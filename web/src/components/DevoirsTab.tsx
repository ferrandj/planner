import type { ReactNode } from 'react';
import { diff, parse, rel } from '../lib/dates';
import { renduCount } from '../lib/model';
import { useApp } from '../state/app';
import { addDevoir, addSubject } from '../lib/items';
import { EditBtn, NoteBtn, Toggles, useTileMenu } from './common';
import { Row } from './Row';

export function DevoirsTab(): ReactNode {
  const { model, data, evs, today, t, tf, fmt, update, setUi, base } = useApp();
  const menu = useTileMenu();
  const create = (make: (d: typeof data) => string): void => { let key = ''; update((d) => { key = make(d); }); setUi({ editing: key }); };
  return (
    <>
      <div className="controls">
        <span className="spacer" />
        <button type="button" className="btn" onClick={() => create((d) => addDevoir(d, base, today))}>{t('+ Ajouter un devoir')}</button>
      </div>
      <div className="dgrid">
        {model.devoirs.map((d) => {
          const dd = diff(d.date, today), left = model.subjects.length - renduCount(model, data, d), urgent = dd >= 0 && dd <= 7 && left > 0;
          const st = left === 0 ? <span className="st ok">{t('Tout rendu')}</span> : dd < 0 ? <span className="st urgent">{t('Date dépassée')}</span> : urgent ? <span className="st urgent">{rel(dd, t, tf)}</span> : <span className="st">{rel(dd, t, tf)}</span>;
          return (
            <article key={d.id} className={'dcard' + (urgent ? ' urgent' : '')} onContextMenu={menu('d:' + d.id)}>
              <div className="tags">{st}</div>
              <div className="dbig">{left === 0 ? t('Rendu') : dd >= 0 ? dd + ' ' + t(dd > 1 ? 'jours' : 'jour') : t('En retard')}</div>
              <h3>{t(d.title)}</h3>
              <div className="when">{t('À déposer avant le ') + fmt.long.format(parse(d.date))}</div>
              <div className="meta">{d.avail ? t('Sujet disponible dès le ') + fmt.long.format(parse(d.avail)) : t('Date de mise à disposition non renseignée')}</div>
              <Toggles d={d} />
              <div className="nrow"><NoteBtn k={'dev:' + d.id} title={d.title} /><EditBtn k={'d:' + d.id} label={d.title} /></div>
            </article>
          );
        })}
      </div>
      <div className="cols2">
        <section className="group"><h2>{t('Examens écrits')}</h2><ul className="list">{evs.filter((e) => e.kind === 'exam').map((e) => <Row key={e.id} e={e} />)}</ul></section>
        <section className="group">
          <h2>{t('Mes matières')} <button type="button" className="btn ghost" onClick={() => create((d) => addSubject(d, base))}>{t('+ Ajouter une matière')}</button></h2>
          <ul className="list">
            {model.subjects.map((s) => (
              <li key={s.id} className="row" style={{ gridTemplateColumns: 'auto minmax(0,1fr)' }} onContextMenu={menu('s:' + s.id)}>
                <span className={'chip s' + s.c}>{s.code}</span>
                <div className="tt">{s.name}<div className="nrow"><NoteBtn k={'s:' + s.id} title={s.code + ' · ' + s.name} /><EditBtn k={'s:' + s.id} label={s.name} /></div></div>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </>
  );
}
