import { vi } from 'vitest';
import audio from '../data/quizAudio.json';
import { hasRecording, stopVoice, voice } from './voice';

const TEXTS = Object.keys(audio as Record<string, string>);
const KNOWN = TEXTS[0];                                           // (what was fetched stays in memory: each test that fetches uses its own text)
/** a successful answer carrying a small sound (the jsdom Blob cannot go through the Node Response class) */
const okSound = async (): Promise<Response> => ({ ok: true, blob: async () => new Blob(['mp3'], { type: 'audio/mpeg' }) }) as unknown as Response;

class FakeAudio {
  static made: FakeAudio[] = [];
  static fail = false;
  paused = false;
  constructor(public src: string) { FakeAudio.made.push(this); }
  play(): Promise<void> { return FakeAudio.fail ? Promise.reject(new Error('NotAllowedError')) : Promise.resolve(); }
  pause(): void { this.paused = true; }
}

function browserVoices(list: Array<{ name: string; lang: string }>) {
  const spoken: Array<{ text: string; voice?: unknown; rate: number; lang: string }> = [];
  vi.stubGlobal('SpeechSynthesisUtterance', class { voice?: unknown; rate = 1; lang = ''; constructor(public text: string) {} });
  vi.stubGlobal('speechSynthesis', { getVoices: () => list, cancel: vi.fn(), speak: (u: { text: string; voice?: unknown; rate: number; lang: string }) => spoken.push(u) });
  return spoken;
}

beforeEach(() => {
  FakeAudio.made = []; FakeAudio.fail = false;
  vi.stubGlobal('Audio', FakeAudio);
  vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:fake-' + Math.random()) }));
});
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('the voice of the quiz', () => {
  it('has a recording for the texts of the quiz, none for others', () => {
    expect(hasRecording(KNOWN)).toBe(true);
    expect(hasRecording('a sentence nobody recorded')).toBe(false);
  });

  it('plays the recording (fetched from the app, once), and keeps it for the next time', async () => {
    const f = vi.fn(okSound);
    vi.stubGlobal('fetch', f);
    expect(await voice.play(KNOWN)).toBe('recording');
    expect(f).toHaveBeenCalledWith('audio/en/' + (audio as Record<string, string>)[KNOWN]);
    expect(await voice.play(KNOWN)).toBe('recording');
    expect(f).toHaveBeenCalledTimes(1);
    expect(FakeAudio.made).toHaveLength(2);
    expect(FakeAudio.made[0].paused).toBe(true);                       // a new reading replaces the one in progress
  });

  it('falls back to the best English voice of the browser when there is no recording', async () => {
    vi.stubGlobal('fetch', vi.fn());
    const spoken = browserVoices([{ name: 'Amelie', lang: 'fr-FR' }, { name: 'Basic', lang: 'en-AU' }, { name: 'Google US English', lang: 'en-US' }, { name: 'Other', lang: 'en-GB' }]);
    expect(await voice.play('A sentence nobody recorded.')).toBe('browser');
    expect(spoken).toHaveLength(1);
    expect(spoken[0]).toMatchObject({ text: 'A sentence nobody recorded.', rate: 0.9, lang: 'en-US' });
    expect((spoken[0].voice as { name: string }).name).toBe('Google US English');
  });

  it('falls back to the browser when the recording cannot be fetched or played', async () => {
    const spoken = browserVoices([]);
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('offline'); }));
    expect(await voice.play(TEXTS[1])).toBe('browser');
    vi.stubGlobal('fetch', vi.fn(async () => new Response('x', { status: 404 })));
    expect(await voice.play(TEXTS[2])).toBe('browser');
    vi.stubGlobal('fetch', vi.fn(okSound));
    FakeAudio.fail = true;
    expect(await voice.play(TEXTS[3])).toBe('browser');
    expect(spoken.length).toBe(3);
    expect(spoken[0].lang).toBe('en-US');                              // no English voice installed: the language is still asked
  });

  it('says "blocked" (and does not pretend) when the browser refuses to play before the page has been clicked', async () => {
    vi.stubGlobal('fetch', vi.fn(okSound));
    const spoken = browserVoices([{ name: 'Google US English', lang: 'en-US' }]);
    class Refused extends FakeAudio { play(): Promise<void> { return Promise.reject(Object.assign(new Error('blocked'), { name: 'NotAllowedError' })); } }
    vi.stubGlobal('Audio', Refused);
    expect(await voice.play(TEXTS[5])).toBe('blocked');
    expect(spoken).toHaveLength(0);                                    // the browser's own voice would be refused as well
  });

  it('says so when nothing can speak, and ignores empty text', async () => {
    vi.stubGlobal('fetch', vi.fn());
    vi.stubGlobal('speechSynthesis', undefined);
    expect(await voice.play('Hello there my friend')).toBe('none');
    expect(await voice.play('   ')).toBe('none');
  });

  it('can be stopped', async () => {
    vi.stubGlobal('fetch', vi.fn(okSound));
    const cancel = vi.fn();
    vi.stubGlobal('speechSynthesis', { cancel, getVoices: () => [], speak: vi.fn() });
    await voice.play(TEXTS[4]);
    stopVoice();
    expect(FakeAudio.made.at(-1)!.paused).toBe(true);
    expect(cancel).toHaveBeenCalled();
  });
});
