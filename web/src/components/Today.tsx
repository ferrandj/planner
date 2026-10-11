import type { CSSProperties, ReactNode } from 'react';
import { parse } from '../lib/dates';
import { span, timeRange } from '../lib/clock';
import { evTitle } from '../lib/labels';
import { eventsOn, isDone, subjectOf } from '../lib/model';
import { useApp } from '../state/app';
import type { Evt } from '../types';

const order = (e: Evt): number => timeRange(e.time).start ?? -1;     // untimed lines (deadlines, exams) first, then by time

/** Where an event stands right now: done, coming up in X, under way, or past. Only meaningful for the real current day. */
function standing(e: Evt, nowMin: number, done: boolean): { key: 'done' | 'now' | 'soon' | 'later' | 'past' | 'none'; text?: string } {
  if (done) return { key: 'done' };
  const { start, end } = timeRange(e.time);
  if (start === null) return { key: 'none' };
  const stop = end ?? start + 90;
  if (nowMin >= stop) return { key: 'past' };
  if (nowMin >= start) return { key: 'now' };
  return { key: start - nowMin <= 60 ? 'soon' : 'later', text: span(start - nowMin) };
}

/** "Programme du jour": what is planned today, in order, with what is under way and what comes next. */
export function TodayBar(): ReactNode {
  const { evs, model, data, today, realToday, clock, update, t, tf, fmt } = useApp();
  const isReal = today === realToday;
  const items = eventsOn(evs, today).filter((e) => e.kind !== 'dispo').sort((a, b) => order(a) - order(b) || (a.id < b.id ? -1 : 1));
  const nextId = isReal ? items.find((e) => { const k = standing(e, clock, !!e.check && isDone(e, data)).key; return k === 'now' || k === 'soon' || k === 'later'; })?.id : undefined;
  const tick = (e: Evt, on: boolean): void => update((d) => { const k = e.planOf || e.id; if (on) d.done[k] = true; else delete d.done[k]; });

  return (
    <section className="today noprint" aria-label={t('Programme du jour')}>
      <div className="today-h">
        <b>{t('Programme du jour')}</b>
        <span className="today-d">{fmt.long.format(parse(today))}</span>
      </div>
      {items.length === 0 ? (
        <p className="today-empty">{t("Rien de prévu aujourd'hui : profite de ta journée ou avance sur un cours.")}</p>
      ) : (
        <ul className="today-l">
          {items.map((e) => {
            const sb = subjectOf(model, e.subject), done = !!e.check && isDone(e, data);
            const st = isReal ? standing(e, clock, done) : { key: done ? 'done' as const : 'none' as const };
            const label = e.kind === 'exam' ? t('Examen') + ' · ' + t(e.title || '') : e.kind === 'devoir' ? t('À RENDRE') + ' · ' + t(e.title || '') : evTitle(e, t);
            const range = e.kind === 'exam' || e.kind === 'devoir' ? '' : e.time || '';
            return (
              <li key={e.id} className={'today-i st-' + st.key + (e.id === nextId ? ' next' : '')} style={sb ? ({ ['--c' as string]: `var(--s${sb.c})` } as CSSProperties) : undefined}>
                <span className="today-t">{range || (e.kind === 'devoir' || e.kind === 'exam' ? t('Aujourd’hui') : '')}</span>
                <span className="today-m">
                  {sb && <i className={'chip s' + sb.c}>{sb.ab}</i>} {e.planOf && <span aria-hidden="true">↻ </span>}{label}
                </span>
                <span className="today-s">
                  {st.key === 'now' && <b>{t('En cours')}</b>}
                  {(st.key === 'soon' || st.key === 'later') && (e.id === nextId ? <b>{tf('Prochain · dans {d}', { d: st.text ?? '' })}</b> : tf('dans {d}', { d: st.text ?? '' }))}
                  {st.key === 'past' && t('Passé')}
                  {st.key === 'done' && t('Fait')}
                </span>
                {e.check ? (
                  <input type="checkbox" className="chk" checked={done} aria-label={tf('Marquer « {t} » comme fait', { t: label })} onChange={(ev) => tick(e, ev.target.checked)} />
                ) : <span />}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
