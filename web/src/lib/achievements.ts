import type { Data, Evt, Subject, Translate, TranslateF } from '../types';
import { diff, parse, iso } from './dates';
import type { Glyph } from './badge';
import { devoirDone, renduCount, type Model } from './model';

/**
 * Achievements ("succès"). Each family has tiers (1, 2, 3, 5, 7, 10... up to the most that exists in the planner); each tier is a medal
 * whose metal grows with the tier. Unlocking is permanent: the date is saved in `data.ach` and nothing here ever removes it,
 * so a streak that breaks, a session unticked or a subject removed cannot take a medal away.
 */

export type Kind = 'live' | 'webconf';

export interface Stats {
  totalDone: number; totalAvail: number;
  bySubject: Record<string, Record<Kind, { done: number; avail: number }>>;
  /** sessions ticked after the day they were planned */
  caught: number;
  bestStreak: number; currentStreak: number;
  perfectWeeks: number;
  rendu: { done: number; total: number };
  devoirsComplete: { done: number; total: number };
  stickers: number; notes: number; created: number; edits: number;
  dark: boolean; lang: boolean; colour: boolean; auto: boolean; touch: boolean;
}

export interface Def {
  id: string; family: string; famName: string; group: Group; glyph: Glyph;
  /** value to reach, and where the user stands now */
  n: number; value: number;
  rank: number; label?: string; color?: string; subject?: string;
  title: string; desc: string;
  /** reached right now (an achievement stays unlocked even when this becomes false: see `data.ach`) */
  met: boolean;
}

export type Group = 'sessions' | 'rhythm' | 'homework' | 'planner';
export const GROUPS: Group[] = ['sessions', 'rhythm', 'homework', 'planner'];

const LADDER = [1, 2, 3, 5, 7, 10, 15, 20, 30, 40, 50, 75, 100, 150, 200, 300];
/** 1, 2, 3, 5, 7, 10... up to the most that exists, ending exactly on it ("everything done"). */
export function ladder(max: number): number[] {
  if (max < 1) return [];
  const t = LADDER.filter((n) => n <= max);
  if (t[t.length - 1] !== max) t.push(max);
  return t;
}

/** Rank of the metal for tier i out of count: the last tier is always the top one. */
export const rankOf = (i: number, count: number): number => (count <= 1 ? 2 : Math.round((i * 4) / (count - 1)));

const ymd = (d: Date): string => iso(d);
const mondayOf = (day: string): string => { const d = parse(day); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return ymd(d); };

/**
 * Days with at least one ticked session, strung into chains: consecutive days, or with ONE rest day in between, but not two rest
 * days within the same week. The length of a chain is its number of active days.
 */
export function streaks(daysIn: string[], today: string): { best: number; current: number } {
  const days = [...new Set(daysIn)].sort();
  let best = 0, current = 0, len = 0, lastRest: string | null = null, prev: string | null = null;
  for (const day of days) {
    if (prev === null) { len = 1; lastRest = null; }
    else {
      const gap = diff(day, prev);
      const rest = gap === 2 ? ymd(new Date(parse(prev).getTime() + 864e5 + 36e5)) : null;
      const restOk = rest !== null && (lastRest === null || diff(rest, lastRest) >= 7);
      if (gap === 1) len++;
      else if (restOk) { len++; lastRest = rest; }
      else { len = 1; lastRest = null; }
    }
    prev = day;
    if (len > best) best = len;
    current = len;
  }
  // the chain is still alive when its last day is today or yesterday (or the day before, if that last day was followed by an allowed rest day)
  if (prev !== null) {
    const gap = diff(today, prev);
    const alive = gap <= 1 || (gap === 2 && (lastRest === null || diff(ymd(new Date(parse(prev).getTime() + 864e5 + 36e5)), lastRest) >= 7));
    if (!alive) current = 0;
  } else current = 0;
  return { best, current };
}

