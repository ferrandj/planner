import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { SyncClient } from './lib/sync';
import { AppProvider } from './state/app';
import './styles/app.css';

const root = createRoot(document.getElementById('root')!);
const sync = new SyncClient();

function Fatal(): React.ReactNode {
  return (
    <div className="wrap">
      <div className="fatal">
        <h1>Planner</h1>
        <p>Le serveur est injoignable et aucune copie locale n&apos;existe sur cet appareil. Rien n&apos;a été modifié. Vérifie que le conteneur tourne puis réessaie.<br />Server unreachable and no local copy on this device. Nothing was changed.</p>
        <button type="button" onClick={() => location.reload()}>Réessayer / Retry</button>
      </div>
    </div>
  );
}

// Nothing is ever shown (or saved) before the server state has been loaded, so an empty browser can never overwrite real data.
sync.load().then(
  (boot) => root.render(<StrictMode><AppProvider boot={boot} sync={sync}><App /></AppProvider></StrictMode>),
  () => root.render(<Fatal />)
);
