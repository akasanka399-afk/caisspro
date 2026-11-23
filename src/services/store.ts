import {
  Business,
  CashRegisterSession,
  CashDenominations,
  CreditSettlement,
  Customer,
  Product,
  PushNotification,
  SaleTransaction,
  StockMovement,
  SubscriptionPlan,
  SubscriptionStatus,
  User,
  UserRole,
} from '../types';
import {
  syncDocToFirestore,
  deleteDocFromFirestore,
  deleteBusinessCascadeFromFirestore,
  setupFirestoreListeners,
  seedOrReconcileFirestore,
  lookupBusinessAndStaffByAccessCode,
  setCloudConnectionStatus,
  flushPendingPosSyncQueue,
  getPendingDocIds,
  getPendingDeletedIds,
  getLocallyDeletedDocIds,
  purgePendingSyncForBusiness,
  clearPosSyncTrackingStorage,
  CollectionSyncPayload,
} from './firebaseSync';
import { testConnection } from '../firebase/config';
import { flushOfflineQueue } from '../digisolia/services/offlineQueue';

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
  DELETED_BUSINESSES: 'kassapro_deleted_businesses',
  PRODUCTS: 'kassapro_products',
  CUSTOMERS: 'kassapro_customers',
  TRANSACTIONS: 'kassapro_transactions',
  SESSIONS: 'kassapro_sessions',
  NOTIFICATIONS: 'kassapro_notifications',
  MOVEMENTS: 'kassapro_movements',
  CURRENT_USER_ID: 'kassapro_current_user_id',
  CREDIT_SETTLEMENTS: 'kassapro_credit_settlements',
};

const DEVELOPER_DISPLAY_NAME = 'Eric SANKARA (Développeur)';
const SEED_BUSINESS_IDS = ['biz_cocody', 'biz_pharmacie', 'biz_dakar', 'biz_quincaillerie', 'biz_telecom'];

