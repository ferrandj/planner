/*
 * Client-side persistence.
 *
 * Every change is (1) written immediately to this browser's localStorage as a safety net,
 * then (2) sent to the server. If the server cannot be reached the edits stay in the
 * browser and are merged into the server state later (three-way merge, see merge.ts).
 * Nothing is ever pushed before the server state has been loaded once, so a fresh or
 * empty browser can never overwrite real data.
 */
import type { Base, BootResult, Data, SyncStatus } from '../types';
import { clone, eq, merge3 } from './merge';

export const CACHE_KEY = 'planner-cache-v1';
export const HDR = { 'Content-Type': 'application/json', 'X-Planner-Client': '1' };

interface CacheDoc { rev: number; synced: Data | null; base: Base | null; data: Data | null; dirty: boolean }
interface ServerDoc { rev: number; base: Base; data: Data }

export interface AttachOptions {
  getData: () => Data;
  /** Replace the app's data. `quiet` = a background refresh that must not disturb the user (return false to postpone). */
  adopt: (data: Data, base: Base | null, quiet?: boolean) => boolean | void;
  onStatus: (s: SyncStatus) => void;
}

export interface SyncOptions {
  fetchFn?: typeof fetch;
  storage?: Pick<Storage, 'getItem' | 'setItem'>;
  pollMs?: number;
  debounceMs?: number;
}

export class SyncClient {
  rev = 0;
  status: SyncStatus = 'saved';
  dirty = false;
  private synced: Data | null = null;
  private base: Base | null = null;
  private inflight = false;
  private again = false;
  private attached = false;
  private retry = 0;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private retryTimer: ReturnType<typeof setTimeout> | undefined;
  private poller: ReturnType<typeof setInterval> | undefined;
  private opt!: AttachOptions;
  private cleanup: Array<() => void> = [];
  private readonly fetchFn: typeof fetch;
  private readonly storage: Pick<Storage, 'getItem' | 'setItem'> | undefined;
  private readonly pollMs: number;
  private readonly debounceMs: number;

  constructor(o: SyncOptions = {}) {
    this.fetchFn = o.fetchFn || ((...a) => fetch(...a));
    this.storage = o.storage || (typeof localStorage !== 'undefined' ? localStorage : undefined);
    this.pollMs = o.pollMs ?? 15000;
    this.debounceMs = o.debounceMs ?? 400;
  }

  api(path: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
    return this.fetchFn(path, { cache: 'no-store', credentials: 'same-origin', ...init });
  }

  private readCache(): CacheDoc | null {
    try {
      const c = JSON.parse(this.storage?.getItem(CACHE_KEY) || 'null');
      return c && typeof c === 'object' ? (c as CacheDoc) : null;
    } catch { return null; }
  }
  private writeCache(): boolean {
    try {
      this.storage?.setItem(CACHE_KEY, JSON.stringify({ rev: this.rev, synced: this.synced, base: this.base, data: this.attached ? this.opt.getData() : this.synced, dirty: this.dirty }));
      return true;
    } catch { return false; }
  }
  private setStatus(s: SyncStatus): void { this.status = s; if (this.attached) this.opt.onStatus(s); }

  /** Load the server state. Falls back to this browser's copy only when the server cannot be reached. */
  async load(): Promise<BootResult> {
    try {
      const r = await this.api('api/state');
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const S = (await r.json()) as ServerDoc;
      const C = this.readCache();
      let data = S.data;
      this.rev = S.rev; this.base = S.base; this.synced = clone(S.data); this.dirty = false;
      if (C && C.dirty && C.data) { // edits made in an earlier session that never reached the server
        data = merge3(C.synced || {}, C.data, S.data) as Data;
        this.dirty = !eq(data, S.data);
      }
      return { data, base: S.base, rev: S.rev, offline: false };
    } catch (err) {
      const C = this.readCache();
      if (!C || !C.data || !C.base) throw err;
      this.rev = C.rev; this.base = C.base; this.synced = C.synced ? C.synced : clone(C.data); this.dirty = !!C.dirty;
      return { data: C.data, base: C.base, rev: C.rev, offline: true };
    }
  }

  attach(opt: AttachOptions): void {
    this.opt = opt; this.attached = true;
    this.writeCache();
    if (this.dirty) { this.setStatus('pending'); this.schedule(0); } else this.setStatus('saved');
    this.poller = setInterval(() => void this.poll(), this.pollMs);
    const on = (target: EventTarget, ev: string, fn: () => void): void => { target.addEventListener(ev, fn); this.cleanup.push(() => target.removeEventListener(ev, fn)); };
    if (typeof document !== 'undefined') {
      on(document, 'visibilitychange', () => { if (document.visibilityState === 'hidden') { if (this.dirty) this.push(true); } else void this.poll(); });
      on(window, 'pagehide', () => { if (this.dirty) this.push(true); });
      on(window, 'online', () => { if (this.dirty) this.schedule(0); else void this.poll(); });
    }
    void this.poll();
  }

