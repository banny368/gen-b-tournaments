/**
 * Gen B Tournaments — Admin User Management
 * ==========================================
 * Handles: paginated user list, ban/suspend/unban/verify, wallet edits, bonus.
 * Requires: config.js, supabase (window._supabase)
 */

'use strict';

/* ─────────────────────────────────────────────────────────────────────────────
   HELPERS
───────────────────────────────────────────────────────────────────────────── */
function getClient() {
  if (window._supabase) return window._supabase;
  const { createClient } = supabase;
  window._supabase = createClient(GENBCONFIG.supabase.url, GENBCONFIG.supabase.anonKey);
  return window._supabase;
}

function showToast(message, type = 'info') {
  const colors = { success: '#00ff88', error: '#ff2d78', info: '#00d4ff', warning: '#ffd700' };
  const container = document.getElementById('toast-container') || (() => {
    const el = document.createElement('div');
    el.id = 'toast-container';
    el.style.cssText = 'position:fixed;top:1.5rem;right:1.5rem;z-index:9999;display:flex;flex-direction:column;gap:.5rem;';
    document.body.appendChild(el);
    return el;
  })();
  const toast = document.createElement('div');
  toast.style.cssText = `
    background:rgba(10,10,26,.97);border:1px solid ${colors[type]};color:#fff;
    padding:.75rem 1.25rem;border-radius:.5rem;font-family:'Inter',sans-serif;
    font-size:.875rem;box-shadow:0 0 20px ${colors[type]}44;max-width:320px;
    opacity:0;transform:translateX(40px);transition:all .3s ease;`;
  toast.textContent = message;
  container.appendChild(toast);
  requestAnimationFrame(() => { toast.style.opacity = '1'; toast.style.transform = 'translateX(0)'; });
  setTimeout(() => {
    toast.style.opacity = '0'; toast.style.transform = 'translateX(40px)';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

async function requireAdmin() {
  const db = getClient();
  const { data: { session } } = await db.auth.getSession();
  if (!session) { window.location.href = '/index.html'; return false; }
  const { data: profile } = await db.from('profiles').select('role').eq('id', session.user.id).single();
  if (!profile || !GENBCONFIG.admin.roles.includes(profile.role)) {
    window.location.href = '/index.html'; return false;
  }
  return true;
}

// Simple debounce
function debounce(fn, ms) {
  let timer;
  return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), ms); };
}

/* ─────────────────────────────────────────────────────────────────────────────
   PAGINATION STATE
───────────────────────────────────────────────────────────────────────────── */
const PAGE_SIZE = 20;
let currentPage = 1;
let currentSearch = '';
let totalUserCount = 0;

