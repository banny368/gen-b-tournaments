-- ============================================================
-- Gen B Tournaments — 0006: Money Engine (Part 2)
-- Deposits, withdrawals, rewards, referrals, chat, claims, legal
-- ============================================================

-- ============================================================
-- DEPOSITS
-- ============================================================
create or replace function public.create_deposit_request(
  p_amount numeric,
  p_provider public.payment_provider
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_min numeric := public.get_setting_num('min_deposit', 10);
  v_max numeric := public.get_setting_num('max_deposit', 100000);
  v_id uuid;
begin
  if v_user is null then
    return jsonb_build_object('success', false, 'error', jsonb_build_object('code','AUTH_REQUIRED','message','Sign in required.'));
  end if;

  -- Manual UPI / gateways are real-money paths: compliance kill switch
  if p_provider <> 'DEMO' and not public.is_flag_enabled('REAL_MONEY_ENABLED') then
    return jsonb_build_object('success', false, 'error', jsonb_build_object('code','REAL_MONEY_DISABLED','message','Deposits are currently disabled.'));
  end if;
  if p_provider = 'DEMO' and not public.is_flag_enabled('DEMO_MODE_ENABLED', true) then
    return jsonb_build_object('success', false, 'error', jsonb_build_object('code','DEMO_DISABLED','message','Demo mode is disabled.'));
  end if;

  if p_amount < v_min or p_amount > v_max then
    return jsonb_build_object('success', false, 'error', jsonb_build_object('code','AMOUNT_OUT_OF_RANGE','message','Amount must be between ' || v_min || ' and ' || v_max || '.'));
  end if;

  insert into public.deposits (user_id, amount, provider, status)
  values (v_user, p_amount, p_provider, 'CREATED')
  returning id into v_id;

  return jsonb_build_object('success', true, 'data', jsonb_build_object(
    'deposit_id', v_id,
    'upi_id', public.get_setting_text('manual_upi_id'),
    'upi_name', public.get_setting_text('manual_upi_name'),
    'instructions', public.get_setting_text('manual_upi_instructions')));
end;
$$;

create or replace function public.submit_deposit_utr(
  p_deposit_id uuid,
  p_utr text,
  p_proof_path text default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_dep public.deposits%rowtype;
  v_recent int;
begin
  select * into v_dep from public.deposits where id = p_deposit_id and user_id = v_user;
  if v_dep is null then
    return jsonb_build_object('success', false, 'error', jsonb_build_object('code','NOT_FOUND','message','Deposit not found.'));
  end if;
  if v_dep.status not in ('CREATED','PAYMENT_PENDING') then
    return jsonb_build_object('success', false, 'error', jsonb_build_object('code','INVALID_STATE','message','This deposit can no longer be modified.'));
  end if;

  update public.deposits
     set utr = upper(trim(p_utr)), proof_path = p_proof_path,
         status = 'PENDING_REVIEW', submitted_at = now()
   where id = p_deposit_id;

  -- velocity risk signal (does not block, flags for review)
  select count(*) into v_recent
    from public.deposits
   where user_id = v_user and created_at > now() - interval '24 hours';
  if v_recent > public.get_setting_num('max_deposits_per_day', 10) then
    insert into public.risk_events (user_id, event_type, severity, signals)
    values (v_user, 'DEPOSIT_VELOCITY', 'MEDIUM',
            jsonb_build_object('deposits_24h', v_recent, 'deposit_id', p_deposit_id));
    update public.deposits set status = 'FLAGGED', risk_score = 50 where id = p_deposit_id;
  end if;

  return jsonb_build_object('success', true, 'data', jsonb_build_object('status', 'PENDING_REVIEW'));
exception
  when unique_violation then
    return jsonb_build_object('success', false, 'error', jsonb_build_object('code','UTR_ALREADY_USED','message','This UTR has already been submitted.'));
end;
$$;

create or replace function public.approve_deposit(
  p_deposit_id uuid,
  p_reason text default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_dep public.deposits%rowtype;
  v_txn uuid;
begin
  if not public.has_permission('APPROVE_DEPOSIT') then
    return jsonb_build_object('success', false, 'error', jsonb_build_object('code','FORBIDDEN','message','Missing permission.'));
  end if;

  select * into v_dep from public.deposits where id = p_deposit_id for update;
  if v_dep is null then
    return jsonb_build_object('success', false, 'error', jsonb_build_object('code','NOT_FOUND','message','Deposit not found.'));
  end if;
  if v_dep.status in ('APPROVED') then
    return jsonb_build_object('success', true, 'data', jsonb_build_object('already_approved', true));
  end if;
  if v_dep.status not in ('PENDING_REVIEW','FLAGGED') then
    return jsonb_build_object('success', false, 'error', jsonb_build_object('code','INVALID_STATE','message','Only pending deposits can be approved.'));
  end if;

  -- money received offline → clearing debit, user credit
  perform public.ledger_post('DEPOSIT',
    jsonb_build_array(
      jsonb_build_object('account_kind','SYSTEM','account','DEPOSIT_CLEARING','direction','DEBIT','amount', v_dep.amount),
      jsonb_build_object('account_kind','USER','account','DEPOSIT','user_id', v_dep.user_id,
                         'wallet_id', public.get_wallet_id(v_dep.user_id),'direction','CREDIT','amount', v_dep.amount)
    ),
    'deposit:' || v_dep.id || ':credit',
    'DEPOSIT', v_dep.id, 'Deposit ' || v_dep.reference_code,
    jsonb_build_object('provider', v_dep.provider));

  update public.deposits
     set status = 'APPROVED', verified_at = now(), verified_by = auth.uid()
   where id = p_deposit_id;

  perform public.notify_user(v_dep.user_id, 'DEPOSIT_APPROVED', 'Deposit approved',
    'Your deposit of ' || v_dep.amount || ' has been credited.');

  -- referral qualification: first approved deposit
  perform public.qualify_referral(v_dep.user_id, 'FIRST_DEPOSIT');
  perform public.write_audit('APPROVE_DEPOSIT', 'deposit', p_deposit_id::text, null, null, p_reason);

  return jsonb_build_object('success', true, 'data', jsonb_build_object('status','APPROVED'));
end;
$$;

create or replace function public.reject_deposit(
  p_deposit_id uuid,
  p_reason text
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_dep public.deposits%rowtype;
begin
  if not public.has_permission('APPROVE_DEPOSIT') then
    return jsonb_build_object('success', false, 'error', jsonb_build_object('code','FORBIDDEN','message','Missing permission.'));
  end if;
  select * into v_dep from public.deposits where id = p_deposit_id for update;
  if v_dep is null or v_dep.status not in ('PENDING_REVIEW','FLAGGED') then
    return jsonb_build_object('success', false, 'error', jsonb_build_object('code','INVALID_STATE','message','Cannot reject this deposit.'));
  end if;
  update public.deposits set status = 'REJECTED', failure_reason = p_reason, verified_at = now(), verified_by = auth.uid()
   where id = p_deposit_id;
  perform public.notify_user(v_dep.user_id, 'DEPOSIT_REJECTED', 'Deposit rejected',
    coalesce(p_reason, 'Your deposit could not be verified.'));
  perform public.write_audit('REJECT_DEPOSIT', 'deposit', p_deposit_id::text, null, null, p_reason);
  return jsonb_build_object('success', true, 'data', jsonb_build_object('status','REJECTED'));
end;
$$;

-- ============================================================
-- WITHDRAWALS
-- ============================================================
create or replace function public.compute_withdrawal_fee(p_amount numeric)
returns numeric
language plpgsql stable security definer set search_path = public as $$
declare
  v_slabs jsonb := coalesce(public.get_setting('withdrawal_fee_slabs', '[]'::jsonb), '[]'::jsonb);
  v_slab jsonb;
  v_fee numeric := 0;
begin
  if jsonb_typeof(v_slabs) = 'array' then
    for v_slab in select * from jsonb_array_elements(v_slabs) loop
      if p_amount >= (v_slab->>'min')::numeric
         and (v_slab->>'max' is null or (v_slab->>'max' = '' or p_amount <= (v_slab->>'max')::numeric)) then
        if v_slab->>'type' = 'percent' then
          v_fee := round(p_amount * (v_slab->>'value')::numeric / 100, 2);
        else
          v_fee := (v_slab->>'value')::numeric;
        end if;
        exit;
      end if;
    end loop;
  end if;
  return v_fee;
end;
$$;

create or replace function public.request_withdrawal(
  p_amount numeric,
  p_destination_type text,
  p_destination_details jsonb
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_fee numeric;
  v_net numeric;
  v_min numeric := public.get_setting_num('min_withdrawal', 50);
  v_max numeric := public.get_setting_num('max_withdrawal', 50000);
  v_daily numeric;
  v_monthly numeric;
  v_today numeric;
  v_month numeric;
  v_balances jsonb;
  v_available numeric;
  v_kyc public.kyc_status;
  v_acct text;
  v_id uuid;
begin
  if v_user is null then
    return jsonb_build_object('success', false, 'error', jsonb_build_object('code','AUTH_REQUIRED','message','Sign in required.'));
  end if;
  if not public.is_flag_enabled('WITHDRAWAL_ENABLED') then
    return jsonb_build_object('success', false, 'error', jsonb_build_object('code','WITHDRAWALS_DISABLED','message','Withdrawals are currently disabled.'));
  end if;
  if public.get_setting_bool('kyc_required_for_withdrawal', true) then
    select status into v_kyc from public.kyc_records where user_id = v_user;
    if v_kyc is distinct from 'APPROVED' then
      return jsonb_build_object('success', false, 'error', jsonb_build_object('code','KYC_REQUIRED','message','Complete KYC before withdrawing.'));
    end if;
  end if;

  if p_amount < v_min or p_amount > v_max then
    return jsonb_build_object('success', false, 'error', jsonb_build_object('code','AMOUNT_OUT_OF_RANGE','message','Amount must be between ' || v_min || ' and ' || v_max || '.'));
  end if;

  -- daily / monthly limits
  v_daily := public.get_setting_num('daily_withdrawal_limit', 100000);
  v_monthly := public.get_setting_num('monthly_withdrawal_limit', 500000);
  select coalesce(sum(amount), 0) into v_today from public.withdrawals
   where user_id = v_user and created_at > date_trunc('day', now()) and status not in ('REJECTED','CANCELLED');
  select coalesce(sum(amount), 0) into v_month from public.withdrawals
   where user_id = v_user and created_at > date_trunc('month', now()) and status not in ('REJECTED','CANCELLED');
  if v_today + p_amount > v_daily or v_month + p_amount > v_monthly then
    return jsonb_build_object('success', false, 'error', jsonb_build_object('code','LIMIT_EXCEEDED','message','Withdrawal limit exceeded.'));
  end if;

  -- withdrawable = sum of configured withdrawable accounts
  v_balances := public.get_wallet_balances(v_user);
  v_available := 0;
  for v_acct in select jsonb_array_elements_text(coalesce(public.get_setting('withdrawable_accounts', '["WINNINGS"]'::jsonb), '["WINNINGS"]'::jsonb)) loop
    v_available := v_available + coalesce((v_balances ->> v_acct)::numeric, 0);
  end loop;
  if v_available < p_amount then
    return jsonb_build_object('success', false, 'error', jsonb_build_object('code','INSUFFICIENT_WITHDRAWABLE','message','Withdrawable balance is too low.'));
  end if;

  v_fee := public.compute_withdrawal_fee(p_amount);
  v_net := p_amount - v_fee;
  if v_net <= 0 then
    return jsonb_build_object('success', false, 'error', jsonb_build_object('code','FEE_EXCEEDS_AMOUNT','message','Fee exceeds the requested amount.'));
  end if;

  insert into public.withdrawals (user_id, amount, fee, net_amount, destination_type, destination_details, kyc_snapshot, slab_snapshot)
  values (v_user, p_amount, v_fee, v_net, p_destination_type, p_destination_details,
          jsonb_build_object('required', public.get_setting_bool('kyc_required_for_withdrawal', true)),
          jsonb_build_object('fee', v_fee))
  returning id into v_id;

  -- lock funds: user withdrawable account → clearing
  perform public.ledger_post('WITHDRAWAL_LOCK',
    jsonb_build_array(
      jsonb_build_object('account_kind','SYSTEM','account','WITHDRAWAL_CLEARING','direction','CREDIT','amount', p_amount),
      jsonb_build_object('account_kind','USER','account','WINNINGS','user_id', v_user,
                         'wallet_id', public.get_wallet_id(v_user),'direction','DEBIT','amount', p_amount)
    ),
    'withdrawal:' || v_id || ':lock',
    'WITHDRAWAL', v_id, 'Withdrawal request locked');

  return jsonb_build_object('success', true, 'data', jsonb_build_object('withdrawal_id', v_id, 'fee', v_fee, 'net', v_net));
end;
$$;

-- action: APPROVE | COMPLETE | REJECT  (REJECT reverses locked funds)
create or replace function public.review_withdrawal(
  p_withdrawal_id uuid,
  p_action text,
  p_reference text default null,
  p_reason text default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_w public.withdrawals%rowtype;
begin
  if not public.has_permission('APPROVE_WITHDRAWAL') then
    return jsonb_build_object('success', false, 'error', jsonb_build_object('code','FORBIDDEN','message','Missing permission.'));
  end if;

  select * into v_w from public.withdrawals where id = p_withdrawal_id for update;
  if v_w is null then
    return jsonb_build_object('success', false, 'error', jsonb_build_object('code','NOT_FOUND','message','Withdrawal not found.'));
  end if;

  if p_action = 'APPROVE' then
    if v_w.status not in ('REQUESTED') then
      return jsonb_build_object('success', false, 'error', jsonb_build_object('code','INVALID_STATE','message','Only requested withdrawals can be approved.'));
    end if;
    update public.withdrawals set status = 'APPROVED', reviewed_by = auth.uid(), reviewed_at = now()
     where id = p_withdrawal_id;
    perform public.notify_user(v_w.user_id, 'WITHDRAWAL_UPDATE', 'Withdrawal approved', 'Your withdrawal is being processed.');

  elsif p_action = 'COMPLETE' then
    if v_w.status not in ('APPROVED','PROCESSING') then
      return jsonb_build_object('success', false, 'error', jsonb_build_object('code','INVALID_STATE','message','Withdrawal is not in a payable state.'));
    end if;
    -- clearing → external payout + platform fee
    perform public.ledger_post('WITHDRAWAL_PAYOUT',
      jsonb_build_array(
        jsonb_build_object('account_kind','SYSTEM','account','WITHDRAWAL_CLEARING','direction','DEBIT','amount', v_w.net_amount),
        jsonb_build_object('account_kind','SYSTEM','account','WITHDRAWAL_CLEARING','direction','DEBIT','amount', v_w.fee),
        jsonb_build_object('account_kind','SYSTEM','account','PLATFORM_REVENUE','direction','CREDIT','amount', v_w.fee)
      ),
      'withdrawal:' || v_w.id || ':payout',
      'WITHDRAWAL', v_w.id, 'Withdrawal paid out',
      jsonb_build_object('reference', p_reference));
    update public.withdrawals
       set status = 'COMPLETED', completed_at = now(), provider_reference = p_reference, reviewed_by = coalesce(reviewed_by, auth.uid())
     where id = p_withdrawal_id;
    perform public.notify_user(v_w.user_id, 'WITHDRAWAL_UPDATE', 'Withdrawal completed', 'Your withdrawal has been paid.');

  elsif p_action = 'REJECT' then
    if v_w.status not in ('REQUESTED','APPROVED','PROCESSING') then
      return jsonb_build_object('success', false, 'error', jsonb_build_object('code','INVALID_STATE','message','Withdrawal cannot be rejected now.'));
    end if;
    -- reverse locked funds through the ledger
    perform public.ledger_post('WITHDRAWAL_REVERSAL',
      jsonb_build_array(
        jsonb_build_object('account_kind','SYSTEM','account','WITHDRAWAL_CLEARING','direction','DEBIT','amount', v_w.amount),
        jsonb_build_object('account_kind','USER','account','WINNINGS','user_id', v_w.user_id,
                           'wallet_id', public.get_wallet_id(v_w.user_id),'direction','CREDIT','amount', v_w.amount)
      ),
      'withdrawal:' || v_w.id || ':reverse',
      'WITHDRAWAL', v_w.id, 'Withdrawal reversed');
    update public.withdrawals set status = 'REJECTED', failure_reason = p_reason, reviewed_by = auth.uid(), reviewed_at = now()
     where id = p_withdrawal_id;
    perform public.notify_user(v_w.user_id, 'WITHDRAWAL_UPDATE', 'Withdrawal rejected', coalesce(p_reason, 'Your withdrawal was rejected and funds returned.'));
  else
    return jsonb_build_object('success', false, 'error', jsonb_build_object('code','BAD_ACTION','message','Unknown action.'));
  end if;

  perform public.write_audit('WITHDRAWAL_' || p_action, 'withdrawal', p_withdrawal_id::text, null, null, p_reason);
  return jsonb_build_object('success', true, 'data', jsonb_build_object('status', p_action));
end;
$$;

-- ============================================================
-- REWARDS
-- ============================================================
create or replace function public.grant_reward(
  p_user uuid,
  p_campaign_id uuid,
  p_idempotency_key text default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_c public.reward_campaigns%rowtype;
  v_amount numeric;
  v_today_count int;
  v_last timestamptz;
  v_txn uuid;
  v_grant_id uuid;
begin
  select * into v_c from public.reward_campaigns where id = p_campaign_id for update;
  if v_c is null or not v_c.active then
    return jsonb_build_object('success', false, 'error', jsonb_build_object('code','CAMPAIGN_INACTIVE','message','Reward not available.'));
  end if;
  if (v_c.starts_at is not null and now() < v_c.starts_at)
     or (v_c.ends_at is not null and now() > v_c.ends_at) then
    return jsonb_build_object('success', false, 'error', jsonb_build_object('code','CAMPAIGN_WINDOW','message','Reward not available.'));
  end if;

  v_amount := coalesce((v_c.config ->> 'amount')::numeric, 0);
  if v_amount <= 0 then
    return jsonb_build_object('success', false, 'error', jsonb_build_object('code','BAD_CONFIG','message','Reward misconfigured.'));
  end if;

  -- anti-abuse: daily cap + cooldown
  select count(*) into v_today_count from public.reward_grants
   where user_id = p_user and campaign_id = p_campaign_id and created_at > date_trunc('day', now());
  if v_today_count >= coalesce((v_c.config ->> 'daily_cap')::int, 1) then
    return jsonb_build_object('success', false, 'error', jsonb_build_object('code','DAILY_CAP_REACHED','message','Daily limit reached.'));
  end if;
  select max(created_at) into v_last from public.reward_grants
   where user_id = p_user and campaign_id = p_campaign_id;
  if v_last is not null and now() < v_last + make_interval(mins => coalesce((v_c.config ->> 'cooldown_minutes')::int, 0)) then
    return jsonb_build_object('success', false, 'error', jsonb_build_object('code','COOLDOWN','message','Please wait before claiming again.'));
  end if;

  -- grant row first, then the ledger entry referencing it (ledger stays append-only)
  insert into public.reward_grants (user_id, campaign_id, source, amount, target_account, expires_at)
  values (p_user, p_campaign_id, v_c.source, v_amount, coalesce((v_c.config->>'target_account')::public.user_account_type, 'REWARD'),
          case when (v_c.config ->> 'expiry_days') is not null
               then now() + make_interval(days => (v_c.config ->> 'expiry_days')::int) end)
  returning id into v_grant_id;

  perform public.ledger_post('REWARD_GRANT',
    jsonb_build_array(
      jsonb_build_object('account_kind','SYSTEM','account','PROMO_POOL','direction','DEBIT','amount', v_amount),
      jsonb_build_object('account_kind','USER','account', coalesce(v_c.config->>'target_account','REWARD'),
                         'user_id', p_user, 'wallet_id', public.get_wallet_id(p_user),
                         'direction','CREDIT','amount', v_amount)
    ),
    coalesce(p_idempotency_key, 'reward:' || p_campaign_id || ':' || p_user || ':' || to_char(now(), 'YYYY-MM-DD') || ':' || v_today_count::text),
    'REWARD', v_grant_id, 'Reward: ' || v_c.name);

  update public.reward_grants set ledger_transaction_id = v_txn where id = v_grant_id;

  return jsonb_build_object('success', true, 'data', jsonb_build_object('amount', v_amount));
end;
$$;

-- qualification event: FIRST_DEPOSIT | FIRST_PAID_ENTRY (idempotent)
create or replace function public.qualify_referral(
  p_referee uuid,
  p_event text
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_ref record;
  v_campaign uuid;
  v_required text := public.get_setting_text('referral_qualification_event', 'FIRST_DEPOSIT');
  v_amount numeric := public.get_setting_num('referral_reward_amount', 0);
begin
  if v_required <> p_event or v_amount <= 0 then return; end if;

  select * into v_ref from public.referrals where referee_id = p_referee and status = 'PENDING';
  if v_ref is null then return; end if;

  update public.referrals set status = 'QUALIFIED', qualified_at = now() where id = v_ref.id;

  select id into v_campaign from public.reward_campaigns
   where source = 'REFERRAL' and active order by created_at desc limit 1;
  if v_campaign is not null then
    perform public.grant_reward(v_ref.referrer_id, v_campaign, 'referral:' || v_ref.id);
  end if;
end;
$$;

-- ============================================================
-- CHAT
-- ============================================================
create or replace function public.send_chat_message(
  p_channel_id uuid,
  p_content text
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_channel public.chat_channels%rowtype;
  v_recent int;
  v_word text;
  v_banned_words text[];
  v_member_exists boolean;
begin
  if v_user is null then
    return jsonb_build_object('success', false, 'error', jsonb_build_object('code','AUTH_REQUIRED','message','Sign in required.'));
  end if;
  if exists (select 1 from public.profiles where id = v_user and is_banned) then
    return jsonb_build_object('success', false, 'error', jsonb_build_object('code','USER_BANNED','message','Account suspended.'));
  end if;

  select * into v_channel from public.chat_channels where id = p_channel_id;
  if v_channel is null or not v_channel.is_active then
    return jsonb_build_object('success', false, 'error', jsonb_build_object('code','CHANNEL_INACTIVE','message','Channel unavailable.'));
  end if;

  -- auto-join the global channel on first message
  select exists (select 1 from public.chat_members where channel_id = p_channel_id and user_id = v_user) into v_member_exists;
  if not v_member_exists then
    if v_channel.type <> 'GLOBAL' then
      return jsonb_build_object('success', false, 'error', jsonb_build_object('code','NOT_MEMBER','message','You are not a member of this channel.'));
    end if;
    insert into public.chat_members (channel_id, user_id) values (p_channel_id, v_user);
  end if;

  if exists (
    select 1 from public.chat_members
     where channel_id = p_channel_id and user_id = v_user
       and (is_muted or muted_until > now())
  ) then
    return jsonb_build_object('success', false, 'error', jsonb_build_object('code','MUTED','message','You are muted in this channel.'));
  end if;

  -- rate limiting (slowmode + burst guard)
  select count(*) into v_recent from public.chat_messages
   where channel_id = p_channel_id and user_id = v_user and created_at > now() - interval '10 seconds';
  if v_recent >= greatest(v_channel.slowmode_seconds, 3) then
    return jsonb_build_object('success', false, 'error', jsonb_build_object('code','RATE_LIMITED','message','Slow down a little.'));
  end if;

  -- basic profanity filter (configurable word list)
  v_banned_words := array(
    select jsonb_array_elements_text(coalesce(public.get_setting('profanity_words', '[]'::jsonb), '[]'::jsonb)));
  foreach v_word in array v_banned_words loop
    if v_word <> '' and position(lower(v_word) in lower(p_content)) > 0 then
      return jsonb_build_object('success', false, 'error', jsonb_build_object('code','PROFANITY','message','Message contains blocked language.'));
    end if;
  end loop;

  insert into public.chat_messages (channel_id, user_id, content) values (p_channel_id, v_user, p_content);
  return jsonb_build_object('success', true, 'data', jsonb_build_object('sent', true));
end;
$$;

-- ============================================================
-- CLAIMS & LEGAL
-- ============================================================
create or replace function public.create_claim(
  p_category text,
  p_subject text,
  p_description text,
  p_tournament_id uuid default null,
  p_deposit_id uuid default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if auth.uid() is null then
    return jsonb_build_object('success', false, 'error', jsonb_build_object('code','AUTH_REQUIRED','message','Sign in required.'));
  end if;
  insert into public.claims (user_id, category, subject, description, related_tournament_id, related_deposit_id)
  values (auth.uid(), p_category::public.claim_category, p_subject, p_description, p_tournament_id, p_deposit_id)
  returning id into v_id;
  return jsonb_build_object('success', true, 'data', jsonb_build_object('claim_id', v_id));
end;
$$;

create or replace function public.record_legal_acceptance(p_slug text, p_version int)
returns void
language sql security definer set search_path = public as $$
  insert into public.legal_acceptances (user_id, document_slug, version)
  values (auth.uid(), p_slug, p_version)
  on conflict (user_id, document_slug, version) do nothing;
$$;
