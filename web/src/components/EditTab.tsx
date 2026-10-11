import { useEffect, type ReactNode } from 'react';
import type { Evt } from '../types';
import { HEX6 } from '../lib/colors';
import { parse } from '../lib/dates';
import { clearColor, resetAllEdits, resetEdit, setEdit } from '../lib/edits';
import { fmtSize } from '../lib/files';
import { K } from '../lib/labels';
import { addDevoir, addExam, addSession, addSubject, removeItem, restoreItem } from '../lib/items';
import { appTitle, removedItems } from '../lib/model';
import { mergeImport } from '../lib/normalize';
import { useApp } from '../state/app';
import { ColorPicker } from './ColorPicker';
import { NoteBtn } from './common';
import { Row } from './Row';
import { EdInput } from './EdInput';

function Head({ id, title, count, def }: { id: string; title: string; count?: string | number; def: boolean }): ReactNode {
  const { ui, setUi } = useApp();
  const open = ui.edOpen[id] ?? def;
  return (
    <button type="button" className="edsec" aria-expanded={open} onClick={() => {
      setUi((u) => ({ edOpen: { ...u.edOpen, [id]: !(u.edOpen[id] ?? def) } }));
      if (id === 'bak' && !open) setUi({ bakMsg: '' });
    }}><span>{title}</span>{count ? <small>{count}</small> : null}<i aria-hidden="true">{open ? '−' : '+'}</i></button>
  );
}
const useOpen = (id: string, def: boolean): boolean => { const { ui } = useApp(); return ui.edOpen[id] ?? def; };

function Preview({ k }: { k: string }): ReactNode {
  const { data, model, evs, t } = useApp();
  const [g, ...rest] = k.split(':'), id = rest.join(':');
  let inner: ReactNode = null;
  if (k === 'app') inner = <div className="pvh">{appTitle(data, t)}</div>;
  else if (g === 's') {
    const sj = model.subjects.find((s) => s.id === id);
    if (sj) inner = <><span className={'chip s' + sj.c}>{sj.code + ' · ' + sj.short}</span> <span className={'cl s' + sj.c}>{sj.ab + ' · ' + K('live', t)}</span> <span className="legend"><span><i className="dot" style={{ ['--c' as string]: `var(--s${sj.c})` }} />{sj.short}</span></span></>;
  } else if (g === 'd') {
    const rows = evs.filter((e) => e.id === 'dev:' + id || e.id === 'av:' + id);
    inner = <ul className="list">{rows.map((e) => <Row key={e.id} e={e} />)}</ul>;
  } else if (g === 'x') inner = <ul className="list">{evs.filter((e) => e.id === id).map((e) => <Row key={e.id} e={e} />)}</ul>;
  else if (g === 'e') {
    const e = model.events.find((x) => x.id === id);
    if (e) inner = <ul className="list"><Row e={{ check: true, ...e } as Evt} /></ul>;
  } else if (g === 'c') inner = <ul className="list">{evs.filter((e) => e.id === id).map((e) => <Row key={e.id} e={e} />)}</ul>;
  return <div className="pvbox"><span className="lbl">{t('Aperçu')}</span><div className="pv" inert>{inner}</div></div>;
}

function Card({ k, title, off, removable, children }: { k: string; title: string; off?: boolean; removable?: boolean; children: ReactNode }): ReactNode {
  const { data, update, t } = useApp();
  const mod = !!(data.edits[k] && Object.keys(data.edits[k]).length);
  return (
    <div className={'edcard' + (off ? ' off' : '') + (mod ? ' modded' : '')}>
      <div className="edtop"><strong>{title}</strong>{mod && <><span className="tag">{t('Modifié')}</span><button type="button" className="lnk" onClick={() => update((d) => resetEdit(d, k))}>{t("Rétablir les valeurs d'origine")}</button></>}{removable && <button type="button" className="lnk" onClick={() => { if (k.startsWith('s:') && !window.confirm(t('Supprimer cette matière ? Ses séances disparaissent aussi du planning, tu pourras la restaurer dans le mode édition.'))) return; update((d) => removeItem(d, k)); }}>{t('Supprimer')}</button>}</div>
      <div className="form">{children}</div>
      <Preview k={k} />
    </div>
  );
}

/** Colour currently shown for a subject (the user's pick, or the theme's default). */
function subjectHex(color: string | undefined, c: number): string {
  if (color && HEX6.test(color)) return color.toLowerCase();
  const v = getComputedStyle(document.documentElement).getPropertyValue('--s' + c).trim();
  return HEX6.test(v) ? v.toLowerCase() : '#888888';
}

