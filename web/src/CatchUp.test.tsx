import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { FakeServer } from './test/fakeServer';
import { mountApp, saved } from './test/render';

// Sunday 11 Oct 2026, noon: the fixture has one late session (Maths live of 5 Oct), a live tomorrow evening and a webconf on Wednesday.
beforeEach(() => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date(2026, 9, 11, 12, 0, 0)); });
afterEach(() => { vi.useRealTimers(); });
const user = (): ReturnType<typeof userEvent.setup> => userEvent.setup({ advanceTimers: () => {} });
const LATE = 'm1-live-2026-10-05';

describe('late classes counter', () => {
  it('shows how many classes are late, by subject, instead of a white "À rattraper" card', async () => {
    await mountApp();
    const bar = screen.getByText('cours en retard').closest('.lb') as HTMLElement;
    expect(within(bar).getByText('1')).toBeInTheDocument();
    expect(within(bar).getByText(/Ma · 1/)).toBeInTheDocument();
    expect(document.querySelector('.sum')?.textContent).not.toMatch(/À rattraper/);
  });
  it('says nothing about a backlog, but encourages, once everything is caught up', async () => {
    await mountApp({ seed: (d) => { d.done[LATE] = true; } });
    expect(screen.queryByText('cours en retard')).toBeNull();
    expect(document.querySelector('.lb.ok')?.textContent).toMatch(/bravo|bien joué|rythme|mérité/);
  });
});

describe('automatic catch-up', () => {
  it('is off by default: nothing is moved', async () => {
    await mountApp();
    expect(screen.getByRole('switch', { name: /Rattrapage automatique/ })).toHaveAttribute('aria-checked', 'false');
    expect(screen.queryByText(/Replanifié/)).toBeNull();
    expect(document.querySelector('.st.plan')).toBeNull();
  });

  it('switched on, it plans the late class in the first free period and the choice is saved', async () => {
    const srv = new FakeServer();
    const { sync } = await mountApp({ server: srv });
    const u = user();
    await u.click(screen.getByRole('switch', { name: /Rattrapage automatique/ }));
    expect(screen.getByRole('switch', { name: /Rattrapage automatique/ })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByText(/Replanifié : .* · Après-midi · soir/)).toBeInTheDocument();   // 12:00: this morning is gone, this afternoon is free
    expect(document.querySelectorAll('.st.plan')).toHaveLength(1);
    expect(screen.getByText(/Tout est replanifié jusqu’au/)).toBeInTheDocument();
    await saved(sync);
    expect(srv.data.prefs.auto).toBe(true);
  });

  it('ticking the catch-up tile ticks the late class itself, and the plan empties', async () => {
    const srv = new FakeServer();
    const { sync } = await mountApp({ server: srv, seed: (d) => { d.prefs.auto = true; } });
    const u = user();
    const tile = document.querySelector('.st.plan')!.closest('li') as HTMLElement;
    await u.click(within(tile).getByRole('checkbox'));
    await saved(sync);
    expect(srv.data.done[LATE]).toBe(true);
    expect(Object.keys(srv.data.done)).toEqual([LATE]);
    expect(document.querySelector('.st.plan')).toBeNull();
    expect(document.querySelector('.lb.ok')).not.toBeNull();
  });

  it('the "max in a row" setting is editable and saved (1 to 20 only)', async () => {
    const srv = new FakeServer();
    const { sync } = await mountApp({ server: srv, seed: (d) => { d.prefs.auto = true; } });
    const u = user();
    const box = screen.getByLabelText('Max. de suite par matière') as HTMLInputElement;
    expect(box.value).toBe('3');
    await u.clear(box); await u.type(box, '5');
    await saved(sync);
    expect(srv.data.prefs.autoMax).toBe(5);
    await u.clear(box); await u.type(box, '0');
    await saved(sync);
    expect(srv.data.prefs.autoMax).toBe(5);                                  // 0 is refused
  });

  it('never touches the original data: late class, ticks and notes stay as they were', async () => {
    const srv = new FakeServer();
    const { sync } = await mountApp({ server: srv, seed: (d) => { d.notes[LATE] = [{ id: 'n1', k: 'text', v: 'keep me' }]; } });
    await user().click(screen.getByRole('switch', { name: /Rattrapage automatique/ }));
    await saved(sync);
    expect(srv.data.done).toEqual({});
    expect(srv.data.hidden).toEqual({});
    expect(srv.data.notes[LATE]).toEqual([{ id: 'n1', k: 'text', v: 'keep me' }]);
  });

  it('a class already in the afternoon/evening keeps its period: the catch-up goes elsewhere', async () => {
    await mountApp({ seed: (d) => { d.prefs.auto = true; d.custom.push({ id: 'c1', title: 'Gym', subject: '', date: '2026-10-11', time: '14:00', tend: '16:00' }); } });
    expect(screen.getByText(/Replanifié : .* · Matin/)).toBeInTheDocument();  // today pm is taken; today am is over -> tomorrow morning
  });
});
