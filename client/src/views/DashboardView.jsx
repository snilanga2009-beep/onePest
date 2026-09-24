import React, { useState, useEffect } from 'react';
import {
  Calendar as CalendarIcon, Clock, CheckCircle2, AlertTriangle,
  PlayCircle, Phone, ArrowRight, User, MapPin, RefreshCw, Zap,
  Smartphone, Settings as SettingsIcon, Plus, Briefcase, UserPlus, Bell
} from 'lucide-react';
import { getDashboardStats, startJob, generateUpcomingJobs } from '../api';

export default function DashboardView({ onSelectJob, onNavigateToTab, onOpenAddCustomer }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState('');
  const [genLoading, setGenLoading] = useState(false);
  const [activeScheduleTab, setActiveScheduleTab] = useState('today');

  const loadData = async (date) => {
    setLoading(true);
    try {
      const res = await getDashboardStats(date);
      setData(res);
      if (!selectedDate && res.today) {
        setSelectedDate(res.today);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData(selectedDate);
  }, [selectedDate]);

  const handleStartJob = async (jobId, e) => {
    e.stopPropagation();
    try {
      await startJob(jobId);
      loadData(selectedDate);
    } catch (err) {
      alert(`Error starting job: ${err.message}`);
    }
  };

  const handleGenerateUpcoming = async () => {
    setGenLoading(true);
    try {
      const res = await generateUpcomingJobs(14);
      alert(res.message);
      loadData(selectedDate);
    } catch (err) {
      alert(`Error: ${err.message}`);
    } finally {
      setGenLoading(false);
    }
  };

  if (loading && !data) {
    return (
      <div className="min-h-[400px] flex flex-col items-center justify-center text-zinc-500 bg-white rounded-2xl border border-red-100 p-12 shadow-sm">
        <RefreshCw className="w-8 h-8 animate-spin mb-3 text-red-600" />
        <span className="font-bold text-red-700 text-sm tracking-wide">Loading operations dashboard...</span>
      </div>
    );
  }

  const counters = data?.counters || {};
  const stats = data?.today_stats || {};

  // Deterministic count resolution (ensures live today & tomorrow counts always display)
  const todayJobsList = data?.today_jobs || [];
  const tomorrowJobsList = data?.tomorrow_jobs || [];
  const todayCount = todayJobsList.length || counters.today_jobs || 0;
  const tomorrowCount = tomorrowJobsList.length || counters.tomorrow_jobs || 0;
  const overdueCount = counters.overdue_jobs || 0;
  const pendingCount = counters.pending_jobs || 0;
  const completedCount = counters.completed_jobs || 0;
  const postponedCount = counters.postponed_jobs || 0;
  const unconfirmedCount = counters.unconfirmed_jobs || 0;

  return (
    <div className="w-full space-y-6 pb-16">

      {/* 1. TOP HEADER - PURE RED & WHITE THEME */}
      <div className="w-full bg-white p-6 rounded-2xl border-t-4 border-red-600 border-x border-b border-zinc-200 shadow-md flex flex-col lg:flex-row lg:items-center justify-between gap-5 relative overflow-hidden">
        {/* Subtle decorative red gradient */}
        <div className="absolute top-0 right-0 w-80 h-80 bg-red-500/5 rounded-full blur-3xl pointer-events-none -mr-16 -mt-16"></div>

        <div className="relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-50 text-red-700 text-[11px] font-black uppercase tracking-wider mb-2 border border-red-200 shadow-2xs">
            <span className="w-2 h-2 rounded-full bg-red-600 animate-pulse"></span>
            <span>Asia/Colombo (GMT+5:30) Live Operations</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-zinc-900 tracking-tight flex items-center gap-2">
            <span>Operations Control Dashboard</span>
          </h1>
          <p className="text-xs sm:text-sm text-zinc-600 mt-1 max-w-2xl font-medium">
            Real-time pest control dispatching, automated technician assignments, SMS alerts and job scheduling.
          </p>
        </div>

        <div className="relative z-10 flex flex-wrap items-center gap-3">
          {/* Date Picker in clean white & red styling */}
          <div className="flex items-center gap-2 bg-red-50/50 border border-red-200 px-3.5 py-2.5 rounded-xl text-xs font-semibold shadow-2xs">
            <CalendarIcon className="w-4 h-4 text-red-600 shrink-0" />
            <input
              type="date"
              value={selectedDate || data?.today || ''}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-transparent border-none text-zinc-900 font-black focus:outline-hidden cursor-pointer"
            />
          </div>

          {selectedDate && selectedDate !== data?.today && (
            <button
              type="button"
              onClick={() => setSelectedDate(data?.today || '')}
              className="px-3.5 py-2.5 bg-red-100 hover:bg-red-200 text-red-800 text-xs font-black rounded-xl border border-red-300 transition"
              title="Return to today"
            >
              Today
            </button>
          )}

          {onOpenAddCustomer && (
            <button
              type="button"
              onClick={onOpenAddCustomer}
              className="flex items-center gap-1.5 px-4 py-2.5 bg-white hover:bg-red-50 text-red-600 text-xs font-black rounded-xl border-2 border-red-500 shadow-sm transition transform active:scale-95 cursor-pointer"
            >
              <UserPlus className="w-4 h-4 text-red-600" />
              <span>+ Add Customer</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleGenerateUpcoming}
            disabled={genLoading}
            className="flex items-center gap-2 px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white text-xs font-black rounded-xl shadow-md shadow-red-200 transition transform active:scale-95 disabled:opacity-50 cursor-pointer"
          >
            <Zap className={`w-4 h-4 ${genLoading ? 'animate-spin' : ''}`} />
            <span>{genLoading ? 'Generating...' : 'Auto-Generate Jobs'}</span>
          </button>
        </div>
      </div>

      {/* 2. AUTOMATION LIFECYCLE BANNER - CRISP WHITE & RED HIGHLIGHTS */}
      <div className="w-full bg-white p-6 rounded-2xl shadow-md border-2 border-red-100 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-50 text-red-700 text-[11px] font-black uppercase tracking-wider mb-1.5 border border-red-200">
              <span className="w-2 h-2 rounded-full bg-red-600 animate-ping"></span>
              Full Auto Operations Engine Active (No Excel Work Needed)
            </div>
            <h2 className="text-base sm:text-lg font-black tracking-tight text-zinc-900">
              Automated Lifecycle: Customer → Recurring Engine → Technician App → Auto Next Job
            </h2>
          </div>

          {/* Quick Action Navigation Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => onNavigateToTab && onNavigateToTab('settings')}
              className="px-3.5 py-2 bg-red-50 hover:bg-red-100 text-red-700 font-bold text-xs rounded-xl border border-red-200 transition flex items-center gap-1.5 shadow-2xs cursor-pointer"
            >
              <Smartphone className="w-3.5 h-3.5 text-red-600" />
              <span>SMS Gateway Settings</span>
            </button>

            <button
              onClick={() => onNavigateToTab && onNavigateToTab('reminders')}
              className="px-3.5 py-2 bg-red-50 hover:bg-red-100 text-red-700 font-bold text-xs rounded-xl border border-red-200 transition flex items-center gap-1.5 shadow-2xs cursor-pointer"
            >
              <Bell className="w-3.5 h-3.5 text-red-600" />
              <span>Auto Reminders Queue</span>
            </button>

            <button
              onClick={() => onNavigateToTab && onNavigateToTab('settings')}
              className="px-3.5 py-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-800 font-bold text-xs rounded-xl border border-zinc-300 transition flex items-center gap-1.5 shadow-2xs cursor-pointer"
            >
              <SettingsIcon className="w-3.5 h-3.5 text-zinc-600" />
              <span>Settings & Users</span>
            </button>

            <button
              onClick={() => onNavigateToTab && onNavigateToTab('jobs')}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-black text-xs rounded-xl border border-red-600 transition flex items-center gap-1.5 shadow-md shadow-red-200 cursor-pointer"
            >
              <Briefcase className="w-3.5 h-3.5 text-white" />
              <span>Manage Jobs</span>
            </button>
          </div>
        </div>

        {/* 5-step visual flow in Red & White */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-3 border-t border-zinc-200 text-xs">
          <div className="p-3.5 rounded-xl bg-zinc-50 border border-zinc-200 hover:border-red-300 transition">
            <span className="text-[10px] text-red-600 font-black uppercase tracking-wider">Step 1</span>
            <div className="font-black text-zinc-900 mt-0.5 text-sm">Customer & Sites</div>
            <div className="text-[11px] text-zinc-500">Stored in database</div>
          </div>
          <div className="p-3.5 rounded-xl bg-zinc-50 border border-zinc-200 hover:border-red-300 transition">
            <span className="text-[10px] text-red-600 font-black uppercase tracking-wider">Step 2</span>
            <div className="font-black text-zinc-900 mt-0.5 text-sm">Recurring Service</div>
            <div className="text-[11px] text-zinc-500">Daily / Weekly / Monthly</div>
          </div>
          <div className="p-3.5 rounded-xl bg-zinc-50 border border-zinc-200 hover:border-red-300 transition">
            <span className="text-[10px] text-red-600 font-black uppercase tracking-wider">Step 3</span>
            <div className="font-black text-zinc-900 mt-0.5 text-sm">Auto Scheduling</div>
            <div className="text-[11px] text-zinc-500">Deterministic generator</div>
          </div>
          <div className="p-3.5 rounded-xl bg-zinc-50 border border-zinc-200 hover:border-red-300 transition">
            <span className="text-[10px] text-red-600 font-black uppercase tracking-wider">Step 4</span>
            <div className="font-black text-zinc-900 mt-0.5 text-sm">Technician Mobile</div>
            <div className="text-[11px] text-zinc-500">GPS Map, Call & Sign</div>
          </div>
          <div className="p-3.5 rounded-xl bg-red-50 border-2 border-red-500 shadow-sm">
            <span className="text-[10px] text-red-700 font-black uppercase tracking-wider">Step 5</span>
            <div className="font-black text-red-900 mt-0.5 text-sm">Auto-Next Job</div>
            <div className="text-[11px] text-red-700 font-bold">Zero manual effort!</div>
          </div>
        </div>
      </div>

      {/* 3. PRIMARY KPI COUNTERS (7 CLEAN RED & WHITE CARDS) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3.5">

        {/* 1. TODAY'S JOBS */}
        <div
          onClick={() => {
            setActiveScheduleTab('today');
            document.getElementById('dashboard-schedule-section')?.scrollIntoView({ behavior: 'smooth' });
          }}
          className={`p-4 rounded-2xl cursor-pointer transition-all duration-200 relative overflow-hidden group shadow-md ${
            activeScheduleTab === 'today'
              ? 'bg-red-50/80 border-2 border-red-600 ring-2 ring-red-400/30'
              : 'bg-white border-2 border-red-400 hover:border-red-600'
          }`}
        >
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-red-600"></div>
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black text-red-700 uppercase tracking-wider">Today's Jobs</span>
            <div className="w-7 h-7 rounded-lg bg-red-100 text-red-600 border border-red-300 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-black text-red-600 mt-2 tracking-tight">{todayCount}</div>
          <div className="text-[10px] text-white font-black mt-1.5 bg-red-600 px-2.5 py-0.5 rounded-md inline-block shadow-2xs">
            Scheduled Today
          </div>
        </div>

        {/* 2. TOMORROW'S JOBS */}
        <div
          onClick={() => {
            setActiveScheduleTab('tomorrow');
            document.getElementById('dashboard-schedule-section')?.scrollIntoView({ behavior: 'smooth' });
          }}
          className={`p-4 rounded-2xl cursor-pointer transition-all duration-200 relative overflow-hidden group shadow-sm ${
            activeScheduleTab === 'tomorrow'
              ? 'bg-red-50/60 border-2 border-red-500 ring-2 ring-red-300/30'
              : 'bg-white border border-zinc-300 hover:border-red-400'
          }`}
        >
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-red-400"></div>
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black text-zinc-700 uppercase tracking-wider">Tomorrow</span>
            <div className="w-7 h-7 rounded-lg bg-red-50 text-red-600 border border-red-200 flex items-center justify-center">
              <CalendarIcon className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-black text-zinc-900 mt-2 tracking-tight">{tomorrowCount}</div>
          <div className="text-[10px] text-red-700 font-bold mt-1.5 bg-red-50 border border-red-200 px-2 py-0.5 rounded-md inline-block">
            Upcoming Next
          </div>
        </div>

        {/* 3. PENDING JOBS */}
        <div
          onClick={() => onNavigateToTab && onNavigateToTab('jobs')}
          className="bg-white p-4 rounded-2xl border border-zinc-300 hover:border-red-400 shadow-sm cursor-pointer transition-all duration-200 relative overflow-hidden group"
        >
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-amber-400"></div>
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black text-zinc-600 uppercase tracking-wider">Pending</span>
            <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-600 border border-amber-200 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-black text-zinc-900 mt-2 tracking-tight">{pendingCount}</div>
          <div className="text-[10px] text-amber-700 font-bold mt-1.5 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md inline-block">
            Action Required
          </div>
        </div>

        {/* 4. COMPLETED JOBS */}
        <div
          onClick={() => onNavigateToTab && onNavigateToTab('reports')}
          className="bg-white p-4 rounded-2xl border border-zinc-300 hover:border-red-400 shadow-sm cursor-pointer transition-all duration-200 relative overflow-hidden group"
        >
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-emerald-500"></div>
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black text-zinc-700 uppercase tracking-wider">Completed</span>
            <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-black text-zinc-900 mt-2 tracking-tight">{completedCount}</div>
          <div className="text-[10px] text-emerald-800 font-bold mt-1.5 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md inline-block">
            Total Finished
          </div>
        </div>

        {/* 5. OVERDUE ALERT */}
        <div
          onClick={() => onNavigateToTab && onNavigateToTab('jobs')}
          className={`p-4 rounded-2xl border-2 transition-all duration-200 cursor-pointer relative overflow-hidden group shadow-md ${
            overdueCount > 0
              ? 'bg-red-50 border-red-500 hover:border-red-600'
              : 'bg-white border-zinc-300 hover:border-zinc-400'
          }`}
        >
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-red-600"></div>
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black text-red-600 uppercase tracking-wider flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-red-600 animate-ping"></span> Overdue
            </span>
            <div className="w-7 h-7 rounded-lg bg-red-600 text-white flex items-center justify-center shadow-2xs">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-black text-red-600 mt-2 tracking-tight">{overdueCount}</div>
          <div className="text-[10px] text-white font-black mt-1.5 bg-red-600 px-2 py-0.5 rounded-md inline-block shadow-2xs">
            Needs Attention
          </div>
        </div>

        {/* 6. POSTPONED JOBS */}
        <div
          onClick={() => onNavigateToTab && onNavigateToTab('jobs')}
          className="bg-white p-4 rounded-2xl border border-zinc-300 hover:border-red-400 shadow-sm cursor-pointer transition-all duration-200 relative overflow-hidden group"
        >
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-violet-400"></div>
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black text-zinc-600 uppercase tracking-wider">Postponed</span>
            <div className="w-7 h-7 rounded-lg bg-violet-50 text-violet-600 border border-violet-200 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-black text-zinc-900 mt-2 tracking-tight">{postponedCount}</div>
          <div className="text-[10px] text-violet-700 font-bold mt-1.5 bg-violet-50 border border-violet-200 px-2 py-0.5 rounded-md inline-block">
            Rescheduled
          </div>
        </div>

        {/* 7. UNCONFIRMED JOBS */}
        <div
          onClick={() => onNavigateToTab && onNavigateToTab('jobs')}
          className="bg-white p-4 rounded-2xl border border-zinc-300 hover:border-red-400 shadow-sm cursor-pointer transition-all duration-200 relative overflow-hidden group"
        >
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-red-500"></div>
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black text-zinc-700 uppercase tracking-wider">Unconfirmed</span>
            <div className="w-7 h-7 rounded-lg bg-red-50 text-red-600 border border-red-200 flex items-center justify-center">
              <Phone className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-black text-zinc-900 mt-2 tracking-tight">{unconfirmedCount}</div>
          <div className="text-[10px] text-red-700 font-bold mt-1.5 bg-red-50 border border-red-200 px-2 py-0.5 rounded-md inline-block">
            SMS Sent
          </div>
        </div>

      </div>

      {/* 4. TODAY'S PROGRESS BAR - PURE WHITE CONTAINER WITH RED & GREEN BAR */}
      <div className="w-full bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="font-black text-zinc-900 text-sm sm:text-base flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-red-600 animate-pulse"></span>
            <span>Today's Execution Progress ({selectedDate || data?.today})</span>
          </div>
          <div className="flex flex-wrap items-center gap-2.5 text-xs font-bold">
            <span className="bg-emerald-50 text-emerald-800 border border-emerald-200 px-3 py-1 rounded-lg flex items-center gap-1.5 shadow-2xs">
              <span className="w-2 h-2 rounded-full bg-emerald-600"></span> Completed: {stats.completed || 0}
            </span>
            <span className="bg-red-600 text-white px-3 py-1 rounded-lg flex items-center gap-1.5 shadow-2xs font-black">
              <span className="w-2 h-2 rounded-full bg-white animate-pulse"></span> In Progress: {stats.in_progress || 0}
            </span>
            <span className="bg-zinc-100 text-zinc-700 border border-zinc-300 px-3 py-1 rounded-lg flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-zinc-400"></span> Pending: {stats.pending || 0}
            </span>
          </div>
        </div>

        {/* Multi-segment progress bar */}
        <div className="w-full h-3.5 bg-zinc-100 border border-zinc-200 rounded-full overflow-hidden flex p-0.5 shadow-inner">
          {stats.total > 0 ? (
            <>
              <div
                style={{ width: `${((stats.completed || 0) / stats.total) * 100}%` }}
                className="bg-emerald-500 rounded-l-full transition-all duration-500 shadow-2xs"
                title={`Completed: ${stats.completed || 0}`}
              ></div>
              <div
                style={{ width: `${((stats.in_progress || 0) / stats.total) * 100}%` }}
                className="bg-red-600 transition-all duration-500 shadow-2xs"
                title={`In Progress: ${stats.in_progress || 0}`}
              ></div>
              <div
                style={{ width: `${((stats.postponed || 0) / stats.total) * 100}%` }}
                className="bg-zinc-400 rounded-r-full transition-all duration-500 shadow-2xs"
                title={`Postponed: ${stats.postponed || 0}`}
              ></div>
            </>
          ) : (
            <div className="w-full bg-zinc-200 rounded-full"></div>
          )}
        </div>
      </div>

      {/* 5. TODAY & TOMORROW SCHEDULE TABLE (CRISP RED & WHITE DESIGN) */}
      <div id="dashboard-schedule-section" className="w-full bg-white rounded-2xl border-2 border-red-100 shadow-md overflow-hidden">
        {/* Table Tab Selector Header */}
        <div className="p-4 sm:p-5 border-b border-zinc-200 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2.5">
            {/* TODAY TAB */}
            <button
              type="button"
              onClick={() => setActiveScheduleTab('today')}
              className={`px-5 py-2.5 rounded-xl text-xs font-black flex items-center gap-2 transition cursor-pointer ${
                activeScheduleTab === 'today'
                  ? 'bg-red-600 text-white border-2 border-red-600 shadow-md shadow-red-200'
                  : 'bg-zinc-100 hover:bg-red-50 text-zinc-800 hover:text-red-700 border border-zinc-300'
              }`}
            >
              <Clock className="w-4 h-4" />
              <span>Today's Jobs ({todayJobsList.length})</span>
              <span className={`text-[10px] px-2 py-0.5 rounded-md font-black ${
                activeScheduleTab === 'today' ? 'bg-white text-red-600' : 'bg-zinc-200 text-zinc-700'
              }`}>
                {selectedDate || data?.today}
              </span>
            </button>

            {/* TOMORROW TAB */}
            <button
              type="button"
              onClick={() => setActiveScheduleTab('tomorrow')}
              className={`px-5 py-2.5 rounded-xl text-xs font-black flex items-center gap-2 transition cursor-pointer ${
                activeScheduleTab === 'tomorrow'
                  ? 'bg-red-600 text-white border-2 border-red-600 shadow-md shadow-red-200'
                  : 'bg-zinc-100 hover:bg-red-50 text-zinc-800 hover:text-red-700 border border-zinc-300'
              }`}
            >
              <CalendarIcon className="w-4 h-4" />
              <span>Tomorrow's Jobs ({tomorrowJobsList.length})</span>
              <span className={`text-[10px] px-2 py-0.5 rounded-md font-black ${
                activeScheduleTab === 'tomorrow' ? 'bg-white text-red-600' : 'bg-zinc-200 text-zinc-700'
              }`}>
                {data?.tomorrow}
              </span>
            </button>
          </div>

          <button
            onClick={() => onNavigateToTab && onNavigateToTab('jobs')}
            className="text-xs font-black text-red-600 hover:text-red-700 flex items-center gap-1.5 self-start sm:self-auto cursor-pointer"
          >
            <span>View All Jobs in System</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        {/* Schedule List Content */}
        {(() => {
          const currentList = activeScheduleTab === 'tomorrow' ? tomorrowJobsList : todayJobsList;
          const activeDateLabel = activeScheduleTab === 'tomorrow' ? `tomorrow (${data?.tomorrow})` : `today (${selectedDate || data?.today})`;

          if (currentList.length === 0) {
            return (
              <div className="p-16 text-center text-zinc-500">
                <Clock className="w-10 h-10 mx-auto mb-3 text-red-300" />
                <div className="text-base font-bold text-zinc-800">No jobs scheduled for {activeDateLabel}</div>
                <p className="text-xs text-zinc-500 mt-1">Use the recurring service engine to generate scheduled treatments automatically.</p>
                <div className="mt-4">
                  <button
                    onClick={handleGenerateUpcoming}
                    className="text-xs px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-black rounded-xl transition cursor-pointer shadow-md shadow-red-200"
                  >
                    Auto-Generate From Recurring Schedule
                  </button>
                </div>
              </div>
            );
          }

          return (
            <div className="w-full overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-red-50 text-red-950 font-black uppercase text-[10px] tracking-wider border-b-2 border-red-500">
                  <tr>
                    <th className="px-5 py-3.5">Time</th>
                    <th className="px-5 py-3.5">Customer & Location</th>
                    <th className="px-5 py-3.5">Treatment</th>
                    <th className="px-5 py-3.5">Technician</th>
                    <th className="px-5 py-3.5">Status</th>
                    <th className="px-5 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200">
                  {currentList.map(job => (
                    <tr
                      key={job.id}
                      onClick={() => onSelectJob(job.id)}
                      className="hover:bg-red-50/50 cursor-pointer transition"
                    >
                      {/* Time */}
                      <td className="px-5 py-4 font-black text-zinc-900 whitespace-nowrap">
                        <div className="flex items-center gap-1.5 text-sm">
                          <Clock className="w-3.5 h-3.5 text-red-600" />
                          <span>{job.scheduled_time || '09:00'}</span>
                        </div>
                        <div className="text-[10px] text-zinc-500 font-semibold mt-0.5 ml-5">{job.duration_minutes || 60} mins</div>
                      </td>

                      {/* Customer & Location */}
                      <td className="px-5 py-4">
                        <div className="font-black text-zinc-950 text-sm hover:text-red-600 transition">{job.customer_name}</div>
                        <div className="flex items-center gap-1 text-[11px] text-zinc-500 mt-1 font-medium">
                          <MapPin className="w-3 h-3 text-red-500 shrink-0" />
                          <span className="truncate max-w-xs">{job.location_name || job.location_address || 'Main Location'}</span>
                        </div>
                      </td>

                      {/* Treatment */}
                      <td className="px-5 py-4 whitespace-nowrap">
                        <span
                          style={{
                            backgroundColor: '#fee2e2',
                            color: '#b91c1c',
                            borderColor: '#fca5a5'
                          }}
                          className="px-3 py-1 rounded-lg text-xs font-black inline-block border"
                        >
                          {job.treatment_code || job.treatment_name || 'PEST'}
                        </span>
                      </td>

                      {/* Technician */}
                      <td className="px-5 py-4 whitespace-nowrap text-zinc-800">
                        {job.technician_name ? (
                          <div className="flex items-center gap-2 font-bold">
                            <div className="w-6 h-6 rounded-full bg-red-600 text-white text-[10px] font-black flex items-center justify-center shadow-2xs">
                              {job.technician_name.charAt(0).toUpperCase()}
                            </div>
                            <span>{job.technician_name}</span>
                          </div>
                        ) : (
                          <span className="text-red-600 font-bold italic text-[11px] bg-red-50 px-2 py-0.5 rounded border border-red-200">
                            Unassigned
                          </span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="px-5 py-4 whitespace-nowrap">
                        <span className={`px-3 py-1 rounded-full text-[11px] font-black tracking-wide ${
                          job.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' :
                          job.status === 'IN_PROGRESS' ? 'bg-red-600 text-white animate-pulse shadow-2xs' :
                          job.status === 'POSTPONED' ? 'bg-zinc-200 text-zinc-800' :
                          'bg-zinc-100 text-zinc-800 border border-zinc-300'
                        }`}>
                          {job.status}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="px-5 py-4 text-right whitespace-nowrap space-x-2">
                        {job.customer_phone && (
                          <a
                            href={`tel:${job.customer_phone}`}
                            onClick={(e) => e.stopPropagation()}
                            className="p-2 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 rounded-lg inline-flex items-center transition shadow-2xs"
                            title="Call Customer"
                          >
                            <Phone className="w-3.5 h-3.5" />
                          </a>
                        )}

                        {job.status === 'TO_BE_DONE' || job.status === 'ASSIGNED' ? (
                          <button
                            onClick={(e) => handleStartJob(job.id, e)}
                            className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white font-black rounded-lg text-xs inline-flex items-center gap-1.5 transition shadow-sm shadow-red-200 cursor-pointer"
                          >
                            <PlayCircle className="w-3.5 h-3.5" /> Start
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        })()}
      </div>

    </div>
  );
}
