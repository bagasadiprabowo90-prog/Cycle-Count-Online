import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { registerServiceWorker } from './lib/sw-register';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);

// Register service worker in production
if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    // Register SW (only in production or can test in dev too)
    await registerServiceWorker();
  });
}