export function computeStats(model: Model, data: Data, evs: Evt[], today: string): Stats {
  const sessions = model.events.filter((e) => !data.hidden[e.id]);
  const bySubject: Stats['bySubject'] = {};
  for (const s of model.subjects) bySubject[s.id] = { live: { done: 0, avail: 0 }, webconf: { done: 0, avail: 0 } };
  let totalDone = 0, totalAvail = 0, caught = 0;
  for (const e of sessions) {
    const cell = bySubject[e.subject]?.[e.kind];
    if (!cell) continue;
    cell.avail++; totalAvail++;
    if (data.done[e.id]) {
      cell.done++; totalDone++;
      const at = data.doneAt[e.id];
      if (at && at > e.date) caught++;
    }
  }

  // days with a ticked session: the day it was ticked, or (ticks from before the dates were recorded) the day of the session itself
  const days: string[] = [];
  const dateOf = new Map<string, string>();
  evs.forEach((e) => { if (e.check && !e.planOf) dateOf.set(e.id, e.date); });
  for (const key of Object.keys(data.done)) {
    if (!data.done[key]) continue;
    const at = data.doneAt[key] || dateOf.get(key);
    if (at && (data.doneAt[key] || at <= today)) days.push(at);
  }
  const st = streaks(days, today);

  const weeks = new Map<string, { n: number; done: number }>();
  for (const e of sessions) {
    const w = weeks.get(mondayOf(e.date)) || { n: 0, done: 0 };
    w.n++; if (data.done[e.id]) w.done++;
    weeks.set(mondayOf(e.date), w);
  }
  const perfectWeeks = [...weeks.values()].filter((w) => w.n >= 2 && w.done === w.n).length;

  const P = data.prefs;
  const stickers = Object.values(data.stickers).reduce((n, l) => n + l.length, 0) + data.bg.length;
  const created = data.custom.length + data.extra.s.length + data.extra.d.length + data.extra.x.length + data.extra.e.length;
  const edits = Object.entries(data.edits).reduce((n, [k, f]) => n + (k === 'app' ? Object.keys(f).length : Object.keys(f).length), 0);
  return {
    totalDone, totalAvail, bySubject, caught, bestStreak: st.best, currentStreak: st.current, perfectWeeks,
    rendu: { done: model.devoirs.reduce((n, d) => n + renduCount(model, data, d), 0), total: model.devoirs.length * model.subjects.length },
    devoirsComplete: { done: model.devoirs.filter((d) => devoirDone(model, data, d)).length, total: model.devoirs.length },
    stickers, notes: Object.values(data.notes).reduce((n, l) => n + l.length, 0), created, edits,
    dark: P.mode === 'dark', lang: P.lang !== 'fr', colour: !['#3b7be8', '#7b4fe0'].includes(P.custom.toLowerCase()), auto: !!P.auto,
    touch: model.subjects.length > 0 && model.subjects.every((s) => (bySubject[s.id].live.done + bySubject[s.id].webconf.done) > 0)
  };
}

interface Family {
  key: string; name: string; group: Group; glyph: Glyph; tiers: number[]; value: number;
  color?: string; subject?: Subject; label: (n: number) => string | undefined;
  title: (n: number, last: boolean) => string; desc: (n: number) => string;
}

