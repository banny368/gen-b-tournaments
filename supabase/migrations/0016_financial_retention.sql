-- ============================================================
-- Gen B Tournaments — 0016: financial records must never be mutated
-- 0015 tried ON DELETE SET NULL on ledger_entries/prizes/refunds, but
-- the immutability trigger correctly rejects any ledger row mutation.
-- Resolution: users WITH financial history cannot be hard-deleted
-- (financial retention; ban/anonymize instead — see admin guide).
-- Users without history delete cleanly via cascade.
-- ============================================================

alter table public.ledger_entries
  drop constraint if exists ledger_entries_user_id_fkey;
alter table public.ledger_entries
  add constraint ledger_entries_user_id_fkey
  foreign key (user_id) references public.profiles(id);

alter table public.ledger_entries
  drop constraint if exists ledger_entries_wallet_id_fkey;
alter table public.ledger_entries
  add constraint ledger_entries_wallet_id_fkey
  foreign key (wallet_id) references public.wallets(id);

alter table public.prizes
  drop constraint if exists prizes_user_id_fkey;
alter table public.prizes
  add constraint prizes_user_id_fkey
  foreign key (user_id) references public.profiles(id);

alter table public.refunds
  drop constraint if exists refunds_user_id_fkey;
alter table public.refunds
  add constraint refunds_user_id_fkey
  foreign key (user_id) references public.profiles(id);
