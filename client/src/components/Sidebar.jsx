import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard, Users, Calendar, Briefcase,
  FileSpreadsheet, BarChart3, Settings, ShieldCheck,
  CheckCircle, Clock, AlertTriangle, Bell, Smartphone,
  Zap, ChevronRight, UserPlus, Database
} from 'lucide-react';
import { getSmsSettings } from '../api';
import { getSavedBranding, fetchServerBranding, PresetLogoIcon } from './BrandingSettingsModal';

export default function Sidebar({ activeTab, onTabChange, counters = {}, onOpenAddCustomer }) {
  const [branding, setBranding] = useState(getSavedBranding());
  const [smsGatewayInfo, setSmsGatewayInfo] = useState({ provider: 'TEXT_LK', is_active: 1, is_simulation: 1 });

  useEffect(() => {
    fetchServerBranding().then(b => { if (b) setBranding(b); });
    const handleBrandingChange = (e) => setBranding(e.detail || getSavedBranding());
    window.addEventListener('branding-updated', handleBrandingChange);
    return () => window.removeEventListener('branding-updated', handleBrandingChange);
  }, []);

  useEffect(() => {
    getSmsSettings()
      .then(res => {
        if (res.success && res.settings) {
          setSmsGatewayInfo({
            provider: res.settings.provider || 'TEXT_LK',
            is_active: res.settings.is_active,
            is_simulation: res.settings.is_simulation
          });
        }
      })
      .catch(() => {});
  }, []);

  const navItems = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: LayoutDashboard,
      color: 'red',
      activeGradient: 'from-red-600 to-rose-600 shadow-red-200',
      iconBg: 'bg-red-50 text-red-600',
      description: 'Overview & KPIs'
    },
    {
      id: 'jobs',
      label: 'Jobs & Operations',
      icon: Briefcase,
      badge: counters.today_jobs,
      badgeColor: 'bg-red-500 text-white',
      color: 'red',
      activeGradient: 'from-red-600 to-rose-600 shadow-red-200',
      iconBg: 'bg-red-50 text-red-600',
      description: 'Daily schedules'
    },
    {
      id: 'reminders',
      label: 'Auto Reminders',
      icon: Bell,
      badge: counters.unconfirmed_jobs ? `${counters.unconfirmed_jobs} alert` : undefined,
      badgeColor: 'bg-purple-500 text-white',
      color: 'purple',
      activeGradient: 'from-purple-600 to-indigo-600 shadow-purple-200',
      iconBg: 'bg-purple-50 text-purple-600',
      description: 'SMS & WhatsApp'
    },
    {
      id: 'calendar',
      label: 'Schedule Calendar',
      icon: Calendar,
      color: 'amber',
      activeGradient: 'from-amber-500 to-orange-600 shadow-amber-200',
      iconBg: 'bg-amber-50 text-amber-600',
      description: 'Master timeline'
    },
    {
      id: 'customers',
      label: 'Customers & CRM',
      icon: Users,
      color: 'emerald',
      activeGradient: 'from-emerald-600 to-teal-600 shadow-emerald-200',
      iconBg: 'bg-emerald-50 text-emerald-600',
      description: 'Clients & Sites'
    },
    {
      id: 'reports',
      label: 'Reports & Export',
      icon: BarChart3,
      color: 'rose',
      activeGradient: 'from-rose-500 to-pink-600 shadow-rose-200',
      iconBg: 'bg-rose-50 text-rose-600',
      description: 'Analytics & PDF'
    },
    {
      id: 'backup',
      label: 'Database Backup',
      icon: Database,
      badge: 'Monthly',
      badgeColor: 'bg-emerald-100 text-emerald-800 border border-emerald-200',
      color: 'teal',
      activeGradient: 'from-teal-600 to-emerald-600 shadow-teal-200',
      iconBg: 'bg-teal-50 text-teal-600',
      description: 'Monthly auto-archives'
    },
    {
      id: 'settings',
      label: 'Settings & Gateway',
      icon: Settings,
      badge: 'SMS + Users',
      badgeColor: 'bg-fuchsia-100 text-fuchsia-700 border border-fuchsia-200',
      color: 'fuchsia',
      activeGradient: 'from-fuchsia-600 to-purple-600 shadow-fuchsia-200',
      iconBg: 'bg-fuchsia-50 text-fuchsia-600',
      description: 'Gateways, Staff & Setup'
    },
  ];

  return (
    <aside className="w-68 bg-white border-r border-slate-200 flex flex-col shrink-0 min-h-[calc(100vh-4rem)] select-none">
      
      {/* Quick Add Customer Action */}
      <div className="px-3.5 pt-3 pb-1">
        <button
          onClick={onOpenAddCustomer}
          className="w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-2xl bg-gradient-to-r from-red-600 via-rose-600 to-red-700 hover:from-red-700 hover:to-rose-800 text-white text-xs font-black shadow-md shadow-red-200 transition transform active:scale-95 group cursor-pointer"
        >
          <UserPlus className="w-4 h-4 transition-transform group-hover:scale-110" />
          <span>+ Add New Customer</span>
        </button>
      </div>

      {/* Navigation List */}
      <div className="p-3.5 flex-1 space-y-1.5 pt-1">
        <div className="px-3 pt-2 pb-1.5 flex items-center justify-between text-[11px] font-extrabold text-slate-400 uppercase tracking-wider">
          <span className="truncate max-w-[140px] text-slate-600 font-bold">{branding.name || 'Operations'}</span>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 font-mono">v2026.1</span>
        </div>

        {navItems.map(item => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;

          return (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-2xl text-xs font-semibold transition-all duration-200 group text-left ${
                isActive
                  ? `bg-gradient-to-r ${item.activeGradient} text-white shadow-md font-bold scale-[1.01]`
                  : 'text-slate-700 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center transition-transform group-hover:scale-105 shrink-0 ${
                    isActive
                      ? 'bg-white/20 text-white backdrop-blur-xs'
                      : `${item.iconBg} shadow-2xs`
                  }`}
                >
                  <Icon className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="truncate leading-tight text-xs font-bold">{item.label}</div>
                  <div className={`text-[10px] truncate ${isActive ? 'text-white/80' : 'text-slate-400'}`}>
                    {item.description}
                  </div>
                </div>
              </div>

              {item.badge !== undefined && (
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold shrink-0 ${
                  isActive
                    ? 'bg-white/20 text-white'
                    : item.badgeColor || 'bg-slate-200 text-slate-700'
                }`}>
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Sri Lanka SMS Gateway Live Indicator Card */}
      <div className="px-3.5 pb-2">
        <div
          onClick={() => onTabChange('settings')}
          className="p-3 rounded-2xl bg-gradient-to-br from-violet-500/10 via-purple-500/5 to-indigo-500/10 border border-violet-200/70 hover:border-violet-300 transition cursor-pointer shadow-2xs group"
        >
          <div className="flex items-center justify-between text-[11px] font-bold text-violet-900 mb-1.5">
            <span className="flex items-center gap-1.5">
              <Smartphone className="w-3.5 h-3.5 text-violet-600" /> Sri Lanka SMS Gateway
            </span>
            <span className="flex items-center gap-1 text-[10px] font-extrabold text-emerald-600 bg-emerald-100 px-1.5 py-0.5 rounded-md">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              {smsGatewayInfo.is_simulation ? 'Simulation' : 'Live'}
            </span>
          </div>
          <div className="flex items-center justify-between text-[11px] text-slate-600">
            <span className="font-mono text-violet-700 font-bold">
              {smsGatewayInfo.provider === 'TEXT_LK' ? 'Text.lk (REST v3)' : smsGatewayInfo.provider}
            </span>
            <span className="text-[10px] text-violet-500 group-hover:translate-x-0.5 transition font-semibold flex items-center">
              Configure <ChevronRight className="w-3 h-3 ml-0.5" />
            </span>
          </div>
        </div>
      </div>

      {/* Live Operations Status Panel */}
      <div className="p-3.5 border-t border-slate-100 bg-slate-50/60 m-3 rounded-2xl space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">
            Live Daily Status
          </span>
          <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
        </div>

        <div className="grid grid-cols-3 gap-1.5 text-center text-xs">
          <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-200/60">
            <div className="text-sm font-black text-amber-700">{counters.today_jobs || 0}</div>
            <div className="text-[9px] font-bold text-amber-600 uppercase">Today</div>
          </div>
          <div className="p-2 rounded-xl bg-rose-500/10 border border-rose-200/60">
            <div className="text-sm font-black text-rose-700">{counters.overdue_jobs || 0}</div>
            <div className="text-[9px] font-bold text-rose-600 uppercase">Overdue</div>
          </div>
          <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-200/60">
            <div className="text-sm font-black text-emerald-700">{counters.completed_jobs || 0}</div>
            <div className="text-[9px] font-bold text-emerald-600 uppercase">Done</div>
          </div>
        </div>
      </div>

    </aside>
  );
}