  stop(): void {
    clearTimeout(this.timer); clearTimeout(this.retryTimer); clearInterval(this.poller);
    this.cleanup.forEach((f) => f()); this.cleanup = []; this.attached = false;
  }

  /** Call after every change to the data. */
  changed(): void {
    this.dirty = true;              // even before attach(): a change made while the app is still starting up is sent as soon as it is attached
    if (!this.attached) return;
    const ok = this.writeCache();
    this.setStatus(ok ? 'pending' : 'cachefull');
    this.schedule(this.debounceMs);
  }

  flush(): void { this.push(false); }

  private schedule(ms: number): void { clearTimeout(this.timer); this.timer = setTimeout(() => this.push(false), ms); }

  private push(unload: boolean): void {
    if (!this.attached || !this.dirty) return;
    if (this.inflight) { this.again = true; return; }
    const sent = clone(this.opt.getData());
    const body = JSON.stringify({ baseRev: this.rev, data: sent });
    this.inflight = true;
    if (this.status !== 'cachefull') this.setStatus('saving');
    void (async () => {
      try {
        const r = await this.api('api/state', { method: 'PUT', headers: HDR, body, keepalive: unload && body.length < 60000 });
        if (r.status === 200) {
          const j = (await r.json()) as { rev: number };
          this.rev = j.rev; this.synced = sent; this.retry = 0;
          if (eq(sent, this.opt.getData())) { this.dirty = false; this.writeCache(); this.setStatus('saved'); }
          else { this.writeCache(); this.again = true; }
        } else if (r.status === 409) { // another device saved in the meantime: merge, never overwrite
          const S = (await r.json()) as ServerDoc;
          const merged = merge3(this.synced, this.opt.getData(), S.data) as Data;
          this.rev = S.rev; this.synced = clone(S.data); this.base = S.base;
          this.opt.adopt(merged, S.base);
          this.dirty = !eq(merged, S.data);
          this.writeCache();
          this.again = this.dirty;
          if (!this.dirty) this.setStatus('saved');
        } else throw new Error('HTTP ' + r.status);
      } catch {
        this.setStatus('offline');
        this.retry = Math.min(this.retry + 1, 6);
        clearTimeout(this.retryTimer);
        this.retryTimer = setTimeout(() => this.push(false), Math.min(30000, 1000 * 2 ** this.retry));
      } finally {
        this.inflight = false;
        if (this.again) { this.again = false; this.schedule(0); }
      }
    })();
  }

  /** Check the server for changes made on another device and adopt them (unless there are local unsynced edits). */
  async poll(): Promise<void> {
    if (!this.attached || this.inflight || (typeof document !== 'undefined' && document.visibilityState === 'hidden')) return;
    if (this.dirty) { if (this.status === 'offline') this.schedule(0); return; }
    try {
      const j = (await (await this.api('api/rev')).json()) as { rev: number };
      if (this.status === 'offline') this.setStatus('saved');
      if (j.rev === this.rev || this.dirty) return;
      const S = (await (await this.api('api/state')).json()) as ServerDoc;
      if (this.dirty || this.inflight) return;
      if (this.opt.adopt(S.data, S.base, true) !== false) { this.rev = S.rev; this.synced = clone(S.data); this.base = S.base; this.writeCache(); }
    } catch { this.setStatus('offline'); }
  }

  /** Explicit reload from the server (after a backup restore). */
  async reloadFromServer(): Promise<void> {
    const S = (await (await this.api('api/state')).json()) as ServerDoc;
    this.rev = S.rev; this.synced = clone(S.data); this.base = S.base; this.dirty = false;
    this.opt.adopt(S.data, S.base);
    this.writeCache(); this.setStatus('saved');
  }

  /** Replace the reference schedule (subjects, assignments, exams, sessions); used by import. */
  async pushBase(base: Base, data: Data): Promise<void> {
    const r = await this.api('api/state', { method: 'PUT', headers: HDR, body: JSON.stringify({ baseRev: this.rev, data, base }) });
    if (r.status === 409) throw new Error('conflict');
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const j = (await r.json()) as { rev: number };
    this.rev = j.rev; this.synced = clone(data); this.base = base; this.dirty = false; this.writeCache(); this.setStatus('saved');
  }
}
