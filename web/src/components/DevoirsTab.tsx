import type { ReactNode } from 'react';
import { diff, parse, rel } from '../lib/dates';
import { renduCount } from '../lib/model';
import { useApp } from '../state/app';
import { NoteBtn, Toggles } from './common';
import { Row } from './Row';

export function DevoirsTab(): ReactNode {
  const { model, data, evs, today, t, tf, fmt } = useApp();
  return (
    <>
      <div className="dgrid">
        {model.devoirs.map((d) => {
          const dd = diff(d.date, today), left = model.subjects.length - renduCount(model, data, d), urgent = dd >= 0 && dd <= 7 && left > 0;
          const st = left === 0 ? <span className="st ok">{t('Tout rendu')}</span> : dd < 0 ? <span className="st urgent">{t('Date dépassée')}</span> : urgent ? <span className="st urgent">{rel(dd, t, tf)}</span> : <span className="st">{rel(dd, t, tf)}</span>;
          return (
            <article key={d.id} className={'dcard' + (urgent ? ' urgent' : '')}>
              <div className="tags">{st}</div>
              <div className="dbig">{left === 0 ? t('Rendu') : dd >= 0 ? dd + ' ' + t(dd > 1 ? 'jours' : 'jour') : t('En retard')}</div>
              <h3>{t(d.title)}</h3>
              <div className="when">{t('À déposer avant le ') + fmt.long.format(parse(d.date))}</div>
              <div className="meta">{d.avail ? t('Sujet disponible dès le ') + fmt.long.format(parse(d.avail)) : t('Date de mise à disposition non renseignée')}</div>
              <Toggles d={d} />
              <div className="nrow"><NoteBtn k={'dev:' + d.id} title={d.title} /></div>
            </article>
          );
        })}
      </div>
      <div className="cols2">
        <section className="group"><h2>{t('Examens écrits')}</h2><ul className="list">{evs.filter((e) => e.kind === 'exam').map((e) => <Row key={e.id} e={e} />)}</ul></section>
        <section className="group">
          <h2>{t('Mes matières')}</h2>
          <ul className="list">
            {model.subjects.map((s) => (
              <li key={s.id} className="row" style={{ gridTemplateColumns: 'auto minmax(0,1fr)' }}>
                <span className={'chip s' + s.c}>{s.code}</span>
                <div className="tt">{s.name}<div className="nrow"><NoteBtn k={'s:' + s.id} title={s.code + ' · ' + s.name} /></div></div>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </>
  );
}
