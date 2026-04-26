import { getOperator, clearAuth } from '../api.js';
import { shieldSVG } from './logo.js';

const NAV_ITEMS = [
  { id: 'dashboard',        icon: '▣',  label: 'Dashboard' },
  { id: 'live-alerts',      icon: '◈',  label: 'Live Alerts', badge: true },
  { id: 'pole-management',  icon: '◫',  label: 'Pole Management' },
  { id: 'incident-history', icon: '≡',  label: 'Incident History' },
  { id: 'command-center',   icon: '⌁',  label: 'Command Center' },
];

export function renderSidebar(activeId, alertCount = 0) {
  const op = getOperator();
  const initials = op?.name?.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase() || 'OP';
  return `
    <!-- Sidebar overlay (mobile) -->
    <div id="sidebar-overlay"></div>
    <div id="sidebar">
      <div class="sidebar-brand">
        <div class="brand-emblem">${shieldSVG({ size: 20 })}</div>
        <div>
          <div class="brand-name">COMRADE</div>
          <div class="brand-sub">Emergency Network</div>
        </div>
      </div>

      <div class="sidebar-section-label">Navigation</div>
      <nav class="sidebar-nav">
        ${NAV_ITEMS.map(n => `
          <a class="nav-item ${n.id === activeId ? 'active' : ''}" href="#${n.id}" data-page="${n.id}">
            <span class="nav-icon" style="font-style:normal;font-family:var(--font-code)">${n.icon}</span>
            <span>${n.label}</span>
            ${n.badge && alertCount > 0 ? `<span class="nav-badge">${alertCount}</span>` : ''}
          </a>
        `).join('')}
      </nav>

      <div class="sidebar-footer">
        <div class="operator-info">
          <div class="op-avatar">${initials}</div>
          <div>
            <div class="op-name">${op?.name || 'Operator'}</div>
            <div class="op-role">${op?.role || 'operator'}</div>
          </div>
          <button class="btn-logout" id="btn-logout" title="Logout">↪</button>
        </div>
      </div>
    </div>`;
}

export function bindSidebarEvents(navigate) {
  document.getElementById('btn-logout')?.addEventListener('click', () => {
    clearAuth();
    navigate('login');
  });

  // Mobile: hamburger open/close
  const sidebar  = document.getElementById('sidebar');
  const toggle   = document.getElementById('menu-toggle');
  const overlay  = document.getElementById('sidebar-overlay');

  const openSidebar  = () => { sidebar?.classList.add('open');    overlay?.classList.add('visible'); };
  const closeSidebar = () => { sidebar?.classList.remove('open'); overlay?.classList.remove('visible'); };

  toggle?.addEventListener('click', openSidebar);
  overlay?.addEventListener('click', closeSidebar);

  // Close sidebar on any nav click (mobile)
  document.querySelectorAll('.nav-item').forEach(a => {
    a.addEventListener('click', closeSidebar);
  });
}
