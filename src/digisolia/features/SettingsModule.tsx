import React, { useState, useRef } from 'react';
import {
  Sun,
  Moon,
  Bell,
  Globe,
  RefreshCw,
  Download,
  Upload,
  CheckCircle2,
  AlertCircle,
  Wifi,
} from 'lucide-react';
import { useTheme } from '../../services/themeContext';
import { DIGISOLIA_CONFIG } from '../config/digisolia.config';
import {
  getUserPreferences,
  saveUserPreferences,
} from '../services/offlineQueue';
import { DigiSoliaUserPreferences } from '../types/digisolia.types';
import { SyncStatusBanner } from '../components/SyncStatusBanner';
import { store } from '../../services/store';

export const SettingsModule: React.FC = () => {
  const { theme, setTheme } = useTheme();
  const isLight = theme === 'light';

  const [prefs, setPrefs] = useState<DigiSoliaUserPreferences>(() => getUserPreferences());
  const [testingConn, setTestingConn] = useState<boolean>(false);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const updatePref = <K extends keyof DigiSoliaUserPreferences>(
    key: K,
    val: DigiSoliaUserPreferences[K]
  ) => {
    const next = saveUserPreferences({ [key]: val });
    setPrefs(next);
    setNotice({ type: 'success', text: 'Préférences enregistrées localement.' });
  };

  const handleTestFirestore = async () => {
    setTestingConn(true);
    setNotice(null);
    const res = await store.syncNow();
    setTestingConn(false);
    if (res.ok && !res.error) {
      const syncedTotal = res.syncedPosOps + res.dafSynced;
      setNotice({
        type: 'success',
        text:
          syncedTotal > 0
            ? `Connexion Firebase vérifiée et ${syncedTotal} donnée(s) synchronisée(s) avec succès.`
            : 'Connexion au serveur Firebase Cloud Firestore vérifiée et données synchronisées.',
      });
    } else {
      setNotice({
        type: 'error',
        text:
          res.error ||
          'Serveur Firebase momentanément inaccessible. L’application continue en mode hors connexion.',
      });
    }
  };

  // Sauvegarde locale non-destructive des données applicatives
  const handleExportBackup = () => {
    try {
      const backupPayload: Record<string, any> = {
        meta: {
          exportedAt: new Date().toISOString(),
          appId: DIGISOLIA_CONFIG.appId,
          appVersion: DIGISOLIA_CONFIG.appVersion,
          frameworkVersion: DIGISOLIA_CONFIG.frameworkVersion,
        },
        storage: {},
      };

      for (let i = 0; i < localStorage.length; i += 1) {
        const key = localStorage.key(i);
        if (key && (key.startsWith('kassapro_') || key.startsWith('digisolia_'))) {
          const val = localStorage.getItem(key);
          if (val !== null) {
            backupPayload.storage[key] = val;
          }
        }
      }

      const blob = new Blob([JSON.stringify(backupPayload, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `sauvegarde-${DIGISOLIA_CONFIG.appId}-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setNotice({
        type: 'success',
        text: 'Sauvegarde complète exportée avec succès.',
      });
    } catch {
      setNotice({
        type: 'error',
        text: 'Impossible de générer le fichier de sauvegarde.',
      });
    }
  };

  const handleImportBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result || '{}'));
        if (!parsed?.meta?.appId || !parsed?.storage || typeof parsed.storage !== 'object') {
          setNotice({
            type: 'error',
            text: 'Fichier de sauvegarde invalide ou corrompu.',
          });
          return;
        }
        if (parsed.meta.appId !== DIGISOLIA_CONFIG.appId) {
          setNotice({
            type: 'error',
            text: `Sauvegarde incompatible : ce fichier appartient à l'application "${parsed.meta.appId}".`,
          });
          return;
        }

        Object.entries(parsed.storage).forEach(([k, v]) => {
          if (
            (k.startsWith('kassapro_') || k.startsWith('digisolia_')) &&
            typeof v === 'string'
          ) {
            localStorage.setItem(k, v);
          }
        });

        setNotice({
          type: 'success',
          text: 'Sauvegarde restaurée avec succès. Rechargez la page pour actualiser toutes les vues.',
        });
      } catch {
        setNotice({
          type: 'error',
          text: 'Erreur de lecture du fichier JSON de sauvegarde.',
        });
      } finally {
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="min-h-full bg-[#F4F7FB] dark:bg-[#05070c] text-slate-900 dark:text-slate-100 py-6 px-4 sm:px-6 lg:px-10">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="rounded-xl bg-white dark:bg-slate-900 border border-[#E1E7EF] dark:border-slate-800 p-6 space-y-1">
          <h1 className="text-2xl font-extrabold text-[#163B65] dark:text-white">
            Paramètres &amp; préférences
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Configurez l&apos;apparence, les notifications, la synchronisation et vos sauvegardes.
          </p>
        </div>

        {notice && (
          <div
            className={`p-3.5 rounded-xl text-xs flex items-center gap-2 border ${
              notice.type === 'success'
                ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
                : 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300'
            }`}
          >
            {notice.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0" />
            )}
            <span>{notice.text}</span>
          </div>
        )}

        {/* Apparence & Langue */}
        <section className="rounded-xl bg-white dark:bg-slate-900 border border-[#E1E7EF] dark:border-slate-800 p-6 space-y-5">
          <h2 className="text-base font-bold text-[#163B65] dark:text-white">
            Affichage &amp; langue
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Mode visuel (Clair / Sombre)
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setTheme('light')}
                  className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-xs font-bold border transition-colors cursor-pointer ${
                    isLight
                      ? 'bg-[#163B65] text-white border-[#163B65]'
                      : 'bg-[#F4F7FB] dark:bg-slate-950 text-slate-700 dark:text-slate-300 border-[#E1E7EF] dark:border-slate-800'
                  }`}
                >
                  <Sun className="w-4 h-4" />
                  <span>Mode clair</span>
                </button>
                <button
                  type="button"
                  onClick={() => setTheme('neon')}
                  className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-xs font-bold border transition-colors cursor-pointer ${
                    !isLight
                      ? 'bg-[#2783C7] text-white border-[#2783C7]'
                      : 'bg-[#F4F7FB] dark:bg-slate-950 text-slate-700 dark:text-slate-300 border-[#E1E7EF] dark:border-slate-800'
                  }`}
                >
                  <Moon className="w-4 h-4" />
                  <span>Mode sombre</span>
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
                <Globe className="w-3.5 h-3.5 text-[#2783C7]" />
                <span>Langue de l&apos;interface</span>
              </label>
              <select
                value={prefs.language}
                onChange={(e) => updatePref('language', e.target.value as 'fr' | 'en')}
                className="w-full px-3 py-2.5 rounded-lg text-sm bg-[#F4F7FB] dark:bg-slate-950 border border-[#E1E7EF] dark:border-slate-700 text-slate-900 dark:text-white focus:outline-hidden focus:border-[#2783C7]"
              >
                <option value="fr">Français (Burkina Faso / Afrique de l&apos;Ouest)</option>
              </select>
            </div>
          </div>
        </section>

        {/* Gestion des notifications */}
        <section className="rounded-xl bg-white dark:bg-slate-900 border border-[#E1E7EF] dark:border-slate-800 p-6 space-y-4">
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-[#2783C7]" />
            <h2 className="text-base font-bold text-[#163B65] dark:text-white">
              Gestion des notifications
            </h2>
          </div>

          <div className="divide-y divide-[#E1E7EF] dark:divide-slate-800">
            {[
              {
                key: 'notificationsEnabled' as const,
                title: 'Notifications DigiSolia & système',
                desc: 'Afficher les annonces produit et alertes importantes dans la barre supérieure.',
              },
              {
                key: 'soundAlertsEnabled' as const,
                title: 'Effets sonores de caisse',
                desc: 'Retour sonore lors de l’encaissement et du scan code-barres.',
              },
              {
                key: 'stockAlertsEnabled' as const,
                title: 'Alertes de rupture de stock',
                desc: 'Signaler les produits passant sous le seuil minimal configuré.',
              },
              {
                key: 'autoSyncOnReconnect' as const,
                title: 'Synchronisation automatique au retour réseau',
                desc: 'Transférer automatiquement la file d’attente hors connexion vers Firebase.',
              },
            ].map((item) => (
              <div key={item.key} className="py-3 first:pt-0 last:pb-0 flex items-center justify-between gap-4">
                <div className="space-y-0.5">
                  <div className="text-sm font-semibold text-slate-900 dark:text-white">
                    {item.title}
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{item.desc}</p>
                </div>
                <input
                  type="checkbox"
                  checked={prefs[item.key]}
                  onChange={(e) => updatePref(item.key, e.target.checked)}
                  className="w-4 h-4 accent-[#163B65] cursor-pointer shrink-0"
                />
              </div>
            ))}
          </div>
        </section>

        {/* État de synchronisation */}
        <section className="rounded-xl bg-white dark:bg-slate-900 border border-[#E1E7EF] dark:border-slate-800 p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-base font-bold text-[#163B65] dark:text-white">
              État de synchronisation Cloud
            </h2>
            <button
              type="button"
              onClick={handleTestFirestore}
              disabled={testingConn}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold text-[#163B65] dark:text-sky-300 bg-[#F4F7FB] dark:bg-slate-800 hover:bg-[#E1E7EF] dark:hover:bg-slate-700 border border-[#E1E7EF] dark:border-slate-700 transition-colors cursor-pointer"
            >
              {testingConn ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Wifi className="w-3.5 h-3.5" />
              )}
              <span>{testingConn ? 'Synchronisation...' : 'Tester & Synchroniser'}</span>
            </button>
          </div>
          <SyncStatusBanner />
        </section>

        {/* Sauvegardes & Version */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <section className="rounded-xl bg-white dark:bg-slate-900 border border-[#E1E7EF] dark:border-slate-800 p-6 space-y-4">
            <h2 className="text-base font-bold text-[#163B65] dark:text-white">
              Sauvegardes locales
            </h2>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              Exportez une copie complète de vos données locales (articles, ventes, sessions, préférences) ou restaurez une archive compatible.
            </p>
            <div className="flex flex-wrap gap-2.5">
              <button
                type="button"
                onClick={handleExportBackup}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold text-white bg-[#163B65] hover:bg-[#1e4d82] transition-colors cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Exporter sauvegarde (.json)</span>
              </button>

              <input
                ref={fileInputRef}
                type="file"
                accept="application/json"
                onChange={handleImportBackup}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold text-[#163B65] dark:text-slate-200 bg-[#F4F7FB] dark:bg-slate-800 hover:bg-[#E1E7EF] dark:hover:bg-slate-700 border border-[#E1E7EF] dark:border-slate-700 transition-colors cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Restaurer archive</span>
              </button>
            </div>
          </section>

          <section className="rounded-xl bg-white dark:bg-slate-900 border border-[#E1E7EF] dark:border-slate-800 p-6 space-y-3">
            <h2 className="text-base font-bold text-[#163B65] dark:text-white">
              Informations sur la version
            </h2>
            <dl className="space-y-2 text-xs">
              <div className="flex justify-between">
                <dt className="text-slate-500 dark:text-slate-400">Application</dt>
                <dd className="font-semibold text-slate-900 dark:text-white">{DIGISOLIA_CONFIG.appName}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500 dark:text-slate-400">Identifiant unique</dt>
                <dd className="font-mono text-[#2783C7]">{DIGISOLIA_CONFIG.appId}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500 dark:text-slate-400">Version produit</dt>
                <dd className="font-mono tabular-nums font-bold">{DIGISOLIA_CONFIG.appVersion}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500 dark:text-slate-400">Version Framework DAF</dt>
                <dd className="font-mono tabular-nums">{DIGISOLIA_CONFIG.frameworkVersion}</dd>
              </div>
            </dl>
          </section>
        </div>
      </div>
    </div>
  );
};
