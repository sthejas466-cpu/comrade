import { api, setAuth } from '../api.js';
import { showToast } from '../components/toast.js';
import { shieldSVG } from '../components/logo.js';

export function renderLogin() {
  return `
    <div id="login-page">
      <div class="login-bg-grid"></div>
      <div class="login-glow-1"></div>
      <div class="login-glow-2"></div>
      <div class="login-box">
        <div class="login-logo">
          <div class="login-logo-emblem">${shieldSVG({ size: 48 })}</div>
          <div class="login-title">COMRADE</div>
          <div class="login-subtitle">Smart Emergency Response Network</div>
        </div>
        <div id="login-error" class="login-error"></div>
        <form id="login-form">
          <div class="form-group">
            <label class="form-label" for="email">Email Address</label>
            <input id="email" class="form-input" type="email" placeholder="admin@comrade.gov" required autocomplete="email" />
          </div>
          <div class="form-group">
            <label class="form-label" for="password">Password</label>
            <input id="password" class="form-input" type="password" placeholder="••••••••" required autocomplete="current-password" />
          </div>
          <button id="btn-login" type="submit" class="btn btn-primary btn-lg btn-full">
            🔐 Sign In to COMRADE
          </button>
        </form>
        <p class="login-hint">admin@comrade.gov &nbsp;/&nbsp; admin123</p>
      </div>
    </div>`;
}

export function bindLoginEvents(navigate) {
  const form = document.getElementById('login-form');
  const errEl = document.getElementById('login-error');
  const btn = document.getElementById('btn-login');

  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    errEl.classList.remove('show');
    btn.disabled = true;
    btn.textContent = 'Authenticating…';
    try {
      const { token, operator } = await api.login(
        document.getElementById('email').value.trim(),
        document.getElementById('password').value
      );
      setAuth(token, operator);
      showToast('Access Granted', `Welcome back, ${operator.name}`, 'success');
      navigate('dashboard');
    } catch (err) {
      errEl.textContent = err.message;
      errEl.classList.add('show');
    } finally {
      btn.disabled = false;
      btn.innerHTML = '🔐 Sign In to COMRADE';
    }
  });
}
