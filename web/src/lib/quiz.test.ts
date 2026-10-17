import { LEVELS, QUESTIONS } from '../data/quizBank';
import { currentLevel, levelStats, pickRound, quizStats, recordAnswer, ROUND, shuffled } from './quiz';
import { emptyData } from './fixtures';

const A1 = LEVELS[0].questions, A2 = LEVELS[1].questions, B1 = LEVELS[2].questions;
const master = (d: ReturnType<typeof emptyData>, list: typeof A1): void => list.forEach((q) => recordAnswer(d, q.id, true, '2026-10-12'));

describe('the question bank (English, levels A1, A2 and B1)', () => {
  it('has the three levels in order, with plenty of questions in A2 and B1', () => {
    expect(LEVELS.map((l) => l.name)).toEqual(['A1', 'A2', 'B1']);
    expect(A1).toHaveLength(50);
    expect(A2.length).toBeGreaterThanOrEqual(100);
    expect(B1.length).toBeGreaterThanOrEqual(100);
    expect(QUESTIONS).toHaveLength(A1.length + A2.length + B1.length);
    expect(new Set(QUESTIONS.map((q) => q.id)).size).toBe(QUESTIONS.length);
    LEVELS.forEach((l) => l.questions.forEach((q) => expect(q.id.startsWith('en-' + l.id + '-'), q.id).toBe(true)));
  });
  it('every question has the three texts, one right answer, three different wrong ones, an explanation and the texts to read aloud', () => {
    for (const q of QUESTIONS) {
      expect(q.q.length, q.id).toBeGreaterThan(5);
      expect(q.fr.length, q.id).toBeGreaterThan(5);
      expect(q.es.length, q.id).toBeGreaterThan(5);
      expect(q.wrong, q.id).toHaveLength(3);
      expect(new Set([q.correct, ...q.wrong]).size, q.id).toBe(4);
      for (const w of [q.why.en, q.why.fr, q.why.es]) expect(w.length, q.id).toBeGreaterThan(3);
      expect(q.qa.length, q.id).toBeGreaterThan(2);
      expect(q.aa.length, q.id).toBeGreaterThan(1);
      expect(q.qa, q.id).not.toMatch(/[_“”«»—]/);                 // what the voice reads is plain
      expect(q.aa, q.id).not.toMatch(/[_“”«»—]/);
    }
  });
  it('a question is not repeated in another form', () => {
    expect(new Set(QUESTIONS.map((q) => q.q + '|' + q.correct)).size).toBe(QUESTIONS.length);
  });
  it('A2 and B1 are about sentences, not single words', () => {
    for (const q of [...A2, ...B1]) expect(q.q.split(/\s+/).length, q.id).toBeGreaterThanOrEqual(4);
    expect([...A2, ...B1].filter((q) => q.q.includes('___')).length).toBeGreaterThan(80);          // sentences with a gap
    expect([...A2, ...B1].filter((q) => q.q.startsWith('Which sentence')).length).toBeGreaterThan(10);
  });
  it('the right answer is never the one that the three others make obvious by length alone', () => {
    // a cheap guard against a bank where "the longest answer is the right one"
    const longest = [...A2, ...B1].filter((q) => [q.correct, ...q.wrong].every((o) => o.length <= q.correct.length) && q.wrong.some((o) => o.length < q.correct.length - 8));
    expect(longest.length).toBeLessThan(([...A2, ...B1].length) * 0.4);
  });
});

