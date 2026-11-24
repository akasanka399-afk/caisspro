import { useEffect, useState } from 'react';
import { Business, CashRegisterSession, SaleTransaction } from '../types';
import { formatDate, formatMoney } from '../utils/formatters';

export type PaperWidth = '80mm' | '58mm';
export type PrinterEncoding = 'ascii' | 'cp858' | 'utf8';

export interface BluetoothPrinterState {
  isSupported: boolean;
  connected: boolean;
  connecting: boolean;
  printing: boolean;
  deviceName: string | null;
  deviceId: string | null;
  paperWidth: PaperWidth;
  encoding: PrinterEncoding;
  autoPrintBle: boolean;
  autoCut: boolean;
  lastError: string | null;
}

// Local Web Bluetooth TypeScript declarations (avoids extra @types package requirements)
interface WebBluetoothCharacteristicProperties {
  write: boolean;
  writeWithoutResponse: boolean;
  notify?: boolean;
  read?: boolean;
}

interface WebBluetoothRemoteGATTCharacteristic {
  uuid: string;
  properties: WebBluetoothCharacteristicProperties;
  writeValue(value: BufferSource): Promise<void>;
  writeValueWithoutResponse?(value: BufferSource): Promise<void>;
  writeValueWithResponse?(value: BufferSource): Promise<void>;
}

interface WebBluetoothRemoteGATTService {
  uuid: string;
  getCharacteristics(): Promise<WebBluetoothRemoteGATTCharacteristic[]>;
  getCharacteristic(uuid: string): Promise<WebBluetoothRemoteGATTCharacteristic>;
}

interface WebBluetoothRemoteGATTServer {
  connected: boolean;
  connect(): Promise<WebBluetoothRemoteGATTServer>;
  disconnect(): void;
  getPrimaryService(service: string): Promise<WebBluetoothRemoteGATTService>;
  getPrimaryServices(): Promise<WebBluetoothRemoteGATTService[]>;
}

interface WebBluetoothDevice {
  id: string;
  name?: string;
  gatt?: WebBluetoothRemoteGATTServer;
  addEventListener(type: string, listener: EventListenerOrEventListenerObject): void;
  removeEventListener(type: string, listener: EventListenerOrEventListenerObject): void;
}

interface WebBluetoothNavigator extends Navigator {
  bluetooth?: {
    requestDevice(options: {
      acceptAllDevices?: boolean;
      filters?: Array<{ services?: string[]; namePrefix?: string }>;
      optionalServices?: string[];
    }): Promise<WebBluetoothDevice>;
  };
}

const STORAGE_KEY = 'kassapro_ble_printer_prefs_v1';

// Standard & widely used BLE thermal printer GATT service UUIDs (58mm & 80mm POS printers)
const KNOWN_PRINTER_SERVICES = [
  '000018f0-0000-1000-8000-00805f9b34fb', // Generic BLE Thermal Printer (Xprinter, Goojprt, Munbyn, Rongta)
  'e7810a71-73ae-499d-8c15-faa9aef0c3f2', // Star / Feasycom / MPT / POS-58 & POS-80
  '49535343-fe7d-4ae5-8fa9-9fafd205e455', // ISSC / Microchip Transparent UART (Sunmi / POS-58)
  '6e400001-b5a3-f393-e0a9-e50e24dcca9e', // Nordic UART Service (NUS)
  '0000ff00-0000-1000-8000-00805f9b34fb', // Generic FF00 Serial
  '0000ffe0-0000-1000-8000-00805f9b34fb', // HM-10 / TI CC254x UART
  '0000ae30-0000-1000-8000-00805f9b34fb', // Zjiang / Jieli / Mini Thermal Printer
  '0000fee7-0000-1000-8000-00805f9b34fb', // Portable POS BLE service
  '00001800-0000-1000-8000-00805f9b34fb',
  '00001801-0000-1000-8000-00805f9b34fb',
  '0000180a-0000-1000-8000-00805f9b34fb',
];

