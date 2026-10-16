import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { makeFmt } from '../lib/dates';
import { buildLibrary, type LibEntry } from '../lib/library';
import { HDR } from '../lib/sync';
import { useApp } from '../state/app';

interface LibStatus { ok?: boolean; enabled: boolean; dir?: string; notes?: number; files?: number; at?: number; error?: string }

const FR = (s: string): string => s;
const FRF = (s: string, v?: Record<string, string | number>): string => Object.entries(v || {}).reduce((x, [k, val]) => x.split('{' + k + '}').join(String(val)), s);
const FR_FMT = makeFmt('fr');

/** The folders of the readable copy, as they are now. */
function useEntries(): LibEntry[] {
  const { model, data, evs } = useApp();
  // the folders are always named in French, whatever the language of the screen: changing the language must not move anything
  return useMemo(() => buildLibrary(model, data, evs, FR, FRF, FR_FMT), [model, data, evs]);
}

async function send(api: (p: string, i?: RequestInit) => Promise<Response>, entries: LibEntry[]): Promise<LibStatus | null> {
  try {
    const r = await api('api/library', { method: 'PUT', headers: HDR, body: JSON.stringify({ entries }) });
    return (await r.json()) as LibStatus;
  } catch { return null; }
}

/** Keeps the readable copy of the notes and attachments up to date on the server (a few seconds after each change). */
export function LibraryWatcher(): ReactNode {
  const { data, sync } = useApp();
  const entries = useEntries();
  const on = data.prefs.library !== false;
  const sent = useRef<string | null>(null);
  const [again, setAgain] = useState(0);
  const key = JSON.stringify(entries);
  useEffect(() => {
    if (!on || key === sent.current) return;
    if (sent.current === null && !entries.length) { sent.current = key; return; }   // nothing to copy yet: leave the folder alone
    let retry: ReturnType<typeof setTimeout> | undefined;
    let live = true;
    const id = setTimeout(() => {
      void send((p, i) => sync.api(p, i), entries).then((s) => {
        if (!live) return;
        if (s && s.ok !== false) sent.current = key;                       // done (or this server has no library: nothing to do)
        else retry = setTimeout(() => setAgain((n) => n + 1), 60_000);     // server unreachable or folder not writable: try again later
      });
    }, 2500);
    return () => { live = false; clearTimeout(id); if (retry) clearTimeout(retry); };
  }, [on, key, entries, sync, again]);
  return null;
}

export function LibraryDialog(): ReactNode {
  const { ui, setUi, data, update, sync, t, tf, fmt } = useApp();
  const entries = useEntries();
  const [st, setSt] = useState<LibStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const on = data.prefs.library !== false;
  const load = useCallback(async () => {
    try { setSt((await (await sync.api('api/library')).json()) as LibStatus); } catch { setSt({ enabled: false }); }
  }, [sync]);
  useEffect(() => { if (ui.libraryOpen) void load(); }, [ui.libraryOpen, load]);
  useEffect(() => {
    if (!ui.libraryOpen) return;
    const onKey = (e: KeyboardEvent): void => { if (e.key === 'Escape') setUi({ libraryOpen: false }); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [ui.libraryOpen, setUi]);
  if (!ui.libraryOpen) return null;
  const now = async (): Promise<void> => { setBusy(true); const s = await send((p, i) => sync.api(p, i), entries); setBusy(false); setSt(s || { enabled: false, error: t('Serveur injoignable.') }); };
  const when = st?.at ? fmt.long.format(new Date(st.at)) + ' ' + new Date(st.at).toTimeString().slice(0, 5) : '';
  return (
    <div className="ov" role="dialog" aria-modal="true" aria-labelledby="lib-t" onClick={(e) => { if (e.target === e.currentTarget) setUi({ libraryOpen: false }); }}>
      <div className="modal wide">
        <div className="mtop acc"><div className="eyebrow">{t('Notes et fichiers')}</div><div className="big sm" id="lib-t">📁 {t('Bibliothèque lisible')}</div></div>
        <div className="mbody">
          <p>{t('Tes notes (en texte simple) et tes fichiers sont aussi copiés dans un dossier normal, lisible sans le planner : un dossier par matière, un sous-dossier par cours, avec notes.txt et les fichiers joints.')}</p>
          <button type="button" role="switch" aria-checked={on} className="sw" onClick={() => update((d) => { d.prefs.library = !on; })}><i aria-hidden="true" />{t('Copie lisible activée')}</button>
          {st && st.enabled === false && <p className="warn" role="alert">{t('Cette version du serveur n’a pas de bibliothèque.')}</p>}
          {st && st.enabled && (
            <dl className="lib-info">
              <dt>{t('Dossier sur le serveur')}</dt><dd><code>{st.dir}</code></dd>
              <dt>{t('Contenu')}</dt><dd>{tf('{n} notes, {f} fichiers', { n: st.notes || 0, f: st.files || 0 })}{when ? ' · ' + tf('copié le {d}', { d: when }) : ''}</dd>
            </dl>
          )}
          {st?.error && <p className="warn" role="alert">{st.error}</p>}
          <pre className="lib-tree" aria-label={t('Exemple de dossiers')}>{'Maths/\n  2026-10-05 Live du soir/\n    notes.txt\n    cours.pdf'}</pre>
          <p className="hint">{t('Pour choisir où ranger ce dossier : dans le docker-compose, monte un dossier de ton NAS (par exemple /volume1/docker/planner/notes:/library) et ajoute LIBRARY_DIR=/library. Le planner reste la référence : cette copie est réécrite par lui, et ce que tu supprimes est rangé dans « _Supprimé », jamais effacé.')}</p>
          <div className="opt">
            <button type="button" className="btn ghost" onClick={() => setUi({ libraryOpen: false })}>{t('Fermer')}</button>
            <span className="spacer" />
            <button type="button" className="btn" disabled={busy || !on || st?.enabled === false} onClick={() => void now()}>{t('Copier maintenant')}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
