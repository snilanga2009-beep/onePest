import React, { useState, useEffect } from 'react';
import { Shield, Upload, Sparkles, X, Check, Building2, Image as ImageIcon, RotateCcw, Smartphone, Laptop } from 'lucide-react';

export const DEFAULT_BRANDING = {
  name: 'Ceylon Pest Solutions',
  subheading: 'Master Operations & Scheduling Suite',
  logoType: 'preset', // 'preset' or 'custom'
  presetId: 'shield', // 'shield', 'bio', 'leaf', 'crown'
  customLogoUrl: '',
  appIconUrl: ''
};

export function getSavedBranding() {
  try {
    const saved = localStorage.getItem('pest_system_branding');
    if (saved) return JSON.parse(saved);
  } catch (e) {
    console.error(e);
  }
  return DEFAULT_BRANDING;
}

export async function fetchServerBranding() {
  try {
    const res = await fetch('/api/branding');
    const data = await res.json();
    if (data.success && data.branding) {
      saveBranding(data.branding, false);
      return data.branding;
    }
  } catch (e) {
    console.warn('[Branding] Could not fetch server branding:', e);
  }
  return getSavedBranding();
}

export function saveBranding(branding, syncToServer = true) {
  try {
    localStorage.setItem('pest_system_branding', JSON.stringify(branding));
    window.dispatchEvent(new CustomEvent('branding-updated', { detail: branding }));

    // Dynamically update document title and favicon
    if (branding.name) {
      document.title = `${branding.name} | Operations & Scheduling`;
    }
    const iconToApply = branding.appIconUrl || branding.customLogoUrl;
    if (iconToApply) {
      let link = document.querySelector("link[rel~='icon']");
      if (!link) {
        link = document.createElement('link');
        link.rel = 'icon';
        document.head.appendChild(link);
      }
      link.href = iconToApply;

      let appleLink = document.querySelector("link[rel='apple-touch-icon']");
      if (!appleLink) {
        appleLink = document.createElement('link');
        appleLink.rel = 'apple-touch-icon';
        document.head.appendChild(appleLink);
      }
      appleLink.href = iconToApply;
    }

    if (syncToServer) {
      fetch('/api/branding', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(branding)
      }).catch(err => console.warn('Failed to sync branding to server:', err));
    }
  } catch (e) {
    console.error(e);
  }
}

