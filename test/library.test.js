'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { Store } = require('../server/store');
const seed = require('../server/seed');
const { Library, seg, TRASH } = require('../server/library');
const { createServer } = require('../server/index');

function setup() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'planner-lib-'));
  const store = new Store(dir, { seed: () => seed.demo(new Date()) }).init();
  const lib = new Library(path.join(dir, 'library'), store, { now: () => Date.UTC(2026, 9, 15, 12, 0, 0) });
  return { dir, store, lib, root: lib.dir };
}
const put = (store, text) => store.putFile(Buffer.from(text), { type: 'text/plain' }).id;
const read = (root, ...p) => fs.readFileSync(path.join(root, ...p), 'utf8');
const list = (root) => fs.readdirSync(root, { recursive: true }).map(String).filter((f) => !f.startsWith('.') && !f.startsWith(TRASH) && fs.statSync(path.join(root, f)).isFile()).sort();

test('names are safe on every system', () => {
  assert.strictEqual(seg('a/b\\c:d*e?'), 'a b c d e');
  assert.strictEqual(seg('..'), '_');
  assert.strictEqual(seg('.hidden'), 'hidden');
  assert.strictEqual(seg('end. '), 'end');
  assert.strictEqual(seg('CON'), '_');
  assert.strictEqual(seg(''), '_');
  assert.strictEqual(seg('x'.repeat(200)).length, 80);
  assert.strictEqual(seg(TRASH), '_' + TRASH);
});

test('writes one folder per class with notes.txt and the attachments under their own names', () => {
  const { store, lib, root } = setup();
  const id = put(store, 'PDF BYTES');
  const r = lib.sync([{ dir: ['Maths', '2026-10-05 Live du soir'], text: 'Chapitre 1\nà revoir', files: [{ id, name: 'cours.pdf' }] }]);
  assert.strictEqual(r.ok, true);
  assert.deepStrictEqual(list(root), ['LISEZ-MOI.txt', 'Maths/2026-10-05 Live du soir/cours.pdf', 'Maths/2026-10-05 Live du soir/notes.txt']);
  assert.strictEqual(read(root, 'Maths', '2026-10-05 Live du soir', 'notes.txt'), 'Chapitre 1\nà revoir\n');
  assert.strictEqual(read(root, 'Maths', '2026-10-05 Live du soir', 'cours.pdf'), 'PDF BYTES');
  assert.deepStrictEqual([r.notes, r.files], [1, 1]);
});

test('same names are made unique, and unsafe names or paths never leave the library', () => {
  const { store, lib, root } = setup();
  const a = put(store, 'A'), b = put(store, 'B');
  lib.sync([
    { dir: ['Maths', 'Cours'], text: 'x', files: [{ id: a, name: 'plan.pdf' }, { id: b, name: 'PLAN.pdf' }, { id: b, name: 'notes.txt' }] },
    { dir: ['maths', 'cours'], text: 'y' },
    { dir: ['..', '..', 'etc'], text: 'z', files: [{ id: a, name: '../../evil.txt' }] }
  ]);
  const files = list(root);
  assert.ok(files.includes('Maths/Cours/plan.pdf') && files.includes('Maths/Cours/PLAN (2).pdf') && files.includes('Maths/Cours/notes (2).txt'), files.join('\n'));
  assert.ok(files.includes('maths/cours (2)/notes.txt') || files.includes('Maths/cours (2)/notes.txt') || files.some((f) => /cours \(2\)\/notes\.txt$/.test(f)), files.join('\n'));
  assert.ok(files.every((f) => !f.includes('..')));
  assert.ok(!fs.existsSync(path.join(root, '..', 'etc')));
  assert.ok(files.some((f) => f.endsWith('etc/notes.txt')) && files.some((f) => f.endsWith('evil.txt')));
});

test('ignores a file id that does not exist, an invalid id and a bad list', () => {
  const { lib, root } = setup();
  const r = lib.sync([{ dir: ['M', 'C'], text: 'ok', files: [{ id: 'f'.repeat(64), name: 'ghost.pdf' }, { id: '../x', name: 'bad' }] }]);
  assert.strictEqual(r.ok, true);
  assert.deepStrictEqual(list(root), ['LISEZ-MOI.txt', 'M/C/notes.txt']);
  assert.strictEqual(lib.sync('nope').ok, false);
});

test('nothing is ever deleted: removed notes go to the trash folder, edited ones are rewritten, the rest is untouched', () => {
  const { store, lib, root } = setup();
  const id = put(store, 'FILE');
  lib.sync([{ dir: ['Maths', 'A'], text: 'one', files: [{ id, name: 'f.pdf' }] }, { dir: ['Maths', 'B'], text: 'keep' }]);
  fs.writeFileSync(path.join(root, 'Maths', 'mine.txt'), 'my own file');       // not ours: never touched
  lib.sync([{ dir: ['Maths', 'A'], text: 'one edited' }, { dir: ['Maths', 'B'], text: 'keep' }]);   // the attachment of A was removed
  assert.strictEqual(read(root, 'Maths', 'A', 'notes.txt'), 'one edited\n');
  assert.ok(!fs.existsSync(path.join(root, 'Maths', 'A', 'f.pdf')));
  const trashed = fs.readdirSync(path.join(root, TRASH), { recursive: true }).map(String).filter((f) => f.endsWith('f.pdf'));
  assert.strictEqual(trashed.length, 1);
  assert.strictEqual(fs.readFileSync(path.join(root, TRASH, trashed[0]), 'utf8'), 'FILE');
  assert.strictEqual(read(root, 'Maths', 'mine.txt'), 'my own file');
  // a class that disappears (renamed): its folder moves to the trash and the new one is written
  lib.sync([{ dir: ['Maths', 'A2'], text: 'one edited' }, { dir: ['Maths', 'B'], text: 'keep' }]);
  assert.ok(!fs.existsSync(path.join(root, 'Maths', 'A')));
  assert.strictEqual(read(root, 'Maths', 'A2', 'notes.txt'), 'one edited\n');
});

