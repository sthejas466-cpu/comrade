import { api } from '../api.js';
import { renderSidebar, bindSidebarEvents } from '../components/sidebar.js';

let allResolved = [];

export function renderIncidentHistory() {
  return `
    <div id="app-shell">
      ${renderSidebar('incident-history')}
      <div id="main-content">
        <div class="page-header">
          <div>
            <div class="page-title">INCIDENT HISTORY</div>
            <div class="page-subtitle">Searchable log of all resolved incidents</div>
          </div>
        </div>
        <div class="page-body">
          <div style="display:flex;gap:12px;margin-bottom:20px;flex-wrap:wrap">
            <div class="search-bar" style="flex:1;min-width:220px">
              <span class="icon">🔍</span>
              <input id="search-input" placeholder="Search by pole, location, type…" />
            </div>
            <select id="filter-priority" class="form-input" style="width:auto;padding:8px 14px">
              <option value="">All Priorities</option>
              <option value="CRITICAL">Critical</option>
              <option value="HIGH">High</option>
              <option value="MEDIUM">Medium</option>
            </select>
          </div>
          <div class="glass-card" style="padding:0;overflow:hidden">
            <div class="table-wrap" id="history-table"></div>
          </div>
        </div>
      </div>
    </div>`;
}

export async function bindIncidentHistoryEvents(navigate) {
  bindSidebarEvents(navigate);
  try {
    allResolved = await api.alerts('resolved');
    renderTable(allResolved);
  } catch {}
  document.getElementById('search-input')?.addEventListener('input', applyFilter);
  document.getElementById('filter-priority')?.addEventListener('change', applyFilter);
}

function applyFilter() {
  const q = document.getElementById('search-input').value.toLowerCase();
  const p = document.getElementById('filter-priority').value;
  const filtered = allResolved.filter(a =>
    (!q || [a.pole_id, a.pole_name, a.location_name, a.alert_type].join(' ').toLowerCase().includes(q)) &&
    (!p || a.priority === p)
  );
  renderTable(filtered);
}

function renderTable(rows) {
  const el = document.getElementById('history-table');
  if (!el) return;
  if (!rows.length) {
    el.innerHTML = `<div class="empty-state"><div class="empty-icon">📋</div><p>No resolved incidents found</p></div>`;
    return;
  }
  el.innerHTML = `
    <table>
      <thead>
        <tr><th>#</th><th>Pole ID</th><th>Location</th><th>Type</th><th>Priority</th><th>Triggered</th><th>Resolved</th></tr>
      </thead>
      <tbody>
        ${rows.map((a, i) => `
          <tr>
            <td style="color:var(--muted)">${i + 1}</td>
            <td><span style="font-family:var(--font-mono);font-size:0.78rem;color:var(--blue)">${a.pole_id}</span></td>
            <td style="color:var(--muted)">📍 ${a.location_name || '—'}</td>
            <td>${a.alert_type}</td>
            <td><span class="alert-badge badge-${(a.priority||'').toLowerCase()}">${a.priority}</span></td>
            <td style="font-size:0.78rem;color:var(--muted)">${fmt(a.created_at)}</td>
            <td style="font-size:0.78rem;color:var(--green)">${a.resolved_at ? fmt(a.resolved_at) : '—'}</td>
          </tr>`).join('')}
      </tbody>
    </table>`;
}

function fmt(iso) {
  return new Date(iso).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' });
}
