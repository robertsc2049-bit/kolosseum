import { Pool } from "pg";

function die(msg) {
  process.stderr.write(msg + "\n");
  process.exit(1);
}

function isSmokeNoDb(v) {
  return v === "1" || v === "true" || v === "TRUE";
}

function safeDbSummary(raw) {
  try {
    const u = new URL(raw);
    const user = u.username ? `${u.username}@` : "";
    const host = u.hostname || "<host>";
    const port = u.port ? `:${u.port}` : "";
    const db = u.pathname || "";
    return `${u.protocol}//${user}${host}${port}${db}`;
  } catch {
    return "<invalid DATABASE_URL>";
  }
}

const blockId = process.argv[2];
if (!blockId || typeof blockId !== "string" || blockId.trim().length === 0) {
  die("smoke-db-assert-block: missing block_id argv[2]");
}

const url = process.env.DATABASE_URL;
if (!url || url.trim().length === 0) {
  die("smoke-db-assert-block: DATABASE_URL is not set");
}

if (isSmokeNoDb(process.env.SMOKE_NO_DB)) {
  die("smoke-db-assert-block: SMOKE_NO_DB is set but Tier-1 smoke requires DB");
}

process.stdout.write(`DB ASSERT: url=${safeDbSummary(url)}\n`);

const pool = new Pool({ connectionString: url });

try {
  const who = await pool.query(
    "select current_database() as db, inet_server_addr()::text as host, inet_server_port() as port"
  );
  if (who?.rows?.[0]) {
    process.stdout.write(
      `DB ASSERT: server db=${who.rows[0].db} host=${who.rows[0].host} port=${who.rows[0].port}\n`
    );
  }

  const existsTable = await pool.query(
    "select to_regclass('public.blocks') as reg"
  );
  const reg = existsTable?.rows?.[0]?.reg ?? null;
  process.stdout.write(`DB ASSERT: public.blocks regclass=${reg}\n`);
  if (!reg) {
    die("DB ASSERT FAIL: table public.blocks does not exist (check schema/table name).");
  }

  const r = await pool.query(
    "select 1 as ok from public.blocks where block_id = $1 limit 1",
    [blockId]
  );

  if (!r || !r.rows || r.rows.length === 0) {
    const c = await pool.query(
      "select count(*)::int as n from public.blocks"
    );
    const n = c?.rows?.[0]?.n ?? -1;
    die(`DB ASSERT FAIL: blocks row not found for block_id=${blockId} (public.blocks count=${n})`);
  }

  process.stdout.write(`DB ASSERT OK: blocks row exists for block_id=${blockId}\n`);
} finally {
  await pool.end();
}