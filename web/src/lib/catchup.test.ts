import { describe, expect, it } from 'vitest';
import type { Evt } from '../types';
import { byDate } from './model';
import { EMPTY_PLAN, blockedPeriods, lateOf, occupantsOf, partOfHour, partsOfTime, planCatchUp, planManual, planTiles } from './catchup';

const TODAY = '2026-10-12'; // a Monday

const ev = (id: string, subject: string, date: string, kind: Evt['kind'] = 'webconf', time = '13:30'): Evt =>
  ({ id, subject, date, kind, time, tag: '', check: true });
const run = (events: Evt[], o: { max?: number; done?: Record<string, boolean>; nowMin?: number; displaced?: Record<string, boolean> } = {}) =>
  planCatchUp({ events, today: TODAY, done: o.done || {}, max: o.max ?? 3, nowMin: o.nowMin, displaced: o.displaced });
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
    expect(tiles).toEqual([expect.objectContaining({ id: 'plan:c1', planOf: 'c1', date: TODAY, kind: 'live', subject: 'c', from: '2026-10-01', time: '09:30', part: 'am' })]);
  });
});

describe('catch-up tiles in the day', () => {
  it('start at 09:30 (morning) and 14:00 (afternoon), so the morning one is listed first, then the afternoon one, then the evening live', () => {
    const late = [ev('c1', 'c', '2026-10-01'), ev('c2', 'c', '2026-10-02')];
    const live = ev('live', 'd', TODAY, 'live', '18:30 – 21:30');          // evening live: takes the afternoon/evening period of that day
    const events = [...late, live, END];
    const tiles = planTiles(events, run(events));
    expect(tiles.map((x) => [x.date, x.time, x.part])).toEqual([[TODAY, '09:30', 'am'], ['2026-10-13', '09:30', 'am']]);
    const day = [live, ...planTiles([...late, END], run([...late, END]))].filter((e) => e.date === TODAY).sort(byDate);
    expect(day.map((e) => e.time)).toEqual(['09:30', '14:00', '18:30 – 21:30']);
  });
  it('the afternoon and the evening are one single period', () => {
    const events = [ev('c1', 'c', '2026-10-01'), ev('c2', 'c', '2026-10-02'), ev('c3', 'c', '2026-10-03'),
      ev('aft', 'd', TODAY, 'webconf', '13:30'), ev('eve', 'e', '2026-10-13', 'live', '18:30 – 21:30'), END];
    const p = run(events);
    expect(p.placed.some((x) => x.date === TODAY && x.part === 'pm')).toBe(false);
    expect(p.placed.some((x) => x.date === '2026-10-13' && x.part === 'pm')).toBe(false);
  });
});

describe('manual catch-up planning', () => {
  const late = [ev('c1', 'c', '2026-10-01'), ev('c2', 'c', '2026-10-02'), ev('c3', 'c', '2026-10-03')];
  const manual = (picks: Record<string, { date: string; time: string }>, done: Record<string, boolean> = {}): ReturnType<typeof run> =>
    planManual({ events: [...late, END], today: TODAY, done, picks });

  it('knows which period an hour belongs to', () => {
    expect(['08:00', '11:00', '12:00', '14:00', '21:00'].map(partOfHour)).toEqual(['am', 'am', 'pm', 'pm', 'pm']);
  });

  it('puts the late classes exactly where the user chose, at the chosen time, and nothing else', () => {
    const p = manual({ c2: { date: '2026-10-13', time: '10:00' }, c1: { date: '2026-10-13', time: '08:00' } });
    expect(p.placed.map((x) => [x.id, x.date, x.part, x.time])).toEqual([['c1', '2026-10-13', 'am', '08:00'], ['c2', '2026-10-13', 'am', '10:00']]);
    expect(p.unplaced).toEqual(['c3']);
    expect(p.byId.c1.time).toBe('08:00');
  });

  it('the tiles start at the chosen hour', () => {
    const events = [...late, END];
    const tiles = planTiles(events, planManual({ events, today: TODAY, done: {}, picks: { c1: { date: '2026-10-14', time: '17:00' } } }));
    expect(tiles).toEqual([expect.objectContaining({ id: 'plan:c1', planOf: 'c1', date: '2026-10-14', time: '17:00', part: 'pm' })]);
  });

  it('a choice is forgotten once the class is ticked, or when its day has gone by (the class goes back to "to plan")', () => {
    expect(manual({ c1: { date: '2026-10-13', time: '09:00' } }, { c1: true }).placed).toEqual([]);
    const gone = manual({ c1: { date: '2026-10-11', time: '09:00' } });
    expect(gone.placed).toEqual([]);
    expect(gone.unplaced).toEqual(['c1', 'c2', 'c3']);
    expect(manual({ c1: { date: TODAY, time: '09:00' } }).placed).toHaveLength(1);        // today is still fine
  });

  it('ignores choices for classes that are not late (or no longer exist)', () => {
    expect(manual({ nope: { date: '2026-10-13', time: '09:00' }, end: { date: '2026-10-13', time: '09:00' } }).placed).toEqual([]);
  });

  it('lists late classes oldest first, and the periods already taken', () => {
    expect(lateOf([late[2], late[0], END, late[1]], TODAY, { c1: true }).map((e) => e.id)).toEqual(['c2', 'c3']);
    const b = blockedPeriods([ev('live', 'd', '2026-10-13', 'live', '18:30 – 21:30'), { id: 'x', kind: 'exam', date: '2026-10-14', end: '2026-10-15' } as Evt], TODAY);
    expect([...b].sort()).toEqual(['2026-10-13|pm', '2026-10-14|am', '2026-10-14|pm', '2026-10-15|am', '2026-10-15|pm']);
  });
});

