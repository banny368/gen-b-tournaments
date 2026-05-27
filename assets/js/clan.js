/**
 * @file clan.js
 * @description Gen B Tournaments — Clan System Module
 * Handles clan creation, joining, leaving, leaderboard, and member management.
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
   HELPERS
   ───────────────────────────────────────────────────────────────────────────── */

/** Generate a random 6-char clan join code */
function _generateClanCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

/* ─────────────────────────────────────────────────────────────────────────────
   DATA FUNCTIONS
   ───────────────────────────────────────────────────────────────────────────── */

/**
 * Create a new clan.
 * @param {string} userId
 * @param {string} name
 * @param {string} tag   2-5 char tag e.g. "GENB"
 * @param {string} description
 * @returns {Promise<{success: boolean, clan: Object|null}>}
 */
async function createClan(userId, name, tag, description) {
  try {
    if (!name?.trim() || name.trim().length < 3) {
      showToast('Clan name must be at least 3 characters.', 'error');
      return { success: false, clan: null };
    }

    const sanitizedTag = tag?.trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5);
    if (!sanitizedTag || sanitizedTag.length < 2) {
      showToast('Clan tag must be 2-5 alphanumeric characters.', 'error');
      return { success: false, clan: null };
    }

    // Check user not already in a clan
    const { data: existingMember } = await _sb()
      .from('clan_members')
      .select('clan_id')
      .eq('user_id', userId)
      .maybeSingle();

    if (existingMember) {
      showToast('You must leave your current clan before creating a new one.', 'error');
      return { success: false, clan: null };
    }

    // Check name uniqueness
    const { count: nameCount } = await _sb()
      .from('clans')
      .select('id', { count: 'exact', head: true })
      .ilike('name', name.trim());

    if ((nameCount || 0) > 0) {
      showToast('Clan name is already taken.', 'error');
      return { success: false, clan: null };
    }

    const joinCode = _generateClanCode();

    const { data: clan, error } = await _sb()
      .from('clans')
      .insert({
        name: name.trim(),
        tag: sanitizedTag,
        description: description?.trim() || '',
        leader_id: userId,
        join_code: joinCode,
        total_wins: 0,
        member_count: 1,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw error;

    // Add creator as leader member
    await _sb().from('clan_members').insert({
      clan_id: clan.id,
      user_id: userId,
      role: 'leader',
      joined_at: new Date().toISOString(),
    });

    // Update user's clan_id
    await _sb().from('users').update({ clan_id: clan.id }).eq('id', userId);

    showToast(`Clan [${sanitizedTag}] ${name} created! 🏴`, 'success');
    return { success: true, clan };
  } catch (err) {
    console.error('[createClan]', err);
    showToast(err.message || 'Failed to create clan.', 'error');
    return { success: false, clan: null };
  }
}

/**
 * Join a clan using its join code.
 * @param {string} userId
 * @param {string} clanCode
 * @returns {Promise<boolean>}
 */
async function joinClan(userId, clanCode) {
  try {
    // Check user not already in a clan
    const { data: existingMember } = await _sb()
      .from('clan_members')
      .select('clan_id')
      .eq('user_id', userId)
      .maybeSingle();

    if (existingMember) {
      showToast('You are already in a clan. Leave first to join another.', 'error');
      return false;
    }

    const { data: clan, error: clanError } = await _sb()
      .from('clans')
      .select('id, name, tag, member_count, max_members')
      .eq('join_code', clanCode.trim().toUpperCase())
      .maybeSingle();

    if (clanError) throw clanError;
    if (!clan) {
      showToast('Invalid clan code. Please check and try again.', 'error');
      return false;
    }

    const maxMembers = clan.max_members || 30;
    if ((clan.member_count || 0) >= maxMembers) {
      showToast('This clan is full.', 'error');
      return false;
    }

    await _sb().from('clan_members').insert({
      clan_id: clan.id,
      user_id: userId,
      role: 'member',
      joined_at: new Date().toISOString(),
    });

    await _sb().from('clans').update({ member_count: (clan.member_count || 0) + 1 }).eq('id', clan.id);
    await _sb().from('users').update({ clan_id: clan.id }).eq('id', userId);

    showToast(`Joined clan [${clan.tag}] ${clan.name}! ⚔️`, 'success');
    return true;
  } catch (err) {
    console.error('[joinClan]', err);
    showToast(err.message || 'Failed to join clan.', 'error');
    return false;
  }
}

/**
 * Leave a clan.
 * @param {string} userId
 * @param {string} clanId
 * @returns {Promise<boolean>}
 */
async function leaveClan(userId, clanId) {
  try {
    const { data: member } = await _sb()
      .from('clan_members')
      .select('role')
      .eq('user_id', userId)
      .eq('clan_id', clanId)
      .maybeSingle();

    if (!member) { showToast('You are not in this clan.', 'error'); return false; }

    if (member.role === 'leader') {
      // Check if there are other members to transfer leadership
      const { count } = await _sb()
        .from('clan_members')
        .select('id', { count: 'exact', head: true })
        .eq('clan_id', clanId)
        .neq('user_id', userId);

      if ((count || 0) > 0) {
        showToast('Transfer leadership before leaving the clan.', 'error');
        return false;
      }

      // No other members — delete the clan
      await _sb().from('clans').delete().eq('id', clanId);
    }

    await _sb().from('clan_members').delete().eq('user_id', userId).eq('clan_id', clanId);

    const { data: clan } = await _sb().from('clans').select('member_count').eq('id', clanId).maybeSingle();
    if (clan) {
      await _sb().from('clans').update({ member_count: Math.max(0, (clan.member_count || 1) - 1) }).eq('id', clanId);
    }

    await _sb().from('users').update({ clan_id: null }).eq('id', userId);

    showToast('You have left the clan.', 'success');
    return true;
  } catch (err) {
    console.error('[leaveClan]', err);
    showToast(err.message || 'Failed to leave clan.', 'error');
    return false;
  }
}

/**
 * Get full clan details including member count and leader info.
 * @param {string} clanId
 * @returns {Promise<Object|null>}
 */
async function getClanDetails(clanId) {
  try {
    const { data, error } = await _sb()
      .from('clans')
      .select('*, users:leader_id(username, avatar_url)')
      .eq('id', clanId)
      .single();

    if (error) throw error;
    return data;
  } catch (err) {
    console.error('[getClanDetails]', err);
    return null;
  }
}

/**
 * Fetch clan leaderboard (top clans by wins).
 * @param {number} [limit=20]
 * @returns {Promise<Array>}
 */
async function getClanLeaderboard(limit = 20) {
  try {
    const { data, error } = await _sb()
      .from('clans')
      .select('id, name, tag, total_wins, member_count, banner_url')
      .order('total_wins', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error('[getClanLeaderboard]', err);
    return [];
  }
}

/**
 * Get all members of a clan.
 * @param {string} clanId
 * @returns {Promise<Array>}
 */
async function getClanMembers(clanId) {
  try {
    const { data, error } = await _sb()
      .from('clan_members')
      .select('role, joined_at, users:user_id(id, username, avatar_url, xp, total_wins)')
      .eq('clan_id', clanId)
      .order('role', { ascending: true });

    if (error) throw error;
    return (data || []).map(m => ({
      ...m.users,
      role: m.role,
      joinedAt: m.joined_at,
    }));
  } catch (err) {
    console.error('[getClanMembers]', err);
    return [];
  }
}

/* ─────────────────────────────────────────────────────────────────────────────
   RENDER FUNCTIONS
   ───────────────────────────────────────────────────────────────────────────── */

/**
 * Returns HTML for a clan card.
 * @param {Object} clan
 * @param {number} [rank]
 * @returns {string}
 */
function renderClanCard(clan, rank) {
  const rankBadge = rank ? `<span class="absolute top-3 left-3 text-xs font-bold px-2 py-0.5 rounded-full bg-black/60 backdrop-blur-sm text-[#ffd700] border border-[#ffd700]/30">#${rank}</span>` : '';

  return `
<div class="relative overflow-hidden rounded-2xl border border-white/10 bg-[#0a0a1a] hover:border-[#b14aed]/40
            transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_0_25px_rgba(177,74,237,0.2)] cursor-pointer"
     data-clan-id="${clan.id}"
     onclick="window.location.href='/clan-detail.html?id=${clan.id}'">

  <!-- Banner / gradient header -->
  <div class="h-20 relative overflow-hidden">
    ${clan.banner_url
      ? `<img src="${clan.banner_url}" class="w-full h-full object-cover">`
      : `<div class="w-full h-full" style="background:linear-gradient(135deg,#b14aed22,#00d4ff11);"></div>`
    }
    ${rankBadge}
    <!-- Tag badge -->
    <span class="absolute top-3 right-3 text-xs font-bold px-2 py-0.5 rounded-full bg-[#b14aed]/30 text-[#b14aed] border border-[#b14aed]/30">[${clan.tag}]</span>
  </div>

  <div class="p-4">
    <h3 class="font-rajdhani font-bold text-lg text-white mb-1">${clan.name}</h3>

    <div class="flex items-center justify-between text-sm">
      <div class="flex items-center gap-1.5 text-gray-400">
        <i data-lucide="users" class="w-3.5 h-3.5"></i>
        <span>${clan.member_count || 0} members</span>
      </div>
      <div class="flex items-center gap-1.5 text-[#ffd700]">
        <i data-lucide="trophy" class="w-3.5 h-3.5"></i>
        <span>${clan.total_wins || 0} wins</span>
      </div>
    </div>
  </div>
</div>`.trim();
}

/* ─────────────────────────────────────────────────────────────────────────────
   PAGE INIT
   ───────────────────────────────────────────────────────────────────────────── */

/**
 * Initialise the clan page.
 */
async function initClanPage() {
  const { data: { user } } = await _sb().auth.getUser();
  if (!user) { window.location.href = '/auth.html'; return; }

  const userId = user.id;

  // Fetch user's clan membership
  const { data: memberData } = await _sb()
    .from('clan_members')
    .select('clan_id, role')
    .eq('user_id', userId)
    .maybeSingle();

  const myClanId = memberData?.clan_id || null;
  const myRole = memberData?.role || null;

  // Show correct panel (my clan vs browse)
  const myClanPanel = document.getElementById('my-clan-panel');
  const noClanPanel = document.getElementById('no-clan-panel');

  if (myClanId) {
    myClanPanel?.classList.remove('hidden');
    noClanPanel?.classList.add('hidden');

    // Load clan details
    const clan = await getClanDetails(myClanId);
    if (clan) {
      const nameEl = document.getElementById('clan-name');
      const tagEl = document.getElementById('clan-tag');
      const codeEl = document.getElementById('clan-join-code');
      const leaderEl = document.getElementById('clan-leader');
      const winsEl = document.getElementById('clan-wins');
      const membersCountEl = document.getElementById('clan-member-count');

      if (nameEl) nameEl.textContent = clan.name;
      if (tagEl) tagEl.textContent = `[${clan.tag}]`;
      if (codeEl) codeEl.textContent = clan.join_code;
      if (leaderEl) leaderEl.textContent = clan.users?.username || '--';
      if (winsEl) winsEl.textContent = clan.total_wins || 0;
      if (membersCountEl) membersCountEl.textContent = clan.member_count || 0;

      // Copy join code
      const copyCodeBtn = document.getElementById('copy-clan-code');
      if (copyCodeBtn) {
        copyCodeBtn.addEventListener('click', () => {
          navigator.clipboard.writeText(clan.join_code).then(() => showToast('Clan code copied! 📋', 'success'));
        });
      }
    }

    // Load members list
    const membersEl = document.getElementById('clan-members-list');
    if (membersEl) {
      const members = await getClanMembers(myClanId);
      membersEl.innerHTML = members.map(m => {
        const avatar = m.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${m.id}`;
        return `
          <div class="flex items-center gap-3 p-3 rounded-xl border border-white/5 bg-[#0a0a1a]">
            <img src="${avatar}" alt="${m.username}" class="w-10 h-10 rounded-full border border-white/10"
                 onerror="this.src='https://api.dicebear.com/7.x/bottts/svg?seed=${m.id}'">
            <div class="flex-1">
              <p class="text-sm font-semibold text-white">${m.username || 'Player'}</p>
              <p class="text-xs text-gray-500">${m.role === 'leader' ? '👑 Leader' : m.role === 'co-leader' ? '⭐ Co-Leader' : 'Member'}</p>
            </div>
            <div class="text-right">
              <p class="text-xs font-bold text-white">${m.total_wins || 0}</p>
              <p class="text-[10px] text-gray-500">wins</p>
            </div>
          </div>`;
      }).join('');
      lucide.createIcons();
    }

    // Leave clan button
    const leaveBtn = document.getElementById('leave-clan-btn');
    if (leaveBtn) {
      leaveBtn.addEventListener('click', async () => {
        if (!confirm('Are you sure you want to leave this clan?')) return;
        const ok = await leaveClan(userId, myClanId);
        if (ok) window.location.reload();
      });
    }
  } else {
    myClanPanel?.classList.add('hidden');
    noClanPanel?.classList.remove('hidden');
  }

  // Load clan leaderboard
  const clanLeaderboardEl = document.getElementById('clan-leaderboard');
  if (clanLeaderboardEl) {
    const clans = await getClanLeaderboard(20);
    if (clans.length === 0) {
      clanLeaderboardEl.innerHTML = `<p class="text-center text-gray-500 py-8">No clans yet. Be the first!</p>`;
    } else {
      clanLeaderboardEl.innerHTML = clans.map((c, i) => renderClanCard(c, i + 1)).join('');
      lucide.createIcons();
    }
  }

  // Create clan form
  const createForm = document.getElementById('create-clan-form');
  if (createForm) {
    createForm.addEventListener('submit', async e => {
      e.preventDefault();
      const btn = createForm.querySelector('[type="submit"]');
      const orig = btn.textContent;
      btn.disabled = true;
      btn.textContent = 'Creating...';

      const name = document.getElementById('clan-name-input')?.value;
      const tag = document.getElementById('clan-tag-input')?.value;
      const desc = document.getElementById('clan-desc-input')?.value;

      const { success } = await createClan(userId, name, tag, desc);
      if (success) window.location.reload();

      btn.disabled = false;
      btn.textContent = orig;
    });
  }

  // Join clan form
  const joinForm = document.getElementById('join-clan-form');
  if (joinForm) {
    joinForm.addEventListener('submit', async e => {
      e.preventDefault();
      const btn = joinForm.querySelector('[type="submit"]');
      const orig = btn.textContent;
      btn.disabled = true;
      btn.textContent = 'Joining...';

      const code = document.getElementById('clan-code-input')?.value;
      const ok = await joinClan(userId, code);
      if (ok) window.location.reload();

      btn.disabled = false;
      btn.textContent = orig;
    });
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initClanPage);
} else {
  initClanPage();
}
