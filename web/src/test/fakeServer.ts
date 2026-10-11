import type { Base, Data } from '../types';
import { clone } from '../lib/merge';
import { base as fixtureBase } from '../lib/fixtures';
import { normalizeData } from '../lib/normalize';

/** In-memory stand-in for the Node server's API contract (revisions, 409 on stale writes, files, backups). */
export class FakeServer {
  rev = 1;
  base: Base = clone(fixtureBase);
  data: Data = normalizeData({});
  down = false;
  puts: Array<{ baseRev: number; data: Data }> = [];
  files = new Map<string, { type: string; size: number }>();
  backups: Array<{ name: string; time: number; rev: number; tag: string; size: number }> = [];
  restored: string[] = [];

  fetch = async (input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> => {
    if (this.down) throw new TypeError('Failed to fetch');
    const url = String(input), method = (init.method || 'GET').toUpperCase();
    const json = (status: number, body: unknown): Response => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
    if (url === 'api/state' && method === 'GET') return json(200, { rev: this.rev, base: this.base, data: this.data });
    if (url === 'api/rev') return json(200, { rev: this.rev });
    if (url === 'api/state' && method === 'PUT') {
      const body = JSON.parse(String(init.body)) as { baseRev: number; data: Data; base?: Base };
      this.puts.push({ baseRev: body.baseRev, data: body.data });
      if (body.baseRev !== this.rev) return json(409, { error: 'conflict', rev: this.rev, base: this.base, data: this.data });
      this.data = body.data; if (body.base) this.base = body.base;
      this.rev++;
      return json(200, { rev: this.rev });
    }
    if (url === 'api/files' && method === 'POST') {
      const id = (this.files.size + 1).toString(16).padStart(64, '0');
      const blob = init.body as Blob;
      this.files.set(id, { type: String((init.headers as Record<string, string>)['Content-Type']), size: blob.size });
      return json(200, { id, size: blob.size });
    }
    if (url === 'api/backups') return json(200, { backups: this.backups });
    if (url === 'api/backups/restore' && method === 'POST') {
      this.restored.push(JSON.parse(String(init.body)).name);
      this.data = normalizeData({ done: { restored: true } });
      this.rev++;
      return json(200, { rev: this.rev });
    }
    return json(404, { error: 'not found' });
  };

  /** Another device saves. */
  otherDevice(mutate: (d: Data) => void): void { const d = clone(this.data); mutate(d); this.data = d; this.rev++; }
}
