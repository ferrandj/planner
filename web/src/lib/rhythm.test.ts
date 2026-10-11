import { patterns, suggestFor, allChoices, usualTime, DEFAULT_TIME } from './rhythm';
import { resolveModel } from './model';
import { emptyData, base } from './fixtures';
import type { Base, SessionEvt } from '../types';

// 2026-10-05 is a Monday
const ev = (id: string, subject: string, kind: 'live' | 'webconf', date: string, time: string): SessionEvt => ({ id, subject, kind, date, time, tag: '' });
const b: Base = {
  ...base,
  e: [
    ev('a1', 'm1', 'live', '2026-10-05', '18:30 – 21:30'), ev('a2', 'm1', 'live', '2026-10-12', '18:30 – 21:30'), ev('a3', 'm1', 'live', '2026-10-19', '18:30 – 21:30'),
    ev('a4', 'm1', 'live', '2026-10-27', '19:00'),                                  // a stray one (Tuesday), not a rhythm
    ev('b1', 'm2', 'webconf', '2026-10-06', '13:30'), ev('b2', 'm2', 'webconf', '2026-10-13', '13:30'),
    ev('b3', 'm2', 'webconf', '2026-10-15', '10:00'), ev('b4', 'm2', 'webconf', '2026-10-22', '10:00')    // a second, repeated rhythm (Thursday)
  ]
};
const model = (): ReturnType<typeof resolveModel> => resolveModel(b, emptyData());

describe('weekly rhythm of each subject', () => {
  it('finds the usual weekday and time, most frequent first', () => {
    const p = patterns(model(), emptyData());
    expect(p[0]).toMatchObject({ subject: 'm1', kind: 'live', weekday: 1, time: '18:30 – 21:30', count: 3 });
    expect(usualTime(model(), emptyData(), 'm1', 'live')).toBe('18:30 – 21:30');
    expect(usualTime(model(), emptyData(), 'm2', 'webconf')).toBe('10:00');          // 2 vs 2: the most recent rhythm wins the tie
  });
  it('falls back to a default time for a subject/kind without history', () => {
    expect(usualTime(model(), emptyData(), 'm1', 'webconf')).toBe(DEFAULT_TIME.webconf);
  });
  it('offers the usual class on its usual weekday, with its usual time', () => {
    expect(suggestFor(model(), emptyData(), '2026-11-02')).toEqual([{ subject: 'm1', kind: 'live', time: '18:30 – 21:30' }]);   // a Monday
  });
  it('offers every repeating rhythm for a weekday, but not a one-off', () => {
    const tue = suggestFor(model(), emptyData(), '2026-11-03');
    expect(tue).toEqual([{ subject: 'm2', kind: 'webconf', time: '13:30' }]);          // Tuesday: m2's webconf (the stray m1 live is not offered)
    const thu = suggestFor(model(), emptyData(), '2026-11-05');
    expect(thu).toEqual([{ subject: 'm2', kind: 'webconf', time: '10:00' }]);
  });
  it('does not offer a class the subject already has that day, and ignores removed sessions', () => {
    expect(suggestFor(model(), emptyData(), '2026-10-12')).toEqual([]);              // m1 already has its Monday live
    const d = emptyData(); d.hidden.a2 = true;
    expect(suggestFor(model(), d, '2026-10-12')).toEqual([{ subject: 'm1', kind: 'live', time: '18:30 – 21:30' }]);
  });
  it('offers nothing on a day without a rhythm, but every subject/kind remains available by hand', () => {
    expect(suggestFor(model(), emptyData(), '2026-11-07')).toEqual([]);              // a Saturday
    expect(allChoices(model(), emptyData())).toHaveLength(4);                        // 2 subjects x live/webconf
  });
  it('a user-added class counts too', () => {
    const d = emptyData(); d.extra.e.push(ev('u1', 'm1', 'webconf', '2026-10-07', '12:00'), ev('u2', 'm1', 'webconf', '2026-10-14', '12:00'));
    expect(suggestFor(resolveModel(b, d), d, '2026-11-04')).toEqual([{ subject: 'm1', kind: 'webconf', time: '12:00' }]);        // a Wednesday
  });
});