let idSequence = 0;
function makeId(prefix: string): string {
  idSequence += 1;
  return `${prefix}_${Date.now()}_${idSequence}_${Math.random().toString(36).slice(2, 6)}`;
}

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
    name: DEVELOPER_DISPLAY_NAME,
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
  // Pharmacie Centrale (CP-5120)
  {
    id: 'usr_owner_pharmacie',
    name: 'Dr. Cissé Aminata (Propriétaire)',
    email: 'aminata@pharmaciecentrale.com',
    phone: '+225 05 12 34 56 78',
    role: 'owner',
    businessId: 'biz_pharmacie',
    pinCode: '1234',
    status: 'active',
    createdAt: '2026-02-01',
    lastLogin: '2026-10-28 08:15',
  },
  {
    id: 'usr_cashier_pharmacie',
    name: 'Kadiatou Koné (Caissière)',
    email: 'caisse@pharmaciecentrale.com',
    phone: '+225 05 12 34 56 79',
    role: 'cashier',
    businessId: 'biz_pharmacie',
    pinCode: '0000',
    status: 'active',
    createdAt: '2026-02-01',
    lastLogin: '2026-10-28 08:00',
  },
  // Boutique Mode Prestige Dakar (CP-7419)
  {
    id: 'usr_owner_dakar',
    name: 'Cheikh Ndiaye (Propriétaire)',
    email: 'cheikh@modedakar.sn',
    phone: '+221 77 654 32 10',
    role: 'owner',
    businessId: 'biz_dakar',
    pinCode: '1234',
    status: 'active',
    createdAt: '2026-03-01',
    lastLogin: '2026-10-28 09:00',
  },
  {
    id: 'usr_cashier_dakar',
    name: 'Awa Diouf (Caissière)',
    email: 'caisse@modedakar.sn',
    phone: '+221 77 654 32 11',
    role: 'cashier',
    businessId: 'biz_dakar',
    pinCode: '0000',
    status: 'active',
    createdAt: '2026-03-01',
    lastLogin: '2026-10-28 09:00',
  },
  // Quincaillerie Pro (CP-3391)
  {
    id: 'usr_owner_quinc',
    name: 'Kouassi Konan (Propriétaire)',
    email: 'kouassi@quincailleriepro.ci',
    phone: '+225 01 23 45 67 89',
    role: 'owner',
    businessId: 'biz_quincaillerie',
    pinCode: '1234',
    status: 'active',
    createdAt: '2026-02-14',
    lastLogin: '2026-10-28 08:30',
  },
  {
    id: 'usr_cashier_quinc',
    name: 'Yao Serge (Caissier)',
    email: 'caisse@quincailleriepro.ci',
    phone: '+225 01 23 45 67 90',
    role: 'cashier',
    businessId: 'biz_quincaillerie',
    pinCode: '0000',
    status: 'active',
    createdAt: '2026-02-14',
    lastLogin: '2026-10-28 08:30',
  },
  // Boutique Télécom (CP-6610)
  {
    id: 'usr_owner_telecom',
    name: 'Moussa Bakayoko (Propriétaire)',
    email: 'moussa@boutiquetelecom.ci',
    phone: '+225 07 88 99 00 11',
    role: 'owner',
    businessId: 'biz_telecom',
    pinCode: '1234',
    status: 'active',
    createdAt: '2026-01-15',
    lastLogin: '2026-10-28 09:10',
  },
  {
    id: 'usr_cashier_telecom',
    name: 'Mariam Bamba (Caissière)',
    email: 'caisse@boutiquetelecom.ci',
    phone: '+225 07 88 99 00 12',
    role: 'cashier',
    businessId: 'biz_telecom',
    pinCode: '0000',
    status: 'active',
    createdAt: '2026-01-15',
    lastLogin: '2026-10-28 09:10',
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
  // Monday (Lundi 26 Octobre 2026)
  {
    id: 'tx_080',
    ticketNumber: 'TK-261026-001',
    businessId: 'biz_cocody',
    cashierId: 'usr_cashier1',
    cashierName: 'Fatou Koné',
    items: [
      { productId: 'prod_1', productName: 'Riz Parfumé Golden Harvest 5kg', barcode: '618110012345', quantity: 2, unitPrice: 5500, total: 11000 },
      { productId: 'prod_4', productName: 'Sucre Blanc en Morceaux 1kg', barcode: '618110012348', quantity: 3, unitPrice: 1000, total: 3000 },
      { productId: 'prod_7', productName: 'Lait Concentré Sucré Bonnet Rouge 397g', barcode: '618110012351', quantity: 5, unitPrice: 850, total: 4250 },
    ],
    subtotal: 18250,
    discountTotal: 0,
    totalAmount: 18250,
    paymentMethod: 'cash',
    amountReceived: 20000,
    changeDue: 1750,
    developerFee: 20,
    timestamp: '2026-10-26 11:15:30',
    status: 'completed',
  },
  {
    id: 'tx_081',
    ticketNumber: 'TK-261026-002',
    businessId: 'biz_cocody',
    cashierId: 'usr_cashier2',
    cashierName: 'Moussa Diop',
    customerId: 'cust_3',
    customerName: 'Dr. Bamba Seydou',
    items: [
      { productId: 'prod_3', productName: 'Huile Végétale Raffinée 1L Dinor', barcode: '618110012347', quantity: 4, unitPrice: 1400, total: 5600 },
      { productId: 'prod_5', productName: 'Eau Minérale Naturelle Céleste 1.5L', barcode: '618110012349', quantity: 6, unitPrice: 500, total: 3000 },
    ],
    subtotal: 8600,
    discountTotal: 0,
    totalAmount: 8600,
    paymentMethod: 'mobile_money',
    amountReceived: 8600,
    changeDue: 0,
    developerFee: 20,
    timestamp: '2026-10-26 15:40:10',
    status: 'completed',
  },
  // Yesterday's sample transactions (Mardi 27 Octobre 2026)
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
  // Thursday (Jeudi 29 Octobre 2026)
  {
    id: 'tx_110',
    ticketNumber: 'TK-261029-001',
    businessId: 'biz_cocody',
    cashierId: 'usr_cashier1',
    cashierName: 'Fatou Koné',
    items: [
      { productId: 'prod_2', productName: 'Jus Naturel Tropical Bloom 330ml', barcode: '618110012346', quantity: 6, unitPrice: 900, total: 5400 },
      { productId: 'prod_15', productName: 'Chips de Banane Plantain 80g', barcode: '618110012359', quantity: 8, unitPrice: 400, total: 3200 },
      { productId: 'prod_12', productName: 'Biscuits Sablés au Beurre 150g', barcode: '618110012356', quantity: 5, unitPrice: 700, total: 3500 },
    ],
    subtotal: 12100,
    discountTotal: 0,
    totalAmount: 12100,
    paymentMethod: 'mobile_money',
    amountReceived: 12100,
    changeDue: 0,
    developerFee: 20,
    timestamp: '2026-10-29 11:22:15',
    status: 'completed',
  },
  {
    id: 'tx_111',
    ticketNumber: 'TK-261029-002',
    businessId: 'biz_cocody',
    cashierId: 'usr_cashier2',
    cashierName: 'Moussa Diop',
    customerId: 'cust_1',
    customerName: 'Mme Kouamé Adjoua',
    items: [
      { productId: 'prod_1', productName: 'Riz Parfumé Golden Harvest 5kg', barcode: '618110012345', quantity: 1, unitPrice: 5500, total: 5500 },
      { productId: 'prod_3', productName: 'Huile Végétale Raffinée 1L Dinor', barcode: '618110012347', quantity: 3, unitPrice: 1400, total: 4200 },
    ],
    subtotal: 9700,
    discountTotal: 0,
    totalAmount: 9700,
    paymentMethod: 'credit',
    amountReceived: 0,
    changeDue: 0,
    developerFee: 20,
    timestamp: '2026-10-29 16:10:45',
    status: 'completed',
  },
  // Friday (Vendredi 30 Octobre 2026)
  {
    id: 'tx_120',
    ticketNumber: 'TK-261030-001',
    businessId: 'biz_cocody',
    cashierId: 'usr_cashier1',
    cashierName: 'Fatou Koné',
    items: [
      { productId: 'prod_1', productName: 'Riz Parfumé Golden Harvest 5kg', barcode: '618110012345', quantity: 3, unitPrice: 5500, total: 16500 },
      { productId: 'prod_13', productName: 'Café Pur Arabica Soluble 100g', barcode: '618110012357', quantity: 3, unitPrice: 2100, total: 6300 },
      { productId: 'prod_16', productName: 'Mayonnaise Gourmande 450g', barcode: '618110012360', quantity: 4, unitPrice: 1500, total: 6000 },
    ],
    subtotal: 28800,
    discountTotal: 800,
    totalAmount: 28000,
    paymentMethod: 'cash',
    amountReceived: 30000,
    changeDue: 2000,
    developerFee: 20,
    timestamp: '2026-10-30 14:15:20',
    status: 'completed',
  },
  {
    id: 'tx_121',
    ticketNumber: 'TK-261030-002',
    businessId: 'biz_cocody',
    cashierId: 'usr_cashier2',
    cashierName: 'Moussa Diop',
    items: [
      { productId: 'prod_6', productName: 'Pâtes Spaghetti 500g Madina', barcode: '618110012350', quantity: 10, unitPrice: 600, total: 6000 },
      { productId: 'prod_14', productName: 'Sardines à l’Huile Végétale 125g', barcode: '618110012358', quantity: 8, unitPrice: 550, total: 4400 },
    ],
    subtotal: 10400,
    discountTotal: 0,
    totalAmount: 10400,
    paymentMethod: 'mobile_money',
    amountReceived: 10400,
    changeDue: 0,
    developerFee: 20,
    timestamp: '2026-10-30 18:40:10',
    status: 'completed',
  },
  // Saturday (Samedi 31 Octobre 2026 - Peak Day)
  {
    id: 'tx_130',
    ticketNumber: 'TK-261031-001',
    businessId: 'biz_cocody',
    cashierId: 'usr_cashier1',
    cashierName: 'Fatou Koné',
    items: [
      { productId: 'prod_1', productName: 'Riz Parfumé Golden Harvest 5kg', barcode: '618110012345', quantity: 4, unitPrice: 5500, total: 22000 },
      { productId: 'prod_3', productName: 'Huile Végétale Raffinée 1L Dinor', barcode: '618110012347', quantity: 5, unitPrice: 1400, total: 7000 },
      { productId: 'prod_4', productName: 'Sucre Blanc en Morceaux 1kg', barcode: '618110012348', quantity: 5, unitPrice: 1000, total: 5000 },
    ],
    subtotal: 34000,
    discountTotal: 1000,
    totalAmount: 33000,
    paymentMethod: 'card',
    amountReceived: 33000,
    changeDue: 0,
    developerFee: 20,
    timestamp: '2026-10-31 11:30:00',
    status: 'completed',
  },
  {
    id: 'tx_131',
    ticketNumber: 'TK-261031-002',
    businessId: 'biz_cocody',
    cashierId: 'usr_cashier2',
    cashierName: 'Moussa Diop',
    items: [
      { productId: 'prod_10', productName: 'Canette Soda Cola 330ml Fraîcheur', barcode: '618110012354', quantity: 12, unitPrice: 500, total: 6000 },
      { productId: 'prod_2', productName: 'Jus Naturel Tropical Bloom 330ml', barcode: '618110012346', quantity: 10, unitPrice: 900, total: 9000 },
      { productId: 'prod_15', productName: 'Chips de Banane Plantain 80g', barcode: '618110012359', quantity: 15, unitPrice: 400, total: 6000 },
    ],
    subtotal: 21000,
    discountTotal: 0,
    totalAmount: 21000,
    paymentMethod: 'cash',
    amountReceived: 25000,
    changeDue: 4000,
    developerFee: 20,
    timestamp: '2026-10-31 17:50:35',
    status: 'completed',
  },
  // Sunday (Dimanche 01 Novembre 2026)
  {
    id: 'tx_140',
    ticketNumber: 'TK-261101-001',
    businessId: 'biz_cocody',
    cashierId: 'usr_cashier1',
    cashierName: 'Fatou Koné',
    items: [
      { productId: 'prod_1', productName: 'Riz Parfumé Golden Harvest 5kg', barcode: '618110012345', quantity: 2, unitPrice: 5500, total: 11000 },
      { productId: 'prod_7', productName: 'Lait Concentré Sucré Bonnet Rouge 397g', barcode: '618110012351', quantity: 4, unitPrice: 850, total: 3400 },
      { productId: 'prod_5', productName: 'Eau Minérale Naturelle Céleste 1.5L', barcode: '618110012349', quantity: 8, unitPrice: 500, total: 4000 },
    ],
    subtotal: 18400,
    discountTotal: 400,
    totalAmount: 18000,
    paymentMethod: 'mobile_money',
    amountReceived: 18000,
    changeDue: 0,
    developerFee: 20,
    timestamp: '2026-11-01 10:15:00',
    status: 'completed',
  },
  {
    id: 'tx_141',
    ticketNumber: 'TK-261101-002',
    businessId: 'biz_cocody',
    cashierId: 'usr_cashier2',
    cashierName: 'Moussa Diop',
    items: [
      { productId: 'prod_12', productName: 'Biscuits Sablés au Beurre 150g', barcode: '618110012356', quantity: 6, unitPrice: 700, total: 4200 },
      { productId: 'prod_2', productName: 'Jus Naturel Tropical Bloom 330ml', barcode: '618110012346', quantity: 4, unitPrice: 900, total: 3600 },
      { productId: 'prod_9', productName: 'Lessive Poudre Express OMO 1kg', barcode: '618110012353', quantity: 2, unitPrice: 1600, total: 3200 },
    ],
    subtotal: 11000,
    discountTotal: 0,
    totalAmount: 11000,
    paymentMethod: 'cash',
    amountReceived: 15000,
    changeDue: 4000,
    developerFee: 20,
    timestamp: '2026-11-01 16:30:22',
    status: 'completed',
  },
];

