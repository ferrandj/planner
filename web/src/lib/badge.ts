/**
 * Badge pictures for the achievements, drawn by code: one medal per tier (the metal and the decoration grow with the tier),
 * a symbol that says what the achievement is about, the subject's own colour when it is about a subject, and the number to reach.
 * Output is plain SVG markup for a 64x64 box, with fixed colours (no scripts, no styles, no external references).
 */

export type Glyph =
  | 'cap' | 'live' | 'webconf' | 'rewind' | 'flame' | 'week' | 'pen' | 'folder' | 'sticker' | 'note'
  | 'plus' | 'edit' | 'moon' | 'globe' | 'palette' | 'gear' | 'target' | 'lock';

const INK = '#1e2433';

/** Symbols, drawn in a 32x32 box centred on (32,30). White with a dark outline. */
const GLYPHS: Record<Glyph, string> = {
  cap: '<path d="M32 17L51 26L32 35L13 26Z"/><path d="M21 31v8q11 6 22 0v-8L32 36Z"/><path d="M49 28v9" fill="none"/>',
  live: '<rect x="15" y="19" width="34" height="23" rx="4"/><path d="M29 25v11l10-5.5Z" fill="%C"/><path d="M24 47h16" fill="none"/>',
  webconf: '<rect x="14" y="18" width="36" height="24" rx="4"/><circle cx="32" cy="27" r="4" fill="%C"/><path d="M24 38q8-9 16 0" fill="%C"/><path d="M25 47h14" fill="none"/>',
  rewind: '<circle cx="32" cy="31" r="14"/><path d="M32 22v10l7 4" fill="none"/><path d="M15 21l-1 9 9-2" fill="%C"/>',
  flame: '<path d="M32 15q12 11 12 21a12 12 0 0 1-24 0q0-7 6-13 1 6 5 7-2-8 1-15Z"/><path d="M32 47a6 6 0 0 1-6-6q0-5 6-9 6 4 6 9a6 6 0 0 1-6 6Z" fill="%C"/>',
  week: '<rect x="15" y="19" width="34" height="29" rx="4"/><path d="M15 27h34" fill="none"/><path d="M22 15v7M42 15v7" fill="none"/><path d="M23 38l6 6 12-12" fill="none" stroke="%C" stroke-width="3.4"/>',
  pen: '<path d="M18 44l3-10 20-20 7 7-20 20Z"/><path d="M36 19l7 7" fill="none"/><path d="M18 44l8-2" fill="none"/>',
  folder: '<path d="M14 21h12l4 4h20v21H14Z"/><path d="M24 36l6 6 11-11" fill="none" stroke="%C" stroke-width="3.4"/>',
  sticker: '<path d="M32 15l4.5 10 11 1-8.3 7.4 2.5 10.6L32 38l-9.7 6 2.5-10.6L16.5 26l11-1Z"/><circle cx="28" cy="29" r="1.6" fill="%I" stroke="none"/><circle cx="36" cy="29" r="1.6" fill="%I" stroke="none"/>',
  note: '<rect x="18" y="15" width="28" height="34" rx="3"/><path d="M24 24h16M24 31h16M24 38h10" fill="none"/>',
  plus: '<circle cx="32" cy="31" r="15"/><path d="M32 23v16M24 31h16" fill="none" stroke="%C" stroke-width="3.6"/>',
  edit: '<path d="M16 46l3-11 22-22 8 8-22 22Z"/><path d="M37 17l8 8" fill="none"/>',
  moon: '<path d="M38 15a17 17 0 1 0 12 28 14 14 0 0 1-12-28Z"/>',
  globe: '<circle cx="32" cy="31" r="16"/><ellipse cx="32" cy="31" rx="7" ry="16" fill="none"/><path d="M16 31h32M19 22q13 5 26 0M19 40q13-5 26 0" fill="none"/>',
  palette: '<path d="M32 14C20 14 14 22 14 31s7 17 16 17c4 0 5-3 3-6s0-6 4-6h6c5 0 7-3 7-7 0-8-8-15-18-15Z"/><circle cx="23" cy="29" r="2.4" fill="%C"/><circle cx="29" cy="22" r="2.4" fill="%I"/><circle cx="38" cy="22" r="2.4" fill="%C"/>',
  gear: '<path d="M28 14h8l1 5 4 2 4-3 6 6-3 4 2 4 5 1v8l-5 1-2 4 3 4-6 6-4-3-4 2-1 5h-8l-1-5-4-2-4 3-6-6 3-4-2-4-5-1v-8l5-1 2-4-3-4 6-6 4 3 4-2Z" transform="translate(7 5) scale(.78)"/><circle cx="32" cy="31" r="5" fill="%C"/>',
  target: '<circle cx="32" cy="31" r="16"/><circle cx="32" cy="31" r="10" fill="%C"/><circle cx="32" cy="31" r="4"/>',
  lock: '<rect x="19" y="29" width="26" height="19" rx="4"/><path d="M24 29v-5a8 8 0 0 1 16 0v5" fill="none"/><circle cx="32" cy="38" r="2.6" fill="%I" stroke="none"/>'
};

