// Applies every .sql file in supabase/migrations/ (in name order) to DATABASE_URL.
// Usage (from the repo root):  node --env-file=backend/.env supabase/apply-migration.mjs
// Runs each file in its own transaction. Never prints the connection string.
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";

const here = path.dirname(fileURLToPath(import.meta.url));
const { Client } = createRequire(path.join(here, "../backend/package.json"))("pg");

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set.");
  process.exit(1);
}

const dir = path.join(here, "migrations");
const files = fs.readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();

const client = new Client({ connectionString: url, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 15000 });
try {
  await client.connect();
  const { rows } = await client.query("select to_regclass('public.users') as t");
  if (rows[0].t) {
    console.error("public.users already exists - refusing to re-apply the initial migration.");
    process.exit(1);
  }
  for (const f of files) {
    await client.query("begin");
    try {
      await client.query(fs.readFileSync(path.join(dir, f), "utf8"));
      await client.query("commit");
      console.log("applied", f);
    } catch (err) {
      await client.query("rollback");
      throw err;
    }
  }
  const t = await client.query(
    `select c.relname as "table", c.relrowsecurity as rls,
            (select count(*)::int from pg_trigger g where g.tgrelid = c.oid and not g.tgisinternal) as triggers
       from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind = 'r' order by 1`
  );
  console.table(t.rows);
} catch (err) {
  console.error("Migration failed:", err.code || "", String(err.message || err.name).replace(/postgres(ql)?:\/\/\S+/gi, "<db-url>"));
  process.exit(1);
} finally {
  await client.end().catch(() => {});
}
