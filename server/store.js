'use strict';
/*
 * Persistence layer.
 *
 * Design goals (in priority order):
 *   1. Never lose user data. Writes are atomic (tmp file + fsync + rename), the
 *      previous version is snapshotted before it is overwritten, uploaded files
 *      are content-addressed and never deleted, and a corrupt state file is
 *      moved aside (never removed) and recovered from the newest valid snapshot.
 *   2. Never silently reset. Seed data is only used when there is no state at
 *      all (no state file, no snapshot, no "corrupt" leftovers).
 *   3. Detect concurrent edits from several devices (optimistic revisions).
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const SCHEMA = 1;
const SNAPSHOT_EVERY_MS = 15 * 1000;
const SHRINK_RATIO = 0.6;
const HEX64 = /^[a-f0-9]{64}$/;

function isObj(v) { return v !== null && typeof v === 'object' && !Array.isArray(v); }

function validBase(b) {
  return isObj(b) && ['s', 'd', 'x', 'e'].every(function (k) { return Array.isArray(b[k]); });
}

function validDoc(d) {
  return isObj(d) && isObj(d.data) && validBase(d.base) && Number.isInteger(d.rev) && d.rev >= 0;
}

function fsyncDir(dir) {
  try {
    const fd = fs.openSync(dir, 'r');
    try { fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
  } catch (e) { /* not supported everywhere (e.g. some network filesystems) */ }
}

function writeFileAtomic(file, text) {
  const tmp = file + '.' + process.pid + '.tmp';
  const fd = fs.openSync(tmp, 'w', 0o644);
  try {
    fs.writeSync(fd, text);
    fs.fsyncSync(fd);
  } finally { fs.closeSync(fd); }
  fs.renameSync(tmp, file);
  fsyncDir(path.dirname(file));
}

function stamp(ms) {
  return new Date(ms).toISOString().replace(/[-:]/g, '').replace('.', '').replace('T', '-'); // 20260101-120000123Z
}

function parseStamp(name) {
  const m = /^state-(\d{8})-(\d{6})(\d{3})Z-r(\d+)(?:-([a-z-]+))?\.json$/.exec(name);
  if (!m) return null;
  const d = m[1], t = m[2];
  const ms = Date.parse(d.slice(0, 4) + '-' + d.slice(4, 6) + '-' + d.slice(6, 8) + 'T' + t.slice(0, 2) + ':' + t.slice(2, 4) + ':' + t.slice(4, 6) + '.' + m[3] + 'Z');
  return { time: ms, rev: +m[4], tag: m[5] || '' };
}

class Store {
  constructor(dir, opts) {
    opts = opts || {};
    this.dir = dir;
    this.now = opts.now || Date.now;
    this.seed = opts.seed; // function () => { base, data }
    this.snapshotEveryMs = opts.snapshotEveryMs === undefined ? SNAPSHOT_EVERY_MS : opts.snapshotEveryMs;
    this.stateFile = path.join(dir, 'state.json');
    this.backupDir = path.join(dir, 'backups');
    this.filesDir = path.join(dir, 'files');
    this.doc = null;
    this.lastSnapshot = 0;
  }

  init() {
    fs.mkdirSync(this.backupDir, { recursive: true });
    fs.mkdirSync(this.filesDir, { recursive: true });
    const found = fs.existsSync(this.stateFile);
    let doc = null;
    if (found) {
      doc = this._readValid(this.stateFile);
      if (!doc) {
        const aside = path.join(this.dir, 'state.corrupt-' + stamp(this.now()) + '.json');
        fs.renameSync(this.stateFile, aside);
        console.error('[store] state.json is unreadable; moved to ' + path.basename(aside));
      }
    }
    if (!doc) doc = this._recoverFromSnapshots();
    if (!doc) {
      if (found || this._hasCorruptLeftovers()) {
        throw new Error('No valid state could be recovered but previous data exists in ' + this.dir +
          '. Refusing to start with an empty planner so nothing gets overwritten. Inspect the files and restore a backup manually.');
      }
      const seed = this.seed ? this.seed() : null;
      if (!seed) throw new Error('No seed available');
      doc = { schema: SCHEMA, rev: 1, updatedAt: new Date(this.now()).toISOString(), base: seed.base, data: seed.data };
      writeFileAtomic(this.stateFile, JSON.stringify(doc));
      console.log('[store] first start: created initial state');
    } else if (!found || !fs.existsSync(this.stateFile)) {
      writeFileAtomic(this.stateFile, JSON.stringify(doc));
    }
    this.doc = doc;
    this._migrate();
    return this;
  }

  _hasCorruptLeftovers() {
    return fs.readdirSync(this.dir).some(function (f) { return /^state\.corrupt-/.test(f); });
  }

  _readValid(file) {
    try {
      const d = JSON.parse(fs.readFileSync(file, 'utf8'));
      return validDoc(d) ? d : null;
    } catch (e) { return null; }
  }

