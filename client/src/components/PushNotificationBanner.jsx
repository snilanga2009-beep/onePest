import React, { useState, useEffect } from 'react';
import { Bell, BellRing, BellOff, Check, X, Shield, Sparkles } from 'lucide-react';
import { getPushSubscriptionStatus, subscribeToPush } from '../services/pushManager';

export default function PushNotificationBanner({ technicianId, onSubscriptionChanged }) {
  const [status, setStatus] = useState(null);
  const [subscribing, setSubscribing] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [feedback, setFeedback] = useState(null);

  const checkStatus = async () => {
    const s = await getPushSubscriptionStatus();
    setStatus(s);
  };

  useEffect(() => {
    checkStatus();
  }, [technicianId]);

  const isIos = typeof window !== 'undefined' && /iphone|ipad|ipod/.test(window.navigator.userAgent.toLowerCase());
  const isStandalone = typeof window !== 'undefined' && (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true);

  if (dismissed || !status || status.isSubscribed || !status.supported) {
    return null;
  }

  // On iOS, if not standalone, explain that Add to Home Screen is required
  if (isIos && !isStandalone) {
    return (
      <div className="mx-3.5 mt-2.5 p-3.5 bg-gradient-to-r from-red-900 to-rose-950 text-white rounded-2xl shadow-lg border border-white/10 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center shrink-0 text-amber-300">
            <BellRing className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="text-xs font-bold text-white flex items-center gap-1">
              <span>Enable iOS Alerts</span>
              <Sparkles className="w-3 h-3 text-amber-300" />
            </div>
            <div className="text-[11px] text-slate-300 mt-0.5 leading-tight">
              Tap <strong>"Add Icon"</strong> above to add this app to your iPhone Home Screen first to enable push notifications.
            </div>
          </div>
        </div>
        <button
          onClick={() => setDismissed(true)}
          className="text-white/60 hover:text-white p-1 rounded-lg"
          title="Dismiss"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    );
  }

  const handleEnable = async () => {
    const techId = technicianId || (typeof window !== 'undefined' ? localStorage.getItem('tech_preferred_id') : '') || '1';
    setSubscribing(true);
    setFeedback(null);

    try {
      await subscribeToPush(techId);
      await checkStatus();
      setFeedback({ type: 'success', msg: '🔔 Push notifications enabled successfully on this device!' });
      if (onSubscriptionChanged) onSubscriptionChanged(true);
      setTimeout(() => setDismissed(true), 3500);
    } catch (err) {
      console.warn('Subscription error:', err);
      await checkStatus();
      if (typeof Notification !== 'undefined' && Notification.permission === 'denied') {
        setFeedback({
          type: 'denied',
          msg: 'Notifications are blocked. Please allow notifications in your phone/browser site settings.'
        });
      } else {
        setFeedback({ type: 'error', msg: err.message || 'Failed to enable notifications.' });
      }
    } finally {
      setSubscribing(false);
    }
  };

  if (status?.permission === 'denied') {
    return (
      <div className="mx-3.5 mt-2.5 p-3 bg-slate-100 rounded-2xl border border-slate-200 text-slate-600 text-xs flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <BellOff className="w-4 h-4 text-slate-400 shrink-0" />
          <span className="text-[11px] leading-tight">
            Notifications are disabled. You can enable them anytime from your device/browser site settings.
          </span>
        </div>
        <button
          onClick={() => setDismissed(true)}
          className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div className="mx-3.5 mt-2.5 p-3.5 bg-gradient-to-r from-red-800 via-rose-900 to-slate-900 text-white rounded-2xl shadow-lg border border-red-500/20 space-y-2.5 animate-in fade-in duration-200">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center shrink-0 border border-white/20 text-red-300 shadow-inner">
            <BellRing className="w-5 h-5 animate-bounce text-red-300" />
          </div>
          <div>
            <div className="text-xs font-black tracking-tight flex items-center gap-1.5 text-white">
              <span>Real-Time Job Alerts</span>
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            </div>
            <div className="text-[11px] text-slate-300 leading-tight mt-0.5">
              Enable notifications to receive new job assignments, job reminders and schedule changes.
            </div>
          </div>
        </div>

        <button
          onClick={() => setDismissed(true)}
          className="text-white/60 hover:text-white p-1 rounded-lg hover:bg-white/10 transition"
          title="Dismiss"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {feedback && (
        <div className={`p-2 rounded-xl text-[11px] font-semibold ${
          feedback.type === 'success' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
        }`}>
          {feedback.msg}
        </div>
      )}

      <div className="flex items-center gap-2 pt-1">
        <button
          onClick={handleEnable}
          disabled={subscribing}
          className="flex-1 py-2.5 px-3 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-black text-xs rounded-xl shadow-md disabled:opacity-50 transition flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
        >
          <Bell className="w-3.5 h-3.5 text-white" />
          <span>{subscribing ? 'Registering Device...' : 'ENABLE NOTIFICATIONS'}</span>
        </button>
        <button
          onClick={() => setDismissed(true)}
          className="py-2.5 px-3 bg-white/10 hover:bg-white/20 text-slate-300 font-bold text-xs rounded-xl transition cursor-pointer"
        >
          Later
        </button>
      </div>
    </div>
  );
}
