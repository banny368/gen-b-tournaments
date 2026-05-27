/**
 * @file wallet.js
 * @description Gen B Tournaments — Wallet Feature Module
 * Handles balances, deposits, withdrawals, UTR checking, and transaction history.
 * Depends on: config.js, supabase.js (window._supabaseClient), utils.js (showToast)
 */

'use strict';

function _sb() {
  if (!window._supabaseClient) {
    window._supabaseClient = supabase.createClient(
      GENBCONFIG.supabase.url,
      GENBCONFIG.supabase.anonKey
    );
  }
  return window._supabaseClient;
}

/* ─────────────────────────────────────────────────────────────────────────────
   WALLET DATA
   ───────────────────────────────────────────────────────────────────────────── */

/**
 * Fetch a user's wallet balances.
 * @param {string} userId
 * @returns {Promise<{main: number, bonus: number, winning: number}>}
 */
async function getWallet(userId) {
  try {
    const { data, error } = await _sb()
      .from('wallets')
      .select('main_balance, bonus_balance, winning_balance')
      .eq('user_id', userId)
      .single();

    if (error) throw error;
    return {
      main: data?.main_balance || 0,
      bonus: data?.bonus_balance || 0,
      winning: data?.winning_balance || 0,
    };
  } catch (err) {
    console.error('[getWallet]', err);
    return { main: 0, bonus: 0, winning: 0 };
  }
}

/**
 * Fetch the active QR code for deposits from admin_settings.
 * @returns {Promise<{qrUrl: string|null, upiId: string|null}>}
 */
async function getActiveQRCode() {
  try {
    const { data, error } = await _sb()
      .from('admin_settings')
      .select('qr_code_url, upi_id')
      .eq('key', 'payment_qr')
      .maybeSingle();

    if (error) throw error;
    return {
      qrUrl: data?.qr_code_url || null,
      upiId: data?.upi_id || null,
    };
  } catch (err) {
    console.error('[getActiveQRCode]', err);
    return { qrUrl: null, upiId: null };
  }
}

/**
 * Check if a UTR number has already been submitted to prevent duplicates.
 * @param {string} utr
 * @returns {Promise<boolean>}
 */
async function checkDuplicateUTR(utr) {
  try {
    const { count, error } = await _sb()
      .from('payment_requests')
      .select('id', { count: 'exact', head: true })
      .eq('utr_number', utr.trim());

    if (error) throw error;
    return (count || 0) > 0;
  } catch (err) {
    console.error('[checkDuplicateUTR]', err);
    return false;
  }
}

/**
 * Upload a payment screenshot to Cloudinary.
 * @param {File} file
 * @returns {Promise<string|null>} Secure URL or null on failure
 */
async function uploadPaymentScreenshot(file) {
  try {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', GENBCONFIG.cloudinary.uploadPreset);
    formData.append('folder', 'payment_screenshots');

    const resp = await fetch(
      `https://api.cloudinary.com/v1_1/${GENBCONFIG.cloudinary.cloudName}/image/upload`,
      { method: 'POST', body: formData }
    );

    if (!resp.ok) throw new Error('Upload failed');
    const result = await resp.json();
    return result.secure_url || null;
  } catch (err) {
    console.error('[uploadPaymentScreenshot]', err);
    showToast('Failed to upload screenshot.', 'error');
    return null;
  }
}

/**
 * Submit a deposit request.
 * @param {string} userId
 * @param {number} amount
 * @param {string} utrNumber
 * @param {string} screenshotUrl
 * @returns {Promise<boolean>}
 */
async function submitDeposit(userId, amount, utrNumber, screenshotUrl) {
  try {
    const { minDeposit, maxDeposit } = GENBCONFIG.wallet;

    if (!amount || amount < minDeposit) {
      showToast(`Minimum deposit is ${GENBCONFIG.app.currency}${minDeposit}.`, 'error');
      return false;
    }
    if (amount > maxDeposit) {
      showToast(`Maximum deposit is ${GENBCONFIG.app.currency}${maxDeposit}.`, 'error');
      return false;
    }
    if (!utrNumber || utrNumber.trim().length < 6) {
      showToast('Please enter a valid UTR/Reference number.', 'error');
      return false;
    }

    const isDuplicate = await checkDuplicateUTR(utrNumber);
    if (isDuplicate) {
      showToast('This UTR number has already been submitted.', 'error');
      return false;
    }

    const { error } = await _sb().from('payment_requests').insert({
      user_id: userId,
      type: 'deposit',
      amount,
      utr_number: utrNumber.trim(),
      screenshot_url: screenshotUrl,
      status: 'pending',
      created_at: new Date().toISOString(),
    });

    if (error) throw error;

    showToast('Deposit request submitted! Admin will verify within 30 minutes.', 'success');
    return true;
  } catch (err) {
    console.error('[submitDeposit]', err);
    showToast(err.message || 'Failed to submit deposit.', 'error');
    return false;
  }
}

