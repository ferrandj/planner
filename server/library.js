'use strict';
/**
 * Readable copy of the notes and attachments ("bibliothèque").
 *
 * The planner keeps its data in `state.json` and its attachments in `files/<sha256>` (names nobody can read). This module
 * mirrors them into an ordinary folder that can be read without the planner:
 *
 *   <library>/<subject>/<date> <class>/notes.txt        (the notes and links, as plain text)
 *   <library>/<subject>/<date> <class>/<attachments with their own names>
 *
 * The app tells the server what the folders are called (the server does not understand the schedule): a list of
 * { dir: [subject, class], text, files: [{ id, name }] }. The folder is a COPY: the planner stays the source of truth
 * and rewrites what it generated. Nothing is ever deleted here: what is no longer wanted (a note removed, a class renamed)
 * is moved to `_Supprimé/<date>/`, and a file that is not ours is moved there before being replaced.
 *
 * Where: LIBRARY_DIR (default: `library` inside the data folder). Mount a NAS folder on it to keep the notes anywhere.
 */
const fs = require('fs');
const path = require('path');
const { writeFileAtomic } = require('./store');

const MANIFEST = '.planner-library.json';
const TRASH = '_Supprimé';
const README = 'LISEZ-MOI.txt';
const NOTES = 'notes.txt';
const MAX_ENTRIES = 5000, MAX_FILES = 300, MAX_TEXT = 500 * 1024, MAX_SEG = 80;
const HEX64 = /^[a-f0-9]{64}$/;

const README_TEXT = [
  'Copie lisible des notes et des fichiers du planner.',
  '',
  'Un dossier par matière, un sous-dossier par cours (ou devoir, examen), avec :',
  '  - notes.txt : les notes et les liens, en texte simple ;',
  '  - les fichiers joints, sous leur nom d\'origine.',
  '',
  'Ce dossier est une COPIE : le planner le met à jour tout seul. Les modifications faites ici ne sont pas',
  'reprises par le planner (elles peuvent être écrasées). Ce qui a été supprimé dans le planner est rangé dans',
  '« ' + TRASH + ' », jamais effacé.',
  ''
].join('\n');

