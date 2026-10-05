-- ============================================================
-- Gen B Tournaments — 0010: Demo credits + misc
-- ============================================================

-- Demo-mode credits: sandbox only, gated by feature flag. Credits go to the
-- BONUS account through the standard reward ledger path — never to DEPOSIT.
create or replace function public.claim_demo_credits()
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_campaign uuid;
  v_result jsonb;
begin
  if v_user is null then
    return jsonb_build_object('success', false, 'error', jsonb_build_object('code','AUTH_REQUIRED','message','Sign in required.'));
  end if;
  if not public.is_flag_enabled('DEMO_MODE_ENABLED', false) then
    return jsonb_build_object('success', false, 'error', jsonb_build_object('code','DEMO_DISABLED','message','Demo mode is disabled.'));
  end if;

  select id into v_campaign from public.reward_campaigns
   where name = 'Demo Credits' and active
   order by created_at desc limit 1;
  if v_campaign is null then
    return jsonb_build_object('success', false, 'error', jsonb_build_object('code','CAMPAIGN_INACTIVE','message','Reward not available.'));
  end if;

  v_result := public.grant_reward(v_user, v_campaign, 'demo:' || v_user || ':' || floor(extract(epoch from now()) / 60)::text);
  return v_result;
end;
$$;

grant execute on function public.claim_demo_credits() to authenticated;
