-- ============================================================
-- Gen B Tournaments — 0001: Extensions, Enums, Core Tables
-- Identity, RBAC, games, tournaments, teams, clans
-- ============================================================

create extension if not exists "pgcrypto";
create extension if not exists "citext";

-- ---------- ENUMS ----------
create type public.user_account_type as enum (
  'DEPOSIT', 'BONUS', 'REWARD', 'WINNINGS', 'REFUND', 'LOCKED'
);

create type public.system_account_type as enum (
  'DEPOSIT_CLEARING', 'WITHDRAWAL_CLEARING', 'TOURNAMENT_ESCROW',
  'PLATFORM_REVENUE', 'PROMO_POOL', 'ADJUSTMENT'
);

create type public.ledger_direction as enum ('DEBIT', 'CREDIT');

create type public.tournament_status as enum (
  'DRAFT', 'SCHEDULED', 'REGISTRATION_OPEN', 'REGISTRATION_CLOSED',
  'ROOM_PENDING', 'ROOM_RELEASED', 'LIVE', 'RESULT_PENDING',
  'RESULT_REVIEW', 'COMPLETED', 'CANCELLED', 'REFUNDING', 'REFUNDED', 'DISPUTED'
);

create type public.entry_status as enum ('ACTIVE', 'CANCELLED', 'REFUNDED', 'DISQUALIFIED');

create type public.tournament_format as enum (
  'SOLO', 'DUO', 'SQUAD', 'BATTLE_ROYALE', 'CUSTOM_ROOM', 'CLAN_VS_CLAN',
  'KNOCKOUT', 'LEAGUE', 'POINTS_TABLE', 'ELIMINATION', 'MULTI_ROUND', 'ONE_V_ONE', 'TWO_V_TWO'
);

create type public.visibility_type as enum ('PUBLIC', 'PRIVATE', 'HIDDEN');

create type public.result_status as enum ('PENDING', 'SUBMITTED', 'APPROVED', 'REJECTED', 'DISPUTED');
create type public.payout_status as enum ('NOT_DUE', 'PENDING', 'PAID', 'FAILED', 'CANCELLED');

create type public.admin_role as enum (
  'SUPER_ADMIN', 'FINANCE_ADMIN', 'TOURNAMENT_ADMIN', 'SUPPORT_ADMIN',
  'MODERATOR', 'CONTENT_ADMIN', 'RISK_ADMIN', 'ANALYST'
);

create type public.deposit_status as enum (
  'CREATED', 'PAYMENT_PENDING', 'PAYMENT_SUCCESS', 'PENDING_REVIEW',
  'APPROVED', 'REJECTED', 'REFUNDED', 'EXPIRED', 'FLAGGED'
);

create type public.payment_provider as enum ('MANUAL_UPI', 'RAZORPAY', 'CASHFREE', 'DEMO');

create type public.withdrawal_status as enum (
  'REQUESTED', 'UNDER_REVIEW', 'APPROVED', 'PROCESSING',
  'COMPLETED', 'FAILED', 'REJECTED', 'REVERSED', 'CANCELLED'
);

create type public.claim_status as enum (
  'OPEN', 'IN_REVIEW', 'WAITING_USER', 'WAITING_ADMIN', 'RESOLVED', 'REJECTED', 'CLOSED'
);

create type public.claim_category as enum (
  'PAYMENT', 'MISSING_DEPOSIT', 'WRONG_RESULT', 'PRIZE', 'CANCELLATION',
  'REFUND', 'TECHNICAL', 'CHEATING_REPORT', 'ACCOUNT'
);

create type public.kyc_status as enum ('NOT_SUBMITTED', 'PENDING', 'APPROVED', 'REJECTED');

create type public.risk_severity as enum ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');
create type public.risk_status as enum ('OPEN', 'REVIEWING', 'RESOLVED_CLEAR', 'RESOLVED_ACTION');

create type public.chat_channel_type as enum ('GLOBAL', 'CLAN', 'TOURNAMENT');
create type public.notification_type as enum (
  'TOURNAMENT_REMINDER', 'ROOM_RELEASED', 'MATCH_STARTING', 'RESULT_PUBLISHED',
  'PRIZE_CREDITED', 'DEPOSIT_APPROVED', 'DEPOSIT_REJECTED', 'WITHDRAWAL_UPDATE',
  'CLAIM_UPDATE', 'CLAN_INVITE', 'REFERRAL_REWARD', 'MAINTENANCE', 'ANNOUNCEMENT', 'SYSTEM'
);

create type public.reward_source as enum (
  'DAILY_LOGIN', 'REFERRAL', 'PARTICIPATION', 'CAMPAIGN', 'ACHIEVEMENT',
  'MILESTONE', 'AD_REWARD', 'EVENT', 'ADMIN_GRANT'
);

-- ---------- PROFILES ----------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username citext unique,
  player_code text unique not null default ('GB-' || upper(substr(md5(random()::text), 1, 6))),
  display_name text,
  avatar_url text,
  bio text,
  country text default 'IN',
  is_verified boolean not null default false,
  is_banned boolean not null default false,
  referral_code text unique not null default ('GB' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6))),
  terms_accepted_version text,
  privacy_accepted_version text,
  language text not null default 'en',
  timezone text not null default 'Asia/Kolkata',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- RBAC ----------
