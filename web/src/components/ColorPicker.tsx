import { useRef, useState, type PointerEvent, type ReactNode } from 'react';
import { HEX6, hex2hsv, hsv2hex, type Hsv } from '../lib/colors';
import { useApp } from '../state/app';

/** Normalise "abc", "#ABC", "aabbcc" ... to "#aabbcc", or null when it is not a colour. */
export function parseHex(v: string): string | null {
  v = String(v || '').trim();
  if (v.charAt(0) !== '#') v = '#' + v;
  if (/^#[0-9a-f]{3}$/i.test(v)) v = '#' + v.slice(1).split('').map((c) => c + c).join('');
  return HEX6.test(v) ? v.toLowerCase() : null;
}

function Favs({ value, onPick }: { value: string; onPick: (hex: string) => void }): ReactNode {
  const { data, update, t } = useApp();
  return (
    <div className="favs">
      <span className="lbl">{t('Mes couleurs')}</span>
      <div className="chips">
        {data.favs.map((c) => (
          <span key={c} className="fav">
            <button type="button" className="favsw" style={{ background: c }} aria-label={t('Utiliser la couleur') + ' ' + c.toUpperCase()} title={c.toUpperCase()} onClick={() => onPick(c)} />
            <button type="button" className="favx" aria-label={t('Retirer cette couleur') + ' ' + c.toUpperCase()} onClick={() => update((d) => { d.favs = d.favs.filter((x) => x !== c); })}>×</button>
          </span>
        ))}
        <button type="button" className="fchip" onClick={() => update((d) => { const c = value.toLowerCase(); if (!d.favs.includes(c)) { d.favs.push(c); if (d.favs.length > 30) d.favs.shift(); } })}>★ {t('Enregistrer cette couleur')}</button>
      </div>
      {!data.favs.length && <span className="hint">{t('Aucune couleur enregistrée pour le moment.')}</span>}
    </div>
  );
}

/** Saturation/brightness square + hue bar + hex field + saved colours. `onChange` fires continuously while dragging. */
export function ColorPicker({ value, onChange, id }: { value: string; onChange: (hex: string) => void; id?: string }): ReactNode {
  const { t, setBusy } = useApp();
  const [hsv, setHsv] = useState<Hsv>(() => hex2hsv(value));
  const [text, setText] = useState<string | null>(null);
  const drag = useRef<'sv' | 'hue' | null>(null);
  // keep the hue when the colour is grey/black; follow outside changes otherwise
  const cur = hsv2hex(hsv) === value.toLowerCase() ? hsv : hex2hsv(value);
  if (cur !== hsv) setHsv(cur);

  const pick = (e: PointerEvent<HTMLDivElement>, part: 'sv' | 'hue'): void => {
    const r = e.currentTarget.getBoundingClientRect();
    const x = Math.min(1, Math.max(0, (e.clientX - r.left) / (r.width || 1))), y = Math.min(1, Math.max(0, (e.clientY - r.top) / (r.height || 1)));
    const n: Hsv = part === 'hue' ? { ...cur, h: Math.min(359.99, x * 360) } : { ...cur, s: x, v: 1 - y };
    setHsv(n);
    onChange(hsv2hex(n));
  };
  const handlers = (part: 'sv' | 'hue'): Record<string, unknown> => ({
    onPointerDown: (e: PointerEvent<HTMLDivElement>) => { e.preventDefault(); drag.current = part; setBusy(true); try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* not supported */ } pick(e, part); },
    onPointerMove: (e: PointerEvent<HTMLDivElement>) => { if (drag.current === part) pick(e, part); },
    onPointerUp: () => { drag.current = null; setBusy(false); },
    onPointerCancel: () => { drag.current = null; setBusy(false); }
  });
  const apply = (v: string): void => { const h = parseHex(v); setText(null); if (h) onChange(h); };

  return (
    <div className="picker" id={id}>
      <div className="svbox" data-testid="svbox" style={{ backgroundColor: `hsl(${Math.round(cur.h)},100%,50%)` }} {...handlers('sv')}>
        <i className="svth" style={{ left: (cur.s * 100).toFixed(1) + '%', top: ((1 - cur.v) * 100).toFixed(1) + '%' }} />
      </div>
      <div className="huebar" data-testid="huebar" {...handlers('hue')}><i className="hueth" style={{ left: ((cur.h / 360) * 100).toFixed(1) + '%' }} /></div>
      <div className="hexrow">
        <i className="hexchip" style={{ background: value }} />
        <input aria-label={t('Code couleur')} value={text ?? value.toUpperCase()} maxLength={7} spellCheck={false} autoComplete="off"
          onChange={(e) => setText(e.target.value)} onBlur={(e) => apply(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') apply((e.target as HTMLInputElement).value); }} />
      </div>
      <Favs value={value} onPick={apply} />
    </div>
  );
}
