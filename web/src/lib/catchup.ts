import type { Data, Evt } from '../types';
import { diff, iso, parse } from './dates';

/**
 * Automatic catch-up planner.
 *
 * Every day has two work periods: the morning ("am", before 12:00) and the afternoon/evening ("pm").
 * A period that already holds anything (session, live, web conference, personal session, exam)
 * is never used. The free periods are filled, in time order, with the sessions that are late:
 *
 *   - per subject, from the first to the last (chronological: 1, 2, 3 ... never 3, 5, 1);
 *   - preferring the subject of the next class that is coming up, if it still has something to catch up
 *     (otherwise the subject of the following class, and so on; otherwise the subject with the oldest backlog);
 *   - never more than `max` catch-ups in a row for the same subject (unless nothing else is left to place).
 *
 * The plan is derived from the data every time (nothing is stored), so it follows ticks, new sessions and the clock.
 */

export type Part = 'am' | 'pm';
export interface Placement { id: string; date: string; part: Part; /** start chosen by the user (manual planning); otherwise the period's usual start */ time?: string }
export interface Plan {
  placed: Placement[];
  /** late sessions for which no free period was found before the end of the schedule */
  unplaced: string[];
  /** placement of a given late session */
  byId: Record<string, Placement>;
}

export const EMPTY_PLAN: Plan = { placed: [], unplaced: [], byId: {} };

const NOON = 12 * 60;
const MAX_DAYS = 400;
/** Where a catch-up tile starts: 09:30 in the morning, 14:00 in the afternoon (so the morning one always comes first in a day). */
export const START: Record<Part, string> = { am: '09:30', pm: '14:00' };
/** Today's morning is still usable before noon, today's afternoon/evening until 17:00. */
const AM_LAST = NOON;
const PM_LAST = 17 * 60;

const toMin = (h: string, m: string): number => Number(h) * 60 + Number(m);

/** Which periods of the day a time label such as "18:30 – 21:30", "13:30", "– 12:00" or "" occupies. */
export function partsOfTime(time: string | undefined): Part[] {
  const ts = [...(time || '').matchAll(/(\d{1,2})[:h](\d{2})/g)].map((m) => toMin(m[1], m[2]));
  if (!ts.length) return ['am', 'pm'];                       // no time: the whole day is considered taken
  let start = ts[0], end = ts.length > 1 ? ts[1] : ts[0];
  if ((time || '').trim().startsWith('–') || (time || '').trim().startsWith('-')) { start = 0; end = ts[0]; }
  const out: Part[] = [];
  if (start < NOON) out.push('am');
  if (start >= NOON || end > 13 * 60) out.push('pm');        // a morning class ending a little after noon leaves the afternoon free
  return out;
}

const slotIndex = (date: string, part: Part, from: string): number => diff(date, from) * 2 + (part === 'pm' ? 1 : 0);

const BLOCKING = new Set(['live', 'webconf', 'perso', 'exam']);

export interface PlanInput {
  /** all lines of the planner, without any catch-up tile */
  events: Evt[];
  today: string;
  done: Data['done'];
  /** maximum catch-ups in a row for the same subject */
  max: number;
  /** minutes since midnight at the moment of planning (0 = the whole of today is available) */
  nowMin?: number;
}

/** Periods ("YYYY-MM-DD|am" / "|pm") from `today` on that already hold a session, live, web conference, personal session or exam. */
export function blockedPeriods(events: Evt[], today: string): Set<string> {
  const blocked = new Set<string>();
  events.forEach((e) => {
    const lastDay = e.end || e.date;
    if (!BLOCKING.has(e.kind) || lastDay < today || e.planOf) return;
    const whole = e.kind === 'exam' || !!e.end;
    const parts = whole ? (['am', 'pm'] as Part[]) : partsOfTime(e.time);
    for (let d = e.date < today ? today : e.date; d <= lastDay; d = shift(d, 1)) parts.forEach((p) => blocked.add(d + '|' + p));
  });
  return blocked;
}

/** The late, un-ticked sessions (live and web conference), oldest first. */
export const lateOf = (events: Evt[], today: string, done: Data['done']): Evt[] =>
  events.filter((e) => e.check && (e.kind === 'live' || e.kind === 'webconf') && !done[e.id] && e.date < today)
    .sort((a, b) => ((a.date + ' ' + (a.time || '') + ' ' + a.id) < (b.date + ' ' + (b.time || '') + ' ' + b.id) ? -1 : 1));

