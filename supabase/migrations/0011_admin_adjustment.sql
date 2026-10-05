-- ============================================================
-- Gen B Tournaments — 0011: Admin manual adjustment RPC
-- ============================================================

-- Manual balance adjustment: reason REQUIRED, permission checked in-DB,
-- always a ledger transaction (never a direct balance edit).
create or replace function public.admin_manual_adjustment(
  p_user uuid,
  p_account text,
  p_amount numeric, -- signed: positive = credit, negative = debit
  p_reason text
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_admin uuid := auth.uid();
  v_abs numeric := abs(p_amount);
  v_direction public.ledger_direction;
begin
  if not public.has_permission('CREATE_ADJUSTMENT') then
    return jsonb_build_object('success', false, 'error', jsonb_build_object('code','FORBIDDEN','message','Missing permission.'));
  end if;
  if p_reason is null or length(trim(p_reason)) < 5 then
    return jsonb_build_object('success', false, 'error', jsonb_build_object('code','REASON_REQUIRED','message','A detailed reason is required.'));
  end if;
  if p_account not in ('DEPOSIT','BONUS','REWARD','WINNINGS','REFUND') then
    return jsonb_build_object('success', false, 'error', jsonb_build_object('code','BAD_ACCOUNT','message','Unknown account.'));
  end if;
  if p_amount = 0 then
    return jsonb_build_object('success', false, 'error', jsonb_build_object('code','ZERO_AMOUNT','message','Amount cannot be zero.'));
  end if;

  if p_amount > 0 then
    v_direction := 'CREDIT';
  else
    v_direction := 'DEBIT';
  end if;

  perform public.ledger_post('ADJUSTMENT',
    jsonb_build_array(
      jsonb_build_object('account_kind','USER','account', p_account, 'user_id', p_user,
                         'wallet_id', public.get_wallet_id(p_user), 'direction', v_direction, 'amount', v_abs),
      jsonb_build_object('account_kind','SYSTEM','account','ADJUSTMENT','direction',
                         case when p_amount > 0 then 'DEBIT' else 'CREDIT' end, 'amount', v_abs)
    ),
    'adjustment:' || v_admin || ':' || gen_random_uuid(),
    'USER', p_user, 'Manual adjustment: ' || p_reason,
    jsonb_build_object('reason', p_reason, 'account', p_account),
    v_admin);

  perform public.write_audit('MANUAL_ADJUSTMENT', 'user', p_user::text, null,
    jsonb_build_object('account', p_account, 'amount', p_amount), p_reason);

  return jsonb_build_object('success', true, 'data', jsonb_build_object('adjusted', p_amount));
end;
$$;

grant execute on function public.admin_manual_adjustment(uuid, text, numeric, text) to authenticated;
