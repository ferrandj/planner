import { fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { FakeServer } from './test/fakeServer';
import { mountApp, saved } from './test/render';

// Sunday 11 Oct 2026, 12:00
beforeEach(() => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date(2026, 9, 11, 12, 0, 0)); });
afterEach(() => { vi.useRealTimers(); });
const user = (): ReturnType<typeof userEvent.setup> => userEvent.setup({ advanceTimers: () => {} });
const bar = (): HTMLElement => screen.getByRole('region', { name: 'Programme du jour' });
const rows = (): HTMLElement[] => within(bar()).getAllByRole('listitem');

describe("today's agenda", () => {
  it('says so when nothing is planned', async () => {
    await mountApp();
    expect(within(bar()).getByText(/Rien de prévu aujourd'hui/)).toBeInTheDocument();
  });

  it('lists the day in order and says what is past, what is next and how long until it', async () => {
    await mountApp({ seed: (d) => {
      d.custom.push({ id: 'c1', title: 'Gym', subject: '', date: '2026-10-11', time: '16:00', tend: '17:00' });
      d.custom.push({ id: 'c2', title: 'Breakfast reading', subject: 'm1', date: '2026-10-11', time: '08:00', tend: '09:00' });
      d.custom.push({ id: 'c3', title: 'Revision', subject: 'm2', date: '2026-10-11', time: '14:00', tend: '15:30' });
    } });
    const r = rows();
    expect(r.map((x) => x.querySelector('.today-m')?.textContent?.replace(/\s+/g, ' ').trim())).toEqual(['Ma Breakfast reading', 'Ph Revision', 'Gym']);
    expect(within(r[0]).getByText('Passé')).toBeInTheDocument();
    expect(within(r[1]).getByText('Prochain · dans 2 h')).toBeInTheDocument();       // 12:00 -> 14:00
    expect(within(r[2]).getByText('dans 4 h')).toBeInTheDocument();
    expect(r[1]).toHaveClass('next');
  });

  it('says "En cours" for what is under way, and ticking a line is saved', async () => {
    vi.setSystemTime(new Date(2026, 9, 11, 14, 30, 0));
    const srv = new FakeServer();
    const { sync } = await mountApp({ server: srv, seed: (d) => { d.custom.push({ id: 'c3', title: 'Revision', subject: 'm2', date: '2026-10-11', time: '14:00', tend: '15:30' }); } });
    expect(within(rows()[0]).getByText('En cours')).toBeInTheDocument();
    await user().click(within(rows()[0]).getByRole('checkbox'));
    await saved(sync);
    expect(srv.data.done.c3).toBe(true);
    expect(within(rows()[0]).getByText('Fait')).toBeInTheDocument();
  });

  it('shows assignment deadlines and exams due today, without a clock status', async () => {
    await mountApp({ seed: (d) => { d.edits['d:d1'] = { date: '2026-10-11' }; } });
    expect(within(rows()[0]).getByText(/À RENDRE · Assignment 1/)).toBeInTheDocument();
  });

  it('with a simulated date it shows that day, without live statuses', async () => {
    await mountApp();
    const u = user();
    await u.click(screen.getByText('Tester avec une autre date'));
    fireEvent.change(document.getElementById('simdate') as HTMLInputElement, { target: { value: '2026-10-12' } });
    const r = rows();
    expect(r).toHaveLength(1);
    expect(r[0].textContent).toMatch(/Live du soir/);
    expect(r[0].textContent).not.toMatch(/dans|En cours|Passé/);
  });
});
