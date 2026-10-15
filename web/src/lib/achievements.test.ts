import { buildDefs, computeStats, every, ladder, newlyMet, rankOf, streaks } from './achievements';
import { badgeMarkup } from './badge';
import { base, emptyData } from './fixtures';
import { buildEvents, resolveModel } from './model';
import { makeT } from './i18n';
import type { Base, SessionEvt } from '../types';

const { t, tf } = makeT('fr');
const S = (id: string, subject: string, kind: 'live' | 'webconf', date: string): SessionEvt => ({ id, subject, kind, date, time: '18:30', tag: '' });
const b: Base = { ...base, e: [
  S('l1', 'm1', 'live', '2026-10-05'), S('l2', 'm1', 'live', '2026-10-12'), S('l3', 'm1', 'live', '2026-10-19'),
  S('w1', 'm1', 'webconf', '2026-10-06'), S('p1', 'm2', 'live', '2026-10-07'), S('p2', 'm2', 'webconf', '2026-10-08')
] };
const make = (mut?: (d: ReturnType<typeof emptyData>) => void) => {
  const d = emptyData(); mut?.(d);
  const m = resolveModel(b, d);
  const evs = buildEvents(m, d);
  const stats = computeStats(m, d, evs, '2026-10-20');
  const defs = buildDefs(m, stats, t, tf, (s) => (s.id === 'm1' ? '#1d5fd1' : '#b42318'));
  return { d, m, stats, defs };
};
const byId = (defs: ReturnType<typeof make>['defs'], id: string) => defs.find((x) => x.id === id);

