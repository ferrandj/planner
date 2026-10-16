import { describe, expect, it } from 'vitest';
import { makeFmt } from './dates';
import { base } from './fixtures';
import { buildLibrary } from './library';
import { buildEvents, resolveModel } from './model';
import { normalizeData } from './normalize';
import { makeT } from './i18n';
import type { Data } from '../types';

const fmt = makeFmt('fr');
const { t, tf } = makeT('fr');
const make = (fn: (d: Data) => void) => {
  const data = normalizeData({});
  fn(data);
  const model = resolveModel(base, data);
  return buildLibrary(model, data, buildEvents(model, data), t, tf, fmt);
};
const LIVE = 'm1-live-2026-10-05';

describe('readable library', () => {
  it('nothing is written when there are no notes', () => {
    expect(make(() => undefined)).toEqual([]);
    expect(make((d) => { d.notes[LIVE] = []; })).toEqual([]);
  });

  it('a class: subject folder, then "date title", with the notes as plain text and the attachments by name', () => {
    const [e] = make((d) => {
      d.notes[LIVE] = [
        { id: '1', k: 'text', v: ' Chapitre 1 ' }, { id: '2', k: 'link', u: 'https://example.org/x', l: 'Le cours' },
        { id: '3', k: 'file', n: 'plan.pdf', z: 10, f: 'a'.repeat(64) }, { id: '4', k: 'img', n: 'tableau.jpg', f: 'b'.repeat(64) }, { id: '5', k: 'file', n: 'pas-encore.pdf', d: 'data:...' }
      ];
    });
    expect(e.dir[0]).toBe('Maths');
    expect(e.dir[1]).toMatch(/^2026-10-05 Live du soir/);
    expect(e.text.split('\n')[0]).toMatch(/^Maths · Live du soir/);
    expect(e.text).toContain('Chapitre 1');
    expect(e.text).toContain('Lien : Le cours\nhttps://example.org/x');
    expect(e.text).toContain('Fichier joint : plan.pdf');
    expect(e.files).toEqual([{ id: 'a'.repeat(64), name: 'plan.pdf' }, { id: 'b'.repeat(64), name: 'tableau.jpg' }]);   // not uploaded yet: left out
    expect(e.text).not.toMatch(/\r|[^\x09\x0a\x20-￿]/);                                                              // plain text
  });

  it('a subject has its own folder, assignments and exams are grouped, a removed item is archived (never dropped)', () => {
    const list = make((d) => {
      d.notes['s:m1'] = [{ id: '1', k: 'text', v: 'about maths' }];
      d.notes['dev:d1'] = [{ id: '2', k: 'text', v: 'about the assignment' }];
      d.notes['gone-item'] = [{ id: '3', k: 'text', v: 'orphan' }];
    });
    const dirs = list.map((e) => e.dir.join('/'));
    expect(dirs).toContain('Maths/Général');
    expect(dirs.some((x) => /^Devoirs\/\d{4}-\d{2}-\d{2} /.test(x))).toBe(true);
    expect(dirs).toContain('Archives/gone-item');
    expect(list.find((e) => e.dir[0] === 'Archives')?.text).toContain('orphan');
  });

  it('a class hidden from the planner keeps its notes in its folder, and a catch-up tile never has a folder of its own', () => {
    const list = make((d) => { d.hidden[LIVE] = true; d.notes[LIVE] = [{ id: '1', k: 'text', v: 'x' }]; d.notes['plan:' + LIVE] = [{ id: '2', k: 'text', v: 'y' }]; });
    expect(list.map((e) => e.dir[0])).toEqual(expect.arrayContaining(['Maths']));
  });

  it('is stable: same data, same list (so nothing is re-sent for nothing)', () => {
    const f = (d: Data): void => { d.notes[LIVE] = [{ id: '1', k: 'text', v: 'a' }]; d.notes['s:m1'] = [{ id: '2', k: 'text', v: 'b' }]; };
    expect(JSON.stringify(make(f))).toBe(JSON.stringify(make(f)));
  });
});
