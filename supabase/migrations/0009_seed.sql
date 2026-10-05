-- ============================================================
-- Gen B Tournaments — 0009: Seed Data
-- Games, permissions, settings, flags, legal docs, demo content.
-- All values here are CONFIGURABLE DEFAULTS — runtime changes come
-- from the admin panel, never code.
-- ============================================================

-- ---------- PERMISSIONS ----------
insert into public.permissions (code, description) values
  ('VIEW_USERS','View user list and profiles'),
  ('EDIT_USERS','Suspend/ban/verify users'),
  ('CREATE_TOURNAMENT','Create tournaments'),
  ('EDIT_TOURNAMENT','Edit tournaments, rooms, results'),
  ('CANCEL_TOURNAMENT','Cancel tournaments and trigger refunds'),
  ('VIEW_DEPOSITS','View deposit queue'),
  ('APPROVE_DEPOSIT','Approve/reject deposits'),
  ('VIEW_WITHDRAWALS','View withdrawal queue'),
  ('APPROVE_WITHDRAWAL','Approve/reject/complete withdrawals'),
  ('CONFIGURE_FEES','Edit commission, fees, slabs'),
  ('VIEW_LEDGER','View full ledger'),
  ('CREATE_ADJUSTMENT','Create manual balance adjustments'),
  ('MODERATE_CHAT','Delete messages, mute users'),
  ('MANAGE_LEGAL_CONTENT','Publish legal documents'),
  ('VIEW_ANALYTICS','View analytics dashboard'),
  ('MANAGE_ROLES','Grant/revoke admin roles')
on conflict (code) do nothing;

-- ---------- FEATURE FLAGS (real money OFF until compliance) ----------
insert into public.feature_flags (key, enabled, description) values
  ('REAL_MONEY_ENABLED', false, 'Master kill switch for all real-money features (deposits, paid entries)'),
  ('WITHDRAWAL_ENABLED', false, 'Withdrawal requests (requires KYC + compliance approval)'),
  ('MANUAL_UPI_ENABLED', false, 'Manual UPI deposit flow'),
  ('RAZORPAY_ENABLED', false, 'Razorpay payment gateway'),
  ('CASHFREE_ENABLED', false, 'Cashfree payment gateway'),
  ('REWARDED_ADS_ENABLED', false, 'Rewarded ads (disabled pending ad-network policy verification)'),
  ('REFERRALS_ENABLED', true, 'Referral program'),
  ('CLANS_ENABLED', true, 'Clan system'),
  ('GLOBAL_CHAT_ENABLED', true, 'Global chat'),
  ('KYC_ENABLED', true, 'KYC/verification flows'),
  ('DEMO_MODE_ENABLED', true, 'Demo mode with fake credits (sandbox only)')
on conflict (key) do nothing;

