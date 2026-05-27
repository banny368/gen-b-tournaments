/**
 * Gen B Tournaments — Admin Payment Management
 * ==============================================
 * Handles: deposit approvals, withdrawal approvals, QR code management, UTR dupe checks.
 * Requires: config.js, supabase (window._supabase), Cloudinary
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

function setLoading(btnId, loading, text = '...') {
  const btn = document.getElementById(btnId);
  if (!btn) return;
  btn.disabled = loading;
  btn.style.opacity = loading ? '0.6' : '1';
  if (loading) btn.dataset.originalText = btn.textContent;
  btn.textContent = loading ? text : (btn.dataset.originalText || btn.textContent);
}

function formatTime(dateStr) {
  return new Date(dateStr).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
}

/* ─────────────────────────────────────────────────────────────────────────────
   1. GET PENDING DEPOSITS (UTR submissions)
───────────────────────────────────────────────────────────────────────────── */
async function getPendingDeposits() {
  const db = getClient();
  const { data, error } = await db
    .from('payments')
    .select(`
      id, user_id, amount, utr_number, screenshot_url, status, created_at,
      profiles(id, username, phone, avatar_url)
    `)
    .eq('type', 'deposit')
    .eq('status', 'pending')
    .order('created_at', { ascending: true });

  if (error) { console.error('[getPendingDeposits]', error); showToast('Failed to fetch deposits', 'error'); return []; }
  return data || [];
}

/* ─────────────────────────────────────────────────────────────────────────────
   2. GET PENDING WITHDRAWALS
───────────────────────────────────────────────────────────────────────────── */
async function getPendingWithdrawals() {
  const db = getClient();
  const { data, error } = await db
    .from('withdrawal_requests')
    .select(`
      id, user_id, amount, upi_id, account_name, status, created_at,
      profiles(id, username, phone, avatar_url)
    `)
    .eq('status', 'pending')
    .order('created_at', { ascending: true });

  if (error) { console.error('[getPendingWithdrawals]', error); showToast('Failed to fetch withdrawals', 'error'); return []; }
  return data || [];
}

/* ─────────────────────────────────────────────────────────────────────────────
   3. APPROVE DEPOSIT
   - Validates UTR duplicate
   - Credits deposit wallet
   - Updates payment status
   - Logs transaction & notification
───────────────────────────────────────────────────────────────────────────── */
async function approveDeposit(paymentId, userId, amount) {
  const db = getClient();

  // Duplicate UTR guard (already done at submit but double-check)
  const { data: existing } = await db
    .from('payments')
    .select('id, utr_number')
    .eq('id', paymentId)
    .single();

  if (existing?.utr_number) {
    const isDupe = await verifyUTR(existing.utr_number, paymentId);
    if (isDupe) { showToast('Duplicate UTR detected — cannot approve', 'error'); return false; }
  }

  // Credit wallet
  const { data: wallet, error: wErr } = await db
    .from('wallets')
    .select('id, deposit_balance')
    .eq('user_id', userId)
    .single();

  if (wErr || !wallet) { showToast('User wallet not found', 'error'); return false; }

  const { error: balErr } = await db
    .from('wallets')
    .update({ deposit_balance: (wallet.deposit_balance || 0) + Number(amount) })
    .eq('id', wallet.id);

  if (balErr) { console.error('[approveDeposit] wallet credit', balErr); showToast('Failed to credit wallet', 'error'); return false; }

  // Update payment status
  const { error: payErr } = await db
    .from('payments')
    .update({ status: 'approved', approved_at: new Date().toISOString() })
    .eq('id', paymentId);

  if (payErr) { console.error('[approveDeposit] status update', payErr); showToast('Wallet credited but status update failed', 'warning'); }

  // Transaction log
  await db.from('transactions').insert({
    user_id: userId, type: 'deposit', amount: Number(amount),
    wallet_type: 'deposit', description: `Deposit approved — Payment #${paymentId}`,
    reference_id: paymentId, created_at: new Date().toISOString(),
  }).catch(() => {});

  // Notification
  await db.from('notifications').insert({
    user_id: userId, title: '💰 Deposit Approved!',
    body: `₹${amount} has been added to your deposit wallet.`,
    type: 'payment', read: false, created_at: new Date().toISOString(),
  }).catch(() => {});

  showToast(`₹${amount} deposit approved! ✅`, 'success');
  return true;
}

