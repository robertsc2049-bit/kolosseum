
// DEV NOTE: Repository automation script. This file exists to make a repeatable repo operation
// deterministic and reviewable. Keep side effects explicit, paths repo-root relative, and
// failure output readable for PowerShell and CI users.
//
// S-V1-O-03 backup/restore dry run. Performs a REAL fixture-only backup and restore against
// throwaway Postgres databases (never the app's real DATABASE_URL database), then builds the
// operational evidence record defined by src/v1BackupRestoreTest.mjs. This script never reads
// production data, never stores secret values, and never touches engine code.
//
// Usage:
//   node scripts/backup-restore-dry-run.mjs [--pg-bin-dir "<dir containing pg_dump/psql>"]
//
// Safety:
//   - Refuses to run unless the DATABASE_URL host is loopback (127.0.0.1 / localhost).
//   - Only ever creates/drops two throwaway databases with fixed, dry-run-specific names;
//     never touches the app's own configured database.
//   - Cleans up both throwaway databases and the local dump file on exit, success or failure.

import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";
import { spawnSync } from "node:child_process";
import { Pool } from "pg";
import { buildBackupRestoreDryRunEvidence, getBackupRestoreDryRunContract } from "../src/v1BackupRestoreTest.mjs";

const FIXTURE_DB = "kolosseum_backup_dryrun_fixture";
const THROWAWAY_DB = "kolosseum_backup_dryrun_restore";
const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost", "::1"]);

const SECRET_LIKE_PATTERNS = [
  /(postgres|mysql|mongodb|redis):\/\/[^/\s:@]+:[^@\s]+@/i,
  /-----BEGIN [A-Z ]+PRIVATE KEY-----/i,
  /\b[A-Za-z0-9_]*(DATABASE_URL|SECRET|TOKEN|PASSWORD|PRIVATE_KEY|API_KEY)[A-Za-z0-9_]*\s*=\s*[^\s]+/i
];

