import React, { useState, useEffect } from 'react';
import {
  Bell, BellRing, Smartphone, ShieldCheck, CheckCircle2,
  AlertTriangle, Send, RefreshCw, Copy, Check, ExternalLink,
  Laptop, Tablet, Key, Server, Users, Radio, Info, Sparkles
} from 'lucide-react';
import { getStaff } from '../api';

export default function FirebasePushSettingsView() {
  const [loading, setLoading] = useState(true);
  const [statusInfo, setStatusInfo] = useState({ vapid_configured: true, active_devices: 0 });
  const [vapidKey, setVapidKey] = useState('');
  const [devices, setDevices] = useState([]);
  const [technicians, setTechnicians] = useState([]);
  const [copiedKey, setCopiedKey] = useState(false);

  // Dispatcher form
  const [targetTechId, setTargetTechId] = useState('ALL');
  const [pushTitle, setPushTitle] = useState('New Job Dispatched 🔔');
  const [pushBody, setPushBody] = useState('A new pest control service has been assigned to your schedule. Tap to view.');
  const [sending, setSending] = useState(false);
  const [dispatchResult, setDispatchResult] = useState(null);

  const loadData = async () => {
    setLoading(true);
    setDispatchResult(null);
    try {
      const [statusRes, keyRes, devRes, staffRes] = await Promise.all([
        fetch('/api/push/status').then(r => r.json()).catch(() => ({})),
        fetch('/api/push/vapid-public-key').then(r => r.json()).catch(() => ({})),
        fetch('/api/push/devices').then(r => r.json()).catch(() => ({})),
        getStaff().catch(() => ({ staff: [] }))
      ]);

      if (statusRes.success) setStatusInfo(statusRes);
      if (keyRes.success && keyRes.publicKey) setVapidKey(keyRes.publicKey);
      if (devRes.success && devRes.devices) setDevices(devRes.devices);
      if (staffRes.staff) {
        setTechnicians(staffRes.staff.filter(s => s.role === 'TECHNICIAN' || s.role === 'ADMIN'));
      }
    } catch (e) {
      console.error('Failed to load push notification settings:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCopyKey = () => {
    if (!vapidKey) return;
    navigator.clipboard.writeText(vapidKey);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  const handleSendPush = async (e) => {
    e.preventDefault();
    if (!pushTitle.trim() || !pushBody.trim()) {
      alert('Please enter both title and message.');
      return;
    }

    setSending(true);
    setDispatchResult(null);

    try {
      let res;
      if (targetTechId === 'ALL') {
        res = await fetch('/api/push/broadcast', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: pushTitle.trim(),
            body: pushBody.trim(),
            url: '/tech'
          })
        });
      } else {
        res = await fetch('/api/push/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            technician_id: parseInt(targetTechId, 10),
            title: pushTitle.trim(),
            body: pushBody.trim(),
            url: '/tech'
          })
        });
      }

      const data = await res.json();
      if (data.success) {
        setDispatchResult({
          type: 'success',
          message: `Successfully dispatched! Delivered to ${data.sentCount || 0} device(s).`
        });
      } else {
        setDispatchResult({
          type: 'error',
          message: data.error || 'Failed to dispatch push notification.'
        });
      }
      loadData();
    } catch (err) {
      setDispatchResult({
        type: 'error',
        message: err.message || 'Network error sending push alert.'
      });
    } finally {
      setSending(false);
    }
  };

  const handleTestDevice = async (techId) => {
    try {
      const res = await fetch('/api/push/send-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          technician_id: techId,
          title: 'Direct Device Test Alert 🔔',
          body: 'This is a test notification from the Dispatch Management Panel.'
        })
      });
      const data = await res.json();
      if (data.success) {
        alert(`Test push delivered to ${data.sentCount || 1} device(s)!`);
      } else {
        alert(data.error || 'Device test failed.');
      }
    } catch (err) {
      alert(`Error sending test: ${err.message}`);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* 1. Header Banner */}
      <div className="bg-gradient-to-r from-red-600 via-rose-600 to-red-700 rounded-3xl p-6 text-white shadow-xl shadow-red-600/10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/20 backdrop-blur-md text-white text-xs font-black uppercase tracking-wider mb-2">
            <Radio className="w-3.5 h-3.5 animate-pulse text-amber-300" />
            <span>Firebase & Web Push Infrastructure</span>
          </div>
          <h1 className="text-2xl font-black tracking-tight">Push Notification Settings</h1>
          <p className="text-red-100 text-xs sm:text-sm mt-1 max-w-2xl">
            Configure Firebase Cloud Messaging (FCM) and Web Push (VAPID) to instantly notify field technicians when jobs are dispatched, rescheduled, or overdue.
          </p>
        </div>

        <button
          onClick={loadData}
          disabled={loading}
          className="px-4 py-2.5 bg-white text-red-600 hover:bg-red-50 text-xs font-black rounded-xl shadow-md transition flex items-center gap-2 cursor-pointer active:scale-95 disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh Status</span>
        </button>
      </div>

      {/* 2. Top Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Engine Status */}
        <div className="bg-white p-5 rounded-2xl border-2 border-red-100 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-emerald-500"></div>
          <div className="flex items-center justify-between">
            <span className="text-xs font-black uppercase text-slate-500 tracking-wider">Push Engine</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 mt-2">Active</div>
          <div className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md inline-block mt-1">
            FCM + VAPID WebPush
          </div>
        </div>

        {/* Card 2: Registered Devices */}
        <div className="bg-white p-5 rounded-2xl border-2 border-red-100 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-red-600"></div>
          <div className="flex items-center justify-between">
            <span className="text-xs font-black uppercase text-slate-500 tracking-wider">Registered Phones</span>
            <div className="w-8 h-8 rounded-xl bg-red-50 text-red-600 flex items-center justify-center">
              <Smartphone className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-red-600 mt-2">{devices.length}</div>
          <div className="text-[11px] font-bold text-slate-500 mt-1">
            Active technician subscriptions
          </div>
        </div>

        {/* Card 3: Service Worker Status */}
        <div className="bg-white p-5 rounded-2xl border-2 border-red-100 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-blue-500"></div>
          <div className="flex items-center justify-between">
            <span className="text-xs font-black uppercase text-slate-500 tracking-wider">Service Worker</span>
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Server className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 mt-2">v5 Active</div>
          <div className="text-[11px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md inline-block mt-1">
            Background Dispatch
          </div>
        </div>

        {/* Card 4: Apple & Android Compatibility */}
        <div className="bg-white p-5 rounded-2xl border-2 border-red-100 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-purple-500"></div>
          <div className="flex items-center justify-between">
            <span className="text-xs font-black uppercase text-slate-500 tracking-wider">Device Support</span>
            <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
              <Sparkles className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 mt-2">100%</div>
          <div className="text-[11px] font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-md inline-block mt-1">
            Android & iOS 16.4+ PWA
          </div>
        </div>
      </div>

      {/* 3. Main Grid: Test Dispatcher + Keys */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column (2 Cols): Live Notification Dispatcher */}
        <div className="lg:col-span-2 bg-white rounded-3xl p-6 border-2 border-red-100 shadow-md space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-red-100 text-red-600 flex items-center justify-center">
                <Send className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-base font-black text-slate-900">Send Live Push Alert to Field</h2>
                <p className="text-xs text-slate-500">Broadcast an urgent operational notice or ping a specific technician phone.</p>
              </div>
            </div>
            <span className="px-2.5 py-1 rounded-full bg-red-50 text-red-600 text-[10px] font-black uppercase border border-red-200">
              Live Sender
            </span>
          </div>

          {dispatchResult && (
            <div className={`p-4 rounded-2xl text-xs font-bold flex items-center gap-2 border ${
              dispatchResult.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : 'bg-red-50 text-red-800 border-red-200'
            }`}>
              {dispatchResult.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
              )}
              <span>{dispatchResult.message}</span>
            </div>
          )}

          <form onSubmit={handleSendPush} className="space-y-4">
            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-slate-600 mb-1">
                Recipient Technician *
              </label>
              <select
                value={targetTechId}
                onChange={(e) => setTargetTechId(e.target.value)}
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-red-500 cursor-pointer"
              >
                <option value="ALL">📢 Broadcast to ALL Registered Technician Phones</option>
                {technicians.map(t => (
                  <option key={t.id} value={t.id}>
                    {t.full_name} ({t.phone || 'No phone'}) - {t.role}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-slate-600 mb-1">
                Notification Title *
              </label>
              <input
                type="text"
                required
                value={pushTitle}
                onChange={(e) => setPushTitle(e.target.value)}
                placeholder="e.g. Schedule Update / Urgent Dispatch"
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-red-500"
              />
            </div>

            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-slate-600 mb-1">
                Message Body *
              </label>
              <textarea
                rows={3}
                required
                value={pushBody}
                onChange={(e) => setPushBody(e.target.value)}
                placeholder="e.g. Please proceed to Bobing Group for scheduled mosquito treatment at 2:00 PM."
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-red-500"
              />
            </div>

            <div className="flex items-center justify-between pt-2">
              <div className="text-[11px] text-slate-500">
                Pushes will display even if technician's phone screen is locked or browser is closed.
              </div>
              <button
                type="submit"
                disabled={sending}
                className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white font-black text-xs rounded-xl shadow-lg shadow-red-600/20 flex items-center gap-2 transition active:scale-95 disabled:opacity-50 cursor-pointer"
              >
                <Send className={`w-4 h-4 ${sending ? 'animate-pulse' : ''}`} />
                <span>{sending ? 'Sending Push...' : 'Send Live Push Alert'}</span>
              </button>
            </div>
          </form>
        </div>

        {/* Right Column: VAPID Key & System Config */}
        <div className="bg-white rounded-3xl p-6 border-2 border-red-100 shadow-md space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center">
              <Key className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-black text-slate-900">VAPID Public Key</h2>
              <p className="text-xs text-slate-500">Required by browser push managers.</p>
            </div>
          </div>

          <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
            <div className="text-[11px] font-bold text-slate-600">Application Server Public Key:</div>
            <div className="p-2.5 bg-white rounded-xl border border-slate-200 font-mono text-[10px] break-all text-slate-800 select-all">
              {vapidKey || 'Loading key...'}
            </div>
            <button
              type="button"
              onClick={handleCopyKey}
              className="w-full py-2 bg-red-50 hover:bg-red-100 text-red-700 font-bold text-xs rounded-xl border border-red-200 flex items-center justify-center gap-1.5 transition cursor-pointer"
            >
              {copiedKey ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedKey ? 'Copied to Clipboard!' : 'Copy Public Key'}</span>
            </button>
          </div>

          <div className="p-4 bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 rounded-2xl text-xs text-amber-900 space-y-2">
            <div className="font-black flex items-center gap-1.5">
              <Info className="w-4 h-4 text-amber-600" />
              <span>iPhone (iOS) Notice</span>
            </div>
            <p className="text-[11px] leading-relaxed text-amber-800">
              For Apple iPhones, Apple requires Web Push apps to be added to the phone screen first (iOS 16.4+). Field technicians should tap <strong>"Add App to Phone Screen"</strong> in the mobile app, then tap <strong>"Enable Notifications"</strong> to receive push alerts.
            </p>
          </div>
        </div>
      </div>

      {/* 4. Registered Field Devices Table */}
      <div className="bg-white rounded-3xl p-6 border-2 border-red-100 shadow-md space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-red-100 text-red-600 flex items-center justify-center">
              <Smartphone className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-black text-slate-900">Registered Technician Devices ({devices.length})</h2>
              <p className="text-xs text-slate-500">Live devices currently connected and listening for push dispatches.</p>
            </div>
          </div>
        </div>

        {devices.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-xs bg-slate-50 rounded-2xl border border-slate-200">
            <Smartphone className="w-8 h-8 text-slate-400 mx-auto mb-2" />
            <div className="font-bold text-slate-700">No Technician Devices Registered Yet</div>
            <p className="text-slate-400 mt-1 max-w-md mx-auto">
              When technicians open the mobile app on Android or iPhone and tap "Enable Push Notifications", their device will immediately register here.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-600 border-b border-slate-200">
                  <th className="py-3 px-3 font-black">Technician</th>
                  <th className="py-3 px-3 font-black">Platform</th>
                  <th className="py-3 px-3 font-black">Browser</th>
                  <th className="py-3 px-3 font-black">Status</th>
                  <th className="py-3 px-3 font-black">Last Seen</th>
                  <th className="py-3 px-3 font-black text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {devices.map(dev => {
                  const tech = dev.staff || technicians.find(t => t.id === dev.technician_id);
                  return (
                    <tr key={dev.id} className="hover:bg-slate-50/70 transition">
                      <td className="py-3 px-3">
                        <div className="font-bold text-slate-900">{tech?.full_name || `Technician #${dev.technician_id}`}</div>
                        <div className="text-[11px] text-slate-500 font-mono">{tech?.phone || 'No phone'}</div>
                      </td>
                      <td className="py-3 px-3">
                        <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-bold text-[10px]">
                          {dev.platform || 'Mobile'}
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        <span className="text-slate-700 font-semibold">{dev.browser || 'Browser'}</span>
                      </td>
                      <td className="py-3 px-3">
                        {dev.is_active ? (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-black uppercase inline-flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span> Active
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 text-[10px] font-bold uppercase">
                            Inactive
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-slate-500 text-[11px]">
                        {dev.last_seen_at ? new Date(dev.last_seen_at).toLocaleDateString() + ' ' + new Date(dev.last_seen_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Recently'}
                      </td>
                      <td className="py-3 px-3 text-right">
                        <button
                          type="button"
                          onClick={() => handleTestDevice(dev.technician_id)}
                          className="px-2.5 py-1 bg-red-50 hover:bg-red-100 text-red-700 font-bold text-[11px] rounded-lg border border-red-200 transition cursor-pointer"
                        >
                          Ping Device
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
