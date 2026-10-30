import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { registerSW } from 'virtual:pwa-register';

// Enregistrement du Service Worker PWA avec mise à jour automatique
registerSW({
  immediate: true,
  onNeedRefresh() {
    console.log('[PWA] Caisse Pro : Nouvelle mise à jour disponible');
  },
  onOfflineReady() {
    console.log('[PWA] Caisse Pro : Prêt pour encaissement 100% hors-ligne');
  },
});

createRoot(document.getElementById('root')!).render(<App />);

