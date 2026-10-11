import { HDR } from './sync';

export const MAX_UPLOAD = 25 * 1048576;

export async function uploadBlob(blob: Blob, type?: string, fetchFn: typeof fetch = (...a) => fetch(...a)): Promise<{ id: string; size: number }> {
  const r = await fetchFn('api/files', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': type || 'application/octet-stream', 'X-Planner-Client': HDR['X-Planner-Client'] }, body: blob });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return (await r.json()) as { id: string; size: number };
}

export function blobToDataUrl(b: Blob): Promise<string> {
  return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = () => rej(r.error); r.readAsDataURL(b); });
}

export function dataUrlToBlob(u: string): Blob {
  const i = u.indexOf(','), meta = u.slice(5, i), raw = u.slice(i + 1), type = meta.split(';')[0] || 'application/octet-stream';
  if (/;base64$/.test(meta)) {
    const s = atob(raw), a = new Uint8Array(s.length);
    for (let k = 0; k < s.length; k++) a[k] = s.charCodeAt(k);
    return new Blob([a], { type });
  }
  return new Blob([decodeURIComponent(raw)], { type });
}

/** URL of an attachment on the server (or the legacy inline data URL). */
export const noteSrc = (n: { f?: string; d?: string; n?: string }, download = false): string =>
  n.f ? 'api/files/' + n.f + (download ? '?name=' + encodeURIComponent(n.n || 'file') : '') : n.d || '';

export const fmtSize = (n: number, mo = 'Mo', ko = 'Ko'): string => (n > 1048576 ? (n / 1048576).toFixed(1) + ' ' + mo : Math.max(1, Math.round(n / 1024)) + ' ' + ko);
