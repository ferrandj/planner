import { render } from '@testing-library/react';
import type { ReactElement } from 'react';
import { App } from '../App';
import { SyncClient } from '../lib/sync';
import { AppProvider } from '../state/app';
import type { BootResult, Data } from '../types';
import { FakeServer } from './fakeServer';

/** Mount the whole app against an in-memory fake server (no network, no timers faked unless the test asks). */
export async function mountApp(opts: { seed?: (d: Data) => void; today?: string; server?: FakeServer; element?: ReactElement } = {}): Promise<{ srv: FakeServer; sync: SyncClient; boot: BootResult; utils: ReturnType<typeof render> }> {
  const srv = opts.server || new FakeServer();
  opts.seed?.(srv.data);
  const sync = new SyncClient({ fetchFn: srv.fetch as typeof fetch, pollMs: 3_600_000, debounceMs: 5 });
  const boot = await sync.load();
  const utils = render(<AppProvider boot={boot} sync={sync}>{opts.element || <App />}</AppProvider>);
  return { srv, sync, boot, utils };
}

/** Wait until the app has written everything to the fake server. */
export async function saved(sync: SyncClient): Promise<void> {
  await vi.waitFor(() => { if (sync.dirty || sync.status !== 'saved') throw new Error('not saved yet: ' + sync.status); }, { timeout: 2000 });
}
