-- ============================================================
-- Gen B Tournaments — 0005: Money Engine (Part 1)
-- Ledger posting, tournament join, prizes, refunds
-- ALL financial state changes flow through these functions.
-- ============================================================

-- ---------- LEDGER POSTING ----------
-- Posts a balanced double-entry transaction and updates cached wallet balances.
-- Lines: [{account_kind:'USER'|'SYSTEM', account, user_id, wallet_id, direction, amount}]
create or replace function public.ledger_post(
  p_txn_type text,
  p_lines jsonb,
  p_idempotency_key text default null,
  p_reference_type text default null,
  p_reference_id uuid default null,
  p_description text default null,
  p_rule_snapshot jsonb default '{}'::jsonb,
  p_created_by uuid default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_txn_id uuid;
  v_line jsonb;
  v_existing uuid;
begin
  -- Idempotency: same key returns the original transaction, never a second movement
  if p_idempotency_key is not null then
    select id into v_existing from public.ledger_transactions where idempotency_key = p_idempotency_key;
    if v_existing is not null then
      return v_existing;
    end if;
  end if;

  insert into public.ledger_transactions (txn_type, reference_type, reference_id, idempotency_key, description, rule_snapshot, created_by)
  values (p_txn_type, p_reference_type, p_reference_id, p_idempotency_key, p_description, p_rule_snapshot, coalesce(p_created_by, auth.uid()))
  returning id into v_txn_id;

  for v_line in select * from jsonb_array_elements(p_lines) loop
    insert into public.ledger_entries
      (transaction_id, account_kind, account, user_id, wallet_id, direction, amount)
    values (
      v_txn_id,
      v_line->>'account_kind',
      v_line->>'account',
      (v_line->>'user_id')::uuid,
      (v_line->>'wallet_id')::uuid,
      (v_line->>'direction')::public.ledger_direction,
      (v_line->>'amount')::numeric(14,2)
    );

    -- maintain cached user balances (serialized on the balance row)
    if v_line->>'account_kind' = 'USER' then
      insert into public.wallet_balances (wallet_id, account, balance)
      values (
        (v_line->>'wallet_id')::uuid,
        (v_line->>'account')::public.user_account_type,
        case when v_line->>'direction' = 'CREDIT' then (v_line->>'amount')::numeric(14,2)
             else -(v_line->>'amount')::numeric(14,2) end
      )
      on conflict (wallet_id, account) do update
        set balance = public.wallet_balances.balance + excluded.balance,
            updated_at = now();
    end if;
  end loop;

  return v_txn_id;
end;
$$;

-- Resolve the wallet id for a user (every user has exactly one)
create or replace function public.get_wallet_id(p_user uuid)
returns uuid
language sql stable security definer set search_path = public as $$
  select id from public.wallets where user_id = p_user limit 1;
$$;

-- Read all user balances as jsonb {DEPOSIT: x, BONUS: y, ...}
create or replace function public.get_wallet_balances(p_user uuid)
returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_object_agg(b.account, b.balance), '{}'::jsonb)
    from public.wallet_balances b
    join public.wallets w on w.id = b.wallet_id
   where w.user_id = p_user;
$$;

