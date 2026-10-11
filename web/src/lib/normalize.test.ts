import { bgClean, mergeImport, normalizeData } from './normalize';
import { emptyData } from './fixtures';

describe('normalizeData', () => {
  it('fills every default on an empty / garbage input', () => {
    for (const raw of [undefined, null, {}, [], 'x', 5]) {
      const d = normalizeData(raw);
      expect(d).toMatchObject({ notes: {}, edits: {}, hidden: {}, done: {}, rendu: {}, custom: [], favs: [], stickers: {}, bg: [], bgv: 2, printOff: {} });
      expect(d.prefs).toMatchObject({ mode: 'auto', lang: 'fr', pal: 'perso', ppal: 'perso' });
      expect(d.prefs.custom).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });
  it('keeps everything the user saved', () => {
    const saved = { notes: { k: [{ id: 'n1', k: 'text', v: 'hi' }] }, edits: { app: { title: 'T' } }, done: { a: true }, rendu: { 'd1:m1': true }, hidden: { x: true }, custom: [{ id: 'c1', title: 't', subject: '', date: '2026-01-01', time: '', tend: '' }], favs: ['#aabbcc'], printOff: { '2026-09': true }, prefs: { mode: 'dark', lang: 'es', pal: 'perso', custom: '#112233', ppal: 'perso', pcustom: '#445566', sync: true } };
    const d = normalizeData(JSON.parse(JSON.stringify(saved)));
    expect(d).toMatchObject(saved);
  });
  it('does not mutate its input', () => {
    const raw = { done: { a: true } };
    normalizeData(raw);
    expect(raw).toEqual({ done: { a: true } });
  });
  it('is idempotent', () => {
    const once = normalizeData({ prefs: { pal: 'rose', ppal: 'bleu' }, favs: ['#aaaaaa', 'bad'] });
    expect(normalizeData(once)).toEqual(once);
  });
  it('migrates legacy palettes to custom colours and sanitises prefs', () => {
    const d = normalizeData({ prefs: { pal: 'rose', ppal: 'orange', mode: 'weird', lang: 'xx', custom: 'nope' } });
    expect(d.prefs).toMatchObject({ pal: 'perso', custom: '#E0407A', ppal: 'perso', pcustom: '#D86A1A', mode: 'auto', lang: 'fr' });
    expect(normalizeData({ prefs: { pal: 'bleu', ppal: 'sobre' } }).prefs.pcustom).toBe('#3B7BE8');
  });
  it('keeps at most 30 valid favourite colours', () => {
    const favs = Array.from({ length: 40 }, (_, i) => '#' + (0x100000 + i).toString(16)).concat(['bad', '#12']);
    const d = normalizeData({ favs });
    expect(d.favs).toHaveLength(30);
    expect(d.favs.every((c) => /^#[0-9a-f]{6}$/i.test(c))).toBe(true);
  });
});

describe('bgClean', () => {
  const s = { id: 'b1', t: 'ours', c: '#112233', x: 0.5, y: 0.5, s: 9, r: 0 };
  it('drops invalid stickers and clamps values', () => {
    const out = bgClean([s, null, { id: 1 }, { ...s, id: 'b2', x: 5, y: -2, s: 999, r: 'z' }, { ...s, id: 'b3', x: NaN }], false, 1000, 800);
    expect(out.map((b) => b.id)).toEqual(['b1', 'b2']);
    expect(out[1]).toMatchObject({ x: 1, y: 0, s: 50, r: 0 });
  });
  it('rescales the legacy coordinate system', () => {
    const out = bgClean([{ ...s, y: 0.5, s: 10 }], true, 1000, 500);
    expect(out[0].y).toBeCloseTo(0.25);
    expect(out[0].s).toBeCloseTo(5);
  });
  it('non-array input gives an empty list', () => { expect(bgClean(undefined, false, 1, 1)).toEqual([]); });
});

describe('mergeImport', () => {
  it('is a union: nothing existing is deleted, imported values win on conflicts', () => {
    const cur = emptyData();
    cur.done = { a: true }; cur.edits = { app: { title: 'Current' } }; cur.notes = { k: [{ id: 'n1', k: 'text', v: 'keep me' }] };
    const imported = { done: { b: true }, edits: { app: { title: 'Imported' } }, notes: { k: [{ id: 'n2', k: 'text', v: 'new' }] }, rendu: { 'd1:m1': true } };
    const r = mergeImport(cur, imported);
    expect(r.done).toEqual({ a: true, b: true });
    expect(r.edits.app.title).toBe('Imported');
    expect(r.notes.k.map((n) => n.id).sort()).toEqual(['n1', 'n2']);
    expect(r.rendu).toEqual({ 'd1:m1': true });
  });
  it('importing the same data twice changes nothing', () => {
    const cur = emptyData(); cur.done = { a: true };
    const once = mergeImport(cur, { done: { b: true } });
    expect(mergeImport(once, { done: { b: true } })).toEqual(once);
  });
});
