'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { merge3 } = require('../public/merge.js');

test('independent checkbox edits on two devices are both kept', () => {
  const base = { done: { a: true } };
  const mine = { done: { a: true, b: true } };
  const theirs = { done: { a: true, c: true } };
  assert.deepStrictEqual(merge3(base, mine, theirs).done, { a: true, c: true, b: true });
});

test('un-checking on one device is not undone by an unrelated change on the other', () => {
  const base = { done: { a: true }, prefs: { lang: 'fr' } };
  const mine = { done: {}, prefs: { lang: 'fr' } };
  const theirs = { done: { a: true }, prefs: { lang: 'en' } };
  const r = merge3(base, mine, theirs);
  assert.deepStrictEqual(r.done, {});
  assert.strictEqual(r.prefs.lang, 'en');
});

test('same scalar edited on both sides: this device wins', () => {
  assert.strictEqual(merge3({ t: 'a' }, { t: 'mine' }, { t: 'theirs' }).t, 'mine');
});

test('id arrays: additions from both sides are kept, no duplicates', () => {
  const base = { notes: { k: [{ id: 'n1', v: 'x' }] } };
  const mine = { notes: { k: [{ id: 'n1', v: 'x' }, { id: 'n2', v: 'mine' }] } };
  const theirs = { notes: { k: [{ id: 'n1', v: 'x' }, { id: 'n3', v: 'theirs' }] } };
  const ids = merge3(base, mine, theirs).notes.k.map((n) => n.id).sort();
  assert.deepStrictEqual(ids, ['n1', 'n2', 'n3']);
});

test('id arrays: delete vs edit keeps the edit; plain delete is honoured', () => {
  const base = { l: [{ id: 'a', v: 1 }, { id: 'b', v: 1 }] };
  const mine = { l: [{ id: 'b', v: 1 }] };                     // I deleted a
  const theirs = { l: [{ id: 'a', v: 2 }, { id: 'b', v: 1 }] }; // they edited a
  assert.deepStrictEqual(merge3(base, mine, theirs).l.map((x) => x.id + x.v), ['a2', 'b1']);
  const theirs2 = { l: [{ id: 'a', v: 1 }, { id: 'b', v: 1 }] };
  assert.deepStrictEqual(merge3(base, mine, theirs2).l.map((x) => x.id), ['b']);
});

test('plain arrays behave as sets', () => {
  const r = merge3({ favs: ['#111111', '#222222'] }, { favs: ['#111111', '#333333'] }, { favs: ['#111111', '#222222', '#444444'] });
  assert.deepStrictEqual(r.favs.sort(), ['#111111', '#333333', '#444444']);
});

test('from an empty base (first import) everything is a union', () => {
  const r = merge3({}, { done: { a: true }, favs: ['#aaaaaa'] }, { done: { b: true }, favs: ['#bbbbbb'] });
  assert.deepStrictEqual(r.done, { b: true, a: true });
  assert.deepStrictEqual(r.favs.sort(), ['#aaaaaa', '#bbbbbb']);
});

test('inputs are not mutated and result is a deep copy', () => {
  const mine = { a: { b: [1] } }, theirs = { a: { b: [1], c: 1 } }, base = { a: { b: [1] } };
  const r = merge3(base, mine, theirs);
  r.a.b.push(2);
  assert.deepStrictEqual(mine, { a: { b: [1] } });
  assert.deepStrictEqual(theirs, { a: { b: [1], c: 1 } });
});
