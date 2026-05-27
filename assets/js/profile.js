/**
 * @file profile.js
 * @description Gen B Tournaments — User Profile Feature Module
 * Handles profile display, stats, badges, match history, avatar upload.
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
 * Fetch a user's full profile with stats.
 * @param {string} userId
 * @returns {Promise<Object|null>}
 */
async function getUserProfile(userId) {
  try {
    const { data, error } = await _sb()
      .from('users')
      .select('*, wallets(main_balance, bonus_balance, winning_balance)')
      .eq('id', userId)
      .single();

    if (error) throw error;
    return data;
  } catch (err) {
    console.error('[getUserProfile]', err);
    return null;
  }
}

/**
 * Update user profile fields.
 * @param {string} userId
 * @param {{ username?: string, bio?: string, game_uid?: string, game?: string }} data
 * @returns {Promise<boolean>}
 */
async function updateProfile(userId, data) {
  try {
    if (data.username) {
      // Uniqueness check
      const { count } = await _sb()
        .from('users')
        .select('id', { count: 'exact', head: true })
        .eq('username', data.username)
        .neq('id', userId);

      if ((count || 0) > 0) {
        showToast('Username is already taken.', 'error');
        return false;
      }
    }

    const { error } = await _sb()
      .from('users')
      .update({ ...data, updated_at: new Date().toISOString() })
      .eq('id', userId);

    if (error) throw error;

    showToast('Profile updated successfully! ✅', 'success');
    return true;
  } catch (err) {
    console.error('[updateProfile]', err);
    showToast(err.message || 'Failed to update profile.', 'error');
    return false;
  }
}

/**
 * Upload avatar to Cloudinary and update profile.
 * @param {File} file
 * @param {string} userId
 * @returns {Promise<string|null>} New avatar URL or null
 */
async function uploadAvatar(file, userId) {
  try {
    if (!file.type.startsWith('image/')) {
      showToast('Please select a valid image file.', 'error');
      return null;
    }
    if (file.size > 5 * 1024 * 1024) {
      showToast('Image must be smaller than 5 MB.', 'error');
      return null;
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', GENBCONFIG.cloudinary.uploadPreset);
    formData.append('folder', 'avatars');
    formData.append('public_id', `avatar_${userId}`);
    formData.append('transformation', 'w_200,h_200,c_fill,g_face,q_auto,f_webp');

    const resp = await fetch(
      `https://api.cloudinary.com/v1_1/${GENBCONFIG.cloudinary.cloudName}/image/upload`,
      { method: 'POST', body: formData }
    );

    if (!resp.ok) throw new Error('Upload failed');
    const result = await resp.json();
    const avatarUrl = result.secure_url;

    const { error } = await _sb()
      .from('users')
      .update({ avatar_url: avatarUrl })
      .eq('id', userId);

    if (error) throw error;

    showToast('Avatar updated! 🎮', 'success');
    return avatarUrl;
  } catch (err) {
    console.error('[uploadAvatar]', err);
    showToast('Failed to upload avatar.', 'error');
    return null;
  }
}

/**
 * Fetch paginated match history for a user.
 * @param {string} userId
 * @param {number} [limit=10]
 * @param {number} [offset=0]
 * @returns {Promise<Array>}
 */
async function getMatchHistory(userId, limit = 10, offset = 0) {
  try {
    const { data, error } = await _sb()
      .from('match_results')
      .select('*, tournaments(name, game, banner_url)')
      .eq('user_id', userId)
      .order('played_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error('[getMatchHistory]', err);
    return [];
  }
}

/**
 * Compute user statistics.
 * @param {string} userId
 * @returns {Promise<{matches: number, wins: number, kills: number, kd: number, winRate: number, earnings: number}>}
 */
async function getUserStats(userId) {
  try {
    const { data, error } = await _sb()
      .from('match_results')
      .select('placement, kills, prize_won')
      .eq('user_id', userId);

    if (error) throw error;

    const matches = data?.length || 0;
    const wins = (data || []).filter(m => m.placement === 1).length;
    const kills = (data || []).reduce((sum, m) => sum + (m.kills || 0), 0);
    const deaths = matches - wins;
    const kd = deaths > 0 ? (kills / deaths).toFixed(2) : kills.toFixed(2);
    const winRate = matches > 0 ? ((wins / matches) * 100).toFixed(1) : '0.0';
    const earnings = (data || []).reduce((sum, m) => sum + (m.prize_won || 0), 0);

    return { matches, wins, kills, kd: parseFloat(kd), winRate: parseFloat(winRate), earnings };
  } catch (err) {
    console.error('[getUserStats]', err);
    return { matches: 0, wins: 0, kills: 0, kd: 0, winRate: 0, earnings: 0 };
  }
}

/**
 * Fetch user badges.
 * @param {string} userId
 * @returns {Promise<Array>}
 */
async function getUserBadges(userId) {
  try {
    const { data, error } = await _sb()
      .from('user_badges')
      .select('*, badges(*)')
      .eq('user_id', userId)
      .order('earned_at', { ascending: false });

    if (error) throw error;
    return (data || []).map(ub => ({ ...ub.badges, earned_at: ub.earned_at }));
  } catch (err) {
    console.error('[getUserBadges]', err);
    return [];
  }
}

/**
 * Fetch user achievements with progress.
 * @param {string} userId
 * @returns {Promise<Array>}
 */
async function getUserAchievements(userId) {
  try {
    const { data, error } = await _sb()
      .from('user_achievements')
      .select('*, achievements(*)')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false });

    if (error) throw error;
    return (data || []).map(ua => ({
      ...ua.achievements,
      progress: ua.progress || 0,
      completed: ua.completed || false,
      completed_at: ua.completed_at,
    }));
  } catch (err) {
    console.error('[getUserAchievements]', err);
    return [];
  }
}

