'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { Store } = require('./store');
const seed = require('./seed');
const { Push } = require('./push');
const { Library } = require('./library');

const MAX_STATE_BYTES = 32 * 1024 * 1024;
const MAX_FILE_BYTES = 25 * 1024 * 1024;
const INLINE_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/avif']);
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon',
  '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json; charset=utf-8', '.txt': 'text/plain; charset=utf-8'
};
const CSP = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; " +
  "font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'";

function safeEqual(a, b) {
  const ha = crypto.createHash('sha256').update(String(a)).digest();
  const hb = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}

function readBody(req, limit) {
  return new Promise(function (resolve, reject) {
    const chunks = [];
    let n = 0;
    req.on('data', function (c) {
      n += c.length;
      if (n > limit) { reject(Object.assign(new Error('payload too large'), { status: 413 })); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', function () { resolve(Buffer.concat(chunks)); });
    req.on('error', reject);
  });
}

function send(res, status, body, headers) {
  const h = Object.assign({ 'Cache-Control': 'no-store' }, headers || {});
  if (body !== null && typeof body === 'object' && !Buffer.isBuffer(body)) {
    body = JSON.stringify(body);
    h['Content-Type'] = 'application/json; charset=utf-8';
  }
  res.writeHead(status, h);
  res.end(body);
}

function createServer(opts) {
  const store = opts.store;
  const PUBLIC_DIR = path.resolve(opts.publicDir || process.env.PUBLIC_DIR || path.join(__dirname, '..', 'web', 'dist'));
  const authUser = opts.authUser, authPass = opts.authPassword;

  async function api(req, res, url) {
    const m = req.method, p = url.pathname;
    if (m !== 'GET' && m !== 'HEAD') {
      // CSRF guard: custom header (forces a CORS preflight, which we never grant) + same-origin check.
      if (req.headers['x-planner-client'] !== '1') return send(res, 403, { error: 'missing client header' });
      const origin = req.headers.origin;
      if (origin) {
        let ok = false;
        try { ok = new URL(origin).host === req.headers.host; } catch (e) { ok = false; }
        if (!ok) return send(res, 403, { error: 'cross-origin request refused' });
      }
    }
    if (p === '/api/state' && m === 'GET') {
      const d = store.get();
      return send(res, 200, { rev: d.rev, base: d.base, data: d.data });
    }
    if (p === '/api/version' && m === 'GET') return send(res, 200, { version: String(opts.version || process.env.APP_VERSION || 'dev') });
    if (p === '/api/rev' && m === 'GET') return send(res, 200, { rev: store.get().rev });
    if (p === '/api/state' && (m === 'PUT' || m === 'POST')) {
      let input;
      try { input = JSON.parse((await readBody(req, MAX_STATE_BYTES)).toString('utf8')); } catch (e) {
        if (e.status) throw e;
        return send(res, 400, { error: 'invalid JSON' });
      }
      const r = store.put(input);
      if (r.conflict) return send(res, 409, { error: 'conflict', rev: r.doc.rev, base: r.doc.base, data: r.doc.data });
      return send(res, 200, { rev: r.rev });
    }
    if (p === '/api/files' && m === 'POST') {
      const buf = await readBody(req, MAX_FILE_BYTES);
      if (!buf.length) return send(res, 400, { error: 'empty file' });
      const type = String(req.headers['content-type'] || 'application/octet-stream').split(';')[0].trim().toLowerCase();
      return send(res, 200, store.putFile(buf, { type: /^[a-z0-9.+-]+\/[a-z0-9.+-]+$/.test(type) ? type : 'application/octet-stream' }));
    }
    const fm = /^\/api\/files\/([a-f0-9]{64})$/.exec(p);
    if (fm && (m === 'GET' || m === 'HEAD')) {
      const f = store.getFile(fm[1]);
      if (!f) return send(res, 404, { error: 'not found' });
      const inline = INLINE_TYPES.has(f.type);
      const name = (url.searchParams.get('name') || 'file').replace(/[\r\n"\\/]/g, '_').slice(0, 200);
      const headers = {
        'Content-Type': inline ? f.type : 'application/octet-stream',
        'Content-Length': f.size,
        'Cache-Control': 'private, max-age=31536000, immutable',
        'X-Content-Type-Options': 'nosniff',
        'Content-Security-Policy': "default-src 'none'; sandbox"
      };
      if (!inline) headers['Content-Disposition'] = "attachment; filename*=UTF-8''" + encodeURIComponent(name);
      res.writeHead(200, headers);
      if (m === 'HEAD') return res.end();
      return fs.createReadStream(f.path).pipe(res);
    }
    if (p.indexOf('/api/push/') === 0 || p === '/api/reminders') {
      const push = opts.push;
      if (!push) return send(res, 404, { error: 'notifications are not available' });
      if (p === '/api/push/key' && m === 'GET') return send(res, 200, { publicKey: push.publicKey() });
      let input;
      try { input = JSON.parse((await readBody(req, 512 * 1024)).toString('utf8') || '{}'); } catch (e) {
        if (e.status) throw e;
        return send(res, 400, { error: 'invalid JSON' });
      }
      if (p === '/api/push/subscribe' && m === 'POST') {
        return push.subscribe(input.subscription, req.headers['user-agent']) ? send(res, 200, { ok: true, devices: push.subs.length }) : send(res, 400, { error: 'invalid subscription' });
      }
      if (p === '/api/push/unsubscribe' && m === 'POST') return send(res, 200, { removed: push.unsubscribe(String(input.endpoint || '')) });
      if (p === '/api/push/test' && m === 'POST') {
        const results = await push.broadcast({ title: String(input.title || 'Planner').slice(0, 80), body: String(input.body || '').slice(0, 160), tag: 'test' }, 120);
        return send(res, 200, { devices: push.subs.length, results: results });
      }
      if (p === '/api/reminders' && m === 'PUT') return push.setReminders(input.items) ? send(res, 200, { ok: true }) : send(res, 400, { error: 'invalid reminders' });
      return send(res, 404, { error: 'not found' });
    }
    if (p === '/api/library') {
      const lib = opts.library;
      if (!lib) return send(res, 200, { enabled: false });
      if (m === 'GET') return send(res, 200, lib.status());
      if (m === 'PUT') {
        let input;
        try { input = JSON.parse((await readBody(req, MAX_STATE_BYTES)).toString('utf8')); } catch (e) {
          if (e.status) throw e;
          return send(res, 400, { error: 'invalid JSON' });
        }
        const r = lib.sync(input.entries);
        return send(res, r.ok ? 200 : (r.error === 'invalid library' ? 400 : 500), r);
      }
    }
    if (p === '/api/backups' && m === 'GET') return send(res, 200, { backups: store.listBackups() });
    if (p === '/api/backups/restore' && m === 'POST') {
      let input;
      try { input = JSON.parse((await readBody(req, 4096)).toString('utf8')); } catch (e) { return send(res, 400, { error: 'invalid JSON' }); }
      const rev = store.restore(String(input && input.name));
      return send(res, 200, { rev: rev });
    }
    if (p === '/api/export' && m === 'GET') {
      const d = store.get();
      return send(res, 200, JSON.stringify({ app: 'planner', exportedAt: new Date().toISOString(), base: d.base, data: d.data }, null, 2), {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': 'attachment; filename="planner-export-' + new Date().toISOString().slice(0, 10) + '.json"'
      });
    }
    return send(res, 404, { error: 'not found' });
  }

  function serveStatic(req, res, url) {
    if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'Method Not Allowed', { 'Content-Type': 'text/plain' });
    let rel;
    try { rel = decodeURIComponent(url.pathname); } catch (e) { return send(res, 400, 'Bad Request', { 'Content-Type': 'text/plain' }); }
    if (rel.indexOf('\0') >= 0) return send(res, 400, 'Bad Request', { 'Content-Type': 'text/plain' });
    if (rel === '/' || rel === '') rel = '/index.html';
    const file = path.normalize(path.join(PUBLIC_DIR, rel));
    if (file !== PUBLIC_DIR && file.indexOf(PUBLIC_DIR + path.sep) !== 0) return send(res, 403, 'Forbidden', { 'Content-Type': 'text/plain' });
    fs.stat(file, function (err, st) {
      if (err || !st.isFile()) return send(res, 404, 'Not found', { 'Content-Type': 'text/plain' });
      const ext = path.extname(file).toLowerCase();
      const immutable = ext === '.woff2';
      res.writeHead(200, {
        'Content-Type': MIME[ext] || 'application/octet-stream',
        'Content-Length': st.size,
        'Cache-Control': immutable ? 'public, max-age=31536000, immutable' : 'no-cache'
      });
      if (req.method === 'HEAD') return res.end();
      fs.createReadStream(file).pipe(res);
    });
  }

  return http.createServer(function (req, res) {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('X-Frame-Options', 'DENY');
    if (!res.hasHeader('Content-Security-Policy')) res.setHeader('Content-Security-Policy', CSP);
    let url;
    try { url = new URL(req.url, 'http://localhost'); } catch (e) { return send(res, 400, 'Bad Request', { 'Content-Type': 'text/plain' }); }
    if (url.pathname === '/healthz') return send(res, 200, 'ok', { 'Content-Type': 'text/plain' });
    if (authUser && authPass) {
      const h = req.headers.authorization || '';
      let ok = false;
      if (h.indexOf('Basic ') === 0) {
        const dec = Buffer.from(h.slice(6), 'base64').toString('utf8');
        const i = dec.indexOf(':');
        ok = i >= 0 && safeEqual(dec.slice(0, i), authUser) && safeEqual(dec.slice(i + 1), authPass);
      }
      if (!ok) return send(res, 401, 'Authentication required', { 'Content-Type': 'text/plain', 'WWW-Authenticate': 'Basic realm="Planner", charset="UTF-8"' });
    }
    if (url.pathname.indexOf('/api/') === 0) {
      api(req, res, url).catch(function (e) {
        if (!e.status) console.error('[error]', req.method, url.pathname, e);
        if (!res.headersSent) send(res, e.status || 500, { error: e.status ? e.message : 'internal error' });
        else res.destroy();
      });
      return;
    }
    serveStatic(req, res, url);
  });
}

/**
 * NAS-friendly start-up. The container starts as root, looks at who owns the data folder and then runs the server as that
 * user (or, when Docker created the folder as root, hands it to the unprivileged user 1000). Privileges are dropped before
 * anything listens on the network, so the server itself never runs as root. If the container was started with a fixed
 * non-root user (compose "user:"), nothing changes and that user must be able to write to the folder.
 */
function dropPrivileges(dataDir) {
  if (typeof process.getuid !== 'function' || process.getuid() !== 0) return null;
  const st = fs.statSync(dataDir);
  let uid = st.uid, gid = st.gid;
  if (uid === 0) { uid = 1000; gid = 1000; }
  // make sure everything already inside belongs to that user too (ownership only, nothing is ever deleted or rewritten)
  const todo = [dataDir];
  while (todo.length) {
    const dir = todo.pop();
    const own = fs.lstatSync(dir);
    if (own.uid !== uid || own.gid !== gid) fs.lchownSync(dir, uid, gid);
    for (const name of fs.readdirSync(dir)) {
      const full = path.join(dir, name), e = fs.lstatSync(full);
      if (e.isDirectory()) todo.push(full);
      else if (e.uid !== uid || e.gid !== gid) fs.lchownSync(full, uid, gid);
    }
  }
  process.setgroups([]);
  process.setgid(gid);
  process.setuid(uid);
  return { uid: uid, gid: gid };
}

function describeFolder(dir) {
  try { const st = fs.statSync(dir); return 'owner ' + st.uid + ':' + st.gid + ', mode ' + (st.mode & 0o777).toString(8); } catch (e) { return 'unreadable (' + e.code + ')'; }
}

function main() {
  const dataDir = path.resolve(process.env.DATA_DIR || path.join(__dirname, '..', 'data'));
  const port = parseInt(process.env.PORT || '8080', 10);
  console.log('[planner] starting v' + (process.env.APP_VERSION || 'dev') + ' as uid ' + (process.getuid ? process.getuid() : '?') + ', data folder ' + dataDir);
  fs.mkdirSync(dataDir, { recursive: true });
  const before = describeFolder(dataDir);
  const dropped = dropPrivileges(dataDir);
  if (dropped) console.log('[planner] data folder had ' + before + ' -> running as uid ' + dropped.uid + ', gid ' + dropped.gid);
  try { fs.accessSync(dataDir, fs.constants.W_OK); } catch (e) {
    throw new Error(dataDir + ' is not writable by this user (uid ' + process.getuid() + '; the folder has ' + describeFolder(dataDir) + '). Fix the folder permissions or run the container with `user: "UID:GID"` of the folder owner.');
  }
  const every = process.env.SNAPSHOT_INTERVAL_SEC === undefined ? undefined : Math.max(0, parseFloat(process.env.SNAPSHOT_INTERVAL_SEC)) * 1000;
  const store = new Store(dataDir, { seed: function () { return seed.load(dataDir, undefined, process.env.DEFAULT_SEED); }, snapshotEveryMs: every }).init();
  const push = new Push(dataDir, { subject: process.env.VAPID_SUBJECT });
  const library = new Library(path.resolve(process.env.LIBRARY_DIR || path.join(dataDir, 'library')), store);
  push.start();
  const server = createServer({ store: store, push: push, library: library, authUser: process.env.AUTH_USER, authPassword: process.env.AUTH_PASSWORD });
  server.listen(port, '0.0.0.0', function () {
    console.log('[planner] version ' + (process.env.APP_VERSION || 'dev') + ' listening on :' + port + ', data in ' + dataDir + ', readable notes in ' + library.dir + ', revision ' + store.get().rev);
  });
  const stop = function () { server.close(function () { process.exit(0); }); setTimeout(function () { process.exit(0); }, 3000).unref(); };
  process.on('SIGTERM', stop);
  process.on('SIGINT', stop);
}

if (require.main === module) {
  try { main(); } catch (e) { console.error('[fatal]', e.message); process.exit(1); }
}

module.exports = { createServer };
