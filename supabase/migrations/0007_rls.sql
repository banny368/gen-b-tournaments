-- ============================================================
-- Gen B Tournaments — 0007: Row Level Security + Privileges
-- Secure by default: deny everything, then grant exactly what's needed.
-- Money mutations happen ONLY through SECURITY DEFINER RPCs.
-- ============================================================

-- ---------- PRIVATE PROFILE DATA (split from public profile) ----------
create table public.profile_private (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  date_of_birth date,
  phone text,
  state_code text,
  referred_by uuid,
  ban_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- blanket lockdown on every public table ----------
do $$
declare r record;
begin
  for r in select tablename from pg_tables where schemaname = 'public' loop
    execute format('revoke all on public.%I from anon, authenticated;', r.tablename);
  end loop;
end $$;

revoke all on all sequences in schema public from anon, authenticated;
revoke all on all functions in schema public from anon, authenticated;

-- ---------- helper: enable RLS everywhere ----------
do $$
declare r record;
begin
  for r in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security;', r.tablename);
    execute format('alter table public.%I force row level security;', r.tablename);
  end loop;
end $$;

-- NOTE: force row level security would block the table owner too, breaking
-- SECURITY DEFINER functions are unaffected (they bypass RLS as definer),
-- but service-role (postgres role) writes from server actions DO respect it.
-- Supabase service role has BYPASSRLS — see below notes. For admin panel
-- writes through the service key this is fine.

-- ============================================================
-- SELECTIVE GRANTS + POLICIES
-- ============================================================

-- ---------- profiles (public-safe fields only) ----------
grant select on public.profiles to anon, authenticated;
grant update (display_name, avatar_url, bio, language, timezone) on public.profiles to authenticated;

create policy "profiles are publicly readable"
  on public.profiles for select using (true);
create policy "users update own profile"
  on public.profiles for update to authenticated using (id = auth.uid());

-- ---------- profile_private ----------
grant select, insert, delete on public.profile_private to authenticated;
grant update on public.profile_private to authenticated;
create policy "own private profile"
  on public.profile_private for all to authenticated using (user_id = auth.uid());
create policy "admins read private profile"
  on public.profile_private for select to authenticated using (public.has_permission('VIEW_USERS'));

-- ---------- RBAC ----------
grant select on public.user_roles to authenticated;
grant select on public.permissions to authenticated;
grant select on public.user_permission_overrides to authenticated;
create policy "read own roles" on public.user_roles for select to authenticated using (user_id = auth.uid());
create policy "admins read roles" on public.user_roles for select to authenticated using (public.is_admin());
create policy "read permissions" on public.permissions for select to authenticated using (true);
create policy "read own overrides" on public.user_permission_overrides for select to authenticated using (user_id = auth.uid());
create policy "admins read overrides" on public.user_permission_overrides for select to authenticated using (public.is_admin());

-- ---------- games / modes ----------
grant select on public.games, public.game_modes to anon, authenticated;
create policy "active games readable" on public.games for select using (active or public.is_admin());
create policy "modes of readable games" on public.game_modes for select using (
  exists (select 1 from public.games g where g.id = game_id and g.active) or public.is_admin());

-- ---------- tournaments ----------
grant select on public.tournaments to anon, authenticated;
create policy "public tournaments readable" on public.tournaments for select using (
  (visibility = 'PUBLIC' and status <> 'DRAFT') or public.is_admin());

grant select on public.tournament_rounds to anon, authenticated;
create policy "rounds of readable tournaments" on public.tournament_rounds for select using (
  exists (select 1 from public.tournaments t where t.id = tournament_id
          and t.visibility = 'PUBLIC' and t.status <> 'DRAFT') or public.is_admin());

-- entries: own + co-participants + admins. No client writes (RPC only).
grant select on public.tournament_entries to authenticated;
create policy "read own entries" on public.tournament_entries for select to authenticated using (user_id = auth.uid());
create policy "participants see tournament lobby" on public.tournament_entries for select to authenticated using (
  exists (select 1 from public.tournament_entries e2
           where e2.tournament_id = tournament_entries.tournament_id and e2.user_id = auth.uid())
  or public.is_admin());

-- rooms: NEVER exposed to clients directly — RPC `get_room_credentials` only
-- (RLS enabled, zero policies => no access)

-- results: readable once tournament completed or user is admin
grant select on public.tournament_results to anon, authenticated;
create policy "results readable" on public.tournament_results for select using (
  public.is_admin() or exists (
    select 1 from public.tournaments t
     where t.id = tournament_results.tournament_id and t.status in ('COMPLETED','RESULT_REVIEW','RESULT_PENDING')));

-- ---------- teams ----------
grant select on public.teams, public.team_members to authenticated;
create policy "teams readable" on public.teams for select to authenticated using (true);
create policy "memberships readable" on public.team_members for select to authenticated using (
  user_id = auth.uid() or public.is_admin()
  or exists (select 1 from public.team_members m2
              where m2.team_id = team_members.team_id and m2.user_id = auth.uid() and m2.status = 'ACTIVE'));
create policy "create own team" on public.teams for insert to authenticated with check (captain_id = auth.uid());
create policy "captain manages team" on public.teams for update to authenticated using (captain_id = auth.uid());
create policy "join own team row" on public.team_members for insert to authenticated
  with check (user_id = auth.uid() or exists (select 1 from public.teams t where t.id = team_id and t.captain_id = auth.uid()));
create policy "captain manages memberships" on public.team_members for update to authenticated using (
  user_id = auth.uid()
  or exists (select 1 from public.teams t where t.id = team_members.team_id and t.captain_id = auth.uid()));

-- ---------- clans ----------
grant select on public.clans to anon, authenticated;
grant select on public.clan_members to authenticated;
create policy "clans readable" on public.clans for select using (status = 'ACTIVE' or public.is_admin());
create policy "create own clan" on public.clans for insert to authenticated with check (owner_id = auth.uid());
create policy "owner manages clan" on public.clans for update to authenticated using (owner_id = auth.uid());
create policy "memberships visible to members" on public.clan_members for select to authenticated using (
  user_id = auth.uid() or public.is_admin()
  or exists (select 1 from public.clan_members m2
              where m2.clan_id = clan_members.clan_id and m2.user_id = auth.uid() and m2.status = 'ACTIVE'));
create policy "apply to clan" on public.clan_members for insert to authenticated
  with check (user_id = auth.uid() and status in ('PENDING'));
create policy "member self-leave / leader manages" on public.clan_members for update to authenticated using (
  user_id = auth.uid()
  or exists (select 1 from public.clans c where c.id = clan_members.clan_id and c.owner_id = auth.uid())
  or exists (select 1 from public.clan_members m2 where m2.clan_id = clan_members.clan_id
              and m2.user_id = auth.uid() and m2.role in ('OWNER','CO_LEADER') and m2.status = 'ACTIVE'));

-- ---------- chat ----------
grant select on public.chat_channels to authenticated;
create policy "channels visible" on public.chat_channels for select to authenticated using (
  type = 'GLOBAL'
  or (type = 'CLAN' and exists (select 1 from public.clan_members cm
        where cm.clan_id = chat_channels.clan_id and cm.user_id = auth.uid() and cm.status = 'ACTIVE'))
  or (type = 'TOURNAMENT' and exists (select 1 from public.tournament_entries e
        where e.tournament_id = chat_channels.tournament_id and e.user_id = auth.uid()))
  or public.is_admin());

grant select on public.chat_messages to authenticated;
create policy "members read channel messages" on public.chat_messages for select to authenticated using (
  public.is_channel_member(chat_messages.channel_id) or public.is_admin());
create policy "moderators soft-delete" on public.chat_messages for update to authenticated using (
  public.has_permission('MODERATE_CHAT'));

grant select on public.chat_reports to authenticated;
create policy "own reports + moderators" on public.chat_reports for select to authenticated using (
  reporter_id = auth.uid() or public.has_permission('MODERATE_CHAT'));
create policy "file report" on public.chat_reports for insert to authenticated with check (reporter_id = auth.uid());

grant select, insert on public.user_blocks to authenticated;
create policy "own blocks" on public.user_blocks for all to authenticated using (blocker_id = auth.uid());

-- ---------- notifications ----------
grant select, update on public.notifications to authenticated;
create policy "own notifications" on public.notifications for select to authenticated using (user_id = auth.uid());
create policy "mark own read" on public.notifications for update to authenticated using (user_id = auth.uid());

-- ---------- claims ----------
grant select, insert on public.claims to authenticated;
create policy "own claims" on public.claims for select to authenticated using (
  user_id = auth.uid() or public.has_permission('VIEW_USERS'));
create policy "create own claim" on public.claims for insert to authenticated with check (user_id = auth.uid());

grant select, insert on public.claim_messages to authenticated;
create policy "claim thread readable by participants" on public.claim_messages for select to authenticated using (
  exists (select 1 from public.claims c where c.id = claim_id and (c.user_id = auth.uid() or public.has_permission('VIEW_USERS'))));
create policy "participants post" on public.claim_messages for insert to authenticated with check (
  exists (select 1 from public.claims c where c.id = claim_id and c.user_id = auth.uid()));

-- ---------- kyc ----------
grant select, insert, update on public.kyc_records to authenticated;
create policy "own kyc" on public.kyc_records for all to authenticated using (user_id = auth.uid());
create policy "admins read kyc" on public.kyc_records for select to authenticated using (public.has_permission('VIEW_USERS'));

-- ---------- risk / audit (admin read; writes via definer) ----------
grant select on public.risk_events, public.audit_logs to authenticated;
create policy "risk visible to risk admins" on public.risk_events for select to authenticated using (public.has_permission('VIEW_LEDGER'));
create policy "audit visible to finance/risk" on public.audit_logs for select to authenticated using (
  public.has_permission('VIEW_LEDGER') or public.has_permission('MANAGE_ROLES'));

-- ---------- legal ----------
grant select on public.legal_documents to anon, authenticated;
create policy "published legal readable" on public.legal_documents for select using (is_published or public.has_permission('MANAGE_LEGAL_CONTENT'));
grant select, insert on public.legal_acceptances to authenticated;
create policy "own acceptances" on public.legal_acceptances for select to authenticated using (user_id = auth.uid());
create policy "record acceptances" on public.legal_acceptances for insert to authenticated with check (user_id = auth.uid());

-- ---------- settings / flags ----------
grant select on public.admin_settings, public.feature_flags to authenticated;
create policy "settings for admins" on public.admin_settings for select to authenticated using (public.is_admin());
create policy "flags readable" on public.feature_flags for select to authenticated using (true);

-- ---------- announcements ----------
grant select on public.announcements to anon, authenticated;
create policy "active announcements" on public.announcements for select using (
  is_active and (ends_at is null or ends_at > now()));

-- ---------- favorites ----------
grant all on public.favorites to authenticated;
create policy "own favorites" on public.favorites for all to authenticated using (user_id = auth.uid());

-- ---------- wallets & ledger (read-only for users; money moves via RPC) ----------
grant select on public.wallets, public.wallet_balances, public.ledger_transactions, public.ledger_entries to authenticated;
create policy "own wallet" on public.wallets for select to authenticated using (user_id = auth.uid());
create policy "admins see wallets" on public.wallets for select to authenticated using (public.has_permission('VIEW_LEDGER'));
create policy "own balances" on public.wallet_balances for select to authenticated using (
  exists (select 1 from public.wallets w where w.id = wallet_balances.wallet_id and w.user_id = auth.uid()));
create policy "admins see balances" on public.wallet_balances for select to authenticated using (public.has_permission('VIEW_LEDGER'));
create policy "own ledger txns" on public.ledger_transactions for select to authenticated using (
  exists (select 1 from public.ledger_entries e
           where e.transaction_id = ledger_transactions.id and e.user_id = auth.uid()));
create policy "admins see ledger txns" on public.ledger_transactions for select to authenticated using (public.has_permission('VIEW_LEDGER'));
create policy "own ledger entries" on public.ledger_entries for select to authenticated using (user_id = auth.uid());
create policy "admins see ledger entries" on public.ledger_entries for select to authenticated using (public.has_permission('VIEW_LEDGER'));

-- ---------- deposits ----------
grant select on public.deposits to authenticated;
create policy "own deposits" on public.deposits for select to authenticated using (user_id = auth.uid());
create policy "finance sees deposits" on public.deposits for select to authenticated using (public.has_permission('VIEW_DEPOSITS'));

-- ---------- withdrawals ----------
grant select on public.withdrawals to authenticated;
create policy "own withdrawals" on public.withdrawals for select to authenticated using (user_id = auth.uid());
create policy "finance sees withdrawals" on public.withdrawals for select to authenticated using (public.has_permission('VIEW_WITHDRAWALS'));

-- ---------- payment orders / events ----------
grant select on public.payment_orders, public.payment_events to authenticated;
create policy "own orders" on public.payment_orders for select to authenticated using (
  user_id = auth.uid() or public.has_permission('VIEW_DEPOSITS'));
create policy "own order events" on public.payment_events for select to authenticated using (
  exists (select 1 from public.payment_orders o where o.id = order_id and o.user_id = auth.uid())
  or public.has_permission('VIEW_DEPOSITS'));

-- ---------- prizes / refunds / commissions ----------
grant select on public.prizes, public.refunds to authenticated;
create policy "own prizes" on public.prizes for select to authenticated using (
  user_id = auth.uid() or public.is_admin());
create policy "own refunds" on public.refunds for select to authenticated using (
  user_id = auth.uid() or public.is_admin());
grant select on public.commissions to authenticated;
create policy "commissions for admins" on public.commissions for select to authenticated using (public.has_permission('VIEW_LEDGER'));

-- ---------- rewards / referrals ----------
grant select on public.reward_campaigns to authenticated;
create policy "campaigns readable" on public.reward_campaigns for select using (active or public.is_admin());
grant select on public.reward_grants, public.ad_reward_events to authenticated;
create policy "own grants" on public.reward_grants for select to authenticated using (user_id = auth.uid());
create policy "own ad events" on public.ad_reward_events for select to authenticated using (user_id = auth.uid());
grant select on public.referrals to authenticated;
create policy "own referrals" on public.referrals for select to authenticated using (
  referrer_id = auth.uid() or referee_id = auth.uid() or public.is_admin());

-- ---------- sessions log ----------
grant select on public.user_sessions_log to authenticated;
create policy "own sessions" on public.user_sessions_log for select to authenticated using (user_id = auth.uid());

-- ---------- RPC execution grants ----------
grant execute on function public.join_tournament(uuid, text, uuid) to authenticated;
grant execute on function public.create_deposit_request(numeric, public.payment_provider) to authenticated;
grant execute on function public.submit_deposit_utr(uuid, text, text) to authenticated;
grant execute on function public.approve_deposit(uuid, text) to authenticated;
grant execute on function public.reject_deposit(uuid, text) to authenticated;
grant execute on function public.request_withdrawal(numeric, text, jsonb) to authenticated;
grant execute on function public.review_withdrawal(uuid, text, text, text) to authenticated;
grant execute on function public.grant_reward(uuid, uuid, text) to authenticated;
grant execute on function public.send_chat_message(uuid, text) to authenticated;
grant execute on function public.create_claim(text, text, text, uuid, uuid) to authenticated;
grant execute on function public.record_legal_acceptance(text, int) to authenticated;
grant execute on function public.get_room_credentials(uuid) to authenticated;
grant execute on function public.publish_results_and_pay(uuid, jsonb) to authenticated;
grant execute on function public.cancel_tournament_refunds(uuid, text) to authenticated;
grant execute on function public.release_room(uuid) to authenticated;
grant execute on function public.qualify_referral(uuid, text) to authenticated;
grant execute on function public.get_wallet_balances(uuid) to authenticated;
grant execute on function public.get_setting(text, jsonb), public.get_setting_text(text, text),
  public.get_setting_num(text, numeric), public.get_setting_bool(text, boolean) to authenticated;
grant execute on function public.is_flag_enabled(text, boolean) to authenticated;
grant execute on function public.has_permission(text, uuid), public.is_admin(uuid) to authenticated;
grant execute on function public.effective_tournament_status(public.tournaments) to authenticated;
grant execute on function public.compute_withdrawal_fee(numeric) to authenticated;
grant execute on function public.notify_user(uuid, public.notification_type, text, text, jsonb) to authenticated;