export function PresetLogoIcon({ id, className = "w-6 h-6" }) {
  if (id === 'bio') {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 2L3 7V12C3 17.5 6.8 21.7 12 23C17.2 21.7 21 17.5 21 12V7L12 2Z" fill="url(#bio-grad)" stroke="#065f46" strokeWidth="1.5" strokeLinejoin="round"/>
        <path d="M12 6V18M7 9L17 15M17 9L7 15" stroke="#ffffff" strokeWidth="2" strokeLinecap="round"/>
        <circle cx="12" cy="12" r="3" fill="#10b981" stroke="#ffffff" strokeWidth="1.5"/>
        <defs>
          <linearGradient id="bio-grad" x1="3" y1="2" x2="21" y2="23" gradientUnits="userSpaceOnUse">
            <stop stopColor="#059669" />
            <stop offset="1" stopColor="#047857" />
          </linearGradient>
        </defs>
      </svg>
    );
  }
  if (id === 'leaf') {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect width="24" height="24" rx="6" fill="url(#leaf-grad)"/>
        <path d="M17 7C17 7 13 8 10 11C7 14 7 17 7 17C7 17 10 17 13 14C16 11 17 7 17 7Z" fill="#a7f3d0" stroke="#ffffff" strokeWidth="1.5"/>
        <path d="M7 17L12 12" stroke="#ffffff" strokeWidth="2" strokeLinecap="round"/>
        <defs>
          <linearGradient id="leaf-grad" x1="0" y1="0" x2="24" y2="24" gradientUnits="userSpaceOnUse">
            <stop stopColor="#10b981" />
            <stop offset="1" stopColor="#0f766e" />
          </linearGradient>
        </defs>
      </svg>
    );
  }
  if (id === 'crown') {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect width="24" height="24" rx="6" fill="url(#crown-grad)"/>
        <path d="M5 16L3 7L8.5 11L12 5L15.5 11L21 7L19 16H5Z" fill="#fef08a" stroke="#ca8a04" strokeWidth="1.5" strokeLinejoin="round"/>
        <circle cx="12" cy="17" r="1.5" fill="#ca8a04"/>
        <defs>
          <linearGradient id="crown-grad" x1="0" y1="0" x2="24" y2="24" gradientUnits="userSpaceOnUse">
            <stop stopColor="#0284c7" />
            <stop offset="1" stopColor="#1e40af" />
          </linearGradient>
        </defs>
      </svg>
    );
  }
  // Default shield & target
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 2L4 5.5V11.5C4 16.8 7.4 21.6 12 23C16.6 21.6 20 16.8 20 11.5V5.5L12 2Z" fill="url(#shield-grad)" stroke="#047857" strokeWidth="1.5" strokeLinejoin="round"/>
      <circle cx="12" cy="12" r="5" stroke="#ffffff" strokeWidth="1.5" strokeDasharray="2 2"/>
      <circle cx="12" cy="12" r="2.5" fill="#facc15"/>
      <path d="M12 7V9.5M12 14.5V17M7 12H9.5M14.5 12H17" stroke="#ffffff" strokeWidth="1.5" strokeLinecap="round"/>
      <defs>
        <linearGradient id="shield-grad" x1="4" y1="2" x2="20" y2="23" gradientUnits="userSpaceOnUse">
          <stop stopColor="#10b981" />
          <stop offset="0.5" stopColor="#059669" />
          <stop offset="1" stopColor="#047857" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export default function BrandingSettingsModal({ isOpen, onClose }) {
  const [branding, setBranding] = useState(getSavedBranding());
  const [previewName, setPreviewName] = useState('');
  const [previewSubheading, setPreviewSubheading] = useState('');
  const [logoType, setLogoType] = useState('preset');
  const [presetId, setPresetId] = useState('shield');
  const [customLogoUrl, setCustomLogoUrl] = useState('');
  const [appIconUrl, setAppIconUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard'); // 'dashboard', 'app_icon'

  useEffect(() => {
    if (isOpen) {
      fetchServerBranding().then(current => {
        setBranding(current);
        setPreviewName(current.name || DEFAULT_BRANDING.name);
        setPreviewSubheading(current.subheading || DEFAULT_BRANDING.subheading);
        setLogoType(current.logoType || 'preset');
        setPresetId(current.presetId || 'shield');
        setCustomLogoUrl(current.customLogoUrl || '');
        setAppIconUrl(current.appIconUrl || '');
      });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleDashboardLogoUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      alert('Dashboard Logo image must be smaller than 2MB');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setCustomLogoUrl(reader.result);
      setLogoType('custom');
    };
    reader.readAsDataURL(file);
  };

  const handleAppIconUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      alert('App Icon image must be smaller than 2MB');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setAppIconUrl(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    setSaving(true);
    const newBranding = {
      name: previewName.trim() || DEFAULT_BRANDING.name,
      subheading: previewSubheading.trim() || DEFAULT_BRANDING.subheading,
      logoType,
      presetId,
      customLogoUrl,
      appIconUrl
    };
    saveBranding(newBranding, true);
    setSaving(false);
    onClose();
  };

  const handleReset = () => {
    setPreviewName(DEFAULT_BRANDING.name);
    setPreviewSubheading(DEFAULT_BRANDING.subheading);
    setLogoType('preset');
    setPresetId('shield');
    setCustomLogoUrl('');
    setAppIconUrl('');
  };

  const presets = [
    { id: 'shield', name: 'Emerald Shield Target', desc: 'Integrated pest management' },
    { id: 'bio', name: 'Bio-Safety Emblem', desc: 'Clean bio-sanitation & chemical control' },
    { id: 'leaf', name: 'Eco-Green Botanical', desc: 'Environmentally safe treatments' },
    { id: 'crown', name: 'Royal Operations Gold', desc: 'Commercial enterprise grade' }
  ];

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-xl overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* Header */}
        <div className="p-6 bg-gradient-to-r from-emerald-600 to-teal-700 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center shadow-lg">
              <Building2 className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-black tracking-tight">System Branding & Logo Settings</h2>
              <p className="text-xs text-emerald-100 mt-0.5">Customize Main Dashboard Logo & Mobile App Icon</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-slate-200 bg-slate-50 px-6 pt-3 gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('dashboard')}
            className={`pb-2.5 px-3 text-xs font-bold border-b-2 flex items-center gap-2 transition ${
              activeTab === 'dashboard'
                ? 'border-emerald-600 text-emerald-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Laptop className="w-4 h-4" />
            <span>1. Main Dashboard Logo</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('app_icon')}
            className={`pb-2.5 px-3 text-xs font-bold border-b-2 flex items-center gap-2 transition ${
              activeTab === 'app_icon'
                ? 'border-emerald-600 text-emerald-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Smartphone className="w-4 h-4" />
            <span>2. Mobile App Icon (PWA)</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-5 overflow-y-auto flex-1 text-xs">

          {/* Live Preview Card */}
          <div className="p-4 bg-slate-900 text-white rounded-2xl border border-slate-800 shadow-md">
            <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-2 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Live Application Preview</span>
            </div>

            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0 overflow-hidden shadow-inner">
                {activeTab === 'app_icon' && appIconUrl ? (
                  <img src={appIconUrl} alt="App Icon" className="w-full h-full object-cover" />
                ) : logoType === 'custom' && customLogoUrl ? (
                  <img src={customLogoUrl} alt="Logo" className="w-full h-full object-contain p-1" />
                ) : (
                  <PresetLogoIcon id={presetId} className="w-8 h-8" />
                )}
              </div>
              <div className="min-w-0">
                <div className="font-extrabold text-white text-sm sm:text-base tracking-tight truncate">
                  {previewName || 'Company Name'}
                </div>
                <div className="text-emerald-400 text-xs font-medium truncate">
                  {previewSubheading || 'Operations & Scheduling Suite'}
                </div>
              </div>
            </div>
          </div>

          {/* TAB 1: Main Dashboard Logo */}
          {activeTab === 'dashboard' && (
            <div className="space-y-4 animate-in fade-in">
              {/* Company Name */}
              <div>
                <label className="font-bold text-slate-800 block mb-1">
                  Company Name (Displayed on Dashboard & Reports)
                </label>
                <input
                  type="text"
                  value={previewName}
                  onChange={(e) => setPreviewName(e.target.value)}
                  placeholder="e.g. Ceylon Pest Management Solutions"
                  className="w-full bg-slate-50 text-xs font-semibold px-4 py-2.5 rounded-xl border border-slate-200 focus:bg-white focus:border-emerald-500 focus:outline-hidden transition"
                />
              </div>

              {/* Subheading */}
              <div>
                <label className="font-bold text-slate-800 block mb-1">
                  Tagline / System Subtitle
                </label>
                <input
                  type="text"
                  value={previewSubheading}
                  onChange={(e) => setPreviewSubheading(e.target.value)}
                  placeholder="e.g. Commercial & Residential Pest Control Services"
                  className="w-full bg-slate-50 text-xs font-medium px-4 py-2.5 rounded-xl border border-slate-200 focus:bg-white focus:border-emerald-500 focus:outline-hidden transition"
                />
              </div>

              {/* Logo Selection Mode */}
              <div className="space-y-3 pt-2">
                <label className="font-bold text-slate-800 block">
                  Dashboard Logo Source
                </label>

                <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setLogoType('preset')}
                    className={`py-2 rounded-lg font-bold transition flex items-center justify-center gap-1.5 ${
                      logoType === 'preset' ? 'bg-white text-emerald-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Shield className="w-3.5 h-3.5" /> Preset Emblems
                  </button>
                  <button
                    type="button"
                    onClick={() => setLogoType('custom')}
                    className={`py-2 rounded-lg font-bold transition flex items-center justify-center gap-1.5 ${
                      logoType === 'custom' ? 'bg-white text-emerald-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Upload className="w-3.5 h-3.5" /> Upload Custom Logo
                  </button>
                </div>

                {/* Presets List */}
                {logoType === 'preset' && (
                  <div className="grid grid-cols-2 gap-3 pt-1">
                    {presets.map(p => (
                      <div
                        key={p.id}
                        onClick={() => setPresetId(p.id)}
                        className={`p-3 rounded-2xl border-2 cursor-pointer transition flex items-center gap-3 ${
                          presetId === p.id
                            ? 'border-emerald-500 bg-emerald-50/50 shadow-xs ring-2 ring-emerald-200'
                            : 'border-slate-200 bg-white hover:border-slate-300'
                        }`}
                      >
                        <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center shrink-0 border border-slate-200">
                          <PresetLogoIcon id={p.id} className="w-7 h-7" />
                        </div>
                        <div className="min-w-0">
                          <div className="font-bold text-slate-900 truncate">{p.name}</div>
                          <div className="text-[10px] text-slate-500 truncate">{p.desc}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Custom Upload Area */}
                {logoType === 'custom' && (
                  <div className="space-y-3 pt-1">
                    <div className="border-2 border-dashed border-slate-300 rounded-2xl p-6 text-center hover:border-emerald-500 hover:bg-emerald-50/20 transition cursor-pointer relative">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleDashboardLogoUpload}
                        className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                      />
                      <div className="flex flex-col items-center justify-center gap-2">
                        <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
                          <Upload className="w-6 h-6" />
                        </div>
                        <div className="font-bold text-slate-800 text-xs">
                          Click or drag & drop Main Dashboard Logo
                        </div>
                        <div className="text-[10px] text-slate-400">
                          Supports PNG, JPG, SVG, WebP (Max: 2MB)
                        </div>
                      </div>
                    </div>

                    {customLogoUrl && (
                      <div className="p-3 bg-white rounded-xl border border-slate-200 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <img src={customLogoUrl} alt="Dashboard Logo" className="w-10 h-10 object-contain rounded border border-slate-200 p-1" />
                          <span className="font-semibold text-slate-700">Custom Dashboard Logo Loaded</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setCustomLogoUrl('')}
                          className="text-rose-600 hover:text-rose-800 text-xs font-bold"
                        >
                          Remove
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: Mobile App Icon (PWA) */}
          {activeTab === 'app_icon' && (
            <div className="space-y-4 animate-in fade-in">
              <div>
                <h3 className="font-bold text-slate-900 text-sm">Mobile Phone App Icon & PWA Launcher</h3>
                <p className="text-slate-500 text-xs mt-0.5">
                  This custom icon appears on technicians' Android & iPhone home screens when they tap "Add Icon", as well as in the PWA splash screen and browser address bar.
                </p>
              </div>

              {/* Upload Dropzone for App Icon */}
              <div className="border-2 border-dashed border-teal-300 bg-teal-50/20 rounded-2xl p-6 text-center hover:border-teal-500 hover:bg-teal-50/40 transition cursor-pointer relative">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleAppIconUpload}
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                />
                <div className="flex flex-col items-center justify-center gap-2">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-teal-500 to-emerald-400 text-white flex items-center justify-center shadow-md">
                    <Smartphone className="w-7 h-7" />
                  </div>
                  <div className="font-bold text-slate-800 text-xs mt-1">
                    Upload Custom Mobile App Icon
                  </div>
                  <div className="text-[10px] text-slate-500 max-w-xs">
                    Square 1:1 aspect ratio recommended (PNG, JPG, SVG, WebP &bull; 512x512 pixels recommended)
                  </div>
                </div>
              </div>

              {/* Preview of Mobile Icon on Device */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-14 h-14 rounded-2xl shadow-lg border border-slate-200 overflow-hidden flex items-center justify-center bg-slate-900 text-white font-black">
                    {appIconUrl ? (
                      <img src={appIconUrl} alt="App Icon" className="w-full h-full object-cover" />
                    ) : customLogoUrl ? (
                      <img src={customLogoUrl} alt="App Icon Fallback" className="w-full h-full object-contain p-1 bg-white" />
                    ) : (
                      <PresetLogoIcon id={presetId} className="w-8 h-8" />
                    )}
                  </div>
                  <div>
                    <div className="font-bold text-slate-800 text-xs">Home Screen Icon Preview</div>
                    <div className="text-[11px] text-slate-500">
                      {appIconUrl ? 'Custom App Icon Active' : 'Using default/dashboard emblem fallback'}
                    </div>
                  </div>
                </div>

                {appIconUrl && (
                  <button
                    type="button"
                    onClick={() => setAppIconUrl('')}
                    className="text-rose-600 hover:text-rose-800 text-xs font-bold px-3 py-1.5 rounded-lg border border-rose-200 hover:bg-rose-50 transition"
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="p-5 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
          <button
            type="button"
            onClick={handleReset}
            className="flex items-center gap-1.5 px-3 py-2 text-slate-600 hover:text-slate-900 text-xs font-semibold rounded-xl hover:bg-slate-200 transition"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Default</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-slate-600 hover:text-slate-800 text-xs font-semibold rounded-xl hover:bg-slate-200 transition"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-1.5 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-md shadow-emerald-200 transition"
            >
              <Check className="w-4 h-4" />
              <span>{saving ? 'Saving...' : 'Save & Apply All Logos'}</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
