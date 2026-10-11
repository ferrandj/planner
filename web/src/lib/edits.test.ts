import { base, emptyData } from './fixtures';
import { baseOf, clearColor, resetAllEdits, resetEdit, setEdit } from './edits';

describe('setEdit', () => {
  it('stores an edit that differs from the reference value', () => {
    const d = emptyData();
    expect(setEdit(d, base, 's:m1', 'name', 'Algebra')).toBe(true);
    expect(d.edits['s:m1']).toEqual({ name: 'Algebra' });
  });
  it('typing the original value back leaves no edit behind', () => {
    const d = emptyData();
    setEdit(d, base, 's:m1', 'name', 'Algebra');
    setEdit(d, base, 's:m1', 'name', 'Maths');
    expect(d.edits['s:m1']).toBeUndefined();
  });
  it('refuses blank required fields and changes nothing', () => {
    const d = emptyData();
    for (const [k, f] of [['s:m1', 'name'], ['s:m1', 'code'], ['d:d1', 'title'], ['d:d1', 'date'], ['x:ex1', 'date'], ['e:m1-live-2026-10-12', 'date']]) {
      expect(setEdit(d, base, k, f, '   ')).toBe(false);
    }
    expect(d.edits).toEqual({});
  });
  it('optional fields may be cleared (kept as an explicit empty edit when the reference has a value)', () => {
    const d = emptyData();
    expect(setEdit(d, base, 'd:d2', 'avail', '')).toBe(true);
    expect(d.edits['d:d2']).toEqual({ avail: '' });
    expect(setEdit(d, base, 'd:d1', 'avail', '')).toBe(true);   // reference has none: no edit needed
    expect(d.edits['d:d1']).toBeUndefined();
  });
  it('edits custom sessions in place, not through edits', () => {
    const d = emptyData();
    d.custom.push({ id: 'c1', title: 'Read', subject: '', date: '2026-10-01', time: '', tend: '' });
    expect(setEdit(d, base, 'c:c1', 'title', 'Read more')).toBe(true);
    expect(d.custom[0].title).toBe('Read more');
    expect(setEdit(d, base, 'c:c1', 'title', '')).toBe(false);
    expect(d.edits).toEqual({});
  });
  it('app title and subtitle: set, trim-empty removes', () => {
    const d = emptyData();
    setEdit(d, base, 'app', 'title', 'My planner');
    setEdit(d, base, 'app', 'eyebrow', 'Sub');
    expect(d.edits.app).toEqual({ title: 'My planner', eyebrow: 'Sub' });
    setEdit(d, base, 'app', 'title', '  ');
    expect(d.edits.app).toEqual({ eyebrow: 'Sub' });
  });
  it('baseOf finds entries and tolerates unknown keys', () => {
    expect(baseOf(base, 'd:d2').avail).toBe('2026-11-20');
    expect(baseOf(base, 'd:nope')).toEqual({});
    expect(baseOf(base, 'zz:1')).toEqual({});
  });
});

describe('resets', () => {
  it('resetEdit removes one item only', () => {
    const d = emptyData();
    setEdit(d, base, 's:m1', 'name', 'A'); setEdit(d, base, 's:m2', 'name', 'B');
    resetEdit(d, 's:m1');
    expect(Object.keys(d.edits)).toEqual(['s:m2']);
  });
  it('resetAll keeps the app title and shows hidden sessions again, leaves done/rendu/notes alone', () => {
    const d = emptyData();
    setEdit(d, base, 'app', 'title', 'Mine'); setEdit(d, base, 's:m1', 'name', 'A');
    d.hidden.x = true; d.done.y = true; d.rendu['d1:m1'] = true; d.notes.k = [{ id: 'n', k: 'text', v: 'v' }];
    resetAllEdits(d);
    expect(d.edits).toEqual({ app: { title: 'Mine' } });
    expect(d.hidden).toEqual({});
    expect(d.done).toEqual({ y: true });
    expect(d.rendu).toEqual({ 'd1:m1': true });
    expect(d.notes.k).toHaveLength(1);
  });
  it('clearColor drops only the colour', () => {
    const d = emptyData();
    d.edits['s:m1'] = { color: '#112233', name: 'A' }; d.edits['s:m2'] = { color: '#445566' };
    clearColor(d, 's:m1'); clearColor(d, 's:m2');
    expect(d.edits['s:m1']).toEqual({ name: 'A' });
    expect(d.edits['s:m2']).toBeUndefined();
  });
});
