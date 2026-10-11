import type { Evt, Translate } from '../types';

/** Human label for a kind of line. */
export const K = (k: string, t: Translate): string =>
  t(({ live: 'Live du soir', webconf: 'Webconférence', perso: 'Séance perso', devoir: 'À rendre', exam: 'Examen', dispo: 'Sujet disponible' } as Record<string, string>)[k]);

export const evTitle = (e: Evt, t: Translate): string => (e.kind === 'perso' ? e.title || '' : K(e.kind, t) + (e.tag ? ' · ' + t(e.tag) : ''));

/** "Morning" / "Afternoon · evening" (the two work periods of a day). */
export const partLabel = (p: 'am' | 'pm', t: Translate): string => t(p === 'am' ? 'Matin' : 'Après-midi · soir');
