import React, { useState, useEffect } from 'react';
import {
  User, Phone, Bell, BellRing, BellOff, Smartphone, ShieldCheck,
  Wifi, WifiOff, RefreshCw, LogOut, CheckCircle2, AlertCircle,
  HardHat, ExternalLink, Laptop, Tablet, Check, ArrowRight
} from 'lucide-react';
import {
  getPersistentTechSession,
  clearPersistentTechSession,
  getPendingMutations
} from '../services/offlineStorage';
import {
  getPushSubscriptionStatus,
  subscribeToPush,
  triggerTestPush
} from '../services/pushManager';
import { triggerSync, onSyncStatusChange } from '../services/syncEngine';
import TechLoginModal from '../components/TechLoginModal';

export default function TechnicianProfileView({ onNavigate, currentUser, onLogout }) {
  const [techSession, setTechSession] = useState(null);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);

  // Push notification state
  const [pushStatus, setPushStatus] = useState({ supported: true, permission: 'default', isSubscribed: false });
  const [enablingPush, setEnablingPush] = useState(false);
  const [sendingTestPush, setSendingTestPush] = useState(false);
  const [testPushFeedback, setTestPushFeedback] = useState(null);
  const [devices, setDevices] = useState([]);
  const [loadingDevices, setLoadingDevices] = useState(false);

  // Sync state
  const [syncStatus, setSyncStatus] = useState({ status: 'synced', pendingCount: 0 });
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncFeedback, setSyncFeedback] = useState(null);

  // Standalone PWA check
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    // 1. Check standalone mode
    const standalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
    setIsStandalone(standalone);

    // 2. Load tech persistent session
    getPersistentTechSession().then(session => {
      setTechSession(session);
      if (session?.id) {
        loadRegisteredDevices(session.id);
      }
    });

    // 3. Check push subscription status
    checkPush();

    // 4. Online/offline listener
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // 5. Sync status listener
    getPendingMutations().then(mutations => {
      setSyncStatus({
        status: mutations.length === 0 ? 'synced' : 'pending',
        pendingCount: mutations.length
      });
    });

    const unsubscribeSync = onSyncStatusChange((state) => {
      setSyncStatus(state);
    });

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      unsubscribeSync();
    };
  }, []);

  const checkPush = async () => {
    try {
      const status = await getPushSubscriptionStatus();
      setPushStatus(status);
    } catch (e) {
      console.error('Error checking push status:', e);
    }
  };

  const loadRegisteredDevices = async (techId) => {
    if (!techId) return;
    setLoadingDevices(true);
    try {
      const res = await fetch(`/api/push/devices/${techId}`);
      const data = await res.json();
      if (data.success) {
        setDevices(data.devices || []);
      }
    } catch (e) {
      console.error('Failed to load registered devices:', e);
    } finally {
      setLoadingDevices(false);
    }
  };

  const handleEnablePush = async () => {
    if (!techSession?.id) {
      setShowLoginModal(true);
      return;
    }
    setEnablingPush(true);
    setTestPushFeedback(null);
    try {
      await subscribeToPush(techSession.id);
      await checkPush();
      await loadRegisteredDevices(techSession.id);
      setTestPushFeedback({ type: 'success', message: 'Web push notifications enabled successfully!' });
    } catch (err) {
      setTestPushFeedback({ type: 'error', message: err.message || 'Failed to subscribe to push notifications.' });
    } finally {
      setEnablingPush(false);
    }
  };

  const handleSendTestPush = async () => {
    if (!techSession?.id) return;
    setSendingTestPush(true);
    setTestPushFeedback(null);
    try {
      const res = await triggerTestPush(techSession.id);
      if (res.success) {
        setTestPushFeedback({
          type: 'success',
          message: `Push delivered to ${res.sentCount || 1} active device(s)! Check your device notification tray.`
        });
      } else {
        setTestPushFeedback({
          type: 'error',
          message: res.error || 'Failed to send test push notification.'
        });
      }
    } catch (err) {
      setTestPushFeedback({
        type: 'error',
        message: err.message || 'Push dispatch failed.'
      });
    } finally {
      setSendingTestPush(false);
    }
  };

  const handleManualSync = async () => {
    setIsSyncing(true);
    setSyncFeedback(null);
    try {
      const res = await triggerSync();
      if (res.success) {
        setSyncFeedback({
          type: 'success',
          message: res.syncedCount > 0 ? `Successfully synchronized ${res.syncedCount} queued action(s)!` : 'All local changes are already up to date.'
        });
      } else {
        setSyncFeedback({
          type: 'error',
          message: res.error || 'Sync encountered errors.'
        });
      }
    } catch (err) {
      setSyncFeedback({
        type: 'error',
        message: err.message || 'Sync failed.'
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleLogout = async () => {
    if (window.confirm('Are you sure you want to sign out from this device?')) {
      await clearPersistentTechSession();
      localStorage.removeItem('auth_token');
      localStorage.removeItem('auth_user');
      localStorage.removeItem('tech_preferred_id');
      sessionStorage.removeItem('auth_token');
      sessionStorage.removeItem('auth_user');
      setTechSession(null);
      if (onLogout) {
        onLogout();
      } else {
        window.location.reload();
      }
    }
  };

  const handleLoginSuccess = (session) => {
    setTechSession(session);
    setShowLoginModal(false);
    loadRegisteredDevices(session.id);
    checkPush();
  };

  return (
    <div className="max-w-md mx-auto min-h-screen bg-slate-100 pb-28 font-sans">
      {/* Top Header */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-emerald-950 text-white p-5 sticky top-0 z-30 shadow-lg border-b border-indigo-900/40">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center font-black text-lg text-slate-950 shadow-md shadow-emerald-950/50">
              {techSession?.full_name ? techSession.full_name.substring(0, 2).toUpperCase() : 'TC'}
            </div>
            <div>
              <h1 className="font-black text-base tracking-tight leading-tight">
                {techSession?.full_name || 'Technician Account'}
              </h1>
              <div className="text-xs text-emerald-400 font-semibold flex items-center gap-1.5 mt-0.5">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Verified Field Technician</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
              isOnline ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
            }`}>
              {isOnline ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
              {isOnline ? 'Online' : 'Offline'}
            </span>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-4">

        {/* 1-Time Permanent Session Card */}
        <div className="bg-white rounded-2xl p-4 shadow-xs border border-slate-200">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Phone className="w-4 h-4 text-emerald-600" />
              <h2 className="font-black text-slate-800 text-sm">1-Time Phone Sign-In</h2>
            </div>
            <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-black uppercase">
              Permanent Session
            </span>
          </div>

          <div className="mt-3 space-y-2 text-xs">
            <div className="flex justify-between py-1 border-b border-slate-50">
              <span className="text-slate-500">Technician Name:</span>
              <span className="font-bold text-slate-800">{techSession?.full_name || 'Not logged in'}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-50">
              <span className="text-slate-500">Mobile Phone:</span>
              <span className="font-bold text-slate-800">{techSession?.phone || '—'}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-50">
              <span className="text-slate-500">Session Status:</span>
              <span className="font-bold text-emerald-600 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                No daily password required
              </span>
            </div>
          </div>

          <div className="mt-4 flex gap-2">
            {!techSession ? (
              <button
                type="button"
                onClick={() => setShowLoginModal(true)}
                className="w-full py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs transition"
              >
                <Phone className="w-4 h-4" />
                Sign In with Mobile Number
              </button>
            ) : (
              <button
                type="button"
                onClick={handleLogout}
                className="w-full py-2 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center justify-center gap-1.5 transition"
              >
                <LogOut className="w-3.5 h-3.5 text-slate-500" />
                Switch Account / Sign Out
              </button>
            )}
          </div>
        </div>

        {/* Real Web Push Notifications Card */}
        <div className="bg-white rounded-2xl p-4 shadow-xs border border-slate-200">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-indigo-600" />
              <h2 className="font-black text-slate-800 text-sm">Real Web Push Notifications</h2>
            </div>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
              pushStatus.permission === 'granted'
                ? 'bg-indigo-100 text-indigo-800'
                : 'bg-amber-100 text-amber-800'
            }`}>
              {pushStatus.permission === 'granted' ? 'Enabled ✓' : 'Permission Needed'}
            </span>
          </div>

          <p className="mt-2.5 text-xs text-slate-600 leading-relaxed">
            Real W3C Web Push using VAPID keys. Delivers alerts directly to your phone when jobs are assigned, rescheduled, or postponed even when the app is closed.
          </p>

          {/* Test Push Feedback Alert */}
          {testPushFeedback && (
            <div className={`mt-3 p-3 rounded-xl text-xs flex items-start gap-2 ${
              testPushFeedback.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                : 'bg-rose-50 text-rose-800 border border-rose-200'
            }`}>
              {testPushFeedback.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              )}
              <div className="flex-1 leading-snug">{testPushFeedback.message}</div>
            </div>
          )}

          <div className="mt-4 space-y-2">
            {pushStatus.permission !== 'granted' ? (
              <button
                type="button"
                onClick={handleEnablePush}
                disabled={enablingPush}
                className="w-full py-2.5 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-black text-xs flex items-center justify-center gap-2 shadow-sm transition cursor-pointer"
              >
                <BellRing className={`w-4 h-4 ${enablingPush ? 'animate-bounce' : ''}`} />
                {enablingPush ? 'Activating Web Push...' : 'ENABLE NOTIFICATIONS'}
              </button>
            ) : (
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={handleSendTestPush}
                  disabled={sendingTestPush}
                  className="w-full py-2.5 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-xs transition cursor-pointer"
                >
                  <BellRing className={`w-4 h-4 text-emerald-400 ${sendingTestPush ? 'animate-spin' : ''}`} />
                  {sendingTestPush ? 'Delivering Web Push...' : 'Send Test Push Notification to My Phone'}
                </button>
                <button
                  type="button"
                  onClick={handleEnablePush}
                  disabled={enablingPush}
                  className="w-full py-1.5 px-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 font-semibold text-[11px] flex items-center justify-center gap-1 transition"
                >
                  <RefreshCw className="w-3 h-3 text-slate-500" />
                  Re-register This Device Token
                </button>
              </div>
            )}
          </div>

          {/* Registered Multi-Device Registry */}
          <div className="mt-4 pt-3 border-t border-slate-100">
            <div className="flex items-center justify-between text-xs font-bold text-slate-700 mb-2">
              <span>Registered Push Devices ({devices.length})</span>
              <button
                type="button"
                onClick={() => techSession?.id && loadRegisteredDevices(techSession.id)}
                className="text-[10px] text-indigo-600 hover:underline flex items-center gap-0.5"
              >
                <RefreshCw className={`w-2.5 h-2.5 ${loadingDevices ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>

            {devices.length === 0 ? (
              <p className="text-[11px] text-slate-400 italic">No devices registered yet for this technician.</p>
            ) : (
              <div className="space-y-1.5">
                {devices.map((dev) => (
                  <div key={dev.id} className="p-2 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      {dev.platform === 'iOS' || dev.platform === 'Android' ? (
                        <Smartphone className="w-4 h-4 text-slate-500" />
                      ) : (
                        <Laptop className="w-4 h-4 text-slate-500" />
                      )}
                      <div>
                        <div className="font-bold text-slate-800 text-[11px]">
                          {dev.platform} &bull; {dev.browser}
                        </div>
                        <div className="text-[9px] text-slate-400 font-mono">
                          ID: {dev.device_id.substring(0, 14)}...
                        </div>
                      </div>
                    </div>
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-sm bg-emerald-100 text-emerald-800">
                      ACTIVE
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Offline Engine & Local Cache Card */}
        <div className="bg-white rounded-2xl p-4 shadow-xs border border-slate-200">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <RefreshCw className="w-4 h-4 text-emerald-600" />
              <h2 className="font-black text-slate-800 text-sm">Offline Storage & Sync Engine</h2>
            </div>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
              syncStatus.pendingCount === 0
                ? 'bg-emerald-100 text-emerald-800'
                : 'bg-amber-100 text-amber-800'
            }`}>
              {syncStatus.pendingCount === 0 ? 'SYNCED ✓' : `WAITING FOR SYNC (${syncStatus.pendingCount})`}
            </span>
          </div>

          <p className="mt-2.5 text-xs text-slate-600 leading-relaxed">
            All jobs, signatures, customer notes, job start timestamps, and photo attachments are stored securely in local IndexedDB. You can operate fully in basements or areas with zero cellular reception.
          </p>

          {syncFeedback && (
            <div className={`mt-3 p-3 rounded-xl text-xs flex items-start gap-2 ${
              syncFeedback.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                : 'bg-rose-50 text-rose-800 border border-rose-200'
            }`}>
              {syncFeedback.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              )}
              <div className="flex-1 leading-snug">{syncFeedback.message}</div>
            </div>
          )}

          <div className="mt-3.5 flex gap-2">
            <button
              type="button"
              onClick={handleManualSync}
              disabled={isSyncing || !isOnline}
              className="w-full py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-black text-xs flex items-center justify-center gap-2 shadow-xs transition cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
              {isSyncing ? 'SYNCHRONIZING WITH SERVER...' : 'SYNC NOW'}
            </button>
          </div>
        </div>

        {/* PWA & System Information Card */}
        <div className="bg-white rounded-2xl p-4 shadow-xs border border-slate-200">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <Smartphone className="w-4 h-4 text-slate-700" />
            <h2 className="font-black text-slate-800 text-sm">PWA Installation Status</h2>
          </div>

          <div className="mt-3 space-y-2 text-xs">
            <div className="flex justify-between py-1 border-b border-slate-50">
              <span className="text-slate-500">Mode:</span>
              <span className="font-bold text-slate-800">
                {isStandalone ? '📱 Standalone PWA (Installed)' : '🌐 Mobile Web Browser'}
              </span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-50">
              <span className="text-slate-500">Service Worker:</span>
              <span className="font-bold text-emerald-600">
                {'serviceWorker' in navigator ? 'Active & Registered ✓' : 'Unavailable'}
              </span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-50">
              <span className="text-slate-500">PWA Version:</span>
              <span className="font-bold text-slate-800">v2.5.0 Production PWA</span>
            </div>
          </div>
        </div>

      </div>

      {/* 1-Time Phone Sign-In Modal */}
      {showLoginModal && (
        <TechLoginModal
          onSuccess={handleLoginSuccess}
          onClose={() => setShowLoginModal(false)}
        />
      )}
    </div>
  );
}