/* ─────────────────────────────────────────────────────────────────────────────
   RENDER FUNCTIONS
   ───────────────────────────────────────────────────────────────────────────── */

/**
 * Returns HTML for a stat card.
 * @param {string} label
 * @param {string|number} value
 * @param {string} icon  Lucide icon name
 * @param {string} [color='#00d4ff']
 * @returns {string}
 */
function renderStatCard(label, value, icon, color = '#00d4ff') {
  return `
<div class="flex flex-col items-center justify-center p-4 rounded-2xl border border-white/5 bg-[#0a0a1a] hover:border-[${color}]/30 transition-all">
  <div class="w-10 h-10 rounded-xl flex items-center justify-center mb-2" style="background:${color}15; border:1px solid ${color}30;">
    <i data-lucide="${icon}" class="w-5 h-5" style="color:${color};"></i>
  </div>
  <span class="font-rajdhani font-bold text-2xl text-white">${value}</span>
  <span class="text-xs text-gray-500 mt-0.5">${label}</span>
</div>`.trim();
}

/**
 * Returns HTML for a badge.
 * @param {Object} badge
 * @returns {string}
 */
function renderBadge(badge) {
  return `
<div class="group relative flex flex-col items-center gap-1 cursor-pointer"
     title="${badge.name}: ${badge.description || ''}">
  <div class="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl
              border border-[#ffd700]/30 bg-[#ffd700]/10 group-hover:shadow-[0_0_20px_rgba(255,215,0,0.4)]
              transition-all duration-300">
    ${badge.icon || '🏅'}
  </div>
  <span class="text-[10px] text-gray-400 text-center line-clamp-1 w-14">${badge.name}</span>
</div>`.trim();
}

/**
 * Returns HTML for a match history row.
 * @param {Object} match
 * @returns {string}
 */
