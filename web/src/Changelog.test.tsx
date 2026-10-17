import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { FakeServer } from './test/fakeServer';
import { mountApp } from './test/render';

beforeEach(() => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date(2026, 9, 12, 10, 0, 0)); });
afterEach(() => { vi.useRealTimers(); });
const user = (): ReturnType<typeof userEvent.setup> => userEvent.setup({ advanceTimers: () => {} });
const news = (): HTMLElement => screen.getByRole('dialog', { name: /Nouveautés|What’s new|Novedades/ });
const noNews = async (): Promise<void> => { await vi.waitFor(() => expect(screen.queryByRole('dialog', { name: /Nouveautés|What’s new/ })).toBeNull()); await new Promise((r) => setTimeout(r, 30)); expect(screen.queryByRole('dialog', { name: /Nouveautés|What’s new/ })).toBeNull(); };
const serverAt = (version: string): FakeServer => { const s = new FakeServer(); s.version = version; return s; };

describe('what is new after an update', () => {
  it('shows it the first time the new version is opened, then not again; a device that never opened the app is told about everything since 1.4.0', async () => {
    const srv = serverAt('1.8.0');
    const a = await mountApp({ server: srv });
    const d = await screen.findByRole('dialog', { name: /Nouveautés/ });
    expect(within(d).getByText('Version 1.8.0')).toBeInTheDocument();
    expect(within(d).getAllByRole('heading', { level: 3 }).map((h) => h.textContent?.split(' ')[0])).toEqual(['v1.8.0', 'v1.7.0', 'v1.6.0', 'v1.5.0']);
    expect(within(d).getByText(/Les nouveautés s’affichent ici après chaque mise à jour/)).toBeInTheDocument();
    await user().click(within(d).getByRole('button', { name: 'Compris' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(localStorage.getItem('planner.seenVersion')).toBe('1.8.0');
    a.utils.unmount();
    await mountApp({ server: srv });
    await noNews();
  });

  it('tells only what is newer than the version this device last saw', async () => {
    localStorage.setItem('planner.seenVersion', '1.6.0');
    await mountApp({ server: serverAt('1.8.0') });
    const d = await screen.findByRole('dialog', { name: /Nouveautés/ });
    expect(within(d).getAllByRole('heading', { level: 3 }).map((h) => h.textContent?.split(' ')[0])).toEqual(['v1.8.0', 'v1.7.0']);
  });

  it('says nothing for a version without news, for a development build, or when the version cannot be read', async () => {
    localStorage.setItem('planner.seenVersion', '1.8.0');
    const a = await mountApp({ server: serverAt('1.8.1') });
    await noNews(); a.utils.unmount();
    const b = await mountApp({ server: serverAt('dev') });
    await noNews(); b.utils.unmount();
    await mountApp({ server: serverAt('') });
    await noNews();
  });

  it('is written in the language of the app', async () => {
    await mountApp({ server: serverAt('1.8.0'), seed: (d) => { d.prefs.lang = 'en'; } });
    const d = await screen.findByRole('dialog', { name: /What’s new/ });
    expect(within(d).getByText(/What is new is shown here after each update/)).toBeInTheDocument();
    expect(within(d).getByRole('button', { name: 'Got it' })).toBeInTheDocument();
  });

  it('waits for the English question, if there is one', async () => {
    await mountApp({ server: serverAt('1.8.0'), seed: (d) => { d.prefs.quiz = true; } });
    const u = user();
    const gate = screen.getByRole('dialog', { name: /Une question avant d’entrer/ });
    await new Promise((r) => setTimeout(r, 30));
    expect(screen.queryByRole('dialog', { name: /Nouveautés/ })).toBeNull();
    for (let i = 0; i < 5; i++) {                                                  // the five questions of the round
      await u.click(within(gate).getAllByRole('button').find((b) => b.classList.contains('qz-opt')) as HTMLElement);
      await u.click(within(gate).getByRole('button', { name: i < 4 ? 'Question suivante' : 'Voir le résultat' }));
    }
    await u.click(within(gate).getByRole('button', { name: 'Entrer dans le planner' }));
    expect(await screen.findByRole('dialog', { name: /Nouveautés/ })).toBeInTheDocument();
  });

  it('Échap closes it and counts as seen', async () => {
    const srv = serverAt('1.8.0');
    const a = await mountApp({ server: srv });
    await screen.findByRole('dialog', { name: /Nouveautés/ });
    await user().keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: /Nouveautés/ })).toBeNull();
    expect(localStorage.getItem('planner.seenVersion')).toBe('1.8.0');
    a.utils.unmount();
  });
});

describe('the "show again" switch and the button', () => {
  it('the 🆕 Nouveautés button opens the latest changes at any time', async () => {
    await mountApp();
    const u = user();
    await u.click(screen.getByRole('button', { name: /Nouveautés/ }));
    const d = news();
    expect(within(d).getByText('Dernières nouveautés')).toBeInTheDocument();
    expect(within(d).getAllByRole('heading', { level: 3 })).toHaveLength(4);
    await u.click(within(d).getByRole('button', { name: 'Compris' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('with the switch on, it is shown again at every start; off, it stops', async () => {
    const srv = serverAt('1.8.0');
    localStorage.setItem('planner.seenVersion', '1.8.0');
    const first = await mountApp({ server: srv });
    const u = user();
    await u.click(screen.getByRole('button', { name: /Nouveautés/ }));
    const sw = within(news()).getByRole('switch', { name: 'Réafficher au prochain démarrage' });
    expect(sw).not.toBeChecked();
    await u.click(sw);
    expect(sw).toBeChecked();
    expect(localStorage.getItem('planner.showChangelog')).toBe('1');
    await u.click(within(news()).getByRole('button', { name: 'Compris' }));
    first.utils.unmount();

    const second = await mountApp({ server: srv });                           // next start-up: shown again although already seen
    const d = await screen.findByRole('dialog', { name: /Nouveautés/ });
    expect(within(d).getByRole('switch')).toBeChecked();
    await u.click(within(d).getByRole('switch'));                              // switch it off
    expect(localStorage.getItem('planner.showChangelog')).toBeNull();
    await u.click(within(d).getByRole('button', { name: 'Compris' }));
    second.utils.unmount();

    await mountApp({ server: srv });
    await noNews();
  });
});