/* ─────────────────────────────────────────────────────────────────────────────
   4. REJECT DEPOSIT
───────────────────────────────────────────────────────────────────────────── */
async function rejectDeposit(paymentId, reason = 'Invalid UTR / payment not received') {
  const db = getClient();
  const { data: payment } = await db.from('payments').select('user_id, amount').eq('id', paymentId).single();

  const { error } = await db
    .from('payments')
    .update({ status: 'rejected', rejection_reason: reason, rejected_at: new Date().toISOString() })
    .eq('id', paymentId);

  if (error) { console.error('[rejectDeposit]', error); showToast('Failed to reject payment', 'error'); return false; }

  if (payment) {
    await db.from('notifications').insert({
      user_id: payment.user_id,
      title: '❌ Deposit Rejected',
      body: `Your deposit of ₹${payment.amount} was rejected. Reason: ${reason}`,
      type: 'payment', read: false, created_at: new Date().toISOString(),
    }).catch(() => {});
  }

  showToast('Deposit rejected.', 'warning');
  return true;
}

/* ─────────────────────────────────────────────────────────────────────────────
   5. APPROVE WITHDRAWAL
   - Marks as paid
   - Deducts winning wallet
   - Logs transaction & notification
───────────────────────────────────────────────────────────────────────────── */
async function approveWithdrawal(withdrawalId, upiId, amount) {
  const db = getClient();
  const { data: req } = await db
    .from('withdrawal_requests')
    .select('user_id, amount')
    .eq('id', withdrawalId)
    .single();

  if (!req) { showToast('Withdrawal request not found', 'error'); return false; }

  // Update request
  const { error: updErr } = await db
    .from('withdrawal_requests')
    .update({ status: 'approved', approved_at: new Date().toISOString(), processed_upi: upiId || null })
    .eq('id', withdrawalId);

  if (updErr) { console.error('[approveWithdrawal]', updErr); showToast('Failed to approve withdrawal', 'error'); return false; }

  // Deduct winning wallet (already deducted at request time — just ensure status sync)
  // Log the approval transaction
  await db.from('transactions').insert({
    user_id: req.user_id, type: 'withdrawal_paid', amount: Number(amount || req.amount),
    wallet_type: 'winning', description: `Withdrawal approved — ₹${amount || req.amount} to ${upiId}`,
    reference_id: withdrawalId, created_at: new Date().toISOString(),
  }).catch(() => {});

  await db.from('notifications').insert({
    user_id: req.user_id,
    title: '✅ Withdrawal Processed!',
    body: `₹${amount || req.amount} has been sent to ${upiId}. Usually arrives within 24 hours.`,
    type: 'payment', read: false, created_at: new Date().toISOString(),
  }).catch(() => {});

  showToast('Withdrawal approved & marked as paid! ✅', 'success');
  return true;
}

/* ─────────────────────────────────────────────────────────────────────────────
   6. REJECT WITHDRAWAL
───────────────────────────────────────────────────────────────────────────── */
async function rejectWithdrawal(withdrawalId, reason = 'Unable to process') {
  const db = getClient();
  const { data: req } = await db
    .from('withdrawal_requests')
    .select('user_id, amount')
    .eq('id', withdrawalId)
    .single();

  const { error } = await db
    .from('withdrawal_requests')
    .update({ status: 'rejected', rejection_reason: reason, rejected_at: new Date().toISOString() })
    .eq('id', withdrawalId);

  if (error) { console.error('[rejectWithdrawal]', error); showToast('Failed to reject withdrawal', 'error'); return false; }

  // Refund winning wallet
  if (req) {
    const { data: wallet } = await db.from('wallets').select('id, winning_balance').eq('user_id', req.user_id).single();
    if (wallet) {
      await db.from('wallets').update({ winning_balance: (wallet.winning_balance || 0) + Number(req.amount) }).eq('id', wallet.id);
    }
    await db.from('notifications').insert({
      user_id: req.user_id, title: '❌ Withdrawal Rejected',
      body: `Your withdrawal of ₹${req.amount} was rejected. Reason: ${reason}. The amount has been refunded to your winning wallet.`,
      type: 'payment', read: false, created_at: new Date().toISOString(),
    }).catch(() => {});
  }

  showToast('Withdrawal rejected & amount refunded.', 'warning');
  return true;
}

