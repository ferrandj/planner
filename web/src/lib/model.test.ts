import type { Data } from '../types';
import { base, emptyData } from './fixtures';
import { appEyebrow, appTitle, backlogCount, buildEvents, devoirDone, dueSoon, eventsOn, inScope, isLate, lastDay, lateDevoirs, monthsList, nextDevoir, renduCount, renduTotals, resolveModel, subjectOf, visible } from './model';

const T = (s: string): string => s;
const mk = (f?: (d: Data) => void): { data: Data; m: ReturnType<typeof resolveModel> } => {
  const data = emptyData();
  f?.(data);
  return { data, m: resolveModel(base, data) };
};

describe('resolveModel (edits layered on the reference schedule)', () => {
  it('without edits it mirrors the base and never mutates it', () => {
    const { m } = mk();
    expect(m.subjects.map((s) => s.name)).toEqual(['Maths', 'Physics']);
    expect(base.s[0].name).toBe('Maths');
  });
  it('applies edits to subjects (short follows name), devoirs, exams and sessions', () => {
    const { m } = mk((d) => {
      d.edits['s:m1'] = { name: 'Algebra', color: '#112233' };
      d.edits['d:d1'] = { date: '2026-11-09' };
      d.edits['x:ex1'] = { end: '' };
      d.edits['e:m2-webconf-2026-10-14'] = { time: '14:00', tag: '' };
    });
    expect(m.subjects[0]).toMatchObject({ name: 'Algebra', short: 'Algebra', color: '#112233' });
    expect(m.devoirs[0].date).toBe('2026-11-09');
    expect(m.exams[0].end).toBe('');
    expect(m.events.find((e) => e.id === 'm2-webconf-2026-10-14')).toMatchObject({ time: '14:00', tag: '' });
    expect(base.d[0].date).toBe('2026-11-02');
  });
  it('title and subtitle: defaults and edits', () => {
    const { data } = mk();
    expect(appTitle(data, T)).toBe('Planning');
    expect(appEyebrow(data)).toBe('');
    data.edits.app = { title: 'Mine', eyebrow: 'Sub' };
    expect(appTitle(data, T)).toBe('Mine');
    expect(appEyebrow(data)).toBe('Sub');
  });
  it('subjectOf', () => {
    const { m } = mk();
    expect(subjectOf(m, 'm2')?.code).toBe('C2');
    expect(subjectOf(m, 'zz')).toBeUndefined();
    expect(subjectOf(m, undefined)).toBeUndefined();
  });
});

describe('buildEvents', () => {
  it('merges sessions, custom sessions, deadlines, availability and exams in date/time order', () => {
    const { m, data } = mk((d) => { d.custom.push({ id: 'c1', title: 'Read', subject: 'm1', date: '2026-10-12', time: '09:00', tend: '10:00' }); });
    const evs = buildEvents(m, data);
    expect(evs.map((e) => e.kind)).toContain('dispo');
    expect(evs.map((e) => e.date)).toEqual([...evs.map((e) => e.date)].sort());
    const perso = evs.find((e) => e.id === 'c1')!;
    expect(perso).toMatchObject({ kind: 'perso', check: true, time: '09:00 – 10:00' });
    expect(evs.findIndex((e) => e.id === 'c1')).toBeLessThan(evs.findIndex((e) => e.id === 'm1-live-2026-10-12')); // 09:00 before 18:30
  });
  it('custom session time formats', () => {
    const { m, data } = mk((d) => {
      d.custom.push({ id: 'a', title: 'a', subject: '', date: '2026-10-01', time: '', tend: '11:00' });
      d.custom.push({ id: 'b', title: 'b', subject: '', date: '2026-10-02', time: '08:00', tend: '' });
    });
    const evs = buildEvents(m, data);
    expect(evs.find((e) => e.id === 'a')!.time).toBe('– 11:00');
    expect(evs.find((e) => e.id === 'b')!.time).toBe('08:00');
  });
  it('hidden sessions disappear but remain in the base', () => {
    const { m, data } = mk((d) => { d.hidden['m1-live-2026-10-05'] = true; });
    expect(buildEvents(m, data).some((e) => e.id === 'm1-live-2026-10-05')).toBe(false);
    expect(m.events.some((e) => e.id === 'm1-live-2026-10-05')).toBe(true);
  });
});

