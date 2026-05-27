/**
 * @file referral.js
 * @description Gen B Tournaments — Referral System Module
 * Handles referral code generation, tracking, sharing, and crediting referrers.
 * Depends on: config.js, supabase.js, utils.js
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
   DATA FUNCTIONS
   ───────────────────────────────────────────────────────────────────────────── */

/**
 * Fetch referral data for a user (code, count, earnings).
 * @param {string} userId
 * @returns {Promise<{code: string, count: number, earnings: number}>}
 */
async function getReferralData(userId) {
  try {
    const { data, error } = await _sb()
      .from('users')
      .select('referral_code, referral_count, referral_earnings')
      .eq('id', userId)
      .single();

    if (error) throw error;

    // Auto-generate code if missing
    if (!data?.referral_code) {
      const code = 'GENB' + userId.slice(0, 6).toUpperCase();
      await _sb().from('users').update({ referral_code: code }).eq('id', userId);
      return { code, count: 0, earnings: 0 };
    }

    return {
      code: data.referral_code,
      count: data.referral_count || 0,
      earnings: data.referral_earnings || 0,
    };
  } catch (err) {
    console.error('[getReferralData]', err);
    return { code: '', count: 0, earnings: 0 };
  }
}

/**
 * Get list of users referred by a user.
 * @param {string} userId
 * @returns {Promise<Array>}
 */
async function getReferredUsers(userId) {
  try {
    const { data, error } = await _sb()
      .from('referrals')
      .select('referred_user_id, created_at, bonus_paid, users:referred_user_id(username, avatar_url)')
      .eq('referrer_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data || []).map(r => ({
      userId: r.referred_user_id,
      username: r.users?.username || 'Player',
      avatar: r.users?.avatar_url || null,
      joinedAt: r.created_at,
      bonusPaid: r.bonus_paid || false,
    }));
  } catch (err) {
    console.error('[getReferredUsers]', err);
    return [];
  }
}

/**
 * Process a referral — credit referrer's wallet and update counts.
 * Should be called when a new user signs up with a referral code.
 * @param {string} referralCode
 * @param {string} newUserId
 * @returns {Promise<boolean>}
 */
async function processReferral(referralCode, newUserId) {
  try {
    if (!referralCode || !newUserId) return false;

    // Find referrer
    const { data: referrer, error: refError } = await _sb()
      .from('users')
      .select('id, referral_code, referral_count, referral_earnings')
      .eq('referral_code', referralCode.toUpperCase())
      .neq('id', newUserId)
      .maybeSingle();

    if (refError) throw refError;
    if (!referrer) {
      showToast('Invalid referral code.', 'error');
      return false;
    }

    // Check not already referred
    const { count } = await _sb()
      .from('referrals')
      .select('id', { count: 'exact', head: true })
      .eq('referrer_id', referrer.id)
      .eq('referred_user_id', newUserId);

    if ((count || 0) > 0) return false;

    const bonus = GENBCONFIG.wallet.referralBonus;

    // Credit referrer's bonus wallet
    const { data: walletData } = await _sb()
      .from('wallets')
      .select('bonus_balance')
      .eq('user_id', referrer.id)
      .single();

    await _sb()
      .from('wallets')
      .update({ bonus_balance: (walletData?.bonus_balance || 0) + bonus })
      .eq('user_id', referrer.id);

    // Update referral stats
    await _sb()
      .from('users')
      .update({
        referral_count: (referrer.referral_count || 0) + 1,
        referral_earnings: (referrer.referral_earnings || 0) + bonus,
      })
      .eq('id', referrer.id);

    // Create referral record
    await _sb().from('referrals').insert({
      referrer_id: referrer.id,
      referred_user_id: newUserId,
      bonus_paid: true,
      bonus_amount: bonus,
      created_at: new Date().toISOString(),
    });

    // Transaction log
    await _sb().from('transactions').insert({
      user_id: referrer.id,
      type: 'referral',
      amount: bonus,
      description: `Referral bonus for inviting a new player`,
    });

    // Also store referral code on new user's profile
    await _sb().from('users').update({ referred_by: referrer.id }).eq('id', newUserId);

    return true;
  } catch (err) {
    console.error('[processReferral]', err);
    return false;
  }
}

/**
 * Share referral link via a platform.
 * @param {'whatsapp'|'telegram'|'copy'} platform
 * @param {string} referralCode
 */