/* ─────────────────────────────────────────────────────────────────────────────
   7. UPLOAD QR CODE (Cloudinary)
───────────────────────────────────────────────────────────────────────────── */
async function uploadQRCode(file) {
  if (!file) { showToast('No file selected', 'warning'); return null; }
  if (!file.type.startsWith('image/')) { showToast('Please select an image file', 'error'); return null; }

  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', GENBCONFIG.cloudinary.uploadPreset);
  formData.append('folder', 'genb/qr_codes');

  try {
    const res = await fetch(
      `https://api.cloudinary.com/v1_1/${GENBCONFIG.cloudinary.cloudName}/image/upload`,
      { method: 'POST', body: formData }
    );

    if (!res.ok) throw new Error(`Cloudinary error: ${res.status}`);
    const data = await res.json();
    const url = data.secure_url;

    // Save to admin_settings
    const db = getClient();
    const { error } = await db
      .from('admin_settings')
      .upsert({ key: 'payment_qr_code', value: url, updated_at: new Date().toISOString() }, { onConflict: 'key' });

    if (error) { console.error('[uploadQRCode] settings save', error); showToast('QR uploaded but settings save failed', 'warning'); return url; }

    showToast('QR code uploaded & updated! ✅', 'success');
    return url;
  } catch (err) {
    console.error('[uploadQRCode]', err);
    showToast('QR upload failed: ' + err.message, 'error');
    return null;
  }
}

/* ─────────────────────────────────────────────────────────────────────────────
   8. GET CURRENT QR CODE
───────────────────────────────────────────────────────────────────────────── */
async function getCurrentQRCode() {
  const db = getClient();
  const { data, error } = await db
    .from('admin_settings')
    .select('value')
    .eq('key', 'payment_qr_code')
    .single();

  if (error || !data) return null;
  return data.value;
}

/* ─────────────────────────────────────────────────────────────────────────────
   9. VERIFY UTR (duplicate check)
   Returns true if UTR is already used (duplicate), false if fresh.
   excludePaymentId: skip comparing against the payment being approved
───────────────────────────────────────────────────────────────────────────── */
async function verifyUTR(utr, excludePaymentId = null) {
  if (!utr || utr.trim().length < 4) return false;

  const db = getClient();
  let query = db
    .from('payments')
    .select('id')
    .eq('utr_number', utr.trim())
    .eq('status', 'approved');

  if (excludePaymentId) query = query.neq('id', excludePaymentId);

  const { data, error } = await query;
  if (error) { console.error('[verifyUTR]', error); return false; }
  return data && data.length > 0;
}

