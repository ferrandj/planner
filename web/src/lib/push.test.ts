import { vi } from 'vitest';
import { disablePush, enablePush, pushEnabledHere, pushState, pushSupported, sendTest, syncReminders } from './push';

const KEY = Buffer.concat([Buffer.from([4]), Buffer.alloc(64, 7)]).toString('base64url');
const json = (o: unknown, ok = true): Response => ({ ok, json: async () => o }) as unknown as Response;

function fakeBrowser(opts: { permission?: NotificationPermission; existing?: boolean } = {}) {
  const sub = { endpoint: 'https://push.example.net/abc', toJSON: () => ({ endpoint: 'https://push.example.net/abc', keys: { p256dh: 'p', auth: 'a' } }), unsubscribe: vi.fn(async () => true) };
  let have = !!opts.existing;
  const pm = { getSubscription: vi.fn(async () => (have ? sub : null)), subscribe: vi.fn(async (_o: { userVisibleOnly: boolean; applicationServerKey: Uint8Array }) => { have = true; return sub; }) };
  const reg = { pushManager: pm };
  Object.defineProperty(window, 'isSecureContext', { value: true, configurable: true });
  Object.defineProperty(navigator, 'serviceWorker', { value: { ready: Promise.resolve(reg), getRegistration: async () => reg }, configurable: true });
  vi.stubGlobal('PushManager', function PushManager() { /* feature flag */ });
  vi.stubGlobal('Notification', { permission: opts.permission ?? 'default', requestPermission: vi.fn(async () => opts.permission ?? 'granted') });
  return { sub, pm };
}
afterEach(() => { vi.unstubAllGlobals(); Reflect.deleteProperty(navigator, 'serviceWorker'); });

describe('phone notifications (browser side)', () => {
  it('is unsupported without a secure address / push API (e.g. plain http on the LAN)', async () => {
    expect(pushSupported()).toBe(false);
    expect(await pushState()).toBe('unsupported');
    expect(await enablePush(async () => json({}))).toBe('unsupported');
  });

  it('enabling asks permission, subscribes with the server key and tells the server', async () => {
    const { pm } = fakeBrowser();
    const api = vi.fn(async (path: string, _i?: RequestInit) => (path.endsWith('key') ? json({ publicKey: KEY }) : json({ ok: true })));
    expect(await pushState()).toBe('off');
    expect(await enablePush(api)).toBe('on');
    const arg = pm.subscribe.mock.calls[0][0];
    expect(arg.userVisibleOnly).toBe(true);
    expect(arg.applicationServerKey).toHaveLength(65);
    const post = api.mock.calls.find((c) => c[0] === 'api/push/subscribe')!;
    expect(JSON.parse((post[1] as RequestInit).body as string).subscription.endpoint).toBe('https://push.example.net/abc');
    expect((post[1] as RequestInit).headers).toMatchObject({ 'X-Planner-Client': '1' });
    expect(pushEnabledHere()).toBe(true);
    expect(await pushState()).toBe('on');
  });

  it('a refused permission changes nothing', async () => {
    fakeBrowser({ permission: 'denied' });
    const api = vi.fn();
    expect(await enablePush(api)).toBe('denied');
    expect(api).not.toHaveBeenCalled();
    expect(await pushState()).toBe('denied');
    expect(pushEnabledHere()).toBe(false);
  });

  it('a server that refuses the subscription is reported', async () => {
    fakeBrowser();
    expect(await enablePush(async (p) => (p.endsWith('key') ? json({ publicKey: KEY }) : json({}, false)))).toBe('error');
    expect(pushEnabledHere()).toBe(false);
  });

  it('disabling unsubscribes the device and tells the server', async () => {
    const { sub } = fakeBrowser({ existing: true });
    localStorage.setItem('planner.push', '1');
    const api = vi.fn(async () => json({ removed: 1 }));
    await disablePush(api);
    expect(sub.unsubscribe).toHaveBeenCalled();
    expect(api).toHaveBeenCalledWith('api/push/unsubscribe', expect.objectContaining({ method: 'POST' }));
    expect(pushEnabledHere()).toBe(false);
  });

  it('test message and schedule sync report success only when the server did', async () => {
    expect(await sendTest(async () => json({ results: ['ok'] }), 'a', 'b')).toBe(true);
    expect(await sendTest(async () => json({ results: ['error:500'] }), 'a', 'b')).toBe(false);
    expect(await sendTest(async () => { throw new Error('offline'); }, 'a', 'b')).toBe(false);
    expect(await syncReminders(async () => json({}), [])).toBe(true);
    expect(await syncReminders(async () => json({}, false), [])).toBe(false);
  });
});
