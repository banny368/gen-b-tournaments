/**
 * Gen B Tournaments — Admin Dashboard
 * =====================================
 * Handles: stats overview, revenue chart, user growth chart, activity feed.
 * Requires: config.js, supabase (window._supabase), Chart.js
 */

'use strict';

/* ─────────────────────────────────────────────────────────────────────────────
   SUPABASE CLIENT HELPER
───────────────────────────────────────────────────────────────────────────── */
function getClient() {
  if (window._supabase) return window._supabase;
  const { createClient } = supabase;
  window._supabase = createClient(GENBCONFIG.supabase.url, GENBCONFIG.supabase.anonKey);
  return window._supabase;
}

/* ─────────────────────────────────────────────────────────────────────────────
   TOAST NOTIFICATION
───────────────────────────────────────────────────────────────────────────── */
function showToast(message, type = 'info') {
  const colors = {
    success: '#00ff88',
    error:   '#ff2d78',
    info:    '#00d4ff',
    warning: '#ffd700',
  };
  const container = document.getElementById('toast-container') || (() => {
    const el = document.createElement('div');
    el.id = 'toast-container';
    el.style.cssText = 'position:fixed;top:1.5rem;right:1.5rem;z-index:9999;display:flex;flex-direction:column;gap:.5rem;';
    document.body.appendChild(el);
    return el;
  })();

  const toast = document.createElement('div');
  toast.style.cssText = `
    background: rgba(10,10,26,0.97);
    border: 1px solid ${colors[type] || colors.info};
    color: #fff;
    padding: .75rem 1.25rem;
    border-radius: .5rem;
    font-family: 'Inter', sans-serif;
    font-size: .875rem;
    box-shadow: 0 0 20px ${colors[type] || colors.info}44;
    max-width: 320px;
    opacity: 0;
    transform: translateX(40px);
    transition: all .3s ease;
  `;
  toast.textContent = message;
  container.appendChild(toast);
  requestAnimationFrame(() => {
    toast.style.opacity = '1';
    toast.style.transform = 'translateX(0)';
  });
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(40px)';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

/* ─────────────────────────────────────────────────────────────────────────────
   ROLE GUARD
───────────────────────────────────────────────────────────────────────────── */
async function requireAdmin() {
  const db = getClient();
  const { data: { session } } = await db.auth.getSession();
  if (!session) { window.location.href = '/index.html'; return false; }

  const { data: profile, error } = await db
    .from('profiles')
    .select('role')
    .eq('id', session.user.id)
    .single();

  if (error || !profile || !GENBCONFIG.admin.roles.includes(profile.role)) {
    window.location.href = '/index.html';
    return false;
  }
  return true;
}

/* ─────────────────────────────────────────────────────────────────────────────
   1. GET ADMIN STATS
   Returns: { totalUsers, totalRevenue, liveTournaments, pendingWithdrawals,
              pendingPayments, totalMatches }
───────────────────────────────────────────────────────────────────────────── */
async function getAdminStats() {
  const db = getClient();

  const [
    { count: totalUsers },
    { data: revenueRows },
    { count: liveTournaments },
    { count: pendingWithdrawals },
    { count: pendingPayments },
    { count: totalMatches },
  ] = await Promise.all([
    db.from('profiles').select('id', { count: 'exact', head: true }),
    db.from('payments').select('amount').eq('status', 'approved').eq('type', 'deposit'),
    db.from('tournaments').select('id', { count: 'exact', head: true }).eq('status', 'live'),
    db.from('withdrawal_requests').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    db.from('payments').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    db.from('tournament_registrations').select('id', { count: 'exact', head: true }),
  ]);

  const totalRevenue = (revenueRows || []).reduce((sum, r) => sum + (r.amount || 0), 0);

  return {
    totalUsers:         totalUsers   ?? 0,
    totalRevenue:       totalRevenue ?? 0,
    liveTournaments:    liveTournaments  ?? 0,
    pendingWithdrawals: pendingWithdrawals ?? 0,
    pendingPayments:    pendingPayments   ?? 0,
    totalMatches:       totalMatches      ?? 0,
  };
}

/* ─────────────────────────────────────────────────────────────────────────────
   2. RENDER STAT CARDS (animated counter)
───────────────────────────────────────────────────────────────────────────── */
function animateCounter(el, target, prefix = '', suffix = '', duration = 1200) {
  const start = performance.now();
  const startVal = 0;
  const isFloat = !Number.isInteger(target);

  function step(now) {
    const progress = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
    const current = startVal + (target - startVal) * eased;
    el.textContent = prefix + (isFloat ? current.toFixed(2) : Math.floor(current).toLocaleString('en-IN')) + suffix;
    if (progress < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

function renderStatCards(stats) {
  const map = {
    'stat-total-users':         { val: stats.totalUsers,         prefix: '',  suffix: '' },
    'stat-total-revenue':       { val: stats.totalRevenue,       prefix: '₹', suffix: '' },
    'stat-live-tournaments':    { val: stats.liveTournaments,    prefix: '',  suffix: '' },
    'stat-pending-withdrawals': { val: stats.pendingWithdrawals, prefix: '',  suffix: '' },
    'stat-pending-payments':    { val: stats.pendingPayments,    prefix: '',  suffix: '' },
    'stat-total-matches':       { val: stats.totalMatches,       prefix: '',  suffix: '' },
  };

  for (const [id, cfg] of Object.entries(map)) {
    const el = document.getElementById(id);
    if (el) animateCounter(el, cfg.val, cfg.prefix, cfg.suffix);
  }
}

/* ─────────────────────────────────────────────────────────────────────────────
   3. GET REVENUE DATA
   period: 'day' | 'week' | 'month'
───────────────────────────────────────────────────────────────────────────── */
async function getRevenueData(period = 'week') {
  const db = getClient();

  const periodMap = { day: 1, week: 7, month: 30 };
  const days = periodMap[period] || 7;
  const since = new Date(Date.now() - days * 86400000).toISOString();

  const { data, error } = await db
    .from('payments')
    .select('amount, created_at')
    .eq('status', 'approved')
    .eq('type', 'deposit')
    .gte('created_at', since)
    .order('created_at', { ascending: true });

  if (error) { console.error('[getRevenueData]', error); return { labels: [], values: [] }; }

  // Bucket by date
  const buckets = {};
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000);
    const key = d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
    buckets[key] = 0;
  }

  (data || []).forEach(row => {
    const key = new Date(row.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
    if (key in buckets) buckets[key] += row.amount;
  });

  return {
    labels: Object.keys(buckets),
    values: Object.values(buckets),
  };
}

/* ─────────────────────────────────────────────────────────────────────────────
   4. INIT REVENUE CHART (Chart.js line)
───────────────────────────────────────────────────────────────────────────── */
let revenueChartInstance = null;

async function initRevenueChart(period = 'week') {
  const data = await getRevenueData(period);
  const canvas = document.getElementById('revenue-chart');
  if (!canvas) return;

  if (revenueChartInstance) revenueChartInstance.destroy();

  const ctx = canvas.getContext('2d');

  // Gradient fill
  const gradient = ctx.createLinearGradient(0, 0, 0, 300);
  gradient.addColorStop(0, 'rgba(0,212,255,0.4)');
  gradient.addColorStop(1, 'rgba(0,212,255,0.01)');

  revenueChartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: data.labels,
      datasets: [{
        label: 'Revenue (₹)',
        data: data.values,
        borderColor: '#00d4ff',
        borderWidth: 2.5,
        backgroundColor: gradient,
        pointBackgroundColor: '#00d4ff',
        pointBorderColor: '#050510',
        pointRadius: 5,
        pointHoverRadius: 8,
        fill: true,
        tension: 0.4,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(10,10,26,0.95)',
          borderColor: '#00d4ff',
          borderWidth: 1,
          titleColor: '#00d4ff',
          bodyColor: '#ffffff',
          callbacks: {
            label: ctx => ` ₹${ctx.parsed.y.toLocaleString('en-IN')}`,
          },
        },
      },
      scales: {
        x: {
          grid: { color: 'rgba(255,255,255,0.05)' },
          ticks: { color: 'rgba(255,255,255,0.6)', font: { family: 'Inter', size: 11 } },
        },
        y: {
          grid: { color: 'rgba(255,255,255,0.05)' },
          ticks: {
            color: 'rgba(255,255,255,0.6)',
            font: { family: 'Inter', size: 11 },
            callback: v => '₹' + v.toLocaleString('en-IN'),
          },
        },
      },
    },
  });
}

