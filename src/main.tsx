import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { registerSW } from 'virtual:pwa-register';

if (import.meta.env.DEV) {
  // Nettoyage d'un éventuel ancien Service Worker de développement pour éviter tout cache obsolète
  if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
    navigator.serviceWorker
      .getRegistrations()
      .then(async (registrations) => {
        if (registrations.length === 0) return;
        let didUnregister = false;
        for (const registration of registrations) {
          const ok = await registration.unregister();
          if (ok) didUnregister = true;
        }
        if (typeof caches !== 'undefined') {
          const names = await caches.keys();
          await Promise.all(
            names
              .filter((name) => name.includes('workbox') || name.includes('precache'))
              .map((name) => caches.delete(name))
          );
        }
        if (didUnregister && typeof sessionStorage !== 'undefined' && !sessionStorage.getItem('kassapro_dev_sw_cleaned')) {
          sessionStorage.setItem('kassapro_dev_sw_cleaned', '1');
          window.location.reload();
        }
      })
      .catch(() => {
        // Ignore cleanup errors
      });
  }
} else {
  // Enregistrement du Service Worker PWA avec mise à jour automatique en production
  registerSW({
    immediate: true,
    onNeedRefresh() {
      console.log('[PWA] Caisse Pro : Nouvelle mise à jour disponible');
    },
    onOfflineReady() {
      console.log('[PWA] Caisse Pro : Prêt pour encaissement 100% hors-ligne');
    },
  });
}

createRoot(document.getElementById('root')!).render(<App />);

