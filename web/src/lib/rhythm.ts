import type { Data, SessionKind } from '../types';
import { parse } from './dates';
import type { Model } from './model';

/**
 * A subject's classes usually come on the same weekday at the same time, every week. These helpers read that rhythm from
 * the sessions already in the planner, so that a day of the calendar can offer "add the usual class" in one click.
 */

export interface Pattern { subject: string; kind: SessionKind; weekday: number; time: string; count: number }
export interface Suggestion { subject: string; kind: SessionKind; time: string }

const KINDS: SessionKind[] = ['live', 'webconf'];
/** Time used when nothing is known about a subject/kind yet. */
export const DEFAULT_TIME: Record<SessionKind, string> = { live: '18:30 – 21:30', webconf: '13:30' };

/** Weekday (0 = Sunday) + time combinations of each subject's sessions, most frequent first. Sessions the user removed do not count. */
export function patterns(m: Model, data: Data): Pattern[] {
  const by = new Map<string, Pattern & { last: string }>();
  for (const e of m.events) {
    if (data.hidden[e.id]) continue;
    const wd = parse(e.date).getDay(), key = [e.subject, e.kind, wd, e.time].join('|');
    const p = by.get(key);
    if (p) { p.count++; if (e.date > p.last) p.last = e.date; }
    else by.set(key, { subject: e.subject, kind: e.kind, weekday: wd, time: e.time, count: 1, last: e.date });
  }
  return [...by.values()].sort((a, b) => b.count - a.count || (a.last < b.last ? 1 : -1))
    .map(({ last, ...rest }) => (void last, rest));
}

/** The usual time of a subject's classes of this kind (the most frequent one), or the default for the kind. */
export function usualTime(m: Model, data: Data, subject: string, kind: SessionKind): string {
  return patterns(m, data).find((p) => p.subject === subject && p.kind === kind)?.time ?? DEFAULT_TIME[kind];
}

/**
 * Classes to offer for a given day: every subject/kind whose usual weekday is that day (the dominant rhythm, plus any other
 * weekday/time that repeats), unless that subject already has a class of that kind on the day.
 */
export function suggestFor(m: Model, data: Data, day: string): Suggestion[] {
  const wd = parse(day).getDay();
  const taken = new Set(m.events.filter((e) => e.date === day && !data.hidden[e.id]).map((e) => e.subject + '|' + e.kind));
  const all = patterns(m, data);
  const out: Suggestion[] = [];
  for (const s of m.subjects) {
    for (const kind of KINDS) {
      if (taken.has(s.id + '|' + kind)) continue;
      const mine = all.filter((p) => p.subject === s.id && p.kind === kind);
      const hit = mine.find((p, i) => p.weekday === wd && (i === 0 || p.count >= 2));
      if (hit) out.push({ subject: s.id, kind, time: hit.time });
    }
  }
  return out;
}

/** Every subject/kind with its usual time, for "add another class" on any day. */
export function allChoices(m: Model, data: Data): Suggestion[] {
  return m.subjects.flatMap((s) => KINDS.map((kind) => ({ subject: s.id, kind, time: usualTime(m, data, s.id, kind) })));
}
