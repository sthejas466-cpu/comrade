import { api, API_BASE } from '../api.js';
import { renderSidebar, bindSidebarEvents } from '../components/sidebar.js';
import { showToast } from '../components/toast.js';
import { io } from 'socket.io-client';

let socket, poleInterval;
let allPoles = [];
let filterStatus = 'all';
let searchQuery = '';

// ─── Render Shell ────────────────────────────────────────────────────────────
export function renderPoleManagement() {
  return `
    <div id="app-shell">
      ${renderSidebar('pole-management')}
      <div id="main-content">
        <div class="page-header">
          <div>
            <div class="page-title">POLE MANAGEMENT</div>
            <div class="page-subtitle">Monitor and control all network poles</div>
          </div>
          <div class="header-right">
            <div class="live-badge"><span class="live-dot"></span>LIVE</div>
          </div>
        </div>

        <div class="page-body">
          <!-- Toolbar -->
          <div class="pm-toolbar">
            <div class="search-bar" style="flex:1;max-width:320px">
              <span class="icon">🔍</span>
              <input id="pm-search" placeholder="Search by ID, name, location…" autocomplete="off" />
            </div>
            <div class="filter-tabs" id="pm-filter-tabs">
              <button class="filter-tab active" data-filter="all">All</button>
              <button class="filter-tab" data-filter="online">
                <span class="dot online" style="width:6px;height:6px;display:inline-block;border-radius:50%;margin-right:4px"></span>Online
              </button>
              <button class="filter-tab" data-filter="offline">
                <span class="dot offline" style="width:6px;height:6px;display:inline-block;border-radius:50%;margin-right:4px"></span>Offline
              </button>
            </div>
            <div id="pm-count" class="pm-count"></div>
          </div>

          <!-- Table -->
          <div class="glass-card" style="padding:0;overflow:hidden">
            <div id="poles-table-wrap">
              <div class="empty-state"><div class="empty-icon">⏳</div><p>Loading poles…</p></div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Pole Detail Modal -->
    <div id="pole-modal" class="modal-overlay hidden">
      <div class="modal-box">
        <div class="modal-header">
          <div>
            <div id="modal-pole-id" class="modal-pole-id"></div>
            <div id="modal-pole-name" class="modal-pole-name"></div>
          </div>
          <button id="modal-close" class="modal-close">✕</button>
        </div>
        <div id="modal-body" class="modal-body"></div>
      </div>
    </div>`;
}

// ─── Bind Events ─────────────────────────────────────────────────────────────
export async function bindPoleManagementEvents(navigate) {
  filterStatus = 'all';
  searchQuery = '';

  bindSidebarEvents(navigate);
  await loadPoles();
  poleInterval = setInterval(loadPoles, 3000);

  socket = io(API_BASE);
  socket.on('pole_updated', loadPoles);
  socket.on('pole_added', loadPoles);

  // Search
  document.getElementById('pm-search')?.addEventListener('input', (e) => {
    searchQuery = e.target.value.toLowerCase();
    renderTable();
  });

  // Filter tabs
  document.getElementById('pm-filter-tabs')?.addEventListener('click', (e) => {
    const btn = e.target.closest('.filter-tab');
    if (!btn) return;
    document.querySelectorAll('.filter-tab').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    filterStatus = btn.dataset.filter;
    renderTable();
  });

  // Modal close
  document.getElementById('modal-close')?.addEventListener('click', closeModal);
  document.getElementById('pole-modal')?.addEventListener('click', (e) => {
    if (e.target.id === 'pole-modal') closeModal();
  });
}

export function unbindPoleManagement() {
  clearInterval(poleInterval);
  socket?.disconnect();
}

// ─── Data Loading ─────────────────────────────────────────────────────────────
async function loadPoles() {
  try {
    allPoles = await api.poles();
    renderTable();
  } catch {}
}