-- ============================================================
-- TOURNAMENT JOIN — atomic, race-safe, idempotent
-- ============================================================
create or replace function public.join_tournament(
  p_tournament_id uuid,
  p_idempotency_key text default null,
  p_team_id uuid default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_t public.tournaments%rowtype;
  v_game public.games%rowtype;
  v_profile public.profiles%rowtype;
  v_dob date;
  v_eff public.tournament_status;
  v_fee numeric(14,2);
  v_required int;
  v_wallet uuid;
  v_balances jsonb;
  v_priority jsonb;
  v_alloc jsonb;
  v_line jsonb;
  v_lines jsonb;
  v_remaining numeric(14,2);
  v_take numeric(14,2);
  v_acct text;
  v_cap numeric(14,2);
  v_real_contributed numeric(14,2);
  v_entry_id uuid;
  v_age_years numeric;
begin
  if v_user is null then
    return jsonb_build_object('success', false, 'error', jsonb_build_object('code','AUTH_REQUIRED','message','Sign in required.'));
  end if;

  -- Retry with the same idempotency key returns the original entry
  if p_idempotency_key is not null then
    select id into v_entry_id from public.tournament_entries
     where idempotency_key = p_idempotency_key and user_id = v_user;
    if v_entry_id is not null then
      return jsonb_build_object('success', true, 'data', jsonb_build_object('entry_id', v_entry_id, 'already_joined', true));
    end if;
  end if;

  select * into v_profile from public.profiles where id = v_user;
  if v_profile is null or v_profile.is_banned then
    return jsonb_build_object('success', false, 'error', jsonb_build_object('code','USER_BANNED','message','Account suspended.'));
  end if;

  -- Lock the tournament row: serializes capacity checks under concurrency
  select * into v_t from public.tournaments where id = p_tournament_id for update;
  if v_t is null or v_t.visibility = 'HIDDEN' then
    return jsonb_build_object('success', false, 'error', jsonb_build_object('code','TOURNAMENT_NOT_FOUND','message','Tournament not found.'));
  end if;

  v_eff := public.effective_tournament_status(v_t);
  if v_eff <> 'REGISTRATION_OPEN' then
    return jsonb_build_object('success', false, 'error', jsonb_build_object('code','REGISTRATION_CLOSED','message','Registration is not open for this tournament.'));
  end if;

  select * into v_game from public.games where id = v_t.game_id;
  if not v_game.active then
    return jsonb_build_object('success', false, 'error', jsonb_build_object('code','GAME_INACTIVE','message','This game is currently unavailable.'));
  end if;

  -- eligibility: age, region (DOB lives in profile_private, not the public profile)
  select date_of_birth into v_dob from public.profile_private where user_id = v_user;
  if v_dob is not null then
    v_age_years := extract(epoch from (now() - v_dob)) / 31557600;
    if v_age_years < v_game.minimum_age then
      return jsonb_build_object('success', false, 'error', jsonb_build_object('code','AGE_RESTRICTED','message','You do not meet the minimum age for this game.'));
    end if;
  elsif v_game.minimum_age > 0 then
    return jsonb_build_object('success', false, 'error', jsonb_build_object('code','AGE_VERIFICATION_REQUIRED','message','Add your date of birth in profile to join.'));
  end if;
  if not ('GLOBAL' = any(v_game.allowed_regions) or v_profile.country = any(v_game.allowed_regions)) then
    return jsonb_build_object('success', false, 'error', jsonb_build_object('code','REGION_RESTRICTED','message','Not available in your region.'));
  end if;

  -- team validation
  v_required := v_t.team_size;
  if p_team_id is not null then
    if not exists (
      select 1 from public.team_members
       where team_id = p_team_id and user_id = v_user and status = 'ACTIVE'
    ) then
      return jsonb_build_object('success', false, 'error', jsonb_build_object('code','NOT_TEAM_MEMBER','message','You are not an active member of this team.'));
    end if;
  elsif v_required > 1 and v_t.format not in ('BATTLE_ROYALE','SOLO') then
    return jsonb_build_object('success', false, 'error', jsonb_build_object('code','TEAM_REQUIRED','message','This tournament requires a team registration.'));
  end if;

  -- capacity (players, not entries)
  if v_t.current_players + v_required > v_t.max_players then
    return jsonb_build_object('success', false, 'error', jsonb_build_object('code','TOURNAMENT_FULL','message','This tournament is full.'));
  end if;

  v_fee := v_t.entry_fee;
  v_lines := '[]'::jsonb;

  if v_fee > 0 then
    v_wallet := public.get_wallet_id(v_user);
    v_balances := public.get_wallet_balances(v_user);
    v_priority := coalesce(public.get_setting('entry_balance_priority', '["DEPOSIT","WINNINGS","REWARD","BONUS"]'::jsonb), '["DEPOSIT","WINNINGS","REWARD","BONUS"]'::jsonb);

    v_alloc := '{}'::jsonb;
    v_remaining := v_fee;
    v_real_contributed := 0;

    -- first pass: real balances without caps
    foreach v_acct in array (select jsonb_array_elements_text(v_priority)) loop
      exit when v_remaining <= 0;
      if v_acct in ('DEPOSIT','WINNINGS') then
        v_take := least(coalesce((v_balances ->> v_acct)::numeric, 0), v_remaining);
        if v_take > 0 then
          v_alloc := v_alloc || jsonb_build_object(v_acct, v_take);
          v_remaining := v_remaining - v_take;
          v_real_contributed := v_real_contributed + v_take;
        end if;
      end if;
    end loop;

    -- configurable minimum real-money contribution
    v_cap := round(v_fee * public.get_setting_num('min_real_balance_percentage', 0) / 100, 2);
    if v_cap > 0 and v_real_contributed < v_cap then
      return jsonb_build_object('success', false, 'error', jsonb_build_object('code','INSUFFICIENT_REAL_BALANCE','message','Add funds to cover the minimum real-balance portion of the entry fee.'));
    end if;

    -- second pass: promotional balances with configurable caps
    foreach v_acct in array (select jsonb_array_elements_text(v_priority)) loop
      exit when v_remaining <= 0;
      if v_acct in ('BONUS','REWARD') then
        if not public.get_setting_bool(lower(v_acct) || '_usage_enabled', true) then
          continue;
        end if;
        v_cap := round(v_fee * public.get_setting_num(lower(v_acct) || '_usage_percentage', 20) / 100, 2)
                 - coalesce((v_alloc ->> v_acct)::numeric, 0);
        v_cap := greatest(v_cap, 0);
        v_take := least(coalesce((v_balances ->> v_acct)::numeric, 0), v_remaining, v_cap);
        if v_take > 0 then
          v_alloc := v_alloc || jsonb_build_object(v_acct, coalesce((v_alloc ->> v_acct)::numeric, 0) + v_take);
          v_remaining := v_remaining - v_take;
        end if;
      end if;
    end loop;

    if v_remaining > 0 then
      return jsonb_build_object('success', false, 'error', jsonb_build_object('code','INSUFFICIENT_BALANCE','message','Not enough wallet balance for the entry fee.'));
    end if;

    v_lines := '[]'::jsonb;
    for v_line in select * from jsonb_each(v_alloc) loop
      v_lines := v_lines || jsonb_build_array(jsonb_build_object(
        'account_kind','USER','account', v_line.key, 'user_id', v_user, 'wallet_id', v_wallet,
        'direction','DEBIT','amount', v_line.value));
    end loop;
    v_lines := v_lines || jsonb_build_array(jsonb_build_object(
      'account_kind','SYSTEM','account','TOURNAMENT_ESCROW','direction','CREDIT','amount', v_fee));
  end if;

  begin
    insert into public.tournament_entries (tournament_id, user_id, team_id, slot_no, idempotency_key)
    values (p_tournament_id, v_user, p_team_id, v_t.current_players + 1, p_idempotency_key)
    returning id into v_entry_id;
  exception when unique_violation then
    -- concurrent double-join by the same user: return the original entry
    select id into v_entry_id from public.tournament_entries
     where tournament_id = p_tournament_id and user_id = v_user;
    return jsonb_build_object('success', true, 'data', jsonb_build_object('entry_id', v_entry_id, 'already_joined', true));
  end;

  update public.tournaments
     set current_players = current_players + v_required
   where id = p_tournament_id;

  if v_fee > 0 then
    perform public.ledger_post(
      'TOURNAMENT_ENTRY',
      v_lines,
      coalesce(p_idempotency_key, 'entry:' || v_entry_id),
      'TOURNAMENT_ENTRY', v_entry_id,
      'Entry fee for ' || v_t.title,
      jsonb_build_object('tournament_id', p_tournament_id, 'entry_fee', v_fee, 'allocation', v_alloc)
    );
  end if;

  return jsonb_build_object('success', true, 'data', jsonb_build_object('entry_id', v_entry_id, 'slot_no', v_t.current_players + 1));
end;
$$;

-- ============================================================
-- RESULTS → PRIZE PAYOUT + COMMISSION (idempotent)
-- ============================================================
create or replace function public.publish_results_and_pay(
  p_tournament_id uuid,
  p_results jsonb -- [{user_id?, team_id?, placement, kills, points}]
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_admin uuid := auth.uid();
  v_t public.tournaments%rowtype;
  v_rate numeric(5,2);
  v_rate_source text;
  v_collected numeric(14,2);
  v_commission numeric(14,2);
  v_prize_pool numeric(14,2);
  v_r jsonb;
  v_rank int;
  v_amount numeric(14,2);
  v_lines jsonb;
  v_game_commission numeric(5,2);
begin
  if not public.has_permission('EDIT_TOURNAMENT') then
    return jsonb_build_object('success', false, 'error', jsonb_build_object('code','FORBIDDEN','message','Missing permission.'));
  end if;

  select * into v_t from public.tournaments where id = p_tournament_id for update;
  if v_t is null then
    return jsonb_build_object('success', false, 'error', jsonb_build_object('code','NOT_FOUND','message','Tournament not found.'));
  end if;
  if v_t.payout_status = 'PAID' then
    return jsonb_build_object('success', true, 'data', jsonb_build_object('already_paid', true));
  end if;
  if v_t.status not in ('RESULT_PENDING','RESULT_REVIEW','LIVE') then
    return jsonb_build_object('success', false, 'error', jsonb_build_object('code','INVALID_STATUS','message','Tournament is not in a payable state.'));
  end if;

  -- collected entry fees actually escrowed for this tournament
  v_collected := coalesce((
    select sum(e.amount) from public.ledger_entries e
    join public.ledger_transactions t on t.id = e.transaction_id
     where t.txn_type = 'TOURNAMENT_ENTRY'
       and t.reference_id in (select id from public.tournament_entries where tournament_id = p_tournament_id)
       and e.account = 'TOURNAMENT_ESCROW' and e.direction = 'CREDIT'
  ), 0);

  -- configurable commission: tournament override → game → default
  select (g.metadata ->> 'commission_percent')::numeric into v_game_commission
    from public.games g where g.id = v_t.game_id;
  if v_t.commission_override is not null then
    v_rate := v_t.commission_override; v_rate_source := 'TOURNAMENT_OVERRIDE';
  elsif v_game_commission is not null then
    v_rate := v_game_commission; v_rate_source := 'GAME';
  else
    v_rate := public.get_setting_num('default_commission_percent', 10); v_rate_source := 'DEFAULT';
  end if;

  v_commission := round(v_collected * v_rate / 100, 2);
  v_prize_pool := v_collected - v_commission;

  -- prize distribution percents must sum to 100
  if coalesce((select sum((d->>'percent')::numeric) from jsonb_array_elements(v_t.prize_distribution) d), 0) <> 100 then
    return jsonb_build_object('success', false, 'error', jsonb_build_object('code','BAD_PRIZE_DISTRIBUTION','message','Prize distribution percents must sum to 100.'));
  end if;

  insert into public.commissions (tournament_id, amount, rate, rate_source)
  values (p_tournament_id, v_commission, v_rate, v_rate_source)
  on conflict (tournament_id) do nothing;

  for v_r in select * from jsonb_array_elements(p_results) loop
    v_rank := (v_r->>'placement')::int;
    select round(v_prize_pool * (d->>'percent')::numeric / 100, 2) into v_amount
      from jsonb_array_elements(v_t.prize_distribution) d
     where (d->>'rank')::int = v_rank
       and (d->>'percent') is not null;
    if v_amount is null then
      return jsonb_build_object('success', false, 'error', jsonb_build_object('code','BAD_PRIZE_DISTRIBUTION','message','No prize percent configured for rank ' || v_rank || '.'));
    end if;

    insert into public.tournament_results (tournament_id, user_id, team_id, placement, kills, points, status, reviewed_by, reviewed_at)
    values (p_tournament_id, (v_r->>'user_id')::uuid, (v_r->>'team_id')::uuid, v_rank,
            (v_r->>'kills')::int, (v_r->>'points')::numeric, 'APPROVED', v_admin, now())
    on conflict (tournament_id, round_no, placement) do nothing;

    insert into public.prizes (tournament_id, user_id, team_id, placement, amount, status)
    values (p_tournament_id, (v_r->>'user_id')::uuid, (v_r->>'team_id')::uuid, v_rank, v_amount, 'PENDING')
    on conflict (tournament_id, placement) do nothing;
  end loop;

  -- pay each prize through the ledger (idempotent per placement)
  for v_r in select * from public.prizes where tournament_id = p_tournament_id and status = 'PENDING' loop
    if v_r.amount > 0 and v_r.user_id is not null then
      v_lines := jsonb_build_array(
        jsonb_build_object('account_kind','SYSTEM','account','TOURNAMENT_ESCROW','direction','DEBIT','amount', v_r.amount),
        jsonb_build_object('account_kind','USER','account','WINNINGS','user_id', v_r.user_id,
                           'wallet_id', public.get_wallet_id(v_r.user_id),'direction','CREDIT','amount', v_r.amount)
      );
      perform public.ledger_post('PRIZE_PAYOUT', v_lines, 'prize:' || p_tournament_id || ':' || v_r.placement,
        'PRIZE', v_r.id, 'Prize for rank ' || v_r.placement);
      update public.prizes set status = 'CREDITED' where id = v_r.id;
      perform public.notify_user(v_r.user_id, 'PRIZE_CREDITED', 'Prize credited',
        'Your prize for ' || v_t.title || ' has been credited.', jsonb_build_object('tournament_id', p_tournament_id, 'amount', v_r.amount));
    elsif v_r.amount > 0 and v_r.team_id is not null then
      -- team prize: split equally across active members
      perform public.ledger_post('PRIZE_PAYOUT',
        jsonb_build_array(
          jsonb_build_object('account_kind','SYSTEM','account','TOURNAMENT_ESCROW','direction','DEBIT','amount', v_r.amount),
          jsonb_build_object('account_kind','SYSTEM','account','ADJUSTMENT','direction','CREDIT','amount', v_r.amount)
        ),
        'prize:' || p_tournament_id || ':' || v_r.placement || ':teamholding',
        'PRIZE', v_r.id, 'Team prize holding (split pending)');
      update public.prizes set status = 'CREDITED' where id = v_r.id;
    end if;
  end loop;

  -- commission to platform revenue
  if v_commission > 0 then
    perform public.ledger_post('COMMISSION',
      jsonb_build_array(
        jsonb_build_object('account_kind','SYSTEM','account','TOURNAMENT_ESCROW','direction','DEBIT','amount', v_commission),
        jsonb_build_object('account_kind','SYSTEM','account','PLATFORM_REVENUE','direction','CREDIT','amount', v_commission)
      ),
      'commission:' || p_tournament_id,
      'TOURNAMENT', p_tournament_id, 'Commission for ' || v_t.title);
  end if;

  update public.tournaments
     set status = 'COMPLETED', result_status = 'APPROVED', payout_status = 'PAID'
   where id = p_tournament_id;

  perform public.write_audit('PUBLISH_RESULTS', 'tournament', p_tournament_id::text, null,
    jsonb_build_object('commission', v_commission, 'prize_pool', v_prize_pool));

  return jsonb_build_object('success', true, 'data', jsonb_build_object('commission', v_commission, 'prize_pool', v_prize_pool));
end;
$$;

-- ============================================================
-- TOURNAMENT CANCELLATION → REFUNDS (idempotent per entry)
-- ============================================================
create or replace function public.cancel_tournament_refunds(
  p_tournament_id uuid,
  p_reason text
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_admin uuid := auth.uid();
  v_t public.tournaments%rowtype;
  v_entry record;
  v_refunded int := 0;
begin
  if not public.has_permission('CANCEL_TOURNAMENT') then
    return jsonb_build_object('success', false, 'error', jsonb_build_object('code','FORBIDDEN','message','Missing permission.'));
  end if;

  select * into v_t from public.tournaments where id = p_tournament_id for update;
  if v_t is null then
    return jsonb_build_object('success', false, 'error', jsonb_build_object('code','NOT_FOUND','message','Tournament not found.'));
  end if;
  if v_t.status in ('REFUNDED','CANCELLED') then
    return jsonb_build_object('success', true, 'data', jsonb_build_object('already_done', true, 'refunded', 0));
  end if;
  if v_t.payout_status = 'PAID' then
    return jsonb_build_object('success', false, 'error', jsonb_build_object('code','ALREADY_PAID','message','Cannot cancel a tournament whose prizes were already paid.'));
  end if;

  update public.tournaments set status = 'REFUNDING' where id = p_tournament_id;

  for v_entry in
    select e.*, t.entry_fee from public.tournament_entries e
    join public.tournaments t on t.id = e.tournament_id
     where e.tournament_id = p_tournament_id and e.status = 'ACTIVE' and t.entry_fee > 0
  loop
    begin
      insert into public.refunds (tournament_id, entry_id, user_id, amount, reason)
      values (p_tournament_id, v_entry.id, v_entry.user_id, v_t.entry_fee, p_reason);
    exception when unique_violation then
      continue; -- already refunded
    end;

    perform public.ledger_post('REFUND',
      jsonb_build_array(
        jsonb_build_object('account_kind','SYSTEM','account','TOURNAMENT_ESCROW','direction','DEBIT','amount', v_t.entry_fee),
        jsonb_build_object('account_kind','USER','account','REFUND','user_id', v_entry.user_id,
                           'wallet_id', public.get_wallet_id(v_entry.user_id),'direction','CREDIT','amount', v_t.entry_fee)
      ),
      'refund:' || v_entry.id, 'REFUND', v_entry.id, 'Refund — ' || v_t.title);

    update public.tournament_entries set status = 'REFUNDED' where id = v_entry.id;
    perform public.notify_user(v_entry.user_id, 'SYSTEM', 'Tournament cancelled',
      v_t.title || ' was cancelled. Your entry fee was refunded to your wallet.');
    v_refunded := v_refunded + 1;
  end loop;

  -- refund free entries too (status change only)
  update public.tournament_entries set status = 'REFUNDED'
   where tournament_id = p_tournament_id and status = 'ACTIVE';

  update public.tournaments set status = 'REFUNDED' where id = p_tournament_id;
  perform public.write_audit('CANCEL_TOURNAMENT', 'tournament', p_tournament_id::text, null,
    jsonb_build_object('reason', p_reason, 'refunded_entries', v_refunded));

  return jsonb_build_object('success', true, 'data', jsonb_build_object('refunded', v_refunded));
end;
$$;

-- ============================================================
-- ROOM CREDENTIALS — hidden until authorized
-- ============================================================
create or replace function public.get_room_credentials(p_tournament_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_t public.tournaments%rowtype;
  v_room public.tournament_rooms%rowtype;
begin
  if v_user is null then
    return jsonb_build_object('success', false, 'error', jsonb_build_object('code','AUTH_REQUIRED','message','Sign in required.'));
  end if;

  select * into v_t from public.tournaments where id = p_tournament_id;
  if v_t is null then
    return jsonb_build_object('success', false, 'error', jsonb_build_object('code','NOT_FOUND','message','Tournament not found.'));
  end if;

  if not public.has_permission('EDIT_TOURNAMENT') then
    if not exists (select 1 from public.tournament_entries
                    where tournament_id = p_tournament_id and user_id = v_user and status = 'ACTIVE') then
      return jsonb_build_object('success', false, 'error', jsonb_build_object('code','NOT_PARTICIPANT','message','Only participants can view room credentials.'));
    end if;
  end if;

  select * into v_room from public.tournament_rooms where tournament_id = p_tournament_id;
  if v_room is null or (v_room.room_id is null and v_room.room_password is null) then
    return jsonb_build_object('success', false, 'error', jsonb_build_object('code','ROOM_NOT_SET','message','Room details are not published yet.'));
  end if;

  -- visible only after release time (admin release OR scheduled release OR 15 min before match)
  if v_room.released_at is null
     and (v_room.release_at is null or now() < v_room.release_at)
     and (v_t.match_start is null or now() < v_t.match_start - interval '15 minutes') then
    return jsonb_build_object('success', false, 'error', jsonb_build_object('code','ROOM_NOT_RELEASED','message','Room details unlock closer to match time.'));
  end if;

  if v_room.hide_after_end and v_t.status in ('COMPLETED','REFUNDED','CANCELLED') then
    return jsonb_build_object('success', false, 'error', jsonb_build_object('code','ROOM_CLOSED','message','Room details are no longer available.'));
  end if;

  return jsonb_build_object('success', true, 'data', jsonb_build_object(
    'room_id', v_room.room_id, 'room_password', v_room.room_password,
    'map', v_room.map_name, 'server_region', v_room.server_region, 'notes', v_room.notes));
end;
$$;

create or replace function public.release_room(p_tournament_id uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if not public.has_permission('EDIT_TOURNAMENT') then
    return jsonb_build_object('success', false, 'error', jsonb_build_object('code','FORBIDDEN','message','Missing permission.'));
  end if;
  update public.tournament_rooms set released_at = now(), updated_by = auth.uid() where tournament_id = p_tournament_id;
  perform public.write_audit('RELEASE_ROOM', 'tournament', p_tournament_id::text);
  return jsonb_build_object('success', true, 'data', jsonb_build_object('released', true));
end;
$$;
