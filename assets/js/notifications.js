/**
 * Gen B Tournaments — Push Notification System (OneSignal)
 * =========================================================
 * Manages browser push notifications via OneSignal and
 * in-app notifications via Supabase.
 *
 * Depends on (load order):
 *   1. config.js
 *   2. supabase.js
 *   3. utils.js
 */

'use strict';

// ─── State ────────────────────────────────────────────────────────────────────
let _oneSignalReady = false;
let _oneSignalPlayer = null;
let _notifBellEl = null;
let _notifDropdownEl = null;
let _unreadCount = 0;

// ─── OneSignal Initialization ─────────────────────────────────────────────────

/**
 * Loads the OneSignal SDK script and initializes it with the configured App ID.
 * Safe to call multiple times — will skip if already initialized.
 *
 * @returns {Promise<void>}
 */
async function initOneSignal() {
  // Feature flag check
  if (typeof GENBCONFIG !== 'undefined' && !GENBCONFIG.features.pushNotifications) {
    console.log('[GenB] Push notifications disabled via config.');
    return;
  }

  if (_oneSignalReady) return;

  const appId = typeof GENBCONFIG !== 'undefined'
    ? GENBCONFIG.oneSignal.appId
    : null;

  if (!appId || appId === 'YOUR_ONESIGNAL_APP_ID') {
    console.warn('[GenB] OneSignal App ID not configured. Skipping push init.');
    return;
  }

  return new Promise((resolve) => {
    // Inject OneSignal SDK
    const script    = document.createElement('script');
    script.src      = 'https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js';
    script.defer    = true;
    script.onload   = () => resolve();
    script.onerror  = () => {
      console.error('[GenB] Failed to load OneSignal SDK.');
      resolve();
    };
    document.head.appendChild(script);
  }).then(async () => {
    window.OneSignalDeferred = window.OneSignalDeferred || [];
    OneSignalDeferred.push(async function (OneSignal) {
      try {
        await OneSignal.init({
          appId,
          safari_web_id: '', // Optional: set if using Safari push
          notifyButton: { enable: false }, // We use our own bell UI
          allowLocalhostAsSecureOrigin: true,
          promptOptions: {
            slidedown: {
              prompts: [
                {
                  type: 'push',
                  autoPrompt: false,  // We prompt manually
                },
              ],
            },
          },
        });

        _oneSignalReady = true;

        // Store player ID
        _oneSignalPlayer = await OneSignal.User.PushSubscription.id;
        console.log('[GenB] OneSignal ready. Player ID:', _oneSignalPlayer);

        // Tag the user with their Supabase user ID
        if (typeof getCurrentUser === 'function') {
          const current = await getCurrentUser();
          if (current?.user?.id) {
            await sendTagToUser('user_id', current.user.id);
            await sendTagToUser('username', current.profile?.username || '');
          }
        }
      } catch (err) {
        console.error('[GenB] OneSignal init error:', err);
      }
    });
  });
}

// ─── Permission Request ───────────────────────────────────────────────────────

/**
 * Requests push notification permission from the browser.
 * Shows a toast if permission is denied.
 *
 * @returns {Promise<'granted'|'denied'|'default'>}
 */
async function requestPermission() {
  try {
    if (!_oneSignalReady) await initOneSignal();

    const permission = await OneSignal.Notifications.requestPermission();
    if (permission) {
      showToast?.('Push notifications enabled! 🎮', 'success');
      _oneSignalPlayer = await OneSignal.User.PushSubscription.id;
    } else {
      showToast?.('Push notifications blocked. You can enable them in browser settings.', 'warning', 5000);
    }
    return permission ? 'granted' : 'denied';
  } catch (err) {
    console.error('[GenB] requestPermission error:', err);
    return 'default';
  }
}

// ─── Player ID ────────────────────────────────────────────────────────────────

/**
 * Returns the current OneSignal Player/Subscription ID.
 * Initializes OneSignal if needed.
 *
 * @returns {Promise<string|null>}
 */
async function getUserPlayerId() {
  if (!_oneSignalReady) await initOneSignal();

  try {
    if (_oneSignalPlayer) return _oneSignalPlayer;
    _oneSignalPlayer = await OneSignal.User.PushSubscription.id;
    return _oneSignalPlayer;
  } catch (err) {
    console.error('[GenB] getUserPlayerId error:', err);
    return null;
  }
}

// ─── User Tags ────────────────────────────────────────────────────────────────

/**
 * Sends a tag to OneSignal for user segmentation.
 *
 * @param {string} key
 * @param {string|number|boolean} value
 * @returns {Promise<void>}
 */
async function sendTagToUser(key, value) {
  try {
    if (!_oneSignalReady) return;
    await OneSignal.User.addTag(key, String(value));
  } catch (err) {
    console.error(`[GenB] sendTagToUser(${key}) error:`, err);
  }
}

/**
 * Sends multiple tags at once.
 *
 * @param {Record<string, string|number|boolean>} tags
 * @returns {Promise<void>}
 */