export function buildDefs(model: Model, stats: Stats, t: Translate, tf: TranslateF, colorOf: (s: Subject) => string): Def[] {
  const fams: Family[] = [];
  const num = (n: number): string | undefined => String(n);
  const plain = (one: string, many: string, hint: string) => ({
    title: (n: number) => (n === 1 ? t(one) : tf(many, { n })),
    desc: (n: number) => tf(hint, { n })
  });

  fams.push({ key: 'all', name: t('Séances suivies'), group: 'sessions', glyph: 'cap', tiers: ladder(stats.totalAvail), value: stats.totalDone, label: num, color: '#3b7be8',
    ...plain('Première séance suivie', '{n} séances suivies', 'Coche {n} séance(s) (live ou webconférence), toutes matières confondues.') });
  for (const s of model.subjects) {
    const c = stats.bySubject[s.id];
    for (const kind of ['live', 'webconf'] as Kind[]) {
      const cell = c[kind];
      const first = kind === 'live' ? 'Premier live · {s}' : 'Première webconférence · {s}', many = kind === 'live' ? '{n} lives · {s}' : '{n} webconférences · {s}';
      const all = kind === 'live' ? 'Tous les lives · {s}' : 'Toutes les webconférences · {s}';
      fams.push({
        key: `s:${s.id}:${kind}`, name: tf(kind === 'live' ? 'Lives · {s}' : 'Webconférences · {s}', { s: s.name }), group: 'sessions', glyph: kind, tiers: ladder(cell.avail), value: cell.done, label: num, color: colorOf(s), subject: s,
        title: (n, last) => (last && n > 1 ? tf(all, { s: s.name }) : n === 1 ? tf(first, { s: s.name }) : tf(many, { n, s: s.name })),
        desc: (n) => tf(kind === 'live' ? 'Suis {n} live(s) du soir de {s}.' : 'Suis {n} webconférence(s) de {s}.', { n, s: s.name })
      });
    }
  }
  fams.push({ key: 'catch', name: t('Rattrapage'), group: 'rhythm', glyph: 'rewind', tiers: [1, 5, 10, 25, 50], value: stats.caught, label: num, color: '#d6457f',
    ...plain('Premier rattrapage', '{n} séances rattrapées', 'Coche {n} séance(s) après le jour où elle était prévue.') });
  fams.push({ key: 'streak', name: t('Assiduité'), group: 'rhythm', glyph: 'flame', tiers: [3, 7, 14, 21, 30, 45, 60], value: stats.bestStreak, label: (n) => n + 'j', color: '#e8782a',
    title: (n) => tf('{n} jours de suite', { n }), desc: (n) => tf('Coche au moins une séance {n} jours d’affilée (un jour de repos par semaine est toléré).', { n }) });
  fams.push({ key: 'week', name: t('Semaines parfaites'), group: 'rhythm', glyph: 'week', tiers: [1, 2, 4, 8, 12], value: stats.perfectWeeks, label: num, color: '#1e7a3c',
    ...plain('Semaine parfaite', '{n} semaines parfaites', 'Termine toutes les séances de {n} semaine(s).') });
  fams.push({ key: 'rendu', name: t('Devoirs rendus'), group: 'homework', glyph: 'pen', tiers: ladder(stats.rendu.total), value: stats.rendu.done, label: num, color: '#8a4fd1',
    ...plain('Premier devoir rendu', '{n} devoirs rendus', 'Coche {n} remise(s) de devoir (une remise = un devoir dans une matière).') });
  fams.push({ key: 'devdone', name: t('Devoirs complets'), group: 'homework', glyph: 'folder', tiers: ladder(stats.devoirsComplete.total), value: stats.devoirsComplete.done, label: num, color: '#8a4fd1',
    ...plain('Premier devoir complet', '{n} devoirs complets', 'Rends {n} devoir(s) dans toutes les matières.') });
  fams.push({ key: 'stk', name: t('Stickers'), group: 'planner', glyph: 'sticker', tiers: [1, 3, 5, 10, 15, 20], value: stats.stickers, label: num, color: '#e0407a',
    ...plain('Premier sticker', '{n} stickers posés', 'Pose {n} sticker(s) sur tes pages.') });
  fams.push({ key: 'notes', name: t('Notes'), group: 'planner', glyph: 'note', tiers: [1, 3, 5, 10, 25], value: stats.notes, label: num, color: '#b4572b',
    ...plain('Première note', '{n} notes', 'Écris ou joins {n} note(s).') });
  fams.push({ key: 'create', name: t('Créations'), group: 'planner', glyph: 'plus', tiers: [1, 3, 5, 10, 20], value: stats.created, label: num, color: '#1e7a3c',
    ...plain('Premier ajout', '{n} ajouts', 'Ajoute {n} élément(s) toi-même (séance, matière, devoir, examen).') });
  fams.push({ key: 'edit', name: t('Personnalisation'), group: 'planner', glyph: 'edit', tiers: [1, 5, 10, 25], value: stats.edits, label: num, color: '#8a4fd1',
    ...plain('Première modification', '{n} modifications', 'Modifie {n} valeur(s) d’un élément (nom, date, couleur…).') });
  const flag = (key: string, glyph: Glyph, on: boolean, title: string, desc: string, color: string): void => {
    fams.push({ key, name: t(title), group: 'planner', glyph, tiers: [1], value: on ? 1 : 0, label: () => undefined, color, title: () => t(title), desc: () => t(desc) });
  };
  flag('dark', 'moon', stats.dark, 'Noctambule', 'Passe en mode sombre.', '#1d3a8a');
  flag('lang', 'globe', stats.lang, 'Polyglotte', 'Change la langue de l’application.', '#1d78a8');
  flag('colour', 'palette', stats.colour, 'Coloriste', 'Choisis ta propre couleur pour l’application.', '#d6457f');
  flag('auto', 'gear', stats.auto, 'Autopilote', 'Active le rattrapage automatique.', '#5c6b7a');
  flag('touch', 'target', stats.touch, 'Touche-à-tout', 'Coche au moins une séance dans chaque matière.', '#1e7a3c');

  const out: Def[] = [];
  for (const f of fams) {
    f.tiers.forEach((n, i) => {
      out.push({
        id: `${f.key}|${n}`, family: f.key, famName: f.name, group: f.group, glyph: f.glyph, n, value: f.value, rank: rankOf(i, f.tiers.length),
        label: f.label(n), color: f.color, subject: f.subject?.id, title: f.title(n, i === f.tiers.length - 1), desc: f.desc(n), met: f.value >= n
      });
    });
  }
  return out;
}

/** Ids reached now and not yet recorded. */
export const newlyMet = (defs: Def[], data: Data): Def[] => defs.filter((d) => d.met && !data.ach[d.id]);
