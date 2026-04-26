import { api, API_BASE } from '../api.js';
import { renderSidebar, bindSidebarEvents } from '../components/sidebar.js';
import { showToast, playAlertSound } from '../components/toast.js';
import { io } from 'socket.io-client';

let socket, alertInterval;
let knownAlertIds = new Set();

export function renderLiveAlerts() {
  return `
    <div id="app-shell">
      ${renderSidebar('live-alerts')}
      <div id="main-content">
        <div class="page-header">
          <div>
            <div class="page-title">LIVE ALERTS</div>
            <div class="page-subtitle">Real-time emergency incident feed</div>
          </div>
          <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
            <span class="live-dot">Auto-refresh 3s</span>
            <button id="btn-sim-alert" class="btn btn-danger">⚡ Simulate SOS</button>
          </div>
        </div>
        <div class="page-body">
          <div id="alert-count-bar" style="margin-bottom:16px;font-size:0.8rem;color:var(--muted)">Loading…</div>
          <div id="alerts-container" class="alerts-grid"></div>
        </div>
      </div>
    </div>`;
}

export async function bindLiveAlertsEvents(navigate) {
  bindSidebarEvents(navigate);

  // Initial load
  await refreshAlerts();

  // 3-second auto-refresh
  alertInterval = setInterval(refreshAlerts, 3000);

  // Socket.io real-time push
  socket = io(API_BASE);
  socket.on('new_alert', (alert) => {
    if (!knownAlertIds.has(alert.id)) {
      knownAlertIds.add(alert.id);
      playAlertSound();
      showToast(`🚨 New Alert: ${alert.pole_id}`, `${alert.alert_type} at ${alert.location_name} — Priority: ${alert.priority}`, 'error', 7000);
      prependAlertCard(alert);
      updateCountBar();
    }
  });
  socket.on('alert_resolved', (alert) => {
    const card = document.querySelector(`[data-alert-id="${alert.id}"]`);
    if (card) {
      card.outerHTML = buildCard(alert);
    }
    updateCountBar();
  });

  // Simulate SOS
  document.getElementById('btn-sim-alert')?.addEventListener('click', async () => {
    try {
      const poles = await api.poles();
      const online = poles.filter(p => p.status === 'online');
      const pole = online[Math.floor(Math.random() * online.length)] || poles[0];
      await api.createAlert({ pole_id: pole.pole_id, alert_type: 'SOS', priority: 'CRITICAL' });
    } catch (e) { showToast('Error', e.message, 'error'); }
  });
}

export function unbindLiveAlerts() {
  clearInterval(alertInterval);
  socket?.disconnect();
}

async function refreshAlerts() {
  try {
    const alerts = await api.alerts();
    alerts.forEach(a => knownAlertIds.add(a.id));
    const container = document.getElementById('alerts-container');
    if (!container) return;
    if (!alerts.length) {
      container.innerHTML = `<div class="empty-state"><div class="empty-icon">✅</div><p>No alerts found</p></div>`;
    } else {
      // Only rebuild if IDs changed (avoid flicker)
      const currentIds = [...container.querySelectorAll('[data-alert-id]')].map(el => +el.dataset.alertId);
      const newIds = alerts.map(a => a.id);
      if (JSON.stringify(currentIds) !== JSON.stringify(newIds)) {
        container.innerHTML = alerts.map(buildCard).join('');
        bindCardActions();
      }
    }
    updateCountBar(alerts);
  } catch {}
}

function updateCountBar(alerts) {
  const el = document.getElementById('alert-count-bar');
  if (!el) return;
  if (!alerts) return;
  const active = alerts.filter(a => a.status === 'active').length;
  const resolved = alerts.filter(a => a.status === 'resolved').length;
  el.innerHTML = `<span style="color:var(--red);font-weight:600">${active} Active</span> &nbsp;·&nbsp; ${resolved} Resolved &nbsp;·&nbsp; ${alerts.length} Total`;
}

function prependAlertCard(alert) {
  const container = document.getElementById('alerts-container');
  if (!container) return;
  const div = document.createElement('div');
  div.innerHTML = buildCard(alert);
  container.prepend(div.firstElementChild);
  bindCardActions();
}

function buildCard(a) {
  const age = timeAgo(a.created_at);
  const pClass = a.priority === 'CRITICAL' ? 'critical' : a.priority === 'HIGH' ? 'high' : 'medium';
  const isActive = a.status === 'active';
  
  let summaryHTML = `<div class="alert-summary">${a.ai_summary || '—'}</div>`;
  try {
    const aiData = JSON.parse(a.ai_summary);
    if (aiData.Category && aiData.RecommendedResponse) {
      summaryHTML = `
        <div class="ai-summary-box">
          <div class="ai-cat">⚡ AI: ${aiData.Category}</div>
          <div class="ai-action">ACTION: ${aiData.RecommendedResponse}</div>
          <div class="ai-desc">${aiData.OperatorSummary}</div>
        </div>
      `;
    }
  } catch (e) { }

  return `
    <div class="alert-card ${a.status}" data-alert-id="${a.id}">
      <div class="alert-header">
        <div>
          <div class="alert-pole-id">${a.pole_id}</div>
          <div class="alert-pole-name">${a.pole_name || 'Unknown'}</div>
          <div class="alert-location">📍 ${a.location_name || '—'}</div>
        </div>
        <div style="display:flex;flex-direction:column;gap:6px;align-items:flex-end">
          <span class="alert-badge badge-${pClass}">${a.priority}</span>
          <span class="alert-badge ${isActive ? 'badge-active' : 'badge-resolved'}">${a.status}</span>
        </div>
      </div>
      ${summaryHTML}
      <div class="alert-meta">
        <span>🕐 ${age}</span>
        <span>Type: ${a.alert_type}</span>
      </div>
      ${isActive ? `
        <div class="alert-actions">
          <button class="btn btn-danger btn-siren" data-id="${a.id}" data-pole="${a.pole_id}">🔊 Siren</button>
          <button class="btn btn-success btn-resolve" data-id="${a.id}">✔ Resolve</button>
          <button class="btn btn-ghost btn-detail" data-id="${a.id}">🔍 Details</button>
        </div>` : ''}
    </div>`;
}

function bindCardActions() {
  document.querySelectorAll('.btn-resolve').forEach(btn => {
    btn.replaceWith(btn.cloneNode(true)); // remove old listeners
  });
  document.querySelectorAll('.btn-siren').forEach(btn => {
    btn.replaceWith(btn.cloneNode(true));
  });
  // Resolve
  document.querySelectorAll('.btn-resolve').forEach(btn => {
    btn.addEventListener('click', async () => {
      btn.disabled = true;
      try {
        await api.resolveAlert(btn.dataset.id);
        showToast('Alert Resolved', 'Incident marked as resolved.', 'success');
      } catch (e) { showToast('Error', e.message, 'error'); btn.disabled = false; }
    });
  });
  // Siren
  document.querySelectorAll('.btn-siren').forEach(btn => {
    btn.addEventListener('click', async () => {
      btn.disabled = true;
      try {
        await api.sendCommand(btn.dataset.pole, 'SIREN_ON');
        showToast('🔊 Siren Activated', `Command sent to ${btn.dataset.pole}`, 'warning');
      } catch (e) { showToast('Error', e.message, 'error'); }
      btn.disabled = false;
    });
  });
}

function timeAgo(iso) {
  const diff = Math.floor((Date.now() - new Date(iso)) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff/60)}m ago`;
  return `${Math.floor(diff/3600)}h ago`;
}