/* ─────────────────────────────────────────────────────────────────────────────
   10. RENDER DEPOSITS TABLE
───────────────────────────────────────────────────────────────────────────── */
function renderDepositsTable(payments) {
  const tbody = document.getElementById('deposits-tbody');
  if (!tbody) return;

  if (!payments || payments.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="py-12 text-center">
          <div class="flex flex-col items-center opacity-50">
            <span style="font-size:3rem;">💰</span>
            <p class="mt-2 text-sm text-gray-400 font-inter">No pending deposits</p>
          </div>
        </td>
      </tr>`;
    return;
  }

  tbody.innerHTML = payments.map(p => `
    <tr class="border-b border-white border-opacity-5 hover:bg-white hover:bg-opacity-5 transition-colors">
      <td class="px-4 py-3">
        <div class="flex items-center gap-2">
          <img src="${p.profiles?.avatar_url || '/assets/img/default-avatar.png'}"
               onerror="this.src='/assets/img/default-avatar.png'"
               class="w-8 h-8 rounded-full object-cover">
          <div>
            <p class="text-sm font-semibold text-white">${p.profiles?.username || 'Unknown'}</p>
            <p class="text-xs text-gray-400">${p.profiles?.phone || '—'}</p>
          </div>
        </div>
      </td>
      <td class="px-4 py-3 text-sm font-semibold" style="color:#00ff88;">₹${p.amount?.toLocaleString('en-IN')}</td>
      <td class="px-4 py-3">
        <code class="text-xs px-2 py-1 rounded font-mono" style="background:rgba(255,255,255,0.06);color:#00d4ff;">${p.utr_number || '—'}</code>
      </td>
      <td class="px-4 py-3 text-xs text-gray-400">${formatTime(p.created_at)}</td>
      <td class="px-4 py-3">
        ${p.screenshot_url
          ? `<a href="${p.screenshot_url}" target="_blank" rel="noopener"
                class="text-xs underline" style="color:#b14aed;">View Screenshot 🖼️</a>`
          : `<span class="text-xs text-gray-500">No screenshot</span>`}
      </td>
      <td class="px-4 py-3">
        <div class="flex gap-2">
          <button onclick="handleApproveDeposit('${p.id}','${p.user_id}',${p.amount})"
                  class="px-3 py-1.5 rounded text-xs font-semibold transition-all"
                  style="background:rgba(0,255,136,0.2);color:#00ff88;border:1px solid rgba(0,255,136,0.4);"
                  title="Approve">✅ Approve</button>
          <button onclick="handleRejectDeposit('${p.id}')"
                  class="px-3 py-1.5 rounded text-xs font-semibold transition-all"
                  style="background:rgba(255,45,120,0.2);color:#ff2d78;border:1px solid rgba(255,45,120,0.4);"
                  title="Reject">❌ Reject</button>
        </div>
      </td>
    </tr>`).join('');
}

/* ─────────────────────────────────────────────────────────────────────────────
   11. RENDER WITHDRAWALS TABLE
───────────────────────────────────────────────────────────────────────────── */
function renderWithdrawalsTable(withdrawals) {
  const tbody = document.getElementById('withdrawals-tbody');
  if (!tbody) return;

  if (!withdrawals || withdrawals.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="py-12 text-center">
          <div class="flex flex-col items-center opacity-50">
            <span style="font-size:3rem;">💸</span>
            <p class="mt-2 text-sm text-gray-400 font-inter">No pending withdrawals</p>
          </div>
        </td>
      </tr>`;
    return;
  }

  tbody.innerHTML = withdrawals.map(w => `
    <tr class="border-b border-white border-opacity-5 hover:bg-white hover:bg-opacity-5 transition-colors">
      <td class="px-4 py-3">
        <div class="flex items-center gap-2">
          <img src="${w.profiles?.avatar_url || '/assets/img/default-avatar.png'}"
               onerror="this.src='/assets/img/default-avatar.png'"
               class="w-8 h-8 rounded-full object-cover">
          <div>
            <p class="text-sm font-semibold text-white">${w.profiles?.username || 'Unknown'}</p>
            <p class="text-xs text-gray-400">${w.profiles?.phone || '—'}</p>
          </div>
        </div>
      </td>
      <td class="px-4 py-3 text-sm font-semibold" style="color:#ffd700;">₹${w.amount?.toLocaleString('en-IN')}</td>
      <td class="px-4 py-3">
        <div>
          <p class="text-sm text-white font-mono">${w.upi_id || '—'}</p>
          <p class="text-xs text-gray-400">${w.account_name || ''}</p>
        </div>
      </td>
      <td class="px-4 py-3 text-xs text-gray-400">${formatTime(w.created_at)}</td>
      <td class="px-4 py-3">
        <span class="px-2 py-0.5 rounded-full text-xs" style="background:rgba(255,215,0,0.15);color:#ffd700;">Pending</span>
      </td>
      <td class="px-4 py-3">
        <div class="flex gap-2">
          <button onclick="handleApproveWithdrawal('${w.id}','${w.upi_id}',${w.amount})"
                  class="px-3 py-1.5 rounded text-xs font-semibold transition-all"
                  style="background:rgba(0,255,136,0.2);color:#00ff88;border:1px solid rgba(0,255,136,0.4);"
                  title="Mark as Paid">✅ Paid</button>
          <button onclick="handleRejectWithdrawal('${w.id}')"
                  class="px-3 py-1.5 rounded text-xs font-semibold transition-all"
                  style="background:rgba(255,45,120,0.2);color:#ff2d78;border:1px solid rgba(255,45,120,0.4);"
                  title="Reject">❌ Reject</button>
        </div>
      </td>
    </tr>`).join('');
}

/* ─────────────────────────────────────────────────────────────────────────────
   ACTION HANDLERS (called from inline onclick)
───────────────────────────────────────────────────────────────────────────── */
async function handleApproveDeposit(paymentId, userId, amount) {
  const ok = await approveDeposit(paymentId, userId, amount);
  if (ok) await reloadPayments();
}

async function handleRejectDeposit(paymentId) {
  const reason = window.prompt('Reason for rejection:', 'Invalid UTR — payment not received');
  if (reason === null) return;
  const ok = await rejectDeposit(paymentId, reason || 'Rejected by admin');
  if (ok) await reloadPayments();
}

