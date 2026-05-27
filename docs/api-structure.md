# Gen B Tournaments — API Structure

> **Supabase JavaScript SDK v2** Reference  
> All operations use the `supabase` client from `assets/js/supabase.js`

---

## Table of Contents

1. [Client Initialization](#1-client-initialization)
2. [Authentication](#2-authentication)
3. [Profiles](#3-profiles)
4. [Tournaments](#4-tournaments)
5. [Tournament Registrations](#5-tournament-registrations)
6. [Wallets](#6-wallets)
7. [Transactions](#7-transactions)
8. [Payments (Deposits)](#8-payments-deposits)
9. [Withdrawals](#9-withdrawals)
10. [Referrals](#10-referrals)
11. [Daily Rewards](#11-daily-rewards)
12. [Spin Wheel](#12-spin-wheel)
13. [Achievements](#13-achievements)
14. [Clans](#14-clans)
15. [Messages (Chat)](#15-messages-chat)
16. [Announcements](#16-announcements)
17. [Notifications](#17-notifications)
18. [Admin Settings](#18-admin-settings)
19. [Analytics Events](#19-analytics-events)
20. [RPC Functions](#20-rpc-functions)
21. [Realtime Subscriptions](#21-realtime-subscriptions)
22. [Storage Operations](#22-storage-operations)
23. [Error Handling Pattern](#23-error-handling-pattern)

---

## 1. Client Initialization

```javascript
// assets/js/supabase.js
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js';

const supabase = createClient(CONFIG.supabase.url, CONFIG.supabase.anonKey, {
  auth: {
    autoRefreshToken:  true,
    persistSession:    true,
    detectSessionInUrl: true
  },
  realtime: {
    params: { eventsPerSecond: 10 }
  }
});

export default supabase;
```

---

## 2. Authentication

### Sign Up with Email

```javascript
const { data, error } = await supabase.auth.signUp({
  email: 'player@example.com',
  password: 'SecurePass123!',
  options: {
    data: {
      username:    'ProGamer99',
      referred_by: 'ABCD1234'  // Optional referral code
    }
  }
});

if (error) console.error('Signup error:', error.message);
else console.log('User:', data.user);
```

### Sign In with Email

```javascript
const { data, error } = await supabase.auth.signInWithPassword({
  email:    'player@example.com',
  password: 'SecurePass123!'
});

if (error) console.error('Login error:', error.message);
else {
  const user    = data.user;
  const session = data.session;
  console.log('Logged in:', user.id);
}
```

### Sign In with Google OAuth

```javascript
const { data, error } = await supabase.auth.signInWithOAuth({
  provider: 'google',
  options: {
    redirectTo: `${CONFIG.app.url}/profile.html`
  }
});
```

### Sign Out

```javascript
const { error } = await supabase.auth.signOut();
if (!error) window.location.href = '/index.html';
```

### Get Current Session

```javascript
const { data: { session }, error } = await supabase.auth.getSession();
if (!session) {
  // User not logged in
  window.location.href = '/index.html';
}
```

### Get Current User

```javascript
const { data: { user }, error } = await supabase.auth.getUser();
console.log('Current user ID:', user?.id);
```

### Listen for Auth State Changes

```javascript
supabase.auth.onAuthStateChange((event, session) => {
  if (event === 'SIGNED_IN') {
    console.log('User signed in:', session.user.id);
    loadUserData(session.user.id);
  }
  if (event === 'SIGNED_OUT') {
    console.log('User signed out');
    window.location.href = '/index.html';
  }
  if (event === 'TOKEN_REFRESHED') {
    console.log('Token refreshed');
  }
});
```

### Password Reset

```javascript
// Step 1: Send reset email
const { error } = await supabase.auth.resetPasswordForEmail(
  'player@example.com',
  { redirectTo: `${CONFIG.app.url}/reset-password.html` }
);

// Step 2: Update password (on reset-password.html after redirect)
const { error: updateError } = await supabase.auth.updateUser({
  password: 'NewPassword456!'
});
```

### Update Email or Password

```javascript
const { data, error } = await supabase.auth.updateUser({
  email:    'newemail@example.com',
  password: 'NewPassword456!'
});
```

---

## 3. Profiles

### Get Own Profile

```javascript
async function getMyProfile() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (error) throw error;
  return data;
}
```

### Get Profile by Username

```javascript
async function getProfileByUsername(username) {
  const { data, error } = await supabase
    .from('profiles')
    .select(`
      id, username, avatar_url, level, xp,
      total_matches, total_wins, total_kills,
      referral_code, created_at
    `)
    .eq('username', username)
    .single();

  if (error) throw error;
  return data;
}
```

### Update Profile

```javascript
async function updateProfile(updates) {
  const { data: { user } } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from('profiles')
    .update({
      username:      updates.username,
      avatar_url:    updates.avatarUrl,
      game_uid_bgmi: updates.bgmiUid,
      game_uid_ff:   updates.ffUid,
      game_uid_cod:  updates.codUid,
      updated_at:    new Date().toISOString()
    })
    .eq('id', user.id)
    .select()
    .single();

  if (error) throw error;
  return data;
}
```

### Get Leaderboard

```javascript
async function getLeaderboard(limit = 50, page = 0) {
  const { data, error, count } = await supabase
    .from('profiles')
    .select('id, username, avatar_url, level, xp, total_wins, total_kills, total_matches', { count: 'exact' })
    .eq('is_banned', false)
    .order('total_wins', { ascending: false })
    .order('total_kills', { ascending: false })
    .range(page * limit, (page + 1) * limit - 1);

  if (error) throw error;
  return { data, total: count };
}
```

### Search Users (Admin)

```javascript
async function searchUsers(query) {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, username, email, role, is_banned, created_at')
    .or(`username.ilike.%${query}%,email.ilike.%${query}%`)
    .limit(20);

  if (error) throw error;
  return data;
}
```

### Ban User (Admin)

```javascript
async function banUser(userId, reason) {
  const { data, error } = await supabase
    .from('profiles')
    .update({ is_banned: true, ban_reason: reason })
    .eq('id', userId)
    .select()
    .single();

  if (error) throw error;
  return data;
}
```

---

## 4. Tournaments

### Get All Tournaments (with filters)

```javascript
async function getTournaments({ game, status, page = 0, limit = 10 }) {
  let query = supabase
    .from('tournaments')
    .select('*', { count: 'exact' })
    .order('start_time', { ascending: true });

  if (game)   query = query.eq('game', game);
  if (status) query = query.eq('status', status);
  else        query = query.in('status', ['upcoming', 'ongoing']);

  query = query.range(page * limit, (page + 1) * limit - 1);

  const { data, error, count } = await query;
  if (error) throw error;
  return { data, total: count };
}
```

### Get Single Tournament

```javascript
async function getTournament(tournamentId) {
  const { data, error } = await supabase
    .from('tournaments')
    .select(`
      *,
      registrations:tournament_registrations(count)
    `)
    .eq('id', tournamentId)
    .single();

  if (error) throw error;
  return data;
}
```

### Create Tournament (Admin)

```javascript
async function createTournament(tournamentData) {
  const { data: { user } } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from('tournaments')
    .insert({
      name:          tournamentData.name,
      game:          tournamentData.game,
      type:          tournamentData.type,
      entry_fee:     tournamentData.entryFee,
      prize_pool:    tournamentData.prizePool,
      max_slots:     tournamentData.maxSlots,
      start_time:    tournamentData.startTime,
      description:   tournamentData.description,
      rules:         tournamentData.rules,
      prize_1st:     tournamentData.prize1st || 0,
      prize_2nd:     tournamentData.prize2nd || 0,
      prize_3rd:     tournamentData.prize3rd || 0,
      per_kill_bonus: tournamentData.perKillBonus || 0,
      created_by:    user.id
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}
```

### Update Tournament (Admin)

```javascript
async function updateTournament(id, updates) {
  const { data, error } = await supabase
    .from('tournaments')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}
```

### Publish Room Details (Admin)

```javascript
async function publishRoomDetails(tournamentId, roomId, roomPassword) {
  const { data, error } = await supabase
    .from('tournaments')
    .update({
      room_id:        roomId,
      room_password:  roomPassword,
      room_published: true,
      updated_at:     new Date().toISOString()
    })
    .eq('id', tournamentId)
    .select()
    .single();

  if (error) throw error;
  return data;
}
```

### Delete Tournament (Admin)

```javascript
async function deleteTournament(id) {
  const { error } = await supabase
    .from('tournaments')
    .delete()
    .eq('id', id);

  if (error) throw error;
}
```

---

## 5. Tournament Registrations

### Get My Registrations

```javascript
async function getMyRegistrations() {
  const { data: { user } } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from('tournament_registrations')
    .select(`
      *,
      tournament:tournaments(id, name, game, start_time, status, room_id, room_password, room_published)
    `)
    .eq('user_id', user.id)
    .order('joined_at', { ascending: false });

  if (error) throw error;
  return data;
}
```

### Check if Registered

```javascript
async function isRegistered(tournamentId) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;

  const { data, error } = await supabase
    .from('tournament_registrations')
    .select('id')
    .eq('tournament_id', tournamentId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (error) throw error;
  return !!data;
}
```

### Get Tournament Participants (Admin)

```javascript
async function getTournamentParticipants(tournamentId) {
  const { data, error } = await supabase
    .from('tournament_registrations')
    .select(`
      *,
      user:profiles(id, username, avatar_url, game_uid_bgmi, game_uid_ff)
    `)
    .eq('tournament_id', tournamentId)
    .order('joined_at', { ascending: true });

  if (error) throw error;
  return data;
}
```

### Get Tournament Results (Leaderboard)

```javascript
async function getTournamentResults(tournamentId) {
  const { data, error } = await supabase
    .from('tournament_registrations')
    .select(`
      placement, kills, prize_won,
      user:profiles(username, avatar_url)
    `)
    .eq('tournament_id', tournamentId)
    .not('placement', 'is', null)
    .order('placement', { ascending: true });

  if (error) throw error;
  return data;
}
```

---

## 6. Wallets

### Get My Wallet

```javascript
async function getMyWallet() {
  const { data: { user } } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from('wallets')
    .select('*')
    .eq('user_id', user.id)
    .single();

  if (error) throw error;
  return data;
}
```

### Get All Wallets (Admin)

```javascript
async function getAllWallets(page = 0, limit = 50) {
  const { data, error, count } = await supabase
    .from('wallets')
    .select(`
      *,
      user:profiles(username, email)
    `, { count: 'exact' })
    .order('updated_at', { ascending: false })
    .range(page * limit, (page + 1) * limit - 1);

  if (error) throw error;
  return { data, total: count };
}
```

### Admin Credit/Debit Wallet

```javascript
async function adminCreditWallet(userId, amount, walletType = 'bonus', note = '') {
  // Update wallet balance
  const column = `${walletType}_balance`;
  const { data: wallet, error: walletError } = await supabase
    .from('wallets')
    .update({ [column]: supabase.raw(`${column} + ${amount}`) })
    .eq('user_id', userId)
    .select()
    .single();

  if (walletError) throw walletError;

  // Log transaction
  const { error: txError } = await supabase
    .from('transactions')
    .insert({
      user_id:     userId,
      type:        'admin_credit',
      amount:      amount,
      wallet_type: walletType,
      direction:   'credit',
      description: note || 'Admin credit'
    });

  if (txError) throw txError;
  return wallet;
}
```

---

## 7. Transactions

### Get My Transactions

```javascript
async function getMyTransactions(page = 0, limit = 20, filterType = null) {
  const { data: { user } } = await supabase.auth.getUser();

  let query = supabase
    .from('transactions')
    .select('*', { count: 'exact' })
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .range(page * limit, (page + 1) * limit - 1);

  if (filterType) query = query.eq('type', filterType);

  const { data, error, count } = await query;
  if (error) throw error;
  return { data, total: count };
}
```

### Get All Transactions (Admin)

```javascript
async function getAllTransactions(page = 0, limit = 50) {
  const { data, error, count } = await supabase
    .from('transactions')
    .select(`
      *,
      user:profiles(username, email)
    `, { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(page * limit, (page + 1) * limit - 1);

  if (error) throw error;
  return { data, total: count };
}
```

---

## 8. Payments (Deposits)

### Submit Deposit Request

```javascript
async function submitDeposit(amount, utrNumber, screenshotUrl) {
  const { data: { user } } = await supabase.auth.getUser();

  // Check for duplicate UTR
  const { data: existing } = await supabase
    .from('payments')
    .select('id')
    .eq('utr_number', utrNumber)
    .maybeSingle();

  if (existing) throw new Error('This UTR number has already been submitted');

  const { data, error } = await supabase
    .from('payments')
    .insert({
      user_id:        user.id,
      amount:         amount,
      utr_number:     utrNumber,
      screenshot_url: screenshotUrl,
      status:         'pending'
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}
```

### Get My Payments

```javascript
async function getMyPayments() {
  const { data: { user } } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from('payments')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data;
}
```

### Get All Pending Payments (Admin)

```javascript
async function getPendingPayments() {
  const { data, error } = await supabase
    .from('payments')
    .select(`
      *,
      user:profiles(username, email)
    `)
    .eq('status', 'pending')
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data;
}
```

### Reject Payment (Admin)

```javascript
async function rejectPayment(paymentId, reason) {
  const { data: { user } } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from('payments')
    .update({
      status:      'rejected',
      admin_note:  reason,
      verified_by: user.id,
      verified_at: new Date().toISOString()
    })
    .eq('id', paymentId)
    .select()
    .single();

  if (error) throw error;

  // Notify user
  const payment = data;
  await supabase.from('notifications').insert({
    user_id: payment.user_id,
    title:   'Deposit Rejected',
    body:    `Your deposit of ₹${payment.amount} was rejected. Reason: ${reason}`,
    url:     '/wallet.html',
    type:    'payment'
  });

  return data;
}
```

---

## 9. Withdrawals

### Submit Withdrawal Request

```javascript
async function submitWithdrawal(amount, upiId, walletType = 'winning') {
  const { data: { user } } = await supabase.auth.getUser();

  // Verify sufficient balance first
  const { data: wallet } = await supabase
    .from('wallets')
    .select(`${walletType}_balance`)
    .eq('user_id', user.id)
    .single();

  const balance = wallet[`${walletType}_balance`];
  if (balance < amount) throw new Error('Insufficient balance');

  const { data, error } = await supabase
    .from('withdrawals')
    .insert({
      user_id:     user.id,
      amount:      amount,
      upi_id:      upiId,
      wallet_type: walletType,
      status:      'pending'
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}
```

### Get My Withdrawals

```javascript
async function getMyWithdrawals() {
  const { data: { user } } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from('withdrawals')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data;
}
```

### Get All Pending Withdrawals (Admin)

```javascript
async function getPendingWithdrawals() {
  const { data, error } = await supabase
    .from('withdrawals')
    .select(`
      *,
      user:profiles(username, email)
    `)
    .in('status', ['pending', 'approved'])
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data;
}
```

### Reject Withdrawal (Admin)

```javascript
async function rejectWithdrawal(withdrawalId, reason) {
  const { data: { user } } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from('withdrawals')
    .update({
      status:       'rejected',
      admin_note:   reason,
      processed_by: user.id,
      processed_at: new Date().toISOString()
    })
    .eq('id', withdrawalId)
    .select()
    .single();

  if (error) throw error;
  return data;
}
```

---

## 10. Referrals

### Get My Referrals

```javascript
async function getMyReferrals() {
  const { data: { user } } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from('referrals')
    .select(`
      *,
      referred:profiles!referred_id(username, avatar_url, created_at)
    `)
    .eq('referrer_id', user.id)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data;
}
```

### Get Referral Stats

```javascript
async function getReferralStats() {
  const { data: { user } } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from('referrals')
    .select('status, amount_credited')
    .eq('referrer_id', user.id);

  if (error) throw error;

  const total    = data.length;
  const credited = data.filter(r => r.status === 'credited').length;
  const earned   = data.reduce((sum, r) => sum + (r.amount_credited || 0), 0);

  return { total, credited, earned };
}
```

---

## 11. Daily Rewards

### Get Claim Status

```javascript
async function getDailyClaimStatus() {
  const { data: { user } } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from('profiles')
    .select('last_daily_claim_at, current_streak, longest_streak')
    .eq('id', user.id)
    .single();

  if (error) throw error;

  const lastClaim   = data.last_daily_claim_at ? new Date(data.last_daily_claim_at) : null;
  const now         = new Date();
  const hoursSince  = lastClaim ? (now - lastClaim) / (1000 * 60 * 60) : 999;
  const canClaim    = hoursSince >= 20;
  const nextClaimAt = lastClaim ? new Date(lastClaim.getTime() + 24 * 60 * 60 * 1000) : now;

  return {
    canClaim,
    nextClaimAt,
    currentStreak: data.current_streak,
    longestStreak: data.longest_streak,
    hoursSince
  };
}
```

### Get Claim History

```javascript
async function getDailyClaimHistory(limit = 30) {
  const { data: { user } } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from('daily_claim_history')
    .select('*')
    .eq('user_id', user.id)
    .order('claimed_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data;
}
```

---

## 12. Spin Wheel

### Get Spin Status

```javascript
async function getSpinStatus() {
  const { data: { user } } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from('profiles')
    .select('last_spin_at')
    .eq('id', user.id)
    .single();

  const { data: settings } = await supabase
    .from('admin_settings')
    .select('value')
    .eq('key', 'spin_cooldown_hours')
    .single();

  const cooldownHours = parseInt(settings.value) || 24;
  const lastSpin      = profile.last_spin_at ? new Date(profile.last_spin_at) : null;
  const now           = new Date();
  const hoursSince    = lastSpin ? (now - lastSpin) / (1000 * 60 * 60) : 999;
  const canSpin       = hoursSince >= cooldownHours;
  const nextSpinAt    = lastSpin ? new Date(lastSpin.getTime() + cooldownHours * 60 * 60 * 1000) : now;

  return { canSpin, nextSpinAt, cooldownHours };
}
```

### Get Spin History

```javascript
async function getSpinHistory(limit = 20) {
  const { data: { user } } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from('spin_history')
    .select('*')
    .eq('user_id', user.id)
    .order('spun_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data;
}
```

---

## 13. Achievements

### Get All Achievements with User Progress

```javascript
async function getAchievementsWithProgress() {
  const { data: { user } } = await supabase.auth.getUser();

  const { data: achievements } = await supabase
    .from('achievements')
    .select('*')
    .eq('is_active', true)
    .order('requirement_value', { ascending: true });

  const { data: userAchievements } = await supabase
    .from('user_achievements')
    .select('*')
    .eq('user_id', user.id);

  // Merge progress into achievement list
  const progressMap = {};
  userAchievements?.forEach(ua => { progressMap[ua.achievement_id] = ua; });

  return achievements.map(ach => ({
    ...ach,
    progress:     progressMap[ach.id]?.progress || 0,
    completed:    progressMap[ach.id]?.completed || false,
    completedAt:  progressMap[ach.id]?.completed_at || null
  }));
}
```

---

## 14. Clans

### Get All Clans

```javascript
async function getClans(search = '', page = 0, limit = 20) {
  let query = supabase
    .from('clans')
    .select(`
      id, name, tag, description, logo_url,
      total_members, total_wins, created_at,
      leader:profiles!leader_id(username, avatar_url)
    `, { count: 'exact' })
    .eq('is_public', true)
    .order('total_wins', { ascending: false })
    .range(page * limit, (page + 1) * limit - 1);

  if (search) query = query.ilike('name', `%${search}%`);

  const { data, error, count } = await query;
  if (error) throw error;
  return { data, total: count };
}
```

### Create Clan

```javascript
async function createClan(name, tag, description) {
  const { data: { user } } = await supabase.auth.getUser();

  // Create clan
  const { data: clan, error: clanError } = await supabase
    .from('clans')
    .insert({
      name, tag, description,
      leader_id: user.id
    })
    .select()
    .single();

  if (clanError) throw clanError;

  // Add leader as member
  const { error: memberError } = await supabase
    .from('clan_members')
    .insert({ clan_id: clan.id, user_id: user.id, role: 'leader' });

  if (memberError) throw memberError;
  return clan;
}
```

### Join Clan

```javascript
async function joinClan(clanId) {
  const { data: { user } } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from('clan_members')
    .insert({ clan_id: clanId, user_id: user.id, role: 'member' })
    .select()
    .single();

  if (error) throw error;
  return data;
}
```

### Leave Clan

```javascript
async function leaveClan() {
  const { data: { user } } = await supabase.auth.getUser();

  const { error } = await supabase
    .from('clan_members')
    .delete()
    .eq('user_id', user.id);

  if (error) throw error;
}
```

---

## 15. Messages (Chat)

### Get Channel Messages

```javascript
async function getMessages(channelType, channelId, limit = 50) {
  const { data, error } = await supabase
    .from('messages')
    .select(`
      id, text, created_at,
      user:profiles(id, username, avatar_url, role)
    `)
    .eq('channel_type', channelType)
    .eq('channel_id', channelId)
    .eq('is_deleted', false)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data.reverse(); // Chronological order
}
```

### Send Message

```javascript
async function sendMessage(channelType, channelId, text) {
  const { data: { user } } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from('messages')
    .insert({
      channel_type: channelType,
      channel_id:   channelId,
      user_id:      user.id,
      text:         text.trim().substring(0, 500)
    })
    .select(`
      id, text, created_at,
      user:profiles(id, username, avatar_url)
    `)
    .single();

  if (error) throw error;
  return data;
}
```

### Delete Message (Soft Delete)

```javascript
async function deleteMessage(messageId) {
  const { data: { user } } = await supabase.auth.getUser();

  const { error } = await supabase
    .from('messages')
    .update({ is_deleted: true, deleted_by: user.id })
    .eq('id', messageId);

  if (error) throw error;
}
```

---

## 16. Announcements

### Get Active Announcements

```javascript
async function getAnnouncements() {
  const { data, error } = await supabase
    .from('announcements')
    .select('*')
    .eq('is_active', true)
    .or('expires_at.is.null,expires_at.gt.' + new Date().toISOString())
    .order('is_pinned', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data;
}
```

### Create Announcement (Admin)

```javascript
async function createAnnouncement(title, content, type = 'info', expiresAt = null) {
  const { data: { user } } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from('announcements')
    .insert({
      title, content, type,
      expires_at: expiresAt,
      created_by: user.id
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}
```

---

## 17. Notifications

### Get My Notifications

```javascript
async function getNotifications(unreadOnly = false) {
  const { data: { user } } = await supabase.auth.getUser();

  let query = supabase
    .from('notifications')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(50);

  if (unreadOnly) query = query.eq('is_read', false);

  const { data, error } = await query;
  if (error) throw error;
  return data;
}
```

### Mark Notification as Read

```javascript
async function markNotificationRead(notificationId) {
  const { data: { user } } = await supabase.auth.getUser();

  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true, read_at: new Date().toISOString() })
    .eq('id', notificationId)
    .eq('user_id', user.id);

  if (error) throw error;
}
```

### Mark All Notifications Read

```javascript
async function markAllNotificationsRead() {
  const { data: { user } } = await supabase.auth.getUser();

  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true, read_at: new Date().toISOString() })
    .eq('user_id', user.id)
    .eq('is_read', false);

  if (error) throw error;
}
```

### Get Unread Count

```javascript
async function getUnreadNotificationCount() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return 0;

  const { count, error } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('is_read', false);

  if (error) return 0;
  return count;
}
```

### Send Notification to User (Admin)

```javascript
async function sendNotification(userId, title, body, url = null, type = 'general') {
  const { data, error } = await supabase
    .from('notifications')
    .insert({ user_id: userId, title, body, url, type })
    .select()
    .single();

  if (error) throw error;
  return data;
}
```

---

## 18. Admin Settings

### Get Single Setting

```javascript
async function getSetting(key) {
  const { data, error } = await supabase
    .from('admin_settings')
    .select('value')
    .eq('key', key)
    .single();

  if (error) return null;
  return data.value;
}
```

### Get All Settings

```javascript
async function getAllSettings() {
  const { data, error } = await supabase
    .from('admin_settings')
    .select('key, value, description, updated_at')
    .order('key');

  if (error) throw error;

  // Convert to key-value object
  const settings = {};
  data.forEach(row => { settings[row.key] = row.value; });
  return settings;
}
```

### Update Setting (Admin)

```javascript
async function updateSetting(key, value) {
  const { data: { user } } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from('admin_settings')
    .update({ value, updated_by: user.id, updated_at: new Date().toISOString() })
    .eq('key', key)
    .select()
    .single();

  if (error) throw error;
  return data;
}
```

---

## 19. Analytics Events

### Track Event

```javascript
async function trackEvent(eventName, properties = {}) {
  try {
    const { data: { user } } = await supabase.auth.getUser();

    await supabase.from('analytics_events').insert({
      event_name: eventName,
      user_id:    user?.id || null,
      properties: properties,
      page_url:   window.location.href,
      session_id: getSessionId()
    });
  } catch (err) {
    // Silently fail - analytics should never break the app
    console.warn('Analytics error:', err);
  }
}

function getSessionId() {
  let sid = sessionStorage.getItem('session_id');
  if (!sid) {
    sid = crypto.randomUUID();
    sessionStorage.setItem('session_id', sid);
  }
  return sid;
}

// Usage examples
await trackEvent('page_view',           { page: 'tournaments' });
await trackEvent('tournament_join',     { tournament_id: id, fee: 50 });
await trackEvent('deposit_submitted',   { amount: 500 });
await trackEvent('withdrawal_requested',{ amount: 200 });
```

---

## 20. RPC Functions

### join_tournament

```javascript
async function joinTournament(tournamentId) {
  const { data: { user } } = await supabase.auth.getUser();

  const { data, error } = await supabase.rpc('join_tournament', {
    p_tournament_id: tournamentId,
    p_user_id:       user.id
  });

  if (error) throw error;

  // data = { success: bool, registration_id?: string, message?: string, error?: string }
  if (!data.success) throw new Error(data.error);
  return data;
}
```

### claim_daily_reward

```javascript
async function claimDailyReward() {
  const { data: { user } } = await supabase.auth.getUser();

  const { data, error } = await supabase.rpc('claim_daily_reward', {
    p_user_id: user.id
  });

  if (error) throw error;
  if (!data.success) throw new Error(data.error);
  return data;
  // data = { success, day, reward_type, reward_value, streak, message }
}
```

### process_spin

```javascript
async function processSpin() {
  const { data: { user } } = await supabase.auth.getUser();

  const { data, error } = await supabase.rpc('process_spin', {
    p_user_id: user.id
  });

  if (error) throw error;
  if (!data.success) throw new Error(data.error);
  return data;
  // data = { success, prize_label, prize_type, prize_value, message }
}
```

### approve_deposit (Admin)

```javascript
async function approveDeposit(paymentId, amount) {
  const { data: { user } } = await supabase.auth.getUser();

  const { data, error } = await supabase.rpc('approve_deposit', {
    p_payment_id: paymentId,
    p_amount:     amount,
    p_admin_id:   user.id
  });

  if (error) throw error;
  if (!data.success) throw new Error(data.error);
  return data;
}
```

### approve_withdrawal (Admin)

```javascript
async function approveWithdrawal(withdrawalId) {
  const { data: { user } } = await supabase.auth.getUser();

  const { data, error } = await supabase.rpc('approve_withdrawal', {
    p_withdrawal_id: withdrawalId,
    p_admin_id:      user.id
  });

  if (error) throw error;
  if (!data.success) throw new Error(data.error);
  return data;
}
```

### distribute_prizes (Admin)

```javascript
async function distributePrizes(tournamentId, results) {
  const { data: { user } } = await supabase.auth.getUser();

  // results format: [{ user_id, placement, kills }, ...]
  const { data, error } = await supabase.rpc('distribute_prizes', {
    p_tournament_id: tournamentId,
    p_results:       results,
    p_admin_id:      user.id
  });

  if (error) throw error;
  if (!data.success) throw new Error(data.error);
  return data;
  // data = { success, processed, errors, message }
}

// Example usage:
const results = [
  { user_id: 'uuid-1', placement: 1, kills: 8 },
  { user_id: 'uuid-2', placement: 2, kills: 5 },
  { user_id: 'uuid-3', placement: 3, kills: 3 }
];
await distributePrizes('tournament-uuid', results);
```

---

## 21. Realtime Subscriptions

### Subscribe to Tournament Updates

```javascript
function subscribeTournamentUpdates(tournamentId, onUpdate) {
  const channel = supabase
    .channel(`tournament:${tournamentId}`)
    .on(
      'postgres_changes',
      {
        event:  '*',
        schema: 'public',
        table:  'tournaments',
        filter: `id=eq.${tournamentId}`
      },
      (payload) => {
        console.log('Tournament updated:', payload);
        onUpdate(payload.new);
      }
    )
    .on(
      'postgres_changes',
      {
        event:  'INSERT',
        schema: 'public',
        table:  'tournament_registrations',
        filter: `tournament_id=eq.${tournamentId}`
      },
      (payload) => {
        console.log('New participant:', payload.new);
        onUpdate({ type: 'new_participant', data: payload.new });
      }
    )
    .subscribe();

  return channel; // Call supabase.removeChannel(channel) to unsubscribe
}
```

### Subscribe to Notifications

```javascript
function subscribeNotifications(userId, onNotification) {
  const channel = supabase
    .channel(`notifications:${userId}`)
    .on(
      'postgres_changes',
      {
        event:  'INSERT',
        schema: 'public',
        table:  'notifications',
        filter: `user_id=eq.${userId}`
      },
      (payload) => {
        onNotification(payload.new);
      }
    )
    .subscribe();

  return channel;
}
```

### Subscribe to Chat Messages

```javascript
function subscribeChat(channelType, channelId, onMessage) {
  const channel = supabase
    .channel(`chat:${channelType}:${channelId}`)
    .on(
      'postgres_changes',
      {
        event:  'INSERT',
        schema: 'public',
        table:  'messages',
        filter: `channel_type=eq.${channelType}&channel_id=eq.${channelId}`
      },
      async (payload) => {
        // Fetch full message with profile
        const { data } = await supabase
          .from('messages')
          .select('*, user:profiles(id, username, avatar_url)')
          .eq('id', payload.new.id)
          .single();
        onMessage(data);
      }
    )
    .subscribe();

  return channel;
}
```

### Subscribe to Wallet Balance

```javascript
function subscribeWallet(userId, onUpdate) {
  const channel = supabase
    .channel(`wallet:${userId}`)
    .on(
      'postgres_changes',
      {
        event:  'UPDATE',
        schema: 'public',
        table:  'wallets',
        filter: `user_id=eq.${userId}`
      },
      (payload) => {
        onUpdate(payload.new);
      }
    )
    .subscribe();

  return channel;
}
```

### Unsubscribe from Channel

```javascript
async function unsubscribe(channel) {
  await supabase.removeChannel(channel);
}
```

---

## 22. Storage Operations

### Upload Payment Screenshot

```javascript
async function uploadPaymentScreenshot(file) {
  const { data: { user } } = await supabase.auth.getUser();

  const fileExt  = file.name.split('.').pop();
  const fileName = `${user.id}/${Date.now()}.${fileExt}`;

  const { data, error } = await supabase.storage
    .from('payment-proofs')
    .upload(fileName, file, {
      cacheControl: '3600',
      upsert:       false,
      contentType:  file.type
    });

  if (error) throw error;

  // Get signed URL (private bucket)
  const { data: urlData } = await supabase.storage
    .from('payment-proofs')
    .createSignedUrl(fileName, 60 * 60 * 24 * 7); // 7 days

  return urlData.signedUrl;
}
```

### Upload Avatar

```javascript
async function uploadAvatar(file) {
  const { data: { user } } = await supabase.auth.getUser();

  const fileExt  = file.name.split('.').pop();
  const fileName = `${user.id}/avatar.${fileExt}`;

  const { data, error } = await supabase.storage
    .from('avatars')
    .upload(fileName, file, {
      cacheControl: '3600',
      upsert:       true  // Replace existing avatar
    });

  if (error) throw error;

  // Get public URL (public bucket)
  const { data: urlData } = supabase.storage
    .from('avatars')
    .getPublicUrl(fileName);

  // Update profile with new avatar URL
  await supabase
    .from('profiles')
    .update({ avatar_url: urlData.publicUrl })
    .eq('id', user.id);

  return urlData.publicUrl;
}
```

### Upload via Cloudinary (Alternative — No file size limit in Supabase free tier)

```javascript
async function uploadToCloudinary(file) {
  const formData = new FormData();
  formData.append('file',          file);
  formData.append('upload_preset', CONFIG.cloudinary.uploadPreset);
  formData.append('folder',        'genb/payment-proofs');

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${CONFIG.cloudinary.cloudName}/image/upload`,
    { method: 'POST', body: formData }
  );

  if (!response.ok) throw new Error('Cloudinary upload failed');

  const result = await response.json();
  return result.secure_url;
}
```

### Get Signed URL for Private File

```javascript
async function getPaymentScreenshot(filePath) {
  const { data, error } = await supabase.storage
    .from('payment-proofs')
    .createSignedUrl(filePath, 3600); // 1 hour expiry

  if (error) throw error;
  return data.signedUrl;
}
```

### Delete File

```javascript
async function deleteFile(bucket, filePath) {
  const { error } = await supabase.storage
    .from(bucket)
    .remove([filePath]);

  if (error) throw error;
}
```

---

## 23. Error Handling Pattern

### Standard try/catch pattern

```javascript
async function safeApiCall(fn) {
  try {
    const result = await fn();
    return { data: result, error: null };
  } catch (err) {
    console.error('API Error:', err);
    return {
      data:  null,
      error: err.message || 'An unexpected error occurred'
    };
  }
}

// Usage
const { data, error } = await safeApiCall(() => getMyProfile());
if (error) {
  showToast(error, 'error');
} else {
  renderProfile(data);
}
```

### Supabase Error Types

```javascript
// Error codes to handle specifically
const SUPABASE_ERRORS = {
  '23505': 'Duplicate entry — this record already exists',
  '23503': 'Referenced record not found',
  '42501': 'Insufficient permissions',
  'PGRST116': 'No record found',
  'PGRST301': 'Too many rows returned',
  'auth/invalid-email':        'Invalid email address',
  'auth/wrong-password':       'Incorrect password',
  'auth/email-already-in-use': 'Email already registered',
  'auth/user-not-found':       'No account found with this email'
};

function parseError(error) {
  if (!error) return null;
  const code    = error.code || error.error_code;
  const message = SUPABASE_ERRORS[code] || error.message || 'Unknown error';
  return message;
}
```

### Loading State Pattern

```javascript
async function withLoading(loadingEl, fn) {
  if (loadingEl) loadingEl.classList.remove('hidden');
  try {
    return await fn();
  } finally {
    if (loadingEl) loadingEl.classList.add('hidden');
  }
}

// Usage
const submitBtn = document.getElementById('submit-btn');
await withLoading(submitBtn, async () => {
  await joinTournament(tournamentId);
  showToast('Joined tournament!', 'success');
});
```

---

*End of API Structure — Gen B Tournaments*
