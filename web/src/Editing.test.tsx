import { fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { FakeServer } from './test/fakeServer';
import { mountApp, saved } from './test/render';

beforeEach(() => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date(2026, 9, 11, 12, 0, 0)); });
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });
const user = (): ReturnType<typeof userEvent.setup> => userEvent.setup({ advanceTimers: () => {} });
const dialog = (): HTMLElement => screen.getByRole('dialog');

describe('edit mode entry', () => {
  it('is a chip next to the language flags, not a tab, and toggles back to where you were', async () => {
    await mountApp();
    const u = user();
    expect(screen.queryByRole('tab', { name: /Édition/ })).toBeNull();
    const chip = screen.getByRole('button', { name: /Édition/ });
    expect(chip.closest('.themebar')).toContainElement(screen.getByRole('button', { name: 'Français' }));
    await u.click(screen.getByRole('tab', { name: 'Devoirs' }));
    await u.click(chip);
    expect(chip).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: '+ Ajouter une matière' })).toBeInTheDocument();
    await u.click(chip);
    expect(screen.getByRole('tab', { name: 'Devoirs' })).toHaveAttribute('aria-selected', 'true');
  });
});

describe('editing a tile where it is', () => {
  it('assignment: ✎ on the card opens the dialog; changes are saved and shown at once', async () => {
    const srv = new FakeServer();
    const { sync } = await mountApp({ server: srv });
    const u = user();
    await u.click(screen.getByRole('tab', { name: 'Devoirs' }));
    await u.click(screen.getByRole('button', { name: 'Éditer : Assignment 1' }));
    const title = within(dialog()).getByLabelText('Titre');
    await u.clear(title); await u.type(title, 'Case study');
    await u.click(within(dialog()).getByRole('button', { name: 'Fermer' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getAllByText('Case study').length).toBeGreaterThan(0);
    await saved(sync);
    expect(srv.data.edits['d:d1']).toMatchObject({ title: 'Case study' });
  });

  it('session: right-click → Éditer opens its dialog (and Échap closes it)', async () => {
    const srv = new FakeServer();
    const { sync } = await mountApp({ server: srv });
    const u = user();
    const row = screen.getAllByText('Webconférence · Révisions')[0].closest('li') as HTMLElement;
    fireEvent.contextMenu(row, { clientX: 40, clientY: 40 });
    await u.click(screen.getByRole('menuitem', { name: /Éditer/ }));
    expect(dialog()).toBeInTheDocument();
    const tag = within(dialog()).getByLabelText('Précision (facultatif)');
    await u.clear(tag); await u.type(tag, 'Exam prep');
    await u.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    await saved(sync);
    expect(srv.data.edits['e:m2-webconf-2026-10-14']).toMatchObject({ tag: 'Exam prep' });
    expect(screen.getAllByText('Webconférence · Exam prep').length).toBeGreaterThan(0);
  });

  it('right-click also ticks / unticks a session', async () => {
    const srv = new FakeServer();
    const { sync } = await mountApp({ server: srv });
    const u = user();
    const row = screen.getAllByText('Webconférence · Révisions')[0].closest('li') as HTMLElement;
    fireEvent.contextMenu(row);
    await u.click(screen.getByRole('menuitem', { name: /Marquer comme fait/ }));
    await saved(sync);
    expect(srv.data.done['m2-webconf-2026-10-14']).toBe(true);
  });

  it('exam: ✎ opens its dialog', async () => {
    await mountApp();
    const u = user();
    await u.click(screen.getByRole('tab', { name: 'Devoirs' }));
    await u.click(screen.getByRole('button', { name: 'Éditer : Exams' }));
    expect(within(dialog()).getByText('Modifier l\'examen')).toBeInTheDocument();
  });
});

describe('adding and removing', () => {
  it('adds a subject, which gets its own colour, and it is saved as the user\'s own item', async () => {
    const srv = new FakeServer();
    const { sync } = await mountApp({ server: srv });
    const u = user();
    await u.click(screen.getByRole('tab', { name: 'Devoirs' }));
    await u.click(screen.getByRole('button', { name: '+ Ajouter une matière' }));
    const name = within(dialog()).getByLabelText('Nom complet');
    await u.clear(name); await u.type(name, 'History');
    await u.click(within(dialog()).getByRole('button', { name: 'Fermer' }));
    await saved(sync);
    expect(srv.data.extra.s).toHaveLength(1);
    expect(srv.data.extra.s[0]).toMatchObject({ c: 3 });
    expect(screen.getAllByText('History').length).toBeGreaterThan(0);
    expect(srv.data.edits['s:' + srv.data.extra.s[0].id]).toMatchObject({ name: 'History' });
  });

  it('adds an assignment and an exam from the edit screen', async () => {
    const srv = new FakeServer();
    const { sync } = await mountApp({ server: srv });
    const u = user();
    await u.click(screen.getByRole('button', { name: /Édition/ }));
    await u.click(screen.getByRole('button', { name: '+ Ajouter un devoir' }));
    await u.click(within(dialog()).getByRole('button', { name: 'Fermer' }));
    await u.click(screen.getByRole('button', { name: '+ Ajouter un examen' }));
    await u.click(within(dialog()).getByRole('button', { name: 'Fermer' }));
    await saved(sync);
    expect(srv.data.extra.d).toHaveLength(1);
    expect(srv.data.extra.x).toHaveLength(1);
  });

  it('removing an item hides it but keeps it, and it can be restored from "Supprimés"', async () => {
    const srv = new FakeServer();
    const { sync } = await mountApp({ server: srv });
    const u = user();
    await u.click(screen.getByRole('tab', { name: 'Devoirs' }));
    await u.click(screen.getByRole('button', { name: 'Éditer : Assignment 2' }));
    await u.click(within(dialog()).getByRole('button', { name: 'Supprimer' }));
    await saved(sync);
    expect(srv.data.deleted['d:d2']).toBe(true);
    expect(screen.queryByRole('button', { name: 'Éditer : Assignment 2' })).toBeNull();
    await u.click(screen.getByRole('button', { name: /Édition/ }));
    await u.click(screen.getByRole('button', { name: /Supprimés/ }));
    await u.click(within(screen.getByText('Assignment 2').closest('.edcard') as HTMLElement).getByRole('button', { name: /Restaurer/ }));
    await saved(sync);
    expect(srv.data.deleted['d:d2']).toBeUndefined();
  });

  it('removing a subject asks first; declining changes nothing', async () => {
    const srv = new FakeServer();
    const { sync } = await mountApp({ server: srv });
    const u = user();
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    await u.click(screen.getByRole('tab', { name: 'Devoirs' }));
    await u.click(screen.getByRole('button', { name: 'Éditer : Physics' }));
    await u.click(within(dialog()).getByRole('button', { name: 'Supprimer' }));
    expect(confirm).toHaveBeenCalledTimes(1);
    await saved(sync);
    expect(srv.data.deleted).toEqual({});
    expect(dialog()).toBeInTheDocument();
  });
});

describe('calendar day popup', () => {
  it('clicking a day opens a popup with what is planned that day; it closes with Fermer, Échap or a click outside', async () => {
    await mountApp();
    const u = user();
    await u.click(screen.getByRole('button', { name: 'Mois' }));
    await u.click(screen.getByRole('button', { name: /^lundi 12 octobre 2026, \d+ élément/ }));
    const d = dialog();
    expect(within(d.querySelector('ul.list') as HTMLElement).getByText(/Live du soir/)).toBeInTheDocument();
    await u.click(within(d).getByRole('button', { name: 'Fermer' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    await u.click(screen.getByRole('button', { name: /^mercredi 14 octobre 2026, / }));
    expect(within(dialog()).getByText(/Webconférence · Révisions/)).toBeInTheDocument();
    await u.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    await u.click(screen.getByRole('button', { name: /^mardi 13 octobre 2026, / }));
    expect(within(dialog()).getByText('Rien de prévu ce jour-là.')).toBeInTheDocument();
    await u.click(dialog());                                                    // the dark area around the popup
    expect(screen.queryByRole('dialog')).toBeNull();
  });
  it('a tile can be edited from the popup, and Échap closes only the edit dialog first', async () => {
    await mountApp();
    const u = user();
    await u.click(screen.getByRole('button', { name: 'Mois' }));
    await u.click(screen.getByRole('button', { name: /^mercredi 14 octobre 2026, / }));
    await u.click(within(dialog()).getAllByRole('button', { name: /^Éditer/ })[0]);
    expect(screen.getAllByRole('dialog')).toHaveLength(2);
    await u.keyboard('{Escape}');
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
  });
});

describe('install as an app', () => {
  it('offers "Installer l\'application" only when the browser says the app can be installed, and asks the browser to do it', async () => {
    await mountApp();
    expect(screen.queryByRole('button', { name: /Installer/ })).toBeNull();
    const prompt = vi.fn().mockResolvedValue(undefined);
    const ev = Object.assign(new Event('beforeinstallprompt', { cancelable: true }), { prompt });
    fireEvent(window, ev);
    const btn = await screen.findByRole('button', { name: /Installer l'application/ });
    expect(ev.defaultPrevented).toBe(true);
    await user().click(btn);
    expect(prompt).toHaveBeenCalledTimes(1);
    await vi.waitFor(() => expect(screen.queryByRole('button', { name: /Installer/ })).toBeNull());
  });
});

describe('quick add of the usual class from a calendar day', () => {
  it('a Monday offers the subject whose evening live is usually on Mondays; one click adds it with the usual time, saved and editable', async () => {
    const srv = new FakeServer();
    const { sync } = await mountApp({ server: srv });
    const u = user();
    await u.click(screen.getByRole('button', { name: 'Mois' }));
    await u.click(screen.getByRole('button', { name: /^lundi 19 octobre 2026, / }));
    const q = within(dialog());
    expect(q.getAllByRole('button', { name: /^Ajouter : / })).toHaveLength(1 + 4);          // 1 suggestion + the 4 manual choices (2 subjects x live/webconf)
    await u.click(q.getAllByRole('button', { name: 'Ajouter : Maths, Live du soir, 18:30 – 21:30' })[0]);
    await saved(sync);
    expect(srv.data.extra.e).toHaveLength(1);
    expect(srv.data.extra.e[0]).toMatchObject({ subject: 'm1', kind: 'live', date: '2026-10-19', time: '18:30 – 21:30' });
    expect(within(dialog().querySelector('ul.list') as HTMLElement).getByText(/Live du soir/)).toBeInTheDocument();   // it is now in the day's list
    expect(within(dialog()).getAllByRole('button', { name: /^Ajouter : / })).toHaveLength(4);   // no longer suggested (already there)
    await u.click(within(dialog()).getAllByRole('button', { name: /^Éditer/ })[0]);        // and, like every tile, editable
    expect(within(screen.getAllByRole('dialog')[1]).getByText('Modifier la séance')).toBeInTheDocument();
  });
  it('another weekday offers that weekday\'s class, and a day without one still lets you pick any subject', async () => {
    await mountApp();
    const u = user();
    await u.click(screen.getByRole('button', { name: 'Mois' }));
    await u.click(screen.getByRole('button', { name: /^mercredi 21 octobre 2026, / }));
    expect(within(dialog()).getAllByRole('button', { name: /^Ajouter : Physics, Webconférence/ }).length).toBeGreaterThan(0);
    await u.keyboard('{Escape}');
    await u.click(screen.getByRole('button', { name: /^samedi 24 octobre 2026, / }));
    expect(within(dialog()).getByText(/Aucune séance habituelle/)).toBeInTheDocument();
    expect(within(dialog()).getAllByRole('button', { name: /^Ajouter : / })).toHaveLength(4);
  });
});
