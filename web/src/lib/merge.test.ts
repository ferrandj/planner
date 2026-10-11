import { merge3, eq, clone } from './merge';

describe('merge3', () => {
  it('keeps independent checkbox edits from two devices', () => {
    const r = merge3({ done: { a: true } }, { done: { a: true, b: true } }, { done: { a: true, c: true } }) as { done: object };
    expect(r.done).toEqual({ a: true, b: true, c: true });
  });

  it('an un-check is not undone by an unrelated change on the other device', () => {
    const r = merge3({ done: { a: true }, prefs: { lang: 'fr' } }, { done: {}, prefs: { lang: 'fr' } }, { done: { a: true }, prefs: { lang: 'en' } }) as { done: object; prefs: { lang: string } };
    expect(r.done).toEqual({});
    expect(r.prefs.lang).toBe('en');
  });

  it('same scalar edited on both sides: this device wins', () => {
    expect((merge3({ t: 'a' }, { t: 'mine' }, { t: 'theirs' }) as { t: string }).t).toBe('mine');
  });

  it('id arrays: additions from both sides are kept without duplicates', () => {
    const base = { notes: { k: [{ id: 'n1', v: 'x' }] } };
    const mine = { notes: { k: [{ id: 'n1', v: 'x' }, { id: 'n2', v: 'mine' }] } };
    const theirs = { notes: { k: [{ id: 'n1', v: 'x' }, { id: 'n3', v: 'theirs' }] } };
    const ids = (merge3(base, mine, theirs) as typeof base).notes.k.map((n) => n.id).sort();
    expect(ids).toEqual(['n1', 'n2', 'n3']);
  });

  it('id arrays: delete vs edit keeps the edit, plain delete is honoured', () => {
    const base = { l: [{ id: 'a', v: 1 }, { id: 'b', v: 1 }] };
    const mine = { l: [{ id: 'b', v: 1 }] };
    expect((merge3(base, mine, { l: [{ id: 'a', v: 2 }, { id: 'b', v: 1 }] }) as typeof base).l.map((x) => x.id + x.v)).toEqual(['a2', 'b1']);
    expect((merge3(base, mine, { l: [{ id: 'a', v: 1 }, { id: 'b', v: 1 }] }) as typeof base).l.map((x) => x.id)).toEqual(['b']);
  });

  it('id arrays: they delete what I edited -> my edit survives', () => {
    const base = { l: [{ id: 'a', v: 1 }] };
    const r = merge3(base, { l: [{ id: 'a', v: 9 }] }, { l: [] }) as typeof base;
    expect(r.l).toEqual([{ id: 'a', v: 9 }]);
  });

  it('plain arrays behave as sets (deletions honoured)', () => {
    const r = merge3({ favs: ['#111111', '#222222'] }, { favs: ['#111111', '#333333'] }, { favs: ['#111111', '#222222', '#444444'] }) as { favs: string[] };
    expect([...r.favs].sort()).toEqual(['#111111', '#333333', '#444444']);
  });

  it('from an empty base (first import) everything is a union', () => {
    const r = merge3({}, { done: { a: true }, favs: ['#aaaaaa'] }, { done: { b: true }, favs: ['#bbbbbb'] }) as { done: object; favs: string[] };
    expect(r.done).toEqual({ a: true, b: true });
    expect([...r.favs].sort()).toEqual(['#aaaaaa', '#bbbbbb']);
  });

  it('removed keys: honoured when the other side did not touch them, kept when it edited them', () => {
    expect(merge3({ a: 1, b: 2 }, { a: 1 }, { a: 1, b: 2, c: 3 })).toEqual({ a: 1, c: 3 });
    expect(merge3({ a: 1, b: 2 }, { a: 1 }, { a: 1, b: 5 })).toEqual({ a: 1, b: 5 });
    expect(merge3({ a: 1, b: 2 }, { a: 1, b: 7 }, { a: 1 })).toEqual({ a: 1, b: 7 });
  });

  it('type conflicts and mixed arrays fall back to this device', () => {
    expect(merge3({ a: [1] }, { a: { x: 1 } }, { a: [2] })).toEqual({ a: { x: 1 } });
    expect(merge3([], [{ id: 'a' }, 1], [2])).toEqual([{ id: 'a' }, 1]);
  });

  it('never mutates its inputs and returns deep copies', () => {
    const mine = { a: { b: [1] } }, theirs = { a: { b: [1], c: 1 } }, base = { a: { b: [1] } };
    const r = merge3(base, mine, theirs) as { a: { b: number[] } };
    r.a.b.push(2);
    expect(mine).toEqual({ a: { b: [1] } });
    expect(theirs).toEqual({ a: { b: [1], c: 1 } });
  });
});

describe('eq / clone', () => {
  it('compares deeply and ignores key order', () => {
    expect(eq({ a: 1, b: [1, { c: 2 }] }, { b: [1, { c: 2 }], a: 1 })).toBe(true);
    expect(eq({ a: 1 }, { a: 1, b: undefined })).toBe(false);
    expect(eq([1, 2], [1, 3])).toBe(false);
    expect(eq([], {})).toBe(false);
    expect(eq(null, {})).toBe(false);
    expect(eq(1, '1')).toBe(false);
  });
  it('clone is deep and tolerates undefined', () => {
    const o = { a: { b: 1 } };
    expect(clone(o)).toEqual(o);
    expect(clone(o)).not.toBe(o);
    expect(clone(undefined)).toBeUndefined();
  });
});