async function sendTagsToUser(tags) {
  try {
    if (!_oneSignalReady) return;
    const stringTags = Object.fromEntries(
      Object.entries(tags).map(([k, v]) => [k, String(v)])
    );
    await OneSignal.User.addTags(stringTags);
  } catch (err) {
    console.error('[GenB] sendTagsToUser error:', err);
  }
}

// ─── Send Notification (via OneSignal REST API) ────────────────────────────────

/**
 * Sends a push notification via the OneSignal REST API.
 * NOTE: This requires a REST API Key — should only be called from a secure
 *       backend/edge function. Exposed here for admin tools only.
 *
 * @param {string}   title      - Notification title.
 * @param {string}   message    - Notification body text.
 * @param {string}   [url]      - Click-through URL.
 * @param {string[]} [playerIds] - Array of player IDs. If empty, sends to all.
 * @param {string}   [restApiKey] - OneSignal REST API Key.
 * @returns {Promise<object|null>}
 */
async function sendNotification(title, message, url = '/', playerIds = [], restApiKey = '') {
  try {
    const appId = typeof GENBCONFIG !== 'undefined' ? GENBCONFIG.oneSignal.appId : '';

    if (!appId || appId === 'YOUR_ONESIGNAL_APP_ID') {
      throw new Error('OneSignal App ID not configured.');
    }

    const body = {
      app_id:   appId,
      headings: { en: title },
      contents: { en: message },
      url,
    };

    if (playerIds && playerIds.length > 0) {
      body.include_subscription_ids = playerIds;
    } else {
      body.included_segments = ['All'];
    }

    const response = await fetch('https://onesignal.com/api/v1/notifications', {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Basic ${restApiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.errors?.[0] || `OneSignal HTTP ${response.status}`);
    }

    return await response.json();
  } catch (err) {
    console.error('[GenB] sendNotification error:', err);
    return null;
  }
}

// ─── In-App Notification Bell ─────────────────────────────────────────────────

/**
 * Fetches notifications from the Supabase `notifications` table.
 *
 * @param {string} userId
 * @param {number} [limit=20]
 * @returns {Promise<object[]>}
 */
async function getNotifications(userId, limit = 20) {
  try {
    if (typeof GenBSupabase === 'undefined') return [];

    const { data, error } = await GenBSupabase.db
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error('[GenB] getNotifications error:', err);
    return [];
  }
}

/**
 * Returns the count of unread notifications for a user.
 *
 * @param {string} userId
 * @returns {Promise<number>}
 */
async function getUnreadCount(userId) {
  try {
    if (typeof GenBSupabase === 'undefined') return 0;

    const { count, error } = await GenBSupabase.db
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('is_read', false);

    if (error) throw error;
    return count || 0;
  } catch (err) {
    console.error('[GenB] getUnreadCount error:', err);
    return 0;
  }
}

/**
 * Marks all notifications as read for a user.
 *
 * @param {string} userId
 * @returns {Promise<void>}
 */
async function markAllRead(userId) {
  try {
    if (typeof GenBSupabase === 'undefined') return;

    const { error } = await GenBSupabase.db
      .from('notifications')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('is_read', false);

    if (error) throw error;

    _unreadCount = 0;
    _updateBadge(0);
  } catch (err) {
    console.error('[GenB] markAllRead error:', err);
  }
}

/**
 * Marks a single notification as read.
 *
 * @param {string} notifId
 * @returns {Promise<void>}
 */
async function markOneRead(notifId) {
  try {
    if (typeof GenBSupabase === 'undefined') return;

    const { error } = await GenBSupabase.db
      .from('notifications')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('id', notifId);

    if (error) throw error;

    _unreadCount = Math.max(0, _unreadCount - 1);
    _updateBadge(_unreadCount);
  } catch (err) {
    console.error('[GenB] markOneRead error:', err);
  }
}

// ─── Bell UI ──────────────────────────────────────────────────────────────────

/**
 * Updates the unread badge on the notification bell.
 *
 * @param {number} count
 * @private
 */
function _updateBadge(count) {
  const badge = document.getElementById('notifBadge');
  if (!badge) return;

  if (count > 0) {
    badge.textContent = count > 99 ? '99+' : count;
    badge.style.display = 'flex';
  } else {
    badge.style.display = 'none';
  }
}

/**
 * Renders notifications into a dropdown container.
 *
 * @param {object[]} notifications
 * @param {HTMLElement} container
 * @param {string} userId
 * @private
 */
function _renderNotifications(notifications, container, userId) {
  if (!container) return;

  if (!notifications.length) {
    container.innerHTML = `
      <div style="padding:24px;text-align:center;color:#64748b;font-family:Inter,sans-serif;font-size:14px">
        <div style="font-size:32px;margin-bottom:8px">🔔</div>
        No notifications yet
      </div>`;
    return;
  }

  const iconMap = {
    tournament:    '🏆',
    payment:       '💰',
    wallet:        '💳',
    reward:        '🎁',
    system:        '⚙️',
    announcement:  '📢',
    match:         '🎮',
    referral:      '🤝',
  };

  container.innerHTML = notifications.map((n) => {
    const icon    = iconMap[n.type] || '🔔';
    const timeAgo = typeof formatTimeAgo === 'function' ? formatTimeAgo(n.created_at) : '';
    const readStyle = n.is_read ? 'opacity:0.6' : '';

    return `
      <div class="notif-item" data-id="${n.id}" style="
        padding:12px 16px;
        border-bottom:1px solid rgba(255,255,255,0.05);
        display:flex;gap:12px;align-items:flex-start;
        cursor:pointer;transition:background 0.2s;
        ${readStyle}
        ${!n.is_read ? 'background:rgba(0,212,255,0.04)' : ''}
      " onclick="window.GenBNotifications._handleNotifClick('${n.id}', '${userId}', ${JSON.stringify(n.url || '').replace(/"/g, '&quot;')})">
        <div style="font-size:22px;flex-shrink:0;line-height:1.2">${icon}</div>
        <div style="flex:1;min-width:0">
          <div style="font-family:Rajdhani,sans-serif;font-weight:600;color:#e2e8f0;font-size:14px;margin-bottom:2px">
            ${typeof sanitizeHTML === 'function' ? sanitizeHTML(n.title || '') : (n.title || '')}
          </div>
          <div style="font-family:Inter,sans-serif;color:#94a3b8;font-size:12px;line-height:1.4;margin-bottom:4px;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical">
            ${typeof sanitizeHTML === 'function' ? sanitizeHTML(n.message || '') : (n.message || '')}
          </div>
          <div style="font-family:Inter,sans-serif;color:#475569;font-size:11px">${timeAgo}</div>
        </div>
        ${!n.is_read ? '<div style="width:7px;height:7px;border-radius:50%;background:#00d4ff;flex-shrink:0;margin-top:4px"></div>' : ''}
      </div>`;
  }).join('');
}

/**
 * Handles click on a notification item.
 *
 * @param {string} notifId
 * @param {string} userId
 * @param {string} url
 * @private
 */
async function _handleNotifClick(notifId, userId, url) {
  await markOneRead(notifId);
  if (url) window.location.href = url;
}

/**
 * Initializes the in-app notification bell for a logged-in user.
 *
 * @param {string} userId
 * @param {string} [bellId='notifBell']       - ID of the bell button element.
 * @param {string} [dropdownId='notifDropdown'] - ID of the dropdown container.
 */
async function initNotificationBell(userId, bellId = 'notifBell', dropdownId = 'notifDropdown') {
  _notifBellEl     = document.getElementById(bellId);
  _notifDropdownEl = document.getElementById(dropdownId);

  if (!_notifBellEl) return;

  // Fetch initial unread count
  _unreadCount = await getUnreadCount(userId);
  _updateBadge(_unreadCount);

  // Bell click — load and show dropdown
  _notifBellEl.addEventListener('click', async (e) => {
    e.stopPropagation();

    const isOpen = _notifDropdownEl?.style.display !== 'none'
      && _notifDropdownEl?.style.display !== '';

    if (isOpen) {
      if (_notifDropdownEl) _notifDropdownEl.style.display = 'none';
      return;
    }

    if (_notifDropdownEl) {
      _notifDropdownEl.style.display = 'block';
      _notifDropdownEl.innerHTML = `<div style="padding:16px;text-align:center;color:#64748b;font-size:13px">Loading…</div>`;

      const notifications = await getNotifications(userId);
      _renderNotifications(notifications, _notifDropdownEl, userId);

      // Mark all read after opening
      if (_unreadCount > 0) {
        await markAllRead(userId);
      }
    }
  });

  // Close on outside click
  document.addEventListener('click', () => {
    if (_notifDropdownEl) _notifDropdownEl.style.display = 'none';
  });

  // Subscribe to realtime new notifications
  if (typeof GenBSupabase !== 'undefined') {
    GenBSupabase.subscribeToTable(
      `notif-${userId}`,
      'notifications',
      async (payload) => {
        if (payload.new?.user_id === userId && !payload.new?.is_read) {
          _unreadCount++;
          _updateBadge(_unreadCount);

          // Show in-app toast for new notification
          const title = payload.new?.title || 'New Notification';
          showToast?.(`🔔 ${title}`, 'info');
        }
      },
      { event: 'INSERT', filter: `user_id=eq.${userId}` }
    );
  }
}

// ─── Expose globally ──────────────────────────────────────────────────────────
window.GenBNotifications = {
  initOneSignal,
  requestPermission,
  getUserPlayerId,
  sendTagToUser,
  sendTagsToUser,
  sendNotification,
  getNotifications,
  getUnreadCount,
  markAllRead,
  markOneRead,
  initNotificationBell,
  _handleNotifClick,
};

// Convenience aliases
window.initOneSignal        = initOneSignal;
window.requestPermission    = requestPermission;
window.getUserPlayerId      = getUserPlayerId;
window.sendTagToUser        = sendTagToUser;
window.sendNotification     = sendNotification;
window.getNotifications     = getNotifications;
window.markAllRead          = markAllRead;
window.initNotificationBell = initNotificationBell;

console.log('[GenB] notifications.js loaded ✓');
