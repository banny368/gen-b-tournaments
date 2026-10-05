-- ============================================================
-- Gen B Tournaments — 0004: Core Functions
-- Settings, feature flags, RBAC, signup trigger, status logic
-- ============================================================

-- ---------- updated_at maintenance ----------
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array['profiles','games','tournaments','teams','clans','wallets',
    'deposits','payment_orders','withdrawals','kyc_records','risk_events','claims','clan_members']
  loop
    execute format('drop trigger if exists trg_touch_%1$s on public.%1$I;', t);
    execute format('create trigger trg_touch_%1$s before update on public.%1$I
      for each row execute function public.touch_updated_at();', t);
  end loop;
end $$;

-- ---------- SETTINGS ----------
create or replace function public.get_setting(p_key text, p_default jsonb default null)
returns jsonb
language sql stable security definer set search_path = public as $$
  select value from public.admin_settings where key = p_key
  union all
  select p_default where not exists (select 1 from public.admin_settings where key = p_key)
  limit 1;
$$;

create or replace function public.get_setting_text(p_key text, p_default text default null)
returns text language plpgsql stable security definer set search_path = public as $$
declare v jsonb;
begin
  v := public.get_setting(p_key);
  return coalesce(v #>> '{}', p_default);
end;
$$;

create or replace function public.get_setting_num(p_key text, p_default numeric default 0)
returns numeric language plpgsql stable security definer set search_path = public as $$
declare v jsonb;
begin
  v := public.get_setting(p_key);
  return coalesce((v #>> '{}')::numeric, p_default);
end;
$$;

create or replace function public.get_setting_bool(p_key text, p_default boolean default false)
returns boolean language plpgsql stable security definer set search_path = public as $$
declare v jsonb;
begin
  v := public.get_setting(p_key);
  return coalesce((v #>> '{}')::boolean, p_default);
end;
$$;

-- ---------- FEATURE FLAGS ----------
create or replace function public.is_flag_enabled(p_key text, p_default boolean default false)
returns boolean
language sql stable security definer set search_path = public as $$
  select enabled from public.feature_flags where key = p_key
  union all
  select p_default where not exists (select 1 from public.feature_flags where key = p_key)
  limit 1;
$$;

-- ---------- RBAC ----------
create or replace function public.role_has_permission(p_role public.admin_role, p_permission text)
returns boolean language sql immutable as $$
  select p_role = 'SUPER_ADMIN' or (p_role, p_permission) in (
    ('FINANCE_ADMIN','VIEW_USERS'), ('FINANCE_ADMIN','VIEW_DEPOSITS'), ('FINANCE_ADMIN','APPROVE_DEPOSIT'),
    ('FINANCE_ADMIN','VIEW_WITHDRAWALS'), ('FINANCE_ADMIN','APPROVE_WITHDRAWAL'), ('FINANCE_ADMIN','CONFIGURE_FEES'),
    ('FINANCE_ADMIN','VIEW_LEDGER'), ('FINANCE_ADMIN','CREATE_ADJUSTMENT'), ('FINANCE_ADMIN','VIEW_ANALYTICS'),
    ('TOURNAMENT_ADMIN','VIEW_USERS'), ('TOURNAMENT_ADMIN','CREATE_TOURNAMENT'), ('TOURNAMENT_ADMIN','EDIT_TOURNAMENT'),
    ('TOURNAMENT_ADMIN','CANCEL_TOURNAMENT'), ('TOURNAMENT_ADMIN','VIEW_ANALYTICS'),
    ('SUPPORT_ADMIN','VIEW_USERS'), ('SUPPORT_ADMIN','VIEW_DEPOSITS'), ('SUPPORT_ADMIN','VIEW_WITHDRAWALS'), ('SUPPORT_ADMIN','VIEW_LEDGER'),
    ('MODERATOR','MODERATE_CHAT'), ('MODERATOR','VIEW_USERS'),
    ('CONTENT_ADMIN','MANAGE_LEGAL_CONTENT'), ('CONTENT_ADMIN','VIEW_ANALYTICS'),
    ('RISK_ADMIN','VIEW_USERS'), ('RISK_ADMIN','VIEW_LEDGER'), ('RISK_ADMIN','VIEW_DEPOSITS'), ('RISK_ADMIN','VIEW_WITHDRAWALS'),
    ('ANALYST','VIEW_ANALYTICS'), ('ANALYST','VIEW_USERS'), ('ANALYST','VIEW_LEDGER')
  );
$$;

create or replace function public.has_permission(p_permission text, p_user uuid default null)
returns boolean
language plpgsql stable security definer set search_path = public as $$
declare
  v_user uuid := coalesce(p_user, auth.uid());
  v_override record;
begin
  if v_user is null then return false; end if;

  -- explicit per-user override wins
  select o.granted into v_override
    from public.user_permission_overrides o
   where o.user_id = v_user and o.permission_code = p_permission
   limit 1;
  if found then return v_override.granted; end if;

  return exists (
    select 1 from public.user_roles r
     where r.user_id = v_user
       and public.role_has_permission(r.role, p_permission)
  );
end;
$$;

create or replace function public.is_admin(p_user uuid default null)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = coalesce(p_user, auth.uid()));
$$;

-- ---------- SIGNUP TRIGGER ----------
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_base text;
  v_username text;
  v_suffix int := 0;
  v_referrer uuid;
begin
  v_base := lower(regexp_replace(split_part(coalesce(new.email, 'player'), '@', 1), '[^a-z0-9_]', '', 'g'));
  if coalesce(v_base, '') = '' then v_base := 'player'; end if;
  if length(v_base) > 20 then v_base := substr(v_base, 1, 20); end if;
  v_username := v_base;
  while exists (select 1 from public.profiles where username = v_username) loop
    v_suffix := v_suffix + 1;
    v_username := v_base || v_suffix::text;
    exit when v_suffix > 999;
  end loop;

  insert into public.profiles (id, username, display_name, avatar_url)
  values (
    new.id,
    v_username,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', v_username),
    new.raw_user_meta_data ->> 'avatar_url'
  );

  insert into public.wallets (user_id) values (new.id) on conflict do nothing;

  -- capture referral code from signup metadata
  if new.raw_user_meta_data ? 'referral_code' then
    select p.id into v_referrer
      from public.profiles p
     where p.referral_code = upper(new.raw_user_meta_data ->> 'referral_code')
       and p.id <> new.id
     limit 1;
    if v_referrer is not null then
      insert into public.referrals (referrer_id, referee_id, code_used)
      values (v_referrer, new.id, upper(new.raw_user_meta_data ->> 'referral_code'))
      on conflict (referee_id) do nothing;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- CHAT MEMBERSHIP ----------
create or replace function public.is_channel_member(p_channel uuid, p_user uuid default null)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.chat_members m
    join public.chat_channels c on c.id = m.channel_id
     where m.channel_id = p_channel
       and m.user_id = coalesce(p_user, auth.uid())
       and m.status = 'ACTIVE'
       and (c.type <> 'CLAN' or exists (
         select 1 from public.clan_members cm
          where cm.clan_id = c.clan_id
            and cm.user_id = coalesce(p_user, auth.uid())
            and cm.status = 'ACTIVE'
       ))
  );
$$;

-- ---------- TOURNAMENT EFFECTIVE STATUS (server-time derived) ----------
create or replace function public.effective_tournament_status(t public.tournaments)
returns public.tournament_status
language plpgsql stable as $$
begin
  if t.status = 'DRAFT' then return 'DRAFT'; end if;
  if t.status in ('CANCELLED','REFUNDING','REFUNDED','COMPLETED','DISPUTED') then return t.status; end if;
  if t.status in ('ROOM_PENDING','ROOM_RELEASED') and now() < t.match_start then return t.status; end if;
  if t.status in ('RESULT_PENDING','RESULT_REVIEW') then return t.status; end if;

  -- time-derived transitions (server clock is authoritative)
  if now() < coalesce(t.registration_start, t.match_start) then
    return 'SCHEDULED';
  end if;
  if now() < coalesce(t.registration_end, t.match_start) then
    return 'REGISTRATION_OPEN';
  end if;
  if now() < t.match_start then
    return 'REGISTRATION_CLOSED';
  end if;
  if t.estimated_end is null or now() < t.estimated_end then
    return 'LIVE';
  end if;
  return 'RESULT_PENDING';
end;
$$;

-- ---------- AUDIT HELPER ----------
create or replace function public.write_audit(
  p_action text,
  p_resource_type text,
  p_resource_id text default null,
  p_before jsonb default null,
  p_after jsonb default null,
  p_reason text default null
) returns void
language plpgsql security definer set search_path = public as $$
begin
  insert into public.audit_logs (actor_id, actor_role, action, resource_type, resource_id, before_state, after_state, reason)
  values (
    auth.uid(),
    (select role::text from public.user_roles where user_id = auth.uid() limit 1),
    p_action, p_resource_type, p_resource_id, p_before, p_after, p_reason
  );
end;
$$;

-- ---------- NOTIFICATION HELPER ----------
create or replace function public.notify_user(
  p_user uuid,
  p_type public.notification_type,
  p_title text,
  p_body text default null,
  p_data jsonb default '{}'::jsonb
) returns void
language sql security definer set search_path = public as $$
  insert into public.notifications (user_id, type, title, body, data)
  values (p_user, p_type, p_title, p_body, p_data);
$$;
