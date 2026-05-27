/**
 * Gen B Tournaments — Admin Tournament Management
 * =================================================
 * Handles: list/create/edit/delete tournaments, room details, status updates,
 *          registrations view, prize distribution.
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

function setLoading(btnId, loading) {
  const btn = document.getElementById(btnId);
  if (!btn) return;
  btn.disabled = loading;
  btn.style.opacity = loading ? '0.6' : '1';
}

/* ─────────────────────────────────────────────────────────────────────────────
   1. GET ALL TOURNAMENTS
───────────────────────────────────────────────────────────────────────────── */
async function getAllTournaments(filters = {}) {
  const db = getClient();
  let query = db
    .from('tournaments')
    .select(`
      id, title, game, entry_fee, prize_pool, max_slots, filled_slots,
      status, start_time, end_time, room_id, room_password,
      created_at, banner_url, map, mode, per_kill_reward, description
    `)
    .order('created_at', { ascending: false });

  if (filters.status)  query = query.eq('status', filters.status);
  if (filters.game)    query = query.eq('game', filters.game);
  if (filters.search)  query = query.ilike('title', `%${filters.search}%`);

  const { data, error } = await query;
  if (error) { console.error('[getAllTournaments]', error); showToast('Failed to fetch tournaments', 'error'); return []; }
  return data || [];
}

/* ─────────────────────────────────────────────────────────────────────────────
   2. CREATE TOURNAMENT
───────────────────────────────────────────────────────────────────────────── */
async function createTournament(data) {
  const db = getClient();

  const payload = {
    title:           data.title,
    game:            data.game,
    entry_fee:       Number(data.entry_fee) || 0,
    prize_pool:      Number(data.prize_pool) || 0,
    max_slots:       Number(data.max_slots) || 100,
    filled_slots:    0,
    status:          data.status || 'upcoming',
    start_time:      data.start_time,
    end_time:        data.end_time || null,
    map:             data.map || null,
    mode:            data.mode || null,
    per_kill_reward: Number(data.per_kill_reward) || 0,
    description:     data.description || null,
    banner_url:      data.banner_url || null,
    room_id:         null,
    room_password:   null,
    prize_distribution: data.prize_distribution || null,  // JSON: [{rank:1, amount:500}, ...]
    created_at:      new Date().toISOString(),
  };

  const { data: created, error } = await db.from('tournaments').insert(payload).select().single();
  if (error) { console.error('[createTournament]', error); showToast('Failed to create tournament: ' + error.message, 'error'); return null; }

  showToast('Tournament created successfully! 🎮', 'success');
  return created;
}

/* ─────────────────────────────────────────────────────────────────────────────
   3. UPDATE TOURNAMENT
───────────────────────────────────────────────────────────────────────────── */
async function updateTournament(id, data) {
  const db = getClient();

  const payload = {};
  const allowed = ['title','game','entry_fee','prize_pool','max_slots','status','start_time',
                   'end_time','map','mode','per_kill_reward','description','banner_url','prize_distribution'];
  allowed.forEach(key => { if (data[key] !== undefined) payload[key] = data[key]; });
  payload.updated_at = new Date().toISOString();

  const { data: updated, error } = await db.from('tournaments').update(payload).eq('id', id).select().single();
  if (error) { console.error('[updateTournament]', error); showToast('Failed to update tournament: ' + error.message, 'error'); return null; }

  showToast('Tournament updated! ✅', 'success');
  return updated;
}

/* ─────────────────────────────────────────────────────────────────────────────
   4. DELETE TOURNAMENT
───────────────────────────────────────────────────────────────────────────── */
async function deleteTournament(id) {
  const confirmed = window.confirm('⚠️ Delete this tournament? This action cannot be undone.');
  if (!confirmed) return false;

  const db = getClient();
  const { error } = await db.from('tournaments').delete().eq('id', id);
  if (error) { console.error('[deleteTournament]', error); showToast('Failed to delete tournament', 'error'); return false; }

  showToast('Tournament deleted.', 'warning');
  return true;
}

