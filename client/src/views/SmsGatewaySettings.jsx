import React, { useState, useEffect } from 'react';
import {
  Radio, Shield, Smartphone, Send, CheckCircle2, AlertTriangle,
  RefreshCw, Info, Key, Globe, DollarSign, ListFilter, Copy, Check
} from 'lucide-react';
import {
  getSmsSettings,
  updateSmsSettings,
  sendTestSms,
  getSmsLogs,
  validatePhone
} from '../api';

export default function SmsGatewaySettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [providers, setProviders] = useState([]);
  const [stats, setStats] = useState({});
  const [logs, setLogs] = useState([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [copiedLogId, setCopiedLogId] = useState(null);

  // Form State
  const [formData, setFormData] = useState({
    provider: 'TEXT_LK',
    sender_id: 'TextLKDemo',
    api_key: '',
    api_token: '',
    user_id: '',
    password: '',
    endpoint_url: '',
    system_url: typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5000',
    is_simulation: 1,
    is_active: 1
  });

  // Test Console State
  const [testPhone, setTestPhone] = useState('0771234567');
  const [testMessage, setTestMessage] = useState('PestControl Pro: Test verification from your Sri Lanka SMS gateway.');
  const [testResult, setTestResult] = useState(null);
  const [phoneMeta, setPhoneMeta] = useState(null);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [settingsRes, logsRes] = await Promise.all([
        getSmsSettings(),
        getSmsLogs({ limit: 25, status: statusFilter })
      ]);

      if (settingsRes.success) {
        setProviders(settingsRes.providers || []);
        setStats(settingsRes.stats || {});
        if (settingsRes.settings) {
          setFormData({
            provider: settingsRes.settings.provider || 'TEXT_LK',
            sender_id: settingsRes.settings.sender_id || 'TextLKDemo',
            api_key: settingsRes.settings.api_key || '',
            api_token: settingsRes.settings.api_token || '',
            user_id: settingsRes.settings.user_id || '',
            password: settingsRes.settings.password || '',
            endpoint_url: settingsRes.settings.endpoint_url || '',
            system_url: settingsRes.settings.system_url || (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5000'),
            is_simulation: settingsRes.settings.is_simulation ? 1 : 0,
            is_active: settingsRes.settings.is_active ? 1 : 0
          });
        }
      }

      if (logsRes.success) {
        setLogs(logsRes.logs || []);
      }
    } catch (e) {
      console.error('Error loading SMS settings:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [statusFilter]);

  // Real-time phone check
  useEffect(() => {
    if (testPhone && testPhone.length >= 9) {
      validatePhone(testPhone)
        .then(res => setPhoneMeta(res))
        .catch(() => setPhoneMeta(null));
    } else {
      setPhoneMeta(null);
    }
  }, [testPhone]);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setSaveSuccessMsg(null);
    try {
      const res = await updateSmsSettings(formData);
      if (res.success) {
        setSaveSuccessMsg('SMS Gateway configuration updated successfully!');
        setTimeout(() => setSaveSuccessMsg(null), 4000);
        loadData();
      }
    } catch (err) {
      alert(`Save Error: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleTestSend = async (e) => {
    e.preventDefault();
    setTesting(true);
    setTestResult(null);
    try {
      const res = await sendTestSms(testPhone, testMessage);
      setTestResult(res);
      loadData();
    } catch (err) {
      setTestResult({ success: false, error: err.message });
    } finally {
      setTesting(false);
    }
  };

  const copyToClipboard = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopiedLogId(id);
    setTimeout(() => setCopiedLogId(null), 2000);
  };

  const currentProviderInfo = providers.find(p => p.id === formData.provider) || {};

  if (loading && providers.length === 0) {
    return (
      <div className="p-12 text-center text-slate-400 text-xs flex items-center justify-center gap-2">
        <RefreshCw className="w-4 h-4 animate-spin text-emerald-600" />
        <span>Loading Sri Lanka SMS Gateway configuration...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* Overview Analytics Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Dispatches</span>
          <div className="text-2xl font-black text-slate-900 mt-0.5">{stats.total_dispatched || 0}</div>
          <span className="text-[11px] text-slate-500 mt-0.5">Automated SMS attempts</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
          <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider flex items-center gap-1">
            <Radio className="w-3.5 h-3.5" /> Live Sent
          </span>
          <div className="text-2xl font-black text-emerald-600 mt-0.5">{stats.total_sent || 0}</div>
          <span className="text-[11px] text-emerald-600 mt-0.5">Direct telco network</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
          <span className="text-[10px] font-bold text-amber-500 uppercase tracking-wider">Simulated Sandbox</span>
          <div className="text-2xl font-black text-amber-600 mt-0.5">{stats.total_simulated || 0}</div>
          <span className="text-[11px] text-amber-500 mt-0.5">Test mode (0 credits spent)</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
          <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-wider flex items-center gap-1">
            <DollarSign className="w-3.5 h-3.5" /> Est. Cost (LKR)
          </span>
          <div className="text-2xl font-black text-indigo-600 mt-0.5">Rs. {(stats.total_cost_lkr || 0).toFixed(2)}</div>
          <span className="text-[11px] text-slate-500 mt-0.5">Estimated telecom expense</span>
        </div>
      </div>

      {/* Main Configuration Card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-5 sm:p-6 space-y-6">

        <div>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="font-bold text-slate-900 text-base sm:text-lg flex items-center gap-2">
                <span>🇱🇰 Sri Lanka SMS Gateway Configuration</span>
                <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-bold">
                  {formData.is_simulation ? 'Simulation Sandbox Active' : 'Live Carrier Mode'}
                </span>
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Configure your Sri Lankan telecom provider for 24h client service reminders, same-day technician arrival alerts, and customer notifications.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <label className="flex items-center gap-2 text-xs font-bold text-slate-700 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl cursor-pointer">
                <input
                  type="checkbox"
                  checked={Boolean(formData.is_simulation)}
                  onChange={(e) => setFormData({ ...formData, is_simulation: e.target.checked ? 1 : 0 })}
                  className="rounded text-emerald-600 focus:ring-0"
                />
                <span>Simulation Mode (Safe Testing)</span>
              </label>
            </div>
          </div>
        </div>

        {saveSuccessMsg && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{saveSuccessMsg}</span>
          </div>
        )}

        {!formData.is_simulation && !formData.api_key && (
          <div className="p-4 bg-amber-50 border border-amber-200 text-amber-900 rounded-xl text-xs space-y-1.5">
            <div className="font-bold flex items-center gap-1.5 text-amber-800">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              <span>Live Carrier Mode Active — API Credentials Required</span>
            </div>
            <p className="text-amber-700 leading-relaxed">
              To deliver real SMS to Sri Lankan phones via <strong>{currentProviderInfo.name || 'your provider'}</strong>, you must enter your registered <strong>API Key</strong> and <strong>User ID</strong> below and click <em>Save SMS Gateway Configuration</em>.
            </p>
            <p className="text-amber-700">
              💡 <em>Don't have an SMS provider account yet?</em> Check <strong>Simulation Mode</strong> to safely test without credits, or use <strong>WhatsApp Direct Dispatch</strong> in the Reminders tab (100% free & live).
            </p>
          </div>
        )}

        {/* Gateway Selection Cards */}
        <div className="space-y-2">
          <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Select SMS Provider</label>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {providers.map((p) => {
              const isSelected = formData.provider === p.id;
              return (
                <div
                  key={p.id}
                  onClick={() => setFormData({ ...formData, provider: p.id })}
                  className={`p-4 rounded-xl border-2 cursor-pointer transition text-left relative ${
                    isSelected
                      ? 'border-emerald-600 bg-emerald-50/40 ring-2 ring-emerald-600/20'
                      : 'border-slate-200 hover:border-slate-300 bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900 text-xs sm:text-sm">{p.name}</span>
                    <span className="text-[10px] font-bold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                      {p.badge}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1 line-clamp-2">{p.description}</p>
                  <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] font-semibold text-slate-500">
                    <span>Est. Rate: <strong className="text-slate-800">{p.approxCostPerSms}</strong></span>
                    {isSelected && <span className="text-emerald-700 font-bold flex items-center gap-0.5">● Active</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Credentials Form */}
        <form onSubmit={handleSave} className="space-y-4 pt-2 border-t border-slate-100">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">

            {/* Sender ID / Mask */}
            <div>
              <label className="font-bold text-slate-700 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Smartphone className="w-3.5 h-3.5 text-slate-400" />
                  <span>Sender Mask / Sender ID</span>
                </span>
                {formData.provider === 'TEXT_LK' && (
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, sender_id: 'TextLKDemo' })}
                    className="text-[10px] text-emerald-600 hover:text-emerald-700 font-bold hover:underline"
                  >
                    Use TextLKDemo
                  </button>
                )}
              </label>
              <input
                type="text"
                value={formData.sender_id}
                onChange={(e) => {
                  let val = e.target.value;
                  if (formData.provider === 'TEXT_LK' && val.toUpperCase() === 'TEXTLKDEMO') {
                    val = 'TextLKDemo';
                  }
                  setFormData({ ...formData, sender_id: val });
                }}
                placeholder={formData.provider === 'TEXT_LK' ? 'TextLKDemo' : 'PESTCONTROL'}
                maxLength={11}
                required
                className="w-full mt-1.5 p-2.5 bg-slate-50 rounded-xl border border-slate-200 focus:outline-hidden font-mono"
              />
              <span className="text-[10px] text-slate-400 mt-0.5 block">
                {formData.provider === 'TEXT_LK'
                  ? 'Note: Text.lk Demo requires exact case: TextLKDemo. Custom IDs must match your Text.lk Dashboard.'
                  : 'Approved telecom alphanumeric mask (max 11 chars)'}
              </span>
            </div>

            {/* User ID / Account ID */}
            <div>
              <label className="font-bold text-slate-700 flex items-center gap-1.5">
                <Key className="w-3.5 h-3.5 text-slate-400" />
                <span>User ID / Account ID {currentProviderInfo.requiresPassword && '*'}</span>
              </label>
              <input
                type="text"
                value={formData.user_id}
                onChange={(e) => setFormData({ ...formData, user_id: e.target.value })}
                placeholder="e.g. 10452 or company_account"
                className="w-full mt-1.5 p-2.5 bg-slate-50 rounded-xl border border-slate-200 focus:outline-hidden font-mono"
              />
              <span className="text-[10px] text-slate-400 mt-0.5 block">Required for Notify.lk and Mobitel Enterprise</span>
            </div>

            {/* API Key / Token */}
            <div>
              <label className="font-bold text-slate-700 flex items-center gap-1.5">
                <Key className="w-3.5 h-3.5 text-slate-400" />
                <span>
                  {formData.provider === 'TEXT_LK' ? 'Text.lk API Token (Bearer Token) *' : 'API Key / Secret Token'}
                </span>
              </label>
              <input
                type="password"
                value={formData.api_key}
                onChange={(e) => setFormData({ ...formData, api_key: e.target.value })}
                placeholder={formData.provider === 'TEXT_LK' ? 'Paste Text.lk Bearer Token' : 'Enter provider API key'}
                className="w-full mt-1.5 p-2.5 bg-slate-50 rounded-xl border border-slate-200 focus:outline-hidden font-mono"
              />
              <span className="text-[10px] text-slate-400 mt-0.5 block">
                {formData.provider === 'TEXT_LK'
                  ? 'Find under: app.text.lk → Developers → API Token'
                  : 'Encrypted & securely stored locally'}
              </span>
            </div>

            {/* Password (if Dialog/Mobitel) */}
            <div>
              <label className="font-bold text-slate-700 flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-slate-400" />
                <span>Account Password / Auth Token</span>
              </label>
              <input
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                placeholder="Account password for telco API"
                className="w-full mt-1.5 p-2.5 bg-slate-50 rounded-xl border border-slate-200 focus:outline-hidden font-mono"
              />
              <span className="text-[10px] text-slate-400 mt-0.5 block">Used for Dialog Axiata & Mobitel HTTP Basic Auth</span>
            </div>

            {/* Live System Public URL / Domain */}
            <div className="sm:col-span-2">
              <div className="flex flex-wrap items-center justify-between gap-1 mb-1">
                <label className="font-bold text-slate-700 flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5 text-blue-500" />
                  <span>Public Live System URL (Used in Technician Links & Customer SMS)</span>
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, system_url: 'https://jaguar-starsmerchant-michael-soundtrack.trycloudflare.com' })}
                    className="text-[10px] bg-blue-50 text-blue-700 px-2 py-0.5 rounded font-bold hover:bg-blue-100 transition"
                  >
                    ⚡ Use Live Tunnel (4G/Mobile)
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, system_url: 'http://192.168.1.12:3000' })}
                    className="text-[10px] bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded font-bold hover:bg-emerald-100 transition"
                  >
                    📶 Use Wi-Fi IP
                  </button>
                </div>
              </div>
              <input
                type="text"
                value={formData.system_url}
                onChange={(e) => setFormData({ ...formData, system_url: e.target.value })}
                placeholder="https://yourdomain.lk or https://...trycloudflare.com or http://192.168.1.12:3000"
                className="w-full p-2.5 bg-slate-50 rounded-xl border border-slate-200 focus:outline-hidden font-mono text-xs"
              />
              <span className="text-[10px] text-slate-500 mt-1 block">
                <strong>Important:</strong> Do not use <code>localhost</code> for mobile phone links. Use the <strong>Live Tunnel</strong> URL for any phone on 4G mobile data, or <strong>Wi-Fi IP</strong> if both your PC and phone are on the same Wi-Fi.
              </span>
            </div>

            {/* Endpoint URL */}
            <div className="sm:col-span-2">
              <label className="font-bold text-slate-700 flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-slate-400" />
                <span>Gateway Endpoint URL (Optional override or Custom URL)</span>
              </label>
              <input
                type="text"
                value={formData.endpoint_url}
                onChange={(e) => setFormData({ ...formData, endpoint_url: e.target.value })}
                placeholder={
                  formData.provider === 'CUSTOM'
                    ? 'https://my-sms.lk/api/send?to={TO}&message={MESSAGE}&sender={SENDER_ID}&key={API_KEY}'
                    : formData.provider === 'TEXT_LK'
                    ? 'Default: https://app.text.lk/api/v3/sms/send'
                    : 'Leave blank to use official default provider endpoint'
                }
                className="w-full mt-1.5 p-2.5 bg-slate-50 rounded-xl border border-slate-200 focus:outline-hidden font-mono"
              />
              <span className="text-[10px] text-slate-400 mt-0.5 block">
                {formData.provider === 'CUSTOM'
                  ? 'Supports placeholders: {TO}, {MESSAGE}, {SENDER_ID}, {API_KEY}, {USER_ID}'
                  : 'Defaults to provider official gateway REST API'}
              </span>
            </div>

          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-xs transition"
            >
              <Shield className="w-4 h-4" />
              <span>{saving ? 'Saving Settings...' : 'Save SMS Gateway Configuration'}</span>
            </button>
          </div>
        </form>

      </div>

      {/* Interactive SMS Dispatch Test Console */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-5 sm:p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-bold text-slate-900 text-sm sm:text-base flex items-center gap-2">
              <Send className="w-4 h-4 text-blue-600" />
              <span>Test SMS Dispatch Console</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Send a test message to any Sri Lankan mobile number to verify network connectivity and template formatting.
            </p>
          </div>

          {phoneMeta?.operator && (
            <span className="text-[11px] font-bold bg-blue-50 text-blue-800 px-3 py-1 rounded-xl border border-blue-200 flex items-center gap-1">
              <span>📶 Carrier:</span>
              <strong className="text-blue-900">{phoneMeta.operator}</strong>
            </span>
          )}
        </div>

        <form onSubmit={handleTestSend} className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="sm:col-span-1">
              <label className="font-bold text-slate-700">Sri Lanka Mobile Number</label>
              <input
                type="text"
                value={testPhone}
                onChange={(e) => setTestPhone(e.target.value)}
                placeholder="0771234567 or +94771234567"
                required
                className="w-full mt-1 p-2.5 bg-slate-50 rounded-xl border border-slate-200 font-mono focus:outline-hidden"
              />
              <span className="text-[10px] text-slate-400 mt-0.5 block">
                {phoneMeta?.isValid ? `Normalized: ${phoneMeta.normalized}` : 'Format: 07XXXXXXXX (Dialog, Mobitel, Hutch, Airtel)'}
              </span>
            </div>

            <div className="sm:col-span-2">
              <label className="font-bold text-slate-700">Test Message Payload</label>
              <input
                type="text"
                value={testMessage}
                onChange={(e) => setTestMessage(e.target.value)}
                required
                className="w-full mt-1 p-2.5 bg-slate-50 rounded-xl border border-slate-200 focus:outline-hidden"
              />
              <div className="flex items-center justify-between text-[10px] text-slate-400 mt-0.5">
                <span>Standard SMS length: 160 chars</span>
                <span>{testMessage.length} characters ({Math.ceil(testMessage.length / 160)} SMS)</span>
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={testing}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-xs transition"
            >
              <Send className={`w-3.5 h-3.5 ${testing ? 'animate-spin' : ''}`} />
              <span>{testing ? 'Sending Verification SMS...' : 'Dispatch Test SMS'}</span>
            </button>
          </div>
        </form>

        {testResult && (
          <div className={`p-4 rounded-xl text-xs border ${
            testResult.success ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-rose-50 border-rose-200 text-rose-900'
          }`}>
            <div className="flex items-center justify-between font-bold">
              <span className="flex items-center gap-1.5">
                {testResult.success ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <AlertTriangle className="w-4 h-4 text-rose-600" />}
                <span>{testResult.message || testResult.error}</span>
              </span>
              {testResult.details?.operator && (
                <span className="text-[10px] bg-white px-2 py-0.5 rounded border border-emerald-300">
                  {testResult.details.operator}
                </span>
              )}
            </div>

            {testResult.details && (
              <div className="mt-2 text-[11px] grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-emerald-200/60 font-mono">
                <div>Recipient: <strong>{testResult.details.formattedPhone || testResult.details.phone}</strong></div>
                <div>Status: <strong>{testResult.details.simulated ? 'SIMULATED' : 'LIVE DELIVERED'}</strong></div>
                <div>Message ID: <strong>{testResult.details.messageId}</strong></div>
                <div>Cost: <strong>Rs. {(testResult.details.costLkr || 0).toFixed(2)}</strong></div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Sri Lanka SMS Delivery Logs */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="font-bold text-slate-900 text-sm sm:text-base flex items-center gap-2">
              <Smartphone className="w-4 h-4 text-emerald-600" />
              <span>SMS Delivery Audit Trail ({logs.length})</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">Real-time log of all customer reminders and verification SMS dispatched.</p>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-400 flex items-center gap-1"><ListFilter className="w-3.5 h-3.5" /> Filter:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="p-1.5 bg-slate-50 border border-slate-200 rounded-lg font-bold text-slate-700 focus:outline-hidden"
            >
              <option value="">All Statuses</option>
              <option value="SENT">Live Sent</option>
              <option value="SIMULATED">Simulated</option>
              <option value="FAILED">Failed</option>
            </select>
            <button
              onClick={() => loadData()}
              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg"
              title="Refresh logs"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {logs.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-xs">
            No SMS messages logged yet. Use the Test Console above or send reminders from the Reminders tab.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px]">
                <tr>
                  <th className="px-4 py-2.5">Date / Time</th>
                  <th className="px-4 py-2.5">Recipient & Mobile</th>
                  <th className="px-4 py-2.5">Job Ref</th>
                  <th className="px-4 py-2.5">Gateway</th>
                  <th className="px-4 py-2.5">Message Content</th>
                  <th className="px-4 py-2.5">Cost</th>
                  <th className="px-4 py-2.5 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-sans">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-slate-500 font-mono text-[11px] whitespace-nowrap">
                      {log.created_at}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-bold text-slate-900">{log.recipient_name || 'Customer'}</div>
                      <div className="text-[11px] text-slate-500 font-mono">{log.phone}</div>
                    </td>
                    <td className="px-4 py-3">
                      {log.job_code ? (
                        <span className="font-mono text-[11px] bg-slate-100 text-slate-800 px-1.5 py-0.5 rounded font-bold">
                          {log.job_code}
                        </span>
                      ) : (
                        <span className="text-slate-400 text-[11px] italic">Direct / Test</span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-semibold text-slate-700">
                      {log.gateway}
                    </td>
                    <td className="px-4 py-3 text-slate-600 max-w-xs truncate" title={log.message}>
                      {log.message}
                    </td>
                    <td className="px-4 py-3 font-mono text-[11px] text-slate-600">
                      Rs. {(log.cost_lkr || 0).toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {log.status === 'SENT' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                          <CheckCircle2 className="w-3 h-3" /> Live Sent
                        </span>
                      )}
                      {log.status === 'SIMULATED' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                          <Info className="w-3 h-3" /> Simulated
                        </span>
                      )}
                      {log.status === 'FAILED' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800" title={log.response}>
                          <AlertTriangle className="w-3 h-3" /> Failed
                        </span>
                      )}
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
