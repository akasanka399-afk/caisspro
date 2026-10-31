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
  Camera,
  ScanLine,
  BookOpen,
} from 'lucide-react';
import { ReceiptModal } from './ReceiptModal';
import { KeyboardShortcutsModal } from './KeyboardShortcutsModal';
import { CameraBarcodeScannerModal } from './CameraBarcodeScannerModal';
import { printThermalReceipt } from '../utils/printReceipt';

export const DIRECT_LABEL_PRESETS = [
  'Vente Directe',
  'Recharge Télécom',
  'Pain & Pâtisserie',
  'Boissons',
  'Alimentation',
  'Divers',
];

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
  const [showCameraScannerModal, setShowCameraScannerModal] = useState<boolean>(false);
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
      } else if (e.key === 'F2') {
        e.preventDefault();
        if (posMode === 'direct') {
          directLabelInputRef.current?.focus();
          directLabelInputRef.current?.select();
          playSoundEffect('beep');
        } else {
          searchInputRef.current?.focus();
          searchInputRef.current?.select();
        }
      } else if (e.key === 'F6') {
        // Dedicated shortcut for Libellé Article
        e.preventDefault();
        if (posMode !== 'direct') {
          setPosMode('direct');
        }
        setTimeout(() => {
          directLabelInputRef.current?.focus();
          directLabelInputRef.current?.select();
        }, 50);
        playSoundEffect('beep');
      } else if (e.key === 'F7' && posMode === 'direct') {
        // Quick quantity increment shortcut
        e.preventDefault();
        setDirectQuantity((q) => (q >= 12 ? 1 : q + 1));
        playSoundEffect('beep');
      } else if (posMode === 'direct' && e.altKey && !e.ctrlKey && !e.metaKey) {
        // Quick label presets via Alt+1 to Alt+6
        let digit = parseInt(e.key, 10);
        if (isNaN(digit)) {
          const match = e.code.match(/(?:Digit|Numpad)([1-6])/);
          if (match) digit = parseInt(match[1], 10);
        }
        if (!isNaN(digit) && digit >= 1 && digit <= DIRECT_LABEL_PRESETS.length) {
          e.preventDefault();
          setDirectLabel(DIRECT_LABEL_PRESETS[digit - 1]);
          playSoundEffect('beep');
          if (document.activeElement !== directLabelInputRef.current) {
            directInputRef.current?.focus();
          }
        }
      } else if (e.key === 'F3') {
        e.preventDefault();
        setShowCameraScannerModal((prev) => !prev);
        playSoundEffect('beep');
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
        if (showCameraScannerModal) setShowCameraScannerModal(false);
        else if (showShortcutsModal) setShowShortcutsModal(false);
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

  // Unified barcode handler for both Camera scanner and external USB handheld scanner
  const handleProcessScannedBarcode = (rawCode: string): { success: boolean; product?: Product; error?: string } => {
    if (!rawCode || !rawCode.trim()) {
      return { success: false, error: 'Code vide' };
    }

    const cleanCode = rawCode.trim();
    // Match by exact barcode or product code or stripped whitespace
    const matched = products.find(
      (p) =>
        p.barcode?.trim() === cleanCode ||
        p.code?.toLowerCase().trim() === cleanCode.toLowerCase() ||
        p.barcode?.replace(/\s+/g, '') === cleanCode.replace(/\s+/g, '')
    );

    if (matched) {
      playSoundEffect('beep');

      if (posMode === 'catalog') {
        addToCart(matched, 1);
        setQuickBarcodeNotice(`Scanné : ${matched.name} (${formatMoney(matched.salePrice)})`);
      } else {
        // Mode Caisse Rapide: add or increment in directItems
        setDirectItems((prev) => {
          const existingIdx = prev.findIndex(
            (it) => it.label === matched.name && it.amount === matched.salePrice
          );
          if (existingIdx >= 0) {
            const updated = [...prev];
            updated[existingIdx] = {
              ...updated[existingIdx],
              quantity: updated[existingIdx].quantity + 1,
            };
            return updated;
          }
          return [
            ...prev,
            {
              id: `scan_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
              label: matched.name,
              amount: matched.salePrice,
              quantity: 1,
            },
          ];
        });
        setDirectLabel(matched.name);
        setQuickBarcodeNotice(`Article scanné : ${matched.name} · ${formatMoney(matched.salePrice)}`);
      }

      setTimeout(() => setQuickBarcodeNotice(null), 3500);
      return { success: true, product: matched };
    } else {
      playSoundEffect('error');
      if (posMode === 'direct') {
        setDirectLabel(`Article #${cleanCode}`);
        setQuickBarcodeNotice(`Code-barres ${cleanCode} non trouvé au catalogue. Saisissez son prix.`);
      } else {
        setQuickBarcodeNotice(`Code-barres ${cleanCode} introuvable dans le catalogue.`);
      }
      setTimeout(() => setQuickBarcodeNotice(null), 3500);
      return { success: false, error: `Code ${cleanCode} non répertorié` };
    }
  };

  // Barcode input form submit (manual keyboard submit in catalog mode)
  const handleBarcodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!barcodeInput.trim()) return;
    handleProcessScannedBarcode(barcodeInput.trim());
    setBarcodeInput('');
  };

  // Hardware USB Barcode Scanner (Keyboard Wedge) listener
  const usbScannerBufferRef = useRef<string>('');
  const lastKeyTimestampRef = useRef<number>(0);

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement as HTMLElement | null;
      const isInput = ['INPUT', 'TEXTAREA'].includes(activeEl?.tagName || '');

      // If user is typing in regular text fields (like search or customer name), ignore unless it's direct amount or barcode
      if (isInput && activeEl !== directInputRef.current && activeEl !== barcodeInputRef.current) {
        return;
      }

      const now = Date.now();
      const timeDiff = now - lastKeyTimestampRef.current;
      lastKeyTimestampRef.current = now;

      // Hardware scanners type at superhuman speed (< 60ms between characters)
      if (e.key === 'Enter') {
        if (usbScannerBufferRef.current.length >= 3 && timeDiff < 90) {
          // Hardware USB scan completed!
          e.preventDefault();
          e.stopPropagation();
          const scannedCode = usbScannerBufferRef.current;
          usbScannerBufferRef.current = '';
          handleProcessScannedBarcode(scannedCode);
          return;
        }
        usbScannerBufferRef.current = '';
      } else if (e.key.length === 1) {
        if (timeDiff > 70 && usbScannerBufferRef.current.length > 0) {
          // Reset buffer if delay too long (manual human typing)
          usbScannerBufferRef.current = '';
        }
        usbScannerBufferRef.current += e.key;
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown, true);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown, true);
  }, [products, posMode]);

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
    } else if (paymentMethod === 'credit') {
      if (!selectedCustomerId) {
        playSoundEffect('error');
        alert('Vente à crédit : Veuillez sélectionner ou créer le client (touche F4) pour porter cette dette au carnet.');
        setShowCustomerModal(true);
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
    } else if (directPaymentMethod === 'credit') {
      const existingCustomer = customers.find((c) => c.id === selectedCustomerId);
      const targetName = existingCustomer?.name || directCustomerName.trim();
      if (!targetName) {
        playSoundEffect('error');
        alert('Vente à crédit : Veuillez indiquer le nom du client (ou sélectionner dans le répertoire [F4]) pour porter la dette au carnet.');
        return;
      }
    }

    setIsProcessing(true);

    // Resolve customer information (either from directory or directly typed)
    let customer = customers.find((c) => c.id === selectedCustomerId);
    const finalCustomerName = customer?.name || (directCustomerName.trim().length > 0 ? directCustomerName.trim() : undefined);
    const finalCustomerPhone = customer?.phone || (directCustomerPhone.trim().length > 0 ? directCustomerPhone.trim() : undefined);

    // If credit sale without existing directory entry, auto-create customer profile
    if (directPaymentMethod === 'credit' && !customer && finalCustomerName) {
      customer = store.addCustomer({
        businessId: business.id,
        name: finalCustomerName,
        phone: finalCustomerPhone || 'N/A',
        creditBalance: 0,
      });
    }

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

        {/* Right Tools: Scanner Caméra + Douchette USB Status + Print Ticket + Keyboard Shortcut */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Bouton Scanner Caméra (F3) */}
          <button
            type="button"
            onClick={() => setShowCameraScannerModal(true)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all border cursor-pointer active:scale-95 ${
              isLight
                ? 'bg-amber-500 hover:bg-amber-600 text-white border-amber-600 shadow-2xs'
                : 'bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border-cyan-400/50 shadow-[0_0_12px_rgba(0,242,254,0.2)]'
            }`}
            title="Activer le scanner de code-barres par caméra (F3)"
          >
            <Camera className="w-3.5 h-3.5" />
            <span>Scan Caméra</span>
            <kbd className={`text-[10px] font-mono px-1 rounded ${
              isLight ? 'bg-amber-600 text-white' : 'bg-cyan-950 text-cyan-300 border border-cyan-500/30'
            }`}>
              F3
            </kbd>
          </button>

          {/* Badge statut Douchette USB connectée */}
          <div
            className={`hidden lg:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border ${
              isLight
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : 'bg-emerald-950/40 text-emerald-400 border-emerald-600/30'
            }`}
            title="Votre lecteur de code-barres USB est détecté et actif. Scannez un article à tout moment."
          >
            <Barcode className="w-3.5 h-3.5" />
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span>Douchette USB Prête</span>
          </div>

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
      {/* MODULE 1: CAISSE RAPIDE DIRECTE (Disposition Ergonomique 0-Scroll 2 Panneaux) */}
      {/* ========================================================================= */}
      {posMode === 'direct' && (
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 min-h-0 h-full p-2 sm:p-2.5 gap-2 sm:gap-2.5 overflow-hidden">
          {/* ===================================================================== */}
          {/* PANNEAU GAUCHE (7 cols) : SAISIE NUMÉRIQUE, PAVÉ TACTILE, RÈGLEMENT   */}
          {/* ===================================================================== */}
          <div className="lg:col-span-7 flex flex-col justify-between h-full min-h-0 space-y-1.5 overflow-hidden">
            {/* 1. COMPACT DIGITAL DISPLAY & QUICK PRESETS */}
            <div
              className={`p-2.5 sm:p-3 rounded-xl border transition-all flex flex-col justify-between shrink-0 ${
                isLight
                  ? 'retail-card bg-white border-slate-300 shadow-2xs'
                  : 'neon-card bg-[#0a0d1e] border-cyan-500/40 shadow-[0_0_20px_rgba(0,242,254,0.08)]'
              }`}
            >
              <div className="flex items-center justify-between text-[11px] mb-0.5">
                <span
                  className={`font-bold uppercase tracking-wider flex items-center gap-1.5 ${
                    isLight ? 'text-amber-800' : 'text-cyan-400'
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>
                    {numDirectAmount > 0
                      ? directQuantity > 1
                        ? `Montant × Qté (${directQuantity})`
                        : "Montant de l'article"
                      : directItems.length > 0
                      ? 'Total cumulé du ticket'
                      : 'Montant de la Vente (Clavier ou Tactile)'}
                  </span>
                </span>
                <div className="flex items-center gap-2">
                  <span
                    className={`text-[10px] font-semibold px-2 py-0.5 rounded border ${
                      isLight
                        ? 'bg-slate-100 text-slate-700 border-slate-200'
                        : 'bg-neutral-900 text-cyan-300 border-cyan-500/30'
                    }`}
                  >
                    Caissière : <strong className="underline">{currentUser.name}</strong>
                  </span>
                  <span className={`hidden sm:inline font-mono text-[10px] ${isLight ? 'text-slate-400' : 'text-neutral-500'}`}>
                    Saisie directe clavier active
                  </span>
                </div>
              </div>

              {/* Display Box */}
              <div className="relative flex flex-col justify-center py-0.5">
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
                  className={`w-full font-mono font-black text-3xl sm:text-4xl md:text-5xl tracking-tight text-right select-all cursor-text py-0.5 ${
                    numDirectAmount > 0 || directItems.length > 0
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
                  <span
                    className={`text-lg sm:text-xl md:text-2xl ml-2 font-bold ${
                      isLight ? 'text-amber-700' : 'text-cyan-400'
                    }`}
                  >
                    F CFA
                  </span>
                </div>

                {numDirectAmount > 0 && directQuantity > 1 && (
                  <div
                    className={`text-right text-[11px] font-mono font-bold ${
                      isLight ? 'text-amber-700' : 'text-cyan-400'
                    }`}
                  >
                    Détail : {directQuantity} × {formatMoney(numDirectAmount)} F
                  </div>
                )}
              </div>

              {/* Quick Preset Adders (+100F, +500F, etc.) */}
              <div className="flex items-center gap-1 overflow-x-auto pt-1.5 border-t border-dashed border-neutral-700/30">
                <span
                  className={`text-[10px] font-semibold whitespace-nowrap mr-1 ${
                    isLight ? 'text-slate-500' : 'text-neutral-400'
                  }`}
                >
                  Ajout rapide :
                </span>
                {[100, 200, 500, 1000, 2000, 5000, 10000].map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => addDirectPreset(amt)}
                    className={`px-2 py-0.5 text-[11px] font-mono font-bold rounded-md border transition-all cursor-pointer whitespace-nowrap active:scale-95 ${
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

            {/* 2. COMPACT ARTICLE & QUANTITY BAR */}
            <div
              className={`p-2 rounded-xl border space-y-1.5 transition-all shrink-0 ${
                isLight
                  ? 'retail-card bg-white border-slate-200 shadow-2xs'
                  : 'neon-card bg-[#090c1a] border-cyan-500/25'
              }`}
            >
              <div className="flex flex-wrap items-center gap-1.5">
                {/* Libellé input avec raccourci F2 */}
                <div className="flex-1 min-w-[140px] relative">
                  <div className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none flex items-center gap-1">
                    <Tag className="w-3 h-3 text-amber-500" />
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
                          directInputRef.current?.focus();
                        } else {
                          // Jump to amount input so cashier can type the price immediately
                          directInputRef.current?.focus();
                          playSoundEffect('beep');
                        }
                      } else if (e.key === 'Escape') {
                        e.preventDefault();
                        directInputRef.current?.focus();
                      } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                        e.preventDefault();
                        const curIdx = DIRECT_LABEL_PRESETS.indexOf(directLabel);
                        let nextIdx = 0;
                        if (e.key === 'ArrowDown') {
                          nextIdx = curIdx === -1 ? 0 : (curIdx + 1) % DIRECT_LABEL_PRESETS.length;
                        } else {
                          nextIdx = curIdx <= 0 ? DIRECT_LABEL_PRESETS.length - 1 : curIdx - 1;
                        }
                        setDirectLabel(DIRECT_LABEL_PRESETS[nextIdx]);
                        playSoundEffect('beep');
                      }
                    }}
                    placeholder="Libellé article (Pain, Boisson, Télécom...) [F2]"
                    className={`w-full pl-7 pr-8 py-1 text-xs font-semibold rounded-lg border transition-all ${
                      isLight
                        ? 'bg-slate-50 border-slate-300 text-slate-900 focus:outline-hidden focus:border-amber-500 focus:bg-white'
                        : 'bg-neutral-950 border-cyan-500/30 text-white focus:outline-hidden focus:border-cyan-400'
                    }`}
                  />
                  <div className="absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none">
                    <kbd
                      className={`text-[9px] font-mono font-bold px-1 py-0.5 rounded border ${
                        isLight
                          ? 'bg-slate-200/80 text-slate-600 border-slate-300'
                          : 'bg-neutral-800 text-cyan-300 border-neutral-700'
                      }`}
                      title="Raccourci clavier F2 (ou F6)"
                    >
                      F2
                    </kbd>
                  </div>
                </div>

                {/* Quantité Stepper avec raccourci F7 */}
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      setDirectQuantity((q) => Math.max(1, q - 1));
                      playSoundEffect('beep');
                    }}
                    className={`w-7 h-7 rounded-lg font-bold flex items-center justify-center border transition-all cursor-pointer ${
                      isLight
                        ? 'bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-300'
                        : 'bg-neutral-900 hover:bg-neutral-800 text-cyan-300 border-cyan-500/30'
                    }`}
                    title="Diminuer la quantité (-1)"
                  >
                    <Minus className="w-3 h-3" />
                  </button>
                  <div className="relative">
                    <input
                      type="number"
                      min="1"
                      max="999"
                      value={directQuantity}
                      onChange={(e) => {
                        const v = parseInt(e.target.value, 10);
                        setDirectQuantity(isNaN(v) || v < 1 ? 1 : v);
                      }}
                      className={`w-10 h-7 text-center font-mono font-bold text-xs rounded-lg border transition-all ${
                        isLight
                          ? 'bg-slate-50 border-slate-300 text-slate-900 focus:outline-hidden focus:border-amber-500'
                          : 'bg-neutral-950 border-cyan-500/30 text-white focus:outline-hidden focus:border-cyan-400'
                      }`}
                      title="Quantité d'articles [F7 pour augmenter]"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setDirectQuantity((q) => q + 1);
                      playSoundEffect('beep');
                    }}
                    className={`w-7 h-7 rounded-lg font-bold flex items-center justify-center border transition-all cursor-pointer ${
                      isLight
                        ? 'bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-300'
                        : 'bg-neutral-900 hover:bg-neutral-800 text-cyan-300 border-cyan-500/30'
                    }`}
                    title="Augmenter la quantité (+1) [F7]"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                </div>

                {/* Bouton Ajouter au ticket */}
                <button
                  type="button"
                  onClick={handleAddDirectItem}
                  disabled={numDirectAmount <= 0}
                  className={`h-7 px-2.5 rounded-lg font-bold text-[11px] flex items-center justify-center gap-1 border transition-all cursor-pointer whitespace-nowrap active:scale-95 shadow-2xs shrink-0 ${
                    numDirectAmount <= 0
                      ? isLight
                        ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                        : 'bg-neutral-900 text-neutral-600 border-neutral-800 cursor-not-allowed'
                      : isLight
                      ? 'bg-amber-500 hover:bg-amber-600 text-white border-amber-600'
                      : 'bg-cyan-500 hover:bg-cyan-400 text-neutral-950 border-cyan-400 shadow-[0_0_12px_rgba(0,242,254,0.4)]'
                  }`}
                  title="Cumuler ce montant au ticket (Touche +)"
                >
                  <Plus className="w-3 h-3 stroke-[3]" />
                  <span>Ajouter [+]</span>
                </button>

                {/* Bouton Scanner Caméra en Caisse Rapide */}
                <button
                  type="button"
                  onClick={() => setShowCameraScannerModal(true)}
                  className={`h-7 px-2 rounded-lg font-bold text-[11px] flex items-center justify-center gap-1 border transition-all cursor-pointer whitespace-nowrap active:scale-95 shadow-2xs shrink-0 ${
                    isLight
                      ? 'bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-300'
                      : 'bg-[#121833] hover:bg-[#1a2245] text-cyan-300 border-cyan-500/40 shadow-[0_0_8px_rgba(0,242,254,0.2)]'
                  }`}
                  title="Scanner le code-barres de l'article avec la caméra [F3]"
                >
                  <Camera className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Scan [F3]</span>
                </button>
              </div>

              {/* Quick model chips avec raccourcis Alt+1..6 & qty shortcuts */}
              <div className="flex items-center justify-between gap-1 overflow-x-auto text-[10px]">
                <div className="flex items-center gap-1 overflow-x-auto">
                  <span className={`font-semibold opacity-60 mr-0.5 whitespace-nowrap flex items-center gap-1`}>
                    <span>Modèles:</span>
                    <span className="text-[9px] opacity-75 font-mono">(Alt+1..6)</span>
                  </span>
                  {DIRECT_LABEL_PRESETS.map((label, idx) => (
                    <button
                      key={label}
                      type="button"
                      onClick={() => {
                        setDirectLabel(label);
                        playSoundEffect('beep');
                      }}
                      className={`px-1.5 py-0.5 rounded text-[10px] font-semibold whitespace-nowrap transition-colors border cursor-pointer flex items-center gap-1 ${
                        directLabel === label
                          ? isLight
                            ? 'bg-slate-900 text-white border-slate-900'
                            : 'bg-cyan-400 text-neutral-950 font-bold border-cyan-400'
                          : isLight
                          ? 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                          : 'bg-neutral-900 text-neutral-400 border-neutral-800 hover:text-white'
                      }`}
                      title={`Raccourci Alt+${idx + 1} (ou flèches haut/bas dans le champ libellé)`}
                    >
                      <span className="opacity-40 text-[9px] font-mono">{idx + 1}</span>
                      <span>{label}</span>
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-0.5 shrink-0">
                  <span className="font-semibold opacity-60 mr-0.5">Qté:</span>
                  {[1, 2, 3, 5, 10].map((q) => (
                    <button
                      key={q}
                      type="button"
                      onClick={() => {
                        setDirectQuantity(q);
                        playSoundEffect('beep');
                      }}
                      className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold transition-all border cursor-pointer ${
                        directQuantity === q
                          ? isLight
                            ? 'bg-amber-500 text-white border-amber-600'
                            : 'bg-cyan-400 text-neutral-950 font-bold border-cyan-400'
                          : isLight
                          ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
                          : 'bg-neutral-900 hover:bg-neutral-800 text-neutral-300 border-neutral-800'
                      }`}
                      title={`Quantité ${q} (Raccourci F7)`}
                    >
                      x{q}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* 3. TACTILE NUMPAD (Fills available middle space, perfectly responsive) */}
            <div className="flex-1 grid grid-cols-4 gap-1.5 min-h-[160px] max-h-[240px]">
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
                { label: '+ Ajouter [+]', val: 'add_item', isAdd: true, colSpan: 'col-span-2' },
                { label: 'Appoint [Esp]', val: 'exact', isExact: true, colSpan: 'col-span-1' },
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
                      className={`${btn.colSpan || ''} py-2 px-1 rounded-xl font-bold text-xs flex items-center justify-center gap-1 border transition-all cursor-pointer active:scale-95 ${
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
                      className={`${btn.colSpan || ''} py-2 px-2 rounded-xl font-bold text-xs flex items-center justify-center gap-1 border transition-all cursor-pointer active:scale-95 ${
                        isLight
                          ? 'bg-amber-500 hover:bg-amber-600 text-white border-amber-600 shadow-2xs'
                          : 'bg-cyan-500 hover:bg-cyan-400 text-neutral-950 font-bold border-cyan-400 shadow-[0_0_12px_rgba(0,242,254,0.35)]'
                      }`}
                      title="Ajouter ce montant au ticket en cours (Touche +)"
                    >
                      <Plus className="w-3.5 h-3.5 stroke-[3]" />
                      <span>Ajouter Montant [+]</span>
                    </button>
                  );
                }

                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleDirectNumpadPress(btn.val)}
                    className={`${btn.colSpan || ''} py-2 rounded-xl font-mono text-lg md:text-xl font-bold flex items-center justify-center border transition-all cursor-pointer active:scale-95 ${
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
                        : 'bg-[#0d1020] hover:bg-[#141933] text-white border-cyan-500/25'
                    }`}
                  >
                    {btn.label}
                  </button>
                );
              })}
            </div>

            {/* 4. PAYMENT METHOD & CASH TENDER BAR */}
            <div className="space-y-1.5 shrink-0">
              {/* Payment selector */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setDirectPaymentMethod('cash');
                    playSoundEffect('beep');
                  }}
                  className={`py-2 px-2 rounded-xl border flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    directPaymentMethod === 'cash'
                      ? isLight
                        ? 'bg-emerald-50 border-emerald-500 text-emerald-900 font-bold shadow-2xs'
                        : 'bg-emerald-950/50 border-emerald-400 text-emerald-300 font-bold shadow-[0_0_12px_rgba(16,185,129,0.3)]'
                      : isLight
                      ? 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                      : 'bg-[#0a0d1e] border-neutral-800 text-neutral-400'
                  }`}
                >
                  <Banknote className="w-4 h-4 text-emerald-500" />
                  <span className="text-xs">Espèces</span>
                  <span className="text-[10px] font-mono opacity-60">F9</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setDirectPaymentMethod('mobile_money');
                    playSoundEffect('beep');
                  }}
                  className={`py-2 px-2 rounded-xl border flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    directPaymentMethod === 'mobile_money'
                      ? isLight
                        ? 'bg-cyan-50 border-cyan-500 text-cyan-900 font-bold shadow-2xs'
                        : 'bg-cyan-950/50 border-cyan-400 text-cyan-300 font-bold shadow-[0_0_12px_rgba(0,242,254,0.3)]'
                      : isLight
                      ? 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                      : 'bg-[#0a0d1e] border-neutral-800 text-neutral-400'
                  }`}
                >
                  <Smartphone className="w-4 h-4 text-cyan-500" />
                  <span className="text-xs">Mobile Money</span>
                  <span className="text-[10px] font-mono opacity-60">F10</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setDirectPaymentMethod('card');
                    playSoundEffect('beep');
                  }}
                  className={`py-2 px-2 rounded-xl border flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    directPaymentMethod === 'card'
                      ? isLight
                        ? 'bg-purple-50 border-purple-500 text-purple-900 font-bold shadow-2xs'
                        : 'bg-purple-950/50 border-purple-400 text-purple-300 font-bold shadow-[0_0_12px_rgba(168,85,247,0.3)]'
                      : isLight
                      ? 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                      : 'bg-[#0a0d1e] border-neutral-800 text-neutral-400'
                  }`}
                >
                  <CreditCard className="w-4 h-4 text-purple-500" />
                  <span className="text-xs">Carte</span>
                  <span className="text-[10px] font-mono opacity-60">F11</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setDirectPaymentMethod('credit');
                    playSoundEffect('beep');
                  }}
                  className={`py-2 px-2 rounded-xl border flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    directPaymentMethod === 'credit'
                      ? isLight
                        ? 'bg-amber-50 border-amber-500 text-amber-900 font-bold shadow-2xs ring-1 ring-amber-400'
                        : 'bg-amber-950/50 border-amber-400 text-amber-300 font-bold shadow-[0_0_12px_rgba(245,158,11,0.3)] ring-1 ring-amber-400'
                      : isLight
                      ? 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                      : 'bg-[#0a0d1e] border-neutral-800 text-neutral-400'
                  }`}
                  title="Porter cet achat sur le carnet de crédit du client"
                >
                  <BookOpen className="w-4 h-4 text-amber-500" />
                  <span className="text-xs">Crédit / Dette</span>
                </button>
              </div>

              {/* Notice informative si vente à crédit sélectionnée */}
              {directPaymentMethod === 'credit' && (
                <div
                  className={`p-2.5 rounded-xl border text-xs flex flex-wrap items-center justify-between gap-2 transition-all ${
                    isLight
                      ? 'bg-amber-50/90 border-amber-300 text-amber-950'
                      : 'bg-amber-950/30 border-amber-500/40 text-amber-200'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-amber-500 shrink-0" />
                    <span>
                      Vente portée au carnet de crédit du client :{' '}
                      <strong>{directCustomerName.trim() || selectedCustomer?.name || 'Nom client requis ci-dessus'}</strong>
                    </span>
                  </div>
                  {selectedCustomer && (
                    <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded bg-amber-500/10 border border-amber-400/30">
                      Dette actuelle : {formatMoney(selectedCustomer.creditBalance)}
                    </span>
                  )}
                </div>
              )}

              {/* Cash tender & change line (if cash) */}
              {directPaymentMethod === 'cash' && (
                <div
                  className={`px-2.5 py-1.5 rounded-xl border flex flex-wrap items-center justify-between gap-2 ${
                    isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#090c1a] border-cyan-500/25'
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <span className={`text-[11px] font-semibold ${isLight ? 'text-slate-600' : 'text-neutral-400'}`}>
                      Reçu :
                    </span>
                    <input
                      type="number"
                      value={directCashReceived}
                      onChange={(e) => setDirectCashReceived(e.target.value)}
                      placeholder={String(totalDirectToPay || 0)}
                      className={`w-24 px-2 py-0.5 rounded-md font-mono text-xs font-bold transition-colors ${
                        isLight
                          ? 'bg-white border border-slate-300 text-slate-900 focus:outline-hidden focus:border-amber-500'
                          : 'bg-neutral-950 border border-cyan-500/30 text-white focus:outline-hidden focus:border-cyan-400'
                      }`}
                    />
                    <span className="text-[10px] font-mono font-bold">F</span>
                  </div>

                  <div className="flex items-center gap-1">
                    {[500, 1000, 2000, 5000, 10000].map((bill) => (
                      <button
                        key={bill}
                        type="button"
                        onClick={() => {
                          setDirectCashReceived(String(bill));
                          playSoundEffect('beep');
                        }}
                        className={`px-1.5 py-0.5 text-[10px] font-mono font-semibold rounded border cursor-pointer ${
                          isLight
                            ? 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200'
                            : 'bg-[#0d1020] hover:bg-[#141933] text-neutral-300 border-neutral-700'
                        }`}
                      >
                        {bill >= 1000 ? `${bill / 1000}k` : bill}
                      </button>
                    ))}
                  </div>

                  <div
                    className={`px-2 py-0.5 rounded-md border font-mono font-bold text-[11px] flex items-center gap-1.5 ${
                      directChangeDue > 0
                        ? isLight
                          ? 'bg-emerald-100 border-emerald-300 text-emerald-800'
                          : 'bg-emerald-950/60 border-emerald-500 text-emerald-300'
                        : isLight
                        ? 'bg-slate-200/60 border-slate-300 text-slate-500'
                        : 'bg-neutral-900 border-neutral-800 text-neutral-500'
                    }`}
                  >
                    <span>Rendu:</span>
                    <span className="font-black">{formatMoney(directChangeDue)}</span>
                  </div>
                </div>
              )}
            </div>

            {/* 5. BIG UNMISSIBLE PINNED VALIDATION BUTTON (Zero-Scroll Guarantee) */}
            <button
              type="button"
              onClick={handleValidateDirectSale}
              disabled={totalDirectToPay <= 0 || isProcessing}
              className={`w-full py-3 sm:py-3.5 px-4 rounded-xl font-black text-sm sm:text-base flex items-center justify-between transition-all cursor-pointer shadow-md active:scale-[0.99] shrink-0 ${
                totalDirectToPay <= 0
                  ? isLight
                    ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                    : 'bg-neutral-900 text-neutral-600 cursor-not-allowed border border-neutral-800'
                  : isLight
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/30'
                  : 'bg-gradient-to-r from-emerald-400 via-cyan-400 to-emerald-400 text-neutral-950 font-black shadow-[0_0_20px_rgba(16,185,129,0.5)]'
              }`}
            >
              <div className="flex items-center gap-2">
                <Check className="w-5 h-5 stroke-[3]" />
                <span>ENCAISSER & VALIDER [Entrée ↵]</span>
              </div>
              <div className="font-mono text-sm sm:text-base font-black tabular-nums">
                {formatMoney(totalDirectToPay)}
                <span className="text-[11px] font-normal opacity-80 ml-1">
                  ({totalDirectItemsCount} art.)
                </span>
              </div>
            </button>
          </div>

          {/* ===================================================================== */}
          {/* PANNEAU DROIT (5 cols) : TICKET EN COURS, CLIENT & DERNIÈRES VENTES    */}
          {/* ===================================================================== */}
          <div className="lg:col-span-5 flex flex-col h-full min-h-0 space-y-2 overflow-hidden">
            {/* 1. TICKET EN COURS (Live Accumulated Items) */}
            <div
              className={`flex-1 flex flex-col min-h-0 rounded-xl border overflow-hidden transition-all ${
                isLight
                  ? 'bg-white border-slate-200 shadow-2xs'
                  : 'bg-[#090c1a] border-cyan-500/25 shadow-[0_0_15px_rgba(0,242,254,0.05)]'
              }`}
            >
              {/* Ticket Header */}
              <div
                className={`px-3 py-2 border-b flex items-center justify-between shrink-0 ${
                  isLight ? 'bg-slate-50 border-slate-200' : 'bg-neutral-950/70 border-cyan-500/20'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Receipt className={`w-4 h-4 ${isLight ? 'text-amber-700' : 'text-cyan-400'}`} />
                  <span className={`text-xs font-black uppercase tracking-wider ${isLight ? 'text-slate-900' : 'text-white'}`}>
                    Ticket en cours
                  </span>
                  <span
                    className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold ${
                      isLight
                        ? 'bg-amber-100 text-amber-900'
                        : 'bg-cyan-950 text-cyan-300 border border-cyan-500/30'
                    }`}
                  >
                    {directItems.length} article{directItems.length > 1 ? 's' : ''}
                  </span>
                </div>

                {directItems.length > 0 && (
                  <button
                    type="button"
                    onClick={handleClearDirectTicket}
                    className={`text-[11px] flex items-center gap-1 font-semibold transition-colors cursor-pointer px-1.5 py-0.5 rounded hover:bg-rose-500/10 ${
                      isLight ? 'text-rose-600' : 'text-rose-400'
                    }`}
                    title="Vider le ticket"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>Vider</span>
                  </button>
                )}
              </div>

              {/* Items List (Scrollable inside its container) */}
              <div className="flex-1 overflow-y-auto p-2 space-y-1 divide-y divide-dashed divide-neutral-200 dark:divide-neutral-800/80">
                {directItems.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center p-4">
                    <Receipt className={`w-8 h-8 mb-2 opacity-30 ${isLight ? 'text-slate-400' : 'text-cyan-400'}`} />
                    <p className={`text-xs font-semibold ${isLight ? 'text-slate-600' : 'text-neutral-300'}`}>
                      Ticket prêt pour le prochain client
                    </p>
                    <p className={`text-[11px] max-w-[240px] mt-1 ${isLight ? 'text-slate-400' : 'text-neutral-500'}`}>
                      Tapez un montant à gauche et appuyez sur <kbd className="font-mono font-bold">[+]</kbd> pour cumuler plusieurs articles, ou sur <kbd className="font-mono font-bold">[Entrée]</kbd> pour valider.
                    </p>

                    {numDirectAmount > 0 && (
                      <div
                        className={`mt-3 px-3 py-1.5 rounded-lg border text-xs font-mono font-bold animate-pulse ${
                          isLight
                            ? 'bg-amber-50 border-amber-300 text-amber-900'
                            : 'bg-cyan-950/40 border-cyan-500/40 text-cyan-300'
                        }`}
                      >
                        En saisie : {formatMoney(numDirectAmount * Math.max(1, directQuantity))}
                      </div>
                    )}
                  </div>
                ) : (
                  directItems.map((item, idx) => (
                    <div key={item.id} className="pt-1.5 first:pt-0 flex items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span
                          className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-mono font-bold shrink-0 ${
                            isLight ? 'bg-amber-100 text-amber-900' : 'bg-cyan-950 text-cyan-300'
                          }`}
                        >
                          {idx + 1}
                        </span>
                        <span className={`font-semibold truncate max-w-[140px] ${isLight ? 'text-slate-800' : 'text-neutral-200'}`}>
                          {item.label}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {/* Qty controls */}
                        <div className="flex items-center gap-0.5">
                          <button
                            type="button"
                            onClick={() => handleUpdateDirectItemQuantity(item.id, -1)}
                            className={`w-4 h-4 rounded flex items-center justify-center border font-bold text-[9px] cursor-pointer ${
                              isLight ? 'bg-slate-100 hover:bg-slate-200 border-slate-300' : 'bg-neutral-800 hover:bg-neutral-700 border-neutral-700'
                            }`}
                          >
                            -
                          </button>
                          <span className="font-mono font-bold px-1 text-[10px]">
                            {item.quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleUpdateDirectItemQuantity(item.id, 1)}
                            className={`w-4 h-4 rounded flex items-center justify-center border font-bold text-[9px] cursor-pointer ${
                              isLight ? 'bg-slate-100 hover:bg-slate-200 border-slate-300' : 'bg-neutral-800 hover:bg-neutral-700 border-neutral-700'
                            }`}
                          >
                            +
                          </button>
                        </div>

                        <span className={`font-mono font-bold tabular-nums ${isLight ? 'text-slate-900' : 'text-cyan-300'}`}>
                          {formatMoney(item.amount * item.quantity)}
                        </span>

                        <button
                          type="button"
                          onClick={() => handleRemoveDirectItem(item.id)}
                          className="p-0.5 rounded text-rose-500 hover:bg-rose-500/10 cursor-pointer"
                          title="Supprimer la ligne"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Ticket Footer Subtotal Banner */}
              <div
                className={`p-2 border-t flex items-center justify-between text-xs font-mono shrink-0 ${
                  isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#060812] border-cyan-500/20'
                }`}
              >
                <span className="font-semibold text-[11px] opacity-75">Sous-total ticket:</span>
                <span className="font-black text-sm tabular-nums">
                  {formatMoney(totalDirectToPay)}
                </span>
              </div>
            </div>

            {/* 2. MENTIONS DU REÇU (Client & Caissière) */}
            <div
              className={`p-2 sm:p-2.5 rounded-xl border space-y-1.5 transition-all shrink-0 ${
                isLight
                  ? 'retail-card bg-white border-slate-200 shadow-2xs'
                  : 'neon-card bg-[#090c1a] border-cyan-500/25'
              }`}
            >
              <div className="flex items-center justify-between text-[11px]">
                <div className="flex items-center gap-1.5 font-bold uppercase tracking-wider">
                  <UserCheck className={`w-3.5 h-3.5 ${isLight ? 'text-amber-600' : 'text-cyan-400'}`} />
                  <span className={isLight ? 'text-slate-800' : 'text-white'}>
                    Client sur le reçu
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowCustomerModal(true)}
                  className={`text-[10px] font-bold underline cursor-pointer ${
                    isLight ? 'text-amber-700 hover:text-amber-800' : 'text-cyan-400 hover:text-cyan-300'
                  }`}
                  title="Sélectionner dans le répertoire client [F4]"
                >
                  Répertoire [F4]
                </button>
              </div>

              {/* Customer Inputs inline */}
              <div className="grid grid-cols-2 gap-1.5">
                <input
                  type="text"
                  value={directCustomerName}
                  onChange={(e) => setDirectCustomerName(e.target.value)}
                  placeholder="Nom Client (ex: M. Koffi)"
                  className={`w-full px-2 py-1 text-xs font-medium rounded-lg border transition-all ${
                    isLight
                      ? 'bg-slate-50 border-slate-300 text-slate-900 focus:outline-hidden focus:border-amber-500'
                      : 'bg-neutral-950 border-cyan-500/30 text-white focus:outline-hidden focus:border-cyan-400'
                  }`}
                />
                <input
                  type="text"
                  value={directCustomerPhone}
                  onChange={(e) => setDirectCustomerPhone(e.target.value)}
                  placeholder="Tél (ex: 07 48 92 11 00)"
                  className={`w-full px-2 py-1 text-xs font-mono font-medium rounded-lg border transition-all ${
                    isLight
                      ? 'bg-slate-50 border-slate-300 text-slate-900 focus:outline-hidden focus:border-amber-500'
                      : 'bg-neutral-950 border-cyan-500/30 text-white focus:outline-hidden focus:border-cyan-400'
                  }`}
                />
              </div>

              {/* Receipt mention summary */}
              <div
                className={`px-2 py-1 rounded-lg text-[10px] flex items-center justify-between border ${
                  isLight
                    ? 'bg-amber-50/70 border-amber-200 text-amber-950'
                    : 'bg-cyan-950/30 border-cyan-500/30 text-cyan-200'
                }`}
              >
                <span className="truncate">
                  Sur le ticket : <strong>{directCustomerName || 'Client Comptoir'}</strong>
                  {directCustomerPhone ? ` (${directCustomerPhone})` : ''} · Caissière : <strong>{currentUser.name}</strong>
                </span>
                {(directCustomerName || directCustomerPhone) && (
                  <button
                    type="button"
                    onClick={() => {
                      setDirectCustomerName('');
                      setDirectCustomerPhone('');
                      setSelectedCustomerId('');
                    }}
                    className="text-[9px] underline opacity-70 hover:opacity-100 ml-1 shrink-0"
                  >
                    Effacer
                  </button>
                )}
              </div>
            </div>

            {/* 3. DERNIÈRES VENTES & RÉIMPRESSION RAPIDE (F12) */}
            <div
              className={`p-2 rounded-xl border flex flex-col justify-between shrink-0 max-h-[140px] overflow-hidden ${
                isLight ? 'retail-card bg-white border-slate-200' : 'neon-card bg-[#0a0d1e] border-cyan-500/25'
              }`}
            >
              <div className="flex items-center justify-between pb-1 border-b border-neutral-700/20 text-[11px]">
                <span className={`font-bold uppercase tracking-wider ${isLight ? 'text-slate-900' : 'text-white'}`}>
                  Dernières Ventes Caissier
                </span>
                <span
                  className={`text-[9px] font-mono px-1.5 py-0.2 rounded border ${
                    isLight
                      ? 'bg-slate-100 text-slate-700 border-slate-300'
                      : 'bg-neutral-800 text-neutral-300 border-neutral-700'
                  }`}
                >
                  {recentTransactions.length} vente{recentTransactions.length > 1 ? 's' : ''}
                </span>
              </div>

              <div className="space-y-1 overflow-y-auto mt-1 pr-0.5">
                {recentTransactions.length === 0 ? (
                  <p className="text-[11px] text-neutral-400 text-center py-2">
                    Aucune vente pour le moment.
                  </p>
                ) : (
                  recentTransactions.slice(0, 3).map((tx) => (
                    <div
                      key={tx.id}
                      onClick={() => setCompletedTx(tx)}
                      className={`p-1.5 rounded-lg border flex items-center justify-between cursor-pointer transition-all ${
                        isLight
                          ? 'bg-slate-50 hover:bg-slate-100 border-slate-200'
                          : 'bg-[#060812] hover:bg-[#0c1022] border-cyan-500/20'
                      }`}
                      title="Cliquer pour voir et imprimer ce ticket"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className={`text-[11px] font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>
                            {tx.ticketNumber}
                          </span>
                          <span className="text-[9px] opacity-60 font-mono">
                            {tx.timestamp.slice(11, 16)}
                          </span>
                        </div>
                        <p className={`text-[10px] truncate max-w-[130px] ${isLight ? 'text-slate-500' : 'text-neutral-400'}`}>
                          {tx.items[0]?.productName || 'Vente'}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className={`text-[11px] font-bold font-mono ${isLight ? 'text-emerald-700' : 'text-emerald-400'}`}>
                          {formatMoney(tx.totalAmount)}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setCompletedTx(tx);
                            printThermalReceipt(tx, business);
                          }}
                          className={`p-1 rounded transition-colors cursor-pointer ${
                            isLight ? 'hover:bg-slate-200 text-slate-700' : 'hover:bg-neutral-800 text-cyan-300'
                          }`}
                          title="Imprimer ce ticket (80mm)"
                        >
                          <Printer className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
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

              {/* Barcode scanner input and Camera Scan button (F3) */}
              <div className="flex items-center gap-1.5 flex-1 min-w-[260px]">
                <form onSubmit={handleBarcodeSubmit} className="relative flex-1">
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
                    placeholder="Douchette USB ou taper code..."
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
                    Valider
                  </button>
                </form>

                <button
                  type="button"
                  onClick={() => setShowCameraScannerModal(true)}
                  className={`h-9 px-3 rounded-lg text-xs font-bold flex items-center gap-1.5 border transition-all cursor-pointer whitespace-nowrap active:scale-95 ${
                    isLight
                      ? 'bg-amber-500 hover:bg-amber-600 text-white border-amber-600 shadow-2xs'
                      : 'bg-cyan-500 hover:bg-cyan-400 text-neutral-950 border-cyan-400 shadow-[0_0_12px_rgba(0,242,254,0.35)]'
                  }`}
                  title="Ouvrir le lecteur caméra [F3]"
                >
                  <Camera className="w-3.5 h-3.5" />
                  <span>Caméra [F3]</span>
                </button>
              </div>
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
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 pt-1">
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
                  <span>Wave / OM</span>
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
                  <span>Carte</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setPaymentMethod('credit');
                    if (!selectedCustomerId) {
                      setShowCustomerModal(true);
                    }
                  }}
                  className={`py-1.5 px-2 rounded-lg text-xs font-bold border flex items-center justify-center gap-1 transition-colors ${
                    paymentMethod === 'credit'
                      ? isLight ? 'bg-amber-500 text-white border-amber-500 shadow-2xs' : 'bg-amber-400 text-neutral-950 font-black border-amber-400 shadow-[0_0_12px_rgba(245,158,11,0.4)]'
                      : isLight ? 'bg-white border-slate-200 text-slate-700' : 'bg-neutral-900 border-neutral-800 text-neutral-400'
                  }`}
                  title="Inscrire cet achat sur la dette du client"
                >
                  <BookOpen className="w-3.5 h-3.5" />
                  <span>Crédit [Carnet]</span>
                </button>
              </div>

              {/* Notice si paiement à crédit sélectionné en mode catalogue */}
              {paymentMethod === 'credit' && (
                <div
                  className={`p-2 rounded-xl border text-xs flex items-center justify-between transition-all ${
                    isLight
                      ? 'bg-amber-50 border-amber-300 text-amber-950'
                      : 'bg-amber-950/30 border-amber-500/40 text-amber-300'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-amber-500 shrink-0" />
                    <span>
                      Compte client : <strong>{selectedCustomer ? selectedCustomer.name : 'Sélectionnez un client (F4)'}</strong>
                    </span>
                  </div>
                  {selectedCustomer && (
                    <span className="font-mono text-[11px] font-bold">
                      Dette actuelle : {formatMoney(selectedCustomer.creditBalance)}
                    </span>
                  )}
                </div>
              )}

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

      {/* Camera Barcode Scanner Modal */}
      <CameraBarcodeScannerModal
        isOpen={showCameraScannerModal}
        onClose={() => setShowCameraScannerModal(false)}
        onBarcodeScanned={handleProcessScannedBarcode}
        products={products}
        currentMode={posMode}
      />
    </div>
  );
};