function shareReferral(platform, referralCode) {
  const appUrl = window.location.origin;
  const shareUrl = `${appUrl}/auth.html?ref=${referralCode}`;
  const message = `🎮 Join me on Gen B Tournaments and win real cash!\nUse my code *${referralCode}* to get a bonus on signup.\n👉 ${shareUrl}`;

  switch (platform) {
    case 'whatsapp':
      window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank');
      break;
    case 'telegram':
      window.open(`https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(message)}`, '_blank');
      break;
    case 'copy':
      navigator.clipboard.writeText(shareUrl).then(() => {
        showToast('Referral link copied! 📋', 'success');
      });
      break;
    default:
      if (navigator.share) {
        navigator.share({ title: 'Gen B Tournaments', text: message, url: shareUrl }).catch(() => {});
      }
  }
}

/* ─────────────────────────────────────────────────────────────────────────────
   PAGE INIT
   ───────────────────────────────────────────────────────────────────────────── */

/**
 * Render and initialise the referral page.
 * @param {string} userId
 */
async function renderReferralPage(userId) {
  const { code, count, earnings } = await getReferralData(userId);
  const referred = await getReferredUsers(userId);

  // Display code
  const codeEl = document.getElementById('referral-code');
  if (codeEl) codeEl.textContent = code;

  // Stats
  const countEl = document.getElementById('referral-count');
  if (countEl) countEl.textContent = count;

  const earningsEl = document.getElementById('referral-earnings');
  if (earningsEl) earningsEl.textContent = `${GENBCONFIG.app.currency}${earnings.toFixed(2)}`;

  const bonusPerEl = document.getElementById('referral-bonus-per');
  if (bonusPerEl) bonusPerEl.textContent = `${GENBCONFIG.app.currency}${GENBCONFIG.wallet.referralBonus}`;

  // Potential earnings
  const potentialEl = document.getElementById('referral-potential');
  if (potentialEl) potentialEl.textContent = `${GENBCONFIG.app.currency}${(10 * GENBCONFIG.wallet.referralBonus).toFixed(0)}`;

  // Share link display
  const shareLinkEl = document.getElementById('referral-link');
  if (shareLinkEl) shareLinkEl.value = `${window.location.origin}/auth.html?ref=${code}`;

  // Share buttons
  document.querySelectorAll('[data-share]').forEach(btn => {
    btn.addEventListener('click', () => shareReferral(btn.dataset.share, code));
  });

  // Copy code button
  const copyCodeBtn = document.getElementById('copy-referral-code');
  if (copyCodeBtn) {
    copyCodeBtn.addEventListener('click', () => {
      navigator.clipboard.writeText(code).then(() => showToast('Referral code copied! 🎉', 'success'));
    });
  }

  // Copy link button
  const copyLinkBtn = document.getElementById('copy-referral-link');
  if (copyLinkBtn) {
    copyLinkBtn.addEventListener('click', () => shareReferral('copy', code));
  }

  // Referred users list
  const listEl = document.getElementById('referred-users-list');
  if (listEl) {
    if (referred.length === 0) {
      listEl.innerHTML = `
        <div class="text-center py-10 text-gray-500">
          <i data-lucide="users" class="w-10 h-10 mx-auto mb-2 opacity-30"></i>
          <p class="text-sm">No referrals yet.</p>
          <p class="text-xs mt-1 text-gray-600">Share your code and earn ${GENBCONFIG.app.currency}${GENBCONFIG.wallet.referralBonus} per signup!</p>
        </div>`;
    } else {
      listEl.innerHTML = referred.map(r => {
        const avatar = r.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${r.userId}`;
        const date = r.joinedAt ? new Date(r.joinedAt).toLocaleDateString('en-IN') : '';
        return `
          <div class="flex items-center gap-3 p-3 rounded-xl border border-white/5 bg-[#0a0a1a]">
            <img src="${avatar}" alt="${r.username}" class="w-10 h-10 rounded-full object-cover border border-white/10"
                 onerror="this.src='https://api.dicebear.com/7.x/bottts/svg?seed=${r.userId}'">
            <div class="flex-1">
              <p class="text-sm font-semibold text-white">${r.username}</p>
              <p class="text-xs text-gray-500">Joined ${date}</p>
            </div>
            <span class="text-xs font-bold ${r.bonusPaid ? 'text-[#00ff88]' : 'text-[#ffd700]'}">
              ${r.bonusPaid ? `+${GENBCONFIG.app.currency}${GENBCONFIG.wallet.referralBonus} ✓` : 'Pending'}
            </span>
          </div>`;
      }).join('');
    }
    lucide.createIcons();
  }
}

async function initReferralPage() {
  const { data: { user } } = await _sb().auth.getUser();
  if (!user) { window.location.href = '/auth.html'; return; }
  await renderReferralPage(user.id);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initReferralPage);
} else {
  initReferralPage();
}
