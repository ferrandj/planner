import audio from '../data/quizAudio.json';

/**
 * The voice of the English quiz.
 *
 * Every text of the quiz was spoken once with a neural voice (see scripts/quiz-audio) and the recordings are part of the app:
 * the same clear accent on every device, nothing to install, and they keep working without internet once heard.
 * If a recording is not available (a new question not recorded yet, or the file cannot be fetched), the voice of the
 * browser reads the text instead.
 */
const FILES = audio as Record<string, string>;
const URLS = new Map<string, string>();            // text -> blob URL of what was already fetched
let playing: HTMLAudioElement | null = null;

export const hasRecording = (text: string): boolean => !!FILES[text];

/** The recording as a blob URL: fetched whole (so that it can be kept offline by the service worker and played on every browser). */
async function recording(text: string): Promise<string | null> {
  const known = URLS.get(text);
  if (known) return known;
  const file = FILES[text];
  if (!file) return null;
  try {
    const r = await fetch('audio/en/' + file);
    if (!r.ok) return null;
    const url = URL.createObjectURL(await r.blob());
    URLS.set(text, url);
    return url;
  } catch { return null; }
}

/** The best English voice the browser has, if any (a fallback only). */
function browserVoice(): SpeechSynthesisVoice | undefined {
  const list = typeof speechSynthesis === 'undefined' ? [] : speechSynthesis.getVoices().filter((v) => /^en[-_]/i.test(v.lang));
  const score = (v: SpeechSynthesisVoice): number => (/natural|neural|premium|enhanced|google|samantha|daniel|serena/i.test(v.name) ? 2 : 0) + (/en[-_](US|GB)/i.test(v.lang) ? 1 : 0);
  return list.sort((a, b) => score(b) - score(a))[0];
}

function speakWithBrowser(text: string, slow = false): boolean {
  if (typeof speechSynthesis === 'undefined' || typeof SpeechSynthesisUtterance === 'undefined') return false;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  const v = browserVoice();
  if (v) { u.voice = v; u.lang = v.lang; } else u.lang = 'en-US';
  u.rate = slow ? 0.6 : 0.9;
  speechSynthesis.speak(u);
  return true;
}

export function stopVoice(): void {
  if (playing) { playing.pause(); playing = null; }
  if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel();
}

/** `blocked`: the browser refuses to start a sound until the page has been touched (it works again after a click). */
export type Spoken = 'recording' | 'browser' | 'blocked' | 'none';

export const voice = {
  /** Reads `text` aloud (English), replacing whatever was being read. `slow`: the same recording at 70 % speed (the pitch does not change), to hear every sound. */
  async play(text: string, slow = false): Promise<Spoken> {
    const t = text.trim();
    if (!t) return 'none';
    stopVoice();
    const url = await recording(t);
    if (url) {
      try {
        const a = new Audio(url);
        if (slow) a.playbackRate = 0.7;
        playing = a;
        await a.play();
        return 'recording';
      } catch (e) {
        if (e instanceof Error && e.name === 'NotAllowedError') { playing = null; return 'blocked'; }   // no click on the page yet: the browser's own voice would be refused too
        /* unreadable: try the browser's voice */
      }
    }
    return speakWithBrowser(t, slow) ? 'browser' : 'none';
  }
};
