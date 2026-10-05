-- ============================================================
-- Gen B Tournaments — 0012: hotfix — balance-check trigger context
-- Deferred constraint triggers fire at COMMIT, outside the SECURITY
-- DEFINER RPC that posted the ledger, as the invoking role. Under RLS
-- the invoker could not see system-account rows, falsely failing the
-- double-entry balance check. The check must run as owner (bypasses RLS).
-- ============================================================

alter function public.assert_transaction_balanced() security definer;
alter function public.assert_transaction_balanced() set search_path = public;
