import { createRoot } from 'react-dom/client';
import './lib/firebase';
import App from './App.tsx';
import './index.css';

// Requirement 1: Remove any leftover profile cache keys or unrecognized keys on startup
try {
  if (typeof window !== 'undefined' && window.localStorage) {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k && (k.startsWith('gsa_cached_profile_') || k.includes('profile') || k.startsWith('user_profile_'))) {
        localStorage.removeItem(k);
      }
    }
  }
  if (typeof window !== 'undefined' && window.sessionStorage) {
    for (let i = sessionStorage.length - 1; i >= 0; i--) {
      const k = sessionStorage.key(i);
      if (k && (k.startsWith('gsa_cached_profile_') || k.includes('profile') || k.startsWith('user_profile_'))) {
        sessionStorage.removeItem(k);
      }
    }
  }
} catch (_) {}

createRoot(document.getElementById('root')!).render(<App />);
