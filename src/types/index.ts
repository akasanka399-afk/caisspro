export type UserRole = 'developer' | 'owner' | 'manager' | 'cashier';

export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: UserRole;
  businessId: string;
  pinCode?: string; // Quick 4-digit PIN for cashiers
  status: 'active' | 'suspended';
  createdAt: string;
  lastLogin: string;
  avatar?: string;
}

export type SubscriptionPlan = 'starter' | 'pro' | 'enterprise';
export type SubscriptionStatus = 'active' | 'trial' | 'expired' | 'suspended';

export interface Business {
  id: string;
  name: string;
  tradeType: string;
  currency: string;
  phone: string;
  address: string;
  ownerName: string;
  subscriptionPlan: SubscriptionPlan;
  subscriptionStatus: SubscriptionStatus;
  subscriptionExpiresAt: string;
  totalSalesCount: number;
  developerFeeRate: number; // 20 F per sale
  createdAt: string;
}

export interface Product {
  id: string;
  businessId: string;
  code: string;
  barcode: string;
  name: string;
  category: string;
  purchasePrice: number;
  salePrice: number;
  stock: number;
  minStockAlert: number;
  unit: string;
  imageUrl?: string;
  isFavorite?: boolean;
}

export interface Category {
  id: string;
  name: string;
  iconName: string;
}

export interface Customer {
  id: string;
  businessId: string;
  name: string;
  phone: string;
  address?: string;
  creditBalance: number; // dette client
  totalPurchases: number;
  lastPurchaseDate?: string;
}

export interface CartItem {
  product: Product;
  quantity: number;
  unitPrice: number;
  discount: number; // percentage or fixed
  subtotal: number;
}

export type PaymentMethod = 'cash' | 'mobile_money' | 'card' | 'credit';

export interface SaleTransaction {
  id: string;
  ticketNumber: string;
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
  paymentMethod: PaymentMethod;
  amountReceived: number;
  changeDue: number;
  developerFee: number; // Fixed 20 F
  timestamp: string;
  status: 'completed' | 'refunded';
}

export interface CashRegisterSession {
  id: string;
  businessId: string;
  cashierId: string;
  cashierName: string;
  openedAt: string;
  closedAt?: string;
  openingFloat: number;
  expectedCash: number;
  actualCash?: number;
  cashDifference?: number;
  totalSalesAmount: number;
  totalSalesCount: number;
  status: 'open' | 'closed';
  notes?: string;
}

export type NotificationType = 'sale_milestone' | 'low_stock' | 'subscription' | 'security' | 'system';

export interface PushNotification {
  id: string;
  targetRole: 'all' | 'developer' | 'owner' | 'manager' | 'cashier';
  businessId?: string;
  businessName?: string;
  title: string;
  message: string;
  type: NotificationType;
  timestamp: string;
  read: boolean;
  priority?: 'normal' | 'high' | 'urgent';
}

export interface StockMovement {
  id: string;
  businessId: string;
  productId: string;
  productName: string;
  type: 'in' | 'out' | 'sale' | 'adjustment';
  quantity: number;
  previousStock: number;
  newStock: number;
  reason: string;
  userName: string;
  timestamp: string;
}