function loadDotEnv(dotenvPath) {
  if (!fs.existsSync(dotenvPath)) return;
  const raw = fs.readFileSync(dotenvPath, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    const isQuoted = (value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"));
    if (!isQuoted) {
      const hash = value.indexOf(" #");
      if (hash >= 0) value = value.slice(0, hash).trim();
    }
    if (isQuoted) value = value.slice(1, -1);
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

function parseArgs(argv) {
  const out = { pgBinDir: process.env.PG_BIN_DIR || null };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--pg-bin-dir") out.pgBinDir = argv[++i];
  }
  return out;
}

function resolveBinary(name, pgBinDir) {
  const candidates = [];
  if (pgBinDir) candidates.push(path.join(pgBinDir, name + (process.platform === "win32" ? ".exe" : "")));
  if (process.platform === "win32") {
    for (const base of ["C:\\Program Files\\PostgreSQL", "C:\\Program Files (x86)\\PostgreSQL"]) {
      if (!fs.existsSync(base)) continue;
      for (const version of fs.readdirSync(base).sort().reverse()) {
        candidates.push(path.join(base, version, "bin", name + ".exe"));
      }
    }
  }
  candidates.push(name);

  for (const candidate of candidates) {
    if (candidate === name) return candidate; // last resort: rely on PATH, let spawnSync report if missing
    if (fs.existsSync(candidate)) return candidate;
  }
  return name;
}

function withDatabase(connectionString, dbName) {
  const u = new URL(connectionString);
  u.pathname = "/" + dbName;
  return u.toString();
}

function targetSummary(connectionString) {
  const u = new URL(connectionString);
  return `host=${u.hostname} port=${u.port || "5432"} user=${u.username} db=${u.pathname.replace(/^\//, "")}`;
}

async function runSql(connectionString, sql) {
  const pool = new Pool({ connectionString });
  try {
    return await pool.query(sql);
  } finally {
    await pool.end();
  }
}

function run(cmd, args, options = {}) {
  const result = spawnSync(cmd, args, { encoding: "utf8", windowsHide: true, ...options });
  if (result.error) {
    throw new Error(`${cmd} failed to start: ${result.error.message}`);
  }
  if (result.status !== 0) {
    throw new Error(`${cmd} ${args.join(" ")} exited ${result.status}\n${result.stderr || result.stdout || ""}`);
  }
  return result;
}

function findSecretLikeValue(text) {
  for (const pattern of SECRET_LIKE_PATTERNS) {
    const match = text.match(pattern);
    if (match) return pattern.source;
  }
  return null;
}

function assertNoEngineImportsInThisScript() {
  const self = fs.readFileSync(new URL(import.meta.url), "utf8");
  const importSpecifiers = [...self.matchAll(/from\s+["']([^"']+)["']/g)].map((m) => m[1]);
  const engineLike = importSpecifiers.find((specifier) => specifier.toLowerCase().includes("engine"));
  if (engineLike) {
    throw new Error(`engine_boundary_checked failed: this script imports an engine-like path (${engineLike})`);
  }
}

async function main() {
  loadDotEnv(path.resolve(process.cwd(), ".env"));
  const args = parseArgs(process.argv.slice(2));

  const appDbUrl = process.env.DATABASE_URL;
  if (!appDbUrl) {
    console.error("DATABASE_URL not set (checked .env and process.env)");
    process.exit(1);
  }

  const appUrl = new URL(appDbUrl);
  if (!LOOPBACK_HOSTS.has(appUrl.hostname)) {
    console.error(`Refusing to run: DATABASE_URL host "${appUrl.hostname}" is not loopback. This dry run only runs against a local database.`);
    process.exit(1);
  }

  const appDbName = appUrl.pathname.replace(/^\//, "");
  if (appDbName === FIXTURE_DB || appDbName === THROWAWAY_DB) {
    console.error("Refusing to run: the app's own DATABASE_URL points at a dry-run database name. Aborting to avoid touching real data.");
    process.exit(1);
  }

  const maintenanceUrl = withDatabase(appDbUrl, "postgres");
  const fixtureUrl = withDatabase(appDbUrl, FIXTURE_DB);
  const throwawayUrl = withDatabase(appDbUrl, THROWAWAY_DB);

  const schemaPath = path.resolve(process.cwd(), "schema.sql");
  const pgDump = resolveBinary("pg_dump", args.pgBinDir);
  const psql = resolveBinary("psql", args.pgBinDir);
  const dumpPath = path.join(os.tmpdir(), `kolosseum_backup_dryrun_${Date.now()}.sql`);

  const steps = { backup_plan_declared: false, fixture_backup_created: false, fixture_restore_performed: false, restore_integrity_compared: false, secret_exposure_checked: false, engine_boundary_checked: false };
  let secretValueAccessed = false;
  let restoreIntegrityCompared = false;

  console.log("S-V1-O-03 backup/restore dry run");
  console.log(`  app database (untouched): ${targetSummary(appDbUrl)}`);
  console.log(`  fixture database:         ${targetSummary(fixtureUrl)}`);
  console.log(`  throwaway database:       ${targetSummary(throwawayUrl)}`);
  console.log(`  pg_dump: ${pgDump}`);
  console.log(`  psql:    ${psql}`);

  try {
    // Step 1: backup_plan_declared
    console.log("\n[1/6] backup_plan_declared");
    console.log(`  plan: pg_dump ${FIXTURE_DB} (plain SQL) -> restore via psql into ${THROWAWAY_DB} -> compare -> drop both`);
    steps.backup_plan_declared = true;

    // Step 2: fixture_backup_created
    console.log("\n[2/6] fixture_backup_created");
    await runSql(maintenanceUrl, `DROP DATABASE IF EXISTS ${FIXTURE_DB};`);
    await runSql(maintenanceUrl, `DROP DATABASE IF EXISTS ${THROWAWAY_DB};`);
    await runSql(maintenanceUrl, `CREATE DATABASE ${FIXTURE_DB};`);

    let schemaSql = fs.readFileSync(schemaPath, "utf8");
    if (schemaSql.charCodeAt(0) === 0xfeff) schemaSql = schemaSql.slice(1);
    const upper = schemaSql.toUpperCase();
    if (!(upper.includes("BEGIN") && upper.includes("COMMIT"))) {
      schemaSql = `BEGIN;\n${schemaSql}\nCOMMIT;\n`;
    }
    await runSql(fixtureUrl, schemaSql);

    const fixtureRow = {
      block_id: "fixture_dryrun_block_1",
      engine_version: "backup-restore-dry-run-fixture",
      canonical_hash: crypto.createHash("sha256").update("fixture_dryrun_block_1").digest("hex")
    };
    await runSql(
      fixtureUrl,
      `INSERT INTO blocks (block_id, engine_version, canonical_hash, phase1_input, phase2_canonical, phase3_output, phase4_program)
       VALUES ('${fixtureRow.block_id}', '${fixtureRow.engine_version}', '${fixtureRow.canonical_hash}', '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, '{}'::jsonb);`
    );
    console.log(`  seeded 1 clearly-fixture row into blocks (block_id=${fixtureRow.block_id})`);

    run(pgDump, ["--no-owner", "--no-privileges", "--file", dumpPath, fixtureUrl]);
    const dumpBytes = fs.statSync(dumpPath).size;
    console.log(`  pg_dump wrote ${dumpBytes} bytes to ${dumpPath}`);
    steps.fixture_backup_created = true;

    // Step 3: secret_exposure_checked (scan the actual dump file content)
    console.log("\n[3/6] secret_exposure_checked");
    const dumpText = fs.readFileSync(dumpPath, "utf8");
    const secretMatch = findSecretLikeValue(dumpText);
    if (secretMatch) {
      secretValueAccessed = true;
      throw new Error(`secret_exposure_checked failed: dump file matched a secret-like pattern (${secretMatch})`);
    }
    console.log("  scanned dump file for connection strings, private keys, and *_SECRET/*_TOKEN/*_PASSWORD assignments: none found");
    steps.secret_exposure_checked = true;

    // Step 4: fixture_restore_performed
    console.log("\n[4/6] fixture_restore_performed");
    await runSql(maintenanceUrl, `CREATE DATABASE ${THROWAWAY_DB};`);
    run(psql, ["-v", "ON_ERROR_STOP=1", "-q", "-f", dumpPath, throwawayUrl]);
    console.log(`  restored dump into ${THROWAWAY_DB} via psql`);
    steps.fixture_restore_performed = true;

    // Step 5: restore_integrity_compared
    console.log("\n[5/6] restore_integrity_compared");
    const fixtureCount = await runSql(fixtureUrl, "SELECT count(*)::int AS n FROM blocks;");
    const restoredCount = await runSql(throwawayUrl, "SELECT count(*)::int AS n FROM blocks;");
    const restoredRowResult = await runSql(throwawayUrl, `SELECT block_id, engine_version, canonical_hash FROM blocks WHERE block_id = '${fixtureRow.block_id}';`);

    const countsMatch = fixtureCount.rows[0].n === restoredCount.rows[0].n;
    const restored = restoredRowResult.rows[0];
    const rowMatches =
      !!restored &&
      restored.block_id === fixtureRow.block_id &&
      restored.engine_version === fixtureRow.engine_version &&
      restored.canonical_hash === fixtureRow.canonical_hash;

    console.log(`  row count: fixture=${fixtureCount.rows[0].n} restored=${restoredCount.rows[0].n} match=${countsMatch}`);
    console.log(`  seeded row content matches restored row content: ${rowMatches}`);

    if (!countsMatch || !rowMatches) {
      throw new Error("restore_integrity_compared failed: restored data does not match the fixture backup");
    }
    restoreIntegrityCompared = true;
    steps.restore_integrity_compared = true;

    // Step 6: engine_boundary_checked
    console.log("\n[6/6] engine_boundary_checked");
    assertNoEngineImportsInThisScript();
    console.log("  confirmed this script imports no engine package/path");
    steps.engine_boundary_checked = true;
  } finally {
    console.log("\ncleanup:");
    try { fs.rmSync(dumpPath, { force: true }); console.log(`  removed ${dumpPath}`); } catch (err) { console.error(`  WARN: could not remove dump file: ${err.message}`); }
    try { await runSql(maintenanceUrl, `DROP DATABASE IF EXISTS ${THROWAWAY_DB};`); console.log(`  dropped ${THROWAWAY_DB}`); } catch (err) { console.error(`  WARN: could not drop ${THROWAWAY_DB}: ${err.message}`); }
    try { await runSql(maintenanceUrl, `DROP DATABASE IF EXISTS ${FIXTURE_DB};`); console.log(`  dropped ${FIXTURE_DB}`); } catch (err) { console.error(`  WARN: could not drop ${FIXTURE_DB}: ${err.message}`); }
  }

  const allStepsPassed = Object.values(steps).every(Boolean);
  if (!allStepsPassed) {
    console.error("\nDry run did not complete all required steps; refusing to build an evidence record.");
    process.exit(1);
  }

  const evidence = buildBackupRestoreDryRunEvidence({
    slice_id: "S-V1-O-03",
    contract_version: getBackupRestoreDryRunContract().contract_version,
    operator_record_id: `backup_restore_dry_run_${new Date().toISOString().replace(/[:.]/g, "-")}`,
    target_environment: "ci_ephemeral",
    data_source: "fixture_only",
    backup_artifact_kind: "logical_dump_fixture",
    restore_target_kind: "throwaway_database",
    production_connection_used: false,
    live_data_used: false,
    secret_value_accessed: secretValueAccessed,
    engine_mutation: false,
    restore_integrity_compared: restoreIntegrityCompared,
    dry_run_steps: Object.keys(steps)
  });

  console.log("\nS-V1-O-03 CONTROLLED_LAUNCH_BACKUP_RESTORE_DRY_RUN_PASS");
  console.log(JSON.stringify(evidence, null, 2));

  const outPath = path.resolve(process.cwd(), "tmp_backup_restore_dry_run_evidence.json");
  fs.writeFileSync(outPath, JSON.stringify(evidence, null, 2) + "\n", "utf8");
  console.log(`\nEvidence record written to ${outPath} (gitignored - operator-held, not committed).`);
}

main().catch((err) => {
  console.error("\nbackup-restore-dry-run.mjs FAILED");
  console.error(err?.message ?? String(err));
  process.exit(1);
});
