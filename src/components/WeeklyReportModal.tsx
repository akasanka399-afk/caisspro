import React, { useState, useMemo } from 'react';
import {
  X,
  Printer,
  Share2,
  Download,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  Receipt,
  ShoppingBag,
  CreditCard,
  Banknote,
  Smartphone,
  Calendar,
  Clock,
  Award,
  CheckCircle,
  FileSpreadsheet,
  Copy,
  Store,
  UserCheck,
} from 'lucide-react';
import { Business, SaleTransaction, User } from '../types';
import { formatMoney, formatShortMoney } from '../utils/formatters';
import { getMondayToSundayWeek, WeekRange } from '../utils/dateUtils';

interface WeeklyReportModalProps {
  business: Business;
  transactions: SaleTransaction[];
  users: User[];
  isLight: boolean;
  onClose: () => void;
  initialWeekOffset?: number;
}

export const WeeklyReportModal: React.FC<WeeklyReportModalProps> = ({
  business,
  transactions,
  users,
  isLight,
  onClose,
  initialWeekOffset = 0,
}) => {
  const [weekOffset, setWeekOffset] = useState<number>(initialWeekOffset);
  const [copiedSummary, setCopiedSummary] = useState<boolean>(false);

  // Compute Monday-Sunday week range
  const weekRange: WeekRange = useMemo(() => {
    return getMondayToSundayWeek(new Date(), weekOffset);
  }, [weekOffset]);

  // Filter transactions belonging to this business AND strictly between Monday 00:00:00 and Sunday 23:59:59
  const weekTransactions = useMemo(() => {
    const mondayStart = weekRange.monday.getTime();
    const sundayEnd = weekRange.sunday.getTime();

    return transactions.filter((t) => {
      if (t.businessId !== business.id) return false;
      const tTime = new Date(t.timestamp.replace(' ', 'T')).getTime();
      return tTime >= mondayStart && tTime <= sundayEnd;
    });
  }, [transactions, business.id, weekRange]);

  // Aggregate daily breakdown (7 days: Lundi to Dimanche)
  const dailyBreakdown = useMemo(() => {
    return weekRange.days.map((dayInfo) => {
      const dayTx = weekTransactions.filter((t) => t.timestamp.startsWith(dayInfo.dateStr));
      const totalCA = dayTx.reduce((sum, t) => sum + t.totalAmount, 0);
      const totalTickets = dayTx.length;
      const avgBasket = totalTickets > 0 ? Math.round(totalCA / totalTickets) : 0;

      return {
        ...dayInfo,
        totalCA,
        totalTickets,
        avgBasket,
        transactions: dayTx,
      };
    });
  }, [weekRange.days, weekTransactions]);

  // Weekly KPIs
  const totalWeeklyCA = useMemo(() => {
    return weekTransactions.reduce((sum, t) => sum + t.totalAmount, 0);
  }, [weekTransactions]);

  const totalWeeklyTickets = weekTransactions.length;
  const avgWeeklyBasket = totalWeeklyTickets > 0 ? Math.round(totalWeeklyCA / totalWeeklyTickets) : 0;
  const totalWeeklyDiscounts = useMemo(() => {
    return weekTransactions.reduce((sum, t) => sum + (t.discountTotal || 0), 0);
  }, [weekTransactions]);

  // Peak sales day (Jour record)
  const peakDay = useMemo(() => {
    let peak = dailyBreakdown[0];
    for (const d of dailyBreakdown) {
      if (d.totalCA > peak.totalCA) {
        peak = d;
      }
    }
    return peak.totalCA > 0 ? peak : null;
  }, [dailyBreakdown]);

  // Payment methods breakdown
  const paymentStats = useMemo(() => {
    const stats: Record<string, { count: number; total: number; label: string; icon: string }> = {
      cash: { count: 0, total: 0, label: 'Espèces', icon: 'banknote' },
      mobile_money: { count: 0, total: 0, label: 'Mobile Money (Wave/OM/Moov)', icon: 'smartphone' },
      card: { count: 0, total: 0, label: 'Carte Bancaire', icon: 'card' },
      credit: { count: 0, total: 0, label: 'Vente à Crédit', icon: 'credit' },
    };

    weekTransactions.forEach((t) => {
      const method = t.paymentMethod || 'cash';
      if (!stats[method]) {
        stats[method] = { count: 0, total: 0, label: method, icon: 'banknote' };
      }
      stats[method].count += 1;
      stats[method].total += t.totalAmount;
    });

    return stats;
  }, [weekTransactions]);

  // Top 5 products sold during this week
  const topProducts = useMemo(() => {
    const map = new Map<string, { id: string; name: string; quantity: number; totalSales: number }>();

    weekTransactions.forEach((t) => {
      t.items.forEach((item) => {
        const existing = map.get(item.productId) || {
          id: item.productId,
          name: item.productName,
          quantity: 0,
          totalSales: 0,
        };
        existing.quantity += item.quantity;
        existing.totalSales += item.total;
        map.set(item.productId, existing);
      });
    });

    return Array.from(map.values())
      .sort((a, b) => b.totalSales - a.totalSales)
      .slice(0, 5);
  }, [weekTransactions]);

  // Cashier performance for this week
  const cashierStats = useMemo(() => {
    const map = new Map<string, { id: string; name: string; count: number; total: number }>();

    weekTransactions.forEach((t) => {
      const cId = t.cashierId || 'unknown';
      const cName = t.cashierName || 'Caisse';
      const existing = map.get(cId) || { id: cId, name: cName, count: 0, total: 0 };
      existing.count += 1;
      existing.total += t.totalAmount;
      map.set(cId, existing);
    });

    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [weekTransactions]);

  // Native Print Handler
  const handlePrintReport = () => {
    window.print();
  };

  // Copy WhatsApp / SMS summary text
  const handleCopyWhatsAppSummary = () => {
    const cur = business.currency || 'FCFA';
    const lines = [
      `📊 *RAPPORT HEBDOMADAIRE DES VENTES*`,
      `🏪 *Commerce :* ${business.name}`,
      `📅 *Période :* Semaine N°${weekRange.weekNumber} (${weekRange.label})`,
      `-----------------------------------------`,
      `💰 *Chiffre d'Affaires Total :* ${formatShortMoney(totalWeeklyCA)} ${cur}`,
      `🧾 *Volume de Tickets :* ${totalWeeklyTickets} ventes`,
      `🛒 *Panier Moyen :* ${formatShortMoney(avgWeeklyBasket)} ${cur}`,
      peakDay ? `🏆 *Jour Record :* ${peakDay.dayName} (${formatShortMoney(peakDay.totalCA)} ${cur})` : '',
      `-----------------------------------------`,
      `📅 *DÉTAIL PAR JOUR (Lundi à Dimanche) :*`,
      ...dailyBreakdown.map((d) => {
        const pct = totalWeeklyCA > 0 ? Math.round((d.totalCA / totalWeeklyCA) * 100) : 0;
        return `• ${d.dayName} (${d.formattedDate}) : ${formatShortMoney(d.totalCA)} ${cur} (${d.totalTickets} tickets - ${pct}%)`;
      }),
      `-----------------------------------------`,
      `💳 *ENCAISSEMENTS PAR MODE :*`,
      `• Espèces : ${formatShortMoney(paymentStats.cash?.total || 0)} ${cur}`,
      `• Mobile Money : ${formatShortMoney(paymentStats.mobile_money?.total || 0)} ${cur}`,
      `• Carte : ${formatShortMoney(paymentStats.card?.total || 0)} ${cur}`,
      `• Crédit : ${formatShortMoney(paymentStats.credit?.total || 0)} ${cur}`,
      `-----------------------------------------`,
      `Généré le ${new Date().toLocaleDateString('fr-FR')} via KassaPro POS`,
    ].filter(Boolean);

    const text = lines.join('\n');
    navigator.clipboard?.writeText(text);
    setCopiedSummary(true);
    setTimeout(() => setCopiedSummary(false), 3000);
  };

  // Download CSV export
  const handleDownloadCSV = () => {
    const cur = business.currency || 'FCFA';
    const rows = [
      ['RAPPORT HEBDOMADAIRE DES VENTES (LUNDI A DIMANCHE)'],
      ['Commerce', business.name],
      ['Semaine', `Semaine N°${weekRange.weekNumber}`],
      ['Intervalle', `${weekRange.mondayStr} au ${weekRange.sundayStr}`],
      ['Devise', cur],
      ['Date d extraction', new Date().toISOString()],
      [],
      ['JOUR', 'DATE', 'TICKETS', 'PANIER MOYEN', `CHIFFRE D AFFAIRES (${cur})`, 'PART %'],
      ...dailyBreakdown.map((d) => [
        d.dayName,
        d.dateStr,
        d.totalTickets.toString(),
        d.avgBasket.toString(),
        d.totalCA.toString(),
        totalWeeklyCA > 0 ? `${((d.totalCA / totalWeeklyCA) * 100).toFixed(1)}%` : '0%',
      ]),
      [],
      ['TOTAL SEMAINE', '', totalWeeklyTickets.toString(), avgWeeklyBasket.toString(), totalWeeklyCA.toString(), '100%'],
      [],
      ['REPARTITION PAIEMENTS', 'MONTANT', 'NB TRANSACTIONS'],
      ['Especes', (paymentStats.cash?.total || 0).toString(), (paymentStats.cash?.count || 0).toString()],
      ['Mobile Money (Wave/OM/Moov)', (paymentStats.mobile_money?.total || 0).toString(), (paymentStats.mobile_money?.count || 0).toString()],
      ['Carte Bancaire', (paymentStats.card?.total || 0).toString(), (paymentStats.card?.count || 0).toString()],
      ['Vente a Credit', (paymentStats.credit?.total || 0).toString(), (paymentStats.credit?.count || 0).toString()],
    ];

    const csvContent = '\uFEFF' + rows.map((e) => e.map((val) => `"${String(val).replace(/"/g, '""')}"`).join(';')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `rapport_hebdo_${business.name.replace(/\s+/g, '_')}_semaine_${weekRange.weekNumber}_${weekRange.year}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-6 bg-black/75 backdrop-blur-sm overflow-y-auto print:p-0 print:bg-white print:static print:z-auto">
      <div
        className={`w-full max-w-5xl rounded-2xl border shadow-2xl overflow-hidden flex flex-col my-auto max-h-[92vh] print:max-h-none print:shadow-none print:border-none print:rounded-none ${
          isLight ? 'bg-white border-slate-200 text-slate-900' : 'bg-[#080b16] border-cyan-500/30 text-white'
        }`}
      >
        {/* Header Bar */}
        <div
          className={`p-4 md:p-5 border-b flex items-center justify-between gap-4 shrink-0 print:border-b-2 print:border-black ${
            isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#05070e] border-cyan-500/20'
          }`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`p-2.5 rounded-xl shrink-0 print:hidden ${
                isLight ? 'bg-blue-100 text-blue-800' : 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/30'
              }`}
            >
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border print:text-black print:border-black ${
                  isLight ? 'bg-blue-50 text-blue-800 border-blue-200' : 'bg-cyan-950/40 text-cyan-300 border-cyan-800'
                }`}>
                  Semaine N° {weekRange.weekNumber} · {weekRange.year}
                </span>
                <span className={`text-xs ${isLight ? 'text-slate-500' : 'text-neutral-400'} print:text-black`}>
                  Lundi à Dimanche
                </span>
              </div>
              <h2 className="text-lg md:text-xl font-extrabold tracking-tight mt-0.5 print:text-xl print:text-black">
                Rapport Hebdomadaire d'Activité & Chiffre d'Affaires
              </h2>
            </div>
          </div>

          {/* Action buttons (hidden on print) */}
          <div className="flex items-center gap-2 print:hidden">
            <button
              type="button"
              onClick={handleCopyWhatsAppSummary}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg border flex items-center gap-1.5 transition-colors cursor-pointer ${
                copiedSummary
                  ? 'bg-emerald-500 text-white border-emerald-600'
                  : isLight
                  ? 'bg-white hover:bg-slate-100 text-slate-800 border-slate-300'
                  : 'bg-neutral-900 hover:bg-neutral-800 text-cyan-300 border-cyan-500/30'
              }`}
              title="Copier un résumé formaté prêt à envoyer sur WhatsApp ou SMS"
            >
              {copiedSummary ? <CheckCircle className="w-4 h-4" /> : <Share2 className="w-4 h-4 text-emerald-500" />}
              <span className="hidden sm:inline">{copiedSummary ? 'Copié !' : 'Partager WhatsApp'}</span>
            </button>

            <button
              type="button"
              onClick={handleDownloadCSV}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg border flex items-center gap-1.5 transition-colors cursor-pointer ${
                isLight
                  ? 'bg-white hover:bg-slate-100 text-slate-800 border-slate-300'
                  : 'bg-neutral-900 hover:bg-neutral-800 text-cyan-300 border-cyan-500/30'
              }`}
              title="Télécharger le fichier Excel/CSV pour la comptabilité"
            >
              <Download className="w-4 h-4 text-blue-500" />
              <span className="hidden sm:inline">Excel (CSV)</span>
            </button>

            <button
              type="button"
              onClick={handlePrintReport}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg border flex items-center gap-1.5 transition-colors cursor-pointer ${
                isLight
                  ? 'bg-blue-600 hover:bg-blue-700 text-white border-blue-700'
                  : 'bg-cyan-500 hover:bg-cyan-400 text-neutral-950 font-bold border-cyan-400 shadow-[0_0_10px_rgba(0,242,254,0.4)]'
              }`}
              title="Imprimer le rapport officiel A4 ou ticket"
            >
              <Printer className="w-4 h-4" />
              <span>Imprimer</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className={`p-2 rounded-lg transition-colors cursor-pointer ${
                isLight ? 'hover:bg-slate-200 text-slate-600' : 'hover:bg-neutral-800 text-neutral-400'
              }`}
              aria-label="Fermer le rapport"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Print-Only Header */}
        <div className="hidden print:block p-6 pb-2 text-black">
          <div className="flex justify-between items-start border-b-2 border-black pb-4 mb-4">
            <div>
              <h1 className="text-2xl font-black uppercase tracking-tight">{business.name}</h1>
              <p className="text-sm">{business.address || 'Abidjan, Côte d’Ivoire'} · Tél : {business.phone}</p>
              <p className="text-xs text-gray-700">Gérant : {business.ownerName} · Régime : {business.tradeType}</p>
            </div>
            <div className="text-right">
              <span className="text-xs font-bold uppercase tracking-wider block">Document Comptable Interne</span>
              <span className="text-lg font-black block">RAPPORT HEBDOMADAIRE</span>
              <span className="text-sm font-mono font-bold block">{weekRange.label}</span>
              <span className="text-xs text-gray-600 block">Semaine ISO N° {weekRange.weekNumber} / {weekRange.year}</span>
            </div>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-4 md:p-6 overflow-y-auto space-y-6 flex-1 print:p-6 print:overflow-visible">
          {/* Week Selector Bar (hidden on print) */}
          <div
            className={`p-3 rounded-xl border flex flex-col sm:flex-row items-center justify-between gap-3 print:hidden ${
              isLight ? 'bg-slate-100/80 border-slate-200' : 'bg-[#0d1224] border-cyan-500/25'
            }`}
          >
            <div className="flex items-center gap-1.5 self-start sm:self-center">
              <button
                type="button"
                onClick={() => setWeekOffset((prev) => prev - 1)}
                className={`px-2.5 py-1.5 text-xs font-bold rounded-lg border flex items-center gap-1 transition-all cursor-pointer ${
                  isLight
                    ? 'bg-white hover:bg-slate-200 text-slate-800 border-slate-300'
                    : 'bg-neutral-900 hover:bg-neutral-800 text-cyan-300 border-cyan-500/30'
                }`}
                title="Semaine précédente"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Semaine Précédente</span>
              </button>

              <button
                type="button"
                onClick={() => setWeekOffset(0)}
                disabled={weekOffset === 0}
                className={`px-2.5 py-1.5 text-xs font-bold rounded-lg border transition-all cursor-pointer ${
                  weekOffset === 0
                    ? isLight
                      ? 'bg-blue-600 text-white border-blue-700 shadow-xs'
                      : 'bg-cyan-500 text-neutral-950 font-bold border-cyan-400'
                    : isLight
                    ? 'bg-white hover:bg-slate-200 text-slate-700 border-slate-300'
                    : 'bg-neutral-900 hover:bg-neutral-800 text-neutral-300 border-neutral-700'
                }`}
                title="Revenir à la semaine en cours"
              >
                Cette Semaine
              </button>

              <button
                type="button"
                onClick={() => setWeekOffset((prev) => prev + 1)}
                className={`px-2.5 py-1.5 text-xs font-bold rounded-lg border flex items-center gap-1 transition-all cursor-pointer ${
                  isLight
                    ? 'bg-white hover:bg-slate-200 text-slate-800 border-slate-300'
                    : 'bg-neutral-900 hover:bg-neutral-800 text-cyan-300 border-cyan-500/30'
                }`}
                title="Semaine suivante"
              >
                <span>Semaine Suivante</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center gap-2 text-xs font-mono font-bold">
              <Calendar className="w-4 h-4 text-amber-500 shrink-0" />
              <span>{weekRange.label}</span>
            </div>
          </div>

          {/* Financial KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 print:grid-cols-4 print:text-black">
            {/* Total Weekly CA */}
            <div
              className={`p-4 rounded-xl border relative overflow-hidden print:border-black print:bg-white ${
                isLight
                  ? 'bg-emerald-50/70 border-emerald-200 text-emerald-950'
                  : 'bg-emerald-950/20 border-emerald-500/40 text-emerald-300'
              }`}
            >
              <div className="flex items-center justify-between text-xs font-semibold mb-1">
                <span>CA Hebdomadaire</span>
                <TrendingUp className="w-4 h-4 text-emerald-600 print:hidden" />
              </div>
              <div className="text-xl md:text-2xl font-black font-mono tracking-tight tabular-nums">
                {formatMoney(totalWeeklyCA, business.currency || 'FCFA')}
              </div>
              <div className="text-[11px] opacity-75 mt-1">
                Du Lundi au Dimanche
              </div>
            </div>

            {/* Total Tickets */}
            <div
              className={`p-4 rounded-xl border relative overflow-hidden print:border-black print:bg-white ${
                isLight ? 'bg-blue-50/70 border-blue-200 text-blue-950' : 'bg-blue-950/20 border-blue-500/40 text-blue-300'
              }`}
            >
              <div className="flex items-center justify-between text-xs font-semibold mb-1">
                <span>Volume de Ventes</span>
                <Receipt className="w-4 h-4 text-blue-600 print:hidden" />
              </div>
              <div className="text-xl md:text-2xl font-black font-mono tracking-tight tabular-nums">
                {totalWeeklyTickets} <span className="text-sm font-normal">tickets</span>
              </div>
              <div className="text-[11px] opacity-75 mt-1">
                Encaissements validés
              </div>
            </div>

            {/* Average Basket */}
            <div
              className={`p-4 rounded-xl border relative overflow-hidden print:border-black print:bg-white ${
                isLight
                  ? 'bg-purple-50/70 border-purple-200 text-purple-950'
                  : 'bg-purple-950/20 border-purple-500/40 text-purple-300'
              }`}
            >
              <div className="flex items-center justify-between text-xs font-semibold mb-1">
                <span>Panier Moyen</span>
                <ShoppingBag className="w-4 h-4 text-purple-600 print:hidden" />
              </div>
              <div className="text-xl md:text-2xl font-black font-mono tracking-tight tabular-nums">
                {formatMoney(avgWeeklyBasket, business.currency || 'FCFA')}
              </div>
              <div className="text-[11px] opacity-75 mt-1">
                Moyenne par client
              </div>
            </div>

            {/* Peak Sales Day */}
            <div
              className={`p-4 rounded-xl border relative overflow-hidden print:border-black print:bg-white ${
                isLight
                  ? 'bg-amber-50/70 border-amber-200 text-amber-950'
                  : 'bg-amber-950/20 border-amber-500/40 text-amber-300'
              }`}
            >
              <div className="flex items-center justify-between text-xs font-semibold mb-1">
                <span>Jour Record (Pic)</span>
                <Award className="w-4 h-4 text-amber-600 print:hidden" />
              </div>
              <div className="text-lg md:text-xl font-black tracking-tight truncate">
                {peakDay ? peakDay.dayName : '—'}
              </div>
              <div className="text-[11px] opacity-75 mt-1 font-mono font-bold">
                {peakDay ? `${formatShortMoney(peakDay.totalCA)} ${business.currency || 'FCFA'}` : 'Aucune vente'}
              </div>
            </div>
          </div>

          {/* DAY-BY-DAY DETAILED TABLE (Lundi à Dimanche) */}
          <div
            className={`rounded-xl border overflow-hidden print:border-black ${
              isLight ? 'bg-white border-slate-200' : 'bg-[#0a0e20] border-cyan-500/25'
            }`}
          >
            <div
              className={`p-3.5 border-b flex items-center justify-between print:bg-gray-100 print:border-black ${
                isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#05070e] border-cyan-500/20'
              }`}
            >
              <div className="flex items-center gap-2 font-bold text-sm">
                <Clock className="w-4 h-4 text-blue-500 print:hidden" />
                <span>Ventilation Journalière Complète (Lundi au Dimanche)</span>
              </div>
              <span className={`text-xs ${isLight ? 'text-slate-500' : 'text-neutral-400'} print:text-black`}>
                7 jours consécutifs
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead
                  className={`border-b print:border-black print:bg-gray-100 ${
                    isLight ? 'bg-slate-50/80 border-slate-200 text-slate-600' : 'bg-[#070914] border-cyan-500/20 text-neutral-400'
                  }`}
                >
                  <tr>
                    <th className="px-4 py-3 font-semibold">Jour</th>
                    <th className="px-4 py-3 font-semibold">Date</th>
                    <th className="px-4 py-3 font-semibold text-center">Tickets</th>
                    <th className="px-4 py-3 font-semibold text-right">Panier Moyen</th>
                    <th className="px-4 py-3 font-semibold text-right">Chiffre d'Affaires</th>
                    <th className="px-4 py-3 font-semibold text-right">Part Semaine</th>
                    <th className="px-4 py-3 font-semibold text-center w-32 print:hidden">Progression</th>
                  </tr>
                </thead>
                <tbody className={`divide-y print:divide-black ${isLight ? 'divide-slate-100' : 'divide-neutral-800'}`}>
                  {dailyBreakdown.map((day) => {
                    const percentOfTotal = totalWeeklyCA > 0 ? (day.totalCA / totalWeeklyCA) * 100 : 0;
                    const isPeak = peakDay && peakDay.dateStr === day.dateStr && day.totalCA > 0;

                    return (
                      <tr
                        key={day.dateStr}
                        className={`transition-colors ${
                          day.isToday
                            ? isLight
                              ? 'bg-amber-50/60 font-semibold'
                              : 'bg-amber-950/20 font-semibold'
                            : isLight
                            ? 'hover:bg-slate-50'
                            : 'hover:bg-[#0f142b]'
                        }`}
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className="font-bold">{day.dayName}</span>
                            {isPeak && (
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-500 border border-amber-500/30 print:border-black print:text-black">
                                🏆 Record
                              </span>
                            )}
                            {day.isToday && (
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-500 border border-blue-500/30 print:hidden">
                                Aujourd'hui
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 font-mono opacity-80">
                          {day.formattedDate}
                        </td>
                        <td className="px-4 py-3 font-mono text-center font-bold">
                          {day.totalTickets}
                        </td>
                        <td className="px-4 py-3 font-mono text-right">
                          {day.totalTickets > 0 ? formatShortMoney(day.avgBasket) : '—'} {business.currency || 'FCFA'}
                        </td>
                        <td className="px-4 py-3 font-mono text-right font-black text-sm">
                          {formatShortMoney(day.totalCA)} {business.currency || 'FCFA'}
                        </td>
                        <td className="px-4 py-3 font-mono text-right font-bold">
                          {percentOfTotal.toFixed(1)}%
                        </td>
                        <td className="px-4 py-3 text-center print:hidden">
                          <div className="w-full bg-slate-200 dark:bg-neutral-800 rounded-full h-2 overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${
                                isPeak
                                  ? 'bg-amber-500'
                                  : day.totalCA > 0
                                  ? 'bg-emerald-500'
                                  : 'bg-transparent'
                              }`}
                              style={{ width: `${Math.min(100, percentOfTotal * 2.5)}%` }}
                            />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot
                  className={`border-t-2 font-bold ${
                    isLight ? 'bg-slate-50 border-slate-300 text-slate-900' : 'bg-[#060812] border-cyan-500/30 text-white'
                  } print:bg-gray-100 print:border-black`}
                >
                  <tr>
                    <td colSpan={2} className="px-4 py-3 uppercase tracking-wider text-xs">
                      Total Semaine (Lundi - Dimanche)
                    </td>
                    <td className="px-4 py-3 text-center font-mono font-black">
                      {totalWeeklyTickets}
                    </td>
                    <td className="px-4 py-3 text-right font-mono">
                      {formatShortMoney(avgWeeklyBasket)} {business.currency || 'FCFA'}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-black text-base text-emerald-600 dark:text-emerald-400 print:text-black">
                      {formatMoney(totalWeeklyCA, business.currency || 'FCFA')}
                    </td>
                    <td className="px-4 py-3 text-right font-mono">
                      100.0%
                    </td>
                    <td className="px-4 py-3 print:hidden" />
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* TWO COLUMNS: Methods Breakdown & Cashier Performance */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Payment Methods */}
            <div
              className={`p-4 rounded-xl border ${
                isLight ? 'bg-white border-slate-200' : 'bg-[#0a0e20] border-cyan-500/25'
              } print:border-black`}
            >
              <div className="flex items-center gap-2 font-bold text-sm mb-3">
                <CreditCard className="w-4 h-4 text-purple-500 print:hidden" />
                <span>Répartition des Encaissements par Mode</span>
              </div>

              <div className="space-y-3">
                {Object.entries(paymentStats).map(([key, stat]) => {
                  const pct = totalWeeklyCA > 0 ? (stat.total / totalWeeklyCA) * 100 : 0;
                  const icons: Record<string, React.ReactNode> = {
                    cash: <Banknote className="w-4 h-4 text-emerald-500" />,
                    mobile_money: <Smartphone className="w-4 h-4 text-orange-500" />,
                    card: <CreditCard className="w-4 h-4 text-blue-500" />,
                    credit: <Receipt className="w-4 h-4 text-rose-500" />,
                  };

                  return (
                    <div key={key} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <span className="print:hidden">{icons[key] || icons.cash}</span>
                          <span className="font-semibold">{stat.label}</span>
                          <span className="text-[10px] opacity-60">({stat.count} op.)</span>
                        </div>
                        <div className="font-mono font-bold">
                          <span>{formatMoney(stat.total, business.currency || 'FCFA')}</span>
                          <span className="ml-2 text-[11px] opacity-75">({pct.toFixed(1)}%)</span>
                        </div>
                      </div>
                      <div className="w-full bg-slate-200 dark:bg-neutral-800 rounded-full h-1.5 overflow-hidden print:hidden">
                        <div
                          className="h-full bg-blue-500 rounded-full"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Cashier Team Performance */}
            <div
              className={`p-4 rounded-xl border ${
                isLight ? 'bg-white border-slate-200' : 'bg-[#0a0e20] border-cyan-500/25'
              } print:border-black`}
            >
              <div className="flex items-center gap-2 font-bold text-sm mb-3">
                <UserCheck className="w-4 h-4 text-emerald-500 print:hidden" />
                <span>Performance de l'Équipe Caisse</span>
              </div>

              {cashierStats.length === 0 ? (
                <div className="text-center py-6 text-xs opacity-60">
                  Aucun encaissement enregistré sur cette semaine.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {cashierStats.map((c) => {
                    const pct = totalWeeklyCA > 0 ? (c.total / totalWeeklyCA) * 100 : 0;
                    return (
                      <div
                        key={c.id}
                        className={`p-2.5 rounded-lg border flex items-center justify-between gap-3 ${
                          isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#070914] border-neutral-800'
                        } print:border-black`}
                      >
                        <div>
                          <div className="font-bold text-xs">{c.name}</div>
                          <div className="text-[11px] opacity-60">{c.count} ticket(s) encaissé(s)</div>
                        </div>
                        <div className="text-right">
                          <div className="font-mono font-bold text-xs">
                            {formatMoney(c.total, business.currency || 'FCFA')}
                          </div>
                          <div className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 print:text-black">
                            {pct.toFixed(1)}% du CA hebdo
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* TOP 5 ARTICLES VENDUS SUR LA SEMAINE */}
          {topProducts.length > 0 && (
            <div
              className={`p-4 rounded-xl border ${
                isLight ? 'bg-white border-slate-200' : 'bg-[#0a0e20] border-cyan-500/25'
              } print:border-black`}
            >
              <div className="flex items-center gap-2 font-bold text-sm mb-3">
                <Award className="w-4 h-4 text-amber-500 print:hidden" />
                <span>Top 5 des Produits les Plus Vendus sur la Semaine</span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead
                    className={`border-b ${
                      isLight ? 'text-slate-500 border-slate-200' : 'text-neutral-400 border-neutral-800'
                    } print:border-black`}
                  >
                    <tr>
                      <th className="py-2 font-semibold">Produit / Article</th>
                      <th className="py-2 text-center font-semibold">Quantité Vendue</th>
                      <th className="py-2 text-right font-semibold">Chiffre d'Affaires Généré</th>
                      <th className="py-2 text-right font-semibold">Part %</th>
                    </tr>
                  </thead>
                  <tbody className={`divide-y ${isLight ? 'divide-slate-100' : 'divide-neutral-800'} print:divide-black`}>
                    {topProducts.map((p, idx) => {
                      const share = totalWeeklyCA > 0 ? (p.totalSales / totalWeeklyCA) * 100 : 0;
                      return (
                        <tr key={p.id}>
                          <td className="py-2">
                            <span className="font-bold mr-2 text-amber-500">#{idx + 1}</span>
                            <span className="font-medium">{p.name}</span>
                          </td>
                          <td className="py-2 text-center font-mono font-bold">
                            {p.quantity}
                          </td>
                          <td className="py-2 text-right font-mono font-black">
                            {formatShortMoney(p.totalSales)} {business.currency || 'FCFA'}
                          </td>
                          <td className="py-2 text-right font-mono font-semibold">
                            {share.toFixed(1)}%
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Print-Only Signature Section */}
          <div className="hidden print:block pt-8 text-black text-xs">
            <div className="grid grid-cols-2 gap-8 border-t-2 border-black pt-4">
              <div>
                <p className="font-bold uppercase">Établi par le Responsable Caisse :</p>
                <p className="mt-8 italic">Date & Signature : ___________________________</p>
              </div>
              <div className="text-right">
                <p className="font-bold uppercase">Visé par la Direction / Propriétaire :</p>
                <p className="mt-8 italic">Date & Cachet : ___________________________</p>
              </div>
            </div>
            <p className="text-[10px] text-gray-500 text-center mt-6">
              Rapport généré le {new Date().toLocaleString('fr-FR')} · Système de Caisse KassaPro POS
            </p>
          </div>
        </div>

        {/* Modal Footer (hidden on print) */}
        <div
          className={`p-4 border-t flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0 print:hidden ${
            isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#05070e] border-cyan-500/20'
          }`}
        >
          <div className="flex items-center gap-2 text-xs opacity-75">
            <CheckCircle className="w-4 h-4 text-emerald-500" />
            <span>Calcul hebdomadaire strict : <strong>Lundi 00:00 au Dimanche 23:59</strong></span>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={onClose}
              className={`px-4 py-2 text-xs font-bold rounded-xl border transition-colors cursor-pointer ${
                isLight
                  ? 'bg-white hover:bg-slate-100 text-slate-800 border-slate-300'
                  : 'bg-neutral-900 hover:bg-neutral-800 text-neutral-300 border-neutral-700'
              }`}
            >
              Fermer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
