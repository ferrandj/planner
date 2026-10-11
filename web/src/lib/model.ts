import type { Base, Data, Devoir, Evt, Exam, SessionEvt, Subject, Translate } from '../types';
import { diff } from './dates';

/** The schedule as the user sees it: reference data with the user's edits layered on top. */
export interface Model { subjects: Subject[]; devoirs: Devoir[]; exams: Exam[]; events: SessionEvt[] }

export function resolveModel(base: Base, data: Data): Model {
  const ed = (g: string, id: string): Record<string, string> => data.edits[g + ':' + id] || {};
  return {
    subjects: base.s.map((o) => { const m = { ...o, ...ed('s', o.id) } as Subject; m.short = m.name; return m; }),
    devoirs: base.d.map((o) => ({ ...o, ...ed('d', o.id) }) as Devoir),
    exams: base.x.map((o) => ({ ...o, ...ed('x', o.id) }) as Exam),
    events: base.e.map((o) => ({ ...o, ...ed('e', o.id) }) as SessionEvt)
  };
}

export const appTitle = (data: Data, t: Translate): string => data.edits.app?.title || t('Planning');
export const appEyebrow = (data: Data): string => data.edits.app?.eyebrow || '';

export function subjectOf(m: Model, id: string | undefined): Subject | undefined {
  return id ? m.subjects.find((s) => s.id === id) : undefined;
}

/** Sessions, custom sessions, assignment deadlines, exams and "subject available" dates, sorted by date then time. */
export function buildEvents(m: Model, data: Data): Evt[] {
  const ev: Evt[] = m.events.filter((e) => !data.hidden[e.id]).map((e) => ({ check: true, ...e }));
  data.custom.forEach((c) => {
    const time = c.tend ? (c.time ? c.time + ' – ' + c.tend : '– ' + c.tend) : (c.time || '');
    ev.push({ check: true, kind: 'perso', ...c, time });
  });
  m.devoirs.forEach((d) => {
    ev.push({ id: 'dev:' + d.id, kind: 'devoir', date: d.date, title: d.title, devoir: d });
    if (d.avail) ev.push({ id: 'av:' + d.id, kind: 'dispo', date: d.avail, title: d.title });
  });
  m.exams.forEach((x) => ev.push({ id: x.id, kind: 'exam', date: x.date, end: x.end, title: x.title }));
  ev.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : (a.time || '') < (b.time || '') ? -1 : 1));
  return ev;
}

export const renduCount = (m: Model, data: Data, d: Devoir): number => m.subjects.filter((s) => data.rendu[d.id + ':' + s.id]).length;
export const devoirDone = (m: Model, data: Data, d: Devoir): boolean => renduCount(m, data, d) === m.subjects.length;
export const lastDay = (e: { date: string; end?: string }): string => e.end || e.date;

export type Scope = 'todo' | 'all';

export function visible(e: Evt, filter: string): boolean {
  return !(filter !== 'all' && e.subject && e.subject !== filter);
}

export function inScope(e: Evt, scope: Scope, today: string, m: Model, data: Data): boolean {
  if (scope === 'all') return true;
  if (e.check && data.done[e.id]) return false;
  if (e.kind === 'devoir' && e.devoir && devoirDone(m, data, e.devoir)) return false;
  if (!e.check && e.kind !== 'devoir' && lastDay(e) < today) return false;
  return true;
}

export const isLate = (e: Evt, today: string, data: Data): boolean => !!e.check && !data.done[e.id] && e.date < today;

/** Assignments due within 7 days (today included) that are not fully handed in. */
export function dueSoon(m: Model, data: Data, today: string): Devoir[] {
  return m.devoirs.filter((d) => { const n = diff(d.date, today); return n >= 0 && n <= 7 && !devoirDone(m, data, d); });
}

export const eventsOn = (evs: Evt[], day: string): Evt[] => evs.filter((e) => e.date <= day && lastDay(e) >= day);

/** Every month (YYYY-MM) from the first to the last event. */
export function monthsList(evs: Evt[]): string[] {
  let min = '9999-99', max = '0000-00';
  evs.forEach((e) => { const a = e.date.slice(0, 7), b = lastDay(e).slice(0, 7); if (a < min) min = a; if (b > max) max = b; });
  if (min > max) return [];
  const out: string[] = [];
  let [y, mo] = min.split('-').map(Number);
  while (`${y}-${String(mo).padStart(2, '0')}` <= max) {
    out.push(`${y}-${String(mo).padStart(2, '0')}`);
    mo++;
    if (mo > 12) { mo = 1; y++; }
  }
  return out;
}

/** Next assignment not yet fully handed in, and the ones already past their date. */
export function nextDevoir(m: Model, data: Data, today: string): Devoir | undefined {
  return m.devoirs.find((d) => diff(d.date, today) >= 0 && !devoirDone(m, data, d));
}
export const lateDevoirs = (m: Model, data: Data, today: string): Devoir[] =>
  m.devoirs.filter((d) => diff(d.date, today) < 0 && !devoirDone(m, data, d));

/** Hand-in progress for the whole schedule. */
export function renduTotals(m: Model, data: Data): { done: number; total: number } {
  let done = 0;
  m.devoirs.forEach((d) => { done += renduCount(m, data, d); });
  return { done, total: m.devoirs.length * m.subjects.length };
}

/** Sessions (live / webconference) that are overdue and not ticked: the "to catch up" counter. */
export const backlogCount = (evs: Evt[], today: string, data: Data): number =>
  evs.filter((e) => isLate(e, today, data) && (e.kind === 'live' || e.kind === 'webconf')).length;
