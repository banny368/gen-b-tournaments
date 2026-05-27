/**
 * Gen B Tournaments — Supabase Client
 * =====================================
 * Initializes the Supabase client and exposes helper functions
 * for authentication, database, storage, and realtime.
 *
 * Depends on:
 *   - config.js  (GENBCONFIG must be loaded before this file)
 *   - @supabase/supabase-js v2
 */

'use strict';

// ─── Validate config is present ───────────────────────────────────────────────
if (typeof GENBCONFIG === 'undefined') {
  throw new Error('[GenB] config.js must be loaded before supabase.js');
}

if (
  !GENBCONFIG.supabase.url ||
  GENBCONFIG.supabase.url.includes('YOUR_PROJECT')
) {
  console.warn('[GenB] Supabase URL is not configured. Update config.js with real credentials.');
}

// ─── Client initialization ────────────────────────────────────────────────────
/**
 * The primary Supabase client instance.
 * @type {import('@supabase/supabase-js').SupabaseClient}
 */
const _supabaseClient = supabase.createClient(
  GENBCONFIG.supabase.url,
  GENBCONFIG.supabase.anonKey,
  {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
      storageKey: 'genb_auth_session',
    },
  }
);

// ─── Named exports (attached to window for CDN usage) ─────────────────────────

/**
 * Raw Supabase client — use for any query not covered by helpers.
 */
const db = _supabaseClient;

/**
 * Supabase auth namespace shortcut.
 */
const auth = _supabaseClient.auth;

/**
 * Supabase storage namespace shortcut.
 */
const storage = _supabaseClient.storage;

// ─── Authentication Helpers ───────────────────────────────────────────────────

/**
 * Returns the currently authenticated user object, or null if not signed in.
 * Combines session data with the profile row from the `profiles` table.
 *
 * @returns {Promise<{user: object, profile: object}|null>}
 */
async function getCurrentUser() {
  try {
    const { data: { session }, error: sessionError } = await auth.getSession();
    if (sessionError) throw sessionError;
    if (!session) return null;

    const { data: profile, error: profileError } = await db
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .single();

    if (profileError && profileError.code !== 'PGRST116') {
      // PGRST116 = row not found — new user might not have a profile yet
      console.error('[GenB] Profile fetch error:', profileError);
    }

    return {
      user: session.user,
      profile: profile || null,
      session,
    };
  } catch (err) {
    console.error('[GenB] getCurrentUser error:', err);
    return null;
  }
}

/**
 * Redirects to /login.html if no active session is found.
 * Stores the intended destination in sessionStorage for post-login redirect.
 *
 * @param {string} [redirectTo='/login.html'] - Login page URL.
 * @returns {Promise<{user: object, profile: object}>}
 */
async function requireAuth(redirectTo = '/login.html') {
  const current = await getCurrentUser();
  if (!current) {
    sessionStorage.setItem('genb_redirect_after_login', window.location.pathname + window.location.search);
    window.location.href = redirectTo;
    // Pause execution while redirect happens
    await new Promise(() => {});
  }
  return current;
}

/**
 * Checks that the current user has an admin-level role.
 * Redirects to the homepage if unauthorized.
 *
 * @param {string} [redirectTo='/index.html'] - Redirect target if not admin.
 * @returns {Promise<{user: object, profile: object}>}
 */
async function requireAdmin(redirectTo = '/index.html') {
  const current = await requireAuth('/login.html');

  const role = current?.profile?.role;
  const isAdmin = role && GENBCONFIG.admin.roles.includes(role);

  if (!isAdmin) {
    console.warn('[GenB] Access denied — admin role required.');
    window.location.href = redirectTo;
    await new Promise(() => {});
  }

  return current;
}

// ─── Database Helpers ─────────────────────────────────────────────────────────

/**
 * Shorthand for a Supabase table query.
 * Usage: table('profiles').select('*').eq('id', userId)
 *
 * @param {string} tableName
 */
function table(tableName) {
  return db.from(tableName);
}

/**
 * Fetches a single row by id from a given table.
 *
 * @param {string} tableName
 * @param {string|number} id
 * @returns {Promise<object|null>}
 */
