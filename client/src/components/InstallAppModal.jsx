import React, { useState, useEffect } from 'react';
import { Smartphone, Download, Share2, PlusSquare, MoreVertical, X, Check, ArrowRight, ExternalLink, Sparkles, ShieldCheck } from 'lucide-react';

export default function InstallAppModal({ isOpen, onClose, deferredPrompt, onInstalled }) {
  const isIosDevice = typeof window !== 'undefined' && /iphone|ipad|ipod/.test(window.navigator.userAgent.toLowerCase());
  const [activeTab, setActiveTab] = useState(isIosDevice ? 'ios' : 'android');
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    if (isIosDevice) {
      setActiveTab('ios');
    } else {
      setActiveTab('android');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleNativeInstall = async () => {
    const promptEvent = deferredPrompt || (typeof window !== 'undefined' ? window.__deferredPrompt : null);
    if (promptEvent) {
      try {
        setInstalling(true);
        await promptEvent.prompt();
        const choice = await promptEvent.userChoice;
        if (choice && choice.outcome === 'accepted') {
          if (onInstalled) onInstalled();
          onClose();
        }
      } catch (err) {
        console.error('[PWA Install Error]:', err);
      } finally {
        setInstalling(false);
      }
    }
  };

  const hasNativePrompt = Boolean(deferredPrompt || (typeof window !== 'undefined' && window.__deferredPrompt));

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-end sm:items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] animate-in slide-in-from-bottom duration-300">
        
        {/* Header */}
        <div className="relative bg-gradient-to-r from-emerald-600 via-teal-600 to-slate-900 text-white p-5">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition cursor-pointer"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-white shadow-lg p-2 flex items-center justify-center shrink-0">
              <img src="/tech-icon-192.png" alt="PestControl Pro Icon" className="w-full h-full object-contain rounded-xl" />
            </div>
            <div>
              <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-400/20 text-emerald-300 text-[10px] font-black uppercase tracking-wider border border-emerald-400/30">
                <Sparkles className="w-3 h-3 text-emerald-300" />
                <span>1-Tap Phone Install</span>
              </div>
              <h3 className="text-lg font-black text-white tracking-tight mt-0.5">
                Add to Phone Screen
              </h3>
              <p className="text-xs text-emerald-100">
                Installs like a real mobile app on Android & iPhone
              </p>
            </div>
          </div>

          {/* OS Switcher Tabs */}
          <div className="flex bg-black/20 p-1 rounded-xl mt-4 gap-1">
            <button
              type="button"
              onClick={() => setActiveTab('android')}
              className={`flex-1 py-1.5 rounded-lg text-xs font-black transition flex items-center justify-center gap-1.5 cursor-pointer ${
                activeTab === 'android'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-white/80 hover:text-white'
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>Android Phone</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('ios')}
              className={`flex-1 py-1.5 rounded-lg text-xs font-black transition flex items-center justify-center gap-1.5 cursor-pointer ${
                activeTab === 'ios'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-white/80 hover:text-white'
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>iPhone / iPad (iOS)</span>
            </button>
          </div>
        </div>

        {/* Modal Content */}
        <div className="p-5 overflow-y-auto space-y-4 text-xs">
          
          {/* ANDROID TAB */}
          {activeTab === 'android' && (
            <div className="space-y-3.5">
              {hasNativePrompt ? (
                <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-center space-y-2.5">
                  <div className="w-10 h-10 rounded-full bg-emerald-500 text-white flex items-center justify-center mx-auto shadow-md">
                    <Download className="w-5 h-5" />
                  </div>
                  <div className="font-black text-slate-900 text-sm">Fast 1-Click Install Ready!</div>
                  <p className="text-slate-600 text-xs">
                    Your Android device is ready to add the PestControl app icon straight to your home screen.
                  </p>
                  <button
                    type="button"
                    onClick={handleNativeInstall}
                    disabled={installing}
                    className="w-full py-3 px-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-xs rounded-xl shadow-md transition flex items-center justify-center gap-2 cursor-pointer active:scale-95 disabled:opacity-50"
                  >
                    <Download className="w-4 h-4" />
                    <span>{installing ? 'Installing App...' : 'INSTALL TO HOME SCREEN NOW'}</span>
                  </button>
                </div>
              ) : null}

              <div className="text-slate-700 font-bold text-xs uppercase tracking-wider text-slate-500">
                Manual Android Instructions:
              </div>

              {/* Step 1 */}
              <div className="flex items-start gap-3 p-3 rounded-2xl bg-slate-50 border border-slate-200">
                <div className="w-7 h-7 rounded-xl bg-slate-900 text-white flex items-center justify-center font-black text-xs shrink-0">
                  1
                </div>
                <div>
                  <div className="font-bold text-slate-900 flex items-center gap-1.5">
                    <span>Tap the 3 dots menu</span>
                    <span className="p-1 rounded bg-slate-200 text-slate-800 inline-flex items-center"><MoreVertical className="w-3 h-3" /></span>
                  </div>
                  <p className="text-slate-500 text-[11px] mt-0.5">
                    Look at the top-right corner of Google Chrome or Samsung Internet browser.
                  </p>
                </div>
              </div>

              {/* Step 2 */}
              <div className="flex items-start gap-3 p-3 rounded-2xl bg-slate-50 border border-slate-200">
                <div className="w-7 h-7 rounded-xl bg-slate-900 text-white flex items-center justify-center font-black text-xs shrink-0">
                  2
                </div>
                <div>
                  <div className="font-bold text-slate-900 flex items-center gap-1.5">
                    <span>Select "Install app" or "Add to Home screen"</span>
                    <Download className="w-3.5 h-3.5 text-emerald-600" />
                  </div>
                  <p className="text-slate-500 text-[11px] mt-0.5">
                    Tap the option from the browser menu list.
                  </p>
                </div>
              </div>

              {/* Step 3 */}
              <div className="flex items-start gap-3 p-3 rounded-2xl bg-slate-50 border border-slate-200">
                <div className="w-7 h-7 rounded-xl bg-slate-900 text-white flex items-center justify-center font-black text-xs shrink-0">
                  3
                </div>
                <div>
                  <div className="font-bold text-slate-900 flex items-center gap-1.5">
                    <span>Tap "Install" / "Add" to confirm</span>
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                  </div>
                  <p className="text-slate-500 text-[11px] mt-0.5">
                    The PestControl Pro icon will appear on your phone screen and app drawer.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* IPHONE (iOS) TAB */}
          {activeTab === 'ios' && (
            <div className="space-y-3.5">
              <div className="p-3 bg-amber-50 rounded-2xl border border-amber-200 text-amber-900 text-[11px] leading-relaxed flex items-start gap-2">
                <div className="w-2 h-2 rounded-full bg-amber-500 shrink-0 mt-1.5" />
                <span>
                  <strong>Important for iPhone:</strong> Must be opened in <strong>Apple Safari</strong>. If you are inside WhatsApp, Facebook, or SMS browser, tap the Share icon and choose <em>"Open in Safari"</em> first!
                </span>
              </div>

              {/* Step 1 */}
              <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
                <div className="w-7 h-7 rounded-xl bg-blue-600 text-white flex items-center justify-center font-black text-xs shrink-0 shadow-xs">
                  1
                </div>
                <div>
                  <div className="font-bold text-slate-900 flex items-center gap-1.5">
                    <span>Tap the Safari Share button</span>
                    <span className="p-1 rounded bg-blue-100 text-blue-700 inline-flex items-center">
                      <Share2 className="w-3.5 h-3.5" />
                    </span>
                  </div>
                  <p className="text-slate-500 text-[11px] mt-0.5">
                    At the bottom bar of Safari on iPhone (or top bar on iPad), tap the square with the arrow pointing up (Share).
                  </p>
                </div>
              </div>

              {/* Step 2 */}
              <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
                <div className="w-7 h-7 rounded-xl bg-blue-600 text-white flex items-center justify-center font-black text-xs shrink-0 shadow-xs">
                  2
                </div>
                <div>
                  <div className="font-bold text-slate-900 flex items-center gap-1.5">
                    <span>Scroll down and tap "Add to Home Screen"</span>
                    <span className="p-1 rounded bg-slate-200 text-slate-800 inline-flex items-center">
                      <PlusSquare className="w-3.5 h-3.5 text-slate-700" />
                    </span>
                  </div>
                  <p className="text-slate-500 text-[11px] mt-0.5">
                    Scroll down through the share options until you see <strong>"Add to Home Screen"</strong> with a plus (+) icon.
                  </p>
                </div>
              </div>

              {/* Step 3 */}
              <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
                <div className="w-7 h-7 rounded-xl bg-blue-600 text-white flex items-center justify-center font-black text-xs shrink-0 shadow-xs">
                  3
                </div>
                <div>
                  <div className="font-bold text-slate-900 flex items-center gap-1.5">
                    <span>Tap "Add" in top-right corner</span>
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                  </div>
                  <p className="text-slate-500 text-[11px] mt-0.5">
                    Confirm by tapping <strong>"Add"</strong>. The app icon will be permanently installed on your iPhone home screen!
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Benefits Footer */}
          <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <div className="flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>Full Offline Support</span>
            </div>
            <div className="flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>1-Tap Instant Launch</span>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center gap-2">
          {hasNativePrompt && activeTab === 'android' ? (
            <button
              type="button"
              onClick={handleNativeInstall}
              disabled={installing}
              className="flex-1 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs rounded-xl shadow-xs transition flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{installing ? 'Installing...' : 'Install Now'}</span>
            </button>
          ) : null}

          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 px-4 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-xs rounded-xl transition cursor-pointer"
          >
            Got it, Close
          </button>
        </div>

      </div>
    </div>
  );
}