  _recoverFromSnapshots() {
    const list = this.listBackups();
    for (let i = 0; i < list.length; i++) {
      const d = this._readValid(path.join(this.backupDir, list[i].name));
      if (d) {
        console.error('[store] recovered state from backup ' + list[i].name);
        return d;
      }
    }
    return null;
  }

  _migrate() {
    // Placeholder for future schema upgrades. Always snapshot before touching anything.
    if (this.doc.schema === SCHEMA) return;
    this._snapshot('pre-migration');
    this.doc.schema = SCHEMA;
    writeFileAtomic(this.stateFile, JSON.stringify(this.doc));
  }

  get() { return this.doc; }

  /** Write a new version. Returns { ok:true, rev } or { conflict:true, doc }. */
  put(input) {
    const cur = this.doc;
    if (!isObj(input) || !isObj(input.data)) throw Object.assign(new Error('data must be an object'), { status: 400 });
    if (input.base !== undefined && !validBase(input.base)) throw Object.assign(new Error('invalid base'), { status: 400 });
    if (input.baseRev !== cur.rev) return { conflict: true, doc: cur };
    return { ok: true, rev: this._commit({ base: input.base || cur.base, data: input.data }) };
  }

  _commit(next, tag) {
    const cur = this.doc;
    const text = JSON.stringify({
      schema: SCHEMA, rev: cur.rev + 1, updatedAt: new Date(this.now()).toISOString(), base: next.base, data: next.data
    });
    const shrink = text.length < JSON.stringify(cur).length * SHRINK_RATIO;
    if (tag || shrink || this.now() - this.lastSnapshot >= this.snapshotEveryMs) this._snapshot(tag || (shrink ? 'shrink' : ''));
    writeFileAtomic(this.stateFile, text);
    this.doc = JSON.parse(text);
    return this.doc.rev;
  }

  _snapshot(tag) {
    const t = this.now();
    const name = 'state-' + stamp(t) + '-r' + this.doc.rev + (tag ? '-' + tag : '') + '.json';
    writeFileAtomic(path.join(this.backupDir, name), JSON.stringify(this.doc));
    this.lastSnapshot = t;
    this._prune();
    return name;
  }

  /* Keep: everything < 2 days, hourly < 14 days, daily < 180 days, monthly forever. Tagged snapshots are never pruned. */
  _prune() {
    const now = this.now();
    const items = this.listBackups(); // newest first
    const seen = new Set();
    items.forEach((it) => {
      if (it.tag) return;
      const age = now - it.time, iso = new Date(it.time).toISOString();
      let key = null;
      if (age < 2 * 864e5) return;
      else if (age < 14 * 864e5) key = 'h' + iso.slice(0, 13);
      else if (age < 180 * 864e5) key = 'd' + iso.slice(0, 10);
      else key = 'm' + iso.slice(0, 7);
      if (seen.has(key)) {
        try { fs.unlinkSync(path.join(this.backupDir, it.name)); } catch (e) { /* ignore */ }
      } else seen.add(key);
    });
  }

  listBackups() {
    let names = [];
    try { names = fs.readdirSync(this.backupDir); } catch (e) { return []; }
    const out = [];
    names.forEach((name) => {
      const p = parseStamp(name);
      if (!p) return;
      let size = 0;
      try { size = fs.statSync(path.join(this.backupDir, name)).size; } catch (e) { return; }
      out.push({ name: name, time: p.time, rev: p.rev, tag: p.tag, size: size });
    });
    out.sort(function (a, b) { return b.time - a.time || b.rev - a.rev; });
    return out;
  }

  /** Restore a snapshot as a new revision. The current state is snapshotted first. */
  restore(name) {
    if (!parseStamp(name)) throw Object.assign(new Error('bad backup name'), { status: 400 });
    const d = this._readValid(path.join(this.backupDir, path.basename(name)));
    if (!d) throw Object.assign(new Error('backup not found or invalid'), { status: 404 });
    return this._commit({ base: d.base, data: d.data }, 'pre-restore');
  }

  /* ---- uploaded files: content-addressed, immutable, never deleted ---- */
  putFile(buf, meta) {
    const id = crypto.createHash('sha256').update(buf).digest('hex');
    const file = path.join(this.filesDir, id);
    if (!fs.existsSync(file)) {
      writeFileAtomic(file, buf);
    }
    const metaFile = file + '.json';
    if (!fs.existsSync(metaFile)) {
      writeFileAtomic(metaFile, JSON.stringify({ type: meta.type || 'application/octet-stream', size: buf.length }));
    }
    return { id: id, size: buf.length };
  }

  getFile(id) {
    if (!HEX64.test(id)) return null;
    const file = path.join(this.filesDir, id);
    try {
      const st = fs.statSync(file);
      let meta = {};
      try { meta = JSON.parse(fs.readFileSync(file + '.json', 'utf8')); } catch (e) { /* no meta */ }
      return { path: file, size: st.size, type: meta.type || 'application/octet-stream' };
    } catch (e) { return null; }
  }
}

module.exports = { Store, SCHEMA, validBase, writeFileAtomic, parseStamp };
