import { base, emptyData } from './fixtures';
import { addDevoir, addExam, addSession, addSubject, isRemoved, nextSlot, removeItem, restoreItem, splitKey } from './items';
import { removedItems, resolveModel } from './model';
import { setEdit } from './edits';
import { buildEvents } from './model';
import { normalizeData } from './normalize';

describe('adding items', () => {
  it('a new subject gets a colour slot nobody uses, even after others were removed', () => {
    const d = emptyData();
    expect(nextSlot(base, d)).toBe(3);
    const k1 = addSubject(d, base);
    removeItem(d, k1);
    const k2 = addSubject(d, base);
    const slots = d.extra.s.map((s) => s.c);
    expect(slots).toEqual([3, 4]);
    expect(k1).not.toBe(k2);
  });
  it('new items are part of the schedule and can be edited like any other', () => {
    const d = emptyData();
    const ks = addSubject(d, base);
    const id = splitKey(ks).id;
    setEdit(d, base, ks, 'name', 'Chemistry');
    setEdit(d, base, ks, 'code', 'CHM1');
    const kd = addDevoir(d, base, '2026-10-11');
    setEdit(d, base, kd, 'date', '2026-11-30');
    const kx = addExam(d, '2026-10-11');
    const ke = addSession(d, id, 'webconf', '2026-10-20');
    const m = resolveModel(base, d);
    expect(m.subjects.map((s) => s.name)).toEqual(['Maths', 'Physics', 'Chemistry']);
    expect(m.subjects[2]).toMatchObject({ code: 'CHM1', short: 'Chemistry', c: 3 });
    expect(m.devoirs.find((x) => 'd:' + x.id === kd)).toMatchObject({ date: '2026-11-30', title: 'Nouveau devoir' });
    expect(m.exams.some((x) => 'x:' + x.id === kx)).toBe(true);
    const ev = buildEvents(m, d).find((e) => 'e:' + e.id === ke)!;
    expect(ev).toMatchObject({ kind: 'webconf', subject: id, check: true, time: '12:30' });
  });
  it('editing a new item back to its created value leaves no stray edit', () => {
    const d = emptyData();
    const k = addDevoir(d, base, '2026-10-11');
    setEdit(d, base, k, 'title', 'X');
    setEdit(d, base, k, 'title', 'Nouveau devoir');
    expect(d.edits[k]).toBeUndefined();
  });
  it('new assignments are numbered after the existing ones', () => {
    const d = emptyData();
    addDevoir(d, base, '2026-10-11');
    addDevoir(d, base, '2026-10-11');
    expect(d.extra.d.map((x) => x.ab)).toEqual(['D3', 'D4']);
  });
});

describe('removing is reversible', () => {
  it('a removed subject takes its sessions with it, and brings them back when restored', () => {
    const d = emptyData();
    removeItem(d, 's:m1');
    let m = resolveModel(base, d);
    expect(m.subjects.map((s) => s.id)).toEqual(['m2']);
    expect(m.events.every((e) => e.subject === 'm2')).toBe(true);
    expect(isRemoved(d, 's:m1')).toBe(true);
    expect(removedItems(base, d).map((r) => r.key)).toEqual(['s:m1']);
    restoreItem(d, 's:m1');
    m = resolveModel(base, d);
    expect(m.subjects.map((s) => s.id)).toEqual(['m1', 'm2']);
    expect(m.events).toHaveLength(base.e.length);
    expect(removedItems(base, d)).toEqual([]);
  });
  it('removed assignments and exams vanish from the planner but stay restorable, with their hand-in state kept', () => {
    const d = emptyData();
    d.rendu['d1:m1'] = true;
    removeItem(d, 'd:d1'); removeItem(d, 'x:ex1');
    const m = resolveModel(base, d);
    expect(m.devoirs.map((x) => x.id)).toEqual(['d2']);
    expect(m.exams).toEqual([]);
    expect(d.rendu['d1:m1']).toBe(true);
    expect(removedItems(base, d).map((r) => r.label)).toEqual(['Assignment 1', 'Exams']);
    restoreItem(d, 'd:d1');
    expect(resolveModel(base, d).devoirs.map((x) => x.id)).toEqual(['d1', 'd2']);
  });
  it('sessions use the existing hidden flag', () => {
    const d = emptyData();
    removeItem(d, 'e:m1-live-2026-10-12');
    expect(d.hidden['m1-live-2026-10-12']).toBe(true);
    expect(isRemoved(d, 'e:m1-live-2026-10-12')).toBe(true);
    restoreItem(d, 'e:m1-live-2026-10-12');
    expect(d.hidden).toEqual({});
  });
  it('removing a user-added item keeps it restorable too', () => {
    const d = emptyData();
    const k = addExam(d, '2026-10-11');
    removeItem(d, k);
    expect(resolveModel(base, d).exams.map((x) => 'x:' + x.id)).not.toContain(k);
    expect(removedItems(base, d).map((r) => r.key)).toContain(k);
    restoreItem(d, k);
    expect(resolveModel(base, d).exams.map((x) => 'x:' + x.id)).toContain(k);
  });
});

describe('older saved data still loads', () => {
  it('data saved before items could be added gets empty defaults', () => {
    const d = normalizeData({ done: { a: true } });
    expect(d.extra).toEqual({ s: [], d: [], x: [], e: [] });
    expect(d.deleted).toEqual({});
    expect(d.prefs).toMatchObject({ auto: false, autoMax: 3 });
    expect(resolveModel(base, d).subjects).toHaveLength(2);
  });
  it('splitKey keeps ids that contain colons', () => {
    expect(splitKey('e:math-live-2026-09-14')).toEqual({ kind: 'e', id: 'math-live-2026-09-14' });
    expect(splitKey('d:a:b')).toEqual({ kind: 'd', id: 'a:b' });
  });
});
