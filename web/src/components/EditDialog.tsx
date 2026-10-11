import { useEffect, useState, type ReactNode } from 'react';
import { clearColor, resetEdit, setEdit } from '../lib/edits';
import { splitKey, removeItem } from '../lib/items';
import { clearDone } from '../lib/done';
import { useApp } from '../state/app';
import { ColorPicker } from './ColorPicker';
import { EdInput } from './EdInput';

const HEX = /^#[0-9a-f]{6}$/i;

/** Edit one tile (subject, assignment, exam, session or personal session) in a dialog. Changes are saved as you type. */
export function EditDialog(): ReactNode {
  const { ui, setUi, model, data, base, update, t, fmt } = useApp();
  const key = ui.editing as string;
  const { kind, id } = splitKey(key);
  const [colorOpen, setColorOpen] = useState(false);
  const close = (): void => setUi({ editing: null });

  const subject = kind === 's' ? model.subjects.find((x) => x.id === id) : undefined;
  const devoir = kind === 'd' ? model.devoirs.find((x) => x.id === id) : undefined;
  const exam = kind === 'x' ? model.exams.find((x) => x.id === id) : undefined;
  const session = kind === 'e' ? model.events.find((x) => x.id === id) : undefined;
  const perso = kind === 'c' ? data.custom.find((x) => x.id === id) : undefined;
  const found = subject || devoir || exam || session || perso;

  useEffect(() => { if (!found) setUi({ editing: null }); }, [found, setUi]);
  useEffect(() => {
    const on = (e: KeyboardEvent): void => { if (e.key === 'Escape') setUi({ editing: null }); };
    document.addEventListener('keydown', on);
    return () => document.removeEventListener('keydown', on);
  }, [setUi]);
  if (!found) return null;

  const title = subject ? t('Modifier la matière') : devoir ? t('Modifier le devoir') : exam ? t("Modifier l'examen") : session ? t('Modifier la séance') : t('Modifier la séance perso');
  const subtitle = subject ? subject.code + ' · ' + subject.name : devoir ? devoir.title : exam ? exam.title : session ? (model.subjects.find((s) => s.id === session.subject)?.ab || '') + ' · ' + fmt.long.format(new Date(session.date + 'T12:00:00')) : perso ? perso.title : '';
  const modded = !!(data.edits[key] && Object.keys(data.edits[key]).length);
  const subjectOptions: Array<[string, string]> = model.subjects.map((s) => [s.id, s.name]);

  const remove = (): void => {
    if (kind === 's' && !window.confirm(t('Supprimer cette matière ? Ses séances disparaissent aussi du planning, tu pourras la restaurer dans le mode édition.'))) return;
    if (kind === 'c') update((d) => { d.custom = d.custom.filter((c) => c.id !== id); clearDone(d, id); });
    else update((d) => removeItem(d, key));
    close();
  };
  const subjColor = subject?.color && HEX.test(subject.color) ? subject.color : (getComputedStyle(document.documentElement).getPropertyValue('--s' + (subject?.c ?? 1)).trim() || '#888888');

  return (
    <div className="ov" role="dialog" aria-modal="true" aria-labelledby="ed-t">
      <div className="modal wide">
        <div className="mtop acc"><div className="eyebrow" id="ed-t">{title}</div><div className="big sm">{subtitle}</div></div>
        <div className="mbody">
          <div className="form">
            {subject && (
              <>
                <EdInput k={key} f="code" label="Code" type="text" val={subject.code} opt={{ max: 12 }} />
                <EdInput k={key} f="name" label="Nom complet" type="text" val={subject.name} opt={{ wide: true, max: 80 }} />
                <EdInput k={key} f="ab" label="Abréviation" type="text" val={subject.ab} opt={{ max: 12 }} />
                <div className="wide colrow">
                  <span className="lbl">{t('Couleur de la matière')}</span>
                  <button type="button" className="colbtn" style={{ background: `var(--s${subject.c})` }} aria-expanded={colorOpen} aria-label={t('Changer la couleur')} onClick={() => setColorOpen(!colorOpen)} />
                  {subject.color && <button type="button" className="lnk" onClick={() => update((d) => clearColor(d, key))}>{t("Couleur d'origine")}</button>}
                </div>
                {colorOpen && <div className="wide"><ColorPicker value={subjColor.toLowerCase()} onChange={(hex) => update((d) => { setEdit(d, base, key, 'color', hex); })} /></div>}
              </>
            )}
            {devoir && (
              <>
                <EdInput k={key} f="title" label="Titre" type="text" val={devoir.title} opt={{ wide: true, max: 60 }} />
                <EdInput k={key} f="ab" label="Abréviation" type="text" val={devoir.ab} opt={{ max: 12 }} />
                <EdInput k={key} f="date" label="Date limite de rendu" type="date" val={devoir.date} />
                <EdInput k={key} f="avail" label="Sujet disponible dès le" type="date" val={devoir.avail || ''} opt={{ clear: true }} />
              </>
            )}
            {exam && (
              <>
                <EdInput k={key} f="title" label="Titre" type="text" val={exam.title} opt={{ wide: true, max: 60 }} />
                <EdInput k={key} f="date" label="Début" type="date" val={exam.date} />
                <EdInput k={key} f="end" label="Fin" type="date" val={exam.end || ''} opt={{ clear: true }} />
              </>
            )}
            {session && (
              <>
                <EdInput k={key} f="subject" label="Matière" type="" val={session.subject} opt={{ options: subjectOptions }} />
                <EdInput k={key} f="date" label="Date" type="date" val={session.date} />
                <EdInput k={key} f="kind" label="Type" type="" val={session.kind} opt={{ options: [['live', t('Live du soir')], ['webconf', t('Webconférence')]] }} />
                <EdInput k={key} f="time" label="Heure" type="text" val={session.time || ''} opt={{ max: 20 }} />
                <EdInput k={key} f="tag" label="Précision (facultatif)" type="text" val={session.tag || ''} opt={{ max: 60, wide: true }} />
              </>
            )}
            {perso && (
              <>
                <EdInput k={key} f="title" label="Titre" type="text" val={perso.title} opt={{ wide: true, max: 80 }} />
                <EdInput k={key} f="subject" label="Matière" type="" val={perso.subject || ''} opt={{ options: [['', t('Aucune')] as [string, string]].concat(subjectOptions) }} />
                <EdInput k={key} f="date" label="Date" type="date" val={perso.date} />
                <EdInput k={key} f="time" label="Début (facultatif)" type="time" val={perso.time || ''} />
                <EdInput k={key} f="tend" label="Fin (facultatif)" type="time" val={perso.tend || ''} />
              </>
            )}
          </div>
          <div className="opt">
            {modded && <button type="button" className="btn ghost" onClick={() => update((d) => resetEdit(d, key))}>{t("Rétablir les valeurs d'origine")}</button>}
            <button type="button" className="btn ghost" onClick={remove}>{t('Supprimer')}</button>
            <span className="spacer" />
            <button type="button" className="btn" id="ed-close" onClick={close}>{t('Fermer')}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
