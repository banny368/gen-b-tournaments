# Gen B Tournaments

Premium, mobile-first esports tournament platform — Next.js 16 PWA + Supabase (free tier), built
free-first per the master build prompt.

**Status:** full platform built and verified locally (build + lint + 16 money-rule unit tests
pass). Real-money features are **disabled behind feature flags** pending compliance approval.

---

## Architecture

| Layer | Technology | Notes |
| --- | --- | --- |
| Frontend | Next.js 16 (App Router, TypeScript), Tailwind v4 | PWA (installable on Android), i18n en/hi/gu |
| Backend | Supabase free tier | Postgres, Auth (email + Google), Storage, Realtime |
| Money logic | PostgreSQL SECURITY DEFINER functions | Server-authoritative, transactional, idempotent |
| Hosting | Vercel (free) + Supabase cloud (free) | GitHub Actions CI |

### Non-negotiable money invariants (implemented)

1. **Double-entry immutable ledger** — `ledger_transactions` + `ledger_entries`; rows cannot be
   UPDATEd/DELETEd (trigger-enforced); a deferred constraint trigger verifies every transaction
   balances to zero at commit. Cached balances (`wallet_balances`) are maintained only by the
   ledger posting function.
2. **Idempotency everywhere** — deposits, joins, prizes, refunds, withdrawals all use idempotency
   keys or unique constraints. A repeated webhook/UTR/join can never move money twice.
3. **Race-safe join** — `join_tournament()` locks the tournament row (`FOR UPDATE`), re-checks
   capacity, debits via ledger, inserts entry, increments players — atomically. 100 users fighting
   for 5 slots cannot oversell.
4. **Client has zero authority** — balances, eligibility, results, statuses, permissions all live
   server-side (RLS + definer functions + server actions with permission checks + audit logs).
5. **Compliance kill switches** — `REAL_MONEY_ENABLED`, `WITHDRAWAL_ENABLED`, `RAZORPAY_ENABLED`
   flags are OFF in seed; deposits via Manual UPI are admin-reviewed (UTR verified, UTRs globally
   unique); withdrawals require KYC and admin approval.

### Database

11 SQL migrations in `supabase/migrations/` (~45 tables, RLS on every table, privilege lockdown by
default). Core groups: identity/RBAC (8 admin roles × 16 permissions), games/tournaments (13
statuses, server-time derived), wallet/ledger, deposits/withdrawals/payments, prizes/refunds/
commissions, rewards/referrals, clans/chat, claims/KYC/risk/audit/legal/settings/flags.

## Project structure

```
src/
  app/[locale]/          # user app (home, tournaments, wallet, rewards, profile, social…)
  app/[locale]/admin/    # admin panel (guarded by requireAdmin + per-action permissions)
  app/api/               # auth callback, payment webhooks
  components/            # ui primitives, layout, tournaments, wallet, admin…
  i18n/                  # next-intl routing/request (en, hi, gu)
  lib/                   # supabase clients, auth, money rules, RPC wrapper, admin actions
  proxy.ts               # locale routing middleware
supabase/migrations/     # ordered SQL migrations (apply with npm run db:migrate)
scripts/                 # migration runner, seed
messages/                en.json / hi.json / gu.json
```

## Local setup

```bash
npm install
cp .env.example .env.local     # fill Supabase values (see DEPLOYMENT below)
npm run db:migrate             # applies SQL migrations (requires DATABASE_URL)
npm run dev                    # http://localhost:3000
```

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server |
| `npm run build` / `npm start` | Production build / serve |
| `npm run lint` | ESLint |
| `npm test` | Vitest unit tests (fee slabs, entry split, prize distribution, commission) |
| `npm run db:migrate` | Apply pending SQL migrations via `DATABASE_URL` |

## Environment variables

See `.env.example`. Only `NEXT_PUBLIC_*` values reach the browser. `SUPABASE_SERVICE_ROLE_KEY` is
used exclusively in server-side admin actions/webhooks (`server-only` import guard). The app builds
and renders a setup screen without any credentials — no crashes, no secrets in client code.

## Documentation

- `docs/DEPLOYMENT.md` — step-by-step free deployment (Supabase → GitHub → Vercel)
- `docs/ADMIN_GUIDE.md` — first admin setup, roles, daily workflows
- `docs/SECURITY_CHECKLIST.md` — controls implemented + production pre-launch checklist
- `PLAN.md` — build progress tracker vs the master prompt

## Known limitations / compliance-dependent features

- Real-money deposits (gateways), withdrawals, and rewarded ads are implemented but **disabled by
  flags** — activation requires legal review, payment-provider approval, and ad-network policy
  checks (master prompt §4, §30, §79).
- Legal pages ship as clearly-marked **templates** — replace with counsel-reviewed documents.
- Android ships as an installable PWA today; a native APK (Capacitor wrapper) is a future step.
- Clan chat UI and some social flows are minimal implementations of the schema-backed model.
