import { fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { FakeServer } from './test/fakeServer';
import { mountApp, saved } from './test/render';

beforeEach(() => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date(2026, 9, 11, 12, 0, 0)); });
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });
const user = (): ReturnType<typeof userEvent.setup> => userEvent.setup({ advanceTimers: () => {} });
const goto = async (u: ReturnType<typeof userEvent.setup>, name: RegExp | string): Promise<void> => { await u.click(screen.getByRole('tab', { name })); };
const section = async (u: ReturnType<typeof userEvent.setup>, name: RegExp | string): Promise<void> => { await u.click(screen.getByRole('button', { name })); };

describe('edit tab', () => {
  it('renaming a subject is saved, shown everywhere, marked as modified, and can be restored', async () => {
    const srv = new FakeServer();
    const { sync } = await mountApp({ server: srv });
    const u = user();
    await goto(u, /Édition/);
    const name = screen.getAllByLabelText('Nom complet')[0];
    await u.clear(name); await u.type(name, 'Algebra');
    await saved(sync);
    expect(srv.data.edits['s:m1']).toEqual({ name: 'Algebra' });
    expect(screen.getByText('Modifié')).toBeInTheDocument();
    await goto(u, 'Planning');
    expect(screen.getAllByText('Algebra').length).toBeGreaterThan(0);
    await goto(u, /Édition/);
    await u.click(screen.getByRole('button', { name: "Rétablir les valeurs d'origine" }));
    await saved(sync);
    expect(srv.data.edits['s:m1']).toBeUndefined();
  });
  it('a required field cannot be left blank: nothing is saved and the old value returns on leaving the field', async () => {
    const srv = new FakeServer();
    const { sync } = await mountApp({ server: srv });
    const u = user();
    await goto(u, /Édition/);
    const code = screen.getAllByLabelText('Code')[0] as HTMLInputElement;
    await u.clear(code);
    expect(code.value).toBe('');
    await u.tab();
    expect(code.value).toBe('C1');
    await saved(sync).catch(() => {});
    expect(srv.data.edits['s:m1']).toBeUndefined();
  });
  it('changing an assignment date moves it in the planner; clearing the "available from" date works', async () => {
    const srv = new FakeServer();
    const { sync } = await mountApp({ server: srv });
    const u = user();
    await goto(u, /Édition/);
    const date = screen.getAllByLabelText('Date limite de rendu')[0];
    fireEvent.change(date, { target: { value: '2026-11-09' } });
    const card2 = screen.getByText('Assignment 2', { selector: 'strong' }).closest('.edcard') as HTMLElement;
    await u.click(within(card2).getByRole('button', { name: 'Effacer cette date' }));
    await saved(sync);
    expect(srv.data.edits['d:d1']).toEqual({ date: '2026-11-09' });
    expect(srv.data.edits['d:d2']).toEqual({ avail: '' });
  });
  it('hiding a session removes it from the planner but keeps it editable; restoring brings it back', async () => {
    const srv = new FakeServer();
    const { sync } = await mountApp({ server: srv });
    const u = user();
    await goto(u, /Édition/);
    await section(u, /Séances · Ma/);
    await u.click(screen.getAllByRole('button', { name: 'Masquer cette séance' })[0]);
    await saved(sync);
    expect(Object.keys(srv.data.hidden)).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Rétablir cette séance' })).toBeInTheDocument();
    await u.click(screen.getByRole('button', { name: 'Rétablir cette séance' }));
    await saved(sync);
    expect(srv.data.hidden).toEqual({});
  });
  it('"Tout réinitialiser" needs a second click, keeps the title, and does not touch ticks, hand-ins or notes', async () => {
    const srv = new FakeServer();
    const { sync } = await mountApp({ server: srv, seed: (d) => {
      d.edits = { app: { title: 'Mine' }, 's:m1': { name: 'X' } }; d.done.a = true; d.rendu['d1:m1'] = true; d.notes.k = [{ id: 'n', k: 'text', v: 'v' }]; d.hidden.h = true;
    } });
    const u = user();
    await goto(u, /Édition/);
    await u.click(screen.getByRole('button', { name: 'Tout réinitialiser' }));
    expect(srv.data.edits['s:m1']).toBeTruthy();                                   // first click only arms it
    await u.click(screen.getByRole('button', { name: 'Confirmer : efface toutes tes modifications' }));
    await saved(sync);
    expect(srv.data.edits).toEqual({ app: { title: 'Mine' } });
    expect(srv.data.hidden).toEqual({});
    expect(srv.data.done).toEqual({ a: true });
    expect(srv.data.rendu).toEqual({ 'd1:m1': true });
    expect(srv.data.notes.k).toHaveLength(1);
  });
  it('the reset button disarms when anything else is clicked', async () => {
    const srv = new FakeServer();
    await mountApp({ server: srv, seed: (d) => { d.edits['s:m1'] = { name: 'X' }; } });
    const u = user();
    await goto(u, /Édition/);
    await u.click(screen.getByRole('button', { name: 'Tout réinitialiser' }));
    await u.click(screen.getByRole('button', { name: /Matières/ }));
    expect(screen.getByRole('button', { name: 'Tout réinitialiser' })).toBeInTheDocument();
    await u.click(screen.getByRole('button', { name: 'Tout réinitialiser' }));
    await u.click(screen.getByRole('button', { name: 'Confirmer : efface toutes tes modifications' }));
    expect(srv.data.edits['s:m1']).toBeUndefined();
  });
  it('title and subtitle are saved', async () => {
    const srv = new FakeServer();
    const { sync } = await mountApp({ server: srv });
    const u = user();
    await goto(u, /Édition/);
    const title = screen.getByLabelText("Titre de l'application");
    await u.clear(title); await u.type(title, 'Term planner');
    await u.type(screen.getByLabelText('Sous-titre (facultatif)'), 'Autumn');
    await saved(sync);
    expect(srv.data.edits.app).toEqual({ title: 'Term planner', eyebrow: 'Autumn' });
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Term planner');
  });
  it('subject colour: pick, save, and go back to the original', async () => {
    const srv = new FakeServer();
    const { sync } = await mountApp({ server: srv });
    const u = user();
    await goto(u, /Édition/);
    await u.click(screen.getAllByRole('button', { name: 'Changer la couleur' })[0]);
    const hex = screen.getByLabelText('Code couleur');
    await u.clear(hex); await u.type(hex, '#112233{Enter}');
    await saved(sync);
    expect(srv.data.edits['s:m1'].color).toBe('#112233');
    expect(document.documentElement.style.getPropertyValue('--s1')).toBe('#112233');
    await u.click(screen.getByRole('button', { name: "Couleur d'origine" }));
    await saved(sync);
    expect(srv.data.edits['s:m1']).toBeUndefined();
  });
  it('custom sessions can be edited here and deleted', async () => {
    const srv = new FakeServer();
    const { sync } = await mountApp({ server: srv, seed: (d) => { d.custom.push({ id: 'c1', title: 'Read', subject: '', date: '2026-10-20', time: '', tend: '' }); } });
    const u = user();
    await goto(u, /Édition/);
    const card = screen.getByText(/^Read ·/).closest('.edcard') as HTMLElement;
    const title = within(card).getByLabelText('Titre');
    await u.clear(title); await u.type(title, 'Read more');
    fireEvent.change(within(card).getByLabelText('Matière'), { target: { value: 'm2' } });
    await saved(sync);
    expect(srv.data.custom[0]).toMatchObject({ title: 'Read more', subject: 'm2' });
    await u.click(within(card).getAllByRole('button', { name: 'Supprimer' }).find((b) => b.classList.contains('btn'))!);
    await saved(sync);
    expect(srv.data.custom).toEqual([]);
  });
});

