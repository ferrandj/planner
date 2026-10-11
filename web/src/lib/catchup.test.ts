import { describe, expect, it } from 'vitest';
import type { Evt } from '../types';
import { EMPTY_PLAN, partsOfTime, planCatchUp, planTiles } from './catchup';

const TODAY = '2026-10-12'; // a Monday

const ev = (id: string, subject: string, date: string, kind: Evt['kind'] = 'webconf', time = '13:30'): Evt =>
  ({ id, subject, date, kind, time, tag: '', check: true });
const run = (events: Evt[], o: { max?: number; done?: Record<string, boolean>; nowMin?: number } = {}) =>
  planCatchUp({ events, today: TODAY, done: o.done || {}, max: o.max ?? 3, nowMin: o.nowMin });
const ids = (p: ReturnType<typeof run>): string[] => p.placed.map((x) => x.id);
/** a far-away last event so that the schedule has room */
const END = ev('end', 'zz', '2026-12-31', 'perso', '08:00');

describe('which periods a time occupies', () => {
  it.each([
    ['18:30 – 21:30', ['pm']], ['13:30', ['pm']], ['09:00', ['am']], ['09:00 – 12:30', ['am']],
    ['09:00 – 17:00', ['am', 'pm']], ['11:00 – 14:00', ['am', 'pm']], ['', ['am', 'pm']], ['– 10:00', ['am']]
  ])('%s', (time, want) => expect(partsOfTime(time)).toEqual(want));
});

