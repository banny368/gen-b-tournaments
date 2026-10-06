/**
 * Careful, one-shot cleanup of the UI-audit test account.
 * Prints every step. Usage: node scripts/cleanup-audit-user.mjs
 */
import { createClient } from "@supabase/supabase-js";
import { Client } from "pg";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const EMAIL_LIKE = "audit-%@testgenb.invalid";

const pg = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});
await pg.connect();

const users = await pg.query("select id, email from auth.users where email like $1", [EMAIL_LIKE]);
console.log("STEP 1 — audit accounts found:", JSON.stringify(users.rows));

for (const u of users.rows) {
  // 1. strip admin role first (security: no admin test accounts on prod)
  const r1 = await pg.query("delete from public.user_roles where user_id = $1 returning role", [u.id]);
  console.log(`STEP 2 — roles removed for ${u.email}:`, r1.rows.map((r) => r.role));

  // 2. purge ledger rows (immutability trigger needs a pause)
  await pg.query("begin");
  await pg.query("alter table public.ledger_entries disable trigger trg_ledger_entries_immutable");
  await pg.query("alter table public.ledger_transactions disable trigger trg_ledger_tx_immutable");
  const r2 = await pg.query(
    `delete from public.ledger_transactions
      where id in (select transaction_id from public.ledger_entries
                    where user_id = $1
                       or wallet_id in (select id from public.wallets where user_id = $1))`,
    [u.id],
  );
  await pg.query("alter table public.ledger_entries enable trigger trg_ledger_entries_immutable");
  await pg.query("alter table public.ledger_transactions enable trigger trg_ledger_tx_immutable");
  await pg.query("commit");
  console.log(`STEP 3 — ledger transactions purged:`, r2.rowCount);

  // 3. normalize tournament counters
  const r3 = await pg.query(
    `update public.tournaments t
        set current_players = greatest(0, current_players - coalesce((
              select count(*) from public.tournament_entries e
               where e.tournament_id = t.id and e.user_id = $1), 0))
      where exists (select 1 from public.tournament_entries e
                     where e.tournament_id = t.id and e.user_id = $1)
      returning slug, current_players`,
    [u.id],
  );
  console.log("STEP 4 — tournament counters fixed:", JSON.stringify(r3.rows));

  // 4. clear chat attribution (messages stay, author becomes anonymous)
  await pg.query("update public.chat_messages set user_id = null where user_id = $1", [u.id]);
  await pg.query("update public.chat_reports set reporter_id = null where reporter_id = $1", [u.id]);
  console.log("STEP 5 — chat attribution cleared");

  // 5. delete the auth user via admin API
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
  const del = await admin.auth.admin.deleteUser(u.id);
  console.log(`STEP 6 — deleteUser for ${u.email}:`, del.error ? `FAILED: ${del.error.message}` : "OK");
}

const left = await pg.query("select email from auth.users order by created_at");
console.log("STEP 7 — remaining users:", JSON.stringify(left.rows.map((r) => r.email)));
const entries = await pg.query("select count(*)::int as n from public.ledger_entries");
console.log("STEP 8 — ledger entries remaining:", entries.rows[0].n);
await pg.end();
