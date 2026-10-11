/*
 * Three-way merge of the planner's JSON state.
 *
 *   merge3(base, mine, theirs)
 *     base   = state at the last successful sync
 *     mine   = state on this device (with unsynced edits)
 *     theirs = state currently on the server (edits from another device)
 *
 * Rules, chosen so that nothing a user did is silently dropped:
 *   - a side that did not change a value yields to the side that did
 *   - objects are merged key by key, arrays of {id} objects element by element
 *   - plain arrays (e.g. saved colours) are merged as sets
 *   - delete vs. edit of the same item: the edit is kept
 *   - two different edits of the same scalar: this device ("mine") wins
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Merge = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function isObj(v) { return v !== null && typeof v === 'object' && !Array.isArray(v); }
  function clone(v) { return v === undefined ? undefined : JSON.parse(JSON.stringify(v)); }

  function eq(a, b) {
    if (a === b) return true;
    if (typeof a !== typeof b || a === null || b === null || typeof a !== 'object') return false;
    if (Array.isArray(a) !== Array.isArray(b)) return false;
    if (Array.isArray(a)) {
      if (a.length !== b.length) return false;
      for (let i = 0; i < a.length; i++) if (!eq(a[i], b[i])) return false;
      return true;
    }
    const ka = Object.keys(a), kb = Object.keys(b);
    if (ka.length !== kb.length) return false;
    for (let i = 0; i < ka.length; i++) {
      if (!Object.prototype.hasOwnProperty.call(b, ka[i]) || !eq(a[ka[i]], b[ka[i]])) return false;
    }
    return true;
  }

  function idArray(a) {
    return Array.isArray(a) && a.every(function (x) { return isObj(x) && typeof x.id === 'string'; });
  }

  function byId(a) {
    const m = new Map();
    a.forEach(function (x) { m.set(x.id, x); });
    return m;
  }

  function mergeIdArrays(base, mine, theirs) {
    const bm = byId(base), mm = byId(mine), tm = byId(theirs), out = [];
    theirs.forEach(function (t) {
      if (mm.has(t.id)) out.push(merge3(bm.get(t.id), mm.get(t.id), t));
      else if (!bm.has(t.id)) out.push(clone(t));                 // added by the other device
      else if (!eq(bm.get(t.id), t)) out.push(clone(t));          // I deleted it, they edited it: keep
    });
    mine.forEach(function (m) {
      if (tm.has(m.id)) return;
      if (!bm.has(m.id)) out.push(clone(m));                      // added here
      else if (!eq(bm.get(m.id), m)) out.push(clone(m));          // they deleted it, I edited it: keep
    });
    return out;
  }

  function mergeSets(base, mine, theirs) {
    const inB = function (x) { return base.some(function (y) { return eq(x, y); }); };
    const inM = function (x) { return mine.some(function (y) { return eq(x, y); }); };
    const inT = function (x) { return theirs.some(function (y) { return eq(x, y); }); };
    const out = [];
    mine.concat(theirs).forEach(function (x) {
      if (out.some(function (y) { return eq(x, y); })) return;
      if (inB(x) && (!inM(x) || !inT(x))) return;                 // deleted on one side
      out.push(clone(x));
    });
    return out;
  }

  function merge3(base, mine, theirs) {
    if (eq(mine, theirs)) return clone(mine);
    if (eq(base, mine)) return clone(theirs);
    if (eq(base, theirs)) return clone(mine);
    if (isObj(mine) && isObj(theirs)) {
      const b = isObj(base) ? base : {};
      const out = {};
      const keys = Object.keys(theirs).concat(Object.keys(mine).filter(function (k) { return !(k in theirs); }));
      keys.forEach(function (k) {
        const inM = k in mine, inT = k in theirs, inB = k in b;
        if (inM && inT) out[k] = merge3(b[k], mine[k], theirs[k]);
        else if (inM) { if (!inB || !eq(b[k], mine[k])) out[k] = clone(mine[k]); }
        else if (!inB || !eq(b[k], theirs[k])) out[k] = clone(theirs[k]);
      });
      return out;
    }
    if (Array.isArray(mine) && Array.isArray(theirs)) {
      const b = Array.isArray(base) ? base : [];
      if (idArray(mine) && idArray(theirs) && idArray(b)) return mergeIdArrays(b, mine, theirs);
      const prim = function (a) { return a.every(function (x) { return x === null || typeof x !== 'object'; }); };
      if (prim(mine) && prim(theirs) && prim(b)) return mergeSets(b, mine, theirs);
    }
    return clone(mine);
  }

  return { merge3: merge3, eq: eq, clone: clone };
});
