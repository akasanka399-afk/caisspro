/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Business, CashRegisterSession, User } from './types';
import { store } from './services/store';
import { ThemeProvider, useTheme } from './services/themeContext';
import { TopBar } from './components/TopBar';
import { POSView } from './components/POSView';
import { OwnerDashboardView } from './components/OwnerDashboardView';
import { DeveloperDashboardView } from './components/DeveloperDashboardView';
import { StockInventoryView } from './components/StockInventoryView';
import { CustomersView } from './components/CustomersView';
import { AuthModal } from './components/AuthModal';
import { CashSessionModal } from './components/CashSessionModal';

function MainLayout() {
  const { theme } = useTheme();
  const [currentUser, setCurrentUser] = useState<User>(store.getCurrentUser());
  const [currentBusiness, setCurrentBusiness] = useState<Business>(() => {
    const user = store.getCurrentUser();
    const allBiz = store.getBusinesses();
    return allBiz.find((b) => b.id === user.businessId) || allBiz[0];
  });

  const [activeView, setActiveView] = useState<string>(() => {
    const user = store.getCurrentUser();
    if (user.role === 'owner') return 'owner-dashboard';
    return 'pos';
  });

  // Modals
  const [showAuthModal, setShowAuthModal] = useState<boolean>(false);
  const [cashSessionModalMode, setCashSessionModalMode] = useState<'open' | 'close' | null>(null);

  // Active cash session
  const [activeSession, setActiveSession] = useState<CashRegisterSession | undefined>(() =>
    store.getActiveCashSession(currentBusiness.id)
  );

  // Sync state on updates
  useEffect(() => {
    const syncData = () => {
      const user = store.getCurrentUser();
      setCurrentUser(user);
      const allBiz = store.getBusinesses();
      const biz = allBiz.find((b) => b.id === user.businessId) || allBiz[0];
      setCurrentBusiness(biz);
      setActiveSession(store.getActiveCashSession(biz.id));
    };

    const unsub = store.subscribe(syncData);
    return () => unsub();
  }, [currentBusiness.id]);

  // Enforce strict RBAC view confidentiality
  useEffect(() => {
    if (currentUser.role === 'cashier') {
      if (activeView !== 'pos') {
        setActiveView('pos');
      }
    } else if (currentUser.role === 'manager') {
      if (activeView === 'owner-dashboard' || activeView === 'dev-dashboard') {
        setActiveView('pos');
      }
    } else if (currentUser.role === 'owner') {
      if (activeView === 'dev-dashboard') {
        setActiveView('owner-dashboard');
      }
    }
  }, [currentUser.role, activeView]);

  // Handle user switch
  const handleSelectUser = (user: User) => {
    store.setCurrentUser(user.id);
    setCurrentUser(user);

    const allBiz = store.getBusinesses();
    const biz = allBiz.find((b) => b.id === user.businessId) || allBiz[0];
    setCurrentBusiness(biz);

    // Switch view to match role (dev console is hidden behind 3 clicks + PIN)
    if (user.role === 'owner') {
      setActiveView('owner-dashboard');
    } else if (user.role === 'developer') {
      setActiveView('dev-dashboard');
    } else {
      setActiveView('pos');
    }
  };

  // Handle cash session open
  const handleOpenCashSession = (openingFloat: number) => {
    const sess = store.openCashSession(
      currentBusiness.id,
      currentUser.id,
      currentUser.name,
      openingFloat
    );
    setActiveSession(sess);
    setCashSessionModalMode(null);
  };

  // Handle cash session close
  const handleCloseCashSession = (sessionId: string, actualCash: number, notes?: string) => {
    store.closeCashSession(sessionId, actualCash, notes);
    setActiveSession(undefined);
    setCashSessionModalMode(null);
    alert('Clôture de caisse validée avec succès. Rapport Z archivé.');
  };

  const isLight = theme === 'light';

  return (
    <div
      className={`min-h-screen flex flex-col font-sans transition-colors duration-200 ${
        isLight
          ? 'bg-slate-50 text-slate-900'
          : 'bg-[#05070c] text-neutral-100'
      }`}
    >
      {/* Top Navigation conforming to strict three-zone contract */}
      <TopBar
        currentUser={currentUser}
        currentBusiness={currentBusiness}
        activeView={activeView}
        onNavigate={(view) => setActiveView(view)}
        onOpenAuthModal={() => setShowAuthModal(true)}
        onOpenCashSessionModal={() => {
          if (activeSession) {
            setCashSessionModalMode('close');
          } else {
            setCashSessionModalMode('open');
          }
        }}
      />

      {/* Main Content Area based on Active View */}
      <main className="flex-1 flex flex-col min-h-0">
        {activeView === 'pos' && (
          <POSView currentUser={currentUser} business={currentBusiness} />
        )}

        {activeView === 'owner-dashboard' && (
          <OwnerDashboardView currentUser={currentUser} business={currentBusiness} />
        )}

        {activeView === 'dev-dashboard' && (
          <DeveloperDashboardView currentUser={currentUser} />
        )}

        {activeView === 'stocks' && (
          <StockInventoryView currentUser={currentUser} business={currentBusiness} />
        )}

        {activeView === 'customers' && (
          <CustomersView currentUser={currentUser} business={currentBusiness} />
        )}
      </main>

      {/* Auth & Role Switcher Modal */}
      {showAuthModal && (
        <AuthModal
          currentUser={currentUser}
          onSelectUser={handleSelectUser}
          onClose={() => setShowAuthModal(false)}
        />
      )}

      {/* Cash Session Open / Close Modal */}
      {cashSessionModalMode && (
        <CashSessionModal
          mode={cashSessionModalMode}
          session={activeSession}
          cashierName={currentUser.name}
          onOpenSession={handleOpenCashSession}
          onCloseSession={handleCloseCashSession}
          onDismiss={() => setCashSessionModalMode(null)}
        />
      )}
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <MainLayout />
    </ThemeProvider>
  );
}
