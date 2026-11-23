import React, { useState, useEffect } from 'react';
import {
  Barcode,
  PackagePlus,
  X,
  AlertTriangle,
  Camera,
  Check,
  Tag,
} from 'lucide-react';
import { Business, Product } from '../types';
import { store, playSoundEffect } from '../services/store';
import { useTheme } from '../services/themeContext';
import { formatMoney } from '../utils/formatters';

interface QuickAddScannedProductModalProps {
  isOpen: boolean;
  business: Business;
  initialBarcode: string;
  existingProducts: Product[];
  onClose: () => void;
  onCreated: (product: Product) => void;
  onRescanRequested?: () => void;
  submitLabel?: string;
}

const CATEGORIES = [
  'Alimentation',
  'Boissons',
  'Hygiène & Soins',
  'Snacks & Biscuits',
  'Télécom & Services',
  'Bazar & Divers',
];

export const QuickAddScannedProductModal: React.FC<QuickAddScannedProductModalProps> = ({
  isOpen,
  business,
  initialBarcode,
  existingProducts,
  onClose,
  onCreated,
  onRescanRequested,
  submitLabel = 'Enregistrer l’article',
}) => {
  const { theme } = useTheme();
  const isLight = theme === 'light';

  const [barcode, setBarcode] = useState<string>(initialBarcode);
  const [code, setCode] = useState<string>('');
  const [name, setName] = useState<string>('');
  const [category, setCategory] = useState<string>('Alimentation');
  const [unit, setUnit] = useState<string>('pièce');
  const [purchasePrice, setPurchasePrice] = useState<string>('0');
  const [salePrice, setSalePrice] = useState<string>('');
  const [stock, setStock] = useState<string>('10');
  const [minStockAlert, setMinStockAlert] = useState<string>('5');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setBarcode(initialBarcode || '');
    setCode(`ART-${String(existingProducts.length + 1).padStart(3, '0')}`);
    setName('');
    setCategory('Alimentation');
    setUnit('pièce');
    setPurchasePrice('0');
    setSalePrice('');
    setStock('10');
    setMinStockAlert('5');
    setErrorMsg(null);
  }, [isOpen, initialBarcode, existingProducts.length]);

  if (!isOpen) return null;

  const cleanBarcode = barcode.trim();
  const duplicateProduct = cleanBarcode
    ? existingProducts.find(
        (p) =>
          p.barcode?.trim() === cleanBarcode ||
          p.barcode?.replace(/\s+/g, '') === cleanBarcode.replace(/\s+/g, '')
      )
    : undefined;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = name.trim().slice(0, 145);
    const parsedSale = Number(salePrice);
    const parsedPurchase = Number(purchasePrice) || 0;
    const parsedStock = parseInt(stock, 10);
    const parsedMinAlert = parseInt(minStockAlert, 10);

    if (!cleanBarcode) {
      setErrorMsg('Veuillez scanner ou saisir un code-barres valide.');
      playSoundEffect('error');
      return;
    }

    if (duplicateProduct) {
      setErrorMsg(
        `Ce code-barres est déjà attribué à « ${duplicateProduct.name} » (${duplicateProduct.stock} ${duplicateProduct.unit} en stock).`
      );
      playSoundEffect('error');
      return;
    }

    if (cleanName.length < 2) {
      setErrorMsg('Veuillez saisir le nom de l’article (au moins 2 caractères).');
      playSoundEffect('error');
      return;
    }

    if (isNaN(parsedSale) || parsedSale < 0) {
      setErrorMsg('Veuillez indiquer un prix de vente valide (supérieur ou égal à 0).');
      playSoundEffect('error');
      return;
    }

    const created = store.addProduct({
      businessId: business.id,
      code: code.trim() || `ART-${String(existingProducts.length + 1).padStart(3, '0')}`,
      barcode: cleanBarcode,
      name: cleanName,
      category,
      purchasePrice: Math.max(0, parsedPurchase),
      salePrice: Math.max(0, parsedSale),
      stock: isNaN(parsedStock) ? 0 : Math.max(0, parsedStock),
      minStockAlert: isNaN(parsedMinAlert) ? 5 : Math.max(0, parsedMinAlert),
      unit: unit.trim() || 'pièce',
    });

    playSoundEffect('beep');
    onCreated(created);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-xs overflow-y-auto">
      <div
        className={`w-full max-w-lg rounded-2xl border shadow-2xl overflow-hidden my-auto flex flex-col max-h-[92dvh] ${
          isLight
            ? 'bg-white border-slate-200 text-slate-900'
            : 'bg-[#0b1020] border-cyan-500/40 text-white'
        }`}
      >
        {/* Header */}
        <div
          className={`px-5 py-4 border-b flex items-center justify-between gap-3 shrink-0 ${
            isLight
              ? 'bg-slate-50 border-slate-200'
              : 'bg-[#070a15] border-cyan-500/20'
          }`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                isLight
                  ? 'bg-amber-100 text-amber-700'
                  : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
              }`}
            >
              <PackagePlus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-extrabold tracking-tight">
                Nouvel article par code-barres
              </h3>
              <p className={`text-xs ${isLight ? 'text-slate-500' : 'text-neutral-400'}`}>
                {business.name} · Création rapide au catalogue
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className={`p-2 rounded-lg transition-colors cursor-pointer ${
              isLight
                ? 'text-slate-400 hover:text-slate-700 hover:bg-slate-200'
                : 'text-neutral-400 hover:text-white hover:bg-neutral-800'
            }`}
            aria-label="Fermer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-4 text-xs">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-200 font-semibold flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {duplicateProduct && !errorMsg && (
            <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200 font-medium flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
              <span>
                Code-barres déjà utilisé par <strong>{duplicateProduct.name}</strong> ({formatMoney(duplicateProduct.salePrice, business.currency)} · Stock : {duplicateProduct.stock} {duplicateProduct.unit}).
              </span>
            </div>
          )}

          {/* Scanned Barcode Field */}
          <div className="space-y-1.5">
            <label className={`block font-bold ${isLight ? 'text-slate-700' : 'text-neutral-200'}`}>
              Code-barres scanné <span className="text-rose-500">*</span>
            </label>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Barcode
                  className={`w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 ${
                    isLight ? 'text-amber-600' : 'text-cyan-400'
                  }`}
                />
                <input
                  type="text"
                  value={barcode}
                  onChange={(e) => {
                    setBarcode(e.target.value);
                    if (errorMsg) setErrorMsg(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      // Avoid accidental incomplete submit if scanned with USB wedge directly inside this input
                      e.preventDefault();
                    }
                  }}
                  placeholder="Scannez ou saisissez le code-barres..."
                  required
                  className={`w-full pl-9 pr-3 py-2.5 rounded-xl font-mono font-bold border focus:outline-hidden ${
                    isLight
                      ? 'bg-amber-50/50 border-amber-300 text-amber-900 focus:border-amber-500'
                      : 'bg-neutral-900 border-cyan-500/40 text-cyan-300 focus:border-cyan-400'
                  }`}
                />
              </div>
              {onRescanRequested && (
                <button
                  type="button"
                  onClick={onRescanRequested}
                  className={`px-3 py-2.5 rounded-xl font-bold border flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 ${
                    isLight
                      ? 'bg-white hover:bg-slate-100 text-slate-700 border-slate-300'
                      : 'bg-neutral-800 hover:bg-neutral-700 text-cyan-300 border-cyan-500/30'
                  }`}
                  title="Scanner avec la caméra"
                >
                  <Camera className="w-4 h-4" />
                  <span>Re-scanner</span>
                </button>
              )}
            </div>
          </div>

          {/* Product Name */}
          <div className="space-y-1.5">
            <label className={`block font-bold ${isLight ? 'text-slate-700' : 'text-neutral-200'}`}>
              Désignation de l’article <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (errorMsg) setErrorMsg(null);
              }}
              placeholder="Ex: Savon Liquide Citron 500ml"
              maxLength={145}
              required
              autoFocus
              className={`w-full px-3.5 py-2.5 rounded-xl border focus:outline-hidden ${
                isLight
                  ? 'bg-white border-slate-300 text-slate-900 focus:border-amber-500'
                  : 'bg-neutral-900 border-neutral-700 text-white focus:border-cyan-400'
              }`}
            />
          </div>

          {/* Sale Price + Stock */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className={`block font-bold ${isLight ? 'text-slate-700' : 'text-neutral-200'}`}>
                Prix de vente ({business.currency || 'FCFA'}) <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                min="0"
                step="25"
                value={salePrice}
                onChange={(e) => setSalePrice(e.target.value)}
                placeholder="Ex: 1500"
                required
                className={`w-full px-3.5 py-2.5 rounded-xl font-mono font-bold tabular-nums border focus:outline-hidden ${
                  isLight
                    ? 'bg-white border-slate-300 text-emerald-700 focus:border-amber-500'
                    : 'bg-neutral-900 border-neutral-700 text-emerald-400 focus:border-cyan-400'
                }`}
              />
            </div>

            <div className="space-y-1.5">
              <label className={`block font-bold ${isLight ? 'text-slate-700' : 'text-neutral-200'}`}>
                Stock initial
              </label>
              <input
                type="number"
                min="0"
                value={stock}
                onChange={(e) => setStock(e.target.value)}
                required
                className={`w-full px-3.5 py-2.5 rounded-xl font-mono tabular-nums border focus:outline-hidden ${
                  isLight
                    ? 'bg-white border-slate-300 text-slate-900 focus:border-amber-500'
                    : 'bg-neutral-900 border-neutral-700 text-white focus:border-cyan-400'
                }`}
              />
            </div>
          </div>

          {/* Category + Unit */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className={`block font-bold ${isLight ? 'text-slate-700' : 'text-neutral-200'}`}>
                Catégorie
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className={`w-full px-3 py-2.5 rounded-xl border focus:outline-hidden ${
                  isLight
                    ? 'bg-white border-slate-300 text-slate-900 focus:border-amber-500'
                    : 'bg-neutral-900 border-neutral-700 text-white focus:border-cyan-400'
                }`}
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className={`block font-bold ${isLight ? 'text-slate-700' : 'text-neutral-200'}`}>
                Unité
              </label>
              <input
                type="text"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                placeholder="pièce, bouteille, sac..."
                required
                className={`w-full px-3.5 py-2.5 rounded-xl border focus:outline-hidden ${
                  isLight
                    ? 'bg-white border-slate-300 text-slate-900 focus:border-amber-500'
                    : 'bg-neutral-900 border-neutral-700 text-white focus:border-cyan-400'
                }`}
              />
            </div>
          </div>

          {/* Purchase price + Internal Code + Alert */}
          <div className="grid grid-cols-3 gap-2.5">
            <div className="space-y-1">
              <label className={`block font-semibold ${isLight ? 'text-slate-600' : 'text-neutral-400'}`}>
                Prix d’achat
              </label>
              <input
                type="number"
                min="0"
                step="25"
                value={purchasePrice}
                onChange={(e) => setPurchasePrice(e.target.value)}
                className={`w-full px-3 py-2 rounded-xl font-mono tabular-nums border focus:outline-hidden ${
                  isLight
                    ? 'bg-white border-slate-300 text-slate-900 focus:border-amber-500'
                    : 'bg-neutral-900 border-neutral-700 text-white focus:border-cyan-400'
                }`}
              />
            </div>

            <div className="space-y-1">
              <label className={`block font-semibold ${isLight ? 'text-slate-600' : 'text-neutral-400'}`}>
                Seuil alerte
              </label>
              <input
                type="number"
                min="0"
                value={minStockAlert}
                onChange={(e) => setMinStockAlert(e.target.value)}
                className={`w-full px-3 py-2 rounded-xl font-mono tabular-nums border focus:outline-hidden ${
                  isLight
                    ? 'bg-white border-slate-300 text-amber-700 focus:border-amber-500'
                    : 'bg-neutral-900 border-neutral-700 text-amber-400 focus:border-cyan-400'
                }`}
              />
            </div>

            <div className="space-y-1">
              <label className={`block font-semibold ${isLight ? 'text-slate-600' : 'text-neutral-400'}`}>
                Réf. interne
              </label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className={`w-full px-3 py-2 rounded-xl font-mono border focus:outline-hidden ${
                  isLight
                    ? 'bg-white border-slate-300 text-slate-900 focus:border-amber-500'
                    : 'bg-neutral-900 border-neutral-700 text-white focus:border-cyan-400'
                }`}
              />
            </div>
          </div>

          <div
            className={`pt-3 border-t flex items-center justify-end gap-2.5 ${
              isLight ? 'border-slate-200' : 'border-neutral-800'
            }`}
          >
            <button
              type="button"
              onClick={onClose}
              className={`px-4 py-2.5 rounded-xl font-bold border transition-colors cursor-pointer whitespace-nowrap ${
                isLight
                  ? 'bg-white hover:bg-slate-100 text-slate-700 border-slate-300'
                  : 'bg-neutral-800 hover:bg-neutral-700 text-neutral-300 border-neutral-700'
              }`}
            >
              Annuler
            </button>

            <button
              type="submit"
              disabled={Boolean(duplicateProduct)}
              className={`px-5 py-2.5 rounded-xl font-black flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50 whitespace-nowrap ${
                isLight
                  ? 'bg-amber-500 hover:bg-amber-600 text-white shadow-sm'
                  : 'bg-cyan-400 hover:bg-cyan-300 text-neutral-950'
              }`}
            >
              <Check className="w-4 h-4" />
              <span>{submitLabel}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
