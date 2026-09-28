import React, { useState, useEffect } from 'react';
import {
  ShieldCheck, Lock, User, Phone, Key, Smartphone,
  CheckCircle2, AlertCircle, ArrowRight, Eye, EyeOff,
  Sparkles, RefreshCw, Send, Check, Shield, HelpCircle
} from 'lucide-react';
import { getSavedBranding, fetchServerBranding, PresetLogoIcon } from '../components/BrandingSettingsModal';

export default function LoginPortal({ onLoginSuccess, technicianOnly = false }) {
  const isTechOnly = technicianOnly ||
    (typeof window !== 'undefined' && (
      window.location.pathname.startsWith('/tech') ||
      window.location.search.includes('tech') ||
      window.location.search.includes('job')
    ));

  const [branding, setBranding] = useState(getSavedBranding());
  const [authMethod, setAuthMethod] = useState(() => isTechOnly ? 'sms_otp' : 'password');

  // Password Sign-In State
  const [selectedRole, setSelectedRole] = useState('ADMIN');
  const [identifier, setIdentifier] = useState('admin');
  const [password, setPassword] = useState('admin123');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordError, setPasswordError] = useState(null);

  // SMS OTP Sign-In State (For Technicians)
  const [phone, setPhone] = useState('0729744526');
  const [otpStep, setOtpStep] = useState(1); // 1: Enter phone, 2: Enter OTP
  const [otpCode, setOtpCode] = useState('');
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpError, setOtpError] = useState(null);
  const [otpFeedback, setOtpFeedback] = useState(null);
  const [countdown, setCountdown] = useState(0);

  useEffect(() => {
    fetchServerBranding().then(b => { if (b) setBranding(b); });
    const handleBranding = (e) => setBranding(e.detail || getSavedBranding());
    window.addEventListener('branding-updated', handleBranding);
    return () => window.removeEventListener('branding-updated', handleBranding);
  }, []);

  // Timer for OTP resend countdown
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  // Handle Password Sign-In
  const handlePasswordLogin = async (e) => {
    if (e) e.preventDefault();
    if (!identifier.trim() || !password) {
      setPasswordError('Please enter your username, phone, or email, and password.');
      return;
    }

    setPasswordLoading(true);
    setPasswordError(null);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifier: identifier.trim(),
          password,
          role: selectedRole !== 'ALL' ? selectedRole : undefined,
          device_info: {
            userAgent: navigator.userAgent,
            platform: navigator.platform
          }
        })
      });

      const text = await res.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch (pErr) {
        throw new Error(`Server returned error (${res.status}): Please check backend configuration.`);
      }

      if (!data.success) {
        throw new Error(data.error || 'Login failed. Please check your credentials.');
      }

      // Save token
      if (rememberMe) {
        localStorage.setItem('auth_token', data.token);
        localStorage.setItem('auth_user', JSON.stringify(data.user));
      } else {
        sessionStorage.setItem('auth_token', data.token);
        sessionStorage.setItem('auth_user', JSON.stringify(data.user));
      }

      if (data.user.role === 'TECHNICIAN') {
        localStorage.setItem('tech_preferred_id', String(data.user.id));
      }

      onLoginSuccess(data.user, data.token);
    } catch (err) {
      setPasswordError(err.message);
    } finally {
      setPasswordLoading(false);
    }
  };

  // Handle Request SMS OTP (Technicians)
  const handleRequestOtp = async (e) => {
    if (e) e.preventDefault();
    const cleanDigits = phone.replace(/\D/g, '');
    if (cleanDigits.length < 9) {
      setOtpError('Please enter a valid Sri Lankan mobile number (e.g. 0729744526).');
      return;
    }

    setOtpLoading(true);
    setOtpError(null);
    setOtpFeedback(null);

    try {
      const res = await fetch('/api/tech-auth/request-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: cleanDigits })
      });

      const text = await res.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch (pErr) {
        throw new Error(`Server returned error (${res.status}): Please check backend configuration.`);
      }

      if (!data.success) {
        throw new Error(data.error || 'Failed to dispatch verification code.');
      }

      setOtpStep(2);
      setCountdown(60);
      setOtpFeedback({
        message: data.message || `Code sent to ${phone}!`,
        debugCode: data.debugCode
      });
      if (data.debugCode) {
        setOtpCode(data.debugCode);
      }
    } catch (err) {
      setOtpError(err.message);
    } finally {
      setOtpLoading(false);
    }
  };

  // Handle Verify SMS OTP (Technicians)
  const handleVerifyOtp = async (e) => {
    if (e) e.preventDefault();
    if (!otpCode || otpCode.trim().length < 6) {
      setOtpError('Please enter the 6-digit verification code received by SMS.');
      return;
    }

    setOtpLoading(true);
    setOtpError(null);

    try {
      const res = await fetch('/api/tech-auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: phone.replace(/\D/g, ''),
          otp_code: otpCode.trim(),
          device_info: {
            userAgent: navigator.userAgent,
            platform: navigator.platform
          }
        })
      });

      const text = await res.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch (pErr) {
        throw new Error(`Server returned error (${res.status}): Please check backend configuration.`);
      }

      if (!data.success) {
        throw new Error(data.error || 'Verification failed. Please check the code.');
      }

      localStorage.setItem('auth_token', data.token);
      localStorage.setItem('auth_user', JSON.stringify({
        ...data.technician,
        role: 'TECHNICIAN'
      }));
      localStorage.setItem('tech_preferred_id', String(data.technician.id));

      onLoginSuccess({
        ...data.technician,
        role: 'TECHNICIAN'
      }, data.token);
    } catch (err) {
      setOtpError(err.message);
    } finally {
      setOtpLoading(false);
    }
  };

  // Direct 1-Click Fast Sign-In
  const quickLogin = async (u, p, role = 'ALL') => {
    setAuthMethod('password');
    setIdentifier(u);
    setPassword(p);
    setSelectedRole(role);
    setPasswordLoading(true);
    setPasswordError(null);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifier: u,
          password: p,
          role: role !== 'ALL' ? role : undefined,
          device_info: {
            userAgent: navigator.userAgent,
            platform: navigator.platform
          }
        })
      });

      const text = await res.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch (pErr) {
        throw new Error(`Server returned error (${res.status}): Please check backend configuration.`);
      }

      if (!data.success) {
        throw new Error(data.error || 'Login failed. Please check your credentials.');
      }

      if (rememberMe) {
        localStorage.setItem('auth_token', data.token);
        localStorage.setItem('auth_user', JSON.stringify(data.user));
      } else {
        sessionStorage.setItem('auth_token', data.token);
        sessionStorage.setItem('auth_user', JSON.stringify(data.user));
      }

      if (data.user.role === 'TECHNICIAN') {
        localStorage.setItem('tech_preferred_id', String(data.user.id));
      }

      onLoginSuccess(data.user, data.token);
    } catch (err) {
      setPasswordError(err.message);
    } finally {
      setPasswordLoading(false);
    }
  };

  // Quick Demo Account Clicker
  const fillPreset = (u, p, role = 'ALL') => {
    setAuthMethod('password');
    setIdentifier(u);
    setPassword(p);
    setSelectedRole(role);
    setPasswordError(null);
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center p-4 sm:p-6 relative overflow-hidden font-sans selection:bg-emerald-500 selection:text-white">
      {/* Pest Control Themed Background Image Layer */}
      <div 
        className="absolute inset-0 bg-cover bg-center bg-no-repeat pointer-events-none scale-105 transform transition-transform duration-1000"
        style={{ backgroundImage: `url('/pest-login-bg.jpg')` }}
      />
      {/* Dark Ambient Overlays & Vignette for Contrast & Readability */}
      <div className="absolute inset-0 bg-slate-950/80 pointer-events-none" />
      <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/70 to-slate-950/90 pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(2,6,23,0.85)_100%)] pointer-events-none" />

      {/* Dynamic Background Glows */}
      <div className="absolute top-1/4 -left-20 w-96 h-96 bg-emerald-500/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 -right-20 w-96 h-96 bg-indigo-500/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-4xl h-96 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-md w-full relative z-10 space-y-6">

        {/* Company Header & Logo */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center justify-center p-3 rounded-3xl bg-gradient-to-tr from-slate-900 to-slate-800 border border-slate-700/80 shadow-2xl shadow-emerald-950/40">
            {branding?.logoType === 'custom' && branding?.customLogoUrl ? (
              <img
                src={branding.customLogoUrl}
                alt={branding.companyName}
                className="w-12 h-12 object-contain rounded-2xl"
              />
            ) : (
              <PresetLogoIcon
                iconKey={branding?.presetIcon || 'shield'}
                color={branding?.primaryColor || '#10b981'}
                className="w-10 h-10"
              />
            )}
          </div>

          <div>
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              {isTechOnly ? 'Field Technician App' : (branding?.companyName || 'Ceylon Pest Management')}
            </h1>
            <p className="text-xs text-slate-400 mt-1 font-medium">
              {isTechOnly ? '1-Time SMS OTP Mobile Verification' : 'Enterprise Operations & Field Technician System'}
            </p>
          </div>
        </div>

        {/* Auth Method Switcher Tabs (Only visible for Office Staff / Admins, NOT on Technician App) */}
        {!isTechOnly && (
          <div className="bg-slate-900/90 backdrop-blur-xl p-1.5 rounded-2xl border border-slate-800 flex shadow-xl">
            <button
              type="button"
              onClick={() => {
                setAuthMethod('password');
                setPasswordError(null);
              }}
              className={`flex-1 py-2 px-3 rounded-xl font-bold text-xs transition flex items-center justify-center gap-2 ${
                authMethod === 'password'
                  ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Key className="w-3.5 h-3.5" />
              <span>Staff Password Sign-In</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setAuthMethod('sms_otp');
                setOtpError(null);
              }}
              className={`flex-1 py-2 px-3 rounded-xl font-bold text-xs transition flex items-center justify-center gap-2 ${
                authMethod === 'sms_otp'
                  ? 'bg-gradient-to-r from-indigo-600 to-teal-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Smartphone className="w-3.5 h-3.5 text-amber-300" />
              <span>Technician SMS OTP</span>
            </button>
          </div>
        )}

        {/* Main Card */}
        <div className="relative bg-slate-900/90 backdrop-blur-2xl p-6 sm:p-7 rounded-3xl border border-slate-700/60 shadow-2xl shadow-black/80 overflow-hidden">
          {/* Subtle Pest Control Concept Accent Overlay inside card */}
          <div 
            className="absolute inset-0 bg-cover bg-center opacity-10 pointer-events-none mix-blend-luminosity filter blur-[0.5px]"
            style={{ backgroundImage: `url('/pest-login-bg.jpg')` }}
          />
          <div className="relative z-10 space-y-5">

          {/* TAB 1: ALL ROLES PASSWORD LOGIN */}
          {authMethod === 'password' && (
            <form onSubmit={handlePasswordLogin} className="space-y-4">
              <div>
                <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-2">
                  Choose Login Role: Admin or Operations Manager
                </label>

                {/* Primary Dual Switcher Cards: Administrator vs Operations Manager */}
                <div className="grid grid-cols-2 gap-2.5 mb-3">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedRole('ADMIN');
                      setIdentifier('admin');
                      setPassword('admin123');
                      setPasswordError(null);
                    }}
                    className={`p-3 rounded-2xl border text-left transition-all relative overflow-hidden group cursor-pointer ${
                      selectedRole === 'ADMIN'
                        ? 'bg-gradient-to-br from-emerald-500/20 via-slate-900 to-teal-500/10 border-emerald-500 ring-2 ring-emerald-500/40 shadow-lg shadow-emerald-950/40'
                        : 'bg-slate-950/70 border-slate-800 hover:border-slate-700 text-slate-400'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xl">👑</span>
                      {selectedRole === 'ADMIN' && (
                        <span className="px-1.5 py-0.5 rounded-full bg-emerald-500/30 text-emerald-300 text-[9px] font-black uppercase tracking-wider border border-emerald-500/50">
                          Active
                        </span>
                      )}
                    </div>
                    <div className="mt-2">
                      <div className="font-bold text-white text-xs flex items-center gap-1">
                        <span>Administrator</span>
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5">Full System Access</div>
                    </div>
                    <div className="mt-2 pt-1.5 border-t border-slate-800/80 flex items-center justify-between text-[10px] text-slate-500 font-mono">
                      <span>admin</span>
                      <span className="text-emerald-400 font-bold group-hover:underline">Select &rarr;</span>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setSelectedRole('MANAGER');
                      setIdentifier('manager');
                      setPassword('manager123');
                      setPasswordError(null);
                    }}
                    className={`p-3 rounded-2xl border text-left transition-all relative overflow-hidden group cursor-pointer ${
                      selectedRole === 'MANAGER'
                        ? 'bg-gradient-to-br from-blue-500/20 via-slate-900 to-indigo-500/10 border-blue-500 ring-2 ring-blue-500/40 shadow-lg shadow-blue-950/40'
                        : 'bg-slate-950/70 border-slate-800 hover:border-slate-700 text-slate-400'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xl">📊</span>
                      {selectedRole === 'MANAGER' && (
                        <span className="px-1.5 py-0.5 rounded-full bg-blue-500/30 text-blue-300 text-[9px] font-black uppercase tracking-wider border border-blue-500/50">
                          Active
                        </span>
                      )}
                    </div>
                    <div className="mt-2">
                      <div className="font-bold text-white text-xs flex items-center gap-1">
                        <span>Operations Manager</span>
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5">Schedules & Operations</div>
                    </div>
                    <div className="mt-2 pt-1.5 border-t border-slate-800/80 flex items-center justify-between text-[10px] text-slate-500 font-mono">
                      <span>manager</span>
                      <span className="text-blue-400 font-bold group-hover:underline">Select &rarr;</span>
                    </div>
                  </button>
                </div>

                {/* Direct 1-Click Fast Sign-In Buttons */}
                <div className="flex items-center gap-2 mb-3">
                  <button
                    type="button"
                    disabled={passwordLoading}
                    onClick={() => quickLogin('admin', 'admin123', 'ADMIN')}
                    className="flex-1 py-2 px-3 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/40 text-emerald-300 font-bold text-[11px] flex items-center justify-center gap-1.5 transition cursor-pointer active:scale-95"
                  >
                    <span>👑 1-Click Admin Sign-In</span>
                  </button>
                  <button
                    type="button"
                    disabled={passwordLoading}
                    onClick={() => quickLogin('manager', 'manager123', 'MANAGER')}
                    className="flex-1 py-2 px-3 rounded-xl bg-blue-500/15 hover:bg-blue-500/25 border border-blue-500/40 text-blue-300 font-bold text-[11px] flex items-center justify-center gap-1.5 transition cursor-pointer active:scale-95"
                  >
                    <span>📊 1-Click Ops Manager</span>
                  </button>
                </div>

                {/* Secondary Role Filter Bar */}
                <div className="grid grid-cols-4 gap-1 text-[10px] font-bold">
                  {[
                    { id: 'ALL', label: 'All Roles' },
                    { id: 'SUPERVISOR', label: 'Supervisor' },
                    { id: 'TECHNICIAN', label: 'Technician' },
                    { id: 'SALESMAN', label: 'Salesman' }
                  ].map(r => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => {
                        setSelectedRole(r.id);
                        if (r.id === 'SUPERVISOR') { setIdentifier('supervisor'); setPassword('supervisor123'); }
                        else if (r.id === 'TECHNICIAN') { setIdentifier('nilanga'); setPassword('tech123'); }
                        else if (r.id === 'SALESMAN') { setIdentifier('pubudu'); setPassword('sales123'); }
                      }}
                      className={`py-1.5 px-1.5 rounded-lg border text-center transition ${
                        selectedRole === r.id
                          ? 'bg-slate-700 text-white border-slate-500'
                          : 'bg-slate-900/60 text-slate-400 border-slate-800 hover:bg-slate-800'
                      }`}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                  Username / Phone / Email
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder="e.g. admin or 0729744526"
                    className="w-full bg-slate-950 text-white text-xs pl-10 pr-3.5 py-3 rounded-xl border border-slate-700 focus:outline-hidden focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition placeholder:text-slate-600 font-medium"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter account password"
                    className="w-full bg-slate-950 text-white text-xs pl-10 pr-10 py-3 rounded-xl border border-slate-700 focus:outline-hidden focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition placeholder:text-slate-600 font-medium"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs text-slate-400 pt-1">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-4 h-4 rounded-sm bg-slate-950 border-slate-700 text-emerald-600 focus:ring-0 cursor-pointer"
                  />
                  <span>Keep me logged in</span>
                </label>
              </div>

              {passwordError && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <span>{passwordError}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={passwordLoading}
                className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-500 hover:from-emerald-500 hover:to-teal-400 disabled:opacity-50 text-white font-black text-xs uppercase tracking-wider shadow-lg shadow-emerald-950/50 flex items-center justify-center gap-2 active:scale-98 transition cursor-pointer"
              >
                {passwordLoading ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <span>SIGN IN TO SYSTEM</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          )}

          {/* TAB 2: TECHNICIAN 1-TIME SMS OTP LOGIN */}
          {authMethod === 'sms_otp' && (
            <div className="space-y-4">
              <div className="text-center pb-2">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 text-[10px] font-black uppercase tracking-wider">
                  <Sparkles className="w-3 h-3 text-amber-300" />
                  Passwordless 1-Time Verification
                </span>
                <p className="text-xs text-slate-400 mt-2">
                  {otpStep === 1
                    ? 'Enter your registered technician mobile phone to receive a 6-digit SMS verification code.'
                    : `Enter the 6-digit code sent to ${phone}.`}
                </p>
              </div>

              {otpStep === 1 ? (
                <form onSubmit={handleRequestOtp} className="space-y-4">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                      Technician Mobile Number
                    </label>
                    <div className="relative">
                      <Phone className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="tel"
                        required
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="e.g. 0729744526"
                        className="w-full bg-slate-950 text-white text-xs pl-10 pr-3.5 py-3 rounded-xl border border-slate-700 focus:outline-hidden focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition font-mono placeholder:text-slate-600"
                      />
                    </div>
                  </div>

                  {otpError && (
                    <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                      <span>{otpError}</span>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={otpLoading}
                    className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-indigo-600 via-teal-600 to-emerald-600 hover:from-indigo-500 hover:to-emerald-500 disabled:opacity-50 text-white font-black text-xs uppercase tracking-wider shadow-lg shadow-indigo-950/50 flex items-center justify-center gap-2 active:scale-98 transition cursor-pointer"
                  >
                    {otpLoading ? (
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
                  <div>
                    <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                      6-Digit SMS Verification Code
                    </label>
                    <input
                      type="text"
                      maxLength={6}
                      required
                      autoFocus
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                      placeholder="• • • • • •"
                      className="w-full bg-slate-950 text-white text-center text-2xl tracking-[0.5em] py-3 rounded-xl border border-slate-700 focus:outline-hidden focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500 font-mono"
                    />
                  </div>

                  {otpFeedback && (
                    <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                        <span>{otpFeedback.message}</span>
                      </div>
                      {otpFeedback.debugCode && (
                        <span className="font-mono font-black text-emerald-200 bg-emerald-950 px-2 py-0.5 rounded-md border border-emerald-500/40">
                          {otpFeedback.debugCode}
                        </span>
                      )}
                    </div>
                  )}

                  {otpError && (
                    <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                      <span>{otpError}</span>
                    </div>
                  )}

                  <div className="flex items-center justify-between text-xs pt-1">
                    <button
                      type="button"
                      onClick={() => setOtpStep(1)}
                      className="text-slate-400 hover:text-white underline"
                    >
                      Change Phone Number
                    </button>
                    <button
                      type="button"
                      disabled={countdown > 0 || otpLoading}
                      onClick={handleRequestOtp}
                      className="text-emerald-400 hover:underline disabled:text-slate-600 disabled:no-underline font-semibold"
                    >
                      {countdown > 0 ? `Resend SMS in ${countdown}s` : 'Resend Code'}
                    </button>
                  </div>

                  <button
                    type="submit"
                    disabled={otpLoading || otpCode.length < 6}
                    className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 text-white font-black text-xs uppercase tracking-wider shadow-lg shadow-emerald-950/50 flex items-center justify-center gap-2 active:scale-98 transition cursor-pointer"
                  >
                    {otpLoading ? (
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
            </div>
          )}

          </div>
        </div>

        {/* Quick Demo Credentials Switcher (Only visible for Office Staff / Admins, NEVER on Technician App) */}
        {!isTechOnly && (
          <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 text-xs space-y-2.5">
            <div className="flex items-center justify-between text-slate-400 font-bold text-[11px] uppercase tracking-wider">
              <span>Quick 1-Click Demo Accounts</span>
              <span className="text-[10px] text-slate-500">Click to fill</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => fillPreset('admin', 'admin123', 'ADMIN')}
                className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 text-left transition"
              >
                <div className="font-bold text-white text-[11px] flex items-center gap-1">
                  <span>👑 Admin</span>
                </div>
                <div className="text-[10px] text-slate-400 font-mono mt-0.5">admin123</div>
              </button>

              <button
                type="button"
                onClick={() => fillPreset('manager', 'manager123', 'MANAGER')}
                className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 text-left transition"
              >
                <div className="font-bold text-white text-[11px] flex items-center gap-1">
                  <span>📊 Ops Manager</span>
                </div>
                <div className="text-[10px] text-slate-400 font-mono mt-0.5">manager123</div>
              </button>

              <button
                type="button"
                onClick={() => fillPreset('dilhan', 'manager123', 'MANAGER')}
                className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 text-left transition"
              >
                <div className="font-bold text-blue-400 text-[11px] flex items-center gap-1">
                  <span>👔 Dilhan (Mgr)</span>
                </div>
                <div className="text-[10px] text-slate-400 font-mono mt-0.5">manager123</div>
              </button>

              <button
                type="button"
                onClick={() => fillPreset('supervisor', 'supervisor123', 'SUPERVISOR')}
                className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 text-left transition"
              >
                <div className="font-bold text-white text-[11px] flex items-center gap-1">
                  <span>🛡️ Supervisor</span>
                </div>
                <div className="text-[10px] text-slate-400 font-mono mt-0.5">supervisor123</div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setAuthMethod('sms_otp');
                  setPhone('0729744526');
                  setOtpStep(1);
                  setOtpError(null);
                }}
                className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 text-left transition"
              >
                <div className="font-bold text-emerald-400 text-[11px] flex items-center gap-1">
                  <span>📱 Tech Nilanga</span>
                </div>
                <div className="text-[10px] text-slate-400 font-mono mt-0.5">072 974 4526</div>
              </button>

              <button
                type="button"
                onClick={() => fillPreset('nilanga', 'tech123', 'TECHNICIAN')}
                className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 text-left transition"
              >
                <div className="font-bold text-white text-[11px] flex items-center gap-1">
                  <span>👷 Tech Pass</span>
                </div>
                <div className="text-[10px] text-slate-400 font-mono mt-0.5">tech123</div>
              </button>

              <button
                type="button"
                onClick={() => fillPreset('pubudu', 'sales123', 'SALESMAN')}
                className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 text-left transition"
              >
                <div className="font-bold text-white text-[11px] flex items-center gap-1">
                  <span>💼 Salesman</span>
                </div>
                <div className="text-[10px] text-slate-400 font-mono mt-0.5">sales123</div>
              </button>
            </div>
          </div>
        )}

        {isTechOnly && (
          <div className="text-center pt-1">
            <a href="/" className="text-xs text-slate-500 hover:text-emerald-400 transition font-medium">
              Administrator / Office Staff Sign-In &rarr;
            </a>
          </div>
        )}

      </div>
    </div>
  );
}
