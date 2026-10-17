import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { QUESTIONS } from './data/quizBank';
import { voice } from './lib/voice';
import { FakeServer } from './test/fakeServer';
import { mountApp, saved } from './test/render';

beforeEach(() => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date(2026, 9, 11, 10, 0, 0)); });
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });
const user = (): ReturnType<typeof userEvent.setup> => userEvent.setup({ advanceTimers: () => {} });
const on = (d: { prefs: { quiz?: boolean; lang: string } }): void => { d.prefs.quiz = true; };
const gate = (): HTMLElement => screen.getByRole('dialog', { name: /Une question avant d’entrer|A question before you come in|Una pregunta antes de entrar/ });

/** The question on screen, found in the bank. */
const current = (g: HTMLElement): (typeof QUESTIONS)[number] => {
  const q = QUESTIONS.filter((x) => (g.textContent || '').includes(x.q)).sort((a, b) => b.q.length - a.q.length)[0];
  if (!q) throw new Error('question not found: ' + (g.textContent || '').slice(0, 120));
  return q;
};
/** Answer the question on screen (right or wrong), then go to the next one. */
async function answer(u: ReturnType<typeof user>, g: HTMLElement, right: boolean, last = false): Promise<void> {
  const q = current(g);
  const label = right ? q.correct : q.wrong[0];
  await u.click(within(g).getByRole('button', { name: label}));
  await u.click(within(g).getByRole('button', { name: last ? 'Voir le résultat' : 'Question suivante' }));
}
async function playRound(u: ReturnType<typeof user>, rights: boolean[]): Promise<void> {
  for (let i = 0; i < rights.length; i++) await answer(u, gate(), rights[i], i === rights.length - 1);
}