/** A folder or file name that is safe on every system (no separators, no control characters, no dots-only names). */
function seg(s, fallback) {
  let v = String(s === undefined || s === null ? '' : s)
    .replace(/[\u0000-\u001f\u007f<>:"/\\|?*]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^[.\s]+/, '')
    .replace(/[. ]+$/, '');
  if (v.length > MAX_SEG) v = v.slice(0, MAX_SEG).trim();
  if (!v || /^(con|prn|aux|nul|com\d|lpt\d)(\..*)?$/i.test(v)) v = fallback || '_';
  if (v === TRASH) v = '_' + v;
  return v;
}

function withSuffix(name, n) {
  const dot = name.lastIndexOf('.');
  return dot > 0 && dot > name.length - 8 ? name.slice(0, dot) + ' (' + n + ')' + name.slice(dot) : name + ' (' + n + ')';
}

const stamp = (ms) => new Date(ms).toISOString().replace(/[-:]/g, '').replace(/\..*/, '').replace('T', '-');

class Library {
  constructor(dir, store, opts) {
    opts = opts || {};
    this.dir = dir;
    this.store = store;
    this.now = opts.now || Date.now;
    this.last = null;    // { at, notes, files, errors }
    this.error = '';
    try { const m = this._readManifest(); if (m && m.last) this.last = m.last; } catch (e) { /* first start */ }
  }

  _readManifest() {
    try { return JSON.parse(fs.readFileSync(path.join(this.dir, MANIFEST), 'utf8')); } catch (e) { return null; }
  }

  status() {
    return { enabled: true, dir: this.dir, notes: this.last ? this.last.notes : 0, files: this.last ? this.last.files : 0, at: this.last ? this.last.at : 0, error: this.error };
  }

  /** Turn what the app sent into the list of things to write: relative path -> { text } | { id }. Names are made safe and unique. */
  plan(entries) {
    if (!Array.isArray(entries)) return null;
    const out = new Map();
    const used = new Set();                                    // lower-cased folder paths (case-insensitive file systems)
    for (const e of entries.slice(0, MAX_ENTRIES)) {
      if (!e || !Array.isArray(e.dir) || !e.dir.length) continue;
      const parts = e.dir.slice(0, 3).map((s) => seg(s));
      let dirKey = parts.join('/'), n = 1;
      while (used.has(dirKey.toLowerCase())) { n++; dirKey = parts.slice(0, -1).concat(withSuffix(parts[parts.length - 1], n)).join('/'); }
      used.add(dirKey.toLowerCase());
      const names = new Set([NOTES.toLowerCase()]);
      const text = typeof e.text === 'string' ? e.text.slice(0, MAX_TEXT) : '';
      if (text.trim()) out.set(dirKey + '/' + NOTES, { text: text.replace(/\r\n?/g, '\n') });
      for (const f of (Array.isArray(e.files) ? e.files : []).slice(0, MAX_FILES)) {
        if (!f || typeof f.id !== 'string' || !HEX64.test(f.id)) continue;
        let name = seg(f.name, 'fichier'), k = 1;
        while (names.has(name.toLowerCase())) { k++; name = withSuffix(seg(f.name, 'fichier'), k); }
        names.add(name.toLowerCase());
        out.set(dirKey + '/' + name, { id: f.id });
      }
    }
    return out;
  }

  _abs(rel) { return path.join(this.dir, ...rel.split('/')); }

  /** Move something out of the way instead of deleting it. */
  _trash(rel, at) {
    const from = this._abs(rel);
    if (!fs.existsSync(from)) return;
    const to = path.join(this.dir, TRASH, stamp(at), ...rel.split('/'));
    fs.mkdirSync(path.dirname(to), { recursive: true });
    let dest = to, k = 1;
    while (fs.existsSync(dest)) { k++; dest = withSuffix(to, k); }
    fs.renameSync(from, dest);
  }

  _prune(rel) {
    let d = path.dirname(this._abs(rel));
    while (d.length > this.dir.length) {
      try { fs.rmdirSync(d); } catch (e) { break; }             // only when empty
      d = path.dirname(d);
    }
  }

  sync(entries) {
    const want = this.plan(entries);
    if (!want) return { ok: false, error: 'invalid library' };
    const at = this.now();
    let errors = 0, firstError = '';
    const fail = (e) => { errors++; if (!firstError) firstError = (e && e.code) || (e && e.message) || 'error'; };
    try {
      fs.mkdirSync(this.dir, { recursive: true });
      fs.accessSync(this.dir, fs.constants.W_OK);
    } catch (e) {
      this.error = 'The library folder cannot be written (' + ((e && e.code) || 'error') + ').';
      return { ok: false, error: this.error };
    }
    const old = (this._readManifest() || {}).files || {};
    const next = {};
    for (const [rel, item] of want) {
      try {
        const abs = this._abs(rel);
        fs.mkdirSync(path.dirname(abs), { recursive: true });
        const ours = Object.prototype.hasOwnProperty.call(old, rel);
        let exists = false;
        try { exists = fs.statSync(abs).isFile(); } catch (e) { /* not there yet */ }
        if (item.text !== undefined) {
          const body = item.text.endsWith('\n') ? item.text : item.text + '\n';
          let same = false;
          if (exists) { try { same = fs.readFileSync(abs, 'utf8') === body; } catch (e) { /* unreadable */ } }
          if (!same) {
            if (exists && !ours) this._trash(rel, at);          // a file of the user's own with that name: kept aside
            writeFileAtomic(abs, body);
          }
          next[rel] = 't';
        } else {
          const src = this.store.getFile(item.id);
          if (!src) { fail({ code: 'missing file' }); continue; }
          const same = exists && ours && old[rel] === item.id && fs.statSync(abs).size === src.size;
          if (!same) {
            if (exists) this._trash(rel, at);                   // other content under the same name: the old one is kept aside
            fs.copyFileSync(src.path, abs);
          }
          next[rel] = item.id;
        }
      } catch (e) { fail(e); }
    }
    // what we wrote earlier and is not wanted any more is moved aside, never deleted
    for (const rel of Object.keys(old)) {
      if (Object.prototype.hasOwnProperty.call(next, rel) || want.has(rel)) continue;
      try { this._trash(rel, at); this._prune(rel); } catch (e) { fail(e); }
    }
    let notes = 0, files = 0;
    Object.keys(next).forEach((r) => { if (next[r] === 't') notes++; else files++; });
    this.last = { at, notes, files, errors };
    this.error = errors ? 'Some items could not be written (' + firstError + ').' : '';
    try {
      writeFileAtomic(path.join(this.dir, MANIFEST), JSON.stringify({ files: next, last: this.last }));
      if (!fs.existsSync(path.join(this.dir, README))) writeFileAtomic(path.join(this.dir, README), README_TEXT);
    } catch (e) { fail(e); }
    return Object.assign({ ok: true }, this.status());
  }
}

module.exports = { Library, seg, MANIFEST, TRASH };
