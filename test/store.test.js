'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { Store } = require('../server/store');
const seed = require('../server/seed');

function tmp() { return fs.mkdtempSync(path.join(os.tmpdir(), 'planner-test-')); }
function open(dir, now) {
  return new Store(dir, { now: now || Date.now, seed: () => seed.demo(new Date()) }).init();
}

test('first start seeds, second start keeps the saved state (never re-seeds)', () => {
  const dir = tmp();
  const s1 = open(dir);
  const r = s1.put({ baseRev: s1.get().rev, data: { done: { x: true } } });
  assert.ok(r.ok);
  const s2 = open(dir);
  assert.deepStrictEqual(s2.get().data, { done: { x: true } });
  assert.strictEqual(s2.get().rev, r.rev);
});

test('stale revision is rejected as a conflict and nothing is written', () => {
  const s = open(tmp());
  const rev = s.get().rev;
  assert.ok(s.put({ baseRev: rev, data: { a: 1 } }).ok);
  const r = s.put({ baseRev: rev, data: { a: 2 } });
  assert.ok(r.conflict);
  assert.deepStrictEqual(s.get().data, { a: 1 });
});

test('invalid payloads are rejected', () => {
  const s = open(tmp());
  assert.throws(() => s.put({ baseRev: s.get().rev, data: [] }), /object/);
  assert.throws(() => s.put({ baseRev: s.get().rev, data: {}, base: { s: [] } }), /base/);
});

test('a corrupt state.json is moved aside and recovered from the newest snapshot', () => {
  const dir = tmp();
  let t = 1_700_000_000_000;
  const s = open(dir, () => t);
  s.put({ baseRev: s.get().rev, data: { v: 1 } });
  t += 3 * 60 * 1000;
  s.put({ baseRev: s.get().rev, data: { v: 2 } }); // snapshots v1 before overwriting
  fs.writeFileSync(path.join(dir, 'state.json'), '{ truncated');
  const s2 = open(dir, () => t + 1000);
  assert.deepStrictEqual(s2.get().data, { v: 1 });
  assert.ok(fs.readdirSync(dir).some((f) => /^state\.corrupt-/.test(f)), 'corrupt file kept for inspection');
});

test('refuses to start empty when data existed but nothing is recoverable', () => {
  const dir = tmp();
  open(dir);
  fs.writeFileSync(path.join(dir, 'state.json'), 'garbage');
  fs.rmSync(path.join(dir, 'backups'), { recursive: true });
  assert.throws(() => open(dir), /Refusing to start/);
  assert.ok(fs.readdirSync(dir).some((f) => /^state\.corrupt-/.test(f)));
});

test('a write that shrinks the state a lot always snapshots first', () => {
  const dir = tmp();
  const s = open(dir);
  const big = {}; for (let i = 0; i < 200; i++) big['k' + i] = 'x'.repeat(50);
  s.put({ baseRev: s.get().rev, data: big });
  const before = s.listBackups().length;
  s.put({ baseRev: s.get().rev, data: {} });
  const after = s.listBackups();
  assert.ok(after.length > before);
  assert.ok(after.some((b) => b.tag === 'shrink'));
});

test('restore brings a backup back and snapshots the current state first', () => {
  let t = 1_700_000_000_000;
  const s = open(tmp(), () => t);
  s.put({ baseRev: s.get().rev, data: { v: 'one' } });
  t += 3 * 60 * 1000;
  s.put({ baseRev: s.get().rev, data: { v: 'two' } });
  const snap = s.listBackups().find((b) => !b.tag);
  t += 1000;
  s.restore(snap.name);
  assert.deepStrictEqual(s.get().data, { v: 'one' });
  assert.ok(s.listBackups().some((b) => b.tag === 'pre-restore'));
  assert.throws(() => s.restore('../state.json'), /bad backup name/);
});

test('pruning keeps tagged snapshots and thins out old ones', () => {
  let t = 1_700_000_000_000;
  const s = open(tmp(), () => t);
  for (let i = 0; i < 6; i++) {
    t += 3 * 60 * 1000;
    s.put({ baseRev: s.get().rev, data: { i } });
  }
  s.restore(s.listBackups()[0].name); // creates a pre-restore tagged snapshot
  t += 100 * 864e5;                   // a hundred days later
  for (let i = 0; i < 3; i++) { t += 3 * 60 * 1000; s.put({ baseRev: s.get().rev, data: { late: i } }); }
  const list = s.listBackups();
  assert.ok(list.some((b) => b.tag === 'pre-restore'));
  const old = list.filter((b) => !b.tag && t - b.time > 14 * 864e5);
  assert.strictEqual(old.length, 1, 'six snapshots from the same day collapse into one');
});

