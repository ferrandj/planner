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
type Json = unknown;
type Obj = Record<string, Json>;
type IdObj = Obj & { id: string };

const isObj = (v: Json): v is Obj => v !== null && typeof v === 'object' && !Array.isArray(v);

export function clone<T>(v: T): T {
  return v === undefined ? v : (JSON.parse(JSON.stringify(v)) as T);
}

export function eq(a: Json, b: Json): boolean {
  if (a === b) return true;
  if (typeof a !== typeof b || a === null || b === null || typeof a !== 'object') return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (!eq(a[i], b[i])) return false;
    return true;
  }
  const oa = a as Obj, ob = b as Obj, ka = Object.keys(oa), kb = Object.keys(ob);
  if (ka.length !== kb.length) return false;
  return ka.every((k) => Object.prototype.hasOwnProperty.call(ob, k) && eq(oa[k], ob[k]));
}

const idArray = (a: Json): a is IdObj[] => Array.isArray(a) && a.every((x) => isObj(x) && typeof x.id === 'string');
const primArray = (a: Json): a is Json[] => Array.isArray(a) && a.every((x) => x === null || typeof x !== 'object');

function mergeIdArrays(base: IdObj[], mine: IdObj[], theirs: IdObj[]): IdObj[] {
  const bm = new Map(base.map((x) => [x.id, x])), mm = new Map(mine.map((x) => [x.id, x])), tm = new Map(theirs.map((x) => [x.id, x]));
  const out: IdObj[] = [];
  for (const t of theirs) {
    const m = mm.get(t.id), b = bm.get(t.id);
    if (m) out.push(merge3(b, m, t) as IdObj);
    else if (!b) out.push(clone(t));                  // added by the other device
    else if (!eq(b, t)) out.push(clone(t));           // I deleted it, they edited it: keep
  }
  for (const m of mine) {
    if (tm.has(m.id)) continue;
    const b = bm.get(m.id);
    if (!b) out.push(clone(m));                       // added here
    else if (!eq(b, m)) out.push(clone(m));           // they deleted it, I edited it: keep
  }
  return out;
}

function mergeSets(base: Json[], mine: Json[], theirs: Json[]): Json[] {
  const has = (a: Json[], x: Json): boolean => a.some((y) => eq(x, y));
  const out: Json[] = [];
  for (const x of mine.concat(theirs)) {
    if (has(out, x)) continue;
    if (has(base, x) && (!has(mine, x) || !has(theirs, x))) continue; // deleted on one side
    out.push(clone(x));
  }
  return out;
}

export function merge3(base: Json, mine: Json, theirs: Json): Json {
  if (eq(mine, theirs)) return clone(mine);
  if (eq(base, mine)) return clone(theirs);
  if (eq(base, theirs)) return clone(mine);
  if (isObj(mine) && isObj(theirs)) {
    const b: Obj = isObj(base) ? base : {};
    const out: Obj = {};
    const keys = Object.keys(theirs).concat(Object.keys(mine).filter((k) => !(k in theirs)));
    for (const k of keys) {
      const inM = k in mine, inT = k in theirs, inB = k in b;
      if (inM && inT) out[k] = merge3(b[k], mine[k], theirs[k]);
      else if (inM) { if (!inB || !eq(b[k], mine[k])) out[k] = clone(mine[k]); }
      else if (!inB || !eq(b[k], theirs[k])) out[k] = clone(theirs[k]);
    }
    return out;
  }
  if (Array.isArray(mine) && Array.isArray(theirs)) {
    const b = Array.isArray(base) ? base : [];
    if (idArray(mine) && idArray(theirs) && idArray(b)) return mergeIdArrays(b, mine, theirs);
    if (primArray(mine) && primArray(theirs) && primArray(b)) return mergeSets(b, mine, theirs);
  }
  return clone(mine);
}
