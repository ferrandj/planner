import { screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { FakeServer } from './test/fakeServer';
import { mountApp, saved } from './test/render';

// A fixed "today" so that dates in the fixtures (2026-10-05 .. 2027-04-30) behave predictably.
beforeEach(() => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date(2026, 9, 11, 12, 0, 0)); });
afterEach(() => { vi.useRealTimers(); });
const user = (): ReturnType<typeof userEvent.setup> => userEvent.setup({ advanceTimers: () => {} });
const tab = (name: RegExp | string): HTMLElement => screen.getByRole('tab', { name });

describe('first screen', () => {
  it('shows the countdown to the next assignment, the summary and the tabs', async () => {
    await mountApp();
    expect(screen.getAllByText('Assignment 1').length).toBeGreaterThan(0);
    expect(screen.getAllByText('22').length).toBeGreaterThan(0);                  // days until 2026-11-02
    expect(screen.getByText('0 / 4')).toBeInTheDocument();                        // nothing handed in yet
    for (const n of ['Planning', 'Devoirs', 'Imprimer']) expect(tab(n)).toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: /Édition/ })).toBeNull();            // edit mode lives next to the flags
    expect(screen.getByRole('button', { name: /Édition/ })).toBeInTheDocument();
  });
  it('uses the saved title and subtitle', async () => {
    await mountApp({ seed: (d) => { d.edits.app = { title: 'My planner', eyebrow: 'Spring term' }; } });
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('My planner');
    expect(screen.getByText('Spring term')).toBeInTheDocument();
    expect(document.title).toBe('My planner');
  });
  it('reads the language and mode from the saved preferences', async () => {
    await mountApp({ seed: (d) => { d.prefs.lang = 'en'; d.prefs.mode = 'dark'; } });
    expect(screen.getByRole('tab', { name: 'Schedule' })).toBeInTheDocument();
    expect(document.documentElement.getAttribute('data-scheme')).toBe('dark');
    expect(document.documentElement.getAttribute('lang')).toBe('en');
  });
});

describe('ticking things off is saved', () => {
  it('a session checkbox goes to the server and survives a reload of the app', async () => {
    const srv = new FakeServer();
    const { sync, utils } = await mountApp({ server: srv });
    const u = user();
    const box = screen.getAllByRole('checkbox')[0];
    expect(box).not.toBeChecked();
    await u.click(box);
    await saved(sync);
    const id = Object.keys(srv.data.done)[0];
    expect(id).toBeTruthy();
    utils.unmount(); sync.stop();
    await mountApp({ server: srv });                                  // "reload"
    await u.click(screen.getByRole('button', { name: 'Tout' }));
    const row = screen.getAllByRole('checkbox').find((c) => (c as HTMLInputElement).checked);
    expect(row).toBeTruthy();
  });
  it('un-ticking removes it again', async () => {
    const srv = new FakeServer();
    const { sync } = await mountApp({ server: srv, seed: (d) => { d.done['m1-live-2026-10-12'] = true; } });
    const u = user();
    await u.click(screen.getByRole('button', { name: 'Tout' }));
    const checked = screen.getAllByRole('checkbox').find((c) => (c as HTMLInputElement).checked)!;
    await u.click(checked);
    await saved(sync);
    expect(srv.data.done['m1-live-2026-10-12']).toBeUndefined();
  });
  it('hand-in toggles of an assignment (Devoirs tab) are saved and update the summary', async () => {
    const srv = new FakeServer();
    const { sync } = await mountApp({ server: srv });
    const u = user();
    await u.click(tab('Devoirs'));
    const card = screen.getAllByRole('article')[0];
    await u.click(within(card).getByRole('button', { name: /Maths · à rendre/ }));
    await saved(sync);
    expect(srv.data.rendu['d1:m1']).toBe(true);
    expect(screen.getByText('1 / 4')).toBeInTheDocument();
    await u.click(within(card).getByRole('button', { name: /Maths · rendu/ }));
    await saved(sync);
    expect(srv.data.rendu['d1:m1']).toBeUndefined();
  });
});

