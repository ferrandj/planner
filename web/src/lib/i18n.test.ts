import { dictionary, makeT } from './i18n';

describe('i18n', () => {
  it('French is the identity', () => {
    const { t } = makeT('fr');
    expect(t('Imprimer')).toBe('Imprimer');
    expect(t('texte inconnu')).toBe('texte inconnu');
  });
  it('translates known keys and falls back to French for unknown ones', () => {
    expect(makeT('en').t('Imprimer')).toBe('Print');
    expect(makeT('es').t('Imprimer')).toBeTruthy();
    expect(makeT('en').t('texte inconnu')).toBe('texte inconnu');
  });
  it('tf substitutes {vars} and leaves unknown ones', () => {
    const { tf } = makeT('en');
    expect(tf('dans {n} j', { n: 3 })).toContain('3');
    expect(tf('dans {n} j', {})).toContain('{n}');
    expect(makeT('fr').tf('dans {n} j', { n: 2 })).toBe('dans 2 j');
  });
  it('English and Spanish cover the same keys', () => {
    expect(Object.keys(dictionary.es).sort()).toEqual(Object.keys(dictionary.en).sort());
  });
  it('placeholders are preserved in every translation', () => {
    for (const lang of ['en', 'es'] as const) {
      for (const [k, v] of Object.entries(dictionary[lang])) {
        const ph = (s: string): string[] => (s.match(/\{\w+\}/g) || []).sort();
        expect(ph(v), `${lang}: ${k}`).toEqual(ph(k));
      }
    }
  });
});