-- ---------- SETTINGS (all configurable from admin) ----------
insert into public.admin_settings (key, category, value, description) values
  ('app_name','GENERAL','"Gen B Tournaments"','Platform name'),
  ('support_email','GENERAL','"support@genb.example"','Support contact'),
  ('maintenance_mode','GENERAL','false','Global maintenance mode'),
  ('default_commission_percent','COMMISSION','10','Default commission % on tournament entry collection'),
  ('min_deposit','WALLET','100','Minimum deposit amount (INR)'),
  ('max_deposit','WALLET','50000','Maximum deposit amount (INR)'),
  ('min_withdrawal','WALLET','200','Minimum withdrawal amount (INR)'),
  ('max_withdrawal','WALLET','25000','Maximum withdrawal amount (INR)'),
  ('daily_withdrawal_limit','WALLET','10000','Daily withdrawal limit per user (INR)'),
  ('monthly_withdrawal_limit','WALLET','50000','Monthly withdrawal limit per user (INR)'),
  ('withdrawal_fee_slabs','WALLET','[{"min":0,"max":499,"type":"flat","value":5},{"min":500,"max":1999,"type":"percent","value":2},{"min":2000,"max":null,"type":"percent","value":1}]','Withdrawal fee slabs (first matching applies)'),
  ('withdrawable_accounts','WALLET','["WINNINGS"]','Balance types eligible for withdrawal'),
  ('kyc_required_for_withdrawal','WALLET','true','Require approved KYC before withdrawal'),
  ('entry_balance_priority','WALLET','["DEPOSIT","WINNINGS","REWARD","BONUS"]','Order in which balance types are consumed for entry fees'),
  ('bonus_usage_enabled','WALLET','true','Allow bonus balance for entry fees'),
  ('bonus_usage_percentage','WALLET','20','Max % of entry fee payable from bonus balance'),
  ('reward_usage_enabled','WALLET','true','Allow reward balance for entry fees'),
  ('reward_usage_percentage','WALLET','20','Max % of entry fee payable from reward balance'),
  ('min_real_balance_percentage','WALLET','60','Min % of entry fee that must come from real (deposit/winnings) balance'),
  ('max_deposits_per_day','RISK','10','Deposit requests per 24h before flagging'),
  ('profanity_words','SECURITY','[]','Blocked words in chat'),
  ('manual_upi_id','PAYMENTS','""','UPI ID shown for manual deposits'),
  ('manual_upi_name','PAYMENTS','""','Payee name for manual deposits'),
  ('manual_upi_instructions','PAYMENTS','"Pay the exact amount, then submit your UTR reference number here. Deposits are verified by our team."','Manual deposit instructions'),
  ('referral_qualification_event','REWARDS','FIRST_DEPOSIT','Event that qualifies a referral: FIRST_DEPOSIT or FIRST_PAID_ENTRY'),
  ('referral_reward_amount','REWARDS','25','Referral reward amount (INR)'),
  ('daily_login_reward_amount','REWARDS','5','Daily login reward (INR)')
on conflict (key) do nothing;

-- ---------- GAMES (original vector artwork paths; no copyrighted assets) ----------
insert into public.games (name, short_name, slug, description, active, supported_modes, minimum_age, sort_order) values
  ('Battlegrounds Mobile India', 'BGMI', 'bgmi',
   'Battle royale tournaments: solo, duo and squad formats with custom rooms.', true,
   '{SOLO,DUO,SQUAD,BATTLE_ROYALE,CUSTOM_ROOM}', 18, 1),
  ('Free Fire', 'FF', 'free-fire',
   'Fast-paced battle royale tournaments where permitted.', true,
   '{SOLO,DUO,SQUAD,BATTLE_ROYALE,CUSTOM_ROOM}', 18, 2),
  ('Call of Duty Mobile', 'COD', 'cod-mobile',
   'Multiplayer and battle royale tournaments where permitted.', true,
   '{ONE_V_ONE,TWO_V_TWO,SQUAD,BATTLE_ROYALE,CUSTOM_ROOM}', 18, 3)
on conflict (slug) do nothing;

insert into public.game_modes (game_id, name, code, team_size)
select g.id, m.name, m.code, m.team_size
from public.games g
cross join (values
  ('Solo','SOLO',1), ('Duo','DUO',2), ('Squad','SQUAD',4), ('Battle Royale','BATTLE_ROYALE',1), ('Custom Room','CUSTOM_ROOM',1)
) as m(name, code, team_size)
where g.slug in ('bgmi','free-fire')
on conflict (game_id, code) do nothing;

insert into public.game_modes (game_id, name, code, team_size)
select g.id, m.name, m.code, m.team_size
from public.games g
cross join (values
  ('1v1','ONE_V_ONE',1), ('2v2','TWO_V_TWO',2), ('Squad','SQUAD',4), ('Battle Royale','BATTLE_ROYALE',1), ('Custom Room','CUSTOM_ROOM',1)
) as m(name, code, team_size)
where g.slug = 'cod-mobile'
on conflict (game_id, code) do nothing;

-- ---------- REWARD CAMPAIGNS ----------
insert into public.reward_campaigns (name, source, config, active) values
  ('Daily Login', 'DAILY_LOGIN', '{"amount":5,"daily_cap":1,"cooldown_minutes":1380,"target_account":"BONUS","expiry_days":7}', true),
  ('Demo Credits', 'ADMIN_GRANT', '{"amount":500,"daily_cap":3,"cooldown_minutes":60,"target_account":"BONUS"}', true),
  ('Referral Reward', 'REFERRAL', '{"amount":25,"target_account":"BONUS","expiry_days":30}', true)
