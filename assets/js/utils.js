/**
 * Gen B Tournaments — Utility Library
 * =====================================
 * Shared helper functions used across all pages.
 *
 * Depends on:
 *   - config.js  (GENBCONFIG must be loaded before this file)
 */

'use strict';

// ─── Toast Notification System ────────────────────────────────────────────────

/** @type {HTMLElement|null} */
let _toastContainer = null;

/**
 * Initializes the toast container in the DOM (once).
 * Called automatically on first showToast call.
 * @returns {HTMLElement}
 */
function _initToastContainer() {
  if (_toastContainer && document.body.contains(_toastContainer)) {
    return _toastContainer;
  }

  _toastContainer = document.createElement('div');
  _toastContainer.id = 'genb-toast-container';
  Object.assign(_toastContainer.style, {
    position:       'fixed',
    bottom:         '24px',
    right:          '24px',
    zIndex:         '99999',
    display:        'flex',
    flexDirection:  'column',
    gap:            '10px',
    pointerEvents:  'none',
    maxWidth:       '360px',
    width:          'calc(100vw - 48px)',
  });
  document.body.appendChild(_toastContainer);
  return _toastContainer;
}

/**
 * Displays a toast notification.
 *
 * @param {string} message  - The message to display.
 * @param {'success'|'error'|'info'|'warning'} [type='info'] - Toast variant.
 * @param {number} [duration=3500] - Auto-dismiss delay in ms.
 */
function showToast(message, type = 'info', duration = 3500) {
  const container = _initToastContainer();

  const palette = {
    success: { border: '#00ff88', icon: '✓', bg: 'rgba(0,255,136,0.12)' },
    error:   { border: '#ff2d78', icon: '✕', bg: 'rgba(255,45,120,0.12)' },
    warning: { border: '#ffd700', icon: '⚠', bg: 'rgba(255,215,0,0.12)'  },
    info:    { border: '#00d4ff', icon: 'ℹ', bg: 'rgba(0,212,255,0.12)'  },
  };

  const { border, icon, bg } = palette[type] || palette.info;

  const toast = document.createElement('div');
  toast.setAttribute('role', 'alert');
  toast.setAttribute('aria-live', 'assertive');
  Object.assign(toast.style, {
    background:     bg,
    border:         `1px solid ${border}`,
    borderLeft:     `4px solid ${border}`,
    boxShadow:      `0 0 20px ${border}40`,
    backdropFilter: 'blur(20px)',
    borderRadius:   '8px',
    padding:        '12px 16px',
    color:          '#e2e8f0',
    fontFamily:     'Inter, sans-serif',
    fontSize:       '14px',
    display:        'flex',
    alignItems:     'center',
    gap:            '10px',
    pointerEvents:  'all',
    cursor:         'pointer',
    opacity:        '0',
    transform:      'translateX(100%)',
    transition:     'opacity 0.3s ease, transform 0.3s ease',
  });

  toast.innerHTML = `
    <span style="font-size:16px;flex-shrink:0;color:${border}">${icon}</span>
    <span style="flex:1;line-height:1.4">${sanitizeHTML(message)}</span>
    <span style="color:#64748b;font-size:18px;flex-shrink:0;line-height:1">×</span>
  `;

  toast.addEventListener('click', () => _dismissToast(toast));
  container.appendChild(toast);

  // Animate in
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      toast.style.opacity   = '1';
      toast.style.transform = 'translateX(0)';
    });
  });

  // Auto dismiss
  const timer = setTimeout(() => _dismissToast(toast), duration);
  toast._dismissTimer = timer;
}

/**
 * @param {HTMLElement} toast
 * @private
 */
function _dismissToast(toast) {
  clearTimeout(toast._dismissTimer);
  toast.style.opacity   = '0';
  toast.style.transform = 'translateX(100%)';
  toast.addEventListener('transitionend', () => toast.remove(), { once: true });
}

// ─── Currency & Number Formatting ─────────────────────────────────────────────

/**
 * Formats a number as Indian Rupees.
 *
 * @param {number|string} amount
 * @param {boolean} [compact=false] - Use compact notation above 1 lakh.
 * @returns {string} e.g. "₹1,250" or "₹1.25L"
 */