/* ─────────────────────────────────────────────────────────────────────────────
   1. GET ALL USERS (paginated + search)
───────────────────────────────────────────────────────────────────────────── */
async function getAllUsers(search = '', page = 1) {
  const db = getClient();
  const from = (page - 1) * PAGE_SIZE;
  const to   = from + PAGE_SIZE - 1;

  let query = db
    .from('profiles')
    .select(`
      id, username, full_name, phone, email, avatar_url, role,
      status, is_verified, is_banned, ban_reason, suspension_until,
      level, xp, referral_code, created_at,
      wallets(deposit_balance, winning_balance, bonus_balance)
    `, { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to);

  if (search) {
    query = query.or(`username.ilike.%${search}%,full_name.ilike.%${search}%,phone.ilike.%${search}%`);
  }

  const { data, count, error } = await query;
  if (error) { console.error('[getAllUsers]', error); showToast('Failed to fetch users', 'error'); return { users: [], count: 0 }; }

  totalUserCount = count || 0;
  return { users: data || [], count: totalUserCount };
}

/* ─────────────────────────────────────────────────────────────────────────────
   2. GET USER DETAILS (single user, full profile)
───────────────────────────────────────────────────────────────────────────── */
async function getUserDetails(userId) {
  const db = getClient();
  const { data, error } = await db
    .from('profiles')
    .select(`
      id, username, full_name, phone, email, avatar_url, role,
      status, is_verified, is_banned, ban_reason, suspension_until,
      level, xp, referral_code, created_at,
      wallets(deposit_balance, winning_balance, bonus_balance),
      tournament_registrations(count),
      transactions(id, type, amount, wallet_type, description, created_at)
    `)
    .eq('id', userId)
    .single();

  if (error) { console.error('[getUserDetails]', error); return null; }
  return data;
}

/* ─────────────────────────────────────────────────────────────────────────────
   3. BAN USER
───────────────────────────────────────────────────────────────────────────── */
async function banUser(userId, reason = 'Violation of terms') {
  const db = getClient();
  const { error } = await db
    .from('profiles')
    .update({ is_banned: true, ban_reason: reason, status: 'banned' })
    .eq('id', userId);

  if (error) { console.error('[banUser]', error); showToast('Failed to ban user', 'error'); return false; }

  await db.from('admin_audit_log').insert({
    action: 'ban_user', target_user_id: userId, reason, created_at: new Date().toISOString(),
  }).catch(() => {});

  showToast('User banned. 🚫', 'warning');
  return true;
}

/* ─────────────────────────────────────────────────────────────────────────────
   4. SUSPEND USER
───────────────────────────────────────────────────────────────────────────── */
async function suspendUser(userId, days = 7) {
  const db = getClient();
  const until = new Date(Date.now() + days * 86400000).toISOString();
  const { error } = await db
    .from('profiles')
    .update({ status: 'suspended', suspension_until: until })
    .eq('id', userId);

  if (error) { console.error('[suspendUser]', error); showToast('Failed to suspend user', 'error'); return false; }

  await db.from('admin_audit_log').insert({
    action: 'suspend_user', target_user_id: userId,
    reason: `Suspended for ${days} day(s) until ${until}`, created_at: new Date().toISOString(),
  }).catch(() => {});

  showToast(`User suspended for ${days} day(s) 🕐`, 'warning');
  return true;
}

/* ─────────────────────────────────────────────────────────────────────────────
   5. UNBAN USER
───────────────────────────────────────────────────────────────────────────── */
async function unbanUser(userId) {
  const db = getClient();
  const { error } = await db
    .from('profiles')
    .update({ is_banned: false, ban_reason: null, status: 'active', suspension_until: null })
    .eq('id', userId);

  if (error) { console.error('[unbanUser]', error); showToast('Failed to unban user', 'error'); return false; }

  await db.from('admin_audit_log').insert({
    action: 'unban_user', target_user_id: userId, created_at: new Date().toISOString(),
  }).catch(() => {});

  showToast('User reinstated. ✅', 'success');
  return true;
}

/* ─────────────────────────────────────────────────────────────────────────────
   6. VERIFY USER
───────────────────────────────────────────────────────────────────────────── */
async function verifyUser(userId) {
  const db = getClient();
  const { error } = await db
    .from('profiles')
    .update({ is_verified: true })
    .eq('id', userId);

  if (error) { console.error('[verifyUser]', error); showToast('Failed to verify user', 'error'); return false; }

  await db.from('notifications').insert({
    user_id: userId, title: '✅ Account Verified!',
    body: 'Your account has been verified by the Gen B team.',
    type: 'system', read: false, created_at: new Date().toISOString(),
  }).catch(() => {});

  showToast('User verified! ✅', 'success');
  return true;
}

/* ─────────────────────────────────────────────────────────────────────────────
   7. EDIT USER WALLET (direct balance override)
   walletType: 'deposit' | 'winning' | 'bonus'
───────────────────────────────────────────────────────────────────────────── */
async function editUserWallet(userId, walletType, newBalance) {
  if (!['deposit', 'winning', 'bonus'].includes(walletType)) {
    showToast('Invalid wallet type', 'error'); return false;
  }
  if (isNaN(newBalance) || newBalance < 0) { showToast('Invalid balance value', 'error'); return false; }

  const db = getClient();
  const field = `${walletType}_balance`;

  const { data: wallet } = await db.from('wallets').select('id').eq('user_id', userId).single();
  if (!wallet) { showToast('Wallet not found', 'error'); return false; }

  const { error } = await db.from('wallets').update({ [field]: Number(newBalance) }).eq('id', wallet.id);
  if (error) { console.error('[editUserWallet]', error); showToast('Failed to update wallet', 'error'); return false; }

  await db.from('admin_audit_log').insert({
    action: 'edit_wallet', target_user_id: userId,
    reason: `Admin set ${walletType} balance to ₹${newBalance}`,
    created_at: new Date().toISOString(),
  }).catch(() => {});

  showToast(`${walletType} wallet updated to ₹${newBalance} ✅`, 'success');
  return true;
}

/* ─────────────────────────────────────────────────────────────────────────────
   8. ADD BONUS TO USER
───────────────────────────────────────────────────────────────────────────── */
async function addBonusToUser(userId, amount, reason = 'Admin bonus') {
  if (!amount || amount <= 0) { showToast('Bonus amount must be > 0', 'warning'); return false; }

  const db = getClient();
  const { data: wallet, error: wErr } = await db
    .from('wallets')
    .select('id, bonus_balance')
    .eq('user_id', userId)
    .single();

  if (wErr || !wallet) { showToast('Wallet not found', 'error'); return false; }

  const newBalance = (wallet.bonus_balance || 0) + Number(amount);
  const { error } = await db.from('wallets').update({ bonus_balance: newBalance }).eq('id', wallet.id);
  if (error) { console.error('[addBonusToUser]', error); showToast('Failed to add bonus', 'error'); return false; }

  await db.from('transactions').insert({
    user_id: userId, type: 'bonus_credit', amount: Number(amount),
    wallet_type: 'bonus', description: reason, created_at: new Date().toISOString(),
  }).catch(() => {});

  await db.from('notifications').insert({
    user_id: userId, title: '🎁 Bonus Added!',
    body: `₹${amount} bonus has been added to your account. Reason: ${reason}`,
    type: 'bonus', read: false, created_at: new Date().toISOString(),
  }).catch(() => {});

  showToast(`₹${amount} bonus added! 🎁`, 'success');
  return true;
}

/* ─────────────────────────────────────────────────────────────────────────────
   9. RENDER USERS TABLE
───────────────────────────────────────────────────────────────────────────── */
function renderUsersTable(users) {
  const tbody = document.getElementById('users-tbody');
  if (!tbody) return;

  if (!users || users.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" class="py-12 text-center">
          <div class="flex flex-col items-center opacity-50">
            <span style="font-size:3rem;">👥</span>
            <p class="mt-2 text-sm text-gray-400 font-inter">No users found</p>
          </div>
        </td>
      </tr>`;
    return;
  }

  tbody.innerHTML = users.map(user => {
    const wallet = Array.isArray(user.wallets) ? user.wallets[0] : user.wallets;
    const totalBal = ((wallet?.deposit_balance || 0) + (wallet?.winning_balance || 0) + (wallet?.bonus_balance || 0));
    const joined = new Date(user.created_at).toLocaleDateString('en-IN', { dateStyle: 'medium' });

    let statusBadge = '';
    if (user.is_banned) {
      statusBadge = `<span class="px-2 py-0.5 rounded-full text-xs" style="background:rgba(255,45,120,.2);color:#ff2d78;">Banned</span>`;
    } else if (user.status === 'suspended') {
      statusBadge = `<span class="px-2 py-0.5 rounded-full text-xs" style="background:rgba(255,215,0,.2);color:#ffd700;">Suspended</span>`;
    } else {
      statusBadge = `<span class="px-2 py-0.5 rounded-full text-xs" style="background:rgba(0,255,136,.2);color:#00ff88;">Active</span>`;
    }

    const verifiedBadge = user.is_verified
      ? `<span class="ml-1 text-xs" style="color:#00d4ff;" title="Verified">✅</span>`
      : `<span class="ml-1 text-xs text-gray-500" title="Unverified">○</span>`;

    return `
      <tr class="border-b border-white border-opacity-5 hover:bg-white hover:bg-opacity-5 transition-colors">
        <td class="px-4 py-3">
          <div class="flex items-center gap-3">
            <img src="${user.avatar_url || '/assets/img/default-avatar.png'}"
                 onerror="this.src='/assets/img/default-avatar.png'"
                 class="w-8 h-8 rounded-full object-cover border"
                 style="border-color:rgba(0,212,255,0.3);">
            <div>
              <div class="flex items-center gap-1">
                <p class="text-sm font-semibold text-white font-rajdhani">${user.username || 'N/A'}</p>
                ${verifiedBadge}
              </div>
              <p class="text-xs text-gray-400">${user.full_name || ''}</p>
            </div>
          </div>
        </td>
        <td class="px-4 py-3 text-xs text-gray-300">${user.phone || '—'}</td>
        <td class="px-4 py-3 text-xs text-gray-400">${joined}</td>
        <td class="px-4 py-3 text-sm font-semibold" style="color:#00ff88;">
          ₹${totalBal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
        </td>
        <td class="px-4 py-3 text-xs text-gray-300">Lv.${user.level || 1} · ${(user.xp || 0).toLocaleString()} XP</td>
        <td class="px-4 py-3">${statusBadge}</td>
        <td class="px-4 py-3 text-xs capitalize" style="color:rgba(177,74,237,0.9);">${user.role || 'user'}</td>
        <td class="px-4 py-3">
          <div class="flex items-center gap-1 flex-wrap">
            <button onclick="openUserModal('${user.id}')"
                    class="px-2 py-1 rounded text-xs transition-all"
                    style="background:rgba(0,212,255,0.15);color:#00d4ff;border:1px solid rgba(0,212,255,0.3);"
                    title="View details">👁️</button>
            ${!user.is_verified ? `
            <button onclick="handleVerifyUser('${user.id}')"
                    class="px-2 py-1 rounded text-xs transition-all"
                    style="background:rgba(0,255,136,0.15);color:#00ff88;border:1px solid rgba(0,255,136,0.3);"
                    title="Verify">✅</button>` : ''}
            ${user.is_banned ? `
            <button onclick="handleUnban('${user.id}')"
                    class="px-2 py-1 rounded text-xs transition-all"
                    style="background:rgba(0,255,136,0.15);color:#00ff88;border:1px solid rgba(0,255,136,0.3);"
                    title="Unban">🔓</button>` : `
            <button onclick="handleBan('${user.id}')"
                    class="px-2 py-1 rounded text-xs transition-all"
                    style="background:rgba(255,45,120,0.15);color:#ff2d78;border:1px solid rgba(255,45,120,0.3);"
                    title="Ban">🚫</button>`}
            <button onclick="handleBonus('${user.id}')"
                    class="px-2 py-1 rounded text-xs transition-all"
                    style="background:rgba(255,215,0,0.15);color:#ffd700;border:1px solid rgba(255,215,0,0.3);"
                    title="Add Bonus">🎁</button>
          </div>
        </td>
      </tr>`;
  }).join('');

  renderPagination();
}

/* ─────────────────────────────────────────────────────────────────────────────
   PAGINATION RENDER
───────────────────────────────────────────────────────────────────────────── */
function renderPagination() {
  const el = document.getElementById('users-pagination');
  if (!el) return;
  const totalPages = Math.ceil(totalUserCount / PAGE_SIZE);
  if (totalPages <= 1) { el.innerHTML = ''; return; }

  el.innerHTML = `
    <div class="flex items-center gap-2 justify-center py-4">
      <button onclick="goToPage(${currentPage - 1})" ${currentPage === 1 ? 'disabled' : ''}
              class="px-3 py-1.5 rounded text-sm text-white transition-all ${currentPage === 1 ? 'opacity-30 cursor-not-allowed' : 'hover:bg-white hover:bg-opacity-10'}"
              style="border:1px solid rgba(255,255,255,0.15);">← Prev</button>
      <span class="text-sm text-gray-400 font-inter">Page <strong class="text-white">${currentPage}</strong> of ${totalPages}
        <span class="ml-2 text-xs">(${totalUserCount} users)</span>
      </span>
      <button onclick="goToPage(${currentPage + 1})" ${currentPage === totalPages ? 'disabled' : ''}
              class="px-3 py-1.5 rounded text-sm text-white transition-all ${currentPage === totalPages ? 'opacity-30 cursor-not-allowed' : 'hover:bg-white hover:bg-opacity-10'}"
              style="border:1px solid rgba(255,255,255,0.15);">Next →</button>
    </div>`;
}

async function goToPage(page) {
  if (page < 1) return;
  const totalPages = Math.ceil(totalUserCount / PAGE_SIZE);
  if (page > totalPages) return;
  currentPage = page;
  const { users } = await getAllUsers(currentSearch, currentPage);
  renderUsersTable(users);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/* ─────────────────────────────────────────────────────────────────────────────
   10. OPEN USER MODAL
───────────────────────────────────────────────────────────────────────────── */
async function openUserModal(userId) {
  const modal = document.getElementById('user-detail-modal');
  if (!modal) return;
  modal.classList.remove('hidden');
  modal.classList.add('flex');

  const content = document.getElementById('user-modal-content');
  if (content) content.innerHTML = '<div class="text-center py-8 text-gray-400 animate-pulse">Loading user data...</div>';

  const user = await getUserDetails(userId);
  if (!user || !content) { showToast('Failed to load user details', 'error'); return; }

  const wallet = Array.isArray(user.wallets) ? user.wallets[0] : user.wallets;
  const recentTx = Array.isArray(user.transactions) ? user.transactions.slice(0, 8) : [];

  content.innerHTML = `
    <div class="space-y-5">
      <!-- Profile Header -->
      <div class="flex items-center gap-4 pb-4" style="border-bottom:1px solid rgba(255,255,255,0.08);">
        <img src="${user.avatar_url || '/assets/img/default-avatar.png'}"
             onerror="this.src='/assets/img/default-avatar.png'"
             class="w-16 h-16 rounded-full object-cover border-2"
             style="border-color:#00d4ff;">
        <div>
          <h3 class="text-lg font-bold text-white font-rajdhani">${user.username || 'N/A'}
            ${user.is_verified ? '<span class="text-sm text-blue-400">✅</span>' : ''}
          </h3>
          <p class="text-sm text-gray-400">${user.full_name || ''} · ${user.phone || 'No phone'}</p>
          <p class="text-xs text-gray-500 mt-0.5">Joined ${new Date(user.created_at).toLocaleDateString('en-IN')}</p>
          <p class="text-xs mt-0.5 capitalize" style="color:#b14aed;">Role: ${user.role || 'user'}</p>
        </div>
      </div>

      <!-- Wallet Summary -->
      <div>
        <h4 class="text-sm font-semibold text-gray-300 mb-3 font-rajdhani uppercase tracking-wider">💰 Wallets</h4>
        <div class="grid grid-cols-3 gap-3">
          ${[
            { label: 'Deposit', key: 'deposit_balance', color: '#00d4ff' },
            { label: 'Winnings', key: 'winning_balance', color: '#00ff88' },
            { label: 'Bonus',   key: 'bonus_balance',   color: '#ffd700' },
          ].map(w => `
            <div class="rounded-lg p-3 text-center" style="background:rgba(255,255,255,0.04);border:1px solid ${w.color}22;">
              <p class="text-xs text-gray-400 mb-1">${w.label}</p>
              <p class="font-bold font-rajdhani" style="color:${w.color};">₹${(wallet?.[w.key] || 0).toFixed(2)}</p>
              <div class="mt-2">
                <input type="number" id="edit-${w.key}-${userId}" value="${(wallet?.[w.key] || 0).toFixed(2)}"
                       step="0.01" min="0"
                       class="w-full text-center text-xs bg-transparent border-b text-white py-0.5"
                       style="border-color:${w.color}44;outline:none;"/>
                <button onclick="handleEditWallet('${userId}','${w.key.replace('_balance','')}', document.getElementById('edit-${w.key}-${userId}').value)"
                        class="mt-1 w-full text-xs py-0.5 rounded transition-all"
                        style="background:${w.color}22;color:${w.color};border:1px solid ${w.color}33;">Save</button>
              </div>
            </div>`
          ).join('')}
        </div>
      </div>

      <!-- Add Bonus -->
      <div class="rounded-lg p-4" style="background:rgba(255,215,0,0.05);border:1px solid rgba(255,215,0,0.15);">
        <h4 class="text-sm font-semibold text-yellow-400 mb-3 font-rajdhani">🎁 Add Bonus Cash</h4>
        <div class="flex gap-2">
          <input type="number" id="bonus-amount-${userId}" placeholder="Amount (₹)" min="1"
                 class="flex-1 bg-transparent border text-white text-sm rounded px-3 py-2"
                 style="border-color:rgba(255,215,0,0.3);outline:none;">
          <input type="text" id="bonus-reason-${userId}" placeholder="Reason"
                 class="flex-1 bg-transparent border text-white text-sm rounded px-3 py-2"
                 style="border-color:rgba(255,215,0,0.3);outline:none;">
          <button onclick="handleAddBonus('${userId}')"
                  class="px-4 py-2 rounded text-sm font-semibold transition-all"
                  style="background:rgba(255,215,0,0.2);color:#ffd700;border:1px solid rgba(255,215,0,0.4);">Add</button>
        </div>
      </div>

      <!-- Moderation -->
      <div class="flex flex-wrap gap-2">
        ${!user.is_verified ? `
        <button onclick="handleVerifyUser('${userId}')"
                class="px-3 py-1.5 rounded text-xs font-semibold transition-all"
                style="background:rgba(0,255,136,0.15);color:#00ff88;border:1px solid rgba(0,255,136,0.3);">
          ✅ Verify User</button>` : ''}
        ${user.is_banned ? `
        <button onclick="handleUnban('${userId}')"
                class="px-3 py-1.5 rounded text-xs font-semibold transition-all"
                style="background:rgba(0,255,136,0.15);color:#00ff88;border:1px solid rgba(0,255,136,0.3);">
          🔓 Unban User</button>` : `
        <button onclick="handleBan('${userId}')"
                class="px-3 py-1.5 rounded text-xs font-semibold transition-all"
                style="background:rgba(255,45,120,0.15);color:#ff2d78;border:1px solid rgba(255,45,120,0.3);">
          🚫 Ban User</button>
        <button onclick="handleSuspend('${userId}')"
                class="px-3 py-1.5 rounded text-xs font-semibold transition-all"
                style="background:rgba(255,215,0,0.15);color:#ffd700;border:1px solid rgba(255,215,0,0.3);">
          🕐 Suspend 7d</button>`}
      </div>

      <!-- Recent Transactions -->
      ${recentTx.length > 0 ? `
      <div>
        <h4 class="text-sm font-semibold text-gray-300 mb-3 font-rajdhani uppercase tracking-wider">📋 Recent Transactions</h4>
        <div class="space-y-2 max-h-52 overflow-y-auto pr-1">
          ${recentTx.map(tx => `
            <div class="flex justify-between items-center py-1.5 px-2 rounded" style="background:rgba(255,255,255,0.03);">
              <div>
                <p class="text-xs text-white capitalize">${tx.type?.replace(/_/g,' ')}</p>
                <p class="text-xs text-gray-500">${tx.description || ''}</p>
              </div>
              <div class="text-right">
                <p class="text-xs font-semibold ${tx.type?.includes('deduct') || tx.type?.includes('fee') ? 'text-red-400' : 'text-green-400'}">
                  ${tx.type?.includes('deduct') || tx.type?.includes('fee') ? '-' : '+'}₹${tx.amount}</p>
                <p class="text-xs text-gray-600">${new Date(tx.created_at).toLocaleDateString('en-IN')}</p>
              </div>
            </div>`
          ).join('')}
        </div>
      </div>` : ''}
    </div>`;
}

/* ─────────────────────────────────────────────────────────────────────────────
   ACTION HANDLERS (called from inline onclick)
───────────────────────────────────────────────────────────────────────────── */
async function handleBan(userId) {
  const reason = window.prompt('Reason for ban:', 'Violation of terms of service');
  if (reason === null) return;
  const ok = await banUser(userId, reason || 'Violation of terms');
  if (ok) { closeUserModal(); await reloadUsers(); }
}

async function handleUnban(userId) {
  const ok = await unbanUser(userId);
  if (ok) { closeUserModal(); await reloadUsers(); }
}

async function handleSuspend(userId) {
  const days = parseInt(window.prompt('Suspend for how many days?', '7'));
  if (isNaN(days) || days < 1) return;
  const ok = await suspendUser(userId, days);
  if (ok) { closeUserModal(); await reloadUsers(); }
}

async function handleVerifyUser(userId) {
  const ok = await verifyUser(userId);
  if (ok) { closeUserModal(); await reloadUsers(); }
}

async function handleEditWallet(userId, walletType, newBalance) {
  await editUserWallet(userId, walletType, parseFloat(newBalance));
}

async function handleAddBonus(userId) {
  const amount = parseFloat(document.getElementById(`bonus-amount-${userId}`)?.value);
  const reason = document.getElementById(`bonus-reason-${userId}`)?.value || 'Admin bonus';
  await addBonusToUser(userId, amount, reason);
}

async function handleBonus(userId) {
  await openUserModal(userId);
}

function closeUserModal() {
  const modal = document.getElementById('user-detail-modal');
  if (!modal) return;
  modal.classList.add('hidden');
  modal.classList.remove('flex');
}

async function reloadUsers() {
  const { users } = await getAllUsers(currentSearch, currentPage);
  renderUsersTable(users);
}

/* ─────────────────────────────────────────────────────────────────────────────
   11. INIT USERS ADMIN
───────────────────────────────────────────────────────────────────────────── */
async function initUsersAdmin() {
  const ok = await requireAdmin();
  if (!ok) return;

  // Initial load
  const { users } = await getAllUsers('', 1);
  renderUsersTable(users);

  // Search input (debounced)
  const searchInput = document.getElementById('user-search');
  if (searchInput) {
    searchInput.addEventListener('input', debounce(async e => {
      currentSearch = e.target.value.trim();
      currentPage = 1;
      const { users } = await getAllUsers(currentSearch, currentPage);
      renderUsersTable(users);
    }, 400));
  }

  // Close modal
  document.getElementById('close-user-modal')?.addEventListener('click', closeUserModal);
  document.getElementById('user-detail-modal')?.addEventListener('click', e => {
    if (e.target === e.currentTarget) closeUserModal();
  });

  // Export CSV button
  const exportBtn = document.getElementById('export-users-btn');
  if (exportBtn) {
    exportBtn.addEventListener('click', async () => {
      const { users: all } = await getAllUsers('', 1);
      const rows = [['Username','Full Name','Phone','Level','Status','Joined']];
      all.forEach(u => rows.push([u.username, u.full_name, u.phone, u.level, u.status, u.created_at]));
      const csv = rows.map(r => r.map(v => `"${v ?? ''}"`).join(',')).join('\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url;
      a.download = `users_${new Date().toISOString().slice(0,10)}.csv`;
      a.click(); URL.revokeObjectURL(url);
    });
  }
}

/* ─────────────────────────────────────────────────────────────────────────────
   AUTO-INIT
───────────────────────────────────────────────────────────────────────────── */
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initUsersAdmin);
} else {
  initUsersAdmin();
}
