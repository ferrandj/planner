import { QUESTIONS } from '../data/quizEnA1';
import { pickQuestion, quizStats, recordAnswer, shuffled } from './quiz';
import { emptyData } from './fixtures';

describe('the question bank (English, level A1)', () => {
  it('has 50 questions with unique ids', () => {
    expect(QUESTIONS).toHaveLength(50);
    expect(new Set(QUESTIONS.map((q) => q.id)).size).toBe(50);
  });
  it('every question has the three texts, one right answer and three different wrong ones', () => {
    for (const q of QUESTIONS) {
      expect(q.q.length, q.id).toBeGreaterThan(5);
      expect(q.fr.length, q.id).toBeGreaterThan(5);
      expect(q.es.length, q.id).toBeGreaterThan(5);
      expect(new Set([q.correct, ...q.wrong]).size, q.id).toBe(4);
      for (const w of q.why ? [q.why.en, q.why.fr, q.why.es] : []) expect(w.length, q.id).toBeGreaterThan(3);
    }
  });
  it('questions are not repeated in another form', () => {
    expect(new Set(QUESTIONS.map((q) => q.q)).size).toBe(50);
  });
});

describe('which question comes next', () => {
  it('goes through the course in order, one question at a time', () => {
    const d = emptyData();
    expect(pickQuestion(d.quiz).id).toBe('en-a1-01');
    recordAnswer(d, 'en-a1-01', true, '2026-10-12');
    expect(pickQuestion(d.quiz).id).toBe('en-a1-02');
  });
  it('a wrong answer comes back until it is answered right', () => {
    const d = emptyData();
    recordAnswer(d, 'en-a1-01', false, '2026-10-12');
    expect(pickQuestion(d.quiz).id).toBe('en-a1-01');
    recordAnswer(d, 'en-a1-01', true, '2026-10-13');
    expect(pickQuestion(d.quiz).id).toBe('en-a1-02');
  });
  it('once everything was answered right, it asks the one asked longest ago', () => {
    const d = emptyData();
    QUESTIONS.forEach((q, i) => recordAnswer(d, q.id, true, `2026-10-${String(10 + (i % 15)).padStart(2, '0')}`));
    const first = pickQuestion(d.quiz, QUESTIONS, () => 0);
    expect(d.quiz[first.id].at).toBe('2026-10-10');
  });
});

describe('answers', () => {
  it('are shuffled, with the right one always findable', () => {
    const q = QUESTIONS[0];
    for (let i = 0; i < 20; i++) {
      const s = shuffled(q);
      expect(s.options).toHaveLength(4);
      expect(s.options[s.answer]).toBe(q.correct);
      expect([...s.options].sort()).toEqual([q.correct, ...q.wrong].sort());
    }
    expect(new Set(Array.from({ length: 40 }, () => shuffled(q).answer)).size).toBeGreaterThan(1);
  });
  it('are counted: right and wrong, mastered questions, last day', () => {
    const d = emptyData();
    recordAnswer(d, 'en-a1-01', false, '2026-10-12'); recordAnswer(d, 'en-a1-01', true, '2026-10-13'); recordAnswer(d, 'en-a1-02', false, '2026-10-13');
    expect(d.quiz['en-a1-01']).toEqual({ ok: 1, ko: 1, at: '2026-10-13' });
    expect(quizStats(d.quiz)).toEqual({ mastered: 1, total: 50, right: 1, wrong: 2 });
  });
});