describe('replacing a planned class by a catch-up', () => {
  const late1 = ev('c1', 'c', '2026-10-01');
  const planned = ev('web', 'd', '2026-10-13', 'webconf', '13:30');
  const evening = ev('live', 'e', '2026-10-13', 'live', '18:30 – 21:30');
  const gym = { id: 'gym', kind: 'perso', date: '2026-10-13', time: '09:00 – 10:00', check: true, subject: '' } as Evt;
  const exam = { id: 'ex', kind: 'exam', date: '2026-10-13', end: '2026-10-14' } as Evt;

  it('a class that can be replaced is a live / web conference not ticked yet; the rest holds its period for good', () => {
    const o = occupantsOf([planned, evening, gym, late1], '2026-10-13', 'pm', {});
    expect(o.replaceable.map((e) => e.id)).toEqual(['web', 'live']);                       // the afternoon and the evening are one period
    expect(o.blockers).toEqual([]);
    expect(occupantsOf([planned, gym], '2026-10-13', 'am', {}).blockers.map((e) => e.id)).toEqual(['gym']);
    expect(occupantsOf([planned], '2026-10-13', 'pm', { web: true }).blockers.map((e) => e.id)).toEqual(['web']);   // already ticked: cannot be replaced
    expect(occupantsOf([exam], '2026-10-14', 'am', {}).blockers.map((e) => e.id)).toEqual(['ex']);
    expect(occupantsOf([planned], '2026-10-13', 'pm', {}, { web: true })).toEqual({ replaceable: [], blockers: [] });    // already replaced: the period is free
    expect(occupantsOf([planned], '2026-10-14', 'pm', {}).replaceable).toEqual([]);          // another day
  });

  it('a replaced class is late whatever its date, and no longer holds its period', () => {
    expect(lateOf([late1, planned, END], TODAY, {}).map((e) => e.id)).toEqual(['c1']);
    expect(lateOf([late1, planned, END], TODAY, {}, { web: true }).map((e) => e.id)).toEqual(['c1', 'web']);
    expect(lateOf([late1, planned, END], TODAY, { web: true }, { web: true }).map((e) => e.id)).toEqual(['c1']);     // ticked: done
    expect(blockedPeriods([planned], TODAY).has('2026-10-13|pm')).toBe(true);
    expect(blockedPeriods([planned], TODAY, { web: true }).has('2026-10-13|pm')).toBe(false);
  });

  it('manual planning: the replaced class waits to be planned, and can itself be placed', () => {
    const p = planManual({ events: [late1, planned, END], today: TODAY, done: {}, picks: { c1: { date: '2026-10-13', time: '15:00', replaces: ['web'] } }, displaced: { web: true } });
    expect(p.placed.map((x) => [x.id, x.date, x.time])).toEqual([['c1', '2026-10-13', '15:00']]);
    expect(p.unplaced).toEqual(['web']);
    const q = planManual({ events: [late1, planned, END], today: TODAY, done: {}, picks: { c1: { date: '2026-10-13', time: '15:00' }, web: { date: '2026-10-14', time: '09:00' } }, displaced: { web: true } });
    expect(q.unplaced).toEqual([]);
  });

  it('automatic planning treats it like any late class: its old period is free, and it is planned later', () => {
    const p = run([late1, planned, END], { displaced: { web: true } });
    expect(p.placed.map((x) => [x.id, x.date, x.part])).toEqual([['c1', TODAY, 'am'], ['web', TODAY, 'pm']]);
    expect(run([late1, planned, END]).placed.map((x) => x.id)).toEqual(['c1']);
  });
});
