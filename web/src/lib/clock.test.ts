import { span, startAt, timeRange } from './clock';

describe('time labels', () => {
  it.each([
    ['18:30 – 21:30', 1110, 1290], ['13:30', 810, null], ['09:30', 570, null], ['9h05', 545, null], ['– 12:00', null, 720], ['', null, null], [undefined, null, null]
  ])('%s', (label, start, end) => expect(timeRange(label as string | undefined)).toEqual({ start, end }));
  it('start moment is in local time, null without a start', () => {
    const t = startAt({ date: '2026-10-12', time: '18:30 – 21:30' }) as number;
    const d = new Date(t);
    expect([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes()]).toEqual([2026, 9, 12, 18, 30]);
    expect(startAt({ date: '2026-10-12', time: '' })).toBeNull();
    expect(startAt({ date: '2026-10-12' })).toBeNull();
  });
  it('spans read naturally', () => {
    expect([span(25), span(60), span(65), span(150)]).toEqual(['25 min', '1 h', '1 h 05', '2 h 30']);
  });
});
