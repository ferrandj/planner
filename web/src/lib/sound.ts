/** Sounds and vibration for reminders and achievements. Everything is best effort: a browser may refuse until the user has touched the page. */

type Ctx = AudioContext;
let ctx: Ctx | null = null;

function audio(): Ctx | null {
  try {
    const A = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!A) return null;
    ctx = ctx || new A();
    if (ctx.state === 'suspended') void ctx.resume().catch(() => undefined);
    return ctx;
  } catch { return null; }
}

/** Browsers only allow sound after a first tap or click: wake the audio up on the first one. */
export function primeAudioOnFirstTouch(): void {
  const on = (): void => { audio(); window.removeEventListener('pointerdown', on); window.removeEventListener('keydown', on); };
  window.addEventListener('pointerdown', on, { once: false });
  window.addEventListener('keydown', on, { once: false });
}

const NOTES = {
  reminder: [[880, 0, 0.18], [1175, 0.2, 0.18], [880, 0.5, 0.18], [1175, 0.7, 0.3]],         // two "ding-dong" pairs
  achievement: [[523, 0, 0.14], [659, 0.14, 0.14], [784, 0.28, 0.14], [1047, 0.42, 0.4]]    // rising arpeggio
} as const;

export function chime(kind: keyof typeof NOTES): void {
  const c = audio();
  if (!c) return;
  const t0 = c.currentTime + 0.02;
  for (const [freq, at, len] of NOTES[kind]) {
    const o = c.createOscillator(), g = c.createGain();
    o.type = 'sine'; o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t0 + at);
    g.gain.exponentialRampToValueAtTime(0.35, t0 + at + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + at + len);
    o.connect(g); g.connect(c.destination);
    o.start(t0 + at); o.stop(t0 + at + len + 0.05);
  }
}

export function vibrate(pattern: number[] = [200, 100, 200, 100, 400]): void {
  try { navigator.vibrate?.(pattern); } catch { /* not supported */ }
}
