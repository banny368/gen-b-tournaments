/**
 * Gen B Tournaments — Admin Wallet Management
 * =============================================
 * Handles: user wallet overview, transaction audit log, bonus credits, admin deductions.
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
  if (!session) { window.location.href = '../index.html'; return false; }
  const { data: profile } = await db.from('profiles').select('role').eq('id', session.user.id).single();
  if (!profile || !GENBCONFIG.admin.roles.includes(profile.role)) {
    window.location.href = '../index.html'; return false;
  }
  return true;
}

function debounce(fn, ms) {
  let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}

function formatCurrency(val) {
  return '₹' + (val || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 });
}

function formatDate(str) {
  return new Date(str).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
}

/* ─────────────────────────────────────────────────────────────────────────────
   1. GET USERS WITH WALLETS (overview table)
───────────────────────────────────────────────────────────────────────────── */
async function getUsersWithWallets(search = '') {
  const db = getClient();

  let query = db
    .from('profiles')
    .select(`
      id, username, full_name, phone, avatar_url, level, created_at,
      wallets(id, deposit_balance, winning_balance, bonus_balance)
    `)
    .order('created_at', { ascending: false })
    .limit(100);

  if (search) {
    query = query.or(`username.ilike.%${search}%,phone.ilike.%${search}%,full_name.ilike.%${search}%`);
  }

  const { data, error } = await query;
  if (error) { console.error('[getUsersWithWallets]', error); showToast('Failed to load wallet data', 'error'); return []; }
  return data || [];
}