const KNOWN_WRITE_CHARACTERISTICS = [
  '00002af1-0000-1000-8000-00805f9b34fb', // Standard BLE Thermal Printer Write
  'bef8d6c9-9c21-4c9e-b632-bd58c1009f9f', // Star / Feasycom / MPT Write
  '49535343-8841-43f4-a8d4-ecbe34729bb3', // ISSC RX (Write)
  '6e400002-b5a3-f393-e0a9-e50e24dcca9e', // Nordic UART RX (Write)
  '0000ff02-0000-1000-8000-00805f9b34fb', // FF02 Write
  '0000ffe1-0000-1000-8000-00805f9b34fb', // HM-10 Read/Write
  '0000ae01-0000-1000-8000-00805f9b34fb', // Zjiang / Jieli Write
];

const PAYMENT_LABELS: Record<string, string> = {
  cash: 'Espèces (Cash)',
  mobile_money: 'Mobile Money (Wave / OM)',
  card: 'Carte Bancaire',
  credit: 'À crédit (Compte Client)',
};

// CP858 lookup table for French / European characters
const CP858_MAP: Record<string, number> = {
  'Ç': 0x80, 'ü': 0x81, 'é': 0x82, 'â': 0x83, 'ä': 0x84, 'à': 0x85, 'å': 0x86, 'ç': 0x87,
  'ê': 0x88, 'ë': 0x89, 'è': 0x8a, 'ï': 0x8b, 'î': 0x8c, 'ì': 0x8d, 'Ä': 0x8e, 'Å': 0x8f,
  'É': 0x90, 'æ': 0x91, 'Æ': 0x92, 'ô': 0x93, 'ö': 0x94, 'ò': 0x95, 'û': 0x96, 'ù': 0x97,
  'ÿ': 0x98, 'Ö': 0x99, 'Ü': 0x9a, 'ø': 0x9b, '£': 0x9c, 'Ø': 0x9d, '×': 0x9e, 'ƒ': 0x9f,
  'á': 0xa0, 'í': 0xa1, 'ó': 0xa2, 'ú': 0xa3, 'ñ': 0xa4, 'Ñ': 0xa5, 'ª': 0xa6, 'º': 0xa7,
  '¿': 0xa8, '®': 0xa9, '¬': 0xaa, '½': 0xab, '¼': 0xac, '¡': 0xad, '«': 0xae, '»': 0xaf,
  'Á': 0xb5, 'Â': 0xb6, 'À': 0xb7, '©': 0xb8, '¢': 0xbd, '¥': 0xbe,
  'ã': 0xc6, 'Ã': 0xc7, '¤': 0xcf, 'ð': 0xd0, 'Ð': 0xd1, 'Ê': 0xd2, 'Ë': 0xd3, 'È': 0xd4,
  '€': 0xd5, 'Í': 0xd6, 'Î': 0xd7, 'Ï': 0xd8, 'Ì': 0xde, 'Ó': 0xe0, 'ß': 0xe1, 'Ô': 0xe2,
  'Ò': 0xe3, 'õ': 0xe4, 'Õ': 0xe5, 'µ': 0xe6, 'þ': 0xe7, 'Þ': 0xe8, 'Ú': 0xe9, 'Û': 0xea,
  'Ù': 0xeb, 'ý': 0xec, 'Ý': 0xed, '°': 0xf8, '·': 0xfa, '²': 0xfd,
};

function toAsciiSafe(text: string): string {
  return text
    .replace(/\u202f|\u00a0/g, ' ')
    .replace(/[«»“”]/g, '"')
    .replace(/[’‘]/g, "'")
    .replace(/[–—]/g, '-')
    .replace(/€/g, 'EUR')
    .replace(/°/g, 'o')
    .replace(/×/g, 'x')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\x20-\x7e\n\r\t]/g, ' ');
}

