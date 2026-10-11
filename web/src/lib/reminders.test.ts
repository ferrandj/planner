import { due, LEADS, readShown, toServer, upcoming, writeShown } from './reminders';
import { resolveModel, buildEvents } from './model';
import { base, emptyData } from './fixtures';
import { makeT } from './i18n';

const { t, tf } = makeT('fr');
const NOW = new Date(2026, 9, 12, 18, 0, 0).getTime();           // Monday 12 Oct 2026, 18:00: the fixture's Maths live starts at 18:30
const build = (mut?: (d: ReturnType<typeof emptyData>) => void) => {
  const data = emptyData(); mut?.(data);
  const m = resolveModel(base, data);
  return { data, m, evs: buildEvents(m, data) };
};

describe('reminders', () => {
  it('lists what starts soon, with its start time and the moment to remind', () => {
    const { data, m, evs } = build();
    const r = upcoming(evs, m, data, NOW, 15, t, tf);
    const live = r.find((x) => x.id.startsWith('m1-live-2026-10-12'))!;
    expect(live.start).toBe(new Date(2026, 9, 12, 18, 30).getTime());
    expect(live.fireAt).toBe(live.start - 15 * 60000);
    expect(live.title).toBe('Ma · Live du soir');
    expect(live.body).toBe('Commence à 18:30 (dans 15 min)');
    expect(r.map((x) => x.start)).toEqual([...r.map((x) => x.start)].sort((a, b) => a - b));
  });
  it('skips what is ticked, what has no start time (deadlines, exams), what is past and what is too far', () => {
    const { data, m, evs } = build((d) => { d.done['m1-live-2026-10-12'] = true; });
    const r = upcoming(evs, m, data, NOW, 15, t, tf);
    expect(r.some((x) => x.id.startsWith('m1-live-2026-10-12'))).toBe(false);
    expect(r.some((x) => /^dev:|^av:|^ex1/.test(x.id))).toBe(false);
    expect(r.some((x) => x.id.startsWith('m1-live-2026-10-05'))).toBe(false);          // past
    expect(upcoming(evs, m, data, NOW, 15, t, tf, 1).some((x) => x.id.startsWith('m2-webconf-2026-10-14'))).toBe(false);   // beyond one day
  });
  it('includes personal sessions that have a time', () => {
    const { data, m, evs } = build((d) => { d.custom.push({ id: 'c1', title: 'Gym', subject: '', date: '2026-10-12', time: '19:00', tend: '20:00' }, { id: 'c2', title: 'No time', subject: '', date: '2026-10-12', time: '', tend: '' }); });
    const r = upcoming(evs, m, data, NOW, 30, t, tf);
    expect(r.find((x) => x.id.startsWith('c1@'))).toMatchObject({ title: 'Gym', fireAt: new Date(2026, 9, 12, 18, 30).getTime() });
    expect(r.some((x) => x.id.startsWith('c2@'))).toBe(false);
  });
  it('a moved session is a new reminder (the id includes the start)', () => {
    const a = build(), b = build((d) => { d.edits['e:m1-live-2026-10-12'] = { time: '20:00' }; });
    const ida = upcoming(a.evs, a.m, a.data, NOW, 15, t, tf).find((x) => x.id.startsWith('m1-live-2026-10-12'))!.id;
    const idb = upcoming(b.evs, b.m, b.data, NOW, 15, t, tf).find((x) => x.id.startsWith('m1-live-2026-10-12'))!.id;
    expect(ida).not.toBe(idb);
  });
  it('is due from the reminder moment until the start, and only once', () => {
    const list = [{ id: 'a', start: 1000 * 60 * 30, fireAt: 1000 * 60 * 15, title: '', body: '' }];
    expect(due(list, 1000 * 60 * 14, {})).toHaveLength(0);
    expect(due(list, 1000 * 60 * 15, {})).toHaveLength(1);
    expect(due(list, 1000 * 60 * 29, {})).toHaveLength(1);
    expect(due(list, 1000 * 60 * 30, {})).toHaveLength(0);               // already started
    expect(due(list, 1000 * 60 * 16, { a: 1 })).toHaveLength(0);         // already shown
  });
  it('sends the server only what it needs', () => {
    const r = { id: 'a', start: 2, fireAt: 1, title: 'T', body: 'B' };
    expect(toServer([{ ...r, extra: 1 } as typeof r])).toEqual([r]);
    expect(LEADS).toContain(15);
  });
  it('remembers what was shown, and forgets it after two days', () => {
    const mem: Record<string, string> = {};
    const store = { getItem: (k: string) => mem[k] ?? null, setItem: (k: string, v: string) => { mem[k] = v; } };
    writeShown(store, { new: 1_000_000_000_000, old: 1 }, 1_000_000_000_000 + 1000);
    expect(readShown(store)).toEqual({ new: 1_000_000_000_000 });
    expect(readShown(undefined)).toEqual({});
  });
});
