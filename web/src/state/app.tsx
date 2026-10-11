import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Base, BootResult, Data, Evt, Lang, SyncStatus, Translate, TranslateF } from '../types';
import { CUSTOM_VARS, customTokens, subjectColorFor } from '../lib/colors';
import { type Fmt, iso, makeFmt } from '../lib/dates';
import { makeT } from '../lib/i18n';
import { clone } from '../lib/merge';
import { buildEvents, resolveModel, type Model, type Scope } from '../lib/model';
import { normalizeData } from '../lib/normalize';
import type { SyncClient } from '../lib/sync';
import { uploadBlob } from '../lib/files';
import { migrateInlineNotes } from '../lib/migrate';

export type Tab = 'planning' | 'devoirs' | 'print' | 'edit';

/** Everything that is only about what is on screen (never saved). */
export interface UiState {
  tab: Tab; view: 'list' | 'month'; scope: Scope; filter: string; month: string; sel: string | null; // calendar day selected
  formOpen: boolean; form: { title: string; subject: string; date: string; time: string; tend: string };
  sim: string | null; alertOpen: boolean;
  noteFor: { key: string; title: string } | null; noteMsg: string;
  printHelp: boolean; stkPop: boolean; stkTarget: 'print' | 'bg'; stkTab: 'stk' | 'emo'; emoCat: number;
  pmonth: string | null; pall: boolean; stkSel: string | null; // sticker selected on the print sheet
  deco: boolean; bsel: string | null; bgColor: boolean; bgArm: boolean;
  rsArm: boolean; cpArm: boolean; themePick: boolean; edOpen: Record<string, boolean>; edPick: string | null;
  editing: string | null; menu: { x: number; y: number; key: string | null; doneId: string | null } | null; prevTab: Tab;
  newc: string; bnewc: string; backups: Array<{ name: string; time: number; rev: number; tag: string; size: number }> | null; bakMsg: string;
}

export const initialUi = (today: string): UiState => ({
  tab: 'planning', view: 'list', scope: 'todo', filter: 'all', month: today.slice(0, 7), sel: null,
  formOpen: false, form: { title: '', subject: '', date: '', time: '', tend: '' }, sim: null, alertOpen: false,
  noteFor: null, noteMsg: '', printHelp: false, stkPop: false, stkTarget: 'print', stkTab: 'stk', emoCat: 0,
  pmonth: null, pall: false, stkSel: null, deco: false, bsel: null, bgColor: false, bgArm: false,
  rsArm: false, cpArm: false, themePick: false, edOpen: {}, edPick: null, editing: null, menu: null, prevTab: 'planning', newc: '#d6457f', bnewc: '#d6457f', backups: null, bakMsg: ''
});

export interface AppCtx {
  data: Data; base: Base; model: Model; evs: Evt[];
  /** Change the data: copy, mutate the copy, store it, and hand it to the sync layer. */
  update: (fn: (draft: Data) => void) => void;
  t: Translate; tf: TranslateF; fmt: Fmt; lang: Lang;
  today: string; ui: UiState; setUi: (p: Partial<UiState> | ((u: UiState) => Partial<UiState>)) => void;
  sync: SyncClient; status: SyncStatus; isDark: boolean;
  /** Drag operations tell the sync layer not to swap the data underneath them. */
  setBusy: (b: boolean) => void;
  adopt: (d: Data, b?: Base | null, quiet?: boolean) => boolean;
}

const Ctx = createContext<AppCtx | null>(null);
export function useApp(): AppCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error('useApp outside AppProvider');
  return c;
}

const isTyping = (): boolean => {
  const a = document.activeElement as HTMLElement | null;
  return !!a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) && !!a.closest('#root');
};

/** Sets the colour scheme, the custom accent tokens and the subject colours on <html>. */
export function applyTheme(data: Data, model: Model, sysDark: boolean): boolean {
  const r = document.documentElement, mode = data.prefs.mode;
  const dark = mode === 'dark' || (mode === 'auto' && sysDark);
  r.setAttribute('data-pal', data.prefs.pal);
  r.setAttribute('data-scheme', dark ? 'dark' : 'light');
  CUSTOM_VARS.forEach((v) => r.style.removeProperty(v));
  if (data.prefs.pal === 'perso') { const tk = customTokens(data.prefs.custom, dark); Object.keys(tk).forEach((k) => r.style.setProperty(k, tk[k])); }
  model.subjects.forEach((sj) => { const c = subjectColorFor(sj.color, dark); if (c) r.style.setProperty('--s' + sj.c, c); else r.style.removeProperty('--s' + sj.c); });
  return dark;
}

