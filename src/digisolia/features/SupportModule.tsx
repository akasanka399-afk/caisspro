import React, { useState, useEffect } from 'react';
import {
  Phone,
  Mail,
  MessageCircle,
  Send,
  HelpCircle,
  BookOpen,
  ChevronDown,
  CheckCircle2,
  AlertCircle,
  Clock,
  RefreshCw,
} from 'lucide-react';
import {
  DIGISOLIA_CONFIG,
  SUPPORT_TOPIC_LABELS,
  WORKFLOW_STATUS_LABELS,
} from '../config/digisolia.config';
import {
  DigiSoliaSupportTicket,
  RequestPriority,
  SupportTopic,
} from '../types/digisolia.types';
import {
  checkAntiSpamGate,
  computeContentHash,
  formatFrenchDateTime,
  recordAntiSpamSubmission,
  sanitizeText,
  validateSupportForm,
} from '../utils/validation';
import {
  fetchUserSupportTickets,
  submitSupportTicketToFirestore,
} from '../services/digisoliaFirebase';
import {
  enqueueOfflineOperation,
  getLocalSupportHistory,
  saveLocalSupportTicket,
} from '../services/offlineQueue';
import { useDigiSoliaAuth } from '../hooks/useDigiSoliaAuth';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { User } from '../../types';

interface SupportModuleProps {
  currentUser: User;
}

