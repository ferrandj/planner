import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { FakeServer } from './test/fakeServer';
import { mountApp, saved } from './test/render';

beforeEach(() => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date(2026, 9, 11, 10, 0, 0)); });
afterEach(() => { vi.useRealTimers(); });
const user = (): ReturnType<typeof userEvent.setup> => userEvent.setup({ advanceTimers: () => {} });
const on = (d: { prefs: { quiz?: boolean; lang: string } }): void => { d.prefs.quiz = true; };
const gate = (): HTMLElement => screen.getByRole('dialog', { name: /Une question avant d’entrer|A question before you come in|Una pregunta antes de entrar/ });

describe('English quiz at the door', () => {
  it('asks a question in the language of the app and in English, with English answers', async () => {
    await mountApp({ seed: on });
    const g = gate();
    expect(within(g).getByText('Quel est le mot anglais pour 🐱 ?')).toBeInTheDocument();
    expect(within(g).getByText('What is the English word for 🐱?')).toBeInTheDocument();
    expect(within(g).getAllByRole('button', { pressed: false }).map((b) => b.textContent).sort()).toEqual(['cat', 'cow', 'dog', 'pig']);
    expect(within(g).getByText(/Anglais de base/)).toBeInTheDocument();
    expect(within(g).getByRole('button', { name: 'Entrer dans le planner' })).toBeDisabled();       // answer first
  });

  it('in English the question is shown once; in Spanish it is shown in Spanish', async () => {
    const en = await mountApp({ seed: (d) => { on(d); d.prefs.lang = 'en'; } });
    expect(screen.getByText('What is the English word for 🐱?')).toBeInTheDocument();
    expect(screen.queryByText(/🇬🇧/)).toBeNull();
    en.utils.unmount();
    await mountApp({ seed: (d) => { on(d); d.prefs.lang = 'es'; } });
    expect(screen.getByText('¿Cómo se dice 🐱 en inglés?')).toBeInTheDocument();
    expect(screen.getByText('What is the English word for 🐱?')).toBeInTheDocument();
  });

  it('a wrong answer still lets you in: the right answer turns green, with a short explanation', async () => {
    const srv = new FakeServer();
    const { sync } = await mountApp({ server: srv, seed: on });
    const u = user();
    const g = gate();
    await u.click(within(g).getByRole('button', { name: 'dog' }));
    expect(within(g).getByRole('button', { name: 'cat ✓' })).toHaveClass('ok');
    expect(within(g).getByRole('button', { name: 'dog ✗' })).toHaveClass('ko');
    expect(within(g).getByText(/Pas tout à fait/)).toBeInTheDocument();
    expect(within(g).getByText(/🐱 se dit « cat » \(chat\)/)).toBeInTheDocument();
    await u.click(within(g).getByRole('button', { name: 'cow' }));                 // the answer cannot be changed afterwards
    expect(within(g).getByRole('button', { name: 'cow' })).not.toHaveClass('ko');
    await u.click(within(g).getByRole('button', { name: 'Entrer dans le planner' }));
    expect(screen.queryByRole('dialog', { name: /Une question avant/ })).toBeNull();
    await saved(sync);
    expect(srv.data.quiz['en-a1-01']).toEqual({ ok: 0, ko: 1, at: '2026-10-11' });
  });

  it('a right answer is celebrated and the next visit asks the next question; a wrong one comes back', async () => {
    const srv = new FakeServer();
    const first = await mountApp({ server: srv, seed: on });
    const u = user();
    await u.click(within(gate()).getByRole('button', { name: 'cat' }));
    expect(within(gate()).getByText(/Bravo/)).toBeInTheDocument();
    await u.click(within(gate()).getByRole('button', { name: 'Entrer dans le planner' }));
    await saved(first.sync);
    first.utils.unmount();

    const second = await mountApp({ server: srv });                              // next visit
    expect(within(gate()).getByText('Quel est le mot anglais pour 🐶 ?')).toBeInTheDocument();
    await u.click(within(gate()).getByRole('button', { name: 'fish' }));
    await u.click(within(gate()).getByRole('button', { name: 'Entrer dans le planner' }));
    await saved(second.sync);
    second.utils.unmount();

    await mountApp({ server: srv });                                             // the one answered wrong is asked again
    expect(within(gate()).getByText('Quel est le mot anglais pour 🐶 ?')).toBeInTheDocument();
  });

  it('is asked every time the app is opened, and the planner behind keeps all its data', async () => {
    const srv = new FakeServer();
    const a = await mountApp({ server: srv, seed: (d) => { on(d); d.done['m1-live-2026-10-05'] = true; } });
    expect(gate()).toBeInTheDocument();
    a.utils.unmount();
    await mountApp({ server: srv });
    expect(gate()).toBeInTheDocument();
    expect(srv.data.done['m1-live-2026-10-05']).toBe(true);
  });

  it('can be turned off from the question itself, and then no question is asked', async () => {
    const srv = new FakeServer();
    const a = await mountApp({ server: srv, seed: on });
    await user().click(within(gate()).getByRole('button', { name: 'Désactiver ce quiz' }));
    expect(screen.queryByRole('dialog', { name: /Une question avant/ })).toBeNull();
    await saved(a.sync);
    expect(srv.data.prefs.quiz).toBe(false);
    a.utils.unmount();
    await mountApp({ server: srv });
    expect(screen.queryByRole('dialog', { name: /Une question avant/ })).toBeNull();
  });

  it('the "Quiz" window turns it back on, shows the progress and offers a practice question', async () => {
    const srv = new FakeServer();
    const a = await mountApp({ server: srv, seed: (d) => { d.prefs.quiz = false; d.quiz['en-a1-01'] = { ok: 2, ko: 1, at: '2026-10-10' }; } });
    const u = user();
    expect(screen.queryByRole('dialog')).toBeNull();
    await u.click(screen.getByRole('button', { name: /Quiz/ }));
    const d = screen.getByRole('dialog', { name: /Quiz d’anglais/ });
    expect(within(d).getByText(/1 questions réussies sur 50 · 2 bonnes réponses, 1 erreurs/)).toBeInTheDocument();
    const sw = within(d).getByRole('switch');
    expect(sw).not.toBeChecked();
    await u.click(sw);
    await saved(a.sync);
    expect(srv.data.prefs.quiz).toBe(true);
    await u.click(within(d).getByRole('button', { name: 'Une question pour s’entraîner' }));
    expect(within(d).getByText('Quel est le mot anglais pour 🐶 ?')).toBeInTheDocument();      // question 1 is mastered: the next one
    await u.click(within(d).getByRole('button', { name: 'dog' }));
    await u.click(within(d).getByRole('button', { name: 'Terminer' }));
    await saved(a.sync);
    expect(srv.data.quiz['en-a1-02'].ok).toBe(1);
    await u.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();                                 // closing the window does not bring the door back this visit
  });

  it('right answers earn English medals', async () => {
    const srv = new FakeServer();
    const a = await mountApp({ server: srv, seed: on });
    await user().click(within(gate()).getByRole('button', { name: 'cat' }));
    await vi.waitFor(() => expect(srv.data.ach['quiz|1']).toBe('2026-10-11'));
    await saved(a.sync);
  });
});
