import { HEX6 } from './colors';
import { BUILT_IN_SLOTS, slotColor, slotCss } from './slotColors';

describe('colours for extra subjects', () => {
  it('nothing is generated while the built-in colours are enough', () => {
    expect(slotCss(0)).toBe('');
    expect(slotCss(BUILT_IN_SLOTS)).toBe('');
  });
  it('every slot above the built-in ones gets a variable, a dark variant and a class', () => {
    const css = slotCss(6);
    for (const c of [5, 6]) {
      expect(css).toContain(`--s${c}:`);
      expect(css).toContain(`.s${c}{--c:var(--s${c})}`);
    }
    expect(css).not.toContain('.s4{');
    expect(css).toContain(':root[data-scheme="dark"]');
  });
  it('colours are valid, deterministic, differ between slots, and are lighter in dark mode', () => {
    const seen = new Set<string>();
    for (let c = 5; c < 40; c++) {
      const l = slotColor(c, false), d = slotColor(c, true);
      expect(l).toMatch(HEX6); expect(d).toMatch(HEX6);
      expect(slotColor(c, false)).toBe(l);
      seen.add(l);
    }
    expect(seen.size).toBe(35);
    const lum = (h: string): number => parseInt(h.slice(1, 3), 16) + parseInt(h.slice(3, 5), 16) + parseInt(h.slice(5, 7), 16);
    expect(lum(slotColor(7, true))).toBeGreaterThan(lum(slotColor(7, false)));
  });
});