export const SupportModule: React.FC<SupportModuleProps> = ({ currentUser }) => {
  const { firebaseUser, signInWithGoogle } = useDigiSoliaAuth();
  const { isBrowserOnline } = useOnlineStatus();

  const [topic, setTopic] = useState<SupportTopic>('technical');
  const [priority, setPriority] = useState<RequestPriority>('normal');
  const [subject, setSubject] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [contactPhone, setContactPhone] = useState<string>(currentUser.phone || '');
  const [honeypot, setHoneypot] = useState<string>('');

  const [submitting, setSubmitting] = useState<boolean>(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [faqSearch, setFaqSearch] = useState<string>('');
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);
  const [tickets, setTickets] = useState<DigiSoliaSupportTicket[]>(() =>
    getLocalSupportHistory(DIGISOLIA_CONFIG.appId)
  );

  const loadTickets = async () => {
    const localList = getLocalSupportHistory(DIGISOLIA_CONFIG.appId);
    if (firebaseUser && isBrowserOnline) {
      try {
        const remoteList = await fetchUserSupportTickets(DIGISOLIA_CONFIG.appId, firebaseUser.uid);
        const mergedMap = new Map<string, DigiSoliaSupportTicket>();
        localList.forEach((t) => mergedMap.set(t.id, t));
        remoteList.forEach((t) => {
          mergedMap.set(t.id, t);
          saveLocalSupportTicket(t);
        });
        setTickets(
          Array.from(mergedMap.values()).sort((a, b) =>
            (b.createdAt || '').localeCompare(a.createdAt || '')
          )
        );
        return;
      } catch {
        // Fallback cache local
      }
    }
    setTickets(localList);
  };

  useEffect(() => {
    loadTickets();
  }, [firebaseUser?.uid, isBrowserOnline]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedbackMsg(null);

    const validation = validateSupportForm({
      subject,
      description,
      email: firebaseUser?.email || currentUser.email,
    });
    if (!validation.valid) {
      setFeedbackMsg({ type: 'error', text: validation.error || 'Formulaire invalide.' });
      return;
    }

    const cleanSubject = sanitizeText(subject, 160);
    const cleanDescription = sanitizeText(description, 2500);
    const hash = computeContentHash(['support', DIGISOLIA_CONFIG.appId, topic, cleanSubject, cleanDescription]);

    const spamCheck = checkAntiSpamGate('support', hash, honeypot);
    if (!spamCheck.valid) {
      setFeedbackMsg({ type: 'error', text: spamCheck.error || 'Envoi bloqué.' });
      return;
    }

    setSubmitting(true);
    const nowIso = new Date().toISOString();
    const ticketId = `sup_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

    const newTicket: DigiSoliaSupportTicket = {
      id: ticketId,
      appId: DIGISOLIA_CONFIG.appId,
      authorUid: firebaseUser?.uid || currentUser.id,
      userId: currentUser.id,
      userName: firebaseUser?.displayName || currentUser.name,
      userEmail: firebaseUser?.email || currentUser.email,
      userPhone: sanitizeText(contactPhone, 30),
      topic,
      priority,
      subject: cleanSubject,
      description: cleanDescription,
      appVersion: DIGISOLIA_CONFIG.appVersion,
      status: 'pending',
      createdAt: nowIso,
    };

    try {
      if (isBrowserOnline && firebaseUser?.emailVerified) {
        await submitSupportTicketToFirestore(newTicket);
        saveLocalSupportTicket(newTicket);
        recordAntiSpamSubmission('support', hash);
        setFeedbackMsg({
          type: 'success',
          text: 'Votre demande d’assistance a été transmise à l’équipe DigiSolia.',
        });
      } else {
        const offlineTicket: DigiSoliaSupportTicket = {
          ...newTicket,
          _offlinePending: true,
        };
        enqueueOfflineOperation({
          kind: 'support',
          appId: DIGISOLIA_CONFIG.appId,
          docId: ticketId,
          payload: offlineTicket,
          dedupeHash: hash,
        });
        saveLocalSupportTicket(offlineTicket);
        recordAntiSpamSubmission('support', hash);
        setFeedbackMsg({
          type: 'success',
          text: !isBrowserOnline
            ? 'Hors connexion : votre demande a été enregistrée localement et sera envoyée automatiquement dès le retour d’Internet.'
            : 'Demande enregistrée dans la file d’attente locale. Connectez votre compte Google DigiSolia pour la synchroniser vers le support.',
        });
      }

      setSubject('');
      setDescription('');
      await loadTickets();
    } catch (err: any) {
      // Fallback hors-ligne automatique en cas de coupure réseau pendant l'envoi
      const fallbackTicket: DigiSoliaSupportTicket = {
        ...newTicket,
        _offlinePending: true,
        _syncError: err?.message,
      };
      enqueueOfflineOperation({
        kind: 'support',
        appId: DIGISOLIA_CONFIG.appId,
        docId: ticketId,
        payload: fallbackTicket,
        dedupeHash: hash,
      });
      saveLocalSupportTicket(fallbackTicket);
      setFeedbackMsg({
        type: 'success',
        text: 'Connexion instable : demande placée en file d’attente locale pour synchronisation automatique.',
      });
      setSubject('');
      setDescription('');
      await loadTickets();
    } finally {
      setSubmitting(false);
    }
  };

  const whatsappUrl = `https://wa.me/${DIGISOLIA_CONFIG.contacts.whatsappNumber}?text=${encodeURIComponent(
    `Bonjour DigiSolia, j'ai besoin d'assistance sur ${DIGISOLIA_CONFIG.appName} (v${DIGISOLIA_CONFIG.appVersion}).`
  )}`;

  const filteredFaq = DIGISOLIA_CONFIG.faqItems.filter(
    (f) =>
      f.question.toLowerCase().includes(faqSearch.toLowerCase()) ||
      f.answer.toLowerCase().includes(faqSearch.toLowerCase()) ||
      f.category.toLowerCase().includes(faqSearch.toLowerCase())
  );

  return (
    <div className="min-h-full bg-[#F4F7FB] dark:bg-[#05070c] text-slate-900 dark:text-slate-100 py-6 px-4 sm:px-6 lg:px-10">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="rounded-xl bg-white dark:bg-slate-900 border border-[#E1E7EF] dark:border-slate-800 p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-2xl font-extrabold text-[#163B65] dark:text-white">
              Centre d&apos;assistance DigiSolia
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Contactez notre support technique au Burkina Faso, consultez le guide ou signalez une difficulté technique.
            </p>
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 shrink-0">
            {DIGISOLIA_CONFIG.contacts.supportHours}
          </div>
        </div>

        {/* Canaux de contact directs configurables */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-xl bg-white dark:bg-slate-900 border border-[#E1E7EF] dark:border-slate-800 hover:border-[#2783C7] p-5 flex items-start gap-4 transition-colors"
          >
            <div className="w-10 h-10 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <MessageCircle className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <div className="text-sm font-bold text-[#163B65] dark:text-white">
                Contact WhatsApp
              </div>
              <div className="text-xs font-mono text-slate-600 dark:text-slate-300 tabular-nums">
                {DIGISOLIA_CONFIG.contacts.whatsappDisplay}
              </div>
              <div className="text-xs font-semibold text-[#2783C7]">
                Ouvrir la discussion →
              </div>
            </div>
          </a>

          <a
            href={`tel:${DIGISOLIA_CONFIG.contacts.phone.replace(/\s+/g, '')}`}
            className="rounded-xl bg-white dark:bg-slate-900 border border-[#E1E7EF] dark:border-slate-800 hover:border-[#2783C7] p-5 flex items-start gap-4 transition-colors"
          >
            <div className="w-10 h-10 rounded-lg bg-[#F4F7FB] dark:bg-slate-800 text-[#2783C7] flex items-center justify-center shrink-0">
              <Phone className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <div className="text-sm font-bold text-[#163B65] dark:text-white">
                Appel téléphonique
              </div>
              <div className="text-xs font-mono text-slate-600 dark:text-slate-300 tabular-nums">
                {DIGISOLIA_CONFIG.contacts.phone}
              </div>
              <div className="text-xs font-semibold text-[#2783C7]">
                Appeler le support →
              </div>
            </div>
          </a>

          <a
            href={`mailto:${DIGISOLIA_CONFIG.contacts.email}?subject=${encodeURIComponent(
              `Support ${DIGISOLIA_CONFIG.appName} v${DIGISOLIA_CONFIG.appVersion}`
            )}`}
            className="rounded-xl bg-white dark:bg-slate-900 border border-[#E1E7EF] dark:border-slate-800 hover:border-[#2783C7] p-5 flex items-start gap-4 transition-colors"
          >
            <div className="w-10 h-10 rounded-lg bg-[#F4F7FB] dark:bg-slate-800 text-[#163B65] dark:text-sky-300 flex items-center justify-center shrink-0">
              <Mail className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <div className="text-sm font-bold text-[#163B65] dark:text-white">
                Adresse e-mail
              </div>
              <div className="text-xs font-mono text-slate-600 dark:text-slate-300 break-all">
                {DIGISOLIA_CONFIG.contacts.email}
              </div>
              <div className="text-xs font-semibold text-[#2783C7]">
                Envoyer un e-mail →
              </div>
            </div>
          </a>
        </div>

        {/* Formulaire ticket support + Guide d'utilisation */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Formulaire */}
          <div className="lg:col-span-7 rounded-xl bg-white dark:bg-slate-900 border border-[#E1E7EF] dark:border-slate-800 p-6 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-base font-bold text-[#163B65] dark:text-white">
                  Demande d&apos;assistance ou signalement technique
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Fonctionne aussi hors connexion avec synchronisation automatique.
                </p>
              </div>
              {!firebaseUser && (
                <button
                  type="button"
                  onClick={() => signInWithGoogle()}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-[#2783C7] hover:bg-[#1e6aa3] transition-colors cursor-pointer whitespace-nowrap"
                >
                  Lier compte Google
                </button>
              )}
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Champ honeypot invisible anti-bot */}
              <input
                type="text"
                tabIndex={-1}
                autoComplete="off"
                value={honeypot}
                onChange={(e) => setHoneypot(e.target.value)}
                className="hidden"
                aria-hidden="true"
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Type de demande
                  </label>
                  <select
                    value={topic}
                    onChange={(e) => setTopic(e.target.value as SupportTopic)}
                    className="w-full px-3 py-2.5 rounded-lg text-sm bg-[#F4F7FB] dark:bg-slate-950 border border-[#E1E7EF] dark:border-slate-700 text-slate-900 dark:text-white focus:outline-hidden focus:border-[#2783C7]"
                  >
                    {Object.entries(SUPPORT_TOPIC_LABELS).map(([k, label]) => (
                      <option key={k} value={k}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Niveau d&apos;urgence
                  </label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as RequestPriority)}
                    className="w-full px-3 py-2.5 rounded-lg text-sm bg-[#F4F7FB] dark:bg-slate-950 border border-[#E1E7EF] dark:border-slate-700 text-slate-900 dark:text-white focus:outline-hidden focus:border-[#2783C7]"
                  >
                    <option value="normal">Normale</option>
                    <option value="high">Haute (ralentissement)</option>
                    <option value="urgent">Urgente (blocage activité)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Sujet *
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={160}
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="Ex: Impression ticket 80mm coupée..."
                    className="w-full px-3 py-2.5 rounded-lg text-sm bg-[#F4F7FB] dark:bg-slate-950 border border-[#E1E7EF] dark:border-slate-700 text-slate-900 dark:text-white focus:outline-hidden focus:border-[#2783C7]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Téléphone de rappel (facultatif)
                  </label>
                  <input
                    type="tel"
                    maxLength={30}
                    value={contactPhone}
                    onChange={(e) => setContactPhone(e.target.value)}
                    placeholder="+226 ..."
                    className="w-full px-3 py-2.5 rounded-lg text-sm bg-[#F4F7FB] dark:bg-slate-950 border border-[#E1E7EF] dark:border-slate-700 text-slate-900 dark:text-white focus:outline-hidden focus:border-[#2783C7]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Description détaillée *
                </label>
                <textarea
                  rows={4}
                  required
                  maxLength={2500}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Décrivez précisément la situation rencontrée, l'appareil utilisé et les étapes pour reproduire le problème..."
                  className="w-full px-3 py-2.5 rounded-lg text-sm bg-[#F4F7FB] dark:bg-slate-950 border border-[#E1E7EF] dark:border-slate-700 text-slate-900 dark:text-white focus:outline-hidden focus:border-[#2783C7]"
                />
              </div>

              {feedbackMsg && (
                <div
                  className={`p-3 rounded-lg text-xs flex items-start gap-2 border ${
                    feedbackMsg.type === 'success'
                      ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
                      : 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300'
                  }`}
                >
                  {feedbackMsg.type === 'success' ? (
                    <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  )}
                  <span>{feedbackMsg.text}</span>
                </div>
              )}

              <div className="flex items-center justify-between pt-2">
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  App : {DIGISOLIA_CONFIG.appId} · v{DIGISOLIA_CONFIG.appVersion}
                </span>
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-xs font-bold text-white bg-[#163B65] hover:bg-[#1e4d82] transition-colors disabled:opacity-60 cursor-pointer whitespace-nowrap"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{submitting ? 'Envoi en cours...' : 'Envoyer la demande'}</span>
                </button>
              </div>
            </form>
          </div>

          {/* Guide d'utilisation */}
          <div className="lg:col-span-5 rounded-xl bg-white dark:bg-slate-900 border border-[#E1E7EF] dark:border-slate-800 p-6 space-y-4">
            <div className="flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-[#2783C7]" />
              <h2 className="text-base font-bold text-[#163B65] dark:text-white">
                Guide d&apos;utilisation rapide
              </h2>
            </div>
            <div className="space-y-4">
              {DIGISOLIA_CONFIG.guideSteps.map((st) => (
                <div key={st.step} className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-md bg-[#163B65] text-white text-xs font-bold flex items-center justify-center shrink-0 tabular-nums">
                    {st.step}
                  </span>
                  <div className="space-y-0.5">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                      {st.title}
                    </h3>
                    <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                      {st.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Questions fréquentes */}
        <section className="rounded-xl bg-white dark:bg-slate-900 border border-[#E1E7EF] dark:border-slate-800 p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-2">
              <HelpCircle className="w-4 h-4 text-[#2783C7]" />
              <h2 className="text-base font-bold text-[#163B65] dark:text-white">
                Questions fréquentes (FAQ)
              </h2>
            </div>
            <input
              type="search"
              value={faqSearch}
              onChange={(e) => setFaqSearch(e.target.value)}
              placeholder="Rechercher dans l'aide..."
              className="sm:w-64 px-3 py-1.5 rounded-lg text-xs bg-[#F4F7FB] dark:bg-slate-950 border border-[#E1E7EF] dark:border-slate-700 text-slate-900 dark:text-white focus:outline-hidden focus:border-[#2783C7]"
            />
          </div>

          <div className="divide-y divide-[#E1E7EF] dark:divide-slate-800">
            {filteredFaq.map((faq, idx) => {
              const isOpen = openFaqIndex === idx;
              return (
                <div key={idx} className="py-3 first:pt-0 last:pb-0">
                  <button
                    type="button"
                    onClick={() => setOpenFaqIndex(isOpen ? null : idx)}
                    className="w-full flex items-center justify-between gap-4 text-left py-1 cursor-pointer"
                  >
                    <div className="space-y-0.5">
                      <span className="text-[11px] font-semibold text-[#2783C7]">
                        {faq.category}
                      </span>
                      <div className="text-sm font-bold text-slate-900 dark:text-white">
                        {faq.question}
                      </div>
                    </div>
                    <ChevronDown
                      className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${
                        isOpen ? 'rotate-180' : ''
                      }`}
                    />
                  </button>
                  {isOpen && (
                    <p className="mt-2 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                      {faq.answer}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* Suivi des tickets */}
        <section className="rounded-xl bg-white dark:bg-slate-900 border border-[#E1E7EF] dark:border-slate-800 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-[#163B65] dark:text-white">
              Historique de vos demandes d&apos;assistance ({tickets.length})
            </h2>
            <button
              type="button"
              onClick={loadTickets}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#2783C7] hover:underline cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Actualiser</span>
            </button>
          </div>

          {tickets.length === 0 ? (
            <p className="text-xs text-slate-500 dark:text-slate-400 py-4 text-center">
              Vous n&apos;avez envoyé aucune demande d&apos;assistance pour le moment.
            </p>
          ) : (
            <div className="divide-y divide-[#E1E7EF] dark:divide-slate-800">
              {tickets.map((tk) => (
                <div key={tk.id} className="py-3.5 first:pt-0 last:pb-0 space-y-1.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-sm font-bold text-slate-900 dark:text-white">
                      {tk.subject}
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      {tk._offlinePending && (
                        <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400 font-medium">
                          <Clock className="w-3 h-3" /> En attente de synchro
                        </span>
                      )}
                      <span className="font-semibold text-[#2783C7]">
                        {WORKFLOW_STATUS_LABELS[tk.status]}
                      </span>
                    </div>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-300">
                    {tk.description}
                  </p>
                  <div className="text-[11px] text-slate-400 tabular-nums">
                    {SUPPORT_TOPIC_LABELS[tk.topic]} · Priorité {tk.priority} · {formatFrenchDateTime(tk.createdAt)}
                  </div>
                  {tk.adminResponse && (
                    <div className="mt-2 p-3 rounded-lg bg-[#F4F7FB] dark:bg-slate-800 text-xs text-slate-700 dark:text-slate-200">
                      <span className="font-bold text-[#163B65] dark:text-sky-300">
                        Réponse support ({tk.handledBy || 'DigiSolia'}) :{' '}
                      </span>
                      {tk.adminResponse}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};