describe('tiers', () => {
  it('1, 2, 3, 5, 7, 10... up to the most that exists, ending exactly on it', () => {
    expect(ladder(0)).toEqual([]);
    expect(ladder(1)).toEqual([1]);
    expect(ladder(4)).toEqual([1, 2, 3, 4]);
    expect(ladder(12)).toEqual([1, 2, 3, 5, 7, 10, 12]);
    expect(every(0)).toEqual([]);
    expect(every(9)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(ladder(20)).toEqual([1, 2, 3, 5, 7, 10, 15, 20]);
  });
  it('the metal grows with the tier and the last tier is always the top one', () => {
    expect([0, 1, 2, 3, 4].map((i) => rankOf(i, 5))).toEqual([0, 1, 2, 3, 4]);
    expect(rankOf(6, 7)).toBe(4);
    expect(rankOf(0, 7)).toBe(0);
    expect(rankOf(0, 1)).toBe(2);
  });
});

describe('streaks (a rest day a week is allowed)', () => {
  const run = (days: string[], today = '2026-11-30') => streaks(days, today);
  it('counts consecutive days and keeps the best chain', () => {
    expect(run(['2026-11-01', '2026-11-02', '2026-11-03', '2026-11-10'], '2026-11-10')).toEqual({ best: 3, current: 1 });
  });
  it('one rest day in between does not break it, two rest days in a row do', () => {
    expect(run(['2026-11-01', '2026-11-03', '2026-11-04'], '2026-11-04').best).toBe(3);
    expect(run(['2026-11-01', '2026-11-04'], '2026-11-04').best).toBe(1);
  });
  it('but not two rest days within the same week', () => {
    expect(run(['2026-11-01', '2026-11-03', '2026-11-05'], '2026-11-05').best).toBe(2);       // rests on the 2nd and the 4th: too close
    expect(run(['2026-11-01', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06', '2026-11-07', '2026-11-08', '2026-11-10'], '2026-11-10').best).toBe(8);   // rests on the 2nd and the 9th: a week apart
  });
  it('a chain of 60 days with a rest day every week reaches 60', () => {
    const days: string[] = [];
    const d = new Date(2026, 0, 1);
    while (days.length < 60) { if (d.getDay() !== 0) days.push(d.toISOString().slice(0, 10)); d.setDate(d.getDate() + 1); }
    expect(streaks(days.map((x) => x), '2026-04-01').best).toBe(60);
  });
  it('the current streak is alive today or yesterday, and over after that', () => {
    const days = ['2026-11-01', '2026-11-02', '2026-11-03'];
    expect(run(days, '2026-11-03').current).toBe(3);
    expect(run(days, '2026-11-04').current).toBe(3);
    expect(run(days, '2026-11-08').current).toBe(0);
    expect(run([], '2026-11-08')).toEqual({ best: 0, current: 0 });
  });
});

describe('achievements for a planner', () => {
  it('has first live / first web conference per subject, then 2, 3... up to everything that exists, plus global ones', () => {
    const { defs } = make();
    expect(defs.filter((d) => d.family === 's:m1:live').map((d) => d.n)).toEqual([1, 2, 3]);
    expect(defs.filter((d) => d.family === 's:m1:webconf').map((d) => d.n)).toEqual([1]);
    expect(defs.filter((d) => d.family === 'all').map((d) => d.n)).toEqual([1, 2, 3, 4, 5, 6]);      // no number is skipped: one achievement per session
    expect(byId(defs, 's:m1:live|1')?.title).toBe('Premier live · Maths');
    expect(byId(defs, 's:m1:live|2')?.title).toBe('2 lives · Maths');
    expect(byId(defs, 's:m1:live|3')?.title).toBe('Tous les lives · Maths');
    expect(byId(defs, 's:m1:webconf|1')?.title).toBe('Première webconférence · Maths');
    expect(byId(defs, 's:m1:live|1')).toMatchObject({ glyph: 'live', color: '#1d5fd1', rank: 0 });
    expect(byId(defs, 's:m1:live|3')?.rank).toBe(4);
  });
  it('nothing is met on an untouched planner (except what is already true)', () => {
    const { defs, d } = make();
    expect(newlyMet(defs, d).map((x) => x.id)).toEqual([]);
  });
  it('ticking sessions meets the right tiers, per subject and kind, and overall', () => {
    const { defs, d } = make((x) => { x.done.l1 = true; x.done.l2 = true; x.done.w1 = true; });
    const met = newlyMet(defs, d).map((x) => x.id).sort();
    expect(met).toEqual(['all|1', 'all|2', 'all|3', 's:m1:live|1', 's:m1:live|2', 's:m1:webconf|1'].sort());
  });
  it('already unlocked ones are not reported again, even when no longer met', () => {
    const { defs, d } = make((x) => { x.done.l1 = true; x.ach['s:m1:live|1'] = '2026-10-01'; x.ach['all|1'] = '2026-10-01'; x.ach['streak|60'] = '2026-10-01'; });
    expect(newlyMet(defs, d)).toEqual([]);
  });
  it('counts sessions ticked after their day as caught up, and ignores ticks without a date', () => {
    const a = make((x) => { x.done.l1 = true; x.doneAt.l1 = '2026-10-18'; x.done.l2 = true; x.doneAt.l2 = '2026-10-12'; x.done.l3 = true; });
    expect(a.stats.caught).toBe(1);
  });
  it('streaks use the day of the tick (or the day of the session for older ticks)', () => {
    const a = make((x) => { ['l1', 'w1', 'p1'].forEach((k) => { x.done[k] = true; }); });   // 5, 6, 7 Oct: older ticks, no dates
    expect(a.stats.bestStreak).toBe(3);
    const b2 = make((x) => { x.done.l1 = true; x.doneAt.l1 = '2026-10-18'; x.done.w1 = true; x.doneAt.w1 = '2026-10-19'; });
    expect(b2.stats.bestStreak).toBe(2);
  });
  it('perfect weeks need every session of the week done (at least two)', () => {
    const a = make((x) => { x.done.l1 = true; x.done.w1 = true; x.done.p1 = true; x.done.p2 = true; });   // week of 5 Oct: 4 sessions, all done
    expect(a.stats.perfectWeeks).toBe(1);
    expect(make((x) => { x.done.l1 = true; }).stats.perfectWeeks).toBe(0);
  });
  it('assignments: hand-ins and complete assignments, up to what exists', () => {
    const { defs } = make((x) => { x.rendu['d1:m1'] = true; x.rendu['d1:m2'] = true; });
    expect(defs.find((d) => d.family === 'rendu' && d.n === 1)?.met).toBe(true);
    expect(defs.find((d) => d.family === 'devdone' && d.n === 1)?.met).toBe(true);
    expect(defs.filter((d) => d.family === 'rendu').map((d) => d.n)).toEqual([1, 2, 3, 4]);       // 2 assignments x 2 subjects
  });
  it('stickers stop at 20 for the last tier', () => {
    const { defs } = make();
    expect(defs.filter((d) => d.family === 'stk').map((d) => d.n)).toEqual([1, 3, 5, 10, 15, 20]);
  });
  it('one-off achievements follow the settings', () => {
    const { defs } = make((x) => { x.prefs.mode = 'dark'; x.prefs.lang = 'en'; x.prefs.auto = true; });
    expect(['dark|1', 'lang|1', 'auto|1'].map((id) => byId(defs, id)?.met)).toEqual([true, true, true]);
    expect(byId(defs, 'colour|1')?.met).toBe(false);
  });
  it('the title that comes with the starting data is not counted as a change made by the user', () => {
    expect(make((x) => { x.edits.app = { title: 'T', eyebrow: 'E' }; }).stats.edits).toBe(0);
    expect(make((x) => { x.edits['s:m1'] = { name: 'N', ab: 'A' }; }).stats.edits).toBe(2);
  });
  it('a medal exists for every tier of every achievement, with a unique id', () => {
    const { defs } = make();
    expect(new Set(defs.map((x) => x.id)).size).toBe(defs.length);
    expect(defs.length).toBeGreaterThan(40);
  });
});

describe('badge pictures', () => {
  it('are plain, self-contained SVG: no script, link or style, locked ones greyed', () => {
    for (const glyph of ['cap', 'live', 'webconf', 'rewind', 'flame', 'week', 'pen', 'folder', 'sticker', 'note', 'plus', 'edit', 'moon', 'globe', 'palette', 'gear', 'target'] as const) {
      for (const rank of [0, 1, 2, 3, 4]) {
        const m = badgeMarkup({ glyph, rank, label: '10', color: '#1d5fd1' });
        expect(m, glyph).not.toMatch(/<script|style=|href=|url\(|\son\w+=/i);
        expect(m).toContain('>10<');
      }
    }
    const locked = badgeMarkup({ glyph: 'cap', rank: 4, label: '10', locked: true });
    expect(locked).not.toContain('#8f6bff');                 // no diamond colours while locked
  });
  it('a higher tier looks different from a lower one (metal and decoration)', () => {
    const marks = [0, 1, 2, 3, 4].map((rank) => badgeMarkup({ glyph: 'live', rank, label: '5', color: '#1d5fd1' }));
    expect(new Set(marks).size).toBe(5);
  });
  it('never lets text or colour from outside break the markup', () => {
    const m = badgeMarkup({ glyph: 'cap', rank: 1, label: '<b>"x"</b>', color: 'red;" onload="x' });
    expect(m).not.toMatch(/onload|<b>|"x"/);
  });
});
