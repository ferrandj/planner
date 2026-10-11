import { useEffect, useRef, type ReactNode } from 'react';
import type { Sticker } from '../types';
import { monthsList } from '../lib/model';
import { useApp } from '../state/app';
import { EMO, EMO_ICON, STK_GROUPS, StickerSvg, stkName } from './Stickers';
import { Seg } from './common';

export const stkKey = (sync: boolean | undefined, k: string): string => (sync ? '*' : k);
const rid = (p: string): string => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 4);

/** Add a sticker to the print sheet of the chosen month, or to the app background. */
export function useAddSticker(): (type: string) => void {
  const { ui, setUi, update, data, evs } = useApp();
  return (type: string) => {
    if (ui.stkTarget === 'bg') {
      const w = document.getElementById('bg')?.getBoundingClientRect().width || 1;
      const ns: Sticker = { id: rid('b'), t: type, c: ui.bnewc, x: 0.3 + Math.random() * 0.4, y: (window.scrollY + window.innerHeight * 0.3 + Math.random() * window.innerHeight * 0.2) / w, s: 9, r: 0 };
      update((d) => { d.bg.push(ns); d.bgAt = Date.now(); });
      setUi({ bsel: ns.id, stkPop: false });
    } else {
      const month = ui.pmonth || monthsList(evs)[0] || '';
      const key = stkKey(data.prefs.sync, month);
      const k = (data.stickers[key] || []).length;
      const ns: Sticker = { id: rid('s'), t: type, c: ui.newc, x: Math.min(0.9, 0.2 + (k % 6) * 0.11), y: 0.1 + (k % 3) * 0.05, s: 7, r: 0 };
      update((d) => { (d.stickers[key] = d.stickers[key] || []).push(ns); });
      setUi({ stkSel: ns.id, stkPop: false });
    }
  };
}

export function StickerPicker(): ReactNode {
  const { ui, setUi, t } = useApp();
  const add = useAddSticker();
  const emo = ui.stkTab === 'emo', pcol = ui.stkTarget === 'bg' ? ui.bnewc : ui.newc;
  const close = useRef<HTMLButtonElement>(null);
  useEffect(() => { close.current?.focus({ preventScroll: true }); }, []);
  useEffect(() => {
    const on = (e: KeyboardEvent): void => { if (e.key === 'Escape') setUi({ stkPop: false }); };
    document.addEventListener('keydown', on);
    return () => document.removeEventListener('keydown', on);
  }, [setUi]);
  const ci = Math.min(ui.emoCat || 0, EMO.length - 1);
  return (
    <div className="ov" role="dialog" aria-modal="true" aria-labelledby="sp-t">
      <div className="modal wide">
        <div className="mtop acc"><div className="eyebrow" id="sp-t">{t('Stickers')}</div><div className="big sm">{t(emo ? 'Choisis un emoji' : 'Choisis un sticker')}</div></div>
        <div className="mbody">
          <Seg value={ui.stkTab} options={[['stk', t('Stickers')], ['emo', t('Emojis')]]} onChange={(v) => setUi({ stkTab: v })} />
          {emo ? (
            <>
              <div className="chips">{EMO.map((g, i) => <button key={g[0]} type="button" className="fchip" aria-pressed={i === ci} onClick={() => setUi({ emoCat: i })}>{EMO_ICON[i]} {t(g[0])}</button>)}</div>
              <div className="egrid">{EMO[ci][1].split(' ').map((e) => <button key={e} type="button" className="ebtn" aria-label={t('Ajouter : ') + e} onClick={() => add('emoji:' + e)}>{e}</button>)}</div>
            </>
          ) : STK_GROUPS.map((g) => (
            <section key={g.n}>
              <h3 className="gh">{t(g.n)}</h3>
              <div className="sgrid">
                {g.ids.map((id) => (
                  <button key={id} type="button" className="sbtn" aria-label={t('Ajouter : ') + t(stkName(id))} onClick={() => add(id)}>
                    <StickerSvg type={id} color={pcol} /><span>{t(stkName(id))}</span>
                  </button>
                ))}
              </div>
            </section>
          ))}
          <button ref={close} className="btn" id="sp-close" onClick={() => setUi({ stkPop: false })}>{t('Fermer')}</button>
        </div>
      </div>
    </div>
  );
}

export function PrintHelp(): ReactNode {
  const { ui, setUi, data, evs, t, tf } = useApp();
  const close = useRef<HTMLButtonElement>(null);
  useEffect(() => { close.current?.focus({ preventScroll: true }); }, []);
  useEffect(() => {
    const on = (e: KeyboardEvent): void => { if (e.key === 'Escape') setUi({ printHelp: false }); };
    document.addEventListener('keydown', on);
    return () => document.removeEventListener('keydown', on);
  }, [setUi]);
  const n = ui.pall ? monthsList(evs).filter((k) => !data.printOff[k]).length : 1;
  return (
    <div className="ov" role="dialog" aria-modal="true" aria-labelledby="ph-t">
      <div className="modal">
        <div className="mtop acc"><div className="eyebrow" id="ph-t">{t('Imprimer')}</div><div className="big sm">{tf('{n} page(s) A4 paysage', { n })}</div></div>
        <div className="mbody">
          <ol className="steps">
            <li>{t('Ordinateur : ')}<span className="kbd">Ctrl</span> + <span className="kbd">P</span> (Windows) · <span className="kbd">Cmd</span> + <span className="kbd">P</span> (Mac)</li>
            <li>{t('Téléphone ou tablette : menu du navigateur, puis « Imprimer ».')}</li>
            <li>{t('Réglages conseillés : A4, paysage, échelle 100 %, marges par défaut.')}</li>
            <li>{t('Le fond reste blanc : seules quelques touches de couleur sont imprimées.')}</li>
          </ol>
          <button ref={close} className="btn" id="ph-close" onClick={() => setUi({ printHelp: false })}>{t('Compris')}</button>
        </div>
      </div>
    </div>
  );
}
