# Deployment — free tiers (Supabase + GitHub + Vercel)

> Nothing below costs money. Free-tier limits can change — verify current limits during setup
> (master prompt §80: never claim "100% free forever").

## Step 1 — Supabase (database + auth + storage)

1. Create account at [supabase.com](https://supabase.com) → **New project** (any name, e.g.
   `gen-b-tournaments`). Save the database password.
2. Collect four values:
   - **Settings → API**: `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - **Settings → API**: `anon public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **Settings → API**: `service_role` key → `SUPABASE_SERVICE_ROLE_KEY` (server-only secret)
   - **Settings → Database → Connection string → URI** → `DATABASE_URL` (for migrations)
3. Local run: put them in `.env.local`, then `npm run db:migrate` — all 11 migrations apply in
   order (schema, RLS, money RPCs, seed data).
4. Auth config (dashboard):
   - Authentication → Providers → Email: enable (disable email confirmation for fastest first
     login if desired).
   - Authentication → Providers → Google: enable with OAuth client credentials (optional; app
     hides the button failure gracefully otherwise).
   - Authentication → URL Configuration: set Site URL to your Vercel URL after step 3 and add
     `<vercel-url>/api/auth/callback` to Redirect URLs.

## Step 2 — GitHub (source + CI)

1. Create a repo `gen-b-tournaments` on GitHub.
2. From the project folder:

   ```bash
   git init
   git add -A
   git commit -m "Gen B Tournaments — initial platform build"
   git branch -M main
   git remote add origin https://github.com/<your-user>/gen-b-tournaments.git
   git push -u origin main
   ```

3. CI (`.github/workflows/ci.yml`) runs lint + unit tests + build on every push automatically.

## Step 3 — Vercel (hosting)

1. [vercel.com](https://vercel.com) → sign in with GitHub → **Add New Project** → import the repo.
2. Framework preset: Next.js (auto). Build command/default settings are fine.
3. Environment variables (Project → Settings → Environment Variables), for Production + Preview:

   ```
   NEXT_PUBLIC_SUPABASE_URL       = <project url>
   NEXT_PUBLIC_SUPABASE_ANON_KEY  = <anon key>
   SUPABASE_SERVICE_ROLE_KEY      = <service role key>
   NEXT_PUBLIC_APP_URL            = https://<your-project>.vercel.app
   ```

4. Deploy. First deploy takes ~2 minutes. Every push to `main` redeploys.

## Step 4 — First admin (required to manage the platform)

1. Register a normal user account on your live site.
2. In Supabase → **SQL Editor**, run:

   ```sql
   insert into public.user_roles (user_id, role)
   select id, 'SUPER_ADMIN' from public.profiles
   where username = '<their-username>';
   ```

3. Reload the site — **Admin** appears in the sidebar; `/admin` is the panel.

## Step 5 — Production smoke tests

- Register/login (email), browse tournaments, join a free or demo tournament.
- Wallet: claim demo credits (bonus balance), view transaction history.
- Admin: create tournament → join with a second account → publish results (prizes auto-credit via
  ledger) → check the audit log entry.

## Step 6 — Going live with real money (LATER — compliance-gated)

Do **not** enable before: legal review for your jurisdictions, payment-provider onboarding
approval, ad-network policy review for rewarded ads, and store/Play policy review.

1. Get Razorpay/Cashfree sandbox keys → set `RAZORPAY_KEY_ID/SECRET/WEBHOOK_SECRET` in Vercel.
2. Point the provider webhook at `/api/payments/razorpay/webhook`.
3. In Admin → Settings: configure `manual_upi_id` and deposit limits; toggle
   `MANUAL_UPI_ENABLED` / `RAZORPAY_ENABLED` / `REAL_MONEY_ENABLED` only after sign-off.
4. Enable `WITHDRAWAL_ENABLED` last, with KYC review workflow operating.

## Rollback / backups

- Vercel: redeploy any previous build from the Deployments tab.
- Supabase: daily backups on free tier are limited — periodically export via
  `pg_dump $DATABASE_URL > backup.sql` and store it safely. A backup that has never been restored
  is not verified: test-restore once.
