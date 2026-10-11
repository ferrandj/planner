'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { Store } = require('../server/store');
const seed = require('../server/seed');
const { createServer } = require('../server/index');

const H = { 'X-Planner-Client': '1', 'Content-Type': 'application/json' };

async function start(extra) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'planner-api-'));
  const store = new Store(dir, { seed: () => seed.demo(new Date()) }).init();
  const server = createServer(Object.assign({ store }, extra || {}));
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const url = 'http://127.0.0.1:' + server.address().port;
  return { url, server, store, dir };
}

test('state round trip with revisions and 409 on stale write', async () => {
  const { url, server } = await start();
  try {
    const s = await (await fetch(url + '/api/state')).json();
    assert.ok(s.rev >= 1 && Array.isArray(s.base.s));
    let r = await fetch(url + '/api/state', { method: 'PUT', headers: H, body: JSON.stringify({ baseRev: s.rev, data: { done: { a: true } } }) });
    assert.strictEqual(r.status, 200);
    const { rev } = await r.json();
    assert.strictEqual(rev, s.rev + 1);
    r = await fetch(url + '/api/state', { method: 'PUT', headers: H, body: JSON.stringify({ baseRev: s.rev, data: { done: {} } }) });
    assert.strictEqual(r.status, 409);
    const c = await r.json();
    assert.deepStrictEqual(c.data, { done: { a: true } });
    assert.strictEqual((await (await fetch(url + '/api/rev')).json()).rev, rev);
  } finally { server.close(); }
});

test('writes without the client header or from another origin are refused', async () => {
  const { url, server, store } = await start();
  try {
    const body = JSON.stringify({ baseRev: store.get().rev, data: {} });
    let r = await fetch(url + '/api/state', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body });
    assert.strictEqual(r.status, 403);
    r = await fetch(url + '/api/state', { method: 'PUT', headers: Object.assign({ Origin: 'http://evil.example' }, H), body });
    assert.strictEqual(r.status, 403);
  } finally { server.close(); }
});

test('file upload, safe serving headers', async () => {
  const { url, server } = await start();
  try {
    const png = Buffer.from('89504e470d0a1a0a', 'hex');
    let r = await fetch(url + '/api/files', { method: 'POST', headers: { 'X-Planner-Client': '1', 'Content-Type': 'image/png' }, body: png });
    const { id } = await r.json();
    r = await fetch(url + '/api/files/' + id);
    assert.strictEqual(r.headers.get('content-type'), 'image/png');
    const html = Buffer.from('<script>alert(1)</script>');
    r = await fetch(url + '/api/files', { method: 'POST', headers: { 'X-Planner-Client': '1', 'Content-Type': 'text/html' }, body: html });
    const h = await r.json();
    r = await fetch(url + '/api/files/' + h.id + '?name=a.html');
    assert.strictEqual(r.headers.get('content-type'), 'application/octet-stream');
    assert.match(r.headers.get('content-disposition'), /^attachment/);
    assert.strictEqual((await fetch(url + '/api/files/' + '0'.repeat(64))).status, 404);
  } finally { server.close(); }
});

test('backups listing and restore over HTTP', async () => {
  const { url, server, store } = await start();
  try {
    const rev0 = store.get().rev;
    await fetch(url + '/api/state', { method: 'PUT', headers: H, body: JSON.stringify({ baseRev: rev0, data: { v: 1 } }) });
    const list = (await (await fetch(url + '/api/backups')).json()).backups;
    assert.ok(list.length >= 1);
    // wipe by mistake ...
    await fetch(url + '/api/state', { method: 'PUT', headers: H, body: JSON.stringify({ baseRev: store.get().rev, data: {} }) });
    // ... and get it back from the snapshot taken before the wipe
    const snap = (await (await fetch(url + '/api/backups')).json()).backups.find((b) => b.tag === 'shrink' || !b.tag);
    const r = await fetch(url + '/api/backups/restore', { method: 'POST', headers: H, body: JSON.stringify({ name: snap.name }) });
    assert.strictEqual(r.status, 200);
    assert.ok(store.get().data.v === 1 || store.get().data.edits);
  } finally { server.close(); }
});

test('static files, traversal and healthz', async () => {
  const { url, server } = await start();
  try {
    assert.strictEqual((await fetch(url + '/healthz')).status, 200);
    const r = await fetch(url + '/merge.js');
    assert.strictEqual(r.status, 200);
    assert.match(r.headers.get('content-security-policy'), /default-src 'self'/);
    const raw = await new Promise((resolve) => {
      require('net').connect(server.address().port, '127.0.0.1', function () {
        this.write('GET /../server/store.js HTTP/1.1\r\nHost: x\r\nConnection: close\r\n\r\n');
        let b = ''; this.on('data', (d) => (b += d)); this.on('end', () => resolve(b));
      });
    });
    assert.doesNotMatch(raw, /class Store/);
  } finally { server.close(); }
});

test('optional basic auth protects everything except /healthz', async () => {
  const { url, server } = await start({ authUser: 'u', authPassword: 'p' });
  try {
    assert.strictEqual((await fetch(url + '/healthz')).status, 200);
    assert.strictEqual((await fetch(url + '/api/state')).status, 401);
    const ok = await fetch(url + '/api/state', { headers: { Authorization: 'Basic ' + Buffer.from('u:p').toString('base64') } });
    assert.strictEqual(ok.status, 200);
    const bad = await fetch(url + '/api/state', { headers: { Authorization: 'Basic ' + Buffer.from('u:x').toString('base64') } });
    assert.strictEqual(bad.status, 401);
  } finally { server.close(); }
});
