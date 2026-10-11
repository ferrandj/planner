import type { Data } from '../types';

/** Tick or untick a session, remembering the day it was ticked (the achievements and streaks use it). */
export function setDone(d: Data, key: string, on: boolean, day: string): void {
  if (on) { d.done[key] = true; d.doneAt[key] = day; }
  else { delete d.done[key]; delete d.doneAt[key]; }
}

/** Forget a session's tick altogether (the session itself was deleted). */
export const clearDone = (d: Data, key: string): void => setDone(d, key, false, '');
