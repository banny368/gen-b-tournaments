-- ============================================================
-- Gen B Tournaments — 0018: nullable attribution columns
-- 0014 made author-attribution FKs ON DELETE SET NULL, but the columns
-- themselves were NOT NULL, so profile deletion still failed. Make the
-- attribution columns nullable and align the two remaining FKs.
-- ============================================================

alter table public.chat_messages alter column user_id drop not null;
alter table public.chat_reports alter column reporter_id drop not null;
alter table public.claim_messages alter column author_id drop not null;

alter table public.chat_reports
  drop constraint if exists chat_reports_reporter_id_fkey;
alter table public.chat_reports
  add constraint chat_reports_reporter_id_fkey
  foreign key (reporter_id) references public.profiles(id) on delete set null;

alter table public.claim_messages
  drop constraint if exists claim_messages_author_id_fkey;
alter table public.claim_messages
  add constraint claim_messages_author_id_fkey
  foreign key (author_id) references public.profiles(id) on delete set null;
