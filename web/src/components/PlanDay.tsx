import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { Evt } from '../types';
import { blockedPeriods, lateOf, partOfHour, planCatchUp, type Part } from '../lib/catchup';
import { addDays, parse } from '../lib/dates';
import { K, partLabel } from '../lib/labels';
import { useApp } from '../state/app';

const HOURS: Record<Part, number[]> = { am: [8, 9, 10, 11], pm: [12, 13, 14, 15, 16, 17, 18, 19, 20, 21] };
const FIRST: Record<Part, string> = { am: '09:00', pm: '14:00' };
const hh = (h: number): string => String(h).padStart(2, '0') + ':00';

interface Choice { id: string; time: string }

/** Choose, for one day, which late classes to catch up and at what time: one in the morning, one in the afternoon/evening. */
function PlanDayBody({ day }: { day: string }): ReactNode {
  const { setUi, evs, data, today, clock, ui, model, update, t, tf, fmt } = useApp();
  const real = evs.filter((e: Evt) => !e.planOf);
  const late = lateOf(real, today, data.done);
  const blocked = blockedPeriods(real, today);
  const closed = useRef<HTMLButtonElement>(null);

  const [choice, setChoice] = useState<Record<Part, Choice | null>>(() => {
    const out: Record<Part, Choice | null> = { am: null, pm: null };
    const mine = late.filter((e) => data.picks[e.id]?.date === day);
    mine.forEach((e) => { const k = data.picks[e.id]; out[partOfHour(k.time)] = { id: e.id, time: k.time }; });
    if (!mine.length) {
      // nothing chosen yet for this day: start from what the automatic planner would do (the user can change everything)
      const sug = planCatchUp({ events: real, today, done: data.done, max: data.prefs.autoMax || 3, nowMin: ui.sim ? 0 : clock });
      sug.placed.filter((p) => p.date === day).forEach((p) => { out[p.part] = { id: p.id, time: FIRST[p.part] }; });
    }
    return out;
  });
  const close = (): void => setUi({ planDay: null });
  useEffect(() => {
    const on = (e: KeyboardEvent): void => { if (e.key === 'Escape') setUi({ planDay: null }); };
    document.addEventListener('keydown', on);
    return () => document.removeEventListener('keydown', on);
  }, [setUi]);
  useEffect(() => { closed.current?.focus({ preventScroll: true }); }, []);

  const save = (): void => {
    update((d) => {
      Object.keys(d.picks).forEach((id) => { if (d.picks[id].date === day) delete d.picks[id]; });
      (['am', 'pm'] as Part[]).forEach((p) => { const c = choice[p]; if (c) d.picks[c.id] = { date: day, time: c.time }; });
    });
    close();
  };

  const label = (e: Evt): string => {
    const s = model.subjects.find((x) => x.id === e.subject);
    const at = data.picks[e.id]?.date;
    const when = at && at !== day ? ' · ' + tf('déjà prévu le {d}', { d: parse(at).getDate() + ' ' + fmt.mon.format(parse(at)) }) : '';
    return `${s ? s.name : ''} · ${K(e.kind, t)} ${tf('du {d}', { d: parse(e.date).getDate() + ' ' + fmt.mon.format(parse(e.date)) })}${when}`;
  };

  const period = (p: Part): ReactNode => {
    const busy = blocked.has(day + '|' + p);
    const c = choice[p];
    const bySubject = model.subjects.map((s) => ({ s, list: late.filter((e) => e.subject === s.id) })).filter((x) => x.list.length);
    const rest = late.filter((e) => !model.subjects.some((s) => s.id === e.subject));
    return (
      <fieldset key={p} className="pd-part" disabled={busy}>
        <legend>{p === 'am' ? '🌅' : '🌙'} {partLabel(p, t)}</legend>
        {busy ? <p className="hint">{t('Déjà occupé ce jour-là par une séance.')}</p> : (
          <div className="pd-row">
            <label>{t('Cours à rattraper')}
              <select aria-label={t('Cours à rattraper') + ' – ' + partLabel(p, t)} value={c?.id || ''}
                onChange={(e) => setChoice((x) => ({ ...x, [p === 'am' ? 'pm' : 'am']: x[p === 'am' ? 'pm' : 'am']?.id === e.target.value ? null : x[p === 'am' ? 'pm' : 'am'], [p]: e.target.value ? { id: e.target.value, time: x[p]?.time || FIRST[p] } : null }))}>
                <option value="">{t('— Rien —')}</option>
                {bySubject.map(({ s, list }) => <optgroup key={s.id} label={s.name}>{list.map((e) => <option key={e.id} value={e.id}>{label(e)}</option>)}</optgroup>)}
                {rest.map((e) => <option key={e.id} value={e.id}>{label(e)}</option>)}
              </select>
            </label>
            <label>{t('Heure')}
              <select aria-label={t('Heure') + ' – ' + partLabel(p, t)} value={c?.time || FIRST[p]} disabled={!c}
                onChange={(e) => setChoice((x) => ({ ...x, [p]: x[p] ? { id: (x[p] as Choice).id, time: e.target.value } : null }))}>
                {HOURS[p].map((h) => <option key={h} value={hh(h)}>{h}h</option>)}
              </select>
            </label>
          </div>
        )}
      </fieldset>
    );
  };

  return (
    <div className="ov" role="dialog" aria-modal="true" aria-labelledby="pd-t" onClick={(e) => { if (e.target === e.currentTarget) close(); }}>
      <div className="modal">
        <div className="mtop acc"><div className="eyebrow">{t('Rattrapage')}</div><div className="big sm" id="pd-t" style={{ textTransform: 'capitalize' }}>{fmt.long.format(parse(day))}</div></div>
        <div className="mbody">
          <p className="hint">{late.length ? tf('Qu’est-ce que tu veux rattraper ce jour-là ? ({n} cours en retard)', { n: late.length }) : t('Plus aucun cours en retard : bravo !')}</p>
          {late.length > 0 && <>{period('am')}{period('pm')}</>}
          <div className="opt">
            <button type="button" className="btn ghost" onClick={close} ref={closed}>{t('Plus tard')}</button>
            <span className="spacer" />
            {late.length > 0 && <button type="button" className="btn" onClick={save}>{t('Enregistrer')}</button>}
          </div>
        </div>
      </div>
    </div>
  );
}

