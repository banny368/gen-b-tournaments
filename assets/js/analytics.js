/**
 * Gen B Tournaments — Analytics Module
 * ======================================
 * Privacy-respecting first-party analytics stored in Supabase.
 * Tracks page views, custom events, UTM campaigns, and session data.
 *
 * Depends on (load order):
 *   1. config.js
 *   2. supabase.js
 */

'use strict';

// ─── Session State ────────────────────────────────────────────────────────────

const _session = {
  id:         _generateSessionId(),
  startedAt:  Date.now(),
  pageViews:  0,
  userId:     null,
  utmParams:  _captureUTM(),
  deviceInfo: _getDeviceInfo(),
};

// ─── Internal Helpers ─────────────────────────────────────────────────────────

/**
 * Generates a random session ID (not persisted across tabs).
 * @returns {string}
 * @private
 */
function _generateSessionId() {
  return `sess_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Captures UTM parameters from the current URL.
 * @returns {{ source, medium, campaign, term, content }}
 * @private
 */
function _captureUTM() {
  const p = new URLSearchParams(window.location.search);
  return {
    source:   p.get('utm_source')   || null,
    medium:   p.get('utm_medium')   || null,
    campaign: p.get('utm_campaign') || null,
    term:     p.get('utm_term')     || null,
    content:  p.get('utm_content')  || null,
  };
}

/**
 * Collects browser and device information.
 * @returns {object}
 * @private
 */
function _getDeviceInfo() {
  const ua = navigator.userAgent || '';
  let device = 'desktop';
  if (/Mobi|Android|iPhone|iPad/i.test(ua)) device = /iPad/i.test(ua) ? 'tablet' : 'mobile';

  let browser = 'other';
  if (/Chrome/i.test(ua) && !/Edge|OPR/i.test(ua)) browser = 'chrome';
  else if (/Firefox/i.test(ua)) browser = 'firefox';
  else if (/Safari/i.test(ua) && !/Chrome/i.test(ua)) browser = 'safari';
  else if (/Edge/i.test(ua)) browser = 'edge';
  else if (/OPR|Opera/i.test(ua)) browser = 'opera';

  let os = 'other';
  if (/Windows/i.test(ua))     os = 'windows';
  else if (/Mac OS/i.test(ua)) os = 'macos';
  else if (/Linux/i.test(ua))  os = 'linux';
  else if (/Android/i.test(ua)) os = 'android';
  else if (/iOS|iPhone|iPad/i.test(ua)) os = 'ios';

  return {
    device,
    browser,
    os,
    language:      navigator.language || 'en',
    screenWidth:   window.screen.width,
    screenHeight:  window.screen.height,
    timezone:      Intl.DateTimeFormat().resolvedOptions().timeZone || null,
  };
}

/**
 * Returns a shallow object with only the non-null UTM values.
 * @returns {object}
 * @private
 */
function _nonNullUTM() {
  return Object.fromEntries(
    Object.entries(_session.utmParams).filter(([, v]) => v !== null)
  );
}

/**
 * Inserts an analytics event row into Supabase.
 *
 * @param {string} eventName
 * @param {object} [properties]
 * @returns {Promise<void>}
 * @private
 */
async function _insertEvent(eventName, properties = {}) {
  try {
    if (typeof GenBSupabase === 'undefined') return;

    const payload = {
      session_id:   _session.id,
      user_id:      _session.userId || null,
      event_name:   eventName,
      page_url:     window.location.pathname,
      page_title:   document.title || null,
      referrer:     document.referrer || null,
      properties:   Object.keys(properties).length ? properties : null,
      utm_source:   _session.utmParams.source,
      utm_medium:   _session.utmParams.medium,
      utm_campaign: _session.utmParams.campaign,
      device_type:  _session.deviceInfo.device,
      browser:      _session.deviceInfo.browser,
      os:           _session.deviceInfo.os,
      language:     _session.deviceInfo.language,
      screen_res:   `${_session.deviceInfo.screenWidth}x${_session.deviceInfo.screenHeight}`,
      timezone:     _session.deviceInfo.timezone,
      created_at:   new Date().toISOString(),
    };

    const { error } = await GenBSupabase.db
      .from('analytics_events')
      .insert(payload);

    if (error) {
      // Non-fatal — analytics should never break the app
      console.warn('[GenB] Analytics insert error:', error.message);
    }
  } catch (err) {
    console.warn('[GenB] _insertEvent failed (non-fatal):', err.message);
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Sets the authenticated user ID for the current session.
 * Call this after the user is confirmed signed in.
 *
 * @param {string} userId
 */
function setAnalyticsUser(userId) {
  _session.userId = userId;
}

/**
 * Tracks a custom event with optional properties.
 *
 * @param {string} eventName          - Snake_case event name, e.g. 'tournament_join'.
 * @param {object} [properties]       - Additional event data.
 * @returns {Promise<void>}
 *
 * @example
 * trackEvent('button_click', { button_id: 'joinBtn', tournament_id: '123' });
 */
async function trackEvent(eventName, properties = {}) {
  if (!eventName) return;
  await _insertEvent(eventName, properties);
}

/**
 * Tracks a page view. Automatically called on module load.
 * Re-call on SPA route changes.
 *
 * @returns {Promise<void>}
 */
async function trackPageView() {
  _session.pageViews++;
  await _insertEvent('page_view', {
    page_views_in_session: _session.pageViews,
    ...(_nonNullUTM()),
  });
}

/**
 * Tracks when a user joins a tournament.
 *
 * @param {string|number} tournamentId
 * @param {object} [extra] - Additional properties (e.g. entry_fee, game_type).
 * @returns {Promise<void>}
 */
async function trackTournamentJoin(tournamentId, extra = {}) {
  await trackEvent('tournament_join', { tournament_id: String(tournamentId), ...extra });
}

/**
 * Tracks a deposit action.
 *
 * @param {number} amount           - Amount in INR.
 * @param {string} [method='upi']   - Payment method used.
 * @returns {Promise<void>}
 */
async function trackDeposit(amount, method = 'upi') {
  await trackEvent('deposit', { amount, method, currency: 'INR' });
}

/**
 * Tracks a withdrawal action.
 *
 * @param {number} amount
 * @param {string} [method='upi']
 * @returns {Promise<void>}
 */
async function trackWithdraw(amount, method = 'upi') {
  await trackEvent('withdraw', { amount, method, currency: 'INR' });
}

/**
 * Tracks when a user views a tournament detail page.
 *
 * @param {string|number} tournamentId
 * @param {string} [gameName]
 * @returns {Promise<void>}
 */
async function trackTournamentView(tournamentId, gameName = '') {
  await trackEvent('tournament_view', { tournament_id: String(tournamentId), game: gameName });
}

/**
 * Tracks a share action.
 *
 * @param {string} contentType  - e.g. 'tournament', 'profile'
 * @param {string} contentId
 * @param {string} [channel]    - e.g. 'whatsapp', 'copy_link'
 * @returns {Promise<void>}
 */
async function trackShare(contentType, contentId, channel = 'unknown') {
  await trackEvent('share', { content_type: contentType, content_id: contentId, channel });
}

/**
 * Tracks a referral link click.
 *
 * @param {string} referralCode
 * @returns {Promise<void>}
 */
async function trackReferralClick(referralCode) {
  await trackEvent('referral_click', { referral_code: referralCode });
}

// ─── Admin Analytics Queries ──────────────────────────────────────────────────

/**
 * Returns total page views within a date range.
 *
 * @param {string} [startDate] - ISO date string (defaults to 30 days ago).
 * @param {string} [endDate]   - ISO date string (defaults to now).
 * @returns {Promise<number>}
 */
async function getPageViews(startDate, endDate) {
  try {
    if (typeof GenBSupabase === 'undefined') return 0;

    const start = startDate || new Date(Date.now() - 30 * 86400000).toISOString();
    const end   = endDate   || new Date().toISOString();

    const { count, error } = await GenBSupabase.db
      .from('analytics_events')
      .select('*', { count: 'exact', head: true })
      .eq('event_name', 'page_view')
      .gte('created_at', start)
      .lte('created_at', end);

    if (error) throw error;
    return count || 0;
  } catch (err) {
    console.error('[GenB] getPageViews error:', err);
    return 0;
  }
}

/**
 * Returns total count of a specific event within a date range.
 *
 * @param {string} eventName
 * @param {string} [startDate]
 * @param {string} [endDate]
 * @returns {Promise<number>}
 */
async function getEventCount(eventName, startDate, endDate) {
  try {
    if (typeof GenBSupabase === 'undefined') return 0;

    const start = startDate || new Date(Date.now() - 30 * 86400000).toISOString();
    const end   = endDate   || new Date().toISOString();

    const { count, error } = await GenBSupabase.db
      .from('analytics_events')
      .select('*', { count: 'exact', head: true })
      .eq('event_name', eventName)
      .gte('created_at', start)
      .lte('created_at', end);

    if (error) throw error;
    return count || 0;
  } catch (err) {
    console.error('[GenB] getEventCount error:', err);
    return 0;
  }
}

/**
 * Returns the top N pages by view count within a date range.
 *
 * @param {number} [limit=10]
 * @param {string} [startDate]
 * @param {string} [endDate]
 * @returns {Promise<{ page_url: string, view_count: number }[]>}
 */
async function getTopPages(limit = 10, startDate, endDate) {
  try {
    if (typeof GenBSupabase === 'undefined') return [];

    const start = startDate || new Date(Date.now() - 30 * 86400000).toISOString();
    const end   = endDate   || new Date().toISOString();

    const { data, error } = await GenBSupabase.db
      .from('analytics_events')
      .select('page_url')
      .eq('event_name', 'page_view')
      .gte('created_at', start)
      .lte('created_at', end);

    if (error) throw error;
    if (!data || !data.length) return [];

    // Aggregate in JS (Supabase free tier doesn't support GROUP BY via REST)
    const counts = {};
    data.forEach(({ page_url }) => {
      counts[page_url] = (counts[page_url] || 0) + 1;
    });

    return Object.entries(counts)
      .map(([page_url, view_count]) => ({ page_url, view_count }))
      .sort((a, b) => b.view_count - a.view_count)
      .slice(0, limit);
  } catch (err) {
    console.error('[GenB] getTopPages error:', err);
    return [];
  }
}

/**
 * Returns unique user count (by user_id) within a date range.
 *
 * @param {string} [startDate]
 * @param {string} [endDate]
 * @returns {Promise<number>}
 */
async function getUniqueUsers(startDate, endDate) {
  try {
    if (typeof GenBSupabase === 'undefined') return 0;

    const start = startDate || new Date(Date.now() - 30 * 86400000).toISOString();
    const end   = endDate   || new Date().toISOString();

    const { data, error } = await GenBSupabase.db
      .from('analytics_events')
      .select('user_id')
      .not('user_id', 'is', null)
      .gte('created_at', start)
      .lte('created_at', end);

    if (error) throw error;
    if (!data) return 0;

    const uniqueIds = new Set(data.map((r) => r.user_id));
    return uniqueIds.size;
  } catch (err) {
    console.error('[GenB] getUniqueUsers error:', err);
    return 0;
  }
}

/**
 * Returns device type breakdown within a date range.
 *
 * @param {string} [startDate]
 * @param {string} [endDate]
 * @returns {Promise<{ device_type: string, count: number }[]>}
 */
async function getDeviceBreakdown(startDate, endDate) {
  try {
    if (typeof GenBSupabase === 'undefined') return [];

    const start = startDate || new Date(Date.now() - 30 * 86400000).toISOString();
    const end   = endDate   || new Date().toISOString();

    const { data, error } = await GenBSupabase.db
      .from('analytics_events')
      .select('device_type')
      .eq('event_name', 'page_view')
      .gte('created_at', start)
      .lte('created_at', end);

    if (error) throw error;
    if (!data) return [];

    const counts = {};
    data.forEach(({ device_type }) => {
      if (device_type) counts[device_type] = (counts[device_type] || 0) + 1;
    });

    return Object.entries(counts)
      .map(([device_type, count]) => ({ device_type, count }))
      .sort((a, b) => b.count - a.count);
  } catch (err) {
    console.error('[GenB] getDeviceBreakdown error:', err);
    return [];
  }
}

/**
 * Returns an aggregated analytics summary for the admin dashboard.
 *
 * @param {number} [days=30]
 * @returns {Promise<object>}
 */
async function getAnalyticsSummary(days = 30) {
  const startDate = new Date(Date.now() - days * 86400000).toISOString();

  const [
    totalPageViews,
    uniqueUsers,
    tournamentJoins,
    deposits,
    withdrawals,
    topPages,
    deviceBreakdown,
  ] = await Promise.allSettled([
    getPageViews(startDate),
    getUniqueUsers(startDate),
    getEventCount('tournament_join', startDate),
    getEventCount('deposit', startDate),
    getEventCount('withdraw', startDate),
    getTopPages(5, startDate),
    getDeviceBreakdown(startDate),
  ]).then((results) => results.map((r) => r.status === 'fulfilled' ? r.value : null));

  return {
    period:          `${days}d`,
    totalPageViews:  totalPageViews   || 0,
    uniqueUsers:     uniqueUsers      || 0,
    tournamentJoins: tournamentJoins  || 0,
    deposits:        deposits         || 0,
    withdrawals:     withdrawals      || 0,
    topPages:        topPages         || [],
    deviceBreakdown: deviceBreakdown  || [],
    generatedAt:     new Date().toISOString(),
  };
}

// ─── Auto page view on load ───────────────────────────────────────────────────

async function _autoTrack() {
  // Resolve user ID from session if available
  if (typeof getCurrentUser === 'function') {
    try {
      const current = await getCurrentUser();
      if (current?.user?.id) {
        setAnalyticsUser(current.user.id);
      }
    } catch {
      // Non-fatal
    }
  }

  await trackPageView();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', _autoTrack);
} else {
  // Defer slightly to allow other scripts to initialize
  setTimeout(_autoTrack, 100);
}

// ─── Expose globally ──────────────────────────────────────────────────────────
window.GenBAnalytics = {
  setAnalyticsUser,
  trackEvent,
  trackPageView,
  trackTournamentJoin,
  trackTournamentView,
  trackDeposit,
  trackWithdraw,
  trackShare,
  trackReferralClick,
  getPageViews,
  getEventCount,
  getTopPages,
  getUniqueUsers,
  getDeviceBreakdown,
  getAnalyticsSummary,
  session: _session,
};

// Convenience aliases
window.trackEvent            = trackEvent;
window.trackPageView         = trackPageView;
window.trackTournamentJoin   = trackTournamentJoin;
window.trackDeposit          = trackDeposit;
window.trackWithdraw         = trackWithdraw;
window.getPageViews          = getPageViews;
window.getEventCount         = getEventCount;
window.getTopPages           = getTopPages;
window.getAnalyticsSummary   = getAnalyticsSummary;

console.log('[GenB] analytics.js loaded ✓');
