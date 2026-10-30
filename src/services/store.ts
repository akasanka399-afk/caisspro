import {
  Business,
  CashRegisterSession,
  Customer,
  Product,
  PushNotification,
  SaleTransaction,
  StockMovement,
  User,
  UserRole,
} from '../types';
import {
  syncDocToFirestore,
  deleteDocFromFirestore,
  setupFirestoreListeners,
  seedRemoteFirestoreIfEmpty,
} from './firebaseSync';

import imgHeroCounter from '../assets/images/pos_retail_counter_1793177600014.jpg';
import imgBeverage from '../assets/images/product_beverage_pack_1793177600621.jpg';
import imgRiceBag from '../assets/images/product_rice_cereal_1793177599557.jpg';

export const ASSET_IMAGES = {
  hero: imgHeroCounter,
  beverage: imgBeverage,
  rice: imgRiceBag,
};

const STORAGE_KEYS = {
  USERS: 'kassapro_users',
  BUSINESSES: 'kassapro_businesses',
  PRODUCTS: 'kassapro_products',
  CUSTOMERS: 'kassapro_customers',
  TRANSACTIONS: 'kassapro_transactions',
  SESSIONS: 'kassapro_sessions',
  NOTIFICATIONS: 'kassapro_notifications',
  MOVEMENTS: 'kassapro_movements',
  CURRENT_USER_ID: 'kassapro_current_user_id',
};

// Default seed businesses
const SEED_BUSINESSES: Business[] = [
  {
    id: 'biz_cocody',
    name: 'Supermarché Express Cocody',
    tradeType: 'Alimentation & Épicerie',
    currency: 'FCFA',
    phone: '+225 07 48 92 11 00',
    address: 'Boulevard Latrille, Cocody Angré, Abidjan',
    ownerName: 'Amadou Diallo',
    subscriptionPlan: 'pro',
    subscriptionStatus: 'active',
    subscriptionExpiresAt: '2027-04-15',
    totalSalesCount: 142,
    developerFeeRate: 20,
    createdAt: '2026-01-10',
    accessCode: 'CP-8842',
  },
  {
    id: 'biz_pharmacie',
    name: 'Pharmacie & Parapharmacie Centrale',
    tradeType: 'Santé & Pharmacie',
    currency: 'FCFA',
    phone: '+225 05 12 34 56 78',
    address: 'Avenue Chardy, Plateau, Abidjan',
    ownerName: 'Dr. Cissé Aminata',
    subscriptionPlan: 'enterprise',
    subscriptionStatus: 'active',
    subscriptionExpiresAt: '2026-11-20',
    totalSalesCount: 94,
    developerFeeRate: 20,
    createdAt: '2026-02-01',
    accessCode: 'CP-5120',
  },
  {
    id: 'biz_dakar',
    name: 'Boutique Mode Prestige Dakar',
    tradeType: 'Prêt-à-porter & Accessoires',
    currency: 'FCFA',
    phone: '+221 77 654 32 10',
    address: 'Almadies, Route de la Corniche, Dakar',
    ownerName: 'Cheikh Ndiaye',
    subscriptionPlan: 'starter',
    subscriptionStatus: 'trial',
    subscriptionExpiresAt: '2026-11-05',
    totalSalesCount: 48,
    developerFeeRate: 20,
    createdAt: '2026-03-01',
    accessCode: 'CP-7419',
  },
  {
    id: 'biz_quincaillerie',
    name: 'Quincaillerie & Outillage Pro',
    tradeType: 'Quincaillerie & BTP',
    currency: 'FCFA',
    phone: '+225 01 23 45 67 89',
    address: 'Zone Industrielle Yopougon, Abidjan',
    ownerName: 'Kouassi Konan',
    subscriptionPlan: 'pro',
    subscriptionStatus: 'active',
    subscriptionExpiresAt: '2026-12-31',
    totalSalesCount: 76,
    developerFeeRate: 20,
    createdAt: '2026-02-14',
    accessCode: 'CP-3391',
  },
  {
    id: 'biz_telecom',
    name: 'Boutique Télécom & Services Digitaux',
    tradeType: 'Télécom',
    currency: 'FCFA',
    phone: '+225 07 88 99 00 11',
    address: 'Carrefour Duncan, Deux-Plateaux, Abidjan',
    ownerName: 'Moussa Bakayoko',
    subscriptionPlan: 'pro',
    subscriptionStatus: 'active',
    subscriptionExpiresAt: '2027-01-30',
    totalSalesCount: 185,
    developerFeeRate: 20,
    createdAt: '2026-01-15',
    accessCode: 'CP-6610',
  },
];

// Default seed users
const SEED_USERS: User[] = [
  {
    id: 'usr_dev',
    name: 'Alexandre K. (Développeur)',
    email: 'dev@kassapro.io',
    phone: '+225 07 00 11 22 33',
    role: 'developer',
    businessId: 'all',
    pinCode: '76127809',
    status: 'active',
    createdAt: '2025-11-01',
    lastLogin: '2026-10-28 08:30',
  },
  {
    id: 'usr_owner',
    name: 'Amadou Diallo (Propriétaire)',
    email: 'amadou@expresscocody.com',
    phone: '+225 07 48 92 11 00',
    role: 'owner',
    businessId: 'biz_cocody',
    pinCode: '1234',
    status: 'active',
    createdAt: '2026-01-10',
    lastLogin: '2026-10-28 09:15',
  },
  {
    id: 'usr_manager',
    name: 'Aïcha Traoré (Gérante)',
    email: 'aicha@expresscocody.com',
    phone: '+225 07 11 22 33 44',
    role: 'manager',
    businessId: 'biz_cocody',
    pinCode: '2244',
    status: 'active',
    createdAt: '2026-01-15',
    lastLogin: '2026-10-28 08:45',
  },
  {
    id: 'usr_cashier1',
    name: 'Fatou Koné (Caissière Principale)',
    email: 'fatou@expresscocody.com',
    phone: '+225 05 99 88 77 66',
    role: 'cashier',
    businessId: 'biz_cocody',
    pinCode: '0000',
    status: 'active',
    createdAt: '2026-01-20',
    lastLogin: '2026-10-28 08:00',
  },
  {
    id: 'usr_cashier2',
    name: 'Moussa Diop (Caissier Soir)',
    email: 'moussa@expresscocody.com',
    phone: '+225 05 44 33 22 11',
    role: 'cashier',
    businessId: 'biz_cocody',
    pinCode: '1111',
    status: 'active',
    createdAt: '2026-02-01',
    lastLogin: '2026-10-27 19:30',
  },
];

