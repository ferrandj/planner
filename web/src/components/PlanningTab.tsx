import type { CSSProperties, FormEvent, ReactNode } from 'react';
import type { Evt } from '../types';
import { pad, parse, wdList } from '../lib/dates';
import { eventsOn, inScope, isLate, subjectOf, visible } from '../lib/model';
import { useApp } from '../state/app';
import { Row } from './Row';
import { Seg } from './common';

export function SubjectChips(): ReactNode {
  const { model, ui, setUi, t } = useApp();
  return (
    <div className="chips">
      <button className="fchip" aria-pressed={ui.filter === 'all'} onClick={() => setUi({ filter: 'all' })}>{t('Toutes les matières')}</button>
      {model.subjects.map((s) => (
        <button key={s.id} className={`fchip s${s.c}`} style={{ ['--c' as string]: `var(--s${s.c})` } as CSSProperties}
          aria-pressed={ui.filter === s.id} onClick={() => setUi({ filter: s.id })}>{s.short}</button>
      ))}
    </div>
  );
}

function ListView({ evs }: { evs: Evt[] }): ReactNode {
  const { ui, data, today, t, tf, fmt } = useApp();
  const late: Evt[] = [], byMonth: Record<string, Evt[]> = {}, order: string[] = [];
  evs.forEach((e) => {
    if (ui.scope === 'todo' && isLate(e, today, data)) { late.push(e); return; }
    const k = e.date.slice(0, 7);
    if (!byMonth[k]) { byMonth[k] = []; order.push(k); }
    byMonth[k].push(e);
  });
  if (!late.length && !order.length) return <div className="empty">{t('Rien à afficher avec ces filtres.')}</div>;
  return (
    <>
      {late.length > 0 && (
        <section className="group late">
          <h2>{t('À rattraper')} <span>{tf('{n} en attente', { n: late.length })}</span></h2>
          <ul className="list">{late.map((e) => <Row key={e.id} e={e} />)}</ul>
        </section>
      )}
      {order.map((k) => (
        <section key={k} className="group">
          <h2 style={{ textTransform: 'capitalize' }}>{fmt.month.format(parse(k + '-01'))}</h2>
          <ul className="list">{byMonth[k].map((e) => <Row key={e.id} e={e} />)}</ul>
        </section>
      ))}
    </>
  );
}

function cellLine(e: Evt, ctx: ReturnType<typeof useApp>): ReactNode {
  const { t, model, data } = ctx;
  if (e.kind === 'exam') return <span key={e.id} className="cl cx">{t('Examen')}</span>;
  if (e.kind === 'dispo') return <span key={e.id} className="cl cx">{t('Sujet : ') + t(e.title || '')}</span>;
  const s2 = subjectOf(model, e.subject);
  const lab = e.kind === 'live' ? t('Live du soir') : e.kind === 'webconf' ? t('Webconf') + (e.tag ? ' · ' + t(e.tag) : '') : e.title;
  return <span key={e.id} className={'cl' + (s2 ? ' s' + s2.c : '') + (data.done[e.id] ? ' dn' : '')}>{(s2 ? s2.ab + ' · ' : '') + lab}</span>;
}

function MonthView({ evs }: { evs: Evt[] }): ReactNode {
  const ctx = useApp();
  const { ui, setUi, model, today, t, tf, fmt } = ctx;
  const [y, m] = ui.month.split('-').map(Number);
  const first = new Date(y, m - 1, 1), off = (first.getDay() + 6) % 7, n = new Date(y, m, 0).getDate();
  const shift = (delta: number): void => {
    const d = new Date(y, m - 1 + delta, 1);
    setUi({ month: d.getFullYear() + '-' + pad(d.getMonth() + 1), sel: null });
  };
  const cells: ReactNode[] = [];
  for (let i = 0; i < off; i++) cells.push(<div key={'o' + i} className="cell out" />);
  for (let d = 1; d <= n; d++) {
    const day = `${y}-${pad(m)}-${pad(d)}`, es = eventsOn(evs, day);
    const dv = es.filter((e) => e.kind === 'devoir'), oth = es.filter((e) => e.kind !== 'devoir');
    cells.push(
      <button key={day} type="button" className={'cell' + (day === today ? ' today' : '') + (day === ui.sel ? ' sel' : '') + (dv.length ? ' hasdv' : '')}
        aria-label={tf('{d}, {n} élément(s)', { d: fmt.long.format(parse(day)), n: es.length })}
        onClick={() => setUi({ sel: ui.sel === day ? null : day })}>
        <span className="cd">{d}</span>
        {dv.map((e) => <span key={e.id} className="dvtag"><span className="dvs">{t(e.devoir?.ab || '')}</span><span className="dvl">{t(e.title || '')}</span></span>)}
        <span className="dots">
          {es.slice(0, 6).map((e) => {
            if (e.kind === 'devoir') return <span key={e.id} className="dot sq" />;
            if (e.kind === 'exam') return <span key={e.id} className="dot ex" />;
            const s = subjectOf(model, e.subject);
            return <span key={e.id} className="dot" style={{ ['--c' as string]: s ? `var(--s${s.c})` : 'var(--muted)', ...(e.kind === 'dispo' ? { opacity: 0.45 } : {}) } as CSSProperties} />;
          })}
        </span>
        <span className="clines">{oth.slice(0, 3).map((e) => cellLine(e, ctx))}{oth.length > 3 && <span className="cl cx">+{oth.length - 3}</span>}</span>
      </button>
    );
  }
  const selEvs = ui.sel ? eventsOn(evs, ui.sel) : [];
  return (
    <>
      <div className="mhead">
        <button className="btn ghost" aria-label={t('Mois précédent')} onClick={() => shift(-1)}>←</button>
        <h2>{fmt.month.format(first)}</h2>
        <button className="btn ghost" aria-label={t('Mois suivant')} onClick={() => shift(1)}>→</button>
      </div>
      <div className="cal">
        {wdList(fmt.wdNarrow).map((x, i) => <div key={i} className="wh">{x}</div>)}
        {cells}
      </div>
      <div className="legend">
        {model.subjects.map((s) => <span key={s.id}><i className="dot" style={{ ['--c' as string]: `var(--s${s.c})` } as CSSProperties} />{s.short}</span>)}
        <span><i className="dot sq" />{t('Devoir')}</span><span><i className="dot ex" />{t('Examen')}</span>
      </div>
      {ui.sel && (
        <section className="group">
          <h2 style={{ textTransform: 'capitalize' }}>{fmt.long.format(parse(ui.sel))}</h2>
          {selEvs.length ? <ul className="list">{selEvs.map((e) => <Row key={e.id} e={e} />)}</ul> : <div className="empty">{t('Rien de prévu ce jour-là.')}</div>}
        </section>
      )}
    </>
  );
}