function Backups(): ReactNode {
  const { ui, setUi, data, update, sync, adopt, base, t, lang } = useApp();
  const open = useOpen('bak', false);
  const load = (): void => {
    sync.api('api/backups').then((r) => r.json()).then((j: { backups: NonNullable<typeof ui.backups> }) => setUi({ backups: j.backups || [] }), () => setUi({ bakMsg: t('Serveur injoignable.') }));
  };
  useEffect(() => { if (open) load(); }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  const locale = ({ fr: 'fr-FR', en: 'en-GB', es: 'es-ES' } as const)[lang];
  const tag = (g: string): string => ({ shrink: 'avant une forte réduction', 'pre-restore': 'avant une restauration', 'pre-migration': 'avant migration' } as Record<string, string>)[g] || '';
  const importText = (txt: string): void => {
    let obj: { data?: unknown; base?: { s?: unknown; d?: unknown; x?: unknown; e?: unknown } } | null;
    try { obj = JSON.parse(txt); } catch { obj = null; }
    const asObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
    const nd = obj && asObj(obj.data) ? obj.data : obj;
    const b = obj?.base;
    const nb = b && [b.s, b.d, b.x, b.e].every(Array.isArray) ? (b as unknown as typeof base) : null;
    if (!asObj(nd)) { setUi({ bakMsg: t('Fichier invalide.') }); return; }
    if (!window.confirm(t("Importer ce fichier ? Il est fusionné avec tes données actuelles : rien n'est supprimé, et une sauvegarde est faite automatiquement."))) return;
    const merged = mergeImport(data, nd);
    if (nb) {
      sync.pushBase(nb, merged).then(() => { adopt(merged, nb); setUi({ bakMsg: t('Import terminé.') }); load(); }, () => setUi({ bakMsg: t("L'import a échoué (données modifiées ailleurs ?). Réessaie.") }));
    } else {
      update((d) => { Object.keys(d).forEach((x) => delete (d as unknown as Record<string, unknown>)[x]); Object.assign(d, merged); });
      setUi({ bakMsg: t('Import terminé.') });
    }
  };
  const restore = (name: string): void => {
    if (!window.confirm(t('Restaurer cette sauvegarde ? Tes données actuelles sont sauvegardées avant, tu pourras y revenir.'))) return;
    sync.api('api/backups/restore', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Planner-Client': '1' }, body: JSON.stringify({ name }) })
      .then((r) => { if (!r.ok) throw new Error(); return sync.reloadFromServer(); })
      .then(() => { setUi({ bakMsg: t('Sauvegarde restaurée.') }); load(); }, () => setUi({ bakMsg: t('Restauration impossible.') }));
  };
  const L = ui.backups || [];
  return (
    <>
      <Head id="bak" title={t('Sauvegardes et export')} def={false} />
      {open && (
        <div className="edbody"><div className="edcard"><div className="form">
          <p className="hint wide">{t("Chaque modification est enregistrée sur le serveur, avec des sauvegardes automatiques régulières. Rien n'est supprimé sans retour possible.")}</p>
          <div className="wide opt">
            <a className="btn ghost" href="api/export" download>{t('Exporter (JSON)')}</a>
            <label className="btn ghost" htmlFor="imp-file">{t('Importer un fichier…')}</label>
            <input id="imp-file" type="file" accept="application/json,.json" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) { const r = new FileReader(); r.onload = () => importText(String(r.result)); r.readAsText(f); } e.target.value = ''; }} />
          </div>
          {ui.bakMsg && <p className="warn wide" role="status">{ui.bakMsg}</p>}
          <div className="wide">
            {L.length ? (
              <ul className="list">{L.slice(0, 40).map((b) => (
                <li key={b.name} className="row" style={{ gridTemplateColumns: 'minmax(0,1fr) auto' }}>
                  <div className="bd"><div className="tt">{new Date(b.time).toLocaleString(locale) + (tag(b.tag) ? ' · ' + t(tag(b.tag)) : '')}</div><div className="mt">{fmtSize(b.size)}</div></div>
                  <button type="button" className="btn ghost" onClick={() => restore(b.name)}>{t('Restaurer')}</button>
                </li>
              ))}</ul>
            ) : <p className="hint">{t('Aucune sauvegarde pour le moment.')}</p>}
          </div>
        </div></div></div>
      )}
    </>
  );
}

