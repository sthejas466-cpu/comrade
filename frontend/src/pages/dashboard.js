import { api } from '../api.js';
import { renderSidebar, bindSidebarEvents } from '../components/sidebar.js';

let statsInterval, chartInstance;

export function renderDashboard() {
  return `
    <div id="app-shell">
      ${renderSidebar('dashboard')}
      <div id="main-content">
        <div class="page-header">
          <div style="display:flex;align-items:center;gap:12px">
            <button id="menu-toggle" style="display:none">☰</button>
            <div>
              <div class="page-title">DASHBOARD</div>
              <div class="page-subtitle">Real-time Emergency Network Overview</div>
            </div>
          </div>
          <div class="header-right">
            <div class="live-badge"><span class="live-dot"></span>LIVE</div>
            <div class="refresh-timer"><div class="spin"></div><span id="last-refresh">Loading…</span></div>
          </div>
        </div>
        <div class="page-body">

          <!-- Stat Cards -->
          <div class="stat-grid" id="stat-grid">
            ${[
              {label:'Total Poles', icon:'◫', accent:'99,102,241'},
              {label:'Online Poles', icon:'●', accent:'74,222,128'},
              {label:'Active Alerts', icon:'◈', accent:'244,63,94'},
              {label:'Resolved Today', icon:'✓', accent:'34,211,238'},
            ].map(c => `
              <div class="stat-card" style="--accent:rgb(${c.accent});--accent-rgb:${c.accent}">
                <div class="stat-icon-wrap">${c.icon}</div>
                <div class="stat-label">${c.label}</div>
                <div class="stat-value skeleton-val">—</div>
                <div class="stat-trend">Loading…</div>
              </div>`).join('')}
          </div>

          <!-- Charts Row -->
          <div class="charts-row">
            <div class="chart-card" style="flex:1.4">
              <div class="chart-header">
                <div class="section-title">ALERT ACTIVITY</div>
                <span class="chart-sub">Last 7 days</span>
              </div>
              <div class="chart-wrap"><canvas id="chart-activity"></canvas></div>
            </div>
            <div class="chart-card" style="flex:1">
              <div class="chart-header">
                <div class="section-title">ALERT STATUS</div>
                <span class="chart-sub">All time</span>
              </div>
              <div class="chart-wrap chart-wrap-sm"><canvas id="chart-status"></canvas></div>
            </div>
          </div>

          <!-- Recent Alerts -->
          <div class="section-header" style="margin-top:24px">
            <div class="section-title">RECENT ACTIVE ALERTS</div>
            <span class="live-dot-label"><span class="live-dot"></span>Auto-refresh</span>
          </div>
          <div id="dash-alerts" class="alerts-grid"></div>
        </div>
      </div>
    </div>`;
}

export async function bindDashboardEvents(navigate) {
  bindSidebarEvents(navigate);
  await loadStats();
  await loadRecentAlerts();
  await buildCharts();
  statsInterval = setInterval(async () => {
    await loadStats();
    await loadRecentAlerts();
  }, 3000);
}

export function unbindDashboard() {
  clearInterval(statsInterval);
  if (chartInstance) { chartInstance.forEach(c => c?.destroy()); chartInstance = null; }
}

async function loadStats() {
  try {
    const s = await api.stats();
    const grid = document.getElementById('stat-grid');
    if (!grid) return;
    const cards = grid.querySelectorAll('.stat-card');
    const data = [
      { val: s.totalPoles,   trend: `${s.totalPoles - s.onlinePoles} offline`, tClass: s.totalPoles - s.onlinePoles > 0 ? 'down' : 'up' },
      { val: s.onlinePoles,  trend: `${Math.round(s.onlinePoles/s.totalPoles*100)||0}% uptime`, tClass: 'up' },
      { val: s.activeAlerts, trend: s.activeAlerts > 0 ? '⚠ Needs attention' : '✓ All clear', tClass: s.activeAlerts > 0 ? 'down' : 'up' },
      { val: s.resolvedToday,trend: 'Incidents closed', tClass: 'up' },
    ];
    cards.forEach((card, i) => {
      const vEl = card.querySelector('.stat-value');
      const tEl = card.querySelector('.stat-trend');
      if (vEl) { animateCount(vEl, data[i].val); }
      if (tEl) { tEl.textContent = data[i].trend; tEl.className = `stat-trend ${data[i].tClass}`; }
    });
    const ref = document.getElementById('last-refresh');
    if (ref) ref.textContent = `Updated ${new Date().toLocaleTimeString()}`;
  } catch {}
}

function animateCount(el, target) {
  const start = parseInt(el.textContent) || 0;
  if (start === target) return;
  const step = (target - start) / 12;
  let cur = start; let i = 0;
  const t = setInterval(() => {
    cur += step; i++;
    el.textContent = Math.round(cur);
    if (i >= 12) { el.textContent = target; clearInterval(t); }
  }, 30);
}

