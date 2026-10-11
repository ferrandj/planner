'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { Push, encrypt, vapidAuthorization } = require('../server/push');

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'planner-push-'));

/** A "phone": its own key pair and auth secret, able to decrypt what the server sends (RFC 8291, receiving side). */
function phone() {
  const ecdh = crypto.createECDH('prime256v1');
  ecdh.generateKeys();
  const auth = crypto.randomBytes(16);
  return {
    keys: { p256dh: ecdh.getPublicKey().toString('base64url'), auth: auth.toString('base64url') },
    decrypt(body) {
      const salt = body.subarray(0, 16), idlen = body[20], asPublic = body.subarray(21, 21 + idlen), cipher = body.subarray(21 + idlen);
      const secret = ecdh.computeSecret(asPublic);
      const prk = Buffer.from(crypto.hkdfSync('sha256', secret, auth, Buffer.concat([Buffer.from('WebPush: info\0'), ecdh.getPublicKey(), asPublic]), 32));
      const cek = Buffer.from(crypto.hkdfSync('sha256', prk, salt, Buffer.from('Content-Encoding: aes128gcm\0'), 16));
      const nonce = Buffer.from(crypto.hkdfSync('sha256', prk, salt, Buffer.from('Content-Encoding: nonce\0'), 12));
      const d = crypto.createDecipheriv('aes-128-gcm', cek, nonce);
      d.setAuthTag(cipher.subarray(cipher.length - 16));
      const plain = Buffer.concat([d.update(cipher.subarray(0, cipher.length - 16)), d.final()]);
      assert.strictEqual(plain[plain.length - 1], 2, 'single-record delimiter');
      return plain.subarray(0, plain.length - 1).toString('utf8');
    }
  };
}

test('encryption matches the RFC 8291 test vector', () => {
  const out = encrypt('When I grow up, I want to be a watermelon', 'BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4', 'BTBZMqHH6r4Tts7J_aSIgg',
    { salt: 'DGv6ra1nlYgDCS1FRnbzlw', senderPrivate: 'yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw' });
  assert.strictEqual(out.toString('base64url'),
    'DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPTpK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN');
});

test('a device can read what the server encrypts for it, and nobody else can', () => {
  const a = phone(), b = phone();
  const body = encrypt('{"title":"Hello"}', a.keys.p256dh, a.keys.auth);
  assert.strictEqual(a.decrypt(body), '{"title":"Hello"}');
  assert.throws(() => b.decrypt(body));
});

test('the VAPID signature verifies with the published public key', () => {
  const dir = tmp();
  const p = new Push(dir, { subject: 'mailto:me@example.org' });
  const h = vapidAuthorization('https://push.example.net/send/abc', p.vapid, p.subject, 1_800_000_000_000);
  const m = /^vapid t=([\w-]+)\.([\w-]+)\.([\w-]+), k=([\w-]+)$/.exec(h);
  assert.ok(m);
  assert.strictEqual(m[4], p.publicKey());
  const claims = JSON.parse(Buffer.from(m[2], 'base64url').toString());
  assert.deepStrictEqual([claims.aud, claims.sub], ['https://push.example.net', 'mailto:me@example.org']);
  const pub = crypto.createPublicKey({ key: { kty: 'EC', crv: 'P-256', x: p.vapid.privateJwk.x, y: p.vapid.privateJwk.y }, format: 'jwk' });
  assert.ok(crypto.verify('sha256', Buffer.from(m[1] + '.' + m[2]), { key: pub, dsaEncoding: 'ieee-p1363' }, Buffer.from(m[3], 'base64url')));
  assert.strictEqual(Buffer.from(m[4], 'base64url').length, 65);
});

test('the key pair is created once and kept (private, in the data folder)', () => {
  const dir = tmp();
  const a = new Push(dir).publicKey();
  assert.strictEqual(new Push(dir).publicKey(), a);
  if (process.platform !== 'win32') assert.strictEqual(fs.statSync(path.join(dir, 'vapid.json')).mode & 0o077, 0);
});

function setup(extra) {
  const dir = tmp(), sent = [];
  let now = 1_800_000_000_000, status = 201;
  const p = new Push(dir, Object.assign({
    now: () => now, allowInsecureEndpoints: true,
    fetchFn: async (url, init) => { sent.push({ url, init }); return { status: status }; }
  }, extra || {}));
  return { dir, sent, p, setNow: (n) => { now = n; }, setStatus: (s) => { status = s; }, now: () => now };
}

