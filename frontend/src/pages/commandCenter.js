import { api, API_BASE } from '../api.js';
import { renderSidebar, bindSidebarEvents } from '../components/sidebar.js';
import { showToast } from '../components/toast.js';
import { io } from 'socket.io-client';

let socket, cmdInterval;

export function renderCommandCenter() {
  return `
    <div id="app-shell">
      ${renderSidebar('command-center')}
      <div id="main-content">
        <div class="page-header">
          <div>
            <div class="page-title">COMMAND CENTER</div>
            <div class="page-subtitle">Send commands to field poles</div>
          </div>
        </div>
        <div class="page-body">
          <!-- Quick Commands -->
          <div class="cmd-grid">
            <div class="cmd-card">
              <div class="cmd-icon">🔊</div>
              <div class="cmd-title">SIREN ON</div>
              <div class="cmd-desc">Activate siren on selected pole to deter threats and signal emergency.</div>
              <select id="siren-on-pole" class="form-input" style="margin-bottom:12px"></select>
              <button id="btn-siren-on" class="btn btn-danger btn-full">🔊 Activate Siren</button>
            </div>
            <div class="cmd-card">
              <div class="cmd-icon">🔇</div>
              <div class="cmd-title">SIREN OFF</div>
              <div class="cmd-desc">Deactivate siren when situation is under control or alert is cleared.</div>
              <select id="siren-off-pole" class="form-input" style="margin-bottom:12px"></select>
              <button id="btn-siren-off" class="btn btn-ghost btn-full">🔇 Deactivate Siren</button>
            </div>
            <div class="cmd-card">
              <div class="cmd-icon">📢</div>
              <div class="cmd-title">BROADCAST</div>
              <div class="cmd-desc">Send a public announcement to all online poles simultaneously.</div>
              <textarea id="broadcast-msg" class="form-input" placeholder="Enter broadcast message…" style="margin-bottom:12px"></textarea>
              <button id="btn-broadcast" class="btn btn-primary btn-full">📢 Send Broadcast</button>
            </div>
          </div>

          <!-- Command Log -->
          <div class="section-header">
            <div class="section-title">COMMAND LOG</div>
            <span class="live-dot">Live</span>
          </div>
          <div class="glass-card" style="padding:0;overflow:hidden">
            <div class="table-wrap" id="cmd-log"></div>
          </div>
        </div>
      </div>
    </div>`;
}

export async function bindCommandCenterEvents(navigate) {
  bindSidebarEvents(navigate);

  // Load poles into dropdowns
  try {
    const poles = await api.poles();
    const opts = poles.map(p => `<option value="${p.pole_id}">${p.pole_id} — ${p.pole_name}</option>`).join('');
    document.getElementById('siren-on-pole').innerHTML = opts;
    document.getElementById('siren-off-pole').innerHTML = opts;
  } catch {}

  await loadCmdLog();
  cmdInterval = setInterval(loadCmdLog, 3000);

  socket = io(API_BASE);
  socket.on('command_sent', () => loadCmdLog());
  socket.on('command_executed', () => loadCmdLog());
  socket.on('broadcast_sent', (d) => {
    showToast('📢 Broadcast Sent', `Message delivered to ${d.pole_count} poles`, 'success');
  });

  document.getElementById('btn-siren-on')?.addEventListener('click', async () => {
    const pole = document.getElementById('siren-on-pole').value;
    try {
      await api.sendCommand(pole, 'SIREN_ON');
      showToast('🔊 Siren ON', `Command sent to ${pole}`, 'warning');
    } catch (e) { showToast('Error', e.message, 'error'); }
  });

  document.getElementById('btn-siren-off')?.addEventListener('click', async () => {
    const pole = document.getElementById('siren-off-pole').value;
    try {
      await api.sendCommand(pole, 'SIREN_OFF');
      showToast('🔇 Siren OFF', `Command sent to ${pole}`, 'info');
    } catch (e) { showToast('Error', e.message, 'error'); }
  });

  document.getElementById('btn-broadcast')?.addEventListener('click', async () => {
    const msg = document.getElementById('broadcast-msg').value.trim();
    if (!msg) { showToast('Error', 'Enter a message first', 'error'); return; }
    try {
      await api.broadcast(msg);
      document.getElementById('broadcast-msg').value = '';
    } catch (e) { showToast('Error', e.message, 'error'); }
  });
}

export function unbindCommandCenter() {
  clearInterval(cmdInterval);
  socket?.disconnect();
}

async function loadCmdLog() {
  try {
    const cmds = await api.commands();
    const el = document.getElementById('cmd-log');
    if (!el) return;
    if (!cmds.length) { el.innerHTML = `<div class="empty-state"><div class="empty-icon">⚡</div><p>No commands sent yet</p></div>`; return; }
    el.innerHTML = `
      <table>
        <thead><tr><th>Pole</th><th>Command</th><th>Status</th><th>Operator</th><th>Time</th></tr></thead>
        <tbody>
          ${cmds.map(c => `
            <tr>
              <td><span style="font-family:var(--font-mono);font-size:0.78rem;color:var(--blue)">${c.pole_id}</span></td>
              <td>${c.command_type}</td>
              <td>
                <span class="chip ${c.status === 'executed' || c.status === 'delivered' ? 'badge-online' : 'badge-active'}" style="font-size:0.65rem">
                  ${c.status}
                </span>
              </td>
              <td style="color:var(--muted)">${c.operator_name || '—'}</td>
              <td style="font-size:0.78rem;color:var(--muted)">${new Date(c.created_at).toLocaleTimeString()}</td>
            </tr>`).join('')}
        </tbody>
      </table>`;
  } catch {}
}
