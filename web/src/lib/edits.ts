import type { Base, Data } from '../types';

const REQUIRED = new Set(['s:name', 's:code', 's:ab', 'd:title', 'd:date', 'x:date', 'e:date', 'c:date', 'c:title', 'd:ab']);

/** The reference entry for an edit key like "s:math" or "e:math-live-2026-09-14". */
export function baseOf(base: Base, key: string, extra?: Data['extra']): Record<string, unknown> {
  const g = key.split(':')[0] as keyof Base, id = key.slice(g.length + 1);
  const list = ((base[g] as Array<{ id: string }> | undefined) || []).concat((extra && (extra[g] as Array<{ id: string }>)) || []);
  return (list.find((o) => o.id === id) as unknown as Record<string, unknown>) || {};
}

/**
 * Apply one edit to a draft of the data. Returns false when the edit is refused (a required field left blank).
 * Edits equal to the reference value are dropped, so "undo" by typing the original value leaves no trace.
 */
export function setEdit(d: Data, base: Base, key: string, f: string, v: string): boolean {
  if (key === 'app') {
    d.edits.app = d.edits.app || {};
    if (!v.trim()) delete d.edits.app[f]; else d.edits.app[f] = v;
    return true;
  }
  const g = key.split(':')[0];
  if (REQUIRED.has(g + ':' + f) && !v.trim()) return false;
  if (g === 'c') {
    const c = d.custom.find((x) => 'c:' + x.id === key) as unknown as Record<string, string> | undefined;
    if (c) c[f] = v;
    return true;
  }
  const b = baseOf(base, key, d.extra)[f];
  if ((b === undefined ? '' : String(b)) === v) {
    if (d.edits[key]) { delete d.edits[key][f]; if (!Object.keys(d.edits[key]).length) delete d.edits[key]; }
  } else (d.edits[key] = d.edits[key] || {})[f] = v;
  return true;
}

/** Remove every edit of one item (the "restore original values" link). */
export function resetEdit(d: Data, key: string): void { delete d.edits[key]; }

/** Reset all edits except the app title / subtitle; sessions hidden by the user are shown again. */
export function resetAllEdits(d: Data): void {
  const keep = d.edits.app;
  d.edits = {};
  if (keep) d.edits.app = keep;
  d.hidden = {};
}

export function clearColor(d: Data, key: string): void {
  if (d.edits[key]) { delete d.edits[key].color; if (!Object.keys(d.edits[key]).length) delete d.edits[key]; }
}