function formatCurrency(amount, compact = false) {
  const num = parseFloat(amount) || 0;
  const currency = (typeof GENBCONFIG !== 'undefined' && GENBCONFIG.app.currency) || '₹';

  if (compact && num >= 100000) {
    return `${currency}${(num / 100000).toFixed(2)}L`;
  }
  if (compact && num >= 1000) {
    return `${currency}${(num / 1000).toFixed(1)}K`;
  }

  return `${currency}${num.toLocaleString('en-IN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}

/**
 * Animates a numeric counter from 0 to a target value.
 *
 * @param {HTMLElement} element  - Target DOM element.
 * @param {number}      target   - Final value to count to.
 * @param {number}      [duration=1500] - Animation duration in ms.
 * @param {function}    [formatter] - Optional formatter fn (defaults to toLocaleString).
 */
function animateCounter(element, target, duration = 1500, formatter) {
  if (!element) return;
  const start     = performance.now();
  const startVal  = parseFloat(element.textContent.replace(/[^0-9.-]/g, '')) || 0;
  const fmt       = formatter || ((v) => Math.floor(v).toLocaleString('en-IN'));

  function step(now) {
    const elapsed  = now - start;
    const progress = Math.min(elapsed / duration, 1);
    // Ease out cubic
    const eased    = 1 - Math.pow(1 - progress, 3);
    const current  = startVal + (target - startVal) * eased;
    element.textContent = fmt(current);
    if (progress < 1) requestAnimationFrame(step);
  }

  requestAnimationFrame(step);
}

// ─── Date & Time Formatting ───────────────────────────────────────────────────

/**
 * Formats an ISO date string into a human-readable date.
 *
 * @param {string|Date} dateString
 * @returns {string} e.g. "26 May 2026"
 */
function formatDate(dateString) {
  if (!dateString) return '—';
  try {
    const d = new Date(dateString);
    if (isNaN(d)) return '—';
    return d.toLocaleDateString('en-IN', {
      day:   'numeric',
      month: 'short',
      year:  'numeric',
    });
  } catch {
    return '—';
  }
}

/**
 * Formats an ISO date string into a relative time string.
 *
 * @param {string|Date} dateString
 * @returns {string} e.g. "2 hours ago", "just now", "3 days ago"
 */
function formatTimeAgo(dateString) {
  if (!dateString) return '—';
  try {
    const diff = Date.now() - new Date(dateString).getTime();
    if (isNaN(diff)) return '—';

    const seconds = Math.floor(diff / 1000);
    if (seconds < 30)   return 'just now';
    if (seconds < 60)   return `${seconds}s ago`;

    const minutes = Math.floor(seconds / 60);
    if (minutes < 60)   return `${minutes}m ago`;

    const hours = Math.floor(minutes / 60);
    if (hours < 24)     return `${hours}h ago`;

    const days = Math.floor(hours / 24);
    if (days < 7)       return `${days}d ago`;

    const weeks = Math.floor(days / 7);
    if (weeks < 5)      return `${weeks}w ago`;

    return formatDate(dateString);
  } catch {
    return '—';
  }
}

/**
 * Calculates days/hours/mins/secs remaining until a target date.
 *
 * @param {string|Date} targetDate
 * @returns {{ days: number, hours: number, mins: number, secs: number, expired: boolean }}
 */
function formatCountdown(targetDate) {
  const diff = new Date(targetDate).getTime() - Date.now();

  if (isNaN(diff) || diff <= 0) {
    return { days: 0, hours: 0, mins: 0, secs: 0, expired: true };
  }

  const totalSecs = Math.floor(diff / 1000);
  return {
    days:    Math.floor(totalSecs / 86400),
    hours:   Math.floor((totalSecs % 86400) / 3600),
    mins:    Math.floor((totalSecs % 3600) / 60),
    secs:    totalSecs % 60,
    expired: false,
  };
}

/**
 * Starts a live countdown and updates a DOM element every second.
 * The element must contain child elements with data-cd-days, data-cd-hours,
 * data-cd-mins, data-cd-secs attributes OR it will update textContent directly.
 *
 * @param {string|Date} targetDate  - ISO date string or Date object.
 * @param {string}      elementId   - ID of the container element.
 * @param {function}    [onExpired] - Optional callback when countdown hits zero.
 * @returns {number} Interval ID (pass to clearInterval to stop).
 */
function startCountdown(targetDate, elementId, onExpired) {
  const el = document.getElementById(elementId);
  if (!el) {
    console.warn(`[GenB] startCountdown: element #${elementId} not found`);
    return null;
  }

  const _update = () => {
    const cd = formatCountdown(targetDate);

    const pad = (n) => String(n).padStart(2, '0');

    const dEl = el.querySelector('[data-cd-days]');
    const hEl = el.querySelector('[data-cd-hours]');
    const mEl = el.querySelector('[data-cd-mins]');
    const sEl = el.querySelector('[data-cd-secs]');

    if (dEl) dEl.textContent = pad(cd.days);
    if (hEl) hEl.textContent = pad(cd.hours);
    if (mEl) mEl.textContent = pad(cd.mins);
    if (sEl) sEl.textContent = pad(cd.secs);

    // Fallback: update textContent when no data attrs
    if (!dEl && !hEl) {
      el.textContent = cd.expired
        ? 'ENDED'
        : `${pad(cd.days)}d ${pad(cd.hours)}h ${pad(cd.mins)}m ${pad(cd.secs)}s`;
    }

    if (cd.expired) {
      clearInterval(timerId);
      if (typeof onExpired === 'function') onExpired();
    }
  };

  _update();
  const timerId = setInterval(_update, 1000);
  return timerId;
}

