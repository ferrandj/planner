import { screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { FakeServer } from './test/fakeServer';
import { mountApp, saved } from './test/render';

beforeEach(() => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date(2026, 9, 11, 12, 0, 0)); });
afterEach(() => { vi.useRealTimers(); });
const user = (): ReturnType<typeof userEvent.setup> => userEvent.setup({ advanceTimers: () => {} });
const LIVE = 'm1-live-2026-10-05';
const WAIT = { timeout: 6000 };

describe('readable library of the notes', () => {
  it('a note written in the app is copied to the server, in the subject / class folder, as plain text', async () => {
    const srv = new FakeServer();
    const { sync } = await mountApp({ server: srv });
    const u = user();
    await u.click(screen.getAllByRole('button', { name: /Notes et pièces jointes : .*Live du soir/ })[0]);
    await u.type(screen.getByLabelText('Ajouter une note'), 'remember the formula');
    await u.click(screen.getByRole('button', { name: 'Ajouter le texte' }));
    await saved(sync);
    await waitFor(() => expect(srv.library!.puts).toBe(1), WAIT);
    const [e] = srv.library!.entries;
    expect(e.dir[0]).toBe('Maths');
    expect(e.dir[1]).toMatch(/^2026-10-0[5-9]|^2026-10-1/);
    expect(e.text).toContain('remember the formula');
  });

  it('nothing is sent when there is no note, and when it is switched off', async () => {
    const srv = new FakeServer();
    const { sync } = await mountApp({ server: srv, seed: (d) => { d.prefs.library = false; d.notes[LIVE] = [{ id: 'n1', k: 'text', v: 'x' }]; } });
    await saved(sync);
    await new Promise((r) => setTimeout(r, 3200));
    expect(srv.library!.puts).toBe(0);
    const srv2 = new FakeServer();
    await mountApp({ server: srv2 });
    await new Promise((r) => setTimeout(r, 3200));
    expect(srv2.library!.puts).toBe(0);
  }, 15000);

  it('existing notes are copied when the app opens', async () => {
    const srv = new FakeServer();
    await mountApp({ server: srv, seed: (d) => { d.notes[LIVE] = [{ id: 'n1', k: 'text', v: 'old note' }]; } });
    await waitFor(() => expect(srv.library!.puts).toBe(1), WAIT);
    expect(srv.library!.entries[0].text).toContain('old note');
  });

  it('the 📁 window says where the copy is, how much it holds, can be switched off and can copy now', async () => {
    const srv = new FakeServer();
    const { sync } = await mountApp({ server: srv, seed: (d) => { d.prefs.library = false; d.notes[LIVE] = [{ id: 'n1', k: 'text', v: 'a' }, { id: 'n2', k: 'file', n: 'cours.pdf', z: 3, f: 'a'.repeat(64) }]; } });
    const u = user();
    await u.click(screen.getByRole('button', { name: /Bibliothèque/ }));
    const dlg = await screen.findByRole('dialog');
    expect(await within(dlg).findByText('/data/library')).toBeInTheDocument();
    expect(within(dlg).getByRole('switch', { name: /Copie lisible activée/ })).toHaveAttribute('aria-checked', 'false');
    expect(within(dlg).getByRole('button', { name: 'Copier maintenant' })).toBeDisabled();
    await u.click(within(dlg).getByRole('switch', { name: /Copie lisible activée/ }));
    await u.click(within(dlg).getByRole('button', { name: 'Copier maintenant' }));
    await waitFor(() => expect(within(dlg).getByText(/1 notes, 1 fichiers/)).toBeInTheDocument());
    await saved(sync);
    expect(srv.data.prefs.library).toBe(true);
    expect(srv.library!.entries[0].files).toEqual([{ id: 'a'.repeat(64), name: 'cours.pdf' }]);
    expect(within(dlg).getByText(/LIBRARY_DIR=\/library/)).toBeInTheDocument();             // how to choose the folder
    await u.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('a server without the library is told so, calmly', async () => {
    const srv = new FakeServer();
    srv.library = null;
    await mountApp({ server: srv, seed: (d) => { d.notes[LIVE] = [{ id: 'n1', k: 'text', v: 'a' }]; } });
    const u = user();
    await u.click(screen.getByRole('button', { name: /Bibliothèque/ }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/pas de bibliothèque/);
  });
});