/** Metals, from the first tier to the last. */
const METALS = [
  { ring: '#b0703a', rim: '#7a4521', hi: '#e9b385' },   // bronze
  { ring: '#a9b4c0', rim: '#6b7684', hi: '#eef2f6' },   // silver
  { ring: '#e0ac1b', rim: '#9a6f00', hi: '#ffe590' },   // gold
  { ring: '#5ec3d8', rim: '#2b7f91', hi: '#d9f7fd' },   // platinum
  { ring: '#8f6bff', rim: '#4a2ec2', hi: '#ddd2ff' }    // diamond
] as const;

export interface BadgeOpts {
  glyph: Glyph;
  /** 0..4: bronze, silver, gold, platinum, diamond */
  rank: number;
  /** what to reach, written on the ribbon ("10", "60 j") */
  label?: string;
  /** face colour (a subject's colour); defaults to a neutral blue */
  color?: string;
  /** greyed out, with a padlock: not unlocked yet */
  locked?: boolean;
}

const HEX = /^#[0-9a-f]{6}$/i;
const esc = (s: string): string => s.replace(/[<>&"']/g, '');

/** Lighter or darker version of a #rrggbb colour. */
export function shade(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16);
  const ch = (v: number): number => Math.max(0, Math.min(255, Math.round(amount < 0 ? v * (1 + amount) : v + (255 - v) * amount)));
  const r = ch((n >> 16) & 255), g = ch((n >> 8) & 255), b = ch(n & 255);
  return '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('');
}

/** Inner markup of the badge (put it inside `<svg viewBox="0 0 64 64">`). */
export function badgeMarkup(o: BadgeOpts): string {
  const rank = Math.max(0, Math.min(4, Math.round(o.rank)));
  const m = o.locked ? { ring: '#9aa0aa', rim: '#6b717b', hi: '#d5d9df' } : METALS[rank];
  const face = o.locked ? '#c9ced6' : HEX.test(o.color || '') ? (o.color as string) : '#3b7be8';
  const glyph = (o.locked ? GLYPHS.lock : GLYPHS[o.glyph]).replace(/%C/g, o.locked ? '#9aa0aa' : face).replace(/%I/g, INK);
  let s = '';
  // decoration grows with the tier: rays behind the medal (gold and up), wings (platinum), crown (diamond)
  if (!o.locked && rank >= 2) {
    const n = rank === 2 ? 8 : 12;
    for (let i = 0; i < n; i++) s += `<path d="M32 6l2.2 6h-4.4Z" fill="${m.ring}" stroke="${m.rim}" stroke-width="1" transform="rotate(${(360 / n) * i} 32 32)"/>`;
  }
  if (!o.locked && rank >= 3) s += `<path d="M5 24q-3 9 5 17l5-6q-6-5-3-13ZM59 24q3 9-5 17l-5-6q6-5 3-13Z" fill="${m.hi}" stroke="${m.rim}" stroke-width="1.4"/>`;
  s += `<circle cx="32" cy="32" r="22" fill="${m.ring}" stroke="${m.rim}" stroke-width="2.4"/>`;
  s += `<circle cx="32" cy="32" r="17.5" fill="${face}" stroke="${m.rim}" stroke-width="1.6"/>`;
  s += `<path d="M18 26a15 15 0 0 1 14-9" fill="none" stroke="${m.hi}" stroke-width="2.4" stroke-linecap="round" opacity=".9"/>`;
  s += `<g fill="#fff" stroke="${INK}" stroke-width="1.7" stroke-linejoin="round" stroke-linecap="round">${glyph}</g>`;
  if (!o.locked && rank >= 4) s += `<path d="M20 10l4 6 8-9 8 9 4-6-2 11H22Z" fill="${m.hi}" stroke="${m.rim}" stroke-width="1.4" stroke-linejoin="round"/>`;
  if (o.label) {
    const w = Math.max(18, 8 + o.label.length * 6);
    s += `<rect x="${32 - w / 2}" y="46" width="${w}" height="12" rx="6" fill="${INK}" stroke="${m.hi}" stroke-width="1.2"/>`;
    s += `<text x="32" y="55.2" text-anchor="middle" font-family="system-ui,sans-serif" font-size="9" font-weight="700" fill="#fff">${esc(o.label)}</text>`;
  }
  return s;
}

/** Complete SVG document (for tests and previews). */
export const badgeSvg = (o: BadgeOpts, size = 64): string => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="${size}" height="${size}">${badgeMarkup(o)}</svg>`;

export const GLYPH_NAMES = Object.keys(GLYPHS) as Glyph[];
