import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { FakeServer } from './test/fakeServer';
import { mountApp, saved } from './test/render';

// Monday 12 Oct 2026, 18:20: the fixture's Maths live starts at 18:30
beforeEach(() => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date(2026, 9, 12, 18, 20, 0)); });
afterEach(() => { vi.useRealTimers(); });
const user = (): ReturnType<typeof userEvent.setup> => userEvent.setup({ advanceTimers: () => {} });

describe('reminders before an event starts', () => {
  it('shows a message when something starts within the chosen time, once', async () => {
    await mountApp();
    const a = await screen.findByRole('alert');
    expect(within(a).getByText('Ma · Live du soir')).toBeInTheDocument();
    expect(within(a).getByText('Commence à 18:30 (dans 10 min)')).toBeInTheDocument();
  });

  it('does not repeat after the message is closed, and does not show again after a reload', async () => {
    const first = await mountApp();
    const u = user();
    await u.click(within(await screen.findByRole('alert')).getByRole('button', { name: 'Fermer' }));
    expect(screen.queryByRole('alert')).toBeNull();
    first.utils.unmount();
    await mountApp();                                                    // the same device opens the app again
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('nothing before the time, nothing once it has started, nothing when ticked, nothing when switched off', async () => {
    vi.setSystemTime(new Date(2026, 9, 12, 18, 0, 0));                  // 30 min before
    const a = await mountApp();
    expect(screen.queryByRole('alert')).toBeNull();
    a.utils.unmount();
    vi.setSystemTime(new Date(2026, 9, 12, 18, 31, 0));                 // already started
    const b = await mountApp();
    expect(screen.queryByRole('alert')).toBeNull();
    b.utils.unmount();
    vi.setSystemTime(new Date(2026, 9, 12, 18, 20, 0));
    const c = await mountApp({ seed: (d) => { d.done['m1-live-2026-10-12'] = true; } });
    expect(screen.queryByRole('alert')).toBeNull();
    c.utils.unmount();
    await mountApp({ seed: (d) => { d.prefs.remind = false; } });
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('a longer notice warns earlier', async () => {
    vi.setSystemTime(new Date(2026, 9, 12, 17, 50, 0));                 // 40 min before
    await mountApp({ seed: (d) => { d.prefs.remindLead = 60; } });
    expect(within(await screen.findByRole('alert')).getByText('Commence à 18:30 (dans 40 min)')).toBeInTheDocument();
  });

  it('the settings are in the "Rappels" window and are saved', async () => {
    const srv = new FakeServer();
    const { sync } = await mountApp({ server: srv });
    const u = user();
    await u.click(screen.getByRole('button', { name: /Rappels/ }));
    const d = screen.getByRole('dialog');
    await u.selectOptions(within(d).getByRole('combobox'), '30');
    await u.click(within(d).getByRole('checkbox', { name: /Son et vibration/ }));
    await saved(sync);
    expect(srv.data.prefs).toMatchObject({ remindLead: 30, remindSound: false, remind: true });
    expect(within(d).getByText(/adresse sécurisée|Non disponible/)).toBeInTheDocument();      // this test browser has no push support
    await u.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: /Rappels/ })).toBeNull();
  });

  it('"Tester le rappel" shows a test message', async () => {
    vi.setSystemTime(new Date(2026, 9, 11, 12, 0, 0));
    await mountApp();
    const u = user();
    await u.click(screen.getByRole('button', { name: /Rappels/ }));
    await u.click(screen.getByRole('button', { name: 'Tester le rappel' }));
    expect(within(await screen.findByRole('alert')).getByText('Test du rappel')).toBeInTheDocument();
  });
});
