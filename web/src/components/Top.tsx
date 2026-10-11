import { useEffect, useState, type ReactNode } from 'react';
import { diff, iso, parse, rel } from '../lib/dates';
import { LANGN } from '../lib/i18n';
import { appEyebrow, appTitle, dueSoon, lateSessions, lateDevoirs, nextDevoir, renduTotals } from '../lib/model';
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
  const { model, data, today, t, tf, fmt } = useApp();
  const next = nextDevoir(model, data, today), nd = next ? diff(next.date, today) : null;
  const { done, total } = renduTotals(model, data);
  return (
    <div className="sum noprint">
      <div><div className="eyebrow">{t('Prochain devoir')}</div><div className={'v' + (next && nd! <= 7 ? ' red' : '')}>{next ? t(next.title) : t('Aucun')}</div><small>{next ? rel(nd!, t, tf) + ' · ' + fmt.long.format(parse(next.date)) : t('Tout est rendu')}</small></div>
      <div><div className="eyebrow">{t('Devoirs rendus')}</div><div className="v">{done} / {total}</div><small>{tf('{a} devoirs × {b} matières', { a: model.devoirs.length, b: model.subjects.length })}</small></div>
    </div>
  );
}

const CHEERS = [
  'Tout est rattrapé, bravo ! Continue comme ça 🎉',
  'Aucun cours en retard : tu es à jour, bien joué 👏',
  'Zéro retard ! Belle régularité, on garde le rythme 💪',
  'Tout est à jour. Profites-en, tu l’as bien mérité ✨'
];

/** Number box that can be emptied while typing; only a whole number from 1 to 20 is ever committed, and it snaps back on leaving. */
function MaxField({ value, onCommit, label }: { value: number; onCommit: (v: number) => void; label: string }): ReactNode {
  const [txt, setTxt] = useState<string | null>(null);
  return (
    <input type="number" min={1} max={20} inputMode="numeric" aria-label={label} value={txt ?? String(value)}
      onChange={(e) => { setTxt(e.target.value); const v = Number(e.target.value); if (e.target.value !== '' && Number.isInteger(v) && v >= 1 && v <= 20) onCommit(v); }}
      onBlur={() => setTxt(null)} />
  );
}

/** Under the next assignment: how many classes are late (or an encouragement when there are none), and the automatic catch-up switch. */
export function LateBar(): ReactNode {
  const { model, data, evs, plan, today, update, t, tf, fmt } = useApp();
  const late = lateSessions(evs, today, data);
  const bySubject = model.subjects.map((s) => ({ s, n: late.filter((e) => e.subject === s.id).length })).filter((x) => x.n > 0);
  const auto = !!data.prefs.auto, max = data.prefs.autoMax || 3;
  const last = plan.placed.length ? plan.placed[plan.placed.length - 1] : null;
  const cheer = CHEERS[Math.abs(Number(today.replace(/-/g, ''))) % CHEERS.length];
  return (
    <div className={'lb noprint' + (late.length ? '' : ' ok')} role="status">
      <div className="lb-main">
        {late.length > 0 ? (
          <>
            <div className="lb-n">{late.length}</div>
            <div className="lb-t">
              <b>{t('cours en retard')}</b>
              <span className="lb-s">{bySubject.map((x) => <i key={x.s.id} className={'chip s' + x.s.c}>{x.s.ab} · {x.n}</i>)}</span>
            </div>
          </>
        ) : <div className="lb-t"><b>{t(cheer)}</b></div>}
      </div>
      <div className="lb-auto">
        <button type="button" role="switch" aria-checked={auto} className="sw" onClick={() => update((d) => { d.prefs.auto = !d.prefs.auto; })}>
          <i aria-hidden="true" />{t('Rattrapage automatique')}
        </button>
        {auto && (
          <label className="lb-max">{t('Max. de suite par matière')}<MaxField value={max} onCommit={(v) => update((d) => { d.prefs.autoMax = v; })} label={t('Max. de suite par matière')} /></label>
        )}
        {auto && late.length > 0 && (
          <span className={'lb-info' + (plan.unplaced.length ? ' warn' : '')}>
            {plan.unplaced.length
              ? '⚠ ' + tf('{n} sans créneau libre avant la fin du planning', { n: plan.unplaced.length })
              : last ? '↻ ' + tf('Tout est replanifié jusqu’au {d}', { d: fmt.long.format(parse(last.date)) }) : ''}
          </span>
        )}
      </div>
    </div>
  );
}

interface InstallEvent extends Event { prompt: () => Promise<void> }

/** "Install the app" button, shown only when the browser says the app can be installed (Android Chrome, desktop Chrome/Edge over HTTPS). */
function InstallChip(): ReactNode {
  const { t } = useApp();
  const [ev, setEv] = useState<InstallEvent | null>(null);
  useEffect(() => {
    const on = (e: Event): void => { e.preventDefault(); setEv(e as InstallEvent); };
    const done = (): void => setEv(null);
    window.addEventListener('beforeinstallprompt', on);
    window.addEventListener('appinstalled', done);
    return () => { window.removeEventListener('beforeinstallprompt', on); window.removeEventListener('appinstalled', done); };
  }, []);
  if (!ev) return null;
  return <button type="button" className="fchip" onClick={() => { void ev.prompt().finally(() => setEv(null)); }}>📲 {t("Installer l'application")}</button>;
}

function ThemeBar(): ReactNode {
  const { data, update, ui, setUi, t } = useApp();
  const modes: Array<[Mode, string]> = [['auto', t('Auto')], ['light', t('Clair')], ['dark', t('Sombre')]];
  return (
    <div className="themebar" role="group" aria-label={t('Apparence')}>
      <div className="chips">
        <button type="button" className="fchip" aria-pressed={ui.themePick} onClick={() => setUi({ themePick: !ui.themePick })}><i className="sd" style={{ background: data.prefs.custom }} />{t('Couleur')}</button>
        <button type="button" className="fchip" aria-pressed={ui.deco} onClick={() => setUi({ deco: !ui.deco, ...(ui.deco ? { bsel: null, bgColor: false } : {}) })}>🎀 {t('Décorer')}</button>
        <InstallChip />
      </div>
      <Seg value={data.prefs.mode} options={modes} onChange={(m) => update((d) => { d.prefs.mode = m; })} />
      <div className="langs" role="group" aria-label={t('Langue')}>
        {(['fr', 'en', 'es'] as Lang[]).map((l) => (
          <button key={l} type="button" className="flag" aria-pressed={data.prefs.lang === l} aria-label={LANGN[l]} title={LANGN[l]} onClick={() => update((d) => { d.prefs.lang = l; })}><Flag lang={l} /></button>
        ))}
      </div>
      <button type="button" className="fchip editchip" aria-pressed={ui.tab === 'edit'}
        onClick={() => setUi(ui.tab === 'edit' ? { tab: ui.prevTab || 'planning' } : { tab: 'edit', prevTab: ui.tab })}>✎ {t('Édition')}</button>
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
  const tabs: Array<[Tab, string]> = [['planning', t('Planning')], ['devoirs', t('Devoirs')], ['print', t('Imprimer')]];
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

