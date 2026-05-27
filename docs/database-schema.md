# Gen B Tournaments — Complete Database Schema

> **Supabase Project** | PostgreSQL 15+  
> Last updated: 2026-05-26

---

## Table of Contents

1. [Profiles](#1-profiles)
2. [Tournaments](#2-tournaments)
3. [Tournament Registrations](#3-tournament-registrations)
4. [Wallets](#4-wallets)
5. [Transactions](#5-transactions)
6. [Payments](#6-payments)
7. [Withdrawals](#7-withdrawals)
8. [Referrals](#8-referrals)
9. [Daily Claim History](#9-daily-claim-history)
10. [Spin History](#10-spin-history)
11. [Achievements](#11-achievements)
12. [User Achievements](#12-user-achievements)
13. [Clans](#13-clans)
14. [Clan Members](#14-clan-members)
15. [Messages](#15-messages)
16. [Announcements](#16-announcements)
17. [Notifications](#17-notifications)
18. [Admin Settings](#18-admin-settings)
19. [Analytics Events](#19-analytics-events)
20. [Indexes](#20-indexes)
21. [Row Level Security (RLS) Policies](#21-row-level-security-rls-policies)
22. [RPC Functions](#22-rpc-functions)
23. [Triggers](#23-triggers)

---

## Prerequisites

Run this once before any table creation to enable required extensions:

```sql
-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enable pg_cron for scheduled tasks (optional, Supabase Pro)
-- CREATE EXTENSION IF NOT EXISTS pg_cron;
```

---

## 1. Profiles

Extends Supabase `auth.users`. Created automatically via trigger on new user signup.

```sql
CREATE TABLE public.profiles (
  id                  UUID          REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  username            TEXT          UNIQUE NOT NULL,
  email               TEXT,
  avatar_url          TEXT,
  phone               TEXT,
  game_uid_bgmi       TEXT,
  game_uid_ff         TEXT,
  game_uid_cod        TEXT,
  referral_code       TEXT          UNIQUE,
  referred_by         UUID          REFERENCES public.profiles(id) ON DELETE SET NULL,
  level               INTEGER       DEFAULT 1 CHECK (level >= 1),
  xp                  INTEGER       DEFAULT 0 CHECK (xp >= 0),
  total_matches       INTEGER       DEFAULT 0 CHECK (total_matches >= 0),
  total_wins          INTEGER       DEFAULT 0 CHECK (total_wins >= 0),
  total_kills         INTEGER       DEFAULT 0 CHECK (total_kills >= 0),
  role                TEXT          DEFAULT 'user' CHECK (role IN ('user', 'admin', 'moderator')),
  is_banned           BOOLEAN       DEFAULT false,
  ban_reason          TEXT,
  is_suspended        BOOLEAN       DEFAULT false,
  suspended_until     TIMESTAMPTZ,
  is_verified         BOOLEAN       DEFAULT false,
  onesignal_player_id TEXT,
  last_spin_at        TIMESTAMPTZ,
  last_daily_claim_at TIMESTAMPTZ,
  current_streak      INTEGER       DEFAULT 0,
  longest_streak      INTEGER       DEFAULT 0,
  created_at          TIMESTAMPTZ   DEFAULT NOW(),
  updated_at          TIMESTAMPTZ   DEFAULT NOW()
);

COMMENT ON TABLE public.profiles IS 'Extended user profiles linked to Supabase auth.users';
COMMENT ON COLUMN public.profiles.role IS 'user | admin | moderator';
COMMENT ON COLUMN public.profiles.referral_code IS 'Unique 8-char code generated on signup';
```

---

## 2. Tournaments

```sql
CREATE TABLE public.tournaments (
  id               UUID          DEFAULT uuid_generate_v4() PRIMARY KEY,
  name             TEXT          NOT NULL,
  game             TEXT          NOT NULL CHECK (game IN ('BGMI', 'FreeFire', 'COD', 'Valorant', 'Other')),
  type             TEXT          NOT NULL CHECK (type IN ('Solo', 'Duo', 'Squad')),
  entry_fee        NUMERIC(10,2) DEFAULT 0 CHECK (entry_fee >= 0),
  prize_pool       NUMERIC(10,2) DEFAULT 0 CHECK (prize_pool >= 0),
  max_slots        INTEGER       NOT NULL CHECK (max_slots > 0),
  filled_slots     INTEGER       DEFAULT 0 CHECK (filled_slots >= 0),
  start_time       TIMESTAMPTZ   NOT NULL,
  registration_end TIMESTAMPTZ,
  status           TEXT          DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'ongoing', 'completed', 'cancelled')),
  room_id          TEXT,
  room_password    TEXT,
  room_published   BOOLEAN       DEFAULT false,
  banner_url       TEXT,
  description      TEXT,
  rules            TEXT,
  map              TEXT,
  perspective      TEXT          CHECK (perspective IN ('TPP', 'FPP', NULL)),
  -- Prize distribution
  prize_1st        NUMERIC(10,2) DEFAULT 0,
  prize_2nd        NUMERIC(10,2) DEFAULT 0,
  prize_3rd        NUMERIC(10,2) DEFAULT 0,
  prize_4th        NUMERIC(10,2) DEFAULT 0,
  prize_5th        NUMERIC(10,2) DEFAULT 0,
  prize_6th        NUMERIC(10,2) DEFAULT 0,
  prize_7th        NUMERIC(10,2) DEFAULT 0,
  prize_8th        NUMERIC(10,2) DEFAULT 0,
  prize_9th        NUMERIC(10,2) DEFAULT 0,
  prize_10th       NUMERIC(10,2) DEFAULT 0,
  per_kill_bonus   NUMERIC(10,2) DEFAULT 0,
  -- Meta
  created_by       UUID          REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ   DEFAULT NOW(),
  updated_at       TIMESTAMPTZ   DEFAULT NOW()
);

COMMENT ON TABLE public.tournaments IS 'Tournament listings with full prize and room details';
COMMENT ON COLUMN public.tournaments.room_published IS 'Whether room ID/password is visible to registered players';
COMMENT ON COLUMN public.tournaments.per_kill_bonus IS 'Bonus credits per kill in the match';
```

---

## 3. Tournament Registrations

```sql
CREATE TABLE public.tournament_registrations (
  id              UUID          DEFAULT uuid_generate_v4() PRIMARY KEY,
  tournament_id   UUID          NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  user_id         UUID          NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  team_name       TEXT,
  member_ids      UUID[],         -- For Squad/Duo: array of co-player user IDs
  joined_at       TIMESTAMPTZ   DEFAULT NOW(),
  placement       INTEGER,        -- Final rank (1st, 2nd, etc.)
  kills           INTEGER         DEFAULT 0 CHECK (kills >= 0),
  prize_won       NUMERIC(10,2)   DEFAULT 0,
  status          TEXT            DEFAULT 'registered' CHECK (status IN ('registered', 'playing', 'eliminated', 'disqualified')),
  UNIQUE (tournament_id, user_id)
);

COMMENT ON TABLE public.tournament_registrations IS 'Player registrations per tournament';
COMMENT ON COLUMN public.tournament_registrations.placement IS 'Final rank after tournament; NULL until results published';
```

---

## 4. Wallets

One wallet per user, created automatically on profile creation.

```sql
CREATE TABLE public.wallets (
  id               UUID          DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id          UUID          NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  main_balance     NUMERIC(12,2) DEFAULT 0 CHECK (main_balance >= 0),
  bonus_balance    NUMERIC(12,2) DEFAULT 0 CHECK (bonus_balance >= 0),
  winning_balance  NUMERIC(12,2) DEFAULT 0 CHECK (winning_balance >= 0),
  updated_at       TIMESTAMPTZ   DEFAULT NOW()
);

COMMENT ON TABLE public.wallets IS 'Three-bucket wallet: main (deposited), bonus (promo), winning (prize money)';
COMMENT ON COLUMN public.wallets.main_balance IS 'Deposited real money; can be withdrawn';
COMMENT ON COLUMN public.wallets.bonus_balance IS 'Promotional/referral bonus; not withdrawable';
COMMENT ON COLUMN public.wallets.winning_balance IS 'Tournament prize winnings; withdrawable';
```

---

## 5. Transactions

Immutable ledger of all wallet movements.

```sql
CREATE TABLE public.transactions (
  id            UUID          DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id       UUID          NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type          TEXT          NOT NULL CHECK (type IN (
                  'deposit', 'withdrawal', 'tournament_join', 'tournament_prize',
                  'referral_bonus', 'daily_reward', 'spin_reward', 'refund',
                  'admin_credit', 'admin_debit', 'achievement_reward'
                )),
  amount        NUMERIC(12,2) NOT NULL,
  wallet_type   TEXT          NOT NULL CHECK (wallet_type IN ('main', 'bonus', 'winning')),
  direction     TEXT          NOT NULL CHECK (direction IN ('credit', 'debit')),
  description   TEXT,
  reference_id  UUID,           -- Can point to tournament_id, payment_id, etc.
  status        TEXT          DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'failed', 'reversed')),
  admin_note    TEXT,
  balance_after NUMERIC(12,2),  -- Snapshot of wallet balance after this transaction
  created_at    TIMESTAMPTZ   DEFAULT NOW()
);

COMMENT ON TABLE public.transactions IS 'Immutable audit log of all wallet movements';
```

---

## 6. Payments

Deposit requests submitted by users (UPI screenshot upload).

```sql
CREATE TABLE public.payments (
  id              UUID          DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id         UUID          NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount          NUMERIC(10,2) NOT NULL CHECK (amount > 0),
  utr_number      TEXT          NOT NULL,
  screenshot_url  TEXT          NOT NULL,
  status          TEXT          DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'duplicate')),
  admin_note      TEXT,
  verified_by     UUID          REFERENCES public.profiles(id) ON DELETE SET NULL,
  verified_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ   DEFAULT NOW()
);

COMMENT ON TABLE public.payments IS 'UPI deposit requests pending admin approval';
COMMENT ON COLUMN public.payments.utr_number IS 'Unique Transaction Reference from UPI payment; checked for duplicates';
```

---

## 7. Withdrawals

Withdrawal requests submitted by users.

```sql
CREATE TABLE public.withdrawals (
  id             UUID          DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id        UUID          NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount         NUMERIC(10,2) NOT NULL CHECK (amount > 0),
  upi_id         TEXT          NOT NULL,
  wallet_type    TEXT          DEFAULT 'winning' CHECK (wallet_type IN ('main', 'winning')),
  status         TEXT          DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'processing', 'paid', 'rejected')),
  admin_note     TEXT,
  processed_by   UUID          REFERENCES public.profiles(id) ON DELETE SET NULL,
  processed_at   TIMESTAMPTZ,
  paid_at        TIMESTAMPTZ,
  created_at     TIMESTAMPTZ   DEFAULT NOW()
);

COMMENT ON TABLE public.withdrawals IS 'Withdrawal requests to user UPI IDs';
```

---

## 8. Referrals

```sql
CREATE TABLE public.referrals (
  id               UUID          DEFAULT uuid_generate_v4() PRIMARY KEY,
  referrer_id      UUID          NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  referred_id      UUID          NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount_credited  NUMERIC(10,2) DEFAULT 0,
  status           TEXT          DEFAULT 'pending' CHECK (status IN ('pending', 'credited', 'cancelled')),
  credited_at      TIMESTAMPTZ,
  created_at       TIMESTAMPTZ   DEFAULT NOW()
);

COMMENT ON TABLE public.referrals IS 'Referral tracking; referred_id is unique (one referrer per user)';
```

---

## 9. Daily Claim History

```sql
CREATE TABLE public.daily_claim_history (
  id           UUID          DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id      UUID          NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  day_number   INTEGER       NOT NULL CHECK (day_number BETWEEN 1 AND 7),
  reward_type  TEXT          NOT NULL CHECK (reward_type IN ('coins', 'bonus', 'spin', 'xp', 'item')),
  reward_value NUMERIC(10,2) NOT NULL,
  streak       INTEGER       NOT NULL DEFAULT 1,
  claimed_at   TIMESTAMPTZ   DEFAULT NOW()
);

COMMENT ON TABLE public.daily_claim_history IS '7-day streak reward claim log per user';
```

---

## 10. Spin History

```sql
CREATE TABLE public.spin_history (
  id           UUID          DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id      UUID          NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  prize_label  TEXT          NOT NULL,   -- e.g., "₹10 Bonus", "50 XP", "Try Again"
  prize_type   TEXT          NOT NULL CHECK (prize_type IN ('coins', 'bonus', 'xp', 'spin_token', 'item', 'nothing')),
  prize_value  NUMERIC(10,2) DEFAULT 0,
  spun_at      TIMESTAMPTZ   DEFAULT NOW()
);

COMMENT ON TABLE public.spin_history IS 'Lucky spin wheel result history per user';
```

---

## 11. Achievements

Master list of all achievement definitions.

```sql
CREATE TABLE public.achievements (
  id                  UUID          DEFAULT uuid_generate_v4() PRIMARY KEY,
  code                TEXT          UNIQUE NOT NULL,  -- e.g., 'first_win', 'kill_master_10'
  title               TEXT          NOT NULL,
  description         TEXT          NOT NULL,
  icon                TEXT,                           -- Icon name or URL
  reward_type         TEXT          NOT NULL CHECK (reward_type IN ('xp', 'bonus', 'item', 'badge')),
  reward_value        NUMERIC(10,2) DEFAULT 0,
  requirement_type    TEXT          NOT NULL CHECK (requirement_type IN (
                        'total_wins', 'total_kills', 'total_matches', 'total_tournaments',
                        'referrals', 'streak', 'deposit', 'custom'
                      )),
  requirement_value   INTEGER       NOT NULL,
  is_active           BOOLEAN       DEFAULT true,
  created_at          TIMESTAMPTZ   DEFAULT NOW()
);

COMMENT ON TABLE public.achievements IS 'Achievement definitions; requirement_value is the threshold to unlock';
```

---

## 12. User Achievements

```sql
CREATE TABLE public.user_achievements (
  id              UUID          DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id         UUID          NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  achievement_id  UUID          NOT NULL REFERENCES public.achievements(id) ON DELETE CASCADE,
  progress        INTEGER       DEFAULT 0 CHECK (progress >= 0),
  completed       BOOLEAN       DEFAULT false,
  completed_at    TIMESTAMPTZ,
  UNIQUE (user_id, achievement_id)
);

COMMENT ON TABLE public.user_achievements IS 'Per-user achievement progress tracking';
```

---

## 13. Clans

```sql
CREATE TABLE public.clans (
  id             UUID          DEFAULT uuid_generate_v4() PRIMARY KEY,
  name           TEXT          UNIQUE NOT NULL,
  tag            TEXT          UNIQUE NOT NULL CHECK (char_length(tag) BETWEEN 2 AND 5),
  description    TEXT,
  logo_url       TEXT,
  leader_id      UUID          NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  total_members  INTEGER       DEFAULT 1,
  total_wins     INTEGER       DEFAULT 0,
  total_kills    INTEGER       DEFAULT 0,
  total_prize    NUMERIC(12,2) DEFAULT 0,
  is_public      BOOLEAN       DEFAULT true,
  created_at     TIMESTAMPTZ   DEFAULT NOW(),
  updated_at     TIMESTAMPTZ   DEFAULT NOW()
);

COMMENT ON TABLE public.clans IS 'Player clans/teams';
COMMENT ON COLUMN public.clans.tag IS '2–5 character unique clan tag';
```

---

## 14. Clan Members

```sql
CREATE TABLE public.clan_members (
  id         UUID          DEFAULT uuid_generate_v4() PRIMARY KEY,
  clan_id    UUID          NOT NULL REFERENCES public.clans(id) ON DELETE CASCADE,
  user_id    UUID          NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  role       TEXT          DEFAULT 'member' CHECK (role IN ('leader', 'co-leader', 'member')),
  joined_at  TIMESTAMPTZ   DEFAULT NOW()
);

COMMENT ON TABLE public.clan_members IS 'Clan membership; user can only be in one clan (unique user_id)';
```

---

## 15. Messages

In-app chat (tournament lobby, general, clan channels).

```sql
CREATE TABLE public.messages (
  id            UUID          DEFAULT uuid_generate_v4() PRIMARY KEY,
  channel_type  TEXT          NOT NULL CHECK (channel_type IN ('tournament', 'clan', 'general', 'support')),
  channel_id    TEXT          NOT NULL,   -- tournament_id / clan_id / 'global' / ticket_id
  user_id       UUID          NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  text          TEXT          NOT NULL CHECK (char_length(text) BETWEEN 1 AND 500),
  is_deleted    BOOLEAN       DEFAULT false,
  deleted_by    UUID          REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ   DEFAULT NOW()
);

COMMENT ON TABLE public.messages IS 'Multi-channel in-app chat messages';
```

---

## 16. Announcements

```sql
CREATE TABLE public.announcements (
  id          UUID          DEFAULT uuid_generate_v4() PRIMARY KEY,
  title       TEXT          NOT NULL,
  content     TEXT          NOT NULL,
  type        TEXT          DEFAULT 'info' CHECK (type IN ('info', 'warning', 'success', 'promo')),
  is_active   BOOLEAN       DEFAULT true,
  is_pinned   BOOLEAN       DEFAULT false,
  expires_at  TIMESTAMPTZ,
  created_by  UUID          REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ   DEFAULT NOW(),
  updated_at  TIMESTAMPTZ   DEFAULT NOW()
);

COMMENT ON TABLE public.announcements IS 'Admin-published site-wide announcements/banners';
```

---

## 17. Notifications

```sql
CREATE TABLE public.notifications (
  id          UUID          DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id     UUID          NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title       TEXT          NOT NULL,
  body        TEXT          NOT NULL,
  url         TEXT,           -- Deep link URL on click
  icon        TEXT,           -- Icon type or URL
  type        TEXT          DEFAULT 'general' CHECK (type IN (
                'general', 'tournament', 'payment', 'withdrawal',
                'achievement', 'referral', 'system', 'promo'
              )),
  is_read     BOOLEAN       DEFAULT false,
  read_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ   DEFAULT NOW()
);

COMMENT ON TABLE public.notifications IS 'In-app notifications per user';
```

---

## 18. Admin Settings

Key-value store for dynamic configuration.

```sql
CREATE TABLE public.admin_settings (
  id          UUID          DEFAULT uuid_generate_v4() PRIMARY KEY,
  key         TEXT          UNIQUE NOT NULL,
  value       JSONB         NOT NULL DEFAULT '{}',
  description TEXT,
  updated_by  UUID          REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_at  TIMESTAMPTZ   DEFAULT NOW()
);

COMMENT ON TABLE public.admin_settings IS 'Dynamic key-value config store for runtime settings';

-- Seed default settings
INSERT INTO public.admin_settings (key, value, description) VALUES
  ('qr_code_url',         '"https://example.com/qr.png"',              'UPI QR code image URL for deposits'),
  ('upi_id',              '"yourupi@paytm"',                            'UPI ID displayed on deposit page'),
  ('min_deposit',         '50',                                          'Minimum deposit amount in INR'),
  ('max_deposit',         '10000',                                       'Maximum deposit amount in INR'),
  ('min_withdrawal',      '100',                                         'Minimum withdrawal amount in INR'),
  ('max_withdrawal',      '5000',                                        'Maximum withdrawal amount in INR'),
  ('referral_bonus',      '30',                                          'Bonus amount credited on successful referral'),
  ('spin_cooldown_hours', '24',                                          'Hours between free spins'),
  ('spin_config',         '[{"label":"Try Again","type":"nothing","value":0,"weight":30},{"label":"₹5 Bonus","type":"bonus","value":5,"weight":25},{"label":"₹10 Bonus","type":"bonus","value":10,"weight":15},{"label":"50 XP","type":"xp","value":50,"weight":15},{"label":"₹25 Bonus","type":"bonus","value":25,"weight":8},{"label":"Extra Spin","type":"spin_token","value":1,"weight":5},{"label":"₹50 Bonus","type":"bonus","value":50,"weight":1.5},{"label":"₹100 Bonus","type":"bonus","value":100,"weight":0.5}]', 'Spin wheel segments config JSON'),
  ('daily_rewards',       '[{"day":1,"type":"bonus","value":10},{"day":2,"type":"xp","value":50},{"day":3,"type":"bonus","value":20},{"day":4,"type":"spin","value":1},{"day":5,"type":"bonus","value":30},{"day":6,"type":"xp","value":100},{"day":7,"type":"bonus","value":100}]', '7-day streak reward config'),
  ('maintenance_mode',    'false',                                       'Enable site maintenance mode'),
  ('site_name',           '"Gen B Tournaments"',                        'Platform display name'),
  ('discord_url',         '""',                                         'Discord invite URL'),
  ('instagram_url',       '""',                                         'Instagram profile URL'),
  ('telegram_url',        '""',                                         'Telegram group URL')
ON CONFLICT (key) DO NOTHING;
```

---

## 19. Analytics Events

```sql
CREATE TABLE public.analytics_events (
  id           UUID          DEFAULT uuid_generate_v4() PRIMARY KEY,
  event_name   TEXT          NOT NULL,
  user_id      UUID          REFERENCES public.profiles(id) ON DELETE SET NULL,
  properties   JSONB         DEFAULT '{}',
  page_url     TEXT,
  session_id   TEXT,
  ip_address   INET,
  user_agent   TEXT,
  created_at   TIMESTAMPTZ   DEFAULT NOW()
);

COMMENT ON TABLE public.analytics_events IS 'Custom analytics event log for behavioral tracking';
```

---

## 20. Indexes

```sql
-- profiles
CREATE INDEX idx_profiles_username        ON public.profiles(username);
CREATE INDEX idx_profiles_referral_code   ON public.profiles(referral_code);
CREATE INDEX idx_profiles_role            ON public.profiles(role);
CREATE INDEX idx_profiles_referred_by     ON public.profiles(referred_by);

-- tournaments
CREATE INDEX idx_tournaments_status       ON public.tournaments(status);
CREATE INDEX idx_tournaments_game         ON public.tournaments(game);
CREATE INDEX idx_tournaments_start_time   ON public.tournaments(start_time);
CREATE INDEX idx_tournaments_created_by   ON public.tournaments(created_by);

-- tournament_registrations
CREATE INDEX idx_reg_tournament_id        ON public.tournament_registrations(tournament_id);
CREATE INDEX idx_reg_user_id              ON public.tournament_registrations(user_id);
CREATE INDEX idx_reg_status               ON public.tournament_registrations(status);

-- wallets
CREATE INDEX idx_wallets_user_id          ON public.wallets(user_id);

-- transactions
CREATE INDEX idx_tx_user_id               ON public.transactions(user_id);
CREATE INDEX idx_tx_type                  ON public.transactions(type);
CREATE INDEX idx_tx_created_at            ON public.transactions(created_at DESC);
CREATE INDEX idx_tx_reference_id          ON public.transactions(reference_id);

-- payments
CREATE INDEX idx_payments_user_id         ON public.payments(user_id);
CREATE INDEX idx_payments_status          ON public.payments(status);
CREATE INDEX idx_payments_utr             ON public.payments(utr_number);

-- withdrawals
CREATE INDEX idx_withdrawals_user_id      ON public.withdrawals(user_id);
CREATE INDEX idx_withdrawals_status       ON public.withdrawals(status);

-- referrals
CREATE INDEX idx_referrals_referrer       ON public.referrals(referrer_id);
CREATE INDEX idx_referrals_referred       ON public.referrals(referred_id);

-- daily_claim_history
CREATE INDEX idx_daily_user_id            ON public.daily_claim_history(user_id);
CREATE INDEX idx_daily_claimed_at         ON public.daily_claim_history(claimed_at DESC);

-- spin_history
CREATE INDEX idx_spin_user_id             ON public.spin_history(user_id);
CREATE INDEX idx_spin_spun_at             ON public.spin_history(spun_at DESC);

-- user_achievements
CREATE INDEX idx_ua_user_id               ON public.user_achievements(user_id);
CREATE INDEX idx_ua_achievement_id        ON public.user_achievements(achievement_id);

-- clan_members
CREATE INDEX idx_cm_clan_id               ON public.clan_members(clan_id);

-- messages
CREATE INDEX idx_msg_channel              ON public.messages(channel_type, channel_id);
CREATE INDEX idx_msg_user_id              ON public.messages(user_id);
CREATE INDEX idx_msg_created_at           ON public.messages(created_at DESC);

-- notifications
CREATE INDEX idx_notif_user_id            ON public.notifications(user_id);
CREATE INDEX idx_notif_is_read            ON public.notifications(user_id, is_read);
CREATE INDEX idx_notif_created_at         ON public.notifications(created_at DESC);

-- analytics_events
CREATE INDEX idx_analytics_event_name     ON public.analytics_events(event_name);
CREATE INDEX idx_analytics_user_id        ON public.analytics_events(user_id);
CREATE INDEX idx_analytics_created_at     ON public.analytics_events(created_at DESC);
CREATE INDEX idx_analytics_session        ON public.analytics_events(session_id);
```

---

## 21. Row Level Security (RLS) Policies

### Enable RLS on all tables

```sql
ALTER TABLE public.profiles               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournaments            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournament_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallets                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.withdrawals            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referrals              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_claim_history    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.spin_history           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.achievements           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_achievements      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clans                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clan_members           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcements          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_settings         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analytics_events       ENABLE ROW LEVEL SECURITY;
```

### Helper function: is_admin()

```sql
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_moderator_or_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role IN ('admin', 'moderator')
  );
$$;
```

### profiles

```sql
-- Anyone can read public profiles (for leaderboard, etc.)
CREATE POLICY "profiles_select_public"
  ON public.profiles FOR SELECT
  USING (true);

-- Users can only update their own profile
CREATE POLICY "profiles_update_own"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    -- Prevent role self-elevation
    AND (role = (SELECT role FROM public.profiles WHERE id = auth.uid()))
  );

-- Insert allowed only for own profile (handled by trigger)
CREATE POLICY "profiles_insert_own"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Admins can update any profile (including banning, role changes)
CREATE POLICY "profiles_admin_update"
  ON public.profiles FOR UPDATE
  USING (public.is_admin());

-- Admins can delete profiles
CREATE POLICY "profiles_admin_delete"
  ON public.profiles FOR DELETE
  USING (public.is_admin());
```

### tournaments

```sql
-- All authenticated users can read tournaments
CREATE POLICY "tournaments_select_all"
  ON public.tournaments FOR SELECT
  USING (auth.role() = 'authenticated');

-- Only admins can insert/update/delete tournaments
CREATE POLICY "tournaments_admin_insert"
  ON public.tournaments FOR INSERT
  WITH CHECK (public.is_admin());

CREATE POLICY "tournaments_admin_update"
  ON public.tournaments FOR UPDATE
  USING (public.is_admin());

CREATE POLICY "tournaments_admin_delete"
  ON public.tournaments FOR DELETE
  USING (public.is_admin());
```

### tournament_registrations

```sql
-- Users can read their own registrations; admins can read all
CREATE POLICY "reg_select"
  ON public.tournament_registrations FOR SELECT
  USING (auth.uid() = user_id OR public.is_moderator_or_admin());

-- Users can register themselves (actual deduction handled by RPC)
CREATE POLICY "reg_insert_own"
  ON public.tournament_registrations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Admins can update registrations (publish results)
CREATE POLICY "reg_admin_update"
  ON public.tournament_registrations FOR UPDATE
  USING (public.is_moderator_or_admin());
```

### wallets

```sql
-- Users can read their own wallet
CREATE POLICY "wallet_select_own"
  ON public.wallets FOR SELECT
  USING (auth.uid() = user_id);

-- Admins can read all wallets
CREATE POLICY "wallet_admin_select"
  ON public.wallets FOR SELECT
  USING (public.is_admin());

-- Only backend/RPC (SECURITY DEFINER) should update wallets
-- No direct user UPDATE policy — all updates via RPC functions
CREATE POLICY "wallet_admin_update"
  ON public.wallets FOR UPDATE
  USING (public.is_admin());
```

### transactions

```sql
-- Users can read their own transactions
CREATE POLICY "tx_select_own"
  ON public.transactions FOR SELECT
  USING (auth.uid() = user_id);

-- Admins can read all
CREATE POLICY "tx_admin_select"
  ON public.transactions FOR SELECT
  USING (public.is_admin());

-- No direct inserts — only via RPC SECURITY DEFINER functions
```

### payments

```sql
-- Users can read their own payments
CREATE POLICY "payments_select_own"
  ON public.payments FOR SELECT
  USING (auth.uid() = user_id);

-- Admins can read all payments
CREATE POLICY "payments_admin_select"
  ON public.payments FOR SELECT
  USING (public.is_moderator_or_admin());

-- Users can submit a payment
CREATE POLICY "payments_insert_own"
  ON public.payments FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Only admins can update payment status
CREATE POLICY "payments_admin_update"
  ON public.payments FOR UPDATE
  USING (public.is_admin());
```

### withdrawals

```sql
-- Users can read their own withdrawals
CREATE POLICY "wd_select_own"
  ON public.withdrawals FOR SELECT
  USING (auth.uid() = user_id);

-- Admins can read all
CREATE POLICY "wd_admin_select"
  ON public.withdrawals FOR SELECT
  USING (public.is_moderator_or_admin());

-- Users can submit withdrawal requests
CREATE POLICY "wd_insert_own"
  ON public.withdrawals FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Only admins can update status
CREATE POLICY "wd_admin_update"
  ON public.withdrawals FOR UPDATE
  USING (public.is_admin());
```

### referrals

```sql
-- Users can view referrals where they are the referrer
CREATE POLICY "ref_select_own"
  ON public.referrals FOR SELECT
  USING (auth.uid() = referrer_id OR public.is_admin());

-- Inserts via RPC only
```

### daily_claim_history

```sql
CREATE POLICY "daily_select_own"
  ON public.daily_claim_history FOR SELECT
  USING (auth.uid() = user_id OR public.is_admin());

-- Inserts via RPC only
```

### spin_history

```sql
CREATE POLICY "spin_select_own"
  ON public.spin_history FOR SELECT
  USING (auth.uid() = user_id OR public.is_admin());

-- Inserts via RPC only
```

### achievements

```sql
-- Anyone can read achievements definitions
CREATE POLICY "achievements_select_all"
  ON public.achievements FOR SELECT
  USING (true);

-- Only admins can manage achievements
CREATE POLICY "achievements_admin_write"
  ON public.achievements FOR ALL
  USING (public.is_admin());
```

### user_achievements

```sql
CREATE POLICY "ua_select_own"
  ON public.user_achievements FOR SELECT
  USING (auth.uid() = user_id OR public.is_admin());

CREATE POLICY "ua_admin_write"
  ON public.user_achievements FOR ALL
  USING (public.is_admin());
```

### clans

```sql
-- Anyone can read public clans
CREATE POLICY "clans_select_public"
  ON public.clans FOR SELECT
  USING (is_public = true OR public.is_admin());

-- Authenticated users can create clans
CREATE POLICY "clans_insert_auth"
  ON public.clans FOR INSERT
  WITH CHECK (auth.uid() = leader_id);

-- Leader or admin can update clan
CREATE POLICY "clans_update_leader"
  ON public.clans FOR UPDATE
  USING (auth.uid() = leader_id OR public.is_admin());

-- Only admin can delete clans
CREATE POLICY "clans_admin_delete"
  ON public.clans FOR DELETE
  USING (public.is_admin());
```

### clan_members

```sql
CREATE POLICY "cm_select_all"
  ON public.clan_members FOR SELECT
  USING (true);

CREATE POLICY "cm_insert_own"
  ON public.clan_members FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "cm_admin_manage"
  ON public.clan_members FOR ALL
  USING (public.is_admin());
```

### messages

```sql
-- Authenticated users can read messages in channels they belong to
CREATE POLICY "msg_select_auth"
  ON public.messages FOR SELECT
  USING (auth.role() = 'authenticated' AND is_deleted = false);

-- Authenticated users can post messages
CREATE POLICY "msg_insert_own"
  ON public.messages FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can soft-delete their own messages; mods can delete any
CREATE POLICY "msg_delete_own_or_mod"
  ON public.messages FOR UPDATE
  USING (auth.uid() = user_id OR public.is_moderator_or_admin());
```

### announcements

```sql
-- Anyone can read active announcements
CREATE POLICY "ann_select_active"
  ON public.announcements FOR SELECT
  USING (is_active = true OR public.is_admin());

-- Only admins can write
CREATE POLICY "ann_admin_write"
  ON public.announcements FOR ALL
  USING (public.is_admin());
```

### notifications

```sql
CREATE POLICY "notif_select_own"
  ON public.notifications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "notif_update_own"
  ON public.notifications FOR UPDATE
  USING (auth.uid() = user_id);

-- Admins can insert notifications for any user
CREATE POLICY "notif_admin_write"
  ON public.notifications FOR ALL
  USING (public.is_admin());
```

### admin_settings

```sql
-- All authenticated users can read settings (needed for QR code, UPI ID, etc.)
CREATE POLICY "settings_select_auth"
  ON public.admin_settings FOR SELECT
  USING (auth.role() = 'authenticated');

-- Only admins can write settings
CREATE POLICY "settings_admin_write"
  ON public.admin_settings FOR ALL
  USING (public.is_admin());
```

### analytics_events

```sql
-- Users can only read their own events; admins can read all
CREATE POLICY "analytics_select"
  ON public.analytics_events FOR SELECT
  USING (auth.uid() = user_id OR public.is_admin());

-- Any authenticated user can insert analytics events
CREATE POLICY "analytics_insert"
  ON public.analytics_events FOR INSERT
  WITH CHECK (true);
```

---

## 22. RPC Functions

All functions use `SECURITY DEFINER` to bypass RLS for atomic wallet operations.

### join_tournament

Atomic: validate eligibility → deduct entry fee → insert registration → increment filled_slots.

```sql
CREATE OR REPLACE FUNCTION public.join_tournament(
  p_tournament_id UUID,
  p_user_id       UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tournament    RECORD;
  v_wallet        RECORD;
  v_reg_exists    BOOLEAN;
  v_balance_after NUMERIC;
  v_reg_id        UUID;
BEGIN
  -- 1. Lock and fetch tournament
  SELECT * INTO v_tournament
  FROM public.tournaments
  WHERE id = p_tournament_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Tournament not found');
  END IF;

  IF v_tournament.status != 'upcoming' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Tournament is not accepting registrations');
  END IF;

  IF v_tournament.filled_slots >= v_tournament.max_slots THEN
    RETURN jsonb_build_object('success', false, 'error', 'Tournament is full');
  END IF;

  -- 2. Check if already registered
  SELECT EXISTS (
    SELECT 1 FROM public.tournament_registrations
    WHERE tournament_id = p_tournament_id AND user_id = p_user_id
  ) INTO v_reg_exists;

  IF v_reg_exists THEN
    RETURN jsonb_build_object('success', false, 'error', 'Already registered for this tournament');
  END IF;

  -- 3. Check if user is banned or suspended
  IF EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = p_user_id AND (is_banned = true OR (is_suspended = true AND suspended_until > NOW()))
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Account is banned or suspended');
  END IF;

  -- 4. If paid tournament, deduct fee from wallet
  IF v_tournament.entry_fee > 0 THEN
    SELECT * INTO v_wallet
    FROM public.wallets
    WHERE user_id = p_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RETURN jsonb_build_object('success', false, 'error', 'Wallet not found');
    END IF;

    -- Try main_balance first, then winning_balance, then bonus_balance
    IF v_wallet.main_balance >= v_tournament.entry_fee THEN
      v_balance_after := v_wallet.main_balance - v_tournament.entry_fee;
      UPDATE public.wallets
      SET main_balance = main_balance - v_tournament.entry_fee, updated_at = NOW()
      WHERE user_id = p_user_id;

      INSERT INTO public.transactions (user_id, type, amount, wallet_type, direction, description, reference_id, balance_after)
      VALUES (p_user_id, 'tournament_join', v_tournament.entry_fee, 'main', 'debit',
              'Entry fee: ' || v_tournament.name, p_tournament_id, v_balance_after);

    ELSIF v_wallet.winning_balance >= v_tournament.entry_fee THEN
      v_balance_after := v_wallet.winning_balance - v_tournament.entry_fee;
      UPDATE public.wallets
      SET winning_balance = winning_balance - v_tournament.entry_fee, updated_at = NOW()
      WHERE user_id = p_user_id;

      INSERT INTO public.transactions (user_id, type, amount, wallet_type, direction, description, reference_id, balance_after)
      VALUES (p_user_id, 'tournament_join', v_tournament.entry_fee, 'winning', 'debit',
              'Entry fee: ' || v_tournament.name, p_tournament_id, v_balance_after);

    ELSIF (v_wallet.main_balance + v_wallet.winning_balance + v_wallet.bonus_balance) >= v_tournament.entry_fee THEN
      -- Deduct from bonus as last resort
      v_balance_after := v_wallet.bonus_balance - v_tournament.entry_fee;
      UPDATE public.wallets
      SET bonus_balance = bonus_balance - v_tournament.entry_fee, updated_at = NOW()
      WHERE user_id = p_user_id;

      INSERT INTO public.transactions (user_id, type, amount, wallet_type, direction, description, reference_id, balance_after)
      VALUES (p_user_id, 'tournament_join', v_tournament.entry_fee, 'bonus', 'debit',
              'Entry fee: ' || v_tournament.name, p_tournament_id, v_balance_after);
    ELSE
      RETURN jsonb_build_object('success', false, 'error', 'Insufficient balance');
    END IF;
  END IF;

  -- 5. Insert registration
  INSERT INTO public.tournament_registrations (tournament_id, user_id)
  VALUES (p_tournament_id, p_user_id)
  RETURNING id INTO v_reg_id;

  -- 6. Increment filled_slots
  UPDATE public.tournaments
  SET filled_slots = filled_slots + 1, updated_at = NOW()
  WHERE id = p_tournament_id;

  -- 7. Update user stats
  UPDATE public.profiles
  SET total_matches = total_matches + 1, updated_at = NOW()
  WHERE id = p_user_id;

  -- 8. Insert notification
  INSERT INTO public.notifications (user_id, title, body, url, type)
  VALUES (p_user_id,
          'Tournament Joined!',
          'You have successfully joined ' || v_tournament.name || '. Good luck!',
          '/tournaments.html',
          'tournament');

  RETURN jsonb_build_object(
    'success', true,
    'registration_id', v_reg_id,
    'message', 'Successfully joined tournament'
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;
```

---

### claim_daily_reward

Atomic: check last claim date → validate 24h cooldown → determine streak → credit reward.

```sql
CREATE OR REPLACE FUNCTION public.claim_daily_reward(
  p_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile       RECORD;
  v_rewards       JSONB;
  v_day_number    INTEGER;
  v_reward        JSONB;
  v_reward_type   TEXT;
  v_reward_value  NUMERIC;
  v_new_streak    INTEGER;
  v_hours_since   NUMERIC;
BEGIN
  -- 1. Lock user profile
  SELECT * INTO v_profile
  FROM public.profiles
  WHERE id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'User not found');
  END IF;

  -- 2. Check 24h cooldown
  IF v_profile.last_daily_claim_at IS NOT NULL THEN
    v_hours_since := EXTRACT(EPOCH FROM (NOW() - v_profile.last_daily_claim_at)) / 3600;
    IF v_hours_since < 20 THEN  -- 20h minimum to allow timezone flexibility
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Already claimed today',
        'next_claim_at', v_profile.last_daily_claim_at + INTERVAL '24 hours'
      );
    END IF;
  END IF;

  -- 3. Determine streak
  IF v_profile.last_daily_claim_at IS NULL OR v_hours_since > 48 THEN
    -- Reset streak
    v_new_streak := 1;
  ELSE
    v_new_streak := (v_profile.current_streak % 7) + 1;
  END IF;

  v_day_number := v_new_streak;

  -- 4. Get rewards config from admin_settings
  SELECT value INTO v_rewards
  FROM public.admin_settings
  WHERE key = 'daily_rewards';

  -- 5. Find today's reward
  SELECT elem INTO v_reward
  FROM jsonb_array_elements(v_rewards) AS elem
  WHERE (elem->>'day')::INTEGER = v_day_number
  LIMIT 1;

  IF v_reward IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Reward config not found');
  END IF;

  v_reward_type  := v_reward->>'type';
  v_reward_value := (v_reward->>'value')::NUMERIC;

  -- 6. Credit reward to wallet
  IF v_reward_type = 'bonus' THEN
    UPDATE public.wallets
    SET bonus_balance = bonus_balance + v_reward_value, updated_at = NOW()
    WHERE user_id = p_user_id;

    INSERT INTO public.transactions (user_id, type, amount, wallet_type, direction, description)
    VALUES (p_user_id, 'daily_reward', v_reward_value, 'bonus', 'credit',
            'Day ' || v_day_number || ' daily login reward');

  ELSIF v_reward_type = 'xp' THEN
    UPDATE public.profiles
    SET xp = xp + v_reward_value::INTEGER, updated_at = NOW()
    WHERE id = p_user_id;

  ELSIF v_reward_type = 'spin' THEN
    -- Grant extra spin token (tracked via spin_history or separate mechanism)
    INSERT INTO public.spin_history (user_id, prize_label, prize_type, prize_value)
    VALUES (p_user_id, 'Daily Reward Spin', 'spin_token', 1);
  END IF;

  -- 7. Update profile streak
  UPDATE public.profiles
  SET
    current_streak      = v_new_streak,
    longest_streak      = GREATEST(longest_streak, v_new_streak),
    last_daily_claim_at = NOW(),
    xp                  = CASE WHEN v_reward_type = 'xp' THEN xp + v_reward_value::INTEGER ELSE xp END,
    updated_at          = NOW()
  WHERE id = p_user_id;

  -- 8. Log claim
  INSERT INTO public.daily_claim_history (user_id, day_number, reward_type, reward_value, streak)
  VALUES (p_user_id, v_day_number, v_reward_type, v_reward_value, v_new_streak);

  -- 9. Notification
  INSERT INTO public.notifications (user_id, title, body, type)
  VALUES (p_user_id,
          'Daily Reward Claimed! 🎁',
          'Day ' || v_day_number || ' reward: ' || v_reward_value || ' ' || v_reward_type || '. Keep your streak going!',
          'general');

  RETURN jsonb_build_object(
    'success',       true,
    'day',           v_day_number,
    'reward_type',   v_reward_type,
    'reward_value',  v_reward_value,
    'streak',        v_new_streak,
    'message',       'Reward claimed successfully!'
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;
```

---

### process_spin

Atomic: check cooldown → weighted random spin → credit prize.

```sql
CREATE OR REPLACE FUNCTION public.process_spin(
  p_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile        RECORD;
  v_spin_config    JSONB;
  v_cooldown_hours INTEGER;
  v_hours_since    NUMERIC;
  v_total_weight   NUMERIC := 0;
  v_random         NUMERIC;
  v_cumulative     NUMERIC := 0;
  v_segment        JSONB;
  v_selected       JSONB;
  v_prize_label    TEXT;
  v_prize_type     TEXT;
  v_prize_value    NUMERIC;
BEGIN
  -- 1. Lock user profile
  SELECT * INTO v_profile
  FROM public.profiles
  WHERE id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'User not found');
  END IF;

  -- 2. Get cooldown config
  SELECT (value::TEXT)::INTEGER INTO v_cooldown_hours
  FROM public.admin_settings
  WHERE key = 'spin_cooldown_hours';

  v_cooldown_hours := COALESCE(v_cooldown_hours, 24);

  -- 3. Check cooldown
  IF v_profile.last_spin_at IS NOT NULL THEN
    v_hours_since := EXTRACT(EPOCH FROM (NOW() - v_profile.last_spin_at)) / 3600;
    IF v_hours_since < v_cooldown_hours THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Spin cooldown active',
        'next_spin_at', v_profile.last_spin_at + (v_cooldown_hours || ' hours')::INTERVAL
      );
    END IF;
  END IF;

  -- 4. Get spin config
  SELECT value INTO v_spin_config
  FROM public.admin_settings
  WHERE key = 'spin_config';

  -- 5. Calculate total weight
  FOR v_segment IN SELECT * FROM jsonb_array_elements(v_spin_config)
  LOOP
    v_total_weight := v_total_weight + (v_segment->>'weight')::NUMERIC;
  END LOOP;

  -- 6. Weighted random selection
  v_random := random() * v_total_weight;

  FOR v_segment IN SELECT * FROM jsonb_array_elements(v_spin_config)
  LOOP
    v_cumulative := v_cumulative + (v_segment->>'weight')::NUMERIC;
    IF v_random <= v_cumulative AND v_selected IS NULL THEN
      v_selected := v_segment;
    END IF;
  END LOOP;

  IF v_selected IS NULL THEN
    v_selected := v_spin_config->0;
  END IF;

  v_prize_label := v_selected->>'label';
  v_prize_type  := v_selected->>'type';
  v_prize_value := (v_selected->>'value')::NUMERIC;

  -- 7. Credit prize
  IF v_prize_type = 'bonus' AND v_prize_value > 0 THEN
    UPDATE public.wallets
    SET bonus_balance = bonus_balance + v_prize_value, updated_at = NOW()
    WHERE user_id = p_user_id;

    INSERT INTO public.transactions (user_id, type, amount, wallet_type, direction, description)
    VALUES (p_user_id, 'spin_reward', v_prize_value, 'bonus', 'credit', 'Spin reward: ' || v_prize_label);

  ELSIF v_prize_type = 'xp' AND v_prize_value > 0 THEN
    UPDATE public.profiles
    SET xp = xp + v_prize_value::INTEGER, updated_at = NOW()
    WHERE id = p_user_id;

  ELSIF v_prize_type = 'coins' AND v_prize_value > 0 THEN
    UPDATE public.wallets
    SET main_balance = main_balance + v_prize_value, updated_at = NOW()
    WHERE user_id = p_user_id;

    INSERT INTO public.transactions (user_id, type, amount, wallet_type, direction, description)
    VALUES (p_user_id, 'spin_reward', v_prize_value, 'main', 'credit', 'Spin reward: ' || v_prize_label);
  END IF;

  -- 8. Update last_spin_at on profile
  UPDATE public.profiles
  SET last_spin_at = NOW(), updated_at = NOW()
  WHERE id = p_user_id;

  -- 9. Log spin result
  INSERT INTO public.spin_history (user_id, prize_label, prize_type, prize_value)
  VALUES (p_user_id, v_prize_label, v_prize_type, v_prize_value);

  RETURN jsonb_build_object(
    'success',      true,
    'prize_label',  v_prize_label,
    'prize_type',   v_prize_type,
    'prize_value',  v_prize_value,
    'message',      'You won: ' || v_prize_label
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;
```

---

### approve_deposit

Atomic: validate no duplicate UTR → credit wallet → update payment status → log transaction.

```sql
CREATE OR REPLACE FUNCTION public.approve_deposit(
  p_payment_id UUID,
  p_amount     NUMERIC,
  p_admin_id   UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_payment       RECORD;
  v_balance_after NUMERIC;
BEGIN
  -- 1. Verify caller is admin
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_admin_id AND role = 'admin') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: Admins only');
  END IF;

  -- 2. Lock and fetch payment
  SELECT * INTO v_payment
  FROM public.payments
  WHERE id = p_payment_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Payment not found');
  END IF;

  IF v_payment.status != 'pending' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Payment already processed: ' || v_payment.status);
  END IF;

  -- 3. Check for duplicate UTR
  IF EXISTS (
    SELECT 1 FROM public.payments
    WHERE utr_number = v_payment.utr_number
      AND id != p_payment_id
      AND status = 'approved'
  ) THEN
    UPDATE public.payments
    SET status = 'duplicate', admin_note = 'Duplicate UTR detected', verified_by = p_admin_id, verified_at = NOW()
    WHERE id = p_payment_id;

    RETURN jsonb_build_object('success', false, 'error', 'Duplicate UTR number detected');
  END IF;

  -- 4. Credit main_balance
  UPDATE public.wallets
  SET main_balance = main_balance + p_amount, updated_at = NOW()
  WHERE user_id = v_payment.user_id
  RETURNING main_balance INTO v_balance_after;

  -- 5. Log transaction
  INSERT INTO public.transactions (user_id, type, amount, wallet_type, direction, description, reference_id, balance_after)
  VALUES (v_payment.user_id, 'deposit', p_amount, 'main', 'credit',
          'Deposit approved (UTR: ' || v_payment.utr_number || ')', p_payment_id, v_balance_after);

  -- 6. Update payment record
  UPDATE public.payments
  SET status = 'approved', verified_by = p_admin_id, verified_at = NOW(), amount = p_amount
  WHERE id = p_payment_id;

  -- 7. Notification to user
  INSERT INTO public.notifications (user_id, title, body, url, type)
  VALUES (v_payment.user_id,
          'Deposit Approved! 💰',
          '₹' || p_amount || ' has been credited to your wallet.',
          '/wallet.html',
          'payment');

  -- 8. Credit referral bonus if first deposit
  PERFORM public.credit_referral_bonus(v_payment.user_id);

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Deposit approved and wallet credited',
    'amount',  p_amount
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;
```

---

### approve_withdrawal

Atomic: validate → deduct wallet → mark as paid.

```sql
CREATE OR REPLACE FUNCTION public.approve_withdrawal(
  p_withdrawal_id UUID,
  p_admin_id      UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_wd            RECORD;
  v_wallet        RECORD;
  v_balance_after NUMERIC;
BEGIN
  -- 1. Admin check
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_admin_id AND role = 'admin') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
  END IF;

  -- 2. Lock withdrawal record
  SELECT * INTO v_wd
  FROM public.withdrawals
  WHERE id = p_withdrawal_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Withdrawal not found');
  END IF;

  IF v_wd.status NOT IN ('pending', 'approved') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Withdrawal already processed: ' || v_wd.status);
  END IF;

  -- 3. Lock wallet and verify balance
  SELECT * INTO v_wallet
  FROM public.wallets
  WHERE user_id = v_wd.user_id
  FOR UPDATE;

  IF v_wd.wallet_type = 'winning' THEN
    IF v_wallet.winning_balance < v_wd.amount THEN
      RETURN jsonb_build_object('success', false, 'error', 'Insufficient winning balance');
    END IF;
    UPDATE public.wallets
    SET winning_balance = winning_balance - v_wd.amount, updated_at = NOW()
    WHERE user_id = v_wd.user_id
    RETURNING winning_balance INTO v_balance_after;

  ELSE -- main
    IF v_wallet.main_balance < v_wd.amount THEN
      RETURN jsonb_build_object('success', false, 'error', 'Insufficient main balance');
    END IF;
    UPDATE public.wallets
    SET main_balance = main_balance - v_wd.amount, updated_at = NOW()
    WHERE user_id = v_wd.user_id
    RETURNING main_balance INTO v_balance_after;
  END IF;

  -- 4. Log transaction
  INSERT INTO public.transactions (user_id, type, amount, wallet_type, direction, description, reference_id, balance_after)
  VALUES (v_wd.user_id, 'withdrawal', v_wd.amount, v_wd.wallet_type, 'debit',
          'Withdrawal to UPI: ' || v_wd.upi_id, p_withdrawal_id, v_balance_after);

  -- 5. Mark withdrawal as paid
  UPDATE public.withdrawals
  SET status = 'paid', processed_by = p_admin_id, processed_at = NOW(), paid_at = NOW()
  WHERE id = p_withdrawal_id;

  -- 6. Notify user
  INSERT INTO public.notifications (user_id, title, body, url, type)
  VALUES (v_wd.user_id,
          'Withdrawal Successful! 🎉',
          '₹' || v_wd.amount || ' has been sent to your UPI ID (' || v_wd.upi_id || ').',
          '/wallet.html',
          'withdrawal');

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Withdrawal processed successfully',
    'amount',  v_wd.amount
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;
```

---

### distribute_prizes

Bulk prize credit from tournament results JSONB array.

```sql
CREATE OR REPLACE FUNCTION public.distribute_prizes(
  p_tournament_id UUID,
  p_results       JSONB,   -- Array: [{"user_id": "...", "placement": 1, "kills": 5}, ...]
  p_admin_id      UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tournament    RECORD;
  v_result        JSONB;
  v_user_id       UUID;
  v_placement     INTEGER;
  v_kills         INTEGER;
  v_prize_amount  NUMERIC;
  v_kill_bonus    NUMERIC;
  v_total_prize   NUMERIC;
  v_count         INTEGER := 0;
  v_errors        JSONB   := '[]'::JSONB;
BEGIN
  -- 1. Admin check
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_admin_id AND role = 'admin') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
  END IF;

  -- 2. Fetch tournament
  SELECT * INTO v_tournament
  FROM public.tournaments
  WHERE id = p_tournament_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Tournament not found');
  END IF;

  IF v_tournament.status = 'completed' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Prizes already distributed');
  END IF;

  -- 3. Process each result
  FOR v_result IN SELECT * FROM jsonb_array_elements(p_results)
  LOOP
    BEGIN
      v_user_id   := (v_result->>'user_id')::UUID;
      v_placement := (v_result->>'placement')::INTEGER;
      v_kills     := COALESCE((v_result->>'kills')::INTEGER, 0);

      -- Determine prize by placement
      v_prize_amount := CASE v_placement
        WHEN 1  THEN v_tournament.prize_1st
        WHEN 2  THEN v_tournament.prize_2nd
        WHEN 3  THEN v_tournament.prize_3rd
        WHEN 4  THEN v_tournament.prize_4th
        WHEN 5  THEN v_tournament.prize_5th
        WHEN 6  THEN v_tournament.prize_6th
        WHEN 7  THEN v_tournament.prize_7th
        WHEN 8  THEN v_tournament.prize_8th
        WHEN 9  THEN v_tournament.prize_9th
        WHEN 10 THEN v_tournament.prize_10th
        ELSE 0
      END;

      v_kill_bonus  := v_kills * COALESCE(v_tournament.per_kill_bonus, 0);
      v_total_prize := v_prize_amount + v_kill_bonus;

      -- Update registration record
      UPDATE public.tournament_registrations
      SET placement = v_placement, kills = v_kills, prize_won = v_total_prize, status = 'eliminated'
      WHERE tournament_id = p_tournament_id AND user_id = v_user_id;

      -- Credit winning wallet if prize > 0
      IF v_total_prize > 0 THEN
        UPDATE public.wallets
        SET winning_balance = winning_balance + v_total_prize, updated_at = NOW()
        WHERE user_id = v_user_id;

        INSERT INTO public.transactions (user_id, type, amount, wallet_type, direction, description, reference_id)
        VALUES (v_user_id, 'tournament_prize', v_total_prize, 'winning', 'credit',
                'Prize #' || v_placement || ' + ' || v_kills || ' kills in ' || v_tournament.name,
                p_tournament_id);

        INSERT INTO public.notifications (user_id, title, body, url, type)
        VALUES (v_user_id,
                'Prize Won! 🏆',
                'You finished #' || v_placement || ' in ' || v_tournament.name || ' and won ₹' || v_total_prize || '!',
                '/wallet.html',
                'tournament');
      END IF;

      -- Update user stats
      IF v_placement = 1 THEN
        UPDATE public.profiles
        SET total_wins = total_wins + 1, total_kills = total_kills + v_kills, xp = xp + 500, updated_at = NOW()
        WHERE id = v_user_id;
      ELSE
        UPDATE public.profiles
        SET total_kills = total_kills + v_kills, xp = xp + (v_kills * 10), updated_at = NOW()
        WHERE id = v_user_id;
      END IF;

      v_count := v_count + 1;

    EXCEPTION WHEN OTHERS THEN
      v_errors := v_errors || jsonb_build_object('user_id', v_user_id, 'error', SQLERRM);
    END;
  END LOOP;

  -- 4. Mark tournament as completed
  UPDATE public.tournaments
  SET status = 'completed', updated_at = NOW()
  WHERE id = p_tournament_id;

  RETURN jsonb_build_object(
    'success',       true,
    'processed',     v_count,
    'errors',        v_errors,
    'message',       'Prizes distributed for ' || v_count || ' players'
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;
```

---

### credit_referral_bonus (Internal Helper)

Called by `approve_deposit` on first deposit to credit referral chain.

```sql
CREATE OR REPLACE FUNCTION public.credit_referral_bonus(
  p_user_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_referral      RECORD;
  v_bonus_amount  NUMERIC;
  v_deposit_count INTEGER;
BEGIN
  -- Check if this is user's first approved deposit
  SELECT COUNT(*) INTO v_deposit_count
  FROM public.transactions
  WHERE user_id = p_user_id AND type = 'deposit' AND status = 'completed';

  IF v_deposit_count > 1 THEN
    RETURN; -- Only credit referral on first deposit
  END IF;

  -- Get referral record
  SELECT * INTO v_referral
  FROM public.referrals
  WHERE referred_id = p_user_id AND status = 'pending'
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  -- Get referral bonus amount from settings
  SELECT (value::TEXT)::NUMERIC INTO v_bonus_amount
  FROM public.admin_settings
  WHERE key = 'referral_bonus';

  v_bonus_amount := COALESCE(v_bonus_amount, 30);

  -- Credit referrer's bonus wallet
  UPDATE public.wallets
  SET bonus_balance = bonus_balance + v_bonus_amount, updated_at = NOW()
  WHERE user_id = v_referral.referrer_id;

  INSERT INTO public.transactions (user_id, type, amount, wallet_type, direction, description)
  VALUES (v_referral.referrer_id, 'referral_bonus', v_bonus_amount, 'bonus', 'credit',
          'Referral bonus for new member deposit');

  -- Update referral record
  UPDATE public.referrals
  SET status = 'credited', amount_credited = v_bonus_amount, credited_at = NOW()
  WHERE id = v_referral.id;

  -- Notify referrer
  INSERT INTO public.notifications (user_id, title, body, type)
  VALUES (v_referral.referrer_id,
          'Referral Bonus Earned! 💸',
          'Your referral made their first deposit. ₹' || v_bonus_amount || ' bonus credited!',
          'referral');

END;
$$;
```

---

## 23. Triggers

### Auto-create profile on new user signup

```sql
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_referral_code TEXT;
  v_referrer_id   UUID;
  v_username      TEXT;
BEGIN
  -- Generate unique username from email
  v_username := LOWER(SPLIT_PART(NEW.email, '@', 1));
  -- Append random suffix if username taken
  WHILE EXISTS (SELECT 1 FROM public.profiles WHERE username = v_username) LOOP
    v_username := v_username || FLOOR(RANDOM() * 9000 + 1000)::TEXT;
  END LOOP;

  -- Generate unique referral code
  LOOP
    v_referral_code := UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 8));
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.profiles WHERE referral_code = v_referral_code);
  END LOOP;

  -- Check if referred by someone (from metadata)
  IF NEW.raw_user_meta_data ? 'referred_by' THEN
    SELECT id INTO v_referrer_id
    FROM public.profiles
    WHERE referral_code = NEW.raw_user_meta_data->>'referred_by';
  END IF;

  -- Create profile
  INSERT INTO public.profiles (id, username, email, referral_code, referred_by)
  VALUES (
    NEW.id,
    v_username,
    NEW.email,
    v_referral_code,
    v_referrer_id
  );

  -- Create wallet
  INSERT INTO public.wallets (user_id)
  VALUES (NEW.id);

  -- Create referral record if applicable
  IF v_referrer_id IS NOT NULL THEN
    INSERT INTO public.referrals (referrer_id, referred_id)
    VALUES (v_referrer_id, NEW.id)
    ON CONFLICT (referred_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

### Auto-update `updated_at` timestamps

```sql
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_updated_at_profiles
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at_tournaments
  BEFORE UPDATE ON public.tournaments
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at_wallets
  BEFORE UPDATE ON public.wallets
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at_clans
  BEFORE UPDATE ON public.clans
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at_announcements
  BEFORE UPDATE ON public.announcements
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
```

### Auto-update clan member count

```sql
CREATE OR REPLACE FUNCTION public.update_clan_member_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.clans SET total_members = total_members + 1 WHERE id = NEW.clan_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.clans SET total_members = total_members - 1 WHERE id = OLD.clan_id;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER on_clan_member_change
  AFTER INSERT OR DELETE ON public.clan_members
  FOR EACH ROW EXECUTE FUNCTION public.update_clan_member_count();
```

---

## Supabase Realtime

Enable Realtime for these tables in your Supabase dashboard or via SQL:

```sql
-- Enable realtime publications
BEGIN;
  DROP PUBLICATION IF EXISTS supabase_realtime;
  CREATE PUBLICATION supabase_realtime FOR TABLE
    public.tournaments,
    public.tournament_registrations,
    public.notifications,
    public.messages,
    public.announcements,
    public.wallets;
COMMIT;
```

---

## Storage Buckets

Create these storage buckets in Supabase Dashboard > Storage:

| Bucket Name        | Public | Max Size | Allowed Types           |
|--------------------|--------|----------|-------------------------|
| `payment-proofs`   | No     | 5 MB     | `image/*`               |
| `avatars`          | Yes    | 2 MB     | `image/*`               |
| `tournament-banners`| Yes   | 5 MB     | `image/*`               |
| `clan-logos`       | Yes    | 2 MB     | `image/*`               |

```sql
-- Storage RLS: Only owner can upload payment proofs
CREATE POLICY "payment_proofs_owner_only"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'payment-proofs' AND
    auth.uid()::TEXT = (storage.foldername(name))[1]
  );

CREATE POLICY "payment_proofs_owner_read"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'payment-proofs' AND
    (auth.uid()::TEXT = (storage.foldername(name))[1] OR public.is_admin())
  );

-- Avatars: public read, owner write
CREATE POLICY "avatars_public_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

CREATE POLICY "avatars_owner_write"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'avatars' AND
    auth.uid()::TEXT = (storage.foldername(name))[1]
  );
```

---

*End of Database Schema — Gen B Tournaments*
