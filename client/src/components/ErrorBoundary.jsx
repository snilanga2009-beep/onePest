import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[React ErrorBoundary caught error]:', error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReload = () => {
    try {
      sessionStorage.clear();
      // Unregister any broken service workers on recovery
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then(registrations => {
          for (const reg of registrations) {
            reg.unregister();
          }
        });
      }
    } catch (e) {}
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 font-sans">
          <div className="bg-white max-w-md w-full rounded-3xl p-6 shadow-2xl border border-red-200 text-center space-y-4">
            <div className="w-14 h-14 bg-red-100 text-red-600 rounded-2xl flex items-center justify-center mx-auto text-2xl font-black">
              ⚠️
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-900">Application Error Encountered</h2>
              <p className="text-xs text-slate-500 mt-1">
                The screen failed to render due to an unexpected client state.
              </p>
            </div>

            {this.state.error && (
              <div className="p-3 bg-red-50 text-red-800 text-[11px] font-mono rounded-xl border border-red-200 text-left overflow-x-auto max-h-36">
                {String(this.state.error.message || this.state.error)}
              </div>
            )}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={this.handleReload}
                className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white text-xs font-black rounded-xl shadow-md cursor-pointer transition active:scale-95"
              >
                RELOAD & RECOVER
              </button>
              <button
                type="button"
                onClick={this.handleGoHome}
                className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl cursor-pointer transition active:scale-95"
              >
                OPEN DASHBOARD
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