async function buildCharts() {
  if (typeof Chart === 'undefined') return;
  try {
    const allAlerts = await api.alerts();
    // Activity chart — last 7 days
    const days = Array.from({length:7}, (_,i) => {
      const d = new Date(); d.setDate(d.getDate()-6+i);
      return d.toLocaleDateString('en-IN',{weekday:'short'});
    });
    const counts = Array.from({length:7}, (_,i) => {
      const d = new Date(); d.setDate(d.getDate()-6+i);
      const dayStr = d.toDateString();
      return allAlerts.filter(a => new Date(a.created_at).toDateString() === dayStr).length;
    });

    const ctxA = document.getElementById('chart-activity');
    const ctxS = document.getElementById('chart-status');
    if (!ctxA || !ctxS) return;

    const defaults = { color: '#94a3b8', borderColor: 'rgba(99,120,255,0.12)', font: { family: 'Inter' } };
    Chart.defaults.color = defaults.color;
    Chart.defaults.borderColor = defaults.borderColor;
    Chart.defaults.font.family = defaults.font.family;

    const c1 = new Chart(ctxA, {
      type: 'bar',
      data: {
        labels: days,
        datasets: [{
          label: 'Alerts',
          data: counts,
          backgroundColor: counts.map(v => v > 0 ? 'rgba(244,63,94,0.7)' : 'rgba(99,102,241,0.3)'),
          borderColor: counts.map(v => v > 0 ? '#f43f5e' : '#6366f1'),
          borderWidth: 1, borderRadius: 6, borderSkipped: false,
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: { backgroundColor: 'rgba(9,13,28,0.95)', borderColor: 'rgba(99,120,255,0.2)', borderWidth: 1, padding: 10 } },
        scales: {
          x: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#475569' } },
          y: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#475569', stepSize: 1 }, min: 0 },
        }
      }
    });

    const active = allAlerts.filter(a => a.status === 'active').length;
    const resolved = allAlerts.filter(a => a.status === 'resolved').length;
    const c2 = new Chart(ctxS, {
      type: 'doughnut',
      data: {
        labels: ['Active', 'Resolved'],
        datasets: [{ data: [active || 0.01, resolved || 0.01], backgroundColor: ['rgba(244,63,94,0.85)','rgba(74,222,128,0.7)'], borderColor: ['#f43f5e','#4ade80'], borderWidth: 2, hoverOffset: 8 }]
      },
      options: {
        responsive: true, maintainAspectRatio: false, cutout: '72%',
        plugins: {
          legend: { position: 'bottom', labels: { padding: 16, boxWidth: 12, color: '#94a3b8' } },
          tooltip: { backgroundColor: 'rgba(9,13,28,0.95)', borderColor: 'rgba(99,120,255,0.2)', borderWidth: 1, padding: 10 }
        }
      }
    });
    chartInstance = [c1, c2];
  } catch {}
}

async function loadRecentAlerts() {
  try {
    const alerts = await api.alerts('active');
    const el = document.getElementById('dash-alerts');
    if (!el) return;
    if (!alerts.length) {
      el.innerHTML = `<div class="empty-state"><div class="empty-icon">✅</div><p>No active alerts — all clear</p></div>`;
      return;
    }
    el.innerHTML = alerts.slice(0, 6).map(alertCardHTML).join('');
  } catch {}
}

function alertCardHTML(a) {
  const age = timeAgo(a.created_at);
  const pClass = a.priority === 'CRITICAL' ? 'critical' : a.priority === 'HIGH' ? 'high' : 'medium';
  let summaryHTML = `<div class="alert-summary">${a.ai_summary || '—'}</div>`;
  try {
    const ai = JSON.parse(a.ai_summary);
    if (ai.Category && ai.RecommendedResponse) {
      summaryHTML = `
        <div class="ai-summary-box">
          <div class="ai-cat">⚡ AI · ${ai.Category}</div>
          <div class="ai-action">${ai.RecommendedResponse}</div>
          <div class="ai-desc">${ai.OperatorSummary}</div>
        </div>`;
    }
  } catch {}
  return `
    <div class="alert-card ${a.status}">
      <div class="alert-header">
        <div>
          <div class="alert-pole-id">${a.pole_id}</div>
          <div class="alert-pole-name">${a.pole_name || 'Unknown'}</div>
          <div class="alert-location">📍 ${a.location_name || '—'}</div>
        </div>
        <span class="alert-badge badge-${pClass}">${a.priority}</span>
      </div>
      ${summaryHTML}
      <div class="alert-meta">
        <span>🕐 ${age}</span>
        <span class="alert-badge ${a.status === 'active' ? 'badge-active' : 'badge-resolved'}">${a.status}</span>
      </div>
    </div>`;
}

function timeAgo(iso) {
  const s = Math.floor((Date.now() - new Date(iso)) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s/60)}m ago`;
  return `${Math.floor(s/3600)}h ago`;
}