function renderMatchHistoryRow(match) {
  const game = GENBCONFIG.games.find(g => g.id === match.tournaments?.game);
  const isWin = match.placement === 1;
  const prizeStr = match.prize_won > 0
    ? `+${GENBCONFIG.app.currency}${match.prize_won}`
    : match.prize_won < 0
      ? `-${GENBCONFIG.app.currency}${Math.abs(match.prize_won)}`
      : '--';

  const placementColor = match.placement === 1 ? '#ffd700'
    : match.placement === 2 ? '#9ca3af'
    : match.placement === 3 ? '#b45309'
    : '#6b7280';

  const dateStr = match.played_at
    ? new Date(match.played_at).toLocaleDateString('en-IN', { dateStyle: 'medium' })
    : '';

  return `
<div class="flex items-center gap-3 p-3 rounded-xl border border-white/5 bg-[#0a0a1a] hover:border-[#00d4ff]/20 transition-colors">
  <!-- Placement -->
  <div class="w-10 h-10 rounded-xl flex items-center justify-center font-rajdhani font-bold text-lg flex-shrink-0"
       style="background:${placementColor}20; color:${placementColor}; border:1px solid ${placementColor}40;">
    #${match.placement || '--'}
  </div>

  <!-- Tournament Info -->
  <div class="flex-1 min-w-0">
    <p class="text-sm font-semibold text-white truncate">${match.tournaments?.name || 'Unknown Tournament'}</p>
    <div class="flex items-center gap-2 mt-0.5">
      <span class="text-xs text-gray-500">${game?.icon || ''} ${game?.name || match.tournaments?.game || ''}</span>
      <span class="text-gray-700">·</span>
      <span class="text-xs text-gray-500">${dateStr}</span>
    </div>
  </div>

  <!-- Kills -->
  <div class="text-center flex-shrink-0">
    <p class="text-sm font-bold text-white">${match.kills || 0}</p>
    <p class="text-[10px] text-gray-500">Kills</p>
  </div>

  <!-- Prize -->
  <div class="text-right flex-shrink-0">
    <p class="font-bold font-rajdhani text-sm ${match.prize_won > 0 ? 'text-[#00ff88]' : 'text-gray-500'}">${prizeStr}</p>
    <p class="text-[10px] ${isWin ? 'text-[#ffd700]' : 'text-gray-600'}">${isWin ? '🏆 WIN' : `#${match.placement}`}</p>
  </div>
</div>`.trim();
}

/* ─────────────────────────────────────────────────────────────────────────────
   PAGE RENDER & INIT
   ───────────────────────────────────────────────────────────────────────────── */

/**
 * Compute level info from XP.
 * @param {number} xp
 * @returns {{ level: Object, nextLevel: Object|null, progress: number }}
 */
function _getLevelInfo(xp = 0) {
  const levels = GENBCONFIG.levels;
  let current = levels[0];
  let next = levels[1];

  for (let i = 0; i < levels.length; i++) {
    if (xp >= levels[i].xpRequired) {
      current = levels[i];
      next = levels[i + 1] || null;
    }
  }

  const progress = next
    ? Math.min(100, Math.round(((xp - current.xpRequired) / (next.xpRequired - current.xpRequired)) * 100))
    : 100;

  return { level: current, nextLevel: next, progress };
}

/**
 * Render the full profile page for a user.
 * @param {string} userId
 */
async function renderProfilePage(userId) {
  // Show skeleton
  const mainEl = document.getElementById('profile-main');

  const [profile, stats, badges, achievements, matches] = await Promise.all([
    getUserProfile(userId),
    getUserStats(userId),
    getUserBadges(userId),
    getUserAchievements(userId),
    getMatchHistory(userId, 10),
  ]);

  if (!profile) {
    if (mainEl) mainEl.innerHTML = `<div class="text-center py-20 text-gray-400">Profile not found.</div>`;
    return;
  }

  const levelInfo = _getLevelInfo(profile.xp || 0);
  const avatarUrl = profile.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${userId}`;
  const wallet = profile.wallets || {};

  // Avatar
  const avatarImg = document.getElementById('profile-avatar');
  if (avatarImg) { avatarImg.src = avatarUrl; avatarImg.alt = profile.username; }

  // Basic info
  const usernameEl = document.getElementById('profile-username');
  if (usernameEl) usernameEl.textContent = profile.username || 'Player';

  const bioEl = document.getElementById('profile-bio');
  if (bioEl) bioEl.textContent = profile.bio || 'No bio yet.';

  const levelBadge = document.getElementById('profile-level');
  if (levelBadge) {
    levelBadge.textContent = `${levelInfo.level.title} (Lv.${levelInfo.level.level})`;
    levelBadge.style.color = levelInfo.level.color;
  }

  // XP bar
  const xpBar = document.getElementById('xp-bar');
  if (xpBar) xpBar.style.width = `${levelInfo.progress}%`;

  const xpText = document.getElementById('xp-text');
  if (xpText) {
    xpText.textContent = levelInfo.nextLevel
      ? `${profile.xp || 0} / ${levelInfo.nextLevel.xpRequired} XP`
      : `${profile.xp || 0} XP — MAX LEVEL`;
  }

  // Stats grid
  const statsGrid = document.getElementById('stats-grid');
  if (statsGrid) {
    statsGrid.innerHTML = [
      renderStatCard('Matches', stats.matches, 'gamepad-2', '#00d4ff'),
      renderStatCard('Wins', stats.wins, 'trophy', '#ffd700'),
      renderStatCard('Kills', stats.kills, 'target', '#ff2d78'),
      renderStatCard('K/D Ratio', stats.kd, 'activity', '#b14aed'),
      renderStatCard('Win Rate', `${stats.winRate}%`, 'percent', '#00ff88'),
      renderStatCard('Earnings', `${GENBCONFIG.app.currency}${stats.earnings.toFixed(0)}`, 'indian-rupee', '#ffd700'),
    ].join('');
    lucide.createIcons();
  }

  // Badges
  const badgesEl = document.getElementById('badges-grid');
  if (badgesEl) {
    badgesEl.innerHTML = badges.length > 0
      ? badges.map(renderBadge).join('')
      : `<p class="text-gray-500 text-sm col-span-full text-center py-4">No badges earned yet. Start competing!</p>`;
  }

  // Achievements
  const achievementsEl = document.getElementById('achievements-list');
  if (achievementsEl) {
    achievementsEl.innerHTML = achievements.length > 0
      ? achievements.map(ach => `
          <div class="p-3 rounded-xl border border-white/5 bg-[#0a0a1a] ${ach.completed ? 'border-[#ffd700]/20' : ''}">
            <div class="flex items-center gap-3 mb-2">
              <span class="text-2xl">${ach.icon || '🎯'}</span>
              <div class="flex-1">
                <p class="text-sm font-semibold text-white">${ach.name}</p>
                <p class="text-xs text-gray-500">${ach.description || ''}</p>
              </div>
              ${ach.completed ? `<span class="text-[#ffd700] text-xs">✓ Done</span>` : `<span class="text-xs text-gray-500">${ach.progress}/${ach.target || 1}</span>`}
            </div>
            <div class="w-full h-1.5 bg-white/5 rounded-full">
              <div class="h-full rounded-full transition-all" style="width:${Math.min(100, ((ach.progress / (ach.target || 1)) * 100)).toFixed(0)}%; background:${ach.completed ? '#ffd700' : '#00d4ff'};"></div>
            </div>
          </div>`).join('')
      : `<p class="text-gray-500 text-sm text-center py-4">No achievements yet.</p>`;
  }

  // Match history
  const matchEl = document.getElementById('match-history-list');
  if (matchEl) {
    matchEl.innerHTML = matches.length > 0
      ? matches.map(renderMatchHistoryRow).join('')
      : `<div class="text-center py-8 text-gray-500">
          <i data-lucide="gamepad-2" class="w-10 h-10 mx-auto mb-2 opacity-30"></i>
          <p>No matches played yet</p>
        </div>`;
    lucide.createIcons();
  }
}

