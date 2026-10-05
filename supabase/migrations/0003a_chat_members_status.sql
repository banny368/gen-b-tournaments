-- ============================================================
-- Gen B Tournaments — 0012: hotfix — chat_members.status
-- Functions/RLS reference chat_members.status; the column was missing
-- from the original 0003 definition (added there too for fresh installs).
-- ============================================================

alter table public.chat_members
  add column if not exists status text not null default 'ACTIVE';
