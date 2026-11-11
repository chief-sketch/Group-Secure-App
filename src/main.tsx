import { createRoot } from 'react-dom/client';
import './lib/firebase';
import App from './App.tsx';
import './index.css';

const rootElement = document.getElementById('root');

if (rootElement) {
  try {
    const root = createRoot(rootElement);
    root.render(<App />);
  } catch (err) {
    console.error('Fatal initialization error:', err);
    rootElement.innerHTML = `
      <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;background:#0B141A;color:#E9EDEF;font-family:sans-serif;padding:24px;text-align:center;">
        <div style="max-width:380px;background:#1F2C33;padding:24px;border-radius:12px;border:1px solid rgba(255,255,255,0.08);">
          <h2 style="font-size:18px;margin-bottom:8px;color:#00A884;">Group Secure App</h2>
          <p style="font-size:14px;color:#8696A0;margin-bottom:16px;">We encountered a startup issue. Click below to reload.</p>
          <button onclick="window.location.reload()" style="background:#00A884;color:#111B21;border:none;padding:10px 20px;border-radius:8px;font-weight:600;cursor:pointer;">
            Reload App
          </button>
        </div>
      </div>
    `;
  }
}
