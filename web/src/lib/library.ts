import type { Data, Evt, Note, Translate, TranslateF } from '../types';
import type { Fmt } from './dates';
import { parse } from './dates';
import { evTitle } from './labels';
import type { Model } from './model';

/**
 * The readable copy of the notes and attachments: what each folder is called and what goes in it.
 * One folder per subject, one sub-folder per class (assignments, exams and the rest have their own folders), holding
 * `notes.txt` (the notes and links as plain text) and the attachments under their own names. The server writes the files
 * (see server/library.js); this builds the list from what the user sees in the planner.
 */
export interface LibEntry { dir: string[]; text: string; files: Array<{ id: string; name: string }> }

const HR = '\n\n----------------------------------------\n\n';

/** Plain-text content of one note. */
function noteText(n: Note, t: Translate): string {
  if (n.k === 'text') return (n.v || '').trim();
  if (n.k === 'link') return t('Lien') + ' : ' + (n.l ? n.l + '\n' : '') + (n.u || '');
  return n.f ? t('Fichier joint') + ' : ' + (n.n || t('fichier')) : '';
}

export function buildLibrary(model: Model, data: Data, evs: Evt[], t: Translate, tf: TranslateF, fmt: Fmt): LibEntry[] {
  const events = new Map<string, Evt>();
  evs.forEach((e) => { if (!e.planOf) events.set(e.id, e); });
  model.events.forEach((e) => { if (!events.has(e.id)) events.set(e.id, { ...e, check: true }); });   // a class hidden from the planner keeps its notes
  const subject = (id?: string) => model.subjects.find((s) => s.id === id);
  const day = (d: string): string => fmt.long.format(parse(d));

  const out: Array<LibEntry & { key: string }> = [];
  for (const [key, list] of Object.entries(data.notes)) {
    if (!list || !list.length) continue;
    let dir: string[], head: string, when = '';
    const m = /^(s|dev|av):(.+)$/.exec(key);
    if (m && m[1] === 's' && subject(m[2])) {
      const s = subject(m[2])!;
      dir = [s.name, t('Général')]; head = s.code + ' · ' + s.name;
    } else if (m && (m[1] === 'dev' || m[1] === 'av') && model.devoirs.some((d) => d.id === m[2])) {
      const d = model.devoirs.find((x) => x.id === m[2])!;
      const date = m[1] === 'av' && d.avail ? d.avail : d.date;
      dir = [t('Devoirs'), date + ' ' + t(d.title) + (m[1] === 'av' ? ' (' + t('Sujet disponible') + ')' : '')];
      head = t(d.title); when = day(date);
    } else if (events.has(key)) {
      const e = events.get(key)!;
      const s = subject(e.subject);
      const title = e.kind === 'exam' || e.kind === 'devoir' || e.kind === 'dispo' ? t(e.title || '') : evTitle(e, t);
      dir = [e.kind === 'exam' ? t('Examens') : s ? s.name : t('Autres'), e.date + ' ' + title];
      head = (s ? s.name + ' · ' : '') + title;
      when = day(e.date) + (e.time ? ' · ' + e.time : '');
    } else {
      dir = [t('Archives'), key]; head = key;                       // the item was removed: its notes are still kept
    }
    const blocks = list.map((n) => noteText(n, t)).filter(Boolean);
    const text = [head, when, '', blocks.join(HR)].filter((x, i) => i !== 1 || x).join('\n').trim();
    out.push({ key, dir, text, files: list.filter((n) => (n.k === 'img' || n.k === 'file') && n.f).map((n) => ({ id: n.f as string, name: n.n || t('fichier') })) });
  }
  void tf;
  return out.sort((a, b) => (a.dir.join('/') + a.key < b.dir.join('/') + b.key ? -1 : 1)).map(({ dir, text, files }) => ({ dir, text, files }));
}
