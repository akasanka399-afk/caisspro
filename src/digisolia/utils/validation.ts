import { DIGISOLIA_CONFIG } from '../config/digisolia.config';

const SUBMISSION_HISTORY_KEY = 'digisolia_antispam_history';

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Nettoie et limite une chaîne en cohérence stricte avec firebase-blueprint.json
 */
export function sanitizeText(value: string, maxLength: number): string {
  return value
    .replace(/[<>]/g, '') // Prévention basique d'injection HTML
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

/**
 * Calcule une empreinte simple pour détecter les doublons exacts
 */
export function computeContentHash(parts: string[]): string {
  const normalized = parts
    .map((p) => p.toLowerCase().replace(/\s+/g, ' ').trim())
    .join('|');
  let hash = 0;
  for (let i = 0; i < normalized.length; i += 1) {
    const chr = normalized.charCodeAt(i);
    hash = (hash << 5) - hash + chr;
    hash |= 0;
  }
  return `h_${Math.abs(hash)}`;
}

/**
 * Vérification anti-spam & limitation des abus (cooldown + quota horaire + doublon)
 */
export function checkAntiSpamGate(
  bucketKey: string,
  contentHash: string,
  honeypotValue?: string
): ValidationResult {
  if (honeypotValue && honeypotValue.trim().length > 0) {
    return { valid: false, error: 'Soumission bloquée par le contrôle anti-robot.' };
  }

  try {
    const raw = localStorage.getItem(SUBMISSION_HISTORY_KEY);
    const history: { key: string; hash: string; ts: number }[] = raw ? JSON.parse(raw) : [];
    const now = Date.now();
    const oneHourAgo = now - 60 * 60 * 1000;

    // Purger les entrées > 1h
    const recent = history.filter((item) => item.ts >= oneHourAgo);

    // 1. Délai minimum entre 2 envois
    const lastForBucket = recent.filter((item) => item.key === bucketKey).sort((a, b) => b.ts - a.ts)[0];
    if (lastForBucket) {
      const elapsed = now - lastForBucket.ts;
      if (elapsed < DIGISOLIA_CONFIG.antiSpamCooldownMs) {
        const waitSec = Math.ceil((DIGISOLIA_CONFIG.antiSpamCooldownMs - elapsed) / 1000);
        return {
          valid: false,
          error: `Veuillez patienter ${waitSec} secondes avant d'envoyer un nouveau message.`,
        };
      }
    }

    // 2. Plafond horaire
    const countLastHour = recent.filter((item) => item.key === bucketKey).length;
    if (countLastHour >= DIGISOLIA_CONFIG.maxFeedbackPerHour) {
      return {
        valid: false,
        error: `Limite de sécurité atteinte (${DIGISOLIA_CONFIG.maxFeedbackPerHour} envois par heure). Réessayez plus tard.`,
      };
    }

    // 3. Prévention des doublons dans la dernière heure
    if (recent.some((item) => item.key === bucketKey && item.hash === contentHash)) {
      return {
        valid: false,
        error: 'Un message identique a déjà été soumis récemment.',
      };
    }

    return { valid: true };
  } catch {
    return { valid: true };
  }
}

export function recordAntiSpamSubmission(bucketKey: string, contentHash: string): void {
  try {
    const raw = localStorage.getItem(SUBMISSION_HISTORY_KEY);
    const history: { key: string; hash: string; ts: number }[] = raw ? JSON.parse(raw) : [];
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    const next = [...history.filter((item) => item.ts >= oneHourAgo), { key: bucketKey, hash: contentHash, ts: Date.now() }];
    localStorage.setItem(SUBMISSION_HISTORY_KEY, JSON.stringify(next));
  } catch {
    // Ignore storage quota issues
  }
}

export function validateFeedbackForm(params: {
  category: string;
  rating?: number;
  message: string;
}): ValidationResult {
  if (!['comment', 'suggestion', 'bug', 'complaint'].includes(params.category)) {
    return { valid: false, error: 'Catégorie d’avis invalide.' };
  }
  if (params.rating !== undefined && (params.rating < 1 || params.rating > 5)) {
    return { valid: false, error: 'La note doit être comprise entre 1 et 5 étoiles.' };
  }
  const cleanMsg = params.message.trim();
  if (cleanMsg.length < 5) {
    return { valid: false, error: 'Votre message doit contenir au moins 5 caractères.' };
  }
  if (cleanMsg.length > 2000) {
    return { valid: false, error: 'Votre message ne peut pas dépasser 2000 caractères.' };
  }
  return { valid: true };
}

export function validateSupportForm(params: {
  subject: string;
  description: string;
  email?: string;
}): ValidationResult {
  const cleanSubject = params.subject.trim();
  const cleanDesc = params.description.trim();

  if (cleanSubject.length < 3 || cleanSubject.length > 160) {
    return { valid: false, error: 'Le sujet doit contenir entre 3 et 160 caractères.' };
  }
  if (cleanDesc.length < 10 || cleanDesc.length > 2500) {
    return { valid: false, error: 'La description doit contenir entre 10 et 2500 caractères.' };
  }
  if (params.email && params.email.trim().length > 0) {
    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(params.email.trim());
    if (!emailOk) {
      return { valid: false, error: 'Veuillez saisir une adresse e-mail valide.' };
    }
  }
  return { valid: true };
}

export function formatFrenchDateTime(isoOrDate?: string): string {
  if (!isoOrDate) return '—';
  try {
    const d = new Date(isoOrDate.replace(' ', 'T'));
    if (Number.isNaN(d.getTime())) return isoOrDate;
    return d.toLocaleString('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return isoOrDate;
  }
}
