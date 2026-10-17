import { existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import audio from '../data/quizAudio.json';
import { QUESTIONS } from '../data/quizBank';

const DIR = join(__dirname, '..', '..', 'public', 'audio', 'en');
const FILES = audio as Record<string, string>;

describe('the recordings of the quiz', () => {
  it('every question has a recording for the question and for the right answer', () => {
    const missing = QUESTIONS.flatMap((q) => [q.qa, q.aa].filter((t) => !FILES[t]).map((t) => q.id + ': ' + t));
    expect(missing).toEqual([]);
  });
  it('every recording is a real file (not empty), and no file is left over', () => {
    const names = Object.values(FILES);
    expect(new Set(names).size).toBe(names.length);
    for (const n of names) {
      expect(existsSync(join(DIR, n)), n).toBe(true);
      expect(statSync(join(DIR, n)).size, n).toBeGreaterThan(1200);
      expect(n).toMatch(/^[0-9a-f]{12}\.mp3$/);
    }
    expect(readdirSync(DIR).filter((f) => f.endsWith('.mp3')).sort()).toEqual([...names].sort());
  });
  it('the files are mp3 (an MPEG audio frame header at the start, possibly after an ID3 tag)', () => {
    const { readFileSync } = require('node:fs') as typeof import('node:fs');
    for (const n of Object.values(FILES).slice(0, 60)) {
      const b = readFileSync(join(DIR, n));
      const start = b.subarray(0, 3).toString() === 'ID3' ? 10 + ((b[6] << 21) | (b[7] << 14) | (b[8] << 7) | b[9]) : 0;
      expect(b[start], n).toBe(0xff);
      expect(b[start + 1] & 0xe0, n).toBe(0xe0);
    }
  });
});
