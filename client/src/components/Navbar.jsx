import React, { useState, useEffect, useRef } from 'react';
import {
  Search, Bell, Smartphone, Monitor, Zap,
  UserCheck, Shield, ChevronDown, CheckCircle2,
  Calendar, MapPin, Phone, AlertCircle, UserPlus,
  Edit3, Sparkles, Building, LogOut, User
} from 'lucide-react';
import { globalSearch, runDailyAutomation, getNotifications, markAllNotificationsRead } from '../api';
import BrandingSettingsModal, { getSavedBranding, fetchServerBranding, PresetLogoIcon } from './BrandingSettingsModal';

export default function Navbar({
  currentRole,
  onRoleChange,
  isMobileView,
  onToggleMobileView,
  onSelectCustomer,
  onSelectJob,
  onRefreshDashboard,
  onOpenAddCustomer,
  currentUser,
  onLogout
}) {
  const [branding, setBranding] = useState(getSavedBranding());
  const [showBrandingModal, setShowBrandingModal] = useState(false);

  useEffect(() => {
    fetchServerBranding().then(b => { if (b) setBranding(b); });
    const handleBrandingChange = (e) => setBranding(e.detail || getSavedBranding());
    window.addEventListener('branding-updated', handleBrandingChange);
    return () => window.removeEventListener('branding-updated', handleBrandingChange);
  }, []);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);

  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifDropdown, setShowNotifDropdown] = useState(false);

  const [automationLoading, setAutomationLoading] = useState(false);
  const [automationMessage, setAutomationMessage] = useState(null);

  const searchRef = useRef(null);
  const notifRef = useRef(null);

  // Load notifications
  const loadNotifications = async () => {
    try {
      const res = await getNotifications({ role: currentRole });
      setNotifications(res.notifications || []);
      setUnreadCount(res.unreadCount || 0);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadNotifications();
    const interval = setInterval(loadNotifications, 30000);
    return () => clearInterval(interval);
  }, [currentRole]);

  // Handle outside clicks
  useEffect(() => {
    function handleClickOutside(event) {
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setShowSearchDropdown(false);
      }
      if (notifRef.current && !notifRef.current.contains(event.target)) {
        setShowNotifDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Search debounce
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults(null);
      setShowSearchDropdown(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await globalSearch(searchQuery);
        setSearchResults(res.results);
        setShowSearchDropdown(true);
      } catch (err) {
        console.error(err);
      } finally {
        setIsSearching(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleRunAutomation = async () => {
    setAutomationLoading(true);
    setAutomationMessage(null);
    try {
      const res = await runDailyAutomation();
      setAutomationMessage(`Automation complete: ${res.result.generatedJobsCount} jobs created, ${res.result.overdueJobsCount} overdue flagged.`);
      if (onRefreshDashboard) onRefreshDashboard();
      loadNotifications();
      setTimeout(() => setAutomationMessage(null), 5000);
    } catch (err) {
      setAutomationMessage(`Error: ${err.message}`);
    } finally {
      setAutomationLoading(false);
    }
  };

  const handleMarkAllRead = async () => {
    await markAllNotificationsRead();
    setUnreadCount(0);
    loadNotifications();
  };

  const roles = [
    { id: 'ADMIN', label: 'Admin (All Access)' },
    { id: 'MANAGER', label: 'Operations Manager' },
    { id: 'SUPERVISOR', label: 'Field Supervisor' },
    { id: 'TECHNICIAN', label: 'Technician View' },
    { id: 'SALESMAN', label: 'Salesman View' }
  ];

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-3">

          {/* Left Brand - Company Logo & Heading Name */}
          <div
            onClick={() => setShowBrandingModal(true)}
            className="flex items-center gap-3 cursor-pointer group p-1 -ml-1 rounded-2xl hover:bg-slate-50 transition"
            title="Click to customize Company Name & Logo"
          >
            <div className="w-11 h-11 rounded-2xl bg-white border border-slate-200/80 shadow-sm flex items-center justify-center overflow-hidden shrink-0 group-hover:scale-105 group-hover:border-emerald-500 transition-all p-1 relative">
              {branding.logoType === 'custom' && branding.customLogoUrl ? (
                <img src={branding.customLogoUrl} alt="Logo" className="w-full h-full object-contain" />
              ) : (
                <PresetLogoIcon id={branding.presetId || 'shield'} className="w-8 h-8" />
              )}
              <span className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-600 rounded-full flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition shadow">
                <Edit3 className="w-2.5 h-2.5" />
              </span>
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-black text-slate-900 tracking-tight text-base sm:text-lg flex items-center gap-1.5 leading-tight group-hover:text-emerald-700 transition">
                  {branding.name || 'Ceylon Pest Solutions'}
                </span>
                <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-emerald-100 text-emerald-800 font-extrabold uppercase shrink-0">
                  SL v2026
                </span>
              </div>
              <div className="hidden sm:flex items-center gap-2 text-[11px] text-slate-500 font-semibold">
                <span className="text-emerald-600 font-bold truncate max-w-[200px]">
                  {branding.subheading || 'Master Operations Suite'}
                </span>
                <span>&bull;</span>
                <span className="flex items-center gap-1">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  <span>Colombo</span>
                </span>
              </div>
            </div>
          </div>

          {/* Center Global Search (Desktop & Tablet only, avoids mobile crowding) */}
          <div className="hidden md:block flex-1 max-w-md lg:max-w-lg relative" ref={searchRef}>
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => searchQuery.trim() && setShowSearchDropdown(true)}
                placeholder="Global Search (Customer, Phone, Location, Job ID)..."
                className="w-full bg-slate-100 hover:bg-slate-50 focus:bg-white text-xs sm:text-sm pl-10 pr-4 py-2 rounded-xl border border-transparent focus:border-emerald-500 focus:outline-hidden transition"
              />
            </div>

            {/* Instant Search Dropdown */}
            {showSearchDropdown && searchResults && (
              <div className="absolute left-0 right-0 mt-2 bg-white rounded-2xl shadow-2xl border border-slate-100 max-h-96 overflow-y-auto z-50 p-2 text-xs">
                {searchResults.customers?.length > 0 && (
                  <div className="mb-2">
                    <div className="px-3 py-1 font-semibold text-slate-400 uppercase text-[10px] tracking-wider">Customers</div>
                    {searchResults.customers.map(c => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => {
                          if (onSelectCustomer) onSelectCustomer(c.id);
                          setShowSearchDropdown(false);
                          setSearchQuery('');
                        }}
                        className="w-full text-left px-3 py-2 rounded-lg hover:bg-emerald-50 flex items-center justify-between text-slate-800 transition"
                      >
                        <div>
                          <div className="font-semibold text-slate-900">{c.name}</div>
                          <div className="text-[11px] text-slate-500">{c.location || 'No location'} &bull; {c.phone || 'No phone'}</div>
                        </div>
                        <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-mono">{c.customer_code}</span>
                      </button>
                    ))}
                  </div>
                )}

                {searchResults.jobs?.length > 0 && (
                  <div className="mb-2">
                    <div className="px-3 py-1 font-semibold text-slate-400 uppercase text-[10px] tracking-wider">Jobs</div>
                    {searchResults.jobs.map(j => (
                      <button
                        key={j.id}
                        type="button"
                        onClick={() => {
                          if (onSelectJob) onSelectJob(j.id);
                          setShowSearchDropdown(false);
                          setSearchQuery('');
                        }}
                        className="w-full text-left px-3 py-2 rounded-lg hover:bg-emerald-50 flex items-center justify-between text-slate-800 transition"
                      >
                        <div>
                          <div className="font-medium text-slate-900">{j.job_code} &bull; <span className="font-semibold">{j.customer_name}</span></div>
                          <div className="text-[11px] text-slate-500">{j.scheduled_date} &bull; {j.treatment_code}</div>
                        </div>
                        <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded font-medium">{j.status}</span>
                      </button>
                    ))}
                  </div>
                )}

                {searchResults.customers?.length === 0 && searchResults.jobs?.length === 0 && (
                  <div className="p-4 text-center text-slate-400 text-xs">
                    No results found for "{searchQuery}"
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right Action Icons & Role Switcher */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">

            {/* Global Add Customer Button (Available in Desktop mode) */}
            {!isMobileView && onOpenAddCustomer && (
              <button
                onClick={onOpenAddCustomer}
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-xs font-bold rounded-xl shadow-sm shadow-emerald-200 transition transform active:scale-95"
                title="Add New Customer"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span className="hidden md:inline">Add Customer</span>
              </button>
            )}

            {/* Run Daily Automation Trigger */}
            {!isMobileView && (
              <button
                onClick={handleRunAutomation}
                disabled={automationLoading}
                title="Run Daily Recurring Engine & Check Overdue Jobs"
                className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-semibold rounded-xl border border-emerald-200 transition shadow-2xs"
              >
                <Zap className={`w-3.5 h-3.5 ${automationLoading ? 'animate-spin text-amber-500' : 'text-emerald-600'}`} />
                <span>{automationLoading ? 'Processing...' : 'Run Automation'}</span>
              </button>
            )}

            {/* View Mode Toggle: Desktop <-> Mobile */}
            <button
              onClick={onToggleMobileView}
              title={isMobileView ? "Switch to Desktop Admin Portal" : "Switch to Mobile Technician App View"}
              className={`flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1.5 text-xs font-semibold rounded-xl border transition ${
                isMobileView
                  ? 'bg-indigo-600 text-white border-indigo-700 shadow-xs'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
              }`}
            >
              {isMobileView ? <Monitor className="w-3.5 h-3.5" /> : <Smartphone className="w-3.5 h-3.5 text-indigo-600" />}
              <span className="hidden sm:inline">{isMobileView ? 'Desktop Admin' : 'Technician App'}</span>
            </button>

            {/* Notification Bell */}
            <div className="relative" ref={notifRef}>
              <button
                onClick={() => setShowNotifDropdown(!showNotifDropdown)}
                className="relative p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition"
              >
                <Bell className="w-4 h-4" />
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 w-4 h-4 bg-rose-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center animate-pulse">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>

              {/* Notification Dropdown */}
              {showNotifDropdown && (
                <div className="absolute right-0 mt-2 w-80 bg-white rounded-2xl shadow-2xl border border-slate-100 p-3 z-50 text-xs">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                    <span className="font-bold text-slate-900">Notifications ({unreadCount} new)</span>
                    {unreadCount > 0 && (
                      <button onClick={handleMarkAllRead} className="text-emerald-600 hover:underline text-[11px]">
                        Mark all read
                      </button>
                    )}
                  </div>
                  <div className="max-h-72 overflow-y-auto mt-2 space-y-2">
                    {notifications.length === 0 ? (
                      <div className="py-6 text-center text-slate-400">No notifications</div>
                    ) : (
                      notifications.slice(0, 10).map(n => (
                        <div key={n.id} className={`p-2.5 rounded-xl border ${n.is_read ? 'bg-slate-50 border-slate-100' : 'bg-emerald-50/50 border-emerald-100'} transition`}>
                          <div className="font-semibold text-slate-900">{n.title}</div>
                          <div className="text-[11px] text-slate-600 mt-0.5">{n.message}</div>
                          <div className="text-[9px] text-slate-400 mt-1">{new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* User Profile Badge & Logout */}
            {currentUser && (
              <div className="flex items-center gap-2">
                <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-100 border border-slate-200 text-xs">
                  <User className="w-3.5 h-3.5 text-slate-500" />
                  <span className="font-bold text-slate-800">{currentUser.full_name}</span>
                  <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded-sm bg-slate-200 text-slate-700">
                    {currentUser.role}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={onLogout}
                  title="Sign Out of Account"
                  className="p-1.5 rounded-xl bg-slate-100 hover:bg-rose-50 text-slate-500 hover:text-rose-600 border border-slate-200 transition cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Role Switcher (Visible to Admins / Managers or when testing) */}
            {(!currentUser || currentUser.role === 'ADMIN' || currentUser.role === 'MANAGER') && (
              <div className="hidden sm:flex relative items-center">
                <span className={`w-2.5 h-2.5 rounded-full absolute left-2.5 z-10 pointer-events-none ${
                  currentRole === 'ADMIN' ? 'bg-purple-500 ring-2 ring-purple-200' :
                  currentRole === 'MANAGER' ? 'bg-blue-500 ring-2 ring-blue-200' :
                  currentRole === 'SUPERVISOR' ? 'bg-amber-500 ring-2 ring-amber-200' :
                  currentRole === 'TECHNICIAN' ? 'bg-emerald-500 ring-2 ring-emerald-200' :
                  'bg-rose-500 ring-2 ring-rose-200'
                }`}></span>
                <select
                  value={currentRole}
                  onChange={(e) => onRoleChange(e.target.value)}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold pl-7 pr-7 py-1.5 rounded-xl border border-slate-200 focus:outline-hidden cursor-pointer appearance-none shadow-2xs transition"
                >
                  {roles.map(r => (
                    <option key={r.id} value={r.id}>{r.label}</option>
                  ))}
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-slate-500 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            )}

          </div>
        </div>

        {/* Automation message toast */}
        {automationMessage && (
          <div className="py-2 px-3 bg-emerald-50 border-b border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{automationMessage}</span>
          </div>
        )}
      </div>

      {/* Company Branding & Logo Settings Modal */}
      <BrandingSettingsModal
        isOpen={showBrandingModal}
        onClose={() => setShowBrandingModal(false)}
      />
    </header>
  );
}