/**
 * Submit a withdrawal request.
 * @param {string} userId
 * @param {number} amount
 * @param {string} upiId
 * @returns {Promise<boolean>}
 */
async function submitWithdrawal(userId, amount, upiId) {
  try {
    const { minWithdraw, maxWithdraw } = GENBCONFIG.wallet;

    if (!amount || amount < minWithdraw) {
      showToast(`Minimum withdrawal is ${GENBCONFIG.app.currency}${minWithdraw}.`, 'error');
      return false;
    }
    if (amount > maxWithdraw) {
      showToast(`Maximum withdrawal is ${GENBCONFIG.app.currency}${maxWithdraw}.`, 'error');
      return false;
    }
    if (!upiId || !upiId.includes('@')) {
      showToast('Please enter a valid UPI ID.', 'error');
      return false;
    }

    // Validate winning balance
    const wallet = await getWallet(userId);
    if (wallet.winning < amount) {
      showToast(`Insufficient winning balance. Available: ${GENBCONFIG.app.currency}${wallet.winning.toFixed(2)}`, 'error');
      return false;
    }

    // Check for pending withdrawal
    const { count } = await _sb()
      .from('payment_requests')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('type', 'withdrawal')
      .eq('status', 'pending');

    if ((count || 0) > 0) {
      showToast('You already have a pending withdrawal request.', 'warning');
      return false;
    }

    // Deduct winning balance
    const { error: walletError } = await _sb()
      .from('wallets')
      .update({ winning_balance: wallet.winning - amount })
      .eq('user_id', userId);

    if (walletError) throw walletError;

    const { error } = await _sb().from('payment_requests').insert({
      user_id: userId,
      type: 'withdrawal',
      amount,
      upi_id: upiId.trim(),
      status: 'pending',
      created_at: new Date().toISOString(),
    });

    if (error) throw error;

    await _sb().from('transactions').insert({
      user_id: userId,
      type: 'withdrawal',
      amount: -amount,
      description: `Withdrawal to ${upiId}`,
    });

    showToast(`Withdrawal of ${GENBCONFIG.app.currency}${amount} submitted! Processing within ${GENBCONFIG.wallet.withdrawProcessingDays} day(s).`, 'success');
    return true;
  } catch (err) {
    console.error('[submitWithdrawal]', err);
    showToast(err.message || 'Failed to submit withdrawal.', 'error');
    return false;
  }
}

/**
 * Fetch paginated transaction history for a user.
 * @param {string} userId
 * @param {{ type?: string, page?: number, limit?: number }} filters
 * @returns {Promise<{data: Array, hasMore: boolean}>}
 */
