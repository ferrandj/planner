import type { Data } from '../types';
import { LEVELS, QUESTIONS, type Level, type Question } from '../data/quizBank';

export type QuizLog = Data['quiz'];

/** Questions asked each time the app is opened. */
export const ROUND = 5;

const mastered = (log: QuizLog, q: Question): boolean => (log[q.id]?.ok ?? 0) > 0;
const askedAt = (log: QuizLog, q: Question): number => Date.parse(log[q.id]?.at || '1970-01-01') || 0;

/**
 * The questions for this visit: the next ones in the course that have not been answered right yet (so a wrong answer comes back,
 * and a level is finished before the next one starts). When fewer than `count` are left, the rest are the ones asked longest ago.
 */
export function pickRound(log: QuizLog, count: number = ROUND, questions: Question[] = QUESTIONS, rand: () => number = Math.random): Question[] {
  const out = questions.filter((q) => !mastered(log, q)).slice(0, count);
  if (out.length >= count) return out;
  const rest = questions.filter((q) => !out.includes(q)).sort((a, b) => askedAt(log, a) - askedAt(log, b) || a.id.localeCompare(b.id));
  // among the ones asked equally long ago, a random start (so that the same five do not come back every time)
  const oldest = rest.length ? askedAt(log, rest[0]) : 0;
  const ties = rest.filter((q) => askedAt(log, q) === oldest);
  const start = ties.length > 1 ? Math.floor(rand() * ties.length) : 0;
  const ordered = [...ties.slice(start), ...ties.slice(0, start), ...rest.slice(ties.length)];
  return out.concat(ordered.slice(0, count - out.length));
}

export interface Shown { options: string[]; answer: number }

/** The four answers in a random order (Fisher-Yates), and where the right one is. */
export function shuffled(q: Question, rand: () => number = Math.random): Shown {
  const all = [q.correct, ...q.wrong];
  for (let i = all.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [all[i], all[j]] = [all[j], all[i]]; }
  return { options: all, answer: all.indexOf(q.correct) };
}

export interface LevelStat { id: Level; name: string; mastered: number; total: number; done: boolean }

/** Progress in each level. */
export function levelStats(log: QuizLog): LevelStat[] {
  return LEVELS.map((l) => {
    const m = l.questions.filter((q) => mastered(log, q)).length;
    return { id: l.id, name: l.name, mastered: m, total: l.questions.length, done: m === l.questions.length };
  });
}

/** The level being worked on: the first one that is not finished (the last one when everything is). */
export function currentLevel(log: QuizLog): LevelStat {
  const s = levelStats(log);
  return s.find((x) => !x.done) ?? s[s.length - 1];
}

export function quizStats(log: QuizLog, questions: Question[] = QUESTIONS): { mastered: number; total: number; right: number; wrong: number } {
  let m = 0, right = 0, wrong = 0;
  for (const q of questions) { const e = log[q.id]; if (!e) continue; if (e.ok > 0) m++; right += e.ok; wrong += e.ko; }
  return { mastered: m, total: questions.length, right, wrong };
}

export function recordAnswer(d: Data, id: string, right: boolean, day: string): void {
  const e = d.quiz[id] || { ok: 0, ko: 0, at: '' };
  if (right) e.ok++; else e.ko++;
  e.at = day;
  d.quiz[id] = e;
}
