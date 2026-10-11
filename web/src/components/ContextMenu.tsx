import { useEffect, type ReactNode } from 'react';
import { useApp } from '../state/app';

/** Right-click (or long-press) menu on a tile. */
export function ContextMenu(): ReactNode {
  const { ui, setUi, data, update, t } = useApp();
  const m = ui.menu;
  useEffect(() => {
    if (!m) return;
    const close = (): void => setUi({ menu: null });
    const onKey = (e: KeyboardEvent): void => { if (e.key === 'Escape') close(); };
    document.addEventListener('click', close);
    document.addEventListener('keydown', onKey);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => { document.removeEventListener('click', close); document.removeEventListener('keydown', onKey); window.removeEventListener('scroll', close, true); window.removeEventListener('resize', close); };
  }, [m, setUi]);
  if (!m) return null;
  const done = !!(m.doneId && data.done[m.doneId]);
  const left = Math.max(4, Math.min(m.x, window.innerWidth - 200)), top = Math.max(4, Math.min(m.y, window.innerHeight - 120));
  return (
    <div className="ctx" role="menu" style={{ left, top }} onContextMenu={(e) => e.preventDefault()}>
      {m.key && <button role="menuitem" type="button" onClick={() => setUi({ editing: m.key, menu: null })}>✎ {t('Éditer')}</button>}
      {m.doneId && (
        <button role="menuitem" type="button" onClick={() => { const id = m.doneId as string; update((d) => { if (d.done[id]) delete d.done[id]; else d.done[id] = true; }); setUi({ menu: null }); }}>
          {done ? '☐ ' + t('Marquer comme non fait') : '☑ ' + t('Marquer comme fait')}
        </button>
      )}
    </div>
  );
}
