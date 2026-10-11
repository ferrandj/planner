import stickers from './stickers.json';
import groups from './stickerGroups.json';
import dict from './i18n.json';

const D = dict as Record<'en' | 'es', Record<string, string>>;

describe('sticker library', () => {
  it('has 80 drawings with unique ids', () => {
    expect(stickers).toHaveLength(80);
    expect(new Set(stickers.map((s) => s.id)).size).toBe(80);
  });
  it('lists every drawing in exactly one group, and only existing ones', () => {
    const ids = groups.flatMap((g) => g.ids);
    expect(new Set(ids).size).toBe(ids.length);
    expect([...ids].sort()).toEqual(stickers.map((s) => s.id).sort());
  });
  it('every name is translated to English and Spanish', () => {
    for (const s of stickers) {
      expect(D.en[s.n], s.n).toBeTruthy();
      expect(D.es[s.n], s.n).toBeTruthy();
    }
  });
  it('drawings are plain shapes (no scripts, handlers or links: they are injected as markup)', () => {
    for (const s of stickers) expect(s.v, s.id).not.toMatch(/<script|\son\w+=|href=|javascript:|<foreignObject|<image/i);
  });
});
