import { useEffect, useRef, useState, type ReactNode } from 'react';

import { entriesSince, latestEntries, markSeen, seenVersion, setShowAgain, showAgain } from '../lib/changelog';
import { parse } from '../lib/dates';
import { useApp } from '../state/app';

/** The running version, asked of the server ("dev" for a development build); null when it cannot be reached. */
async function runningVersion(api: (p: string) => Promise<Response>): Promise<string | null> {
  try { const r = await api('api/version'); return r.ok ? String(((await r.json()) as { version?: string }).version || '') || null : null; } catch { return null; }
}

/** After an update, the first opening shows what is new; also when the "show again" switch was left on. Waits for the English question, if there is one. */
export function NewsStartup(): ReactNode {
  const { data, ui, setUi, sync } = useApp();
  const done = useRef(false);
  const ready = data.prefs.quiz === false || ui.quizPassed;
  useEffect(() => {
    if (!ready || done.current) return;
    done.current = true;
    void (async () => {
      const version = await runningVersion((p) => sync.api(p));
      const again = showAgain();
      const real = !!version && version !== 'dev';
      const entries = real ? entriesSince(seenVersion(), version as string) : [];
      if (entries.length) setUi({ news: { version: version as string, entries } });
      else if (again) setUi({ news: { version: real ? (version as string) : '', entries: latestEntries(4) } });
    })();
  }, [ready, sync, setUi]);
  return null;
}

/** "🆕 Nouveautés": opens the latest changes at any time. */
export function NewsChip(): ReactNode {
  const { setUi, sync, t } = useApp();
  return <button type="button" className="fchip" onClick={() => { void runningVersion((p) => sync.api(p)).then((v) => setUi({ news: { version: v && v !== 'dev' ? v : '', entries: latestEntries(4) } })); }}>🆕 {t('Nouveautés')}</button>;
}

export function ChangelogDialog(): ReactNode {
  const { ui, setUi, lang, fmt, t, tf } = useApp();
  const news = ui.news;
  const [again, setAgain] = useState(showAgain());
  const ok = useRef<HTMLButtonElement>(null);
  const close = (): void => { if (news?.version) markSeen(news.version); setUi({ news: null }); };
  const closeRef = useRef(close);
  closeRef.current = close;
  useEffect(() => {
    if (!news) return;
    setAgain(showAgain());
    ok.current?.focus({ preventScroll: true });
    const on = (e: KeyboardEvent): void => { if (e.key === 'Escape') closeRef.current(); };
    document.addEventListener('keydown', on);
    return () => document.removeEventListener('keydown', on);
  }, [news]);
  if (!news) return null;
  return (
    <div className="ov" role="dialog" aria-modal="true" aria-labelledby="cl-t">
      <div className="modal wide">
        <div className="mtop acc"><div className="eyebrow" id="cl-t">🆕 {t('Nouveautés')}</div><div className="big sm">{news.version ? tf('Version {v}', { v: news.version }) : t('Dernières nouveautés')}</div></div>
        <div className="mbody">
          <div className="cl-list">
            {news.entries.map((e) => (
              <section key={e.version} className="cl-entry">
                <h3>v{e.version} <small>{fmt.long.format(parse(e.date))}</small></h3>
                <ul>{e.items.map((i, n) => <li key={n}>{i[lang]}</li>)}</ul>
              </section>
            ))}
          </div>
          <label className="check">
            <input type="checkbox" role="switch" checked={again} onChange={(e) => { setShowAgain(e.target.checked); setAgain(e.target.checked); }} /> {t('Réafficher au prochain démarrage')}
          </label>
          <div className="opt"><span className="spacer" /><button ref={ok} type="button" className="btn" onClick={close}>{t('Compris')}</button></div>
        </div>
      </div>
    </div>
  );
}

