/**
 * @file tournaments.js
 * @description Gen B Tournaments — Tournament Feature Module
 * Handles fetching, filtering, joining, leaving, and rendering tournaments.
 * Depends on: config.js, supabase.js (window.supabase), utils.js (showToast)
 */

'use strict';

/* ─────────────────────────────────────────────────────────────────────────────
   SUPABASE CLIENT HELPER
   ───────────────────────────────────────────────────────────────────────────── */

/** @returns {import('@supabase/supabase-js').SupabaseClient} */
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
 * Fetch tournaments with optional filters.
 * @param {{ game?: string, type?: string, status?: string }} [filters={}]
 * @returns {Promise<Array>}
 */
async function getTournaments(filters = {}) {
  try {
    let query = _sb()
      .from('tournaments')
      .select('*')
      .order('start_time', { ascending: true });

    if (filters.game && filters.game !== 'all') {
      query = query.eq('game', filters.game);
    }
    if (filters.type && filters.type !== 'all') {
      query = query.eq('type', filters.type);
    }
    if (filters.status && filters.status !== 'all') {
      query = query.eq('status', filters.status);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error('[getTournaments]', err);
    showToast('Failed to load tournaments.', 'error');
    return [];
  }
}

/**
 * Fetch a single tournament by ID with full details.
 * @param {string} id
 * @returns {Promise<Object|null>}
 */
async function getTournamentById(id) {
  try {
    const { data, error } = await _sb()
      .from('tournaments')
      .select('*, registrations(count)')
      .eq('id', id)
      .single();
    if (error) throw error;
    return data;
  } catch (err) {
    console.error('[getTournamentById]', err);
    return null;
  }
}

/**
 * Join a tournament: deduct entry fee from wallet and create registration record.
 * @param {string} tournamentId
 * @param {string} userId
 * @returns {Promise<boolean>}
 */
async function joinTournament(tournamentId, userId) {
  try {
    const tournament = await getTournamentById(tournamentId);
    if (!tournament) throw new Error('Tournament not found.');

    if (tournament.status !== 'upcoming') {
      showToast('Registration is closed for this tournament.', 'error');
      return false;
    }

    const slot = await checkSlotAvailability(tournamentId);
    if (!slot.available) {
      showToast('No slots available.', 'error');
      return false;
    }

    // Check if already registered
    const { data: existing } = await _sb()
      .from('registrations')
      .select('id')
      .eq('tournament_id', tournamentId)
      .eq('user_id', userId)
      .maybeSingle();

    if (existing) {
      showToast('You are already registered.', 'warning');
      return false;
    }

    // Fetch wallet
    const { data: wallet, error: walletError } = await _sb()
      .from('wallets')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (walletError) throw walletError;

    const entryFee = tournament.entry_fee || 0;
    const totalBalance = (wallet.main_balance || 0) + (wallet.bonus_balance || 0);

    if (entryFee > 0 && totalBalance < entryFee) {
      showToast('Insufficient wallet balance. Please deposit funds.', 'error');
      return false;
    }

    // Deduct entry fee (prioritise bonus balance first)
    if (entryFee > 0) {
      let bonusDeduct = Math.min(wallet.bonus_balance || 0, entryFee);
      let mainDeduct = entryFee - bonusDeduct;

      const { error: deductError } = await _sb()
        .from('wallets')
        .update({
          bonus_balance: (wallet.bonus_balance || 0) - bonusDeduct,
          main_balance: (wallet.main_balance || 0) - mainDeduct,
        })
        .eq('user_id', userId);

      if (deductError) throw deductError;

      // Log transaction
      await _sb().from('transactions').insert({
        user_id: userId,
        type: 'entry_fee',
        amount: -entryFee,
        description: `Entry fee for ${tournament.name}`,
        meta: { tournament_id: tournamentId },
      });
    }

    // Create registration
    const { error: regError } = await _sb().from('registrations').insert({
      tournament_id: tournamentId,
      user_id: userId,
      registered_at: new Date().toISOString(),
    });

    if (regError) throw regError;

    showToast('Successfully joined the tournament! 🎮', 'success');
    return true;
  } catch (err) {
    console.error('[joinTournament]', err);
    showToast(err.message || 'Failed to join tournament.', 'error');
    return false;
  }
}

/**
 * Leave a tournament and refund the entry fee to bonus wallet.
 * @param {string} tournamentId
 * @param {string} userId
 * @returns {Promise<boolean>}
 */
async function leaveTournament(tournamentId, userId) {
  try {
    const tournament = await getTournamentById(tournamentId);
    if (!tournament) throw new Error('Tournament not found.');

    if (tournament.status !== 'upcoming') {
      showToast('Cannot leave an in-progress or completed tournament.', 'error');
      return false;
    }

    const { error: delError } = await _sb()
      .from('registrations')
      .delete()
      .eq('tournament_id', tournamentId)
      .eq('user_id', userId);

    if (delError) throw delError;

    // Refund entry fee to bonus balance
    const entryFee = tournament.entry_fee || 0;
    if (entryFee > 0) {
      await _sb().rpc('increment_wallet', {
        p_user_id: userId,
        p_column: 'bonus_balance',
        p_amount: entryFee,
      });

      await _sb().from('transactions').insert({
        user_id: userId,
        type: 'refund',
        amount: entryFee,
        description: `Refund for leaving ${tournament.name}`,
        meta: { tournament_id: tournamentId },
      });
    }

    showToast('You have left the tournament. Entry fee refunded to bonus wallet.', 'success');
    return true;
  } catch (err) {
    console.error('[leaveTournament]', err);
    showToast(err.message || 'Failed to leave tournament.', 'error');
    return false;
  }
}

/**
 * Get all tournaments a user has registered for.
 * @param {string} userId
 * @returns {Promise<Array>}
 */
async function getMyTournaments(userId) {
  try {
    const { data, error } = await _sb()
      .from('registrations')
      .select('tournament_id, registered_at, tournaments(*)')
      .eq('user_id', userId)
      .order('registered_at', { ascending: false });

    if (error) throw error;
    return (data || []).map(r => ({ ...r.tournaments, registered_at: r.registered_at }));
  } catch (err) {
    console.error('[getMyTournaments]', err);
    return [];
  }
}

/**
 * Get room ID and password if admin has published them and user is registered.
 * @param {string} tournamentId
 * @param {string} userId
 * @returns {Promise<{roomId: string|null, roomPass: string|null, published: boolean}>}
 */
async function getRoomDetails(tournamentId, userId) {
  try {
    // Check registration
    const { data: reg } = await _sb()
      .from('registrations')
      .select('id')
      .eq('tournament_id', tournamentId)
      .eq('user_id', userId)
      .maybeSingle();

    if (!reg) return { roomId: null, roomPass: null, published: false, registered: false };

    const { data: room, error } = await _sb()
      .from('tournament_rooms')
      .select('room_id, room_pass, published_at')
      .eq('tournament_id', tournamentId)
      .maybeSingle();

    if (error) throw error;

    if (!room || !room.published_at) {
      return { roomId: null, roomPass: null, published: false, registered: true };
    }

    return {
      roomId: room.room_id,
      roomPass: room.room_pass,
      published: true,
      registered: true,
    };
  } catch (err) {
    console.error('[getRoomDetails]', err);
    return { roomId: null, roomPass: null, published: false, registered: false };
  }
}

/**
 * Get a list of registered players for a tournament (avatar + username).
 * @param {string} tournamentId
 * @returns {Promise<Array>}
 */
async function getRegisteredPlayers(tournamentId) {
  try {
    const { data, error } = await _sb()
      .from('registrations')
      .select('user_id, users:user_id(username, avatar_url)')
      .eq('tournament_id', tournamentId)
      .limit(50);

    if (error) throw error;
    return (data || []).map(r => ({
      userId: r.user_id,
      username: r.users?.username || 'Player',
      avatar: r.users?.avatar_url || null,
    }));
  } catch (err) {
    console.error('[getRegisteredPlayers]', err);
    return [];
  }
}

/**
 * Check slot availability for a tournament.
 * @param {string} tournamentId
 * @returns {Promise<{available: boolean, total: number, remaining: number}>}
 */
async function checkSlotAvailability(tournamentId) {
  try {
    const { data: tournament } = await _sb()
      .from('tournaments')
      .select('max_players')
      .eq('id', tournamentId)
      .single();

    const { count } = await _sb()
      .from('registrations')
      .select('id', { count: 'exact', head: true })
      .eq('tournament_id', tournamentId);

    const total = tournament?.max_players || 0;
    const registered = count || 0;
    const remaining = Math.max(0, total - registered);

    return { available: remaining > 0, total, remaining, registered };
  } catch (err) {
    console.error('[checkSlotAvailability]', err);
    return { available: false, total: 0, remaining: 0, registered: 0 };
  }
}

/* ─────────────────────────────────────────────────────────────────────────────
   RENDER FUNCTIONS
   ───────────────────────────────────────────────────────────────────────────── */

/**
 * Returns HTML string for a single tournament card.
 * @param {Object} tournament
 * @returns {string}
 */
function renderTournamentCard(tournament) {
  const gameConfig = GENBCONFIG.games.find(g => g.id === tournament.game) || {};
  const statusMap = {
    upcoming: { label: 'Upcoming', cls: 'text-neon-blue border-neon-blue' },
    live: { label: 'LIVE', cls: 'text-neon-green border-neon-green animate-pulse' },
    completed: { label: 'Ended', cls: 'text-gray-400 border-gray-600' },
  };
  const statusCfg = statusMap[tournament.status] || statusMap.upcoming;
  const startDate = tournament.start_time
    ? new Date(tournament.start_time).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
    : 'TBA';

  const slotsUsed = tournament.registered_count || 0;
  const slotsTotal = tournament.max_players || 0;
  const slotsRemaining = Math.max(0, slotsTotal - slotsUsed);
  const slotPct = slotsTotal > 0 ? Math.min(100, Math.round((slotsUsed / slotsTotal) * 100)) : 0;
  const slotBarColor = slotPct >= 90 ? '#ff2d78' : slotPct >= 60 ? '#ffd700' : '#00ff88';

  const prizePool = tournament.prize_pool
    ? `${GENBCONFIG.app.currency}${Number(tournament.prize_pool).toLocaleString('en-IN')}`
    : 'Free';
  const entryFee = tournament.entry_fee > 0
    ? `${GENBCONFIG.app.currency}${tournament.entry_fee}`
    : 'FREE';

  const countdownAttr = tournament.start_time && tournament.status === 'upcoming'
    ? `data-countdown="${tournament.start_time}"`
    : '';

  return `
<div class="tournament-card group relative overflow-hidden rounded-2xl border border-white/10 bg-[#0a0a1a] hover:border-[#00d4ff]/40 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_0_30px_rgba(0,212,255,0.2)] cursor-pointer"
     data-tournament-id="${tournament.id}"
     onclick="window.location.href='/tournament-detail.html?id=${tournament.id}'">

  <!-- Banner -->
  <div class="relative h-36 overflow-hidden">
    ${tournament.banner_url
      ? `<img src="${tournament.banner_url}" alt="${tournament.name}" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500">`
      : `<div class="w-full h-full flex items-center justify-center text-6xl" style="background: linear-gradient(135deg, ${gameConfig.color || '#0a0a2a'}22, #0a0a1a);">${gameConfig.icon || '🎮'}</div>`
    }
    <!-- Status badge -->
    <span class="absolute top-3 left-3 text-xs font-bold px-2 py-1 rounded-full border backdrop-blur-sm bg-black/50 ${statusCfg.cls}">
      ${statusCfg.label}
    </span>
    <!-- Game badge -->
    <span class="absolute top-3 right-3 text-xs font-semibold px-2 py-1 rounded-full bg-black/60 backdrop-blur-sm text-white border border-white/10">
      ${gameConfig.icon || ''} ${gameConfig.name || tournament.game}
    </span>
    <!-- Type badge -->
    ${tournament.type ? `<span class="absolute bottom-3 left-3 text-xs px-2 py-0.5 rounded-full bg-[#b14aed]/30 text-[#b14aed] border border-[#b14aed]/30">${tournament.type}</span>` : ''}
  </div>

  <!-- Body -->
  <div class="p-4">
    <h3 class="font-rajdhani font-bold text-lg text-white mb-1 line-clamp-1">${tournament.name}</h3>

    <!-- Prize & Entry -->
    <div class="flex items-center justify-between mb-3">
      <div class="flex items-center gap-1.5">
        <span class="text-[10px] text-gray-400 uppercase tracking-wider">Prize</span>
        <span class="text-[#ffd700] font-bold font-rajdhani text-base">${prizePool}</span>
      </div>
      <div class="flex items-center gap-1.5">
        <span class="text-[10px] text-gray-400 uppercase tracking-wider">Entry</span>
        <span class="font-bold text-sm ${tournament.entry_fee > 0 ? 'text-white' : 'text-[#00ff88]'}">${entryFee}</span>
      </div>
    </div>

    <!-- Slot bar -->
    <div class="mb-3">
      <div class="flex justify-between text-[10px] text-gray-400 mb-1">
        <span>${slotsUsed}/${slotsTotal} players</span>
        <span>${slotsRemaining} slots left</span>
      </div>
      <div class="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
        <div class="h-full rounded-full transition-all duration-500" style="width:${slotPct}%; background:${slotBarColor};"></div>
      </div>
    </div>

    <!-- Start Time / Countdown -->
    <div class="flex items-center justify-between text-xs text-gray-400">
      <div class="flex items-center gap-1">
        <i data-lucide="calendar" class="w-3 h-3"></i>
        <span>${startDate}</span>
      </div>
      ${countdownAttr
        ? `<div class="flex items-center gap-1 text-[#00d4ff]">
             <i data-lucide="timer" class="w-3 h-3"></i>
             <span ${countdownAttr} class="font-mono text-xs font-bold">--:--:--</span>
           </div>`
        : ''}
    </div>
  </div>
</div>`.trim();
}

/**
 * Renders a grid of tournament cards into a container element.
 * @param {Array} tournaments
 * @param {string} containerId
 */
function renderTournamentGrid(tournaments, containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  if (!tournaments || tournaments.length === 0) {
    container.innerHTML = `
      <div class="col-span-full flex flex-col items-center justify-center py-20 text-center">
        <div class="text-6xl mb-4">🎮</div>
        <p class="text-gray-400 text-lg font-rajdhani">No tournaments found</p>
        <p class="text-gray-600 text-sm mt-1">Check back later for upcoming events</p>
      </div>`;
    lucide.createIcons();
    return;
  }

  container.innerHTML = tournaments.map(renderTournamentCard).join('');
  lucide.createIcons();
  initCountdownTimers();
}

/* ─────────────────────────────────────────────────────────────────────────────
   COUNTDOWN TIMERS
   ───────────────────────────────────────────────────────────────────────────── */

let _countdownInterval = null;

/**
 * Starts live countdown timers for all [data-countdown] elements on the page.
 */
function initCountdownTimers() {
  if (_countdownInterval) clearInterval(_countdownInterval);

  function tick() {
    document.querySelectorAll('[data-countdown]').forEach(el => {
      const targetTime = new Date(el.dataset.countdown).getTime();
      const now = Date.now();
      const diff = targetTime - now;

      if (diff <= 0) {
        el.textContent = 'LIVE';
        el.classList.add('text-[#00ff88]');
        return;
      }

      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);

      if (h > 24) {
        const d = Math.floor(h / 24);
        el.textContent = `${d}d ${h % 24}h`;
      } else {
        el.textContent = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
      }
    });
  }

  tick();
  _countdownInterval = setInterval(tick, 1000);
}

/* ─────────────────────────────────────────────────────────────────────────────
   FILTER SYSTEM
   ───────────────────────────────────────────────────────────────────────────── */

/** Active filter state */
const _tournamentFilters = {
  status: 'upcoming',
  game: 'all',
  type: 'all',
};

/**
 * Reads active tab + game filter and re-renders the tournament grid.
 * Expected DOM: #tournament-grid, [data-filter-tab], [data-game-filter]
 */
async function applyFilters() {
  const grid = document.getElementById('tournament-grid');
  if (!grid) return;

  // Show skeleton loader
  grid.innerHTML = Array(6).fill(0).map(() => `
    <div class="rounded-2xl border border-white/5 bg-[#0a0a1a] overflow-hidden animate-pulse">
      <div class="h-36 bg-white/5"></div>
      <div class="p-4 space-y-3">
        <div class="h-5 bg-white/5 rounded w-3/4"></div>
        <div class="h-4 bg-white/5 rounded w-1/2"></div>
        <div class="h-2 bg-white/5 rounded"></div>
      </div>
    </div>`).join('');

  const tournaments = await getTournaments({ ..._tournamentFilters });
  renderTournamentGrid(tournaments, 'tournament-grid');
}

/* ─────────────────────────────────────────────────────────────────────────────
   PAGE INITIALISER
   ───────────────────────────────────────────────────────────────────────────── */

/**
 * Initialise tournament listing page — tabs, game filter, and grid.
 */
async function initTournamentsPage() {
  // Tab switching
  document.querySelectorAll('[data-filter-tab]').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('[data-filter-tab]').forEach(t => {
        t.classList.remove('active', 'text-[#00d4ff]', 'border-[#00d4ff]');
        t.classList.add('text-gray-400', 'border-transparent');
      });
      tab.classList.add('active', 'text-[#00d4ff]', 'border-[#00d4ff]');
      tab.classList.remove('text-gray-400', 'border-transparent');
      _tournamentFilters.status = tab.dataset.filterTab;
      applyFilters();
    });
  });

  // Game filter
  document.querySelectorAll('[data-game-filter]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-game-filter]').forEach(b => b.classList.remove('active', 'bg-[#00d4ff]/20', 'text-[#00d4ff]', 'border-[#00d4ff]'));
      btn.classList.add('active', 'bg-[#00d4ff]/20', 'text-[#00d4ff]', 'border-[#00d4ff]');
      _tournamentFilters.game = btn.dataset.gameFilter;
      applyFilters();
    });
  });

  // Type filter
  const typeSelect = document.getElementById('type-filter');
  if (typeSelect) {
    typeSelect.addEventListener('change', () => {
      _tournamentFilters.type = typeSelect.value || 'all';
      applyFilters();
    });
  }

  await applyFilters();
}

// Auto-init if on tournaments page
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initTournamentsPage);
} else {
  initTournamentsPage();
}