/* ─────────────────────────────────────────────────────────────────────────────
   5. USER GROWTH DATA + CHART (Chart.js bar)
───────────────────────────────────────────────────────────────────────────── */
let growthChartInstance = null;

async function getUserGrowthData() {
  const db = getClient();
  const since = new Date(Date.now() - 30 * 86400000).toISOString();

  const { data, error } = await db
    .from('profiles')
    .select('created_at')
    .gte('created_at', since)
    .order('created_at', { ascending: true });

  if (error) { console.error('[getUserGrowthData]', error); return { labels: [], values: [] }; }

  const buckets = {};
  for (let i = 29; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000);
    const key = d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
    buckets[key] = 0;
  }
  (data || []).forEach(row => {
    const key = new Date(row.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
    if (key in buckets) buckets[key]++;
  });

  return { labels: Object.keys(buckets), values: Object.values(buckets) };
}

async function initUserGrowthChart() {
  const data = await getUserGrowthData();
  const canvas = document.getElementById('growth-chart');
  if (!canvas) return;

  if (growthChartInstance) growthChartInstance.destroy();

  growthChartInstance = new Chart(canvas.getContext('2d'), {
    type: 'bar',
    data: {
      labels: data.labels,
      datasets: [{
        label: 'New Users',
        data: data.values,
        backgroundColor: 'rgba(177,74,237,0.6)',
        borderColor: '#b14aed',
        borderWidth: 1.5,
        borderRadius: 4,
        hoverBackgroundColor: 'rgba(177,74,237,0.9)',
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(10,10,26,0.95)',
          borderColor: '#b14aed',
          borderWidth: 1,
          titleColor: '#b14aed',
          bodyColor: '#ffffff',
        },
      },
      scales: {
        x: {
          grid: { color: 'rgba(255,255,255,0.04)' },
          ticks: {
            color: 'rgba(255,255,255,0.5)',
            font: { family: 'Inter', size: 10 },
            maxTicksLimit: 10,
          },
        },
        y: {
          grid: { color: 'rgba(255,255,255,0.05)' },
          ticks: {
            color: 'rgba(255,255,255,0.6)',
            font: { family: 'Inter', size: 11 },
            stepSize: 1,
          },
        },
      },
    },
  });
}

