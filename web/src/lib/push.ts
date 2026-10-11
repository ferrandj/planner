/** Phone notifications (Web Push): this device subscribes, the server keeps the schedule and sends the message when it is due. */

type Api = (path: string, init?: RequestInit) => Promise<Response>;
const HEADERS = { 'Content-Type': 'application/json', 'X-Planner-Client': '1' };
const KEY = 'planner.push';

export type PushState = 'unsupported' | 'denied' | 'off' | 'on';

/** Notifications need a secure address (HTTPS or localhost), a service worker and the push API. */
export const pushSupported = (): boolean =>
  typeof window !== 'undefined' && !!window.isSecureContext && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

export const pushEnabledHere = (): boolean => { try { return localStorage.getItem(KEY) === '1'; } catch { return false; } };
const remember = (on: boolean): void => { try { if (on) localStorage.setItem(KEY, '1'); else localStorage.removeItem(KEY); } catch { /* blocked storage */ } };

export async function pushState(): Promise<PushState> {
  if (!pushSupported()) return 'unsupported';
  if (Notification.permission === 'denied') return 'denied';
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = await reg?.pushManager.getSubscription();
    if (sub) { remember(true); return 'on'; }
  } catch { /* fall through */ }
  remember(false);
  return 'off';
}

function keyBytes(b64url: string): Uint8Array {
  const pad = '='.repeat((4 - (b64url.length % 4)) % 4);
  const raw = atob((b64url + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

export async function enablePush(api: Api): Promise<PushState | 'error'> {
  if (!pushSupported()) return 'unsupported';
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') return perm === 'denied' ? 'denied' : 'off';
  try {
    const reg = await navigator.serviceWorker.ready;
    const { publicKey } = (await (await api('api/push/key')).json()) as { publicKey: string };
    const sub = (await reg.pushManager.getSubscription()) || await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(publicKey) as BufferSource });
    const r = await api('api/push/subscribe', { method: 'POST', headers: HEADERS, body: JSON.stringify({ subscription: sub.toJSON() }) });
    if (!r.ok) return 'error';
    remember(true);
    return 'on';
  } catch { return 'error'; }
}

export async function disablePush(api: Api): Promise<void> {
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = await reg?.pushManager.getSubscription();
    if (sub) {
      await api('api/push/unsubscribe', { method: 'POST', headers: HEADERS, body: JSON.stringify({ endpoint: sub.endpoint }) }).catch(() => undefined);
      await sub.unsubscribe();
    }
  } finally { remember(false); }
}

export async function sendTest(api: Api, title: string, body: string): Promise<boolean> {
  try {
    const r = await api('api/push/test', { method: 'POST', headers: HEADERS, body: JSON.stringify({ title, body }) });
    const j = (await r.json()) as { results?: string[] };
    return r.ok && !!j.results?.some((x) => x === 'ok');
  } catch { return false; }
}

export async function syncReminders(api: Api, items: unknown[]): Promise<boolean> {
  try { return (await api('api/reminders', { method: 'PUT', headers: HEADERS, body: JSON.stringify({ items }) })).ok; } catch { return false; }
}
