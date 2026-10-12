import { BASELINE_VERSION, CHANGELOG, type ChangeEntry } from '../data/changelog';

/** -1, 0 or 1 for "1.10.0" against "1.9.2". Anything that is not x.y.z (e.g. "dev") sorts before every release. */
export function compareVersions(a: string, b: string): number {
  const p = (v: string): number[] | null => (/^\d+\.\d+\.\d+$/.test(v) ? v.split('.').map(Number) : null);
  const x = p(a), y = p(b);
  if (!x && !y) return 0;
  if (!x) return -1;
  if (!y) return 1;
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] < y[i] ? -1 : 1;
  return 0;
}

/** What is new for someone who last saw `seen` and now runs `current`: newest first. */
export function entriesSince(seen: string | null, current: string, entries: ChangeEntry[] = CHANGELOG): ChangeEntry[] {
  const from = seen && /^\d+\.\d+\.\d+$/.test(seen) ? seen : BASELINE_VERSION;
  return entries.filter((e) => compareVersions(e.version, from) > 0 && compareVersions(e.version, current) <= 0)
    .sort((a, b) => compareVersions(b.version, a.version));
}

/** The latest few entries (for the "Nouveautés" button). */
export const latestEntries = (n = 4, entries: ChangeEntry[] = CHANGELOG): ChangeEntry[] => [...entries].sort((a, b) => compareVersions(b.version, a.version)).slice(0, n);

const SEEN = 'planner.seenVersion', AGAIN = 'planner.showChangelog';
type S = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | undefined;
const store = (): S => { try { return typeof localStorage === 'undefined' ? undefined : localStorage; } catch { return undefined; } };

/** Kept per device (not in the planner data): each phone or computer is told once about an update. */
export const seenVersion = (s: S = store()): string | null => { try { return s?.getItem(SEEN) || null; } catch { return null; } };
export const markSeen = (v: string, s: S = store()): void => { try { s?.setItem(SEEN, v); } catch { /* blocked storage: it is simply shown again */ } };
export const showAgain = (s: S = store()): boolean => { try { return s?.getItem(AGAIN) === '1'; } catch { return false; } };
export const setShowAgain = (on: boolean, s: S = store()): void => { try { if (on) s?.setItem(AGAIN, '1'); else s?.removeItem(AGAIN); } catch { /* blocked storage */ } };