test('subscriptions are validated, stored, deduplicated and survive a restart', () => {
  const { dir, p } = setup();
  const ph = phone();
  assert.strictEqual(p.subscribe({ endpoint: 'https://push.example.net/1', keys: ph.keys }), true);
  assert.strictEqual(p.subscribe({ endpoint: 'https://push.example.net/1', keys: ph.keys }), true);
  assert.strictEqual(p.subs.length, 1);
  assert.strictEqual(p.subscribe({ endpoint: 'https://push.example.net/2', keys: { p256dh: 'bad', auth: 'bad' } }), false);
  assert.strictEqual(p.subscribe({ endpoint: 'not a url', keys: ph.keys }), false);
  assert.strictEqual(new Push(dir, { allowInsecureEndpoints: true }).subs.length, 1);
  assert.strictEqual(p.unsubscribe('https://push.example.net/1'), 1);
});

test('endpoints on the local network are refused (the server must not be tricked into calling them)', () => {
  const p = new Push(tmp());
  const ph = phone();
  for (const e of ['http://push.example.net/x', 'https://localhost/x', 'https://192.168.1.5/x', 'https://[::1]/x', 'https://nas.local/x', 'https://127.0.0.1:8080/x'])
    assert.strictEqual(p.subscribe({ endpoint: e, keys: ph.keys }), false, e);
  assert.strictEqual(p.subscribe({ endpoint: 'https://fcm.googleapis.com/fcm/send/abc', keys: ph.keys }), true);
});

test('a reminder is pushed once, when it is due, encrypted for the device and signed', async () => {
  const { p, sent, setNow, now } = setup();
  const ph = phone();
  p.subscribe({ endpoint: 'https://push.example.net/1', keys: ph.keys });
  const start = now() + 20 * 60000;
  p.setReminders([{ id: 'e1', fireAt: start - 15 * 60000, start, title: 'Droit', body: 'Starts at 18:30' }]);
  assert.strictEqual(await p.tick(), 0);                                   // not yet
  setNow(start - 15 * 60000);
  assert.strictEqual(await p.tick(), 1);
  assert.strictEqual(sent.length, 1);
  const { init } = sent[0];
  assert.strictEqual(init.headers['Content-Encoding'], 'aes128gcm');
  assert.match(init.headers.Authorization, /^vapid t=.+, k=.+$/);
  assert.strictEqual(init.headers.Urgency, 'high');
  assert.deepStrictEqual(JSON.parse(ph.decrypt(init.body)), { title: 'Droit', body: 'Starts at 18:30', tag: 'e1', start });
  setNow(start - 10 * 60000);
  assert.strictEqual(await p.tick(), 0);                                   // never twice
  p.setReminders([{ id: 'e1', fireAt: start - 15 * 60000, start, title: 'Droit', body: 'Starts at 18:30' }]);   // the app re-sends its list
  assert.strictEqual(await p.tick(), 0);
  assert.strictEqual(sent.length, 1);
});

test('a moved event is announced again at its new time; a past one is not announced at all', async () => {
  const { p, sent, setNow, now } = setup();
  p.subscribe({ endpoint: 'https://push.example.net/1', keys: phone().keys });
  const start = now() + 30 * 60000;
  p.setReminders([{ id: 'e1', fireAt: start - 15 * 60000, start, title: 'A', body: '' }]);
  setNow(start - 15 * 60000);
  await p.tick();
  const moved = start + 60 * 60000;
  p.setReminders([{ id: 'e1', fireAt: moved - 15 * 60000, start: moved, title: 'A', body: '' }]);
  setNow(moved - 15 * 60000);
  await p.tick();
  assert.strictEqual(sent.length, 2);
  setNow(moved + 5 * 60000);                                               // server was down: the event has started
  p.setReminders([{ id: 'late', fireAt: moved - 15 * 60000, start: moved, title: 'B', body: '' }]);
  assert.strictEqual(await p.tick(), 0);
});

test('a device the push service no longer knows is forgotten', async () => {
  const { p, setStatus, now } = setup();
  p.subscribe({ endpoint: 'https://push.example.net/1', keys: phone().keys });
  setStatus(410);
  const r = await p.broadcast({ title: 'x' });
  assert.deepStrictEqual(r, ['gone']);
  assert.strictEqual(p.subs.length, 0);
  assert.ok(now());
});

test('the schedule is validated and bounded', () => {
  const { p, now } = setup();
  assert.strictEqual(p.setReminders('nope'), false);
  p.setReminders([{ id: 'ok', fireAt: now() + 1000, start: now() + 900000, title: 'T'.repeat(500), body: '' }, { id: 5 }, null, { id: 'far', fireAt: 1, start: now() + 90 * 864e5 }, { id: 'old', fireAt: 1, start: now() - 3600000 }]);
  assert.deepStrictEqual(p.items.map((i) => i.id), ['ok']);
  assert.strictEqual(p.items[0].title.length, 120);
});
