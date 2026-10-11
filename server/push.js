'use strict';
/**
 * Phone notifications (Web Push), with no dependency.
 *
 * - The browser of each device subscribes (PushManager) and sends its subscription here.
 * - The app sends the list of upcoming reminders (what to say, and when) - the server does not need to understand the
 *   planner, it only keeps that list and sends a push when a reminder is due.
 * - Messages are encrypted for the device (RFC 8291, aes128gcm) and signed with this server's own VAPID key (RFC 8292).
 *   The key pair is created on first use and kept in the data folder (vapid.json); it never leaves the server.
 *
 * Files in the data folder: vapid.json (key pair), push.json (devices), reminders.json (schedule + what was already sent).
 * None of them is part of the planner data: losing them only means notifications must be re-enabled.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { writeFileAtomic } = require('./store');

const b64u = (buf) => Buffer.from(buf).toString('base64url');
const unb64u = (s) => Buffer.from(String(s), 'base64url');

function generateVapid() {
  const { privateKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  const jwk = privateKey.export({ format: 'jwk' });
  return { publicKey: b64u(Buffer.concat([Buffer.from([4]), unb64u(jwk.x), unb64u(jwk.y)])), privateJwk: jwk };
}

/** Authorization header proving to the push service that this server is the one the device subscribed to. */
function vapidAuthorization(endpoint, vapid, subject, nowMs) {
  const aud = new URL(endpoint).origin;
  const head = b64u(JSON.stringify({ typ: 'JWT', alg: 'ES256' }));
  const body = b64u(JSON.stringify({ aud: aud, exp: Math.floor((nowMs || Date.now()) / 1000) + 12 * 3600, sub: subject }));
  const key = crypto.createPrivateKey({ key: vapid.privateJwk, format: 'jwk' });
  const sig = crypto.sign('sha256', Buffer.from(head + '.' + body), { key: key, dsaEncoding: 'ieee-p1363' });
  return 'vapid t=' + head + '.' + body + '.' + b64u(sig) + ', k=' + vapid.publicKey;
}

/** RFC 8291 "aes128gcm" encryption of one message for one device. `fixed` is only for tests (salt and sender key). */
function encrypt(plaintext, p256dh, auth, fixed) {
  const uaPublic = unb64u(p256dh), authSecret = unb64u(auth);
  if (uaPublic.length !== 65 || uaPublic[0] !== 4 || authSecret.length < 16) throw new Error('invalid subscription keys');
  const ecdh = crypto.createECDH('prime256v1');
  if (fixed && fixed.senderPrivate) ecdh.setPrivateKey(unb64u(fixed.senderPrivate)); else ecdh.generateKeys();
  const asPublic = ecdh.getPublicKey();
  const secret = ecdh.computeSecret(uaPublic);
  const salt = fixed && fixed.salt ? unb64u(fixed.salt) : crypto.randomBytes(16);
  const prk = Buffer.from(crypto.hkdfSync('sha256', secret, authSecret, Buffer.concat([Buffer.from('WebPush: info\0'), uaPublic, asPublic]), 32));
  const cek = Buffer.from(crypto.hkdfSync('sha256', prk, salt, Buffer.from('Content-Encoding: aes128gcm\0'), 16));
  const nonce = Buffer.from(crypto.hkdfSync('sha256', prk, salt, Buffer.from('Content-Encoding: nonce\0'), 12));
  const cipher = crypto.createCipheriv('aes-128-gcm', cek, nonce);
  const data = Buffer.concat([cipher.update(Buffer.concat([Buffer.from(plaintext), Buffer.from([2])])), cipher.final(), cipher.getAuthTag()]);
  const rs = Buffer.alloc(4);
  rs.writeUInt32BE(4096);
  return Buffer.concat([salt, rs, Buffer.from([asPublic.length]), asPublic, data]);
}

function readJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { return fallback; }
}

const MAX_SUBS = 20, MAX_ITEMS = 1000;

class Push {
  constructor(dir, opts) {
    opts = opts || {};
    this.dir = dir;
    this.fetchFn = opts.fetchFn || ((u, i) => fetch(u, i));
    this.subject = opts.subject || process.env.VAPID_SUBJECT || 'mailto:planner@example.invalid';
    this.allowInsecure = !!opts.allowInsecureEndpoints;
    this.now = opts.now || (() => Date.now());
    this.vapidFile = path.join(dir, 'vapid.json');
    this.subsFile = path.join(dir, 'push.json');
    this.itemsFile = path.join(dir, 'reminders.json');
    this.vapid = readJson(this.vapidFile, null);
    if (!this.vapid || !this.vapid.publicKey || !this.vapid.privateJwk) {
      this.vapid = generateVapid();
      writeFileAtomic(this.vapidFile, JSON.stringify(this.vapid));
      try { fs.chmodSync(this.vapidFile, 0o600); } catch (e) { /* not supported everywhere */ }
    }
    this.subs = (readJson(this.subsFile, { subs: [] }).subs || []).filter((s) => s && s.endpoint);
    const r = readJson(this.itemsFile, { items: [], sent: {} });
    this.items = Array.isArray(r.items) ? r.items : [];
    this.sent = r.sent && typeof r.sent === 'object' ? r.sent : {};
    this.timer = null;
  }

