import { useEffect, useRef, type PointerEvent, type ReactNode } from 'react';
import type { Evt } from '../types';
import { PRINT_PALS, colOf, softOf } from '../lib/colors';
import { pad, parse, range, wdList } from '../lib/dates';
import { evTitle } from '../lib/labels';
import { appEyebrow, appTitle, eventsOn, monthsList, subjectOf, visible } from '../lib/model';
import { useApp } from '../state/app';
import { ColorPicker } from './ColorPicker';
import { SubjectChips } from './PlanningTab';
import { StickerSvg, stkName } from './Stickers';
import { stkKey } from './StickerPicker';
import { Seg } from './common';

const cap = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

function printPal(prefs: { ppal: string; pcustom: string }): { m: string; s: string } {
  return prefs.ppal === 'perso' ? { m: prefs.pcustom, s: softOf(prefs.pcustom) } : PRINT_PALS[prefs.ppal] || PRINT_PALS.sobre;
}

function Pline({ e }: { e: Evt }): ReactNode {
  const { model, data, t } = useApp();
  const sb = subjectOf(model, e.subject);
  if (e.kind === 'devoir' && e.devoir) {
    const d = e.devoir;
    return <div className="pl dv"><b>{t('À RENDRE')}</b> {t(e.title || '')}<div className="sb">{model.subjects.map((s) => <span key={s.id}><i className="pb">{data.rendu[d.id + ':' + s.id] ? '✓' : ''}</i>{s.ab}</span>)}</div></div>;
  }
  if (e.kind === 'exam') return <div className="pl ex"><b>{t('EXAMEN')}</b> {t(e.title || '')}</div>;
  if (e.kind === 'dispo') return <div className="pl av">{t('Sujet dispo : ') + t(e.title || '')}</div>;
  return <div className="pl"><i className="pb">{data.done[e.id] ? '✓' : ''}</i><b>{sb ? sb.ab : ''}</b> {evTitle(e, t)}{e.time ? ' ' + e.time : ''}</div>;
}

function StickersLayer({ month, edit }: { month: string; edit: boolean }): ReactNode {
  const { data, ui, setUi, update, setBusy } = useApp();
  const key = stkKey(data.prefs.sync, month);
  const drag = useRef<{ id: string; sheet: HTMLElement; pid: number } | null>(null);
  const down = (e: PointerEvent<HTMLDivElement>, id: string): void => {
    if (!edit) return;
    e.preventDefault();
    drag.current = { id, sheet: e.currentTarget.closest('.sheet') as HTMLElement, pid: e.pointerId };
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* not supported */ }
    setBusy(true); setUi({ stkSel: id });
  };
  const move = (e: PointerEvent<HTMLDivElement>): void => {
    const d = drag.current;
    if (!d || d.pid !== e.pointerId) return;
    const r = d.sheet.getBoundingClientRect();
    const x = Math.min(1, Math.max(0, (e.clientX - r.left) / (r.width || 1))), y = Math.min(1, Math.max(0, (e.clientY - r.top) / (r.height || 1)));
    update((dd) => { const s = (dd.stickers[key] || []).find((q) => q.id === d.id); if (s) { s.x = x; s.y = y; } });
  };
  const up = (e: PointerEvent<HTMLDivElement>): void => { if (drag.current && drag.current.pid === e.pointerId) { drag.current = null; setBusy(false); } };
  return (
    <>
      {(data.stickers[key] || []).map((s) => (
        <div key={s.id} className={'stk' + (edit ? ' ed' : '') + (edit && ui.stkSel === s.id ? ' sel' : '')} data-id={s.id} data-month={key}
          style={{ left: (s.x * 100).toFixed(2) + '%', top: (s.y * 100).toFixed(2) + '%', width: s.s + '%', transform: `translate(-50%,-50%) rotate(${s.r}deg)` }}
          onPointerDown={(e) => down(e, s.id)} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
          <StickerSvg type={s.t} color={s.c} />
        </div>
      ))}
    </>
  );
}

