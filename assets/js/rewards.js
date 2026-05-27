/**
 * @file rewards.js
 * @description Gen B Tournaments — Rewards System Module
 * Handles daily check-in streaks, spin wheel, and achievements.
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
   DAILY REWARDS
   ───────────────────────────────────────────────────────────────────────────── */

/**
 * Get daily reward status for a user.
 * @param {string} userId
 * @returns {Promise<{streak: number, todayReward: Object, claimed: boolean, lastClaimed: string|null}>}
 */
async function getDailyRewardStatus(userId) {
  try {
    const { data, error } = await _sb()
      .from('daily_rewards')
      .select('streak, last_claimed_at')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) throw error;

    const now = new Date();
    const lastClaimed = data?.last_claimed_at ? new Date(data.last_claimed_at) : null;

    let streak = data?.streak || 0;
    let claimed = false;

    if (lastClaimed) {
      const diffMs = now - lastClaimed;
      const diffHours = diffMs / (1000 * 60 * 60);

      if (diffHours < 24) {
        // Already claimed today
        claimed = true;
      } else if (diffHours > 48) {
        // Streak broken
        streak = 0;
      }
    }

    const dayIndex = (streak % 7); // 0-based
    const todayReward = GENBCONFIG.dailyRewards[dayIndex] || GENBCONFIG.dailyRewards[0];

    return { streak, todayReward, claimed, lastClaimed: data?.last_claimed_at || null };
  } catch (err) {
    console.error('[getDailyRewardStatus]', err);
    return { streak: 0, todayReward: GENBCONFIG.dailyRewards[0], claimed: false, lastClaimed: null };
  }
}

/**
 * Claim daily reward for a user.
 * @param {string} userId
 * @returns {Promise<{success: boolean, reward: Object|null}>}
 */
async function claimDailyReward(userId) {
  try {
    const status = await getDailyRewardStatus(userId);

    if (status.claimed) {
      showToast('You already claimed today\'s reward. Come back tomorrow! ⏰', 'warning');
      return { success: false, reward: null };
    }

    const newStreak = status.streak + 1;
    const reward = status.todayReward;

    // Upsert daily_rewards record
    const { error: drError } = await _sb()
      .from('daily_rewards')
      .upsert({
        user_id: userId,
        streak: newStreak,
        last_claimed_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });

    if (drError) throw drError;

    // Credit reward
    if (reward.type === 'cash') {
      const { data: wallet } = await _sb().from('wallets').select('bonus_balance').eq('user_id', userId).single();
      await _sb().from('wallets').update({ bonus_balance: (wallet?.bonus_balance || 0) + reward.value }).eq('user_id', userId);
      await _sb().from('transactions').insert({
        user_id: userId,
        type: 'daily',
        amount: reward.value,
        description: `Day ${newStreak} daily reward`,
      });
    } else if (reward.type === 'xp') {
      const { data: userData } = await _sb().from('users').select('xp').eq('id', userId).single();
      await _sb().from('users').update({ xp: (userData?.xp || 0) + reward.value }).eq('id', userId);
    }

    showToast(`🎁 Day ${newStreak} reward claimed: ${reward.reward}!`, 'success');
    return { success: true, reward: { ...reward, day: newStreak } };
  } catch (err) {
    console.error('[claimDailyReward]', err);
    showToast('Failed to claim reward. Try again.', 'error');
    return { success: false, reward: null };
  }
}

/* ─────────────────────────────────────────────────────────────────────────────
   SPIN WHEEL
   ───────────────────────────────────────────────────────────────────────────── */

/**
 * Check if user can spin the wheel.
 * @param {string} userId
 * @returns {Promise<{canSpin: boolean, nextSpinAt: Date|null, hoursLeft: number}>}
 */