function encodeTextBytes(text: string, encoding: PrinterEncoding): number[] {
  const cleaned = text.replace(/\u202f|\u00a0/g, ' ');
  if (encoding === 'utf8') {
    return Array.from(new TextEncoder().encode(cleaned));
  }
  if (encoding === 'ascii') {
    const ascii = toAsciiSafe(cleaned);
    const bytes: number[] = [];
    for (let i = 0; i < ascii.length; i++) {
      bytes.push(ascii.charCodeAt(i) & 0x7f);
    }
    return bytes;
  }

  // cp858
  const bytes: number[] = [];
  for (const ch of cleaned) {
    const code = ch.charCodeAt(0);
    if (code < 0x80) {
      bytes.push(code);
    } else if (CP858_MAP[ch] !== undefined) {
      bytes.push(CP858_MAP[ch]);
    } else {
      const fallback = toAsciiSafe(ch);
      for (let i = 0; i < fallback.length; i++) {
        bytes.push(fallback.charCodeAt(i) & 0x7f);
      }
    }
  }
  return bytes;
}

class EscPosBuilder {
  private buffer: number[] = [];
  private readonly cols: number;
  private readonly encoding: PrinterEncoding;

  constructor(paperWidth: PaperWidth, encoding: PrinterEncoding) {
    // 58mm thermal rolls: 384 dots => 32 characters per line (Font A)
    // 80mm thermal rolls: 512..576 dots => 42 characters safe across 72mm-80mm printable widths
    this.cols = paperWidth === '58mm' ? 32 : 42;
    this.encoding = encoding;

    // ESC @ (Initialize printer)
    this.buffer.push(0x1b, 0x40);
    if (encoding === 'cp858') {
      // ESC t 19 (Select PC858 codepage)
      this.buffer.push(0x1b, 0x74, 19);
    }
  }

  getColumns(): number {
    return this.cols;
  }

  align(mode: 'left' | 'center' | 'right'): this {
    const n = mode === 'center' ? 1 : mode === 'right' ? 2 : 0;
    this.buffer.push(0x1b, 0x61, n);
    return this;
  }

  bold(enabled: boolean): this {
    this.buffer.push(0x1b, 0x45, enabled ? 1 : 0);
    return this;
  }

  size(scale: 'normal' | 'tall' | 'wide' | 'double'): this {
    const n =
      scale === 'double'
        ? 0x11
        : scale === 'tall'
        ? 0x01
        : scale === 'wide'
        ? 0x10
        : 0x00;
    this.buffer.push(0x1d, 0x21, n);
    return this;
  }

  line(text: string = ''): this {
    if (text) {
      this.buffer.push(...encodeTextBytes(text, this.encoding));
    }
    this.buffer.push(0x0a);
    return this;
  }

  wrappedLine(text: string): this {
    const trimmed = text.trim();
    if (!trimmed) {
      this.buffer.push(0x0a);
      return this;
    }
    const words = trimmed.split(/\s+/);
    let current = '';
    for (const word of words) {
      if (!current) {
        current = word.length > this.cols ? word.slice(0, this.cols) : word;
      } else if (current.length + 1 + word.length <= this.cols) {
        current += ' ' + word;
      } else {
        this.line(current);
        current = word.length > this.cols ? word.slice(0, this.cols) : word;
      }
    }
    if (current) {
      this.line(current);
    }
    return this;
  }

  pair(left: string, right: string): this {
    const cleanLeft = left.trim();
    const cleanRight = right.trim();
    const minGap = 1;
    const maxLeft = Math.max(4, this.cols - cleanRight.length - minGap);
    const l = cleanLeft.length > maxLeft ? cleanLeft.slice(0, maxLeft) : cleanLeft;
    const spaces = Math.max(1, this.cols - l.length - cleanRight.length);
    return this.line(`${l}${' '.repeat(spaces)}${cleanRight}`);
  }

  divider(char: '-' | '=' = '-'): this {
    return this.line(char.repeat(this.cols));
  }

  feed(lines: number = 3): this {
    this.buffer.push(0x1b, 0x64, Math.max(1, Math.min(10, lines)));
    return this;
  }

  cut(): this {
    // GS V 66 0 (Feed and partial cut - safely ignored on portable printers without cutter)
    this.buffer.push(0x1d, 0x56, 0x42, 0x00);
    return this;
  }

  build(): Uint8Array {
    return new Uint8Array(this.buffer);
  }
}

