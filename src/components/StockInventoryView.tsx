import React, { useState, useEffect } from 'react';
import { Business, Product, StockMovement, User } from '../types';
import { store } from '../services/store';
import { useTheme } from '../services/themeContext';
import { formatMoney, formatDate } from '../utils/formatters';
import {
  Package,
  AlertTriangle,
  Plus,
  ArrowDownLeft,
  ArrowUpRight,
  Search,
  Filter,
  Edit2,
  Trash2,
  Barcode,
  History,
  CheckCircle,
  TrendingUp,
  Tag,
  Layers,
} from 'lucide-react';

interface StockInventoryViewProps {
  currentUser: User;
  business: Business;
}

export const StockInventoryView: React.FC<StockInventoryViewProps> = ({ currentUser, business }) => {
  const { theme } = useTheme();
  const isLight = theme === 'light';

  const [products, setProducts] = useState<Product[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [filterLowStockOnly, setFilterLowStockOnly] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'catalog' | 'movements'>('catalog');

  // Modals
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [adjustTargetProduct, setAdjustTargetProduct] = useState<Product | null>(null);
  const [adjustQuantity, setAdjustQuantity] = useState<string>('10');
  const [adjustType, setAdjustType] = useState<'in' | 'out'>('in');
  const [adjustReason, setAdjustReason] = useState<string>('Réapprovisionnement fournisseur');

  // New product form state
  const [newCode, setNewCode] = useState<string>('');
  const [newBarcode, setNewBarcode] = useState<string>('');
  const [newName, setNewName] = useState<string>('');
  const [newCategory, setNewCategory] = useState<string>('Alimentation');
  const [newPurchasePrice, setNewPurchasePrice] = useState<string>('1000');
  const [newSalePrice, setNewSalePrice] = useState<string>('1500');
  const [newInitialStock, setNewInitialStock] = useState<string>('20');
  const [newMinAlert, setNewMinAlert] = useState<string>('5');
  const [newUnit, setNewUnit] = useState<string>('pièce');

  const refreshData = () => {
    setProducts(store.getProducts(business.id));
    setMovements(store.getStockMovements(business.id));
  };

  useEffect(() => {
    refreshData();
    const unsub = store.subscribe(() => {
      refreshData();
    });
    return () => unsub();
  }, [business.id]);

  const categories = ['all', ...Array.from(new Set(products.map((p) => p.category)))];

  // Low stock products count
  const lowStockProducts = products.filter((p) => p.stock <= p.minStockAlert);
  const totalStockUnits = products.reduce((sum, p) => sum + p.stock, 0);
  const totalStockAssetValue = products.reduce((sum, p) => sum + p.stock * p.purchasePrice, 0);

  // Filtered products
  const filteredProducts = products.filter((p) => {
    const matchesCategory = selectedCategory === 'all' || p.category === selectedCategory;
    const matchesSearch =
      searchQuery === '' ||
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.barcode.includes(searchQuery);
    const matchesLowStock = !filterLowStockOnly || p.stock <= p.minStockAlert;
    return matchesCategory && matchesSearch && matchesLowStock;
  });

  // Handle new product submit
  const handleAddProduct = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    const autoCode = newCode.trim() || `ART-${String(products.length + 1).padStart(3, '0')}`;
    const autoBarcode = newBarcode.trim() || `618${Date.now().toString().slice(-9)}`;

    store.addProduct({
      businessId: business.id,
      code: autoCode,
      barcode: autoBarcode,
      name: newName.trim(),
      category: newCategory,
      purchasePrice: parseFloat(newPurchasePrice) || 0,
      salePrice: parseFloat(newSalePrice) || 0,
      stock: parseInt(newInitialStock) || 0,
      minStockAlert: parseInt(newMinAlert) || 5,
      unit: newUnit.trim() || 'pièce',
    });

    setShowAddModal(false);
    setNewName('');
    setNewCode('');
    setNewBarcode('');
    alert(`Produit "${newName}" ajouté au catalogue.`);
  };

  // Handle stock adjustment submit
  const handleAdjustSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustTargetProduct) return;

    const qty = parseInt(adjustQuantity) || 0;
    const delta = adjustType === 'in' ? qty : -qty;

    store.adjustStock(adjustTargetProduct.id, delta, adjustReason);
    setAdjustTargetProduct(null);
    setAdjustQuantity('10');
    alert(`Stock mis à jour pour ${adjustTargetProduct.name}.`);
  };

  // Delete product
  const handleDeleteProduct = (prod: Product) => {
    if (confirm(`Confirmez-vous la suppression du produit "${prod.name}" ?`)) {
      store.deleteProduct(prod.id);
    }
  };

  return (
    <div className={`flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto w-full transition-colors duration-200 ${
      isLight ? 'bg-slate-100 text-slate-900' : 'bg-neutral-950 text-white'
    }`}>
      {/* Top Header */}
      <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b ${
        isLight ? 'border-slate-300' : 'border-neutral-800'
      }`}>
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold mb-1">
            <span className={isLight ? 'text-amber-700 font-bold' : 'text-cyan-400 font-mono tracking-wider'}>
              Gestion des Stocks & Fiches Produits
            </span>
            <span className={isLight ? 'text-slate-400' : 'text-neutral-600'}>·</span>
            <span className={isLight ? 'text-slate-600 font-medium' : 'text-neutral-400 font-normal'}>
              {business.name}
            </span>
          </div>
          <h1 className={`text-xl md:text-2xl font-extrabold tracking-tight ${
            isLight ? 'text-slate-900' : 'text-white'
          }`}>
            Inventaire & Suivi des Flux en Temps Réel
          </h1>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => {
              setNewCode(`ART-${String(products.length + 1).padStart(3, '0')}`);
              setNewBarcode(`618${Date.now().toString().slice(-9)}`);
              setShowAddModal(true);
            }}
            className={`px-4 py-2 text-xs font-bold rounded-lg flex items-center gap-1.5 transition-all shadow-sm ${
              isLight
                ? 'bg-amber-500 hover:bg-amber-600 text-white shadow-amber-500/20 active:scale-95'
                : 'bg-cyan-400 hover:bg-cyan-300 text-neutral-950 neon-glow shadow-cyan-400/30'
            }`}
          >
            <Plus className="w-4 h-4" />
            <span>Nouveau Produit</span>
          </button>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Total references */}
        <div className={`p-4 rounded-xl space-y-1 transition-all ${
          isLight
            ? 'retail-card bg-white border border-slate-200 shadow-xs'
            : 'neon-card bg-neutral-900/90 border border-cyan-500/30'
        }`}>
          <div className="flex items-center justify-between">
            <span className={`text-xs font-medium ${isLight ? 'text-slate-500' : 'text-neutral-400'}`}>
              Total Références en Rayon
            </span>
            <Layers className={`w-4 h-4 ${isLight ? 'text-slate-400' : 'text-cyan-400'}`} />
          </div>
          <div className={`text-2xl font-extrabold font-mono tabular-nums ${isLight ? 'text-slate-900' : 'text-white'}`}>
            {products.length} références
          </div>
          <span className={`text-[11px] font-mono ${isLight ? 'text-slate-500' : 'text-neutral-500'}`}>
            {totalStockUnits} unités physiques en stock
          </span>
        </div>

        {/* Stock Asset Value */}
        <div className={`p-4 rounded-xl space-y-1 transition-all ${
          isLight
            ? 'retail-card bg-white border border-slate-200 shadow-xs'
            : 'neon-card bg-neutral-900/90 border border-emerald-500/30'
        }`}>
          <div className="flex items-center justify-between">
            <span className={`text-xs font-medium ${isLight ? 'text-slate-500' : 'text-neutral-400'}`}>
              Valeur Marchande du Stock (Achat)
            </span>
            <TrendingUp className={`w-4 h-4 ${isLight ? 'text-emerald-600' : 'text-emerald-400'}`} />
          </div>
          <div className={`text-2xl font-extrabold font-mono tabular-nums ${
            isLight ? 'text-emerald-700' : 'text-emerald-400 neon-text-green'
          }`}>
            {formatMoney(totalStockAssetValue)}
          </div>
          <span className={`text-[11px] font-mono ${isLight ? 'text-emerald-700/80' : 'text-emerald-500/80'}`}>
            Actif immobilisé magasin
          </span>
        </div>

        {/* Low Stock Alerts */}
        <div className={`p-4 rounded-xl space-y-1 transition-all ${
          isLight
            ? 'retail-card bg-white border border-slate-200 shadow-xs'
            : 'neon-card bg-neutral-900/90 border border-amber-500/30'
        }`}>
          <div className="flex items-center justify-between">
            <span className={`text-xs font-medium ${isLight ? 'text-slate-500' : 'text-neutral-400'}`}>
              Alertes Stock Critique
            </span>
            <AlertTriangle className={`w-4 h-4 ${lowStockProducts.length > 0 ? (isLight ? 'text-rose-600' : 'text-rose-400') : (isLight ? 'text-slate-400' : 'text-neutral-600')}`} />
          </div>
          <div className={`text-2xl font-extrabold font-mono tabular-nums ${
            lowStockProducts.length > 0
              ? (isLight ? 'text-rose-700 font-bold' : 'text-rose-400')
              : (isLight ? 'text-slate-700' : 'text-neutral-300')
          }`}>
            {lowStockProducts.length} articles
          </div>
          <button
            onClick={() => setFilterLowStockOnly(!filterLowStockOnly)}
            className={`text-[11px] font-semibold hover:underline flex items-center gap-1 ${
              isLight ? 'text-amber-700' : 'text-cyan-400'
            }`}
          >
            {filterLowStockOnly ? 'Afficher tous les articles' : 'Filtrer uniquement le stock critique'}
          </button>
        </div>
      </div>

      {/* Critical Stock Alert Banner */}
      {lowStockProducts.length > 0 && (
        <div className={`p-4 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border ${
          isLight
            ? 'bg-rose-50 border-rose-300 text-rose-900'
            : 'bg-rose-950/30 border-rose-800/60 text-rose-200'
        }`}>
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${
              isLight ? 'bg-rose-100 text-rose-600' : 'bg-rose-500/20 text-rose-400'
            }`}>
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h4 className={`text-xs font-bold ${isLight ? 'text-rose-900' : 'text-rose-200'}`}>
                {lowStockProducts.length} référence(s) sous le seuil d'alerte minimal !
              </h4>
              <p className={`text-[11px] ${isLight ? 'text-rose-700' : 'text-rose-300/80'}`}>
                Articles à réapprovisionner : {lowStockProducts.map((p) => `${p.name} (${p.stock})`).join(', ')}.
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              if (lowStockProducts[0]) {
                setAdjustTargetProduct(lowStockProducts[0]);
                setAdjustType('in');
                setAdjustReason('Réapprovisionnement d\'urgence suite alerte');
              }
            }}
            className={`px-3.5 py-1.5 font-bold text-xs rounded-lg transition-colors shrink-0 ${
              isLight
                ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-xs'
                : 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-600/30'
            }`}
          >
            Réapprovisionner
          </button>
        </div>
      )}

      {/* View Switcher Tabs: Catalog vs Audit Movements */}
      <div className={`flex items-center justify-between border-b pb-2 ${
        isLight ? 'border-slate-300' : 'border-neutral-800'
      }`}>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('catalog')}
            className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all ${
              activeTab === 'catalog'
                ? isLight
                  ? 'bg-amber-500 text-white shadow-xs'
                  : 'bg-cyan-400 text-neutral-950 font-extrabold shadow-cyan-400/20'
                : isLight
                ? 'bg-white text-slate-600 hover:text-slate-900 border border-slate-200'
                : 'bg-neutral-900 text-neutral-400 hover:text-white border border-neutral-800'
            }`}
          >
            Catalogue & Fiches Articles ({products.length})
          </button>
          <button
            onClick={() => setActiveTab('movements')}
            className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all ${
              activeTab === 'movements'
                ? isLight
                  ? 'bg-amber-500 text-white shadow-xs'
                  : 'bg-cyan-400 text-neutral-950 font-extrabold shadow-cyan-400/20'
                : isLight
                ? 'bg-white text-slate-600 hover:text-slate-900 border border-slate-200'
                : 'bg-neutral-900 text-neutral-400 hover:text-white border border-neutral-800'
            }`}
          >
            Historique des Flux & Mouvements ({movements.length})
          </button>
        </div>
      </div>

      {/* TAB 1: PRODUCT CATALOG & STOCK CONTROLS */}
      {activeTab === 'catalog' && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            {/* Search */}
            <div className="relative flex-1 max-w-md">
              <Search className={`w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 ${
                isLight ? 'text-slate-400' : 'text-neutral-500'
              }`} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Rechercher par nom, code ou code-barres..."
                className={`w-full pl-9 pr-4 py-2 rounded-lg text-xs transition-colors ${
                  isLight
                    ? 'bg-white border border-slate-300 text-slate-900 placeholder-slate-400 focus:outline-hidden focus:border-amber-500 shadow-xs'
                    : 'bg-neutral-900 border border-neutral-800 text-white placeholder-neutral-500 focus:outline-hidden focus:border-cyan-400'
                }`}
              />
            </div>

            {/* Category Select */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
              {categories.map((c) => (
                <button
                  key={c}
                  onClick={() => setSelectedCategory(c)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg whitespace-nowrap transition-colors ${
                    selectedCategory === c
                      ? isLight
                        ? 'bg-slate-900 text-white'
                        : 'bg-neutral-800 text-cyan-400 border border-cyan-400/40'
                      : isLight
                      ? 'bg-white text-slate-600 hover:bg-slate-200/80 border border-slate-200'
                      : 'bg-neutral-900 text-neutral-400 hover:text-white border border-neutral-800'
                  }`}
                >
                  {c === 'all' ? 'Toutes catégories' : c}
                </button>
              ))}
            </div>
          </div>

          {/* Table */}
          <div className={`rounded-xl overflow-hidden border ${
            isLight
              ? 'retail-card bg-white border-slate-200 shadow-xs'
              : 'neon-card bg-neutral-900/90 border-neutral-800'
          }`}>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className={`border-b ${
                  isLight
                    ? 'bg-slate-50 border-slate-200 text-slate-700'
                    : 'bg-neutral-950/80 border-neutral-800 text-neutral-400'
                }`}>
                  <tr>
                    <th className="px-4 py-3 font-bold">Produit</th>
                    <th className="px-4 py-3 font-bold">Catégorie</th>
                    <th className="px-4 py-3 font-bold">Code-barres</th>
                    <th className="px-4 py-3 font-bold text-right">P. Achat</th>
                    <th className="px-4 py-3 font-bold text-right">P. Vente</th>
                    <th className="px-4 py-3 font-bold text-right">Marge</th>
                    <th className="px-4 py-3 font-bold text-center">Stock Actuel</th>
                    <th className="px-4 py-3 font-bold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className={`divide-y ${
                  isLight ? 'divide-slate-200' : 'divide-neutral-800/80'
                }`}>
                  {filteredProducts.map((p) => {
                    const margin = p.salePrice - p.purchasePrice;
                    const marginPct = p.purchasePrice > 0 ? Math.round((margin / p.purchasePrice) * 100) : 0;
                    const isLow = p.stock <= p.minStockAlert;
                    const isZero = p.stock === 0;

                    return (
                      <tr key={p.id} className={`transition-colors ${
                        isLight ? 'hover:bg-slate-50/80' : 'hover:bg-neutral-850/50'
                      }`}>
                        <td className="px-4 py-3">
                          <div className={`font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>{p.name}</div>
                          <div className={`text-[11px] font-mono ${isLight ? 'text-slate-500' : 'text-neutral-400'}`}>
                            Ref: {p.code}
                          </div>
                        </td>
                        <td className={`px-4 py-3 ${isLight ? 'text-slate-600' : 'text-neutral-300'}`}>{p.category}</td>
                        <td className={`px-4 py-3 font-mono ${isLight ? 'text-slate-500' : 'text-neutral-400'}`}>{p.barcode}</td>
                        <td className={`px-4 py-3 text-right font-mono tabular-nums ${isLight ? 'text-slate-600' : 'text-neutral-400'}`}>
                          {formatMoney(p.purchasePrice)}
                        </td>
                        <td className={`px-4 py-3 text-right font-mono font-bold tabular-nums ${isLight ? 'text-slate-900' : 'text-white'}`}>
                          {formatMoney(p.salePrice)}
                        </td>
                        <td className={`px-4 py-3 text-right font-mono font-semibold tabular-nums ${isLight ? 'text-emerald-700' : 'text-emerald-400'}`}>
                          +{formatMoney(margin)} ({marginPct}%)
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span
                            className={`inline-flex items-center gap-1 font-mono font-bold px-2 py-0.5 rounded text-[11px] ${
                              isZero
                                ? isLight
                                  ? 'bg-rose-100 text-rose-700 border border-rose-300'
                                  : 'bg-rose-950/60 text-rose-300 border border-rose-800'
                                : isLow
                                ? isLight
                                  ? 'bg-amber-100 text-amber-800 border border-amber-300'
                                  : 'bg-amber-950/60 text-amber-300 border border-amber-800'
                                : isLight
                                ? 'bg-slate-100 text-slate-800 border border-slate-300'
                                : 'bg-neutral-950 text-neutral-200 border border-neutral-800'
                            }`}
                          >
                            {isLow && <AlertTriangle className="w-3 h-3 text-amber-500" />}
                            <span>
                              {p.stock} {p.unit}
                            </span>
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => {
                                setAdjustTargetProduct(p);
                                setAdjustType('in');
                                setAdjustReason('Réapprovisionnement fournisseur');
                              }}
                              className={`px-2.5 py-1 rounded text-[11px] font-bold transition-colors flex items-center gap-1 ${
                                isLight
                                  ? 'bg-amber-100 hover:bg-amber-200 text-amber-800 border border-amber-300'
                                  : 'bg-neutral-800 hover:bg-neutral-700 text-cyan-400 border border-cyan-500/20'
                              }`}
                              title="Ajuster ou réapprovisionner le stock"
                            >
                              <Plus className="w-3 h-3" />
                              <span>Stock</span>
                            </button>
                            <button
                              onClick={() => handleDeleteProduct(p)}
                              className={`p-1.5 rounded transition-colors ${
                                isLight
                                  ? 'text-slate-400 hover:text-rose-600 hover:bg-rose-50'
                                  : 'text-neutral-500 hover:text-rose-400 hover:bg-neutral-800'
                              }`}
                              title="Supprimer la fiche"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: AUDIT LOG OF STOCK MOVEMENTS */}
      {activeTab === 'movements' && (
        <div className={`rounded-xl overflow-hidden border ${
          isLight
            ? 'retail-card bg-white border-slate-200 shadow-xs'
            : 'neon-card bg-neutral-900 border-neutral-800'
        }`}>
          <div className={`px-5 py-4 border-b flex items-center justify-between ${
            isLight ? 'bg-slate-50 border-slate-200' : 'bg-neutral-950 border-neutral-800'
          }`}>
            <h3 className={`text-xs font-bold uppercase tracking-wider ${
              isLight ? 'text-slate-900' : 'text-white'
            }`}>
              Journal d'audit des flux de stock
            </h3>
            <span className={`text-xs ${isLight ? 'text-slate-500' : 'text-neutral-400'}`}>
              Traçabilité horodatée
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className={`border-b ${
                isLight ? 'bg-slate-100/70 border-slate-200 text-slate-700' : 'bg-neutral-950/60 border-neutral-800 text-neutral-400'
              }`}>
                <tr>
                  <th className="px-4 py-2.5 font-bold">Date & Heure</th>
                  <th className="px-4 py-2.5 font-bold">Produit</th>
                  <th className="px-4 py-2.5 font-bold">Type de Flux</th>
                  <th className="px-4 py-2.5 font-bold text-center">Quantité</th>
                  <th className="px-4 py-2.5 font-bold text-center">Avant / Après</th>
                  <th className="px-4 py-2.5 font-bold">Motif / Justificatif</th>
                  <th className="px-4 py-2.5 font-bold">Auteur</th>
                </tr>
              </thead>
              <tbody className={`divide-y ${isLight ? 'divide-slate-200' : 'divide-neutral-800/80'}`}>
                {movements.map((m) => (
                  <tr key={m.id} className={`transition-colors ${
                    isLight ? 'hover:bg-slate-50' : 'hover:bg-neutral-850/50'
                  }`}>
                    <td className={`px-4 py-2.5 font-mono ${isLight ? 'text-slate-700' : 'text-neutral-300'}`}>
                      {formatDate(m.timestamp)}
                    </td>
                    <td className={`px-4 py-2.5 font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>
                      {m.productName}
                    </td>
                    <td className="px-4 py-2.5">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold ${
                          m.type === 'in'
                            ? isLight
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                              : 'bg-emerald-950/40 text-emerald-400 border border-emerald-800'
                            : m.type === 'sale'
                            ? isLight
                              ? 'bg-blue-100 text-blue-800 border border-blue-300'
                              : 'bg-blue-950/40 text-blue-400 border border-blue-800'
                            : isLight
                            ? 'bg-amber-100 text-amber-800 border border-amber-300'
                            : 'bg-amber-950/40 text-amber-400 border border-amber-800'
                        }`}
                      >
                        {m.type === 'in' ? 'Entrée / Livraison' : m.type === 'sale' ? 'Vente Caisse' : 'Ajustement'}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-center font-mono font-bold">
                      <span className={m.quantity >= 0 ? (isLight ? 'text-emerald-700' : 'text-emerald-400') : (isLight ? 'text-rose-700' : 'text-rose-400')}>
                        {m.quantity >= 0 ? `+${m.quantity}` : m.quantity}
                      </span>
                    </td>
                    <td className={`px-4 py-2.5 text-center font-mono ${isLight ? 'text-slate-600' : 'text-neutral-400'}`}>
                      {m.previousStock} → <strong className={isLight ? 'text-slate-900' : 'text-white'}>{m.newStock}</strong>
                    </td>
                    <td className={`px-4 py-2.5 ${isLight ? 'text-slate-700' : 'text-neutral-300'}`}>{m.reason}</td>
                    <td className={`px-4 py-2.5 ${isLight ? 'text-slate-500' : 'text-neutral-400'}`}>{m.userName}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal: Adjust Stock */}
      {adjustTargetProduct && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className={`rounded-xl max-w-md w-full p-6 space-y-4 shadow-2xl border ${
            isLight ? 'retail-card bg-white border-slate-300' : 'neon-card bg-neutral-900 border-neutral-800'
          }`}>
            <h3 className={`text-sm font-bold flex items-center gap-2 ${isLight ? 'text-slate-900' : 'text-white'}`}>
              <Package className={`w-4 h-4 ${isLight ? 'text-amber-600' : 'text-cyan-400'}`} />
              <span>Ajustement de Stock : {adjustTargetProduct.name}</span>
            </h3>

            <form onSubmit={handleAdjustSubmit} className="space-y-3.5 text-xs">
              <div className={`p-3 rounded-lg border flex justify-between items-center ${
                isLight ? 'bg-slate-50 border-slate-200' : 'bg-neutral-950 border-neutral-800'
              }`}>
                <span className={isLight ? 'text-slate-600' : 'text-neutral-400'}>Stock actuellement en rayon :</span>
                <span className={`font-mono font-bold text-base ${isLight ? 'text-slate-900' : 'text-white'}`}>
                  {adjustTargetProduct.stock} {adjustTargetProduct.unit}
                </span>
              </div>

              <div>
                <label className={`block font-semibold mb-1 ${isLight ? 'text-slate-700' : 'text-neutral-300'}`}>Type de Mouvement</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setAdjustType('in')}
                    className={`p-2.5 rounded-lg border font-bold text-center transition-colors ${
                      adjustType === 'in'
                        ? isLight
                          ? 'bg-emerald-100 border-emerald-400 text-emerald-800'
                          : 'bg-emerald-950/40 border-emerald-500 text-emerald-300'
                        : isLight
                        ? 'bg-slate-100 border-slate-200 text-slate-600'
                        : 'bg-neutral-950 border-neutral-800 text-neutral-400'
                    }`}
                  >
                    + Entrée (Livraison)
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdjustType('out')}
                    className={`p-2.5 rounded-lg border font-bold text-center transition-colors ${
                      adjustType === 'out'
                        ? isLight
                          ? 'bg-rose-100 border-rose-400 text-rose-800'
                          : 'bg-rose-950/40 border-rose-500 text-rose-300'
                        : isLight
                        ? 'bg-slate-100 border-slate-200 text-slate-600'
                        : 'bg-neutral-950 border-neutral-800 text-neutral-400'
                    }`}
                  >
                    - Sortie (Perte / Casse)
                  </button>
                </div>
              </div>

              <div>
                <label className={`block font-semibold mb-1 ${isLight ? 'text-slate-700' : 'text-neutral-300'}`}>
                  Quantité ({adjustTargetProduct.unit})
                </label>
                <input
                  type="number"
                  min="1"
                  value={adjustQuantity}
                  onChange={(e) => setAdjustQuantity(e.target.value)}
                  required
                  className={`w-full px-3 py-2 rounded-lg font-mono text-base font-bold transition-colors ${
                    isLight
                      ? 'bg-white border border-slate-300 text-slate-900 focus:outline-hidden focus:border-amber-500'
                      : 'bg-neutral-950 border border-neutral-800 text-white focus:outline-hidden focus:border-cyan-400'
                  }`}
                  autoFocus
                />
              </div>

              <div>
                <label className={`block font-semibold mb-1 ${isLight ? 'text-slate-700' : 'text-neutral-300'}`}>
                  Motif / Numéro de Bon de Livraison
                </label>
                <input
                  type="text"
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  placeholder="Ex: Facture Fournisseur F-9021"
                  required
                  className={`w-full px-3 py-2 rounded-lg transition-colors ${
                    isLight
                      ? 'bg-white border border-slate-300 text-slate-900 focus:outline-hidden focus:border-amber-500'
                      : 'bg-neutral-950 border border-neutral-800 text-white focus:outline-hidden focus:border-cyan-400'
                  }`}
                />
              </div>

              <div className={`pt-2 flex justify-end gap-2 border-t ${isLight ? 'border-slate-200' : 'border-neutral-800'}`}>
                <button
                  type="button"
                  onClick={() => setAdjustTargetProduct(null)}
                  className={`px-4 py-2 rounded-lg font-medium ${
                    isLight ? 'bg-slate-200 hover:bg-slate-300 text-slate-700' : 'bg-neutral-800 hover:bg-neutral-700 text-neutral-300'
                  }`}
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className={`px-5 py-2 font-bold rounded-lg ${
                    isLight
                      ? 'bg-amber-500 hover:bg-amber-600 text-white shadow-xs'
                      : 'bg-cyan-400 hover:bg-cyan-300 text-neutral-950 neon-glow'
                  }`}
                >
                  Valider l'ajustement
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Add New Product */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className={`rounded-xl max-w-lg w-full p-6 space-y-4 shadow-2xl overflow-y-auto max-h-[85vh] border ${
            isLight ? 'retail-card bg-white border-slate-300' : 'neon-card bg-neutral-900 border-neutral-800'
          }`}>
            <div className={`flex items-center justify-between pb-2 border-b ${
              isLight ? 'border-slate-200' : 'border-neutral-800'
            }`}>
              <h3 className={`text-base font-bold flex items-center gap-2 ${isLight ? 'text-slate-900' : 'text-white'}`}>
                <Package className={`w-4 h-4 ${isLight ? 'text-amber-600' : 'text-cyan-400'}`} />
                <span>Créer une Nouvelle Fiche Article</span>
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className={`p-1 rounded ${isLight ? 'text-slate-400 hover:text-slate-700' : 'text-neutral-400 hover:text-white'}`}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddProduct} className="space-y-3 text-xs">
              <div>
                <label className={`block font-semibold mb-1 ${isLight ? 'text-slate-700' : 'text-neutral-300'}`}>
                  Désignation du produit
                </label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Ex: Sucre Blanc Raffiné 1kg"
                  required
                  className={`w-full px-3 py-2 rounded-lg transition-colors ${
                    isLight
                      ? 'bg-white border border-slate-300 text-slate-900 focus:outline-hidden focus:border-amber-500'
                      : 'bg-neutral-950 border border-neutral-800 text-white focus:outline-hidden focus:border-cyan-400'
                  }`}
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={`block font-semibold mb-1 ${isLight ? 'text-slate-700' : 'text-neutral-300'}`}>Rayon / Catégorie</label>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    className={`w-full px-3 py-2 rounded-lg transition-colors ${
                      isLight
                        ? 'bg-white border border-slate-300 text-slate-900 focus:outline-hidden focus:border-amber-500'
                        : 'bg-neutral-950 border border-neutral-800 text-white focus:outline-hidden focus:border-cyan-400'
                    }`}
                  >
                    <option value="Alimentation">Alimentation</option>
                    <option value="Boissons">Boissons</option>
                    <option value="Hygiène & Soins">Hygiène & Soins</option>
                    <option value="Snacks & Biscuits">Snacks & Biscuits</option>
                    <option value="Bazar & Divers">Bazar & Divers</option>
                  </select>
                </div>

                <div>
                  <label className={`block font-semibold mb-1 ${isLight ? 'text-slate-700' : 'text-neutral-300'}`}>Unité</label>
                  <input
                    type="text"
                    value={newUnit}
                    onChange={(e) => setNewUnit(e.target.value)}
                    placeholder="sac, bouteille, pièce..."
                    required
                    className={`w-full px-3 py-2 rounded-lg transition-colors ${
                      isLight
                        ? 'bg-white border border-slate-300 text-slate-900 focus:outline-hidden focus:border-amber-500'
                        : 'bg-neutral-950 border border-neutral-800 text-white focus:outline-hidden focus:border-cyan-400'
                    }`}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={`block font-semibold mb-1 ${isLight ? 'text-slate-700' : 'text-neutral-300'}`}>Code Interne</label>
                  <input
                    type="text"
                    value={newCode}
                    onChange={(e) => setNewCode(e.target.value)}
                    className={`w-full px-3 py-2 rounded-lg font-mono transition-colors ${
                      isLight
                        ? 'bg-white border border-slate-300 text-slate-900 focus:outline-hidden focus:border-amber-500'
                        : 'bg-neutral-950 border border-neutral-800 text-white focus:outline-hidden focus:border-cyan-400'
                    }`}
                  />
                </div>

                <div>
                  <label className={`block font-semibold mb-1 ${isLight ? 'text-slate-700' : 'text-neutral-300'}`}>Code-barres (EAN-13)</label>
                  <input
                    type="text"
                    value={newBarcode}
                    onChange={(e) => setNewBarcode(e.target.value)}
                    className={`w-full px-3 py-2 rounded-lg font-mono transition-colors ${
                      isLight
                        ? 'bg-white border border-slate-300 text-amber-700 focus:outline-hidden focus:border-amber-500'
                        : 'bg-neutral-950 border border-neutral-800 text-cyan-300 focus:outline-hidden focus:border-cyan-400'
                    }`}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={`block font-semibold mb-1 ${isLight ? 'text-slate-700' : 'text-neutral-300'}`}>Prix d'Achat (F CFA)</label>
                  <input
                    type="number"
                    min="0"
                    step="50"
                    value={newPurchasePrice}
                    onChange={(e) => setNewPurchasePrice(e.target.value)}
                    required
                    className={`w-full px-3 py-2 rounded-lg font-mono transition-colors ${
                      isLight
                        ? 'bg-white border border-slate-300 text-slate-900 focus:outline-hidden focus:border-amber-500'
                        : 'bg-neutral-950 border border-neutral-800 text-white focus:outline-hidden focus:border-cyan-400'
                    }`}
                  />
                </div>

                <div>
                  <label className={`block font-semibold mb-1 ${isLight ? 'text-slate-700' : 'text-neutral-300'}`}>Prix de Vente TTC (F CFA)</label>
                  <input
                    type="number"
                    min="0"
                    step="50"
                    value={newSalePrice}
                    onChange={(e) => setNewSalePrice(e.target.value)}
                    required
                    className={`w-full px-3 py-2 rounded-lg font-mono font-bold transition-colors ${
                      isLight
                        ? 'bg-white border border-slate-300 text-emerald-700 focus:outline-hidden focus:border-amber-500'
                        : 'bg-neutral-950 border border-neutral-800 text-emerald-400 focus:outline-hidden focus:border-cyan-400'
                    }`}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={`block font-semibold mb-1 ${isLight ? 'text-slate-700' : 'text-neutral-300'}`}>Stock Initial</label>
                  <input
                    type="number"
                    min="0"
                    value={newInitialStock}
                    onChange={(e) => setNewInitialStock(e.target.value)}
                    required
                    className={`w-full px-3 py-2 rounded-lg font-mono transition-colors ${
                      isLight
                        ? 'bg-white border border-slate-300 text-slate-900 focus:outline-hidden focus:border-amber-500'
                        : 'bg-neutral-950 border border-neutral-800 text-white focus:outline-hidden focus:border-cyan-400'
                    }`}
                  />
                </div>

                <div>
                  <label className={`block font-semibold mb-1 ${isLight ? 'text-slate-700' : 'text-neutral-300'}`}>Seuil Alerte Stock Mini</label>
                  <input
                    type="number"
                    min="1"
                    value={newMinAlert}
                    onChange={(e) => setNewMinAlert(e.target.value)}
                    required
                    className={`w-full px-3 py-2 rounded-lg font-mono transition-colors ${
                      isLight
                        ? 'bg-white border border-slate-300 text-amber-700 focus:outline-hidden focus:border-amber-500'
                        : 'bg-neutral-950 border border-neutral-800 text-amber-400 focus:outline-hidden focus:border-cyan-400'
                    }`}
                  />
                </div>
              </div>

              <div className={`pt-3 flex justify-end gap-2 border-t ${isLight ? 'border-slate-200' : 'border-neutral-800'}`}>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className={`px-4 py-2 rounded-lg font-medium ${
                    isLight ? 'bg-slate-200 hover:bg-slate-300 text-slate-700' : 'bg-neutral-800 hover:bg-neutral-700 text-neutral-300'
                  }`}
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className={`px-5 py-2 font-bold rounded-lg ${
                    isLight
                      ? 'bg-amber-500 hover:bg-amber-600 text-white shadow-xs'
                      : 'bg-cyan-400 hover:bg-cyan-300 text-neutral-950 neon-glow'
                  }`}
                >
                  Enregistrer l'Article
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
