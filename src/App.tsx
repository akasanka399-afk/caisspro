/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Business, CashRegisterSession, CashDenominations, PushNotification, User } from './types';
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
import { ZReportModal } from './components/ZReportModal';
import {
  AboutModule,
  DashboardModule,
  DigiSoliaShell,
  ErrorBoundary,
  FeedbackModule,
  NotificationsModule,
  ProfileModule,
  SettingsModule,
  SupportModule,
  WelcomeModule,
  hasSeenWelcomePage,
  useDigiSoliaAuth,
} from './digisolia';

const FALLBACK_EMPTY_BUSINESS: Business = {
  id: 'biz_none',
  name: 'Aucun commerce sélectionné',
  tradeType: 'Non configuré',
  currency: 'FCFA',
  phone: '',
  address: '',
  ownerName: 'Développeur',
  subscriptionPlan: 'starter',
  subscriptionStatus: 'trial',
  subscriptionExpiresAt: '2099-12-31',
  totalSalesCount: 0,
  developerFeeRate: 20,
  createdAt: '2026-01-01',
  accessCode: '---',
};

function MainLayout() {
  const { theme } = useTheme();
  const { firebaseUser } = useDigiSoliaAuth();

  const [currentUser, setCurrentUser] = useState<User>(store.getCurrentUser());
  const [currentBusiness, setCurrentBusiness] = useState<Business>(() => {
    const user = store.getCurrentUser();
    const allBiz = store.getBusinesses();
    return allBiz.find((b) => b.id === user.businessId) || allBiz[0] || FALLBACK_EMPTY_BUSINESS;
  });
  const [notifications, setNotifications] = useState<PushNotification[]>(() =>
    store.getNotifications(currentUser.role, currentBusiness.id)
  );

  const defaultBusinessView = currentUser.role === 'owner' ? 'owner-dashboard' : 'pos';

  const [activeView, setActiveView] = useState<string>(() => {
    if (!hasSeenWelcomePage()) {
      return 'daf-welcome';
    }
    const user = store.getCurrentUser();
    if (user.role === 'owner') return 'owner-dashboard';
    return 'pos';
  });

  // Modals
  const [showAuthModal, setShowAuthModal] = useState<boolean>(false);
  const [cashSessionModalMode, setCashSessionModalMode] = useState<'open' | 'close' | null>(null);
  const [activeZReportSession, setActiveZReportSession] = useState<CashRegisterSession | null>(null);

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
      const biz = allBiz.find((b) => b.id === user.businessId) || allBiz[0] || FALLBACK_EMPTY_BUSINESS;
      setCurrentBusiness(biz);
      setActiveSession(store.getActiveCashSession(biz.id));
      setNotifications(store.getNotifications(user.role, biz.id));
    };

    syncData();
    const unsub = store.subscribe(syncData);
    return () => unsub();
  }, [currentBusiness.id]);

  // Enforce strict RBAC view confidentiality for business views while allowing DAF framework modules
  useEffect(() => {
    const isDafView = activeView.startsWith('daf-');
    if (isDafView) return;

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
    const biz = allBiz.find((b) => b.id === user.businessId) || allBiz[0] || FALLBACK_EMPTY_BUSINESS;
    setCurrentBusiness(biz);

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

  // Handle cash session close & trigger official Z-Report (or close without printing)
  const handleCloseCashSession = (
    sessionId: string,
    actualCash: number,
    notes?: string,
    denominations?: CashDenominations,
    openZReport: boolean = true
  ) => {
    const closed = store.closeCashSession(sessionId, actualCash, notes, denominations);
    setActiveSession(undefined);
    setCashSessionModalMode(null);
    if (closed && openZReport) {
      setActiveZReportSession(closed);
    }
  };

  const isLight = theme === 'light';
  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div
      className={`min-h-screen md:h-screen md:overflow-hidden flex flex-col font-sans transition-colors duration-200 ${
        isLight
          ? 'bg-[#F4F7FB] text-slate-900'
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

      {/* DigiSolia App Framework Responsive Shell wrapping Existing App + DAF Modules */}
      <DigiSoliaShell
        activeView={activeView}
        businessViewFallback={defaultBusinessView}
        unreadNotificationsCount={unreadCount}
        onNavigate={(view) => setActiveView(view)}
      >
        <main className="flex-1 flex flex-col min-h-full">
          {/* --- EXISTING DIGISOLIA POS (CAISSE PRO) VIEWS --- */}
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

          {/* --- DIGISOLIA APP FRAMEWORK (DAF) COMMON MODULES --- */}
          {activeView === 'daf-welcome' && (
            <WelcomeModule
              onStart={() => setActiveView(defaultBusinessView)}
              onOpenSupport={() => setActiveView('daf-support')}
            />
          )}

          {activeView === 'daf-dashboard' && (
            <DashboardModule
              currentUser={currentUser}
              currentBusiness={currentBusiness}
              notifications={notifications}
              cloudUserEmail={firebaseUser?.email}
              onNavigateApp={(view) => setActiveView(view)}
              onNavigateFramework={(view) => setActiveView(view)}
            />
          )}

          {activeView === 'daf-notifications' && (
            <NotificationsModule notifications={notifications} />
          )}

          {activeView === 'daf-support' && (
            <SupportModule currentUser={currentUser} />
          )}

          {activeView === 'daf-feedback' && (
            <FeedbackModule currentUser={currentUser} />
          )}

          {activeView === 'daf-profile' && (
            <ProfileModule
              currentUser={currentUser}
              currentBusiness={currentBusiness}
              onOpenLocalAuthModal={() => setShowAuthModal(true)}
            />
          )}

          {activeView === 'daf-settings' && <SettingsModule />}

          {activeView === 'daf-about' && <AboutModule />}
        </main>
      </DigiSoliaShell>

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

      {/* Official Z-Report Modal upon closure or on demand */}
      {activeZReportSession && (
        <ZReportModal
          session={activeZReportSession}
          business={currentBusiness}
          isLight={isLight}
          onClose={() => setActiveZReportSession(null)}
        />
      )}
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <MainLayout />
      </ThemeProvider>
    </ErrorBoundary>
  );
}
