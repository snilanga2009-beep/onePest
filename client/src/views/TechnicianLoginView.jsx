import React, { useState, useEffect } from 'react';
import {
  Phone, Smartphone, ShieldCheck, CheckCircle2, AlertTriangle,
  Send, RefreshCw, Sparkles, User, Key, ArrowRight, Lock, Check
} from 'lucide-react';
import { savePersistentTechSession } from '../services/offlineStorage';
import { getSavedBranding, fetchServerBranding, PresetLogoIcon } from '../components/BrandingSettingsModal';

export default function TechnicianLoginView({ onLoginSuccess }) {
  const [branding, setBranding] = useState(() => getSavedBranding());
  const [step, setStep] = useState(1); // 1: Enter Phone, 2: Enter OTP
  const [phone, setPhone] = useState('0729744526');
  const [otpCode, setOtpCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [smsFeedback, setSmsFeedback] = useState(null);
  const [countdown, setCountdown] = useState(0);

  // Field technicians for 1-tap activation
  const [technicians, setTechnicians] = useState([]);
  const [loadingTechs, setLoadingTechs] = useState(false);

  useEffect(() => {
    fetchServerBranding().then(b => { if (b) setBranding(b); });
    const handleBrandingChange = (e) => setBranding(e.detail || getSavedBranding());
    window.addEventListener('branding-updated', handleBrandingChange);
    return () => window.removeEventListener('branding-updated', handleBrandingChange);
  }, []);

  useEffect(() => {
    // Load registered technicians for quick bypass
    setLoadingTechs(true);
    fetch('/api/tech-auth/technicians')
      .then(r => r.json())
      .then(d => {
        if (d.success && d.technicians) {
          setTechnicians(d.technicians);
        }
      })
      .catch(() => {})
      .finally(() => setLoadingTechs(false));
  }, []);

  // Timer for OTP resend countdown
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  // Step 1: Send SMS OTP
  const handleRequestOtp = async (e) => {
    if (e) e.preventDefault();
    const cleanDigits = phone.replace(/\D/g, '');
    if (cleanDigits.length < 9) {
      setError('Please enter a valid 9 or 10-digit Sri Lankan phone number.');
      return;
    }

    setLoading(true);
    setError(null);
    setSmsFeedback(null);

    try {
      const res = await fetch('/api/tech-auth/request-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: cleanDigits })
      });

      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || 'Failed to send SMS verification code.');
      }

      setStep(2);
      setCountdown(60);
      setSmsFeedback({
        message: data.message || `Code sent to ${phone} via SMS!`,
        debugCode: data.debugCode
      });
      if (data.debugCode) {
        setOtpCode(data.debugCode);
      }
    } catch (err) {
      setError(err.message || 'Failed to dispatch verification code.');
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Verify SMS OTP
  const handleVerifyOtp = async (e) => {
    if (e) e.preventDefault();
    if (!otpCode || otpCode.trim().length < 6) {
      setError('Please enter the 6-digit verification code received by SMS.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/tech-auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: phone.replace(/\D/g, ''),
          otp_code: otpCode.trim(),
          device_info: {
            userAgent: navigator.userAgent,
            timestamp: new Date().toISOString()
          }
        })
      });

      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || 'Invalid or expired verification code.');
      }

      await activateSession(data.technician, data.token);
    } catch (err) {
      setError(err.message || 'Verification failed.');
    } finally {
      setLoading(false);
    }
  };

  // Quick 1-Tap Preset Activation
  const handleQuickLogin = async (targetPhone) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/tech-auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: targetPhone })
      });
      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || 'Failed to activate preset session.');
      }
      await activateSession(data.technician, data.token);
    } catch (err) {
      setError(err.message || 'Quick activation failed.');
    } finally {
      setLoading(false);
    }
  };

  const activateSession = async (technician, token) => {
    const techUser = {
      ...technician,
      role: 'TECHNICIAN'
    };

    // Save to IndexedDB permanent store
    await savePersistentTechSession({
      token,
      technician: techUser,
      phone: technician.phone
    });

    // Save to localStorage for instant synchronous boot
    localStorage.setItem('auth_token', token);
    localStorage.setItem('auth_user', JSON.stringify(techUser));
    localStorage.setItem('tech_preferred_id', String(technician.id));
    localStorage.setItem('tech_session', JSON.stringify(techUser));

    if (onLoginSuccess) {
      onLoginSuccess(techUser, token);
    }
  };

  return (
    <div className="min-h-[100dvh] bg-gradient-to-b from-red-50/40 via-white to-red-50/20 flex flex-col justify-between p-4 sm:p-6 max-w-md mx-auto select-none font-sans">
      
      {/* Top Branding Section */}
      <div className="pt-6 sm:pt-10 text-center space-y-3">
        <div className="w-18 h-18 sm:w-20 sm:h-20 mx-auto rounded-3xl bg-gradient-to-tr from-red-600 via-rose-600 to-red-700 shadow-xl shadow-red-600/20 p-1 flex items-center justify-center border-2 border-white">
          {branding?.customLogoUrl ? (
            <img src={branding.customLogoUrl} alt="Logo" className="w-full h-full object-contain rounded-2xl bg-white p-1" />
          ) : branding?.appIconUrl ? (
            <img src={branding.appIconUrl} alt="Icon" className="w-full h-full object-cover rounded-2xl" />
          ) : branding?.presetId ? (
            <PresetLogoIcon id={branding.presetId} className="w-10 h-10 text-white" />
          ) : (
            <Smartphone className="w-10 h-10 text-white" />
          )}
        </div>

        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-100 text-red-700 text-[10px] font-black uppercase tracking-wider mb-1 border border-red-200">
            <span className="w-2 h-2 rounded-full bg-red-600 animate-ping"></span>
            <span>1-Time Setup • Permanent Session</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            Field Technician Portal
          </h1>
          <p className="text-xs text-slate-500 max-w-xs mx-auto">
            {branding.name || 'Ceylon Pest Management'} &bull; Enter your mobile number to receive your activation SMS code.
          </p>
        </div>
      </div>

      {/* Main Authentication Card */}
      <div className="my-6 bg-white rounded-3xl p-6 sm:p-7 border-2 border-red-100 shadow-xl shadow-red-600/5 space-y-4">
        {error && (
          <div className="p-3.5 bg-red-50 border border-red-200 text-red-800 rounded-2xl text-xs font-bold flex items-start gap-2 animate-shake">
            <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {smsFeedback && (
          <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl text-xs font-bold space-y-1">
            <div className="flex items-center gap-1.5 text-emerald-700">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{smsFeedback.message}</span>
            </div>
            {smsFeedback.debugCode && (
              <div className="text-[11px] text-emerald-600 font-mono bg-emerald-100/60 p-1.5 rounded-lg text-center mt-1">
                Your SMS code is: <strong className="text-emerald-950 font-black text-sm">{smsFeedback.debugCode}</strong>
              </div>
            )}
          </div>
        )}

        {step === 1 ? (
          /* STEP 1: ENTER PHONE NUMBER */
          <form onSubmit={handleRequestOtp} className="space-y-4">
            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1.5">
                Technician Mobile Number *
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Phone className="w-4 h-4 text-red-600" />
                </div>
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="07XXXXXXXX or 94XXXXXXXX"
                  className="w-full pl-10 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-black text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-red-500 focus:bg-white transition"
                />
              </div>
              <p className="text-[11px] text-slate-400 mt-1.5 pl-1">
                A 6-digit verification code will be sent to this phone.
              </p>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 bg-gradient-to-r from-red-600 via-rose-600 to-red-700 hover:from-red-700 hover:to-rose-800 text-white font-black text-sm rounded-2xl shadow-lg shadow-red-600/30 flex items-center justify-center gap-2 active:scale-98 transition cursor-pointer disabled:opacity-50"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-white" />
                  <span>Sending SMS Code...</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 text-white" />
                  <span>Request OTP Code</span>
                </>
              )}
            </button>
          </form>
        ) : (
          /* STEP 2: ENTER OTP CODE */
          <form onSubmit={handleVerifyOtp} className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-black uppercase tracking-wider text-slate-700">
                  Enter 6-Digit OTP Code *
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setStep(1);
                    setOtpCode('');
                    setError(null);
                  }}
                  className="text-[11px] text-red-600 font-bold hover:underline"
                >
                  Change Phone
                </button>
              </div>

              <input
                type="text"
                required
                maxLength={6}
                value={otpCode}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, '').slice(0, 6);
                  setOtpCode(val);
                }}
                placeholder="• • • • • •"
                autoFocus
                className="w-full py-3.5 px-4 text-center tracking-[0.5em] font-mono text-2xl font-black bg-slate-50 border-2 border-red-200 rounded-2xl text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-red-500 focus:bg-white transition"
              />
            </div>

            <button
              type="submit"
              disabled={loading || otpCode.length < 6}
              className="w-full py-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-black text-sm rounded-2xl shadow-lg shadow-emerald-600/25 flex items-center justify-center gap-2 active:scale-98 transition cursor-pointer disabled:opacity-50"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-white" />
                  <span>Verifying Code...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 text-white" />
                  <span>Activate & Open App</span>
                </>
              )}
            </button>

            <div className="text-center pt-1">
              {countdown > 0 ? (
                <span className="text-[11px] text-slate-400 font-medium">
                  Resend code in <strong className="text-slate-700 font-black">{countdown}s</strong>
                </span>
              ) : (
                <button
                  type="button"
                  onClick={handleRequestOtp}
                  disabled={loading}
                  className="text-xs text-red-600 font-black hover:underline inline-flex items-center gap-1 cursor-pointer"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Resend SMS Code</span>
                </button>
              )}
            </div>
          </form>
        )}

        {/* Quick 1-Tap Technician Preset Buttons */}
        <div className="pt-3 border-t border-slate-100">
          <div className="text-[11px] font-black uppercase text-slate-400 tracking-wider text-center mb-2.5">
            Or Quick 1-Tap Activation
          </div>
          <div className="grid grid-cols-2 gap-2">
            {technicians.length > 0 ? (
              technicians.slice(0, 4).map(t => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => handleQuickLogin(t.phone)}
                  disabled={loading}
                  className="p-2.5 rounded-xl bg-red-50/70 hover:bg-red-100 text-left border border-red-200/80 transition active:scale-95 group cursor-pointer disabled:opacity-50"
                >
                  <div className="font-black text-xs text-slate-900 group-hover:text-red-700 truncate">
                    {t.full_name}
                  </div>
                  <div className="text-[10px] text-slate-500 font-mono truncate">
                    {t.phone || 'No phone'}
                  </div>
                </button>
              ))
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => handleQuickLogin('0729744526')}
                  disabled={loading}
                  className="p-2.5 rounded-xl bg-red-50/70 hover:bg-red-100 text-left border border-red-200/80 transition active:scale-95 group cursor-pointer"
                >
                  <div className="font-black text-xs text-slate-900 group-hover:text-red-700">Nuwan</div>
                  <div className="text-[10px] text-slate-500 font-mono">0729744526</div>
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickLogin('077213817')}
                  disabled={loading}
                  className="p-2.5 rounded-xl bg-red-50/70 hover:bg-red-100 text-left border border-red-200/80 transition active:scale-95 group cursor-pointer"
                >
                  <div className="font-black text-xs text-slate-900 group-hover:text-red-700">Wijee</div>
                  <div className="text-[10px] text-slate-500 font-mono">077213817</div>
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Footer Info */}
      <div className="text-center pb-4 text-[11px] text-slate-400 space-y-1">
        <div className="flex items-center justify-center gap-1 text-slate-500 font-bold">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
          <span>No daily password needed after verification</span>
        </div>
        <p>Session remains active permanently on this device.</p>
      </div>

    </div>
  );
}
