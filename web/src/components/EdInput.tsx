import { useEffect, useState, type ReactNode } from 'react';
import { setEdit } from '../lib/edits';
import { useApp } from '../state/app';

export interface EdOpts { wide?: boolean; max?: number; clear?: boolean; options?: Array<[string, string]> }

/** A text/date/select field of an editor card. Edits are saved as you type; a refused blank is restored when leaving the field. */
export function EdInput({ k, f, label, type, val, opt }: { k: string; f: string; label: string; type: string; val: string; opt?: EdOpts }): ReactNode {
  const { data, base, update, t } = useApp();
  const [draft, setDraft] = useState(val);
  const [focus, setFocus] = useState(false);
  useEffect(() => { if (!focus) setDraft(val); }, [val, focus]);
  const mod = data.edits[k]?.[f] !== undefined;
  const commit = (v: string): void => { setDraft(v); update((d) => { setEdit(d, base, k, f, v); }); };
  return (
    <label className={(opt?.wide ? 'wide ' : '') + (mod ? 'mod' : '')}>{t(label)}
      {opt?.options ? (
        <select value={draft} onChange={(e) => commit(e.target.value)}>{opt.options.map((o) => <option key={o[0]} value={o[0]}>{o[1]}</option>)}</select>
      ) : (
        <input type={type} value={draft} maxLength={opt?.max} onFocus={() => setFocus(true)} onBlur={() => { setFocus(false); setDraft(val); }} onChange={(e) => commit(e.target.value)} />
      )}
      {opt?.clear && val && <button type="button" className="lnk" onClick={() => commit('')}>{t('Effacer cette date')}</button>}
    </label>
  );
}
