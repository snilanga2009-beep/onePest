import React, { useState, useEffect } from 'react';
import {
  Calendar as CalendarIcon, ChevronLeft, ChevronRight, Clock,
  Filter, User, MapPin, CheckCircle2, AlertTriangle, UserPlus,
  Edit, Sparkles, Check, ChevronDown, Eye, CalendarDays,
  Zap, ArrowRight, X, Phone, Layers, ShieldCheck, Users, HardHat
} from 'lucide-react';
import { getCalendarEvents, getStaff, getTreatments } from '../api';
import EditJobModal from '../components/EditJobModal';

export default function CalendarView({
  onSelectJob,
  onOpenAddCustomer,
  currentRole,
  currentTechnicianId
}) {
  const isTechnicianMode = currentRole === 'TECHNICIAN' || (Boolean(currentTechnicianId) && currentRole !== 'ADMIN' && currentRole !== 'MANAGER' && currentRole !== 'SUPERVISOR');

  const getEffectiveTechId = () => {
    if (currentTechnicianId) return String(currentTechnicianId);
    try {
      const pref = localStorage.getItem('tech_preferred_id');
      if (pref) return String(pref);
      const authUser = localStorage.getItem('auth_user');
      if (authUser) {
        const u = JSON.parse(authUser);
        if (u?.id) return String(u.id);
      }
      const techSess = localStorage.getItem('tech_session_v1') || localStorage.getItem('tech_session');
      if (techSess) {
        const s = JSON.parse(techSess);
        const id = s?.technician?.id || s?.id;
        if (id) return String(id);
      }
    } catch (e) {}
    return '';
  };

  const lockedTechId = isTechnicianMode ? getEffectiveTechId() : '';

  const [viewMode, setViewMode] = useState('month'); // 'day', 'week', 'month', 'list'
  const [currentDate, setCurrentDate] = useState(new Date('2026-09-01'));
  const [events, setEvents] = useState([]);
  const [eventsByDate, setEventsByDate] = useState({});
  const [loading, setLoading] = useState(true);

  // Filters
  const [filterFrequency, setFilterFrequency] = useState('all');
  const [filterTechnician, setFilterTechnician] = useState(() => (isTechnicianMode ? getEffectiveTechId() : ''));
  const [filterStatus, setFilterStatus] = useState('');
  const [filterTreatment, setFilterTreatment] = useState('');

  // Frequency live metric counts
  const [frequencyCounts, setFrequencyCounts] = useState({
    all: 0,
    DAILY: 0,
    WEEKLY: 0,
    FORTNIGHTLY: 0,
    MONTHLY: 0,
    '3 MONTHLY': 0
  });

  // Keep filterTechnician locked to technician in technician mode
  useEffect(() => {
    if (isTechnicianMode) {
      const resolved = getEffectiveTechId();
      if (resolved) {
        setFilterTechnician(resolved);
      }
    }
  }, [isTechnicianMode, currentTechnicianId]);

  // Metadata
  const [staff, setStaff] = useState([]);
  const [treatments, setTreatments] = useState([]);

  // Selected Day Drawer & Edit Job Modal
  const [selectedDayEvents, setSelectedDayEvents] = useState(null);
  const [editingJob, setEditingJob] = useState(null);

  useEffect(() => {
    getStaff().then(r => setStaff(r.staff || []));
    getTreatments().then(r => setTreatments(r.treatments || []));
  }, []);

  const loadEvents = async () => {
    setLoading(true);
    try {
      // Calculate start and end date based on current month
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth();
      const startDate = `${year}-${String(month + 1).padStart(2, '0')}-01`;
      const lastDay = new Date(year, month + 1, 0).getDate();
      const endDate = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

      const res = await getCalendarEvents({
        start_date: startDate,
        end_date: endDate,
        technician_id: isTechnicianMode ? (lockedTechId || filterTechnician) : filterTechnician,
        status: filterStatus,
        treatment_id: filterTreatment,
        frequency: filterFrequency !== 'all' ? filterFrequency : ''
      });

      if (res.frequency_counts) {
        setFrequencyCounts(res.frequency_counts);
      }

      let evts = res.events || [];
      // Client-side safeguard to guarantee frequency filtering
      if (filterFrequency && filterFrequency !== 'all') {
        const target = filterFrequency.toUpperCase();
        evts = evts.filter(j => (j.recurring_frequency || j.frequency || '').toUpperCase() === target);
      }

      setEvents(evts);

      // Re-build eventsByDate to strictly reflect active filtered events
      const grouped = {};
      evts.forEach(job => {
        const d = job.scheduled_date;
        if (!grouped[d]) grouped[d] = [];
        grouped[d].push(job);
      });
      setEventsByDate(grouped);

      // If a day drawer was open, update its events matching current frequency filter
      setSelectedDayEvents(prev => {
        if (!prev) return null;
        const updatedDateStr = prev.dateStr;
        return {
          ...prev,
          events: grouped[updatedDateStr] || []
        };
      });
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEvents();
  }, [currentDate, filterFrequency, filterTechnician, filterStatus, filterTreatment]);

  // Navigate dates
  const handlePrev = () => {
    const next = new Date(currentDate);
    if (viewMode === 'month') next.setMonth(next.getMonth() - 1);
    else if (viewMode === 'week') next.setDate(next.getDate() - 7);
    else next.setDate(next.getDate() - 1);
    setCurrentDate(next);
  };

  const handleNext = () => {
    const next = new Date(currentDate);
    if (viewMode === 'month') next.setMonth(next.getMonth() + 1);
    else if (viewMode === 'week') next.setDate(next.getDate() + 7);
    else next.setDate(next.getDate() + 1);
    setCurrentDate(next);
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  // Month grid generator
  const getDaysInMonth = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDayIndex = new Date(year, month, 1).getDay(); // 0 is Sunday
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const days = [];
    // Padding before 1st of month
    for (let i = 0; i < firstDayIndex; i++) {
      days.push({ day: null, dateStr: null });
    }
    // Month days
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      days.push({ day: d, dateStr });
    }
    return days;
  };

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  // Compute operational statistics for current view
  const stats = {
    total: events.length,
    completed: events.filter(e => e.status === 'COMPLETED').length,
    inProgress: events.filter(e => e.status === 'IN_PROGRESS').length,
    assignedOrPending: events.filter(e => e.status === 'ASSIGNED' || e.status === 'TO_BE_DONE').length,
    postponed: events.filter(e => e.status === 'POSTPONED').length,
  };

  return (
    <div className="space-y-5 pb-16">

      {/* Top Banner / Hero Header */}
      <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl bg-white p-5 sm:p-7 text-slate-900 shadow-sm border border-slate-200/90 border-t-4 border-t-red-600">
        
        {/* Soft Ambient Accents */}
        <div className="absolute -top-24 -right-24 w-80 h-80 rounded-full bg-red-500/5 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-80 h-80 rounded-full bg-red-500/5 blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-2.5 py-0.5 rounded-full bg-red-50 text-red-700 font-extrabold text-[10px] tracking-widest uppercase border border-red-200 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-red-600 animate-ping" />
                Live Operational Schedule
              </span>
              <span className="text-[10px] text-slate-500 font-medium">Asia/Colombo Timezone</span>
            </div>

            <h1 className="text-xl sm:text-3xl font-black tracking-tight text-slate-900 flex items-center gap-2.5 sm:gap-3">
              <CalendarDays className="w-6 h-6 sm:w-7 sm:h-7 text-red-600 shrink-0" />
              <span>{isTechnicianMode ? 'My Assigned Schedule' : 'Master Operations Schedule Calendar'}</span>
            </h1>

            <p className="text-xs sm:text-sm text-slate-600 mt-1 max-w-2xl font-normal leading-relaxed">
              Multi-frequency dispatch board for commercial, residential and industrial pest prevention cycles with real-time status tracking.
            </p>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex flex-wrap items-center gap-2.5">
            {onOpenAddCustomer && (
              <button
                type="button"
                onClick={onOpenAddCustomer}
                className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white font-extrabold text-xs rounded-2xl shadow-md shadow-red-600/30 transition transform active:scale-95 border border-red-500"
              >
                <UserPlus className="w-4 h-4" />
                <span>+ Add Customer</span>
              </button>
            )}

            {/* View Mode Toggle Switcher */}
            <div className="bg-slate-100 p-1 rounded-2xl flex items-center gap-1 border border-slate-200 text-xs font-bold">
              {['month', 'week', 'day', 'list'].map(mode => (
                <button
                  key={mode}
                  onClick={() => setViewMode(mode)}
                  className={`px-3.5 py-1.5 rounded-xl capitalize transition-all duration-200 ${
                    viewMode === mode
                      ? 'bg-red-600 text-white shadow-md font-black scale-102'
                      : 'text-slate-600 hover:text-slate-950 hover:bg-white'
                  }`}
                >
                  {mode}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Operational Statistics Pill Cards */}
        <div className="relative z-10 grid grid-cols-2 sm:grid-cols-5 gap-3 mt-6 pt-5 border-t border-slate-100">
          
          <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-slate-200/80 text-slate-700 flex items-center justify-center font-bold">
              <CalendarIcon className="w-4 h-4" />
            </div>
            <div>
              <div className="text-lg font-black text-slate-900">{stats.total}</div>
              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Total in View</div>
            </div>
          </div>

          <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            </div>
            <div>
              <div className="text-lg font-black text-emerald-800">{stats.completed}</div>
              <div className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">Completed</div>
            </div>
          </div>

          <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center font-bold">
              <Clock className="w-4 h-4 text-amber-600" />
            </div>
            <div>
              <div className="text-lg font-black text-amber-800">{stats.inProgress}</div>
              <div className="text-[10px] font-bold text-amber-600 uppercase tracking-wider">In Progress</div>
            </div>
          </div>

          <div className="p-3 rounded-2xl bg-red-50 border border-red-200 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-red-100 text-red-700 flex items-center justify-center font-bold">
              <User className="w-4 h-4 text-red-600" />
            </div>
            <div>
              <div className="text-lg font-black text-red-800">{stats.assignedOrPending}</div>
              <div className="text-[10px] font-bold text-red-600 uppercase tracking-wider">Assigned / To Do</div>
            </div>
          </div>

          <div className="p-3 rounded-2xl bg-purple-50 border border-purple-200 flex items-center gap-3 col-span-2 sm:col-span-1">
            <div className="w-9 h-9 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold">
              <AlertTriangle className="w-4 h-4 text-purple-600" />
            </div>
            <div>
              <div className="text-lg font-black text-purple-800">{stats.postponed}</div>
              <div className="text-[10px] font-bold text-purple-600 uppercase tracking-wider">Postponed</div>
            </div>
          </div>

        </div>

      </div>

      {/* Colorful Interactive Treatment & Frequency Filter Bar */}
      <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-sm space-y-4">
        
        {/* Treatment Color Legend Chips */}
        <div>
          <div className="flex items-center justify-between text-xs font-bold text-slate-400 uppercase tracking-wider mb-2.5">
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Treatment Types & Color Coding (Click to filter)</span>
            </span>
            {filterTreatment && (
              <button
                onClick={() => setFilterTreatment('')}
                className="text-[11px] font-bold text-emerald-700 hover:underline"
              >
                Clear Treatment Filter
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {treatments.map(t => {
              const isSelected = filterTreatment === String(t.id);
              const colorHex = t.color_hex || '#10B981';

              return (
                <button
                  key={t.id}
                  onClick={() => setFilterTreatment(isSelected ? '' : String(t.id))}
                  style={{
                    backgroundColor: isSelected ? colorHex : `${colorHex}15`,
                    borderColor: isSelected ? colorHex : `${colorHex}50`,
                    color: isSelected ? '#ffffff' : colorHex
                  }}
                  className={`px-3 py-1.5 rounded-xl border text-xs font-black transition-all flex items-center gap-2 transform active:scale-95 shadow-2xs ${
                    isSelected ? 'ring-3 ring-emerald-300 scale-105 shadow-md' : 'hover:scale-102'
                  }`}
                  title={`${t.name} (Duration: ${t.default_duration_minutes}m)`}
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: isSelected ? '#ffffff' : colorHex }}
                  />
                  <span>{t.code}</span>
                  <span className={`text-[10px] font-semibold opacity-80 hidden md:inline`}>
                    {t.name}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Secondary Filter Controls */}
        <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs">
          
          {/* Quick Frequency Filter Chips */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="font-bold text-slate-400 uppercase text-[10px] mr-1">Frequency:</span>
            {[
              { id: 'all', label: 'All' },
              { id: 'DAILY', label: 'Daily' },
              { id: 'WEEKLY', label: 'Weekly' },
              { id: 'FORTNIGHTLY', label: 'Fortnightly' },
              { id: 'MONTHLY', label: 'Monthly' },
              ...(frequencyCounts['3 MONTHLY'] > 0 ? [{ id: '3 MONTHLY', label: '3 Monthly' }] : [])
            ].map(f => {
              const count = frequencyCounts[f.id] ?? (f.id === 'all' ? frequencyCounts.all : 0);
              const isSelected = filterFrequency === f.id;
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setFilterFrequency(f.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold uppercase transition flex items-center gap-1.5 transform active:scale-95 shadow-2xs cursor-pointer ${
                    isSelected
                      ? 'bg-gradient-to-r from-red-600 to-red-700 text-white shadow-md scale-105 ring-2 ring-red-400/40'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  <span>{f.label}</span>
                  {typeof count === 'number' && (
                    <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                      isSelected ? 'bg-white/25 text-white' : 'bg-slate-200 text-slate-600'
                    }`}>
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Dropdown Filters */}
          <div className="flex flex-wrap items-center gap-2">
            {isTechnicianMode ? (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-50 text-red-800 border border-red-200 text-xs font-black shadow-2xs">
                <HardHat className="w-3.5 h-3.5 text-red-600" />
                <span>My Assigned Schedule Only</span>
              </div>
            ) : (
              <select
                value={filterTechnician}
                onChange={(e) => setFilterTechnician(e.target.value)}
                className="bg-slate-50 text-xs font-semibold px-3 py-1.5 rounded-xl border border-slate-200 focus:outline-hidden focus:border-red-500"
              >
                <option value="">All Field Technicians</option>
                {staff.filter(s => s.role === 'TECHNICIAN').map(s => (
                  <option key={s.id} value={s.id}>{s.full_name}</option>
                ))}
              </select>
            )}

            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="bg-slate-50 text-xs font-semibold px-3 py-1.5 rounded-xl border border-slate-200 focus:outline-hidden focus:border-red-500"
            >
              <option value="">All Statuses</option>
              <option value="TO_BE_DONE">TO BE DONE</option>
              <option value="ASSIGNED">ASSIGNED</option>
              <option value="IN_PROGRESS">IN PROGRESS</option>
              <option value="COMPLETED">COMPLETED</option>
              <option value="POSTPONED">POSTPONED</option>
            </select>
          </div>
        </div>

        {/* Date Navigator Header Bar */}
        <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrev}
              className="p-2 rounded-xl border border-slate-200 hover:bg-red-50 hover:border-red-300 hover:text-red-700 text-slate-700 transition"
              title="Previous Month"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <div className="bg-gradient-to-r from-red-50 via-rose-50 to-red-50 px-5 py-2 rounded-2xl border border-red-200 shadow-2xs">
              <h2 className="text-base sm:text-lg font-black text-red-950 tracking-tight text-center">
                {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
              </h2>
            </div>

            <button
              onClick={handleNext}
              className="p-2 rounded-xl border border-slate-200 hover:bg-red-50 hover:border-red-300 hover:text-red-700 text-slate-700 transition"
              title="Next Month"
            >
              <ChevronRight className="w-4 h-4" />
            </button>

            <button
              onClick={handleToday}
              className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl transition border border-slate-200 ml-1"
            >
              Today
            </button>
          </div>

          <div className="flex items-center gap-3 text-xs">
            <span className="text-slate-500">
              Showing <strong className="text-slate-900 font-bold">{events.length}</strong> scheduled services
            </span>
            {loading && (
              <span className="text-red-600 font-bold flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
                Updating...
              </span>
            )}
          </div>
        </div>

      </div>

      {/* VIEW 1: MONTH GRID VIEW */}
      {viewMode === 'month' && (
        <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200/90 shadow-md overflow-hidden">
          <div className="overflow-x-auto w-full">
            <div className="min-w-[620px] sm:min-w-0">
              
              {/* Day of Week Header with Gradients */}
              <div className="grid grid-cols-7 bg-gradient-to-r from-red-50/70 via-rose-50/50 to-red-50/70 border-b border-red-200 text-center py-3 text-xs font-black text-red-950 uppercase tracking-wider">
            <span className="text-red-600 font-black">Sun</span>
            <span>Mon</span>
            <span>Tue</span>
            <span>Wed</span>
            <span>Thu</span>
            <span>Fri</span>
            <span className="text-red-600 font-black">Sat</span>
          </div>

          {/* Month Days Grid */}
          <div className="grid grid-cols-7 auto-rows-fr divide-x divide-y divide-slate-100 min-h-[620px]">
            {getDaysInMonth().map((item, idx) => {
              const dayEvents = item.dateStr ? (eventsByDate[item.dateStr] || []) : [];
              const isToday = item.dateStr === new Date().toISOString().substring(0, 10);
              const isWeekend = idx % 7 === 0 || idx % 7 === 6;

              if (!item.day) {
                return (
                  <div key={`empty-${idx}`} className="bg-slate-50/50 p-2 min-h-[115px]"></div>
                );
              }

              return (
                <div
                  key={item.dateStr}
                  onClick={() => setSelectedDayEvents({ dateStr: item.dateStr, day: item.day, events: dayEvents })}
                  className={`p-2 min-h-[115px] flex flex-col justify-between transition group cursor-pointer relative ${
                    isToday
                      ? 'bg-gradient-to-b from-red-50/60 to-white ring-2 ring-red-500 z-10 shadow-sm'
                      : isWeekend
                      ? 'bg-slate-50/40 hover:bg-slate-100/70'
                      : 'hover:bg-slate-50/80'
                  }`}
                >
                  {/* Day Header */}
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-1.5">
                      <span className={`text-xs font-black px-2 py-0.5 rounded-lg ${
                        isToday
                          ? 'bg-red-600 text-white shadow-xs'
                          : isWeekend
                          ? 'text-red-600 font-bold'
                          : 'text-slate-800'
                      }`}>
                        {item.day}
                      </span>
                      {isToday && (
                        <span className="text-[9px] font-black text-red-700 bg-red-100 px-1.5 py-0.2 rounded uppercase">
                          Today
                        </span>
                      )}
                    </div>

                    {dayEvents.length > 0 && (
                      <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                        dayEvents.length > 4
                          ? 'bg-purple-100 text-purple-800 border border-purple-200'
                          : dayEvents.length > 2
                          ? 'bg-blue-100 text-blue-800 border border-blue-200'
                          : 'bg-slate-100 text-slate-700'
                      }`}>
                        {dayEvents.length} {dayEvents.length === 1 ? 'job' : 'jobs'}
                      </span>
                    )}
                  </div>

                  {/* Day Job Chips Container */}
                  <div className="space-y-1.5 flex-1 overflow-hidden">
                    {dayEvents.slice(0, 3).map(j => {
                      const color = j.treatment_color || '#10B981';

                      return (
                        <div
                          key={j.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedDayEvents({ dateStr: item.dateStr, day: item.day, events: dayEvents, highlightedJobId: j.id });
                          }}
                          style={{
                            borderLeftColor: color,
                            backgroundColor: `${color}12`
                          }}
                          className="p-1.5 border-l-3 rounded-lg text-[10px] text-slate-900 hover:shadow-xs transition transform hover:scale-[1.02] flex items-center justify-between gap-1 group/chip"
                          title={`${j.scheduled_time || '09:00'} - ${j.customer_name} (${j.treatment_code})`}
                        >
                          <div className="min-w-0 flex items-center gap-1 truncate">
                            <span
                              style={{ color }}
                              className="font-black shrink-0 text-[10px]"
                            >
                              {j.treatment_code}
                            </span>
                            <span className="font-semibold text-slate-800 truncate">
                              {j.customer_name}
                            </span>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            {/* Status Dot */}
                            <span
                              className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                                j.status === 'COMPLETED' ? 'bg-emerald-500' :
                                j.status === 'IN_PROGRESS' ? 'bg-amber-500 animate-pulse' :
                                j.status === 'POSTPONED' ? 'bg-indigo-500' :
                                'bg-slate-400'
                              }`}
                            />

                            {/* Quick Edit Button on Hover (Admin only) */}
                            {!isTechnicianMode && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingJob(j);
                                }}
                                className="opacity-0 group-hover/chip:opacity-100 p-0.5 rounded hover:bg-white text-slate-600 hover:text-amber-700 transition"
                                title="Edit this job"
                              >
                                <Edit className="w-2.5 h-2.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}

                    {dayEvents.length > 3 && (
                      <div className="text-[10px] text-emerald-800 font-extrabold px-1.5 py-0.5 rounded bg-emerald-50 border border-emerald-100 text-center">
                        +{dayEvents.length - 3} more jobs &rarr;
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            </div>
            </div>
          </div>
        </div>
      )}

      {/* VIEW 2: LIST / WEEK / DAY VIEW */}
      {(viewMode === 'list' || viewMode === 'day' || viewMode === 'week') && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-md overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex items-center justify-between font-black text-slate-900 text-sm">
            <span className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-emerald-600" />
              <span>Operational Timeline Events ({events.length})</span>
            </span>
          </div>

          <div className="divide-y divide-slate-100">
            {events.length === 0 ? (
              <div className="p-16 text-center text-slate-400 text-xs">
                No events found matching current criteria.
              </div>
            ) : (
              events.map(job => (
                <div
                  key={job.id}
                  onClick={() => setSelectedDayEvents({ dateStr: job.scheduled_date, day: null, events: [job], highlightedJobId: job.id })}
                  className="p-4 hover:bg-slate-50 cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs transition group"
                >
                  <div className="flex items-center gap-4">
                    {/* Time & Date Box */}
                    <div className="font-mono text-center min-w-[85px] p-2 rounded-xl bg-slate-50 border border-slate-200 group-hover:border-emerald-300 transition">
                      <div className="font-black text-slate-900 text-xs">{job.scheduled_date}</div>
                      <div className="text-slate-500 text-[11px] font-bold mt-0.5">{job.scheduled_time || '09:00'}</div>
                    </div>

                    {/* Color Accent Bar */}
                    <div
                      className="w-2 h-12 rounded-full shrink-0 shadow-xs"
                      style={{ backgroundColor: job.treatment_color || '#10B981' }}
                    />

                    <div>
                      <div className="font-black text-slate-900 text-sm sm:text-base flex items-center gap-2">
                        <span>{job.customer_name}</span>
                        <span
                          style={{
                            backgroundColor: `${job.treatment_color || '#10B981'}20`,
                            color: job.treatment_color || '#10B981'
                          }}
                          className="text-[10px] font-black px-2 py-0.5 rounded-md uppercase"
                        >
                          {job.treatment_code}
                        </span>
                      </div>

                      <div className="text-slate-500 text-[11px] mt-1 flex flex-wrap items-center gap-2 font-medium">
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-slate-400" />
                          <span>{job.location_name || 'Main Location'}</span>
                        </span>
                        {job.technician_name && (
                          <>
                            <span>&bull;</span>
                            <span className="flex items-center gap-1 font-semibold text-slate-700">
                              <User className="w-3 h-3 text-emerald-600" />
                              <span>Tech: {job.technician_name}</span>
                            </span>
                            {(job.crew_count > 1 || job.workers_info) && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 font-bold text-[10px] border border-indigo-200">
                                <HardHat className="w-2.5 h-2.5 text-indigo-600" />
                                <span>{job.crew_count || 1} Crew</span>
                              </span>
                            )}
                          </>
                        )}
                        {job.recurring_frequency && (
                          <>
                            <span>&bull;</span>
                            <span className="text-emerald-700 font-bold bg-emerald-50 px-1.5 py-0.2 rounded">
                              {job.recurring_frequency}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-center" onClick={(e) => e.stopPropagation()}>
                    <span className={`px-3 py-1 rounded-full text-[10px] font-black tracking-wide uppercase ${
                      job.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' :
                      job.status === 'IN_PROGRESS' ? 'bg-amber-100 text-amber-800 border border-amber-200 animate-pulse' :
                      job.status === 'POSTPONED' ? 'bg-indigo-100 text-indigo-800 border border-indigo-200' :
                      'bg-slate-100 text-slate-700 border border-slate-200'
                    }`}>
                      {job.status}
                    </span>

                    {!isTechnicianMode && (
                      <button
                        type="button"
                        onClick={() => setEditingJob(job)}
                        className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 font-bold rounded-xl text-xs flex items-center gap-1 border border-amber-200 transition shadow-2xs"
                        title="Edit Job Details"
                      >
                        <Edit className="w-3 h-3 text-amber-600" />
                        <span>Edit</span>
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* SELECTED DAY OPERATIONAL INSPECTOR DRAWER */}
      {selectedDayEvents && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex justify-end animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-xl h-full shadow-2xl overflow-y-auto flex flex-col animate-in slide-in-from-right duration-200">
            
            {/* Drawer Header */}
            <div className="p-6 bg-gradient-to-r from-red-700 via-red-600 to-rose-700 text-white flex items-center justify-between sticky top-0 z-10 shadow-md">
              <div>
                <span className="text-[10px] uppercase font-mono font-black px-2 py-0.5 rounded-full bg-white/20 text-white border border-white/30">
                  Day Schedule Inspector
                </span>
                <h2 className="text-xl font-black mt-1 text-white">
                  {selectedDayEvents.dateStr}
                </h2>
                <div className="text-xs text-red-100 mt-0.5 font-medium">
                  {selectedDayEvents.events.length} treatment service(s) scheduled on this day
                </div>
              </div>

              <button
                onClick={() => setSelectedDayEvents(null)}
                className="p-2 text-white/80 hover:text-white rounded-xl hover:bg-white/10 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Drawer Content */}
            <div className="p-6 space-y-4 flex-1 overflow-y-auto">
              {selectedDayEvents.events.length === 0 ? (
                <div className="p-12 text-center text-slate-400 text-xs">
                  No appointments scheduled for this date.
                </div>
              ) : (
                selectedDayEvents.events.map(job => (
                  <div
                    key={job.id}
                    className={`p-4 rounded-2xl bg-white border transition space-y-3 ${
                      selectedDayEvents.highlightedJobId === job.id
                        ? 'border-emerald-500 ring-2 ring-emerald-400/50 shadow-md'
                        : 'border-slate-200 hover:border-emerald-300 shadow-xs'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs font-mono font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded">
                          {job.job_code}
                        </span>
                        <span
                          style={{
                            backgroundColor: `${job.treatment_color || '#10B981'}20`,
                            color: job.treatment_color || '#10B981'
                          }}
                          className="text-[10px] font-black px-2 py-0.5 rounded-md uppercase"
                        >
                          {job.treatment_code}
                        </span>
                        {(job.recurring_frequency || job.frequency) && (
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wide bg-teal-50 text-teal-800 border border-teal-200">
                            {job.recurring_frequency || job.frequency}
                          </span>
                        )}
                      </div>

                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black ${
                        job.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-800' :
                        job.status === 'IN_PROGRESS' ? 'bg-amber-100 text-amber-800' :
                        job.status === 'POSTPONED' ? 'bg-indigo-100 text-indigo-800' :
                        'bg-slate-100 text-slate-700'
                      }`}>
                        {job.status}
                      </span>
                    </div>

                    <div>
                      <h4 className="font-extrabold text-slate-900 text-base">{job.customer_name}</h4>
                      <div className="text-xs text-slate-500 mt-1 space-y-1">
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          <span>Time: <strong className="text-slate-800">{job.scheduled_time || '09:00'}</strong> ({job.duration_minutes || 60} mins)</span>
                        </div>
                        {job.customer_phone && (
                          <div className="flex items-center gap-1.5">
                            <Phone className="w-3.5 h-3.5 text-emerald-600" />
                            <a
                              href={`tel:${job.customer_phone}`}
                              className="text-emerald-700 font-bold hover:underline font-mono"
                            >
                              {job.customer_phone}
                            </a>
                          </div>
                        )}
                        {job.location_name && (
                          <div className="flex items-center gap-1.5">
                            <MapPin className="w-3.5 h-3.5 text-slate-400" />
                            <span>{job.location_name} {job.location_address ? `(${job.location_address})` : ''}</span>
                          </div>
                        )}
                        {job.technician_name && (
                          <div className="flex flex-wrap items-center gap-1.5">
                            <div className="flex items-center gap-1.5">
                              <User className="w-3.5 h-3.5 text-emerald-600" />
                              <span>Technician: <strong className="text-slate-800">{job.technician_name}</strong></span>
                            </div>
                            {(job.crew_count > 1 || job.workers_info) && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 font-bold text-[10px] border border-indigo-200">
                                <HardHat className="w-3 h-3 text-indigo-600" />
                                <span>{job.crew_count || 1} Total Crew</span>
                              </span>
                            )}
                          </div>
                        )}

                        {job.special_instructions && (
                          <div className="mt-1.5 p-2 bg-amber-50/80 border border-amber-200 rounded-xl text-[11px] text-amber-900 leading-relaxed">
                            <strong>Special Customer Instructions:</strong> {job.special_instructions}
                          </div>
                        )}

                        {/* Accompanying Workers List */}
                        {(() => {
                          let workers = [];
                          try {
                            if (job.workers_info) {
                              workers = typeof job.workers_info === 'string'
                                ? JSON.parse(job.workers_info)
                                : job.workers_info;
                            }
                          } catch (e) {}

                          if (!workers || workers.length === 0) return null;

                          return (
                            <div className="mt-2 p-2.5 bg-slate-50 border border-slate-200/80 rounded-xl space-y-1.5">
                              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                                <Users className="w-3 h-3 text-indigo-600" /> Accompanying Workers ({workers.length}):
                              </span>
                              <div className="flex flex-wrap gap-1.5">
                                {workers.map((w, idx) => (
                                  <span key={idx} className="inline-flex items-center gap-1.5 px-2 py-1 bg-white border border-slate-200 rounded-lg text-[11px] text-slate-800">
                                    <strong className="text-slate-900">{w.name || `Labourer #${idx + 1}`}</strong>
                                    {w.phone && (
                                      <a
                                        href={`tel:${w.phone}`}
                                        className="text-emerald-700 font-mono text-[10px] font-bold hover:underline flex items-center gap-0.5 bg-emerald-50 px-1.5 py-0.5 rounded"
                                      >
                                        <Phone className="w-2.5 h-2.5" /> {w.phone}
                                      </a>
                                    )}
                                  </span>
                                ))}
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                      <button
                        type="button"
                        onClick={() => {
                          onSelectJob(job.id);
                          setSelectedDayEvents(null);
                        }}
                        className="text-xs font-bold text-emerald-700 hover:text-emerald-900 flex items-center gap-1"
                      >
                        <Eye className="w-3.5 h-3.5" /> View Operations Details
                      </button>

                      {!isTechnicianMode && (
                        <button
                          type="button"
                          onClick={() => setEditingJob(job)}
                          className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 font-bold rounded-xl text-xs flex items-center gap-1 border border-amber-200 transition"
                        >
                          <Edit className="w-3 h-3 text-amber-600" />
                          <span>Edit Job</span>
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Drawer Footer */}
            <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
              <span className="text-xs text-slate-500">Day View Inspection</span>
              <button
                type="button"
                onClick={() => setSelectedDayEvents(null)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-xs rounded-xl transition"
              >
                Close Drawer
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Edit Job Details Modal */}
      <EditJobModal
        isOpen={!!editingJob}
        job={editingJob}
        onClose={() => setEditingJob(null)}
        onJobUpdated={() => {
          loadEvents();
        }}
      />

    </div>
  );
}
