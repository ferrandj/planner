import { colOf, customTokens, hex2hsl, hex2hsv, hsv2hex, hslHex, lum, softOf, subjectColorFor, PRINT_PALS } from './colors';

describe('colors', () => {
  it('hsl round trip', () => {
    for (const hex of ['#ff0000', '#00ff00', '#0000ff', '#7b4fe0', '#336699', '#cccccc']) {
      const { h, s, l } = hex2hsl(hex);
      expect(hslHex(h, s * 100, l * 100)).toBe(hex);
    }
  });
  it('hsv round trip', () => {
    for (const hex of ['#ff0000', '#00ff7f', '#7b4fe0', '#000000', '#ffffff', '#123456']) expect(hsv2hex(hex2hsv(hex))).toBe(hex);
  });
  it('luminance ordering', () => {
    expect(lum('#000000')).toBe(0);
    expect(lum('#ffffff')).toBeCloseTo(1, 5);
    expect(lum('#ffff00')).toBeGreaterThan(lum('#0000ff'));
  });
  it('softOf lightens towards white', () => {
    expect(softOf('#000000')).toBe('#cccccc');
    expect(softOf('#ffffff')).toBe('#ffffff');
  });
  it('colOf accepts presets and hex, otherwise falls back to rose', () => {
    expect(colOf('bleu').m).toBe('#3B73D1');
    expect(colOf('#336699')).toEqual({ m: '#336699', s: softOf('#336699') });
    expect(colOf('nonsense').m).toBe('#D6457F');
    expect(colOf(undefined).m).toBe('#D6457F');
  });
  it('customTokens: readable accent for both schemes', () => {
    const light = customTokens('#ffee00', false), dark = customTokens('#101040', true);
    expect(lum(light['--accent'])).toBeLessThan(0.45);        // a very light accent is darkened on a light UI
    expect(lum(dark['--accent'])).toBeGreaterThanOrEqual(0.2); // and a very dark one lightened on a dark UI
    expect(light['--surface']).toBe('#FFFFFF');
    expect(customTokens('#808080', false)['--bg']).toBe(hslHex(0, 0, 94)); // greys stay grey
    expect(['#10151b', '#FFFFFF']).toContain(light['--accent-ink']);
  });
  it('subjectColorFor lightens dark colours only in dark mode', () => {
    expect(subjectColorFor('#223344', false)).toBe('#223344');
    expect(subjectColorFor('#223344', true)).not.toBe('#223344');
    expect(subjectColorFor('#ffddaa', true)).toBe('#ffddaa');
    expect(subjectColorFor('bad', true)).toBe('');
    expect(subjectColorFor(undefined, false)).toBe('');
  });
  it('print palettes are valid hex', () => {
    Object.values(PRINT_PALS).forEach((p) => { expect(p.m).toMatch(/^#[0-9a-f]{6}$/i); expect(p.s).toMatch(/^#[0-9a-f]{6}$/i); });
  });
});