create table public.permissions (
  code text primary key,
  description text not null default ''
);

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  role public.admin_role not null,
  granted_by uuid references public.profiles(id),
  granted_at timestamptz not null default now(),
  unique (user_id, role)
);

create table public.user_permission_overrides (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  permission_code text not null references public.permissions(code) on delete cascade,
  granted boolean not null,
  granted_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  unique (user_id, permission_code)
);

-- ---------- GAMES ----------
create table public.games (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  short_name text not null,
  slug citext not null unique,
  icon_url text,
  banner_url text,
  description text,
  active boolean not null default true,
  supported_modes text[] not null default '{}',
  allowed_regions text[] not null default '{IN}',
  minimum_age int not null default 18 check (minimum_age >= 0),
  rules text,
  metadata jsonb not null default '{}'::jsonb,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.game_modes (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  name text not null,
  code text not null,
  team_size int not null default 1 check (team_size > 0),
  active boolean not null default true,
  unique (game_id, code)
);

-- ---------- TEAMS ----------
create table public.teams (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  tag citext not null unique,
  logo_url text,
  captain_id uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.team_members (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'MEMBER' check (role in ('CAPTAIN', 'CO_CAPTAIN', 'MEMBER')),
  status text not null default 'ACTIVE' check (status in ('INVITED', 'REQUESTED', 'ACTIVE', 'REMOVED', 'LEFT')),
  created_at timestamptz not null default now(),
  unique (team_id, user_id)
);

-- ---------- TOURNAMENTS ----------
create table public.tournaments (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id),
  category_id uuid,
  title text not null,
  slug citext not null unique,
  description text,
  banner_url text,
  thumbnail_url text,
  format public.tournament_format not null default 'BATTLE_ROYALE',
  team_size int not null default 1 check (team_size > 0),
  entry_fee numeric(14,2) not null default 0 check (entry_fee >= 0),
  currency text not null default 'INR',
  prize_pool numeric(14,2) not null default 0 check (prize_pool >= 0),
  prize_distribution jsonb not null default '[]'::jsonb, -- [{rank:1, percent:50}, ...]
  max_players int not null check (max_players > 0),
  current_players int not null default 0 check (current_players >= 0),
  registration_start timestamptz not null default now(),
  registration_end timestamptz,
  match_start timestamptz not null,
  estimated_end timestamptz,
  status public.tournament_status not null default 'DRAFT',
  visibility public.visibility_type not null default 'PUBLIC',
  rules text,
  scoring_rules jsonb not null default '{}'::jsonb,
  spectator_enabled boolean not null default true,
  result_status public.result_status not null default 'PENDING',
  payout_status public.payout_status not null default 'NOT_DUE',
  commission_override numeric(5,2), -- percent, null = use game/default config
  is_featured boolean not null default false,
  is_demo boolean not null default false,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (current_players <= max_players)
);

create table public.tournament_rounds (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  round_no int not null,
  name text not null,
  format text,
  scheduled_at timestamptz,
  status text not null default 'PENDING',
  unique (tournament_id, round_no)
);

create table public.tournament_entries (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  team_id uuid references public.teams(id),
  slot_no int not null,
  status public.entry_status not null default 'ACTIVE',
  idempotency_key text unique,
  joined_at timestamptz not null default now(),
  unique (tournament_id, user_id)
);

create table public.tournament_rooms (
  tournament_id uuid primary key references public.tournaments(id) on delete cascade,
  room_id text,
  room_password text,
  release_at timestamptz,
  server_region text,
  map_name text,
  notes text,
  hide_after_end boolean not null default true,
  released_at timestamptz,
  updated_by uuid references public.profiles(id),
  updated_at timestamptz not null default now()
);

create table public.tournament_results (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  round_no int not null default 1,
  user_id uuid references public.profiles(id),
  team_id uuid references public.teams(id),
  placement int,
  kills int,
  points numeric(10,2) not null default 0,
  notes text,
  evidence_path text,
  status public.result_status not null default 'SUBMITTED',
  submitted_by uuid references public.profiles(id),
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (tournament_id, round_no, placement)
);

-- ---------- CLANS ----------
create table public.clans (
  id uuid primary key default gen_random_uuid(),
  name citext not null unique,
  tag citext not null unique,
  logo_url text,
  owner_id uuid not null references public.profiles(id),
  description text,
  member_limit int not null default 50 check (member_limit > 0),
  status text not null default 'ACTIVE' check (status in ('ACTIVE', 'DISBANDED', 'SUSPENDED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.clan_members (
  id uuid primary key default gen_random_uuid(),
  clan_id uuid not null references public.clans(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'MEMBER' check (role in ('OWNER', 'CO_LEADER', 'ELDER', 'MEMBER')),
  status text not null default 'ACTIVE' check (status in ('PENDING', 'INVITED', 'ACTIVE', 'REMOVED', 'LEFT')),
  created_at timestamptz not null default now(),
  unique (clan_id, user_id)
);

-- Indexes for hot query paths
create index idx_tournaments_status_start on public.tournaments (status, match_start);
create index idx_tournaments_game_status on public.tournaments (game_id, status);
create index idx_tournaments_featured on public.tournaments (is_featured) where is_featured;
create index idx_entries_user on public.tournament_entries (user_id);
create index idx_entries_tournament on public.tournament_entries (tournament_id);
create index idx_profiles_username on public.profiles (username);
create index idx_roles_user on public.user_roles (user_id);
