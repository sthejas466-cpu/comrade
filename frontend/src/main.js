import { io } from 'socket.io-client';
import { getToken, clearAuth, API_BASE } from './api.js';
import { showToast, playAlertSound } from './components/toast.js';
import { initSimulator, showSimulator, hideSimulator } from './components/simulator.js';
import { initErrorBoundary, initNetworkMonitor } from './components/errorBoundary.js';

import { renderLogin, bindLoginEvents } from './pages/login.js';
import { renderDashboard, bindDashboardEvents, unbindDashboard } from './pages/dashboard.js';
import { renderLiveAlerts, bindLiveAlertsEvents, unbindLiveAlerts } from './pages/liveAlerts.js';
import { renderPoleManagement, bindPoleManagementEvents, unbindPoleManagement } from './pages/poleManagement.js';
import { renderIncidentHistory, bindIncidentHistoryEvents } from './pages/incidentHistory.js';
import { renderCommandCenter, bindCommandCenterEvents, unbindCommandCenter } from './pages/commandCenter.js';

// ─── Router ───────────────────────────────────────────────────────────────────
let currentPage = null;
const PAGES = {
  login:            { render: renderLogin,          bind: bindLoginEvents,            public: true },
  dashboard:        { render: renderDashboard,      bind: bindDashboardEvents,        unbind: unbindDashboard },
  'live-alerts':    { render: renderLiveAlerts,     bind: bindLiveAlertsEvents,       unbind: unbindLiveAlerts },
  'pole-management':{ render: renderPoleManagement, bind: bindPoleManagementEvents,   unbind: unbindPoleManagement },
  'incident-history':{ render: renderIncidentHistory, bind: bindIncidentHistoryEvents },
  'command-center': { render: renderCommandCenter,  bind: bindCommandCenterEvents,    unbind: unbindCommandCenter },
};

async function navigate(page) {
  if (!PAGES[page]?.public && !getToken()) { page = 'login'; }
  if (page === 'login' && getToken())       { page = 'dashboard'; }

  if (currentPage && PAGES[currentPage]?.unbind) PAGES[currentPage].unbind();

  currentPage = page;
  const def = PAGES[page] || PAGES['dashboard'];
  document.getElementById('app').innerHTML = def.render();
  await def.bind(navigate);

  history.replaceState(null, '', `#${page}`);

  // Show simulator on all authenticated pages, hide on login
  if (page === 'login') hideSimulator();
  else                  showSimulator();
}

// ─── Hash routing ─────────────────────────────────────────────────────────────
window.addEventListener('hashchange', () => {
  navigate(location.hash.replace('#', '') || 'dashboard');
});

// ─── Global Socket — cross-page alert notifications ───────────────────────────
function initGlobalSocket() {
  if (!getToken()) return;
  const sock = io(API_BASE);
  sock.on('new_alert', (alert) => {
    if (currentPage !== 'live-alerts') {
      playAlertSound();
      showToast(
        `🚨 New Emergency: ${alert.pole_id}`,
        `${alert.alert_type} at ${alert.location_name} — Priority: ${alert.priority}`,
        'error', 8000
      );
    }
  });
  window.addEventListener('comrade_logout', () => sock.disconnect());
}

// ─── Boot ─────────────────────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', async () => {
  // Error boundary + offline monitor — init before anything else
  initErrorBoundary();
  initNetworkMonitor();

  // Loading screen
  await new Promise(r => setTimeout(r, 1600));
  const ls = document.getElementById('loading-screen');
  if (ls) { ls.classList.add('hidden'); setTimeout(() => ls.remove(), 500); }

  // Init persistent simulator (injected into body, survives page swaps)
  initSimulator();

  // Route to first page
  const startPage = location.hash.replace('#', '') || (getToken() ? 'dashboard' : 'login');
  await navigate(startPage);

  initGlobalSocket();
});
