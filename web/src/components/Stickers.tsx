import type { ReactNode } from 'react';
import stickers from '../data/stickers.json';
import groups from '../data/stickerGroups.json';
import emoji from '../data/emoji.json';
import { colOf } from '../lib/colors';

interface StickerDef { id: string; n: string; v: string }
export const STICKERS = stickers as StickerDef[];
export const STK_GROUPS = groups as Array<{ n: string; ids: string[] }>;
export const EMO = emoji as Array<[string, string]>;
export const EMO_ICON = ['😀', '🧑', '🐻', '🍎', '✈️', '⚽', '💡', '❤️', '🏁'];

export const stkName = (id: string): string => STICKERS.find((x) => x.id === id)?.n || '';

/** A sticker (built-in drawing or emoji) in the given colour. Drawings are static, trusted data bundled with the app. */
export function StickerSvg({ type, color }: { type: string; color: string }): ReactNode {
  if (type.indexOf('emoji:') === 0) {
    return (
      <svg className="sv" viewBox="0 0 64 64" aria-hidden="true">
        <text x="32" y="34" textAnchor="middle" dominantBaseline="central" fontSize="50" fontFamily="'Apple Color Emoji','Segoe UI Emoji','Noto Color Emoji',sans-serif">{type.slice(6)}</text>
      </svg>
    );
  }
  const st = STICKERS.find((x) => x.id === type);
  if (!st) return null;
  const col = colOf(color);
  return <svg className="sv" viewBox="0 0 64 64" style={{ ['--m' as string]: col.m, ['--s' as string]: col.s }} aria-hidden="true" dangerouslySetInnerHTML={{ __html: st.v }} />;
}
