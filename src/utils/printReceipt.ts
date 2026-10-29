import { Business, SaleTransaction } from '../types';
import { formatMoney, formatDate } from './formatters';

const PAYMENT_LABELS: Record<string, string> = {
  cash: 'Espèces (Cash)',
  mobile_money: 'Mobile Money (Wave / OM)',
  card: 'Carte Bancaire',
  credit: 'À crédit (Compte Client)',
};

/**
 * Builds a clean, high-contrast, thermal-ready HTML document string
 * formatted specifically for 80mm (and 58mm) thermal POS printers.
 */
export function buildThermalReceiptHtml(transaction: SaleTransaction, business: Business): string {
  const itemsRows = transaction.items
    .map(
      (it) => `
      <tr>
        <td style="padding: 3px 0; vertical-align: top; font-weight: 600;">
          ${escapeHtml(it.productName)}
          <div style="font-size: 10px; color: #444; font-weight: normal;">
            ${it.quantity} x ${formatMoney(it.unitPrice, 'F')}
          </div>
        </td>
        <td style="padding: 3px 0; text-align: right; vertical-align: top; font-weight: bold; white-space: nowrap;">
          ${formatMoney(it.total, 'F')}
        </td>
      </tr>
    `
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>Ticket ${transaction.ticketNumber} - ${escapeHtml(business.name)}</title>
  <style>
    @page {
      size: 80mm auto;
      margin: 0mm;
    }
    *, *::before, *::after {
      box-sizing: border-box;
    }
    html, body {
      margin: 0;
      padding: 0;
      background: #ffffff;
      color: #000000;
      font-family: 'Courier New', Courier, 'Lucida Console', Monaco, monospace;
      font-size: 11px;
      line-height: 1.35;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .receipt-container {
      width: 76mm;
      max-width: 100%;
      margin: 0 auto;
      padding: 4mm 3mm 8mm 3mm;
    }
    .text-center { text-align: center; }
    .text-right { text-align: right; }
    .text-left { text-align: left; }
    .bold { font-weight: bold; }
    .uppercase { text-transform: uppercase; }
    .store-name {
      font-size: 15px;
      font-weight: 900;
      letter-spacing: 0.5px;
      margin: 0 0 2px 0;
    }
    .divider-solid {
      border-top: 1px solid #000;
      margin: 6px 0;
    }
    .divider-dashed {
      border-top: 1px dashed #000;
      margin: 6px 0;
    }
    .divider-double {
      border-top: 2px dashed #000;
      margin: 6px 0;
    }
    .row {
      display: flex;
      justify-content: space-between;
      margin: 1.5px 0;
    }
    .items-table {
      width: 100%;
      border-collapse: collapse;
      margin: 4px 0;
      font-size: 11px;
    }
    .items-table th {
      border-bottom: 1px solid #000;
      padding-bottom: 3px;
      font-weight: bold;
    }
    .total-box {
      margin-top: 4px;
      padding-top: 4px;
      border-top: 1px dashed #000;
    }
    .grand-total {
      font-size: 14px;
      font-weight: 900;
      display: flex;
      justify-content: space-between;
      margin: 4px 0;
      padding: 4px 0;
      border-top: 1px solid #000;
      border-bottom: 1px solid #000;
    }
    .barcode-box {
      font-family: 'Courier New', monospace;
      letter-spacing: 3px;
      font-size: 11px;
      text-align: center;
      padding: 4px;
      margin: 6px 0 2px 0;
      background: #000;
      color: #fff;
      font-weight: bold;
    }
    .footer-note {
      font-size: 9.5px;
      text-align: center;
      margin-top: 6px;
      line-height: 1.3;
    }
    @media screen {
      body {
        background: #f1f5f9;
        padding: 20px;
        display: flex;
        justify-content: center;
      }
      .receipt-container {
        background: #ffffff;
        box-shadow: 0 4px 15px rgba(0,0,0,0.1);
        border: 1px solid #ddd;
        border-radius: 4px;
      }
      .no-print-bar {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        background: #0f172a;
        color: white;
        padding: 10px 20px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        z-index: 1000;
      }
      .print-btn {
        background: #10b981;
        color: white;
        border: none;
        padding: 6px 14px;
        border-radius: 6px;
        font-weight: bold;
        cursor: pointer;
      }
    }
    @media print {
      .no-print-bar { display: none !important; }
    }
  </style>
</head>
<body>
  <div class="receipt-container">
    <!-- Store Header -->
    <div class="text-center">
      <div class="store-name uppercase">${escapeHtml(business.name)}</div>
      ${business.address ? `<div>${escapeHtml(business.address)}</div>` : ''}
      ${business.phone ? `<div>Tél: ${escapeHtml(business.phone)}</div>` : ''}
      <div style="font-size: 9px; margin-top: 2px;">Commerce Enregistré · Système Caisse Pro</div>
    </div>

    <div class="divider-solid"></div>

    <!-- Ticket Info -->
    <div class="row">
      <span class="bold">Ticket N°:</span>
      <span class="bold">${escapeHtml(transaction.ticketNumber)}</span>
    </div>
    <div class="row">
      <span>Date:</span>
      <span>${escapeHtml(formatDate(transaction.timestamp))}</span>
    </div>
    <div class="row">
      <span>Caissier(ère):</span>
      <span class="bold">${escapeHtml(transaction.cashierName || 'Caisse Principale')}</span>
    </div>
    <div class="row">
      <span>Client:</span>
      <span class="bold">${escapeHtml(transaction.customerName || 'Client Comptoir')}</span>
    </div>
    ${
      transaction.customerPhone
        ? `<div class="row">
            <span>Tél. Client:</span>
            <span>${escapeHtml(transaction.customerPhone)}</span>
          </div>`
        : ''
    }

    <div class="divider-dashed"></div>

    <!-- Items -->
    <table class="items-table">
      <thead>
        <tr>
          <th class="text-left">Désignation</th>
          <th class="text-right">Total</th>
        </tr>
      </thead>
      <tbody>
        ${itemsRows}
      </tbody>
    </table>

    <!-- Totals -->
    <div class="total-box">
      <div class="row">
        <span>Sous-total:</span>
        <span class="bold">${formatMoney(transaction.subtotal, 'F')}</span>
      </div>
      ${
        transaction.discountTotal > 0
          ? `<div class="row" style="color: #000;">
              <span>Remise accordée:</span>
              <span class="bold">-${formatMoney(transaction.discountTotal, 'F')}</span>
            </div>`
          : ''
      }
      <div class="grand-total">
        <span>TOTAL À PAYER:</span>
        <span>${formatMoney(transaction.totalAmount, 'F CFA')}</span>
      </div>
      <div class="row" style="margin-top: 4px;">
        <span>Mode règlement:</span>
        <span class="bold">${escapeHtml(PAYMENT_LABELS[transaction.paymentMethod] || transaction.paymentMethod)}</span>
      </div>
      ${
        transaction.paymentMethod === 'cash'
          ? `<div class="row">
              <span>Espèces reçues:</span>
              <span>${formatMoney(transaction.amountReceived, 'F')}</span>
            </div>
            <div class="row">
              <span class="bold">Monnaie rendue:</span>
              <span class="bold">${formatMoney(transaction.changeDue, 'F')}</span>
            </div>`
          : ''
      }
    </div>

    <div class="divider-dashed"></div>

    <!-- Barcode simulation -->
    <div class="barcode-box">
      |||| | ||||| || |||||| | ||||
    </div>
    <div class="text-center" style="font-size: 9px; letter-spacing: 1px;">
      ${escapeHtml(transaction.ticketNumber)}
    </div>

    <!-- Thank you note -->
    <div class="footer-note">
      <div class="bold">Merci de votre visite et à très bientôt !</div>
      <div style="font-size: 8.5px; color: #555; margin-top: 3px;">
        Logiciel Caisse Pro · Reçu officiel de vente
      </div>
    </div>
  </div>
</body>
</html>`;
}

/**
 * Generates formatted raw text ticket for thermal/ASCII printers or WhatsApp/SMS
 */
export function buildThermalReceiptText(transaction: SaleTransaction, business: Business): string {
  const line = '------------------------------------------';
  const doubleLine = '==========================================';

  const itemsText = transaction.items
    .map((it) => {
      const name = it.productName.padEnd(26, ' ').slice(0, 26);
      const total = formatMoney(it.total, 'F').padStart(14, ' ');
      const sub = `   ${it.quantity} x ${formatMoney(it.unitPrice, 'F')}`;
      return `${name}${total}\n${sub}`;
    })
    .join('\n');

  return [
    business.name.toUpperCase(),
    business.address || '',
    business.phone ? `Tél: ${business.phone}` : '',
    doubleLine,
    `Ticket N°: ${transaction.ticketNumber}`,
    `Date: ${formatDate(transaction.timestamp)}`,
    `Caissier(ère): ${transaction.cashierName || 'Caisse'}`,
    `Client: ${transaction.customerName || 'Client Comptoir'}${
      transaction.customerPhone ? ` (${transaction.customerPhone})` : ''
    }`,
    line,
    'Articles                                 Total',
    line,
    itemsText,
    line,
    `Sous-total:             ${formatMoney(transaction.subtotal, 'F').padStart(16, ' ')}`,
    transaction.discountTotal > 0
      ? `Remise:                -${formatMoney(transaction.discountTotal, 'F').padStart(16, ' ')}`
      : '',
    doubleLine,
    `TOTAL À PAYER:         ${formatMoney(transaction.totalAmount, 'F CFA').padStart(16, ' ')}`,
    doubleLine,
    `Règlement: ${PAYMENT_LABELS[transaction.paymentMethod] || transaction.paymentMethod}`,
    transaction.paymentMethod === 'cash'
      ? `Reçu: ${formatMoney(transaction.amountReceived, 'F')} | Rendu: ${formatMoney(transaction.changeDue, 'F')}`
      : '',
    line,
    'Merci pour votre confiance et à bientôt !',
    'Caisse Pro v2.4',
  ]
    .filter(Boolean)
    .join('\n');
}

/**
 * Prints the thermal receipt via a dedicated isolated hidden iframe.
 * If iframe printing fails (e.g. sandbox restriction), falls back to window.print().
 */
export async function printThermalReceipt(
  transaction: SaleTransaction,
  business: Business
): Promise<{ success: boolean; method: 'iframe' | 'window' | 'download' }> {
  const html = buildThermalReceiptHtml(transaction, business);

  // Strategy 1: Dedicated hidden iframe
  try {
    let iframe = document.getElementById('thermal-print-frame') as HTMLIFrameElement | null;
    if (!iframe) {
      iframe = document.createElement('iframe');
      iframe.id = 'thermal-print-frame';
      iframe.style.position = 'fixed';
      iframe.style.top = '-9999px';
      iframe.style.left = '-9999px';
      iframe.style.width = '80mm';
      iframe.style.height = '100px';
      iframe.style.border = '0';
      iframe.style.visibility = 'hidden';
      document.body.appendChild(iframe);
    }

    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (doc) {
      doc.open();
      doc.write(html);
      doc.close();

      await new Promise((resolve) => setTimeout(resolve, 200));

      const win = iframe.contentWindow;
      if (win) {
        win.focus();
        win.print();
        return { success: true, method: 'iframe' };
      }
    }
  } catch (err) {
    console.warn('Iframe printing encountered an issue, falling back to window.print():', err);
  }

  // Strategy 2: Fallback to window.print()
  try {
    window.focus();
    window.print();
    return { success: true, method: 'window' };
  } catch (err) {
    console.warn('window.print() was blocked or failed:', err);
  }

  // Strategy 3: Automatic file download fallback so user is never stranded
  downloadReceiptHtml(transaction, business);
  return { success: true, method: 'download' };
}

/**
 * Downloads a self-contained HTML ticket with auto-print capability
 */
export function downloadReceiptHtml(transaction: SaleTransaction, business: Business): void {
  const html = buildThermalReceiptHtml(transaction, business);
  // Add auto-print script on open for convenience
  const autoPrintHtml = html.replace(
    '</body>',
    '<script>window.onload = function() { setTimeout(function() { window.print(); }, 300); };</script></body>'
  );

  const blob = new Blob([autoPrintHtml], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Ticket_${transaction.ticketNumber.replace(/[^a-zA-Z0-9_-]/g, '_')}.html`;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 1000);
}

/**
 * Downloads raw text receipt (.txt)
 */
export function downloadReceiptText(transaction: SaleTransaction, business: Business): void {
  const text = buildThermalReceiptText(transaction, business);
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Ticket_${transaction.ticketNumber.replace(/[^a-zA-Z0-9_-]/g, '_')}.txt`;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 1000);
}

/**
 * Copies the formatted receipt text to the clipboard (e.g. for WhatsApp / SMS)
 */
export async function copyReceiptToClipboard(transaction: SaleTransaction, business: Business): Promise<boolean> {
  const text = buildThermalReceiptText(transaction, business);
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
    // Fallback for older environments
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.top = '-9999px';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    const success = document.execCommand('copy');
    document.body.removeChild(textarea);
    return success;
  } catch (err) {
    console.error('Failed to copy receipt text to clipboard:', err);
    return false;
  }
}

function escapeHtml(str: string): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
