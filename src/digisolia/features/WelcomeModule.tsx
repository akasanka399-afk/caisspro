import React from 'react';
import { ArrowRight, Check, Headphones, Layers, ShieldCheck, Smartphone, WifiOff } from 'lucide-react';
import { DIGISOLIA_APPS_CATALOG, DIGISOLIA_CONFIG } from '../config/digisolia.config';
import { DigiSoliaLogo } from '../components/DigiSoliaLogo';
import { markWelcomePageSeen } from '../services/offlineQueue';

interface WelcomeModuleProps {
  onStart: () => void;
  onOpenSupport: () => void;
}

export const WelcomeModule: React.FC<WelcomeModuleProps> = ({ onStart, onOpenSupport }) => {
  const handleStart = () => {
    markWelcomePageSeen();
    onStart();
  };

  return (
    <div className="min-h-full bg-[#F4F7FB] dark:bg-[#05070c] text-slate-900 dark:text-slate-100 py-8 px-4 sm:px-6 lg:px-10">
      <div className="max-w-5xl mx-auto space-y-10">
        {/* Hero Présentation */}
        <section className="rounded-2xl bg-white dark:bg-slate-900 border border-[#E1E7EF] dark:border-slate-800 p-6 sm:p-10">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-8">
            <div className="space-y-5 max-w-2xl">
              <DigiSoliaLogo size="lg" showSignature appAccent="POS" />

              <div className="space-y-3 pt-2">
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  {DIGISOLIA_CONFIG.publisherName} · Version {DIGISOLIA_CONFIG.appVersion} · DAF{' '}
                  {DIGISOLIA_CONFIG.frameworkVersion}
                </p>
                <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-[#163B65] dark:text-white leading-tight [text-wrap:balance]">
                  {DIGISOLIA_CONFIG.appName} — Caisse &amp; Gestion Commerciale
                </h1>
                <p className="text-base text-slate-600 dark:text-slate-300 leading-relaxed">
                  {DIGISOLIA_CONFIG.description}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleStart}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold text-white bg-[#163B65] hover:bg-[#1e4d82] transition-colors cursor-pointer whitespace-nowrap"
                >
                  <span>Commencer</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={onOpenSupport}
                  className="inline-flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold text-[#163B65] dark:text-sky-300 bg-[#F4F7FB] dark:bg-slate-800 hover:bg-[#E1E7EF] dark:hover:bg-slate-700 border border-[#E1E7EF] dark:border-slate-700 transition-colors cursor-pointer whitespace-nowrap"
                >
                  <Headphones className="w-4 h-4 text-[#2783C7]" />
                  <span>Centre d&apos;assistance</span>
                </button>
              </div>
            </div>

            {/* Aperçu Synthétique Éditeur */}
            <div className="w-full lg:w-72 shrink-0 rounded-xl bg-[#163B65] text-white p-6 space-y-4">
              <div className="text-xs font-semibold uppercase tracking-wider text-sky-200">
                Écosystème DigiSolia
              </div>
              <div className="space-y-3 text-sm">
                <div className="flex items-start gap-2.5">
                  <WifiOff className="w-4 h-4 text-sky-300 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-semibold">Continuité hors connexion</div>
                    <p className="text-xs text-sky-100/80">
                      Cache local &amp; synchronisation automatique Firebase
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-2.5">
                  <ShieldCheck className="w-4 h-4 text-sky-300 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-semibold">Données isolées et sécurisées</div>
                    <p className="text-xs text-sky-100/80">
                      Règles strictes par application et par rôle
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-2.5">
                  <Smartphone className="w-4 h-4 text-sky-300 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-semibold">Multi-appareils</div>
                    <p className="text-xs text-sky-100/80">
                      Optimisé Android, tablettes et ordinateurs
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Fonctionnalités principales */}
        <section className="space-y-4">
          <div>
            <h2 className="text-lg font-bold text-[#163B65] dark:text-white">
              Fonctionnalités clés de l&apos;application
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Conçue pour répondre aux réalités du terrain et accélérer vos opérations quotidiennes.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {DIGISOLIA_CONFIG.features.map((feat, idx) => (
              <div
                key={idx}
                className="rounded-xl bg-white dark:bg-slate-900 border border-[#E1E7EF] dark:border-slate-800 p-5 space-y-2"
              >
                <div className="text-xs font-semibold text-[#2783C7] tabular-nums">
                  0{idx + 1}. Fonctionnalité
                </div>
                <h3 className="text-base font-bold text-[#163B65] dark:text-white">
                  {feat.title}
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                  {feat.description}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Avantages & Applications de l'écosystème */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 rounded-xl bg-white dark:bg-slate-900 border border-[#E1E7EF] dark:border-slate-800 p-6 space-y-4">
            <h2 className="text-lg font-bold text-[#163B65] dark:text-white">
              Avantages pour votre activité
            </h2>
            <ul className="space-y-3">
              {DIGISOLIA_CONFIG.benefits.map((benefit, idx) => (
                <li key={idx} className="flex items-start gap-3 text-sm text-slate-700 dark:text-slate-300">
                  <span className="w-5 h-5 rounded-md bg-[#F4F7FB] dark:bg-slate-800 text-[#2783C7] flex items-center justify-center shrink-0 mt-0.5">
                    <Check className="w-3.5 h-3.5" />
                  </span>
                  <span>{benefit}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="lg:col-span-5 rounded-xl bg-white dark:bg-slate-900 border border-[#E1E7EF] dark:border-slate-800 p-6 space-y-4">
            <div className="flex items-center gap-2 text-[#163B65] dark:text-white">
              <Layers className="w-4 h-4 text-[#2783C7]" />
              <h2 className="text-base font-bold">Suite logicielle DigiSolia</h2>
            </div>
            <div className="divide-y divide-[#E1E7EF] dark:divide-slate-800">
              {DIGISOLIA_APPS_CATALOG.map((appItem) => (
                <div key={appItem.appId} className="py-3 first:pt-0 last:pb-0 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-bold text-slate-900 dark:text-white">
                      {appItem.name}
                    </span>
                    <span className="text-xs font-mono text-slate-500 dark:text-slate-400 tabular-nums">
                      v{appItem.version}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-400">
                    {appItem.shortDescription}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Footer Éditeur */}
        <footer className="pt-4 border-t border-[#E1E7EF] dark:border-slate-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
          <span>
            Édité par <strong className="text-[#163B65] dark:text-slate-200">{DIGISOLIA_CONFIG.publisherName}</strong>
          </span>
          <span>
            {DIGISOLIA_CONFIG.contacts.address} · {DIGISOLIA_CONFIG.contacts.phone} · {DIGISOLIA_CONFIG.contacts.email}
          </span>
        </footer>
      </div>
    </div>
  );
};
