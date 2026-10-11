import type { Evt } from '../types';
import { parse } from './dates';

/** Start and end (minutes since midnight) found in a time label such as "18:30 – 21:30", "13:30" or "– 12:00"; null when there is none. */
export function timeRange(time: string | undefined): { start: number | null; end: number | null } {
  const label = (time || '').trim();
  const ts = [...label.matchAll(/(\d{1,2})[:h](\d{2})/g)].map((m) => Number(m[1]) * 60 + Number(m[2]));
  if (!ts.length) return { start: null, end: null };
  if (/^[–-]/.test(label)) return { start: null, end: ts[0] };      // "– 12:00": only an end
  return { start: ts[0], end: ts.length > 1 ? ts[1] : null };
}

/** Moment (epoch ms, local time) at which an event starts, or null for events without a start time (deadlines, exams, "available" dates). */
export function startAt(e: Pick<Evt, 'date' | 'time'>): number | null {
  const { start } = timeRange(e.time);
  if (start === null) return null;
  const d = parse(e.date);
  d.setHours(Math.floor(start / 60), start % 60, 0, 0);
  return d.getTime();
}

/** "1 h 05", "25 min" */
export function span(min: number): string {
  const h = Math.floor(min / 60), m = min % 60;
  return h ? `${h} h${m ? ' ' + String(m).padStart(2, '0') : ''}` : `${m} min`;
}
