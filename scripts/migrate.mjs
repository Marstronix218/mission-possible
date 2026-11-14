import pg from "pg";
import { readdir, readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
const apply = process.argv.includes("--apply");
const connection = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;
if (!connection) {
  console.error(
    "SUPABASE_DB_URL / DATABASE_URL is empty. Add the PostgreSQL connection string to .env.local.",
  );
  process.exit(1);
}
let client,
  transaction = false;
let current = "connection";
try {
  const url = new URL(connection);
  if (!["postgres:", "postgresql:"].includes(url.protocol))
    throw Object.assign(new Error(), { code: "INVALID_DATABASE_URL" });
  const expected = process.env.NEXT_PUBLIC_SUPABASE_URL
    ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname.split(".")[0]
    : null;
  if (
    expected &&
    url.hostname.endsWith(".supabase.co") &&
    !url.hostname.startsWith("db." + expected + ".")
  )
    throw Object.assign(new Error(), { code: "PROJECT_MISMATCH" });
  if (
    expected &&
    url.hostname.endsWith(".pooler.supabase.com") &&
    decodeURIComponent(url.username) !== "postgres." + expected
  )
    throw Object.assign(new Error(), { code: "PROJECT_MISMATCH" });
  for (const key of ["sslmode", "sslcert", "sslkey", "sslrootcert"])
    url.searchParams.delete(key);
  const local = ["localhost", "127.0.0.1", "::1"].includes(url.hostname);
  client = new pg.Client({
    connectionString: url.toString(),
    ssl: local ? false : { rejectUnauthorized: true },
    connectionTimeoutMillis: 15000,
  });
  await client.connect();
  const { rows } = await client.query(
    "select tablename from pg_tables where schemaname='public' order by tablename",
  );
  console.log(
    "Connected. Public tables:",
    rows.map((r) => r.tablename).join(", ") || "(none)",
  );
  if (apply) {
    await client.query("begin");
    transaction = true;
    await client.query(
      "select pg_advisory_xact_lock(hashtextextended('mission-possible:migrations',0))",
    );
    await client.query("create schema if not exists supabase_migrations");
    await client.query(
      "create table if not exists supabase_migrations.schema_migrations(version text primary key,statements text[],name text)",
    );
    await client.query(
      "create table if not exists supabase_migrations.mission_checksums(version text primary key,sha256 text not null)",
    );
    await client.query(
      "revoke all on schema supabase_migrations from public,anon,authenticated",
    );
    const directory = new URL("../supabase/migrations/", import.meta.url);
    for (const filename of (await readdir(directory))
      .filter((f) => /^\d+_.+\.sql$/.test(f))
      .sort()) {
      current = filename;
      const version = filename.split("_")[0];
      const sql = await readFile(new URL(filename, directory), "utf8");
      const hash = createHash("sha256").update(sql).digest("hex");
      const old = await client.query(
        "select sha256 from supabase_migrations.mission_checksums where version=$1",
        [version],
      );
      if (old.rows[0] && old.rows[0].sha256 !== hash)
        throw Object.assign(new Error(), { code: "APPLIED_MIGRATION_CHANGED" });
      const known = await client.query(
        "select version from supabase_migrations.schema_migrations where version=$1",
        [version],
      );
      if (known.rowCount) {
        console.log("Already applied:", filename);
        continue;
      }
      await client.query(sql);
      await client.query(
        "insert into supabase_migrations.schema_migrations(version,statements,name) values($1,$2,$3)",
        [version, [sql], filename.slice(version.length + 1, -4)],
      );
      await client.query(
        "insert into supabase_migrations.mission_checksums values($1,$2)",
        [version, hash],
      );
      console.log("Applied:", filename);
    }
    await client.query("notify pgrst, 'reload schema'");
    await client.query("commit");
    transaction = false;
    console.log("Migrations committed.");
  }
} catch (error) {
  if (transaction) await client.query("rollback").catch(() => {});
  console.error(
    "Database operation failed at " +
      current +
      "; code: " +
      (error.code ?? "CONNECTION_ERROR") +
      ". No connection credentials are logged.",
  );
  process.exitCode = 1;
} finally {
  await client?.end().catch(() => {});
}
