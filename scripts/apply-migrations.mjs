/**
 * Applies SQL migrations in order against DATABASE_URL (Supabase Postgres).
 * Tracks applied files in the _migrations table. Idempotent.
 *
 * Usage: npm run db:migrate   (requires DATABASE_URL in .env.local or env)
 */
import fs from "node:fs";
import path from "node:path";
import { Client } from "pg";
import fs2 from "node:fs";

function loadEnv() {
  for (const file of [".env.local", ".env"]) {
    const p = path.join(process.cwd(), file);
    if (fs.existsSync(p)) {
      for (const line of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
        const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
        if (m && !process.env[m[1]]) {
          process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
        }
      }
    }
  }
}

async function main() {
  loadEnv();
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL is not set. Add it to .env.local (Supabase → Settings → Database → Connection string URI).");
    process.exit(1);
  }

  const needsSsl = /supabase\.(co|com|in)/.test(url) && !/sslmode=/.test(url);
  const client = new Client({
    connectionString: url,
    ...(needsSsl ? { ssl: { rejectUnauthorized: false } } : {}),
  });
  await client.connect();

  await client.query(`create table if not exists _migrations (name text primary key, applied_at timestamptz not null default now())`);

  const dir = path.join(process.cwd(), "supabase", "migrations");
  const files = fs2.readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();

  const { rows } = await client.query<{ name: string }>(`select name from _migrations`);
  const applied = new Set(rows.map((r) => r.name));

  let ran = 0;
  for (const file of files) {
    if (applied.has(file)) {
      console.log(`= ${file} (already applied)`);
      continue;
    }
    const sql = fs2.readFileSync(path.join(dir, file), "utf8");
    try {
      await client.query("begin");
      await client.query(sql);
      await client.query(`insert into _migrations (name) values ($1)`, [file]);
      await client.query("commit");
      console.log(`+ ${file} applied`);
      ran++;
    } catch (err) {
      await client.query("rollback");
      console.error(`! ${file} FAILED:`, err.message);
      process.exit(1);
    }
  }

  console.log(ran === 0 ? "Database is up to date." : `Applied ${ran} migration(s).`);
  await client.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