/* ─────────────────────────────────────────────────────────────────────────────
   6. GET RECENT ACTIVITY
───────────────────────────────────────────────────────────────────────────── */
async function getRecentActivity(limit = 20) {
  const db = getClient();

  // Pull from multiple event sources and merge
  const [
    { data: payments },
    { data: registrations },
    { data: withdrawals },
  ] = await Promise.all([
    db.from('payments')
      .select('id, user_id, amount, status, type, created_at, profiles(username)')
      .order('created_at', { ascending: false })
      .limit(limit),
    db.from('tournament_registrations')
      .select('id, user_id, tournament_id, created_at, profiles(username), tournaments(title)')
      .order('created_at', { ascending: false })
      .limit(limit),
    db.from('withdrawal_requests')
      .select('id, user_id, amount, status, created_at, profiles(username)')
      .order('created_at', { ascending: false })
      .limit(limit),
  ]);

  const activities = [];

  (payments || []).forEach(p => {
    const user = p.profiles?.username || 'Unknown';
    const icon = p.type === 'deposit' ? '💰' : '🔄';
    const label = p.type === 'deposit' ? 'Deposit' : 'Refund';
    activities.push({
      id: `pay-${p.id}`,
      icon,
      text: `${user} — ${label} ₹${p.amount} [${p.status}]`,
      time: p.created_at,
      color: p.status === 'approved' ? '#00ff88' : p.status === 'rejected' ? '#ff2d78' : '#ffd700',
    });
  });

  (registrations || []).forEach(r => {
    const user = r.profiles?.username || 'Unknown';
    const tourney = r.tournaments?.title || 'Tournament';
    activities.push({
      id: `reg-${r.id}`,
      icon: '🎮',
      text: `${user} joined "${tourney}"`,
      time: r.created_at,
      color: '#00d4ff',
    });
  });

  (withdrawals || []).forEach(w => {
    const user = w.profiles?.username || 'Unknown';
    activities.push({
      id: `wd-${w.id}`,
      icon: '💸',
      text: `${user} — Withdrawal ₹${w.amount} [${w.status}]`,
      time: w.created_at,
      color: w.status === 'approved' ? '#00ff88' : w.status === 'rejected' ? '#ff2d78' : '#ffd700',
    });
  });

  // Sort by time desc, take top N
  activities.sort((a, b) => new Date(b.time) - new Date(a.time));
  return activities.slice(0, limit);
}