async function getTransactions(userId, filters = {}) {
  try {
    const page = filters.page || 0;
    const limit = filters.limit || 20;
    const from = page * limit;

    let query = _sb()
      .from('transactions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(from, from + limit);

    if (filters.type && filters.type !== 'all') {
      query = query.eq('type', filters.type);
    }

    const { data, error } = await query;
    if (error) throw error;

    return {
      data: data || [],
      hasMore: (data || []).length === limit + 1,
    };
  } catch (err) {
    console.error('[getTransactions]', err);
    return { data: [], hasMore: false };
  }
}

/* ─────────────────────────────────────────────────────────────────────────────
   RENDER FUNCTIONS
   ───────────────────────────────────────────────────────────────────────────── */

const _txTypeConfig = {
  deposit:    { label: 'Deposit',      icon: 'arrow-down-circle', color: '#00ff88' },
  withdrawal: { label: 'Withdrawal',   icon: 'arrow-up-circle',   color: '#ff2d78' },
  entry_fee:  { label: 'Entry Fee',    icon: 'gamepad-2',         color: '#ffd700' },
  prize:      { label: 'Prize Won',    icon: 'trophy',            color: '#ffd700' },
  refund:     { label: 'Refund',       icon: 'rotate-ccw',        color: '#00d4ff' },
  bonus:      { label: 'Bonus',        icon: 'gift',              color: '#b14aed' },
  referral:   { label: 'Referral',     icon: 'users',             color: '#00d4ff' },
  spin:       { label: 'Spin Reward',  icon: 'circle-dot',        color: '#ff6b35' },
  daily:      { label: 'Daily Reward', icon: 'calendar-check',    color: '#00ff88' },
};

/**
 * Returns HTML for a single transaction row.
 * @param {Object} tx
 * @returns {string}
 */
function renderTransactionRow(tx) {
  const cfg = _txTypeConfig[tx.type] || { label: tx.type, icon: 'activity', color: '#9ca3af' };
  const isCredit = tx.amount > 0;
  const amtStr = `${isCredit ? '+' : ''}${GENBCONFIG.app.currency}${Math.abs(tx.amount).toFixed(2)}`;
  const dateStr = tx.created_at
    ? new Date(tx.created_at).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })
    : '';

  const statusMap = {
    pending:   'text-[#ffd700] bg-[#ffd700]/10',
    approved:  'text-[#00ff88] bg-[#00ff88]/10',
    rejected:  'text-[#ff2d78] bg-[#ff2d78]/10',
    completed: 'text-[#00d4ff] bg-[#00d4ff]/10',
  };
  const statusCls = statusMap[tx.status] || 'text-gray-400 bg-white/5';

  return `
<div class="flex items-center justify-between p-4 rounded-xl border border-white/5 bg-[#0a0a1a] hover:border-[#00d4ff]/20 transition-colors">
  <div class="flex items-center gap-3">
    <div class="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style="background:${cfg.color}15; border:1px solid ${cfg.color}30;">
      <i data-lucide="${cfg.icon}" class="w-5 h-5" style="color:${cfg.color};"></i>
    </div>
    <div>
      <p class="text-sm font-semibold text-white">${cfg.label}</p>
      <p class="text-xs text-gray-500">${tx.description || ''}</p>
      <p class="text-xs text-gray-600">${dateStr}</p>
    </div>
  </div>
  <div class="text-right flex flex-col items-end gap-1">
    <span class="font-bold font-rajdhani text-base ${isCredit ? 'text-[#00ff88]' : 'text-[#ff2d78]'}">${amtStr}</span>
    ${tx.status ? `<span class="text-[10px] px-2 py-0.5 rounded-full font-semibold ${statusCls}">${tx.status}</span>` : ''}
  </div>
</div>`.trim();
}

/**
 * Animate wallet balance cards with a counting effect.
 * @param {{ main: number, bonus: number, winning: number }} wallet
 */