/**
 * Fully initialise the profile page.
 */
async function initProfilePage() {
  const { data: { user } } = await _sb().auth.getUser();
  if (!user) { window.location.href = '/auth.html'; return; }

  const userId = user.id;

  await renderProfilePage(userId);

  // Avatar upload
  const avatarInput = document.getElementById('avatar-upload-input');
  const avatarTrigger = document.getElementById('avatar-upload-btn');
  if (avatarTrigger && avatarInput) {
    avatarTrigger.addEventListener('click', () => avatarInput.click());
    avatarInput.addEventListener('change', async e => {
      const file = e.target.files[0];
      if (!file) return;
      avatarTrigger.innerHTML = `<span class="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full"></span>`;
      const url = await uploadAvatar(file, userId);
      if (url) {
        const avatarImg = document.getElementById('profile-avatar');
        if (avatarImg) avatarImg.src = url;
      }
      avatarTrigger.innerHTML = `<i data-lucide="camera" class="w-4 h-4"></i>`;
      lucide.createIcons();
    });
  }

  // Profile edit form
  const editForm = document.getElementById('profile-edit-form');
  if (editForm) {
    editForm.addEventListener('submit', async e => {
      e.preventDefault();
      const btn = editForm.querySelector('[type="submit"]');
      const origText = btn.textContent;
      btn.disabled = true;
      btn.textContent = 'Saving...';

      const formData = {
        username: document.getElementById('edit-username')?.value?.trim(),
        bio: document.getElementById('edit-bio')?.value?.trim(),
        game_uid: document.getElementById('edit-game-uid')?.value?.trim(),
        game: document.getElementById('edit-game')?.value,
      };

      // Remove undefined/empty
      Object.keys(formData).forEach(k => { if (!formData[k]) delete formData[k]; });

      const ok = await updateProfile(userId, formData);
      if (ok) await renderProfilePage(userId);

      btn.disabled = false;
      btn.textContent = origText;
    });

    // Pre-fill form
    const profile = await getUserProfile(userId);
    if (profile) {
      const u = document.getElementById('edit-username');
      const b = document.getElementById('edit-bio');
      const g = document.getElementById('edit-game-uid');
      const gm = document.getElementById('edit-game');
      if (u) u.value = profile.username || '';
      if (b) b.value = profile.bio || '';
      if (g) g.value = profile.game_uid || '';
      if (gm) gm.value = profile.game || '';
    }
  }

  // Load more matches
  let matchOffset = 10;
  const loadMoreMatchesBtn = document.getElementById('load-more-matches');
  if (loadMoreMatchesBtn) {
    loadMoreMatchesBtn.addEventListener('click', async () => {
      const more = await getMatchHistory(userId, 10, matchOffset);
      const matchEl = document.getElementById('match-history-list');
      if (matchEl && more.length > 0) {
        matchEl.insertAdjacentHTML('beforeend', more.map(renderMatchHistoryRow).join(''));
        lucide.createIcons();
        matchOffset += 10;
      }
      if (more.length < 10) loadMoreMatchesBtn.classList.add('hidden');
    });
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initProfilePage);
} else {
  initProfilePage();
}
