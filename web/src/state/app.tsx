import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Base, BootResult, Data, Evt, Lang, SyncStatus, Translate, TranslateF } from '../types';
import { CUSTOM_VARS, customTokens, subjectColorFor } from '../lib/colors';
import { type Fmt, iso, makeFmt } from '../lib/dates';
import { makeT } from '../lib/i18n';
import { clone } from '../lib/merge';
import { buildEvents, byDate, resolveModel, type Model, type Scope } from '../lib/model';
import { buildDefs, computeStats, type Def, type Stats } from '../lib/achievements';
import { slotColor } from '../lib/slotColors';
import { EMPTY_PLAN, planCatchUp, planTiles, type Plan } from '../lib/catchup';
import { normalizeData } from '../lib/normalize';
import type { SyncClient } from '../lib/sync';
import { uploadBlob } from '../lib/files';
import { migrateInlineNotes } from '../lib/migrate';

/** A short message on top of the page: a reminder, an unlocked achievement... */
export interface Toast { id: string; kind: 'reminder' | 'achievement' | 'info'; title: string; body?: string; icon?: string; /** ms until it goes away by itself (omit: stays until closed) */ ttl?: number }

export type Tab = 'planning' | 'devoirs' | 'success' | 'print' | 'edit';

/** Everything that is only about what is on screen (never saved). */
export interface UiState {
  tab: Tab; view: 'list' | 'month'; scope: Scope; filter: string; month: string; sel: string | null; // calendar day selected
  formOpen: boolean; form: { title: string; subject: string; date: string; time: string; tend: string };
  sim: string | null; alertOpen: boolean;
  noteFor: { key: string; title: string } | null; noteMsg: string;
  printHelp: boolean; stkPop: boolean; stkTarget: 'print' | 'bg'; stkTab: 'stk' | 'emo'; emoCat: number;
  pmonth: string | null; pall: boolean; stkSel: string | null; // sticker selected on the print sheet
  deco: boolean; bsel: string | null; bgColor: boolean; bgArm: boolean;
  remindOpen: boolean; quizPassed: boolean; quizOpen: boolean;
  rsArm: boolean; cpArm: boolean; themePick: boolean; edOpen: Record<string, boolean>; edPick: string | null;
  editing: string | null; menu: { x: number; y: number; key: string | null; doneId: string | null } | null; prevTab: Tab;
  newc: string; bnewc: string; backups: Array<{ name: string; time: number; rev: number; tag: string; size: number }> | null; bakMsg: string;
}

export const initialUi = (today: string): UiState => ({
  tab: 'planning', view: 'list', scope: 'todo', filter: 'all', month: today.slice(0, 7), sel: null,
  formOpen: false, form: { title: '', subject: '', date: '', time: '', tend: '' }, sim: null, alertOpen: false,
  noteFor: null, noteMsg: '', printHelp: false, stkPop: false, stkTarget: 'print', stkTab: 'stk', emoCat: 0,
  pmonth: null, pall: false, stkSel: null, deco: false, bsel: null, bgColor: false, bgArm: false,
  remindOpen: false, quizPassed: false, quizOpen: false, rsArm: false, cpArm: false, themePick: false, edOpen: {}, edPick: null, editing: null, menu: null, prevTab: 'planning', newc: '#d6457f', bnewc: '#d6457f', backups: null, bakMsg: ''
});

