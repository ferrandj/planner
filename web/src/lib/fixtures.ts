import type { Base, Data } from '../types';
import { normalizeData } from './normalize';

export const base: Base = {
  s: [
    { id: 'm1', code: 'C1', name: 'Maths', short: 'Maths', ab: 'Ma', c: 1 },
    { id: 'm2', code: 'C2', name: 'Physics', short: 'Physics', ab: 'Ph', c: 2 }
  ],
  d: [
    { id: 'd1', ab: 'D1', title: 'Assignment 1', date: '2026-11-02' },
    { id: 'd2', ab: 'D2', title: 'Assignment 2', date: '2026-12-07', avail: '2026-11-20' }
  ],
  x: [{ id: 'ex1', title: 'Exams', date: '2027-04-29', end: '2027-04-30' }],
  e: [
    { id: 'm1-live-2026-10-12', subject: 'm1', kind: 'live', date: '2026-10-12', time: '18:30 – 21:30', tag: '' },
    { id: 'm2-webconf-2026-10-14', subject: 'm2', kind: 'webconf', date: '2026-10-14', time: '12:30', tag: 'Révisions' },
    { id: 'm1-live-2026-10-05', subject: 'm1', kind: 'live', date: '2026-10-05', time: '18:30 – 21:30', tag: '' }
  ]
};

export const emptyData = (): Data => normalizeData({});
