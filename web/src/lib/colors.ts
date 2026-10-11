export const HEX6 = /^#[0-9a-f]{6}$/i;

export interface Hsl { h: number; s: number; l: number }
export interface Hsv { h: number; s: number; v: number }

function hueOf(r: number, g: number, b: number, mx: number, d: number): number {
  let h = 0;
  if (d) {
    if (mx === r) h = ((g - b) / d) % 6;
    else if (mx === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return h;
}
const rgb = (hex: string): [number, number, number] =>
  [parseInt(hex.slice(1, 3), 16) / 255, parseInt(hex.slice(3, 5), 16) / 255, parseInt(hex.slice(5, 7), 16) / 255];

export function hex2hsl(hex: string): Hsl {
  const [r, g, b] = rgb(hex);
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn, l = (mx + mn) / 2;
  return { h: hueOf(r, g, b, mx, d), s: d ? d / (1 - Math.abs(2 * l - 1)) : 0, l };
}

const toHex = (u: number): string => Math.round(u * 255).toString(16).padStart(2, '0');

export function hslHex(h: number, s: number, l: number): string {
  s /= 100; l /= 100;
  const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs((h / 60) % 2 - 1)), m = l - c / 2;
  let r = 0, g = 0, b = 0;
  if (h < 60) { r = c; g = x; } else if (h < 120) { r = x; g = c; } else if (h < 180) { g = c; b = x; }
  else if (h < 240) { g = x; b = c; } else if (h < 300) { r = x; b = c; } else { r = c; b = x; }
  return '#' + [r, g, b].map((u) => toHex(u + m)).join('');
}

/** Relative luminance (WCAG). */
export function lum(hex: string): number {
  const a = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2];
}

export const CUSTOM_VARS = ['--bg', '--surface', '--surface2', '--fg', '--muted', '--line', '--accent', '--accent-ink'] as const;

/** UI colour tokens derived from one chosen accent colour, for the light or dark scheme. */
export function customTokens(hex: string, dark: boolean): Record<string, string> {
  const o = hex2hsl(hex), h = Math.round(o.h) % 360, sat = Math.max(25, Math.round(o.s * 100)), k = o.s < 0.08 ? 0 : 1;
  let acc = hex;
  if (!dark) { if (lum(hex) > 0.45) acc = hslHex(h, Math.min(100, sat), 38); }
  else if (lum(hex) < 0.2) acc = hslHex(h, Math.min(100, sat), 66);
  const tk: Record<string, string> = dark
    ? { '--bg': hslHex(h, 30 * k, 8), '--surface': hslHex(h, 26 * k, 12), '--surface2': hslHex(h, 24 * k, 16), '--fg': hslHex(h, 25 * k, 93), '--muted': hslHex(h, 14 * k, 66), '--line': hslHex(h, 20 * k, 23) }
    : { '--bg': hslHex(h, 40 * k, 94), '--surface': '#FFFFFF', '--surface2': hslHex(h, 40 * k, 97), '--fg': hslHex(h, 40 * k, 11), '--muted': hslHex(h, 16 * k, 37), '--line': hslHex(h, 28 * k, 83) };
  tk['--accent'] = acc;
  tk['--accent-ink'] = lum(acc) > 0.4 ? '#10151b' : '#FFFFFF';
  return tk;
}

export function hex2hsv(hex: string): Hsv {
  const [r, g, b] = rgb(hex);
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  return { h: hueOf(r, g, b, mx, d), s: mx ? d / mx : 0, v: mx };
}

export function hsv2hex(o: Hsv): string {
  const h = o.h / 60, c = o.v * o.s, x = c * (1 - Math.abs(h % 2 - 1)), m = o.v - c;
  let r = 0, g = 0, b = 0;
  if (h < 1) { r = c; g = x; } else if (h < 2) { r = x; g = c; } else if (h < 3) { g = c; b = x; }
  else if (h < 4) { g = x; b = c; } else if (h < 5) { r = x; b = c; } else { r = c; b = x; }
  return '#' + [r, g, b].map((u) => toHex(u + m)).join('');
}

/** 80 % lighter tint of a colour (used for sticker fills and print tints). */
export function softOf(hex: string): string {
  return '#' + [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16);
    return Math.round(c + (255 - c) * 0.8).toString(16).padStart(2, '0');
  }).join('');
}

export interface Duo { m: string; s: string; n?: string }
export const STK_COLORS: Record<string, Duo> = {
  rose: { n: 'Rose', m: '#D6457F', s: '#FBD9E6' },
  bleu: { n: 'Bleu', m: '#3B73D1', s: '#D8E5FA' },
  orange: { n: 'Orange', m: '#E0701F', s: '#FDE0C8' }
};
export const PRINT_PALS: Record<string, Duo> = {
  sobre: { n: 'Sobre', m: '#555555', s: '#EEEEEE' },
  bleu: { n: 'Bleu', m: '#2F6BC9', s: '#E3ECFA' },
  rose: { n: 'Rose', m: '#CF3F78', s: '#FCE3EC' },
  orange: { n: 'Orange', m: '#D86A1A', s: '#FDE9D9' }
};
/** Sticker colour: a named preset or any #rrggbb. */
export function colOf(c: string | undefined): Duo {
  if (c && STK_COLORS[c]) return STK_COLORS[c];
  if (c && HEX6.test(c)) return { m: c, s: softOf(c) };
  return STK_COLORS.rose;
}

/** Subject colour tuned for dark mode (lighter when too dark). */
export function subjectColorFor(color: string | undefined, dark: boolean): string {
  if (!color || !HEX6.test(color)) return '';
  if (dark) {
    const h = hex2hsl(color);
    if (h.l < 0.62) return hslHex(h.h, Math.round(h.s * 100), 68);
  }
  return color;
}
