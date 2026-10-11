import dict from '../data/i18n.json';
import type { Lang, Translate, TranslateF } from '../types';

const D = dict as Record<'en' | 'es', Record<string, string>>;

/** The key is the French text; French is returned as is, and unknown keys fall back to French. */
export function makeT(lang: Lang): { t: Translate; tf: TranslateF } {
  const d = lang === 'fr' ? undefined : D[lang];
  const t: Translate = (s) => (d && d[s]) || s;
  const tf: TranslateF = (s, vars) => t(s).replace(/\{(\w+)\}/g, (m, k: string) => (vars && vars[k] !== undefined ? String(vars[k]) : m));
  return { t, tf };
}

export const LANGN: Record<Lang, string> = { fr: 'Français', en: 'English', es: 'Español' };
export const dictionary = D;