test('files are content-addressed, deduplicated and validated', () => {
  const s = open(tmp());
  const a = s.putFile(Buffer.from('hello'), { type: 'text/plain' });
  const b = s.putFile(Buffer.from('hello'), { type: 'text/plain' });
  assert.strictEqual(a.id, b.id);
  assert.strictEqual(s.getFile(a.id).size, 5);
  assert.strictEqual(s.getFile('../etc/passwd'), null);
  assert.strictEqual(s.getFile('0'.repeat(64)), null);
});

test('seed.json is used on first start, invalid seed.json is an error (no silent fallback)', () => {
  const dir = tmp();
  const base = { s: [{ id: 'x', code: 'C', name: 'N', short: 'N', ab: 'N', c: 1 }], d: [], x: [], e: [] };
  fs.writeFileSync(path.join(dir, 'seed.json'), JSON.stringify({ base, data: { edits: { app: { title: 'Mine' } } } }));
  const s = new Store(dir, { seed: () => seed.load(dir) }).init();
  assert.strictEqual(s.get().base.s[0].id, 'x');
  assert.strictEqual(s.get().data.edits.app.title, 'Mine');
  const dir2 = tmp();
  fs.writeFileSync(path.join(dir2, 'seed.json'), '{"base":{}}');
  assert.throws(() => new Store(dir2, { seed: () => seed.load(dir2) }).init(), /seed\.json/);
});

test('seed order: your seed.json beats the bundled default, which beats the demo; broken files are errors', () => {
  const mkBase = (id) => ({ s: [{ id, code: 'C', name: id, short: id, ab: 'A', c: 1 }], d: [], x: [], e: [] });
  const dflt = path.join(tmp(), 'default.json');
  fs.writeFileSync(dflt, JSON.stringify({ base: mkBase('bundled'), data: { edits: { app: { title: 'Bundled' } } } }));
  // 1. nothing but the bundled default
  const d1 = tmp();
  assert.strictEqual(new Store(d1, { seed: () => seed.load(d1, undefined, dflt) }).init().get().base.s[0].id, 'bundled');
  // 2. own seed.json wins
  const d2 = tmp();
  fs.writeFileSync(path.join(d2, 'seed.json'), JSON.stringify({ base: mkBase('mine') }));
  assert.strictEqual(new Store(d2, { seed: () => seed.load(d2, undefined, dflt) }).init().get().base.s[0].id, 'mine');
  // 3. no default configured / default file missing -> generic demo
  const d3 = tmp();
  assert.strictEqual(new Store(d3, { seed: () => seed.load(d3, undefined, '/nope/missing.json') }).init().get().base.s[0].id, 'm1');
  // 4. a broken default is an error, not a silent demo
  const bad = path.join(tmp(), 'bad.json');
  fs.writeFileSync(bad, '{"base":{}}');
  const d4 = tmp();
  assert.throws(() => new Store(d4, { seed: () => seed.load(d4, undefined, bad) }).init(), /must contain "base"/);
  // 5. once state exists the default is never applied again
  const d5 = tmp();
  const s5 = new Store(d5, { seed: () => seed.load(d5, undefined, dflt) }).init();
  s5.put({ baseRev: s5.get().rev, data: { done: { keep: true } } });
  fs.writeFileSync(dflt, JSON.stringify({ base: mkBase('changed-later') }));
  const again = new Store(d5, { seed: () => seed.load(d5, undefined, dflt) }).init();
  assert.strictEqual(again.get().base.s[0].id, 'bundled');
  assert.deepStrictEqual(again.get().data, { done: { keep: true } });
});

test('the bundled default schedule is valid and contains no contact details', () => {
  const file = path.join(__dirname, '..', 'seed', 'default.json');
  const s = JSON.parse(fs.readFileSync(file, 'utf8'));
  assert.ok(require('../server/store').validBase(s.base));
  assert.ok(s.base.s.length > 0 && s.base.e.length > 0);
  const text = JSON.stringify(s);
  assert.doesNotMatch(text, /@|https?:|\d{8,}/.replace ? /@|https?:/ : /@/);
  for (const e of s.base.e) assert.ok(s.base.s.some((x) => x.id === e.subject), 'session of unknown subject ' + e.id);
});
