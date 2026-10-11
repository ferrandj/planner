import { MAX_UPLOAD } from './files';

export interface PreparedFile { blob: Blob; type: string; name: string; kind: 'img' | 'file' }

/**
 * Get a picked file ready for upload. Photos are shrunk to at most 1600 px (JPEG) to keep the NAS tidy; anything that
 * cannot be decoded as an image (e.g. HEIC on some browsers) is uploaded as it is, so nothing the user adds is dropped.
 * Returns null (with `tooBig`) only when the file exceeds the upload limit.
 */
export function prepFile(f: File, maxPx = 1600): Promise<PreparedFile | { tooBig: string } | null> {
  return new Promise((resolve) => {
    let img = /^image\//.test(f.type) && f.type !== 'image/svg+xml';
    const raw = (): void => {
      if (f.size > MAX_UPLOAD) { resolve({ tooBig: f.name }); return; }
      resolve({ blob: f, type: f.type || 'application/octet-stream', name: f.name, kind: img ? 'img' : 'file' });
    };
    if (!img || f.type === 'image/gif' || typeof Image === 'undefined' || typeof URL.createObjectURL !== 'function') { raw(); return; }
    const u = URL.createObjectURL(f), im = new Image();
    im.onerror = () => { URL.revokeObjectURL(u); img = false; raw(); };
    im.onload = () => {
      const k = Math.min(1, maxPx / Math.max(im.width, im.height)), c = document.createElement('canvas');
      c.width = Math.round(im.width * k); c.height = Math.round(im.height * k);
      const x = c.getContext('2d');
      if (!x) { URL.revokeObjectURL(u); raw(); return; }
      x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(im, 0, 0, c.width, c.height);
      URL.revokeObjectURL(u);
      c.toBlob((b) => { if (b) resolve({ blob: b, type: 'image/jpeg', name: f.name, kind: 'img' }); else raw(); }, 'image/jpeg', 0.85);
    };
    im.src = u;
  });
}

/** Normalise a typed link: add https:// when no scheme is given; only http(s) and mailto are accepted. */
export function cleanLink(u: string): string | null {
  u = u.trim();
  if (!u) return null;
  if (!/^[a-z][a-z0-9+.-]*:/i.test(u)) u = 'https://' + u;
  return /^(https?:|mailto:)/i.test(u) ? u : null;
}
