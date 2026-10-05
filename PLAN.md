# Gen B Tournaments — Build Plan & Progress Tracker

> Source spec: `Gen_B_Tournaments_Master_Build_Prompt.md` (123 sections).
> This file is the execution tracker. Update status as each phase completes.

## Locked Decisions

| Decision | Choice |
| --- | --- |
| Frontend | Next.js 15 (App Router, TypeScript) + Tailwind CSS v4 + shadcn/ui patterns |
| PWA | Serwist service worker, installable on Android, offline page |
| Backend | Supabase free tier (PostgreSQL, Auth, Storage, Realtime) |
| Money logic | PostgreSQL functions (server-authoritative, transactional, idempotent) |
| i18n | next-intl — English, Hindi, Gujarati |
| Testing | Vitest (unit) + Playwright (e2e) + GitHub Actions CI |
| Hosting | Vercel (free) + Supabase cloud (free) + GitHub |
| Real money | Disabled behind feature flags/compliance gates until legal approval |

## Non-Negotiable Invariants (checked every phase)

1. Every balance change = double-entry ledger transaction. No direct balance mutation.
2. Money-moving RPCs are idempotent (idempotency keys / unique constraints).
3. Client never decides money, eligibility, results, status, or permissions.
4. Real-money features behind feature flags; kill switches wired.
5. No emojis in UI — SVG icons (lucide) only.
6. No hard-coded fees/commissions/games/limits — all from `admin_settings` / `games` / `feature_flags`.
7. UTC in DB; server time for countdowns/status transitions.
8. Secrets only in server env; `.env.example` documents all.

## Phase Status

| # | Phase | Deliverables | Status |
| --- | --- | --- | --- |
| 1 | Setup & scaffold | Repo, toolchain, PLAN.md, env templates, CI | ✅ Done |
| 2 | Foundation | Design system, PWA shell, auth, profiles, RBAC, games CRUD, i18n, seeds | ✅ Done |
| 3 | Tournament engine | Model, statuses, listing, details, countdown, race-safe join, rooms, results | ✅ Done |
| 4 | Wallet & ledger | Double-entry ledger, balance types, history, demo credits, manual UPI + UTR | ✅ Done |
| 5 | Payments | Provider abstraction, Razorpay sandbox adapter, verified webhook, event log | ✅ Done (flag OFF) |
| 6 | Withdrawals | Slab engine, KYC state, admin queue, reversal (flag OFF in prod) | ✅ Done (flag OFF) |
| 7 | Social | Clans, global chat (realtime), leaderboards, notifications, claims | ✅ Done (clan chat UI minimal) |
| 8 | Rewards | Referrals, campaigns, reward ledger, anti-abuse caps, ad-reward stub | ✅ Done (ads OFF) |
| 9 | Admin panel | Dashboard, queues, settings, flags, audit viewer, claims, users, adjustments | ✅ Done |
| 10 | Security & performance | RLS lockdown, upload security model, security headers, money-rule tests, CI | ✅ Done (e2e race tests pending live DB) |
| 11 | Release | Final audit, legal pages, docs, prod build, **deploy live** | ✅ LIVE: https://gen-b-tournaments.vercel.app |

## Deployment record (2026-10-05)

- Database: 12 migrations applied to Supabase (project `nyvkxtxhqhpzumwueyag`, Mumbai)
- Backend e2e smoke suite: **20/20 passed** (`node scripts/e2e-smoke.mjs`)
- Repo: `banny368/gen-b-tournaments` (branch `main`; old `master` = previous static attempt)
- Hosting: Vercel project `gen-b-tournaments` (framework corrected from "Other" to Next.js,
  deployment protection disabled)
- CI on every push (lint + money tests + build)

## Verification Gates (per master prompt §108 — never declare complete until all pass)

- [ ] All phases implemented
- [ ] Automated tests pass (unit + e2e)
- [ ] 15 critical money tests pass (§85)
- [ ] Security review passes
- [ ] Responsive UI review passes (mobile/tablet/desktop)
- [ ] Production build succeeds
- [ ] Admin workflow tested
- [ ] Payment sandbox workflow tested
- [ ] DB policies reviewed
- [ ] Docs updated
- [ ] Known limitations listed
- [ ] Compliance-dependent features marked disabled

## Environment Variables (see `.env.example`)

`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (server-only),
`DATABASE_URL` (migrations), `PAYMENT_*` / `RAZORPAY_*` (sandbox until keys exist), `NEXT_PUBLIC_APP_URL`.
Real credentials are supplied by the user at deployment time; app must build/run UI without them.

## Deployment Runbook (Phase 11)

1. Create GitHub repo → push this codebase.
2. Create Supabase project → run `npm run db:migrate` with `DATABASE_URL` → create first admin.
3. Vercel: import repo → set env vars → deploy.
4. Production smoke tests (auth, browse, demo join, admin login).
5. Compliance-dependent features verified OFF: `REAL_MONEY_ENABLED`, `WITHDRAWAL_ENABLED`, `RAZORPAY_ENABLED`.