// ─── Clipboard ────────────────────────────────────────────────────────────────

/**
 * Copies text to the clipboard. Shows a toast on success/failure.
 *
 * @param {string} text      - Text to copy.
 * @param {string} [label]   - Optional label for toast message.
 * @returns {Promise<boolean>}
 */
async function copyToClipboard(text, label = 'Text') {
  try {
    await navigator.clipboard.writeText(text);
    showToast(`${label} copied!`, 'success', 2000);
    return true;
  } catch {
    // Fallback for older browsers
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.cssText = 'position:fixed;opacity:0;top:-9999px';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
      showToast(`${label} copied!`, 'success', 2000);
      return true;
    } catch {
      showToast('Failed to copy. Please copy manually.', 'error');
      return false;
    }
  }
}

// ─── String Helpers ───────────────────────────────────────────────────────────

/**
 * Generates a unique referral code from a username.
 *
 * @param {string} username
 * @returns {string} e.g. "RAJESH-X7K2"
 */
function generateReferralCode(username) {
  if (!username) return '';
  const clean  = username.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 6);
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${clean}-${suffix}`;
}

/**
 * Returns the initials from a full name (for avatar fallback).
 *
 * @param {string} name
 * @returns {string} e.g. "RK" for "Rahul Kumar"
 */
function getInitials(name) {
  if (!name) return '??';
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('');
}

/**
 * Truncates a string and appends an ellipsis.
 *
 * @param {string} text
 * @param {number} maxLength
 * @returns {string}
 */
function truncateText(text, maxLength) {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 1) + '…';
}

/**
 * Sanitizes a string to prevent XSS injection in innerHTML.
 *
 * @param {string} str - Raw untrusted string.
 * @returns {string} HTML-escaped string.
 */
function sanitizeHTML(str) {
  if (typeof str !== 'string') return '';
  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
  return str.replace(/[&<>"']/g, (c) => map[c]);
}

// ─── Function Utilities ───────────────────────────────────────────────────────

/**
 * Debounces a function — delays invocation until after `delay` ms of silence.
 *
 * @param {function} fn
 * @param {number}   delay - Delay in ms.
 * @returns {function}
 */
function debounce(fn, delay) {
  let timer;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}

// ─── Validation ───────────────────────────────────────────────────────────────

/**
 * Validates an Indian UPI ID.
 * Format: username@bankhandle  (e.g. rahul@upi, 9876543210@paytm)
 *
 * @param {string} upiId
 * @returns {boolean}
 */
function isValidUPI(upiId) {
  if (!upiId || typeof upiId !== 'string') return false;
  // Standard UPI regex: alphanumeric/._-+  @ alphanumeric
  return /^[\w.\-+]+@[a-zA-Z]{2,}$/.test(upiId.trim());
}

/**
 * Validates a UTR (Unique Transaction Reference) number.
 * Must be 12-22 alphanumeric characters.
 *
 * @param {string} utr
 * @returns {boolean}
 */
function isValidUTR(utr) {
  if (!utr || typeof utr !== 'string') return false;
  return /^[a-zA-Z0-9]{12,22}$/.test(utr.trim());
}

// ─── Level System Helpers ─────────────────────────────────────────────────────

/**
 * Returns the level info object for a given XP value.
 *
 * @param {number} xp
 * @returns {{ level: number, title: string, xpRequired: number, color: string }}
 */
function getLevelInfo(xp) {
  const levels = (typeof GENBCONFIG !== 'undefined' && GENBCONFIG.levels) || [];
  if (!levels.length) return { level: 1, title: 'Recruit', xpRequired: 0, color: '#9ca3af' };

  let current = levels[0];
  for (const lvl of levels) {
    if (xp >= lvl.xpRequired) {
      current = lvl;
    } else {
      break;
    }
  }
  return current;
}

/**
 * Returns the XP progress percentage towards the next level.
 *
 * @param {number} xp
 * @returns {{ percentage: number, currentXP: number, neededXP: number, nextLevel: object|null }}
 */
function getXPProgress(xp) {
  const levels = (typeof GENBCONFIG !== 'undefined' && GENBCONFIG.levels) || [];
  if (!levels.length) return { percentage: 0, currentXP: 0, neededXP: 100, nextLevel: null };

  const currentLevel = getLevelInfo(xp);
  const nextLevel    = levels.find((l) => l.level === currentLevel.level + 1) || null;

  if (!nextLevel) {
    // Max level
    return { percentage: 100, currentXP: xp, neededXP: 0, nextLevel: null };
  }

  const xpIntoLevel = xp - currentLevel.xpRequired;
  const xpForNext   = nextLevel.xpRequired - currentLevel.xpRequired;
  const percentage  = Math.min(100, Math.floor((xpIntoLevel / xpForNext) * 100));

  return {
    percentage,
    currentXP: xpIntoLevel,
    neededXP:  xpForNext - xpIntoLevel,
    nextLevel,
  };
}

// ─── URL / Query String ───────────────────────────────────────────────────────

/**
 * Builds a query string from a params object.
 *
 * @param {Record<string, string|number|boolean>} params
 * @returns {string} e.g. "?page=1&limit=20"
 */
function buildQueryString(params) {
  if (!params || typeof params !== 'object') return '';
  const qs = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');
  return qs ? `?${qs}` : '';
}

/**
 * Parses the current page's URL query string into an object.
 *
 * @returns {Record<string, string>}
 */
function getQueryParams() {
  const params = {};
  new URLSearchParams(window.location.search).forEach((v, k) => {
    params[k] = v;
  });
  return params;
}

// ─── Skeleton Loader Builder ──────────────────────────────────────────────────

/**
 * Builds skeleton placeholder HTML for loading states.
 *
 * @param {number} count - Number of skeletons to create.
 * @param {'card'|'list'|'row'|'circle'|'text'} [type='card'] - Skeleton variant.
 * @returns {string} HTML string ready for innerHTML injection.
 */
function createSkeleton(count = 3, type = 'card') {
  const shimmer = `
    background: linear-gradient(90deg, rgba(255,255,255,0.03) 25%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.03) 75%);
    background-size: 200% 100%;
    animation: skeletonShimmer 1.5s infinite;
    border-radius: 8px;
  `.trim();

  // Inject keyframes once
  if (!document.getElementById('genb-skeleton-styles')) {
    const style = document.createElement('style');
    style.id = 'genb-skeleton-styles';
    style.textContent = `
      @keyframes skeletonShimmer {
        0%   { background-position: 200% 0; }
        100% { background-position: -200% 0; }
      }
    `;
    document.head.appendChild(style);
  }

  const templates = {
    card: () => `
      <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(0,212,255,0.1);border-radius:12px;padding:16px;display:flex;flex-direction:column;gap:12px">
        <div style="height:140px;${shimmer}"></div>
        <div style="height:18px;width:70%;${shimmer}"></div>
        <div style="height:14px;width:50%;${shimmer}"></div>
        <div style="display:flex;gap:8px">
          <div style="height:32px;flex:1;${shimmer}"></div>
          <div style="height:32px;flex:1;${shimmer}"></div>
        </div>
      </div>`,

    list: () => `
      <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(0,212,255,0.1);border-radius:10px;padding:14px 16px;display:flex;align-items:center;gap:12px">
        <div style="width:44px;height:44px;border-radius:50%;flex-shrink:0;${shimmer}"></div>
        <div style="flex:1;display:flex;flex-direction:column;gap:8px">
          <div style="height:14px;width:60%;${shimmer}"></div>
          <div style="height:12px;width:40%;${shimmer}"></div>
        </div>
        <div style="width:60px;height:14px;${shimmer}"></div>
      </div>`,

    row: () => `
      <tr>
        <td style="padding:12px 8px"><div style="height:12px;${shimmer}"></div></td>
        <td style="padding:12px 8px"><div style="height:12px;width:80%;${shimmer}"></div></td>
        <td style="padding:12px 8px"><div style="height:12px;width:60%;${shimmer}"></div></td>
        <td style="padding:12px 8px"><div style="height:12px;width:40%;${shimmer}"></div></td>
      </tr>`,

    circle: () => `
      <div style="display:flex;flex-direction:column;align-items:center;gap:8px">
        <div style="width:64px;height:64px;border-radius:50%;${shimmer}"></div>
        <div style="height:12px;width:48px;${shimmer}"></div>
      </div>`,

    text: () => `
      <div style="display:flex;flex-direction:column;gap:8px">
        <div style="height:14px;width:100%;${shimmer}"></div>
        <div style="height:14px;width:90%;${shimmer}"></div>
        <div style="height:14px;width:75%;${shimmer}"></div>
      </div>`,
  };

  const tpl = templates[type] || templates.card;
  return Array.from({ length: count }, tpl).join('');
}

// ─── Misc DOM Helpers ─────────────────────────────────────────────────────────

/**
 * Shows a loading spinner inside a button while an async operation runs.
 *
 * @param {HTMLButtonElement} btn       - The button element.
 * @param {Promise}           promise   - The promise to await.
 * @param {string}            [loadingText='Loading...']
 * @returns {Promise<any>} Resolves/rejects with the original promise.
 */
async function withButtonLoading(btn, promise, loadingText = 'Loading...') {
  if (!btn) return promise;
  const originalHTML    = btn.innerHTML;
  const originalDisabled = btn.disabled;

  btn.disabled = true;
  btn.innerHTML = `
    <svg style="width:16px;height:16px;animation:spin 1s linear infinite;display:inline-block;vertical-align:middle;margin-right:6px" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
    </svg>${sanitizeHTML(loadingText)}`;

  // Inject spin animation once
  if (!document.getElementById('genb-spin-anim')) {
    const s = document.createElement('style');
    s.id = 'genb-spin-anim';
    s.textContent = '@keyframes spin{to{transform:rotate(360deg)}}';
    document.head.appendChild(s);
  }

  try {
    return await promise;
  } finally {
    btn.innerHTML = originalHTML;
    btn.disabled  = originalDisabled;
  }
}

/**
 * Shows or hides an error message below a form field.
 *
 * @param {string}  fieldId  - The input element's id.
 * @param {string}  message  - Error text (pass '' to clear).
 */
function showFieldError(fieldId, message) {
  const field = document.getElementById(fieldId);
  if (!field) return;

  const errId = `${fieldId}-error`;
  let errEl   = document.getElementById(errId);

  if (!message) {
    if (errEl) errEl.remove();
    field.style.borderColor = '';
    return;
  }

  if (!errEl) {
    errEl    = document.createElement('p');
    errEl.id = errId;
    Object.assign(errEl.style, {
      color:      '#ff2d78',
      fontSize:   '12px',
      marginTop:  '4px',
      fontFamily: 'Inter, sans-serif',
    });
    field.parentNode.insertBefore(errEl, field.nextSibling);
  }

  errEl.textContent = message;
  field.style.borderColor = '#ff2d78';
}

// ─── Expose globally ──────────────────────────────────────────────────────────
window.GenBUtils = {
  // Toast
  showToast,

  // Currency
  formatCurrency,
  animateCounter,

  // Date/Time
  formatDate,
  formatTimeAgo,
  formatCountdown,
  startCountdown,

  // Clipboard
  copyToClipboard,

  // Strings
  generateReferralCode,
  getInitials,
  truncateText,
  sanitizeHTML,

  // Functions
  debounce,

  // Validation
  isValidUPI,
  isValidUTR,

  // Levels
  getLevelInfo,
  getXPProgress,

  // URL
  buildQueryString,
  getQueryParams,

  // Skeleton
  createSkeleton,

  // DOM
  withButtonLoading,
  showFieldError,
};

// Also expose key helpers at window level for convenience
window.showToast        = showToast;
window.formatCurrency   = formatCurrency;
window.formatDate       = formatDate;
window.formatTimeAgo    = formatTimeAgo;
window.formatCountdown  = formatCountdown;
window.startCountdown   = startCountdown;
window.copyToClipboard  = copyToClipboard;
window.sanitizeHTML     = sanitizeHTML;
window.debounce         = debounce;
window.getLevelInfo     = getLevelInfo;
window.getXPProgress    = getXPProgress;
window.createSkeleton   = createSkeleton;
window.withButtonLoading = withButtonLoading;
window.showFieldError   = showFieldError;
window.animateCounter   = animateCounter;
window.generateReferralCode = generateReferralCode;
window.getInitials      = getInitials;
window.isValidUPI       = isValidUPI;
window.isValidUTR       = isValidUTR;
window.buildQueryString = buildQueryString;
window.getQueryParams   = getQueryParams;
window.truncateText     = truncateText;

// Initialize toast container eagerly once DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', _initToastContainer);
} else {
  _initToastContainer();
}

console.log('[GenB] utils.js loaded ✓');
