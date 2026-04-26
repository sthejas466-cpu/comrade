// ─── Demo Simulation Module ───────────────────────────────────────────────────
// Persistent floating "Simulate Emergency" button shown on all authenticated pages.

import { api } from '../api.js';
import { showToast, playAlertSound } from './toast.js';

let simBtn, simPanel, autoSimInterval;
let isAutoMode = false;

const SCENARIOS = [
  { type: 'SOS',      priority: 'CRITICAL', label: 'Physical Assault',  ai: { Severity:'Critical', Category:'Assault',  RecommendedResponse:'Dispatch armed response unit immediately. Cordon area.', OperatorSummary:'Assault in progress detected at pole location. Immediate dispatch required.' } },
  { type: 'SOS',      priority: 'CRITICAL', label: 'Medical Emergency', ai: { Severity:'Critical', Category:'Medical',  RecommendedResponse:'Dispatch ambulance and on-site medical responders without delay.', OperatorSummary:'Unresponsive individual reported. Medical emergency — ambulance en route.' } },
  { type: 'SOS',      priority: 'HIGH',     label: 'Theft in Progress', ai: { Severity:'High',     Category:'Theft',    RecommendedResponse:'Alert nearest patrol unit. Preserve CCTV footage from pole camera.', OperatorSummary:'Bag-snatch incident reported near the pole. Suspect on foot, heading north.' } },
  { type: 'SOS',      priority: 'HIGH',     label: 'Crowd Panic',       ai: { Severity:'High',     Category:'Panic',    RecommendedResponse:'Deploy crowd control personnel. Announce evacuation route via broadcast.', OperatorSummary:'Large crowd panic detected. Possible stampede risk — crowd management required.' } },
  { type: 'SOS',      priority: 'HIGH',     label: 'Suspicious Object', ai: { Severity:'High',     Category:'Other',    RecommendedResponse:'Alert bomb disposal unit. Evacuate 50m radius around pole immediately.', OperatorSummary:'Unattended suspicious object reported adjacent to pole. Evacuation initiated.' } },
  { type: 'SOS',      priority: 'CRITICAL', label: 'Fire / Smoke',      ai: { Severity:'Critical', Category:'Other',    RecommendedResponse:'Dispatch fire brigade. Activate water sprinklers in nearest zone.', OperatorSummary:'Smoke detected near pole sensor. Possible fire outbreak — fire brigade dispatched.' } },
];

export function initSimulator() {
  injectSimulatorUI();
  bindSimulatorEvents();
}

export function showSimulator() {
  simBtn?.classList.remove('hidden');
  simPanel?.classList.remove('hidden');
}

export function hideSimulator() {
  simBtn?.classList.add('hidden');
  simPanel?.classList.add('hidden');
  stopAutoSim();
}

// ─── Inject UI ────────────────────────────────────────────────────────────────
function injectSimulatorUI() {
  // Remove any existing
  document.getElementById('sim-root')?.remove();

  const root = document.createElement('div');
  root.id = 'sim-root';
  root.innerHTML = `
    <!-- Floating trigger button -->
    <button id="sim-btn" class="sim-trigger">
      <span class="sim-trigger-icon">
        <svg width="14" height="16" viewBox="0 0 24 28" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 1L2 5.5V14C2 20.8 6.5 26.5 12 28C17.5 26.5 22 20.8 22 14V5.5L12 1Z" fill="white" opacity="0.9"/>
          <rect x="10.75" y="8.5" width="2.5" height="11" rx="1.25" fill="#f43f5e"/>
          <rect x="7" y="12.25" width="10" height="2.5" rx="1.25" fill="#f43f5e"/>
        </svg>
      </span>
      <span class="sim-trigger-label">SIMULATE</span>
    </button>

    <!-- Expanded panel -->
    <div id="sim-panel" class="sim-panel hidden">
      <div class="sim-panel-header">
        <div class="sim-panel-title">
          <span class="sim-pulse-dot"></span>
          DEMO SIMULATION MODE
        </div>
        <button id="sim-panel-close" class="sim-panel-close">✕</button>
      </div>

      <div class="sim-panel-body">
        <p class="sim-desc">Generate realistic emergency scenarios for live demos and presentations.</p>

        <!-- Single trigger -->
        <button id="sim-fire-btn" class="btn sim-fire-btn">
          <span id="sim-fire-icon">🚨</span>
          <span id="sim-fire-label">Simulate Emergency</span>
        </button>

        <!-- Scenario selector -->
        <div class="sim-field">
          <label class="sim-label">Scenario</label>
          <select id="sim-scenario" class="form-input">
            <option value="random">🎲 Random</option>
            ${SCENARIOS.map((s,i) => `<option value="${i}">${s.label}</option>`).join('')}
          </select>
        </div>

        <!-- Pole selector -->
        <div class="sim-field">
          <label class="sim-label">Target Pole</label>
          <select id="sim-pole" class="form-input">
            <option value="random">🎲 Random Online Pole</option>
          </select>
        </div>

        <div class="sim-divider"></div>

        <!-- Auto mode -->
        <div class="sim-auto-row">
          <div>
            <div class="sim-auto-title">Auto Simulation</div>
            <div class="sim-auto-sub">Fire alerts automatically</div>
          </div>
          <button id="sim-auto-btn" class="sim-auto-toggle">Start</button>
        </div>
        <div class="sim-field" id="sim-interval-wrap">
          <label class="sim-label">Interval (seconds)</label>
          <input id="sim-interval" type="number" class="form-input" value="8" min="3" max="60" />
        </div>

        <div class="sim-divider"></div>
        <div id="sim-log" class="sim-log"></div>
      </div>
    </div>

    <!-- Alert flash overlay -->
    <div id="sim-flash" class="sim-flash hidden"></div>
  `;
  document.body.appendChild(root);

  simBtn   = document.getElementById('sim-btn');
  simPanel = document.getElementById('sim-panel');

  // Load poles into selector
  loadPolesIntoSelector();
}

