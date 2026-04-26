// ─── API & Socket Client ─────────────────────────────────────────────────────
// API_BASE comes from the Vite environment variable in production,
// or falls back to localhost for development.
export const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3001';

// ─── Auth helpers ─────────────────────────────────────────────────────────────
export function getToken()    { return localStorage.getItem('comrade_token'); }
export function getOperator() { return JSON.parse(localStorage.getItem('comrade_operator') || 'null'); }
export function setAuth(token, operator) {
  localStorage.setItem('comrade_token', token);
  localStorage.setItem('comrade_operator', JSON.stringify(operator));
}
export function clearAuth() {
  localStorage.removeItem('comrade_token');
  localStorage.removeItem('comrade_operator');
}

// ─── Request helper ───────────────────────────────────────────────────────────
const MAX_RETRIES = 1;

async function req(method, path, body, retries = 0) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000); // 10s timeout

  try {
    const res = await fetch(API_BASE + path, {
      method,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    clearTimeout(timeout);

    // Handle 401 globally — token expired
    if (res.status === 401 && !path.includes('/login')) {
      clearAuth();
      window.location.hash = '#login';
      throw new Error('Session expired. Please log in again.');
    }

    // Handle non-JSON responses gracefully
    const contentType = res.headers.get('content-type') || '';
    const data = contentType.includes('application/json') ? await res.json() : {};

    if (!res.ok) throw new Error(data.error || `Server error (${res.status})`);
    return data;

  } catch (err) {
    clearTimeout(timeout);

    // Retry once on network failure (not on abort/auth errors)
    if (retries < MAX_RETRIES && err.name !== 'AbortError' && err.message !== 'Session expired. Please log in again.') {
      await new Promise(r => setTimeout(r, 800));
      return req(method, path, body, retries + 1);
    }

    if (err.name === 'AbortError') throw new Error('Request timed out. Check your connection.');
    throw err;
  }
}

// ─── API surface ──────────────────────────────────────────────────────────────
export const api = {
  login:       (email, password)      => req('POST',  '/api/auth/login',       { email, password }),
  stats:       ()                      => req('GET',   '/api/stats'),
  poles:       ()                      => req('GET',   '/api/poles'),
  updatePole:  (pole_id, body)         => req('PATCH', `/api/poles/${pole_id}`, body),
  alerts:      (status)                => req('GET',   `/api/alerts${status ? `?status=${status}` : ''}`),
  resolveAlert:(id)                    => req('PATCH', `/api/alerts/${id}/resolve`),
  createAlert: (body)                  => req('POST',  '/api/alerts',           body),
  commands:    ()                      => req('GET',   '/api/commands'),
  sendCommand: (pole_id, command_type) => req('POST',  '/api/commands',         { pole_id, command_type }),
  broadcast:   (message)               => req('POST',  '/api/commands/broadcast',{ message }),
  health:      ()                      => req('GET',   '/api/health'),
};
