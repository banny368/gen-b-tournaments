-- ============================================================
-- Gen B Tournaments — 0003: Platform Tables
-- Rewards, referrals, chat, notifications, claims, KYC, risk,
-- audit, legal, settings, flags, announcements, favorites
-- ============================================================

-- ---------- REWARDS & REFERRALS ----------
create table public.reward_campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  source public.reward_source not null,
  config jsonb not null default '{}'::jsonb, -- {amount, daily_cap, session_cap, cooldown_minutes, expiry_days}
  active boolean not null default false,
  starts_at timestamptz,
  ends_at timestamptz,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.reward_grants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  campaign_id uuid references public.reward_campaigns(id),
  source public.reward_source not null,
  amount numeric(14,2) not null check (amount > 0),
  target_account public.user_account_type not null default 'REWARD',
  expires_at timestamptz,
  ledger_transaction_id uuid references public.ledger_transactions(id),
  created_at timestamptz not null default now()
);

create index idx_reward_grants_user on public.reward_grants (user_id, created_at desc);

create table public.ad_reward_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  provider text not null,
  provider_reward_id text unique,
  status text not null default 'RECEIVED' check (status in ('RECEIVED', 'VERIFIED', 'REWARDED', 'REJECTED')),
  rewarded_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_id uuid not null references public.profiles(id) on delete cascade,
  referee_id uuid not null unique references public.profiles(id) on delete cascade,
  code_used text not null,
  status text not null default 'PENDING' check (status in ('PENDING', 'QUALIFIED', 'REWARDED', 'REJECTED')),
  qualified_at timestamptz,
  reward_transaction_id uuid references public.ledger_transactions(id),
  created_at timestamptz not null default now()
);

create index idx_referrals_referrer on public.referrals (referrer_id);

-- ---------- CHAT ----------
create table public.chat_channels (
  id uuid primary key default gen_random_uuid(),
  type public.chat_channel_type not null,
  name text,
  clan_id uuid references public.clans(id) on delete cascade,
  tournament_id uuid references public.tournaments(id) on delete cascade,
  slowmode_seconds int not null default 5,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (clan_id),
  unique (tournament_id)
);

create table public.chat_members (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid not null references public.chat_channels(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'MEMBER' check (role in ('MEMBER', 'MODERATOR', 'ADMIN')),
  is_muted boolean not null default false,
  muted_until timestamptz,
  joined_at timestamptz not null default now(),
  unique (channel_id, user_id)
);

create table public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid not null references public.chat_channels(id) on delete cascade,
  user_id uuid not null references public.profiles(id),
  content text not null check (length(content) between 1 and 500),
  is_deleted boolean not null default false,
  deleted_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create index idx_chat_messages_channel on public.chat_messages (channel_id, created_at desc);

create table public.chat_reports (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.chat_messages(id) on delete cascade,
  reporter_id uuid not null references public.profiles(id),
  reason text not null,
  status text not null default 'OPEN' check (status in ('OPEN', 'RESOLVED', 'DISMISSED')),
  resolved_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  unique (message_id, reporter_id)
);

create table public.user_blocks (
  id uuid primary key default gen_random_uuid(),
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (blocker_id, blocked_id)
);

-- ---------- NOTIFICATIONS ----------
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type public.notification_type not null,
  title text not null,
  body text,
  data jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index idx_notifications_user on public.notifications (user_id, created_at desc);

-- ---------- CLAIMS / SUPPORT ----------
create table public.claims (
  id uuid primary key default gen_random_uuid(),
  ticket_code text unique not null default ('TCK-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8))),
  user_id uuid not null references public.profiles(id) on delete cascade,
  category public.claim_category not null,
  priority text not null default 'NORMAL' check (priority in ('LOW', 'NORMAL', 'HIGH', 'URGENT')),
  related_tournament_id uuid references public.tournaments(id),
  related_deposit_id uuid references public.deposits(id),
  related_withdrawal_id uuid references public.withdrawals(id),
  subject text not null,
  description text not null,
  status public.claim_status not null default 'OPEN',
  assigned_admin uuid references public.profiles(id),
  resolution text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.claim_messages (
  id uuid primary key default gen_random_uuid(),
  claim_id uuid not null references public.claims(id) on delete cascade,
  author_id uuid not null references public.profiles(id),
  is_staff boolean not null default false,
  content text not null,
  created_at timestamptz not null default now()
);

create index idx_claims_user on public.claims (user_id, created_at desc);
create index idx_claims_status on public.claims (status) where status not in ('RESOLVED', 'CLOSED', 'REJECTED');

-- ---------- KYC ----------
create table public.kyc_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  full_name text not null,
  date_of_birth date not null,
  doc_type text not null check (doc_type in ('AADHAAR', 'PAN', 'DL', 'PASSPORT')),
  doc_number_last4 text not null,
  doc_proof_path text not null,
  status public.kyc_status not null default 'PENDING',
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  rejection_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id)
);

-- ---------- RISK / FRAUD ----------
create table public.risk_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  event_type text not null,
  severity public.risk_severity not null default 'LOW',
  signals jsonb not null default '{}'::jsonb,
  status public.risk_status not null default 'OPEN',
  resolved_by uuid references public.profiles(id),
  resolution_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_risk_events_status on public.risk_events (status, severity);

-- ---------- AUDIT LOG (append-only) ----------
create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id),
  actor_role text,
  action text not null,
  resource_type text not null,
  resource_id text,
  before_state jsonb,
  after_state jsonb,
  reason text,
  request_id text,
  ip inet,
  created_at timestamptz not null default now()
);

create index idx_audit_logs_created on public.audit_logs (created_at desc);
create index idx_audit_logs_actor on public.audit_logs (actor_id, created_at desc);
create index idx_audit_logs_resource on public.audit_logs (resource_type, resource_id);

-- ---------- LEGAL CONTENT ----------
create table public.legal_documents (
  id uuid primary key default gen_random_uuid(),
  slug text not null,
  version int not null,
  title text not null,
  content_md text not null,
  is_published boolean not null default false,
  published_at timestamptz,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  unique (slug, version)
);

create table public.legal_acceptances (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  document_slug text not null,
  version int not null,
  accepted_at timestamptz not null default now(),
  unique (user_id, document_slug, version)
);

-- ---------- SETTINGS / FLAGS / ANNOUNCEMENTS ----------
create table public.admin_settings (
  key text primary key,
  category text not null default 'GENERAL',
  value jsonb not null,
  description text not null default '',
  updated_by uuid references public.profiles(id),
  updated_at timestamptz not null default now()
);

create table public.feature_flags (
  key text primary key,
  enabled boolean not null default false,
  description text not null default '',
  updated_by uuid references public.profiles(id),
  updated_at timestamptz not null default now()
);

create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  type text not null default 'INFO' check (type in ('INFO', 'WARNING', 'MAINTENANCE', 'EMERGENCY')),
  is_active boolean not null default true,
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

-- ---------- FAVORITES ----------
create table public.favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  entity_type text not null check (entity_type in ('GAME', 'TOURNAMENT', 'CLAN')),
  entity_id uuid not null,
  created_at timestamptz not null default now(),
  unique (user_id, entity_type, entity_id)
);

-- ---------- DEVICE / SESSION RISK ----------
create table public.user_sessions_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  device_info jsonb not null default '{}'::jsonb,
  ip inet,
  created_at timestamptz not null default now()
);

create index idx_sessions_user on public.user_sessions_log (user_id, created_at desc);
