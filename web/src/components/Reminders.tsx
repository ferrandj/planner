import { useEffect, useRef, useState, type ReactNode } from 'react';
import { disablePush, enablePush, pushEnabledHere, pushState, pushSupported, sendTest, syncReminders, type PushState } from '../lib/push';
import { due, LEADS, readShown, toServer, upcoming, writeShown } from '../lib/reminders';
import { chime, primeAudioOnFirstTouch, vibrate } from '../lib/sound';
import { useApp } from '../state/app';

/** Shows the reminder shortly before each start (message, sound, vibration) and keeps the server's schedule up to date for the phone. */
export function ReminderWatcher(): ReactNode {
  const { evs, model, data, t, tf, toast, sync } = useApp();
  const shown = useRef<Record<string, number>>(readShown(typeof localStorage === 'undefined' ? undefined : localStorage));
  const lastSent = useRef('');
  const on = data.prefs.remind !== false, lead = data.prefs.remindLead || 15, sound = data.prefs.remindSound !== false;

  useEffect(() => { primeAudioOnFirstTouch(); }, []);

  useEffect(() => {
    const run = (): void => {
      if (!on) return;
      const now = Date.now();
      const list = upcoming(evs, model, data, now, lead, t, tf, 1);
      const fresh = due(list, now, shown.current);
      if (!fresh.length) return;
      for (const r of fresh) {
        shown.current[r.id] = now;
        const mins = Math.max(1, Math.ceil((r.start - now) / 60_000));
        const body = tf('Commence à {h} (dans {m} min)', { h: new Date(r.start).toTimeString().slice(0, 5), m: mins });
        toast({ kind: 'reminder', title: r.title, body, icon: '⏰', ttl: Math.max(30_000, r.start - now + 60_000) });
        if (document.hidden && 'Notification' in window && Notification.permission === 'granted') {
          void navigator.serviceWorker?.getRegistration().then((reg) => reg?.showNotification(r.title, { body, tag: r.id, vibrate: [200, 100, 200, 100, 400], icon: 'icon-192.png' } as NotificationOptions)).catch(() => undefined);
        }
      }
      writeShown(localStorage, shown.current, now);
      if (sound) { chime('reminder'); vibrate(); }
    };
    run();
    const id = setInterval(run, 15_000);
    return () => clearInterval(id);
  }, [evs, model, data, on, lead, sound, t, tf, toast]);

  // the phone: the server needs to know what is coming (it is the one that wakes the phone up)
  useEffect(() => {
    if (!pushEnabledHere()) return;
    const list = on ? toServer(upcoming(evs, model, data, Date.now(), lead, t, tf, 7)) : [];
    const key = JSON.stringify(list);
    if (key === lastSent.current) return;
    const id = setTimeout(() => { void syncReminders((p, i) => sync.api(p, i), list).then((ok) => { if (ok) lastSent.current = key; }); }, 1500);
    return () => clearTimeout(id);
  }, [evs, model, data, on, lead, t, tf, sync]);

  return null;
}

/** Messages on top of the page. */
export function Toasts(): ReactNode {
  const { toasts, dismissToast, t } = useApp();
  if (!toasts.length) return null;
  return (
    <div className="toasts noprint" aria-live="polite">
      {toasts.map((x) => (
        <div key={x.id} className={'toast ' + x.kind} role={x.kind === 'reminder' ? 'alert' : 'status'}>
          <span className="toast-i" aria-hidden="true">{x.icon || 'ℹ️'}</span>
          <div className="toast-t"><b>{x.title}</b>{x.body && <div>{x.body}</div>}</div>
          <button type="button" className="toast-x" aria-label={t('Fermer')} onClick={() => dismissToast(x.id)}>×</button>
        </div>
      ))}
    </div>
  );
}