test('an empty list from a confused client deletes nothing either', () => {
  const { store, lib, root } = setup();
  const id = put(store, 'IMPORTANT');
  lib.sync([{ dir: ['Maths', 'A'], text: 'precious', files: [{ id, name: 'f.pdf' }] }]);
  lib.sync([]);
  const all = fs.readdirSync(root, { recursive: true }).map(String);
  assert.ok(all.some((f) => f.endsWith('f.pdf')) && all.some((f) => f.endsWith('notes.txt')));
  const inTrash = fs.readdirSync(path.join(root, TRASH), { recursive: true }).map(String).filter((f) => f.endsWith('notes.txt'));
  assert.strictEqual(fs.readFileSync(path.join(root, TRASH, inTrash[0]), 'utf8'), 'precious\n');
});

test('a file of the user with the same name is kept aside before ours is written', () => {
  const { lib, root } = setup();
  fs.mkdirSync(path.join(root, 'Maths', 'A'), { recursive: true });
  fs.writeFileSync(path.join(root, 'Maths', 'A', 'notes.txt'), 'handwritten');
  lib.sync([{ dir: ['Maths', 'A'], text: 'from the planner' }]);
  assert.strictEqual(read(root, 'Maths', 'A', 'notes.txt'), 'from the planner\n');
  const aside = fs.readdirSync(path.join(root, TRASH), { recursive: true }).map(String).filter((f) => f.endsWith('notes.txt'));
  assert.strictEqual(fs.readFileSync(path.join(root, TRASH, aside[0]), 'utf8'), 'handwritten');
});

test('an unchanged library is not rewritten', () => {
  const { lib, root } = setup();
  const e = [{ dir: ['Maths', 'A'], text: 'same' }];
  lib.sync(e);
  const f = path.join(root, 'Maths', 'A', 'notes.txt');
  const t = fs.statSync(f).mtimeMs;
  fs.utimesSync(f, new Date(1000), new Date(1000));
  lib.sync(e);
  assert.strictEqual(fs.statSync(f).mtimeMs, 1000 * 1, 'not rewritten');
  assert.ok(t > 1000);
});

test('the folder can be anywhere (and a folder that cannot be written is reported, not fatal)', () => {
  const { dir, store } = setup();
  const elsewhere = new Library(path.join(dir, 'a', 'b', 'notes-nas'), store);
  assert.strictEqual(elsewhere.sync([{ dir: ['M', 'C'], text: 'hi' }]).ok, true);
  assert.ok(fs.existsSync(path.join(dir, 'a', 'b', 'notes-nas', 'M', 'C', 'notes.txt')));
  const blocked = new Library(path.join(dir, 'state.json', 'x'), store);              // a file in the way
  const r = blocked.sync([{ dir: ['M', 'C'], text: 'hi' }]);
  assert.strictEqual(r.ok, false);
  assert.ok(blocked.status().error);
});

test('API: GET reports the folder, PUT writes it, the client header is required', async () => {
  const { dir, store, lib, root } = setup();
  const publicDir = fs.mkdtempSync(path.join(os.tmpdir(), 'planner-public-'));
  fs.writeFileSync(path.join(publicDir, 'index.html'), '<!doctype html><title>t</title>');
  const server = createServer({ store, publicDir, library: lib });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const url = 'http://127.0.0.1:' + server.address().port;
  try {
    let s = await (await fetch(url + '/api/library')).json();
    assert.strictEqual(s.dir, root);
    assert.strictEqual(s.enabled, true);
    let r = await fetch(url + '/api/library', { method: 'PUT', body: JSON.stringify({ entries: [] }) });
    assert.strictEqual(r.status, 403);
    r = await fetch(url + '/api/library', { method: 'PUT', headers: { 'X-Planner-Client': '1', 'Content-Type': 'application/json' }, body: JSON.stringify({ entries: [{ dir: ['Maths', 'Cours'], text: 'hello' }] }) });
    assert.strictEqual(r.status, 200);
    assert.strictEqual(read(root, 'Maths', 'Cours', 'notes.txt'), 'hello\n');
    s = await (await fetch(url + '/api/library')).json();
    assert.deepStrictEqual([s.notes, s.files], [1, 0]);
    r = await fetch(url + '/api/library', { method: 'PUT', headers: { 'X-Planner-Client': '1' }, body: '{"entries":"nope"}' });
    assert.strictEqual(r.status, 400);
  } finally { server.close(); }
});

test('API: without a library the endpoint says it is off', async () => {
  const { store } = setup();
  const publicDir = fs.mkdtempSync(path.join(os.tmpdir(), 'planner-public-'));
  fs.writeFileSync(path.join(publicDir, 'index.html'), 'x');
  const server = createServer({ store, publicDir });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  try {
    assert.deepStrictEqual(await (await fetch('http://127.0.0.1:' + server.address().port + '/api/library')).json(), { enabled: false });
  } finally { server.close(); }
});