/* ─────────────────────────────────────────────────────────────────────────────
   5. PUBLISH ROOM DETAILS
───────────────────────────────────────────────────────────────────────────── */
async function publishRoomDetails(tournamentId, roomId, roomPassword) {
  if (!roomId || !roomPassword) { showToast('Room ID and password are required', 'warning'); return false; }

  const db = getClient();
  const { error } = await db
    .from('tournaments')
    .update({ room_id: roomId, room_password: roomPassword, updated_at: new Date().toISOString() })
    .eq('id', tournamentId);

  if (error) { console.error('[publishRoomDetails]', error); showToast('Failed to publish room details', 'error'); return false; }

  // Optionally insert a notification record for all registrants
  const { data: registrations } = await db
    .from('tournament_registrations')
    .select('user_id, tournaments(title)')
    .eq('tournament_id', tournamentId);

  if (registrations && registrations.length > 0) {
    const title = registrations[0].tournaments?.title || 'Tournament';
    const notifications = registrations.map(r => ({
      user_id: r.user_id,
      title:   'Room Details Published! 🎮',
      body:    `${title} — Room ID: ${roomId} | Password: ${roomPassword}`,
      type:    'room_details',
      read:    false,
      created_at: new Date().toISOString(),
    }));
    await db.from('notifications').insert(notifications);
  }

  showToast('Room details published & players notified! 🔑', 'success');
  return true;
}

/* ─────────────────────────────────────────────────────────────────────────────
   6. UPDATE TOURNAMENT STATUS
   status: 'upcoming' | 'live' | 'completed' | 'cancelled'
───────────────────────────────────────────────────────────────────────────── */
async function updateTournamentStatus(id, status) {
  const db = getClient();
  const { error } = await db
    .from('tournaments')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id);

  if (error) { console.error('[updateTournamentStatus]', error); showToast('Status update failed', 'error'); return false; }
  showToast(`Status set to "${status}" ✅`, 'success');
  return true;
}

/* ─────────────────────────────────────────────────────────────────────────────
   7. GET TOURNAMENT REGISTRATIONS
───────────────────────────────────────────────────────────────────────────── */
async function getTournamentRegistrations(tournamentId) {
  const db = getClient();
  const { data, error } = await db
    .from('tournament_registrations')
    .select(`
      id, user_id, team_name, slot_number, kill_count, rank, prize_earned, registered_at,
      profiles(id, username, avatar_url, phone)
    `)
    .eq('tournament_id', tournamentId)
    .order('registered_at', { ascending: true });

  if (error) { console.error('[getTournamentRegistrations]', error); showToast('Failed to fetch registrations', 'error'); return []; }
  return data || [];
}

/* ─────────────────────────────────────────────────────────────────────────────
   8. DISTRIBUTE PRIZES
   results: [{ userId, rank, killCount, prizeAmount }]
───────────────────────────────────────────────────────────────────────────── */
async function distributePrizes(tournamentId, results) {
  if (!results || results.length === 0) { showToast('No results provided', 'warning'); return false; }

  const db = getClient();
  let allOk = true;

  for (const r of results) {
    if (!r.prizeAmount || r.prizeAmount <= 0) continue;

    // Update registration record
    const { error: regErr } = await db
      .from('tournament_registrations')
      .update({ rank: r.rank, kill_count: r.killCount, prize_earned: r.prizeAmount })
      .eq('tournament_id', tournamentId)
      .eq('user_id', r.userId);

    if (regErr) { console.error('[distributePrizes] reg update', regErr); allOk = false; continue; }

    // Credit winning wallet
    const { data: wallet, error: walletErr } = await db
      .from('wallets')
      .select('id, winning_balance')
      .eq('user_id', r.userId)
      .single();

    if (walletErr || !wallet) { console.error('[distributePrizes] wallet fetch', walletErr); allOk = false; continue; }

    const { error: creditErr } = await db
      .from('wallets')
      .update({ winning_balance: (wallet.winning_balance || 0) + r.prizeAmount })
      .eq('id', wallet.id);

    if (creditErr) { console.error('[distributePrizes] wallet credit', creditErr); allOk = false; continue; }

    // Transaction log
    await db.from('transactions').insert({
      user_id:     r.userId,
      type:        'prize',
      amount:      r.prizeAmount,
      wallet_type: 'winning',
      description: `Prize for Rank #${r.rank} — Tournament ${tournamentId}`,
      reference_id: tournamentId,
      created_at:  new Date().toISOString(),
    });

    // Notification
    await db.from('notifications').insert({
      user_id: r.userId,
      title:   '🏆 Prize Credited!',
      body:    `Congratulations! ₹${r.prizeAmount} has been added to your winning wallet for Rank #${r.rank}.`,
      type:    'prize',
      read:    false,
      created_at: new Date().toISOString(),
    });
  }

  // Mark tournament completed
  await db.from('tournaments').update({ status: 'completed', updated_at: new Date().toISOString() }).eq('id', tournamentId);

  if (allOk) showToast('Prizes distributed successfully! 🏆', 'success');
  else showToast('Some prizes failed to distribute — check console', 'warning');
  return allOk;
}

