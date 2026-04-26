// ─── COMRADE Shield Logo ──────────────────────────────────────────────────────
// Premium inline SVG shield for use across the app.
// Each call uses a unique gradient ID to prevent SVG conflicts in the DOM.

let _idCounter = 0;

/**
 * Returns an inline SVG shield string.
 * @param {object} opts
 * @param {number}  opts.size      Width in px (height scales proportionally, 24:28 ratio)
 * @param {string}  opts.variant   'full' | 'mono' | 'outline'  (default: 'full')
 */
export function shieldSVG({ size = 24, variant = 'full' } = {}) {
  const id   = `csg${++_idCounter}`;
  const w    = size;
  const h    = Math.round(size * 28 / 24);

  if (variant === 'outline') {
    // Thin outline-only version for small contexts
    return `<svg width="${w}" height="${h}" viewBox="0 0 24 28" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 1.5L2.5 5.5V14.5C2.5 21 7 26.5 12 28C17 26.5 21.5 21 21.5 14.5V5.5L12 1.5Z"
        stroke="rgba(244,63,94,0.85)" stroke-width="1.2" stroke-linejoin="round"/>
      <path d="M12 9V17M9 13H15" stroke="rgba(244,63,94,0.9)" stroke-width="1.5" stroke-linecap="round"/>
    </svg>`;
  }

  if (variant === 'mono') {
    // White/light version for dark backgrounds
    return `<svg width="${w}" height="${h}" viewBox="0 0 24 28" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 1L2 5.5V14C2 20.8 6.5 26.5 12 28C17.5 26.5 22 20.8 22 14V5.5L12 1Z"
        fill="rgba(255,255,255,0.12)" stroke="rgba(255,255,255,0.5)" stroke-width="0.8" stroke-linejoin="round"/>
      <path d="M12 9V18M9 13.5H15" stroke="white" stroke-width="2" stroke-linecap="round"/>
    </svg>`;
  }

  // Full — gradient fill with cross emblem (default)
  return `<svg width="${w}" height="${h}" viewBox="0 0 24 28" fill="none" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <!-- Main body gradient -->
      <linearGradient id="${id}a" x1="12" y1="0" x2="12" y2="28" gradientUnits="userSpaceOnUse">
        <stop offset="0%"   stop-color="#f43f5e"/>
        <stop offset="100%" stop-color="#7c1037"/>
      </linearGradient>
      <!-- Inner highlight -->
      <linearGradient id="${id}b" x1="12" y1="1" x2="12" y2="18" gradientUnits="userSpaceOnUse">
        <stop offset="0%"   stop-color="white" stop-opacity="0.18"/>
        <stop offset="100%" stop-color="white" stop-opacity="0"/>
      </linearGradient>
      <!-- Outer glow filter -->
      <filter id="${id}f" x="-40%" y="-30%" width="180%" height="180%">
        <feGaussianBlur stdDeviation="1.5" result="glow"/>
        <feMerge><feMergeNode in="glow"/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>
    </defs>

    <!-- Drop shadow / glow -->
    <path d="M12 2.5L3.5 6.5V14.5C3.5 20.8 7.5 26 12 27.5C16.5 26 20.5 20.8 20.5 14.5V6.5L12 2.5Z"
      fill="#f43f5e" opacity="0.25" filter="url(#${id}f)"/>

    <!-- Shield body -->
    <path d="M12 1L2 5.5V14C2 20.8 6.5 26.5 12 28C17.5 26.5 22 20.8 22 14V5.5L12 1Z"
      fill="url(#${id}a)" stroke="rgba(255,100,120,0.5)" stroke-width="0.6" stroke-linejoin="round"/>

    <!-- Inner highlight sheen -->
    <path d="M12 2.2L4 6.2V13.5C4 19.2 7.6 24.4 12 26.2C16.4 24.4 20 19.2 20 13.5V6.2L12 2.2Z"
      fill="url(#${id}b)"/>

    <!-- Emergency cross emblem -->
    <rect x="10.75" y="8.5" width="2.5" height="11" rx="1.25" fill="white" opacity="0.96"/>
    <rect x="7"     y="12.25" width="10" height="2.5" rx="1.25" fill="white" opacity="0.96"/>

    <!-- Subtle bottom edge shine -->
    <path d="M8 24.5C9.8 26 11 26.8 12 27.2C13 26.8 14.2 26 16 24.5"
      stroke="rgba(255,255,255,0.3)" stroke-width="0.8" stroke-linecap="round" fill="none"/>
  </svg>`;
}

/**
 * Large loading-screen emblem — three animated rings + shield core.
 * Returns the emblem-core inner content (the shield SVG).
 */
export function shieldLoadingCore() {
  return shieldSVG({ size: 28, variant: 'full' });
}
