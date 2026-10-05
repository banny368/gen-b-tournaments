-- ============================================================
-- Gen B Tournaments — 0017: fix RLS "infinite recursion"
-- Policies on tournament_entries / team_members / clan_members
-- sub-queried their OWN table, which Postgres rejects ("infinite
-- recursion detected in policy"). That broke every client read of
-- entries (My Matches, participants), and cascaded into any policy
-- referencing those tables (chat channels). Replace the self-queries
-- with SECURITY DEFINER helper functions that bypass RLS.
-- ============================================================

create or replace function public.is_tournament_participant(
  p_tournament uuid,
  p_user uuid default null
) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.tournament_entries
     where tournament_id = p_tournament
       and user_id = coalesce(p_user, auth.uid())
       and status = 'ACTIVE'
  );
$$;

create or replace function public.is_team_member(
  p_team uuid,
  p_user uuid default null
) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.team_members
     where team_id = p_team
       and user_id = coalesce(p_user, auth.uid())
       and status = 'ACTIVE'
  );
$$;

create or replace function public.is_clan_member(
  p_clan uuid,
  p_user uuid default null
) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.clan_members
     where clan_id = p_clan
       and user_id = coalesce(p_user, auth.uid())
       and status = 'ACTIVE'
  );
$$;

grant execute on function public.is_tournament_participant(uuid, uuid) to authenticated;
grant execute on function public.is_team_member(uuid, uuid) to authenticated;
grant execute on function public.is_clan_member(uuid, uuid) to authenticated;

-- ---------- tournament_entries ----------
drop policy if exists "participants see tournament lobby" on public.tournament_entries;
create policy "participants see tournament lobby"
  on public.tournament_entries for select to authenticated using (
    public.is_tournament_participant(tournament_entries.tournament_id) or public.is_admin()
  );

-- ---------- team_members ----------
drop policy if exists "memberships readable" on public.team_members;
create policy "memberships readable"
  on public.team_members for select to authenticated using (
    user_id = auth.uid()
    or public.is_admin()
    or public.is_team_member(team_members.team_id)
  );

-- ---------- clan_members ----------
drop policy if exists "memberships visible to members" on public.clan_members;
create policy "memberships visible to members"
  on public.clan_members for select to authenticated using (
    user_id = auth.uid()
    or public.is_admin()
    or public.is_clan_member(clan_members.clan_id)
  );