/* ─────────────────────────────────────────────────────────────────────────────
   9. MODAL MANAGEMENT
───────────────────────────────────────────────────────────────────────────── */
function openCreateModal() {
  const modal = document.getElementById('tournament-modal');
  if (!modal) return;
  document.getElementById('modal-title').textContent = 'Create Tournament';
  document.getElementById('tournament-form').reset();
  document.getElementById('tournament-id-input').value = '';
  modal.classList.remove('hidden');
  modal.classList.add('flex');
}

async function openEditModal(id) {
  const db = getClient();
  const { data: t, error } = await db.from('tournaments').select('*').eq('id', id).single();
  if (error || !t) { showToast('Failed to load tournament', 'error'); return; }

  const modal = document.getElementById('tournament-modal');
  if (!modal) return;
  document.getElementById('modal-title').textContent = 'Edit Tournament';
  document.getElementById('tournament-id-input').value = t.id;

  const fields = ['title','game','entry_fee','prize_pool','max_slots','status',
                  'start_time','end_time','map','mode','per_kill_reward','description','banner_url'];
  fields.forEach(f => {
    const el = document.getElementById(`field-${f}`);
    if (el) el.value = t[f] ?? '';
  });

  modal.classList.remove('hidden');
  modal.classList.add('flex');
}

function closeModal(modalId = 'tournament-modal') {
  const modal = document.getElementById(modalId);
  if (!modal) return;
  modal.classList.add('hidden');
  modal.classList.remove('flex');
}

/* ─────────────────────────────────────────────────────────────────────────────
   10. RENDER TOURNAMENTS TABLE
───────────────────────────────────────────────────────────────────────────── */
const STATUS_STYLES = {
  upcoming:  { bg: 'rgba(0,212,255,0.15)',  color: '#00d4ff', label: 'Upcoming' },
  live:      { bg: 'rgba(0,255,136,0.15)',  color: '#00ff88', label: '🔴 LIVE'  },
  completed: { bg: 'rgba(177,74,237,0.15)', color: '#b14aed', label: 'Completed'},
  cancelled: { bg: 'rgba(255,45,120,0.15)', color: '#ff2d78', label: 'Cancelled'},
};

