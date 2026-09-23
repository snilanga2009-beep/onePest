import React, { useState, useEffect } from 'react';
import {
  Bell, Send, CheckCircle2, Clock, AlertTriangle, User,
  Calendar, Phone, MessageSquare, Zap, ExternalLink, RefreshCw,
  Smartphone, Radio, ListFilter, Check, DollarSign, Layers
} from 'lucide-react';
import {
  getRemindersQueue,
  getTechnicianRouteReminder,
  logReminderSent,
  runDailyAutomation,
  sendJobSmsReminder,
  bulkSendSmsReminders,
  getSmsLogs
} from '../api';

export default function RemindersView() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedTechRoute, setSelectedTechRoute] = useState(null);
  const [loadingRoute, setLoadingRoute] = useState(false);
  const [runningAuto, setRunningAuto] = useState(false);
  const [autoMessage, setAutoMessage] = useState(null);

  // SMS Modal State
  const [smsJobModal, setSmsJobModal] = useState(null); // { job, reminderType: '24H' | 'ARRIVAL' }
  const [sendingSms, setSendingSms] = useState(false);
  const [smsResult, setSmsResult] = useState(null);

  // Bulk SMS Modal State
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [runningBulk, setRunningBulk] = useState(false);
  const [bulkResult, setBulkResult] = useState(null);

  // Quick SMS Logs
  const [recentLogs, setRecentLogs] = useState([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  const loadQueue = async () => {
    setLoading(true);
    try {
      const [queueRes, logsRes] = await Promise.all([
        getRemindersQueue(),
        getSmsLogs({ limit: 10 })
      ]);
      setData(queueRes);
      if (logsRes.success) {
        setRecentLogs(logsRes.logs || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadQueue();
  }, []);

  const handleSendWhatsApp = async (job, phone, message) => {
    if (!phone) {
      alert('No phone number recorded for this customer.');
      return;
    }
    const cleanPhone = phone.replace(/\D/g, '');
    const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');

    try {
      await logReminderSent({
        job_id: job.id,
        channel: 'WhatsApp',
        recipient_name: job.customer_name,
        recipient_phone: phone
      });
      loadQueue();
    } catch (err) {
      console.error(err);
    }
  };

  const handleOpenSmsModal = (job, reminderType = '24H') => {
    setSmsResult(null);
    setSmsJobModal({ job, reminderType });
  };

  const handleDispatchSms = async () => {
    if (!smsJobModal) return;
    setSendingSms(true);
    setSmsResult(null);
    try {
      const res = await sendJobSmsReminder(smsJobModal.job.id, smsJobModal.reminderType);
      setSmsResult(res);
      loadQueue();
    } catch (err) {
      setSmsResult({ success: false, error: err.message });
    } finally {
      setSendingSms(false);
    }
  };

  const handleBulkSendSms = async () => {
    setRunningBulk(true);
    setBulkResult(null);
    try {
      const res = await bulkSendSmsReminders({ date: data?.tomorrow, reminder_type: '24H' });
      setBulkResult(res);
      loadQueue();
    } catch (err) {
      setBulkResult({ success: false, error: err.message });
    } finally {
      setRunningBulk(false);
    }
  };

  const handleViewTechRoute = async (techId) => {
    setLoadingRoute(true);
    try {
      const res = await getTechnicianRouteReminder(techId);
      setSelectedTechRoute(res);
    } catch (e) {
      alert(`Error loading route: ${e.message}`);
    } finally {
      setLoadingRoute(false);
    }
  };

  const handleSendTechRouteWhatsApp = (route) => {
    if (!route.whatsapp_phone) {
      alert('Technician does not have a phone number on record.');
      return;
    }
    const url = `https://wa.me/${route.whatsapp_phone}?text=${encodeURIComponent(route.whatsapp_message)}`;
    window.open(url, '_blank');
  };

  const handleTriggerAutomation = async () => {
    setRunningAuto(true);
    setAutoMessage(null);
    try {
      const res = await runDailyAutomation();
      setAutoMessage(`Auto-check complete! ${res.result.generatedJobsCount} new jobs generated, ${res.result.overdueJobsCount} overdue flagged.`);
      loadQueue();
    } catch (e) {
      setAutoMessage(`Error: ${e.message}`);
    } finally {
      setRunningAuto(false);
    }
  };

  if (loading && !data) {
    return (
      <div className="p-8 text-center text-slate-400 text-xs flex items-center justify-center gap-2">
        <RefreshCw className="w-4 h-4 animate-spin text-emerald-600" /> Loading automated reminder queue...
      </div>
    );
  }

  const counts = data?.counts || {};
  const smsSettings = data?.sms_settings || {};

  return (
    <div className="space-y-6 pb-12">

      {/* Header */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
              <Bell className="w-6 h-6 text-emerald-600" />
              <span>Automated Reminders & Dispatch Notifications</span>
            </h1>
            <span className="text-[10px] bg-blue-100 text-blue-800 font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
              <span>🇱🇰 Gateway: {smsSettings.provider || 'Notify.lk'}</span>
              <span>({smsSettings.is_simulation ? 'Simulation' : 'Live'})</span>
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            24h client service reminders, same-day arrival alerts, and technician daily route dispatch via Sri Lanka SMS Gateways & WhatsApp.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Bulk Send All SMS Button */}
          <button
            onClick={() => {
              setBulkResult(null);
              setShowBulkModal(true);
            }}
            disabled={!data?.tomorrow_jobs || data.tomorrow_jobs.length === 0}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-xs transition"
          >
            <Smartphone className="w-4 h-4" />
            <span>Bulk Send Tomorrow's SMS ({data?.tomorrow_jobs?.length || 0})</span>
          </button>

          <button
            onClick={handleTriggerAutomation}
            disabled={runningAuto}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs transition"
          >
            <Zap className={`w-4 h-4 ${runningAuto ? 'animate-spin text-amber-300' : ''}`} />
            <span>{runningAuto ? 'Checking...' : 'Trigger Auto Engine'}</span>
          </button>
        </div>
      </div>

      {autoMessage && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{autoMessage}</span>
        </div>
      )}

      {/* Queue Counter Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
          <span className="text-[10px] font-bold text-slate-400 uppercase">Tomorrow's Alerts (24h)</span>
          <div className="text-2xl font-black text-blue-600 mt-0.5">{counts.tomorrow_reminders || 0}</div>
          <span className="text-[11px] text-slate-500 mt-0.5">Upcoming services</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
          <span className="text-[10px] font-bold text-slate-400 uppercase">Today's Arrival Alerts</span>
          <div className="text-2xl font-black text-emerald-600 mt-0.5">{counts.today_reminders || 0}</div>
          <span className="text-[11px] text-slate-500 mt-0.5">Technicians on route</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
          <span className="text-[10px] font-bold text-slate-400 uppercase">Active Technicians</span>
          <div className="text-2xl font-black text-indigo-600 mt-0.5">{counts.active_technicians || 0}</div>
          <span className="text-[11px] text-slate-500 mt-0.5">Routes scheduled today</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
          <span className="text-[10px] font-bold text-rose-500 uppercase flex items-center gap-1">
            <AlertTriangle className="w-3.5 h-3.5" /> Overdue Follow-ups
          </span>
          <div className="text-2xl font-black text-rose-600 mt-0.5">{counts.overdue_followups || 0}</div>
          <span className="text-[11px] text-rose-500 mt-0.5">Needs customer contact</span>
        </div>
      </div>

      {/* Section 1: 24-Hour Upcoming Service Client Reminders */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="font-bold text-slate-900 text-sm sm:text-base flex items-center gap-2">
              <Clock className="w-4 h-4 text-blue-600" />
              <span>Upcoming Tomorrow: 24-Hour Client Reminders ({data?.tomorrow_jobs?.length || 0})</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">Scheduled for {data?.tomorrow}. Remind clients before technician departs.</p>
          </div>

          {data?.tomorrow_jobs?.length > 0 && (
            <button
              onClick={() => {
                setBulkResult(null);
                setShowBulkModal(true);
              }}
              className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold rounded-lg text-xs flex items-center gap-1.5 transition border border-blue-200"
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>Bulk Send All ({data.tomorrow_jobs.length}) via SMS</span>
            </button>
          )}
        </div>

        {data?.tomorrow_jobs?.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-xs">No jobs scheduled for tomorrow ({data?.tomorrow}).</div>
        ) : (
          <div className="divide-y divide-slate-100 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px]">
                <tr>
                  <th className="px-4 py-2.5">Time</th>
                  <th className="px-4 py-2.5">Client & Contact</th>
                  <th className="px-4 py-2.5">Location</th>
                  <th className="px-4 py-2.5">Treatment</th>
                  <th className="px-4 py-2.5">Technician</th>
                  <th className="px-4 py-2.5 text-right">Dispatch Channels</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data?.tomorrow_jobs?.map(job => (
                  <tr key={job.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-semibold text-slate-900">{job.scheduled_time || '09:00'}</td>
                    <td className="px-4 py-3">
                      <div className="font-bold text-slate-900">{job.customer_name}</div>
                      <div className="text-[11px] text-slate-500 flex flex-wrap items-center gap-1.5 mt-0.5">
                        <Phone className="w-3 h-3 text-slate-400" />
                        <span className="font-mono">{job.sms_formatted || job.customer_phone || 'No phone'}</span>
                        {job.sms_operator && (
                          <span className="text-[9px] bg-slate-100 text-slate-700 font-semibold px-1.5 py-0.2 rounded">
                            {job.sms_operator}
                          </span>
                        )}
                        {job.contact_person && <span className="text-slate-400">({job.contact_person})</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{job.location_name || 'Main Location'}</td>
                    <td className="px-4 py-3 font-bold text-emerald-700">{job.treatment_code}</td>
                    <td className="px-4 py-3 text-slate-700">{job.technician_name || 'Unassigned'}</td>
                    <td className="px-4 py-3 text-right">
                      {job.customer_phone ? (
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Send WhatsApp */}
                          <button
                            onClick={() => handleSendWhatsApp(job, job.whatsapp_phone, job.whatsapp_message)}
                            className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold rounded-lg text-xs inline-flex items-center gap-1 border border-emerald-200 transition"
                            title="Open WhatsApp chat"
                          >
                            <MessageSquare className="w-3.5 h-3.5" />
                            <span>WhatsApp</span>
                          </button>

                          {/* Send SMS via Sri Lanka Gateway */}
                          <button
                            onClick={() => handleOpenSmsModal(job, '24H')}
                            className="px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg text-xs inline-flex items-center gap-1 shadow-2xs transition"
                            title="Send SMS via Sri Lanka Gateway"
                          >
                            <Smartphone className="w-3.5 h-3.5" />
                            <span>Send SMS</span>
                          </button>
                        </div>
                      ) : (
                        <span className="text-slate-400 text-xs italic">No phone</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Section 2: Today's Arrival Alerts */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="font-bold text-slate-900 text-sm sm:text-base flex items-center gap-2">
              <Zap className="w-4 h-4 text-emerald-600" />
              <span>Today's Arrival Alerts ({data?.today_jobs?.length || 0})</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">Notify customers when specialist is heading to their premises today ({data?.today}).</p>
          </div>
        </div>

        {data?.today_jobs?.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-xs">No jobs scheduled for today ({data?.today}).</div>
        ) : (
          <div className="divide-y divide-slate-100 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px]">
                <tr>
                  <th className="px-4 py-2.5">Time</th>
                  <th className="px-4 py-2.5">Client & Contact</th>
                  <th className="px-4 py-2.5">Location</th>
                  <th className="px-4 py-2.5">Treatment</th>
                  <th className="px-4 py-2.5">Technician</th>
                  <th className="px-4 py-2.5 text-right">Dispatch Channels</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data?.today_jobs?.map(job => (
                  <tr key={job.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-semibold text-slate-900">{job.scheduled_time || '09:00'}</td>
                    <td className="px-4 py-3">
                      <div className="font-bold text-slate-900">{job.customer_name}</div>
                      <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                        <Phone className="w-3 h-3 text-slate-400" />
                        <span className="font-mono">{job.sms_formatted || job.customer_phone || 'No phone'}</span>
                        {job.sms_operator && (
                          <span className="text-[9px] bg-slate-100 text-slate-700 font-semibold px-1.5 py-0.2 rounded">
                            {job.sms_operator}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{job.location_name || 'Main Location'}</td>
                    <td className="px-4 py-3 font-bold text-emerald-700">{job.treatment_code}</td>
                    <td className="px-4 py-3 text-slate-700">{job.technician_name || 'Unassigned'}</td>
                    <td className="px-4 py-3 text-right">
                      {job.customer_phone ? (
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleSendWhatsApp(job, job.whatsapp_phone, job.whatsapp_message)}
                            className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold rounded-lg text-xs inline-flex items-center gap-1 border border-emerald-200 transition"
                          >
                            <MessageSquare className="w-3.5 h-3.5" />
                            <span>WhatsApp</span>
                          </button>
                          <button
                            onClick={() => handleOpenSmsModal(job, 'ARRIVAL')}
                            className="px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg text-xs inline-flex items-center gap-1 shadow-2xs transition"
                          >
                            <Smartphone className="w-3.5 h-3.5" />
                            <span>Send Arrival SMS</span>
                          </button>
                        </div>
                      ) : (
                        <span className="text-slate-400 text-xs italic">No phone</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Section 3: Technician Daily Route Reminders */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="font-bold text-slate-900 text-sm sm:text-base flex items-center gap-2">
              <User className="w-4 h-4 text-indigo-600" />
              <span>Technician Morning Route Dispatch ({data?.technicians_routes?.length || 0})</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">Send each technician their complete stop list, client phone numbers, and navigation details.</p>
          </div>
        </div>

        {data?.technicians_routes?.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-xs">No active technician routes today.</div>
        ) : (
          <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {data?.technicians_routes?.map(tech => (
              <div key={tech.id} className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="font-bold text-slate-900 text-sm">{tech.full_name}</div>
                  <span className="text-[10px] font-bold bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded-full">
                    {tech.total_jobs} job(s) today
                  </span>
                </div>
                <div className="text-xs text-slate-500 flex items-center gap-1">
                  <Phone className="w-3.5 h-3.5 text-slate-400" />
                  <span className="font-mono">{tech.phone || 'No phone'}</span>
                </div>

                <button
                  onClick={() => handleViewTechRoute(tech.id)}
                  className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg text-xs flex items-center justify-center gap-1.5 shadow-2xs transition"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>Send Route via WhatsApp</span>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Section 4: Recent SMS Delivery History Quick Audit */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-bold text-slate-900 text-sm sm:text-base flex items-center gap-2">
            <Radio className="w-4 h-4 text-emerald-600" />
            <span>Recent Sri Lanka SMS Activity ({recentLogs.length})</span>
          </h3>
          <button
            onClick={() => loadQueue()}
            className="text-xs text-slate-500 hover:text-slate-800 flex items-center gap-1"
          >
            <RefreshCw className="w-3 h-3" /> Refresh
          </button>
        </div>

        {recentLogs.length === 0 ? (
          <div className="p-6 text-center text-slate-400 text-xs">No SMS dispatched yet today.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px]">
                <tr>
                  <th className="px-4 py-2">Time</th>
                  <th className="px-4 py-2">Customer & Mobile</th>
                  <th className="px-4 py-2">Job Ref</th>
                  <th className="px-4 py-2">Provider</th>
                  <th className="px-4 py-2">Message</th>
                  <th className="px-4 py-2 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {recentLogs.map((l) => (
                  <tr key={l.id} className="hover:bg-slate-50">
                    <td className="px-4 py-2.5 text-slate-500 font-mono text-[11px] whitespace-nowrap">{l.created_at}</td>
                    <td className="px-4 py-2.5 font-bold text-slate-900">
                      <div>{l.recipient_name || 'Customer'}</div>
                      <div className="text-[10px] text-slate-400 font-mono">{l.phone}</div>
                    </td>
                    <td className="px-4 py-2.5 font-mono text-slate-700">{l.job_code || '—'}</td>
                    <td className="px-4 py-2.5 text-slate-600 font-semibold">{l.gateway}</td>
                    <td className="px-4 py-2.5 text-slate-600 max-w-xs truncate">{l.message}</td>
                    <td className="px-4 py-2.5 text-right font-bold">
                      {l.status === 'SENT' && <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full text-[10px]">● Sent</span>}
                      {l.status === 'SIMULATED' && <span className="text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full text-[10px]">● Simulated</span>}
                      {l.status === 'FAILED' && <span className="text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full text-[10px]">● Failed</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* SINGLE JOB SMS DISPATCH MODAL */}
      {smsJobModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-bold text-slate-900 text-base flex items-center gap-1.5">
                  <Smartphone className="w-4 h-4 text-blue-600" />
                  <span>Dispatch SMS via {smsSettings.provider || 'Gateway'}</span>
                </h3>
                <span className="text-[10px] text-slate-500">
                  {smsSettings.is_simulation ? 'Simulation Mode Active' : 'Live Carrier Mode'}
                </span>
              </div>
              <button onClick={() => setSmsJobModal(null)} className="text-slate-400 hover:text-slate-700">✕</button>
            </div>

            <div className="text-xs space-y-3">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                <div className="flex justify-between font-bold text-slate-800">
                  <span>Recipient:</span>
                  <span>{smsJobModal.job.customer_name}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Mobile:</span>
                  <span className="font-mono font-bold text-blue-700">
                    {smsJobModal.job.sms_formatted || smsJobModal.job.customer_phone}
                  </span>
                </div>
                {smsJobModal.job.sms_operator && (
                  <div className="flex justify-between text-slate-500">
                    <span>Operator:</span>
                    <span>{smsJobModal.job.sms_operator}</span>
                  </div>
                )}
                <div className="flex justify-between text-slate-500">
                  <span>Job Code:</span>
                  <span className="font-mono font-bold">{smsJobModal.job.job_code}</span>
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Message Preview:</label>
                <div className="p-3 bg-blue-50/50 rounded-xl border border-blue-200 text-slate-800 font-sans text-xs leading-relaxed">
                  {smsJobModal.reminderType === 'ARRIVAL'
                    ? smsJobModal.job.sms_message || 'Technician arriving today...'
                    : smsJobModal.job.sms_message}
                </div>
                <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                  <span>Est. Cost: <strong>Rs. 0.35 LKR</strong></span>
                  <span>Char count: {(smsJobModal.job.sms_message || '').length}</span>
                </div>
              </div>
            </div>

            {smsResult && (
              <div className={`p-3 rounded-xl text-xs border ${
                smsResult.success ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-rose-50 border-rose-200 text-rose-800'
              }`}>
                <div className="font-bold flex items-center gap-1">
                  {smsResult.success ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <AlertTriangle className="w-4 h-4 text-rose-600" />}
                  <span>{smsResult.message || smsResult.error}</span>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                onClick={() => setSmsJobModal(null)}
                className="px-4 py-2 font-semibold text-slate-600 text-xs"
              >
                Close
              </button>
              <button
                onClick={handleDispatchSms}
                disabled={sendingSms}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-xs transition"
              >
                <Send className={`w-3.5 h-3.5 ${sendingSms ? 'animate-spin' : ''}`} />
                <span>{sendingSms ? 'Sending SMS...' : `Dispatch via ${smsSettings.provider || 'Gateway'}`}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* BULK SEND ALL SMS MODAL */}
      {showBulkModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-bold text-slate-900 text-base flex items-center gap-1.5">
                  <Smartphone className="w-4 h-4 text-blue-600" />
                  <span>Bulk 24-Hour SMS Dispatch</span>
                </h3>
                <span className="text-[10px] text-slate-500">
                  Target Date: <strong>{data?.tomorrow}</strong>
                </span>
              </div>
              <button onClick={() => setShowBulkModal(false)} className="text-slate-400 hover:text-slate-700">✕</button>
            </div>

            <div className="text-xs space-y-3">
              <div className="p-3 bg-blue-50 rounded-xl border border-blue-200 text-blue-900 space-y-1">
                <div className="font-bold flex items-center gap-1">
                  <Layers className="w-4 h-4 text-blue-600" />
                  <span>{data?.tomorrow_jobs?.length || 0} Clients Scheduled for Tomorrow</span>
                </div>
                <p className="text-[11px] text-blue-700">
                  This will dispatch 24h appointment reminders via Sri Lanka SMS Gateway ({smsSettings.provider || 'Gateway'}).
                </p>
              </div>

              <div className="max-h-48 overflow-y-auto divide-y divide-slate-100 border border-slate-200 rounded-xl">
                {data?.tomorrow_jobs?.map((j, idx) => (
                  <div key={j.id} className="p-2.5 flex items-center justify-between text-xs">
                    <div>
                      <span className="font-bold text-slate-800">{idx + 1}. {j.customer_name}</span>
                      <span className="text-slate-400 text-[10px] block font-mono">{j.sms_formatted || j.customer_phone || 'No phone'}</span>
                    </div>
                    <span className="text-[10px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-mono font-bold">
                      {j.treatment_code} @ {j.scheduled_time || '09:00'}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {bulkResult && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl text-xs space-y-1">
                <div className="font-bold flex items-center gap-1">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>{bulkResult.message}</span>
                </div>
                {bulkResult.summary && (
                  <div className="text-[11px] text-emerald-700 font-mono mt-1">
                    Total: {bulkResult.summary.total} | Sent: {bulkResult.summary.sent} | Simulated: {bulkResult.summary.simulated} | Failed: {bulkResult.summary.failed}
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                onClick={() => setShowBulkModal(false)}
                className="px-4 py-2 font-semibold text-slate-600 text-xs"
              >
                Close
              </button>
              <button
                onClick={handleBulkSendSms}
                disabled={runningBulk}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-xs transition"
              >
                <Send className={`w-3.5 h-3.5 ${runningBulk ? 'animate-spin' : ''}`} />
                <span>{runningBulk ? 'Dispatching SMS in Bulk...' : 'Confirm & Dispatch All SMS'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Technician Route Modal Preview */}
      {selectedTechRoute && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="font-bold text-slate-900 text-base">Route Dispatch: {selectedTechRoute.technician?.full_name}</h2>
              <button onClick={() => setSelectedTechRoute(null)} className="text-slate-400 hover:text-slate-700">✕</button>
            </div>

            <div className="text-xs space-y-2">
              <div className="font-semibold text-slate-600">WhatsApp Message Preview:</div>
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 font-mono text-[11px] whitespace-pre-line text-slate-800 max-h-60 overflow-y-auto">
                {selectedTechRoute.whatsapp_message}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => setSelectedTechRoute(null)}
                className="px-4 py-2 font-semibold text-slate-600 text-xs"
              >
                Cancel
              </button>
              <button
                onClick={() => handleSendTechRouteWhatsApp(selectedTechRoute)}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-xs"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Open in WhatsApp</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
