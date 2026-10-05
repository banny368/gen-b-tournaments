# Security Checklist

## Implemented controls

### Money integrity
- [x] Double-entry ledger; entries immutable (UPDATE/DELETE triggers raise `LEDGER_IMMUTABLE`)
- [x] Deferred constraint trigger verifies every transaction balances to zero at commit
- [x] Idempotency keys on all money movements (deposits, joins, prizes, refunds, withdrawals,
      rewards, adjustments); duplicate webhook/UTR/retry cannot duplicate balance changes
- [x] UTR globally unique (partial unique index) — one payment can never fund two deposits
- [x] Tournament join uses row locks + atomic transaction (capacity can never be exceeded; no
      negative balances — CHECK constraint on wallet_balances)
- [x] Withdrawal funds locked in a clearing account; reversal is a ledger transaction, never a
      deletion
- [x] No direct client writes to any money table (RLS: no INSERT/UPDATE/DELETE policies; changes
      only via SECURITY DEFINER RPCs with in-DB permission checks)
- [x] Admin "adjustment" requires reason + permission + writes audit; no balance editing exists

### Authorization
- [x] RLS enabled **and forced** on every public table; blanket privilege revocation first
      (secure by default), then explicit grants
- [x] Sensitive profile data (DOB, phone, ban reason) isolated in `profile_private` (self + admin
      VIEW_USERS only)
- [x] Room credentials table has **zero** RLS policies — access only via participant-checked RPC
- [x] Admin RBAC: 8 roles × 16 permissions, checked in DB functions AND server actions; per-user
      overrides supported
- [x] Admin panel guarded server-side (`requireAdmin` + per-action `assertPermission`); no
      permission is trusted from the client

### Application
- [x] Secrets only in server env; `server-only` guard on service-role client; `.env.example`
      documents all keys; `.gitignore` blocks `.env*`
- [x] Security headers: X-Frame-Options DENY, nosniff, Referrer-Policy, Permissions-Policy
- [x] Webhook signature verification (HMAC-SHA256, timing-safe compare); all webhook events
      logged to `payment_events` (valid or not)
- [x] Chat: server-side rate limiting, mute enforcement, configurable profanity blocklist,
      membership authorization via definer function
- [x] Risk engine foundations: deposit velocity flagging, risk_events table + queue
- [x] Input validation: DB constraints (CHECKs, enums, unique indexes) + app-side validation
- [x] Append-only audit log with actor, role, action, resource, before/after, reason
- [x] CI: lint + money-rule unit tests + production build on every push

## Before real-money production launch (human verification required)

- [ ] Legal/compliance review for target jurisdictions (real-money gaming rules, age gating,
      state restrictions, responsible gaming, grievance officer requirements)
- [ ] Payment provider onboarding approved (Razorpay/Cashfree) + webhooks configured over HTTPS
- [ ] Replace template legal documents with counsel-reviewed versions; publish versions
- [ ] Supabase Auth: enable MFA for admin accounts; enforce email confirmation; configure SMTP
- [ ] File-upload hardening review (storage bucket policies, signed URLs, MIME checks)
- [ ] Dependency audit (`npm audit` / Dependabot) reviewed and clean
- [ ] Penetration pass on RLS policies with anon/authenticated/service roles (Supabase lints)
- [ ] Restore test on a `pg_dump` backup (a backup that has never been restored is not verified)
- [ ] Rate limiting at the edge (Vercel WAF / Upstash) for auth + RPC endpoints
- [ ] App-store policy review if distributing an APK; Play real-money-gaming declaration
