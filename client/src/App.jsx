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

  // Extract direct job id from URL: /tech?job=123 OR /tech/job/123 OR ?job=123
  const directJobIdFromUrl = urlParams.get('job') || (pathname.startsWith('/tech/job/') ? pathname.replace(/^\/tech\/job\/?/, '').split('/')[0]?.split('?')[0] : null);

  // Authenticated User State
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const stored = localStorage.getItem('auth_user') || sessionStorage.getItem('auth_user');
      return stored ? JSON.parse(stored) : null;
    } catch (e) {
      return null;
    }
  });
  const [isAuthChecking, setIsAuthChecking] = useState(true);

  const [activeTab, setActiveTab] = useState(
    isDirectConfirmationRoute ? 'confirmations' : isDirectTechRoute ? 'mobile_home' : 'dashboard'
  );
  const [currentRole, setCurrentRole] = useState(() => {
    try {
      const stored = localStorage.getItem('auth_user') || sessionStorage.getItem('auth_user');
      if (stored) {
        const u = JSON.parse(stored);
        if (u?.role) return u.role;
      }
    } catch (e) {}
    return isDirectTechRoute ? 'TECHNICIAN' : 'ADMIN';
  });
  const [isMobileView, setIsMobileView] = useState(isDirectTechRoute || currentRole === 'TECHNICIAN');

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
            setCurrentRole(data.user.role);
            if (data.user.role === 'TECHNICIAN') {
              setIsMobileView(true);
              localStorage.setItem('tech_preferred_id', String(data.user.id));
            }
          } else {
            // Invalid session
            localStorage.removeItem('auth_token');
            localStorage.removeItem('auth_user');
            sessionStorage.removeItem('auth_token');
            sessionStorage.removeItem('auth_user');
            setCurrentUser(null);
          }
        })
        .catch(() => {})
        .finally(() => setIsAuthChecking(false));
    } else {
      setIsAuthChecking(false);
    }
  }, []);

  const handleLoginSuccess = (user, token) => {
    setCurrentUser(user);
    setCurrentRole(user.role);
    if (user.role === 'TECHNICIAN') {
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

    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_user');
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

  // If not authenticated and not checking session, show Login Portal!
  if (!currentUser && !isAuthChecking) {
    return (
      <LoginPortal
        onLoginSuccess={handleLoginSuccess}
        technicianOnly={isDirectTechRoute || activeTab === 'mobile_home'}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">

      {/* Top Navigation */}
      <Navbar
        currentRole={currentRole}
        onRoleChange={handleRoleChange}
        isMobileView={isMobileView}
        onToggleMobileView={() => {
          const next = !isMobileView;
          setIsMobileView(next);
          if (next && activeTab === 'dashboard') {
            setActiveTab('mobile_home');
          } else if (!next && activeTab === 'mobile_home') {
            setActiveTab('dashboard');
          }
        }}
        onSelectCustomer={handleSelectCustomer}
        onSelectJob={handleSelectJob}
        onRefreshDashboard={refreshDashboard}
        onOpenAddCustomer={() => setShowGlobalAddCustomerModal(true)}
        currentUser={currentUser}
        onLogout={handleLogout}
      />

      {/* Mobile App Mode or Desktop Admin Mode */}
      {isMobileView ? (
        <div className="flex-1 flex flex-col bg-slate-100 min-h-screen w-full max-w-full overflow-x-hidden">
          <main className="flex-1 w-full max-w-4xl mx-auto px-2 sm:px-4 pt-2 sm:pt-4 pb-28">
            {activeTab === 'mobile_home' && (
              <MobileTechnicianView
                onSelectJob={handleSelectJob}
                initialJobId={selectedJobId}
                activeTechnicianId={currentUser?.role === 'TECHNICIAN' ? currentUser?.id : (localStorage.getItem('tech_preferred_id') || '')}
                currentUser={currentUser}
                onLogout={handleLogout}
              />
            )}
            {activeTab === 'jobs' && (
              <JobsView
                initialJobId={selectedJobId}
                onSelectCustomer={handleSelectCustomer}
                currentRole={currentRole}
                currentTechnicianId={currentUser?.role === 'TECHNICIAN' ? currentUser?.id : (localStorage.getItem('tech_preferred_id') || '')}
                isMobileView={true}
              />
            )}
            {activeTab === 'calendar' && (
              <CalendarView
                onSelectJob={handleSelectJob}
                currentRole={currentRole}
                currentTechnicianId={currentUser?.role === 'TECHNICIAN' ? currentUser?.id : (localStorage.getItem('tech_preferred_id') || '')}
              />
            )}
            {activeTab === 'customers' && (
              <CustomersView
                selectedCustomerId={selectedCustomerId}
                onSelectJob={handleSelectJob}
                onOpenAddCustomer={() => setShowGlobalAddCustomerModal(true)}
                currentRole={currentRole}
                currentTechnicianId={currentUser?.role === 'TECHNICIAN' ? currentUser?.id : (localStorage.getItem('tech_preferred_id') || '')}
                isMobileView={true}
              />
            )}
            {activeTab === 'profile' && (
              <TechnicianProfileView
                onNavigate={setActiveTab}
                currentUser={currentUser}
                onLogout={handleLogout}
              />
            )}
            {activeTab === 'reports' && (
              <div className="p-4 space-y-4 max-w-md mx-auto">
                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-2">
                  <h3 className="font-bold text-slate-900 text-sm">More Options & Modules</h3>
                  <button onClick={() => setActiveTab('import')} className="w-full text-left p-2.5 rounded-xl bg-slate-50 hover:bg-emerald-50 text-xs font-semibold text-slate-800">
                    📊 Excel Import Wizard
                  </button>
                  <button onClick={() => setActiveTab('reports_full')} className="w-full text-left p-2.5 rounded-xl bg-slate-50 hover:bg-emerald-50 text-xs font-semibold text-slate-800">
                    📈 Operational Reports & Exports
                  </button>
                  <button onClick={() => setActiveTab('backup')} className="w-full text-left p-2.5 rounded-xl bg-slate-50 hover:bg-emerald-50 text-xs font-semibold text-slate-800">
                    💾 Database Backup & Monthly Archives
                  </button>
                  <button onClick={() => setActiveTab('settings')} className="w-full text-left p-2.5 rounded-xl bg-slate-50 hover:bg-emerald-50 text-xs font-semibold text-slate-800">
                    ⚙️ Treatments & Staff Settings
                  </button>
                  <button onClick={() => setActiveTab('confirmations')} className="w-full text-left p-2.5 rounded-xl bg-slate-50 hover:bg-emerald-50 text-xs font-semibold text-slate-800">
                    📱 Customer Confirmation Portal
                  </button>
                </div>
              </div>
            )}
            {activeTab === 'import' && <ExcelImportWizard onImportFinished={refreshDashboard} />}
            {activeTab === 'reports_full' && <ReportsView />}
            {activeTab === 'backup' && <BackupDatabaseView />}
            {activeTab === 'reminders' && <RemindersView />}
            {activeTab === 'settings' && <TreatmentsSettingsView currentRole={currentRole} />}
            {activeTab === 'confirmations' && <CustomerConfirmationPortal onBack={() => setActiveTab('mobile_home')} />}
          </main>

          {/* Fixed Bottom Navigation for Mobile App */}
          <MobileBottomNav
            activeTab={activeTab}
            onTabChange={setActiveTab}
            todayJobsCount={dashboardData?.counters?.today_jobs || 0}
            currentRole={currentRole}
          />
        </div>
      ) : (
        /* Desktop Mode with Sidebar */
        <div className="flex-1 flex max-w-7xl w-full mx-auto">
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