export function Sheet({ month, edit }: { month: string; edit: boolean }): ReactNode {
  const { evs: all, ui, setUi, model, data, t, fmt } = useApp();
  const [y, m] = month.split('-').map(Number);
  const first = new Date(y, m - 1, 1), off = (first.getDay() + 6) % 7, n = new Date(y, m, 0).getDate(), rows = Math.ceil((off + n) / 7);
  const pp = printPal(data.prefs), evs = all.filter((e) => visible(e, ui.filter));
  const due = evs.filter((e) => (e.kind === 'devoir' || e.kind === 'exam' || e.kind === 'dispo') && e.date.slice(0, 7) === month);
  const rem = (7 - ((off + n) % 7)) % 7;
  const eyebrow = appEyebrow(data);
  return (
    <div className="swrap">
      <section className="sheet" data-month={month} style={{ ['--pt' as string]: pp.m, ['--pts' as string]: pp.s }}
        onClick={(e) => { if (ui.stkSel && !(e.target as Element).closest('.stk')) setUi({ stkSel: null }); }}>
        <div className="sh-head"><div><h2>{cap(fmt.month.format(first))}</h2><span>{appTitle(data, t) + (eyebrow ? ' · ' + eyebrow : '')}</span></div></div>
        <div className="pgrid" style={{ gridTemplateRows: `auto repeat(${rows},minmax(0,1fr))` }}>
          {wdList(fmt.wdLong).map((d) => <div key={d} className="ph">{d}</div>)}
          {Array.from({ length: off }, (_, i) => <div key={'o' + i} className="pc" />)}
          {Array.from({ length: n }, (_, i) => {
            const d = i + 1, day = `${y}-${pad(m)}-${pad(d)}`, wk = (off + d - 1) % 7 >= 5, esd = eventsOn(evs, day), hd = esd.some((e) => e.kind === 'devoir');
            return <div key={day} className={'pc' + (wk ? ' wk' : '') + (hd ? ' hasdv' : '')}><div className="pd">{d}</div>{esd.map((e) => <Pline key={e.id} e={e} />)}</div>;
          })}
          {Array.from({ length: rem }, (_, i) => <div key={'r' + i} className="pc" />)}
        </div>
        {due.length > 0 && (
          <div className="pdue"><b>{t('Échéances du mois')}</b>
            <ul>{due.map((e) => (
              <li key={e.id} className={e.kind === 'devoir' ? 'dvli' : undefined}>
                {(e.kind === 'devoir' ? t('À rendre : ') : e.kind === 'exam' ? t('Examen : ') : t('Sujet disponible : ')) + t(e.title || '') + ' — ' + (e.kind === 'exam' ? range(e, fmt) : fmt.long.format(parse(e.date)))}
              </li>
            ))}</ul>
          </div>
        )}
        <div className="plegend">{t('□ à faire · ✓ fait ou rendu')} — {model.subjects.map((s) => s.ab + ' = ' + s.code + ' ' + s.name).join(' · ')}</div>
        <StickersLayer month={month} edit={edit} />
      </section>
    </div>
  );
}

function MonthPicker({ ms }: { ms: string[] }): ReactNode {
  const { data, update, t, tf, fmt } = useApp();
  const n = ms.filter((k) => !data.printOff[k]).length;
  return (
    <div className="panel noprint">
      <div className="opt">
        <span className="lbl">{tf('Mois à imprimer : {n} sur {m}', { n, m: ms.length })}</span>
        <button type="button" className="btn ghost" onClick={() => update((d) => { d.printOff = {}; })}>{t('Tous')}</button>
        <button type="button" className="btn ghost" onClick={() => update((d) => { ms.forEach((k) => { d.printOff[k] = true; }); })}>{t('Aucun')}</button>
      </div>
      <div className="chips">
        {ms.map((k) => { const on = !data.printOff[k]; return <button key={k} type="button" className="fchip" aria-pressed={on} onClick={() => update((d) => { d.printOff[k] = !d.printOff[k]; })}>{on ? '✓ ' : ''}{fmt.monShort.format(parse(k + '-01'))}</button>; })}
      </div>
    </div>
  );
}

