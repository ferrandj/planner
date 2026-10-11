import type { Base, Data, Devoir, Evt, Exam, SessionEvt, SessionKind, Subject } from '../types';
import { iso, parse } from './dates';

export type ItemKind = 's' | 'd' | 'x' | 'e';

export const newId = (): string => 'u' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

const addDays = (day: string, n: number): string => { const d = parse(day); d.setDate(d.getDate() + n); return iso(d); };

const allSubjects = (base: Base, d: Data): Subject[] => base.s.concat(d.extra.s);

/** Colour slot for a new subject: one nobody has used yet (removed subjects keep theirs, so a restore never clashes). */
export function nextSlot(base: Base, d: Data): number {
  return allSubjects(base, d).reduce((m, s) => Math.max(m, s.c || 0), 0) + 1;
}

export function addSubject(d: Data, base: Base): string {
  const id = newId(), c = nextSlot(base, d);
  d.extra.s.push({ id, code: 'NOUVEAU', name: 'Nouvelle matière', short: 'Nouvelle matière', ab: 'Nouv.', c });
  return 's:' + id;
}

export function addDevoir(d: Data, base: Base, today: string): string {
  const id = newId(), n = base.d.length + d.extra.d.length + 1;
  const dev: Devoir = { id, ab: 'D' + n, title: 'Nouveau devoir', date: addDays(today, 14) };
  d.extra.d.push(dev);
  return 'd:' + id;
}

export function addExam(d: Data, today: string): string {
  const id = newId();
  const x: Exam = { id, title: 'Examen', date: addDays(today, 30) };
  d.extra.x.push(x);
  return 'x:' + id;
}

export function addSession(d: Data, subject: string, kind: SessionKind, date: string, time?: string): string {
  const id = newId();
  const e: SessionEvt = { id, subject, kind, date, time: time ?? (kind === 'live' ? '18:30 – 21:30' : '12:30'), tag: '' };
  d.extra.e.push(e);
  return 'e:' + id;
}

/** Remove an item without erasing it. Sessions use the existing "hidden" flag. */
export function removeItem(d: Data, key: string): void {
  if (key.startsWith('e:')) d.hidden[key.slice(2)] = true;
  else d.deleted[key] = true;
}

export function restoreItem(d: Data, key: string): void {
  if (key.startsWith('e:')) delete d.hidden[key.slice(2)];
  else delete d.deleted[key];
}

export const isRemoved = (d: Data, key: string): boolean => (key.startsWith('e:') ? !!d.hidden[key.slice(2)] : !!d.deleted[key]);

/** Parse "s:id" / "d:id" ... */
export function splitKey(key: string): { kind: string; id: string } {
  const i = key.indexOf(':');
  return { kind: key.slice(0, i), id: key.slice(i + 1) };
}

/** Which editable item a tile stands for ("d:id", "e:id", ...), or null for tiles that are computed (e.g. planned catch-up). */
export function editKeyOf(e: Evt): string | null {
  if (e.planOf) return null;
  switch (e.kind) {
    case 'live': case 'webconf': return 'e:' + e.id;
    case 'perso': return 'c:' + e.id;
    case 'devoir': return e.devoir ? 'd:' + e.devoir.id : null;
    case 'dispo': return 'd:' + e.id.replace(/^av:/, '');
    case 'exam': return 'x:' + e.id;
    default: return null;
  }
}
