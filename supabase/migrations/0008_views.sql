-- ============================================================
-- Gen B Tournaments — 0008: Leaderboard Views
-- All leaderboard math stays server-side.
-- ============================================================

create or replace view public.leaderboard_global as
select
  p.id as user_id,
  p.username,
  p.display_name,
  p.avatar_url,
  count(distinct e.id) as matches,
  count(distinct r.id) filter (where r.placement = 1) as wins,
  coalesce(sum(r.kills), 0) as kills,
  coalesce(sum(r.points), 0) as points,
  coalesce((select sum(pr.amount) from public.prizes pr where pr.user_id = p.id and pr.status = 'CREDITED'), 0) as earnings
from public.profiles p
left join public.tournament_entries e on e.user_id = p.id and e.status = 'ACTIVE'
left join public.tournament_results r on r.user_id = p.id and r.status = 'APPROVED'
group by p.id;

create or replace view public.leaderboard_weekly as
select
  p.id as user_id,
  p.username,
  p.display_name,
  p.avatar_url,
  count(distinct e.id) as matches,
  count(distinct r.id) filter (where r.placement = 1) as wins,
  coalesce(sum(r.kills), 0) as kills,
  coalesce(sum(r.points), 0) as points
from public.profiles p
left join public.tournament_entries e
  on e.user_id = p.id and e.status = 'ACTIVE' and e.joined_at > date_trunc('week', now())
left join public.tournament_results r
  on r.user_id = p.id and r.status = 'APPROVED' and r.created_at > date_trunc('week', now())
group by p.id;

create or replace view public.leaderboard_monthly as
select
  p.id as user_id,
  p.username,
  p.display_name,
  p.avatar_url,
  count(distinct e.id) as matches,
  count(distinct r.id) filter (where r.placement = 1) as wins,
  coalesce(sum(r.kills), 0) as kills,
  coalesce(sum(r.points), 0) as points
from public.profiles p
left join public.tournament_entries e
  on e.user_id = p.id and e.status = 'ACTIVE' and e.joined_at > date_trunc('month', now())
left join public.tournament_results r
  on r.user_id = p.id and r.status = 'APPROVED' and r.created_at > date_trunc('month', now())
group by p.id;

grant select on public.leaderboard_global, public.leaderboard_weekly, public.leaderboard_monthly to anon, authenticated;

-- ============================================================
-- Global chat channel id helper (single well-known row)
-- ============================================================
create or replace function public.get_global_channel()
returns uuid
language sql stable security definer set search_path = public as $$
  select id from public.chat_channels where type = 'GLOBAL' limit 1;
$$;
grant execute on function public.get_global_channel() to authenticated;
