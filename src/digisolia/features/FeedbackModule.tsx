import React, { useState, useEffect } from 'react';
import { Star, Send, CheckCircle2, AlertCircle, Clock, RefreshCw } from 'lucide-react';
import {
  DIGISOLIA_CONFIG,
  FEEDBACK_CATEGORY_LABELS,
  WORKFLOW_STATUS_LABELS,
} from '../config/digisolia.config';
import { DigiSoliaFeedbackItem, FeedbackCategory } from '../types/digisolia.types';
import {
  checkAntiSpamGate,
  computeContentHash,
  formatFrenchDateTime,
  recordAntiSpamSubmission,
  sanitizeText,
  validateFeedbackForm,
} from '../utils/validation';
import {
  fetchUserFeedback,
  submitFeedbackToFirestore,
} from '../services/digisoliaFirebase';
import {
  enqueueOfflineOperation,
  getLocalFeedbackHistory,
  saveLocalFeedbackItem,
} from '../services/offlineQueue';
import { useDigiSoliaAuth } from '../hooks/useDigiSoliaAuth';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { User } from '../../types';

interface FeedbackModuleProps {
  currentUser: User;
}

export const FeedbackModule: React.FC<FeedbackModuleProps> = ({ currentUser }) => {
  const { firebaseUser, signInWithGoogle } = useDigiSoliaAuth();
  const { isBrowserOnline } = useOnlineStatus();

  const [category, setCategory] = useState<FeedbackCategory>('comment');
  const [rating, setRating] = useState<number>(5);
  const [hoverRating, setHoverRating] = useState<number | null>(null);
  const [message, setMessage] = useState<string>('');
  const [honeypot, setHoneypot] = useState<string>('');

  const [submitting, setSubmitting] = useState<boolean>(false);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [items, setItems] = useState<DigiSoliaFeedbackItem[]>(() =>
    getLocalFeedbackHistory(DIGISOLIA_CONFIG.appId)
  );

  const loadHistory = async () => {
    const localList = getLocalFeedbackHistory(DIGISOLIA_CONFIG.appId);
    if (firebaseUser && isBrowserOnline) {
      try {
        const remoteList = await fetchUserFeedback(DIGISOLIA_CONFIG.appId, firebaseUser.uid);
        const map = new Map<string, DigiSoliaFeedbackItem>();
        localList.forEach((f) => map.set(f.id, f));
        remoteList.forEach((f) => {
          map.set(f.id, f);
          saveLocalFeedbackItem(f);
        });
        setItems(
          Array.from(map.values()).sort((a, b) =>
            (b.createdAt || '').localeCompare(a.createdAt || '')
          )
        );
        return;
      } catch {
        // Garde l'historique local
      }
    }
    setItems(localList);
  };

  useEffect(() => {
    loadHistory();
  }, [firebaseUser?.uid, isBrowserOnline]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setNotice(null);

    const includeRating = category === 'comment' || category === 'suggestion';
    const check = validateFeedbackForm({
      category,
      rating: includeRating ? rating : undefined,
      message,
    });
    if (!check.valid) {
      setNotice({ type: 'error', text: check.error || 'Formulaire invalide.' });
      return;
    }

    const cleanMessage = sanitizeText(message, 2000);
    const hash = computeContentHash([
      'feedback',
      DIGISOLIA_CONFIG.appId,
      category,
      String(rating),
      cleanMessage,
    ]);

    const spam = checkAntiSpamGate('feedback', hash, honeypot);
    if (!spam.valid) {
      setNotice({ type: 'error', text: spam.error || 'Envoi bloqué par l’anti-spam.' });
      return;
    }

    setSubmitting(true);
    const nowIso = new Date().toISOString();
    const feedbackId = `fb_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

    const payload: DigiSoliaFeedbackItem = {
      id: feedbackId,
      appId: DIGISOLIA_CONFIG.appId,
      authorUid: firebaseUser?.uid || currentUser.id,
      userId: currentUser.id,
      userName: firebaseUser?.displayName || currentUser.name,
      userEmail: firebaseUser?.email || currentUser.email,
      category,
      rating: includeRating ? rating : undefined,
      message: cleanMessage,
      status: 'pending',
      createdAt: nowIso,
    };

    try {
      if (isBrowserOnline && firebaseUser?.emailVerified) {
        await submitFeedbackToFirestore(payload);
        saveLocalFeedbackItem(payload);
        recordAntiSpamSubmission('feedback', hash);
        setNotice({
          type: 'success',
          text: 'Merci ! Votre retour a bien été enregistré dans Firebase sous le statut « En attente ».',
        });
      } else {
        const offlineItem: DigiSoliaFeedbackItem = { ...payload, _offlinePending: true };
        enqueueOfflineOperation({
          kind: 'feedback',
          appId: DIGISOLIA_CONFIG.appId,
          docId: feedbackId,
          payload: offlineItem,
          dedupeHash: hash,
        });
        saveLocalFeedbackItem(offlineItem);
        recordAntiSpamSubmission('feedback', hash);
        setNotice({
          type: 'success',
          text: !isBrowserOnline
            ? 'Hors connexion : votre avis a été mis en file d’attente locale et sera envoyé automatiquement au retour d’Internet.'
            : 'Avis enregistré localement. Connectez votre compte Google DigiSolia pour le synchroniser sur le Cloud.',
        });
      }
      setMessage('');
      await loadHistory();
    } catch (err: any) {
      const offlineItem: DigiSoliaFeedbackItem = {
        ...payload,
        _offlinePending: true,
        _syncError: err?.message,
      };
      enqueueOfflineOperation({
        kind: 'feedback',
        appId: DIGISOLIA_CONFIG.appId,
        docId: feedbackId,
        payload: offlineItem,
        dedupeHash: hash,
      });
      saveLocalFeedbackItem(offlineItem);
      setNotice({
        type: 'success',
        text: 'Enregistré en file d’attente locale pour synchronisation automatique.',
      });
      setMessage('');
      await loadHistory();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-full bg-[#F4F7FB] dark:bg-[#05070c] text-slate-900 dark:text-slate-100 py-6 px-4 sm:px-6 lg:px-10">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="rounded-xl bg-white dark:bg-slate-900 border border-[#E1E7EF] dark:border-slate-800 p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-2xl font-extrabold text-[#163B65] dark:text-white">
              Avis et suggestions
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Notez {DIGISOLIA_CONFIG.appName}, proposez une amélioration, signalez un bug ou déposez une réclamation.
            </p>
          </div>
          {!firebaseUser && (
            <button
              type="button"
              onClick={() => signInWithGoogle()}
              className="px-4 py-2 rounded-lg text-xs font-semibold text-white bg-[#2783C7] hover:bg-[#1e6aa3] transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              Connecter Google Cloud
            </button>
          )}
        </div>

        {/* Formulaire */}
        <form
          onSubmit={handleSubmit}
          className="rounded-xl bg-white dark:bg-slate-900 border border-[#E1E7EF] dark:border-slate-800 p-6 space-y-5"
        >
          <input
            type="text"
            tabIndex={-1}
            autoComplete="off"
            value={honeypot}
            onChange={(e) => setHoneypot(e.target.value)}
            className="hidden"
            aria-hidden="true"
          />

          {/* Choix catégorie */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              Catégorie de votre retour
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {(['comment', 'suggestion', 'bug', 'complaint'] as FeedbackCategory[]).map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategory(cat)}
                  className={`px-3 py-2.5 rounded-lg text-xs font-semibold border transition-colors cursor-pointer whitespace-nowrap ${
                    category === cat
                      ? 'bg-[#163B65] text-white border-[#163B65]'
                      : 'bg-[#F4F7FB] dark:bg-slate-950 text-slate-700 dark:text-slate-300 border-[#E1E7EF] dark:border-slate-800 hover:border-[#2783C7]'
                  }`}
                >
                  {FEEDBACK_CATEGORY_LABELS[cat]}
                </button>
              ))}
            </div>
          </div>

          {/* Note 1 à 5 étoiles */}
          {(category === 'comment' || category === 'suggestion') && (
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Note globale sur {DIGISOLIA_CONFIG.appName}
              </label>
              <div className="flex items-center gap-2">
                {[1, 2, 3, 4, 5].map((star) => {
                  const active = (hoverRating ?? rating) >= star;
                  return (
                    <button
                      key={star}
                      type="button"
                      onMouseEnter={() => setHoverRating(star)}
                      onMouseLeave={() => setHoverRating(null)}
                      onClick={() => setRating(star)}
                      aria-label={`${star} étoile${star > 1 ? 's' : ''}`}
                      className="p-1.5 rounded-lg hover:bg-[#F4F7FB] dark:hover:bg-slate-800 transition-colors cursor-pointer"
                    >
                      <Star
                        className={`w-7 h-7 ${
                          active
                            ? 'fill-amber-400 text-amber-400'
                            : 'text-slate-300 dark:text-slate-600'
                        }`}
                      />
                    </button>
                  );
                })}
                <span className="ml-2 text-sm font-bold text-[#163B65] dark:text-white tabular-nums">
                  {rating} / 5
                </span>
              </div>
            </div>
          )}

          {/* Message */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Votre message *
              </label>
              <span className="text-[11px] font-mono text-slate-400 tabular-nums">
                {message.length} / 2000
              </span>
            </div>
            <textarea
              rows={4}
              required
              maxLength={2000}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={
                category === 'bug'
                  ? 'Décrivez l’anomalie rencontrée...'
                  : category === 'complaint'
                  ? 'Expliquez l’objet de votre réclamation...'
                  : category === 'suggestion'
                  ? 'Quelle nouvelle fonctionnalité vous aiderait au quotidien ?'
                  : 'Partagez votre expérience avec notre application...'
              }
              className="w-full px-3.5 py-2.5 rounded-lg text-sm bg-[#F4F7FB] dark:bg-slate-950 border border-[#E1E7EF] dark:border-slate-700 text-slate-900 dark:text-white focus:outline-hidden focus:border-[#2783C7]"
            />
          </div>

          {notice && (
            <div
              className={`p-3 rounded-lg text-xs flex items-start gap-2 border ${
                notice.type === 'success'
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
                  : 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300'
              }`}
            >
              {notice.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              )}
              <span>{notice.text}</span>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-[#E1E7EF] dark:border-slate-800">
            <span className="text-xs text-slate-500 dark:text-slate-400">
              Application : <span className="font-mono">{DIGISOLIA_CONFIG.appId}</span> · Protection anti-spam active
            </span>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-xs font-bold text-white bg-[#163B65] hover:bg-[#1e4d82] transition-colors disabled:opacity-60 cursor-pointer whitespace-nowrap"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{submitting ? 'Envoi...' : 'Soumettre mon avis'}</span>
            </button>
          </div>
        </form>

        {/* Historique de traitement */}
        <section className="rounded-xl bg-white dark:bg-slate-900 border border-[#E1E7EF] dark:border-slate-800 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-[#163B65] dark:text-white">
              Mes avis et demandes envoyés ({items.length})
            </h2>
            <button
              type="button"
              onClick={loadHistory}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#2783C7] hover:underline cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Actualiser</span>
            </button>
          </div>

          {items.length === 0 ? (
            <p className="text-xs text-slate-500 dark:text-slate-400 py-4 text-center">
              Aucun avis envoyé pour le moment.
            </p>
          ) : (
            <div className="divide-y divide-[#E1E7EF] dark:divide-slate-800">
              {items.map((item) => (
                <div key={item.id} className="py-3.5 first:pt-0 last:pb-0 space-y-1.5">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2 font-semibold text-slate-800 dark:text-slate-200">
                      <span>{FEEDBACK_CATEGORY_LABELS[item.category]}</span>
                      {item.rating && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="text-amber-500 tabular-nums">{item.rating}/5 ★</span>
                        </>
                      )}
                      <span aria-hidden="true">·</span>
                      <span className="text-slate-400 font-normal tabular-nums">
                        {formatFrenchDateTime(item.createdAt)}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      {item._offlinePending && (
                        <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400 font-medium">
                          <Clock className="w-3 h-3" /> En attente de synchro
                        </span>
                      )}
                      <span
                        className={`font-bold ${
                          item.status === 'resolved'
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : item.status === 'rejected'
                            ? 'text-rose-600 dark:text-rose-400'
                            : item.status === 'in_progress'
                            ? 'text-[#2783C7]'
                            : 'text-amber-600 dark:text-amber-400'
                        }`}
                      >
                        {WORKFLOW_STATUS_LABELS[item.status]}
                      </span>
                    </div>
                  </div>
                  <p className="text-sm text-slate-700 dark:text-slate-300">{item.message}</p>
                  {item.adminResponse && (
                    <div className="mt-1.5 p-3 rounded-lg bg-[#F4F7FB] dark:bg-slate-800 text-xs text-slate-700 dark:text-slate-200">
                      <span className="font-bold text-[#163B65] dark:text-sky-300">
                        Réponse DigiSolia ({item.handledBy || 'Équipe support'}) :{' '}
                      </span>
                      {item.adminResponse}
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