function StickerPanel({ month, ms }: { month: string; ms: string[] }): ReactNode {
  const { data, ui, setUi, update, t, tf } = useApp();
  const key = stkKey(data.prefs.sync, month), L = data.stickers[key] || [], cur = L.find((s) => s.id === ui.stkSel);
  const colorVal = colOf(cur ? cur.c : ui.newc).m;
  const setScope = (on: boolean): void => {
    if (on === !!data.prefs.sync) return;
    update((d) => {
      if (on) { if (!(d.stickers['*'] && d.stickers['*'].length)) d.stickers['*'] = JSON.parse(JSON.stringify(d.stickers[month] || [])); }
      else { const sh = d.stickers['*'] || []; ms.forEach((k) => { if (d.stickers[k] === undefined) d.stickers[k] = JSON.parse(JSON.stringify(sh)); }); }
      d.prefs.sync = on;
    });
    setUi({ stkSel: null });
  };
  const edit = (fn: (s: { s: number; r: number }) => void): void => update((d) => { const s = (d.stickers[key] || []).find((q) => q.id === ui.stkSel); if (s) fn(s); });
  return (
    <div className="panel noprint">
      <div className="opt"><span className="lbl">{t('Stickers : touche pour ajouter, glisse sur la feuille pour placer')}</span></div>
      <div className="opt"><span className="lbl">{t('Décoration')}</span>
        <Seg label={t('Portée de la décoration')} value={data.prefs.sync ? 'all' : 'month'} options={[['month', t('Ce mois seulement')], ['all', t('Même déco pour tous les mois')]]} onChange={(v) => setScope(v === 'all')} />
      </div>
      {!data.prefs.sync && L.length > 0 && (
        <div className="opt"><button type="button" className="btn ghost" data-arm="cp" onClick={() => {
          if (!ui.cpArm) { setUi({ cpArm: true }); return; }
          const src = JSON.stringify(data.stickers[month] || []);
          update((d) => { ms.forEach((k) => { d.stickers[k] = JSON.parse(src); }); });
          setUi({ cpArm: false });
        }}>{ui.cpArm ? t('Confirmer : remplace la déco des autres mois') : t('Copier cette déco sur tous les mois')}</button></div>
      )}
      <div className="opt"><button type="button" className="btn" onClick={() => setUi({ stkTarget: 'print', stkPop: true })}>{t('Stickers et emojis')}</button><span className="hint">{t('Choisis un sticker dans la liste')}</span></div>
      <div className="opt selbar"><span className="lbl">{cur ? tf('Couleur du sticker sélectionné ({n})', { n: t(stkName(cur.t)) }) : t('Couleur des prochains stickers')}</span></div>
      <ColorPicker value={colorVal} onChange={(hex) => { if (cur) edit((s) => { (s as unknown as { c: string }).c = hex; }); else setUi({ newc: hex }); }} />
      {cur ? (
        <div className="opt selbar"><span className="lbl">{t('Taille et angle')}</span>
          <div className="seg"><button type="button" aria-label={t('Plus petit')} onClick={() => edit((s) => { s.s = Math.max(3, Math.min(20, s.s - 1)); })}>−</button><button type="button" aria-label={t('Plus grand')} onClick={() => edit((s) => { s.s = Math.max(3, Math.min(20, s.s + 1)); })}>+</button></div>
          <div className="seg"><button type="button" aria-label={t('Tourner à gauche')} onClick={() => edit((s) => { s.r = (s.r - 15) % 360; })}>↺</button><button type="button" aria-label={t('Tourner à droite')} onClick={() => edit((s) => { s.r = (s.r + 15) % 360; })}>↻</button></div>
          <button type="button" className="btn ghost" onClick={() => { update((d) => { d.stickers[key] = (d.stickers[key] || []).filter((x) => x.id !== cur.id); }); setUi({ stkSel: null }); }}>{t('Supprimer')}</button>
        </div>
      ) : <div className="opt"><span className="hint">{t('Touche un sticker sur la feuille pour changer sa couleur, sa taille ou le supprimer.')}</span></div>}
      {L.length > 0 && <div className="opt"><button type="button" className="btn ghost" onClick={() => { update((d) => { d.stickers[key] = []; }); setUi({ stkSel: null }); }}>{data.prefs.sync ? t('Retirer tous les stickers (tous les mois)') : t('Retirer tous les stickers de ce mois')}</button></div>}
    </div>
  );
}

const PRINTER_SVG = <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 9V3h12v6" /><rect x="3" y="9" width="18" height="9" rx="2" /><path d="M6 14h12v7H6z" /></svg>;

