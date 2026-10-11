import type { ReactNode } from 'react';
import { diff, iso, parse, rel } from '../lib/dates';
import { LANGN } from '../lib/i18n';
import { appEyebrow, appTitle, backlogCount, dueSoon, lateDevoirs, nextDevoir, renduTotals } from '../lib/model';
import type { Lang, Mode } from '../types';
import { useApp, type Tab } from '../state/app';
import { ColorPicker } from './ColorPicker';
import { Flag } from './Flags';
import { Seg } from './common';

export function Banner(): ReactNode {
  const { model, data, today, t, fmt } = useApp();
  const next = nextDevoir(model, data, today), late = lateDevoirs(model, data, today);
  const notRendu = (id: string): string => model.subjects.filter((s) => !data.rendu[id + ':' + s.id]).map((s) => s.ab).join(', ');
  const lateH = late.length > 0 && <div className="nb-late">{t('En retard : ')}{late.map((d) => t(d.title) + ' (' + notRendu(d.id) + ')').join(' · ')}</div>;
  if (!next) {
    return <div className="nb noprint" role="status"><div className="nb-l"><div className="nb-k">{t('Devoirs')}</div><div className="nb-t">{t('Tout est rendu, bravo !')}</div></div>{lateH}</div>;
  }
  const n = diff(next.date, today);
  return (
    <div className="nb noprint" role="status">
      <div className="nb-l">
        <div className="nb-k">{t(n === 0 ? 'Prochain devoir à rendre' : 'Prochain devoir à rendre dans')}</div>
        <div className="nb-n">{n === 0 ? <span className="txt">{t("Aujourd'hui")}</span> : <><span>{n}</span><small>{t(n > 1 ? 'jours' : 'jour')}</small></>}</div>
      </div>
      <div className="nb-r">
        <div className="nb-t">{t(next.title)}</div>
        <div className="nb-d">{fmt.long.format(parse(next.date))}</div>
        <div className="nb-d">{t('Reste à rendre : ')}{notRendu(next.id)}</div>
      </div>
      {lateH}
    </div>
  );
}

export function Summary(): ReactNode {
  const { model, data, evs, today, t, tf, fmt } = useApp();
  const next = nextDevoir(model, data, today), nd = next ? diff(next.date, today) : null;
  const { done, total } = renduTotals(model, data);
  return (
    <div className="sum noprint">
      <div><div className="eyebrow">{t('Prochain devoir')}</div><div className={'v' + (next && nd! <= 7 ? ' red' : '')}>{next ? t(next.title) : t('Aucun')}</div><small>{next ? rel(nd!, t, tf) + ' · ' + fmt.long.format(parse(next.date)) : t('Tout est rendu')}</small></div>
      <div><div className="eyebrow">{t('À rattraper')}</div><div className="v">{backlogCount(evs, today, data)}</div><small>{t('lives et webconférences à revoir')}</small></div>
      <div><div className="eyebrow">{t('Devoirs rendus')}</div><div className="v">{done} / {total}</div><small>{tf('{a} devoirs × {b} matières', { a: model.devoirs.length, b: model.subjects.length })}</small></div>
    </div>
  );
}

function ThemeBar(): ReactNode {
  const { data, update, ui, setUi, t } = useApp();
  const modes: Array<[Mode, string]> = [['auto', t('Auto')], ['light', t('Clair')], ['dark', t('Sombre')]];
  return (
    <div className="themebar" role="group" aria-label={t('Apparence')}>
      <div className="chips">
        <button type="button" className="fchip" aria-pressed={ui.themePick} onClick={() => setUi({ themePick: !ui.themePick })}><i className="sd" style={{ background: data.prefs.custom }} />{t('Couleur')}</button>
        <button type="button" className="fchip" aria-pressed={ui.deco} onClick={() => setUi({ deco: !ui.deco, ...(ui.deco ? { bsel: null, bgColor: false } : {}) })}>🎀 {t('Décorer')}</button>
      </div>
      <Seg value={data.prefs.mode} options={modes} onChange={(m) => update((d) => { d.prefs.mode = m; })} />
      <div className="langs" role="group" aria-label={t('Langue')}>
        {(['fr', 'en', 'es'] as Lang[]).map((l) => (
          <button key={l} type="button" className="flag" aria-pressed={data.prefs.lang === l} aria-label={LANGN[l]} title={LANGN[l]} onClick={() => update((d) => { d.prefs.lang = l; })}><Flag lang={l} /></button>
        ))}
      </div>
    </div>
  );
}

export function Header(): ReactNode {
  const { data, today, t, fmt, ui, update } = useApp();
  const eyebrow = appEyebrow(data);
  return (
    <>
      <header className="top noprint">
        <div>
          {eyebrow && <div className="eyebrow">{eyebrow}</div>}
          <h1>{appTitle(data, t)}</h1>
          <p>{fmt.long.format(parse(today))}</p>
        </div>
        <ThemeBar />
      </header>
      {ui.themePick && (
        <div className="panel noprint">
          <div className="opt"><span className="lbl">{t('Couleur personnalisée')}</span></div>
          <ColorPicker value={data.prefs.custom} onChange={(hex) => update((d) => { d.prefs.custom = hex; d.prefs.pal = 'perso'; })} />
        </div>
      )}
    </>
  );
}

export function SimBar(): ReactNode {
  const { ui, setUi, model, data, t, fmt } = useApp();
  if (!ui.sim) return null;
  return (
    <div className="simbar noprint">{t('Date simulée : ')}{fmt.long.format(parse(ui.sim))}{' '}
      <button onClick={() => setUi({ sim: null, alertOpen: dueSoon(model, data, iso(new Date())).length > 0 })}>{t("Revenir à aujourd'hui")}</button>
    </div>
  );
}

export function Tabs(): ReactNode {
  const { ui, setUi, t } = useApp();
  const tabs: Array<[Tab, string]> = [['planning', t('Planning')], ['devoirs', t('Devoirs')], ['print', t('Imprimer')], ['edit', '✎ ' + t('Édition')]];
  return (
    <div className="tabs noprint" role="tablist">
      {tabs.map(([v, label]) => <button key={v} role="tab" aria-selected={ui.tab === v} onClick={() => setUi({ tab: v })}>{label}</button>)}
    </div>
  );
}

export function SimTool(): ReactNode {
  const { ui, setUi, model, data, t } = useApp();
  return (
    <details className="tools noprint">
      <summary>{t('Tester avec une autre date')}</summary>
      <div>
        <label htmlFor="simdate">{t('Date simulée')}</label>
        <input type="date" id="simdate" value={ui.sim || ''} onChange={(e) => {
          const sim = e.target.value || null;
          const td = sim || iso(new Date());
          setUi({ sim, alertOpen: dueSoon(model, data, td).length > 0, ...(ui.view === 'month' ? { month: td.slice(0, 7) } : {}) });
        }} />
      </div>
    </details>
  );
}

