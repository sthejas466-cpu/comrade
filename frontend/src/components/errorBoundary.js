// ─── Global Error Boundary ────────────────────────────────────────────────────
// Catches runtime JS errors and renders a fallback UI instead of a white screen.

export function initErrorBoundary() {
  window.addEventListener('error', (e) => {
    console.error('Global error:', e.error);
    // Don't show error UI for minor/3rd-party errors
    if (!e.error || e.filename?.includes('socket.io')) return;
    showErrorScreen(e.error.message || 'An unexpected error occurred');
  });

  window.addEventListener('unhandledrejection', (e) => {
    console.error('Unhandled rejection:', e.reason);
    const msg = e.reason?.message || String(e.reason);
    // Ignore abort errors from fetch timeouts navigating away
    if (msg.includes('AbortError') || msg.includes('NetworkError')) return;
  });
}

export function showErrorScreen(message) {
  const app = document.getElementById('app');
  if (!app) return;
  app.innerHTML = `
    <div style="
      min-height:100vh; display:flex; align-items:center; justify-content:center;
      background:#05080f; font-family:'Inter',sans-serif; padding:24px;
    ">
      <div style="
        max-width:480px; width:100%; text-align:center;
        background:rgba(9,13,28,0.95); border:1px solid rgba(244,63,94,0.25);
        border-radius:20px; padding:44px 36px;
        box-shadow:0 32px 80px rgba(0,0,0,0.6);
      ">
        <div style="font-size:3rem; margin-bottom:16px;">⚠️</div>
        <div style="font-family:'Orbitron',sans-serif; font-size:1rem; font-weight:700; letter-spacing:3px; color:#f43f5e; margin-bottom:8px;">SYSTEM ERROR</div>
        <p style="color:#94a3b8; font-size:0.85rem; line-height:1.6; margin-bottom:28px;">${message}</p>
        <button onclick="window.location.reload()" style="
          padding:11px 28px; border-radius:10px; border:none; cursor:pointer;
          background:linear-gradient(135deg,#f43f5e,#9f1239); color:#fff;
          font-family:'Inter',sans-serif; font-size:0.875rem; font-weight:600;
          box-shadow:0 4px 16px rgba(244,63,94,0.4);
        ">↻ Reload Application</button>
        <br/><br/>
        <a href="#dashboard" style="color:#475569; font-size:0.78rem;" onclick="window.location.reload()">← Back to Dashboard</a>
      </div>
    </div>`;
}

// ─── Network status banner ────────────────────────────────────────────────────
let offlineBanner = null;

export function initNetworkMonitor() {
  const show = () => {
    if (offlineBanner) return;
    offlineBanner = document.createElement('div');
    offlineBanner.id = 'offline-banner';
    offlineBanner.style.cssText = `
      position:fixed; top:0; left:0; right:0; z-index:99999;
      background:rgba(244,63,94,0.95); color:#fff; text-align:center;
      padding:8px 16px; font-size:0.78rem; font-weight:600; letter-spacing:1px;
      font-family:'Inter',sans-serif; box-shadow:0 2px 12px rgba(244,63,94,0.5);
    `;
    offlineBanner.textContent = '⚡ No internet connection — COMRADE is offline';
    document.body.prepend(offlineBanner);
  };

  const hide = () => {
    offlineBanner?.remove();
    offlineBanner = null;
  };

  window.addEventListener('offline', show);
  window.addEventListener('online',  hide);
  if (!navigator.onLine) show();
}
