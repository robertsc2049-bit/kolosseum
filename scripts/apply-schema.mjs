// scripts/apply-schema.mjs
import fs from "node:fs";
import path from "node:path";
import { Pool } from "pg";

/**
 * Tiny .env loader (no dependency). Rules:
 * - loads .env from repo root (process.cwd())
 * - does NOT overwrite existing process.env keys
 * - supports: KEY=VALUE, quoted values, comments (#), blank lines
 */
function loadDotEnv(dotenvPath) {
  if (!fs.existsSync(dotenvPath)) return;

  const raw = fs.readFileSync(dotenvPath, "utf8");
  const lines = raw.split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;

    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();

    // strip inline comment for unquoted values: FOO=bar # comment
    const isQuoted =
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"));

    if (!isQuoted) {
      const hash = value.indexOf(" #");
      if (hash >= 0) value = value.slice(0, hash).trim();
    }

    // unquote
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }

    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

function parseArgs(argv) {
  const out = {
    dbUrl: undefined,
    schemaPath: undefined,
    quiet: false
  };

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];

    if (a === "--db-url" || a === "-d") {
      out.dbUrl = argv[++i];
      continue;
    }
    if (a === "--schema" || a === "-s") {
      out.schemaPath = argv[++i];
      continue;
    }
    if (a === "--quiet" || a === "-q") {
      out.quiet = true;
      continue;
    }
    if (a === "--help" || a === "-h") {
      printHelpAndExit(0);
    }
  }

  return out;
}

function printHelpAndExit(code) {
  console.log(`
Usage:
  node scripts/apply-schema.mjs [--db-url "<postgres_url>"] [--schema "<path_to_schema.sql>"] [--quiet]

Examples:
  node scripts/apply-schema.mjs
  node scripts/apply-schema.mjs --db-url "postgres://postgres:***@127.0.0.1:5432/kolosseum"
  node scripts/apply-schema.mjs --schema "./schema.sql"

Notes:
  - Loads .env from repo root unless DATABASE_URL is already set.
  - Prints host/user/db (never prints password).
`.trim());
  process.exit(code);
}

function stripUtf8Bom(s) {
  return s.length > 0 && s.charCodeAt(0) === 0xfeff ? s.slice(1) : s;
}

function hasBeginCommit(sql) {
  // very conservative detection: if file already has BEGIN and COMMIT somewhere, we assume it manages its own txn
  const up = sql.toUpperCase();
  return up.includes("BEGIN") && up.includes("COMMIT");
}

function dbTargetNoSecrets(dbUrl) {
  try {
    const u = new URL(dbUrl);

    // postgres URLs can be: postgres://user:pass@host:port/db
    const user = u.username || "(none)";
    const host = u.hostname || "(none)";
    const port = u.port || "(default)";
    const db = (u.pathname || "").replace(/^\//, "") || "(none)";

    return { user, host, port, db, ok: true };
  } catch {
    return { user: "(unparsed)", host: "(unparsed)", port: "(unparsed)", db: "(unparsed)", ok: false };
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  // Load .env without overwriting existing env vars.
  const dotenvPath = path.resolve(process.cwd(), ".env");
  loadDotEnv(dotenvPath);

  const dbUrl = args.dbUrl || process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error("DATABASE_URL not set (and no --db-url provided)");
    console.error(`Looked for .env at: ${dotenvPath}`);
    process.exit(1);
  }

  const schemaPath = path.resolve(process.cwd(), args.schemaPath || "schema.sql");
  if (!fs.existsSync(schemaPath)) {
    console.error(`schema.sql not found at: ${schemaPath}`);
    process.exit(1);
  }

  const target = dbTargetNoSecrets(dbUrl);
  if (!args.quiet) {
    console.log(`DB: host=${target.host} port=${target.port} user=${target.user} db=${target.db}`);
    console.log(`Schema: ${schemaPath}`);
  }

  let sql = fs.readFileSync(schemaPath, "utf8");
  sql = stripUtf8Bom(sql);

  // If schema.sql does not appear to manage its own transaction, wrap it.
  if (!hasBeginCommit(sql)) {
    sql = `BEGIN;\n${sql}\nCOMMIT;\n`;
  }

  const pool = new Pool({ connectionString: dbUrl });

  try {
    // single round-trip; Postgres accepts multi-statement SQL in one query string
    await pool.query(sql);

    if (!args.quiet) console.log("Schema applied successfully");
  } catch (err) {
    console.error("Schema apply failed");

    // pg errors often have: message, detail, position, code
    if (err && typeof err === "object") {
      const e = err;
      const msg = e.message ?? String(e);
      console.error(msg);

      if (e.code) console.error(`code: ${e.code}`);
      if (e.detail) console.error(`detail: ${e.detail}`);
      if (e.position) console.error(`position: ${e.position}`);

      // show a small hint if it looks like the earlier "ALTER inside CREATE TABLE" issue
      if (typeof msg === "string" && msg.toLowerCase().includes("syntax error") && typeof e.position === "string") {
        console.error("hint: check schema.sql around the reported position; common cause is SQL placed inside CREATE TABLE parentheses.");
      }
    } else {
      console.error(String(err));
    }

    process.exit(1);
  } finally {
    await pool.end();
  }
}

main().catch((e) => {
  console.error("apply-schema.mjs crashed");
  console.error(e?.message ?? String(e));
  process.exit(1);
});
