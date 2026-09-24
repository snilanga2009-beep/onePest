import React, { useState, useEffect } from 'react';
import {
  Phone, Navigation, Play, CheckCircle2, Clock, MapPin,
  Calendar, User, AlertTriangle, ArrowLeft, Camera, PenTool,
  Check, X, RefreshCw, Smartphone, Download, Share2, Sparkles,
  ExternalLink, HardHat, Users, Wifi, WifiOff, BellRing, LogIn, LogOut
} from 'lucide-react';
import { getJobs, getJobById, startJob, completeJob, postponeJob, getStaff } from '../api';
import SignaturePad from '../components/SignaturePad';
import {
  cacheJobs,
  getCachedJobs,
  getPersistentTechSession,
  savePersistentTechSession,
  clearPersistentTechSession,
  enqueueOfflineMutation,
  getPendingMutations
} from '../services/offlineStorage';
import { triggerSync, onSyncStatusChange } from '../services/syncEngine';
import PushNotificationBanner from '../components/PushNotificationBanner';
import TechLoginModal from '../components/TechLoginModal';
import InstallAppModal from '../components/InstallAppModal';
import { getSavedBranding, fetchServerBranding, PresetLogoIcon } from '../components/BrandingSettingsModal';

export default function MobileTechnicianView({ onSelectJob, activeTechnicianId, initialJobId, currentUser, onLogout }) {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [todayStr, setTodayStr] = useState(new Date().toISOString().substring(0, 10));

  // System Branding (App Icon & Company Logo)
  const [branding, setBranding] = useState(() => getSavedBranding());

  useEffect(() => {
    fetchServerBranding().then(b => { if (b) setBranding(b); });
    const onBranding = (e) => setBranding(e.detail || getSavedBranding());
    window.addEventListener('branding-updated', onBranding);
    return () => window.removeEventListener('branding-updated', onBranding);
  }, []);

  // Persistent Technician Session & 1-Time Phone Sign-in
  const [techSession, setTechSession] = useState(null);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);

  // Sync Engine State
  const [syncState, setSyncState] = useState({ status: 'synced', pendingCount: 0 });
  const [syncingNow, setSyncingNow] = useState(false);

  // Current Technician Filter with persistent storage
  const [technicians, setTechnicians] = useState([]);
  const [selectedTechId, setSelectedTechId] = useState(() => {
    return activeTechnicianId || (typeof window !== 'undefined' ? localStorage.getItem('tech_preferred_id') || '' : '');
  });

  const handleTechChange = (val) => {
    setSelectedTechId(val);
    if (val) {
      localStorage.setItem('tech_preferred_id', val);
    } else {
      localStorage.removeItem('tech_preferred_id');
    }
  };

  useEffect(() => {
    if (activeTechnicianId && String(activeTechnicianId) !== String(selectedTechId)) {
      setSelectedTechId(String(activeTechnicianId));
      localStorage.setItem('tech_preferred_id', String(activeTechnicianId));
    }
  }, [activeTechnicianId]);

  const handleSignOut = async () => {
    if (window.confirm('Are you sure you want to sign out from the Technician App?')) {
      await clearPersistentTechSession();
      localStorage.removeItem('auth_token');
      localStorage.removeItem('auth_user');
      localStorage.removeItem('tech_preferred_id');
      sessionStorage.removeItem('auth_token');
      sessionStorage.removeItem('auth_user');
      if (onLogout) {
        onLogout();
      } else {
        window.location.reload();
      }
    }
  };

  // Detail Modal / View
  const [activeJob, setActiveJob] = useState(null);

  // PWA Install / Add to Home Screen State
  const [deferredPrompt, setDeferredPrompt] = useState(() => (typeof window !== 'undefined' ? window.__deferredPrompt : null));
  const [isStandalone, setIsStandalone] = useState(false);
  const [showInstallModal, setShowInstallModal] = useState(false);
  const [showIosGuide, setShowIosGuide] = useState(false);

  useEffect(() => {
    const isRunningStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
    setIsStandalone(isRunningStandalone);

    const handleBeforeInstall = (e) => {
      e.preventDefault();
      window.__deferredPrompt = e;
      setDeferredPrompt(e);
    };

    const handlePwaInstallable = () => {
      setDeferredPrompt(window.__deferredPrompt);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('pwa-installable', handlePwaInstallable);

    // 1-Time Tech Session bootstrap
    getPersistentTechSession().then(sess => {
      if (sess?.id) {
        setTechSession(sess);
        if (!selectedTechId) {
          setSelectedTechId(String(sess.id));
        }
      }
    });

    // Offline / Online listeners & background sync engine
    const handleOnline = () => {
      setIsOnline(true);
      triggerSync().then(() => loadTodayJobs());
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial pending mutations count
    getPendingMutations().then(mutations => {
      setSyncState({
        status: mutations.length === 0 ? 'synced' : 'pending',
        pendingCount: mutations.length
      });
    });

    const unsubSync = onSyncStatusChange((state) => {
      setSyncState(state);
      if (state.status === 'synced') {
        loadTodayJobs();
      }
    });

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('pwa-installable', handlePwaInstallable);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      unsubSync();
    };
  }, []);

  const handleInstallApp = async () => {
    const isIos = typeof window !== 'undefined' && /iphone|ipad|ipod/.test(window.navigator.userAgent.toLowerCase());
    const promptEvent = deferredPrompt || (typeof window !== 'undefined' ? window.__deferredPrompt : null);

    if (isIos) {
      setShowInstallModal(true);
      return;
    }

    if (promptEvent) {
      try {
        await promptEvent.prompt();
        const choice = await promptEvent.userChoice;
        if (choice && choice.outcome === 'accepted') {
          setIsStandalone(true);
          setDeferredPrompt(null);
          if (typeof window !== 'undefined') window.__deferredPrompt = null;
        } else {
          setShowInstallModal(true);
        }
      } catch (e) {
        console.error('Install prompt error:', e);
        setShowInstallModal(true);
      }
    } else {
      setShowInstallModal(true);
    }
  };

  // Initial Job deep-link from SMS / URL (never expires!)
  useEffect(() => {
    if (initialJobId) {
      setLoading(true);
      getJobById(initialJobId)
        .then(res => {
          if (res?.job) {
            setActiveJob(res.job);
            if (res.job.scheduled_date) {
              setTodayStr(res.job.scheduled_date);
            }
            if (res.job.technician_id) {
              const techIdStr = String(res.job.technician_id);
              handleTechChange(techIdStr);
              const techUser = res.job.staff || {
                id: res.job.technician_id,
                full_name: res.job.technician_name || 'Technician',
                phone: res.job.technician_phone || '',
                role: 'TECHNICIAN'
              };
              try {
                localStorage.setItem('auth_user', JSON.stringify(techUser));
                localStorage.setItem('tech_preferred_id', techIdStr);
                savePersistentTechSession(techUser);
              } catch (e) {}
            }
          }
        })
        .catch(err => {
          console.error('[Technician View] Error loading deep-linked job:', err);
        })
        .finally(() => {
          setLoading(false);
        });
    }
  }, [initialJobId]);

  // Completion Form Modal
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [jobToComplete, setJobToComplete] = useState(null);
  const [completionNotes, setCompletionNotes] = useState('');
  const [customerSignature, setCustomerSignature] = useState(null);
  const [showSignaturePad, setShowSignaturePad] = useState(false);
  const [photoUrl, setPhotoUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handlePhotoCapture = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setPhotoUrl(event.target.result);
      };
      reader.readAsDataURL(file);
    }
  };

  // Postpone Form Modal
  const [showPostponeModal, setShowPostponeModal] = useState(false);
  const [jobToPostpone, setJobToPostpone] = useState(null);
  const [postponeDate, setPostponeDate] = useState('');
  const [postponeReason, setPostponeReason] = useState('');

  const loadTodayJobs = async () => {
    setLoading(true);
    try {
      if (navigator.onLine) {
        const res = await getJobs({
          date: todayStr,
          technician_id: selectedTechId || undefined
        });
        const serverJobs = res.jobs || [];
        setJobs(serverJobs);
        // Cache in local IndexedDB for zero-latency offline access
        await cacheJobs(serverJobs);
      } else {
        // Read directly from IndexedDB when offline
        const cached = await getCachedJobs({
          date: todayStr,
          technician_id: selectedTechId || undefined
        });
        setJobs(cached);
      }
    } catch (e) {
      console.warn('Network error fetching jobs, loading from IndexedDB:', e);
      const cached = await getCachedJobs({
        date: todayStr,
        technician_id: selectedTechId || undefined
      });
      setJobs(cached);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    getStaff({ role: 'TECHNICIAN' }).then(r => {
      setTechnicians(r.staff || []);
    });
  }, []);

  useEffect(() => {
    loadTodayJobs();
  }, [todayStr, selectedTechId]);

  const handleStartJob = async (jobId, e) => {
    if (e) e.stopPropagation();

    if (!navigator.onLine) {
      await enqueueOfflineMutation({
        type: 'START_JOB',
        jobId,
        data: {}
      });
      setJobs(prev => prev.map(j => j.id === jobId ? { ...j, status: 'IN_PROGRESS' } : j));
      if (activeJob?.id === jobId) {
        setActiveJob(prev => ({ ...prev, status: 'IN_PROGRESS' }));
      }
      alert('⚡ Job started in OFFLINE mode! Saved to local device. Will automatically sync when connection returns.');
      return;
    }

    try {
      await startJob(jobId);
      loadTodayJobs();
      if (activeJob?.id === jobId) {
        const updated = await getJobById(jobId);
        setActiveJob(updated.job);
      }
    } catch (err) {
      // Connection drop fallback
      await enqueueOfflineMutation({
        type: 'START_JOB',
        jobId,
        data: {}
      });
      setJobs(prev => prev.map(j => j.id === jobId ? { ...j, status: 'IN_PROGRESS' } : j));
      alert('⚡ Network issue detected. Job started in offline queue!');
    }
  };

  const handleOpenComplete = (job, e) => {
    if (e) e.stopPropagation();
    setJobToComplete(job);
    setCompletionNotes('');
    setCustomerSignature(null);
    setPhotoUrl('');
    setShowCompleteModal(true);
  };

  const handleOpenPostpone = (job, e) => {
    if (e) e.stopPropagation();
    setJobToPostpone(job);
    setPostponeDate('');
    setPostponeReason('');
    setShowPostponeModal(true);
  };

  const handleCompleteSubmit = async (e) => {
    e.preventDefault();
    if (!jobToComplete) return;

    setSubmitting(true);
    const payload = {
      technician_notes: completionNotes,
      customer_signature: customerSignature,
      photos: photoUrl ? [{ url: photoUrl, type: 'COMPLETION' }] : []
    };

    if (!navigator.onLine) {
      await enqueueOfflineMutation({
        type: 'COMPLETE_JOB',
        jobId: jobToComplete.id,
        data: payload
      });
      setJobs(prev => prev.map(j => j.id === jobToComplete.id ? { ...j, status: 'COMPLETED', technician_notes: completionNotes } : j));
      alert('⚡ Job completed OFFLINE! Customer signature & notes are securely saved in device IndexedDB. Will sync when back online.');
      setShowCompleteModal(false);
      setJobToComplete(null);
      if (activeJob?.id === jobToComplete.id) {
        setActiveJob(null);
      }
      setSubmitting(false);
      return;
    }

    try {
      await completeJob(jobToComplete.id, payload);
      alert('Job Completed! Next recurring service has been automatically calculated & generated.');
      setShowCompleteModal(false);
      setJobToComplete(null);
      if (activeJob?.id === jobToComplete.id) {
        setActiveJob(null);
      }
      loadTodayJobs();
    } catch (err) {
      // Network drop fallback
      await enqueueOfflineMutation({
        type: 'COMPLETE_JOB',
        jobId: jobToComplete.id,
        data: payload
      });
      setJobs(prev => prev.map(j => j.id === jobToComplete.id ? { ...j, status: 'COMPLETED', technician_notes: completionNotes } : j));
      alert('⚡ Connection dropped: Completed job saved to local offline database! Will auto-sync when online.');
      setShowCompleteModal(false);
      setJobToComplete(null);
      if (activeJob?.id === jobToComplete.id) {
        setActiveJob(null);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handlePostponeSubmit = async (e) => {
    e.preventDefault();
    if (!jobToPostpone || !postponeDate) return;

    const payload = {
      postponed_to_date: postponeDate,
      reason: postponeReason
    };

    if (!navigator.onLine) {
      await enqueueOfflineMutation({
        type: 'POSTPONE_JOB',
        jobId: jobToPostpone.id,
        data: payload
      });
      setJobs(prev => prev.map(j => j.id === jobToPostpone.id ? { ...j, status: 'POSTPONED' } : j));
      alert(`⚡ Job postponed offline to ${postponeDate}. Will sync when connection returns.`);
      setShowPostponeModal(false);
      setJobToPostpone(null);
      if (activeJob?.id === jobToPostpone.id) {
        setActiveJob(null);
      }
      return;
    }

    try {
      await postponeJob(jobToPostpone.id, payload);
      alert(`Job postponed to ${postponeDate}`);
      setShowPostponeModal(false);
      setJobToPostpone(null);
      if (activeJob?.id === jobToPostpone.id) {
        setActiveJob(null);
      }
      loadTodayJobs();
    } catch (err) {
      await enqueueOfflineMutation({
        type: 'POSTPONE_JOB',
        jobId: jobToPostpone.id,
        data: payload
      });
      alert(`⚡ Connection issue: Job postponed offline to ${postponeDate}. Will auto-sync when online.`);
      setShowPostponeModal(false);
      setJobToPostpone(null);
      if (activeJob?.id === jobToPostpone.id) {
        setActiveJob(null);
      }
    }
  };

  const openNavigation = (job, e) => {
    if (e) e.stopPropagation();
    let query = '';
    if (job.latitude && job.longitude) {
      query = `${job.latitude},${job.longitude}`;
    } else {
      query = encodeURIComponent(`${job.location_name || ''} ${job.location_address || ''} Sri Lanka`);
    }
    window.open(`https://www.google.com/maps/search/?api=1&query=${query}`, '_blank');
  };

  return (
    <div className="w-full max-w-3xl mx-auto min-h-screen bg-slate-100 pb-28 shadow-2xl relative font-sans">

      {/* Top Mobile App Header */}
      <div className="bg-gradient-to-r from-red-700 via-red-600 to-rose-700 text-white p-4 sticky top-0 z-30 shadow-md border-b border-red-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            {activeJob ? (
              <button
                onClick={() => setActiveJob(null)}
                className="w-8 h-8 rounded-xl bg-white/20 hover:bg-white/30 flex items-center justify-center text-white transition"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            ) : (
              <div className="w-9 h-9 rounded-2xl bg-white/20 border border-white/30 flex items-center justify-center font-black text-sm text-slate-950 shadow-md overflow-hidden">
                {branding?.appIconUrl ? (
                  <img src={branding.appIconUrl} alt="App Icon" className="w-full h-full object-cover" />
                ) : branding?.customLogoUrl ? (
                  <img src={branding.customLogoUrl} alt="Logo" className="w-full h-full object-contain p-0.5 bg-white" />
                ) : branding?.presetId ? (
                  <PresetLogoIcon id={branding.presetId} className="w-6 h-6" />
                ) : (
                  <span className="text-emerald-400 font-black">PC</span>
                )}
              </div>
            )}
            <div>
              <h1 className="font-black text-sm sm:text-base tracking-tight leading-tight">
                {activeJob ? 'JOB EXECUTION' : 'FIELD TECHNICIAN APP'}
              </h1>
              <div className="text-[10px] text-emerald-400 font-semibold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                <span>Asia/Colombo &bull; {todayStr}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Real-time Offline Sync Engine Status Pill */}
            {syncState.pendingCount > 0 ? (
              <button
                type="button"
                onClick={async () => {
                  setSyncingNow(true);
                  await triggerSync();
                  setSyncingNow(false);
                }}
                title="Tap to synchronize pending offline actions"
                className="px-2 py-1 rounded-lg bg-amber-500/25 hover:bg-amber-500/40 text-amber-300 border border-amber-400/50 text-[10px] font-black uppercase tracking-wider flex items-center gap-1 animate-pulse transition cursor-pointer"
              >
                <RefreshCw className={`w-3 h-3 ${syncingNow ? 'animate-spin' : ''}`} />
                <span>WAITING FOR SYNC ({syncState.pendingCount})</span>
              </button>
            ) : (
              <span className="px-2 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-400/40 text-[10px] font-black uppercase tracking-wider flex items-center gap-1">
                <Check className="w-3 h-3 text-emerald-400" />
                <span>SYNCED ✓</span>
              </span>
            )}

            {!isStandalone && (
              <button
                type="button"
                onClick={handleInstallApp}
                title="Save App Icon to Phone Screen"
                className="px-2.5 py-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 font-black text-[11px] flex items-center gap-1 shadow-xs active:scale-95 transition cursor-pointer"
              >
                <Smartphone className="w-3.5 h-3.5" />
                <span>Add Icon</span>
              </button>
            )}
            <button
              onClick={loadTodayJobs}
              title="Refresh job queue"
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-emerald-400' : ''}`} />
            </button>

            {/* Prominent Sign Out Button */}
            <button
              type="button"
              onClick={handleSignOut}
              title="Sign Out from Technician App"
              className="px-2.5 py-1.5 rounded-xl bg-rose-500/25 hover:bg-rose-500/40 text-rose-200 border border-rose-400/50 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer active:scale-95"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>

        {/* Technician Profile Selector on Mobile */}
        {!activeJob && (
          <div className="mt-3.5 space-y-2.5">
            {/* 1-Time Permanent Phone Sign-In Status Pill */}
            <div className="flex items-center justify-between bg-black/25 px-3 py-1.5 rounded-xl border border-white/10 text-xs">
              <div className="flex items-center gap-1.5 truncate">
                <Phone className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span className="text-[11px] text-slate-300 truncate">
                  {currentUser?.full_name ? (
                    <span>
                      <strong className="text-white">{currentUser.full_name}</strong> {currentUser.phone ? `(${currentUser.phone})` : ''}
                    </span>
                  ) : techSession ? (
                    <span>
                      <strong className="text-white">{techSession.full_name}</strong> ({techSession.phone})
                    </span>
                  ) : (
                    <span className="text-emerald-300 font-semibold">Active Technician Session</span>
                  )}
                </span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-rose-500/30 hover:bg-rose-500/50 text-rose-200 border border-rose-400/40 transition cursor-pointer flex items-center gap-1"
                >
                  <LogOut className="w-2.5 h-2.5" />
                  <span>Sign Out</span>
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2 bg-white/10 px-3 py-1.5 rounded-xl border border-white/10 text-xs">
              <User className="w-4 h-4 text-emerald-300 shrink-0" />
              <select
                value={selectedTechId}
                onChange={(e) => handleTechChange(e.target.value)}
                className="bg-transparent text-white text-xs font-bold focus:outline-hidden w-full cursor-pointer"
              >
                <option value="" className="text-slate-900">All Field Technicians</option>
                {technicians.map(t => (
                  <option key={t.id} value={t.id} className="text-slate-900">{t.full_name} ({t.phone || 'No phone'})</option>
                ))}
              </select>
            </div>

            {/* Quick Status Bar on Mobile */}
            <div className="grid grid-cols-3 gap-1.5 text-center text-xs">
              <div className="p-1.5 rounded-xl bg-sky-500/20 border border-sky-400/30">
                <div className="text-base font-black text-sky-300">{jobs.filter(j => j.status === 'TO_BE_DONE' || j.status === 'ASSIGNED').length}</div>
                <div className="text-[9px] font-bold text-sky-200 uppercase">Assigned</div>
              </div>
              <div className="p-1.5 rounded-xl bg-amber-500/20 border border-amber-400/30">
                <div className="text-base font-black text-amber-300">{jobs.filter(j => j.status === 'IN_PROGRESS').length}</div>
                <div className="text-[9px] font-bold text-amber-200 uppercase">Active</div>
              </div>
              <div className="p-1.5 rounded-xl bg-emerald-500/20 border border-emerald-400/30">
                <div className="text-base font-black text-emerald-300">{jobs.filter(j => j.status === 'COMPLETED').length}</div>
                <div className="text-[9px] font-bold text-emerald-200 uppercase">Done</div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* PWA Save to Home Screen Top Banner */}
      {!isStandalone && (
        <div className="mx-3.5 mt-3 p-3 bg-gradient-to-r from-emerald-600 via-teal-600 to-indigo-700 rounded-2xl shadow-md text-white flex items-center justify-between gap-2.5 border border-white/20">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center shrink-0 border border-white/30 shadow-inner">
              <Smartphone className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="text-xs font-black tracking-tight flex items-center gap-1">
                <span>Save App to Home Screen</span>
                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              </div>
              <div className="text-[10px] text-emerald-100 leading-tight">
                1-tap phone icon to open panel & start work
              </div>
            </div>
          </div>

          <button
            onClick={handleInstallApp}
            className="px-3 py-2 bg-white hover:bg-emerald-50 text-emerald-950 font-black text-xs rounded-xl shadow-sm shrink-0 flex items-center gap-1.5 active:scale-95 transition"
          >
            <Download className="w-3.5 h-3.5 text-emerald-700" />
            <span>Add Icon</span>
          </button>
        </div>
      )}

      {/* Dispatched Job SMS Alert Banner */}
      {activeJob && (
        <div className="mx-3.5 mt-3 p-3 bg-gradient-to-r from-amber-500/15 to-orange-500/15 border border-amber-300 rounded-2xl text-amber-900 text-xs flex items-center justify-between shadow-2xs">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-ping" />
            <span className="font-bold text-xs">Direct Job Start Link (Permanent)</span>
          </div>
          <span className="text-[10px] font-mono bg-amber-100 text-amber-900 border border-amber-300 px-2 py-0.5 rounded-lg font-black uppercase">
            No Login Needed
          </span>
        </div>
      )}

      {/* Real Web Push Notification Permission Explanatory Banner */}
      {!activeJob && (
        <div className="mx-3.5 mt-3">
          <PushNotificationBanner technicianId={selectedTechId || techSession?.id} />
        </div>
      )}

      {/* VIEW 1: TODAY'S JOBS FEED */}
      {!activeJob && (
        <div className="p-3.5 space-y-3">
          {jobs.length === 0 ? (
            <div className="p-8 text-center bg-white rounded-3xl border border-slate-200 shadow-sm mt-4">
              <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-2" />
              <div className="font-black text-slate-800 text-sm">All Clear for Today!</div>
              <p className="text-xs text-slate-500 mt-1">No pending jobs found for this date. Check tomorrow or pick another technician.</p>
            </div>
          ) : (
            jobs.map(job => {
              const formattedPhone = job.customer_phone ? job.customer_phone.replace(/[^0-9]/g, '') : '';
              const intlPhone = formattedPhone.startsWith('0')
                ? '94' + formattedPhone.substring(1)
                : formattedPhone.startsWith('94')
                  ? formattedPhone
                  : '94' + formattedPhone;

              const whatsappText = encodeURIComponent(`Hello ${job.customer_name}, this is your Pest Control Technician. I am on my way for your scheduled ${job.treatment_code} service today.`);

              return (
                <div
                  key={job.id}
                  onClick={() => setActiveJob(job)}
                  className="bg-white rounded-3xl border border-slate-200 p-4 shadow-sm hover:shadow-md transition space-y-3 cursor-pointer relative overflow-hidden"
                >
                  <div
                    className="absolute top-0 left-0 bottom-0 w-1.5"
                    style={{ backgroundColor: job.treatment_color || '#10B981' }}
                  ></div>

                  {/* Header: Customer & Status */}
                  <div className="flex items-start justify-between gap-2 pl-1.5">
                    <div>
                      <h3 className="font-black text-slate-900 text-base leading-tight">{job.customer_name}</h3>
                      <div className="text-[11px] text-slate-400 font-mono mt-0.5">{job.job_code}</div>
                    </div>
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase shrink-0 ${
                      job.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-800' :
                      job.status === 'IN_PROGRESS' ? 'bg-amber-100 text-amber-800 animate-pulse' :
                      job.status === 'POSTPONED' ? 'bg-indigo-100 text-indigo-800' :
                      'bg-slate-100 text-slate-700'
                    }`}>
                      {job.status}
                    </span>
                  </div>

                  {/* Details: Location, Time, Treatment */}
                  <div className="space-y-1.5 text-xs text-slate-600 bg-slate-50 p-2.5 rounded-2xl border border-slate-100 pl-3">
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span className="font-semibold text-slate-800 line-clamp-1">
                        {job.location_name || job.location_address || 'Main Location'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[11px] pt-1 border-t border-slate-100">
                      <div className="flex items-center gap-1.5 font-bold text-slate-700">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        <span>{job.scheduled_time || '09:00'} ({job.duration_minutes || 60}m)</span>
                      </div>

                      <span
                        style={{ backgroundColor: `${job.treatment_color || '#10B981'}20`, color: job.treatment_color || '#10B981' }}
                        className="px-2.5 py-0.5 rounded-lg font-black text-[11px]"
                      >
                        {job.treatment_code}
                      </span>
                    </div>
                  </div>

                  {/* Field Actions: Call, WhatsApp, Navigation, Start / Complete */}
                  <div className="space-y-2 pt-1 pl-1.5" onClick={(e) => e.stopPropagation()}>
                    <div className="grid grid-cols-3 gap-1.5">
                      {/* Call Button */}
                      {job.customer_phone ? (
                        <a
                          href={`tel:${job.customer_phone}`}
                          className="flex items-center justify-center gap-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-xl text-xs transition"
                        >
                          <Phone className="w-3.5 h-3.5 text-emerald-600" />
                          <span>CALL</span>
                        </a>
                      ) : (
                        <div className="py-2 bg-slate-50 text-slate-400 font-bold rounded-xl text-[10px] text-center">NO PHONE</div>
                      )}

                      {/* WhatsApp Button */}
                      {job.customer_phone ? (
                        <a
                          href={`https://wa.me/${intlPhone}?text=${whatsappText}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-center gap-1 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold rounded-xl text-xs transition border border-emerald-200/60"
                        >
                          <span className="text-emerald-600 font-bold text-xs">💬</span>
                          <span>CHAT</span>
                        </a>
                      ) : (
                        <div className="py-2 bg-slate-50 text-slate-400 font-bold rounded-xl text-[10px] text-center">NO WA</div>
                      )}

                      {/* Navigate Button */}
                      <button
                        onClick={(e) => openNavigation(job, e)}
                        className="flex items-center justify-center gap-1 py-2 bg-blue-50 hover:bg-blue-100 text-blue-800 font-bold rounded-xl text-xs transition border border-blue-200/60"
                      >
                        <Navigation className="w-3.5 h-3.5 text-blue-600" />
                        <span>MAPS</span>
                      </button>
                    </div>

                    {/* Primary Workflow Button */}
                    {job.status === 'IN_PROGRESS' ? (
                      <button
                        onClick={(e) => handleOpenComplete(job, e)}
                        className="w-full flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black rounded-2xl text-xs shadow-md shadow-emerald-200 transition scale-100 active:scale-95"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>COMPLETE & TOUCH SIGN-OFF</span>
                      </button>
                    ) : job.status !== 'COMPLETED' ? (
                      <button
                        onClick={(e) => handleStartJob(job.id, e)}
                        className="w-full flex items-center justify-center gap-2 py-3 bg-slate-900 hover:bg-black text-white font-black rounded-2xl text-xs shadow-md transition scale-100 active:scale-95"
                      >
                        <Play className="w-4 h-4 text-emerald-400" />
                        <span>START JOB NOW</span>
                      </button>
                    ) : (
                      <div className="py-2.5 bg-emerald-50 text-emerald-700 font-bold rounded-2xl text-xs text-center border border-emerald-200 flex items-center justify-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        <span>COMPLETED & NEXT SCHEDULED</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* VIEW 2: JOB DETAILS VIEW */}
      {activeJob && (
        <div className="p-4 space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm space-y-3 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-mono text-slate-400 font-bold">{activeJob.job_code}</span>
              <span className={`px-2.5 py-0.5 rounded-full font-black text-[10px] ${
                activeJob.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-800'
              }`}>
                {activeJob.status}
              </span>
            </div>

            <h2 className="text-lg font-black text-slate-900">{activeJob.customer_name}</h2>

            {/* Contact Person & Direct Call */}
            {activeJob.customer_phone && (
              <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-100 flex items-center justify-between">
                <div>
                  <div className="font-bold text-slate-900">{activeJob.contact_person || 'Client'}</div>
                  <div className="text-emerald-700 font-mono mt-0.5">{activeJob.customer_phone}</div>
                </div>
                <a
                  href={`tel:${activeJob.customer_phone}`}
                  className="px-3 py-1.5 bg-emerald-600 text-white font-bold rounded-lg flex items-center gap-1"
                >
                  <Phone className="w-3.5 h-3.5" /> Call
                </a>
              </div>
            )}

            {/* Location & Navigation */}
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-2">
              <div className="flex items-center gap-1.5 font-bold text-slate-900">
                <MapPin className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{activeJob.location_name || 'Main Location'}</span>
              </div>
              <div className="text-slate-600">{activeJob.location_address || activeJob.location_name}</div>
              <button
                onClick={(e) => openNavigation(activeJob, e)}
                className="w-full py-2 bg-blue-50 text-blue-700 font-bold rounded-lg flex items-center justify-center gap-1.5"
              >
                <Navigation className="w-4 h-4" /> Open in Google Maps
              </button>
            </div>

            {/* Treatment, Date & Time */}
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-slate-400 uppercase font-bold text-[9px]">Treatment</span>
                <div className="font-bold text-slate-900 mt-0.5">{activeJob.treatment_code}</div>
              </div>
              <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-slate-400 uppercase font-bold text-[9px]">Scheduled</span>
                <div className="font-bold text-slate-900 mt-0.5">{activeJob.scheduled_date} at {activeJob.scheduled_time || '09:00'}</div>
              </div>
            </div>

            {/* Special Instructions */}
            {activeJob.special_instructions && (
              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200">
                <span className="font-bold text-amber-900 uppercase text-[10px]">Special Instructions</span>
                <p className="mt-1 text-amber-800">{activeJob.special_instructions}</p>
              </div>
            )}
          </div>

          {/* Action Buttons for Details View */}
          <div className="space-y-2">
            {activeJob.status !== 'COMPLETED' && (
              <>
                {activeJob.status !== 'IN_PROGRESS' ? (
                  <button
                    onClick={(e) => handleStartJob(activeJob.id, e)}
                    className="w-full py-4 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white font-black rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-red-600/30 text-sm active:scale-98 transition"
                  >
                    <Play className="w-5 h-5 text-white" /> START JOB NOW
                  </button>
                ) : (
                  <button
                    onClick={(e) => handleOpenComplete(activeJob, e)}
                    className="w-full py-3.5 bg-emerald-600 text-white font-black rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-emerald-200"
                  >
                    <CheckCircle2 className="w-5 h-5" /> COMPLETE JOB
                  </button>
                )}

                <button
                  onClick={(e) => handleOpenPostpone(activeJob, e)}
                  className="w-full py-3 bg-slate-200 text-slate-800 font-bold rounded-2xl flex items-center justify-center gap-2"
                >
                  <Clock className="w-4 h-4" /> POSTPONE / RESCHEDULE
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* MOBILE JOB COMPLETION MODAL */}
      {showCompleteModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-end sm:items-center justify-center">
          <div className="bg-white w-full max-w-md rounded-t-3xl sm:rounded-2xl p-5 shadow-2xl max-h-[90vh] overflow-y-auto space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="font-black text-slate-900 text-base flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                <span>Complete Job</span>
              </h2>
              <button onClick={() => setShowCompleteModal(false)} className="text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCompleteSubmit} className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700">Service Notes / Findings</label>
                <textarea
                  rows={3}
                  value={completionNotes}
                  onChange={(e) => setCompletionNotes(e.target.value)}
                  placeholder="Record treatment chemical dosage, pest activity, infested zones..."
                  className="w-full mt-1 p-2.5 bg-slate-50 rounded-xl border border-slate-200 focus:outline-hidden"
                />
              </div>

              {/* Optional Job Photo Capture */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="font-bold text-slate-700 flex items-center gap-1.5">
                    <Camera className="w-4 h-4 text-emerald-600" />
                    <span>Job Photo</span>
                    <span className="text-[10px] text-slate-400 font-normal">(Optional - Not Required)</span>
                  </label>
                  {photoUrl && (
                    <button
                      type="button"
                      onClick={() => setPhotoUrl('')}
                      className="text-[11px] text-rose-600 font-bold hover:underline"
                    >
                      Remove Photo
                    </button>
                  )}
                </div>

                {photoUrl ? (
                  <div className="relative rounded-2xl overflow-hidden border border-emerald-200 bg-slate-50 p-1.5">
                    <img src={photoUrl} alt="Completed Job" className="max-h-36 w-full object-cover rounded-xl" />
                  </div>
                ) : (
                  <div>
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      id="tech-camera-input"
                      className="hidden"
                      onChange={handlePhotoCapture}
                    />
                    <label
                      htmlFor="tech-camera-input"
                      className="flex items-center justify-center gap-2 py-3 px-4 bg-slate-50 hover:bg-emerald-50 text-slate-700 hover:text-emerald-800 font-bold rounded-2xl border-2 border-dashed border-slate-200 hover:border-emerald-300 transition cursor-pointer"
                    >
                      <Camera className="w-5 h-5 text-emerald-600" />
                      <span>Take Photo with Camera (Optional)</span>
                    </label>
                  </div>
                )}
              </div>

              {/* Touch Signature Pad for Customer */}
              <div className="pt-2">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="font-bold text-slate-700 flex items-center gap-1.5">
                    <PenTool className="w-4 h-4 text-emerald-600" /> Customer Signature
                  </label>
                  {!showSignaturePad && (
                    <button
                      type="button"
                      onClick={() => setShowSignaturePad(true)}
                      className="text-xs font-bold text-emerald-600 hover:underline"
                    >
                      {customerSignature ? 'Change Signature' : '+ Open Signature Pad'}
                    </button>
                  )}
                </div>

                {customerSignature ? (
                  <div className="border-2 border-emerald-200 rounded-xl p-2 bg-emerald-50/30">
                    <img src={customerSignature} alt="Customer signature" className="max-h-20 mx-auto" />
                  </div>
                ) : (
                  <div className="p-3 border-2 border-dashed border-slate-200 rounded-xl text-center text-slate-400 text-xs">
                    Tap "+ Open Signature Pad" to let client sign on screen
                  </div>
                )}

                {showSignaturePad && (
                  <div className="mt-2">
                    <SignaturePad
                      onSave={(dataUrl) => {
                        setCustomerSignature(dataUrl);
                        setShowSignaturePad(false);
                      }}
                      onCancel={() => setShowSignaturePad(false)}
                      title="Customer Touch Sign-off"
                    />
                  </div>
                )}
              </div>

              <div className="pt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowCompleteModal(false)}
                  className="w-1/3 py-3 bg-slate-100 text-slate-700 font-bold rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-2/3 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-xl shadow-lg shadow-emerald-200"
                >
                  {submitting ? 'Saving...' : 'SAVE & COMPLETE'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MOBILE POSTPONE MODAL */}
      {showPostponeModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-end sm:items-center justify-center">
          <div className="bg-white w-full max-w-md rounded-t-3xl sm:rounded-2xl p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="font-black text-slate-900 text-base">Postpone Service</h2>
              <button onClick={() => setShowPostponeModal(false)} className="text-slate-400">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handlePostponeSubmit} className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700">Reschedule To Date *</label>
                <input
                  type="date"
                  required
                  value={postponeDate}
                  onChange={(e) => setPostponeDate(e.target.value)}
                  className="w-full mt-1 p-2.5 bg-slate-50 rounded-xl border border-slate-200 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700">Reason</label>
                <textarea
                  rows={2}
                  value={postponeReason}
                  onChange={(e) => setPostponeReason(e.target.value)}
                  placeholder="e.g. Factory closed, customer request"
                  className="w-full mt-1 p-2.5 bg-slate-50 rounded-xl border border-slate-200 focus:outline-hidden"
                />
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowPostponeModal(false)}
                  className="w-1/3 py-3 bg-slate-100 text-slate-700 font-bold rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="w-2/3 py-3 bg-indigo-600 text-white font-black rounded-xl"
                >
                  CONFIRM POSTPONE
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PWA Universal Install Modal for Android & iPhone */}
      <InstallAppModal
        isOpen={showInstallModal || showIosGuide}
        onClose={() => {
          setShowInstallModal(false);
          setShowIosGuide(false);
        }}
        deferredPrompt={deferredPrompt || (typeof window !== 'undefined' ? window.__deferredPrompt : null)}
        onInstalled={() => setIsStandalone(true)}
      />

      {/* 1-Time Permanent Phone Sign-In Modal */}
      {showLoginModal && (
        <TechLoginModal
          onSuccess={(sess) => {
            setTechSession(sess);
            setShowLoginModal(false);
            if (sess?.id) {
              handleTechChange(String(sess.id));
            }
          }}
          onClose={() => setShowLoginModal(false)}
        />
      )}

    </div>
  );
}
