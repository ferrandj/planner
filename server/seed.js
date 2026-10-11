'use strict';
/*
 * Initial content, used ONLY on the very first start when /data has no state.
 *
 * 1. <DATA_DIR>/seed.json, if it exists (replace the schedule without rebuilding anything).
 * 2. The default schedule bundled with the image (DEFAULT_SEED, see seed/default.json).
 * 3. Otherwise a small generic demo, relative to today's date.
 *
 * seed.json format: { "base": { "s": [], "d": [], "x": [], "e": [] }, "data": { ... optional saved settings ... } }
 *   s = subjects    { id, code, name, short, ab, c (1-4: colour slot) }
 *   d = assignments { id, ab, title, date: "YYYY-MM-DD", avail?: "YYYY-MM-DD" }
 *   x = exams       { id, title, date, end? }
 *   e = sessions    { id, subject, kind: "live"|"webconf", date, time, tag }
 */
const fs = require('fs');
const path = require('path');
const { validBase } = require('./store');

function iso(d) {
  const p = function (n) { return String(n).padStart(2, '0'); };
  return d.getUTCFullYear() + '-' + p(d.getUTCMonth() + 1) + '-' + p(d.getUTCDate());
}

function addDays(d, n) { return new Date(d.getTime() + n * 864e5); }

function demo(now) {
  const t0 = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const subjects = [1, 2, 3, 4].map(function (i) {
    return { id: 'm' + i, code: 'SUBJ' + i, name: 'Matière ' + i, short: 'Matière ' + i, ab: 'M' + i, c: i };
  });
  const events = [];
  subjects.forEach(function (s, i) {
    for (let w = 0; w < 6; w++) {
      const live = iso(addDays(t0, 1 + i + w * 7));
      events.push({ id: s.id + '-live-' + live, subject: s.id, kind: 'live', date: live, time: '18:30 – 21:30', tag: '' });
      const web = iso(addDays(t0, 3 + i + w * 14));
      events.push({ id: s.id + '-webconf-' + web, subject: s.id, kind: 'webconf', date: web, time: '12:30', tag: '' });
    }
  });
  const base = {
    s: subjects,
    d: [
      { id: 'd1', ab: 'D1', title: 'Devoir 1', date: iso(addDays(t0, 21)) },
      { id: 'd2', ab: 'D2', title: 'Devoir 2', date: iso(addDays(t0, 56)), avail: iso(addDays(t0, 28)) }
    ],
    x: [{ id: 'ex1', title: 'Examens écrits', date: iso(addDays(t0, 120)), end: iso(addDays(t0, 122)) }],
    e: events
  };
  return { base: base, data: { edits: { app: { title: 'Planner' } } } };
}

function readSeed(file) {
  let s;
  try { s = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { throw new Error(file + ' is not valid JSON: ' + e.message); }
  if (!s || !validBase(s.base)) throw new Error(file + ' must contain "base" with arrays s, d, x, e');
  console.log('[seed] using ' + file);
  return { base: s.base, data: (s.data && typeof s.data === 'object' && !Array.isArray(s.data)) ? s.data : {} };
}

/**
 * Order: <dataDir>/seed.json (your own, wins) -> the default bundled with the image -> generic demo.
 * An invalid file is an error, never a silent fallback.
 */
function load(dataDir, now, defaultSeed) {
  const own = path.join(dataDir, 'seed.json');
  if (fs.existsSync(own)) return readSeed(own);
  if (defaultSeed && fs.existsSync(defaultSeed)) return readSeed(defaultSeed);
  console.log('[seed] no seed.json found, using the generic demo content');
  return demo(now || new Date());
}

module.exports = { load, demo };