// Default products for Supermarché Express Cocody
const SEED_PRODUCTS: Product[] = [
  {
    id: 'prod_1',
    businessId: 'biz_cocody',
    code: 'ART-001',
    barcode: '618110012345',
    name: 'Riz Parfumé Golden Harvest 5kg',
    category: 'Alimentation',
    purchasePrice: 4200,
    salePrice: 5500,
    stock: 4, // Under min alert!
    minStockAlert: 10,
    unit: 'sac',
    imageUrl: imgRiceBag,
    isFavorite: true,
  },
  {
    id: 'prod_2',
    businessId: 'biz_cocody',
    code: 'ART-002',
    barcode: '618110012346',
    name: 'Jus Naturel Tropical Bloom 330ml',
    category: 'Boissons',
    purchasePrice: 600,
    salePrice: 900,
    stock: 28,
    minStockAlert: 12,
    unit: 'bouteille',
    imageUrl: imgBeverage,
    isFavorite: true,
  },
  {
    id: 'prod_3',
    businessId: 'biz_cocody',
    code: 'ART-003',
    barcode: '618110012347',
    name: 'Huile Végétale Raffinée 1L Dinor',
    category: 'Alimentation',
    purchasePrice: 1100,
    salePrice: 1400,
    stock: 35,
    minStockAlert: 15,
    unit: 'bouteille',
    isFavorite: true,
  },
  {
    id: 'prod_4',
    businessId: 'biz_cocody',
    code: 'ART-004',
    barcode: '618110012348',
    name: 'Sucre Blanc en Morceaux 1kg',
    category: 'Alimentation',
    purchasePrice: 800,
    salePrice: 1000,
    stock: 19,
    minStockAlert: 10,
    unit: 'paquet',
    isFavorite: true,
  },
  {
    id: 'prod_5',
    businessId: 'biz_cocody',
    code: 'ART-005',
    barcode: '618110012349',
    name: 'Eau Minérale Naturelle Céleste 1.5L',
    category: 'Boissons',
    purchasePrice: 350,
    salePrice: 500,
    stock: 42,
    minStockAlert: 20,
    unit: 'bouteille',
    isFavorite: true,
  },
  {
    id: 'prod_6',
    businessId: 'biz_cocody',
    code: 'ART-006',
    barcode: '618110012350',
    name: 'Pâtes Spaghetti 500g Madina',
    category: 'Alimentation',
    purchasePrice: 400,
    salePrice: 600,
    stock: 50,
    minStockAlert: 20,
    unit: 'sachet',
    isFavorite: true,
  },
  {
    id: 'prod_7',
    businessId: 'biz_cocody',
    code: 'ART-007',
    barcode: '618110012351',
    name: 'Lait Concentré Sucré Bonnet Rouge 397g',
    category: 'Alimentation',
    purchasePrice: 650,
    salePrice: 850,
    stock: 22,
    minStockAlert: 15,
    unit: 'boite',
    isFavorite: false,
  },
  {
    id: 'prod_8',
    businessId: 'biz_cocody',
    code: 'ART-008',
    barcode: '618110012352',
    name: 'Savon de Toilette Douceur 200g',
    category: 'Hygiène & Soins',
    purchasePrice: 300,
    salePrice: 500,
    stock: 3, // Low stock!
    minStockAlert: 12,
    unit: 'pièce',
    isFavorite: true,
  },
  {
    id: 'prod_9',
    businessId: 'biz_cocody',
    code: 'ART-009',
    barcode: '618110012353',
    name: 'Lessive Poudre Express OMO 1kg',
    category: 'Hygiène & Soins',
    purchasePrice: 1200,
    salePrice: 1600,
    stock: 14,
    minStockAlert: 8,
    unit: 'sachet',
    isFavorite: false,
  },
  {
    id: 'prod_10',
    businessId: 'biz_cocody',
    code: 'ART-010',
    barcode: '618110012354',
    name: 'Canette Soda Cola 330ml Fraîcheur',
    category: 'Boissons',
    purchasePrice: 380,
    salePrice: 500,
    stock: 31,
    minStockAlert: 15,
    unit: 'canette',
    isFavorite: true,
  },
  {
    id: 'prod_11',
    businessId: 'biz_cocody',
    code: 'ART-011',
    barcode: '618110012355',
    name: 'Dentifrice Protection Complète 75ml',
    category: 'Hygiène & Soins',
    purchasePrice: 650,
    salePrice: 950,
    stock: 16,
    minStockAlert: 10,
    unit: 'tube',
    isFavorite: false,
  },
  {
    id: 'prod_12',
    businessId: 'biz_cocody',
    code: 'ART-012',
    barcode: '618110012356',
    name: 'Biscuits Sablés au Beurre 150g',
    category: 'Snacks & Biscuits',
    purchasePrice: 450,
    salePrice: 700,
    stock: 25,
    minStockAlert: 10,
    unit: 'paquet',
    isFavorite: true,
  },
  {
    id: 'prod_13',
    businessId: 'biz_cocody',
    code: 'ART-013',
    barcode: '618110012357',
    name: 'Café Pur Arabica Soluble 100g',
    category: 'Boissons',
    purchasePrice: 1500,
    salePrice: 2100,
    stock: 11,
    minStockAlert: 6,
    unit: 'bocal',
    isFavorite: false,
  },
  {
    id: 'prod_14',
    businessId: 'biz_cocody',
    code: 'ART-014',
    barcode: '618110012358',
    name: 'Sardines à l’Huile Végétale 125g',
    category: 'Alimentation',
    purchasePrice: 400,
    salePrice: 550,
    stock: 38,
    minStockAlert: 15,
    unit: 'boite',
    isFavorite: false,
  },
  {
    id: 'prod_15',
    businessId: 'biz_cocody',
    code: 'ART-015',
    barcode: '618110012359',
    name: 'Chips de Banane Plantain 80g',
    category: 'Snacks & Biscuits',
    purchasePrice: 250,
    salePrice: 400,
    stock: 29,
    minStockAlert: 12,
    unit: 'sachet',
    isFavorite: true,
  },
  {
    id: 'prod_16',
    businessId: 'biz_cocody',
    code: 'ART-016',
    barcode: '618110012360',
    name: 'Mayonnaise Gourmande 450g',
    category: 'Alimentation',
    purchasePrice: 1150,
    salePrice: 1500,
    stock: 18,
    minStockAlert: 8,
    unit: 'bocal',
    isFavorite: false,
  },
];

