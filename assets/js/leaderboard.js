/**
 * @file leaderboard.js
 * @description Gen B Tournaments — Leaderboard Feature Module
 * Handles global/weekly/monthly rankings, podium display, and per-user rank.
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
 * Fetch leaderboard data.
 * @param {'global'|'weekly'|'monthly'} type
 * @param {string} [game='all']
 * @param {number} [limit=50]
 * @returns {Promise<Array>}
 */
async function getLeaderboard(type = 'global', game = 'all', limit = 50) {
  try {
    let viewName = 'leaderboard_global';
    if (type === 'weekly') viewName = 'leaderboard_weekly';
    if (type === 'monthly') viewName = 'leaderboard_monthly';

    let query = _sb()
      .from(viewName)
      .select('*')
      .order('total_wins', { ascending: false })
      .order('total_kills', { ascending: false })
      .limit(limit);

    if (game && game !== 'all') {
      query = query.eq('game', game);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error('[getLeaderboard]', err);
    // Fallback to users table if view doesn't exist yet
    try {
      let fallback = _sb()
        .from('users')
        .select('id, username, avatar_url, xp, total_wins, total_kills, game')
        .order('xp', { ascending: false })
        .limit(limit);

      if (game && game !== 'all') fallback = fallback.eq('game', game);

      const { data } = await fallback;
      return data || [];
    } catch {
      return [];
    }
  }
}

/**
 * Get the current user's rank on a specific leaderboard.
 * @param {string} userId
 * @param {'global'|'weekly'|'monthly'} [type='global']
 * @param {string} [game='all']
 * @returns {Promise<{rank: number|null, data: Object|null}>}
 */
async function getUserRank(userId, type = 'global', game = 'all') {
  try {
    const board = await getLeaderboard(type, game, 500);
    const idx = board.findIndex(p => p.id === userId || p.user_id === userId);

    if (idx === -1) return { rank: null, data: null };
    return { rank: idx + 1, data: board[idx] };
  } catch (err) {
    console.error('[getUserRank]', err);
    return { rank: null, data: null };
  }
}

/* ─────────────────────────────────────────────────────────────────────────────
   RENDER FUNCTIONS
   ───────────────────────────────────────────────────────────────────────────── */

const _rankStyles = [
  { bg: 'bg-[#ffd700]/10', border: 'border-[#ffd700]/30', text: 'text-[#ffd700]', glow: 'shadow-[0_0_15px_rgba(255,215,0,0.3)]', medal: '🥇' },
  { bg: 'bg-[#9ca3af]/10', border: 'border-[#9ca3af]/30', text: 'text-[#9ca3af]', glow: 'shadow-[0_0_10px_rgba(156,163,175,0.2)]', medal: '🥈' },
  { bg: 'bg-[#b45309]/10', border: 'border-[#b45309]/30', text: 'text-[#cd7f32]', glow: '', medal: '🥉' },
];

/**
 * Returns HTML row for a leaderboard entry.
 * @param {Object} player
 * @param {number} rank
 * @param {string} [currentUserId]
 * @returns {string}
 */
function renderLeaderboardRow(player, rank, currentUserId = '') {
  const isCurrentUser = player.id === currentUserId || player.user_id === currentUserId;
  const rankStyle = _rankStyles[rank - 1];
  const avatar = player.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${player.id || player.user_id}`;
  const game = GENBCONFIG.games.find(g => g.id === player.game);

  const rankDisplay = rank <= 3
    ? `<span class="text-xl">${rankStyle.medal}</span>`
    : `<span class="font-rajdhani font-bold text-lg ${rank <= 10 ? 'text-[#00d4ff]' : 'text-gray-500'}">#${rank}</span>`;

  return `
<div class="flex items-center gap-3 p-3 rounded-xl border transition-all duration-200
            ${isCurrentUser ? 'border-[#00d4ff]/40 bg-[#00d4ff]/5 shadow-[0_0_15px_rgba(0,212,255,0.15)]' : 'border-white/5 bg-[#0a0a1a] hover:border-white/10'}
            ${rank <= 3 ? rankStyle.glow : ''}">

  <!-- Rank -->
  <div class="w-10 text-center flex-shrink-0">
    ${rankDisplay}
  </div>

  <!-- Avatar -->
  <div class="relative flex-shrink-0">
    <img src="${avatar}" alt="${player.username}"
         class="w-10 h-10 rounded-full object-cover border-2 ${rank <= 3 ? rankStyle.border : 'border-white/10'}"
         onerror="this.src='https://api.dicebear.com/7.x/bottts/svg?seed=${player.id || rank}'">
    ${player.is_online ? `<span class="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-[#00ff88] rounded-full border-2 border-[#050510]"></span>` : ''}
  </div>

  <!-- Info -->
  <div class="flex-1 min-w-0">
    <div class="flex items-center gap-1.5">
      <p class="text-sm font-semibold text-white truncate ${isCurrentUser ? 'text-[#00d4ff]' : ''}">${player.username || 'Player'}</p>
      ${isCurrentUser ? `<span class="text-[10px] px-1.5 py-0.5 rounded-full bg-[#00d4ff]/20 text-[#00d4ff] font-bold">YOU</span>` : ''}
    </div>
    <div class="flex items-center gap-2 mt-0.5">
      ${game ? `<span class="text-[10px] text-gray-500">${game.icon} ${game.name}</span>` : ''}
      <span class="text-[10px] text-gray-600">${player.xp || 0} XP</span>
    </div>
  </div>

  <!-- Stats -->
  <div class="flex items-center gap-4 flex-shrink-0 text-right">
    <div class="hidden sm:block">
      <p class="text-sm font-bold text-white">${player.total_kills || player.kills || 0}</p>
      <p class="text-[10px] text-gray-500">Kills</p>
    </div>
    <div>
      <p class="text-sm font-bold ${rank <= 3 ? rankStyle.text : 'text-white'}">${player.total_wins || player.wins || 0}</p>
      <p class="text-[10px] text-gray-500">Wins</p>
    </div>
  </div>
</div>`.trim();
}

/**
 * Renders the top-3 podium.
 * @param {Array} top3  Array of exactly up to 3 players
 * @returns {string}
 */
function renderPodium(top3) {
  const [first, second, third] = top3;
  const podiumItem = (player, rank, heightCls, medalColor) => {
    if (!player) return `<div class="${heightCls} flex items-end justify-center opacity-20">
      <div class="w-16 text-center"><div class="w-14 h-14 mx-auto rounded-full border-2 border-dashed border-gray-700 mb-2 flex items-center justify-center text-2xl">?</div><div class="h-${rank === 1 ? '24' : rank === 2 ? '16' : '12'} w-full bg-white/5 rounded-t-xl"></div></div>
    </div>`;

    const avatar = player.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${player.id}`;
    const pillarH = rank === 1 ? 'h-24' : rank === 2 ? 'h-16' : 'h-12';

    return `
<div class="flex flex-col items-center">
  <div class="relative mb-1">
    <img src="${avatar}" alt="${player.username}"
         class="w-16 h-16 rounded-full object-cover border-4"
         style="border-color:${medalColor}; box-shadow:0 0 20px ${medalColor}60;"
         onerror="this.src='https://api.dicebear.com/7.x/bottts/svg?seed=${rank}'">
    <span class="absolute -top-2 -right-1 text-xl">${rank === 1 ? '🥇' : rank === 2 ? '🥈' : '🥉'}</span>
  </div>
  <p class="text-xs font-semibold text-white text-center truncate w-20">${player.username || 'Player'}</p>
  <p class="text-[10px] text-gray-400 mb-2">${player.total_wins || 0} wins</p>
  <div class="${pillarH} w-20 rounded-t-xl flex items-center justify-center font-rajdhani font-bold text-xl"
       style="background:linear-gradient(180deg, ${medalColor}30, ${medalColor}10); border-top:2px solid ${medalColor}60; color:${medalColor};">
    #${rank}
  </div>
</div>`.trim();
  };

  return `
<div class="flex items-end justify-center gap-3 px-4 pb-0">
  ${podiumItem(second, 2, 'h-auto', '#9ca3af')}
  ${podiumItem(first, 1, 'h-auto', '#ffd700')}
  ${podiumItem(third, 3, 'h-auto', '#cd7f32')}
</div>`.trim();
}

/* ─────────────────────────────────────────────────────────────────────────────
   PAGE INIT
   ───────────────────────────────────────────────────────────────────────────── */

let _lbType = 'global';
let _lbGame = 'all';

/**
 * Initialise leaderboard page with tabs and game filter.
 */
async function initLeaderboardPage() {
  const { data: { user } } = await _sb().auth.getUser();
  const currentUserId = user?.id || '';

  async function loadLeaderboard() {
    // Show loader
    const listEl = document.getElementById('leaderboard-list');
    const podiumEl = document.getElementById('leaderboard-podium');

    if (listEl) listEl.innerHTML = Array(5).fill(0).map(() => `
      <div class="flex items-center gap-3 p-3 rounded-xl border border-white/5 bg-[#0a0a1a] animate-pulse">
        <div class="w-10 h-4 bg-white/5 rounded"></div>
        <div class="w-10 h-10 bg-white/5 rounded-full"></div>
        <div class="flex-1 space-y-2"><div class="h-3 bg-white/5 rounded w-3/4"></div><div class="h-2 bg-white/5 rounded w-1/2"></div></div>
        <div class="w-12 h-4 bg-white/5 rounded"></div>
      </div>`).join('');

    const board = await getLeaderboard(_lbType, _lbGame, 100);
    const top3 = board.slice(0, 3);
    const rest = board.slice(3);

    if (podiumEl) {
      podiumEl.innerHTML = renderPodium(top3);
    }

    if (listEl) {
      if (rest.length === 0) {
        listEl.innerHTML = `<div class="text-center py-10 text-gray-500">
          <i data-lucide="bar-chart-2" class="w-10 h-10 mx-auto mb-2 opacity-30"></i>
          <p>No rankings yet. Start playing!</p>
        </div>`;
      } else {
        listEl.innerHTML = rest.map((p, i) => renderLeaderboardRow(p, i + 4, currentUserId)).join('');
      }
      lucide.createIcons();
    }

    // User rank badge
    const { rank: myRank } = await getUserRank(currentUserId, _lbType, _lbGame);
    const myRankEl = document.getElementById('my-rank');
    if (myRankEl) {
      myRankEl.textContent = myRank ? `#${myRank}` : '--';
    }
  }

  // Tab switching
  document.querySelectorAll('[data-lb-tab]').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('[data-lb-tab]').forEach(t => {
        t.classList.remove('active', 'text-[#00d4ff]', 'border-[#00d4ff]');
        t.classList.add('text-gray-400', 'border-transparent');
      });
      tab.classList.add('active', 'text-[#00d4ff]', 'border-[#00d4ff]');
      tab.classList.remove('text-gray-400', 'border-transparent');
      _lbType = tab.dataset.lbTab;
      loadLeaderboard();
    });
  });

  // Game filter
  document.querySelectorAll('[data-game-filter]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-game-filter]').forEach(b => b.classList.remove('active', 'bg-[#00d4ff]/20', 'text-[#00d4ff]'));
      btn.classList.add('active', 'bg-[#00d4ff]/20', 'text-[#00d4ff]');
      _lbGame = btn.dataset.gameFilter;
      loadLeaderboard();
    });
  });

  await loadLeaderboard();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initLeaderboardPage);
} else {
  initLeaderboardPage();
}