describe('backups, export and import', () => {
  const backups = [{ name: 'state-20261011-120000000Z-r3.json', time: Date.UTC(2026, 9, 11, 12), rev: 3, tag: '', size: 2048 }, { name: 'state-20261011-110000000Z-r2-shrink.json', time: Date.UTC(2026, 9, 11, 11), rev: 2, tag: 'shrink', size: 900 }];
  it('lists backups with sizes and labels, offers the export link', async () => {
    const srv = new FakeServer(); srv.backups = backups;
    await mountApp({ server: srv });
    const u = user();
    await goto(u, /Édition/);
    await section(u, /Sauvegardes et export/);
    expect(await screen.findAllByRole('button', { name: 'Restaurer' })).toHaveLength(2);
    expect(screen.getByText(/avant une forte réduction/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Exporter (JSON)' })).toHaveAttribute('href', 'api/export');
  });
  it('restoring asks first, then loads the restored data into the app', async () => {
    const srv = new FakeServer(); srv.backups = backups;
    await mountApp({ server: srv });
    const u = user();
    const confirm = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true);
    await goto(u, /Édition/);
    await section(u, /Sauvegardes et export/);
    const btns = await screen.findAllByRole('button', { name: 'Restaurer' });
    await u.click(btns[0]);
    expect(srv.restored).toEqual([]);                      // declined: nothing happens
    await u.click(btns[0]);
    await vi.waitFor(() => expect(srv.restored).toEqual([backups[0].name]));
    expect(await screen.findByText('Sauvegarde restaurée.')).toBeInTheDocument();
    expect(confirm).toHaveBeenCalledTimes(2);
  });
  it('imports a file by merging it into the current data (nothing is deleted)', async () => {
    const srv = new FakeServer();
    const { sync } = await mountApp({ server: srv, seed: (d) => { d.done.keep = true; } });
    const u = user();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    await goto(u, /Édition/);
    await section(u, /Sauvegardes et export/);
    const file = new File([JSON.stringify({ done: { imported: true }, notes: { k: [{ id: 'n1', k: 'text', v: 'from file' }] } })], 'old.json', { type: 'application/json' });
    await u.upload(document.getElementById('imp-file') as HTMLInputElement, file);
    expect(await screen.findByText('Import terminé.')).toBeInTheDocument();
    await saved(sync);
    expect(srv.data.done).toEqual({ keep: true, imported: true });
    expect(srv.data.notes.k[0].v).toBe('from file');
  });
  it('imports an export that carries its own schedule (replaces the reference schedule)', async () => {
    const srv = new FakeServer();
    await mountApp({ server: srv });
    const u = user();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    await goto(u, /Édition/);
    await section(u, /Sauvegardes et export/);
    const base = { s: [{ id: 'z', code: 'Z1', name: 'Zoology', short: 'Zoology', ab: 'Zo', c: 1 }], d: [], x: [], e: [] };
    await u.upload(document.getElementById('imp-file') as HTMLInputElement, new File([JSON.stringify({ app: 'planner', base, data: { done: { a: true } } })], 'x.json'));
    expect(await screen.findByText('Import terminé.')).toBeInTheDocument();
    expect(srv.base.s[0].name).toBe('Zoology');
    expect(srv.data.done.a).toBe(true);
  });
  it('declining the confirmation imports nothing; a broken file is reported', async () => {
    const srv = new FakeServer();
    await mountApp({ server: srv });
    const u = user();
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    await goto(u, /Édition/);
    await section(u, /Sauvegardes et export/);
    const input = document.getElementById('imp-file') as HTMLInputElement;
    await u.upload(input, new File([JSON.stringify({ done: { x: true } })], 'a.json'));
    expect(confirm).toHaveBeenCalled();
    expect(srv.data.done).toEqual({});
    await u.upload(input, new File(['not json'], 'b.json'));
    expect(await screen.findByText('Fichier invalide.')).toBeInTheDocument();
  });
});

describe('print tab', () => {
  it('shows one A4 sheet for the current month with sessions and the legend', async () => {
    await mountApp();
    const u = user();
    await goto(u, 'Imprimer');
    const sheet = document.querySelector('.sheet') as HTMLElement;
    expect(within(sheet).getByRole('heading', { name: /Octobre 2026/i })).toBeInTheDocument();
    expect(within(sheet).getAllByText(/Live du soir/).length).toBeGreaterThan(0);
    expect(within(sheet).getByText(/Ma = C1 Maths/)).toBeInTheDocument();
  });
  it('previous/next month and the month selector', async () => {
    await mountApp();
    const u = user();
    await goto(u, 'Imprimer');
    await u.click(screen.getByRole('button', { name: 'Mois suivant' }));
    expect(screen.getByRole('heading', { name: /Novembre 2026/i })).toBeInTheDocument();
    await u.selectOptions(screen.getByLabelText('Mois à imprimer'), '2027-04');
    expect(screen.getByRole('heading', { name: /Avril 2027/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Mois suivant' })).toBeDisabled();
  });
  it('several months: choose which ones, count pages, show an empty message when none', async () => {
    const srv = new FakeServer();
    const { sync } = await mountApp({ server: srv });
    const u = user();
    await goto(u, 'Imprimer');
    await u.click(screen.getByRole('button', { name: 'Plusieurs mois' }));
    expect(document.querySelectorAll('.sheet')).toHaveLength(7);
    await u.click(screen.getByRole('button', { name: 'Aucun' }));
    expect(screen.getByText('Aucun mois sélectionné.')).toBeInTheDocument();
    await u.click(screen.getByRole('button', { name: /oct\. 26/ }));
    expect(document.querySelectorAll('.sheet')).toHaveLength(1);
    await saved(sync);
    expect(Object.values(srv.data.printOff).filter(Boolean)).toHaveLength(6);
    await u.click(screen.getByRole('button', { name: 'Tous' }));
    expect(document.querySelectorAll('.sheet')).toHaveLength(7);
  });
  it('the print dialog explains the steps and closes', async () => {
    await mountApp();
    const u = user();
    await goto(u, 'Imprimer');
    await u.click(screen.getByRole('button', { name: /Imprimer.*page/ }));
    const dlg = screen.getByRole('dialog');
    expect(within(dlg).getByText('1 page(s) A4 paysage')).toBeInTheDocument();
    await u.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
  });
  it('print colour: sober / custom is saved', async () => {
    const srv = new FakeServer();
    const { sync } = await mountApp({ server: srv });
    const u = user();
    await goto(u, 'Imprimer');
    await u.click(screen.getByRole('button', { name: 'Sobre' }));
    await saved(sync);
    expect(srv.data.prefs.ppal).toBe('sobre');
    expect(document.querySelector('.sheet')).toHaveStyle({ '--pt': '#555555' });
  });
  it('stickers: add from the library, recolour, resize, rotate, delete, clear', async () => {
    const srv = new FakeServer();
    const { sync } = await mountApp({ server: srv });
    const u = user();
    await goto(u, 'Imprimer');
    await u.click(screen.getByRole('button', { name: 'Stickers et emojis' }));
    await u.click(screen.getByRole('button', { name: /Ajouter : Ours/ }));
    await saved(sync);
    const key = Object.keys(srv.data.stickers)[0];
    expect(srv.data.stickers[key]).toHaveLength(1);
    expect(srv.data.stickers[key][0]).toMatchObject({ t: 'ours', s: 7, r: 0 });
    expect(document.querySelector('.stk.sel')).toBeTruthy();
    await u.click(screen.getByRole('button', { name: 'Plus grand' }));
    await u.click(screen.getByRole('button', { name: 'Tourner à droite' }));
    await saved(sync);
    expect(srv.data.stickers[key][0]).toMatchObject({ s: 8, r: 15 });
    const hex = screen.getAllByLabelText('Code couleur').pop()!;
    await u.clear(hex); await u.type(hex, '#00aa00{Enter}');
    await saved(sync);
    expect(srv.data.stickers[key][0].c).toBe('#00aa00');
    await u.click(screen.getByRole('button', { name: 'Supprimer' }));
    await saved(sync);
    expect(srv.data.stickers[key]).toEqual([]);
    await u.click(screen.getByRole('button', { name: 'Stickers et emojis' }));
    await u.click(screen.getByRole('button', { name: 'Emojis' }));
    await u.click(screen.getAllByRole('button', { name: /^Ajouter : / })[0]);
    await u.click(screen.getByRole('button', { name: 'Retirer tous les stickers de ce mois' }));
    await saved(sync);
    expect(srv.data.stickers[key]).toEqual([]);
  });
  it('stickers can be dragged on the sheet and the new position is saved', async () => {
    const srv = new FakeServer();
    const { sync } = await mountApp({ server: srv, seed: (d) => { d.stickers['2026-10'] = [{ id: 's1', t: 'ours', c: '#d6457f', x: 0.2, y: 0.2, s: 7, r: 0 }]; } });
    const u = user();
    await goto(u, 'Imprimer');
    const stk = document.querySelector('.stk.ed') as HTMLElement;
    const sheet = document.querySelector('.sheet') as HTMLElement;
    sheet.getBoundingClientRect = () => ({ left: 0, top: 0, width: 1000, height: 500, right: 1000, bottom: 500, x: 0, y: 0, toJSON: () => ({}) });
    fireEvent.pointerDown(stk, { pointerId: 1, clientX: 200, clientY: 100 });
    fireEvent.pointerMove(stk, { pointerId: 1, clientX: 500, clientY: 250 });
    fireEvent.pointerUp(stk, { pointerId: 1 });
    await saved(sync);
    expect(srv.data.stickers['2026-10'][0]).toMatchObject({ x: 0.5, y: 0.5 });
  });
  it('same decoration for every month, and copying a month\'s decoration to all (with confirmation)', async () => {
    const srv = new FakeServer();
    const { sync } = await mountApp({ server: srv, seed: (d) => { d.stickers['2026-10'] = [{ id: 's1', t: 'ours', c: '#d6457f', x: 0.2, y: 0.2, s: 7, r: 0 }]; } });
    const u = user();
    await goto(u, 'Imprimer');
    await u.click(screen.getByRole('button', { name: 'Copier cette déco sur tous les mois' }));
    expect(srv.data.stickers['2026-11']).toBeUndefined();
    await u.click(screen.getByRole('button', { name: 'Confirmer : remplace la déco des autres mois' }));
    await saved(sync);
    expect(Object.keys(srv.data.stickers)).toHaveLength(7);
    await u.click(screen.getByRole('button', { name: 'Même déco pour tous les mois' }));
    await saved(sync);
    expect(srv.data.prefs.sync).toBe(true);
    expect(srv.data.stickers['*']).toHaveLength(1);
    await u.click(screen.getByRole('button', { name: 'Ce mois seulement' }));
    await saved(sync);
    expect(srv.data.prefs.sync).toBe(false);
  });
});

describe('background decoration', () => {
  it('add a sticker behind the app, resize, recolour, delete, and clear all (two clicks)', async () => {
    const srv = new FakeServer();
    const { sync } = await mountApp({ server: srv });
    const u = user();
    await u.click(screen.getByRole('button', { name: /Décorer/ }));
    await u.click(screen.getByRole('button', { name: /Ajouter un sticker/ }));
    await u.click(screen.getByRole('button', { name: /Ajouter : Ours/ }));
    await saved(sync);
    expect(srv.data.bg).toHaveLength(1);
    expect(document.body.classList.contains('decorating')).toBe(true);
    await u.click(screen.getByRole('button', { name: 'Plus grand' }));
    await u.click(within(screen.getByRole('toolbar')).getByRole('button', { name: 'Couleur' }));
    await saved(sync);
    expect(srv.data.bg[0].s).toBe(10);
    await u.click(screen.getByRole('button', { name: 'Supprimer' }));
    await saved(sync);
    expect(srv.data.bg).toHaveLength(0);
    await u.click(screen.getByRole('button', { name: /Ajouter un sticker/ }));
    await u.click(screen.getByRole('button', { name: /Ajouter : Chat/ }));
    await u.click(screen.getByRole('button', { name: 'Tout retirer' }));
    expect(srv.data.bg).toHaveLength(1);                                   // armed only
    await u.click(screen.getByRole('button', { name: 'Confirmer : tout retirer' }));
    await saved(sync);
    expect(srv.data.bg).toHaveLength(0);
    await u.click(screen.getByRole('button', { name: /Terminé/ }));
    expect(document.body.classList.contains('decorating')).toBe(false);
  });
});

describe('date simulator', () => {
  it('shows a banner for the simulated date and goes back to today', async () => {
    await mountApp();
    const u = user();
    await u.click(screen.getByText('Tester avec une autre date'));
    await u.type(screen.getByLabelText('Date simulée'), '2026-12-10');
    expect(screen.getByText(/Date simulée :/)).toBeInTheDocument();
    expect(screen.getByText(/En retard :/)).toBeInTheDocument();             // assignments 1 and 2 are past
    await u.click(screen.getByRole('button', { name: "Revenir à aujourd'hui" }));
    expect(screen.queryByText(/Date simulée :/)).toBeNull();
  });
});
