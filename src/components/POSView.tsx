import React, { useState, useEffect, useRef } from 'react';
import { Business, Customer, PaymentMethod, Product, SaleTransaction, User } from '../types';
import { store, playSoundEffect } from '../services/store';
import { useTheme } from '../services/themeContext';
import { formatMoney, formatDate } from '../utils/formatters';
import {
  Search,
  Barcode,
  ShoppingCart,
  Trash2,
  Plus,
  Minus,
  CreditCard,
  Banknote,
  Smartphone,
  UserCheck,
  Zap,
  RotateCcw,
  Percent,
  Check,
  Keyboard,
  Layers,
  Printer,
  DollarSign,
  ArrowRight,
  Clock,
  Sparkles,
  Tag,
  Receipt,
  Phone,
} from 'lucide-react';
import { ReceiptModal } from './ReceiptModal';
import { KeyboardShortcutsModal } from './KeyboardShortcutsModal';
import { printThermalReceipt } from '../utils/printReceipt';

interface POSViewProps {
  currentUser: User;
  business: Business;
}

export const POSView: React.FC<POSViewProps> = ({ currentUser, business }) => {
  const { theme } = useTheme();
  const isLight = theme === 'light';

  // Primary POS Mode: 'catalog' (articles & rayons) vs 'direct' (caisse rapide saisie montant)
  const [posMode, setPosMode] = useState<'catalog' | 'direct'>('direct');

  // Shared state
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [barcodeInput, setBarcodeInput] = useState<string>('');

  // Mode Catalogue Cart state
  const [cart, setCart] = useState<{
    product: Product;
    quantity: number;
    unitPrice: number;
    subtotal: number;
  }[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [discountTotal, setDiscountTotal] = useState<number>(0);
  const [showDiscountInput, setShowDiscountInput] = useState<boolean>(false);
  const [discountInputValue, setDiscountInputValue] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [amountReceived, setAmountReceived] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [completedTx, setCompletedTx] = useState<SaleTransaction | null>(null);

  // Mode Caisse Rapide (Saisie Directe du Montant & Multi-Articles & Quantités) State
  const [directAmount, setDirectAmount] = useState<string>('');
  const [directLabel, setDirectLabel] = useState<string>('Vente Directe');
  const [directQuantity, setDirectQuantity] = useState<number>(1);
  const [directItems, setDirectItems] = useState<{
    id: string;
    label: string;
    amount: number;
    quantity: number;
  }[]>([]);
  const [directPaymentMethod, setDirectPaymentMethod] = useState<PaymentMethod>('cash');
  const [directCashReceived, setDirectCashReceived] = useState<string>('');
  const [directCustomerName, setDirectCustomerName] = useState<string>('');
  const [directCustomerPhone, setDirectCustomerPhone] = useState<string>('');
  const [directCustomerNote, setDirectCustomerNote] = useState<string>('');

  // Modals
  const [showShortcutsModal, setShowShortcutsModal] = useState<boolean>(false);
  const [showCustomerModal, setShowCustomerModal] = useState<boolean>(false);
  const [quickBarcodeNotice, setQuickBarcodeNotice] = useState<string | null>(null);
  const [globalNotice, setGlobalNotice] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  // Refs for keyboard navigation & direct typing
  const searchInputRef = useRef<HTMLInputElement>(null);
  const barcodeInputRef = useRef<HTMLInputElement>(null);
  const cashInputRef = useRef<HTMLInputElement>(null);
  const directInputRef = useRef<HTMLInputElement>(null);
  const directLabelInputRef = useRef<HTMLInputElement>(null);

  // Load products & customers
  const refreshData = () => {
    setProducts(store.getProducts(business.id));
    setCustomers(store.getCustomers(business.id));
  };

  useEffect(() => {
    refreshData();
    const unsubscribe = store.subscribe(() => {
      refreshData();
    });
    return () => unsubscribe();
  }, [business.id]);

  // Categories list
  const categories = ['all', ...Array.from(new Set(products.map((p) => p.category)))];

  // Mode Catalogue calculations
  const cartSubtotal = cart.reduce((sum, item) => sum + item.subtotal, 0);
  const cartTotal = Math.max(0, cartSubtotal - discountTotal);
  const numReceived = parseFloat(amountReceived) || 0;
  const changeDue = Math.max(0, numReceived - cartTotal);

  // Mode Caisse Rapide calculations (Multi-montants cumulés avec prise en compte des quantités)
  const numDirectAmount = parseFloat(directAmount) || 0;
  const directItemsSum = directItems.reduce((acc, it) => acc + (it.amount * it.quantity), 0);
  const activeLineAmount = numDirectAmount > 0 ? numDirectAmount * Math.max(1, directQuantity) : 0;
  const totalDirectToPay = directItems.length > 0
    ? directItemsSum + activeLineAmount
    : activeLineAmount;
  const numDirectReceived = parseFloat(directCashReceived) || 0;
  const directChangeDue = Math.max(0, numDirectReceived - totalDirectToPay);
  const totalDirectItemsCount = directItems.reduce((acc, it) => acc + it.quantity, 0) + (numDirectAmount > 0 ? Math.max(1, directQuantity) : 0);

  // Keep directCashReceived in sync if not cash
  useEffect(() => {
    if (directPaymentMethod !== 'cash') {
      setDirectCashReceived(String(totalDirectToPay));
    }
  }, [directPaymentMethod, totalDirectToPay]);

  // Focus direct input when switching to direct mode
  useEffect(() => {
    if (posMode === 'direct') {
      setTimeout(() => {
        directInputRef.current?.focus();
      }, 50);
    }
  }, [posMode]);

  // Auto-set amount received in catalog mode if payment is electronic
  useEffect(() => {
    if (paymentMethod !== 'cash') {
      setAmountReceived(String(cartTotal));
    }
  }, [paymentMethod, cartTotal]);

  // Handle printing the latest receipt formatted for thermal printers
  const handlePrintTicket = async () => {
    const transactions = store.getTransactions(business.id);
    const targetTx = completedTx || transactions[0];

    if (!targetTx) {
      playSoundEffect('error');
      setGlobalNotice({
        message: 'Aucun ticket de vente disponible pour ce commerce. Effectuez une vente au préalable.',
        type: 'error',
      });
      setTimeout(() => setGlobalNotice(null), 4000);
      return;
    }

    setCompletedTx(targetTx);
    playSoundEffect('beep');
    setGlobalNotice({
      message: `Impression thermique du ticket ${targetTx.ticketNumber} en cours...`,
      type: 'success',
    });
    setTimeout(() => setGlobalNotice(null), 3500);

    try {
      await printThermalReceipt(targetTx, business);
    } catch (err) {
      console.error('Erreur lors de l’impression du ticket:', err);
    }
  };

  // Keyboard shortcut listener for both modes
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement as HTMLElement | null;
      const isInputActive = ['INPUT', 'TEXTAREA'].includes(activeEl?.tagName || '') && activeEl !== directInputRef.current;

      if (e.key === 'F1') {
        e.preventDefault();
        setShowShortcutsModal((prev) => !prev);
      } else if (e.key === 'F5') {
        // Toggle between Catalogue and Caisse Rapide
        e.preventDefault();
        setPosMode((prev) => (prev === 'catalog' ? 'direct' : 'catalog'));
        playSoundEffect('beep');
      } else if (e.key === 'F2' && posMode === 'catalog') {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      } else if (e.key === 'F3' && posMode === 'catalog') {
        e.preventDefault();
        barcodeInputRef.current?.focus();
        barcodeInputRef.current?.select();
      } else if (e.key === 'F4') {
        e.preventDefault();
        setShowCustomerModal((prev) => !prev);
      } else if (e.key === 'F8' && posMode === 'catalog') {
        e.preventDefault();
        setShowDiscountInput((prev) => !prev);
      } else if (e.key === 'F9') {
        e.preventDefault();
        if (posMode === 'catalog') {
          setPaymentMethod('cash');
          cashInputRef.current?.focus();
        } else {
          setDirectPaymentMethod('cash');
          directInputRef.current?.focus();
        }
        playSoundEffect('beep');
      } else if (e.key === 'F10') {
        e.preventDefault();
        if (posMode === 'catalog') {
          setPaymentMethod('mobile_money');
        } else {
          setDirectPaymentMethod('mobile_money');
        }
        playSoundEffect('beep');
      } else if (e.key === 'F11') {
        e.preventDefault();
        if (posMode === 'catalog') {
          setPaymentMethod('card');
        } else {
          setDirectPaymentMethod('card');
        }
        playSoundEffect('beep');
      } else if (e.key === 'F12') {
        e.preventDefault();
        handlePrintTicket();
      } else if (e.key === 'Escape') {
        if (showShortcutsModal) setShowShortcutsModal(false);
        else if (showCustomerModal) setShowCustomerModal(false);
        else if (completedTx) setCompletedTx(null);
        else if (posMode === 'direct') {
          if (directAmount !== '') {
            setDirectAmount('');
          } else if (directItems.length > 0) {
            setDirectItems([]);
          }
          setDirectCashReceived('');
        } else {
          setSearchQuery('');
          setBarcodeInput('');
        }
      } else if ((e.key === '+' || e.key === '=') && posMode === 'direct' && !isInputActive) {
        // Key +: Add current amount to ticket
        e.preventDefault();
        handleAddDirectItem();
      } else if (e.key === ' ' && !isInputActive) {
        // Space key: exact tender
        e.preventDefault();
        if (posMode === 'catalog' && cart.length > 0) {
          setAmountReceived(String(cartTotal));
          playSoundEffect('beep');
        } else if (posMode === 'direct' && totalDirectToPay > 0) {
          setDirectCashReceived(String(totalDirectToPay));
          playSoundEffect('beep');
        }
      } else if (e.key === 'Enter' && !isInputActive) {
        // Enter key: Validate sale
        e.preventDefault();
        if (posMode === 'catalog') {
          handleValidateSale();
        } else {
          handleValidateDirectSale();
        }
      } else if (posMode === 'direct' && !isInputActive) {
        // Handle direct numeric keyboard entry if directInputRef is not already focused
        if (document.activeElement !== directInputRef.current) {
          if (e.key >= '0' && e.key <= '9') {
            e.preventDefault();
            handleDirectNumpadPress(e.key);
          } else if (e.key === 'Backspace') {
            e.preventDefault();
            handleDirectNumpadPress('backspace');
          } else if (e.key.toLowerCase() === 'c') {
            e.preventDefault();
            handleDirectNumpadPress('clear');
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    posMode,
    cart,
    cartTotal,
    paymentMethod,
    amountReceived,
    directAmount,
    numDirectAmount,
    directItems,
    totalDirectToPay,
    directLabel,
    directQuantity,
    directPaymentMethod,
    directCashReceived,
    directCustomerName,
    directCustomerPhone,
    showShortcutsModal,
    showCustomerModal,
    completedTx,
  ]);

  // Mode Catalogue: Add product to cart
  const addToCart = (product: Product, qty: number = 1) => {
    if (product.stock <= 0) {
      playSoundEffect('error');
      alert(`Stock épuisé pour "${product.name}".`);
      return;
    }

    setCart((prev) => {
      const existing = prev.find((i) => i.product.id === product.id);
      if (existing) {
        const newQty = existing.quantity + qty;
        if (newQty > product.stock) {
          playSoundEffect('error');
          alert(`Quantité demandée (${newQty}) supérieure au stock disponible (${product.stock}).`);
          return prev;
        }
        return prev.map((item) =>
          item.product.id === product.id
            ? { ...item, quantity: newQty, subtotal: newQty * item.unitPrice }
            : item
        );
      } else {
        return [
          ...prev,
          {
            product,
            quantity: qty,
            unitPrice: product.salePrice,
            subtotal: qty * product.salePrice,
          },
        ];
      }
    });

    playSoundEffect('beep');
  };

  // Modify quantity in cart
  const updateQuantity = (productId: string, delta: number) => {
    setCart((prev) => {
      return prev
        .map((item) => {
          if (item.product.id === productId) {
            const nextQty = item.quantity + delta;
            if (nextQty <= 0) return null;
            if (nextQty > item.product.stock) {
              playSoundEffect('error');
              alert(`Stock maximum disponible atteint (${item.product.stock}).`);
              return item;
            }
            return {
              ...item,
              quantity: nextQty,
              subtotal: nextQty * item.unitPrice,
            };
          }
          return item;
        })
        .filter(Boolean) as typeof prev;
    });
    playSoundEffect('beep');
  };

  // Clear cart
  const clearCart = () => {
    if (cart.length === 0) return;
    setCart([]);
    setDiscountTotal(0);
    setAmountReceived('');
    setSelectedCustomerId('');
    playSoundEffect('beep');
  };

  // Barcode handler
  const handleBarcodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!barcodeInput.trim()) return;

    const code = barcodeInput.trim();
    const matched = products.find((p) => p.barcode === code || p.code.toLowerCase() === code.toLowerCase());

    if (matched) {
      addToCart(matched, 1);
      setQuickBarcodeNotice(`Article scanné : ${matched.name}`);
      setTimeout(() => setQuickBarcodeNotice(null), 2500);
      setBarcodeInput('');
    } else {
      playSoundEffect('error');
      setQuickBarcodeNotice(`Code introuvable : ${code}`);
      setTimeout(() => setQuickBarcodeNotice(null), 3000);
    }
  };

  // Mode Catalogue: Validate sale
  const handleValidateSale = () => {
    if (cart.length === 0) {
      playSoundEffect('error');
      return;
    }

    if (paymentMethod === 'cash') {
      const rec = parseFloat(amountReceived) || 0;
      if (rec < cartTotal) {
        playSoundEffect('error');
        alert(`Montant reçu (${rec} F) insuffisant pour couvrir le total de ${cartTotal} F CFA.`);
        return;
      }
    }

    setIsProcessing(true);

    const customer = customers.find((c) => c.id === selectedCustomerId);

    const tx = store.completeSale({
      businessId: business.id,
      cashierId: currentUser.id,
      cashierName: currentUser.name,
      customerId: customer?.id,
      customerName: customer?.name,
      customerPhone: customer?.phone,
      items: cart.map((i) => ({
        productId: i.product.id,
        productName: i.product.name,
        barcode: i.product.barcode,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
        total: i.subtotal,
      })),
      subtotal: cartSubtotal,
      discountTotal,
      totalAmount: cartTotal,
      paymentMethod,
      amountReceived: paymentMethod === 'cash' ? numReceived : cartTotal,
      changeDue: paymentMethod === 'cash' ? changeDue : 0,
    });

    setCompletedTx(tx);
    setIsProcessing(false);

    // Reset cart
    setCart([]);
    setDiscountTotal(0);
    setAmountReceived('');
  };

  // Mode Caisse Rapide: Add item/amount to current ticket with quantity
  const handleAddDirectItem = () => {
    if (numDirectAmount <= 0) {
      playSoundEffect('error');
      alert('Veuillez saisir un montant supérieur à 0 F.');
      directInputRef.current?.focus();
      return;
    }

    const itemLabel = (directLabel && directLabel.trim().length > 0)
      ? directLabel.trim()
      : `Article ${directItems.length + 1}`;

    const itemQuantity = Math.max(1, directQuantity);

    const newItem = {
      id: `it_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      label: itemLabel,
      amount: numDirectAmount,
      quantity: itemQuantity,
    };

    setDirectItems((prev) => [...prev, newItem]);
    setDirectAmount('');
    setDirectQuantity(1); // Reset quantity back to 1 for the next item
    playSoundEffect('beep');
    setTimeout(() => {
      directInputRef.current?.focus();
    }, 50);
  };

  // Update quantity of an already added item in the accumulated ticket
  const handleUpdateDirectItemQuantity = (itemId: string, delta: number) => {
    playSoundEffect('beep');
    setDirectItems((prev) =>
      prev
        .map((it) => {
          if (it.id === itemId) {
            const nextQty = it.quantity + delta;
            return nextQty > 0 ? { ...it, quantity: nextQty } : null;
          }
          return it;
        })
        .filter((it): it is { id: string; label: string; amount: number; quantity: number } => it !== null)
    );
  };

  const handleRemoveDirectItem = (itemId: string) => {
    playSoundEffect('beep');
    setDirectItems((prev) => prev.filter((it) => it.id !== itemId));
  };

  const handleClearDirectTicket = () => {
    playSoundEffect('beep');
    setDirectItems([]);
    setDirectAmount('');
    setDirectQuantity(1);
    setDirectCashReceived('');
    setTimeout(() => {
      directInputRef.current?.focus();
    }, 50);
  };

  // Mode Caisse Rapide: Tactile numpad press
  const handleDirectNumpadPress = (val: string) => {
    playSoundEffect('beep');
    if (val === 'clear') {
      setDirectAmount('');
      setDirectQuantity(1);
      setDirectCashReceived('');
    } else if (val === 'backspace') {
      setDirectAmount((prev) => prev.slice(0, -1));
    } else if (val === '00') {
      if (directAmount && directAmount !== '0') {
        setDirectAmount((prev) => prev + '00');
      }
    } else if (val === 'add_item') {
      handleAddDirectItem();
    } else {
      // Numbers 0-9
      setDirectAmount((prev) => {
        if (prev === '0') return val;
        return prev + val;
      });
    }
  };

  // Quick preset adder (e.g. +500F, +1000F)
  const addDirectPreset = (val: number) => {
    playSoundEffect('beep');
    setDirectAmount((prev) => {
      const current = parseFloat(prev) || 0;
      return String(current + val);
    });
  };

  // Mode Caisse Rapide: Validate sale (accumulates all directItems + current typed amount and attaches cashier and customer)
  const handleValidateDirectSale = () => {
    const itemsToSale: {
      productId: string;
      productName: string;
      barcode: string;
      quantity: number;
      unitPrice: number;
      total: number;
    }[] = [];

    // 1. All accumulated ticket items
    directItems.forEach((it) => {
      itemsToSale.push({
        productId: `prod_direct_${it.id}`,
        productName: it.label,
        barcode: `EXPRESS-${it.id.slice(-6)}`,
        quantity: it.quantity,
        unitPrice: it.amount,
        total: it.amount * it.quantity,
      });
    });

    // 2. Plus any unadded amount in the input currently being typed
    if (numDirectAmount > 0) {
      const activeLabel = (directLabel && directLabel.trim().length > 0)
        ? directLabel.trim()
        : (directItems.length > 0 ? `Article ${directItems.length + 1}` : 'Vente Caisse Rapide');
      const activeQty = Math.max(1, directQuantity);
      itemsToSale.push({
        productId: `prod_direct_${Date.now()}`,
        productName: activeLabel,
        barcode: `EXPRESS-${Date.now().toString().slice(-6)}`,
        quantity: activeQty,
        unitPrice: numDirectAmount,
        total: numDirectAmount * activeQty,
      });
    }

    if (itemsToSale.length === 0) {
      playSoundEffect('error');
      alert('Veuillez saisir au moins un montant pour enregistrer la vente.');
      directInputRef.current?.focus();
      return;
    }

    const totalToPay = itemsToSale.reduce((acc, it) => acc + it.total, 0);

    if (directPaymentMethod === 'cash') {
      const rec = numDirectReceived || totalToPay;
      if (rec < totalToPay) {
        playSoundEffect('error');
        alert(`Montant remis (${rec} F) insuffisant pour régler ${totalToPay} F CFA.`);
        return;
      }
    }

    setIsProcessing(true);

    // Resolve customer information (either from directory or directly typed)
    const customer = customers.find((c) => c.id === selectedCustomerId);
    const finalCustomerName = customer?.name || (directCustomerName.trim().length > 0 ? directCustomerName.trim() : undefined);
    const finalCustomerPhone = customer?.phone || (directCustomerPhone.trim().length > 0 ? directCustomerPhone.trim() : undefined);

    const tx = store.completeSale({
      businessId: business.id,
      cashierId: currentUser.id,
      cashierName: currentUser.name,
      customerId: customer?.id,
      customerName: finalCustomerName,
      customerPhone: finalCustomerPhone,
      items: itemsToSale,
      subtotal: totalToPay,
      discountTotal: 0,
      totalAmount: totalToPay,
      paymentMethod: directPaymentMethod,
      amountReceived: directPaymentMethod === 'cash' ? (numDirectReceived || totalToPay) : totalToPay,
      changeDue: directPaymentMethod === 'cash' ? Math.max(0, (numDirectReceived || totalToPay) - totalToPay) : 0,
    });

    setCompletedTx(tx);
    setIsProcessing(false);

    // Reset direct register ready for the next customer
    setDirectItems([]);
    setDirectAmount('');
    setDirectQuantity(1);
    setDirectCashReceived('');
    setDirectCustomerName('');
    setDirectCustomerPhone('');
    setSelectedCustomerId('');
    setTimeout(() => {
      directInputRef.current?.focus();
    }, 100);
  };

  // Filter products for catalog mode
  const filteredProducts = products.filter((p) => {
    const matchesCategory = selectedCategory === 'all' || p.category === selectedCategory;
    const matchesSearch =
      searchQuery === '' ||
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.barcode.includes(searchQuery) ||
      p.code.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const selectedCustomer = customers.find((c) => c.id === selectedCustomerId);
  const recentTransactions = store.getTransactions(business.id).slice(0, 5);

  return (
    <div
      className={`flex-1 flex flex-col min-h-0 overflow-y-auto lg:overflow-hidden select-none transition-colors duration-200 ${
        isLight ? 'bg-slate-100/70 text-slate-900' : 'bg-[#05070c] text-white'
      }`}
    >
      {/* TOP DUAL-MODE SWITCHER BAR (Catalogue Articles vs Caisse Rapide Saisie Directe) */}
      <div
        className={`sticky top-0 z-20 px-3 sm:px-4 py-2 border-b flex flex-wrap items-center justify-between gap-2 sm:gap-3 shrink-0 backdrop-blur-md ${
          isLight ? 'bg-white/95 border-slate-200 shadow-2xs' : 'bg-[#080b18]/95 border-cyan-500/20'
        }`}
      >
        {/* Mode Selector Tabs */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPosMode('direct')}
            className={`px-4 py-2 rounded-xl text-xs font-black flex items-center gap-2 transition-all cursor-pointer ${
              posMode === 'direct'
                ? isLight
                  ? 'bg-amber-500 text-white shadow-md shadow-amber-500/20 scale-102'
                  : 'bg-cyan-400 text-neutral-950 font-black shadow-[0_0_18px_rgba(0,242,254,0.8)] scale-102'
                : isLight
                ? 'bg-slate-100 text-slate-600 hover:text-slate-900 hover:bg-slate-200'
                : 'bg-neutral-900 text-neutral-400 hover:text-white border border-neutral-800'
            }`}
          >
            <Zap className={`w-4 h-4 ${posMode === 'direct' ? 'fill-current' : ''}`} />
            <span>⚡ CAISSE RAPIDE (Montant Direct)</span>
            <kbd className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
              posMode === 'direct'
                ? isLight ? 'bg-amber-600 text-white' : 'bg-cyan-500 text-neutral-950'
                : isLight ? 'bg-slate-200 text-slate-700' : 'bg-neutral-800 text-neutral-300'
            }`}>
              F5
            </kbd>
          </button>

          <button
            onClick={() => setPosMode('catalog')}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
              posMode === 'catalog'
                ? isLight
                  ? 'bg-amber-500 text-white shadow-md shadow-amber-500/20 scale-102'
                  : 'bg-cyan-400 text-neutral-950 font-black shadow-[0_0_18px_rgba(0,242,254,0.8)] scale-102'
                : isLight
                ? 'bg-slate-100 text-slate-600 hover:text-slate-900 hover:bg-slate-200'
                : 'bg-neutral-900 text-neutral-400 hover:text-white border border-neutral-800'
            }`}
          >
            <ShoppingCart className="w-4 h-4" />
            <span>Rayons & Catalogue ({products.length})</span>
          </button>
        </div>

        {/* Right Tools: Print Ticket + Keyboard Shortcut */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handlePrintTicket}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all border ${
              isLight
                ? 'bg-white hover:bg-slate-50 text-slate-800 border-slate-200 shadow-2xs'
                : 'bg-[#0e1428] hover:bg-[#141b36] text-cyan-300 border-cyan-500/40 shadow-[0_0_10px_rgba(0,242,254,0.15)]'
            }`}
            title="Imprimer le dernier ticket (F12)"
          >
            <Printer className={`w-3.5 h-3.5 ${isLight ? 'text-emerald-600' : 'text-emerald-400'}`} />
            <span>Imprimer ticket</span>
            <span className="text-[10px] font-mono opacity-70">F12</span>
          </button>

          <button
            onClick={() => setShowShortcutsModal(true)}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 border ${
              isLight
                ? 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200'
                : 'bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border-neutral-700'
            }`}
            title="Raccourcis Clavier (F1)"
          >
            <Keyboard className="w-3.5 h-3.5 text-amber-500" />
            <span className="hidden sm:inline">Raccourcis</span>
            <span className="text-[10px] font-mono opacity-60">F1</span>
          </button>
        </div>
      </div>

      {/* Global Notice Toast (Impression, alertes caisse) */}
      {globalNotice && (
        <div
          className={`px-4 py-2 text-xs font-semibold flex items-center justify-between border-b transition-all shrink-0 z-30 ${
            globalNotice.type === 'error'
              ? 'bg-rose-500/15 border-rose-500/30 text-rose-500'
              : globalNotice.type === 'success'
              ? isLight
                ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                : 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300'
              : isLight
              ? 'bg-blue-50 border-blue-200 text-blue-800'
              : 'bg-cyan-950/60 border-cyan-500/30 text-cyan-300'
          }`}
        >
          <div className="flex items-center gap-2">
            <Printer className="w-4 h-4 shrink-0" />
            <span>{globalNotice.message}</span>
          </div>
          <button
            onClick={() => setGlobalNotice(null)}
            className="p-1 hover:opacity-100 opacity-60 text-sm font-bold cursor-pointer"
          >
            ×
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODULE 1: CAISSE RAPIDE DIRECTE (Saisie Clavier d'ordinateur + Tactile)   */}
      {/* ========================================================================= */}
      {posMode === 'direct' && (
        <div className="flex-1 flex flex-col lg:flex-row min-h-0 overflow-y-auto lg:overflow-hidden p-2.5 sm:p-4 gap-3 sm:gap-4">
          {/* Main Direct Cash Register Pad (Left / Center) */}
          <div className="flex-1 flex flex-col justify-between max-w-3xl mx-auto w-full space-y-3 min-h-0 overflow-y-auto pr-0 sm:pr-1">
            {/* BIG NUMERIC DISPLAY & KEYBOARD INPUT */}
            <div
              className={`p-4 sm:p-5 rounded-2xl border transition-all flex flex-col justify-between ${
                isLight
                  ? 'retail-card bg-white border-slate-300 shadow-sm'
                  : 'neon-card bg-[#0a0d1e] border-cyan-500/40 shadow-[0_0_25px_rgba(0,242,254,0.1)]'
              }`}
            >
              <div className="flex items-center justify-between text-xs mb-1">
                <span className={`font-bold uppercase tracking-wider flex items-center gap-2 ${
                  isLight ? 'text-amber-800' : 'text-cyan-400'
                }`}>
                  <Sparkles className="w-4 h-4" />
                  <span>
                    {numDirectAmount > 0
                      ? (directQuantity > 1 ? `Montant × Qté (${directQuantity})` : "Montant de l'article en cours")
                      : directItems.length > 0
                      ? "Total cumulé du ticket"
                      : "Montant de la Vente (Saisie Clavier ou Tactile)"}
                  </span>
                </span>
                <span className={`font-mono text-[11px] ${isLight ? 'text-slate-500' : 'text-neutral-400'}`}>
                  {directItems.length > 0
                    ? `${directItems.length} article(s) au ticket`
                    : "Tapez le montant sur votre clavier"}
                </span>
              </div>

              {/* Display Box */}
              <div className="relative flex flex-col justify-center py-2">
                {/* Hidden autofocus input that captures physical keyboard keystrokes effortlessly */}
                <input
                  ref={directInputRef}
                  type="text"
                  inputMode="numeric"
                  value={directAmount}
                  onChange={(e) => {
                    const clean = e.target.value.replace(/\D/g, '');
                    setDirectAmount(clean);
                  }}
                  placeholder="0"
                  className="absolute inset-0 opacity-0 cursor-default"
                  autoFocus
                />

                <div
                  onClick={() => directInputRef.current?.focus()}
                  className={`w-full font-mono font-black text-4xl sm:text-5xl md:text-6xl tracking-tight text-right select-all cursor-text py-1 ${
                    (numDirectAmount > 0 || directItems.length > 0)
                      ? isLight
                        ? 'text-slate-900'
                        : 'text-cyan-300 neon-text-cyan'
                      : isLight
                      ? 'text-slate-300'
                      : 'text-neutral-700'
                  }`}
                >
                  {numDirectAmount > 0
                    ? formatMoney(numDirectAmount * Math.max(1, directQuantity), '')
                    : directItems.length > 0
                    ? formatMoney(totalDirectToPay, '')
                    : '0'}
                  <span className={`text-xl sm:text-2xl md:text-3xl ml-2 font-bold ${
                    isLight ? 'text-amber-700' : 'text-cyan-400'
                  }`}>
                    F CFA
                  </span>
                </div>

                {numDirectAmount > 0 && directQuantity > 1 && (
                  <div className={`text-right text-xs font-mono font-bold mt-0.5 ${
                    isLight ? 'text-amber-700' : 'text-cyan-400'
                  }`}>
                    Détail : {directQuantity} × {formatMoney(numDirectAmount)} F
                  </div>
                )}
              </div>

              {/* Quick Preset Adders (+100F, +500F, etc.) */}
              <div className="flex items-center gap-1.5 overflow-x-auto pt-2 border-t border-dashed border-neutral-700/40">
                <span className={`text-[11px] font-semibold whitespace-nowrap mr-1 ${
                  isLight ? 'text-slate-500' : 'text-neutral-400'
                }`}>
                  Ajout rapide :
                </span>
                {[100, 200, 500, 1000, 2000, 5000, 10000].map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => addDirectPreset(amt)}
                    className={`px-2.5 py-1 text-xs font-mono font-bold rounded-lg border transition-all cursor-pointer whitespace-nowrap active:scale-95 ${
                      isLight
                        ? 'bg-slate-50 hover:bg-slate-100 text-slate-800 border-slate-200'
                        : 'bg-[#0f142b] hover:bg-[#151c3d] text-cyan-300 border-cyan-500/30'
                    }`}
                  >
                    +{amt >= 1000 ? `${amt / 1000}k` : amt} F
                  </button>
                ))}
              </div>
            </div>

            {/* LIBELLÉ DE L'ARTICLE, QUANTITÉ & BOUTON AJOUTER PLUSIEURS MONTANTS */}
            <div className={`p-3.5 rounded-2xl border space-y-3 transition-all ${
              isLight ? 'retail-card bg-white border-slate-200 shadow-2xs' : 'neon-card bg-[#090c1a] border-cyan-500/25'
            }`}>
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end">
                {/* Libellé de l'article (span 6) */}
                <div className="sm:col-span-6 relative">
                  <div className="flex items-center justify-between mb-1">
                    <label className={`text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5 ${
                      isLight ? 'text-slate-700' : 'text-cyan-400'
                    }`}>
                      <Tag className="w-3.5 h-3.5 text-amber-500" />
                      <span>Libellé de l'article</span>
                    </label>
                    <span className={`text-[10px] ${isLight ? 'text-slate-400' : 'text-neutral-500'}`}>
                      Personnalisable au clavier
                    </span>
                  </div>

                  <input
                    ref={directLabelInputRef}
                    type="text"
                    value={directLabel}
                    onChange={(e) => setDirectLabel(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        if (numDirectAmount > 0) {
                          handleAddDirectItem();
                        } else {
                          handleValidateDirectSale();
                        }
                      }
                    }}
                    placeholder="Saisissez le libellé (ex: Pain, Recharge Télécom, Café...)"
                    className={`w-full px-3.5 py-2 text-xs font-semibold rounded-xl border transition-all ${
                      isLight
                        ? 'bg-slate-50 border-slate-300 text-slate-900 focus:outline-hidden focus:border-amber-500 focus:bg-white shadow-2xs'
                        : 'bg-neutral-950 border-cyan-500/30 text-white focus:outline-hidden focus:border-cyan-400'
                    }`}
                  />
                </div>

                {/* Quantité de l'article (span 3) */}
                <div className="sm:col-span-3">
                  <div className="flex items-center justify-between mb-1">
                    <label className={`text-[11px] font-bold uppercase tracking-wider ${
                      isLight ? 'text-slate-700' : 'text-cyan-400'
                    }`}>
                      Quantité (Qté)
                    </label>
                    <span className="text-[10px] font-mono font-bold opacity-70">
                      x{directQuantity}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        setDirectQuantity((q) => Math.max(1, q - 1));
                        playSoundEffect('beep');
                      }}
                      className={`w-9 h-9 rounded-xl font-bold flex items-center justify-center border transition-all cursor-pointer ${
                        isLight
                          ? 'bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-300'
                          : 'bg-neutral-900 hover:bg-neutral-800 text-cyan-300 border-cyan-500/30'
                      }`}
                      title="Diminuer la quantité (-1)"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                    <input
                      type="number"
                      min="1"
                      max="999"
                      value={directQuantity}
                      onChange={(e) => {
                        const v = parseInt(e.target.value, 10);
                        setDirectQuantity(isNaN(v) || v < 1 ? 1 : v);
                      }}
                      className={`w-full h-9 text-center font-mono font-bold text-sm rounded-xl border transition-all ${
                        isLight
                          ? 'bg-slate-50 border-slate-300 text-slate-900 focus:outline-hidden focus:border-amber-500 focus:bg-white'
                          : 'bg-neutral-950 border-cyan-500/30 text-white focus:outline-hidden focus:border-cyan-400'
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setDirectQuantity((q) => q + 1);
                        playSoundEffect('beep');
                      }}
                      className={`w-9 h-9 rounded-xl font-bold flex items-center justify-center border transition-all cursor-pointer ${
                        isLight
                          ? 'bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-300'
                          : 'bg-neutral-900 hover:bg-neutral-800 text-cyan-300 border-cyan-500/30'
                      }`}
                      title="Augmenter la quantité (+1)"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Bouton pour ajouter un montant supplémentaire au ticket (span 3) */}
                <div className="sm:col-span-3">
                  <button
                    type="button"
                    onClick={handleAddDirectItem}
                    disabled={numDirectAmount <= 0}
                    className={`w-full h-9 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 border transition-all cursor-pointer whitespace-nowrap active:scale-95 shadow-xs ${
                      numDirectAmount <= 0
                        ? isLight
                          ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                          : 'bg-neutral-900 text-neutral-600 border-neutral-800 cursor-not-allowed'
                        : isLight
                        ? 'bg-amber-500 hover:bg-amber-600 text-white border-amber-600 shadow-amber-500/20'
                        : 'bg-cyan-500 hover:bg-cyan-400 text-neutral-950 border-cyan-400 shadow-[0_0_15px_rgba(0,242,254,0.4)]'
                    }`}
                    title="Ajouter ce montant au ticket pour cumuler plusieurs montants (Touche +)"
                  >
                    <Plus className="w-4 h-4 stroke-[3]" />
                    <span>Ajouter au Ticket [+]</span>
                  </button>
                </div>
              </div>

              {/* QUICK CHIPS SUGGESTIONS & QUANTITY PRESETS */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-dashed border-neutral-700/20">
                {/* Modèles de libellé */}
                <div className="flex items-center gap-1.5 overflow-x-auto">
                  <span className={`text-[10px] font-bold uppercase tracking-wider whitespace-nowrap mr-1 ${
                    isLight ? 'text-slate-400' : 'text-neutral-500'
                  }`}>
                    Modèles :
                  </span>
                  {[
                    'Vente Directe',
                    'Recharge Télécom',
                    'Alimentation',
                    'Boissons',
                    'Pain & Pâtisserie',
                    'Snacks & Biscuits',
                    'Hygiène & Soins',
                    'Divers',
                  ].map((label) => (
                    <button
                      key={label}
                      type="button"
                      onClick={() => {
                        setDirectLabel(label);
                        playSoundEffect('beep');
                      }}
                      className={`px-2 py-0.5 rounded-lg text-[11px] font-semibold whitespace-nowrap transition-colors border cursor-pointer ${
                        directLabel === label
                          ? isLight
                            ? 'bg-slate-900 text-white border-slate-900 shadow-2xs'
                            : 'bg-cyan-400 text-neutral-950 font-bold border-cyan-400 shadow-[0_0_10px_rgba(0,242,254,0.5)]'
                          : isLight
                          ? 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                          : 'bg-neutral-900 text-neutral-400 border-neutral-800 hover:text-white'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                {/* Quick quantity shortcuts */}
                <div className="flex items-center gap-1">
                  <span className={`text-[10px] font-bold uppercase tracking-wider ${
                    isLight ? 'text-slate-400' : 'text-neutral-500'
                  }`}>
                    Qté:
                  </span>
                  {[1, 2, 3, 5, 10, 12].map((q) => (
                    <button
                      key={q}
                      type="button"
                      onClick={() => {
                        setDirectQuantity(q);
                        playSoundEffect('beep');
                      }}
                      className={`px-2 py-0.5 rounded text-[11px] font-mono font-bold transition-all border cursor-pointer ${
                        directQuantity === q
                          ? isLight
                            ? 'bg-amber-500 text-white border-amber-600'
                            : 'bg-cyan-400 text-neutral-950 font-bold border-cyan-400 shadow-[0_0_8px_rgba(0,242,254,0.5)]'
                          : isLight
                          ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
                          : 'bg-neutral-900 hover:bg-neutral-800 text-neutral-300 border-neutral-800'
                      }`}
                    >
                      x{q}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* INFORMATIONS REÇU : CAISSIÈRE & NOM / NUMÉRO DU CLIENT */}
            <div className={`p-3.5 rounded-2xl border space-y-2.5 transition-all ${
              isLight ? 'retail-card bg-white border-slate-200 shadow-2xs' : 'neon-card bg-[#090c1a] border-cyan-500/25'
            }`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <UserCheck className={`w-4 h-4 ${isLight ? 'text-amber-600' : 'text-cyan-400'}`} />
                  <span className={`text-xs font-bold uppercase tracking-wider ${
                    isLight ? 'text-slate-800' : 'text-white'
                  }`}>
                    Mentions du Reçu · Caissière & Client
                  </span>
                </div>

                {/* Cashier indicator */}
                <div className={`text-xs flex items-center gap-1.5 font-semibold px-2.5 py-1 rounded-lg border ${
                  isLight
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                    : 'bg-emerald-950/40 text-emerald-300 border-emerald-500/30'
                }`}>
                  <span className="opacity-75">Caissière :</span>
                  <span className="font-bold underline">{currentUser.name}</span>
                </div>
              </div>

              {/* Customer Inputs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className={`block text-[11px] font-bold uppercase tracking-wider mb-1 ${
                    isLight ? 'text-slate-600' : 'text-neutral-400'
                  }`}>
                    Nom du Client sur le reçu
                  </label>
                  <input
                    type="text"
                    value={directCustomerName}
                    onChange={(e) => setDirectCustomerName(e.target.value)}
                    placeholder="Ex: M. Koffi, Société BTP, Client Comptoir..."
                    className={`w-full px-3 py-1.5 text-xs font-medium rounded-xl border transition-all ${
                      isLight
                        ? 'bg-slate-50 border-slate-300 text-slate-900 focus:outline-hidden focus:border-amber-500 focus:bg-white'
                        : 'bg-neutral-950 border-cyan-500/30 text-white focus:outline-hidden focus:border-cyan-400'
                    }`}
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className={`text-[11px] font-bold uppercase tracking-wider ${
                      isLight ? 'text-slate-600' : 'text-neutral-400'
                    }`}>
                      N° Téléphone Client sur le reçu
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowCustomerModal(true)}
                      className={`text-[10px] font-bold underline cursor-pointer ${
                        isLight ? 'text-amber-700 hover:text-amber-800' : 'text-cyan-400 hover:text-cyan-300'
                      }`}
                      title="Choisir un client enregistré dans le répertoire [F4]"
                    >
                      Répertoire client [F4]
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      type="text"
                      value={directCustomerPhone}
                      onChange={(e) => setDirectCustomerPhone(e.target.value)}
                      placeholder="Ex: 07 48 92 11 00"
                      className={`w-full px-3 py-1.5 text-xs font-mono font-medium rounded-xl border transition-all ${
                        isLight
                          ? 'bg-slate-50 border-slate-300 text-slate-900 focus:outline-hidden focus:border-amber-500 focus:bg-white'
                          : 'bg-neutral-950 border-cyan-500/30 text-white focus:outline-hidden focus:border-cyan-400'
                      }`}
                    />
                  </div>
                </div>
              </div>

              {/* Live receipt badge */}
              <div className={`p-2 rounded-xl text-[11px] flex flex-wrap items-center justify-between gap-1 border ${
                isLight ? 'bg-amber-50/70 border-amber-200 text-amber-950' : 'bg-cyan-950/30 border-cyan-500/40 text-cyan-200'
              }`}>
                <div className="flex items-center gap-1.5 min-w-0">
                  <Receipt className="w-3.5 h-3.5 shrink-0 text-amber-600" />
                  <span className="truncate">
                    Figurera sur le reçu : Caissière : <strong>{currentUser.name}</strong> · Client : <strong>{directCustomerName || 'Client Comptoir'}</strong> {directCustomerPhone ? `(Tél: ${directCustomerPhone})` : ''}
                  </span>
                </div>
                {(directCustomerName || directCustomerPhone || selectedCustomerId) && (
                  <button
                    type="button"
                    onClick={() => {
                      setDirectCustomerName('');
                      setDirectCustomerPhone('');
                      setSelectedCustomerId('');
                      playSoundEffect('beep');
                    }}
                    className="text-[10px] underline shrink-0 opacity-70 hover:opacity-100 cursor-pointer"
                  >
                    Effacer client
                  </button>
                )}
              </div>
            </div>

            {/* TICKET MULTI-MONTANTS CUMULÉS (WHEN DIRECT ITEMS EXIST) */}
            {directItems.length > 0 && (
              <div className={`p-4 rounded-2xl border space-y-3 transition-all ${
                isLight
                  ? 'bg-amber-50/50 border-amber-200 shadow-2xs'
                  : 'bg-[#0c1024] border-cyan-500/30 shadow-[0_0_15px_rgba(0,242,254,0.06)]'
              }`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Receipt className={`w-4 h-4 ${isLight ? 'text-amber-700' : 'text-cyan-400'}`} />
                    <span className={`text-xs font-extrabold uppercase tracking-wider ${
                      isLight ? 'text-slate-900' : 'text-white'
                    }`}>
                      Ticket en cours ({directItems.length} article{directItems.length > 1 ? 's' : ''})
                    </span>
                    <span className={`px-2 py-0.5 rounded text-[11px] font-mono font-bold ${
                      isLight ? 'bg-amber-200 text-amber-950' : 'bg-cyan-950 text-cyan-300 border border-cyan-500/40'
                    }`}>
                      Sous-total : {formatMoney(directItemsSum)}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={handleClearDirectTicket}
                    className={`text-xs flex items-center gap-1 font-semibold transition-colors cursor-pointer px-2 py-1 rounded hover:bg-rose-500/10 ${
                      isLight ? 'text-rose-600' : 'text-rose-400'
                    }`}
                    title="Vider tous les articles du ticket"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Vider le ticket</span>
                  </button>
                </div>

                {/* List of accumulated amounts with quantity steppers */}
                <div className="max-h-44 overflow-y-auto space-y-1.5 pr-1 divide-y divide-dashed divide-neutral-200 dark:divide-neutral-800">
                  {directItems.map((item, idx) => (
                    <div
                      key={item.id}
                      className="pt-1.5 first:pt-0 flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-mono font-bold shrink-0 ${
                          isLight ? 'bg-amber-200/80 text-amber-900' : 'bg-cyan-950 text-cyan-300'
                        }`}>
                          {idx + 1}
                        </span>
                        <span className={`font-semibold truncate ${
                          isLight ? 'text-slate-800' : 'text-neutral-200'
                        }`}>
                          {item.label}
                        </span>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        {/* Inline quantity control in ticket */}
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleUpdateDirectItemQuantity(item.id, -1)}
                            className={`w-5 h-5 rounded flex items-center justify-center border font-bold text-[10px] cursor-pointer ${
                              isLight ? 'bg-slate-100 hover:bg-slate-200 border-slate-300' : 'bg-neutral-800 hover:bg-neutral-700 border-neutral-700'
                            }`}
                            title="Diminuer la quantité (-1)"
                          >
                            -
                          </button>
                          <span className="font-mono font-bold px-1 text-[11px]">
                            {item.quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleUpdateDirectItemQuantity(item.id, 1)}
                            className={`w-5 h-5 rounded flex items-center justify-center border font-bold text-[10px] cursor-pointer ${
                              isLight ? 'bg-slate-100 hover:bg-slate-200 border-slate-300' : 'bg-neutral-800 hover:bg-neutral-700 border-neutral-700'
                            }`}
                            title="Augmenter la quantité (+1)"
                          >
                            +
                          </button>
                        </div>

                        <span className={`font-mono font-bold ${
                          isLight ? 'text-slate-900' : 'text-cyan-300'
                        }`}>
                          {formatMoney(item.amount * item.quantity)}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRemoveDirectItem(item.id)}
                          className="p-1 rounded hover:bg-rose-500/20 text-rose-500 transition-colors cursor-pointer"
                          title="Supprimer cette ligne"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* TACTILE NUMPAD (Large touchable buttons) */}
            <div className="grid grid-cols-4 gap-2.5">
              {[
                { label: '7', val: '7' },
                { label: '8', val: '8' },
                { label: '9', val: '9' },
                { label: '⌫', val: 'backspace', isAction: true },
                { label: '4', val: '4' },
                { label: '5', val: '5' },
                { label: '6', val: '6' },
                { label: 'C', val: 'clear', isAction: true, isDanger: true },
                { label: '1', val: '1' },
                { label: '2', val: '2' },
                { label: '3', val: '3' },
                { label: '00', val: '00' },
                { label: '0', val: '0' },
                { label: '+ Ajouter [Touche +]', val: 'add_item', isAdd: true, colSpan: 'col-span-2' },
                { label: 'Appoint [Espace]', val: 'exact', isExact: true, colSpan: 'col-span-1' },
              ].map((btn, idx) => {
                if (btn.isExact) {
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        setDirectCashReceived(String(totalDirectToPay));
                        playSoundEffect('beep');
                      }}
                      className={`${btn.colSpan || ''} py-3 px-2 rounded-xl font-bold text-xs flex items-center justify-center gap-1 border transition-all cursor-pointer active:scale-95 ${
                        isLight
                          ? 'bg-amber-50 hover:bg-amber-100 text-amber-800 border-amber-300'
                          : 'bg-cyan-950/40 hover:bg-cyan-900/60 text-cyan-300 border-cyan-500/40'
                      }`}
                      title="Saisir automatiquement le montant exact [Espace]"
                    >
                      <span>Appoint</span>
                    </button>
                  );
                }

                if (btn.isAdd) {
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleAddDirectItem()}
                      className={`${btn.colSpan || ''} py-3 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 border transition-all cursor-pointer active:scale-95 ${
                        isLight
                          ? 'bg-amber-500 hover:bg-amber-600 text-white border-amber-600 shadow-xs'
                          : 'bg-cyan-500 hover:bg-cyan-400 text-neutral-950 font-bold border-cyan-400 shadow-[0_0_15px_rgba(0,242,254,0.4)]'
                      }`}
                      title="Ajouter ce montant au ticket en cours (Touche +)"
                    >
                      <Plus className="w-4 h-4 stroke-[3]" />
                      <span>Ajouter Montant [+]</span>
                    </button>
                  );
                }

                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleDirectNumpadPress(btn.val)}
                    className={`${btn.colSpan || ''} py-3.5 rounded-xl font-mono text-xl md:text-2xl font-bold flex items-center justify-center border transition-all cursor-pointer active:scale-95 ${
                      btn.isDanger
                        ? isLight
                          ? 'bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-300'
                          : 'bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border-rose-800'
                        : btn.isAction
                        ? isLight
                          ? 'bg-slate-200 hover:bg-slate-300 text-slate-800 border-slate-300'
                          : 'bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border-neutral-700'
                        : isLight
                        ? 'bg-white hover:bg-slate-50 text-slate-900 border-slate-200 shadow-2xs'
                        : 'bg-[#0d1020] hover:bg-[#141933] text-white border-cyan-500/25 shadow-[0_0_8px_rgba(0,242,254,0.05)]'
                    }`}
                  >
                    {btn.label}
                  </button>
                );
              })}
            </div>

            {/* PAYMENT METHOD SELECTOR TABS */}
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => {
                  setDirectPaymentMethod('cash');
                  playSoundEffect('beep');
                }}
                className={`p-3 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
                  directPaymentMethod === 'cash'
                    ? isLight
                      ? 'bg-emerald-50 border-emerald-500 text-emerald-900 font-bold shadow-xs'
                      : 'bg-emerald-950/50 border-emerald-400 text-emerald-300 font-bold shadow-[0_0_15px_rgba(16,185,129,0.3)]'
                    : isLight
                    ? 'bg-white border-slate-200 text-slate-600'
                    : 'bg-[#0a0d1e] border-neutral-800 text-neutral-400'
                }`}
              >
                <Banknote className="w-5 h-5 text-emerald-500" />
                <span className="text-xs">Espèces (Cash)</span>
                <span className="text-[10px] font-mono opacity-60">F9</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setDirectPaymentMethod('mobile_money');
                  playSoundEffect('beep');
                }}
                className={`p-3 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
                  directPaymentMethod === 'mobile_money'
                    ? isLight
                      ? 'bg-cyan-50 border-cyan-500 text-cyan-900 font-bold shadow-xs'
                      : 'bg-cyan-950/50 border-cyan-400 text-cyan-300 font-bold shadow-[0_0_15px_rgba(0,242,254,0.3)]'
                    : isLight
                    ? 'bg-white border-slate-200 text-slate-600'
                    : 'bg-[#0a0d1e] border-neutral-800 text-neutral-400'
                }`}
              >
                <Smartphone className="w-5 h-5 text-cyan-500" />
                <span className="text-xs">Mobile Money</span>
                <span className="text-[10px] font-mono opacity-60">F10</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setDirectPaymentMethod('card');
                  playSoundEffect('beep');
                }}
                className={`p-3 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
                  directPaymentMethod === 'card'
                    ? isLight
                      ? 'bg-purple-50 border-purple-500 text-purple-900 font-bold shadow-xs'
                      : 'bg-purple-950/50 border-purple-400 text-purple-300 font-bold shadow-[0_0_15px_rgba(168,85,247,0.3)]'
                    : isLight
                    ? 'bg-white border-slate-200 text-slate-600'
                    : 'bg-[#0a0d1e] border-neutral-800 text-neutral-400'
                }`}
              >
                <CreditCard className="w-5 h-5 text-purple-500" />
                <span className="text-xs">Carte Bancaire</span>
                <span className="text-[10px] font-mono opacity-60">F11</span>
              </button>
            </div>

            {/* CASH TENDER & CHANGE DUE BAR (when cash is selected) */}
            {directPaymentMethod === 'cash' && (
              <div
                className={`p-3.5 rounded-xl border flex flex-col sm:flex-row items-center justify-between gap-3 ${
                  isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#090c1a] border-cyan-500/25'
                }`}
              >
                {/* Cash received input */}
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <span className={`text-xs font-semibold whitespace-nowrap ${
                    isLight ? 'text-slate-600' : 'text-neutral-400'
                  }`}>
                    Espèces Remises :
                  </span>
                  <input
                    type="number"
                    value={directCashReceived}
                    onChange={(e) => setDirectCashReceived(e.target.value)}
                    placeholder={String(totalDirectToPay || 0)}
                    className={`w-32 px-3 py-1.5 rounded-lg font-mono text-sm font-bold transition-colors ${
                      isLight
                        ? 'bg-white border border-slate-300 text-slate-900 focus:outline-hidden focus:border-amber-500'
                        : 'bg-neutral-950 border border-cyan-500/30 text-white focus:outline-hidden focus:border-cyan-400'
                    }`}
                  />
                  <span className="text-xs font-mono font-bold">F</span>
                </div>

                {/* Quick bills */}
                <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto justify-end">
                  {[500, 1000, 2000, 5000, 10000].map((bill) => (
                    <button
                      key={bill}
                      type="button"
                      onClick={() => {
                        setDirectCashReceived(String(bill));
                        playSoundEffect('beep');
                      }}
                      className={`px-2 py-1 text-xs font-mono font-semibold rounded border cursor-pointer ${
                        isLight
                          ? 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200'
                          : 'bg-[#0d1020] hover:bg-[#141933] text-neutral-300 border-neutral-700'
                      }`}
                    >
                      {bill >= 1000 ? `${bill / 1000}k` : bill}
                    </button>
                  ))}
                </div>

                {/* Change due pill */}
                <div className={`px-3 py-1.5 rounded-lg border font-mono font-bold text-xs flex items-center gap-2 shrink-0 ${
                  directChangeDue > 0
                    ? isLight
                      ? 'bg-emerald-100 border-emerald-300 text-emerald-800'
                      : 'bg-emerald-950/60 border-emerald-500 text-emerald-300 shadow-[0_0_10px_rgba(16,185,129,0.4)]'
                    : isLight
                    ? 'bg-slate-200/60 border-slate-300 text-slate-500'
                    : 'bg-neutral-900 border-neutral-800 text-neutral-500'
                }`}>
                  <span>Monnaie à rendre :</span>
                  <span className="text-sm font-black">{formatMoney(directChangeDue)}</span>
                </div>
              </div>
            )}

            {/* BIG VALIDATION BUTTON */}
            <button
              type="button"
              onClick={handleValidateDirectSale}
              disabled={totalDirectToPay <= 0 || isProcessing}
              className={`w-full py-4 px-6 rounded-2xl font-black text-base flex items-center justify-center gap-3 transition-all cursor-pointer shadow-lg active:scale-[0.99] ${
                totalDirectToPay <= 0
                  ? isLight
                    ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                    : 'bg-neutral-900 text-neutral-600 cursor-not-allowed border border-neutral-800'
                  : isLight
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/30'
                  : 'bg-gradient-to-r from-emerald-400 via-cyan-400 to-emerald-400 text-neutral-950 font-black shadow-[0_0_25px_rgba(16,185,129,0.6)]'
              }`}
            >
              <Check className="w-6 h-6 stroke-[3]" />
              <span>ENCAISSER & VALIDER LE TICKET [Entrée ↵]</span>
              <span className="text-sm font-mono opacity-80">
                ({formatMoney(totalDirectToPay)} · {totalDirectItemsCount} art.)
              </span>
            </button>
          </div>

          {/* RIGHT SIDEBAR: RECENT SALES TICKETS & LIVE AUDIT */}
          <div
            className={`w-full lg:w-80 rounded-2xl border p-4 flex flex-col justify-between space-y-4 shrink-0 overflow-y-auto ${
              isLight ? 'retail-card bg-white border-slate-200' : 'neon-card bg-[#0a0d1e] border-cyan-500/25'
            }`}
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-neutral-700/30">
                <div className="flex items-center gap-2">
                  <Receipt className={`w-4 h-4 ${isLight ? 'text-amber-600' : 'text-cyan-400'}`} />
                  <h3 className={`text-xs font-bold uppercase tracking-wider ${
                    isLight ? 'text-slate-900' : 'text-white'
                  }`}>
                    Dernières Ventes Caissier
                  </h3>
                </div>
                <span className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
                  isLight
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                    : 'bg-emerald-950/40 text-emerald-400 border-emerald-800'
                }`}>
                  +20 F / vente
                </span>
              </div>

              {/* Transactions stream */}
              <div className="space-y-2">
                {recentTransactions.length === 0 ? (
                  <p className="text-xs text-neutral-400 text-center py-6">
                    Aucune vente enregistrée pour le moment.
                  </p>
                ) : (
                  recentTransactions.map((tx) => (
                    <div
                      key={tx.id}
                      onClick={() => setCompletedTx(tx)}
                      className={`p-2.5 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                        isLight
                          ? 'bg-slate-50 hover:bg-slate-100 border-slate-200'
                          : 'bg-[#060812] hover:bg-[#0c1022] border-cyan-500/20'
                      }`}
                      title="Cliquer pour réimprimer ce ticket"
                    >
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className={`text-xs font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>
                            {tx.ticketNumber}
                          </span>
                          <span className="text-[10px] opacity-60 font-mono">
                            {tx.timestamp.slice(11, 16)}
                          </span>
                        </div>
                        <p className={`text-[11px] truncate max-w-[150px] ${
                          isLight ? 'text-slate-500' : 'text-neutral-400'
                        }`}>
                          {tx.items.length > 1
                            ? `${tx.items[0]?.productName} (+${tx.items.length - 1} art.)`
                            : (tx.items[0]?.productName || 'Vente')}
                        </p>
                      </div>

                      <div className="text-right">
                        <span className={`text-xs font-bold font-mono ${
                          isLight ? 'text-emerald-700' : 'text-emerald-400'
                        }`}>
                          {formatMoney(tx.totalAmount)}
                        </span>
                        <div className="text-[9px] font-mono text-purple-500 font-semibold">
                          +20 F
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Quick Helper Tips */}
            <div className={`p-3 rounded-xl border text-[11px] space-y-1.5 ${
              isLight ? 'bg-amber-50/70 border-amber-200 text-amber-900' : 'bg-[#080b18] border-cyan-500/20 text-neutral-300'
            }`}>
              <div className="flex items-center gap-1.5 font-bold">
                <Keyboard className="w-3.5 h-3.5 text-amber-500" />
                <span>Commandes clavier directes :</span>
              </div>
              <ul className="space-y-1 opacity-90 pl-1">
                <li>• <kbd className="font-mono font-bold">Chiffres</kbd> : taper le montant</li>
                <li>• <kbd className="font-mono font-bold">+</kbd> : cumuler plusieurs montants</li>
                <li>• <kbd className="font-mono font-bold">Entrée</kbd> : valider le ticket</li>
                <li>• <kbd className="font-mono font-bold">Espace</kbd> : appoint exact</li>
                <li>• <kbd className="font-mono font-bold">F12</kbd> : imprimer ticket thermique</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODULE 2: CATALOGUE D'ARTICLES & SCANNER CODE-BARRES                     */}
      {/* ========================================================================= */}
      {posMode === 'catalog' && (
        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
          {/* LEFT AREA: Catalog, Touch product buttons, Barcode scanner */}
          <div
            className={`flex-1 flex flex-col border-r overflow-hidden ${
              isLight ? 'border-slate-200 bg-slate-50/50' : 'border-cyan-500/20 bg-[#070913]'
            }`}
          >
            {/* Top Control Bar: Search + Barcode Scanner */}
            <div
              className={`p-3 border-b flex flex-wrap items-center gap-2.5 transition-colors ${
                isLight ? 'bg-white border-slate-200 shadow-2xs' : 'bg-[#090d1c] border-cyan-500/20'
              }`}
            >
              {/* Product search (F2) */}
              <div className="relative flex-1 min-w-[200px]">
                <Search
                  className={`w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 ${
                    isLight ? 'text-slate-400' : 'text-neutral-400'
                  }`}
                />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Rechercher produit (F2)..."
                  className={`w-full pl-9 pr-14 py-2 rounded-lg text-xs transition-colors focus:outline-hidden ${
                    isLight
                      ? 'bg-slate-50 border border-slate-200 text-slate-900 placeholder-slate-400 focus:border-amber-500 focus:bg-white'
                      : 'bg-[#060812] border border-cyan-500/30 text-white placeholder-neutral-500 focus:border-cyan-400 focus:shadow-[0_0_10px_rgba(0,242,254,0.3)]'
                  }`}
                />
                <span
                  className={`absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-mono px-1.5 py-0.5 rounded border ${
                    isLight
                      ? 'text-slate-500 bg-slate-100 border-slate-200'
                      : 'text-neutral-400 bg-neutral-900 border-neutral-800'
                  }`}
                >
                  F2
                </span>
              </div>

              {/* Barcode scanner input (F3) */}
              <form onSubmit={handleBarcodeSubmit} className="relative flex-1 min-w-[220px]">
                <Barcode
                  className={`w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 ${
                    isLight ? 'text-amber-600' : 'text-cyan-400'
                  }`}
                />
                <input
                  ref={barcodeInputRef}
                  type="text"
                  value={barcodeInput}
                  onChange={(e) => setBarcodeInput(e.target.value)}
                  placeholder="Scanner code-barres (F3)..."
                  className={`w-full pl-9 pr-14 py-2 rounded-lg text-xs font-mono transition-colors focus:outline-hidden ${
                    isLight
                      ? 'bg-slate-50 border border-amber-300 text-amber-900 placeholder-slate-400 focus:border-amber-500 focus:bg-white'
                      : 'bg-[#060812] border border-cyan-400/50 text-cyan-300 placeholder-neutral-500 focus:border-cyan-400 focus:shadow-[0_0_12px_rgba(0,242,254,0.4)]'
                  }`}
                />
                <button
                  type="submit"
                  className={`absolute right-1 top-1/2 -translate-y-1/2 px-2.5 py-1 text-[10px] font-bold rounded transition-colors ${
                    isLight
                      ? 'bg-amber-500 hover:bg-amber-600 text-white shadow-2xs'
                      : 'bg-cyan-400 hover:bg-cyan-300 text-neutral-950 shadow-[0_0_8px_rgba(0,242,254,0.7)]'
                  }`}
                >
                  Scan
                </button>
              </form>
            </div>

            {/* Barcode feedback notice banner if present */}
            {quickBarcodeNotice && (
              <div
                className={`px-4 py-1.5 border-b text-xs flex items-center gap-2 ${
                  isLight
                    ? 'bg-amber-50 border-amber-200 text-amber-800'
                    : 'bg-cyan-950/40 border-cyan-500/30 text-cyan-300'
                }`}
              >
                <Zap className="w-3.5 h-3.5 shrink-0" />
                <span className="font-mono">{quickBarcodeNotice}</span>
              </div>
            )}

            {/* Category Tabs */}
            <div
              className={`px-3 py-2.5 border-b flex items-center gap-1.5 overflow-x-auto ${
                isLight ? 'bg-white/80 border-slate-200' : 'bg-[#060812] border-cyan-500/20'
              }`}
            >
              {categories.map((cat) => {
                const isActive = selectedCategory === cat;
                return (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all border ${
                      isActive
                        ? isLight
                          ? 'bg-amber-500 border-amber-500 text-white shadow-xs'
                          : 'bg-cyan-400 border-cyan-300 text-neutral-950 shadow-[0_0_15px_rgba(0,242,254,0.7)]'
                        : isLight
                        ? 'bg-white border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                        : 'bg-[#0b0e1d] border-cyan-500/20 text-neutral-400 hover:text-cyan-300'
                    }`}
                  >
                    {cat === 'all' ? 'Tous les rayons' : cat}
                  </button>
                );
              })}
            </div>

            {/* Product Grid */}
            <div className="flex-1 p-3 overflow-y-auto">
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 xl:grid-cols-4 gap-3">
                {filteredProducts.map((p) => {
                  const isLowStock = p.stock <= p.minStockAlert;
                  const isOutOfStock = p.stock === 0;

                  return (
                    <button
                      key={p.id}
                      onClick={() => addToCart(p, 1)}
                      disabled={isOutOfStock}
                      className={`group relative text-left p-3 rounded-xl border flex flex-col justify-between transition-all active:scale-[0.98] ${
                        isOutOfStock
                          ? 'opacity-40 cursor-not-allowed bg-neutral-900/40 border-neutral-800'
                          : isLight
                          ? 'retail-card bg-white border-slate-200 hover:border-amber-400 hover:shadow-md'
                          : 'neon-card bg-[#0b0f22] border-cyan-500/25 hover:border-cyan-400 hover:shadow-[0_0_18px_rgba(0,242,254,0.25)]'
                      }`}
                    >
                      <div>
                        <div className="flex items-start justify-between gap-1 mb-1">
                          <span
                            className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                              isLight ? 'bg-slate-100 text-slate-600' : 'bg-neutral-900 text-neutral-400'
                            }`}
                          >
                            {p.code}
                          </span>
                          <span
                            className={`text-[10px] font-mono px-1.5 py-0.5 rounded font-bold ${
                              isOutOfStock
                                ? 'bg-rose-500/20 text-rose-400'
                                : isLowStock
                                ? 'bg-amber-500/20 text-amber-400'
                                : isLight
                                ? 'bg-emerald-50 text-emerald-700'
                                : 'bg-emerald-500/20 text-emerald-400'
                            }`}
                          >
                            {p.stock} {p.unit}
                          </span>
                        </div>
                        <h4
                          className={`text-xs font-bold line-clamp-2 leading-tight ${
                            isLight ? 'text-slate-900' : 'text-white'
                          }`}
                        >
                          {p.name}
                        </h4>
                      </div>

                      <div className="mt-3 pt-2 border-t border-neutral-700/20 flex items-center justify-between">
                        <span
                          className={`font-mono font-extrabold text-sm tabular-nums ${
                            isLight ? 'text-amber-700' : 'text-cyan-300'
                          }`}
                        >
                          {formatMoney(p.salePrice)}
                        </span>
                        <div
                          className={`w-6 h-6 rounded-md flex items-center justify-center transition-colors ${
                            isLight
                              ? 'bg-amber-100 group-hover:bg-amber-500 text-amber-800 group-hover:text-white'
                              : 'bg-cyan-500/20 group-hover:bg-cyan-400 text-cyan-300 group-hover:text-neutral-950'
                          }`}
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* RIGHT AREA: Cart & Checkout Ticket */}
          <div
            className={`w-full lg:w-96 flex flex-col justify-between shrink-0 overflow-hidden ${
              isLight ? 'bg-white' : 'bg-[#070913]'
            }`}
          >
            {/* Header Ticket */}
            <div
              className={`p-3.5 border-b flex items-center justify-between ${
                isLight ? 'border-slate-200 bg-slate-50/80' : 'border-cyan-500/20 bg-[#090d1c]'
              }`}
            >
              <div className="flex items-center gap-2">
                <ShoppingCart className={`w-4 h-4 ${isLight ? 'text-amber-600' : 'text-cyan-400'}`} />
                <h3 className="text-xs font-bold tracking-tight">Panier & Ticket ({cart.length})</h3>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowCustomerModal(true)}
                  className={`px-2 py-1 rounded text-xs flex items-center gap-1 border ${
                    selectedCustomerId
                      ? isLight
                        ? 'bg-amber-100 text-amber-900 border-amber-300 font-bold'
                        : 'bg-cyan-950/40 text-cyan-300 border-cyan-500/50 font-bold'
                      : isLight
                      ? 'bg-white text-slate-600 border-slate-200'
                      : 'bg-neutral-800 text-neutral-300 border-neutral-700'
                  }`}
                  title="Assigner un client au ticket (F4)"
                >
                  <UserCheck className="w-3 h-3" />
                  <span className="truncate max-w-[80px]">
                    {selectedCustomer ? selectedCustomer.name.split(' ')[0] : 'Client'}
                  </span>
                  <span className="text-[9px] opacity-60">F4</span>
                </button>

                {cart.length > 0 && (
                  <button
                    onClick={clearCart}
                    className={`p-1.5 rounded transition-colors ${
                      isLight
                        ? 'text-slate-400 hover:text-rose-600 hover:bg-rose-50'
                        : 'text-neutral-500 hover:text-rose-400 hover:bg-neutral-800'
                    }`}
                    title="Vider le panier (Échap)"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Cart Items List */}
            <div className="flex-1 overflow-y-auto divide-y divide-neutral-700/20 p-2 space-y-1">
              {cart.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center p-6 text-center space-y-2 opacity-50">
                  <ShoppingCart className="w-10 h-10 stroke-1" />
                  <p className="text-xs">Panier vide. Touchez un article ou scannez un code-barres.</p>
                </div>
              ) : (
                cart.map((item) => (
                  <div key={item.product.id} className="p-2 flex items-center justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-bold truncate">{item.product.name}</div>
                      <div className="text-[11px] opacity-70 font-mono">
                        {item.quantity} × {formatMoney(item.unitPrice)}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <div className="flex items-center border rounded-lg overflow-hidden border-neutral-700/40">
                        <button
                          onClick={() => updateQuantity(item.product.id, -1)}
                          className="px-2 py-1 hover:bg-neutral-700/30 text-xs"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="px-2 font-mono text-xs font-bold">{item.quantity}</span>
                        <button
                          onClick={() => updateQuantity(item.product.id, 1)}
                          className="px-2 py-1 hover:bg-neutral-700/30 text-xs"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>

                      <div className="font-mono font-bold text-xs tabular-nums text-right w-16">
                        {formatMoney(item.subtotal)}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Cart Calculations & Tender Footer */}
            <div
              className={`p-3.5 border-t space-y-2.5 ${
                isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#080b18] border-cyan-500/20'
              }`}
            >
              <div className="space-y-1 text-xs">
                <div className="flex justify-between text-neutral-400">
                  <span>Sous-total</span>
                  <span className="font-mono">{formatMoney(cartSubtotal)}</span>
                </div>

                <div className="flex justify-between items-center text-sm font-black pt-1 border-t border-neutral-700/30">
                  <span>TOTAL :</span>
                  <span className={`font-mono text-base font-black ${
                    isLight ? 'text-amber-800' : 'text-cyan-300'
                  }`}>
                    {formatMoney(cartTotal)}
                  </span>
                </div>
              </div>

              {/* Payment Method Selector */}
              <div className="grid grid-cols-3 gap-1.5 pt-1">
                <button
                  type="button"
                  onClick={() => setPaymentMethod('cash')}
                  className={`py-1.5 px-2 rounded-lg text-xs font-bold border flex items-center justify-center gap-1 transition-colors ${
                    paymentMethod === 'cash'
                      ? isLight ? 'bg-emerald-500 text-white border-emerald-500' : 'bg-emerald-400 text-neutral-950 font-black border-emerald-400'
                      : isLight ? 'bg-white border-slate-200 text-slate-700' : 'bg-neutral-900 border-neutral-800 text-neutral-400'
                  }`}
                >
                  <Banknote className="w-3.5 h-3.5" />
                  <span>Espèces [F9]</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentMethod('mobile_money')}
                  className={`py-1.5 px-2 rounded-lg text-xs font-bold border flex items-center justify-center gap-1 transition-colors ${
                    paymentMethod === 'mobile_money'
                      ? isLight ? 'bg-cyan-500 text-white border-cyan-500' : 'bg-cyan-400 text-neutral-950 font-black border-cyan-400'
                      : isLight ? 'bg-white border-slate-200 text-slate-700' : 'bg-neutral-900 border-neutral-800 text-neutral-400'
                  }`}
                >
                  <Smartphone className="w-3.5 h-3.5" />
                  <span>Wave / OM [F10]</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentMethod('card')}
                  className={`py-1.5 px-2 rounded-lg text-xs font-bold border flex items-center justify-center gap-1 transition-colors ${
                    paymentMethod === 'card'
                      ? isLight ? 'bg-purple-500 text-white border-purple-500' : 'bg-purple-400 text-neutral-950 font-black border-purple-400'
                      : isLight ? 'bg-white border-slate-200 text-slate-700' : 'bg-neutral-900 border-neutral-800 text-neutral-400'
                  }`}
                >
                  <CreditCard className="w-3.5 h-3.5" />
                  <span>Carte [F11]</span>
                </button>
              </div>

              {/* Big Validate Button */}
              <button
                type="button"
                onClick={handleValidateSale}
                disabled={cart.length === 0 || isProcessing}
                className={`w-full py-3.5 px-4 rounded-xl font-black text-sm flex items-center justify-center gap-2 transition-all shadow-md active:scale-[0.99] cursor-pointer ${
                  cart.length === 0
                    ? isLight
                      ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                      : 'bg-neutral-900 text-neutral-600 cursor-not-allowed'
                    : isLight
                    ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/20'
                    : 'bg-gradient-to-r from-emerald-400 via-cyan-400 to-emerald-400 text-neutral-950 font-black shadow-[0_0_20px_rgba(16,185,129,0.5)]'
                }`}
              >
                <Check className="w-5 h-5 stroke-[3]" />
                <span>VALIDER & IMPRIMER [Entrée]</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Customer Selection Modal */}
      {showCustomerModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div
            className={`rounded-2xl max-w-md w-full p-5 space-y-4 shadow-2xl border ${
              isLight ? 'bg-white border-slate-200 text-slate-900' : 'bg-[#0d1020] border-cyan-500/40 text-white'
            }`}
          >
            <div className={`flex items-center justify-between pb-2 border-b ${
              isLight ? 'border-slate-100' : 'border-neutral-800'
            }`}>
              <h3 className="text-sm font-bold flex items-center gap-2">
                <UserCheck className={`w-4 h-4 ${isLight ? 'text-amber-600' : 'text-cyan-400'}`} />
                <span>Sélectionner le Client</span>
              </h3>
              <button onClick={() => setShowCustomerModal(false)} className="opacity-60 hover:opacity-100">
                ✕
              </button>
            </div>

            <div className="space-y-2 max-h-60 overflow-y-auto">
              <button
                onClick={() => {
                  setSelectedCustomerId('');
                  setDirectCustomerName('');
                  setDirectCustomerPhone('');
                  setShowCustomerModal(false);
                }}
                className={`w-full text-left p-2.5 rounded-lg border text-xs transition-colors ${
                  selectedCustomerId === '' && !directCustomerName
                    ? isLight
                      ? 'border-amber-500 bg-amber-50 font-bold text-amber-900'
                      : 'border-cyan-400 bg-cyan-950/40 font-bold text-cyan-300'
                    : isLight
                    ? 'border-slate-200 bg-slate-50 hover:bg-slate-100'
                    : 'border-neutral-800 bg-[#060812] hover:bg-neutral-850'
                }`}
              >
                Client de passage / Anonyme (Comptoir)
              </button>

              {customers.map((c) => (
                <button
                  key={c.id}
                  onClick={() => {
                    setSelectedCustomerId(c.id);
                    setDirectCustomerName(c.name);
                    setDirectCustomerPhone(c.phone);
                    setShowCustomerModal(false);
                  }}
                  className={`w-full text-left p-2.5 rounded-lg border text-xs transition-colors flex justify-between items-center ${
                    selectedCustomerId === c.id
                      ? isLight
                        ? 'border-amber-500 bg-amber-50 font-bold text-amber-900'
                        : 'border-cyan-400 bg-cyan-950/40 font-bold text-cyan-300'
                      : isLight
                      ? 'border-slate-200 bg-slate-50 hover:bg-slate-100'
                      : 'border-neutral-800 bg-[#060812] hover:bg-neutral-850'
                  }`}
                >
                  <div>
                    <span className="font-bold block">{c.name}</span>
                    <span className="text-[11px] opacity-70 font-mono">{c.phone}</span>
                  </div>
                  {c.creditBalance > 0 && (
                    <span className="text-[11px] font-mono text-rose-500 font-bold bg-rose-500/10 px-2 py-0.5 rounded border border-rose-300">
                      Dette: {formatMoney(c.creditBalance)}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Keyboard Shortcuts Modal */}
      {showShortcutsModal && <KeyboardShortcutsModal onClose={() => setShowShortcutsModal(false)} />}

      {/* Receipt Modal on Successful Checkout */}
      {completedTx && (
        <ReceiptModal
          transaction={completedTx}
          business={business}
          onClose={() => setCompletedTx(null)}
        />
      )}
    </div>
  );
};
