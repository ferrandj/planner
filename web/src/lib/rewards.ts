import rewards from '../data/rewards.json';

/**
 * Reward stickers: every achievement unlocked gives one extra cute two-colour sticker (a design from `rewards.json` in one of the colour pairs below).
 * The number `k` saved for an achievement in `data.rew` picks the design (k mod 30) and the colours; it is never changed afterwards.
 * Drawings are static, trusted data bundled with the app: `{A}` is the main colour, `{B}` the second one, `{I}` the ink.
 */
interface Design { id: string; n: string; v: string }
export const DESIGNS = rewards as Design[];
export const DESIGN_COUNT = DESIGNS.length;

const INK = '#1e2433';
/** Two colours per palette: main and second. */
export const PALETTES: ReadonlyArray<readonly [string, string]> = [
  ['#f78fb3', '#7ed6c1'], ['#6c9bf2', '#ffd166'], ['#a77bf3', '#ff9f5a'], ['#2ec4b6', '#ff7a6b'],
  ['#7bc86c', '#f78fb3'], ['#ef5b5b', '#8ecdf5'], ['#f2c14e', '#a77bf3'], ['#2f4b7c', '#7ed6c1']
];
/** Different stickers it is possible to get before one repeats. */
export const REWARD_VARIANTS = DESIGN_COUNT * PALETTES.length;

const norm = (k: number): number => ((Math.floor(k) % REWARD_VARIANTS) + REWARD_VARIANTS) % REWARD_VARIANTS;
const paletteOf = (k: number): number => (k + Math.floor(k / DESIGN_COUNT)) % PALETTES.length;

export const REWARD_PREFIX = 'rw:';
/** Number of a sticker type like "rw:12" (undefined for any other type). */
export function rewardIndex(type: string): number | undefined {
  const m = /^rw:(\d{1,6})$/.exec(type);
  return m ? Number(m[1]) : undefined;
}

/** French name of the design (translated by the caller). */
export const rewardName = (k: number): string => DESIGNS[norm(k) % DESIGN_COUNT].n;

/** Inner SVG markup (64x64 box) of reward `k`. */
export function rewardMarkup(k: number): string {
  const n = norm(k);
  const [a, b] = PALETTES[paletteOf(n)];
  return DESIGNS[n % DESIGN_COUNT].v.replace(/\{A\}/g, a).replace(/\{B\}/g, b).replace(/\{I\}/g, INK);
}

/** Number to give to the next reward: after the highest one already given, so two achievements never get the same sticker until all have been used. */
export const nextReward = (rew: Record<string, number>): number => Object.values(rew).reduce((m, v) => Math.max(m, v + 1), 0);