describe('which questions come next', () => {
  it('a round is five questions, in the order of the course', () => {
    const d = emptyData();
    expect(ROUND).toBe(5);
    expect(pickRound(d.quiz).map((q) => q.id)).toEqual(A1.slice(0, 5).map((q) => q.id));
    recordAnswer(d, A1[0].id, true, '2026-10-12');
    expect(pickRound(d.quiz).map((q) => q.id)).toEqual(A1.slice(1, 6).map((q) => q.id));
  });
  it('a wrong answer comes back until it is answered right', () => {
    const d = emptyData();
    A1.slice(0, 5).forEach((q, i) => recordAnswer(d, q.id, i !== 1, '2026-10-12'));
    expect(pickRound(d.quiz).map((q) => q.id)).toEqual([A1[1], ...A1.slice(5, 9)].map((q) => q.id));
    recordAnswer(d, A1[1].id, true, '2026-10-13');
    expect(pickRound(d.quiz)[0].id).toBe(A1[5].id);
  });
  it('the next level starts when every question of the level has been answered right', () => {
    const d = emptyData();
    master(d, A1.slice(0, 49));
    expect(currentLevel(d.quiz).id).toBe('a1');
    expect(pickRound(d.quiz).map((q) => q.id)).toEqual([A1[49], ...A2.slice(0, 4)].map((q) => q.id));      // the last A1 question, then A2 follows
    recordAnswer(d, A1[49].id, true, '2026-10-12');
    expect(currentLevel(d.quiz).id).toBe('a2');
    expect(levelStats(d.quiz).map((x) => [x.name, x.done])).toEqual([['A1', true], ['A2', false], ['B1', false]]);
    expect(pickRound(d.quiz).map((q) => q.level)).toEqual(['a2', 'a2', 'a2', 'a2', 'a2']);
    master(d, A2);
    expect(currentLevel(d.quiz).id).toBe('b1');
    expect(pickRound(d.quiz)[0].id).toBe(B1[0].id);
  });
  it('once everything was answered right, it reviews the questions asked longest ago', () => {
    const d = emptyData();
    QUESTIONS.forEach((q, i) => recordAnswer(d, q.id, true, `2026-09-${String(1 + (i % 28)).padStart(2, '0')}`));
    const r = pickRound(d.quiz, 5, QUESTIONS, () => 0);
    expect(r).toHaveLength(5);
    expect(new Set(r.map((q) => q.id)).size).toBe(5);
    r.forEach((q) => expect(d.quiz[q.id].at).toBe('2026-09-01'));
    expect(currentLevel(d.quiz).id).toBe('b1');
    expect(levelStats(d.quiz).every((x) => x.done)).toBe(true);
  });
  it('when fewer than five are left, the round is completed with questions to review', () => {
    const d = emptyData();
    master(d, QUESTIONS.slice(0, QUESTIONS.length - 2));
    const r = pickRound(d.quiz);
    expect(r).toHaveLength(5);
    expect(r.slice(0, 2).map((q) => q.id)).toEqual(QUESTIONS.slice(-2).map((q) => q.id));
    expect(new Set(r.map((q) => q.id)).size).toBe(5);
  });
});

describe('answers', () => {
  it('are shuffled, with the right one always findable', () => {
    const q = A1[0];
    for (let i = 0; i < 20; i++) {
      const s = shuffled(q);
      expect(s.options).toHaveLength(4);
      expect(s.options[s.answer]).toBe(q.correct);
      expect([...s.options].sort()).toEqual([q.correct, ...q.wrong].sort());
    }
    expect(new Set(Array.from({ length: 40 }, () => shuffled(q).answer)).size).toBeGreaterThan(1);
  });
  it('are counted: right and wrong, mastered questions, last day, per level', () => {
    const d = emptyData();
    recordAnswer(d, 'en-a1-01', false, '2026-10-12'); recordAnswer(d, 'en-a1-01', true, '2026-10-13'); recordAnswer(d, 'en-a1-02', false, '2026-10-13');
    expect(d.quiz['en-a1-01']).toEqual({ ok: 1, ko: 1, at: '2026-10-13' });
    expect(quizStats(d.quiz)).toEqual({ mastered: 1, total: QUESTIONS.length, right: 1, wrong: 2 });
    expect(levelStats(d.quiz)[0]).toMatchObject({ mastered: 1, total: 50, done: false });
  });
});