function renderWalletCards(wallet) {
  function animateCount(el, target) {
    if (!el) return;
    const duration = 800;
    const start = Date.now();
    const from = 0;

    const tick = () => {
      const elapsed = Date.now() - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      el.textContent = `${GENBCONFIG.app.currency}${(from + (target - from) * eased).toFixed(2)}`;
      if (progress < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  animateCount(document.getElementById('wallet-main'), wallet.main);
  animateCount(document.getElementById('wallet-bonus'), wallet.bonus);
  animateCount(document.getElementById('wallet-winning'), wallet.winning);

  const total = wallet.main + wallet.bonus + wallet.winning;
  animateCount(document.getElementById('wallet-total'), total);
}

/* ─────────────────────────────────────────────────────────────────────────────
   PAGE INIT
   ───────────────────────────────────────────────────────────────────────────── */

let _txPage = 0;
let _txFilter = 'all';

/**
 * Fully initialise the wallet page.
 */
async function initWalletPage() {
  const { data: { user } } = await _sb().auth.getUser();
  if (!user) { window.location.href = '/auth.html'; return; }

  const userId = user.id;

  // Load wallet balances
  const wallet = await getWallet(userId);
  renderWalletCards(wallet);

  // Load QR code
  const { qrUrl, upiId } = await getActiveQRCode();
  const qrImg = document.getElementById('deposit-qr');
  if (qrImg && qrUrl) qrImg.src = qrUrl;
  const upiDisplay = document.getElementById('upi-id-display');
  if (upiDisplay && upiId) upiDisplay.textContent = upiId;

  // Load transactions
  async function loadTransactions(reset = false) {
    if (reset) { _txPage = 0; }
    const listEl = document.getElementById('transaction-list');
    if (!listEl) return;

    if (reset) listEl.innerHTML = `<div class="flex justify-center py-8"><div class="w-8 h-8 border-2 border-[#00d4ff] border-t-transparent rounded-full animate-spin"></div></div>`;

    const { data, hasMore } = await getTransactions(userId, { type: _txFilter, page: _txPage, limit: 20 });

    if (reset) listEl.innerHTML = '';

    if (data.length === 0 && _txPage === 0) {
      listEl.innerHTML = `<div class="text-center py-12 text-gray-500">
        <i data-lucide="inbox" class="w-12 h-12 mx-auto mb-3 opacity-30"></i>
        <p>No transactions yet</p>
      </div>`;
      lucide.createIcons();
      return;
    }

    listEl.insertAdjacentHTML('beforeend', data.map(renderTransactionRow).join(''));
    lucide.createIcons();

    const loadMoreBtn = document.getElementById('load-more-tx');
    if (loadMoreBtn) loadMoreBtn.classList.toggle('hidden', !hasMore);
  }

  // TX filter tabs
  document.querySelectorAll('[data-tx-filter]').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('[data-tx-filter]').forEach(t => t.classList.remove('active', 'text-[#00d4ff]', 'border-[#00d4ff]'));
      tab.classList.add('active', 'text-[#00d4ff]', 'border-[#00d4ff]');
      _txFilter = tab.dataset.txFilter;
      loadTransactions(true);
    });
  });

  // Load more
  const loadMoreBtn = document.getElementById('load-more-tx');
  if (loadMoreBtn) {
    loadMoreBtn.addEventListener('click', () => { _txPage++; loadTransactions(); });
  }

  // Screenshot preview
  const screenshotInput = document.getElementById('payment-screenshot');
  if (screenshotInput) {
    screenshotInput.addEventListener('change', e => {
      const file = e.target.files[0];
      if (!file) return;
      const preview = document.getElementById('screenshot-preview');
      if (preview) {
        preview.src = URL.createObjectURL(file);
        preview.classList.remove('hidden');
      }
    });
  }

  // Deposit form
  const depositForm = document.getElementById('deposit-form');
  if (depositForm) {
    depositForm.addEventListener('submit', async e => {
      e.preventDefault();
      const btn = depositForm.querySelector('[type="submit"]');
      const origText = btn.textContent;
      btn.disabled = true;
      btn.innerHTML = `<span class="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></span>Submitting...`;

      const amount = Number(document.getElementById('deposit-amount')?.value);
      const utr = document.getElementById('utr-number')?.value || '';
      const file = screenshotInput?.files[0];

      let screenshotUrl = null;
      if (file) screenshotUrl = await uploadPaymentScreenshot(file);

      const ok = await submitDeposit(userId, amount, utr, screenshotUrl);
      if (ok) {
        depositForm.reset();
        const preview = document.getElementById('screenshot-preview');
        if (preview) preview.classList.add('hidden');
      }

      btn.disabled = false;
      btn.textContent = origText;
    });
  }

  // Withdrawal form
  const withdrawForm = document.getElementById('withdraw-form');
  if (withdrawForm) {
    withdrawForm.addEventListener('submit', async e => {
      e.preventDefault();
      const btn = withdrawForm.querySelector('[type="submit"]');
      const origText = btn.textContent;
      btn.disabled = true;
      btn.innerHTML = `<span class="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></span>Submitting...`;

      const amount = Number(document.getElementById('withdraw-amount')?.value);
      const upiId = document.getElementById('withdraw-upi')?.value || '';

      const ok = await submitWithdrawal(userId, amount, upiId);
      if (ok) {
        withdrawForm.reset();
        const freshWallet = await getWallet(userId);
        renderWalletCards(freshWallet);
      }

      btn.disabled = false;
      btn.textContent = origText;
    });
  }

  // Copy UPI ID
  const copyUpiBtn = document.getElementById('copy-upi-btn');
  if (copyUpiBtn && upiId) {
    copyUpiBtn.addEventListener('click', () => {
      navigator.clipboard.writeText(upiId).then(() => showToast('UPI ID copied!', 'success'));
    });
  }

  await loadTransactions(true);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initWalletPage);
} else {
  initWalletPage();
}