// Seed customers
const SEED_CUSTOMERS: Customer[] = [
  {
    id: 'cust_1',
    businessId: 'biz_cocody',
    name: 'Mme Kouamé Adjoua',
    phone: '+225 07 12 34 56',
    address: 'Angré 8ème Tranche',
    creditBalance: 4500, // Arriéré de paiement
    totalPurchases: 148500,
    lastPurchaseDate: '2026-10-27',
  },
  {
    id: 'cust_2',
    businessId: 'biz_cocody',
    name: 'M. Koffi Yao Serge',
    phone: '+225 05 98 76 54',
    address: 'Vallon, Cocody',
    creditBalance: 0,
    totalPurchases: 86000,
    lastPurchaseDate: '2026-10-28',
  },
  {
    id: 'cust_3',
    businessId: 'biz_cocody',
    name: 'Dr. Bamba Seydou',
    phone: '+225 01 22 33 44',
    address: 'Clinique de l’Espoir',
    creditBalance: 12000,
    totalPurchases: 320000,
    lastPurchaseDate: '2026-10-26',
  },
  {
    id: 'cust_4',
    businessId: 'biz_cocody',
    name: 'Société Alpha Logistique',
    phone: '+225 27 20 21 22',
    address: 'Zone 4, Marcory',
    creditBalance: 0,
    totalPurchases: 540000,
    lastPurchaseDate: '2026-10-25',
  },
];

// Initial sales generated over past days & today to provide realistic metrics
const SEED_TRANSACTIONS: SaleTransaction[] = [
  // Today's earlier sales
  {
    id: 'tx_101',
    ticketNumber: 'TK-261028-001',
    businessId: 'biz_cocody',
    cashierId: 'usr_cashier1',
    cashierName: 'Fatou Koné',
    customerId: 'cust_2',
    customerName: 'M. Koffi Yao Serge',
    items: [
      { productId: 'prod_1', productName: 'Riz Parfumé Golden Harvest 5kg', barcode: '618110012345', quantity: 1, unitPrice: 5500, total: 5500 },
      { productId: 'prod_3', productName: 'Huile Végétale Raffinée 1L Dinor', barcode: '618110012347', quantity: 2, unitPrice: 1400, total: 2800 },
      { productId: 'prod_5', productName: 'Eau Minérale Naturelle Céleste 1.5L', barcode: '618110012349', quantity: 3, unitPrice: 500, total: 1500 },
    ],
    subtotal: 9800,
    discountTotal: 0,
    totalAmount: 9800,
    paymentMethod: 'cash',
    amountReceived: 10000,
    changeDue: 200,
    developerFee: 20,
    timestamp: '2026-10-28 08:42:15',
    status: 'completed',
  },
  {
    id: 'tx_102',
    ticketNumber: 'TK-261028-002',
    businessId: 'biz_cocody',
    cashierId: 'usr_cashier1',
    cashierName: 'Fatou Koné',
    items: [
      { productId: 'prod_2', productName: 'Jus Naturel Tropical Bloom 330ml', barcode: '618110012346', quantity: 2, unitPrice: 900, total: 1800 },
      { productId: 'prod_12', productName: 'Biscuits Sablés au Beurre 150g', barcode: '618110012356', quantity: 2, unitPrice: 700, total: 1400 },
    ],
    subtotal: 3200,
    discountTotal: 0,
    totalAmount: 3200,
    paymentMethod: 'mobile_money',
    amountReceived: 3200,
    changeDue: 0,
    developerFee: 20,
    timestamp: '2026-10-28 09:14:50',
    status: 'completed',
  },
  {
    id: 'tx_103',
    ticketNumber: 'TK-261028-003',
    businessId: 'biz_cocody',
    cashierId: 'usr_cashier1',
    cashierName: 'Fatou Koné',
    items: [
      { productId: 'prod_6', productName: 'Pâtes Spaghetti 500g Madina', barcode: '618110012350', quantity: 4, unitPrice: 600, total: 2400 },
      { productId: 'prod_16', productName: 'Mayonnaise Gourmande 450g', barcode: '618110012360', quantity: 1, unitPrice: 1500, total: 1500 },
      { productId: 'prod_14', productName: 'Sardines à l’Huile Végétale 125g', barcode: '618110012358', quantity: 2, unitPrice: 550, total: 1100 },
    ],
    subtotal: 5000,
    discountTotal: 0,
    totalAmount: 5000,
    paymentMethod: 'cash',
    amountReceived: 5000,
    changeDue: 0,
    developerFee: 20,
    timestamp: '2026-10-28 09:55:02',
    status: 'completed',
  },
  {
    id: 'tx_104',
    ticketNumber: 'TK-261028-004',
    businessId: 'biz_cocody',
    cashierId: 'usr_cashier1',
    cashierName: 'Fatou Koné',
    customerId: 'cust_1',
    customerName: 'Mme Kouamé Adjoua',
    items: [
      { productId: 'prod_4', productName: 'Sucre Blanc en Morceaux 1kg', barcode: '618110012348', quantity: 2, unitPrice: 1000, total: 2000 },
      { productId: 'prod_7', productName: 'Lait Concentré Sucré Bonnet Rouge 397g', barcode: '618110012351', quantity: 3, unitPrice: 850, total: 2550 },
      { productId: 'prod_13', productName: 'Café Pur Arabica Soluble 100g', barcode: '618110012357', quantity: 1, unitPrice: 2100, total: 2100 },
    ],
    subtotal: 6650,
    discountTotal: 150,
    totalAmount: 6500,
    paymentMethod: 'cash',
    amountReceived: 10000,
    changeDue: 3500,
    developerFee: 20,
    timestamp: '2026-10-28 10:20:18',
    status: 'completed',
  },
  // Yesterday's sample transactions
  {
    id: 'tx_091',
    ticketNumber: 'TK-261027-024',
    businessId: 'biz_cocody',
    cashierId: 'usr_cashier1',
    cashierName: 'Fatou Koné',
    items: [
      { productId: 'prod_1', productName: 'Riz Parfumé Golden Harvest 5kg', barcode: '618110012345', quantity: 2, unitPrice: 5500, total: 11000 },
    ],
    subtotal: 11000,
    discountTotal: 0,
    totalAmount: 11000,
    paymentMethod: 'card',
    amountReceived: 11000,
    changeDue: 0,
    developerFee: 20,
    timestamp: '2026-10-27 16:45:00',
    status: 'completed',
  },
  {
    id: 'tx_092',
    ticketNumber: 'TK-261027-025',
    businessId: 'biz_cocody',
    cashierId: 'usr_cashier2',
    cashierName: 'Moussa Diop',
    items: [
      { productId: 'prod_9', productName: 'Lessive Poudre Express OMO 1kg', barcode: '618110012353', quantity: 2, unitPrice: 1600, total: 3200 },
      { productId: 'prod_10', productName: 'Canette Soda Cola 330ml Fraîcheur', barcode: '618110012354', quantity: 4, unitPrice: 500, total: 2000 },
    ],
    subtotal: 5200,
    discountTotal: 0,
    totalAmount: 5200,
    paymentMethod: 'cash',
    amountReceived: 6000,
    changeDue: 800,
    developerFee: 20,
    timestamp: '2026-10-27 18:30:10',
    status: 'completed',
  },
];

