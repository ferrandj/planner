import { hslHex } from './colors';

/** Subjects 1-4 have hand-picked colours in the stylesheet. Any further subject gets its own, spread around the colour wheel. */
export const BUILT_IN_SLOTS = 4;

export function slotColor(slot: number, dark: boolean): string {
  const hue = (slot * 137.508) % 360; // golden angle: neighbouring slots look clearly different
  return dark ? hslHex(hue, 62, 70) : hslHex(hue, 62, 34);
}

/** CSS for every colour slot above the built-in ones (light and dark scheme, plus the `.sN` helper class). */
export function slotCss(maxSlot: number): string {
  let css = '';
  for (let c = BUILT_IN_SLOTS + 1; c <= maxSlot; c++) {
    css += `:root{--s${c}:${slotColor(c, false)}}:root[data-scheme="dark"]{--s${c}:${slotColor(c, true)}}.s${c}{--c:var(--s${c})}\n`;
  }
  return css;
}