export function AppProvider({ boot, sync, children }: { boot: BootResult; sync: SyncClient; children: ReactNode }): ReactNode {
  const [data, setData] = useState<Data>(() => normalizeData(boot.data, { w: window.innerWidth, h: window.innerHeight }));
  const dataRef = useRef(data);
  const [base, setBase] = useState<Base>(boot.base);
  const [status, setStatus] = useState<SyncStatus>(boot.offline ? 'offline' : 'saved');
  const [nowDay, setNowDay] = useState(() => iso(new Date()));
  const [ui, setUiState] = useState<UiState>(() => initialUi(iso(new Date())));
  const [sysDark, setSysDark] = useState(() => !!window.matchMedia?.('(prefers-color-scheme: dark)').matches);
  const busy = useRef(false);

  const update = useCallback((fn: (d: Data) => void) => {
    const next = clone(dataRef.current);
    fn(next);
    dataRef.current = next;
    setData(next);
    sync.changed();
  }, [sync]);

  const adopt = useCallback((nd: Data, nb?: Base | null, quiet?: boolean): boolean => {
    if (quiet && (isTyping() || busy.current)) return false;
    const n = normalizeData(nd, { w: window.innerWidth, h: window.innerHeight });
    dataRef.current = n; setData(n);
    if (nb) setBase(nb);
    return true;
  }, []);

  useEffect(() => {
    sync.attach({ getData: () => dataRef.current, adopt, onStatus: setStatus });
    return () => sync.stop();
  }, [sync, adopt]);

  // day rollover and system dark-mode changes
  useEffect(() => {
    const id = setInterval(() => setNowDay(iso(new Date())), 60_000);
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)');
    const on = (): void => setSysDark(!!mq?.matches);
    mq?.addEventListener?.('change', on);
    return () => { clearInterval(id); mq?.removeEventListener?.('change', on); };
  }, []);

  const model = useMemo(() => resolveModel(base, data), [base, data]);
  const evs = useMemo(() => buildEvents(model, data), [model, data]);
  const { t, tf } = useMemo(() => makeT(data.prefs.lang), [data.prefs.lang]);
  const fmt = useMemo(() => makeFmt(data.prefs.lang), [data.prefs.lang]);
  const today = ui.sim || nowDay;

  const isDark = useMemo(() => {
    const m = data.prefs.mode;
    return m === 'dark' || (m === 'auto' && sysDark);
  }, [data.prefs.mode, sysDark]);
  useEffect(() => { applyTheme(data, model, sysDark); }, [data, model, sysDark]);
  useEffect(() => { document.documentElement.setAttribute('lang', data.prefs.lang); }, [data.prefs.lang]);

  // first time the server confirms "saved": upload any legacy inline attachments
  const migrating = useRef(false);
  useEffect(() => {
    if (status !== 'saved' || migrating.current) return;
    if (!Object.values(dataRef.current.notes).some((l) => l.some((n) => !n.f && n.d?.startsWith('data:')))) return;
    migrating.current = true;
    void migrateInlineNotes(() => dataRef.current, update, (b, ty) => uploadBlob(b, ty, (u, i) => sync.api(u, i))).finally(() => { migrating.current = false; });
  }, [status, data, update, sync]);

  const setUi = useCallback((p: Partial<UiState> | ((u: UiState) => Partial<UiState>)) => {
    setUiState((u) => ({ ...u, ...(typeof p === 'function' ? p(u) : p) }));
  }, []);
  const setBusy = useCallback((b: boolean) => { busy.current = b; }, []);

  // opening the app on a day with an assignment due soon shows the alert once
  const alerted = useRef(false);
  useEffect(() => {
    if (alerted.current) return;
    alerted.current = true;
    setUiState((u) => ({ ...u, alertOpen: true }));
  }, []);

  const value: AppCtx = { data, base, model, evs, update, t, tf, fmt, lang: data.prefs.lang, today, ui, setUi, sync, status, isDark, setBusy, adopt };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
