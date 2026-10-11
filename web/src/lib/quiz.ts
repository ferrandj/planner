import type { Data } from '../types';
import { QUESTIONS, type Question } from '../data/quizEnA1';

export type QuizLog = Data['quiz'];

/**
 * The next question: the first one in the course that has not been answered right yet (so a wrong answer comes back the next time),
 * and, once every question has been answered right at least once, the one asked longest ago.
 */
export function pickQuestion(log: QuizLog, questions: Question[] = QUESTIONS, rand: () => number = Math.random): Question {
  const todo = questions.find((q) => !(log[q.id]?.ok > 0));
  if (todo) return todo;
  const oldest = questions.reduce((m, q) => Math.min(m, Date.parse(log[q.id]?.at || '1970-01-01') || 0), Infinity);
  const ties = questions.filter((q) => (Date.parse(log[q.id]?.at || '1970-01-01') || 0) === oldest);
  return ties[Math.floor(rand() * ties.length)] ?? questions[0];
}

export interface Shown { options: string[]; answer: number }

/** The four answers in a random order (Fisher-Yates), and where the right one is. */
export function shuffled(q: Question, rand: () => number = Math.random): Shown {
  const all = [q.correct, ...q.wrong];
  for (let i = all.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [all[i], all[j]] = [all[j], all[i]]; }
  return { options: all, answer: all.indexOf(q.correct) };
}

export function quizStats(log: QuizLog, questions: Question[] = QUESTIONS): { mastered: number; total: number; right: number; wrong: number } {
  let mastered = 0, right = 0, wrong = 0;
  for (const q of questions) { const e = log[q.id]; if (!e) continue; if (e.ok > 0) mastered++; right += e.ok; wrong += e.ko; }
  return { mastered, total: questions.length, right, wrong };
}

export function recordAnswer(d: Data, id: string, right: boolean, day: string): void {
  const e = d.quiz[id] || { ok: 0, ko: 0, at: '' };
  if (right) e.ok++; else e.ko++;
  e.at = day;
  d.quiz[id] = e;
}
