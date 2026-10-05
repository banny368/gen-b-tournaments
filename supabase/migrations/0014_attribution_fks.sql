-- ============================================================
-- Gen B Tournaments — 0014: attribution FKs must not block user deletion
-- created_by / reviewed_by / actor_id style references are attribution,
-- not ownership: historical financial + audit records must survive the
-- referenced profile being deleted (SET NULL), never cascade or block.
-- ============================================================

alter table public.ledger_transactions
  drop constraint if exists ledger_transactions_created_by_fkey;
alter table public.ledger_transactions
  add constraint ledger_transactions_created_by_fkey
  foreign key (created_by) references public.profiles(id) on delete set null;

alter table public.tournaments
  drop constraint if exists tournaments_created_by_fkey;
alter table public.tournaments
  add constraint tournaments_created_by_fkey
  foreign key (created_by) references public.profiles(id) on delete set null;

alter table public.reward_campaigns
  drop constraint if exists reward_campaigns_created_by_fkey;
alter table public.reward_campaigns
  add constraint reward_campaigns_created_by_fkey
  foreign key (created_by) references public.profiles(id) on delete set null;

alter table public.tournament_rooms
  drop constraint if exists tournament_rooms_updated_by_fkey;
alter table public.tournament_rooms
  add constraint tournament_rooms_updated_by_fkey
  foreign key (updated_by) references public.profiles(id) on delete set null;

alter table public.deposits
  drop constraint if exists deposits_verified_by_fkey;
alter table public.deposits
  add constraint deposits_verified_by_fkey
  foreign key (verified_by) references public.profiles(id) on delete set null;

alter table public.withdrawals
  drop constraint if exists withdrawals_reviewed_by_fkey;
alter table public.withdrawals
  add constraint withdrawals_reviewed_by_fkey
  foreign key (reviewed_by) references public.profiles(id) on delete set null;

alter table public.kyc_records
  drop constraint if exists kyc_records_reviewed_by_fkey;
alter table public.kyc_records
  add constraint kyc_records_reviewed_by_fkey
  foreign key (reviewed_by) references public.profiles(id) on delete set null;

alter table public.risk_events
  drop constraint if exists risk_events_resolved_by_fkey;
alter table public.risk_events
  add constraint risk_events_resolved_by_fkey
  foreign key (resolved_by) references public.profiles(id) on delete set null;

alter table public.claims
  drop constraint if exists claims_assigned_admin_fkey;
alter table public.claims
  add constraint claims_assigned_admin_fkey
  foreign key (assigned_admin) references public.profiles(id) on delete set null;

alter table public.chat_messages
  drop constraint if exists chat_messages_user_id_fkey;
alter table public.chat_messages
  add constraint chat_messages_user_id_fkey
  foreign key (user_id) references public.profiles(id) on delete set null;

alter table public.chat_messages
  drop constraint if exists chat_messages_deleted_by_fkey;
alter table public.chat_messages
  add constraint chat_messages_deleted_by_fkey
  foreign key (deleted_by) references public.profiles(id) on delete set null;

alter table public.chat_reports
  drop constraint if exists chat_reports_resolved_by_fkey;
alter table public.chat_reports
  add constraint chat_reports_resolved_by_fkey
  foreign key (resolved_by) references public.profiles(id) on delete set null;

alter table public.legal_documents
  drop constraint if exists legal_documents_created_by_fkey;
alter table public.legal_documents
  add constraint legal_documents_created_by_fkey
  foreign key (created_by) references public.profiles(id) on delete set null;

alter table public.admin_settings
  drop constraint if exists admin_settings_updated_by_fkey;
alter table public.admin_settings
  add constraint admin_settings_updated_by_fkey
  foreign key (updated_by) references public.profiles(id) on delete set null;

alter table public.feature_flags
  drop constraint if exists feature_flags_updated_by_fkey;
alter table public.feature_flags
  add constraint feature_flags_updated_by_fkey
  foreign key (updated_by) references public.profiles(id) on delete set null;

alter table public.announcements
  drop constraint if exists announcements_created_by_fkey;
alter table public.announcements
  add constraint announcements_created_by_fkey
  foreign key (created_by) references public.profiles(id) on delete set null;

alter table public.audit_logs
  drop constraint if exists audit_logs_actor_id_fkey;
alter table public.audit_logs
  add constraint audit_logs_actor_id_fkey
  foreign key (actor_id) references public.profiles(id) on delete set null;

alter table public.user_roles
  drop constraint if exists user_roles_granted_by_fkey;
alter table public.user_roles
  add constraint user_roles_granted_by_fkey
  foreign key (granted_by) references public.profiles(id) on delete set null;

alter table public.user_permission_overrides
  drop constraint if exists user_permission_overrides_granted_by_fkey;
alter table public.user_permission_overrides
  add constraint user_permission_overrides_granted_by_fkey
  foreign key (granted_by) references public.profiles(id) on delete set null;

alter table public.tournament_results
  drop constraint if exists tournament_results_submitted_by_fkey;
alter table public.tournament_results
  add constraint tournament_results_submitted_by_fkey
  foreign key (submitted_by) references public.profiles(id) on delete set null;

alter table public.tournament_results
  drop constraint if exists tournament_results_reviewed_by_fkey;
alter table public.tournament_results
  add constraint tournament_results_reviewed_by_fkey
  foreign key (reviewed_by) references public.profiles(id) on delete set null;
