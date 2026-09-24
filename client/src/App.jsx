import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import Sidebar from './components/Sidebar';
import MobileBottomNav from './components/MobileBottomNav';

// Views
import DashboardView from './views/DashboardView';
import CustomersView from './views/CustomersView';
import JobsView from './views/JobsView';
import CalendarView from './views/CalendarView';
import MobileTechnicianView from './views/MobileTechnicianView';
import ExcelImportWizard from './views/ExcelImportWizard';
import ReportsView from './views/ReportsView';
import TreatmentsSettingsView from './views/TreatmentsSettingsView';
import CustomerConfirmationPortal from './views/CustomerConfirmationPortal';
import RemindersView from './views/RemindersView';
import TechnicianProfileView from './views/TechnicianProfileView';
import LoginPortal from './views/LoginPortal';
import BackupDatabaseView from './views/BackupDatabaseView';
import CreateCustomerModal from './components/CreateCustomerModal';
import FirebasePushSettingsView from './views/FirebasePushSettingsView';
import TechnicianLoginView from './views/TechnicianLoginView';
import { getPersistentTechSession, clearPersistentTechSession } from './services/offlineStorage';

import { getDashboardStats } from './api';

export default function App() {
  const urlParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams();
  const pathname = typeof window !== 'undefined' ? window.location.pathname : '';

  const isDirectConfirmationRoute = pathname.startsWith('/confirmations');
  const urlJobCode = isDirectConfirmationRoute
    ? pathname.replace(/^\/confirmations\/?/, '').split('/')[0]?.split('?')[0]
    : '';

  // Direct Technician Deep-Link or PWA standalone launcher
  const isDirectTechRoute = pathname.startsWith('/tech') || pathname.startsWith('/technician') || urlParams.has('tech') || urlParams.has('job') || urlParams.get('view') === 'tech';

  const isPhoneOrPwa = typeof window !== 'undefined' && (
    window.innerWidth < 768 ||
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true ||
    isDirectTechRoute
  );

  // Extract direct job id from URL: /tech?job=123 OR /tech/job/123 OR ?job=123
  const directJobIdFromUrl = urlParams.get('job') || (pathname.startsWith('/tech/job/') ? pathname.replace(/^\/tech\/job\/?/, '').split('/')[0]?.split('?')[0] : null);

  const DEFAULT_USER = {
    id: 1,
    username: 'admin',
    full_name: 'Operations Manager',
    role: 'ADMIN'
  };

  // Authenticated User State: on mobile/PWA phone, do NOT default to admin user so 1-time phone OTP sign-in works
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const stored = localStorage.getItem('auth_user') || sessionStorage.getItem('auth_user');
      if (stored) return JSON.parse(stored);
      return isPhoneOrPwa ? null : DEFAULT_USER;
    } catch (e) {
      return isPhoneOrPwa ? null : DEFAULT_USER;
    }
  });
  const [isAuthChecking, setIsAuthChecking] = useState(true);

  const [activeTab, setActiveTab] = useState(() => {
    if (isDirectConfirmationRoute) return 'confirmations';
    if (isPhoneOrPwa) return 'mobile_home';
    return 'dashboard';
  });

  const [currentRole, setCurrentRole] = useState(() => {
    try {
      const stored = localStorage.getItem('auth_user') || sessionStorage.getItem('auth_user');
      if (stored) {
        const u = JSON.parse(stored);
        if (u?.role) return u.role;
      }
    } catch (e) {}
    return isPhoneOrPwa ? 'TECHNICIAN' : 'ADMIN';
  });

  const [isMobileView, setIsMobileView] = useState(() => isPhoneOrPwa);

  // Verify session on app boot
  useEffect(() => {
    const token = localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
    if (token) {
      fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${token}` }
      })
        .then(r => r.json())
        .then(data => {
          if (data.success && data.user) {
            setCurrentUser(data.user);
            if (isDirectTechRoute || isPhoneOrPwa) {
              setCurrentRole('TECHNICIAN');
              setIsMobileView(true);
              if (activeTab === 'dashboard') setActiveTab('mobile_home');
            } else {
              setCurrentRole(data.user.role);
              if (data.user.role === 'TECHNICIAN') {
                setIsMobileView(true);
                setActiveTab('mobile_home');
                localStorage.setItem('tech_preferred_id', String(data.user.id));
              }
            }
          } else {
            getPersistentTechSession().then(sess => {
              if (sess?.technician) {
                setCurrentUser(sess.technician);
                setCurrentRole('TECHNICIAN');
                setIsMobileView(true);
                setActiveTab('mobile_home');
              } else if (!isPhoneOrPwa) {
                setCurrentUser(DEFAULT_USER);
              }
            });
          }
        })
        .catch(() => {
          getPersistentTechSession().then(sess => {
            const user = sess?.technician || (sess?.id ? sess : null);
            if (user) {
              setCurrentUser(user);
              setCurrentRole('TECHNICIAN');
              setIsMobileView(true);
              setActiveTab('mobile_home');
            } else if (!isPhoneOrPwa) {
              setCurrentUser(DEFAULT_USER);
            }
          });
        })
        .finally(() => setIsAuthChecking(false));
    } else {
      // Check permanent IndexedDB technician session
      getPersistentTechSession().then(sess => {
        const user = sess?.technician || (sess?.id ? sess : null);
        if (user) {
          setCurrentUser(user);
          setCurrentRole('TECHNICIAN');
          setIsMobileView(true);
          setActiveTab('mobile_home');
        } else if (isPhoneOrPwa) {
          setCurrentRole('TECHNICIAN');
          setIsMobileView(true);
          setActiveTab('mobile_home');
        }
        setIsAuthChecking(false);
      });
    }
  }, [isDirectTechRoute, isPhoneOrPwa]);

  const handleLoginSuccess = (user, token) => {
    setCurrentUser(user);
    setCurrentRole(user.role || 'TECHNICIAN');
    if (user.role === 'TECHNICIAN' || isPhoneOrPwa) {
      setIsMobileView(true);
      setActiveTab('mobile_home');
      localStorage.setItem('tech_preferred_id', String(user.id));
    } else {
      setIsMobileView(false);
      setActiveTab('dashboard');
    }
  };

  const handleLogout = async () => {
    const token = localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token })
      });
    } catch (e) {}

    await clearPersistentTechSession();
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_user');
    localStorage.removeItem('tech_preferred_id');
    localStorage.removeItem('tech_session');
    localStorage.removeItem('tech_session_v1');
    sessionStorage.removeItem('auth_token');
    sessionStorage.removeItem('auth_user');
    setCurrentUser(null);
  };

  // Global Add Customer Modal (Accessible from any tab!)
  const [showGlobalAddCustomerModal, setShowGlobalAddCustomerModal] = useState(false);

  // Cross-view selection navigation
  const [selectedCustomerId, setSelectedCustomerId] = useState(null);
  const [selectedJobId, setSelectedJobId] = useState(directJobIdFromUrl ? (parseInt(directJobIdFromUrl, 10) || directJobIdFromUrl) : null);

  // App metrics & badges
  const [dashboardData, setDashboardData] = useState(null);

  const refreshDashboard = async () => {
    try {
      const res = await getDashboardStats();
      setDashboardData(res);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    refreshDashboard();
  }, []);

  // When role changes, sync state
  const handleRoleChange = (newRole) => {
    setCurrentRole(newRole);
    if (newRole === 'TECHNICIAN') {
      setIsMobileView(true);
      setActiveTab('mobile_home');
    }
  };

  const handleSelectCustomer = (customerId) => {
    setSelectedCustomerId(customerId);
    setActiveTab('customers');
  };

  const handleSelectJob = (jobId) => {
    setSelectedJobId(null);
    setTimeout(() => {
      setSelectedJobId(jobId);
      setActiveTab('jobs');
    }, 10);
  };

  // If customer is opening an online confirmation link from SMS / WhatsApp
  if (isDirectConfirmationRoute) {
    return (
      <div className="min-h-screen bg-slate-100 flex flex-col justify-center items-center p-3 sm:p-6">
        <div className="max-w-xl w-full">
          <CustomerConfirmationPortal
            jobCode={urlJobCode}
            onBack={() => {
              window.location.href = '/';
            }}
          />
        </div>
      </div>
    );
  }

  // Only show Login Portal if the user explicitly navigated to /login!
  const isExplicitLoginRoute = pathname === '/login';
  if (isExplicitLoginRoute) {
    return (
      <LoginPortal
        onLoginSuccess={handleLoginSuccess}
        technicianOnly={activeTab === 'mobile_home'}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">

      {/* Top Navigation - ONLY in Desktop Admin View */}
      {!isMobileView && (
        <Navbar
          currentRole={currentRole}
          onRoleChange={handleRoleChange}
          isMobileView={isMobileView}
          onToggleMobileView={() => {
            setIsMobileView(true);
            setActiveTab('mobile_home');
          }}
          onSelectCustomer={handleSelectCustomer}
          onSelectJob={handleSelectJob}
          onRefreshDashboard={refreshDashboard}
          onOpenAddCustomer={() => setShowGlobalAddCustomerModal(true)}
          currentUser={currentUser}
          onLogout={handleLogout}
        />
      )}

      {/* Mobile App Mode or Desktop Admin Mode */}
      {isMobileView ? (
        !currentUser && !directJobIdFromUrl ? (
          <TechnicianLoginView onLoginSuccess={handleLoginSuccess} />
        ) : (
          <div className="flex flex-col bg-slate-100 min-h-[100dvh] h-[100dvh] w-full max-w-full overflow-hidden select-none relative">
            {/* Desktop Tester Switch Back Button */}
            {typeof window !== 'undefined' && window.innerWidth >= 768 && (
              <div className="absolute top-2 right-2 z-50">
                <button
                  type="button"
                  onClick={() => {
                    setIsMobileView(false);
                    setActiveTab('dashboard');
                  }}
                  className="px-3 py-1.5 rounded-full bg-slate-900/80 hover:bg-slate-900 text-white text-[11px] font-bold shadow-lg backdrop-blur-md flex items-center gap-1.5 border border-white/20 transition cursor-pointer"
                >
                  <span>🖥️ Return to Desktop Admin</span>
                </button>
              </div>
            )}

            {/* Clean Main Content Area with safe scrolling for iOS & Android */}
            <main className="flex-1 w-full max-w-2xl mx-auto overflow-y-auto overscroll-contain">
              {activeTab === 'mobile_home' && (
                <MobileTechnicianView
                  onSelectJob={handleSelectJob}
                  initialJobId={selectedJobId}
                  activeTechnicianId={currentUser?.role === 'TECHNICIAN' ? currentUser?.id : (localStorage.getItem('tech_preferred_id') || '')}
                  currentUser={currentUser}
                  onLogout={handleLogout}
                />
              )}
              {activeTab === 'calendar' && (
                <div className="pb-28 pt-2 px-2">
                  <CalendarView
                    onSelectJob={handleSelectJob}
                    currentRole="TECHNICIAN"
                    currentTechnicianId={currentUser?.role === 'TECHNICIAN' ? currentUser?.id : (localStorage.getItem('tech_preferred_id') || '')}
                  />
                </div>
              )}
              {activeTab === 'jobs' && (
                <div className="pb-28 pt-2 px-2">
                  <JobsView
                    initialJobId={selectedJobId}
                    onSelectCustomer={handleSelectCustomer}
                    currentRole="TECHNICIAN"
                    currentTechnicianId={currentUser?.role === 'TECHNICIAN' ? currentUser?.id : (localStorage.getItem('tech_preferred_id') || '')}
                    isMobileView={true}
                  />
                </div>
              )}
              {activeTab === 'profile' && (
                <div className="pb-28">
                  <TechnicianProfileView
                    onNavigate={setActiveTab}
                    currentUser={currentUser}
                    onLogout={handleLogout}
                  />
                </div>
              )}
            </main>

            {/* Fixed PWA Bottom Navigation (Red & White, safe area for Android + iPhone) */}
            <MobileBottomNav
              activeTab={activeTab === 'dashboard' ? 'mobile_home' : activeTab}
              onTabChange={setActiveTab}
              todayJobsCount={dashboardData?.counters?.today_jobs || 0}
            />
          </div>
        )
      ) : (
        /* Desktop Mode with Sidebar */
        <div className="flex-1 flex w-full">
          <Sidebar
            activeTab={activeTab}
            onTabChange={setActiveTab}
            counters={dashboardData?.counters || {}}
            onOpenAddCustomer={() => setShowGlobalAddCustomerModal(true)}
          />

          <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-x-hidden">
            {activeTab === 'dashboard' && (
              <DashboardView
                onSelectJob={handleSelectJob}
                onNavigateToTab={setActiveTab}
                onOpenAddCustomer={() => setShowGlobalAddCustomerModal(true)}
              />
            )}
            {activeTab === 'mobile_home' && (
              <MobileTechnicianView
                onSelectJob={handleSelectJob}
                initialJobId={selectedJobId}
                activeTechnicianId={currentUser?.role === 'TECHNICIAN' ? currentUser?.id : (localStorage.getItem('tech_preferred_id') || '')}
                currentUser={currentUser}
                onLogout={handleLogout}
              />
            )}
            {activeTab === 'customers' && (
              <CustomersView
                selectedCustomerId={selectedCustomerId}
                onSelectJob={handleSelectJob}
                onOpenAddCustomer={() => setShowGlobalAddCustomerModal(true)}
                currentRole={currentRole}
                currentTechnicianId={currentUser?.role === 'TECHNICIAN' ? currentUser?.id : ''}
                isMobileView={false}
              />
            )}
            {activeTab === 'reminders' && (
              <RemindersView />
            )}
            {activeTab === 'calendar' && (
              <CalendarView
                onSelectJob={handleSelectJob}
                onOpenAddCustomer={() => setShowGlobalAddCustomerModal(true)}
                currentRole={currentRole}
                currentTechnicianId={currentUser?.role === 'TECHNICIAN' ? currentUser?.id : ''}
              />
            )}
            {activeTab === 'jobs' && (
              <JobsView
                initialJobId={selectedJobId}
                onSelectCustomer={handleSelectCustomer}
                onOpenAddCustomer={() => setShowGlobalAddCustomerModal(true)}
                currentRole={currentRole}
                currentTechnicianId={currentUser?.role === 'TECHNICIAN' ? currentUser?.id : ''}
                isMobileView={false}
              />
            )}
            {activeTab === 'push_settings' && (
              <FirebasePushSettingsView />
            )}
            {activeTab === 'import' && (
              <ExcelImportWizard
                onImportFinished={refreshDashboard}
              />
            )}
            {activeTab === 'reports' && (
              <ReportsView />
            )}
            {activeTab === 'backup' && (
              <BackupDatabaseView />
            )}
            {activeTab === 'settings' && (
              <TreatmentsSettingsView
                currentRole={currentRole}
              />
            )}
            {activeTab === 'confirmations' && (
              <CustomerConfirmationPortal
                onBack={() => setActiveTab('dashboard')}
              />
            )}
          </main>
        </div>
      )}

      {/* Global Add Customer Modal Accessible from ANY Tab */}
      <CreateCustomerModal
        isOpen={showGlobalAddCustomerModal}
        onClose={() => setShowGlobalAddCustomerModal(false)}
        onCustomerCreated={(newCust) => {
          refreshDashboard();
          handleSelectCustomer(newCust.id);
        }}
      />

    </div>
  );
}
