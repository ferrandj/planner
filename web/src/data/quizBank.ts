import a1 from './quizEnA1.json';
import a2 from './quizEnA2.json';
import b1 from './quizEnB1.json';

/**
 * The English quiz: three levels, from the easiest to the hardest, each a list of questions kept in teaching order.
 *   A1: words with pictures, polite phrases, "to be" / "to have", numbers and days, everyday words (50)
 *   A2: past, present and future in sentences, comparing, quantities, prepositions, real-life replies, short texts
 *   B1: present perfect, conditionals, passive, reported speech, relative clauses, phrasal verbs, linking words, longer texts
 * The question is asked in English and in the language of the app; the answers are in English; after each answer a short
 * explanation says why. `qa` is what the voice reads for the question, `aa` what it reads for the right answer
 * (the audio files are listed in quizAudio.json).
 */
export type Level = 'a1' | 'a2' | 'b1';

export interface Question {
  id: string;
  level: Level;
  q: string;
  fr: string;
  es: string;
  /** the right answer, then three wrong ones (they are shuffled when shown) */
  correct: string;
  wrong: [string, string, string];
  why: { en: string; fr: string; es: string };
  /** text read aloud for the question / for the right answer */
  qa: string;
  aa: string;
}

export const LEVELS: ReadonlyArray<{ id: Level; name: string; questions: Question[] }> = [
  { id: 'a1', name: 'A1', questions: a1 as Question[] },
  { id: 'a2', name: 'A2', questions: a2 as Question[] },
  { id: 'b1', name: 'B1', questions: b1 as Question[] }
];

/** Every question, in the order of the course (A1, then A2, then B1). */
export const QUESTIONS: Question[] = LEVELS.flatMap((l) => l.questions);