export function buildEscPosSaleReceipt(
  transaction: SaleTransaction,
  business: Business,
  paperWidth: PaperWidth,
  encoding: PrinterEncoding,
  autoCut: boolean = true
): Uint8Array {
  const b = new EscPosBuilder(paperWidth, encoding);
  const isCancelled = transaction.status === 'cancelled';

  b.align('center')
    .bold(true)
    .size(paperWidth === '58mm' ? 'tall' : 'double')
    .wrappedLine(business.name.toUpperCase())
    .size('normal')
    .bold(false);

  if (business.address) {
    b.wrappedLine(business.address);
  }
  if (business.phone) {
    b.line(`Tel: ${business.phone}`);
  }
  b.line('Commerce Enregistre - Caisse Pro');

  if (isCancelled) {
    b.divider('=')
      .bold(true)
      .line('*** VENTE ANNULEE ***')
      .bold(false);
    if (transaction.cancellationReason) {
      b.wrappedLine(`Motif: ${transaction.cancellationReason}`);
    }
  }

  b.divider('=')
    .align('left')
    .bold(true)
    .pair('Ticket N°:', transaction.ticketNumber)
    .bold(false)
    .pair('Date:', formatDate(transaction.timestamp))
    .pair('Caissier:', transaction.cashierName || 'Caisse')
    .pair('Client:', transaction.customerName || 'Client Comptoir');

  if (transaction.customerPhone) {
    b.pair('Tel Client:', transaction.customerPhone);
  }

  b.divider('-');
  b.bold(true).pair('Designation', 'Total').bold(false);
  b.divider('-');

  for (const item of transaction.items) {
    const qtyUnit = `${item.quantity} x ${formatMoney(item.unitPrice, 'F')}`;
    const lineTotal = formatMoney(item.total, 'F');
    b.bold(true).wrappedLine(item.productName).bold(false);
    b.pair(`  ${qtyUnit}`, lineTotal);
  }

  b.divider('-');
  b.pair('Sous-total:', formatMoney(transaction.subtotal, 'F'));

  if (transaction.discountTotal > 0) {
    b.pair('Remise accordee:', `-${formatMoney(transaction.discountTotal, 'F')}`);
  }

  b.divider('=');
  b.bold(true)
    .size('tall')
    .pair('TOTAL A PAYER:', formatMoney(transaction.totalAmount, 'F CFA'))
    .size('normal')
    .bold(false);
  b.divider('=');

  b.pair('Reglement:', PAYMENT_LABELS[transaction.paymentMethod] || transaction.paymentMethod);

  if (transaction.paymentMethod === 'cash') {
    b.pair('Especes recues:', formatMoney(transaction.amountReceived, 'F'));
    b.bold(true)
      .pair('Monnaie rendue:', formatMoney(transaction.changeDue, 'F'))
      .bold(false);
  } else if (transaction.paymentMethod === 'credit') {
    b.divider('-')
      .align('center')
      .bold(true)
      .line('*** VENTE A CREDIT (DETTE) ***')
      .bold(false)
      .align('left')
      .pair('Titulaire:', transaction.customerName || 'Compte Client')
      .pair('Porte au carnet:', formatMoney(transaction.totalAmount, 'F CFA'))
      .line('')
      .line('Signature Client: _______________');
  }

  b.divider('-')
    .align('center')
    .bold(true)
    .line(transaction.ticketNumber)
    .bold(false)
    .line('Merci de votre visite !')
    .line('KassaPro POS')
    .feed(4);

  if (autoCut) {
    b.cut();
  }

  return b.build();
}

