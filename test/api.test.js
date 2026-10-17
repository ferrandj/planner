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
  const publicDir = fs.mkdtempSync(path.join(os.tmpdir(), 'planner-public-'));
  fs.writeFileSync(path.join(publicDir, 'index.html'), '<!doctype html><title>t</title>');
  fs.writeFileSync(path.join(publicDir, 'app.js'), 'console.log(1)');
  const server = createServer(Object.assign({ store, publicDir }, extra || {}));
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
    const r = await fetch(url + '/app.js');
    assert.strictEqual(r.status, 200);
    assert.match(r.headers.get('content-security-policy'), /default-src 'self'/);
    assert.match(r.headers.get('content-security-policy'), /media-src 'self' blob:/);       // the voice of the quiz is played from a blob
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

test('the app manifest and service worker are served with the right types and are never cached by the browser', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'planner-pwa-'));
  fs.writeFileSync(path.join(dir, 'index.html'), '<!doctype html><title>t</title>');
  fs.writeFileSync(path.join(dir, 'manifest.webmanifest'), '{"name":"Planner"}');
  fs.writeFileSync(path.join(dir, 'sw.js'), 'self.addEventListener("fetch",()=>{})');
  fs.writeFileSync(path.join(dir, 'icon-192.png'), Buffer.from([0x89, 0x50, 0x4e, 0x47]));
  const store = new Store(fs.mkdtempSync(path.join(os.tmpdir(), 'planner-api-')), { seed: () => seed.demo(new Date()) }).init();
  const server = createServer({ store, publicDir: dir });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const url = 'http://127.0.0.1:' + server.address().port;
  try {
    let r = await fetch(url + '/manifest.webmanifest');
    assert.strictEqual(r.status, 200);
    assert.match(r.headers.get('content-type'), /^application\/manifest\+json/);
    r = await fetch(url + '/sw.js');
    assert.match(r.headers.get('content-type'), /^text\/javascript/);
    assert.strictEqual(r.headers.get('cache-control'), 'no-cache');          // a new release's worker is picked up at once
    r = await fetch(url + '/icon-192.png');
    assert.strictEqual(r.headers.get('content-type'), 'image/png');
  } finally { server.close(); }
});

test('notification endpoints: public key, subscribe, schedule, test message, unsubscribe; CSRF header still required', async () => {
  const { Push } = require('../server/push');
  const crypto = require('crypto');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'planner-pushapi-'));
  const calls = [];
  const push = new Push(dir, { allowInsecureEndpoints: true, fetchFn: async (u, i) => { calls.push({ u, i }); return { status: 201 }; } });
  const { server, url } = await (async () => {
    const store = new Store(fs.mkdtempSync(path.join(os.tmpdir(), 'planner-api-')), { seed: () => seed.demo(new Date()) }).init();
    const s = createServer({ store, push, publicDir: dir });
    await new Promise((r) => s.listen(0, '127.0.0.1', r));
    return { server: s, url: 'http://127.0.0.1:' + s.address().port };
  })();
  try {
    const key = await (await fetch(url + '/api/push/key')).json();
    assert.strictEqual(Buffer.from(key.publicKey, 'base64url').length, 65);
    const ecdh = crypto.createECDH('prime256v1'); ecdh.generateKeys();
    const sub = { endpoint: 'https://push.example.net/abc', keys: { p256dh: ecdh.getPublicKey().toString('base64url'), auth: crypto.randomBytes(16).toString('base64url') } };
    let r = await fetch(url + '/api/push/subscribe', { method: 'POST', body: JSON.stringify({ subscription: sub }) });
    assert.strictEqual(r.status, 403);                                          // no client header
    r = await fetch(url + '/api/push/subscribe', { method: 'POST', headers: H, body: JSON.stringify({ subscription: sub }) });
    assert.strictEqual(r.status, 200);
    assert.strictEqual((await r.json()).devices, 1);
    r = await fetch(url + '/api/push/subscribe', { method: 'POST', headers: H, body: JSON.stringify({ subscription: { endpoint: 'x' } }) });
    assert.strictEqual(r.status, 400);
    const soon = Date.now() + 3600000;
    r = await fetch(url + '/api/reminders', { method: 'PUT', headers: H, body: JSON.stringify({ items: [{ id: 'a', fireAt: soon - 900000, start: soon, title: 'T', body: 'B' }] }) });
    assert.strictEqual(r.status, 200);
    assert.strictEqual(push.items.length, 1);
    r = await fetch(url + '/api/reminders', { method: 'PUT', headers: H, body: JSON.stringify({ items: 'nope' }) });
    assert.strictEqual(r.status, 400);
    r = await fetch(url + '/api/push/test', { method: 'POST', headers: H, body: JSON.stringify({ title: 'Test' }) });
    assert.deepStrictEqual(await r.json(), { devices: 1, results: ['ok'] });
    assert.strictEqual(calls.length, 1);
    r = await fetch(url + '/api/push/unsubscribe', { method: 'POST', headers: H, body: JSON.stringify({ endpoint: sub.endpoint }) });
    assert.deepStrictEqual(await r.json(), { removed: 1 });
  } finally { server.close(); }
});

test('without the notification module the endpoints answer 404 (nothing else changes)', async () => {
  const { url, server } = await start();
  try {
    assert.strictEqual((await fetch(url + '/api/push/key')).status, 404);
    assert.strictEqual((await fetch(url + '/api/state')).status, 200);
  } finally { server.close(); }
});

test('the running version is published (for "what is new")', async () => {
  const { url, server } = await start({ version: '9.8.7' });
  try {
    const r = await fetch(url + '/api/version');
    assert.strictEqual(r.status, 200);
    assert.deepStrictEqual(await r.json(), { version: '9.8.7' });
  } finally { server.close(); }
  const b = await start();
  try { assert.match((await (await fetch(b.url + '/api/version')).json()).version, /^.+$/); } finally { b.server.close(); }
});
