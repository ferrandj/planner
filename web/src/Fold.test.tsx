import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { mountApp } from './test/render';

// Sunday 11 Oct 2026: one late class (Maths live of 5 Oct); then a live on 12 Oct, a webconf on 14 Oct, assignments in November...
beforeEach(() => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date(2026, 9, 11, 12, 0, 0)); try { localStorage.clear(); } catch { /* none */ } });
afterEach(() => { vi.useRealTimers(); });
const user = (): ReturnType<typeof userEvent.setup> => userEvent.setup({ advanceTimers: () => {} });
const fold = (name: RegExp): HTMLElement => screen.getByRole('button', { name });

describe('the list of classes: folding, order and month', () => {
  it('every line shows the day, the number and the month', async () => {
    await mountApp();
    const row = screen.getAllByText('12', { selector: '.dn' })[0].closest('.dt') as HTMLElement;
    expect(row.querySelector('.wd')?.textContent).toMatch(/lun/i);
    expect(row.querySelector('.mo')?.textContent).toMatch(/oct/i);
    const months = [...document.querySelectorAll('.row .dt .mo')].map((e) => e.textContent);
    expect(months.length).toBeGreaterThan(5);
    expect(months.every((m) => !!m)).toBe(true);
  });

  it('"À rattraper" and "À suivre" are two sections that fold, and each month folds too', async () => {
    await mountApp();
    const u = user();
    const late = fold(/À rattraper/), next = fold(/À suivre/);
    expect(late).toHaveAttribute('aria-expanded', 'true');
    const lateList = document.getElementById(late.getAttribute('aria-controls') as string) as HTMLElement;
    expect(lateList).not.toHaveAttribute('hidden');
    expect(within(lateList).getAllByRole('listitem').length).toBeGreaterThan(0);
    await u.click(late);
    expect(late).toHaveAttribute('aria-expanded', 'false');
    expect(lateList).toHaveAttribute('hidden');
    expect(next).toHaveAttribute('aria-expanded', 'true');                           // the other one is not affected

    const nextBody = document.getElementById(next.getAttribute('aria-controls') as string) as HTMLElement;
    const october = within(nextBody).getByRole('button', { name: /^octobre 2026 \d+$/i });
    const octList = document.getElementById(october.getAttribute('aria-controls') as string) as HTMLElement;
    await u.click(october);
    expect(octList).toHaveAttribute('hidden');
    expect(within(nextBody).getByRole('button', { name: /^novembre 2026 \d+$/i })).toHaveAttribute('aria-expanded', 'true');
    await u.click(next);
    expect(nextBody).toHaveAttribute('hidden');
    await u.click(next);
    expect(nextBody).not.toHaveAttribute('hidden');
    expect(octList).toHaveAttribute('hidden');                                       // the month stays folded inside
  });

  it('what is folded stays folded after a reload, on this device', async () => {
    const a = await mountApp();
    await user().click(fold(/À rattraper/));
    a.utils.unmount();
    await mountApp();
    expect(fold(/À rattraper/)).toHaveAttribute('aria-expanded', 'false');
    expect(fold(/À suivre/)).toHaveAttribute('aria-expanded', 'true');
  });

  it('the late classes are in date order (a replaced class that is later in the calendar comes after)', async () => {
    await mountApp({ seed: (d) => { d.displaced['m1-live-2026-10-12'] = true; d.custom.push({ id: 'c0', title: 'Early', subject: 'm2', date: '2026-10-01', time: '10:00', tend: '' }); } });
    const late = document.getElementById(fold(/À rattraper/).getAttribute('aria-controls') as string) as HTMLElement;
    const days = [...late.querySelectorAll('.dt')].map((e) => (e.querySelector('.dn')?.textContent || '') + ' ' + (e.querySelector('.mo')?.textContent || ''));
    expect(days.length).toBe(3);
    const nums = days.map((d) => Number(d.split(' ')[0]));
    expect(nums).toEqual([...nums].sort((x, y) => x - y));
  });

  it('with "Tout", the months are the top level (no "À suivre" wrapper) and fold as well', async () => {
    await mountApp();
    const u = user();
    await u.click(screen.getByRole('button', { name: 'Tout' }));
    expect(screen.queryByRole('button', { name: /À rattraper/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /À suivre/ })).toBeNull();
    const oct = screen.getByRole('button', { name: /^octobre 2026 \d+$/i });
    await u.click(oct);
    expect(oct).toHaveAttribute('aria-expanded', 'false');
  });
});
