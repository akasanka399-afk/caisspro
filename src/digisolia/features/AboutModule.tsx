import React from 'react';
import { Globe, Mail, MapPin, Phone, ShieldCheck, Target, Compass } from 'lucide-react';
import { DIGISOLIA_CONFIG } from '../config/digisolia.config';
import { DigiSoliaLogo } from '../components/DigiSoliaLogo';

export const AboutModule: React.FC = () => {
  return (
    <div className="min-h-full bg-[#F4F7FB] dark:bg-[#05070c] text-slate-900 dark:text-slate-100 py-6 px-4 sm:px-6 lg:px-10">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Identité DigiSolia */}
        <section className="rounded-xl bg-white dark:bg-slate-900 border border-[#E1E7EF] dark:border-slate-800 p-6 sm:p-8 space-y-4">
          <DigiSoliaLogo size="lg" showSignature />
          <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed pt-2">
            <strong>DigiSolia</strong> est une entreprise de solutions numériques basée au{' '}
            <strong>Burkina Faso</strong>. Nous concevons des logiciels professionnels fiables,
            ergonomiques et adaptés aux réalités économiques et techniques d&apos;Afrique de l&apos;Ouest
            (continuité hors connexion, rapidité d&apos;exécution et sécurité des données).
          </p>
          <div className="text-xs text-slate-500 dark:text-slate-400 pt-1 tabular-nums">
            {DIGISOLIA_CONFIG.appName} · Version {DIGISOLIA_CONFIG.appVersion} · DigiSolia App Framework v
            {DIGISOLIA_CONFIG.frameworkVersion}
          </div>
        </section>

        {/* Mission & Vision */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <section className="rounded-xl bg-white dark:bg-slate-900 border border-[#E1E7EF] dark:border-slate-800 p-6 space-y-3">
            <div className="flex items-center gap-2 text-[#163B65] dark:text-white">
              <Target className="w-5 h-5 text-[#2783C7]" />
              <h2 className="text-base font-bold">Notre Mission</h2>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              Doter les commerces, établissements scolaires, hôtels et PME d&apos;outils numériques
              simples à adopter, robustes face aux coupures réseau et immédiatement rentables au quotidien.
            </p>
          </section>

          <section className="rounded-xl bg-white dark:bg-slate-900 border border-[#E1E7EF] dark:border-slate-800 p-6 space-y-3">
            <div className="flex items-center gap-2 text-[#163B65] dark:text-white">
              <Compass className="w-5 h-5 text-[#2783C7]" />
              <h2 className="text-base font-bold">Notre Vision</h2>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              Devenir le socle technologique de référence au Burkina Faso et dans la sous-région
              pour la digitalisation durable des activités commerciales et de services.
            </p>
          </section>
        </div>

        {/* Coordonnées officielles */}
        <section className="rounded-xl bg-white dark:bg-slate-900 border border-[#E1E7EF] dark:border-slate-800 p-6 space-y-4">
          <h2 className="text-base font-bold text-[#163B65] dark:text-white">
            Coordonnées officielles
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div className="flex items-start gap-3">
              <MapPin className="w-4 h-4 text-[#2783C7] mt-0.5 shrink-0" />
              <div>
                <div className="text-xs text-slate-500 dark:text-slate-400">Siège</div>
                <div className="font-semibold text-slate-900 dark:text-white">
                  {DIGISOLIA_CONFIG.contacts.address}
                </div>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Phone className="w-4 h-4 text-[#2783C7] mt-0.5 shrink-0" />
              <div>
                <div className="text-xs text-slate-500 dark:text-slate-400">Téléphone &amp; WhatsApp</div>
                <div className="font-mono font-semibold text-slate-900 dark:text-white tabular-nums">
                  {DIGISOLIA_CONFIG.contacts.phone}
                </div>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Mail className="w-4 h-4 text-[#2783C7] mt-0.5 shrink-0" />
              <div>
                <div className="text-xs text-slate-500 dark:text-slate-400">Support e-mail</div>
                <div className="font-semibold text-slate-900 dark:text-white">
                  {DIGISOLIA_CONFIG.contacts.email}
                </div>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Globe className="w-4 h-4 text-[#2783C7] mt-0.5 shrink-0" />
              <div>
                <div className="text-xs text-slate-500 dark:text-slate-400">Site officiel</div>
                <div className="font-semibold text-[#2783C7]">
                  {DIGISOLIA_CONFIG.contacts.website}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Conditions d'utilisation & Politique de confidentialité */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <section className="rounded-xl bg-white dark:bg-slate-900 border border-[#E1E7EF] dark:border-slate-800 p-6 space-y-3">
            <h2 className="text-base font-bold text-[#163B65] dark:text-white">
              Conditions d&apos;utilisation
            </h2>
            <ul className="space-y-2 text-xs text-slate-600 dark:text-slate-300 leading-relaxed list-disc pl-4">
              <li>
                L&apos;utilisation des applications DigiSolia est réservée aux établissements et
                utilisateurs autorisés disposant d&apos;une licence ou session active.
              </li>
              <li>
                Chaque utilisateur est responsable de la confidentialité de ses codes PIN, accès
                magasin et identifiants Google Cloud.
              </li>
              <li>
                Toute tentative d&apos;abus, de spam ou d&apos;accès non autorisé aux consoles
                administratives entraîne la suspension automatique de l&apos;accès.
              </li>
            </ul>
          </section>

          <section className="rounded-xl bg-white dark:bg-slate-900 border border-[#E1E7EF] dark:border-slate-800 p-6 space-y-3">
            <div className="flex items-center gap-2 text-[#163B65] dark:text-white">
              <ShieldCheck className="w-4 h-4 text-[#2783C7]" />
              <h2 className="text-base font-bold">Politique de confidentialité</h2>
            </div>
            <ul className="space-y-2 text-xs text-slate-600 dark:text-slate-300 leading-relaxed list-disc pl-4">
              <li>
                Les données métier de chaque application ({DIGISOLIA_CONFIG.appId}) sont strictement
                cloisonnées et ne sont jamais mélangées avec d&apos;autres produits.
              </li>
              <li>
                Les informations personnelles (nom, e-mail, téléphone) servent uniquement à
                l&apos;authentification, au suivi des tickets et à l&apos;assistance client.
              </li>
              <li>
                Aucune donnée sensible n&apos;est partagée avec des tiers commerciaux. Les règles
                Firebase Firestore contrôlent chaque lecture et écriture côté serveur.
              </li>
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
};