function AddForm(): ReactNode {
  const { ui, setUi, model, update, today, t } = useApp();
  const f = ui.form;
  const set = (k: keyof typeof f, v: string): void => setUi((u) => ({ form: { ...u.form, [k]: v } }));
  const submit = (ev: FormEvent): void => {
    ev.preventDefault();
    const title = f.title.trim();
    if (!title) return;
    update((d) => { d.custom.push({ id: 'c' + Date.now(), title, subject: f.subject || '', date: f.date || today, time: f.time || '', tend: f.tend || '' }); });
    setUi({ form: { title: '', subject: '', date: '', time: '', tend: '' }, formOpen: false });
  };
  return (
    <form className="form" id="addform" onSubmit={submit}>
      <label className="wide" htmlFor="f-title">{t('Titre')}<input id="f-title" name="title" required maxLength={80} placeholder={t('Ex. Relire le chapitre 3')} value={f.title} onChange={(e) => set('title', e.target.value)} /></label>
      <label htmlFor="f-subject">{t('Matière')}
        <select id="f-subject" name="subject" value={f.subject} onChange={(e) => set('subject', e.target.value)}>
          <option value="">{t('Aucune')}</option>
          {model.subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </label>
      <label htmlFor="f-date">{t('Date')}<input id="f-date" name="date" type="date" required value={f.date || today} onChange={(e) => set('date', e.target.value)} /></label>
      <label htmlFor="f-time">{t('Début (facultatif)')}<input id="f-time" name="time" type="time" value={f.time} onChange={(e) => set('time', e.target.value)} /></label>
      <label htmlFor="f-tend">{t('Fin (facultatif)')}<input id="f-tend" name="tend" type="time" value={f.tend} onChange={(e) => set('tend', e.target.value)} /></label>
      <button className="btn" type="submit">{t('Ajouter au planning')}</button>
    </form>
  );
}

export function PlanningTab(): ReactNode {
  const { evs: all, ui, setUi, model, data, today, t } = useApp();
  const evs = all.filter((e) => visible(e, ui.filter));
  return (
    <>
      <div className="controls">
        <Seg className="only-narrow" label={t('Vue')} value={ui.view} options={[['list', t('Liste')], ['month', t('Mois')]]}
          onChange={(v) => setUi({ view: v, month: ui.month || today.slice(0, 7) })} />
        <span className="spacer" />
        <button className="btn" onClick={() => setUi({ formOpen: !ui.formOpen })}>{ui.formOpen ? t('Fermer') : t('+ Ajouter une séance')}</button>
      </div>
      <SubjectChips />
      {ui.formOpen && <AddForm />}
      <div className="split">
        <div className={'pane pane-month' + (ui.view === 'month' ? '' : ' hide-narrow')}><MonthView evs={evs} /></div>
        <div className={'pane pane-list' + (ui.view === 'list' ? '' : ' hide-narrow')}>
          <Seg label={t('Affichage')} value={ui.scope} options={[['todo', t('À faire')], ['all', t('Tout')]]} onChange={(v) => setUi({ scope: v })} />
          <ListView evs={evs.filter((e) => inScope(e, ui.scope, today, model, data))} />
        </div>
      </div>
    </>
  );
}
