import type { Data, Sticker } from '../types';
import { HEX6 } from './colors';
import { clone, merge3 } from './merge';

/** Clean the sticker list that decorates the background (kept from the earlier version, incl. the legacy coordinate scale). */
export function bgClean(list: unknown, legacy: boolean, w: number, h: number): Sticker[] {
  const arr = Array.isArray(list) ? list : [];
  return arr
    .filter((b): b is Sticker => !!b && typeof b.id === 'string' && typeof b.t === 'string' && isFinite(b.x) && isFinite(b.y))
    .map((b) => {
      let y = +b.y, sz = +b.s || 9;
      if (legacy) { y = (y * h) / w; sz = (sz * Math.min(w, h)) / w; }
      return { id: b.id, t: b.t, c: b.c || '#d6457f', x: Math.min(1, Math.max(0, +b.x)), y: Math.min(30, Math.max(0, y)), s: Math.min(50, Math.max(2, sz)), r: +b.r || 0 };
    });
}

/**
 * Fill in defaults on whatever came from the server / an import. Idempotent, never removes user content.
 * Accepts the earlier single-file version's saved format as well.
 */
export function normalizeData(raw: unknown, viewport: { w: number; h: number } = { w: 1000, h: 800 }): Data {
  const d = (raw && typeof raw === 'object' && !Array.isArray(raw) ? clone(raw) : {}) as Partial<Data> & Record<string, unknown>;
  const x = d as unknown as Data;
  const ex = (d.extra || {}) as Partial<Data['extra']>;
  x.extra = { s: Array.isArray(ex.s) ? ex.s : [], d: Array.isArray(ex.d) ? ex.d : [], x: Array.isArray(ex.x) ? ex.x : [], e: Array.isArray(ex.e) ? ex.e : [] };
  x.deleted = d.deleted || {};
  x.notes = d.notes || {}; x.edits = d.edits || {}; x.hidden = d.hidden || {};
  x.done = d.done || {}; x.rendu = d.rendu || {}; x.custom = Array.isArray(d.custom) ? d.custom : [];
  const P = (d.prefs = d.prefs || ({} as Data['prefs']));
  const old: Record<string, string> = { bleu: '#3B7BE8', rose: '#E0407A', orange: '#E8782A' };
  const oldp: Record<string, string> = { bleu: '#2F6BC9', rose: '#CF3F78', orange: '#D86A1A' };
  const pal = P.pal;
  if (pal !== 'perso') { P.custom = old[pal] || '#3B7BE8'; P.pal = 'perso'; }
  if (P.ppal === 'sobre') { if (!HEX6.test(P.pcustom || '')) P.pcustom = P.custom; }
  else if (P.ppal !== 'perso') { P.pcustom = oldp[P.ppal] || oldp[pal] || '#2F6BC9'; P.ppal = 'perso'; }
  x.favs = (Array.isArray(d.favs) ? d.favs : []).filter((c) => HEX6.test(c || '')).slice(0, 30);
  if (!['auto', 'light', 'dark'].includes(P.mode)) P.mode = 'auto';
  if (!['sobre', 'perso'].includes(P.ppal)) P.ppal = 'perso';
  if (!['fr', 'en', 'es'].includes(P.lang)) P.lang = 'fr';
  if (!HEX6.test(P.custom || '')) P.custom = '#7b4fe0';
  P.auto = !!P.auto;
  P.autoMax = Number.isInteger(P.autoMax) && (P.autoMax as number) >= 1 && (P.autoMax as number) <= 20 ? P.autoMax : 3;
  P.remind = P.remind !== false;
  P.remindLead = [5, 10, 15, 30, 60].includes(P.remindLead as number) ? P.remindLead : 15;
  P.remindSound = P.remindSound !== false;
  if (!HEX6.test(P.pcustom || '')) P.pcustom = '#7b4fe0';
  x.stickers = d.stickers || {};
  x.bg = bgClean(d.bg, d.bgv !== 2, viewport.w || 1, viewport.h || 1);
  x.bgv = 2;
  x.bgAt = +(d.bgAt as number) || 0;
  x.printOff = d.printOff || {};
  return x;
}

/** Import: union with what is already there. Nothing is deleted; on conflicts the imported value wins. */
export function mergeImport(current: Data, imported: unknown): Data {
  return normalizeData(merge3({}, imported, clone(current)));
}
