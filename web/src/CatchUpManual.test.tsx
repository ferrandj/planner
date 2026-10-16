import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { FakeServer } from './test/fakeServer';
import { mountApp, saved } from './test/render';

// Sunday 11 Oct 2026, noon: one late session (Maths live of 5 Oct), a live tomorrow evening (12 Oct) and a webconf on Wednesday.
beforeEach(() => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date(2026, 9, 11, 12, 0, 0)); try { localStorage.clear(); } catch { /* none */ } });
afterEach(() => { vi.useRealTimers(); });
const user = (): ReturnType<typeof userEvent.setup> => userEvent.setup({ advanceTimers: () => {} });
const LATE = 'm1-live-2026-10-05';

describe('manual catch-up planning', () => {
  it('is a checkbox under the automatic switch: automatic by default, manual when ticked (nothing is placed by itself)', async () => {
    const srv = new FakeServer();
    const { sync } = await mountApp({ server: srv, seed: (d) => { d.prefs.auto = true; } });
    const u = user();
    const box = screen.getByRole('checkbox', { name: 'Je choisis moi-même mes rattrapages' });
    expect(box).not.toBeChecked();
    expect(document.querySelectorAll('.st.plan')).toHaveLength(1);              // automatic: placed for me
    await u.click(box);
    expect(document.querySelectorAll('.st.plan')).toHaveLength(0);              // manual: nothing until I choose
    expect(screen.getByText(/1 cours à planifier/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Planifier demain/ })).toBeInTheDocument();
    expect(screen.queryByLabelText('Max. de suite par matière')).toBeNull();
    await saved(sync);
    expect(srv.data.prefs.autoManual).toBe(true);
  });

  it('the checkbox is only there while the switch is on', async () => {
    await mountApp();
    expect(screen.queryByRole('checkbox', { name: 'Je choisis moi-même mes rattrapages' })).toBeNull();
  });

  it('"Planifier demain" asks what to catch up, with hours for the morning and the afternoon, and saves the choice', async () => {
    const srv = new FakeServer();
    const { sync } = await mountApp({ server: srv, seed: (d) => { d.prefs.auto = true; d.prefs.autoManual = true; } });
    const u = user();
    await u.click(screen.getByRole('button', { name: /Planifier demain/ }));
    const dlg = screen.getByRole('dialog');
    expect(within(dlg).getByText(/lundi 12 octobre 2026/i)).toBeInTheDocument();
    const cls = within(dlg).getByLabelText(/Cours à rattraper – Matin/) as HTMLSelectElement;
    const hour = within(dlg).getByLabelText(/Heure – Matin/) as HTMLSelectElement;
    expect([...hour.options].map((o) => o.textContent)).toEqual(['8h', '9h', '10h', '11h']);
    expect(hour).toBeDisabled();                                                     // nothing chosen yet
    expect(within(dlg).getByText(/Prévu : Maths · Live du soir/)).toBeInTheDocument();                 // the live of tomorrow evening holds the afternoon/evening: it can be replaced
    await u.selectOptions(cls, LATE);
    await u.selectOptions(hour, '10:00');
    await u.click(within(dlg).getByRole('button', { name: 'Enregistrer' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    await saved(sync);
    expect(srv.data.picks).toEqual({ [LATE]: { date: '2026-10-12', time: '10:00' } });
    expect(document.querySelectorAll('.st.plan')).toHaveLength(1);
    expect(screen.getByText(/Tous les rattrapages sont planifiés/)).toBeInTheDocument();
    expect(srv.data.done).toEqual({});                                               // the class itself is untouched
  });

  it('a chosen day can be changed or emptied, and "Plus tard" changes nothing', async () => {
    const srv = new FakeServer();
    const { sync } = await mountApp({ server: srv, seed: (d) => { d.prefs.auto = true; d.prefs.autoManual = true; d.picks[LATE] = { date: '2026-10-12', time: '09:00' }; } });
    const u = user();
    await u.click(screen.getByRole('button', { name: /Planifier demain/ }));
    let dlg = screen.getByRole('dialog');
    expect((within(dlg).getByLabelText(/Cours à rattraper – Matin/) as HTMLSelectElement).value).toBe(LATE);
    expect((within(dlg).getByLabelText(/Heure – Matin/) as HTMLSelectElement).value).toBe('09:00');
    await u.click(within(dlg).getByRole('button', { name: 'Plus tard' }));
    await saved(sync);
    expect(srv.data.picks[LATE]).toEqual({ date: '2026-10-12', time: '09:00' });
    await u.click(screen.getByRole('button', { name: /Planifier demain/ }));
    dlg = screen.getByRole('dialog');
    await u.selectOptions(within(dlg).getByLabelText(/Cours à rattraper – Matin/), '');
    await u.click(within(dlg).getByRole('button', { name: 'Enregistrer' }));
    await saved(sync);
    expect(srv.data.picks).toEqual({});
  });

  it('a day of the calendar can be planned from its popup', async () => {
    await mountApp({ seed: (d) => { d.prefs.auto = true; d.prefs.autoManual = true; } });
    const u = user();
    await u.click(screen.getByRole('button', { name: /^mardi 13 octobre 2026, / }));
    await u.click(screen.getByRole('button', { name: /Planifier les rattrapages de ce jour/ }));
    const dlg = screen.getByRole('dialog');
    expect(within(dlg).getByText(/mardi 13 octobre 2026/i)).toBeInTheDocument();
    const pm = within(dlg).getByLabelText(/Cours à rattraper – Après-midi/) as HTMLSelectElement;   // a free day: the afternoon/evening can be chosen too
    await u.selectOptions(pm, LATE);
    expect([...(within(dlg).getByLabelText(/Heure – Après-midi/) as HTMLSelectElement).options].map((o) => o.textContent)).toEqual(['12h', '13h', '14h', '15h', '16h', '17h', '18h', '19h', '20h', '21h']);
    expect((within(dlg).getByLabelText(/Heure – Après-midi/) as HTMLSelectElement).value).toBe('14:00');

  });

  it('ticking the last class of the day asks what to do tomorrow — once', async () => {
    const srv = new FakeServer();
    await mountApp({ server: srv, seed: (d) => {
      d.prefs.auto = true; d.prefs.autoManual = true;
      d.custom.push({ id: 'c1', title: 'Relire', subject: '', date: '2026-10-11', time: '14:00', tend: '15:00' }, { id: 'c2', title: 'Ranger', subject: '', date: '2026-10-11', time: '16:00', tend: '17:00' });
    } });
    const u = user();
    const box = (n: string): HTMLElement => screen.getAllByRole('checkbox', { name: new RegExp(n) })[0];
    await u.click(box('Relire'));
    expect(screen.queryByRole('dialog')).toBeNull();                                  // one is still to do
    await u.click(box('Ranger'));
    const dlg = await screen.findByRole('dialog');
    expect(within(dlg).getByText(/lundi 12 octobre 2026/i)).toBeInTheDocument();
    await u.click(within(dlg).getByRole('button', { name: 'Plus tard' }));
    await u.click(box('Ranger')); await u.click(box('Ranger'));                              // untick, tick again
    expect(screen.queryByRole('dialog')).toBeNull();                                  // already asked for tomorrow
  });

  it('it does not ask when the planning is automatic, nor when tomorrow is already planned', async () => {
    await mountApp({ seed: (d) => { d.prefs.auto = true; d.custom.push({ id: 'c1', title: 'Relire', subject: '', date: '2026-10-11', time: '14:00', tend: '15:00' }); } });
    await user().click(screen.getAllByRole('checkbox', { name: /Relire/ })[0]);
    expect(screen.queryByRole('dialog')).toBeNull();
  });
  it('nor when tomorrow already has its catch-up', async () => {
    await mountApp({ seed: (d) => { d.prefs.auto = true; d.prefs.autoManual = true; d.picks[LATE] = { date: '2026-10-12', time: '09:00' }; d.custom.push({ id: 'c1', title: 'Relire', subject: '', date: '2026-10-11', time: '14:00', tend: '15:00' }); } });
    await user().click(screen.getAllByRole('checkbox', { name: /Relire/ })[0]);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('a chosen catch-up that was not done by its day goes back to "to plan", and the choices of the automatic mode are kept', async () => {
    await mountApp({ seed: (d) => { d.prefs.auto = true; d.prefs.autoManual = true; d.picks[LATE] = { date: '2026-10-10', time: '09:00' }; } });
    expect(screen.getByText(/1 cours à planifier/)).toBeInTheDocument();
    expect(document.querySelectorAll('.st.plan')).toHaveLength(0);
  });

  it('a class chosen for one period is taken away from the other one (never planned twice)', async () => {
    const srv = new FakeServer();
    const { sync } = await mountApp({ server: srv, seed: (d) => { d.prefs.auto = true; d.prefs.autoManual = true; } });
    const u = user();
    await u.click(screen.getByRole('button', { name: /^mardi 13 octobre 2026, / }));
    await u.click(screen.getByRole('button', { name: /Planifier les rattrapages de ce jour/ }));
    const dlg = screen.getByRole('dialog');
    await u.selectOptions(within(dlg).getByLabelText(/Cours à rattraper – Après-midi/), LATE);
    await u.selectOptions(within(dlg).getByLabelText(/Cours à rattraper – Matin/), LATE);
    expect((within(dlg).getByLabelText(/Cours à rattraper – Après-midi/) as HTMLSelectElement).value).toBe('');
    await u.click(within(dlg).getByRole('button', { name: 'Enregistrer' }));
    await saved(sync);
    expect(srv.data.picks).toEqual({ [LATE]: { date: '2026-10-13', time: '09:00' } });
  });

  it('a period held by a personal session or an exam cannot be replaced', async () => {
    await mountApp({ seed: (d) => { d.prefs.auto = true; d.prefs.autoManual = true; d.custom.push({ id: 'c1', title: 'Gym', subject: '', date: '2026-10-12', time: '09:00', tend: '10:00' }); } });
    const u = user();
    await u.click(screen.getByRole('button', { name: /Planifier demain/ }));
    const dlg = screen.getByRole('dialog');
    expect(within(dlg).getByText('Déjà occupé ce jour-là par une séance.')).toBeInTheDocument();
    expect(within(dlg).queryByLabelText(/Cours à rattraper – Matin/)).toBeNull();
  });
});

describe('replacing a planned class by a catch-up', () => {
  const WEB = 'm2-webconf-2026-10-14';
  const open = async (u: ReturnType<typeof user>): Promise<HTMLElement> => {
    await u.click(screen.getByRole('button', { name: /^mercredi 14 octobre 2026, / }));
    await u.click(screen.getByRole('button', { name: /Planifier les rattrapages de ce jour/ }));
    return screen.getByRole('dialog');
  };

  it('the class that was there goes straight to "À rattraper" and the late counter grows; the catch-up takes its place', async () => {
    const srv = new FakeServer();
    const { sync } = await mountApp({ server: srv, seed: (d) => { d.prefs.auto = true; d.prefs.autoManual = true; } });
    const u = user();
    expect(screen.getByText('cours en retard').closest('.lb')!.querySelector('.lb-n')).toHaveTextContent('1');
    const dlg = await open(u);
    expect(within(dlg).getByText(/Prévu : Physics · Webconférence/)).toBeInTheDocument();
    await u.selectOptions(within(dlg).getByLabelText(/Cours à rattraper – Après-midi/), LATE);
    expect(within(dlg).getByText(/Remplace : Physics · Webconférence.*« À rattraper »/)).toBeInTheDocument();
    await u.selectOptions(within(dlg).getByLabelText(/Heure – Après-midi/), '15:00');
    await u.click(within(dlg).getByRole('button', { name: 'Enregistrer' }));
    await saved(sync);
    expect(srv.data.displaced).toEqual({ [WEB]: true });
    expect(srv.data.picks[LATE]).toEqual({ date: '2026-10-14', time: '15:00', replaces: [WEB] });
    expect(srv.data.done).toEqual({});                                              // nothing is ticked or deleted
    expect(screen.getByText('cours en retard').closest('.lb')!.querySelector('.lb-n')).toHaveTextContent('2');
    const late = screen.getByRole('heading', { name: /À rattraper/ }).closest('section') as HTMLElement;
    expect(within(late).getByText('Remplacé · à rattraper')).toBeInTheDocument();
    expect(screen.getByText(/1 cours à planifier/)).toBeInTheDocument();           // the replaced class waits to be planned
  });

  it('cancelling the replacement gives the class its place back; once the catch-up is done the replaced class stays late', async () => {
    const srv = new FakeServer();
    const { sync } = await mountApp({ server: srv, seed: (d) => { d.prefs.auto = true; d.prefs.autoManual = true; d.displaced[WEB] = true; d.picks[LATE] = { date: '2026-10-14', time: '15:00', replaces: [WEB] }; } });
    const u = user();
    let dlg = await open(u);
    expect(within(dlg).getByText(/Remplace : Physics · Webconférence/)).toBeInTheDocument();     // shown again when the day is reopened
    await u.selectOptions(within(dlg).getByLabelText(/Cours à rattraper – Après-midi/), '');
    await u.click(within(dlg).getByRole('button', { name: 'Enregistrer' }));
    await saved(sync);
    expect(srv.data.displaced).toEqual({});
    expect(srv.data.picks).toEqual({});
    expect(screen.getByText('cours en retard').closest('.lb')!.querySelector('.lb-n')).toHaveTextContent('1');
    // again, then the catch-up is ticked: the replacement is final
    dlg = await open(u);
    await u.selectOptions(within(dlg).getByLabelText(/Cours à rattraper – Après-midi/), LATE);
    await u.click(within(dlg).getByRole('button', { name: 'Enregistrer' }));
    await saved(sync);
    expect(srv.data.displaced).toEqual({ [WEB]: true });
    await u.click(within(document.querySelector('.st.plan')!.closest('li') as HTMLElement).getByRole('checkbox'));
    await saved(sync);
    expect(srv.data.done[LATE]).toBe(true);
    expect(srv.data.displaced).toEqual({ [WEB]: true });
    expect(screen.getByText('cours en retard').closest('.lb')!.querySelector('.lb-n')).toHaveTextContent('1');   // the replaced class is the one left to catch up
  });

  it('choosing another catch-up for the same period keeps the replacement', async () => {
    const srv = new FakeServer();
    const { sync } = await mountApp({ server: srv, seed: (d) => { d.prefs.auto = true; d.prefs.autoManual = true; d.displaced[WEB] = true; d.picks[LATE] = { date: '2026-10-14', time: '15:00', replaces: [WEB] }; } });
    const u = user();
    const dlg = await open(u);
    await u.selectOptions(within(dlg).getByLabelText(/Heure – Après-midi/), '17:00');
    await u.click(within(dlg).getByRole('button', { name: 'Enregistrer' }));
    await saved(sync);
    expect(srv.data.picks[LATE]).toEqual({ date: '2026-10-14', time: '17:00', replaces: [WEB] });
    expect(srv.data.displaced).toEqual({ [WEB]: true });
  });

  const planned = (): Element[] => [...document.querySelectorAll('.today-i')].filter((li) => /Live du soir/.test(li.textContent || '') && !/↻/.test(li.textContent || ''));   // not the catch-up tiles
  it('a class is in the agenda of its day, but not once it was replaced', async () => {
    vi.setSystemTime(new Date(2026, 9, 12, 8, 0, 0));
    await mountApp({ seed: (d) => { d.prefs.auto = true; } });
    expect(planned()).toHaveLength(1);
  });
  it('...and gone from it once replaced', async () => {
    vi.setSystemTime(new Date(2026, 9, 12, 8, 0, 0));
    await mountApp({ seed: (d) => { d.prefs.auto = true; d.displaced['m1-live-2026-10-12'] = true; } });
    expect(planned()).toHaveLength(0);
  });
});
