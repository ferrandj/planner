import type { ReactNode } from 'react';
import type { Devoir } from '../types';
import { useApp } from '../state/app';

/** Per-subject "handed in / to hand in" buttons of one assignment. */
export function Toggles({ d, big }: { d: Devoir; big?: boolean }): ReactNode {
  const { model, data, update, t } = useApp();
  return (
    <div className="rend">
      {model.subjects.map((s) => {
        const k = d.id + ':' + s.id, on = !!data.rendu[k];
        return (
          <button key={s.id} type="button" className={`tog s${s.c}${big ? ' big' : ''}`} aria-pressed={on}
            onClick={() => update((x) => { if (x.rendu[k]) delete x.rendu[k]; else x.rendu[k] = true; })}>
            {s.short}{on ? t(' · rendu') : t(' · à rendre')}
          </button>
        );
      })}
    </div>
  );
}

export function NoteBtn({ k, title }: { k: string; title: string }): ReactNode {
  const { data, setUi, t } = useApp();
  const n = (data.notes[k] || []).length;
  return (
    <button type="button" className={'nbtn' + (n ? ' has' : '')} aria-label={t('Notes et pièces jointes') + ' : ' + title}
      onClick={() => setUi({ noteFor: { key: k, title }, noteMsg: '' })}>
      📎 {n ? n : t('Notes')}
    </button>
  );
}

/** Two- or three-way segmented control. */
export function Seg<T extends string>({ label, value, options, onChange, className }: { label?: string; value: T; options: Array<[T, string]>; onChange: (v: T) => void; className?: string }): ReactNode {
  return (
    <div className={'seg' + (className ? ' ' + className : '')} role="group" aria-label={label}>
      {options.map(([v, text]) => <button key={v} type="button" aria-pressed={value === v} onClick={() => onChange(v)}>{text}</button>)}
    </div>
  );
}
