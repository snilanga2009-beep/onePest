import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Register PWA Service Worker for Mobile 1-Tap App Installability
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((reg) => console.log('PWA ServiceWorker registered successfully:', reg.scope))
      .catch((err) => console.log('PWA ServiceWorker registration failed:', err));
  });
}

// Global PWA BeforeInstallPrompt listener for 1-Tap Install
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  window.__deferredPrompt = e;
  window.dispatchEvent(new CustomEvent('pwa-installable'));
  console.log('[PWA] beforeinstallprompt captured globally');
});

window.addEventListener('appinstalled', () => {
  window.__deferredPrompt = null;
  console.log('[PWA] App successfully installed on device');
});


