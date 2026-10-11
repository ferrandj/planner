import type { ReactNode } from 'react';
import type { Evt } from '../types';
import { diff, parse, range, rel } from '../lib/dates';
import { evTitle } from '../lib/labels';
import { isDone, renduCount, subjectOf } from '../lib/model';
import { partLabel } from '../lib/labels';
import { useApp } from '../state/app';
import { editKeyOf } from '../lib/items';
import { EditBtn, NoteBtn, Toggles, useTileMenu } from './common';

/** One line of the planner: a session, a custom session, an assignment, an exam or an "available from" date. */
export function Row({ e }: { e: Evt }): ReactNode {
  const { data, model, plan, t, tf, fmt, today, update } = useApp();
  const dd = diff(e.date, today), dt = parse(e.date), done = !!e.check && isDone(e, data);
  const key = e.planOf || e.id;                       // a catch-up tile stands for the late session it replans
  const moved = plan.byId[e.id];
  const sb = subjectOf(model, e.subject);
  const menu = useTileMenu();
  const ek = editKeyOf(e);
  const tags: ReactNode[] = [];
  let title = '', meta = '', tail: ReactNode = null, extra: ReactNode = null;

  if (sb) tags.push(<span key="chip" className={`chip s${sb.c}`}>{sb.code + ' · ' + sb.short}</span>);
  if (e.check) {
    if (done) tags.push(<span key="st" className="st ok">{t('Fait')}</span>);
    else if (dd < 0) tags.push(<span key="st" className="st late">{e.kind === 'perso' ? t('En retard') : t('À rattraper')}</span>);
    else if (dd === 0) tags.push(<span key="st" className="st now">{t("Aujourd'hui")}</span>);
    if (e.planOf) tags.push(<span key="pl" className="st plan">↻ {t('Rattrapage')}</span>);
    title = evTitle(e, t);
    meta = (e.time ? (e.planOf ? t(e.time) : e.time) + ' · ' : '') + rel(dd, t, tf);
    if (e.planOf && e.from) meta += ' · ' + tf('initialement le {d}', { d: fmt.long.format(parse(e.from)) });
    if (moved && !done) extra = <div className="replanned">↻ {tf('Replanifié : {d} · {p}', { d: fmt.long.format(parse(moved.date)), p: partLabel(moved.part, t) })}</div>;
    const box = (
      <input type="checkbox" className="chk" checked={done} aria-label={tf('Marquer « {t} » comme fait', { t: title })}
        onChange={(ev) => update((d) => { if (ev.target.checked) d.done[key] = true; else delete d.done[key]; })} />
    );
    tail = e.kind === 'perso' ? (
      <span style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
        <button className="del" aria-label={t('Supprimer')}
          onClick={() => update((d) => { d.custom = d.custom.filter((c) => c.id !== e.id); delete d.done[e.id]; })}>×</button>
        {box}
      </span>
    ) : box;
  } else if (e.kind === 'devoir' && e.devoir) {
    const left = model.subjects.length - renduCount(model, data, e.devoir);
    if (left === 0) tags.push(<span key="st" className="st ok">{t('Tout rendu')}</span>);
    else if (dd < 0) tags.push(<span key="st" className="st urgent">{t('Date dépassée')}</span>);
    else if (dd <= 7) tags.push(<span key="st" className="st urgent">{rel(dd, t, tf)}</span>);
    tags.push(<span key="solid" className="chip solid">{t('À RENDRE')}</span>);
    title = t(e.title || '');
    meta = tf('Date limite {r} · {a}/{b} matières rendues', { r: rel(dd, t, tf), a: renduCount(model, data, e.devoir), b: model.subjects.length });
    extra = <Toggles d={e.devoir} />;
  } else if (e.kind === 'exam') {
    tags.push(<span key="x" className="chip" style={{ ['--c' as string]: 'var(--fg)' }}>{t('Examen')}</span>);
    title = t(e.title || ''); meta = range(e, fmt) + ' · ' + rel(dd, t, tf);
  } else {
    tags.push(<span key="d" className="chip">{t('Sujet disponible')}</span>);
    title = t(e.title || ''); meta = rel(dd, t, tf);
  }

  return (
    <li className={`row kind-${e.kind}${done ? ' done' : ''}`} onContextMenu={menu(ek, e.check ? key : null)}>
      <div className="dt"><span className="wd">{fmt.wd.format(dt)}</span><span className="dn">{dt.getDate()}</span></div>
      <div className="bd">
        <div className="tags">{tags}</div>
        <div className="tt">{title}</div>
        <div className="mt">{meta}</div>
        {extra}
        <div className="nrow"><NoteBtn k={key} title={(sb ? sb.ab + ' · ' : '') + title + ' · ' + fmt.long.format(dt)} />{ek && <EditBtn k={ek} label={title} />}</div>
      </div>
      {tail ?? <span />}
    </li>
  );
}

