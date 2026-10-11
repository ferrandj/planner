import { diff, iso, makeFmt, pad, parse, range, rel, wdList } from './dates';
import { makeT } from './i18n';

describe('dates', () => {
  it('pads, formats and parses ISO dates without timezone drift', () => {
    expect(pad(5)).toBe('05');
    expect(iso(new Date(2027, 0, 9))).toBe('2027-01-09');
    const d = parse('2026-12-31');
    expect([d.getFullYear(), d.getMonth(), d.getDate()]).toEqual([2026, 11, 31]);
  });

  it('diff counts whole days, also across DST changes', () => {
    expect(diff('2026-11-02', '2026-10-11')).toBe(22);
    expect(diff('2026-10-11', '2026-11-02')).toBe(-22);
    expect(diff('2026-03-30', '2026-03-28')).toBe(2);   // spring-forward weekend
    expect(diff('2026-10-26', '2026-10-24')).toBe(2);   // fall-back weekend
    expect(diff('2027-01-01', '2026-01-01')).toBe(365);
  });

  it('rel() words and units follow the language', () => {
    const fr = makeT('fr'), en = makeT('en');
    expect(rel(0, fr.t, fr.tf)).toBe("aujourd'hui");
    expect(rel(1, fr.t, fr.tf)).toBe('demain');
    expect(rel(-1, fr.t, fr.tf)).toBe('hier');
    expect(rel(5, fr.t, fr.tf)).toBe('dans 5 j');
    expect(rel(-5, fr.t, fr.tf)).toBe('il y a 5 j');
    expect(rel(90, fr.t, fr.tf)).toBe('dans 3 mois');
    expect(rel(-90, fr.t, fr.tf)).toBe('il y a 3 mois');
    expect(rel(1, en.t, en.tf)).toBe('tomorrow');
  });

  it('range() handles single day, same month and across months', () => {
    const f = makeFmt('en');
    expect(range({ date: '2027-04-29' }, f)).toContain('2027');
    expect(range({ date: '2027-05-03', end: '2027-05-10' }, f)).toBe('3–10 May 2027');
    expect(range({ date: '2027-04-29', end: '2027-05-03' }, f)).toBe('29 April – 3 May 2027');
  });

  it('weekday list starts on Monday', () => {
    expect(wdList(makeFmt('en').wdLong)[0]).toBe('Monday');
    expect(wdList(makeFmt('fr').wdLong)[6]).toBe('dimanche');
  });
});
