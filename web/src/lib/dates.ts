import type { Lang, Translate, TranslateF } from '../types';

export const pad = (n: number): string => String(n).padStart(2, '0');
export const iso = (d: Date): string => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export function parse(s: string): Date {
  const p = s.split('-').map(Number);
  return new Date(p[0], p[1] - 1, p[2]);
}
/** The day `n` days after `day` (before it when negative). */
export const addDays = (day: string, n: number): string => { const d = parse(day); d.setDate(d.getDate() + n); return iso(d); };
/** Whole days from b to a (a - b). */
export const diff = (a: string, b: string): number => Math.round((parse(a).getTime() - parse(b).getTime()) / 864e5);

export interface Fmt {
  wd: Intl.DateTimeFormat; long: Intl.DateTimeFormat; month: Intl.DateTimeFormat; mon: Intl.DateTimeFormat;
  monShort: Intl.DateTimeFormat; mo: Intl.DateTimeFormat; wdLong: Intl.DateTimeFormat; wdNarrow: Intl.DateTimeFormat; locale: string;
}
export function makeFmt(lang: Lang): Fmt {
  const locale = ({ fr: 'fr-FR', en: 'en-GB', es: 'es-ES' } as const)[lang] || 'fr-FR';
  return {
    locale,
    wd: new Intl.DateTimeFormat(locale, { weekday: 'short' }),
    long: new Intl.DateTimeFormat(locale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
    month: new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }),
    mon: new Intl.DateTimeFormat(locale, { month: 'long' }),
    monShort: new Intl.DateTimeFormat(locale, { month: 'short', year: '2-digit' }),
    mo: new Intl.DateTimeFormat(locale, { month: 'short' }),
    wdLong: new Intl.DateTimeFormat(locale, { weekday: 'long' }),
    wdNarrow: new Intl.DateTimeFormat(locale, { weekday: 'narrow' })
  };
}
/** Weekday names Monday..Sunday for a formatter. */
export function wdList(f: Intl.DateTimeFormat): string[] {
  const o: string[] = [];
  for (let i = 0; i < 7; i++) o.push(f.format(new Date(2024, 0, 1 + i)));
  return o;
}

/** "today", "tomorrow", "in 12 d", "3 months ago" ... (keys are the French texts). */
export function rel(dd: number, t: Translate, tf: TranslateF): string {
  if (dd === 0) return t("aujourd'hui");
  if (dd === 1) return t('demain');
  if (dd === -1) return t('hier');
  const a = Math.abs(dd), big = a >= 60, u = big ? Math.round(a / 30) : a;
  return dd > 0 ? tf(big ? 'dans {n} mois' : 'dans {n} j', { n: u }) : tf(big ? 'il y a {n} mois' : 'il y a {n} j', { n: u });
}

/** "12 – 15 May 2027" style range (or the single long date). */
export function range(e: { date: string; end?: string }, f: Fmt): string {
  if (!e.end) return f.long.format(parse(e.date));
  const a = parse(e.date), b = parse(e.end);
  if (a.getMonth() === b.getMonth()) return `${a.getDate()}–${b.getDate()} ${f.mon.format(a)} ${a.getFullYear()}`;
  return `${a.getDate()} ${f.mon.format(a)} – ${b.getDate()} ${f.mon.format(b)} ${b.getFullYear()}`;
}