describe('catch-up planner', () => {
  it('plans nothing when nothing is late', () => {
    expect(run([ev('a', 'x', '2026-10-20'), END])).toEqual(EMPTY_PLAN);
  });

  it('only late, un-ticked sessions are planned (done, future, assignments and hidden ones are not)', () => {
    const late = ev('late', 'x', '2026-10-01');
    const p = run([late, ev('done', 'x', '2026-10-02'), ev('fut', 'x', '2026-10-30'), { id: 'dev', kind: 'devoir', date: '2026-10-03' } as Evt, END], { done: { done: true } });
    expect(ids(p)).toEqual(['late']);
  });

  it('fills the first free period (this morning) and keeps first-to-last order per subject', () => {
    const p = run([ev('c3', 'c', '2026-10-03'), ev('c1', 'c', '2026-10-01'), ev('c2', 'c', '2026-10-02'), END]);
    expect(p.placed.map((x) => [x.id, x.date, x.part])).toEqual([['c1', TODAY, 'am'], ['c2', TODAY, 'pm'], ['c3', '2026-10-13', 'am']]);
  });

  it('never uses a period that already holds a class (a live in the evening blocks the afternoon/evening only)', () => {
    const p = run([ev('l1', 'c', '2026-10-01'), ev('l2', 'c', '2026-10-02'), ev('l3', 'c', '2026-10-03'),
      ev('live', 'd', TODAY, 'live', '18:30 – 21:30'), ev('web', 'd', '2026-10-13', 'webconf', '13:30'), END]);
    expect(p.placed.map((x) => [x.date, x.part])).toEqual([[TODAY, 'am'], ['2026-10-13', 'am'], ['2026-10-14', 'am']]);
  });

  it('a personal session without a time takes the whole day; an exam takes every day it covers', () => {
    const p = run([ev('l1', 'c', '2026-10-01'), ev('l2', 'c', '2026-10-02'), ev('l3', 'c', '2026-10-03'),
      { id: 'perso', kind: 'perso', date: TODAY, time: '', check: true, subject: '' } as Evt,
      { id: 'ex', kind: 'exam', date: '2026-10-13', end: '2026-10-14' } as Evt, END]);
    expect(p.placed.map((x) => [x.date, x.part])).toEqual([['2026-10-15', 'am'], ['2026-10-15', 'pm'], ['2026-10-16', 'am']]);
  });

  it('assignment deadlines and "available from" dates do not take a period', () => {
    const p = run([ev('l1', 'c', '2026-10-01'), { id: 'dev', kind: 'devoir', date: TODAY } as Evt, { id: 'av', kind: 'dispo', date: TODAY } as Evt, END]);
    expect(p.placed[0]).toMatchObject({ date: TODAY, part: 'am' });
  });

  it('later in the day, the periods that are already over are not used', () => {
    const l = [ev('l1', 'c', '2026-10-01'), ev('l2', 'c', '2026-10-02'), ev('l3', 'c', '2026-10-03'), END];
    expect(run(l, { nowMin: 13 * 60 }).placed[0]).toMatchObject({ date: TODAY, part: 'pm' });
    expect(run(l, { nowMin: 18 * 60 }).placed[0]).toMatchObject({ date: '2026-10-13', part: 'am' });
  });

  it('prefers the subject of the next class when it still has something to catch up', () => {
    const p = run([ev('a1', 'a', '2026-10-01'), ev('b1', 'b', '2026-10-02'),
      ev('next', 'b', TODAY, 'webconf', '13:30'), ev('after', 'a', '2026-10-14', 'webconf', '13:30'), END]);
    expect(ids(p)).toEqual(['b1', 'a1']);                                  // the next class is "b"
  });

  it('otherwise follows the following classes, then falls back to the oldest backlog', () => {
    const p = run([ev('a1', 'a', '2026-10-05'), ev('b1', 'b', '2026-10-02'), ev('c1', 'c', '2026-10-03'),
      ev('next', 'z', TODAY, 'webconf', '13:30'), ev('after', 'c', '2026-10-14', 'webconf', '13:30'), END]);
    expect(ids(p)).toEqual(['c1', 'b1', 'a1']);                            // z has nothing; c is next; then oldest first (b, a)
  });

  it('never more than the chosen number in a row for the same subject', () => {
    const c = [1, 2, 3, 4].map((i) => ev('c' + i, 'c', `2026-10-0${i}`));
    const o = [ev('o1', 'o', '2026-10-05')];
    const subj = (p: ReturnType<typeof run>): string[] => p.placed.map((x) => x.id[0]);
    expect(subj(run([...c, ...o, END]))).toEqual(['c', 'c', 'c', 'o', 'c']);
    expect(subj(run([...c, ...o, END], { max: 2 }))).toEqual(['c', 'c', 'o', 'c', 'c']);
    expect(subj(run([...c, ...o, END], { max: 1 }))).toEqual(['c', 'o', 'c', 'c', 'c']);
  });

  it('the limit does not apply when nothing else is left (everything still gets planned)', () => {
    const c = [1, 2, 3, 4, 5].map((i) => ev('c' + i, 'c', `2026-10-0${i}`));
    expect(ids(run([...c, END], { max: 2 }))).toEqual(['c1', 'c2', 'c3', 'c4', 'c5']);
  });

  it('with the next class being the same subject the quota still applies', () => {
    const c = [1, 2, 3, 4].map((i) => ev('c' + i, 'c', `2026-10-0${i}`));
    const p = run([...c, ev('o1', 'o', '2026-10-05'), ev('next', 'c', '2026-10-30', 'webconf', '13:30'), END]);
    expect(p.placed.map((x) => x.id[0])).toEqual(['c', 'c', 'c', 'o', 'c']);
  });

  it('lists what cannot fit before the end of the schedule', () => {
    const late = [1, 2, 3, 4, 5].map((i) => ev('c' + i, 'c', `2026-10-0${i}`));
    const p = run([...late, ev('last', 'z', '2026-10-13', 'webconf', '13:30')]);  // schedule ends tomorrow: 3 free periods
    expect(p.placed).toHaveLength(3);
    expect(p.unplaced).toEqual(['c4', 'c5']);
  });

  it('is stable: the same input always gives the same plan, and ticking the first one moves everyone up', () => {
    const l = [1, 2, 3].map((i) => ev('c' + i, 'c', `2026-10-0${i}`));
    const a = run([...l, END]), b = run([...l, END]);
    expect(a).toEqual(b);
    const after = run([...l, END], { done: { c1: true } });
    expect(after.placed.map((x) => [x.id, x.date, x.part])).toEqual([['c2', TODAY, 'am'], ['c3', TODAY, 'pm']]);
  });

  it('builds tiles that point back to the late session', () => {
    const events = [ev('c1', 'c', '2026-10-01', 'live'), END];
    const tiles = planTiles(events, run(events));
    expect(tiles).toEqual([expect.objectContaining({ id: 'plan:c1', planOf: 'c1', date: TODAY, kind: 'live', subject: 'c', from: '2026-10-01', time: 'Matin' })]);
  });
});
