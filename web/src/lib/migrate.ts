import type { Data } from '../types';
import { dataUrlToBlob, uploadBlob } from './files';

/**
 * Attachments saved by the earlier version live inside the JSON as data: URLs. Upload them to the server one by one
 * and replace them by a file reference. If an upload fails the attachment is simply left as it was (nothing is lost).
 */
export async function migrateInlineNotes(get: () => Data, update: (fn: (d: Data) => void) => void, upload = uploadBlob): Promise<number> {
  const todo: Array<[string, string, string]> = [];
  for (const [k, list] of Object.entries(get().notes)) for (const n of list) if (!n.f && typeof n.d === 'string' && n.d.startsWith('data:')) todo.push([k, n.id, n.d]);
  let moved = 0;
  for (const [key, id, url] of todo) {
    try {
      const b = dataUrlToBlob(url);
      const { id: fid } = await upload(b, b.type);
      update((d) => { const n = (d.notes[key] || []).find((x) => x.id === id); if (n && !n.f) { n.f = fid; delete n.d; moved++; } });
    } catch { /* keep the inline copy; retried next time */ }
  }
  return moved;
}