export function PlanDayDialog(): ReactNode {
  const { ui } = useApp();
  return ui.planDay ? <PlanDayBody key={ui.planDay} day={ui.planDay} /> : null;
}

/**
 * Manual planning: when the last class of the day is ticked, ask what to catch up tomorrow (once per day, and only when nothing is chosen yet).
 */
export function CatchUpAsk(): ReactNode {
  const { data, evs, today, ui, setUi } = useApp();
  const manual = !!data.prefs.auto && !!data.prefs.autoManual;
  const items = evs.filter((e) => e.date === today && e.check);
  const allDone = items.length > 0 && items.every((e) => !!data.done[e.planOf || e.id]);
  const prev = useRef<boolean | null>(null);
  useEffect(() => {
    const was = prev.current;
    prev.current = allDone;
    if (was !== false || !allDone || !manual || ui.sim) return;
    const tomorrow = addDays(today, 1);
    const late = lateOf(evs.filter((e) => !e.planOf), today, data.done);
    if (!late.length || late.some((e) => data.picks[e.id]?.date === tomorrow)) return;
    const key = 'planner.asked.' + tomorrow;
    try { if (localStorage.getItem(key)) return; localStorage.setItem(key, '1'); } catch { /* no storage: ask anyway */ }
    setUi({ planDay: tomorrow });
  }, [allDone, manual, today, evs, data.done, data.picks, ui.sim, setUi]);
  return null;
}