on conflict do nothing;

-- ---------- GLOBAL CHAT CHANNEL ----------
insert into public.chat_channels (type, name, slowmode_seconds)
select 'GLOBAL', 'Global Chat', 5
where not exists (select 1 from public.chat_channels where type = 'GLOBAL');

-- ---------- LEGAL DOCUMENTS v1 (TEMPLATES — require legal review before production) ----------
insert into public.legal_documents (slug, version, title, content_md, is_published, published_at) values
('terms', 1, 'Terms of Service', '# Terms of Service

> **TEMPLATE — MUST BE REVIEWED AND REPLACED BY QUALIFIED LEGAL COUNSEL BEFORE PRODUCTION USE.**

These terms govern your use of Gen B Tournaments. By registering you accept these terms.

1. **Eligibility** — You must meet the minimum age requirement in your jurisdiction and reside in a permitted region.
2. **Account** — One account per person. Multiple accounts may be suspended.
3. **Tournaments** — Entry fees, prize pools and rules are displayed per tournament. Results published by the platform are final subject to the dispute process.
4. **Fair play** — Cheating, exploitation or fraud leads to permanent suspension and forfeiture of balances.
5. **Payments** — Deposits and withdrawals follow the published payment policy. Real-money features may be restricted by region and eligibility.
6. **Changes** — We may update these terms; material changes will be notified.', true, now()),
('privacy', 1, 'Privacy Policy', '# Privacy Policy

> **TEMPLATE — MUST BE REVIEWED AND REPLACED BY QUALIFIED LEGAL COUNSEL BEFORE PRODUCTION USE.**

We collect the minimum data required to operate the platform: account details, game IDs, tournament participation, and transaction records. We do not sell personal data. You may request data access or account deletion from Settings, subject to legal retention requirements for financial records.', true, now()),
('refund-policy', 1, 'Refund Policy', '# Refund Policy

> **TEMPLATE — MUST BE REVIEWED AND REPLACED BY QUALIFIED LEGAL COUNSEL BEFORE PRODUCTION USE.**

Entry fees are refunded in full when a tournament is cancelled by the platform. Deposits that were successfully verified are not refundable except where required by law. Approved disputes are refunded to the wallet.', true, now()),
('tournament-rules', 1, 'Tournament Rules', '# Tournament Rules

Each tournament displays its specific rules on the detail page. Standard rules: no teaming, no emulators where restricted, no abusive behaviour, screenshots may be required as result evidence, and room credentials are shared only with verified participants.', true, now()),
('payment-policy', 1, 'Payment Policy', '# Payment Policy

> **TEMPLATE — MUST BE REVIEWED AND REPLACED BY QUALIFIED LEGAL COUNSEL BEFORE PRODUCTION USE.**

Deposits are processed through approved payment providers. Manual UPI deposits require UTR verification and are credited after review. Payments are never credited based on client-side claims alone.', true, now()),
('withdrawal-policy', 1, 'Withdrawal Policy', '# Withdrawal Policy

> **TEMPLATE — MUST BE REVIEWED AND REPLACED BY QUALIFIED LEGAL COUNSEL BEFORE PRODUCTION USE.**

Withdrawals require approved KYC and are processed to the verified destination on your account. Fees and limits are shown before you confirm. Withdrawals may be paused for compliance reviews.', true, now()),
('community-guidelines', 1, 'Community Guidelines', '# Community Guidelines

Be respectful. No harassment, hate speech, spam, or advertising. Chat and clan content is moderated; violations lead to mutes or bans.', true, now()),
('responsible-gaming', 1, 'Responsible Gaming & Eligibility', '# Responsible Gaming & Eligibility

> **TEMPLATE — MUST BE REVIEWED AND REPLACED BY QUALIFIED LEGAL COUNSEL BEFORE PRODUCTION USE.**

Tournament entry involves skill and may involve entry fees. Play responsibly — never spend more than you can afford. Real-money features are unavailable where restricted by law, and may be disabled for your protection. Self-exclusion is available on request via support.', true, now())
on conflict (slug, version) do nothing;
