/** Data model. The saved shape is identical to the previous (plain JS) version so existing data keeps working. */

export type Lang = 'fr' | 'en' | 'es';
export type Mode = 'auto' | 'light' | 'dark';

export interface Subject { id: string; code: string; name: string; short: string; ab: string; c: number; color?: string }
export interface Devoir { id: string; ab: string; title: string; date: string; avail?: string }
export interface Exam { id: string; title: string; date: string; end?: string }
export type SessionKind = 'live' | 'webconf';
export interface SessionEvt { id: string; subject: string; kind: SessionKind; date: string; time: string; tag: string }

/** Reference schedule that comes from the server (seed.json / import). Edits are layered on top, never applied in place. */
export interface Base { s: Subject[]; d: Devoir[]; x: Exam[]; e: SessionEvt[] }

export interface Note {
  id: string;
  k: 'text' | 'link' | 'img' | 'file';
  v?: string;            // text
  u?: string; l?: string; // link url / label
  n?: string; z?: number; // file name / size
  f?: string;            // server file id (sha256)
  d?: string;            // legacy inline data URL (migrated to f)
}

export interface CustomEvt { id: string; title: string; subject: string; date: string; time: string; tend: string }

export interface Sticker { id: string; t: string; c: string; x: number; y: number; s: number; r: number }

export interface Prefs {
  mode: Mode;
  lang: Lang;
  pal: string;
  custom: string;   // UI accent colour
  ppal: string;     // print palette
  pcustom: string;  // print colour
  sync?: boolean;   // same sticker decoration on every month
  auto?: boolean;   // automatic catch-up planning switched on
  autoManual?: boolean; // catch-ups are chosen by the user, one day at a time, instead of being placed automatically
  autoMax?: number; // never more than this many catch-up slots in a row for the same subject
  quiz?: boolean;        // the English question asked each time the app is opened (on unless switched off)
  remind?: boolean;      // reminders shortly before an event starts (in the app, and on the phone when enabled there)
  remindLead?: number;   // minutes before the start
  library?: boolean;     // readable copy of the notes and files on the server (on unless switched off)
  remindSound?: boolean; // sound and vibration with the in-app reminder
}

export type Edits = Record<string, Record<string, string>>;

/** Items the user created themselves (the reference schedule in `Base` stays untouched). */
export interface Extra { s: Subject[]; d: Devoir[]; x: Exam[]; e: SessionEvt[] }

export interface Data {
  /** Items added by the user: subjects, assignments, exams, sessions. */
  extra: Extra;
  /** Items removed by the user ("s:id", "d:id", "x:id"). Nothing is erased: they can be restored from the edit screen. */
  deleted: Record<string, boolean>;
  notes: Record<string, Note[]>;
  edits: Edits;
  hidden: Record<string, boolean>;
  done: Record<string, boolean>;
  /** day (YYYY-MM-DD) on which each ticked session was ticked (for streaks and "caught up" achievements) */
  doneAt: Record<string, string>;
  /** English quiz: for each question, how many times it was answered right / wrong and the last day it was asked */
  quiz: Record<string, { ok: number; ko: number; at: string }>;
  /** unlocked achievements: id -> day it was unlocked. Only ever grows. */
  ach: Record<string, string>;
  /** reward sticker given with each unlocked achievement: id -> number of the sticker (see lib/rewards). Only ever grows. */
  rew: Record<string, number>;
  /** catch-ups chosen by hand: late session id -> the day and start time chosen for it (kept even when the planning is automatic) */
  picks: Record<string, { date: string; time: string }>;
  rendu: Record<string, boolean>;
  custom: CustomEvt[];
  prefs: Prefs;
  favs: string[];
  stickers: Record<string, Sticker[]>;
  bg: Sticker[];
  bgv: number;
  bgAt: number;
  printOff: Record<string, boolean>;
}

/** What the server returns / what sync hands to the app at start-up. */
export interface BootResult { data: Data; base: Base; rev: number; offline: boolean }

export type SyncStatus = 'saved' | 'saving' | 'pending' | 'offline' | 'cachefull';

export type EvtKind = SessionKind | 'perso' | 'devoir' | 'exam' | 'dispo';
/** One line in the planner: a session, a custom session, an assignment deadline, an exam or an "available from" date. */
export interface Evt {
  id: string;
  kind: EvtKind;
  date: string;
  end?: string;
  time?: string;
  tag?: string;
  subject?: string;
  title?: string;
  check?: boolean;
  devoir?: Devoir;
  /** catch-up tile: id of the late session it stands for, and the day that session was originally on */
  planOf?: string;
  part?: 'am' | 'pm';
  from?: string;
}

export type Translate = (s: string) => string;
export type TranslateF = (s: string, vars?: Record<string, string | number>) => string;