// Seed cash session for current day and historical closed Z-session
const SEED_SESSIONS: CashRegisterSession[] = [
  {
    id: 'sess_yesterday',
    zNumber: 'Z-20261027-001',
    businessId: 'biz_cocody',
    cashierId: 'usr_cashier1',
    cashierName: 'Fatou Koné',
    openedAt: '2026-10-27 08:00:00',
    closedAt: '2026-10-27 19:30:00',
    openingFloat: 25000,
    expectedCash: 30200,
    actualCash: 30200,
    cashDifference: 0,
    totalSalesAmount: 16200,
    totalSalesCount: 2,
    status: 'closed',
    cashSales: 5200,
    mobileMoneySales: 0,
    cardSales: 11000,
    creditSales: 0,
    discountsTotal: 0,
    creditSettlementsCash: 0,
    notes: 'Clôture de journée normale sans écart. Caisse parfaitement équilibrée.',
  },
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
    cashSales: 21300,
    mobileMoneySales: 3200,
    cardSales: 0,
    creditSales: 0,
    discountsTotal: 150,
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

// Store service with live BroadcastChannel & LocalStorage + Cloud Firestore sync
class StoreService {
  private syncChannel: BroadcastChannel | null = null;
  private listeners: Set<() => void> = new Set();
  private firebaseUnsubscribe: (() => void) | null = null;
  private firebaseInitialized = false;
  private firebaseInitializing = false;
  private onlineReconnectBound = false;

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
    this.bindOnlineReconnect();
    this.initFirebase();
  }

  private bindOnlineReconnect() {
    if (typeof window === 'undefined' || this.onlineReconnectBound) return;
    this.onlineReconnectBound = true;
    window.addEventListener('online', () => {
      this.syncNow().catch(() => {
        // Resilient offline fallback
      });
    });
  }

  private initStorage() {
    if (typeof window === 'undefined') return;
    if (!localStorage.getItem(STORAGE_KEYS.BUSINESSES)) {
      localStorage.setItem(STORAGE_KEYS.BUSINESSES, JSON.stringify(SEED_BUSINESSES));
    }
    if (!localStorage.getItem(STORAGE_KEYS.USERS)) {
      localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(SEED_USERS));
    } else {
      try {
        const existingUsers: User[] = JSON.parse(localStorage.getItem(STORAGE_KEYS.USERS) || '[]');
        const deletedBizIds = new Set(this.getDeletedBusinessIds());
        const existingIds = new Set(existingUsers.map((u) => u.id));
        const missingSeedUsers = SEED_USERS.filter(
          (su) => !existingIds.has(su.id) && !deletedBizIds.has(su.businessId)
        );
        const { list: normalizedUsers, changed } = this.normalizeUsersList([
          ...existingUsers,
          ...missingSeedUsers,
        ]);
        if (missingSeedUsers.length > 0 || changed) {
          localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(normalizedUsers));
        }
      } catch {
        localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(SEED_USERS));
      }
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
    if (!localStorage.getItem(STORAGE_KEYS.CREDIT_SETTLEMENTS)) {
      localStorage.setItem(STORAGE_KEYS.CREDIT_SETTLEMENTS, JSON.stringify([]));
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
      localStorage.setItem(STORAGE_KEYS.CURRENT_USER_ID, 'usr_cashier1');
    }
  }

  private normalizeUsersList(users: User[]): { list: User[]; changed: boolean; migratedDev?: User } {
    let changed = false;
    let migratedDev: User | undefined;
    const list = users.map((u) => {
      if (u.id === 'usr_dev' && u.name !== DEVELOPER_DISPLAY_NAME) {
        changed = true;
        migratedDev = { ...u, name: DEVELOPER_DISPLAY_NAME };
        return migratedDev;
      }
      return u;
    });
    return { list, changed, migratedDev };
  }

  private getDeletedBusinessIds(): string[] {
    if (typeof window === 'undefined') return [];
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.DELETED_BUSINESSES);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  private markBusinessDeletedLocally(businessId: string) {
    if (typeof window === 'undefined') return;
    const existing = this.getDeletedBusinessIds();
    if (!existing.includes(businessId)) {
      const next = [...existing, businessId].slice(-200);
      localStorage.setItem(STORAGE_KEYS.DELETED_BUSINESSES, JSON.stringify(next));
    }
  }

  private mergeRemoteItemsById<T extends { id: string }>(localItems: T[], remoteItems: T[]): T[] {
    const map = new Map<string, T>();
    localItems.forEach((item) => {
      if (item && item.id) map.set(item.id, item);
    });
    remoteItems.forEach((item) => {
      if (item && item.id) map.set(item.id, item);
    });
    return Array.from(map.values());
  }

  /**
   * Non-destructive collection reconciliation:
   * - Preserves local mutations currently pending in the POS outbox queue
   * - Respects local deletion tombstones & removed business IDs
   * - Propagates live remote deletions from Firestore docChanges()
   */
  private reconcileCollection<T extends { id: string; businessId?: string }>(
    collectionName: string,
    localItems: T[],
    payload: CollectionSyncPayload<T>,
    options?: { allowDevWithoutBusiness?: boolean; allowNoBusinessId?: boolean }
  ): T[] {
    const deletedBizIds = new Set(this.getDeletedBusinessIds());
    const locallyDeletedIds = getLocallyDeletedDocIds(collectionName);
    const pendingUpsertIds = getPendingDocIds(collectionName);
    const pendingDeleteIds = getPendingDeletedIds(collectionName);
    const removedSet = new Set(payload.removedIds || []);

    const map = new Map<string, T>();

    localItems.forEach((item) => {
      if (!item?.id) return;
      if (removedSet.has(item.id) && !pendingUpsertIds.has(item.id)) return;
      if (pendingDeleteIds.has(item.id) || locallyDeletedIds.has(item.id)) return;
      if (
        item.businessId &&
        deletedBizIds.has(item.businessId) &&
        !(options?.allowDevWithoutBusiness && item.id === 'usr_dev')
      ) {
        return;
      }
      map.set(item.id, item);
    });

    payload.docs.forEach((remoteItem) => {
      if (!remoteItem?.id) return;
      if (pendingDeleteIds.has(remoteItem.id) || locallyDeletedIds.has(remoteItem.id)) return;
      if (
        remoteItem.businessId &&
        deletedBizIds.has(remoteItem.businessId) &&
        !(options?.allowDevWithoutBusiness && remoteItem.id === 'usr_dev')
      ) {
        return;
      }
      if (!options?.allowNoBusinessId && collectionName === 'businesses' && deletedBizIds.has(remoteItem.id)) {
        return;
      }
      // Do not overwrite unsent local mutations waiting in the outbox
      if (pendingUpsertIds.has(remoteItem.id) && map.has(remoteItem.id)) {
        return;
      }
      map.set(remoteItem.id, remoteItem);
    });

    return Array.from(map.values());
  }

  private async runSeedOrReconcile() {
    return seedOrReconcileFirestore({
      businesses: this.getBusinesses(),
      users: this.getUsers(),
      products: this.getProducts(),
      customers: this.getCustomers(),
      transactions: this.getTransactions(),
      creditSettlements: this.getCreditSettlements(),
      sessions: this.getSessions(),
      notifications: this.getAllNotificationsRaw(),
      movements: this.getStockMovements(),
      deletedBusinessIds: this.getDeletedBusinessIds(),
      seedBusinessIds: SEED_BUSINESS_IDS,
    });
  }

  private attachListeners() {
    if (this.firebaseUnsubscribe) {
      this.firebaseUnsubscribe();
      this.firebaseUnsubscribe = null;
    }

    this.firebaseUnsubscribe = setupFirestoreListeners({
      onBusinessesUpdated: (payload) => {
        const deletedIds = new Set(this.getDeletedBusinessIds());
        const remoteIds = new Set(payload.docs.map((b) => b.id));
        const pendingBizUpserts = getPendingDocIds('businesses');

        let reconciled = this.reconcileCollection<Business>(
          'businesses',
          this.getBusinesses(),
          payload,
          { allowNoBusinessId: true }
        ).filter((b) => !deletedIds.has(b.id));

        // If authoritative live server snapshot omits a seeded business, remove it locally
        if (!payload.fromCache && payload.docs.length > 0) {
          const seedSet = new Set(SEED_BUSINESS_IDS);
          const staleSeedIds = reconciled
            .filter((b) => seedSet.has(b.id) && !remoteIds.has(b.id) && !pendingBizUpserts.has(b.id))
            .map((b) => b.id);
          if (staleSeedIds.length > 0) {
            staleSeedIds.forEach((id) => this.removeBusinessLocally(id));
            reconciled = reconciled.filter((b) => !staleSeedIds.includes(b.id));
          }
        }

        localStorage.setItem(STORAGE_KEYS.BUSINESSES, JSON.stringify(reconciled));
        this.notify();
      },
      onBusinessRemoved: (removedBizId) => {
        this.removeBusinessLocally(removedBizId);
      },
      onProductsUpdated: (payload) => {
        const merged = this.reconcileCollection<Product>('products', this.getProducts(), payload);
        localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(merged));
        this.notify();
      },
      onTransactionsUpdated: (payload) => {
        const merged = this.reconcileCollection<SaleTransaction>(
          'transactions',
          this.getTransactions(),
          payload
        );
        merged.sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''));
        localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(merged));
        this.notify();
      },
      onCreditSettlementsUpdated: (payload) => {
        const merged = this.reconcileCollection<CreditSettlement>(
          'credit_settlements',
          this.getCreditSettlements(),
          payload
        );
        merged.sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''));
        localStorage.setItem(STORAGE_KEYS.CREDIT_SETTLEMENTS, JSON.stringify(merged));
        this.notify();
      },
      onUsersUpdated: (payload) => {
        const merged = this.reconcileCollection<User>('users', this.getUsers(), payload, {
          allowDevWithoutBusiness: true,
        });
        const { list: normalized, changed, migratedDev } = this.normalizeUsersList(merged);
        localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(normalized));
        if (changed && migratedDev) {
          syncDocToFirestore('users', migratedDev.id, migratedDev);
        }
        this.notify();
      },
      onCustomersUpdated: (payload) => {
        const merged = this.reconcileCollection<Customer>(
          'customers',
          this.getCustomers(),
          payload
        );
        localStorage.setItem(STORAGE_KEYS.CUSTOMERS, JSON.stringify(merged));
        this.notify();
      },
      onSessionsUpdated: (payload) => {
        const merged = this.reconcileCollection<CashRegisterSession>(
          'sessions',
          this.getSessions(),
          payload
        );
        merged.sort((a, b) => (b.openedAt || '').localeCompare(a.openedAt || ''));
        localStorage.setItem(STORAGE_KEYS.SESSIONS, JSON.stringify(merged));
        this.notify();
      },
      onNotificationsUpdated: (payload) => {
        const merged = this.reconcileCollection<PushNotification>(
          'notifications',
          this.getAllNotificationsRaw(),
          payload,
          { allowNoBusinessId: true }
        );
        merged.sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''));
        localStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify(merged));
        this.notify();
      },
      onMovementsUpdated: (payload) => {
        const merged = this.reconcileCollection<StockMovement>(
          'movements',
          this.getStockMovements(),
          payload
        );
        merged.sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''));
        localStorage.setItem(STORAGE_KEYS.MOVEMENTS, JSON.stringify(merged));
        this.notify();
      },
    });
  }

  private async initFirebase() {
    if (typeof window === 'undefined') return;
    if (this.firebaseInitialized || this.firebaseInitializing) return;
    this.firebaseInitializing = true;

    try {
      const connected = await testConnection();
      if (!connected) {
        setCloudConnectionStatus(
          typeof navigator !== 'undefined' ? navigator.onLine : false,
          false
        );
        return;
      }

      this.firebaseInitialized = true;
      setCloudConnectionStatus(true, true);

      // First push any pending offline mutations queued earlier, then seed or reconcile deltas
      await flushPendingPosSyncQueue();
      await this.runSeedOrReconcile();
      this.attachListeners();
    } catch (e) {
      console.warn('[Firebase] Init error (offline fallback mode active):', e);
    } finally {
      this.firebaseInitializing = false;
    }
  }

  /**
   * Unified manual & automatic bidirectional synchronization across POS + DAF queues.
   */
  public async syncNow(): Promise<{
    ok: boolean;
    syncedPosOps: number;
    pendingPosOps: number;
    dafSynced: number;
    error?: string;
  }> {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setCloudConnectionStatus(false, false);
      return {
        ok: false,
        syncedPosOps: 0,
        pendingPosOps: 0,
        dafSynced: 0,
        error: 'Appareil hors connexion. Les modifications sont conservées localement.',
      };
    }

    const connected = await testConnection();
    setCloudConnectionStatus(true, connected);
    if (!connected) {
      return {
        ok: false,
        syncedPosOps: 0,
        pendingPosOps: 0,
        dafSynced: 0,
        error: 'Serveur Firebase temporairement inaccessible.',
      };
    }

    const flushRes = await flushPendingPosSyncQueue();

    if (!this.firebaseInitialized) {
      this.firebaseInitialized = true;
      await this.runSeedOrReconcile();
      this.attachListeners();
    } else {
      await this.runSeedOrReconcile();
    }

    const dafRes = await flushOfflineQueue();
    this.broadcast();

    return {
      ok: flushRes.failedCount === 0,
      syncedPosOps: flushRes.syncedCount,
      pendingPosOps: flushRes.remainingCount,
      dafSynced: dafRes.syncedCount,
      error: flushRes.lastError || dafRes.lastError,
    };
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
    const raw: User[] = data ? JSON.parse(data) : SEED_USERS;
    const { list, changed } = this.normalizeUsersList(raw);
    if (changed && typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(list));
    }
    return list;
  }

  public addUser(user: Omit<User, 'id' | 'createdAt' | 'lastLogin'>): User {
    const users = this.getUsers();
    const newUser: User = {
      ...user,
      name: (user.name || 'Utilisateur').trim().slice(0, 120),
      id: makeId('usr'),
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

  public generateOwnerPinString(): string {
    const pin = Math.floor(1000 + Math.random() * 9000).toString();
    return pin;
  }

  public getBusinessCredentials(businessId: string): {
    business?: Business;
    owner?: User;
    cashiers: User[];
  } {
    const biz = this.getBusiness(businessId);
    const users = this.getUsersByBusinessId(businessId);
    const owner = users.find((u) => u.role === 'owner');
    const cashiers = users.filter((u) => u.role === 'cashier');
    return {
      business: biz,
      owner,
      cashiers,
    };
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

  public getBusinessDeletionStats(businessId: string): {
    users: number;
    products: number;
    customers: number;
    transactions: number;
    sessions: number;
  } {
    return {
      users: this.getUsers().filter((u) => u.businessId === businessId && u.id !== 'usr_dev').length,
      products: this.getProducts(businessId).length,
      customers: this.getCustomers(businessId).length,
      transactions: this.getTransactions(businessId).length,
      sessions: this.getSessions(businessId).length,
    };
  }

  private removeBusinessLocally(businessId: string): {
    removed: boolean;
    businessName?: string;
    stats: { users: number; products: number; customers: number; transactions: number; sessions: number };
  } {
    const businesses = this.getBusinesses();
    const target = businesses.find((b) => b.id === businessId);
    const stats = this.getBusinessDeletionStats(businessId);

    this.markBusinessDeletedLocally(businessId);
    purgePendingSyncForBusiness(businessId);

    const remainingBusinesses = businesses.filter((b) => b.id !== businessId);
    localStorage.setItem(STORAGE_KEYS.BUSINESSES, JSON.stringify(remainingBusinesses));

    const remainingUsers = this.getUsers().filter(
      (u) => u.id === 'usr_dev' || u.role === 'developer' || u.businessId !== businessId
    );
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(remainingUsers));

    localStorage.setItem(
      STORAGE_KEYS.PRODUCTS,
      JSON.stringify(this.getProducts().filter((p) => p.businessId !== businessId))
    );
    localStorage.setItem(
      STORAGE_KEYS.CUSTOMERS,
      JSON.stringify(this.getCustomers().filter((c) => c.businessId !== businessId))
    );
    localStorage.setItem(
      STORAGE_KEYS.TRANSACTIONS,
      JSON.stringify(this.getTransactions().filter((t) => t.businessId !== businessId))
    );
    localStorage.setItem(
      STORAGE_KEYS.CREDIT_SETTLEMENTS,
      JSON.stringify(this.getCreditSettlements().filter((s) => s.businessId !== businessId))
    );
    localStorage.setItem(
      STORAGE_KEYS.SESSIONS,
      JSON.stringify(this.getSessions().filter((s) => s.businessId !== businessId))
    );
    localStorage.setItem(
      STORAGE_KEYS.NOTIFICATIONS,
      JSON.stringify(this.getAllNotificationsRaw().filter((n) => n.businessId !== businessId))
    );
    localStorage.setItem(
      STORAGE_KEYS.MOVEMENTS,
      JSON.stringify(this.getStockMovements().filter((m) => m.businessId !== businessId))
    );

    // Ensure currentUserId remains valid
    const currentUserId = localStorage.getItem(STORAGE_KEYS.CURRENT_USER_ID);
    if (currentUserId && !remainingUsers.some((u) => u.id === currentUserId)) {
      const fallbackUser = remainingUsers.find((u) => u.id === 'usr_dev') || remainingUsers[0];
      if (fallbackUser) {
        localStorage.setItem(STORAGE_KEYS.CURRENT_USER_ID, fallbackUser.id);
      }
    }

    this.broadcast();
    return { removed: Boolean(target), businessName: target?.name, stats };
  }

  public async deleteBusiness(businessId: string): Promise<{
    localDeleted: boolean;
    cloudDeleted: boolean;
    cloudDeletedDocs: number;
    cloudError?: string;
    businessName?: string;
    stats: { users: number; products: number; customers: number; transactions: number; sessions: number };
  }> {
    const localRes = this.removeBusinessLocally(businessId);

    this.addNotification({
      targetRole: 'developer',
      businessId: 'all',
      title: `Commerce supprimé : ${localRes.businessName || businessId}`,
      message: `Suppression définitive de la base (${localRes.stats.users} comptes, ${localRes.stats.products} articles, ${localRes.stats.transactions} ventes).`,
      type: 'security',
      priority: 'high',
    });

    const cloudRes = await deleteBusinessCascadeFromFirestore(businessId);

    return {
      localDeleted: true,
      cloudDeleted: cloudRes.success,
      cloudDeletedDocs: cloudRes.deletedDocsCount,
      cloudError: cloudRes.errorMessage,
      businessName: localRes.businessName,
      stats: localRes.stats,
    };
  }

  public async retryDeleteBusinessFromCloud(businessId: string) {
    return deleteBusinessCascadeFromFirestore(businessId);
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

  /**
   * Look up a business by its accessCode from Cloud Firestore and cache both the business
   * and its active staff locally so phone/tablet terminals immediately display Propriétaire/Caissier choices.
   */
  public async fetchBusinessAndStaffByAccessCode(rawCode: string): Promise<{
    business?: Business;
    staff: User[];
  }> {
    const localBiz = this.getBusinessByAccessCode(rawCode);
    const localStaff = localBiz ? this.getUsersByBusinessId(localBiz.id) : [];

    const remote = await lookupBusinessAndStaffByAccessCode(rawCode);
    if (remote.business) {
      const mergedBusinesses = this.mergeRemoteItemsById(this.getBusinesses(), [remote.business]);
      localStorage.setItem(STORAGE_KEYS.BUSINESSES, JSON.stringify(mergedBusinesses));

      if (remote.staff.length > 0) {
        const mergedUsers = this.mergeRemoteItemsById(this.getUsers(), remote.staff);
        localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(mergedUsers));
      }

      this.notify();
      const updatedStaff = this.getUsersByBusinessId(remote.business.id);
      return {
        business: remote.business,
        staff: updatedStaff.length > 0 ? updatedStaff : remote.staff,
      };
    }

    return {
      business: localBiz,
      staff: localStaff,
    };
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

  public addBusiness(biz: {
    name: string;
    tradeType: string;
    currency?: string;
    phone?: string;
    address?: string;
    ownerName?: string;
    ownerPhone?: string;
    ownerEmail?: string;
    ownerPin?: string;
    accessCode?: string;
    subscriptionPlan?: SubscriptionPlan;
    subscriptionStatus?: SubscriptionStatus;
    subscriptionExpiresAt?: string;
    cashierPin?: string;
  }): Business & {
    ownerUser: User;
    cashierUser: User;
    generatedAccessCode: string;
    generatedOwnerPin: string;
    generatedCashierPin: string;
  } {
    const list = this.getBusinesses();

    // 1. Generate unique session access code
    let finalCode = biz.accessCode?.trim().toUpperCase();
    if (!finalCode) {
      finalCode = this.generateAccessCodeString();
    } else if (!finalCode.startsWith('CP-')) {
      finalCode = `CP-${finalCode}`;
    }

    // 2. Generate default 4-digit PIN for owner
    const finalOwnerPin = biz.ownerPin?.trim() || this.generateOwnerPinString();

    // 3. Default cashier PIN
    const finalCashierPin = biz.cashierPin?.trim() || '0000';

    const expDate = new Date();
    expDate.setMonth(expDate.getMonth() + 12);

    const newBiz: Business = {
      id: makeId('biz'),
      name: biz.name.trim().slice(0, 120),
      tradeType: biz.tradeType || 'Commerce Général',
      currency: biz.currency || 'FCFA',
      phone: (biz.phone?.trim() || '+225 00 00 00 00').slice(0, 30),
      address: (biz.address?.trim() || 'Abidjan, Côte d\'Ivoire').slice(0, 200),
      ownerName: (biz.ownerName?.trim() || 'Propriétaire').slice(0, 100),
      subscriptionPlan: biz.subscriptionPlan || 'pro',
      subscriptionStatus: biz.subscriptionStatus || 'active',
      subscriptionExpiresAt: biz.subscriptionExpiresAt || expDate.toISOString().slice(0, 10),
      totalSalesCount: 0,
      developerFeeRate: 20,
      createdAt: new Date().toISOString().slice(0, 10),
      accessCode: finalCode,
    };

    list.push(newBiz);
    localStorage.setItem(STORAGE_KEYS.BUSINESSES, JSON.stringify(list));
    syncDocToFirestore('businesses', newBiz.id, newBiz);

    // 4. Create Owner user account automatically with default PIN
    const cleanOwnerName = newBiz.ownerName.trim();
    const slugOwner = cleanOwnerName
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, '')
      .slice(0, 10) || 'proprio';
    const slugBiz = newBiz.name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, '')
      .slice(0, 10) || 'commerce';

    const ownerUser: User = {
      id: makeId('usr_owner'),
      name: `${cleanOwnerName} (Propriétaire)`.slice(0, 120),
      email: (biz.ownerEmail?.trim() || `${slugOwner}@${slugBiz}.com`).slice(0, 120),
      phone: (biz.ownerPhone?.trim() || newBiz.phone).slice(0, 30),
      role: 'owner',
      businessId: newBiz.id,
      pinCode: finalOwnerPin,
      status: 'active',
      createdAt: new Date().toISOString().slice(0, 10),
      lastLogin: 'Jamais connecté',
    };

    // 5. Create default Cashier account automatically
    const cashierUser: User = {
      id: makeId('usr_cashier'),
      name: 'Caissier(ère) 1',
      email: `caisse1@${slugBiz}.com`.slice(0, 120),
      phone: newBiz.phone.slice(0, 30),
      role: 'cashier',
      businessId: newBiz.id,
      pinCode: finalCashierPin,
      status: 'active',
      createdAt: new Date().toISOString().slice(0, 10),
      lastLogin: 'Jamais connecté',
    };

    const users = this.getUsers();
    users.push(ownerUser, cashierUser);
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
    syncDocToFirestore('users', ownerUser.id, ownerUser);
    syncDocToFirestore('users', cashierUser.id, cashierUser);

    // 6. Seed starter products for the new business
    this.seedStarterProductsForNewBusiness(newBiz.id);

    // 7. System notification
    this.addNotification({
      targetRole: 'developer',
      businessId: newBiz.id,
      businessName: newBiz.name,
      title: `Commerce Déployé : ${newBiz.name}`,
      message: `Code session: ${finalCode} | PIN Propriétaire: ${finalOwnerPin} | PIN Caissier: ${finalCashierPin}`,
      type: 'security',
      priority: 'high',
    });

    this.broadcast();

    return Object.assign(newBiz, {
      ownerUser,
      cashierUser,
      generatedAccessCode: finalCode,
      generatedOwnerPin: finalOwnerPin,
      generatedCashierPin: finalCashierPin,
    });
  }

  private seedStarterProductsForNewBusiness(bizId: string) {
    const products = this.getProducts();
    const starterItems = [
      {
        name: 'Article Pack Découverte 1',
        category: 'Général',
        purchasePrice: 1000,
        salePrice: 1500,
        stock: 50,
        minStockAlert: 10,
        unit: 'pièce',
        isFavorite: true,
      },
      {
        name: 'Produit Vedette Standard',
        category: 'Général',
        purchasePrice: 2000,
        salePrice: 2800,
        stock: 30,
        minStockAlert: 8,
        unit: 'pièce',
        isFavorite: true,
      },
      {
        name: 'Consommable / Accessoire Caisse',
        category: 'Divers',
        purchasePrice: 500,
        salePrice: 800,
        stock: 100,
        minStockAlert: 20,
        unit: 'pièce',
        isFavorite: false,
      },
    ];

    starterItems.forEach((item, index) => {
      const prodId = `prod_${bizId}_${index + 1}`;
      const barcode = `618${Math.floor(100000000 + Math.random() * 900000000)}`;
      const prod: Product = {
        id: prodId,
        businessId: bizId,
        code: `ART-${String(index + 1).padStart(3, '0')}`,
        barcode,
        name: item.name,
        category: item.category,
        purchasePrice: item.purchasePrice,
        salePrice: item.salePrice,
        stock: item.stock,
        minStockAlert: item.minStockAlert,
        unit: item.unit,
        isFavorite: item.isFavorite,
      };
      products.push(prod);
      syncDocToFirestore('products', prod.id, prod);
    });

    localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(products));
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
      name: (product.name || 'Article').trim().slice(0, 150),
      id: makeId('prod'),
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
      name: (cust.name || 'Client').trim().slice(0, 100),
      phone: (cust.phone || '').trim().slice(0, 30),
      id: makeId('cust'),
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

  // --- Credit & Debt Management ---
  public getCreditSettlements(businessId?: string, customerId?: string): CreditSettlement[] {
    const data = localStorage.getItem(STORAGE_KEYS.CREDIT_SETTLEMENTS);
    let list: CreditSettlement[] = data ? JSON.parse(data) : [];
    if (businessId && businessId !== 'all') {
      list = list.filter((s) => s.businessId === businessId);
    }
    if (customerId) {
      list = list.filter((s) => s.customerId === customerId);
    }
    return list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  public recordCreditPayment(data: {
    businessId: string;
    customerId: string;
    amount: number;
    paymentMethod: 'cash' | 'mobile_money' | 'card';
    cashierName: string;
    notes?: string;
  }): { settlement: CreditSettlement; updatedCustomer: Customer } {
    const customers = this.getCustomers();
    const customer = customers.find((c) => c.id === data.customerId);
    if (!customer) {
      throw new Error('Client introuvable');
    }

    const previousBalance = customer.creditBalance;
    const paymentAmount = Math.max(0, data.amount);
    const newBalance = Math.max(0, previousBalance - paymentAmount);
    customer.creditBalance = newBalance;

    localStorage.setItem(STORAGE_KEYS.CUSTOMERS, JSON.stringify(customers));
    syncDocToFirestore('customers', customer.id, customer);

    const settlements = this.getCreditSettlements();
    const newSettlement: CreditSettlement = {
      id: `stl_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      businessId: data.businessId,
      customerId: customer.id,
      customerName: customer.name,
      amount: paymentAmount,
      paymentMethod: data.paymentMethod,
      timestamp: new Date().toISOString().replace('T', ' ').slice(0, 19),
      cashierName: data.cashierName,
      notes: data.notes || 'Règlement de dette / acompte carnet',
      previousBalance,
      newBalance,
    };

    settlements.unshift(newSettlement);
    localStorage.setItem(STORAGE_KEYS.CREDIT_SETTLEMENTS, JSON.stringify(settlements));
    syncDocToFirestore('credit_settlements', newSettlement.id, newSettlement);

    // If payment was made in cash, update active cash register session
    if (data.paymentMethod === 'cash') {
      const activeSession = this.getActiveCashSession(data.businessId);
      if (activeSession) {
        activeSession.expectedCash += paymentAmount;
        this.updateCashSession(activeSession);
      }
    }

    this.broadcast();
    return { settlement: newSettlement, updatedCustomer: customer };
  }

  public adjustCustomerCredit(data: {
    businessId: string;
    customerId: string;
    deltaAmount: number;
    reason: string;
    cashierName: string;
  }): Customer {
    const customers = this.getCustomers();
    const customer = customers.find((c) => c.id === data.customerId);
    if (!customer) {
      throw new Error('Client introuvable');
    }

    customer.creditBalance = Math.max(0, customer.creditBalance + data.deltaAmount);
    localStorage.setItem(STORAGE_KEYS.CUSTOMERS, JSON.stringify(customers));
    syncDocToFirestore('customers', customer.id, customer);
    this.broadcast();
    return customer;
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
      id: makeId('tx'),
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

  public cancelTransaction(data: {
    transactionId: string;
    reason: string;
    cashierUser: User;
    restoreStock?: boolean;
  }): { success: boolean; transaction?: SaleTransaction; error?: string } {
    const cleanReason = (data.reason || '').trim().slice(0, 280);
    if (cleanReason.length < 3) {
      return {
        success: false,
        error: 'Veuillez saisir une justification valide (minimum 3 caractères).',
      };
    }

    const txs = this.getTransactions();
    const tx = txs.find((t) => t.id === data.transactionId);
    if (!tx) {
      return { success: false, error: 'Transaction introuvable.' };
    }

    if (tx.status === 'cancelled') {
      return { success: false, error: 'Cette transaction a déjà été annulée.' };
    }

    const nowStr = new Date().toISOString().replace('T', ' ').slice(0, 19);
    tx.status = 'cancelled';
    tx.cancelledAt = nowStr;
    tx.cancelledBy = data.cashierUser.name.slice(0, 100);
    tx.cancelledById = data.cashierUser.id.slice(0, 128);
    tx.cancellationReason = cleanReason;

    localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(txs));
    syncDocToFirestore('transactions', tx.id, tx);

    // Restore stock if requested and sync each updated product to Firestore
    if (data.restoreStock !== false) {
      const products = this.getProducts();
      tx.items.forEach((it) => {
        const prod = products.find((p) => p.id === it.productId);
        if (prod) {
          const prev = prod.stock;
          prod.stock += it.quantity;
          syncDocToFirestore('products', prod.id, prod);
          this.addStockMovement({
            businessId: tx.businessId,
            productId: prod.id,
            productName: prod.name,
            type: 'in',
            quantity: it.quantity,
            previousStock: prev,
            newStock: prod.stock,
            reason: `Annulation vente ${tx.ticketNumber} (${cleanReason.slice(0, 140)})`,
            userName: data.cashierUser.name,
          });
        }
      });
      localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(products));
    }

    // Update business total sales count
    const businesses = this.getBusinesses();
    const biz = businesses.find((b) => b.id === tx.businessId);
    if (biz && biz.totalSalesCount > 0) {
      biz.totalSalesCount = Math.max(0, biz.totalSalesCount - 1);
      localStorage.setItem(STORAGE_KEYS.BUSINESSES, JSON.stringify(businesses));
      syncDocToFirestore('businesses', biz.id, biz);
    }

    // If credit sale, reverse the customer debt
    if (tx.paymentMethod === 'credit' && tx.customerId) {
      const customers = this.getCustomers();
      const customer = customers.find((c) => c.id === tx.customerId);
      if (customer) {
        customer.creditBalance = Math.max(0, customer.creditBalance - tx.totalAmount);
        customer.totalPurchases = Math.max(0, customer.totalPurchases - tx.totalAmount);
        localStorage.setItem(STORAGE_KEYS.CUSTOMERS, JSON.stringify(customers));
        syncDocToFirestore('customers', customer.id, customer);
      }
    }

    // Adjust active cash session metrics if the cancelled sale occurred in this open session
    const activeSession = this.getActiveCashSession(tx.businessId);
    if (activeSession) {
      const openTime = new Date(activeSession.openedAt.replace(' ', 'T')).getTime();
      const txTime = new Date(tx.timestamp.replace(' ', 'T')).getTime();
      if (txTime >= openTime) {
        activeSession.totalSalesAmount = Math.max(0, activeSession.totalSalesAmount - tx.totalAmount);
        activeSession.totalSalesCount = Math.max(0, activeSession.totalSalesCount - 1);
        if (tx.paymentMethod === 'cash') {
          activeSession.expectedCash = Math.max(0, activeSession.expectedCash - tx.totalAmount);
        }
        this.updateCashSession(activeSession);
      }
    }

    // Notify owner
    this.addNotification({
      targetRole: 'owner',
      businessId: tx.businessId,
      title: `Vente annulée : ${tx.ticketNumber}`,
      message: `La vente de ${tx.totalAmount} F CFA (Ticket ${tx.ticketNumber}) a été annulée par ${data.cashierUser.name}. Motif : ${cleanReason}`,
      type: 'security',
      priority: 'high',
    });

    this.broadcast();
    return { success: true, transaction: tx };
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
      id: makeId('sess'),
      businessId,
      cashierId,
      cashierName: cashierName.slice(0, 100),
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

  public closeCashSession(
    sessionId: string,
    actualCash: number,
    notes?: string,
    denominations?: CashDenominations
  ): CashRegisterSession | undefined {
    const sessions = this.getSessions();
    const sess = sessions.find((s) => s.id === sessionId);
    if (!sess) return undefined;

    const now = new Date();
    const nowStr = now.toISOString().replace('T', ' ').slice(0, 19);
    const dateFormatted = now.toISOString().slice(0, 10).replace(/-/g, '');

    // Form sequence Z-YYYYMMDD-001 based on closed sessions
    const closedCount = sessions.filter((s) => s.status === 'closed').length;
    const zNumber = `Z-${dateFormatted}-${String(closedCount + 1).padStart(3, '0')}`;

    // Get all transactions during this session
    const openTime = new Date(sess.openedAt.replace(' ', 'T')).getTime();
    const allTx = this.getTransactions(sess.businessId);
    const sessionTx = allTx.filter((t) => {
      const tTime = new Date(t.timestamp.replace(' ', 'T')).getTime();
      return tTime >= openTime && t.status === 'completed';
    });

    const cashSales = sessionTx
      .filter((t) => t.paymentMethod === 'cash')
      .reduce((sum, t) => sum + t.totalAmount, 0);

    const mobileMoneySales = sessionTx
      .filter((t) => t.paymentMethod === 'mobile_money')
      .reduce((sum, t) => sum + t.totalAmount, 0);

    const cardSales = sessionTx
      .filter((t) => t.paymentMethod === 'card')
      .reduce((sum, t) => sum + t.totalAmount, 0);

    const creditSales = sessionTx
      .filter((t) => t.paymentMethod === 'credit')
      .reduce((sum, t) => sum + t.totalAmount, 0);

    const discountsTotal = sessionTx.reduce((sum, t) => sum + (t.discountTotal || 0), 0);

    // Credit settlements in cash during this session
    const settlements = this.getCreditSettlements(sess.businessId);
    const creditSettlementsCash = settlements
      .filter((stl) => {
        const sTime = new Date(stl.timestamp.replace(' ', 'T')).getTime();
        return sTime >= openTime && stl.paymentMethod === 'cash';
      })
      .reduce((sum, stl) => sum + stl.amount, 0);

    // Total expected cash = openingFloat + cashSales + creditSettlementsCash
    const totalExpectedCash = sess.openingFloat + cashSales + creditSettlementsCash;

    sess.zNumber = zNumber;
    sess.closedAt = nowStr;
    sess.expectedCash = totalExpectedCash;
    sess.actualCash = actualCash;
    sess.cashDifference = actualCash - totalExpectedCash;
    sess.totalSalesAmount = sessionTx.reduce((sum, t) => sum + t.totalAmount, 0);
    sess.totalSalesCount = sessionTx.length;
    sess.cashSales = cashSales;
    sess.mobileMoneySales = mobileMoneySales;
    sess.cardSales = cardSales;
    sess.creditSales = creditSales;
    sess.discountsTotal = discountsTotal;
    sess.creditSettlementsCash = creditSettlementsCash;
    sess.denominations = denominations;
    sess.status = 'closed';
    sess.notes = notes;

    localStorage.setItem(STORAGE_KEYS.SESSIONS, JSON.stringify(sessions));
    syncDocToFirestore('sessions', sess.id, sess);

    // Notify owner if there is a discrepancy
    if (sess.cashDifference !== 0) {
      const isShort = sess.cashDifference < 0;
      this.addNotification({
        targetRole: 'owner',
        businessId: sess.businessId,
        title: isShort ? 'Alerte : Déficit de Caisse (Rapport Z)' : 'Excédent de Caisse (Rapport Z)',
        message: `${sess.cashierName} a clôturé sa caisse (${zNumber}) avec un écart de ${sess.cashDifference > 0 ? '+' : ''}${sess.cashDifference} F CFA.`,
        type: 'security',
        priority: isShort ? 'high' : 'normal',
      });
    }

    this.broadcast();
    return sess;
  }

  // --- Push Notifications ---
  private getAllNotificationsRaw(): PushNotification[] {
    const data = localStorage.getItem(STORAGE_KEYS.NOTIFICATIONS);
    return data ? JSON.parse(data) : SEED_NOTIFICATIONS;
  }

  public getNotifications(role?: UserRole, businessId?: string): PushNotification[] {
    const notifs = this.getAllNotificationsRaw();

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
    const notifs: PushNotification[] = this.getAllNotificationsRaw();
    const newNotif: PushNotification = {
      ...notif,
      title: (notif.title || 'Notification').trim().slice(0, 150),
      message: (notif.message || '').trim().slice(0, 500),
      id: makeId('notif'),
      timestamp: new Date().toISOString().replace('T', ' ').slice(0, 19),
      read: false,
    };
    notifs.unshift(newNotif);
    localStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify(notifs));
    syncDocToFirestore('notifications', newNotif.id, newNotif);
    this.broadcast();
  }

  public markNotificationAsRead(notifId: string) {
    const notifs: PushNotification[] = this.getAllNotificationsRaw().map((n) =>
      n.id === notifId ? { ...n, read: true } : n
    );
    localStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify(notifs));
    const target = notifs.find((n) => n.id === notifId);
    if (target) syncDocToFirestore('notifications', notifId, target);
    this.broadcast();
  }

  public markAllNotificationsAsRead() {
    const raw = this.getAllNotificationsRaw();
    const changedItems: PushNotification[] = [];
    const notifs: PushNotification[] = raw.map((n) => {
      if (!n.read) {
        const updated = { ...n, read: true };
        changedItems.push(updated);
        return updated;
      }
      return n;
    });
    localStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify(notifs));
    changedItems.forEach((n) => syncDocToFirestore('notifications', n.id, n));
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
      productName: (mov.productName || '').slice(0, 150),
      reason: (mov.reason || '').slice(0, 200),
      userName: (mov.userName || '').slice(0, 100),
      id: makeId('mov'),
      timestamp: new Date().toISOString().replace('T', ' ').slice(0, 19),
    };
    movs.unshift(newMov);
    localStorage.setItem(STORAGE_KEYS.MOVEMENTS, JSON.stringify(movs));
    syncDocToFirestore('movements', newMov.id, newMov);
  }

  // Reset database to initial seed
  public resetToFactory() {
    localStorage.clear();
    clearPosSyncTrackingStorage();
    this.initStorage();
    this.broadcast();
  }
}

export const store = new StoreService();
