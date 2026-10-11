import { useEffect, type MouseEvent, type ReactNode } from 'react';
import { appTitle } from './lib/model';
import { useApp } from './state/app';
import { BackgroundLayer, DecoBar } from './components/Decor';
import { DevoirsTab } from './components/DevoirsTab';
import { EditTab } from './components/EditTab';
import { ContextMenu } from './components/ContextMenu';
import { Overlays } from './components/Overlays';
import { slotCss } from './lib/slotColors';
import { PlanningTab } from './components/PlanningTab';
import { PrintTab } from './components/PrintTab';
import { Banner, Header, SimBar, SimTool, Summary, Tabs } from './components/Top';

const SYNC_TXT = {
  saved: '✓ Enregistré', saving: '… Enregistrement', pending: '… Enregistrement',
  offline: '⚠ Hors ligne : modifications gardées sur cet appareil', cachefull: '⚠ Copie locale pleine : reste connecté au serveur'
} as const;

function SubjectSlotStyles(): ReactNode {
  const { base, data } = useApp();
  const max = base.s.concat(data.extra.s).reduce((m, x) => Math.max(m, x.c || 0), 0);
  const css = slotCss(max);
  return css ? <style id="subject-slots">{css}</style> : null;
}

function SyncPill(): ReactNode {
  const { status, t } = useApp();
  return <div id="syncstat" className={`sync noprint ${status}`} role="status" aria-live="polite">{t(SYNC_TXT[status])}</div>;
}

export function App(): ReactNode {
  const { ui, setUi, data, t } = useApp();
  useEffect(() => { document.title = appTitle(data, t); }, [data, t]);

  // "Are you sure?" buttons disarm as soon as anything else is clicked.
  const disarm = (e: MouseEvent): void => {
    const a = (e.target as Element).closest('[data-arm]')?.getAttribute('data-arm');
    if ((ui.cpArm && a !== 'cp') || (ui.rsArm && a !== 'rs') || (ui.bgArm && a !== 'bg')) {
      setUi((u) => ({ cpArm: a === 'cp' && u.cpArm, rsArm: a === 'rs' && u.rsArm, bgArm: a === 'bg' && u.bgArm }));
    }
  };

  return (
    <div onClickCapture={disarm}>
      <SubjectSlotStyles />
      <BackgroundLayer />
      <div className="wrap" id="app">
        <Banner />
        <Header />
        <SimBar />
        <Summary />
        <Tabs />
        {ui.tab === 'planning' && <div className="noprint tabbody"><PlanningTab /></div>}
        {ui.tab === 'devoirs' && <div className="noprint tabbody"><DevoirsTab /></div>}
        {ui.tab === 'edit' && <div className="noprint tabbody"><EditTab /></div>}
        {ui.tab === 'print' && <PrintTab />}
        <SimTool />
      </div>
      <div id="alert"><Overlays /></div>
      <div id="decobar"><DecoBar /></div>
      <ContextMenu />
      <SyncPill />
    </div>
  );
}
