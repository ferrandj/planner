import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { Note } from '../types';
import { diff, parse, rel } from '../lib/dates';
import { fmtSize, noteSrc, uploadBlob, blobToDataUrl } from '../lib/files';
import { cleanLink, prepFile } from '../lib/images';
import { dueSoon } from '../lib/model';
import { useApp } from '../state/app';
import { Toggles } from './common';
import { PrintHelp, StickerPicker } from './StickerPicker';

const nid = (): string => 'n' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);

function NotesModal(): ReactNode {
  const { ui, setUi, data, update, sync, t } = useApp();
  const nf = ui.noteFor!;
  const list = data.notes[nf.key] || [];
  const [text, setText] = useState(''), [url, setUrl] = useState(''), [label, setLabel] = useState('');
  const textRef = useRef(text);
  textRef.current = text;
  const addNote = (item: Note): void => update((d) => { (d.notes[nf.key] = d.notes[nf.key] || []).push(item); });
  const close = (): void => {
    if (textRef.current.trim()) addNote({ id: nid(), k: 'text', v: textRef.current.trim() }); // an unsent draft is never lost
    setUi({ noteFor: null, noteMsg: '' });
  };
  useEffect(() => {
    const on = (e: KeyboardEvent): void => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', on);
    return () => document.removeEventListener('keydown', on);
  });
  const addFiles = async (files: FileList): Promise<void> => {
    for (const f of Array.from(files)) {
      const p = await prepFile(f);
      if (!p) continue;
      if ('tooBig' in p) { setUi({ noteMsg: t('Fichier trop gros (max 25 Mo) : ') + p.tooBig }); continue; }
      try {
        const j = await uploadBlob(p.blob, p.type, (u, i) => sync.api(u, i));
        addNote({ id: nid(), k: p.kind, n: p.name, z: p.blob.size, f: j.id });
      } catch { // server unreachable: keep the file inside the data, it is uploaded later
        try { addNote({ id: nid(), k: p.kind, n: p.name, z: p.blob.size, d: await blobToDataUrl(p.blob) }); } catch { /* unreadable */ }
      }
    }
  };
  const remove = (id: string): void => update((d) => { d.notes[nf.key] = (d.notes[nf.key] || []).filter((n) => n.id !== id); if (!d.notes[nf.key].length) delete d.notes[nf.key]; });
  return (
    <div className="ov" role="dialog" aria-modal="true" aria-labelledby="nt-t">
      <div className="modal wide">
        <div className="mtop acc"><div className="eyebrow" id="nt-t">{t('Notes et pièces jointes')}</div><div className="big sm">{nf.title}</div></div>
        <div className="mbody">
          {ui.noteMsg && <p className="warn" role="alert">{ui.noteMsg}</p>}
          {list.length ? (
            <div className="nlist">
              {list.map((n) => (
                <div key={n.id} className="nitem">
                  {n.k === 'text' ? <textarea rows={3} aria-label={t('Note')} value={n.v || ''} onChange={(e) => update((d) => { const x = (d.notes[nf.key] || []).find((m) => m.id === n.id); if (x) x.v = e.target.value; })} />
                    : n.k === 'link' ? <a href={n.u} target="_blank" rel="noopener noreferrer">🔗 {n.l || n.u}</a>
                    : n.k === 'img' ? <img src={noteSrc(n)} alt={n.n || ''} loading="lazy" />
                    : <a className="fl" href={noteSrc(n, true)} download={n.n || 'file'}>📄 {n.n} <small>({fmtSize(n.z || 0)})</small></a>}
                  <button type="button" className="lnk" onClick={() => remove(n.id)}>{t('Supprimer')}</button>
                </div>
              ))}
            </div>
          ) : <p className="hint">{t('Aucune note pour le moment.')}</p>}
          <div className="nadd">
            <label htmlFor="nt-text">{t('Ajouter une note')}</label>
            <textarea id="nt-text" rows={3} placeholder={t('Écris une note…')} value={text} onChange={(e) => setText(e.target.value)} />
            <button type="button" className="btn ghost" onClick={() => { if (text.trim()) { addNote({ id: nid(), k: 'text', v: text.trim() }); setText(''); } }}>{t('Ajouter le texte')}</button>
          </div>
          <div className="nadd">
            <label htmlFor="nt-url">{t('Ajouter un lien')}</label>
            <input id="nt-url" type="url" inputMode="url" placeholder="https://…" value={url} onChange={(e) => setUrl(e.target.value)} />
            <input id="nt-label" type="text" maxLength={80} placeholder={t('Nom du lien (facultatif)')} value={label} onChange={(e) => setLabel(e.target.value)} />
            <button type="button" className="btn ghost" onClick={() => {
              if (!url.trim()) return;
              const u = cleanLink(url);
              if (!u) { setUi({ noteMsg: t('Lien invalide') }); return; }
              addNote({ id: nid(), k: 'link', u, l: label.trim() }); setUrl(''); setLabel(''); setUi({ noteMsg: '' });
            }}>{t('Ajouter le lien')}</button>
          </div>
          <div className="nadd">
            <label htmlFor="nt-file">{t('Ajouter des images ou des fichiers')}</label>
            <input id="nt-file" type="file" multiple onChange={(e) => { const fl = e.target.files; if (fl && fl.length) void addFiles(fl).then(() => { e.target.value = ''; }); }} />
          </div>
          <button className="btn" id="nt-close" onClick={close}>{t('Fermer')}</button>
        </div>
      </div>
    </div>
  );
}

function AlertModal(): ReactNode {
  const { model, data, today, ui, setUi, t, tf, fmt } = useApp();
  const due = dueSoon(model, data, today);
  const btn = useRef<HTMLButtonElement>(null);
  useEffect(() => { btn.current?.focus({ preventScroll: true }); }, []);
  useEffect(() => {
    const on = (e: KeyboardEvent): void => { if (e.key === 'Escape') setUi({ alertOpen: false }); };
    document.addEventListener('keydown', on);
    return () => document.removeEventListener('keydown', on);
  }, [setUi]);
  if (!ui.alertOpen || !due.length) return null;
  const first = diff(due[0].date, today);
  const big = first === 0 ? t("C'est aujourd'hui") : first === 1 ? t('Demain') : tf('Dans {n} jours', { n: first });
  return (
    <div className="ov" role="alertdialog" aria-modal="true" aria-labelledby="al-t">
      <div className="modal">
        <div className="mtop"><div className="eyebrow" id="al-t">{t('Devoir à rendre')}</div><div className="big">{big}</div></div>
        <div className="mbody">
          {due.map((d) => {
            const n = diff(d.date, today);
            return (
              <div key={d.id} className="mdev">
                <h3>{t(d.title)}</h3>
                <p>{t('À déposer avant le ') + fmt.long.format(parse(d.date))}{n > first ? ' (' + rel(n, t, tf) + ')' : ''}</p>
                <Toggles d={d} big />
              </div>
            );
          })}
          <button ref={btn} className="btn" id="al-close" onClick={() => setUi({ alertOpen: false })}>{t("Compris, je m'en occupe")}</button>
        </div>
      </div>
    </div>
  );
}

/** One dialog at a time, in the same priority as before: notes, stickers, print help, due-soon alert. */
export function Overlays(): ReactNode {
  const { ui, model, data, today } = useApp();
  if (ui.noteFor) return <NotesModal key={ui.noteFor.key} />;
  if (ui.stkPop) return <StickerPicker />;
  if (ui.printHelp) return <PrintHelp />;
  if (ui.alertOpen && dueSoon(model, data, today).length) return <AlertModal />;
  return null;
}