  publicKey() { return this.vapid.publicKey; }

  _saveSubs() { writeFileAtomic(this.subsFile, JSON.stringify({ subs: this.subs })); }
  _saveItems() { writeFileAtomic(this.itemsFile, JSON.stringify({ items: this.items, sent: this.sent })); }

  validEndpoint(endpoint) {
    let u;
    try { u = new URL(String(endpoint)); } catch (e) { return false; }
    if (this.allowInsecure) return u.protocol === 'https:' || u.protocol === 'http:';
    // only real push services: https, never an address of the local network (the server would be tricked into calling it)
    return u.protocol === 'https:' && !/^(localhost|.*\.local|.*\.internal)$/i.test(u.hostname) && !/^[\d.]+$/.test(u.hostname) && u.hostname.indexOf(':') < 0 && u.hostname.indexOf('[') < 0;
  }

  subscribe(sub, ua) {
    const ok = sub && typeof sub.endpoint === 'string' && sub.keys && typeof sub.keys.p256dh === 'string' && typeof sub.keys.auth === 'string';
    if (!ok || !this.validEndpoint(sub.endpoint)) return false;
    try { encrypt('x', sub.keys.p256dh, sub.keys.auth); } catch (e) { return false; }
    this.subs = this.subs.filter((s) => s.endpoint !== sub.endpoint);
    this.subs.push({ endpoint: sub.endpoint, keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth }, added: this.now(), ua: String(ua || '').slice(0, 120) });
    if (this.subs.length > MAX_SUBS) this.subs = this.subs.slice(-MAX_SUBS);
    this._saveSubs();
    return true;
  }

  unsubscribe(endpoint) {
    const n = this.subs.length;
    this.subs = this.subs.filter((s) => s.endpoint !== endpoint);
    if (this.subs.length !== n) this._saveSubs();
    return n - this.subs.length;
  }

  /** Replace the schedule. Items already sent (same id and same moment) are never sent twice. */
  setReminders(items) {
    if (!Array.isArray(items)) return false;
    const now = this.now();
    const clean = [];
    for (const it of items.slice(0, MAX_ITEMS)) {
      if (!it || typeof it.id !== 'string' || !Number.isFinite(it.fireAt) || !Number.isFinite(it.start)) continue;
      if (it.start < now - 60000 || it.start > now + 30 * 864e5) continue;
      clean.push({ id: it.id.slice(0, 160), fireAt: Math.round(it.fireAt), start: Math.round(it.start), title: String(it.title || '').slice(0, 120), body: String(it.body || '').slice(0, 200) });
    }
    this.items = clean;
    this._saveItems();
    return true;
  }

  async _post(sub, payload, ttl) {
    const body = encrypt(JSON.stringify(payload), sub.keys.p256dh, sub.keys.auth);
    const res = await this.fetchFn(sub.endpoint, {
      method: 'POST',
      headers: {
        'Content-Encoding': 'aes128gcm', 'Content-Type': 'application/octet-stream', 'Content-Length': String(body.length),
        TTL: String(ttl), Urgency: 'high', Authorization: vapidAuthorization(sub.endpoint, this.vapid, this.subject, this.now())
      },
      body: body
    });
    if (res.status === 404 || res.status === 410) return 'gone';
    return res.status >= 200 && res.status < 300 ? 'ok' : 'error:' + res.status;
  }

  /** Send one message to every device. Devices the push service says are gone are forgotten. */
  async broadcast(payload, ttl) {
    const results = [];
    for (const sub of this.subs.slice()) {
      let r;
      try { r = await this._post(sub, payload, ttl || 600); } catch (e) { r = 'error:' + (e && e.message); }
      if (r === 'gone') this.unsubscribe(sub.endpoint);
      results.push(r);
    }
    return results;
  }

  /** Send what is due: from `fireAt` until the event starts. */
  async tick() {
    const now = this.now();
    const due = this.items.filter((it) => it.fireAt <= now && now < it.start + 60000 && !this.sent[it.id + '@' + it.fireAt]);
    for (const it of due) {
      this.sent[it.id + '@' + it.fireAt] = now;                   // marked first: never twice, even if sending is slow
      this._saveItems();
      if (this.subs.length) await this.broadcast({ title: it.title, body: it.body, tag: it.id, start: it.start }, Math.max(60, Math.round((it.start - now) / 1000)));
    }
    // housekeeping
    const keepSince = now - 2 * 864e5;
    let changed = false;
    for (const k of Object.keys(this.sent)) if (this.sent[k] < keepSince) { delete this.sent[k]; changed = true; }
    const before = this.items.length;
    this.items = this.items.filter((it) => it.start > now - 10 * 60000);
    if (changed || this.items.length !== before) this._saveItems();
    return due.length;
  }

  start(everyMs) {
    if (this.timer) return;
    this.timer = setInterval(() => { this.tick().catch((e) => console.error('[push]', e && e.message)); }, everyMs || 15000);
    if (this.timer.unref) this.timer.unref();
  }

  stop() { if (this.timer) clearInterval(this.timer); this.timer = null; }
}

module.exports = { Push, encrypt, generateVapid, vapidAuthorization };