async function loadPolesIntoSelector() {
  try {
    const poles = await api.poles();
    const sel = document.getElementById('sim-pole');
    if (!sel) return;
    const online = poles.filter(p => p.status === 'online');
    online.forEach(p => {
      const opt = document.createElement('option');
      opt.value = p.pole_id;
      opt.textContent = `${p.pole_id} — ${p.pole_name}`;
      sel.appendChild(opt);
    });
  } catch {}
}

// ─── Bind Events ──────────────────────────────────────────────────────────────
function bindSimulatorEvents() {
  // Toggle panel
  simBtn.addEventListener('click', () => {
    simPanel.classList.toggle('hidden');
    simPanel.classList.toggle('open');
  });

  document.getElementById('sim-panel-close').addEventListener('click', () => {
    simPanel.classList.add('hidden');
    simPanel.classList.remove('open');
  });

  // Fire single alert
  document.getElementById('sim-fire-btn').addEventListener('click', () => {
    fireSimulation();
  });

  // Auto mode toggle
  document.getElementById('sim-auto-btn').addEventListener('click', () => {
    isAutoMode ? stopAutoSim() : startAutoSim();
  });
}

// ─── Core Fire Logic ──────────────────────────────────────────────────────────
async function fireSimulation() {
  const fireBtn = document.getElementById('sim-fire-btn');
  const fireLabel = document.getElementById('sim-fire-label');
  const fireIcon  = document.getElementById('sim-fire-icon');

  if (fireBtn?.disabled) return;
  if (fireBtn) { fireBtn.disabled = true; fireLabel.textContent = 'Generating…'; fireIcon.textContent = '⏳'; }

  try {
    const poles = await api.poles();
    const online = poles.filter(p => p.status === 'online');
    if (!online.length) { showToast('No Online Poles', 'All poles are offline — cannot simulate.', 'error'); return; }

    // Pick pole
    const poleSelVal = document.getElementById('sim-pole')?.value || 'random';
    const pole = poleSelVal === 'random'
      ? online[Math.floor(Math.random() * online.length)]
      : (poles.find(p => p.pole_id === poleSelVal) || online[0]);

    // Pick scenario
    const scenSelVal = document.getElementById('sim-scenario')?.value ?? 'random';
    const scenario = scenSelVal === 'random'
      ? SCENARIOS[Math.floor(Math.random() * SCENARIOS.length)]
      : SCENARIOS[parseInt(scenSelVal)];

    // Fire alert via API
    await api.createAlert({
      pole_id:    pole.pole_id,
      alert_type: scenario.type,
      priority:   scenario.priority,
      ai_summary: JSON.stringify(scenario.ai),
    });

    // Visual feedback
    triggerFlash();
    playAlertSound();
    showToast(
      `🚨 SIMULATION: ${scenario.label}`,
      `${pole.pole_id} — ${pole.location_name} · Priority: ${scenario.priority}`,
      'error', 7000
    );
    addSimLog(scenario.label, pole.pole_id, scenario.priority);

  } catch (err) {
    showToast('Simulation Failed', err.message, 'error');
  } finally {
    if (fireBtn) {
      setTimeout(() => {
        fireBtn.disabled = false;
        if (fireLabel) fireLabel.textContent = 'Simulate Emergency';
        if (fireIcon)  fireIcon.textContent = '🚨';
      }, 1200);
    }
  }
}

function startAutoSim() {
  isAutoMode = true;
  const btn = document.getElementById('sim-auto-btn');
  if (btn) { btn.textContent = 'Stop'; btn.classList.add('running'); }
  document.getElementById('sim-btn')?.classList.add('auto-running');

  const interval = Math.max(3, parseInt(document.getElementById('sim-interval')?.value || '8')) * 1000;
  fireSimulation();
  autoSimInterval = setInterval(fireSimulation, interval);
}

function stopAutoSim() {
  isAutoMode = false;
  clearInterval(autoSimInterval);
  const btn = document.getElementById('sim-auto-btn');
  if (btn) { btn.textContent = 'Start'; btn.classList.remove('running'); }
  document.getElementById('sim-btn')?.classList.remove('auto-running');
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function triggerFlash() {
  const flash = document.getElementById('sim-flash');
  if (!flash) return;
  flash.classList.remove('hidden');
  flash.classList.add('active');
  setTimeout(() => { flash.classList.remove('active'); flash.classList.add('hidden'); }, 600);
}

function addSimLog(scenario, poleId, priority) {
  const log = document.getElementById('sim-log');
  if (!log) return;
  const row = document.createElement('div');
  row.className = 'sim-log-row';
  row.innerHTML = `
    <span class="sim-log-time">${new Date().toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit',second:'2-digit'})}</span>
    <span class="sim-log-pole">${poleId}</span>
    <span class="sim-log-scene">${scenario}</span>
    <span class="sim-log-pri sim-pri-${priority.toLowerCase()}">${priority}</span>`;
  log.prepend(row);
  // Keep max 5 entries
  while (log.children.length > 5) log.removeChild(log.lastChild);
}