// ─── Table Render (filtered) ──────────────────────────────────────────────────
function renderTable() {
  const wrap = document.getElementById('poles-table-wrap');
  if (!wrap) return;

  let poles = allPoles;
  if (filterStatus !== 'all') poles = poles.filter(p => p.status === filterStatus);
  if (searchQuery) poles = poles.filter(p =>
    [p.pole_id, p.pole_name, p.location_name].join(' ').toLowerCase().includes(searchQuery)
  );

  // Update count badge
  const countEl = document.getElementById('pm-count');
  if (countEl) {
    const onlineCount = allPoles.filter(p => p.status === 'online').length;
    countEl.innerHTML = `
      <span class="pm-stat"><span class="dot online" style="width:7px;height:7px;display:inline-block;border-radius:50%;margin-right:5px;vertical-align:middle"></span>${onlineCount} Online</span>
      <span class="pm-stat-sep">/</span>
      <span class="pm-stat">${allPoles.length - onlineCount} Offline</span>`;
  }

  if (!poles.length) {
    wrap.innerHTML = `<div class="empty-state"><div class="empty-icon">🗼</div><p>${searchQuery || filterStatus !== 'all' ? 'No poles match your filter.' : 'No poles found.'}</p></div>`;
    return;
  }

  wrap.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>Pole ID</th>
          <th>Name</th>
          <th>Location</th>
          <th>Status</th>
          <th style="min-width:160px">Battery</th>
          <th>Last Active</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        ${poles.map(p => poleRow(p)).join('')}
      </tbody>
    </table>`;

  bindTableEvents(poles);
}

function poleRow(p) {
  const bat = p.battery_level ?? 0;
  const batClass = bat > 50 ? 'high' : bat > 20 ? 'mid' : 'low';
  const batColor = bat > 50 ? 'var(--green)' : bat > 20 ? 'var(--yellow)' : 'var(--red)';
  const lastSeen = p.last_seen ? timeAgo(p.last_seen) : '—';
  const isOffline = p.status === 'offline';

  return `
    <tr class="pole-row ${isOffline ? 'row-offline' : ''}" data-pole-id="${p.pole_id}" style="cursor:pointer">
      <td>
        <span class="pole-id-cell">${p.pole_id}</span>
      </td>
      <td>
        <div class="pole-name-cell">
          <span class="pole-name">${p.pole_name}</span>
        </div>
      </td>
      <td>
        <span class="pole-location">📍 ${p.location_name}</span>
      </td>
      <td>
        <div class="status-dot">
          <span class="dot ${p.status}"></span>
          <span class="status-label ${p.status}">${p.status}</span>
        </div>
      </td>
      <td>
        <div class="battery-bar-enhanced">
          <div class="battery-icon" style="color:${batColor}">
            ${bat > 50 ? '🔋' : bat > 20 ? '🪫' : '⚠️'}
          </div>
          <div class="battery-track-enhanced">
            <div class="battery-fill-enhanced" style="width:${bat}%;background:${batColor}"></div>
          </div>
          <span class="battery-pct" style="color:${batColor}">${bat}%</span>
        </div>
      </td>
      <td>
        <div class="last-seen-cell">
          <span class="last-seen-time">${lastSeen}</span>
          ${p.last_seen ? `<span class="last-seen-abs">${new Date(p.last_seen).toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'})}</span>` : ''}
        </div>
      </td>
      <td onclick="event.stopPropagation()">
        <div class="row-actions">
          <button class="btn btn-ghost btn-detail-pole" data-pole="${p.pole_id}" style="font-size:0.72rem;padding:5px 10px">
            🔍 Details
          </button>
          <button class="btn ${p.status === 'online' ? 'btn-danger' : 'btn-success'} btn-toggle-status"
            data-pole="${p.pole_id}" data-status="${p.status}"
            style="font-size:0.72rem;padding:5px 10px">
            ${p.status === 'online' ? '⏸ Offline' : '▶ Online'}
          </button>
        </div>
      </td>
    </tr>`;
}

function bindTableEvents(poles) {
  // Row click → open modal
  document.querySelectorAll('.pole-row').forEach(row => {
    row.addEventListener('click', () => {
      const pole = poles.find(p => p.pole_id === row.dataset.poleId);
      if (pole) openModal(pole);
    });
  });

  // Toggle status
  document.querySelectorAll('.btn-toggle-status').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const newStatus = btn.dataset.status === 'online' ? 'offline' : 'online';
      btn.disabled = true;
      try {
        await api.updatePole(btn.dataset.pole, { status: newStatus });
        showToast('Pole Updated', `${btn.dataset.pole} → ${newStatus}`, 'success');
        await loadPoles();
      } catch (err) {
        showToast('Error', err.message, 'error');
        btn.disabled = false;
      }
    });
  });

  // Detail button
  document.querySelectorAll('.btn-detail-pole').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const pole = poles.find(p => p.pole_id === btn.dataset.pole);
      if (pole) openModal(pole);
    });
  });
}

// ─── Modal ────────────────────────────────────────────────────────────────────
function openModal(p) {
  const modal = document.getElementById('pole-modal');
  const bat = p.battery_level ?? 0;
  const batColor = bat > 50 ? 'var(--green)' : bat > 20 ? 'var(--yellow)' : 'var(--red)';
  const isOnline = p.status === 'online';

  document.getElementById('modal-pole-id').textContent = p.pole_id;
  document.getElementById('modal-pole-name').textContent = p.pole_name;
  document.getElementById('modal-body').innerHTML = `
    <!-- Status Banner -->
    <div class="modal-status-banner ${isOnline ? 'banner-online' : 'banner-offline'}">
      <span class="dot ${p.status}" style="width:9px;height:9px"></span>
      <span>${isOnline ? 'POLE ONLINE — Active & Reporting' : 'POLE OFFLINE — No signal received'}</span>
    </div>

    <!-- Info Grid -->
    <div class="modal-info-grid">
      <div class="modal-info-item">
        <div class="modal-info-label">Location</div>
        <div class="modal-info-value">📍 ${p.location_name}</div>
      </div>
      <div class="modal-info-item">
        <div class="modal-info-label">Coordinates</div>
        <div class="modal-info-value" style="font-family:var(--font-code);font-size:0.82rem">${p.latitude?.toFixed(4) ?? '—'}, ${p.longitude?.toFixed(4) ?? '—'}</div>
      </div>
      <div class="modal-info-item">
        <div class="modal-info-label">Last Active</div>
        <div class="modal-info-value">${p.last_seen ? new Date(p.last_seen).toLocaleString('en-IN',{dateStyle:'medium',timeStyle:'short'}) : '—'}</div>
      </div>
      <div class="modal-info-item">
        <div class="modal-info-label">Installed On</div>
        <div class="modal-info-value">${p.created_at ? new Date(p.created_at).toLocaleDateString('en-IN',{dateStyle:'medium'}) : '—'}</div>
      </div>
    </div>

    <!-- Battery Section -->
    <div class="modal-section">
      <div class="modal-section-title">BATTERY STATUS</div>
      <div class="modal-battery">
        <div class="modal-battery-label">
          <span style="font-family:var(--font-mono);font-size:1.6rem;font-weight:700;color:${batColor}">${bat}%</span>
          <span class="modal-battery-status">${bat > 80 ? 'Excellent' : bat > 50 ? 'Good' : bat > 20 ? 'Low — Schedule maintenance' : '⚠ Critical — Replace immediately'}</span>
        </div>
        <div class="modal-battery-track">
          <div class="modal-battery-fill" style="width:${bat}%;background:${batColor};box-shadow:0 0 12px ${batColor}"></div>
        </div>
      </div>
    </div>

    <!-- Quick Commands -->
    <div class="modal-section">
      <div class="modal-section-title">QUICK COMMANDS</div>
      <div class="modal-cmd-row">
        <button class="btn btn-danger modal-btn-siren-on" data-pole="${p.pole_id}" ${!isOnline ? 'disabled' : ''}>🔊 Siren ON</button>
        <button class="btn btn-ghost modal-btn-siren-off" data-pole="${p.pole_id}" ${!isOnline ? 'disabled' : ''}>🔇 Siren OFF</button>
        <button class="btn ${isOnline ? 'btn-danger' : 'btn-success'} modal-btn-toggle"
          data-pole="${p.pole_id}" data-status="${p.status}">
          ${isOnline ? '⏸ Set Offline' : '▶ Set Online'}
        </button>
      </div>
    </div>`;

  // Bind modal commands
  document.querySelector('.modal-btn-siren-on')?.addEventListener('click', async () => {
    try { await api.sendCommand(p.pole_id, 'SIREN_ON'); showToast('🔊 Siren ON', `Command sent to ${p.pole_id}`, 'warning'); } catch (e) { showToast('Error', e.message, 'error'); }
  });
  document.querySelector('.modal-btn-siren-off')?.addEventListener('click', async () => {
    try { await api.sendCommand(p.pole_id, 'SIREN_OFF'); showToast('🔇 Siren OFF', `Command sent to ${p.pole_id}`, 'info'); } catch (e) { showToast('Error', e.message, 'error'); }
  });
  document.querySelector('.modal-btn-toggle')?.addEventListener('click', async (e) => {
    const newStatus = e.currentTarget.dataset.status === 'online' ? 'offline' : 'online';
    try {
      await api.updatePole(p.pole_id, { status: newStatus });
      showToast('Pole Updated', `${p.pole_id} → ${newStatus}`, 'success');
      closeModal();
      await loadPoles();
    } catch (err) { showToast('Error', err.message, 'error'); }
  });

  modal.classList.remove('hidden');
  requestAnimationFrame(() => modal.classList.add('open'));
}

function closeModal() {
  const modal = document.getElementById('pole-modal');
  modal.classList.remove('open');
  setTimeout(() => modal.classList.add('hidden'), 280);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function timeAgo(iso) {
  const s = Math.floor((Date.now() - new Date(iso)) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s/60)}m ago`;
  if (s < 86400) return `${Math.floor(s/3600)}h ago`;
  return `${Math.floor(s/86400)}d ago`;
}