export function buildEscPosZReport(
  session: CashRegisterSession,
  business: Business,
  paperWidth: PaperWidth,
  encoding: PrinterEncoding,
  autoCut: boolean = true
): Uint8Array {
  const b = new EscPosBuilder(paperWidth, encoding);
  const cur = business.currency || 'F CFA';
  const diff = session.cashDifference || 0;
  const isPerfect = diff === 0;
  const isSurplus = diff > 0;
  const avgBasket =
    session.totalSalesCount > 0 ? Math.round(session.totalSalesAmount / session.totalSalesCount) : 0;
  const zNum = session.zNumber || `Z-${session.id.slice(-6).toUpperCase()}`;

  b.align('center')
    .bold(true)
    .size('tall')
    .wrappedLine(business.name.toUpperCase())
    .size('normal')
    .bold(false);

  if (business.address) b.wrappedLine(business.address);
  if (business.phone) b.line(`Tel: ${business.phone}`);

  b.divider('=')
    .bold(true)
    .line('RAPPORT DE CAISSE Z')
    .line(zNum)
    .bold(false)
    .divider('=');

  b.align('left')
    .pair('Ouverture:', formatDate(session.openedAt))
    .pair('Cloture:', formatDate(session.closedAt || new Date().toISOString()))
    .pair('Caissier:', session.cashierName)
    .divider('-');

  b.bold(true).line('1. SYNTHESE DES VENTES').bold(false);
  b.pair('Tickets emis:', String(session.totalSalesCount));
  b.pair('Panier moyen:', formatMoney(avgBasket, cur));
  if ((session.discountsTotal || 0) > 0) {
    b.pair('Remises:', `-${formatMoney(session.discountsTotal || 0, cur)}`);
  }
  b.bold(true)
    .pair('CA NET:', formatMoney(session.totalSalesAmount, cur))
    .bold(false);

  b.divider('-');
  b.bold(true).line('2. ENCAISSEMENTS').bold(false);
  b.pair('Especes:', formatMoney(session.cashSales || 0, cur));
  b.pair('Mobile Money:', formatMoney(session.mobileMoneySales || 0, cur));
  b.pair('Carte Bancaire:', formatMoney(session.cardSales || 0, cur));
  b.pair('Ventes a Credit:', formatMoney(session.creditSales || 0, cur));
  if ((session.creditSettlementsCash || 0) > 0) {
    b.pair('+ Regl. creances:', `+${formatMoney(session.creditSettlementsCash || 0, cur)}`);
  }

  b.divider('-');
  b.bold(true).line('3. TIROIR-CAISSE').bold(false);
  b.pair('Fond initial:', formatMoney(session.openingFloat, cur));
  b.pair('+ Cash recu:', `+${formatMoney((session.cashSales || 0) + (session.creditSettlementsCash || 0), cur)}`);
  b.pair('Attendu:', formatMoney(session.expectedCash, cur));
  b.pair('Compte reel:', formatMoney(session.actualCash || 0, cur));

  b.divider('=');
  b.align('center').bold(true);
  if (isPerfect) {
    b.line(`ECART: 0 ${cur}`);
    b.line('CAISSE PARFAITE');
  } else if (isSurplus) {
    b.line(`EXCEDENT: +${formatMoney(diff, cur)}`);
  } else {
    b.line(`DEFICIT: ${formatMoney(diff, cur)}`);
  }
  b.bold(false).align('left');

  if (session.denominations) {
    const denoms = [
      { label: 'Billet 10 000 F', count: session.denominations.b10000, value: (session.denominations.b10000 || 0) * 10000 },
      { label: 'Billet 5 000 F', count: session.denominations.b5000, value: (session.denominations.b5000 || 0) * 5000 },
      { label: 'Billet 2 000 F', count: session.denominations.b2000, value: (session.denominations.b2000 || 0) * 2000 },
      { label: 'Billet 1 000 F', count: session.denominations.b1000, value: (session.denominations.b1000 || 0) * 1000 },
      { label: 'Billet 500 F', count: session.denominations.b500, value: (session.denominations.b500 || 0) * 500 },
      { label: 'Piece 500 F', count: session.denominations.p500, value: (session.denominations.p500 || 0) * 500 },
      { label: 'Piece 200 F', count: session.denominations.p200, value: (session.denominations.p200 || 0) * 200 },
      { label: 'Piece 100 F', count: session.denominations.p100, value: (session.denominations.p100 || 0) * 100 },
      { label: 'Piece 50 F', count: session.denominations.p50, value: (session.denominations.p50 || 0) * 50 },
      { label: 'Piece 25 F', count: session.denominations.p25, value: (session.denominations.p25 || 0) * 25 },
    ].filter((d) => (d.count || 0) > 0);

    if (denoms.length > 0) {
      b.divider('-');
      b.bold(true).line('4. BILLETAGE').bold(false);
      for (const d of denoms) {
        b.pair(`${d.label} x${d.count}`, formatMoney(d.value, 'F'));
      }
    }
  }

  if (session.notes) {
    b.divider('-').wrappedLine(`Note: ${session.notes}`);
  }

  b.divider('-')
    .line('Visa Caissier: _________________')
    .line('')
    .line('Visa Gerant:   _________________')
    .align('center')
    .line('*** CLOTURE DEFINITIVE KASSAPRO ***')
    .feed(4);

  if (autoCut) {
    b.cut();
  }

  return b.build();
}