describe('planning', () => {
  it('"À faire" hides what is done, "Tout" shows everything', async () => {
    await mountApp({ seed: (d) => { d.done['m1-live-2026-10-12'] = true; } });
    const u = user();
    const count = (): number => screen.getAllByRole('checkbox').length;
    const todo = count();
    await u.click(screen.getByRole('button', { name: 'Tout' }));
    expect(count()).toBe(todo + 1);
    await u.click(screen.getByRole('button', { name: 'À faire' }));
    expect(count()).toBe(todo);
  });
  it('overdue sessions are grouped under "À rattraper"', async () => {
    await mountApp();
    expect(screen.getByRole('heading', { name: /À rattraper/ })).toBeInTheDocument();
  });
  it('the subject filter narrows the list', async () => {
    await mountApp();
    const u = user();
    const before = screen.getAllByRole('checkbox').length;
    await u.click(screen.getAllByRole('button', { name: 'Physics' })[0]);
    expect(screen.getAllByRole('checkbox').length).toBeLessThan(before);
    await u.click(screen.getByRole('button', { name: 'Toutes les matières' }));
    expect(screen.getAllByRole('checkbox').length).toBe(before);
  });
  it('adds a custom session, saves it, and can delete it', async () => {
    const srv = new FakeServer();
    const { sync } = await mountApp({ server: srv });
    const u = user();
    await u.click(screen.getByRole('button', { name: '+ Ajouter une séance' }));
    await u.type(screen.getByLabelText('Titre'), 'Read chapter 3');
    await u.click(screen.getByRole('button', { name: 'Ajouter au planning' }));
    await saved(sync);
    expect(srv.data.custom).toHaveLength(1);
    expect(srv.data.custom[0]).toMatchObject({ title: 'Read chapter 3', date: '2026-10-11' });
    expect(screen.getAllByText('Read chapter 3').length).toBeGreaterThan(0);
    await u.click(screen.getByRole('button', { name: 'Supprimer' }));
    await saved(sync);
    expect(srv.data.custom).toHaveLength(0);
  });
  it('does not add a session without a title', async () => {
    const srv = new FakeServer();
    await mountApp({ server: srv });
    const u = user();
    await u.click(screen.getByRole('button', { name: '+ Ajouter une séance' }));
    await u.click(screen.getByRole('button', { name: 'Ajouter au planning' }));
    expect(srv.data.custom).toHaveLength(0);
  });
  it('month view: selecting a day lists its sessions', async () => {
    await mountApp();
    const u = user();
    await u.click(screen.getByRole('button', { name: 'Mois' }));
    await u.click(screen.getByRole('button', { name: /12 octobre 2026, 1 élément/ }));
    expect(screen.getAllByText(/Live du soir/).length).toBeGreaterThan(0);
    await u.click(screen.getByRole('button', { name: 'Mois suivant' }));
    expect(screen.getAllByRole('heading', { name: /novembre 2026/i }).length).toBeGreaterThan(0);
  });
});

