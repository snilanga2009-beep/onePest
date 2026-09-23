import React, { useState, useEffect } from 'react';
import {
  Smartphone, LogIn, Shield, Check, AlertCircle,
  User, Sparkles, Send, X, RefreshCw, CheckCircle2, Lock
} from 'lucide-react';
import { saveTechSession } from '../services/offlineStorage';

export default function TechLoginModal({ isOpen = true, onSuccess, onLoginSuccess, onClose }) {
  const [step, setStep] = useState(1); // 1: Enter phone, 2: Enter OTP
  const [phone, setPhone] = useState('0729744526');
  const [otpCode, setOtpCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [smsFeedback, setSmsFeedback] = useState(null);
  const [countdown, setCountdown] = useState(0);

  // Countdown timer for resend
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  if (!isOpen && isOpen !== undefined) return null;

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
        message: data.message || `Code sent to ${phone}!`,
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
      setError('Please enter the 6-digit verification code received via SMS.');
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

      // Save 1-Time Session in IndexedDB & LocalStorage
      await saveTechSession({
        token: data.token,
        technician: data.technician,
        phone: data.technician.phone
      });

      localStorage.setItem('auth_token', data.token);
      localStorage.setItem('auth_user', JSON.stringify({
        ...data.technician,
        role: 'TECHNICIAN'
      }));
      localStorage.setItem('tech_preferred_id', String(data.technician.id));

      if (onSuccess) {
        onSuccess(data.technician, data.token);
      } else if (onLoginSuccess) {
        onLoginSuccess(data.technician, data.token);
      }
    } catch (err) {
      setError(err.message || 'Verification failed.');
    } finally {
      setLoading(false);
    }
  };

  // Quick Preset Bypass (for instant testing without SMS wait)
  const handleDirectLogin = async (targetPhone) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/tech-auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: targetPhone })
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);

      await saveTechSession({
        token: data.token,
        technician: data.technician,
        phone: data.technician.phone
      });
      localStorage.setItem('auth_token', data.token);
      localStorage.setItem('auth_user', JSON.stringify({ ...data.technician, role: 'TECHNICIAN' }));
      localStorage.setItem('tech_preferred_id', String(data.technician.id));

      if (onSuccess) onSuccess(data.technician, data.token);
      else if (onLoginSuccess) onLoginSuccess(data.technician, data.token);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-sm overflow-hidden flex flex-col relative">

        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 z-20 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition"
          >
            <X className="w-4 h-4" />
          </button>
        )}

        {/* Header Banner */}
        <div className="p-6 bg-gradient-to-br from-slate-900 via-indigo-950 to-emerald-950 text-white text-center relative">
          <div className="w-16 h-16 mx-auto rounded-3xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center font-black text-xl text-slate-950 shadow-lg shadow-emerald-950/50 mb-3">
            PC
          </div>
          <h2 className="text-lg font-black tracking-tight">Technician 1-Time SMS Sign-In</h2>
          <p className="text-xs text-emerald-300 font-semibold mt-1">
            PestControl Pro &bull; Field Operations App
          </p>
        </div>

        {/* Form Body */}
        <div className="p-6 space-y-4">
          <div className="text-center text-xs text-slate-500">
            {step === 1
              ? 'Enter your mobile number to receive a 6-digit SMS verification code. Session never expires on this device.'
              : `Enter the 6-digit verification code sent to ${phone}.`}
          </div>

          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {step === 1 ? (
            <form onSubmit={handleRequestOtp} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <Smartphone className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Mobile Phone Number</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-xs font-bold text-slate-400">
                    🇱🇰 +94
                  </div>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="72 974 4526 or 077..."
                    autoFocus
                    required
                    className="w-full pl-16 pr-3.5 py-3 bg-slate-50 rounded-xl border border-slate-200 focus:bg-white focus:border-emerald-500 focus:outline-hidden font-mono font-bold text-sm tracking-wider"
                  />
                </div>
              </div>

              {/* Quick Presets */}
              <div className="space-y-1 pt-1">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                  Quick Select (Registered Techs):
                </span>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleDirectLogin('0729744526')}
                    className="px-2.5 py-1 bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 rounded-lg text-[11px] font-bold text-slate-700 border border-slate-200 transition"
                  >
                    ⚡ Nilanga (072 974 4526)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDirectLogin('0774567890')}
                    className="px-2.5 py-1 bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 rounded-lg text-[11px] font-bold text-slate-700 border border-slate-200 transition"
                  >
                    ⚡ Janadara (077 456 7890)
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-xs rounded-xl shadow-md shadow-emerald-200 disabled:opacity-50 transition flex items-center justify-center gap-2 cursor-pointer mt-2"
              >
                {loading ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>SEND SMS VERIFICATION CODE</span>
                  </>
                )}
              </button>
            </form>
          ) : (
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Enter 6-Digit SMS Code</span>
                </label>
                <input
                  type="text"
                  maxLength={6}
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="• • • • • •"
                  autoFocus
                  required
                  className="w-full py-3 bg-slate-50 text-slate-900 text-center text-2xl tracking-[0.5em] rounded-xl border border-slate-200 focus:bg-white focus:border-emerald-500 focus:outline-hidden font-mono font-black"
                />
              </div>

              {smsFeedback && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>{smsFeedback.message}</span>
                  </div>
                  {smsFeedback.debugCode && (
                    <span className="font-mono font-black text-emerald-900 bg-emerald-200 px-2 py-0.5 rounded-md border border-emerald-400">
                      {smsFeedback.debugCode}
                    </span>
                  )}
                </div>
              )}

              <div className="flex items-center justify-between text-xs pt-1">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="text-slate-500 hover:text-slate-800 underline"
                >
                  Change Number
                </button>
                <button
                  type="button"
                  disabled={countdown > 0 || loading}
                  onClick={handleRequestOtp}
                  className="text-emerald-600 hover:underline disabled:text-slate-400 disabled:no-underline font-semibold"
                >
                  {countdown > 0 ? `Resend SMS in ${countdown}s` : 'Resend Code'}
                </button>
              </div>

              <button
                type="submit"
                disabled={loading || otpCode.length < 6}
                className="w-full py-3.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-xs rounded-xl shadow-md shadow-emerald-200 disabled:opacity-50 transition flex items-center justify-center gap-2 cursor-pointer mt-2"
              >
                {loading ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>VERIFY & OPEN TECHNICIAN APP</span>
                  </>
                )}
              </button>
            </form>
          )}

          <div className="text-[10px] text-slate-400 text-center flex items-center justify-center gap-1 pt-1">
            <Shield className="w-3 h-3 text-emerald-500" />
            <span>Permanent 1-Time Session. Stored securely on this device.</span>
          </div>
        </div>

      </div>
    </div>
  );
}