async function handleApproveWithdrawal(id, upiId, amount) {
  const ok = await approveWithdrawal(id, upiId, amount);
  if (ok) await reloadPayments();
}

async function handleRejectWithdrawal(id) {
  const reason = window.prompt('Reason for rejection:', 'Unable to process');
  if (reason === null) return;
  const ok = await rejectWithdrawal(id, reason || 'Rejected by admin');
  if (ok) await reloadPayments();
}

async function reloadPayments() {
  const [deposits, withdrawals] = await Promise.all([getPendingDeposits(), getPendingWithdrawals()]);
  renderDepositsTable(deposits);
  renderWithdrawalsTable(withdrawals);
  updateBadgeCounts(deposits.length, withdrawals.length);
}

function updateBadgeCounts(depositsCount, withdrawalsCount) {
  const el1 = document.getElementById('pending-deposits-count');
  const el2 = document.getElementById('pending-withdrawals-count');
  if (el1) el1.textContent = depositsCount;
  if (el2) el2.textContent = withdrawalsCount;
}

/* ─────────────────────────────────────────────────────────────────────────────
   12. INIT PAYMENTS ADMIN
───────────────────────────────────────────────────────────────────────────── */
async function initPaymentsAdmin() {
  const ok = await requireAdmin();
  if (!ok) return;

  // Load current QR code
  const qrUrl = await getCurrentQRCode();
  const qrPreview = document.getElementById('qr-preview');
  const qrPlaceholder = document.getElementById('qr-placeholder');
  if (qrUrl && qrPreview) {
    qrPreview.src = qrUrl;
    qrPreview.classList.remove('hidden');
    if (qrPlaceholder) qrPlaceholder.classList.add('hidden');
  }

  // Load all pending items
  await reloadPayments();

  // QR Upload
  const qrInput  = document.getElementById('qr-file-input');
  const qrButton = document.getElementById('upload-qr-btn');

  if (qrButton) {
    qrButton.addEventListener('click', () => qrInput?.click());
  }

  if (qrInput) {
    qrInput.addEventListener('change', async e => {
      const file = e.target.files[0];
      if (!file) return;
      setLoading('upload-qr-btn', true, 'Uploading...');
      const url = await uploadQRCode(file);
      setLoading('upload-qr-btn', false);
      if (url && qrPreview) {
        qrPreview.src = url;
        qrPreview.classList.remove('hidden');
        if (qrPlaceholder) qrPlaceholder.classList.add('hidden');
      }
    });
  }

  // UTR verification widget
  const utrInput = document.getElementById('utr-verify-input');
  const utrBtn   = document.getElementById('utr-verify-btn');
  const utrResult = document.getElementById('utr-verify-result');

  if (utrBtn) {
    utrBtn.addEventListener('click', async () => {
      const utr = utrInput?.value.trim();
      if (!utr) { showToast('Enter a UTR number first', 'warning'); return; }
      const isDupe = await verifyUTR(utr);
      if (utrResult) {
        utrResult.textContent = isDupe ? '⚠️ DUPLICATE — this UTR is already approved!' : '✅ Fresh UTR — not previously used';
        utrResult.style.color = isDupe ? '#ff2d78' : '#00ff88';
        utrResult.classList.remove('hidden');
      }
    });
  }

  // Tab switcher
  document.querySelectorAll('[data-tab]').forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;
      document.querySelectorAll('[data-tab-panel]').forEach(panel => {
        panel.classList.toggle('hidden', panel.dataset.tabPanel !== tab);
      });
      document.querySelectorAll('[data-tab]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });

  // Refresh button
  document.getElementById('refresh-payments-btn')?.addEventListener('click', reloadPayments);

  // Real-time subscription
  const db = getClient();
  db.channel('admin-payments')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'payments' }, async () => {
      await reloadPayments();
      showToast('New deposit submission! 💰', 'info');
    })
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'withdrawal_requests' }, async () => {
      await reloadPayments();
      showToast('New withdrawal request! 💸', 'info');
    })
    .subscribe();
}

/* ─────────────────────────────────────────────────────────────────────────────
   AUTO-INIT
───────────────────────────────────────────────────────────────────────────── */
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initPaymentsAdmin);
} else {
  initPaymentsAdmin();
}
