import { afterEach, beforeEach, vi } from 'vitest';
import type { Data, SyncStatus } from '../types';
import { FakeServer } from '../test/fakeServer';
import { clone } from './merge';
import { CACHE_KEY, SyncClient } from './sync';

let srv: FakeServer;
let sc: SyncClient;
let live: Data;
let statuses: SyncStatus[];
let adopted: Data[];

const make = (): SyncClient => new SyncClient({ fetchFn: srv.fetch as typeof fetch, pollMs: 60_000, debounceMs: 10 });
async function boot(): Promise<void> {
  const b = await sc.load();
  live = b.data;
  sc.attach({ getData: () => live, adopt: (d) => { live = d; adopted.push(d); }, onStatus: (s) => statuses.push(s) });
}
const edit = (fn: (d: Data) => void): void => { fn(live); sc.changed(); };
const settle = async (ms = 50): Promise<void> => { await vi.advanceTimersByTimeAsync(ms); };
const cache = (): { dirty: boolean; data: Data; rev: number } => JSON.parse(localStorage.getItem(CACHE_KEY)!);

beforeEach(() => { vi.useFakeTimers(); srv = new FakeServer(); sc = make(); statuses = []; adopted = []; });
afterEach(() => { sc.stop(); vi.useRealTimers(); });

describe('loading', () => {
  it('returns the server state', async () => {
    srv.data.done = { a: true };
    const b = await sc.load();
    expect(b.data.done).toEqual({ a: true });
    expect(b.offline).toBe(false);
    expect(b.rev).toBe(1);
  });
  it('throws when the server is down and this browser has no copy (never invents data)', async () => {
    srv.down = true;
    await expect(sc.load()).rejects.toThrow();
  });
  it('starts from the browser copy when the server is down', async () => {
    srv.data.done = { a: true };
    await boot(); sc.stop();
    srv.down = true;
    const b = await make().load();
    expect(b.offline).toBe(true);
    expect(b.data.done).toEqual({ a: true });
  });
  it('a non-OK answer is treated like an outage', async () => {
    const broken = new SyncClient({ fetchFn: (async () => new Response('x', { status: 500 })) as typeof fetch });
    await expect(broken.load()).rejects.toThrow('HTTP 500');
  });
});

describe('saving', () => {
  it('writes the browser cache immediately and the server shortly after (debounced)', async () => {
    await boot();
    edit((d) => { d.done.x = true; });
    expect(cache().dirty).toBe(true);
    expect(cache().data.done.x).toBe(true);
    expect(srv.puts).toHaveLength(0);
    await settle();
    expect(srv.puts).toHaveLength(1);
    expect(srv.data.done.x).toBe(true);
    expect(sc.status).toBe('saved');
    expect(cache().dirty).toBe(false);
  });
  it('many quick edits become one request', async () => {
    await boot();
    for (let i = 0; i < 20; i++) edit((d) => { d.done['k' + i] = true; });
    await settle();
    expect(srv.puts).toHaveLength(1);
    expect(Object.keys(srv.data.done)).toHaveLength(20);
  });
  it('an edit made while a save is in flight is sent right after', async () => {
    await boot();
    edit((d) => { d.done.a = true; });
    await vi.advanceTimersByTimeAsync(10);        // first PUT starts
    edit((d) => { d.done.b = true; });            // lands while in flight (or just after)
    await settle(200);
    expect(srv.data.done).toEqual({ a: true, b: true });
    expect(sc.status).toBe('saved');
  });
  it('never pushes when nothing changed', async () => {
    await boot();
    sc.flush();
    await settle();
    expect(srv.puts).toHaveLength(0);
  });
});

describe('changes made while the app is still starting', () => {
  it('a change made before attach() is not forgotten: it is sent as soon as the client is attached', async () => {
    const b = await sc.load();
    live = b.data;
    live.done = { early: true };
    sc.changed();                                                         // e.g. a component updating the data in its first effect
    sc.attach({ getData: () => live, adopt: (d) => { live = d; adopted.push(d); }, onStatus: (s) => statuses.push(s) });
    await settle(100);
    expect(srv.data.done).toEqual({ early: true });
    expect(adopted).toEqual([]);                                          // and the server's older copy never replaced it
  });
});