export function EditTab(): ReactNode {
  const { data, model, base, ui, setUi, update, t, fmt, today } = useApp();
  const create = (make: (d: typeof data) => string): void => { let key = ''; update((d) => { key = make(d); }); setUi({ editing: key }); };
  const removed = removedItems(base, data);
  const isOpen = (id: string, def: boolean): boolean => ui.edOpen[id] ?? def;
  const dateOf = (d: string): string => fmt.long.format(parse(d));
  return (
    <div className="editor">
      <p className="hint">{t("Mode édition : tu peux changer tous les noms, codes et dates. Les modifications sont enregistrées tout de suite. Pour les dates, touche le champ pour ouvrir le calendrier.")}</p>
      <div className="opt">
        <button type="button" className="btn ghost" data-arm="rs" onClick={() => {
          if (!ui.rsArm) { setUi({ rsArm: true }); return; }
          update((d) => resetAllEdits(d));
          setUi({ rsArm: false });
        }}>{ui.rsArm ? t('Confirmer : efface toutes tes modifications') : t('Tout réinitialiser')}</button>
      </div>

      <Head id="app" title={t("Titre de l'application")} def />
      {isOpen('app', true) && (
        <div className="edbody">
          <div className="form">
            <EdInput k="app" f="title" label="Titre de l'application" type="text" val={data.edits.app?.title || t('Planning')} opt={{ wide: true, max: 60 }} />
            <EdInput k="app" f="eyebrow" label="Sous-titre (facultatif)" type="text" val={data.edits.app?.eyebrow || ''} opt={{ wide: true, max: 60 }} />
          </div>
          <Preview k="app" />
        </div>
      )}

      <Head id="subj" title={t('Matières')} count={model.subjects.length} def />
      {isOpen('subj', true) && (
        <div className="edbody">
          <div className="sectionbar" style={{ gridColumn: '1 / -1' }}><button type="button" className="btn" onClick={() => create((d) => addSubject(d, base))}>{t('+ Ajouter une matière')}</button></div>
          {model.subjects.map((x) => {
            const k = 's:' + x.id;
            return (
              <Card key={x.id} k={k} title={x.code + ' · ' + x.name} removable>
                <EdInput k={k} f="code" label="Code" type="text" val={x.code} opt={{ max: 12 }} />
                <EdInput k={k} f="name" label="Nom complet" type="text" val={x.name} opt={{ wide: true, max: 80 }} />
                <EdInput k={k} f="ab" label="Abréviation" type="text" val={x.ab} opt={{ max: 12 }} />
                <div className="wide colrow">
                  <span className="lbl">{t('Couleur de la matière')}</span>
                  <button type="button" className="colbtn" style={{ background: `var(--s${x.c})` }} aria-expanded={ui.edPick === x.id} aria-label={t('Changer la couleur')} onClick={() => setUi({ edPick: ui.edPick === x.id ? null : x.id })} />
                  {x.color && <button type="button" className="lnk" onClick={() => update((d) => clearColor(d, k))}>{t("Couleur d'origine")}</button>}
                </div>
                {ui.edPick === x.id && <div className="wide"><ColorPicker value={subjectHex(x.color, x.c)} onChange={(hex) => update((d) => { setEdit(d, base, k, 'color', hex); })} /></div>}
                <NoteBtn k={k} title={x.code + ' · ' + x.name} />
              </Card>
            );
          })}
        </div>
      )}

      <Head id="dev" title={t('Devoirs')} count={model.devoirs.length} def />
      {isOpen('dev', true) && (
        <div className="edbody">
          <div className="sectionbar" style={{ gridColumn: '1 / -1' }}><button type="button" className="btn" onClick={() => create((d) => addDevoir(d, base, today))}>{t('+ Ajouter un devoir')}</button></div>
          {model.devoirs.map((x) => {
            const k = 'd:' + x.id;
            return (
              <Card key={x.id} k={k} title={x.title} removable>
                <EdInput k={k} f="title" label="Titre" type="text" val={x.title} opt={{ wide: true, max: 60 }} />
                <EdInput k={k} f="ab" label="Abréviation" type="text" val={x.ab} opt={{ max: 12 }} />
                <EdInput k={k} f="date" label="Date limite de rendu" type="date" val={x.date} />
                <EdInput k={k} f="avail" label="Sujet disponible dès le" type="date" val={x.avail || ''} opt={{ clear: true }} />
              </Card>
            );
          })}
        </div>
      )}

      <Head id="exam" title={t('Examens')} count={model.exams.length} def />
      {isOpen('exam', true) && (
        <div className="edbody">
          <div className="sectionbar" style={{ gridColumn: '1 / -1' }}><button type="button" className="btn" onClick={() => create((d) => addExam(d, today))}>{t("+ Ajouter un examen")}</button></div>
          {model.exams.map((x) => {
            const k = 'x:' + x.id;
            return (
              <Card key={x.id} k={k} title={x.title + ' · ' + dateOf(x.date)} removable>
                <EdInput k={k} f="title" label="Titre" type="text" val={x.title} opt={{ wide: true, max: 60 }} />
                <EdInput k={k} f="date" label="Début" type="date" val={x.date} />
                <EdInput k={k} f="end" label="Fin" type="date" val={x.end || ''} opt={{ clear: true }} />
              </Card>
            );
          })}
        </div>
      )}

      {model.subjects.map((sj) => {
        const L = model.events.filter((e) => e.subject === sj.id).sort((a, b) => (a.date < b.date ? -1 : 1)), id = 'ev-' + sj.id;
        const hid = L.filter((e) => data.hidden[e.id]).length;
        return (
          <div key={sj.id} style={{ display: 'contents' }}>
            <Head id={id} title={t('Séances') + ' · ' + sj.ab} count={L.length + (hid ? ` (${hid} ${t('masquée(s)')})` : '')} def={false} />
            {isOpen(id, false) && (
              <div className="edbody">
                <div className="sectionbar" style={{ gridColumn: '1 / -1' }}><button type="button" className="btn" onClick={() => create((d) => addSession(d, sj.id, 'live', today))}>{t('+ Ajouter une séance')}</button></div>
                {L.map((e) => {
                  const k = 'e:' + e.id, off = !!data.hidden[e.id];
                  return (
                    <Card key={e.id} k={k} off={off} title={K(e.kind, t) + ' · ' + dateOf(e.date) + (off ? ' (' + t('masquée') + ')' : '')}>
                      <EdInput k={k} f="date" label="Date" type="date" val={e.date} />
                      <EdInput k={k} f="kind" label="Type" type="" val={e.kind} opt={{ options: [['live', t('Live du soir')], ['webconf', t('Webconférence')]] }} />
                      <EdInput k={k} f="time" label="Heure" type="text" val={e.time || ''} opt={{ max: 20 }} />
                      <EdInput k={k} f="tag" label="Précision (facultatif)" type="text" val={e.tag || ''} opt={{ max: 60 }} />
                      <button type="button" className="btn ghost" onClick={() => update((d) => { if (d.hidden[e.id]) delete d.hidden[e.id]; else d.hidden[e.id] = true; })}>{off ? t('Rétablir cette séance') : t('Masquer cette séance')}</button>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      <Head id="perso" title={t('Séances perso')} count={data.custom.length} def />
      {isOpen('perso', true) && (
        <div className="edbody">
          {data.custom.length ? data.custom.map((c) => {
            const k = 'c:' + c.id;
            return (
              <Card key={c.id} k={k} title={c.title + ' · ' + dateOf(c.date)}>
                <EdInput k={k} f="title" label="Titre" type="text" val={c.title} opt={{ wide: true, max: 80 }} />
                <EdInput k={k} f="subject" label="Matière" type="" val={c.subject || ''} opt={{ options: [['', t('Aucune')] as [string, string]].concat(model.subjects.map((x): [string, string] => [x.id, x.name])) }} />
                <EdInput k={k} f="date" label="Date" type="date" val={c.date} />
                <EdInput k={k} f="time" label="Début (facultatif)" type="time" val={c.time || ''} />
                <EdInput k={k} f="tend" label="Fin (facultatif)" type="time" val={c.tend || ''} />
                <button type="button" className="btn ghost" onClick={() => update((d) => { d.custom = d.custom.filter((x) => x.id !== c.id); delete d.done[c.id]; })}>{t('Supprimer')}</button>
              </Card>
            );
          }) : <p className="hint">{t("Aucune séance perso. Ajoute-en depuis l'onglet Planning.")}</p>}
        </div>
      )}

      <Head id="removed" title={t('Supprimés')} count={removed.length || undefined} def={false} />
      {isOpen('removed', false) && (
        <div className="edbody">
          {removed.length ? removed.map((r) => (
            <div key={r.key} className="edcard"><div className="edtop"><strong>{r.label}</strong><button type="button" className="btn ghost" onClick={() => update((d) => restoreItem(d, r.key))}>{t('Restaurer')}</button></div></div>
          )) : <p className="hint">{t('Rien de supprimé.')}</p>}
        </div>
      )}

      <Backups />
    </div>
  );
}