export function planCatchUp(inp: PlanInput): Plan {
  const { events, today, done } = inp;
  const max = Math.max(1, Math.floor(inp.max) || 3);
  const nowMin = inp.nowMin || 0;

  const isDone = (e: Evt): boolean => !!done[e.id];
  const key = (e: Evt): string => e.date + ' ' + (e.time || '') + ' ' + e.id;

  // 1. the backlog, per subject, first to last
  const queues = new Map<string, Evt[]>();
  events
    .filter((e) => e.check && (e.kind === 'live' || e.kind === 'webconf') && !isDone(e) && e.date < today)
    .sort((a, b) => (key(a) < key(b) ? -1 : 1))
    .forEach((e) => { const s = e.subject || ''; if (!queues.has(s)) queues.set(s, []); queues.get(s)!.push(e); });
  const pending = [...queues.values()].reduce((n, q) => n + q.length, 0);
  if (!pending) return EMPTY_PLAN;

  // 2. periods that already hold something
  const blocked = blockedPeriods(events, today);
  let last = today;
  events.forEach((e) => { const lastDay = e.end || e.date; if (lastDay > last) last = lastDay; });

  // 3. upcoming classes (to prefer the subject of the next one), by period
  const upcoming = events
    .filter((e) => e.subject && (e.kind === 'live' || e.kind === 'webconf' || e.kind === 'perso') && e.date >= today && !isDone(e))
    .flatMap((e) => partsOfTime(e.time).slice(0, 1).map((p) => ({ idx: slotIndex(e.date, p, today), subject: e.subject as string })))
    .sort((a, b) => a.idx - b.idx);

  // 4. free periods from now to the end of the schedule
  const horizon = Math.min(diff(last, today), MAX_DAYS);
  const placed: Placement[] = [];
  let lastSubject = '\u0000', run = 0, left = pending, up = 0;
  for (let i = 0; i <= horizon && left > 0; i++) {
    const date = shift(today, i);
    for (const part of ['am', 'pm'] as Part[]) {
      if (left === 0) break;
      if (i === 0 && nowMin >= (part === 'am' ? AM_LAST : PM_LAST)) continue;
      if (blocked.has(date + '|' + part)) continue;
      const idx = i * 2 + (part === 'pm' ? 1 : 0);
      while (up < upcoming.length && upcoming[up].idx <= idx) up++;
      const ok = (s: string): boolean => (queues.get(s)?.length || 0) > 0 && !(s === lastSubject && run >= max);

      let pick: string | undefined;
      for (let j = up; j < upcoming.length; j++) if (ok(upcoming[j].subject)) { pick = upcoming[j].subject; break; }
      if (pick === undefined) {
        let best: string | undefined;
        for (const [s, q] of queues) {
          if (!ok(s)) continue;
          if (best === undefined) { best = s; continue; }
          const a = queues.get(best)!;
          if (key(q[0]) < key(a[0]) || (key(q[0]) === key(a[0]) && q.length > a.length)) best = s;
        }
        pick = best;
      }
      if (pick === undefined) {
        // only the subject that has just had its quota is left: carry on rather than leave it unplanned
        for (const [s, q] of queues) if (q.length) { pick = s; break; }
      }
      if (pick === undefined) break;
      const ev = queues.get(pick)!.shift() as Evt;
      run = pick === lastSubject ? run + 1 : 1;
      lastSubject = pick;
      placed.push({ id: ev.id, date, part });
      left--;
    }
  }

  const byId: Record<string, Placement> = {};
  placed.forEach((p) => { byId[p.id] = p; });
  const unplaced = [...queues.values()].flat().map((e) => e.id);
  return { placed, unplaced, byId };
}

function shift(day: string, n: number): string {
  const d = parse(day);
  d.setDate(d.getDate() + n);
  return iso(d);
}

/** Catch-up tiles for the planner (lines like the original sessions, on their new day). */
export function planTiles(events: Evt[], plan: Plan): Evt[] {
  if (!plan.placed.length) return [];
  const orig = new Map(events.map((e) => [e.id, e]));
  return plan.placed.flatMap((p) => {
    const o = orig.get(p.id);
    if (!o) return [];
    return [{
      id: 'plan:' + o.id, kind: o.kind, date: p.date, time: p.time || (p.part === 'am' ? START.am : START.pm), part: p.part, tag: o.tag,
      subject: o.subject, check: true, planOf: o.id, from: o.date
    } as Evt];
  });
}

/** What the user chose for the late sessions, saved per session: the day and the start time ("09:00"). */
export type Picks = Record<string, { date: string; time: string }>;

export const partOfHour = (time: string): Part => (Number(time.slice(0, 2)) < 12 ? 'am' : 'pm');

/**
 * Manual planning: the catch-ups are exactly what the user chose (nothing is moved by itself). A choice is kept as long as its session
 * is still late and not ticked and its day is not over; a session whose day went by without being ticked goes back to "to plan".
 */
export function planManual(inp: { events: Evt[]; today: string; done: Data['done']; picks: Picks }): Plan {
  const late = lateOf(inp.events, inp.today, inp.done);
  const placed: Placement[] = [];
  const byId: Record<string, Placement> = {};
  for (const e of late) {
    const k = inp.picks[e.id];
    if (!k || k.date < inp.today) continue;
    const p: Placement = { id: e.id, date: k.date, part: partOfHour(k.time), time: k.time };
    placed.push(p);
    byId[e.id] = p;
  }
  placed.sort((a, b) => (a.date + (a.time || '') < b.date + (b.time || '') ? -1 : 1));
  return { placed, unplaced: late.filter((e) => !byId[e.id]).map((e) => e.id), byId };
}