export function buildEscPosTestPage(
  business: Business,
  paperWidth: PaperWidth,
  encoding: PrinterEncoding,
  autoCut: boolean = true
): Uint8Array {
  const b = new EscPosBuilder(paperWidth, encoding);
  b.align('center')
    .bold(true)
    .size('double')
    .line('TEST BLE POS')
    .size('normal')
    .wrappedLine(business.name.toUpperCase())
    .bold(false)
    .divider('=')
    .align('left')
    .pair('Format papier:', paperWidth)
    .pair('Largeur ligne:', `${b.getColumns()} colonnes`)
    .pair('Encodage:', encoding.toUpperCase())
    .pair('Date:', formatDate(new Date().toISOString()))
    .divider('-')
    .line('01234567890123456789012345678901' + (paperWidth === '80mm' ? '2345678901' : ''))
    .pair('Article test x2', '2 500 F')
    .pair('TOTAL TEST', '2 500 F CFA')
    .divider('=')
    .align('center')
    .bold(true)
    .line('IMPRIMANTE BLUETOOTH PRETE !')
    .bold(false)
    .line('KassaPro POS · ESC/POS BLE')
    .feed(4);

  if (autoCut) {
    b.cut();
  }

  return b.build();
}

interface StoredPrefs {
  paperWidth: PaperWidth;
  encoding: PrinterEncoding;
  autoPrintBle: boolean;
  autoCut: boolean;
}

function loadPrefs(): StoredPrefs {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<StoredPrefs>;
      return {
        paperWidth: parsed.paperWidth === '58mm' ? '58mm' : '80mm',
        encoding:
          parsed.encoding === 'cp858' || parsed.encoding === 'utf8' ? parsed.encoding : 'ascii',
        autoPrintBle: typeof parsed.autoPrintBle === 'boolean' ? parsed.autoPrintBle : true,
        autoCut: typeof parsed.autoCut === 'boolean' ? parsed.autoCut : true,
      };
    }
  } catch {
    // ignore storage read errors
  }
  return {
    paperWidth: '80mm',
    encoding: 'ascii',
    autoPrintBle: true,
    autoCut: true,
  };
}

function savePrefs(prefs: StoredPrefs): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // ignore storage write errors
  }
}

class BluetoothThermalPrinterService {
  private device: WebBluetoothDevice | null = null;
  private characteristic: WebBluetoothRemoteGATTCharacteristic | null = null;
  private listeners = new Set<(state: BluetoothPrinterState) => void>();
  private state: BluetoothPrinterState;

  constructor() {
    const prefs = loadPrefs();
    const nav = typeof navigator !== 'undefined' ? (navigator as WebBluetoothNavigator) : undefined;
    this.state = {
      isSupported: Boolean(nav && nav.bluetooth),
      connected: false,
      connecting: false,
      printing: false,
      deviceName: null,
      deviceId: null,
      paperWidth: prefs.paperWidth,
      encoding: prefs.encoding,
      autoPrintBle: prefs.autoPrintBle,
      autoCut: prefs.autoCut,
      lastError: null,
    };
  }

  private emit(): void {
    const snapshot = { ...this.state };
    this.listeners.forEach((listener) => listener(snapshot));
  }

  private updateState(patch: Partial<BluetoothPrinterState>): void {
    this.state = { ...this.state, ...patch };
    this.emit();
  }

  private persistPrefs(): void {
    savePrefs({
      paperWidth: this.state.paperWidth,
      encoding: this.state.encoding,
      autoPrintBle: this.state.autoPrintBle,
      autoCut: this.state.autoCut,
    });
  }

