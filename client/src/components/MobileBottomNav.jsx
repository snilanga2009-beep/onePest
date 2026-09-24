import React from 'react';
import { Home, Briefcase, Calendar, Users, User, LayoutDashboard, Smartphone } from 'lucide-react';

export default function MobileBottomNav({ activeTab, onTabChange, todayJobsCount = 0, currentRole }) {
  const isTech = currentRole === 'TECHNICIAN';
  
  const tabs = isTech
    ? [
        { id: 'mobile_home', label: 'MY JOBS', icon: Home },
        { id: 'jobs', label: 'ALL JOBS', icon: Briefcase, badge: todayJobsCount },
        { id: 'calendar', label: 'CALENDAR', icon: Calendar },
        { id: 'customers', label: 'CLIENTS', icon: Users },
        { id: 'profile', label: 'PROFILE', icon: User }
      ]
    : [
        { id: 'dashboard', label: 'DASHBOARD', icon: LayoutDashboard },
        { id: 'mobile_home', label: 'TECH APP', icon: Smartphone },
        { id: 'jobs', label: 'JOBS', icon: Briefcase, badge: todayJobsCount },
        { id: 'calendar', label: 'CALENDAR', icon: Calendar },
        { id: 'customers', label: 'CLIENTS', icon: Users }
      ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-red-100 z-40 px-2 py-2 flex items-center justify-around shadow-2xl safe-area-bottom">
      {tabs.map(tab => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onTabChange(tab.id)}
            className={`flex flex-col items-center justify-center flex-1 py-1 px-1 transition relative cursor-pointer ${
              isActive ? 'text-red-600' : 'text-slate-400 hover:text-slate-700'
            }`}
          >
            <div className="relative">
              <Icon className={`w-5 h-5 sm:w-6 sm:h-6 ${isActive ? 'stroke-[2.5px] text-red-600' : 'stroke-2'}`} />
              {tab.badge !== undefined && tab.badge > 0 && (
                <span className="absolute -top-1 -right-2 bg-red-600 text-white text-[10px] font-black w-4 h-4 rounded-full flex items-center justify-center shadow-xs">
                  {tab.badge}
                </span>
              )}
            </div>
            <span className={`text-[10px] tracking-wide mt-1 font-black ${isActive ? 'text-red-600' : 'text-slate-500'}`}>
              {tab.label}
            </span>
            {isActive && (
              <span className="w-4 h-1 bg-red-600 rounded-full mt-0.5"></span>
            )}
          </button>
        );
      })}
    </nav>
  );
}

