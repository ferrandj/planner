import { useEffect, useLayoutEffect, useRef, type PointerEvent, type ReactNode } from 'react';
import type { Sticker } from '../types';
import { colOf } from '../lib/colors';
import { useApp } from '../state/app';
import { ColorPicker } from './ColorPicker';
import { StickerSvg } from './Stickers';

const bgStyle = (b: Sticker): React.CSSProperties => ({
  left: (b.x * 100).toFixed(3) + '%', top: `calc(var(--w,1000px)*${b.y.toFixed(4)})`, width: b.s.toFixed(2) + '%', transform: `translate(-50%,-50%) rotate(${b.r}deg)`
});

/** Decoration stickers that stay behind the whole app (positions are relative to the page width). */
export function BackgroundLayer(): ReactNode {
  const { data, ui, setUi, update, setBusy } = useApp();
  const box = useRef<HTMLDivElement>(null);
  const drag = useRef<{ id: string; pid: number; ox: number; oy: number; moved: boolean } | null>(null);
  useLayoutEffect(() => {
    const w = (): void => { box.current?.style.setProperty('--w', (box.current.getBoundingClientRect().width || 1000) + 'px'); };
    w();
    window.addEventListener('resize', w);
    return () => window.removeEventListener('resize', w);
  });
  useEffect(() => { document.body.classList.toggle('decorating', ui.deco); return () => document.body.classList.remove('decorating'); }, [ui.deco]);

  const down = (e: PointerEvent<HTMLDivElement>, b: Sticker): void => {
    if (!ui.deco) return;
    e.preventDefault();
    const rc = box.current!.getBoundingClientRect();
    drag.current = { id: b.id, pid: e.pointerId, ox: (e.clientX - rc.left) / rc.width - b.x, oy: (e.clientY - rc.top) / rc.width - b.y, moved: false };
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* not supported */ }
    setBusy(true); setUi({ bsel: b.id });
  };
  const move = (e: PointerEvent<HTMLDivElement>): void => {
    const d = drag.current;
    if (!d || d.pid !== e.pointerId) return;
    const rc = box.current!.getBoundingClientRect();
    const x = Math.min(1, Math.max(0, (e.clientX - rc.left) / rc.width - d.ox)), y = Math.min(30, Math.max(0, (e.clientY - rc.top) / rc.width - d.oy));
    d.moved = true;
    update((dd) => { const s = dd.bg.find((q) => q.id === d.id); if (s) { s.x = x; s.y = y; } });
    if (e.clientY > window.innerHeight - 170) window.scrollBy(0, 10); else if (e.clientY < 50) window.scrollBy(0, -10);
  };
  const up = (e: PointerEvent<HTMLDivElement>): void => {
    const d = drag.current;
    if (!d || d.pid !== e.pointerId) return;
    drag.current = null; setBusy(false);
    if (d.moved) update((dd) => { dd.bgAt = Date.now(); });
  };
  return (
    <div id="bg" aria-hidden="true" ref={box}>
      {data.bg.map((b) => (
        <div key={b.id} className={'bgs' + (ui.deco && ui.bsel === b.id ? ' sel' : '')} data-id={b.id} style={bgStyle(b)} onPointerDown={(e) => down(e, b)} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
          <StickerSvg type={b.t} color={b.c} />
        </div>
      ))}
    </div>
  );
}

export function DecoBar(): ReactNode {
  const { data, ui, setUi, update, t } = useApp();
  if (!ui.deco) return null;
  const sel = ui.bsel ? data.bg.find((b) => b.id === ui.bsel) : undefined;
  const edit = (fn: (b: Sticker) => void): void => update((d) => { const b = d.bg.find((x) => x.id === ui.bsel); if (b) { fn(b); d.bgAt = Date.now(); } });
  return (
    <div className="dbar" role="toolbar" aria-label={t("Décor de l'application")}>
      <div className="drow">
        <button type="button" className="btn" onClick={() => setUi({ stkTarget: 'bg', stkPop: true })}>＋ {t('Ajouter un sticker')}</button>
        {sel && (
          <>
            <div className="seg"><button type="button" aria-label={t('Plus petit')} onClick={() => edit((b) => { b.s = Math.max(2, Math.min(50, b.s - 1)); })}>−</button><button type="button" aria-label={t('Plus grand')} onClick={() => edit((b) => { b.s = Math.max(2, Math.min(50, b.s + 1)); })}>+</button></div>
            <div className="seg"><button type="button" aria-label={t('Tourner à gauche')} onClick={() => edit((b) => { b.r = (b.r - 15) % 360; })}>↺</button><button type="button" aria-label={t('Tourner à droite')} onClick={() => edit((b) => { b.r = (b.r + 15) % 360; })}>↻</button></div>
            <button type="button" className="fchip" aria-pressed={ui.bgColor} onClick={() => setUi({ bgColor: !ui.bgColor })}><i className="sd" style={{ background: colOf(sel.c).m }} />{t('Couleur')}</button>
            <button type="button" className="btn ghost" onClick={() => { update((d) => { d.bg = d.bg.filter((x) => x.id !== sel.id); d.bgAt = Date.now(); }); setUi({ bsel: null, bgColor: false }); }}>{t('Supprimer')}</button>
          </>
        )}
        <span className="spacer" />
        {data.bg.length > 0 && (
          <button type="button" className="btn ghost" data-arm="bg" onClick={() => {
            if (!ui.bgArm) { setUi({ bgArm: true }); return; }
            update((d) => { d.bg = []; d.bgAt = Date.now(); });
            setUi({ bsel: null, bgColor: false, bgArm: false });
          }}>{ui.bgArm ? t('Confirmer : tout retirer') : t('Tout retirer')}</button>
        )}
        <button type="button" className="btn" onClick={() => setUi({ deco: false, bsel: null, bgColor: false, bgArm: false })}>✓ {t('Terminé')}</button>
      </div>
      {!sel && <span className="hint">{t("Ajoute un sticker, puis touche-le et glisse-le où tu veux. Il reste en arrière-plan sur toutes les pages.")}</span>}
      {sel && ui.bgColor && <ColorPicker value={colOf(sel.c).m} onChange={(hex) => edit((b) => { b.c = hex; })} />}
    </div>
  );
}
