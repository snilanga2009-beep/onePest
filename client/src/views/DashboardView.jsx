import React, { useState, useEffect } from 'react';
import {
  Calendar as CalendarIcon, Clock, CheckCircle2, AlertTriangle,
  PlayCircle, Phone, ArrowRight, User, MapPin, RefreshCw, Zap,
  Smartphone, Settings as SettingsIcon, Plus, Briefcase, UserPlus
} from 'lucide-react';
import { getDashboardStats, startJob, generateUpcomingJobs } from '../api';

export default function DashboardView({ onSelectJob, onNavigateToTab, onOpenAddCustomer }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState('');
  const [genLoading, setGenLoading] = useState(false);

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
      <div className="p-8 flex items-center justify-center text-slate-400">
        <RefreshCw className="w-6 h-6 animate-spin mr-2 text-emerald-600" /> Loading operations dashboard...
      </div>
    );
  }

  const counters = data?.counters || {};
  const stats = data?.today_stats || {};

  return (
    <div className="space-y-6 pb-12">

      {/* Header with Date Selector and Generation Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
        <div>
          <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[11px] font-bold uppercase tracking-wider mb-1.5 border border-emerald-200">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
            Asia/Colombo (GMT+5:30) Live
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            Operations Control Dashboard
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Pest control daily scheduling, field technician progress and operational alerts.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-2 bg-slate-50 px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium">
            <CalendarIcon className="w-4 h-4 text-emerald-600" />
            <input
              type="date"
              value={selectedDate || data?.today || ''}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-transparent border-none text-slate-800 font-semibold focus:outline-hidden cursor-pointer"
            />
          </div>

          {onOpenAddCustomer && (
            <button
              type="button"
              onClick={onOpenAddCustomer}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-emerald-50 text-slate-800 hover:text-emerald-800 text-xs font-bold rounded-xl border border-slate-200 hover:border-emerald-300 transition shadow-2xs"
            >
              <UserPlus className="w-3.5 h-3.5 text-emerald-600" />
              <span>+ Add Customer</span>
            </button>
          )}

          <button
            onClick={handleGenerateUpcoming}
            disabled={genLoading}
            className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold rounded-xl shadow-md shadow-emerald-200 transition scale-100 hover:scale-[1.02]"
          >
            <Zap className={`w-3.5 h-3.5 ${genLoading ? 'animate-spin' : ''}`} />
            <span>{genLoading ? 'Generating...' : 'Auto-Generate Jobs'}</span>
          </button>
        </div>
      </div>

      {/* NEW SYSTEM AUTOMATION PIPELINE BANNER */}
      <div className="bg-gradient-to-r from-slate-950 via-indigo-950 to-emerald-950 text-white p-5 sm:p-6 rounded-3xl shadow-xl border border-indigo-900/50 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold uppercase tracking-wider mb-1 border border-emerald-500/30">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
              Full Auto Operations Engine Active (No Excel Work Needed)
            </div>
            <h2 className="text-base sm:text-lg font-black tracking-tight text-white">
              Automated Lifecycle: Customer → Recurring Engine → Technician App → Auto Next Job
            </h2>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => onNavigateToTab && onNavigateToTab('reminders')}
              className="px-3.5 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs rounded-xl shadow-md shadow-purple-900/40 transition flex items-center gap-1.5"
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>SMS Reminders (Text.lk)</span>
            </button>

            <button
              onClick={() => onNavigateToTab && onNavigateToTab('settings')}
              className="px-3.5 py-2 bg-gradient-to-r from-fuchsia-600 to-pink-600 hover:from-fuchsia-500 hover:to-pink-500 text-white font-bold text-xs rounded-xl shadow-md shadow-fuchsia-900/40 transition flex items-center gap-1.5"
            >
              <SettingsIcon className="w-3.5 h-3.5" />
              <span>Settings & Users</span>
            </button>

            <button
              onClick={() => onNavigateToTab && onNavigateToTab('jobs')}
              className="px-3.5 py-2 bg-white/10 hover:bg-white/20 text-white font-bold text-xs rounded-xl border border-white/20 transition flex items-center gap-1.5"
            >
              <Briefcase className="w-3.5 h-3.5" />
              <span>Manage Jobs</span>
            </button>
          </div>
        </div>

        {/* 5-step visual flow */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-2 border-t border-white/10 text-xs">
          <div className="p-2 rounded-xl bg-white/5 border border-white/10">
            <span className="text-[10px] text-emerald-400 font-bold">Step 1</span>
            <div className="font-bold text-white mt-0.5">Customer & Sites</div>
            <div className="text-[10px] text-slate-300">Saved in database</div>
          </div>
          <div className="p-2 rounded-xl bg-white/5 border border-white/10">
            <span className="text-[10px] text-emerald-400 font-bold">Step 2</span>
            <div className="font-bold text-white mt-0.5">Recurring Service</div>
            <div className="text-[10px] text-slate-300">Daily/Weekly/Monthly</div>
          </div>
          <div className="p-2 rounded-xl bg-white/5 border border-white/10">
            <span className="text-[10px] text-emerald-400 font-bold">Step 3</span>
            <div className="font-bold text-white mt-0.5">Auto Scheduling</div>
            <div className="text-[10px] text-slate-300">Jobs created automatically</div>
          </div>
          <div className="p-2 rounded-xl bg-white/5 border border-white/10">
            <span className="text-[10px] text-emerald-400 font-bold">Step 4</span>
            <div className="font-bold text-white mt-0.5">Technician Mobile</div>
            <div className="text-[10px] text-slate-300">GPS Map, Call & Sign</div>
          </div>
          <div className="p-2 rounded-xl bg-emerald-500/20 border border-emerald-400/30">
            <span className="text-[10px] text-emerald-300 font-bold">Step 5</span>
            <div className="font-bold text-emerald-200 mt-0.5">Next Job Auto-Created</div>
            <div className="text-[10px] text-emerald-300 font-semibold">Zero manual effort!</div>
          </div>
        </div>
      </div>

      {/* Primary KPI Counters */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        {/* Today's Jobs */}
        <div
          onClick={() => onNavigateToTab && onNavigateToTab('jobs')}
          className="bg-white p-4 rounded-2xl border border-blue-200/80 shadow-2xs hover:shadow-md hover:border-blue-400 cursor-pointer transition-all duration-200 relative overflow-hidden group"
        >
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 to-indigo-600"></div>
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black text-blue-600 uppercase tracking-wider">Today's Jobs</span>
            <div className="w-6 h-6 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <Clock className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 mt-2">{counters.today_jobs || 0}</div>
          <div className="text-[10px] text-blue-700 font-bold mt-1 bg-blue-50 px-2 py-0.5 rounded-md inline-block">Scheduled Today</div>
        </div>

        {/* Tomorrow's Jobs */}
        <div
          onClick={() => onNavigateToTab && onNavigateToTab('jobs')}
          className="bg-white p-4 rounded-2xl border border-sky-200/80 shadow-2xs hover:shadow-md hover:border-sky-400 cursor-pointer transition-all duration-200 relative overflow-hidden group"
        >
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-sky-400 to-cyan-500"></div>
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black text-sky-600 uppercase tracking-wider">Tomorrow</span>
            <div className="w-6 h-6 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center">
              <CalendarIcon className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-2xl font-black text-sky-700 mt-2">{counters.tomorrow_jobs || 0}</div>
          <div className="text-[10px] text-sky-600 font-bold mt-1 bg-sky-50 px-2 py-0.5 rounded-md inline-block">Upcoming Next</div>
        </div>

        {/* Pending Jobs */}
        <div
          onClick={() => onNavigateToTab && onNavigateToTab('jobs')}
          className="bg-white p-4 rounded-2xl border border-amber-200/80 shadow-2xs hover:shadow-md hover:border-amber-400 cursor-pointer transition-all duration-200 relative overflow-hidden group"
        >
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-400 to-orange-500"></div>
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black text-amber-600 uppercase tracking-wider">Pending</span>
            <div className="w-6 h-6 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <Clock className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-2xl font-black text-amber-600 mt-2">{counters.pending_jobs || 0}</div>
          <div className="text-[10px] text-amber-700 font-bold mt-1 bg-amber-50 px-2 py-0.5 rounded-md inline-block">Action Required</div>
        </div>

        {/* Completed Jobs */}
        <div
          onClick={() => onNavigateToTab && onNavigateToTab('reports')}
          className="bg-white p-4 rounded-2xl border border-emerald-200/80 shadow-2xs hover:shadow-md hover:border-emerald-400 cursor-pointer transition-all duration-200 relative overflow-hidden group"
        >
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 to-teal-500"></div>
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black text-emerald-600 uppercase tracking-wider">Completed</span>
            <div className="w-6 h-6 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-2xl font-black text-emerald-600 mt-2">{counters.completed_jobs || 0}</div>
          <div className="text-[10px] text-emerald-700 font-bold mt-1 bg-emerald-50 px-2 py-0.5 rounded-md inline-block">Total Successful</div>
        </div>

        {/* Overdue Jobs Alert */}
        <div
          onClick={() => onNavigateToTab && onNavigateToTab('jobs')}
          className={`p-4 rounded-2xl border transition-all duration-200 cursor-pointer relative overflow-hidden group ${
            counters.overdue_jobs > 0
              ? 'bg-rose-50/70 border-rose-300 shadow-sm shadow-rose-100 hover:border-rose-400'
              : 'bg-white border-slate-200 shadow-2xs hover:border-slate-300'
          }`}
        >
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-rose-500 to-red-600"></div>
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black text-rose-600 uppercase tracking-wider flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping"></span> Overdue
            </span>
            <div className="w-6 h-6 rounded-lg bg-rose-100 text-rose-600 flex items-center justify-center">
              <AlertTriangle className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-2xl font-black text-rose-600 mt-2">{counters.overdue_jobs || 0}</div>
          <div className="text-[10px] text-rose-700 font-bold mt-1 bg-rose-100/80 px-2 py-0.5 rounded-md inline-block">Immediate Attention</div>
        </div>

        {/* Postponed Jobs */}
        <div
          onClick={() => onNavigateToTab && onNavigateToTab('jobs')}
          className="bg-white p-4 rounded-2xl border border-violet-200/80 shadow-2xs hover:shadow-md hover:border-violet-400 cursor-pointer transition-all duration-200 relative overflow-hidden group"
        >
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-violet-500 to-purple-600"></div>
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black text-violet-600 uppercase tracking-wider">Postponed</span>
            <div className="w-6 h-6 rounded-lg bg-violet-50 text-violet-600 flex items-center justify-center">
              <Clock className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-2xl font-black text-violet-600 mt-2">{counters.postponed_jobs || 0}</div>
          <div className="text-[10px] text-violet-700 font-bold mt-1 bg-violet-50 px-2 py-0.5 rounded-md inline-block">Rescheduled</div>
        </div>

        {/* Unconfirmed Jobs */}
        <div
          onClick={() => onNavigateToTab && onNavigateToTab('jobs')}
          className="bg-white p-4 rounded-2xl border border-fuchsia-200/80 shadow-2xs hover:shadow-md hover:border-fuchsia-400 cursor-pointer transition-all duration-200 relative overflow-hidden group"
        >
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-fuchsia-500 to-pink-600"></div>
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black text-fuchsia-600 uppercase tracking-wider">Unconfirmed</span>
            <div className="w-6 h-6 rounded-lg bg-fuchsia-50 text-fuchsia-600 flex items-center justify-center">
              <Phone className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-2xl font-black text-fuchsia-600 mt-2">{counters.unconfirmed_jobs || 0}</div>
          <div className="text-[10px] text-fuchsia-700 font-bold mt-1 bg-fuchsia-50 px-2 py-0.5 rounded-md inline-block">SMS Link Sent</div>
        </div>
      </div>

      {/* Today's Operational Progress Bar */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="font-extrabold text-slate-900 text-sm sm:text-base flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
            <span>Today's Execution Progress ({selectedDate || data?.today})</span>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs font-bold">
            <span className="text-emerald-700 bg-emerald-50 px-2 py-1 rounded-lg flex items-center gap-1.5 border border-emerald-200/60">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span> Completed: {stats.completed || 0}
            </span>
            <span className="text-amber-700 bg-amber-50 px-2 py-1 rounded-lg flex items-center gap-1.5 border border-amber-200/60">
              <span className="w-2 h-2 rounded-full bg-amber-500"></span> In Progress: {stats.in_progress || 0}
            </span>
            <span className="text-slate-600 bg-slate-100 px-2 py-1 rounded-lg flex items-center gap-1.5 border border-slate-200">
              <span className="w-2 h-2 rounded-full bg-slate-400"></span> Pending: {stats.pending || 0}
            </span>
          </div>
        </div>

        {/* Multi-gradient Progress Bar */}
        <div className="w-full h-3.5 bg-slate-100 rounded-full overflow-hidden flex p-0.5 shadow-inner">
          {stats.total > 0 ? (
            <>
              <div
                style={{ width: `${((stats.completed || 0) / stats.total) * 100}%` }}
                className="bg-gradient-to-r from-emerald-500 to-teal-400 rounded-l-full transition-all duration-500 shadow-sm"
              ></div>
              <div
                style={{ width: `${((stats.in_progress || 0) / stats.total) * 100}%` }}
                className="bg-gradient-to-r from-amber-400 to-orange-400 transition-all duration-500 shadow-sm"
              ></div>
              <div
                style={{ width: `${((stats.postponed || 0) / stats.total) * 100}%` }}
                className="bg-gradient-to-r from-violet-500 to-purple-400 rounded-r-full transition-all duration-500 shadow-sm"
              ></div>
            </>
          ) : (
            <div className="w-full bg-slate-200 rounded-full"></div>
          )}
        </div>
      </div>

      {/* Today's Jobs List */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="font-bold text-slate-900 text-base sm:text-lg">Today's Jobs ({data?.today_jobs?.length || 0})</h2>
            <p className="text-xs text-slate-500 mt-0.5">Click any job to view details, assign technicians, or record completion.</p>
          </div>
          <button
            onClick={() => onNavigateToTab && onNavigateToTab('jobs')}
            className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 flex items-center gap-1"
          >
            <span>View All Jobs</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {data?.today_jobs?.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-sm">
            <Clock className="w-8 h-8 mx-auto mb-2 text-slate-300" />
            No jobs scheduled for {selectedDate || data?.today}.
            <div className="mt-3">
              <button
                onClick={handleGenerateUpcoming}
                className="text-xs px-3 py-1.5 bg-emerald-50 text-emerald-700 font-semibold rounded-lg hover:bg-emerald-100 transition"
              >
                Auto-generate from recurring schedule
              </button>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="px-4 py-3">Time</th>
                  <th className="px-4 py-3">Customer & Location</th>
                  <th className="px-4 py-3">Treatment</th>
                  <th className="px-4 py-3">Technician</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data?.today_jobs?.map(job => (
                  <tr
                    key={job.id}
                    onClick={() => onSelectJob(job.id)}
                    className="hover:bg-slate-50/80 cursor-pointer transition"
                  >
                    <td className="px-4 py-3.5 font-semibold text-slate-900 whitespace-nowrap">
                      {job.scheduled_time || '09:00'}
                      <div className="text-[10px] text-slate-400 font-normal">{job.duration_minutes || 60} mins</div>
                    </td>

                    <td className="px-4 py-3.5">
                      <div className="font-bold text-slate-900 text-sm">{job.customer_name}</div>
                      <div className="flex items-center gap-1 text-[11px] text-slate-500 mt-0.5">
                        <MapPin className="w-3 h-3 text-slate-400" />
                        <span>{job.location_name || job.location_address || 'Main Location'}</span>
                      </div>
                    </td>

                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <span
                        style={{ backgroundColor: `${job.treatment_color || '#10B981'}20`, color: job.treatment_color || '#10B981' }}
                        className="px-2.5 py-1 rounded-lg text-xs font-bold inline-block"
                      >
                        {job.treatment_code}
                      </span>
                    </td>

                    <td className="px-4 py-3.5 whitespace-nowrap text-slate-700">
                      {job.technician_name ? (
                        <div className="flex items-center gap-1.5 font-medium">
                          <User className="w-3.5 h-3.5 text-slate-400" />
                          <span>{job.technician_name}</span>
                        </div>
                      ) : (
                        <span className="text-amber-500 font-semibold italic text-[11px]">Unassigned</span>
                      )}
                    </td>

                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${
                        job.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-800' :
                        job.status === 'IN_PROGRESS' ? 'bg-amber-100 text-amber-800 animate-pulse' :
                        job.status === 'POSTPONED' ? 'bg-indigo-100 text-indigo-800' :
                        'bg-slate-100 text-slate-700'
                      }`}>
                        {job.status}
                      </span>
                    </td>

                    <td className="px-4 py-3.5 text-right whitespace-nowrap space-x-2">
                      {job.customer_phone && (
                        <a
                          href={`tel:${job.customer_phone}`}
                          onClick={(e) => e.stopPropagation()}
                          className="p-1.5 bg-slate-100 hover:bg-emerald-50 text-slate-600 hover:text-emerald-700 rounded-lg inline-flex items-center"
                          title="Call Customer"
                        >
                          <Phone className="w-3.5 h-3.5" />
                        </a>
                      )}

                      {job.status === 'TO_BE_DONE' || job.status === 'ASSIGNED' ? (
                        <button
                          onClick={(e) => handleStartJob(job.id, e)}
                          className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg text-[11px] inline-flex items-center gap-1 transition"
                        >
                          <PlayCircle className="w-3 h-3" /> Start
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
}