export interface AppCtx {
  data: Data; base: Base; model: Model; evs: Evt[];
  /** where the automatic catch-up planner put the late sessions (empty when it is switched off) */
  plan: Plan;
  /** achievements: every medal that exists in this planner, where the user stands, and what is unlocked (dates) */
  ach: { defs: Def[]; byId: Record<string, Def>; stats: Stats; unlocked: Record<string, string> };
  /** Change the data: copy, mutate the copy, store it, and hand it to the sync layer. */
  update: (fn: (draft: Data) => void) => void;
  t: Translate; tf: TranslateF; fmt: Fmt; lang: Lang;
  today: string;
  /** the real current day, even while a simulated date is chosen */
  realToday: string;
  /** minutes since midnight, refreshed every minute */
  clock: number;
  toasts: Toast[]; toast: (t: Omit<Toast, 'id'>) => string; dismissToast: (id: string) => void;
  ui: UiState; setUi: (p: Partial<UiState> | ((u: UiState) => Partial<UiState>)) => void;
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

const HEXC = /^#[0-9a-f]{6}$/i;
/** A subject's colour as #rrggbb (its own colour, else the stylesheet's colour for its slot, else one derived from the slot). */
function subjectHex(s: { c: number; color?: string }): string {
  if (s.color && HEXC.test(s.color)) return s.color;
  try {
    const v = getComputedStyle(document.documentElement).getPropertyValue('--s' + s.c).trim();
    if (HEXC.test(v)) return v;
  } catch { /* no stylesheet (tests) */ }
  return slotColor(s.c, false);
}
const minutesNow = (): number => { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); };
/** Only the half of the day matters to the planner (so it is not recomputed every minute). */
const dayPart = (min: number): number => (min < 12 * 60 ? 0 : min < 17 * 60 ? 12 * 60 : 17 * 60);

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
  const [clock, setClock] = useState(() => minutesNow());
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
    const id = setInterval(() => { setNowDay(iso(new Date())); setClock(minutesNow()); }, 60_000);
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)');
    const on = (): void => setSysDark(!!mq?.matches);
    mq?.addEventListener?.('change', on);
    return () => { clearInterval(id); mq?.removeEventListener?.('change', on); };
  }, []);

  const model = useMemo(() => resolveModel(base, data), [base, data]);
  const evs0 = useMemo(() => buildEvents(model, data), [model, data]);
  const { t, tf } = useMemo(() => makeT(data.prefs.lang), [data.prefs.lang]);
  const fmt = useMemo(() => makeFmt(data.prefs.lang), [data.prefs.lang]);
  const today = ui.sim || nowDay;
  // the planner only needs to know which half of today is still ahead; recomputed when that changes
  const nowMin = ui.sim ? 0 : dayPart(clock);
  const auto = !!data.prefs.auto, autoMax = data.prefs.autoMax || 3;
  const plan = useMemo(
    () => (auto ? planCatchUp({ events: evs0, today, done: data.done, max: autoMax, nowMin }) : EMPTY_PLAN),
    [auto, autoMax, evs0, today, data.done, nowMin]
  );
  // achievements are counted on the real schedule (not on the catch-up tiles the planner shows)
  const achStats = useMemo(() => computeStats(model, data, evs0, nowDay), [model, data, evs0, nowDay]);
  const achDefs = useMemo(() => buildDefs(model, achStats, t, tf, (s) => subjectHex(s)), [model, achStats, t, tf]);
  const ach = useMemo(() => ({ defs: achDefs, byId: Object.fromEntries(achDefs.map((d) => [d.id, d])), stats: achStats, unlocked: data.ach }), [achDefs, achStats, data.ach]);
  const evs = useMemo(() => (plan.placed.length ? evs0.concat(planTiles(evs0, plan)).sort(byDate) : evs0), [evs0, plan]);

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
  const [toasts, setToasts] = useState<Toast[]>([]);
  const dismissToast = useCallback((id: string) => setToasts((l) => l.filter((x) => x.id !== id)), []);
  const toast = useCallback((x: Omit<Toast, 'id'>): string => {
    const id = 't' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    setToasts((l) => l.concat({ ...x, id }).slice(-4));
    if (x.ttl) setTimeout(() => setToasts((l) => l.filter((y) => y.id !== id)), x.ttl);
    return id;
  }, []);
  const setBusy = useCallback((b: boolean) => { busy.current = b; }, []);

  // opening the app on a day with an assignment due soon shows the alert once
  const alerted = useRef(false);
  useEffect(() => {
    if (alerted.current) return;
    alerted.current = true;
    setUiState((u) => ({ ...u, alertOpen: true }));
  }, []);

  const value: AppCtx = { data, base, model, evs, plan, ach, update, t, tf, fmt, lang: data.prefs.lang, today, realToday: nowDay, clock, toasts, toast, dismissToast, ui, setUi, sync, status, isDark, setBusy, adopt };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