// Seed cash session for current day
const SEED_SESSIONS: CashRegisterSession[] = [
  {
    id: 'sess_today',
    businessId: 'biz_cocody',
    cashierId: 'usr_cashier1',
    cashierName: 'Fatou Koné',
    openedAt: '2026-10-28 08:00:00',
    openingFloat: 25000, // Fond de caisse 25 000 F CFA
    expectedCash: 46300, // 25000 + cash sales
    totalSalesAmount: 24500,
    totalSalesCount: 4,
    status: 'open',
  },
];

// Seed push notifications
const SEED_NOTIFICATIONS: PushNotification[] = [
  {
    id: 'notif_1',
    targetRole: 'all',
    businessId: 'biz_cocody',
    businessName: 'Supermarché Express Cocody',
    title: 'Alerte Stock Critique',
    message: 'Le stock de "Riz Parfumé Golden Harvest 5kg" est à 4 sacs (seuil d\'alerte: 10 sacs). Réapprovisionnement requis.',
    type: 'low_stock',
    timestamp: '2026-10-28 08:43:00',
    read: false,
    priority: 'high',
  },
  {
    id: 'notif_2',
    targetRole: 'developer',
    businessId: 'biz_cocody',
    businessName: 'Supermarché Express Cocody',
    title: 'Nouveau Palier de Ventes Réalisé',
    message: 'Supermarché Express Cocody a atteint 142 ventes. Total redevance développeur accumulée : 2 840 F CFA (20 F/vente).',
    type: 'sale_milestone',
    timestamp: '2026-10-28 10:20:20',
    read: false,
    priority: 'normal',
  },
  {
    id: 'notif_3',
    targetRole: 'developer',
    businessId: 'biz_dakar',
    businessName: 'Boutique Mode Prestige Dakar',
    title: 'Fin de période d\'essai proche',
    message: 'L\'essai de "Boutique Mode Prestige Dakar" expire le 05/11/2026. Prévoir la relance pour le passage au Pack Pro.',
    type: 'subscription',
    timestamp: '2026-10-27 14:00:00',
    read: true,
    priority: 'normal',
  },
  {
    id: 'notif_4',
    targetRole: 'all',
    title: 'Synchronisation Cloud Active',
    message: 'Le système de caisse rapide et le terminal tactile sont connectés en temps réel avec le tableau de bord développeur.',
    type: 'system',
    timestamp: '2026-10-28 07:00:00',
    read: true,
    priority: 'normal',
  },
];

// Seed stock movements
const SEED_MOVEMENTS: StockMovement[] = [
  {
    id: 'mov_1',
    businessId: 'biz_cocody',
    productId: 'prod_1',
    productName: 'Riz Parfumé Golden Harvest 5kg',
    type: 'in',
    quantity: 20,
    previousStock: 5,
    newStock: 25,
    reason: 'Livraison Fournisseur - Bon BL-8821',
    userName: 'Aïcha Traoré (Gérante)',
    timestamp: '2026-10-25 10:00:00',
  },
  {
    id: 'mov_2',
    businessId: 'biz_cocody',
    productId: 'prod_1',
    productName: 'Riz Parfumé Golden Harvest 5kg',
    type: 'sale',
    quantity: -1,
    previousStock: 5,
    newStock: 4,
    reason: 'Vente Caisse TK-261028-001',
    userName: 'Fatou Koné',
    timestamp: '2026-10-28 08:42:15',
  },
];

// Helper for sound effects using Web Audio API
export const playSoundEffect = (type: 'beep' | 'cash' | 'error' | 'alert') => {
  try {
    const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === 'beep') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1200, ctx.currentTime);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.08);
    } else if (type === 'cash') {
      // Ding ding double chime
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.setValueAtTime(1760, ctx.currentTime + 0.07);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.35);
    } else if (type === 'alert') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(440, ctx.currentTime);
      osc.frequency.setValueAtTime(660, ctx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.25);
    } else if (type === 'error') {
      osc.type = 'square';
      osc.frequency.setValueAtTime(220, ctx.currentTime);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.2);
    }
  } catch {
    // AudioContext might be muted or not allowed prior to interaction
  }
};

// Store service with live BroadcastChannel & LocalStorage sync
class StoreService {
  private syncChannel: BroadcastChannel | null = null;
  private listeners: Set<() => void> = new Set();

