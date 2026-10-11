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
}

export type Edits = Record<string, Record<string, string>>;

export interface Data {
  notes: Record<string, Note[]>;
  edits: Edits;
  hidden: Record<string, boolean>;
  done: Record<string, boolean>;
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
}

export type Translate = (s: string) => string;
export type TranslateF = (s: string, vars?: Record<string, string | number>) => string;
