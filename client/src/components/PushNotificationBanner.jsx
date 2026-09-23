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

  if (!status || !status.supported || status.isSubscribed || dismissed) {
    return null;
  }

  const handleEnable = async () => {
    if (!technicianId) {
      alert('Please log in as a technician first to enable device notifications.');
      return;
    }

    setSubscribing(true);
    setFeedback(null);

    try {
      await subscribeToPush(technicianId);
      await checkStatus();
      setFeedback({ type: 'success', msg: 'Push notifications enabled successfully on this device!' });
      if (onSubscriptionChanged) onSubscriptionChanged(true);
      setTimeout(() => setDismissed(true), 3000);
    } catch (err) {
      console.warn('Subscription error:', err);
      await checkStatus();
      if (Notification.permission === 'denied') {
        setFeedback({
          type: 'denied',
          msg: 'Notifications are disabled. You can enable them from your device/browser settings.'
        });
      } else {
        setFeedback({ type: 'error', msg: err.message || 'Failed to enable notifications.' });
      }
    } finally {
      setSubscribing(false);
    }
  };

  if (status.permission === 'denied') {
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
    <div className="mx-3.5 mt-2.5 p-3.5 bg-gradient-to-r from-indigo-900 via-slate-900 to-emerald-950 text-white rounded-2xl shadow-lg border border-white/10 space-y-2.5 animate-in fade-in duration-200">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center shrink-0 border border-white/20 text-emerald-400 shadow-inner">
            <BellRing className="w-5 h-5 animate-bounce" />
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
          className="flex-1 py-2.5 px-3 bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 font-black text-xs rounded-xl shadow-md disabled:opacity-50 transition flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
        >
          <Bell className="w-3.5 h-3.5 text-slate-950" />
          <span>{subscribing ? 'Registering Device...' : 'ENABLE NOTIFICATIONS'}</span>
        </button>
        <button
          onClick={() => setDismissed(true)}
          className="py-2.5 px-3 bg-white/10 hover:bg-white/20 text-slate-300 font-bold text-xs rounded-xl transition"
        >
          Later
        </button>
      </div>
    </div>
  );
}