describe('notes and attachments', () => {
  it('adds a text note (saved), a link, rejects a bad link, deletes a note', async () => {
    const srv = new FakeServer();
    const { sync } = await mountApp({ server: srv });
    const u = user();
    await u.click(screen.getAllByRole('button', { name: /Notes et pièces jointes/ })[0]);
    await u.type(screen.getByLabelText('Ajouter une note'), 'remember the formula');
    await u.click(screen.getByRole('button', { name: 'Ajouter le texte' }));
    await u.type(screen.getByLabelText('Ajouter un lien'), 'example.org/doc');
    await u.click(screen.getByRole('button', { name: 'Ajouter le lien' }));
    await u.type(screen.getByLabelText('Ajouter un lien'), 'javascript:alert(1)');
    await u.click(screen.getByRole('button', { name: 'Ajouter le lien' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Lien invalide');
    await saved(sync);
    const notes = Object.values(srv.data.notes)[0];
    expect(notes.map((n) => n.k)).toEqual(['text', 'link']);
    expect(notes[1].u).toBe('https://example.org/doc');
    expect(screen.getByRole('link', { name: /example.org\/doc/ })).toHaveAttribute('rel', 'noopener noreferrer');
    await u.click(screen.getAllByRole('button', { name: 'Supprimer' })[0]);
    await saved(sync);
    expect(Object.values(srv.data.notes)[0]).toHaveLength(1);
  });
  it('editing a note saves while typing', async () => {
    const srv = new FakeServer();
    const { sync } = await mountApp({ server: srv, seed: (d) => { d.notes['dev:d1'] = [{ id: 'n1', k: 'text', v: 'old' }]; } });
    const u = user();
    await u.click(tab('Devoirs'));
    await u.click(screen.getAllByRole('button', { name: /Notes et pièces jointes/ })[0]);
    const ta = screen.getByLabelText('Note');
    await u.clear(ta); await u.type(ta, 'new text');
    await saved(sync);
    expect(srv.data.notes['dev:d1'][0].v).toBe('new text');
  });
  it('closing the dialog keeps an unsent draft as a note', async () => {
    const srv = new FakeServer();
    const { sync } = await mountApp({ server: srv });
    const u = user();
    await u.click(screen.getAllByRole('button', { name: /Notes et pièces jointes/ })[0]);
    await u.type(screen.getByLabelText('Ajouter une note'), 'half-finished thought');
    await u.click(screen.getByRole('button', { name: 'Fermer' }));
    await saved(sync);
    expect(Object.values(srv.data.notes)[0][0].v).toBe('half-finished thought');
    expect(screen.queryByRole('dialog')).toBeNull();
  });
  it('Escape closes the dialog and also keeps the draft', async () => {
    const srv = new FakeServer();
    const { sync } = await mountApp({ server: srv });
    const u = user();
    await u.click(screen.getAllByRole('button', { name: /Notes et pièces jointes/ })[0]);
    await u.type(screen.getByLabelText('Ajouter une note'), 'via escape');
    await u.keyboard('{Escape}');
    await saved(sync);
    expect(Object.values(srv.data.notes)[0][0].v).toBe('via escape');
  });
  it('uploads a file to the server and stores only a reference', async () => {
    const srv = new FakeServer();
    const { sync } = await mountApp({ server: srv });
    const u = user();
    await u.click(screen.getAllByRole('button', { name: /Notes et pièces jointes/ })[0]);
    await u.upload(screen.getByLabelText('Ajouter des images ou des fichiers'), new File(['pdf-bytes'], 'course.pdf', { type: 'application/pdf' }));
    await waitFor(() => expect(srv.files.size).toBe(1));
    await saved(sync);
    const n = Object.values(srv.data.notes)[0][0];
    expect(n).toMatchObject({ k: 'file', n: 'course.pdf', z: 9 });
    expect(n.f).toMatch(/^[0-9a-f]{64}$/);
    expect(n.d).toBeUndefined();
    expect(screen.getByRole('link', { name: /course\.pdf/ })).toHaveAttribute('href', 'api/files/' + n.f + '?name=course.pdf');
  });
  it('when the server is down, the file is kept inside the data and uploaded later', async () => {
    const srv = new FakeServer();
    const { sync } = await mountApp({ server: srv });
    const u = user();
    await u.click(screen.getAllByRole('button', { name: /Notes et pièces jointes/ })[0]);
    srv.down = true;
    await u.upload(screen.getByLabelText('Ajouter des images ou des fichiers'), new File(['abc'], 'a.txt', { type: 'text/plain' }));
    await waitFor(() => expect(JSON.parse(localStorage.getItem('planner-cache-v1')!).data.notes).not.toEqual({}));
    const cached = Object.values(JSON.parse(localStorage.getItem('planner-cache-v1')!).data.notes as Record<string, Array<{ d?: string }>>)[0][0];
    expect(cached.d).toMatch(/^data:text\/plain/);
    srv.down = false;
    await vi.waitFor(() => { expect(sync.status).toBe('saved'); expect(srv.files.size).toBe(1); }, { timeout: 8000 });
    await vi.waitFor(() => { const n = Object.values(srv.data.notes)[0]?.[0]; expect(n?.f).toBeTruthy(); expect(n?.d).toBeUndefined(); }, { timeout: 8000 });
  }, 15000);
  it('a legacy inline attachment is moved to the server automatically', async () => {
    const srv = new FakeServer();
    await mountApp({ server: srv, seed: (d) => { d.notes['dev:d1'] = [{ id: 'n1', k: 'file', n: 'old.txt', z: 5, d: 'data:text/plain;base64,aGVsbG8=' }]; } });
    await vi.waitFor(() => { const n = srv.data.notes['dev:d1'][0]; expect(n.f).toBeTruthy(); expect(n.d).toBeUndefined(); }, { timeout: 4000 });
    expect(srv.files.size).toBe(1);
  });
});

describe('alert for assignments due within 7 days', () => {
  it('appears on load, lets you hand in from it, and closes', async () => {
    const srv = new FakeServer();
    const { sync } = await mountApp({ server: srv });
    vi.setSystemTime(new Date(2026, 9, 28, 12));   // 5 days before Assignment 1 -> use the date simulator instead (the mount already happened)
    const u = user();
    await u.click(screen.getByText('Tester avec une autre date'));
    await u.type(screen.getByLabelText('Date simulée'), '2026-10-30');
    const dlg = await screen.findByRole('alertdialog');
    expect(within(dlg).getByText('Dans 3 jours')).toBeInTheDocument();
    await u.click(within(dlg).getByRole('button', { name: /Maths · à rendre/ }));
    await saved(sync);
    expect(srv.data.rendu['d1:m1']).toBe(true);
    await u.click(within(dlg).getByRole('button', { name: /Compris/ }));
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });
  it('is not shown when nothing is due soon', async () => {
    await mountApp();
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });
});

describe('look and language', () => {
  it('switching language translates the interface and is saved', async () => {
    const srv = new FakeServer();
    const { sync } = await mountApp({ server: srv });
    const u = user();
    await u.click(screen.getByRole('button', { name: 'English' }));
    expect(screen.getByRole('tab', { name: 'Schedule' })).toBeInTheDocument();
    await saved(sync);
    expect(srv.data.prefs.lang).toBe('en');
  });
  it('dark / light / auto mode is saved and applied', async () => {
    const srv = new FakeServer();
    const { sync } = await mountApp({ server: srv });
    const u = user();
    await u.click(screen.getByRole('button', { name: 'Sombre' }));
    expect(document.documentElement.getAttribute('data-scheme')).toBe('dark');
    await u.click(screen.getByRole('button', { name: 'Clair' }));
    expect(document.documentElement.getAttribute('data-scheme')).toBe('light');
    await saved(sync);
    expect(srv.data.prefs.mode).toBe('light');
  });
  it('the custom colour picker changes the accent and saves it', async () => {
    const srv = new FakeServer();
    const { sync } = await mountApp({ server: srv });
    const u = user();
    await u.click(screen.getByRole('button', { name: 'Couleur' }));
    const hex = screen.getByLabelText('Code couleur');
    await u.clear(hex); await u.type(hex, '#336699{Enter}');
    await saved(sync);
    expect(srv.data.prefs.custom).toBe('#336699');
    expect(document.documentElement.style.getPropertyValue('--accent')).toBeTruthy();
  });
  it('rejects an invalid colour code and shows the old one again', async () => {
    const srv = new FakeServer();
    await mountApp({ server: srv, seed: (d) => { d.prefs.custom = '#336699'; } });
    const u = user();
    await u.click(screen.getByRole('button', { name: 'Couleur' }));
    const hex = screen.getByLabelText('Code couleur') as HTMLInputElement;
    await u.clear(hex); await u.type(hex, 'zzz{Enter}');
    expect(hex.value).toBe('#336699'.toUpperCase());
  });
  it('saves and re-uses favourite colours', async () => {
    const srv = new FakeServer();
    const { sync } = await mountApp({ server: srv, seed: (d) => { d.prefs.custom = '#336699'; } });
    const u = user();
    await u.click(screen.getByRole('button', { name: 'Couleur' }));
    await u.click(screen.getByRole('button', { name: /Enregistrer cette couleur/ }));
    await saved(sync);
    expect(srv.data.favs).toEqual(['#336699']);
    await u.click(screen.getByRole('button', { name: /Retirer cette couleur/ }));
    await saved(sync);
    expect(srv.data.favs).toEqual([]);
  });
});

describe('sync status', () => {
  it('shows saved, then offline with a clear message when the server is unreachable', async () => {
    const srv = new FakeServer();
    const { sync } = await mountApp({ server: srv });
    expect(screen.getByText('✓ Enregistré')).toBeInTheDocument();
    srv.down = true;
    await user().click(screen.getAllByRole('checkbox')[0]);
    await screen.findByText(/Hors ligne/);
    expect(JSON.parse(localStorage.getItem('planner-cache-v1')!).dirty).toBe(true);
    srv.down = false;
    await vi.waitFor(() => expect(sync.status).toBe('saved'), { timeout: 8000 });
    expect(Object.keys(srv.data.done)).toHaveLength(1);
  }, 15000);
});
