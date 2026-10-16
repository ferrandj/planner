import type { Data, Evt, Translate, TranslateF } from '../types';
import { startAt } from './clock';
import { evTitle } from './labels';
import { isDone, type Model, subjectOf } from './model';

/** A reminder: shown shortly before something starts. `start` and `fireAt` are epoch milliseconds. */
export interface Reminder { id: string; start: number; fireAt: number; title: string; body: string }

export const LEADS = [5, 10, 15, 30, 60] as const;
const DAY = 864e5;

const hhmm = (ms: number): string => { const d = new Date(ms); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); };

/**
 * Everything with a start time that begins within the next `days` days and is not ticked off yet: sessions, personal sessions,
 * and the catch-up tiles the planner placed. (Assignment deadlines, exams and "available from" dates have no start time.)
 * The id carries the start moment, so a moved event is a new reminder.
 */
export function upcoming(evs: Evt[], model: Model, data: Data, nowMs: number, leadMin: number, t: Translate, tf: TranslateF, days = 7): Reminder[] {
  const out: Reminder[] = [];
  for (const e of evs) {
    if (e.kind === 'devoir' || e.kind === 'exam' || e.kind === 'dispo') continue;
    const start = startAt(e);
    if (start === null || start < nowMs - 60_000 || start > nowMs + days * DAY) continue;
    if (e.check && isDone(e, data)) continue;
    if (data.displaced[e.id]) continue;                // replaced by a catch-up: nothing happens at that time any more
    const sb = subjectOf(model, e.subject);
    const label = evTitle(e, t);
    out.push({
      id: e.id + '@' + start,
      start,
      fireAt: start - leadMin * 60_000,
      title: (sb ? sb.ab + ' · ' : '') + label,
      body: tf('Commence à {h} (dans {m} min)', { h: hhmm(start), m: leadMin })
    });
  }
  return out.sort((a, b) => a.start - b.start);
}

/** Reminders whose moment has come (from `fireAt` until the start) and that were not shown yet. */
export function due(list: Reminder[], nowMs: number, shown: Record<string, number>): Reminder[] {
  return list.filter((r) => r.fireAt <= nowMs && nowMs < r.start && !shown[r.id]);
}

/** What the server needs to push to the phone: nothing but ids, moments and texts. */
export const toServer = (list: Reminder[]): Array<Pick<Reminder, 'id' | 'start' | 'fireAt' | 'title' | 'body'>> => list.map(({ id, start, fireAt, title, body }) => ({ id, start, fireAt, title, body }));

const KEY = 'planner.reminded';
/** Reminders already shown on this device (so that a reload does not play them again). */
export function readShown(storage: Pick<Storage, 'getItem'> | undefined): Record<string, number> {
  try { const v = JSON.parse(storage?.getItem(KEY) || '{}'); return v && typeof v === 'object' ? v : {}; } catch { return {}; }
}
export function writeShown(storage: Pick<Storage, 'setItem'> | undefined, shown: Record<string, number>, nowMs: number): void {
  const keep = Object.fromEntries(Object.entries(shown).filter(([, ts]) => ts > nowMs - 2 * DAY));
  try { storage?.setItem(KEY, JSON.stringify(keep)); } catch { /* storage full or blocked: worst case a reminder repeats after a reload */ }
}