describe('hand-in progress', () => {
  it('counts per assignment and overall', () => {
    const { m, data } = mk((d) => { d.rendu['d1:m1'] = true; d.rendu['d1:m2'] = true; d.rendu['d2:m1'] = true; });
    expect(renduCount(m, data, m.devoirs[0])).toBe(2);
    expect(devoirDone(m, data, m.devoirs[0])).toBe(true);
    expect(devoirDone(m, data, m.devoirs[1])).toBe(false);
    expect(renduTotals(m, data)).toEqual({ done: 3, total: 4 });
  });
  it('next / late / due soon', () => {
    const { m, data } = mk();
    expect(nextDevoir(m, data, '2026-10-11')!.id).toBe('d1');
    expect(nextDevoir(m, data, '2026-11-03')!.id).toBe('d2');
    expect(nextDevoir(m, data, '2027-01-01')).toBeUndefined();
    expect(lateDevoirs(m, data, '2026-11-03').map((d) => d.id)).toEqual(['d1']);
    expect(dueSoon(m, data, '2026-10-26').map((d) => d.id)).toEqual(['d1']);   // 7 days before
    expect(dueSoon(m, data, '2026-10-25')).toEqual([]);                         // 8 days before
    expect(dueSoon(m, data, '2026-11-02').map((d) => d.id)).toEqual(['d1']);   // due today
    expect(dueSoon(m, data, '2026-11-03')).toEqual([]);                         // already past
    data.rendu['d1:m1'] = true; data.rendu['d1:m2'] = true;
    expect(dueSoon(m, data, '2026-10-30')).toEqual([]);                         // handed in
  });
});

describe('scope, lateness, filters', () => {
  const today = '2026-10-10';
  it('isLate only for ticked-able, past, undone items', () => {
    const { m, data } = mk();
    const evs = buildEvents(m, data);
    const past = evs.find((e) => e.id === 'm1-live-2026-10-05')!;
    const future = evs.find((e) => e.id === 'm1-live-2026-10-12')!;
    expect(isLate(past, today, data)).toBe(true);
    expect(isLate(future, today, data)).toBe(false);
    data.done[past.id] = true;
    expect(isLate(past, today, data)).toBe(false);
    expect(isLate(evs.find((e) => e.kind === 'devoir')!, '2027-06-01', data)).toBe(false);
    expect(backlogCount(evs, '2026-10-13', data)).toBe(1); // the 10-05 one is done, the 10-12 is late
  });
  it('"todo" scope hides done items, handed-in assignments and past non-checkable items', () => {
    const { m, data } = mk();
    const evs = buildEvents(m, data);
    const live = evs.find((e) => e.id === 'm1-live-2026-10-12')!;
    expect(inScope(live, 'todo', today, m, data)).toBe(true);
    data.done[live.id] = true;
    expect(inScope(live, 'todo', today, m, data)).toBe(false);
    expect(inScope(live, 'all', today, m, data)).toBe(true);
    const dev = evs.find((e) => e.id === 'dev:d1')!;
    expect(inScope(dev, 'todo', today, m, data)).toBe(true);
    data.rendu['d1:m1'] = true; data.rendu['d1:m2'] = true;
    expect(inScope(dev, 'todo', today, m, data)).toBe(false);
    const dispo = evs.find((e) => e.id === 'av:d2')!;
    expect(inScope(dispo, 'todo', today, m, data)).toBe(true);
    expect(inScope(dispo, 'todo', '2026-12-01', m, data)).toBe(false);
  });
  it('visible() filters by subject but always shows non-subject items', () => {
    const { m, data } = mk();
    const evs = buildEvents(m, data);
    const live = evs.find((e) => e.id === 'm1-live-2026-10-12')!;
    expect(visible(live, 'all')).toBe(true);
    expect(visible(live, 'm1')).toBe(true);
    expect(visible(live, 'm2')).toBe(false);
    expect(visible(evs.find((e) => e.kind === 'exam')!, 'm2')).toBe(true);
  });
  it('eventsOn handles ranges; lastDay', () => {
    const { m, data } = mk();
    const evs = buildEvents(m, data);
    expect(eventsOn(evs, '2027-04-30').map((e) => e.kind)).toEqual(['exam']);
    expect(eventsOn(evs, '2027-05-01')).toEqual([]);
    expect(lastDay({ date: 'a', end: 'b' })).toBe('b');
    expect(lastDay({ date: 'a' })).toBe('a');
  });
  it('monthsList covers every month between first and last event, and is empty with no events', () => {
    const { m, data } = mk();
    const ms = monthsList(buildEvents(m, data));
    expect(ms[0]).toBe('2026-10');
    expect(ms[ms.length - 1]).toBe('2027-04');
    expect(ms).toHaveLength(7);
    expect(monthsList([])).toEqual([]);
  });
});