async function getSpinStatus(userId) {
  try {
    const { data, error } = await _sb()
      .from('spin_history')
      .select('spun_at')
      .eq('user_id', userId)
      .order('spun_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;

    if (!data) return { canSpin: true, nextSpinAt: null, hoursLeft: 0 };

    const lastSpin = new Date(data.spun_at);
    const cooldownMs = GENBCONFIG.spinWheel.cooldownHours * 60 * 60 * 1000;
    const nextSpinAt = new Date(lastSpin.getTime() + cooldownMs);
    const hoursLeft = Math.max(0, (nextSpinAt - Date.now()) / (1000 * 60 * 60));
    const canSpin = hoursLeft === 0;

    return { canSpin, nextSpinAt: canSpin ? null : nextSpinAt, hoursLeft };
  } catch (err) {
    console.error('[getSpinStatus]', err);
    return { canSpin: false, nextSpinAt: null, hoursLeft: 0 };
  }
}

/**
 * Execute a spin and determine prize via weighted random selection.
 * @param {string} userId
 * @returns {Promise<{success: boolean, prize: Object|null, prizeIndex: number}>}
 */
async function spinWheel(userId) {
  try {
    const status = await getSpinStatus(userId);

    if (!status.canSpin) {
      const h = Math.floor(status.hoursLeft);
      const m = Math.floor((status.hoursLeft - h) * 60);
      showToast(`Next spin available in ${h}h ${m}m ⏳`, 'warning');
      return { success: false, prize: null, prizeIndex: -1 };
    }

    // Weighted random selection
    const prizes = GENBCONFIG.spinWheel.prizes;
    const totalWeight = prizes.reduce((sum, p) => sum + p.probability, 0);
    let rand = Math.random() * totalWeight;
    let prizeIndex = 0;

    for (let i = 0; i < prizes.length; i++) {
      rand -= prizes[i].probability;
      if (rand <= 0) { prizeIndex = i; break; }
    }

    const prize = prizes[prizeIndex];

    // Record spin
    await _sb().from('spin_history').insert({
      user_id: userId,
      prize_index: prizeIndex,
      prize_label: prize.label,
      prize_value: prize.value,
      prize_type: prize.type,
      spun_at: new Date().toISOString(),
    });

    // Credit reward
    if (prize.type === 'cash' && prize.value > 0) {
      const { data: wallet } = await _sb().from('wallets').select('bonus_balance').eq('user_id', userId).single();
      await _sb().from('wallets').update({ bonus_balance: (wallet?.bonus_balance || 0) + prize.value }).eq('user_id', userId);
      await _sb().from('transactions').insert({
        user_id: userId,
        type: 'spin',
        amount: prize.value,
        description: `Spin wheel reward: ${prize.label}`,
      });
    } else if (prize.type === 'xp' && prize.value > 0) {
      const { data: userData } = await _sb().from('users').select('xp').eq('id', userId).single();
      await _sb().from('users').update({ xp: (userData?.xp || 0) + prize.value }).eq('id', userId);
    }

    return { success: true, prize, prizeIndex };
  } catch (err) {
    console.error('[spinWheel]', err);
    showToast('Spin failed. Please try again.', 'error');
    return { success: false, prize: null, prizeIndex: -1 };
  }
}

/* ─────────────────────────────────────────────────────────────────────────────
   ACHIEVEMENTS
   ───────────────────────────────────────────────────────────────────────────── */

/**
 * Fetch achievement progress for a user.
 * @param {string} userId
 * @returns {Promise<Array>}
 */
async function getAchievements(userId) {
  try {
    const { data, error } = await _sb()
      .from('user_achievements')
      .select('*, achievements(*)')
      .eq('user_id', userId);

    if (error) throw error;
    return (data || []).map(ua => ({
      ...ua.achievements,
      progress: ua.progress || 0,
      completed: ua.completed || false,
      completed_at: ua.completed_at,
    }));
  } catch (err) {
    console.error('[getAchievements]', err);
    return [];
  }
}

/**
 * Auto-check and award achievements based on current user stats.
 * @param {string} userId
 * @returns {Promise<Array>} Newly awarded achievements
 */
async function checkAndAwardAchievements(userId) {
  const awarded = [];
  try {
    const { data: userData } = await _sb()
      .from('users')
      .select('xp')
      .eq('id', userId)
      .single();

    const { data: stats } = await _sb()
      .from('match_results')
      .select('placement, kills')
      .eq('user_id', userId);

    const wins = (stats || []).filter(m => m.placement === 1).length;
    const kills = (stats || []).reduce((sum, m) => sum + (m.kills || 0), 0);
    const matches = (stats || []).length;
    const xp = userData?.xp || 0;

    const milestones = [
      { key: 'first_win', check: wins >= 1, label: 'First Win', icon: '🏆' },
      { key: 'ten_wins', check: wins >= 10, label: '10 Wins', icon: '🥇' },
      { key: 'hundred_kills', check: kills >= 100, label: '100 Kills', icon: '💀' },
      { key: 'veteran', check: matches >= 50, label: 'Veteran', icon: '⚔️' },
      { key: 'xp_500', check: xp >= 500, label: 'XP Hunter', icon: '⚡' },
    ];

    for (const m of milestones) {
      if (!m.check) continue;

      const { count } = await _sb()
        .from('user_achievements')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('achievement_key', m.key)
        .eq('completed', true);

      if ((count || 0) > 0) continue;

      await _sb().from('user_achievements').upsert({
        user_id: userId,
        achievement_key: m.key,
        completed: true,
        completed_at: new Date().toISOString(),
        progress: 1,
      }, { onConflict: 'user_id,achievement_key' });

      awarded.push(m);
      showToast(`🏅 Achievement Unlocked: ${m.label}!`, 'success');
    }
  } catch (err) {
    console.error('[checkAndAwardAchievements]', err);
  }
  return awarded;
}

/* ─────────────────────────────────────────────────────────────────────────────
   RENDER FUNCTIONS
   ───────────────────────────────────────────────────────────────────────────── */

/**
 * Renders the SVG spin wheel from GENBCONFIG prizes.
 * @returns {string} SVG markup
 */
function renderSpinWheel() {
  const prizes = GENBCONFIG.spinWheel.prizes;
  const n = prizes.length;
  const anglePerSlice = (2 * Math.PI) / n;
  const cx = 150, cy = 150, r = 140;

  let paths = '';
  let labels = '';

  prizes.forEach((prize, i) => {
    const startAngle = i * anglePerSlice - Math.PI / 2;
    const endAngle = startAngle + anglePerSlice;

    const x1 = cx + r * Math.cos(startAngle);
    const y1 = cy + r * Math.sin(startAngle);
    const x2 = cx + r * Math.cos(endAngle);
    const y2 = cy + r * Math.sin(endAngle);

    const largeArc = anglePerSlice > Math.PI ? 1 : 0;

    paths += `<path d="M${cx},${cy} L${x1},${y1} A${r},${r} 0 ${largeArc},1 ${x2},${y2} Z"
                   fill="${prize.color}" stroke="#050510" stroke-width="2" opacity="0.9"/>`;

    const labelAngle = startAngle + anglePerSlice / 2;
    const lx = cx + (r * 0.65) * Math.cos(labelAngle);
    const ly = cy + (r * 0.65) * Math.sin(labelAngle);
    const degrees = (labelAngle * 180 / Math.PI);

    labels += `<text x="${lx}" y="${ly}" text-anchor="middle" dominant-baseline="middle"
                     font-size="12" font-weight="bold" fill="white" font-family="Rajdhani, sans-serif"
                     transform="rotate(${degrees}, ${lx}, ${ly})">${prize.label}</text>`;
  });

  return `
<svg id="spin-wheel-svg" viewBox="0 0 300 300" width="300" height="300"
     style="filter:drop-shadow(0 0 20px rgba(0,212,255,0.4)); transition:transform 4s cubic-bezier(0.17,0.67,0.12,0.99);">
  <!-- Wheel segments -->
  ${paths}
  ${labels}
  <!-- Center hub -->
  <circle cx="${cx}" cy="${cy}" r="18" fill="#050510" stroke="#00d4ff" stroke-width="3"/>
  <circle cx="${cx}" cy="${cy}" r="8" fill="#00d4ff"/>
  <!-- Pointer -->
  <polygon points="${cx},${cy - r - 10} ${cx - 12},${cy - r + 12} ${cx + 12},${cy - r + 12}"
           fill="#ffd700" stroke="#050510" stroke-width="2"/>
</svg>`.trim();
}

/**
 * Animate the spin wheel to a specific prize index.
 * @param {number} prizeIndex
 * @returns {Promise<void>}
 */
function animateSpin(prizeIndex) {
  return new Promise(resolve => {
    const svg = document.getElementById('spin-wheel-svg');
    if (!svg) { resolve(); return; }

    const n = GENBCONFIG.spinWheel.prizes.length;
    const anglePerSlice = 360 / n;
    const targetAngle = 360 * 8 + (360 - (prizeIndex * anglePerSlice + anglePerSlice / 2));

    svg.style.transition = 'transform 4s cubic-bezier(0.17,0.67,0.12,0.99)';
    svg.style.transform = `rotate(${targetAngle}deg)`;

    setTimeout(resolve, 4200);
  });
}

/**
 * Renders the 7-day streak card grid.
 * @param {{ streak: number, claimed: boolean, todayReward: Object }} status
 * @returns {string}
 */
function renderDailyStreakCards(status) {
  return GENBCONFIG.dailyRewards.map((reward, i) => {
    const day = i + 1;
    const isClaimed = day <= (status.claimed ? status.streak : status.streak - (status.claimed ? 0 : 1)) && status.streak > 0;
    const isToday = day === ((status.streak % 7) || 7);
    const isFuture = !isClaimed && !isToday;

    let cardCls = 'border-white/5 bg-[#0a0a1a]';
    let dayColor = 'text-gray-500';

    if (isClaimed) {
      cardCls = 'border-[#00ff88]/30 bg-[#00ff88]/5';
      dayColor = 'text-[#00ff88]';
    } else if (isToday) {
      cardCls = 'border-[#00d4ff]/50 bg-[#00d4ff]/10 shadow-[0_0_15px_rgba(0,212,255,0.2)]';
      dayColor = 'text-[#00d4ff]';
    }

    return `
<div class="flex flex-col items-center p-3 rounded-xl border transition-all ${cardCls} ${isToday ? 'scale-105' : ''}">
  <span class="text-[10px] font-bold ${dayColor} uppercase tracking-wider mb-1">Day ${day}</span>
  <span class="text-2xl my-1">${isClaimed ? '✅' : reward.type === 'cash' ? '💰' : '⚡'}</span>
  <span class="text-xs font-bold text-white">${reward.reward}</span>
  ${isToday && !status.claimed
    ? `<button id="claim-daily-btn" class="mt-2 text-[10px] px-2 py-1 rounded-full bg-[#00d4ff] text-black font-bold hover:bg-[#00d4ff]/80 transition-colors">CLAIM</button>`
    : isClaimed
      ? `<span class="mt-2 text-[10px] text-[#00ff88]">Claimed</span>`
      : `<span class="mt-2 text-[10px] text-gray-600">Locked</span>`
  }
</div>`.trim();
  }).join('');
}

/* ─────────────────────────────────────────────────────────────────────────────
   PAGE INIT
   ───────────────────────────────────────────────────────────────────────────── */

/**
 * Initialise the rewards page.
 */
async function initRewardsPage() {
  const { data: { user } } = await _sb().auth.getUser();
  if (!user) { window.location.href = '/auth.html'; return; }

  const userId = user.id;

  // ── Daily Rewards ──────────────────────────────────────────
  async function loadDailyRewards() {
    const status = await getDailyRewardStatus(userId);

    const streakCards = document.getElementById('streak-cards');
    if (streakCards) {
      streakCards.innerHTML = renderDailyStreakCards(status);

      // Bind claim button
      const claimBtn = document.getElementById('claim-daily-btn');
      if (claimBtn) {
        claimBtn.addEventListener('click', async () => {
          claimBtn.disabled = true;
          claimBtn.textContent = '...';
          const { success } = await claimDailyReward(userId);
          if (success) await loadDailyRewards();
          else { claimBtn.disabled = false; claimBtn.textContent = 'CLAIM'; }
        });
      }
    }

    const streakCountEl = document.getElementById('current-streak');
    if (streakCountEl) streakCountEl.textContent = `${status.streak} 🔥`;
  }

  // ── Spin Wheel ────────────────────────────────────────────
  const wheelContainer = document.getElementById('spin-wheel-container');
  if (wheelContainer) {
    wheelContainer.innerHTML = renderSpinWheel();
  }

  async function updateSpinStatus() {
    const spinStatus = await getSpinStatus(userId);
    const spinBtn = document.getElementById('spin-btn');
    const spinCooldown = document.getElementById('spin-cooldown');

    if (spinBtn) {
      spinBtn.disabled = !spinStatus.canSpin;
      spinBtn.classList.toggle('opacity-50', !spinStatus.canSpin);
    }

    if (spinCooldown && !spinStatus.canSpin) {
      const h = Math.floor(spinStatus.hoursLeft);
      const m = Math.floor((spinStatus.hoursLeft - h) * 60);
      spinCooldown.textContent = `Next spin: ${h}h ${m}m`;
      spinCooldown.classList.remove('hidden');
    } else if (spinCooldown) {
      spinCooldown.classList.add('hidden');
    }
  }

  const spinBtn = document.getElementById('spin-btn');
  if (spinBtn) {
    spinBtn.addEventListener('click', async () => {
      spinBtn.disabled = true;
      const { success, prize, prizeIndex } = await spinWheel(userId);

      if (success && prizeIndex >= 0) {
        await animateSpin(prizeIndex);

        // Show result modal
        const resultModal = document.getElementById('spin-result-modal');
        const resultText = document.getElementById('spin-result-text');
        if (resultModal) resultModal.classList.remove('hidden');
        if (resultText) {
          resultText.innerHTML = prize.value > 0
            ? `🎉 You won <span class="text-[#ffd700] font-bold text-2xl">${prize.label}</span>!`
            : `😅 Better luck next time!`;
        }

        await updateSpinStatus();
      } else {
        spinBtn.disabled = false;
      }
    });
  }

  // Close spin result modal
  const closeSpinModal = document.getElementById('close-spin-modal');
  if (closeSpinModal) {
    closeSpinModal.addEventListener('click', () => {
      document.getElementById('spin-result-modal')?.classList.add('hidden');
    });
  }

  // ── Achievements ──────────────────────────────────────────
  const achEl = document.getElementById('achievements-list');
  if (achEl) {
    const achievements = await getAchievements(userId);
    if (achievements.length === 0) {
      achEl.innerHTML = `<p class="text-center text-gray-500 text-sm py-6">Play more to unlock achievements!</p>`;
    } else {
      achEl.innerHTML = achievements.map(ach => `
        <div class="flex items-center gap-3 p-3 rounded-xl border border-white/5 bg-[#0a0a1a] ${ach.completed ? 'border-[#ffd700]/20' : ''}">
          <span class="text-2xl flex-shrink-0">${ach.icon || '🎯'}</span>
          <div class="flex-1 min-w-0">
            <p class="text-sm font-semibold text-white">${ach.name || ach.achievement_key}</p>
            <div class="w-full h-1.5 bg-white/5 rounded-full mt-1">
              <div class="h-full rounded-full" style="width:${Math.min(100, ((ach.progress / (ach.target || 1)) * 100)).toFixed(0)}%; background:${ach.completed ? '#ffd700' : '#00d4ff'};"></div>
            </div>
          </div>
          <span class="text-xs ${ach.completed ? 'text-[#ffd700]' : 'text-gray-500'} flex-shrink-0">
            ${ach.completed ? '✓ Done' : `${ach.progress}/${ach.target || 1}`}
          </span>
        </div>`).join('');
    }
  }

  await loadDailyRewards();
  await updateSpinStatus();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initRewardsPage);
} else {
  initRewardsPage();
}