/** "Rappels" settings: the reminder before each start, in the app and on the phone. */
export function RemindersDialog(): ReactNode {
  const { ui, setUi, data, update, t, tf, toast, sync } = useApp();
  const [state, setState] = useState<PushState | 'busy' | 'error'>('off');
  const [note, setNote] = useState('');
  const close = (): void => setUi({ remindOpen: false });
  useEffect(() => { void pushState().then(setState); }, []);
  const open = ui.remindOpen;
  useEffect(() => {
    if (!open) return;
    const on = (e: KeyboardEvent): void => { if (e.key === 'Escape') setUi({ remindOpen: false }); };
    document.addEventListener('keydown', on);
    return () => document.removeEventListener('keydown', on);
  }, [open, setUi]);
  if (!open) return null;
  const api = (p: string, i?: RequestInit): Promise<Response> => sync.api(p, i);
  const p = data.prefs;

  const enable = async (): Promise<void> => { setState('busy'); setNote(''); setState(await enablePush(api)); };
  const disable = async (): Promise<void> => { setState('busy'); await disablePush(api); setState(await pushState()); };
  const test = async (): Promise<void> => {
    chime('reminder'); vibrate();
    toast({ kind: 'reminder', title: t('Test du rappel'), body: t('Si tu vois et entends ceci, les rappels dans l’application fonctionnent.'), icon: '⏰', ttl: 8000 });
    if (state === 'on') setNote((await sendTest(api, t('Test du rappel'), t('Les notifications du téléphone fonctionnent.'))) ? t('Notification envoyée : regarde ton téléphone.') : t('Envoi impossible pour le moment (le serveur n’atteint pas le service de notifications).'));
  };

  return (
    <div className="ov" role="dialog" aria-modal="true" aria-labelledby="rm-t" onClick={(e) => { if (e.target === e.currentTarget) close(); }}>
      <div className="modal wide">
        <div className="mtop acc"><div className="eyebrow" id="rm-t">🔔 {t('Rappels')}</div><div className="big sm">{t('Être prévenu avant le début')}</div></div>
        <div className="mbody">
          <label className="check"><input type="checkbox" checked={p.remind !== false} onChange={(e) => update((d) => { d.prefs.remind = e.target.checked; })} /> {t('Me prévenir avant chaque début (cours, webconférence, séance perso…)')}</label>
          <label>{t('Combien de temps avant')}
            <select value={p.remindLead || 15} onChange={(e) => update((d) => { d.prefs.remindLead = Number(e.target.value); })}>
              {LEADS.map((n) => <option key={n} value={n}>{tf('{n} min avant', { n })}</option>)}
            </select>
          </label>
          <label className="check"><input type="checkbox" checked={p.remindSound !== false} onChange={(e) => update((d) => { d.prefs.remindSound = e.target.checked; })} /> {t('Son et vibration dans l’application')}</label>

          <div className="quickadd">
            <div className="lbl">{t('Notifications sur ce téléphone (même application fermée)')}</div>
            {state === 'unsupported' && <p className="hint">{pushSupported() ? t('Non disponible sur ce navigateur.') : t('Indisponible ici : le navigateur exige une adresse sécurisée (HTTPS) pour les notifications du téléphone. Voir le README.')}</p>}
            {state === 'denied' && <p className="hint">{t('Bloqué : autorise les notifications de ce site dans les réglages du navigateur, puis réessaie.')}</p>}
            {state === 'error' && <p className="hint">{t('Impossible de les activer pour le moment. Réessaie.')}</p>}
            {state === 'on' && <p className="hint">✅ {t('Actif sur cet appareil.')}</p>}
            <div className="opt">
              {(state === 'off' || state === 'error' || state === 'denied') && <button type="button" className="btn" onClick={() => void enable()}>{t('Activer sur cet appareil')}</button>}
              {state === 'on' && <button type="button" className="btn ghost" onClick={() => void disable()}>{t('Désactiver sur cet appareil')}</button>}
              <button type="button" className="btn ghost" onClick={() => void test()}>{t('Tester le rappel')}</button>
            </div>
            {note && <p className="hint" role="status">{note}</p>}
          </div>
          <div className="opt"><span className="spacer" /><button type="button" className="btn" onClick={close}>{t('Fermer')}</button></div>
        </div>
      </div>
    </div>
  );
}
