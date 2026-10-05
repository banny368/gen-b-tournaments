-- ============================================================
-- Gen B Tournaments — 0015: financial history survives user deletion
-- Ledger rows are historical records; deleting a user must not delete
-- (or block on) them. Attribution columns become NULL, the balanced
-- transaction remains intact. Same for prize/refund attribution.
-- ============================================================

alter table public.ledger_entries
  drop constraint if exists ledger_entries_user_id_fkey;
alter table public.ledger_entries
  add constraint ledger_entries_user_id_fkey
  foreign key (user_id) references public.profiles(id) on delete set null;

alter table public.ledger_entries
  drop constraint if exists ledger_entries_wallet_id_fkey;
alter table public.ledger_entries
  add constraint ledger_entries_wallet_id_fkey
  foreign key (wallet_id) references public.wallets(id) on delete set null;

alter table public.prizes
  drop constraint if exists prizes_user_id_fkey;
alter table public.prizes
  add constraint prizes_user_id_fkey
  foreign key (user_id) references public.profiles(id) on delete set null;

alter table public.refunds
  drop constraint if exists refunds_user_id_fkey;
alter table public.refunds
  add constraint refunds_user_id_fkey
  foreign key (user_id) references public.profiles(id) on delete set null;

alter table public.teams
  drop constraint if exists teams_captain_id_fkey;
alter table public.teams
  add constraint teams_captain_id_fkey
  foreign key (captain_id) references public.profiles(id) on delete set null;

alter table public.clans
  drop constraint if exists clans_owner_id_fkey;
alter table public.clans
  add constraint clans_owner_id_fkey
  foreign key (owner_id) references public.profiles(id) on delete set null;

alter table public.profiles
  drop constraint if exists profiles_id_fkey;
alter table public.profiles
  add constraint profiles_id_fkey
  foreign key (id) references auth.users(id) on delete cascade;