  constructor() {
    this.initStorage();
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        this.syncChannel = new BroadcastChannel('kassapro_sync_bus');
        this.syncChannel.onmessage = (event) => {
          if (event.data?.type === 'SYNC_STATE') {
            this.notify();
          }
        };
      } catch {
        // Fallback
      }
    }
    this.initFirebase();
  }

  private initStorage() {
    if (typeof window === 'undefined') return;
    if (!localStorage.getItem(STORAGE_KEYS.BUSINESSES)) {
      localStorage.setItem(STORAGE_KEYS.BUSINESSES, JSON.stringify(SEED_BUSINESSES));
    }
    if (!localStorage.getItem(STORAGE_KEYS.USERS)) {
      localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(SEED_USERS));
    }
    if (!localStorage.getItem(STORAGE_KEYS.PRODUCTS)) {
      localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(SEED_PRODUCTS));
    }
    if (!localStorage.getItem(STORAGE_KEYS.CUSTOMERS)) {
      localStorage.setItem(STORAGE_KEYS.CUSTOMERS, JSON.stringify(SEED_CUSTOMERS));
    }
    if (!localStorage.getItem(STORAGE_KEYS.TRANSACTIONS)) {
      localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(SEED_TRANSACTIONS));
    }
    if (!localStorage.getItem(STORAGE_KEYS.SESSIONS)) {
      localStorage.setItem(STORAGE_KEYS.SESSIONS, JSON.stringify(SEED_SESSIONS));
    }
    if (!localStorage.getItem(STORAGE_KEYS.NOTIFICATIONS)) {
      localStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify(SEED_NOTIFICATIONS));
    }
    if (!localStorage.getItem(STORAGE_KEYS.MOVEMENTS)) {
      localStorage.setItem(STORAGE_KEYS.MOVEMENTS, JSON.stringify(SEED_MOVEMENTS));
    }
    if (!localStorage.getItem(STORAGE_KEYS.CURRENT_USER_ID)) {
      // Default to Cashier for POS immediate demo, can easily switch to Owner or Developer
      localStorage.setItem(STORAGE_KEYS.CURRENT_USER_ID, 'usr_cashier1');
    }
  }

  private initFirebase() {
    if (typeof window === 'undefined') return;
    try {
      seedRemoteFirestoreIfEmpty({
        businesses: this.getBusinesses(),
        users: this.getUsers(),
        products: this.getProducts(),
        customers: this.getCustomers(),
        transactions: this.getTransactions(),
        sessions: this.getSessions(),
        notifications: this.getNotifications(),
        movements: this.getStockMovements(),
      });

      setupFirestoreListeners({
        onBusinessesUpdated: (items) => {
          if (items && items.length > 0) {
            localStorage.setItem(STORAGE_KEYS.BUSINESSES, JSON.stringify(items));
            this.notify();
          }
        },
        onProductsUpdated: (items) => {
          if (items && items.length > 0) {
            localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(items));
            this.notify();
          }
        },
        onTransactionsUpdated: (items) => {
          if (items && items.length > 0) {
            localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(items));
            this.notify();
          }
        },
        onUsersUpdated: (items) => {
          if (items && items.length > 0) {
            localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(items));
            this.notify();
          }
        },
        onCustomersUpdated: (items) => {
          if (items && items.length > 0) {
            localStorage.setItem(STORAGE_KEYS.CUSTOMERS, JSON.stringify(items));
            this.notify();
          }
        },
        onSessionsUpdated: (items) => {
          if (items && items.length > 0) {
            localStorage.setItem(STORAGE_KEYS.SESSIONS, JSON.stringify(items));
            this.notify();
          }
        },
        onNotificationsUpdated: (items) => {
          if (items && items.length > 0) {
            localStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify(items));
            this.notify();
          }
        },
        onMovementsUpdated: (items) => {
          if (items && items.length > 0) {
            localStorage.setItem(STORAGE_KEYS.MOVEMENTS, JSON.stringify(items));
            this.notify();
          }
        },
      });
    } catch (e) {
      console.warn('[Firebase] Init error (offline fallback mode active):', e);
    }
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    this.listeners.forEach((fn) => fn());
  }

  private broadcast() {
    this.notify();
    if (this.syncChannel) {
      this.syncChannel.postMessage({ type: 'SYNC_STATE', timestamp: Date.now() });
    }
  }

  // --- Current User & Auth ---
  public getCurrentUser(): User {
    const users = this.getUsers();
    const id = localStorage.getItem(STORAGE_KEYS.CURRENT_USER_ID);
    return users.find((u) => u.id === id) || users[0];
  }

  public setCurrentUser(userId: string) {
    localStorage.setItem(STORAGE_KEYS.CURRENT_USER_ID, userId);
    this.broadcast();
  }

  // --- Users ---
  public getUsers(): User[] {
    const data = localStorage.getItem(STORAGE_KEYS.USERS);
    return data ? JSON.parse(data) : SEED_USERS;
  }

  public addUser(user: Omit<User, 'id' | 'createdAt' | 'lastLogin'>): User {
    const users = this.getUsers();
    const newUser: User = {
      ...user,
      id: `usr_${Date.now()}`,
      createdAt: new Date().toISOString().slice(0, 10),
      lastLogin: 'Jamais connecté',
    };
    users.push(newUser);
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
    syncDocToFirestore('users', newUser.id, newUser);
    this.broadcast();
    return newUser;
  }

  public updateUser(userId: string, updates: Partial<User>) {
    const users = this.getUsers().map((u) => (u.id === userId ? { ...u, ...updates } : u));
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
    const updated = users.find((u) => u.id === userId);
    if (updated) syncDocToFirestore('users', userId, updated);
    this.broadcast();
  }

  public resetUserPassword(userId: string, newPinOrPass: string) {
    const users = this.getUsers().map((u) => (u.id === userId ? { ...u, pinCode: newPinOrPass } : u));
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
    const updated = users.find((u) => u.id === userId);
    if (updated) syncDocToFirestore('users', userId, updated);
    this.addNotification({
      targetRole: 'developer',
      title: 'Sécurité : Mot de passe réinitialisé',
      message: `Identifiants mis à jour pour l'utilisateur ID: ${userId}`,
      type: 'security',
      priority: 'normal',
    });
    this.broadcast();
  }

  public deleteUser(userId: string) {
    const users = this.getUsers().filter((u) => u.id !== userId);
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
    deleteDocFromFirestore('users', userId);
    this.broadcast();
  }

  // --- Businesses ---
  public generateAccessCodeString(): string {
    const num = Math.floor(1000 + Math.random() * 9000);
    return `CP-${num}`;
  }

  public getBusinesses(): Business[] {
    const data = localStorage.getItem(STORAGE_KEYS.BUSINESSES);
    let list: Business[] = data ? JSON.parse(data) : SEED_BUSINESSES;
    let migrated = false;
    list = list.map((b) => {
      if (!b.accessCode) {
        migrated = true;
        const seedMatch = SEED_BUSINESSES.find((s) => s.id === b.id);
        return {
          ...b,
          accessCode: seedMatch?.accessCode || `CP-${Math.floor(1000 + Math.random() * 9000)}`,
        };
      }
      return b;
    });
    if (migrated && typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEYS.BUSINESSES, JSON.stringify(list));
    }
    return list;
  }

  public getBusiness(businessId: string): Business | undefined {
    return this.getBusinesses().find((b) => b.id === businessId);
  }

  public updateBusiness(businessId: string, updates: Partial<Business>) {
    const businesses = this.getBusinesses().map((b) => (b.id === businessId ? { ...b, ...updates } : b));
    localStorage.setItem(STORAGE_KEYS.BUSINESSES, JSON.stringify(businesses));
    const updated = businesses.find((b) => b.id === businessId);
    if (updated) syncDocToFirestore('businesses', businessId, updated);
    this.broadcast();
  }

  public generateBusinessAccessCode(businessId: string): string {
    const newCode = this.generateAccessCodeString();
    this.updateBusiness(businessId, { accessCode: newCode });
    const biz = this.getBusiness(businessId);
    this.addNotification({
      targetRole: 'developer',
      businessId,
      businessName: biz?.name,
      title: `Nouveau Code d'Accès Généré`,
      message: `Le code d'accès pour "${biz?.name || businessId}" est désormais : ${newCode}`,
      type: 'security',
      priority: 'high',
    });
    return newCode;
  }

  public getBusinessByAccessCode(rawCode: string): Business | undefined {
    if (!rawCode || !rawCode.trim()) return undefined;
    const clean = rawCode.trim().toUpperCase();
    const normalized = clean.startsWith('CP-') ? clean : `CP-${clean}`;
    const businesses = this.getBusinesses();
    return businesses.find(
      (b) =>
        b.accessCode?.toUpperCase() === clean ||
        b.accessCode?.toUpperCase() === normalized ||
        b.accessCode?.replace('CP-', '') === clean
    );
  }

  public getUsersByBusinessId(businessId: string): User[] {
    return this.getUsers().filter((u) => u.businessId === businessId && u.status === 'active');
  }

  public loginWithBusinessCodeAndPassword({
    accessCode,
    userId,
    userIdentifier,
    passwordOrPin,
  }: {
    accessCode: string;
    userId?: string;
    userIdentifier?: string;
    passwordOrPin: string;
  }): { success: boolean; business?: Business; user?: User; error?: string } {
    if (!accessCode || !accessCode.trim()) {
      return { success: false, error: 'Veuillez saisir le code d\'accès de votre commerce.' };
    }

    if (!passwordOrPin || !passwordOrPin.trim()) {
      return {
        success: false,
        error: 'Le mot de passe / code PIN fourni par le propriétaire est obligatoire pour vous connecter.',
      };
    }

    const foundBiz = this.getBusinessByAccessCode(accessCode);
    if (!foundBiz) {
      return {
        success: false,
        error: 'Code commerce invalide ou introuvable. Demandez votre code de caisse au propriétaire.',
      };
    }

    if (foundBiz.subscriptionStatus === 'suspended') {
      return {
        success: false,
        error: `La session pour le commerce "${foundBiz.name}" est suspendue. Contactez le propriétaire.`,
      };
    }

    const bizUsers = this.getUsersByBusinessId(foundBiz.id);
    if (bizUsers.length === 0) {
      return {
        success: false,
        error: `Aucun compte utilisateur actif trouvé pour le commerce "${foundBiz.name}".`,
      };
    }

    let targetUser: User | undefined;

    if (userId) {
      targetUser = bizUsers.find((u) => u.id === userId);
      if (!targetUser) {
        return { success: false, error: 'Utilisateur sélectionné introuvable dans ce commerce.' };
      }
    } else if (userIdentifier && userIdentifier.trim()) {
      const cleanIdent = userIdentifier.trim().toLowerCase();
      targetUser = bizUsers.find(
        (u) =>
          u.email.toLowerCase() === cleanIdent ||
          u.phone.replace(/\s+/g, '') === cleanIdent.replace(/\s+/g, '') ||
          u.name.toLowerCase().includes(cleanIdent)
      );
      if (!targetUser) {
        return {
          success: false,
          error: `Aucun utilisateur correspondant à "${userIdentifier}" dans ce commerce.`,
        };
      }
    } else {
      // Find matching user by PIN
      const matchingUsers = bizUsers.filter((u) => u.pinCode === passwordOrPin.trim());
      if (matchingUsers.length === 1) {
        targetUser = matchingUsers[0];
      } else if (matchingUsers.length > 1) {
        return {
          success: false,
          error: 'Plusieurs comptes partagent ce code PIN. Veuillez sélectionner votre nom dans la liste.',
        };
      } else {
        return {
          success: false,
          error: 'Mot de passe ou code PIN incorrect pour ce commerce.',
        };
      }
    }

    // Verify PIN / password
    if (targetUser.pinCode && targetUser.pinCode !== passwordOrPin.trim()) {
      return {
        success: false,
        error: 'Mot de passe ou code PIN incorrect. Vérifiez auprès du propriétaire.',
      };
    }

    // Update login timestamp & set active user
    const nowStr = new Date().toISOString().replace('T', ' ').slice(0, 16);
    this.updateUser(targetUser.id, { lastLogin: nowStr });
    this.setCurrentUser(targetUser.id);

    return {
      success: true,
      business: foundBiz,
      user: targetUser,
    };
  }

  // Deprecated direct code login kept for backward compatibility but enforced
  public loginWithAccessCode(rawCode: string): { success: boolean; business?: Business; user?: User; error?: string } {
    return this.loginWithBusinessCodeAndPassword({
      accessCode: rawCode,
      passwordOrPin: '0000', // default fallback for tests
    });
  }

  public addBusiness(biz: Omit<Business, 'id' | 'totalSalesCount' | 'developerFeeRate' | 'createdAt' | 'accessCode'> & { accessCode?: string }): Business {
    const list = this.getBusinesses();
    const newBiz: Business = {
      ...biz,
      accessCode: biz.accessCode || this.generateAccessCodeString(),
      id: `biz_${Date.now()}`,
      totalSalesCount: 0,
      developerFeeRate: 20,
      createdAt: new Date().toISOString().slice(0, 10),
    };
    list.push(newBiz);
    localStorage.setItem(STORAGE_KEYS.BUSINESSES, JSON.stringify(list));
    syncDocToFirestore('businesses', newBiz.id, newBiz);
    this.broadcast();
    return newBiz;
  }

  // --- Products ---
  public getProducts(businessId?: string): Product[] {
    const data = localStorage.getItem(STORAGE_KEYS.PRODUCTS);
    const products: Product[] = data ? JSON.parse(data) : SEED_PRODUCTS;
    if (businessId && businessId !== 'all') {
      return products.filter((p) => p.businessId === businessId);
    }
    return products;
  }

  public addProduct(product: Omit<Product, 'id'>): Product {
    const products = this.getProducts();
    const newProd: Product = {
      ...product,
      id: `prod_${Date.now()}`,
    };
    products.push(newProd);
    localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(products));
    syncDocToFirestore('products', newProd.id, newProd);

    // Log movement
    this.addStockMovement({
      businessId: newProd.businessId,
      productId: newProd.id,
      productName: newProd.name,
      type: 'in',
      quantity: newProd.stock,
      previousStock: 0,
      newStock: newProd.stock,
      reason: 'Création initiale du produit',
      userName: this.getCurrentUser().name,
    });

    this.broadcast();
    return newProd;
  }

  public updateProduct(productId: string, updates: Partial<Product>) {
    const products = this.getProducts().map((p) => (p.id === productId ? { ...p, ...updates } : p));
    localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(products));
    const updated = products.find((p) => p.id === productId);
    if (updated) syncDocToFirestore('products', productId, updated);
    this.broadcast();
  }

  public deleteProduct(productId: string) {
    const products = this.getProducts().filter((p) => p.id !== productId);
    localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(products));
    deleteDocFromFirestore('products', productId);
    this.broadcast();
  }

  public adjustStock(productId: string, delta: number, reason: string) {
    const products = this.getProducts();
    const prod = products.find((p) => p.id === productId);
    if (!prod) return;

    const previousStock = prod.stock;
    const newStock = Math.max(0, prod.stock + delta);
    prod.stock = newStock;

    localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(products));
    syncDocToFirestore('products', prod.id, prod);

    // Log movement
    this.addStockMovement({
      businessId: prod.businessId,
      productId: prod.id,
      productName: prod.name,
      type: delta >= 0 ? 'in' : 'adjustment',
      quantity: delta,
      previousStock,
      newStock,
      reason,
      userName: this.getCurrentUser().name,
    });

    // Check low stock alert
    if (newStock <= prod.minStockAlert) {
      this.addNotification({
        targetRole: 'all',
        businessId: prod.businessId,
        title: 'Alerte : Stock critique',
        message: `Le stock de "${prod.name}" a atteint ${newStock} ${prod.unit} (seuil: ${prod.minStockAlert}).`,
        type: 'low_stock',
        priority: 'high',
      });
      playSoundEffect('alert');
    }

    this.broadcast();
  }

  // --- Customers ---
  public getCustomers(businessId?: string): Customer[] {
    const data = localStorage.getItem(STORAGE_KEYS.CUSTOMERS);
    const customers: Customer[] = data ? JSON.parse(data) : SEED_CUSTOMERS;
    if (businessId && businessId !== 'all') {
      return customers.filter((c) => c.businessId === businessId);
    }
    return customers;
  }

  public addCustomer(cust: Omit<Customer, 'id' | 'totalPurchases'>): Customer {
    const list = this.getCustomers();
    const newCust: Customer = {
      ...cust,
      id: `cust_${Date.now()}`,
      totalPurchases: 0,
    };
    list.push(newCust);
    localStorage.setItem(STORAGE_KEYS.CUSTOMERS, JSON.stringify(list));
    syncDocToFirestore('customers', newCust.id, newCust);
    this.broadcast();
    return newCust;
  }

  public updateCustomer(customerId: string, updates: Partial<Customer>) {
    const list = this.getCustomers().map((c) => (c.id === customerId ? { ...c, ...updates } : c));
    localStorage.setItem(STORAGE_KEYS.CUSTOMERS, JSON.stringify(list));
    const updated = list.find((c) => c.id === customerId);
    if (updated) syncDocToFirestore('customers', customerId, updated);
    this.broadcast();
  }

  // --- Transactions & Sale Engine ---
  public getTransactions(businessId?: string): SaleTransaction[] {
    const data = localStorage.getItem(STORAGE_KEYS.TRANSACTIONS);
    const txs: SaleTransaction[] = data ? JSON.parse(data) : SEED_TRANSACTIONS;
    if (businessId && businessId !== 'all') {
      return txs.filter((t) => t.businessId === businessId);
    }
    return txs;
  }

  public completeSale(saleData: {
    businessId: string;
    cashierId: string;
    cashierName: string;
    customerId?: string;
    customerName?: string;
    customerPhone?: string;
    items: {
      productId: string;
      productName: string;
      barcode: string;
      quantity: number;
      unitPrice: number;
      total: number;
    }[];
    subtotal: number;
    discountTotal: number;
    totalAmount: number;
    paymentMethod: 'cash' | 'mobile_money' | 'card' | 'credit';
    amountReceived: number;
    changeDue: number;
  }): SaleTransaction {
    const transactions = this.getTransactions();
    const products = this.getProducts();
    const businesses = this.getBusinesses();
    const customers = this.getCustomers();

    const dateStr = new Date();
    const dateFormatted = dateStr.toISOString().slice(0, 10).replace(/-/g, '');
    const seq = String(transactions.length + 1).padStart(4, '0');
    const ticketNumber = `TK-${dateFormatted}-${seq}`;

    const newTx: SaleTransaction = {
      ...saleData,
      id: `tx_${Date.now()}`,
      ticketNumber,
      developerFee: 20, // 20 F per sale strictly
      timestamp: dateStr.toISOString().replace('T', ' ').slice(0, 19),
      status: 'completed',
    };

    transactions.unshift(newTx);
    localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(transactions));
    syncDocToFirestore('transactions', newTx.id, newTx);

    // Decrement stock in real-time
    saleData.items.forEach((item) => {
      const prod = products.find((p) => p.id === item.productId);
      if (prod) {
        const prev = prod.stock;
        prod.stock = Math.max(0, prod.stock - item.quantity);
        syncDocToFirestore('products', prod.id, prod);
        this.addStockMovement({
          businessId: saleData.businessId,
          productId: prod.id,
          productName: prod.name,
          type: 'sale',
          quantity: -item.quantity,
          previousStock: prev,
          newStock: prod.stock,
          reason: `Vente ${ticketNumber}`,
          userName: saleData.cashierName,
        });

        // Trigger low stock alert if needed
        if (prod.stock <= prod.minStockAlert) {
          this.addNotification({
            targetRole: 'all',
            businessId: saleData.businessId,
            title: 'Alerte : Stock critique après vente',
            message: `Le produit "${prod.name}" n'a plus que ${prod.stock} ${prod.unit} en rayon.`,
            type: 'low_stock',
            priority: 'high',
          });
        }
      }
    });
    localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(products));

    // Update business total sales count
    const biz = businesses.find((b) => b.id === saleData.businessId);
    if (biz) {
      biz.totalSalesCount += 1;
      localStorage.setItem(STORAGE_KEYS.BUSINESSES, JSON.stringify(businesses));
      syncDocToFirestore('businesses', biz.id, biz);

      // Push notification for milestones (every 25 sales)
      if (biz.totalSalesCount % 25 === 0) {
        this.addNotification({
          targetRole: 'owner',
          businessId: biz.id,
          businessName: biz.name,
          title: `Objectif Ventes : ${biz.totalSalesCount} ventes réalisées !`,
          message: `Félicitations ! ${biz.name} totalise désormais ${biz.totalSalesCount} transactions enregistrées avec succès.`,
          type: 'sale_milestone',
          priority: 'normal',
        });
      }
    }

    // Update customer stats / credit balance if sold on credit
    if (saleData.customerId) {
      const customer = customers.find((c) => c.id === saleData.customerId);
      if (customer) {
        customer.totalPurchases += saleData.totalAmount;
        customer.lastPurchaseDate = newTx.timestamp.slice(0, 10);
        if (saleData.paymentMethod === 'credit') {
          customer.creditBalance += saleData.totalAmount;
        }
        localStorage.setItem(STORAGE_KEYS.CUSTOMERS, JSON.stringify(customers));
        syncDocToFirestore('customers', customer.id, customer);
      }
    }

    // Update cash session if cash
    const activeSession = this.getActiveCashSession(saleData.businessId);
    if (activeSession) {
      activeSession.totalSalesAmount += saleData.totalAmount;
      activeSession.totalSalesCount += 1;
      if (saleData.paymentMethod === 'cash') {
        activeSession.expectedCash += saleData.totalAmount;
      }
      this.updateCashSession(activeSession);
    }

    playSoundEffect('cash');
    this.broadcast();
    return newTx;
  }

  // --- Cash Sessions ---
  public getSessions(businessId?: string): CashRegisterSession[] {
    const data = localStorage.getItem(STORAGE_KEYS.SESSIONS);
    const sessions: CashRegisterSession[] = data ? JSON.parse(data) : SEED_SESSIONS;
    if (businessId && businessId !== 'all') {
      return sessions.filter((s) => s.businessId === businessId);
    }
    return sessions;
  }

  public getActiveCashSession(businessId: string): CashRegisterSession | undefined {
    return this.getSessions(businessId).find((s) => s.status === 'open');
  }

  public openCashSession(businessId: string, cashierId: string, cashierName: string, openingFloat: number): CashRegisterSession {
    const sessions = this.getSessions();
    const newSession: CashRegisterSession = {
      id: `sess_${Date.now()}`,
      businessId,
      cashierId,
      cashierName,
      openedAt: new Date().toISOString().replace('T', ' ').slice(0, 19),
      openingFloat,
      expectedCash: openingFloat,
      totalSalesAmount: 0,
      totalSalesCount: 0,
      status: 'open',
    };
    sessions.unshift(newSession);
    localStorage.setItem(STORAGE_KEYS.SESSIONS, JSON.stringify(sessions));
    syncDocToFirestore('sessions', newSession.id, newSession);
    this.broadcast();
    return newSession;
  }

  public updateCashSession(session: CashRegisterSession) {
    const sessions = this.getSessions().map((s) => (s.id === session.id ? session : s));
    localStorage.setItem(STORAGE_KEYS.SESSIONS, JSON.stringify(sessions));
    syncDocToFirestore('sessions', session.id, session);
    this.broadcast();
  }

  public closeCashSession(sessionId: string, actualCash: number, notes?: string): CashRegisterSession | undefined {
    const sessions = this.getSessions();
    const sess = sessions.find((s) => s.id === sessionId);
    if (!sess) return undefined;

    sess.closedAt = new Date().toISOString().replace('T', ' ').slice(0, 19);
    sess.actualCash = actualCash;
    sess.cashDifference = actualCash - sess.expectedCash;
    sess.status = 'closed';
    sess.notes = notes;

    localStorage.setItem(STORAGE_KEYS.SESSIONS, JSON.stringify(sessions));
    syncDocToFirestore('sessions', sess.id, sess);
    this.broadcast();
    return sess;
  }

  // --- Push Notifications ---
  public getNotifications(role?: UserRole, businessId?: string): PushNotification[] {
    const data = localStorage.getItem(STORAGE_KEYS.NOTIFICATIONS);
    const notifs: PushNotification[] = data ? JSON.parse(data) : SEED_NOTIFICATIONS;

    return notifs.filter((n) => {
      // Strict confidentiality: Non-developer users (cashier, manager, owner) must NEVER see developer-only notifications
      if (role !== 'developer' && (n.targetRole === 'developer' || n.type === 'subscription' || n.title?.toLowerCase().includes('développeur') || n.message?.toLowerCase().includes('redevance'))) {
        return false;
      }
      if (role && n.targetRole !== 'all' && n.targetRole !== role) {
        return false;
      }
      if (businessId && businessId !== 'all' && n.businessId && n.businessId !== businessId) {
        return false;
      }
      return true;
    });
  }

  public addNotification(notif: Omit<PushNotification, 'id' | 'timestamp' | 'read'>) {
    const notifs: PushNotification[] = this.getNotifications();
    const newNotif: PushNotification = {
      ...notif,
      id: `notif_${Date.now()}`,
      timestamp: new Date().toISOString().replace('T', ' ').slice(0, 19),
      read: false,
    };
    notifs.unshift(newNotif);
    localStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify(notifs));
    syncDocToFirestore('notifications', newNotif.id, newNotif);
    this.broadcast();
  }

  public markNotificationAsRead(notifId: string) {
    const notifs: PushNotification[] = this.getNotifications().map((n) =>
      n.id === notifId ? { ...n, read: true } : n
    );
    localStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify(notifs));
    const target = notifs.find((n) => n.id === notifId);
    if (target) syncDocToFirestore('notifications', notifId, target);
    this.broadcast();
  }

  public markAllNotificationsAsRead() {
    const notifs: PushNotification[] = this.getNotifications().map((n) => ({ ...n, read: true }));
    localStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify(notifs));
    notifs.forEach((n) => syncDocToFirestore('notifications', n.id, n));
    this.broadcast();
  }

  // --- Stock Movements ---
  public getStockMovements(businessId?: string): StockMovement[] {
    const data = localStorage.getItem(STORAGE_KEYS.MOVEMENTS);
    const movs: StockMovement[] = data ? JSON.parse(data) : SEED_MOVEMENTS;
    if (businessId && businessId !== 'all') {
      return movs.filter((m) => m.businessId === businessId);
    }
    return movs;
  }

  private addStockMovement(mov: Omit<StockMovement, 'id' | 'timestamp'>) {
    const movs = this.getStockMovements();
    const newMov: StockMovement = {
      ...mov,
      id: `mov_${Date.now()}`,
      timestamp: new Date().toISOString().replace('T', ' ').slice(0, 19),
    };
    movs.unshift(newMov);
    localStorage.setItem(STORAGE_KEYS.MOVEMENTS, JSON.stringify(movs));
    syncDocToFirestore('movements', newMov.id, newMov);
  }

  // Reset database to initial seed
  public resetToFactory() {
    localStorage.clear();
    this.initStorage();
    this.broadcast();
  }
}

export const store = new StoreService();