/* ─────────────────────────────────────────────────────────────────────────────
   2. GET WALLET DETAILS (single user — all wallets + full tx history)
───────────────────────────────────────────────────────────────────────────── */
async function getWalletDetails(userId) {
  const db = getClient();

  const [
    { data: wallets, error: wErr },
    { data: transactions, error: txErr },
  ] = await Promise.all([
    db.from('wallets').select('*').eq('user_id', userId).single(),
    db.from('transactions')
      .select('id, type, amount, wallet_type, description, reference_id, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(100),
  ]);

  if (wErr) console.error('[getWalletDetails] wallets', wErr);
  if (txErr) console.error('[getWalletDetails] transactions', txErr);

  return {
    wallets:      wallets || null,
    transactions: transactions || [],
  };
}

/* ─────────────────────────────────────────────────────────────────────────────
   3. ADD BONUS (credit bonus wallet)
───────────────────────────────────────────────────────────────────────────── */
async function addBonus(userId, amount, reason = 'Admin bonus') {
  if (!amount || Number(amount) <= 0) { showToast('Amount must be greater than 0', 'warning'); return false; }

  const db = getClient();
  const { data: wallet, error: wErr } = await db
    .from('wallets')
    .select('id, bonus_balance')
    .eq('user_id', userId)
    .single();

  if (wErr || !wallet) { showToast('Wallet not found for this user', 'error'); return false; }

  const newBalance = (wallet.bonus_balance || 0) + Number(amount);
  const { error: updErr } = await db.from('wallets').update({ bonus_balance: newBalance }).eq('id', wallet.id);
  if (updErr) { console.error('[addBonus]', updErr); showToast('Failed to add bonus', 'error'); return false; }

  // Transaction log
  await db.from('transactions').insert({
    user_id:     userId,
    type:        'bonus_credit',
    amount:      Number(amount),
    wallet_type: 'bonus',
    description: reason,
    created_at:  new Date().toISOString(),
  }).catch(() => {});

  // Admin audit
  await db.from('admin_audit_log').insert({
    action: 'add_bonus', target_user_id: userId,
    reason: `Added ₹${amount} bonus. Reason: ${reason}`,
    created_at: new Date().toISOString(),
  }).catch(() => {});

  // User notification
  await db.from('notifications').insert({
    user_id: userId, title: '🎁 Bonus Added!',
    body: `₹${amount} bonus has been added to your account! Reason: ${reason}`,
    type: 'bonus', read: false, created_at: new Date().toISOString(),
  }).catch(() => {});

  showToast(`₹${amount} bonus added! 🎁`, 'success');
  return true;
}

/* ─────────────────────────────────────────────────────────────────────────────
   4. DEDUCT BALANCE (admin deduction from any wallet)
   walletType: 'deposit' | 'winning' | 'bonus'
───────────────────────────────────────────────────────────────────────────── */
async function deductBalance(userId, walletType, amount, reason = 'Admin deduction') {
  const validTypes = ['deposit', 'winning', 'bonus'];
  if (!validTypes.includes(walletType)) { showToast('Invalid wallet type', 'error'); return false; }
  if (!amount || Number(amount) <= 0) { showToast('Deduction amount must be > 0', 'warning'); return false; }

  const db = getClient();
  const field = `${walletType}_balance`;

  const { data: wallet, error: wErr } = await db
    .from('wallets')
    .select(`id, ${field}`)
    .eq('user_id', userId)
    .single();

  if (wErr || !wallet) { showToast('Wallet not found', 'error'); return false; }

  const currentBalance = wallet[field] || 0;
  if (currentBalance < Number(amount)) {
    showToast(`Insufficient balance. Current: ₹${currentBalance.toFixed(2)}`, 'error');
    return false;
  }

  const newBalance = currentBalance - Number(amount);
  const { error: updErr } = await db.from('wallets').update({ [field]: newBalance }).eq('id', wallet.id);
  if (updErr) { console.error('[deductBalance]', updErr); showToast('Deduction failed', 'error'); return false; }

  // Transaction log
  await db.from('transactions').insert({
    user_id:     userId,
    type:        'admin_deduction',
    amount:      Number(amount),
    wallet_type: walletType,
    description: reason,
    created_at:  new Date().toISOString(),
  }).catch(() => {});

  // Admin audit
  await db.from('admin_audit_log').insert({
    action: 'deduct_balance', target_user_id: userId,
    reason: `Deducted ₹${amount} from ${walletType} wallet. Reason: ${reason}`,
    created_at: new Date().toISOString(),
  }).catch(() => {});

  // User notification
  await db.from('notifications').insert({
    user_id: userId, title: '⚠️ Balance Adjustment',
    body: `₹${amount} has been deducted from your ${walletType} wallet. Reason: ${reason}.`,
    type: 'system', read: false, created_at: new Date().toISOString(),
  }).catch(() => {});

  showToast(`₹${amount} deducted from ${walletType} wallet`, 'warning');
  return true;
}

/* ─────────────────────────────────────────────────────────────────────────────
   5. GET TRANSACTION AUDIT LOG (all transactions, admin-visible)
───────────────────────────────────────────────────────────────────────────── */
async function getTransactionAuditLog(filters = {}) {
  const db = getClient();

  let query = db
    .from('transactions')
    .select(`
      id, user_id, type, amount, wallet_type, description, reference_id, created_at,
      profiles(username, phone)
    `)
    .order('created_at', { ascending: false });

  if (filters.type)    query = query.eq('type', filters.type);
  if (filters.userId)  query = query.eq('user_id', filters.userId);
  if (filters.from)    query = query.gte('created_at', filters.from);
  if (filters.to)      query = query.lte('created_at', filters.to);

  query = query.limit(filters.limit || 200);

  const { data, error } = await query;
  if (error) { console.error('[getTransactionAuditLog]', error); showToast('Failed to load audit log', 'error'); return []; }
  return data || [];
}

/* ─────────────────────────────────────────────────────────────────────────────
   6. RENDER WALLET TABLE (user list with balance summary)
───────────────────────────────────────────────────────────────────────────── */
function renderWalletTable(users) {
  const tbody = document.getElementById('wallet-tbody');
  if (!tbody) return;

  if (!users || users.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="py-12 text-center">
          <div class="flex flex-col items-center opacity-50">
            <span style="font-size:3rem;">💼</span>
            <p class="mt-2 text-sm text-gray-400 font-inter">No users found</p>
          </div>
        </td>
      </tr>`;
    return;
  }

  // Calculate platform totals
  let totalDeposit = 0, totalWinning = 0, totalBonus = 0;

  const rows = users.map(user => {
    const w = Array.isArray(user.wallets) ? user.wallets[0] : user.wallets;
    const dep = w?.deposit_balance || 0;
    const win = w?.winning_balance || 0;
    const bon = w?.bonus_balance   || 0;
    const total = dep + win + bon;
    totalDeposit += dep; totalWinning += win; totalBonus += bon;

    return `
      <tr class="border-b border-white border-opacity-5 hover:bg-white hover:bg-opacity-5 transition-colors">
        <td class="px-4 py-3">
          <div class="flex items-center gap-3">
            <img src="${user.avatar_url || '/assets/img/default-avatar.png'}"
                 onerror="this.src='/assets/img/default-avatar.png'"
                 class="w-8 h-8 rounded-full object-cover border" style="border-color:rgba(0,212,255,0.3);">
            <div>
              <p class="text-sm font-semibold text-white font-rajdhani">${user.username || 'N/A'}</p>
              <p class="text-xs text-gray-400">${user.phone || ''}</p>
            </div>
          </div>
        </td>
        <td class="px-4 py-3 text-sm" style="color:#00d4ff;">${formatCurrency(dep)}</td>
        <td class="px-4 py-3 text-sm" style="color:#00ff88;">${formatCurrency(win)}</td>
        <td class="px-4 py-3 text-sm" style="color:#ffd700;">${formatCurrency(bon)}</td>
        <td class="px-4 py-3 text-sm font-bold text-white">${formatCurrency(total)}</td>
        <td class="px-4 py-3 text-xs text-gray-400">Lv.${user.level || 1}</td>
        <td class="px-4 py-3">
          <div class="flex gap-1">
            <button onclick="openWalletDetailPanel('${user.id}')"
                    class="px-2 py-1 rounded text-xs transition-all"
                    style="background:rgba(0,212,255,0.15);color:#00d4ff;border:1px solid rgba(0,212,255,0.3);"
                    title="Wallet Details">💼 Details</button>
            <button onclick="openBonusPanel('${user.id}','${user.username}')"
                    class="px-2 py-1 rounded text-xs transition-all"
                    style="background:rgba(255,215,0,0.15);color:#ffd700;border:1px solid rgba(255,215,0,0.3);"
                    title="Add Bonus">🎁 Bonus</button>
            <button onclick="openDeductPanel('${user.id}','${user.username}')"
                    class="px-2 py-1 rounded text-xs transition-all"
                    style="background:rgba(255,45,120,0.15);color:#ff2d78;border:1px solid rgba(255,45,120,0.3);"
                    title="Deduct">➖ Deduct</button>
          </div>
        </td>
      </tr>`;
  });

  tbody.innerHTML = rows.join('');

  // Update platform totals
  const el = id => document.getElementById(id);
  if (el('platform-deposit-total'))  el('platform-deposit-total').textContent  = formatCurrency(totalDeposit);
  if (el('platform-winning-total'))  el('platform-winning-total').textContent  = formatCurrency(totalWinning);
  if (el('platform-bonus-total'))    el('platform-bonus-total').textContent    = formatCurrency(totalBonus);
  if (el('platform-overall-total'))  el('platform-overall-total').textContent  = formatCurrency(totalDeposit + totalWinning + totalBonus);
}

/* ─────────────────────────────────────────────────────────────────────────────
   WALLET DETAIL SIDE PANEL
───────────────────────────────────────────────────────────────────────────── */
async function openWalletDetailPanel(userId) {
  const panel = document.getElementById('wallet-detail-panel');
  if (!panel) return;
  panel.classList.remove('hidden', 'translate-x-full');
  panel.classList.add('flex');

  const content = document.getElementById('wallet-detail-content');
  if (content) content.innerHTML = '<div class="text-center py-10 text-gray-400 animate-pulse text-sm">Loading...</div>';

  const { wallets: w, transactions } = await getWalletDetails(userId);

  if (!content) return;

  const txTypeColors = {
    deposit:       '#00d4ff',
    withdrawal_paid: '#ff2d78',
    prize:         '#00ff88',
    bonus_credit:  '#ffd700',
    admin_deduction: '#ff2d78',
    entry_fee:     '#b14aed',
    refund:        '#00ff88',
  };

  content.innerHTML = `
    <div class="space-y-4">
      <!-- Balance Cards -->
      <div class="grid grid-cols-3 gap-2">
        ${[
          { label: 'Deposit',  key: 'deposit_balance',  color: '#00d4ff' },
          { label: 'Winnings', key: 'winning_balance',  color: '#00ff88' },
          { label: 'Bonus',    key: 'bonus_balance',    color: '#ffd700' },
        ].map(wt => `
          <div class="rounded-lg p-3 text-center" style="background:rgba(255,255,255,0.04);border:1px solid ${wt.color}22;">
            <p class="text-xs text-gray-400 mb-1">${wt.label}</p>
            <p class="font-bold text-sm font-rajdhani" style="color:${wt.color};">${formatCurrency(w?.[wt.key])}</p>
          </div>`
        ).join('')}
      </div>

      <!-- Transaction History -->
      <div>
        <h4 class="text-sm font-semibold text-gray-300 mb-2 font-rajdhani uppercase tracking-wider">
          📋 Transaction History (${transactions.length})
        </h4>
        <div class="space-y-1.5 max-h-[400px] overflow-y-auto pr-1 custom-scrollbar">
          ${transactions.length === 0
            ? '<p class="text-xs text-gray-500 text-center py-4">No transactions</p>'
            : transactions.map(tx => {
                const color = txTypeColors[tx.type] || '#9ca3af';
                const isDebit = ['withdrawal_paid','entry_fee','admin_deduction'].includes(tx.type);
                return `
                  <div class="flex items-start justify-between py-2 px-2 rounded gap-2"
                       style="background:rgba(255,255,255,0.03);">
                    <div class="min-w-0">
                      <p class="text-xs text-white capitalize truncate">${tx.type?.replace(/_/g,' ')}</p>
                      <p class="text-xs text-gray-500 truncate">${tx.description || '—'}</p>
                      <p class="text-xs text-gray-600">${formatDate(tx.created_at)}</p>
                    </div>
                    <div class="text-right flex-shrink-0">
                      <p class="text-sm font-semibold font-rajdhani" style="color:${isDebit ? '#ff2d78' : color};">
                        ${isDebit ? '-' : '+'}${formatCurrency(tx.amount)}
                      </p>
                      <p class="text-xs capitalize" style="color:${color}55;">${tx.wallet_type || ''}</p>
                    </div>
                  </div>`;
              }).join('')}
        </div>
      </div>
    </div>`;
}

/* ─────────────────────────────────────────────────────────────────────────────
   BONUS PANEL (quick add)
───────────────────────────────────────────────────────────────────────────── */
function openBonusPanel(userId, username) {
  const modal = document.getElementById('action-modal');
  if (!modal) return;

  document.getElementById('action-modal-title').textContent = `🎁 Add Bonus — ${username}`;
  document.getElementById('action-modal-body').innerHTML = `
    <div class="space-y-3">
      <div>
        <label class="block text-xs text-gray-400 mb-1">Amount (₹)</label>
        <input type="number" id="action-amount" min="1" placeholder="e.g. 50"
               class="w-full bg-transparent border text-white rounded px-3 py-2 text-sm"
               style="border-color:rgba(255,215,0,0.4);outline:none;">
      </div>
      <div>
        <label class="block text-xs text-gray-400 mb-1">Reason</label>
        <input type="text" id="action-reason" placeholder="e.g. Referral campaign reward"
               class="w-full bg-transparent border text-white rounded px-3 py-2 text-sm"
               style="border-color:rgba(255,215,0,0.4);outline:none;">
      </div>
    </div>`;

  document.getElementById('action-modal-confirm').onclick = async () => {
    const amount = parseFloat(document.getElementById('action-amount')?.value);
    const reason = document.getElementById('action-reason')?.value || 'Admin bonus';
    const ok = await addBonus(userId, amount, reason);
    if (ok) {
      closeActionModal();
      const users = await getUsersWithWallets();
      renderWalletTable(users);
    }
  };

  modal.classList.remove('hidden');
  modal.classList.add('flex');
}

/* ─────────────────────────────────────────────────────────────────────────────
   DEDUCT PANEL
───────────────────────────────────────────────────────────────────────────── */
function openDeductPanel(userId, username) {
  const modal = document.getElementById('action-modal');
  if (!modal) return;

  document.getElementById('action-modal-title').textContent = `➖ Deduct Balance — ${username}`;
  document.getElementById('action-modal-body').innerHTML = `
    <div class="space-y-3">
      <div>
        <label class="block text-xs text-gray-400 mb-1">Wallet Type</label>
        <select id="action-wallet-type"
                class="w-full bg-transparent border text-white rounded px-3 py-2 text-sm"
                style="border-color:rgba(255,45,120,0.4);outline:none;background:#0a0a1a;">
          <option value="deposit" style="background:#0a0a1a;">Deposit Wallet</option>
          <option value="winning" style="background:#0a0a1a;">Winning Wallet</option>
          <option value="bonus"   style="background:#0a0a1a;">Bonus Wallet</option>
        </select>
      </div>
      <div>
        <label class="block text-xs text-gray-400 mb-1">Amount (₹)</label>
        <input type="number" id="action-amount" min="1" placeholder="e.g. 100"
               class="w-full bg-transparent border text-white rounded px-3 py-2 text-sm"
               style="border-color:rgba(255,45,120,0.4);outline:none;">
      </div>
      <div>
        <label class="block text-xs text-gray-400 mb-1">Reason</label>
        <input type="text" id="action-reason" placeholder="e.g. Chargeback / Penalty"
               class="w-full bg-transparent border text-white rounded px-3 py-2 text-sm"
               style="border-color:rgba(255,45,120,0.4);outline:none;">
      </div>
    </div>`;

  document.getElementById('action-modal-confirm').onclick = async () => {
    const walletType = document.getElementById('action-wallet-type')?.value;
    const amount     = parseFloat(document.getElementById('action-amount')?.value);
    const reason     = document.getElementById('action-reason')?.value || 'Admin deduction';
    const ok = await deductBalance(userId, walletType, amount, reason);
    if (ok) {
      closeActionModal();
      const users = await getUsersWithWallets();
      renderWalletTable(users);
    }
  };

  modal.classList.remove('hidden');
  modal.classList.add('flex');
}

function closeActionModal() {
  const modal = document.getElementById('action-modal');
  if (!modal) return;
  modal.classList.add('hidden');
  modal.classList.remove('flex');
}

/* ─────────────────────────────────────────────────────────────────────────────
   AUDIT LOG RENDER
───────────────────────────────────────────────────────────────────────────── */
function renderAuditLog(transactions) {
  const tbody = document.getElementById('audit-tbody');
  if (!tbody) return;

  if (!transactions || transactions.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="py-10 text-center text-gray-500 text-sm">No transactions in audit log</td>
      </tr>`;
    return;
  }

  const typeColors = {
    deposit:         '#00d4ff',
    withdrawal_paid: '#ff2d78',
    prize:           '#00ff88',
    bonus_credit:    '#ffd700',
    admin_deduction: '#ff2d78',
    entry_fee:       '#b14aed',
    refund:          '#00ff88',
  };

  tbody.innerHTML = transactions.map(tx => {
    const color    = typeColors[tx.type] || '#9ca3af';
    const isDebit  = ['withdrawal_paid','entry_fee','admin_deduction'].includes(tx.type);
    const username = tx.profiles?.username || 'Unknown';

    return `
      <tr class="border-b border-white border-opacity-5 hover:bg-white hover:bg-opacity-5 transition-colors text-sm">
        <td class="px-4 py-2 text-xs text-gray-400 font-mono">${formatDate(tx.created_at)}</td>
        <td class="px-4 py-2">
          <p class="text-white font-semibold">${username}</p>
          <p class="text-xs text-gray-500">${tx.profiles?.phone || ''}</p>
        </td>
        <td class="px-4 py-2">
          <span class="px-2 py-0.5 rounded text-xs capitalize" style="background:${color}22;color:${color};">
            ${tx.type?.replace(/_/g,' ')}
          </span>
        </td>
        <td class="px-4 py-2 font-semibold font-rajdhani" style="color:${isDebit ? '#ff2d78' : '#00ff88'};">
          ${isDebit ? '-' : '+'}${formatCurrency(tx.amount)}
        </td>
        <td class="px-4 py-2 text-xs text-gray-400 capitalize">${tx.wallet_type || '—'}</td>
        <td class="px-4 py-2 text-xs text-gray-400 max-w-[200px] truncate" title="${tx.description || ''}">
          ${tx.description || '—'}
        </td>
      </tr>`;
  }).join('');
}

/* ─────────────────────────────────────────────────────────────────────────────
   7. INIT WALLET ADMIN
───────────────────────────────────────────────────────────────────────────── */
async function initWalletAdmin() {
  const ok = await requireAdmin();
  if (!ok) return;

  // Load wallet table
  const users = await getUsersWithWallets();
  renderWalletTable(users);

  // Search
  const searchInput = document.getElementById('wallet-search');
  searchInput?.addEventListener('input', debounce(async e => {
    const users = await getUsersWithWallets(e.target.value.trim());
    renderWalletTable(users);
  }, 400));

  // Load audit log
  const auditLog = await getTransactionAuditLog({ limit: 200 });
  renderAuditLog(auditLog);

  // Audit log filters
  const auditTypeFilter = document.getElementById('audit-type-filter');
  const auditFromDate   = document.getElementById('audit-from-date');
  const auditToDate     = document.getElementById('audit-to-date');
  const applyFiltersBtn = document.getElementById('apply-audit-filters');

  if (applyFiltersBtn) {
    applyFiltersBtn.addEventListener('click', async () => {
      const filters = {
        type: auditTypeFilter?.value || undefined,
        from: auditFromDate?.value  ? new Date(auditFromDate.value).toISOString() : undefined,
        to:   auditToDate?.value    ? new Date(auditToDate.value + 'T23:59:59').toISOString() : undefined,
        limit: 500,
      };
      const log = await getTransactionAuditLog(filters);
      renderAuditLog(log);
    });
  }

  // Export audit log CSV
  document.getElementById('export-audit-btn')?.addEventListener('click', async () => {
    const log = await getTransactionAuditLog({ limit: 5000 });
    const rows = [['Date','Username','Type','Amount','Wallet','Description']];
    log.forEach(tx => rows.push([
      formatDate(tx.created_at),
      tx.profiles?.username || 'Unknown',
      tx.type,
      tx.amount,
      tx.wallet_type,
      tx.description || '',
    ]));
    const csv = rows.map(r => r.map(v => `"${v}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `transactions_audit_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
  });

  // Close wallet detail panel
  document.getElementById('close-wallet-panel')?.addEventListener('click', () => {
    const panel = document.getElementById('wallet-detail-panel');
    if (panel) { panel.classList.add('hidden', 'translate-x-full'); panel.classList.remove('flex'); }
  });

  // Close action modal
  document.getElementById('close-action-modal')?.addEventListener('click', closeActionModal);
  document.getElementById('action-modal')?.addEventListener('click', e => {
    if (e.target === e.currentTarget) closeActionModal();
  });
  document.getElementById('action-modal-cancel')?.addEventListener('click', closeActionModal);

  // Tab switcher
  document.querySelectorAll('[data-wallet-tab]').forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.walletTab;
      document.querySelectorAll('[data-wallet-panel]').forEach(panel => {
        panel.classList.toggle('hidden', panel.dataset.walletPanel !== tab);
      });
      document.querySelectorAll('[data-wallet-tab]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });

  // Real-time wallet changes
  const db = getClient();
  db.channel('admin-wallets')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'wallets' }, async () => {
      const users = await getUsersWithWallets();
      renderWalletTable(users);
    })
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'transactions' }, async () => {
      const auditLog = await getTransactionAuditLog({ limit: 200 });
      renderAuditLog(auditLog);
    })
    .subscribe();
}

/* ─────────────────────────────────────────────────────────────────────────────
   AUTO-INIT
───────────────────────────────────────────────────────────────────────────── */
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initWalletAdmin);
} else {
  initWalletAdmin();
}
