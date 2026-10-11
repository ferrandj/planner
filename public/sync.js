/*
 * Client-side persistence.
 *
 * Every change is (1) written immediately to this browser's localStorage as a safety net,
 * then (2) sent to the server. If the server cannot be reached the edits stay in the
 * browser and are merged into the server state later (three-way merge, see merge.js).
 * Nothing is ever pushed before the server state has been loaded once, so a fresh or
 * empty browser can never overwrite real data.
 */
(function () {
  'use strict';
  var CACHE_KEY = 'planner-cache-v1';
  var HDR = { 'Content-Type': 'application/json', 'X-Planner-Client': '1' };
  var st = {
    rev: 0, synced: null, base: null, dirty: false, inflight: false, again: false,
    timer: null, retry: 0, retryTimer: null, getData: null, adopt: null, onStatus: null, status: 'saved', attached: false
  };

  function clone(v) { return v === undefined ? undefined : JSON.parse(JSON.stringify(v)); }
  function readCache() { try { var c = JSON.parse(localStorage.getItem(CACHE_KEY)); return c && typeof c === 'object' ? c : null; } catch (e) { return null; } }
  function writeCache() {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({ rev: st.rev, synced: st.synced, base: st.base, data: st.getData ? st.getData() : st.synced, dirty: st.dirty }));
      return true;
    } catch (e) { return false; }
  }
  function setStatus(s) { st.status = s; if (st.onStatus) st.onStatus(s); }
  function api(path, opt) { return fetch(path, Object.assign({ cache: 'no-store', credentials: 'same-origin' }, opt || {})); }

  function load() {
    return api('api/state').then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    }).then(function (S) {
      var C = readCache(), data = S.data, offline = false;
      st.rev = S.rev; st.base = S.base; st.synced = clone(S.data); st.dirty = false;
      if (C && C.dirty && C.data) {            // edits made in an earlier session that never reached the server
        data = Merge.merge3(C.synced || {}, C.data, S.data);
        st.dirty = !Merge.eq(data, S.data);
      }
      return { data: data, base: S.base, rev: S.rev, offline: offline };
    }, function (err) {
      var C = readCache();
      if (!C || !C.data || !C.base) throw err;
      st.rev = C.rev; st.base = C.base; st.synced = C.synced ? C.synced : clone(C.data); st.dirty = !!C.dirty;
      return { data: C.data, base: C.base, rev: C.rev, offline: true };
    });
  }

  function attach(opt) {
    st.getData = opt.getData; st.adopt = opt.adopt; st.onStatus = opt.onStatus; st.attached = true;
    writeCache();
    if (st.dirty) { setStatus('pending'); schedule(0); } else setStatus('saved');
    setInterval(poll, 15000);
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'hidden') { if (st.dirty) push(true); } else poll();
    });
    window.addEventListener('pagehide', function () { if (st.dirty) push(true); });
    window.addEventListener('online', function () { if (st.dirty) schedule(0); else poll(); });
    poll();
  }

  function changed() {
    if (!st.attached) return true;
    st.dirty = true;
    var ok = writeCache();
    setStatus(ok ? 'pending' : 'cachefull');
    schedule(400);
    return true;
  }

  function schedule(ms) { clearTimeout(st.timer); st.timer = setTimeout(function () { push(false); }, ms); }

  function push(unload) {
    if (!st.attached || !st.dirty) return;
    if (st.inflight) { st.again = true; return; }
    var sent = clone(st.getData()), body = JSON.stringify({ baseRev: st.rev, data: sent });
    st.inflight = true;
    if (st.status !== 'cachefull') setStatus('saving');
    api('api/state', { method: 'PUT', headers: HDR, body: body, keepalive: !!unload && body.length < 60000 }).then(function (r) {
      if (r.status === 200) {
        return r.json().then(function (j) {
          st.rev = j.rev; st.synced = sent; st.retry = 0;
          if (Merge.eq(sent, st.getData())) { st.dirty = false; writeCache(); setStatus('saved'); }
          else { writeCache(); st.again = true; }
        });
      }
      if (r.status === 409) {
        return r.json().then(function (S) {          // another device saved in the meantime: merge, never overwrite
          var merged = Merge.merge3(st.synced, st.getData(), S.data);
          st.rev = S.rev; st.synced = clone(S.data); st.base = S.base;
          st.adopt(merged, S.base);
          st.dirty = !Merge.eq(merged, S.data);
          writeCache();
          st.again = st.dirty;
          if (!st.dirty) setStatus('saved');
        });
      }
      throw new Error('HTTP ' + r.status);
    }).catch(function () {
      setStatus('offline');
      st.retry = Math.min(st.retry + 1, 6);
      clearTimeout(st.retryTimer);
      st.retryTimer = setTimeout(function () { push(false); }, Math.min(30000, 1000 * Math.pow(2, st.retry)));
    }).then(function () {
      st.inflight = false;
      if (st.again) { st.again = false; schedule(0); }
    });
  }

  function poll() {
    if (!st.attached || st.inflight || document.visibilityState === 'hidden') return;
    if (st.dirty) { if (st.status === 'offline') schedule(0); return; }
    api('api/rev').then(function (r) { return r.json(); }).then(function (j) {
      if (st.status === 'offline') setStatus('saved');
      if (j.rev === st.rev || st.dirty) return;
      return api('api/state').then(function (r) { return r.json(); }).then(function (S) {
        if (st.dirty || st.inflight) return;
        if (st.adopt(S.data, S.base, true) !== false) { st.rev = S.rev; st.synced = clone(S.data); st.base = S.base; writeCache(); }
      });
    }).catch(function () { setStatus('offline'); });
  }

  /* Explicit reload from the server (after a backup restore). */
  function reloadFromServer() {
    return api('api/state').then(function (r) { return r.json(); }).then(function (S) {
      st.rev = S.rev; st.synced = clone(S.data); st.base = S.base; st.dirty = false;
      st.adopt(S.data, S.base);
      writeCache(); setStatus('saved');
    });
  }

  /* Replace the reference schedule (subjects, assignments, exams, sessions), used by "import". */
  function pushBase(base, data) {
    return api('api/state', { method: 'PUT', headers: HDR, body: JSON.stringify({ baseRev: st.rev, data: data, base: base }) }).then(function (r) {
      if (r.status === 409) throw new Error('conflict');
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    }).then(function (j) { st.rev = j.rev; st.synced = clone(data); st.base = base; st.dirty = false; writeCache(); setStatus('saved'); });
  }

  window.PlannerSync = {
    load: load, attach: attach, changed: changed, flush: function () { return push(false); },
    reloadFromServer: reloadFromServer, pushBase: pushBase, status: function () { return st.status; },
    api: api, HDR: HDR
  };
})();