describe('English quiz at the door', () => {
  beforeEach(() => { vi.spyOn(voice, 'play').mockResolvedValue('recording'); });

  it('asks five questions per visit, each in the language of the app and in English, with English answers', async () => {
    await mountApp({ seed: on });
    const g = gate();
    expect(within(g).getByText('Quel est le mot anglais pour 🐱 ?')).toBeInTheDocument();
    expect(within(g).getByText('What is the English word for 🐱?')).toBeInTheDocument();
    expect(within(g).getAllByRole('button', { pressed: false }).map((b) => b.textContent).sort()).toEqual(['cat', 'cow', 'dog', 'pig']);
    expect(within(g).getByText(/Anglais · A1/)).toBeInTheDocument();
    expect(within(g).getByText('1 / 5')).toBeInTheDocument();
    expect(within(g).getByRole('button', { name: 'Question suivante' })).toBeDisabled();            // answer first
    expect(within(g).queryByRole('button', { name: 'Entrer dans le planner' })).toBeNull();          // only after the five questions
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

  it('a wrong answer is fine: the right one turns green, with a short explanation, and it is read aloud', async () => {
    const srv = new FakeServer();
    await mountApp({ server: srv, seed: on });
    const u = user();
    const g = gate();
    await u.click(within(g).getByRole('button', { name: 'dog' }));
    expect(within(g).getByRole('button', { name: 'cat ✓' })).toHaveClass('ok');
    expect(within(g).getByRole('button', { name: 'dog ✗' })).toHaveClass('ko');
    expect(within(g).getByText(/Pas tout à fait/)).toBeInTheDocument();
    expect(within(g).getByText(/🐱 se dit « cat » \(chat\)/)).toBeInTheDocument();
    expect(voice.play).toHaveBeenNthCalledWith(1, 'What is the English word for this picture?');   // the question was read by itself...
    expect(voice.play).toHaveBeenNthCalledWith(2, 'cat');                            // ...and the voice says the right answer
    await u.click(within(g).getByRole('button', { name: 'cow' }));                 // the answer cannot be changed afterwards
    expect(within(g).getByRole('button', { name: 'cow' })).not.toHaveClass('ko');
    expect(voice.play).toHaveBeenCalledTimes(2);
  });

  it('the question and the right answer can be listened to at any time', async () => {
    await mountApp({ seed: on });
    const u = user();
    const g = gate();
    await u.click(within(g).getByRole('button', { name: /Écouter la question/ }));
    expect(voice.play).toHaveBeenLastCalledWith('What is the English word for this picture?');
    await u.click(within(g).getByRole('button', { name: 'cat' }));
    await u.click(within(g).getByRole('button', { name: /Écouter la bonne réponse/ }));
    expect(voice.play).toHaveBeenLastCalledWith('cat');
  });

  it('the voice can be switched off: nothing is read, and the choice is kept', async () => {
    const srv = new FakeServer();
    const a = await mountApp({ server: srv, seed: on });
    const u = user();
    const g = gate();
    expect(voice.play).toHaveBeenCalledTimes(1);                                     // the first question was read when it appeared
    await u.click(within(g).getByRole('button', { name: /Voix/ }));
    await u.click(within(g).getByRole('button', { name: 'cat' }));
    expect(voice.play).toHaveBeenCalledTimes(1);                                     // nothing more once switched off
    await saved(a.sync);
    expect(srv.data.prefs.quizVoice).toBe(false);
  });

  it('each question is read as soon as it appears, with no click on "Écouter" (the voice is on by default)', async () => {
    await mountApp({ seed: on });
    const u = user();
    expect(voice.play).toHaveBeenCalledTimes(1);
    expect(voice.play).toHaveBeenLastCalledWith('What is the English word for this picture?');
    await u.click(within(gate()).getByRole('button', { name: 'cat' }));
    await u.click(within(gate()).getByRole('button', { name: 'Question suivante' }));
    expect(within(gate()).getByText('2 / 5')).toBeInTheDocument();
    expect(voice.play).toHaveBeenLastCalledWith('What is the English word for this picture?');
    expect(voice.play).toHaveBeenCalledTimes(3);                                     // question 1, its right answer, question 2
  });

  it('with the voice switched off nothing starts by itself, but the buttons still read on request', async () => {
    await mountApp({ seed: (d) => { on(d); d.prefs.quizVoice = false; } });
    const u = user();
    const g = gate();
    await u.click(within(g).getByRole('button', { name: 'cat' }));
    expect(voice.play).not.toHaveBeenCalled();
    await u.click(within(g).getByRole('button', { name: /Écouter la bonne réponse/ }));
    expect(voice.play).toHaveBeenCalledWith('cat');
  });

  it('if the browser refuses to start the sound by itself, it says what to do, and the voice runs by itself after the first click', async () => {
    (voice.play as ReturnType<typeof vi.fn>).mockResolvedValueOnce('blocked');
    await mountApp({ seed: on });
    const u = user();
    const g = gate();
    expect(await within(g).findByText(/Ton navigateur attend un clic/)).toBeInTheDocument();
    await u.click(within(g).getByRole('button', { name: /Écouter la question/ }));
    expect(voice.play).toHaveBeenCalledTimes(2);
    await vi.waitFor(() => expect(within(g).queryByText(/Ton navigateur attend un clic/)).toBeNull());
    await u.click(within(g).getByRole('button', { name: 'cat' }));
    await u.click(within(g).getByRole('button', { name: 'Question suivante' }));
    expect(voice.play).toHaveBeenCalledTimes(4);                                     // the next question started by itself
    expect(within(gate()).queryByText(/Ton navigateur attend un clic/)).toBeNull();
  });

  it('after five answers: the score, the right answers and the way in; everything is saved', async () => {
    const srv = new FakeServer();
    const a = await mountApp({ server: srv, seed: on });
    const u = user();
    await playRound(u, [true, true, false, true, true]);
    const g = gate();
    expect(within(g).getByText('4 bonnes réponses sur 5')).toBeInTheDocument();
    expect(within(g).getAllByRole('listitem').map((li) => li.textContent?.replace('🔊', ''))).toEqual(['cat', 'dog', 'apple', 'bread', 'milk']);
    expect(within(g).getByText('A1')).toBeInTheDocument();
    await u.click(within(g).getByRole('button', { name: 'Entrer dans le planner' }));
    expect(screen.queryByRole('dialog', { name: /Une question avant/ })).toBeNull();
    await saved(a.sync);
    expect(srv.data.quiz['en-a1-01']).toEqual({ ok: 1, ko: 0, at: '2026-10-11' });
    expect(srv.data.quiz['en-a1-03']).toEqual({ ok: 0, ko: 1, at: '2026-10-11' });
  });

  it('the next visit asks the next five, and the one that was wrong comes back first', async () => {
    const srv = new FakeServer();
    const first = await mountApp({ server: srv, seed: on });
    const u = user();
    await playRound(u, [true, true, false, true, true]);
    await u.click(within(gate()).getByRole('button', { name: 'Entrer dans le planner' }));
    await saved(first.sync);
    first.utils.unmount();

    await mountApp({ server: srv });
    expect(within(gate()).getByText('Quel est le mot anglais pour 🍎 ?')).toBeInTheDocument();       // en-a1-03, answered wrong
    await playRound(u, [true, true, true, true, true]);
    expect(within(gate()).getByText('5 bonnes réponses sur 5')).toBeInTheDocument();
  });

  it('finishing a level moves on to the next one, with a message', async () => {
    const srv = new FakeServer();
    const a = await mountApp({ server: srv, seed: (d) => { on(d); QUESTIONS.slice(0, 49).forEach((q) => { d.quiz[q.id] = { ok: 1, ko: 0, at: '2026-10-10' }; }); } });
    const u = user();
    const g = gate();
    expect(within(g).getByText(/Anglais · A1/)).toBeInTheDocument();
    await answer(u, g, true);                                                       // the last question of A1...
    expect(within(gate()).getByText(/Anglais · A2/)).toBeInTheDocument();           // ...the course goes on with A2 in the same round
    await playRound(u, [true, true, true, false]);
    const done = gate();
    expect(within(done).getByText(/Niveau A1 terminé ! Tu passes au niveau A2\./)).toBeInTheDocument();
    expect([...done.querySelectorAll('.qz-lv.done')].map((e) => e.textContent)).toEqual(['A1 50/50']);
    await u.click(within(done).getByRole('button', { name: 'Entrer dans le planner' }));
    await saved(a.sync);
    expect(srv.data.quiz['en-a2-001'].ok).toBe(1);
    expect(srv.data.quiz['en-a2-004'].ko).toBe(1);
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

  it('the "Quiz" window turns it back on, shows the progress by level, the voice switch and offers five practice questions', async () => {
    const srv = new FakeServer();
    const a = await mountApp({ server: srv, seed: (d) => { d.prefs.quiz = false; d.quiz['en-a1-01'] = { ok: 2, ko: 1, at: '2026-10-10' }; } });
    const u = user();
    expect(screen.queryByRole('dialog')).toBeNull();
    await u.click(screen.getByRole('button', { name: /Quiz/ }));
    const d = screen.getByRole('dialog', { name: /Quiz d’anglais/ });
    expect(within(d).getByText(new RegExp('1 questions réussies sur ' + QUESTIONS.length + ' · 2 bonnes réponses, 1 erreurs'))).toBeInTheDocument();
    expect([...d.querySelectorAll('.qz-lv')].map((e) => e.textContent)).toEqual(['A1 1/50', expect.stringMatching(/^A2 0\//), expect.stringMatching(/^B1 0\//)]);
    const sw = within(d).getByRole('switch', { name: /Poser une question/ });
    expect(sw).not.toBeChecked();
    await u.click(sw);
    await u.click(within(d).getByRole('switch', { name: /Voix/ }));
    await saved(a.sync);
    expect(srv.data.prefs).toMatchObject({ quiz: true, quizVoice: false });
    await u.click(within(d).getByRole('button', { name: 'Cinq questions pour s’entraîner' }));
    expect(within(d).getByText('Quel est le mot anglais pour 🐶 ?')).toBeInTheDocument();      // question 1 is mastered: the next one
    for (let i = 0; i < 5; i++) {
      const q = current(d);
      await u.click(within(d).getByRole('button', { name: q.correct}));
      await u.click(within(d).getByRole('button', { name: i < 4 ? 'Question suivante' : 'Voir le résultat' }));
    }
    await u.click(within(d).getByRole('button', { name: 'Terminer' }));
    await saved(a.sync);
    expect(srv.data.quiz['en-a1-02'].ok).toBe(1);
    expect(srv.data.quiz['en-a1-06'].ok).toBe(1);
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
