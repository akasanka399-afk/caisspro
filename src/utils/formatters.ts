// Currency and date formatting helpers for West & Central African CFA Franc (FCFA / F)

export const formatMoney = (amount: number, currency: string = 'F CFA'): string => {
  const formatted = Math.round(amount)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return `${formatted} ${currency}`;
};

export const formatShortMoney = (amount: number): string => {
  return Math.round(amount)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
};

export const formatDate = (isoString: string): string => {
  try {
    const d = new Date(isoString.replace(' ', 'T'));
    return new Intl.DateTimeFormat('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(d);
  } catch {
    return isoString;
  }
};

export const formatTimeOnly = (isoString: string): string => {
  try {
    const d = new Date(isoString.replace(' ', 'T'));
    return new Intl.DateTimeFormat('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).format(d);
  } catch {
    return isoString;
  }
};