  getState(): BluetoothPrinterState {
    return { ...this.state };
  }

  getPaperWidth(): PaperWidth {
    return this.state.paperWidth;
  }

  isConnected(): boolean {
    return Boolean(this.state.connected && this.device?.gatt?.connected && this.characteristic);
  }

  subscribe(listener: (state: BluetoothPrinterState) => void): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => {
      this.listeners.delete(listener);
    };
  }

  setPaperWidth(paperWidth: PaperWidth): void {
    this.updateState({ paperWidth });
    this.persistPrefs();
  }

  setEncoding(encoding: PrinterEncoding): void {
    this.updateState({ encoding });
    this.persistPrefs();
  }

  setAutoPrintBle(autoPrintBle: boolean): void {
    this.updateState({ autoPrintBle });
    this.persistPrefs();
  }

  setAutoCut(autoCut: boolean): void {
    this.updateState({ autoCut });
    this.persistPrefs();
  }

  clearError(): void {
    this.updateState({ lastError: null });
  }

  private handleDisconnected = (): void => {
    this.characteristic = null;
    this.updateState({
      connected: false,
      connecting: false,
      printing: false,
    });
  };

  private async findWritableCharacteristic(
    server: WebBluetoothRemoteGATTServer
  ): Promise<WebBluetoothRemoteGATTCharacteristic> {
    // 1. Try known printer services & characteristics first for fastest pairing
    for (const serviceUuid of KNOWN_PRINTER_SERVICES) {
      try {
        const service = await server.getPrimaryService(serviceUuid);
        const chars = await service.getCharacteristics();
        for (const knownCharUuid of KNOWN_WRITE_CHARACTERISTICS) {
          const matched = chars.find(
            (c) =>
              c.uuid.toLowerCase() === knownCharUuid &&
              (c.properties.writeWithoutResponse || c.properties.write)
          );
          if (matched) return matched;
        }
        const anyWritable = chars.find(
          (c) => c.properties.writeWithoutResponse || c.properties.write
        );
        if (anyWritable) return anyWritable;
      } catch {
        // Service not present on this printer, continue
      }
    }

    // 2. Fallback: inspect all advertised primary services
    const services = await server.getPrimaryServices();
    for (const service of services) {
      try {
        const chars = await service.getCharacteristics();
        const writable = chars.find(
          (c) => c.properties.writeWithoutResponse || c.properties.write
        );
        if (writable) return writable;
      } catch {
        // ignore inaccessible service
      }
    }

    throw new Error(
      "Aucune caractéristique d'écriture BLE ESC/POS compatible n'a été trouvée sur ce périphérique."
    );
  }

  async connect(): Promise<boolean> {
    const nav = typeof navigator !== 'undefined' ? (navigator as WebBluetoothNavigator) : undefined;
    if (!nav?.bluetooth) {
      this.updateState({
        isSupported: false,
        lastError:
          "Web Bluetooth n'est pas supporté sur ce navigateur. Utilisez Google Chrome, Edge (PC/Android) ou l'application Bluefy sur iOS, sinon utilisez l'impression système 80mm/58mm.",
      });
      return false;
    }

    this.updateState({ connecting: true, lastError: null });

    try {
      const device = await nav.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: KNOWN_PRINTER_SERVICES,
      });

      if (this.device && this.device !== device) {
        this.device.removeEventListener('gattserverdisconnected', this.handleDisconnected);
      }

      this.device = device;
      device.addEventListener('gattserverdisconnected', this.handleDisconnected);

      if (!device.gatt) {
        throw new Error('Serveur GATT Bluetooth indisponible sur cet appareil.');
      }

      const server = await device.gatt.connect();
      const char = await this.findWritableCharacteristic(server);
      this.characteristic = char;

      this.updateState({
        connected: true,
        connecting: false,
        deviceName: device.name || 'Imprimante BLE POS',
        deviceId: device.id,
        lastError: null,
      });

      return true;
    } catch (err) {
      const errorObj = err as { name?: string; message?: string };
      let friendlyMsg = errorObj?.message || 'Échec de connexion Bluetooth.';

      if (errorObj?.name === 'NotFoundError') {
        friendlyMsg = 'Sélection annulée : aucune imprimante Bluetooth choisie.';
      } else if (errorObj?.name === 'SecurityError') {
        friendlyMsg =
          "Accès Bluetooth bloqué par la politique de sécurité ou l'iframe. Ouvrez l'application dans un onglet navigateur direct (HTTPS / Chrome) ou utilisez l'impression thermique système.";
      } else if (errorObj?.name === 'NetworkError') {
        friendlyMsg =
          "Impossible d'établir la liaison GATT. Vérifiez que l'imprimante thermique BLE est allumée et à portée.";
      }

      this.updateState({
        connected: false,
        connecting: false,
        lastError: friendlyMsg,
      });
      return false;
    }
  }

  disconnect(): void {
    try {
      if (this.device?.gatt?.connected) {
        this.device.gatt.disconnect();
      }
    } catch {
      // ignore disconnect error
    }
    this.characteristic = null;
    this.updateState({
      connected: false,
      connecting: false,
      printing: false,
    });
  }

  private async ensureConnectedCharacteristic(): Promise<WebBluetoothRemoteGATTCharacteristic> {
    if (this.device?.gatt && !this.device.gatt.connected) {
      const server = await this.device.gatt.connect();
      this.characteristic = await this.findWritableCharacteristic(server);
      this.updateState({ connected: true });
    }
    if (!this.characteristic || !this.device?.gatt?.connected) {
      throw new Error('Imprimante Bluetooth non connectée.');
    }
    return this.characteristic;
  }

  async sendBytes(data: Uint8Array): Promise<void> {
    this.updateState({ printing: true, lastError: null });
    try {
      const char = await this.ensureConnectedCharacteristic();
      // 20-byte chunks fit safely inside every BLE ATT MTU (default 23 bytes)
      const chunkSize = 20;

      for (let offset = 0; offset < data.length; offset += chunkSize) {
        const chunk = data.slice(offset, offset + chunkSize);
        if (char.properties.writeWithoutResponse && char.writeValueWithoutResponse) {
          await char.writeValueWithoutResponse(chunk);
        } else if (char.writeValueWithResponse) {
          await char.writeValueWithResponse(chunk);
        } else {
          await char.writeValue(chunk);
        }
        // Small inter-packet pacing prevents buffer overrun on entry-level 58mm/80mm BLE controllers
        await new Promise((resolve) => setTimeout(resolve, 14));
      }
    } catch (err) {
      const msg = (err as Error)?.message || "Erreur lors de l'envoi Bluetooth vers l'imprimante.";
      this.updateState({ lastError: msg });
      throw new Error(msg);
    } finally {
      this.updateState({ printing: false });
    }
  }

  async printReceipt(
    transaction: SaleTransaction,
    business: Business,
    paperWidthOverride?: PaperWidth
  ): Promise<void> {
    const width = paperWidthOverride || this.state.paperWidth;
    const payload = buildEscPosSaleReceipt(
      transaction,
      business,
      width,
      this.state.encoding,
      this.state.autoCut
    );
    await this.sendBytes(payload);
  }

  async printZReport(
    session: CashRegisterSession,
    business: Business,
    paperWidthOverride?: PaperWidth
  ): Promise<void> {
    const width = paperWidthOverride || this.state.paperWidth;
    const payload = buildEscPosZReport(
      session,
      business,
      width,
      this.state.encoding,
      this.state.autoCut
    );
    await this.sendBytes(payload);
  }

  async printTestPage(business: Business, paperWidthOverride?: PaperWidth): Promise<void> {
    const width = paperWidthOverride || this.state.paperWidth;
    const payload = buildEscPosTestPage(
      business,
      width,
      this.state.encoding,
      this.state.autoCut
    );
    await this.sendBytes(payload);
  }
}

export const bluetoothPrinter = new BluetoothThermalPrinterService();

export function useBluetoothPrinter(): BluetoothPrinterState {
  const [state, setState] = useState<BluetoothPrinterState>(() => bluetoothPrinter.getState());

  useEffect(() => {
    return bluetoothPrinter.subscribe(setState);
  }, []);

  return state;
}
