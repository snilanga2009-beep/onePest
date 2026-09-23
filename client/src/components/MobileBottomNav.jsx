import React from 'react';
import { Home, Briefcase, Calendar, Users, User } from 'lucide-react';

export default function MobileBottomNav({ activeTab, onTabChange, todayJobsCount = 0, currentRole }) {
  const isTech = currentRole === 'TECHNICIAN';
  const tabs = [
    { id: 'mobile_home', label: 'HOME', icon: Home },
    { id: 'jobs', label: 'JOBS', icon: Briefcase, badge: todayJobsCount },
    { id: 'calendar', label: 'CALENDAR', icon: Calendar },
    { id: 'customers', label: isTech ? 'DONE CLIENTS' : 'CUSTOMERS', icon: Users },
    { id: 'profile', label: 'PROFILE', icon: User }
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 z-40 px-2 py-2 flex items-center justify-around shadow-2xl safe-area-bottom">
      {tabs.map(tab => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`flex flex-col items-center justify-center flex-1 py-1 px-1 transition relative ${
              isActive ? 'text-emerald-600' : 'text-slate-400 hover:text-slate-700'
            }`}
          >
            <div className="relative">
              <Icon className={`w-6 h-6 ${isActive ? 'stroke-[2.5px]' : 'stroke-2'}`} />
              {tab.badge !== undefined && tab.badge > 0 && (
                <span className="absolute -top-1 -right-2 bg-emerald-600 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                  {tab.badge}
                </span>
              )}
            </div>
            <span className={`text-[10px] tracking-wide mt-1 font-bold ${isActive ? 'text-emerald-700' : 'text-slate-500'}`}>
              {tab.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
