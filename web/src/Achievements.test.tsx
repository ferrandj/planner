import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { FakeServer } from './test/fakeServer';
import { mountApp, saved } from './test/render';

// Sunday 11 Oct 2026, 10:00 (the fixture's sessions are on 5, 12 Oct (live Maths), 14 Oct (webconf Physics))
beforeEach(() => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date(2026, 9, 11, 10, 0, 0)); });
afterEach(() => { vi.useRealTimers(); });
const user = (): ReturnType<typeof userEvent.setup> => userEvent.setup({ advanceTimers: () => {} });
const LATE = 'm1-live-2026-10-05';

describe('achievements', () => {
  it('has a tab with the trophy room: count, streak, groups and a medal for every tier', async () => {
    await mountApp();
    const u = user();
    await u.click(screen.getByRole('tab', { name: /Succès/ }));
    expect(screen.getByRole('progressbar', { name: 'Succès débloqués' })).toHaveAttribute('aria-valuenow', '0');
    expect(screen.getByText(/Série en cours : 0 j/)).toBeInTheDocument();
    for (const g of ['Séances', 'Rythme et rattrapage', 'Devoirs', 'Mon planner']) expect(screen.getByRole('heading', { name: g })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Premier live · Maths — verrouillé' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tous les lives · Maths — verrouillé' })).toBeInTheDocument();     // 2 lives exist for Maths: tier 2 is "all"
  });

  it('ticking a session unlocks its medals: a message, the date saved for good, and the tick date recorded', async () => {
    const srv = new FakeServer();
    const { sync } = await mountApp({ server: srv });
    const u = user();
    await u.click(screen.getAllByRole('checkbox', { name: /Live du soir/ })[0]);
    expect(await screen.findByText(/Succès débloqué ! Premier live · Maths/)).toBeInTheDocument();
    await saved(sync);
    expect(srv.data.done[LATE]).toBe(true);
    expect(srv.data.doneAt[LATE]).toBe('2026-10-11');
    expect(srv.data.ach).toMatchObject({ 'all|1': '2026-10-11', 's:m1:live|1': '2026-10-11' });
  });

  it('unticking never takes a medal away', async () => {
    const srv = new FakeServer();
    const { sync } = await mountApp({ server: srv });
    const u = user();
    await u.click(screen.getByRole('button', { name: 'Tout' }));                     // keep ticked sessions on screen
    await u.click(screen.getAllByRole('checkbox', { name: /Live du soir/ })[0]);
    await vi.waitFor(() => expect(srv.data.ach['s:m1:live|1']).toBe('2026-10-11'));
    await u.click(screen.getAllByRole('checkbox', { name: /Live du soir/ })[0]);       // untick
    await saved(sync);
    expect(srv.data.done[LATE]).toBeUndefined();
    expect(srv.data.doneAt[LATE]).toBeUndefined();
    expect(srv.data.ach['s:m1:live|1']).toBe('2026-10-11');
    await u.click(screen.getByRole('tab', { name: /Succès/ }));
    expect(screen.getByRole('button', { name: 'Premier live · Maths — débloqué' })).toBeInTheDocument();
  });

  it('what was already ticked before achievements existed is credited once, with one summary message', async () => {
    const srv = new FakeServer();
    const { sync } = await mountApp({ server: srv, seed: (d) => { d.done[LATE] = true; d.done['m1-live-2026-10-12'] = true; d.done['m2-webconf-2026-10-14'] = true; d.prefs.mode = 'dark'; } });
    expect(await screen.findByText(/succès débloqués !/)).toBeInTheDocument();
    await vi.waitFor(() => expect(Object.keys(srv.data.ach).length).toBeGreaterThan(3));
    await saved(sync);
    expect(srv.data.ach['s:m1:live|2']).toBe('2026-10-11');                           // both Maths lives: "all the lives"
  });

  it('a medal opens its details; locked ones say how far you are', async () => {
    await mountApp({ seed: (d) => { d.done[LATE] = true; } });
    const u = user();
    await u.click(screen.getByRole('tab', { name: /Succès/ }));
    await u.click(screen.getByRole('button', { name: 'Tous les lives · Maths — verrouillé' }));
    const a = screen.getByText('Tous les lives · Maths', { selector: 'h2' }).closest('aside') as HTMLElement;
    expect(within(a).getByText(/Verrouillé : 1 \/ 2/)).toBeInTheDocument();
    await u.click(screen.getByRole('button', { name: 'Premier live · Maths — débloqué' }));
    expect(screen.getByText(/Débloqué le dimanche 11 octobre 2026/)).toBeInTheDocument();
  });

  it('each unlocked achievement gives its own extra two-colour sticker, usable from the sticker picker; the medal itself is not a sticker', async () => {
    const srv = new FakeServer();
    const { sync } = await mountApp({ server: srv, seed: (d) => { d.done[LATE] = true; d.ach['s:m1:live|1'] = '2026-10-01'; d.ach['all|1'] = '2026-10-01'; } });
    const u = user();
    await saved(sync);
    await vi.waitFor(() => expect(Object.keys(srv.data.rew).length).toBeGreaterThanOrEqual(2));
    expect(srv.data.rew['all|1']).not.toBe(srv.data.rew['s:m1:live|1']);               // two different stickers
    await u.click(screen.getByRole('tab', { name: 'Imprimer' }));
    await u.click(screen.getByRole('button', { name: 'Stickers et emojis' }));
    const dlg = screen.getByRole('dialog');
    expect(within(dlg).getByRole('heading', { name: /Récompenses/ })).toBeInTheDocument();
    expect(within(dlg).queryByRole('button', { name: /Ajouter : Premier live/ })).toBeNull();      // medals are not stickers any more
    await u.click(within(dlg).getByRole('button', { name: 'Ajouter : Méduse' }));
    await saved(sync);
    const key = Object.keys(srv.data.stickers)[0];
    expect(srv.data.stickers[key][0].t).toMatch(/^rw:\d+$/);
    expect(document.querySelector('.stk svg.reward')).toBeTruthy();
  });

  it('rewards are given once and never change: existing ones are kept, new ones continue after the highest', async () => {
    const srv = new FakeServer();
    const { sync } = await mountApp({ server: srv, seed: (d) => { d.done[LATE] = true; d.ach['all|1'] = '2026-10-01'; d.rew['all|1'] = 7; d.ach['s:m1:live|1'] = '2026-10-02'; } });
    await saved(sync);
    await vi.waitFor(() => expect(srv.data.rew['s:m1:live|1']).toBe(8));
    expect(srv.data.rew['all|1']).toBe(7);
  });

  it('placing stickers unlocks the sticker medals, up to 20 for the last one', async () => {
    const srv = new FakeServer();
    const { sync } = await mountApp({ server: srv, seed: (d) => { d.stickers['*'] = Array.from({ length: 3 }, (_, i) => ({ id: 's' + i, t: 'ours', c: '#d6457f', x: 0.1, y: 0.1, s: 7, r: 0 })); } });
    expect(await screen.findByText(/Succès débloqué ! 3 stickers posés/)).toBeInTheDocument();
    await vi.waitFor(() => expect(srv.data.ach['stk|3']).toBeTruthy());
    await saved(sync);
    expect(Object.keys(srv.data.ach)).toEqual(expect.arrayContaining(['stk|1', 'stk|3']));
    expect(srv.data.ach['stk|5']).toBeUndefined();
  });
});