export function PrintTab(): ReactNode {
  const { evs, ui, setUi, data, update, today, t, tf, fmt } = useApp();
  const ms = monthsList(evs), tm = today.slice(0, 7);
  const pmonth = ui.pmonth && ms.includes(ui.pmonth) ? ui.pmonth : ms.includes(tm) ? tm : ms[0] || tm;
  const sheets = ms.filter((k) => !data.printOff[k]);
  const i = ms.indexOf(pmonth), npages = ui.pall ? sheets.length : 1;
  const paper = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const fit = (): void => { const pa = paper.current; if (pa) pa.style.setProperty('--k', Math.min(1.4, pa.clientWidth / 1060).toFixed(4)); };
    fit();
    window.addEventListener('resize', fit);
    const ro = typeof ResizeObserver !== 'undefined' && paper.current ? new ResizeObserver(fit) : null;
    if (ro && paper.current) ro.observe(paper.current);
    return () => { window.removeEventListener('resize', fit); ro?.disconnect(); };
  });
  const go = (j: number): void => { if (j >= 0 && j < ms.length) setUi({ pmonth: ms[j], stkSel: null }); };
  return (
    <div className="ptwo">
      <div className="pside noprint">
        <button type="button" className="btn bigbtn" onClick={() => setUi({ printHelp: true })}>{PRINTER_SVG}<span>{t('Imprimer')}</span><small>{tf('{n} page(s)', { n: npages })}</small></button>
        <div className="controls noprint">
          <Seg label={t('Quoi imprimer')} value={ui.pall ? 'all' : 'one'} options={[['one', t('Un mois')], ['all', t('Plusieurs mois')]]} onChange={(v) => setUi({ pall: v === 'all', sel: null })} />
          {!ui.pall && (
            <>
              <button className="btn ghost" disabled={i <= 0} aria-label={t('Mois précédent')} onClick={() => go(i - 1)}>←</button>
              <select id="pmonth" aria-label={t('Mois à imprimer')} value={pmonth} onChange={(e) => setUi({ pmonth: e.target.value, stkSel: null })}>
                {ms.map((k) => <option key={k} value={k}>{cap(fmt.month.format(parse(k + '-01')))}</option>)}
              </select>
              <button className="btn ghost" disabled={i >= ms.length - 1} aria-label={t('Mois suivant')} onClick={() => go(i + 1)}>→</button>
            </>
          )}
        </div>
        <div className="noprint"><SubjectChips /></div>
        {ui.pall && <MonthPicker ms={ms} />}
        <div className="panel noprint">
          <div className="opt"><span className="lbl">{t("Couleurs d'impression")}</span>
            <div className="chips">
              <button type="button" className="fchip" aria-pressed={data.prefs.ppal === 'sobre'} onClick={() => update((d) => { d.prefs.ppal = 'sobre'; })}><i className="sd" style={{ background: PRINT_PALS.sobre.m }} />{t(PRINT_PALS.sobre.n || '')}</button>
              <button type="button" className="fchip" aria-pressed={data.prefs.ppal === 'perso'} onClick={() => update((d) => { d.prefs.ppal = 'perso'; })}><i className="sd" style={{ background: data.prefs.pcustom }} />{t('Couleur')}</button>
            </div>
          </div>
          {data.prefs.ppal === 'perso' && <ColorPicker value={data.prefs.pcustom} onChange={(hex) => update((d) => { d.prefs.pcustom = hex; d.prefs.ppal = 'perso'; })} />}
        </div>
        {!ui.pall ? <StickerPanel month={pmonth} ms={ms} /> : <p className="hint noprint">{t('Pour placer ou changer des stickers, repasse en « Un mois ».')}</p>}
        <p className="hint noprint">{t("Aperçu de la feuille A4 paysage, une page par mois. Pour imprimer, utilise la fonction Imprimer du navigateur (Ctrl ou Cmd + P), échelle 100 %. Le fond reste blanc : seules quelques touches de couleur sont imprimées.")}</p>
      </div>
      <div className="pmain">
        <div className="paper printzone" ref={paper}>
          {ui.pall
            ? (sheets.length ? sheets.map((k) => <Sheet key={k} month={k} edit={false} />) : <div className="empty noprint">{t('Aucun mois sélectionné.')}</div>)
            : <Sheet month={pmonth} edit />}
        </div>
      </div>
    </div>
  );
}