async function getById(tableName, id) {
  try {
    const { data, error } = await db
      .from(tableName)
      .select('*')
      .eq('id', id)
      .single();
    if (error) throw error;
    return data;
  } catch (err) {
    console.error(`[GenB] getById(${tableName}, ${id}) error:`, err);
    return null;
  }
}

// ─── Realtime Helpers ─────────────────────────────────────────────────────────

/**
 * Subscribes to realtime changes on a table.
 *
 * @param {string} channelName - Unique channel identifier.
 * @param {string} tableName   - Supabase table name.
 * @param {function} callback  - Called with (payload) on each change.
 * @param {{ event?: string, filter?: string }} [options]
 * @returns {RealtimeChannel} - Call `.unsubscribe()` to clean up.
 */
function subscribeToTable(channelName, tableName, callback, options = {}) {
  const { event = '*', filter } = options;

  const channelConfig = {
    event,
    schema: 'public',
    table: tableName,
  };

  if (filter) channelConfig.filter = filter;

  const channel = db
    .channel(channelName)
    .on('postgres_changes', channelConfig, callback)
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        console.log(`[GenB] Realtime subscribed: ${channelName}`);
      } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
        console.warn(`[GenB] Realtime channel ${channelName} status: ${status}`);
      }
    });

  return channel;
}

/**
 * Unsubscribes from a realtime channel.
 *
 * @param {RealtimeChannel} channel
 */
async function unsubscribe(channel) {
  if (channel) {
    await db.removeChannel(channel);
  }
}

// ─── Cloudinary Upload Helper ─────────────────────────────────────────────────

/**
 * Uploads a file to Cloudinary using an unsigned upload preset.
 *
 * @param {File}   file   - The File object to upload (e.g. from an <input type="file">).
 * @param {string} [folder='genb'] - Cloudinary folder path.
 * @returns {Promise<{ url: string, publicId: string }|null>}
 *
 * @example
 * const result = await uploadToCloudinary(file, 'avatars');
 * if (result) console.log(result.url);
 */
async function uploadToCloudinary(file, folder = 'genb') {
  try {
    const { cloudName, uploadPreset } = GENBCONFIG.cloudinary;

    if (!cloudName || cloudName.includes('YOUR_CLOUD')) {
      throw new Error('Cloudinary is not configured. Update config.js.');
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', uploadPreset);
    formData.append('folder', folder);

    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
      { method: 'POST', body: formData }
    );

    if (!response.ok) {
      const errBody = await response.json().catch(() => ({}));
      throw new Error(errBody.error?.message || `Cloudinary HTTP ${response.status}`);
    }

    const result = await response.json();
    return {
      url: result.secure_url,
      publicId: result.public_id,
    };
  } catch (err) {
    console.error('[GenB] uploadToCloudinary error:', err);
    return null;
  }
}

// ─── Storage Helper ───────────────────────────────────────────────────────────

/**
 * Uploads a file to a Supabase Storage bucket and returns the public URL.
 *
 * @param {string} bucket   - The storage bucket name.
 * @param {string} path     - Path within the bucket (e.g. 'avatars/user123.jpg').
 * @param {File}   file     - The File object to upload.
 * @param {{ upsert?: boolean, contentType?: string }} [options]
 * @returns {Promise<string|null>} Public URL of the uploaded file.
 */
async function uploadToStorage(bucket, path, file, options = {}) {
  try {
    const { upsert = true, contentType } = options;

    const { error } = await storage
      .from(bucket)
      .upload(path, file, {
        upsert,
        contentType: contentType || file.type || 'application/octet-stream',
      });

    if (error) throw error;

    const { data: { publicUrl } } = storage.from(bucket).getPublicUrl(path);
    return publicUrl;
  } catch (err) {
    console.error('[GenB] uploadToStorage error:', err);
    return null;
  }
}

// ─── Expose globally ──────────────────────────────────────────────────────────
window.GenBSupabase = {
  db,
  auth,
  storage,
  table,
  getById,
  getCurrentUser,
  requireAuth,
  requireAdmin,
  subscribeToTable,
  unsubscribe,
  uploadToCloudinary,
  uploadToStorage,
};

// Also expose individual helpers at window level for convenience
window.getCurrentUser    = getCurrentUser;
window.requireAuth       = requireAuth;
window.requireAdmin      = requireAdmin;
window.uploadToCloudinary = uploadToCloudinary;

console.log('[GenB] supabase.js loaded ✓');