function renderTournamentsTable(tournaments) {
  const tbody = document.getElementById('tournaments-tbody');
  if (!tbody) return;

  if (!tournaments || tournaments.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="9" class="py-12 text-center">
          <div class="flex flex-col items-center opacity-50">
            <span style="font-size:3rem;">🎮</span>
            <p class="mt-2 text-sm text-gray-400 font-inter">No tournaments found</p>
          </div>
        </td>
      </tr>`;
    return;
  }

  tbody.innerHTML = tournaments.map(t => {
    const style = STATUS_STYLES[t.status] || STATUS_STYLES.upcoming;
    const startDate = t.start_time ? new Date(t.start_time).toLocaleString('en-IN', { dateStyle:'medium', timeStyle:'short' }) : '—';
    const fillPct = t.max_slots ? Math.round((t.filled_slots / t.max_slots) * 100) : 0;
    const gameInfo = GENBCONFIG.games.find(g => g.id === t.game) || { icon: '🎮', name: t.game };

    return `
      <tr class="border-b border-white border-opacity-5 hover:bg-white hover:bg-opacity-5 transition-colors">
        <td class="px-4 py-3">
          <div class="flex items-center gap-2">
            <span class="text-xl">${gameInfo.icon}</span>
            <div>
              <p class="text-sm font-semibold text-white font-rajdhani truncate max-w-[160px]">${t.title}</p>
              <p class="text-xs text-gray-400">${gameInfo.name} · ${t.mode || 'N/A'}</p>
            </div>
          </div>
        </td>
        <td class="px-4 py-3 text-sm text-white">₹${(t.entry_fee || 0).toLocaleString('en-IN')}</td>
        <td class="px-4 py-3 text-sm font-semibold" style="color:#ffd700;">₹${(t.prize_pool || 0).toLocaleString('en-IN')}</td>
        <td class="px-4 py-3">
          <div class="text-xs text-white">${t.filled_slots || 0}/${t.max_slots}</div>
          <div class="w-20 h-1 rounded-full mt-1" style="background:rgba(255,255,255,0.1);">
            <div class="h-1 rounded-full" style="width:${fillPct}%; background:#00d4ff;"></div>
          </div>
        </td>
        <td class="px-4 py-3">
          <span class="px-2 py-1 rounded-full text-xs font-semibold" style="background:${style.bg}; color:${style.color};">
            ${style.label}
          </span>
        </td>
        <td class="px-4 py-3 text-xs text-gray-400">${startDate}</td>
        <td class="px-4 py-3">
          ${t.room_id
            ? `<span class="text-xs text-green-400">✅ Published</span>`
            : `<span class="text-xs text-gray-500">Not published</span>`}
        </td>
        <td class="px-4 py-3">
          <select onchange="handleStatusChange('${t.id}', this.value)"
                  class="bg-transparent border border-white border-opacity-20 text-white text-xs rounded px-2 py-1 cursor-pointer">
            ${['upcoming','live','completed','cancelled'].map(s =>
              `<option value="${s}" ${t.status===s?'selected':''} style="background:#0a0a1a;">${s}</option>`
            ).join('')}
          </select>
        </td>
        <td class="px-4 py-3">
          <div class="flex items-center gap-1">
            <button onclick="openEditModal('${t.id}')"
                    class="px-2 py-1 rounded text-xs font-semibold transition-all"
                    style="background:rgba(0,212,255,0.15);color:#00d4ff;border:1px solid rgba(0,212,255,0.3);"
                    title="Edit">✏️</button>
            <button onclick="openRoomModal('${t.id}')"
                    class="px-2 py-1 rounded text-xs font-semibold transition-all"
                    style="background:rgba(255,215,0,0.15);color:#ffd700;border:1px solid rgba(255,215,0,0.3);"
                    title="Publish Room">🔑</button>
            <button onclick="openRegistrationsModal('${t.id}')"
                    class="px-2 py-1 rounded text-xs font-semibold transition-all"
                    style="background:rgba(177,74,237,0.15);color:#b14aed;border:1px solid rgba(177,74,237,0.3);"
                    title="View Registrations">👥</button>
            <button onclick="handleDeleteTournament('${t.id}')"
                    class="px-2 py-1 rounded text-xs font-semibold transition-all"
                    style="background:rgba(255,45,120,0.15);color:#ff2d78;border:1px solid rgba(255,45,120,0.3);"
                    title="Delete">🗑️</button>
          </div>
        </td>
      </tr>`;
  }).join('');
}

/* ─────────────────────────────────────────────────────────────────────────────
   EVENT HANDLERS (wired to inline onclick attributes)
───────────────────────────────────────────────────────────────────────────── */
async function handleStatusChange(id, status) {
  await updateTournamentStatus(id, status);
}

async function handleDeleteTournament(id) {
  const deleted = await deleteTournament(id);
  if (deleted) {
    const tournaments = await getAllTournaments();
    renderTournamentsTable(tournaments);
  }
}

function openRoomModal(tournamentId) {
  const modal = document.getElementById('room-modal');
  if (!modal) return;
  document.getElementById('room-tournament-id').value = tournamentId;
  document.getElementById('room-id-input').value = '';
  document.getElementById('room-password-input').value = '';
  modal.classList.remove('hidden');
  modal.classList.add('flex');
}

async function openRegistrationsModal(tournamentId) {
  const modal = document.getElementById('registrations-modal');
  if (!modal) return;
  modal.classList.remove('hidden');
  modal.classList.add('flex');

  const tbody = document.getElementById('registrations-tbody');
  if (tbody) tbody.innerHTML = '<tr><td colspan="6" class="py-6 text-center text-gray-400 text-sm">Loading...</td></tr>';

  const registrations = await getTournamentRegistrations(tournamentId);

  if (!tbody) return;
  if (!registrations.length) {
    tbody.innerHTML = '<tr><td colspan="6" class="py-6 text-center text-gray-400 text-sm">No registrations yet</td></tr>';
    return;
  }

  tbody.innerHTML = registrations.map((r, idx) => `
    <tr class="border-b border-white border-opacity-5">
      <td class="px-3 py-2 text-sm text-gray-400">${idx + 1}</td>
      <td class="px-3 py-2 text-sm text-white">${r.profiles?.username || 'Unknown'}</td>
      <td class="px-3 py-2 text-sm text-gray-300">${r.team_name || '—'}</td>
      <td class="px-3 py-2 text-sm text-center">
        <input type="number" min="0" value="${r.kill_count ?? 0}"
               id="kills-${r.user_id}" placeholder="0"
               class="w-16 text-center bg-transparent border border-white border-opacity-20 text-white rounded px-1 py-0.5 text-xs"/>
      </td>
      <td class="px-3 py-2 text-sm text-center">
        <input type="number" min="0" value="${r.rank ?? ''}"
               id="rank-${r.user_id}" placeholder="Rank"
               class="w-16 text-center bg-transparent border border-white border-opacity-20 text-white rounded px-1 py-0.5 text-xs"/>
      </td>
      <td class="px-3 py-2 text-sm text-center">
        <input type="number" min="0" value="${r.prize_earned ?? ''}"
               id="prize-${r.user_id}" placeholder="₹0"
               class="w-20 text-center bg-transparent border border-white border-opacity-20 text-white rounded px-1 py-0.5 text-xs"/>
      </td>
    </tr>`).join('');

  // Store tournamentId for prize distribution button
  const distributeBtn = document.getElementById('distribute-prizes-btn');
  if (distributeBtn) {
    distributeBtn.onclick = async () => {
      const results = registrations.map(r => ({
        userId:      r.user_id,
        rank:        parseInt(document.getElementById(`rank-${r.user_id}`)?.value) || null,
        killCount:   parseInt(document.getElementById(`kills-${r.user_id}`)?.value) || 0,
        prizeAmount: parseFloat(document.getElementById(`prize-${r.user_id}`)?.value) || 0,
      })).filter(r => r.prizeAmount > 0);

      await distributePrizes(tournamentId, results);
      closeModal('registrations-modal');
      const tournaments = await getAllTournaments();
      renderTournamentsTable(tournaments);
    };
  }
}

/* ─────────────────────────────────────────────────────────────────────────────
   11. INIT TOURNAMENTS ADMIN
───────────────────────────────────────────────────────────────────────────── */
async function initTournamentsAdmin() {
  const ok = await requireAdmin();
  if (!ok) return;

  // Initial load
  let tournaments = await getAllTournaments();
  renderTournamentsTable(tournaments);

  // Create button
  const createBtn = document.getElementById('create-tournament-btn');
  if (createBtn) createBtn.addEventListener('click', openCreateModal);

  // Search / filter
  const searchInput = document.getElementById('tournament-search');
  const statusFilter = document.getElementById('status-filter');
  const gameFilter   = document.getElementById('game-filter');

  async function applyFilters() {
    const filters = {
      search: searchInput?.value.trim() || undefined,
      status: statusFilter?.value || undefined,
      game:   gameFilter?.value || undefined,
    };
    tournaments = await getAllTournaments(filters);
    renderTournamentsTable(tournaments);
  }

  searchInput?.addEventListener('input', applyFilters);
  statusFilter?.addEventListener('change', applyFilters);
  gameFilter?.addEventListener('change', applyFilters);

  // Tournament form submission (create / edit)
  const form = document.getElementById('tournament-form');
  if (form) {
    form.addEventListener('submit', async e => {
      e.preventDefault();
      setLoading('save-tournament-btn', true);

      const id = document.getElementById('tournament-id-input')?.value;
      const formData = Object.fromEntries(new FormData(form));

      let result;
      if (id) result = await updateTournament(id, formData);
      else     result = await createTournament(formData);

      setLoading('save-tournament-btn', false);

      if (result) {
        closeModal('tournament-modal');
        tournaments = await getAllTournaments();
        renderTournamentsTable(tournaments);
      }
    });
  }

  // Close modal buttons
  document.querySelectorAll('[data-close-modal]').forEach(btn => {
    btn.addEventListener('click', () => closeModal(btn.dataset.closeModal));
  });

  // Room details form
  const roomForm = document.getElementById('room-form');
  if (roomForm) {
    roomForm.addEventListener('submit', async e => {
      e.preventDefault();
      const tid  = document.getElementById('room-tournament-id').value;
      const rid  = document.getElementById('room-id-input').value.trim();
      const rpwd = document.getElementById('room-password-input').value.trim();
      setLoading('publish-room-btn', true);
      await publishRoomDetails(tid, rid, rpwd);
      setLoading('publish-room-btn', false);
      closeModal('room-modal');
      tournaments = await getAllTournaments();
      renderTournamentsTable(tournaments);
    });
  }

  // Realtime
  const db = getClient();
  db.channel('admin-tournaments')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'tournaments' }, async () => {
      tournaments = await getAllTournaments();
      renderTournamentsTable(tournaments);
    })
    .subscribe();
}

/* ─────────────────────────────────────────────────────────────────────────────
   AUTO-INIT
───────────────────────────────────────────────────────────────────────────── */
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initTournamentsAdmin);
} else {
  initTournamentsAdmin();
}