describe('two devices', () => {
  it('a stale write is merged, not overwritten', async () => {
    await boot();
    srv.otherDevice((d) => { d.done.fromPhone = true; });   // phone saved first
    edit((d) => { d.done.fromPc = true; });                  // PC still on the old revision
    await settle(100);
    expect(srv.data.done).toEqual({ fromPhone: true, fromPc: true });
    expect(live.done).toEqual({ fromPhone: true, fromPc: true });
    expect(adopted.length).toBeGreaterThan(0);
    expect(sc.status).toBe('saved');
  });
  it('polling picks up changes from another device when there are no local edits', async () => {
    await boot();
    srv.otherDevice((d) => { d.done.remote = true; });
    await sc.poll();
    expect(live.done.remote).toBe(true);
    expect(sc.rev).toBe(srv.rev);
  });
  it('polling is postponed (not lost) while the user is typing', async () => {
    const b = await sc.load();
    live = b.data;
    let busy = true;
    sc.attach({ getData: () => live, adopt: (d, _b, quiet) => { if (quiet && busy) return false; live = d; }, onStatus: () => {} });
    srv.otherDevice((d) => { d.done.remote = true; });
    await sc.poll();
    expect(live.done.remote).toBeUndefined();
    busy = false;
    await sc.poll();
    expect(live.done.remote).toBe(true);
  });
  it('polling does not overwrite unsynced local edits', async () => {
    await boot();
    srv.down = true;
    edit((d) => { d.done.mine = true; });
    await settle(20);
    srv.down = false;
    srv.otherDevice((d) => { d.done.theirs = true; });
    await sc.poll();                       // dirty -> must not adopt
    expect(live.done.theirs).toBeUndefined();
    await settle(3000);                    // retry succeeds via 409 + merge
    expect(srv.data.done).toEqual({ theirs: true, mine: true });
  });
});

describe('offline', () => {
  it('keeps edits locally, shows offline, retries with backoff and syncs when back', async () => {
    await boot();
    srv.down = true;
    edit((d) => { d.done.a = true; });
    await settle(20);
    expect(sc.status).toBe('offline');
    expect(cache().dirty).toBe(true);
    expect(cache().data.done.a).toBe(true);
    await settle(10_000);
    expect(sc.status).toBe('offline');
    srv.down = false;
    await settle(40_000);
    expect(srv.data.done.a).toBe(true);
    expect(sc.status).toBe('saved');
    expect(cache().dirty).toBe(false);
  });
  it('edits from a closed tab are merged into the server on the next start', async () => {
    await boot();
    srv.down = true;
    edit((d) => { d.done.unsynced = true; });
    await settle(20);
    sc.stop();                                       // tab closed
    srv.down = false;
    srv.otherDevice((d) => { d.done.other = true; }); // meanwhile another device saved
    const sc2 = make(); sc = sc2;
    const b = await sc2.load();
    expect(b.data.done).toEqual({ unsynced: true, other: true });
    live = b.data;
    sc2.attach({ getData: () => live, adopt: (d) => { live = d; }, onStatus: () => {} });
    await vi.advanceTimersByTimeAsync(100);
    expect(srv.data.done).toEqual({ unsynced: true, other: true });
  });
  it('if the browser cache is full the server save still happens and the status says so', async () => {
    const full = { getItem: () => null, setItem: () => { throw new Error('quota'); } };
    sc = new SyncClient({ fetchFn: srv.fetch as typeof fetch, storage: full, debounceMs: 10, pollMs: 60_000 });
    await boot();
    edit((d) => { d.done.a = true; });
    expect(statuses).toContain('cachefull');
    await settle();
    expect(srv.data.done.a).toBe(true);
  });
  it('an offline poll flips the status and recovers', async () => {
    await boot();
    srv.down = true;
    await sc.poll();
    expect(sc.status).toBe('offline');
    srv.down = false;
    await sc.poll();
    expect(sc.status).toBe('saved');
  });
});

describe('explicit operations', () => {
  it('reloadFromServer adopts the restored state and is not dirty', async () => {
    await boot();
    srv.otherDevice((d) => { d.done.restored = true; });
    await sc.reloadFromServer();
    expect(live.done.restored).toBe(true);
    expect(sc.dirty).toBe(false);
    expect(sc.status).toBe('saved');
  });
  it('pushBase replaces the schedule with the data in one write; a conflict is reported, not forced', async () => {
    await boot();
    const nb = clone(srv.base); nb.s.pop();
    await sc.pushBase(nb, live);
    expect(srv.base.s).toHaveLength(1);
    srv.otherDevice(() => {});
    await expect(sc.pushBase(srv.base, live)).rejects.toThrow('conflict');
    const broken = new SyncClient({ fetchFn: (async () => new Response('x', { status: 500 })) as typeof fetch });
    await expect(broken.pushBase(srv.base, live)).rejects.toThrow('HTTP 500');
  });
  it('flush before unload sends keepalive', async () => {
    await boot();
    const spy = vi.fn(srv.fetch);
    sc = new SyncClient({ fetchFn: spy as typeof fetch, debounceMs: 10_000, pollMs: 60_000 });
    await boot();
    edit((d) => { d.done.a = true; });
    document.dispatchEvent(new Event('visibilitychange'));
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
    await settle(5);
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
    const put = spy.mock.calls.find((c) => (c[1] as RequestInit | undefined)?.method === 'PUT');
    expect((put![1] as RequestInit).keepalive).toBe(true);
  });
});
