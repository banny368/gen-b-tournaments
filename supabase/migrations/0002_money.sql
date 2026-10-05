-- ============================================================
-- Gen B Tournaments — 0002: Money Tables
-- Wallets, immutable double-entry ledger, deposits, withdrawals,
-- payment orders/events, prizes, refunds, commissions
-- ============================================================

-- ---------- WALLETS ----------
create table public.wallets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles(id) on delete cascade,
  currency text not null default 'INR',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Cached balances, ONLY maintained by ledger helper functions (never client writes)
create table public.wallet_balances (
  wallet_id uuid not null references public.wallets(id) on delete cascade,
  account public.user_account_type not null,
  balance numeric(14,2) not null default 0 check (balance >= 0),
  updated_at timestamptz not null default now(),
  primary key (wallet_id, account)
);

-- ---------- LEDGER (immutable, double-entry) ----------
create table public.ledger_transactions (
  id uuid primary key default gen_random_uuid(),
  txn_type text not null, -- DEPOSIT, TOURNAMENT_ENTRY, PRIZE_PAYOUT, REFUND, COMMISSION, WITHDRAWAL, ADJUSTMENT, REWARD_GRANT, WITHDRAWAL_FEE, BONUS_GRANT
  reference_type text,
  reference_id uuid,
  idempotency_key text unique,
  description text,
  metadata jsonb not null default '{}'::jsonb,
  rule_snapshot jsonb not null default '{}'::jsonb, -- applied config/rule versions
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.ledger_entries (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid not null references public.ledger_transactions(id) on delete cascade,
  account_kind text not null check (account_kind in ('USER', 'SYSTEM')),
  account text not null, -- user_account_type or system_account_type value
  user_id uuid references public.profiles(id),
  wallet_id uuid references public.wallets(id),
  direction public.ledger_direction not null,
  amount numeric(14,2) not null check (amount > 0),
  created_at timestamptz not null default now(),
  check (
    (account_kind = 'USER' and user_id is not null and wallet_id is not null
      and account in ('DEPOSIT','BONUS','REWARD','WINNINGS','REFUND','LOCKED'))
    or
    (account_kind = 'SYSTEM' and user_id is null and wallet_id is null
      and account in ('DEPOSIT_CLEARING','WITHDRAWAL_CLEARING','TOURNAMENT_ESCROW','PLATFORM_REVENUE','PROMO_POOL','ADJUSTMENT'))
  )
);

create index idx_ledger_tx_created on public.ledger_transactions (created_at desc);
create index idx_ledger_tx_ref on public.ledger_transactions (reference_type, reference_id);
create index idx_ledger_entries_tx on public.ledger_entries (transaction_id);
create index idx_ledger_entries_user on public.ledger_entries (user_id, created_at desc);

-- Append-only enforcement: historical ledger rows must never change
create or replace function public.forbid_ledger_mutation()
returns trigger language plpgsql as $$
begin
  raise exception 'LEDGER_IMMUTABLE: ledger rows cannot be modified or deleted. Create a correcting transaction instead.';
end;
$$;

create trigger trg_ledger_entries_immutable
  before update or delete on public.ledger_entries
  for each row execute function public.forbid_ledger_mutation();

create trigger trg_ledger_tx_immutable
  before delete on public.ledger_transactions
  for each row execute function public.forbid_ledger_mutation();

-- Double-entry guard: at COMMIT, every transaction must balance to zero.
-- DEBIT amounts are stored as negative contributions, CREDIT as positive.
create or replace function public.assert_transaction_balanced()
returns trigger language plpgsql as $$
declare
  imbalance numeric(14,2);
begin
  select coalesce(sum(case when direction = 'CREDIT' then amount else -amount end), 0)
    into imbalance
    from public.ledger_entries
   where transaction_id = new.transaction_id;

  if imbalance <> 0 then
    raise exception 'LEDGER_UNBALANCED: transaction % is off by %', new.transaction_id, imbalance;
  end if;
  return null;
end;
$$;

create constraint trigger trg_ledger_balanced
  after insert on public.ledger_entries
  deferrable initially deferred
  for each row execute function public.assert_transaction_balanced();

-- ---------- DEPOSITS ----------
create table public.deposits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  amount numeric(14,2) not null check (amount > 0),
  currency text not null default 'INR',
  provider public.payment_provider not null,
  provider_order_id text,
  provider_payment_id text,
  utr text,
  reference_code text unique not null default ('DEP-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8))),
  status public.deposit_status not null default 'CREATED',
  submitted_at timestamptz,
  verified_at timestamptz,
  verified_by uuid references public.profiles(id),
  proof_path text,
  risk_score int not null default 0,
  failure_reason text,
  notes text,
  ledger_transaction_id uuid references public.ledger_transactions(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- One real-world UTR can never fund two deposits (or two users)
create unique index idx_deposits_utr_unique
  on public.deposits (utr) where utr is not null;
create index idx_deposits_user on public.deposits (user_id, created_at desc);
create index idx_deposits_status on public.deposits (status) where status in ('PENDING_REVIEW', 'FLAGGED');

-- ---------- PAYMENT ORDERS / EVENTS ----------
create table public.payment_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  deposit_id uuid not null references public.deposits(id) on delete cascade,
  provider public.payment_provider not null,
  provider_order_id text unique,
  amount numeric(14,2) not null check (amount > 0),
  currency text not null default 'INR',
  status text not null default 'CREATED',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.payment_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references public.payment_orders(id),
  deposit_id uuid references public.deposits(id),
  provider public.payment_provider not null,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  signature_valid boolean,
  processed boolean not null default false,
  processed_at timestamptz,
  error text,
  created_at timestamptz not null default now()
);

create index idx_payment_events_order on public.payment_events (order_id, created_at desc);

-- ---------- WITHDRAWALS ----------
create table public.withdrawals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  amount numeric(14,2) not null check (amount > 0),
  fee numeric(14,2) not null default 0 check (fee >= 0),
  net_amount numeric(14,2) not null check (net_amount > 0),
  currency text not null default 'INR',
  destination_type text not null check (destination_type in ('UPI', 'BANK')),
  destination_details jsonb not null, -- {upi_id} or {account_number, ifsc, holder_name} — mask before display
  status public.withdrawal_status not null default 'REQUESTED',
  kyc_snapshot jsonb not null default '{}'::jsonb,
  slab_snapshot jsonb not null default '{}'::jsonb,
  provider_reference text,
  failure_reason text,
  admin_notes text,
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  completed_at timestamptz,
  ledger_transaction_id uuid references public.ledger_transactions(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (net_amount = amount - fee)
);

create index idx_withdrawals_user on public.withdrawals (user_id, created_at desc);
create index idx_withdrawals_status on public.withdrawals (status) where status in ('REQUESTED', 'UNDER_REVIEW', 'APPROVED', 'PROCESSING');

-- ---------- PRIZES / REFUNDS / COMMISSIONS ----------
create table public.prizes (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  user_id uuid references public.profiles(id),
  team_id uuid references public.teams(id),
  placement int not null,
  amount numeric(14,2) not null check (amount >= 0),
  status text not null default 'PENDING' check (status in ('PENDING', 'CREDITED', 'CANCELLED')),
  ledger_transaction_id uuid references public.ledger_transactions(id),
  created_at timestamptz not null default now(),
  unique (tournament_id, placement)
);

create table public.refunds (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  entry_id uuid not null references public.tournament_entries(id),
  user_id uuid not null references public.profiles(id),
  amount numeric(14,2) not null check (amount > 0),
  reason text,
  status text not null default 'PENDING' check (status in ('PENDING', 'CREDITED', 'FAILED')),
  ledger_transaction_id uuid references public.ledger_transactions(id),
  created_at timestamptz not null default now(),
  unique (entry_id) -- one refund per entry, ever
);

create table public.commissions (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  amount numeric(14,2) not null check (amount >= 0),
  rate numeric(5,2) not null,
  rate_source text not null, -- TOURNAMENT_OVERRIDE | GAME | DEFAULT
  ledger_transaction_id uuid references public.ledger_transactions(id),
  created_at timestamptz not null default now(),
  unique (tournament_id)
);

create index idx_prizes_user on public.prizes (user_id) where user_id is not null;
