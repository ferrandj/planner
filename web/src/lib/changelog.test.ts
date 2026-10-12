import { CHANGELOG } from '../data/changelog';
import { compareVersions, entriesSince, latestEntries, markSeen, seenVersion, setShowAgain, showAgain } from './changelog';

const mem = (): { getItem: (k: string) => string | null; setItem: (k: string, v: string) => void; removeItem: (k: string) => void } => {
  const m: Record<string, string> = {};
  return { getItem: (k) => m[k] ?? null, setItem: (k, v) => { m[k] = v; }, removeItem: (k) => { delete m[k]; } };
};

describe('versions', () => {
  it('compare numerically, not as text', () => {
    expect(compareVersions('1.10.0', '1.9.2')).toBe(1);
    expect(compareVersions('1.2.3', '1.2.3')).toBe(0);
    expect(compareVersions('2.0.0', '10.0.0')).toBe(-1);
    expect(compareVersions('dev', '1.0.0')).toBe(-1);
    expect(compareVersions('dev', 'dev')).toBe(0);
  });
});

describe('what is new', () => {
  const e = (version: string) => ({ version, date: '2026-01-01', items: [{ fr: 'a', en: 'a', es: 'a' }] });
  const list = [e('1.5.0'), e('1.7.0'), e('1.6.0'), e('1.8.0')];
  it('everything between the version last seen and the one running, newest first', () => {
    expect(entriesSince('1.5.0', '1.8.0', list).map((x) => x.version)).toEqual(['1.8.0', '1.7.0', '1.6.0']);
    expect(entriesSince('1.7.0', '1.8.0', list).map((x) => x.version)).toEqual(['1.8.0']);
  });
  it('nothing when up to date, and nothing for a version without an entry', () => {
    expect(entriesSince('1.8.0', '1.8.0', list)).toEqual([]);
    expect(entriesSince('1.8.0', '1.8.1', list)).toEqual([]);
  });
  it('never shows something newer than the running version', () => {
    expect(entriesSince('1.5.0', '1.6.0', list).map((x) => x.version)).toEqual(['1.6.0']);
  });
  it('a device that never recorded a version is told about everything after the baseline (1.4.0)', () => {
    expect(entriesSince(null, '1.8.0', list).map((x) => x.version)).toEqual(['1.8.0', '1.7.0', '1.6.0', '1.5.0']);
    expect(entriesSince('garbage', '1.8.0', list)).toHaveLength(4);
  });
  it('the real list: newest first, versions unique, every entry has the three languages', () => {
    const vs = CHANGELOG.map((c) => c.version);
    expect(new Set(vs).size).toBe(vs.length);
    expect([...vs].sort((a, b) => compareVersions(b, a))).toEqual(vs);
    for (const c of CHANGELOG) {
      expect(c.items.length, c.version).toBeGreaterThan(0);
      for (const i of c.items) { expect(i.fr.length).toBeGreaterThan(5); expect(i.en.length).toBeGreaterThan(5); expect(i.es.length).toBeGreaterThan(5); }
    }
    expect(latestEntries(2).map((c) => c.version)).toEqual(vs.slice(0, 2));
  });
});

describe('what this device has seen', () => {
  it('is remembered per device, with the "show again" switch', () => {
    const s = mem();
    expect(seenVersion(s)).toBeNull();
    markSeen('1.8.0', s);
    expect(seenVersion(s)).toBe('1.8.0');
    expect(showAgain(s)).toBe(false);
    setShowAgain(true, s);
    expect(showAgain(s)).toBe(true);
    setShowAgain(false, s);
    expect(showAgain(s)).toBe(false);
  });
  it('a blocked storage never breaks anything', () => {
    const bad = { getItem: () => { throw new Error('no'); }, setItem: () => { throw new Error('no'); }, removeItem: () => { throw new Error('no'); } };
    expect(seenVersion(bad)).toBeNull();
    expect(() => { markSeen('1.0.0', bad); setShowAgain(true, bad); }).not.toThrow();
    expect(showAgain(bad)).toBe(false);
  });
});
