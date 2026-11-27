import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import { seedReferenceData } from './data/seed';
import './styles.css';
import { registerSW } from 'virtual:pwa-register';

// Load a new version as soon as it is deployed, rather than on the next visit.
// Checks again every 10 minutes for screens left open (e.g. at the command post).
const updateSW = registerSW({
  immediate: true,
  onNeedRefresh() { void updateSW(true); },
  onRegisteredSW(_url, reg) { if (reg) setInterval(() => { if (navigator.onLine) void reg.update(); }, 10 * 60_000); },
});

void seedReferenceData();
ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>);
