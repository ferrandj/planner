import type { ReactNode } from 'react';
import stickers from '../data/stickers.json';
import groups from '../data/stickerGroups.json';
import emoji from '../data/emoji.json';
import { colOf } from '../lib/colors';
import { badgeMarkup } from '../lib/badge';
import { rewardIndex, rewardMarkup } from '../lib/rewards';
import { useApp } from '../state/app';

interface StickerDef { id: string; n: string; v: string }
export const STICKERS = stickers as StickerDef[];
export const STK_GROUPS = groups as Array<{ n: string; ids: string[] }>;
export const EMO = emoji as Array<[string, string]>;
export const EMO_ICON = ['😀', '🧑', '🐻', '🍎', '✈️', '⚽', '💡', '❤️', '🏁'];

export const stkName = (id: string): string => STICKERS.find((x) => x.id === id)?.n || '';

/** An achievement medal used as a sticker: it keeps its own colours (metal and subject), whatever colour is chosen for stickers. */
function MedalSticker({ id }: { id: string }): ReactNode {
  const { ach } = useApp();
  const d = ach.byId[id];
  const html = badgeMarkup(d ? { glyph: d.glyph, rank: d.rank, label: d.label, color: d.color } : { glyph: 'target', rank: 2 });   // a medal whose subject was removed is still shown
  return <svg className="sv medal" viewBox="0 0 64 64" aria-hidden="true" dangerouslySetInnerHTML={{ __html: html }} />;
}

/** A sticker (built-in drawing, emoji, achievement medal or reward sticker) in the given colour. Drawings are static, trusted data bundled with the app. */
export function StickerSvg({ type, color }: { type: string; color: string }): ReactNode {
  if (type.indexOf('emoji:') === 0) {
    return (
      <svg className="sv" viewBox="0 0 64 64" aria-hidden="true">
        <text x="32" y="34" textAnchor="middle" dominantBaseline="central" fontSize="50" fontFamily="'Apple Color Emoji','Segoe UI Emoji','Noto Color Emoji',sans-serif">{type.slice(6)}</text>
      </svg>
    );
  }
  const rw = rewardIndex(type);
  if (rw !== undefined) return <svg className="sv reward" viewBox="0 0 64 64" aria-hidden="true" dangerouslySetInnerHTML={{ __html: rewardMarkup(rw) }} />;
  if (type.startsWith('ach:')) return <MedalSticker id={type.slice(4)} />;
  const st = STICKERS.find((x) => x.id === type);
  if (!st) return null;
  const col = colOf(color);
  return <svg className="sv" viewBox="0 0 64 64" style={{ ['--m' as string]: col.m, ['--s' as string]: col.s }} aria-hidden="true" dangerouslySetInnerHTML={{ __html: st.v }} />;
}