/* ─────────────────────────────────────────────────────────────────────────────
   7. RENDER ACTIVITY FEED
───────────────────────────────────────────────────────────────────────────── */
function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1)   return 'just now';
  if (mins < 60)  return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)   return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function renderActivityFeed(activities) {
  const el = document.getElementById('activity-feed');
  if (!el) return;

  if (!activities || activities.length === 0) {
    el.innerHTML = `
      <div class="flex flex-col items-center justify-center py-12 text-center opacity-50">
        <span style="font-size:2.5rem;">📭</span>
        <p class="mt-3 text-sm text-gray-400 font-inter">No recent activity</p>
      </div>`;
    return;
  }

  el.innerHTML = activities.map(act => `
    <div class="flex items-start gap-3 py-3 border-b border-white border-opacity-5 last:border-0 group hover:bg-white hover:bg-opacity-5 px-2 rounded-lg transition-all duration-200">
      <div class="flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-base"
           style="background: rgba(255,255,255,0.06); border: 1px solid ${act.color}33;">
        ${act.icon}
      </div>
      <div class="flex-1 min-w-0">
        <p class="text-sm text-white leading-snug font-inter truncate">${act.text}</p>
        <p class="text-xs mt-0.5" style="color: ${act.color};">${timeAgo(act.time)}</p>
      </div>
    </div>
  `).join('');
}

/* ─────────────────────────────────────────────────────────────────────────────
   8. INIT DASHBOARD  (full page init)
───────────────────────────────────────────────────────────────────────────── */
async function initDashboard() {
  // Role guard
  const ok = await requireAdmin();
  if (!ok) return;

  // Show skeleton loading
  document.querySelectorAll('.stat-skeleton').forEach(el => el.classList.add('animate-pulse'));

  try {
    // Stats
    const stats = await getAdminStats();
    renderStatCards(stats);
    document.querySelectorAll('.stat-skeleton').forEach(el => el.classList.remove('animate-pulse'));

    // Charts
    if (window.Chart) {
      await Promise.all([
        initRevenueChart('week'),
        initUserGrowthChart(),
      ]);
    } else {
      console.warn('[Dashboard] Chart.js not loaded — skipping charts.');
    }

    // Activity feed
    const activities = await getRecentActivity(25);
    renderActivityFeed(activities);

    // Period switcher buttons
    document.querySelectorAll('[data-period]').forEach(btn => {
      btn.addEventListener('click', async () => {
        document.querySelectorAll('[data-period]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        await initRevenueChart(btn.dataset.period);
      });
    });

    // Real-time subscription for activity feed
    const db = getClient();
    db.channel('admin-dashboard')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payments' }, async () => {
        const activities = await getRecentActivity(25);
        renderActivityFeed(activities);
        const stats = await getAdminStats();
        renderStatCards(stats);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'withdrawal_requests' }, async () => {
        const stats = await getAdminStats();
        renderStatCards(stats);
      })
      .subscribe();

  } catch (err) {
    console.error('[initDashboard]', err);
    showToast('Failed to load dashboard data', 'error');
  }
}

/* ─────────────────────────────────────────────────────────────────────────────
   AUTO-INIT
───────────────────────────────────────────────────────────────────────────── */
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initDashboard);
} else {
  initDashboard();
}
