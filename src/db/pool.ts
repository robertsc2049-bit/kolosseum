import { Pool } from "pg";
import crypto from "node:crypto";

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

function isSmokeNoDb(): boolean {
  const v = process.env.SMOKE_NO_DB;
  return v === "1" || v === "true" || v === "TRUE";
}

function safeUrlSummary(u: URL): string {
  // Do not leak password. Keep host/port/db/user.
  const user = u.username ? `${u.username}@` : "";
  const host = u.hostname || "<host>";
  const port = u.port ? `:${u.port}` : "";
  const db = u.pathname ? u.pathname : "";
  return `${u.protocol}//${user}${host}${port}${db}`;
}

function requireDatabaseUrl(): string {
  const raw = process.env.DATABASE_URL;

  // Tier-0: allow API to boot without DATABASE_URL.
  // We DO NOT talk to Postgres in SMOKE_NO_DB mode.
  if (isSmokeNoDb()) {
    if (isNonEmptyString(raw)) return raw;
    // Placeholder only. Must never be dialed.
    return "postgres://smoke_no_db:smoke_no_db@127.0.0.1:1/smoke_no_db";
  }

  if (!isNonEmptyString(raw)) {
    throw new Error(
      "DATABASE_URL is not set. Provide it via env var or a .env file in repo root (see .env.example).",
    );
  }

  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    throw new Error("DATABASE_URL is not a valid URL.");
  }

  const proto = (u.protocol || "").toLowerCase();
  if (proto !== "postgres:" && proto !== "postgresql:") {
    throw new Error(`DATABASE_URL must use postgres/postgresql protocol. Got: ${u.protocol}`);
  }

  // If username is present, password must be a non-empty string for SCRAM auth.
  if (isNonEmptyString(u.username) && !isNonEmptyString(u.password)) {
    throw new Error(
      `DATABASE_URL is missing a password component (required for SCRAM auth). Parsed: ${safeUrlSummary(u)}`,
    );
  }

  return raw;
}

type PgQueryResult = { rows: any[]; rowCount: number };

function makeId(prefix: string): string {
  // Node 24: randomUUID available.
  return `${prefix}_${crypto.randomUUID().replace(/-/g, "")}`;
}

function noopResult(): PgQueryResult {
  return { rows: [], rowCount: 0 };
}

function returningResult(sql: string): PgQueryResult {
  // Heuristic: if query says RETURNING block_id/session_id/id, hand back a value so handlers can proceed.
  // This is Tier-0 only and intentionally minimal.
  const lower = sql.toLowerCase();

  if (lower.includes("returning") && lower.includes("block_id")) {
    return { rows: [{ block_id: makeId("b") }], rowCount: 1 };
  }

  if (lower.includes("returning") && lower.includes("session_id")) {
    return { rows: [{ session_id: makeId("s") }], rowCount: 1 };
  }

  if (lower.includes("returning") && (lower.includes(" id") || lower.includes("returning id"))) {
    return { rows: [{ id: makeId("id") }], rowCount: 1 };
  }

  if (lower.includes("returning")) {
    // Unknown returning fields: still return one row to keep control-flow moving.
    return { rows: [{}], rowCount: 1 };
  }

  return noopResult();
}

class NoDbClient {
  async query(sql: any): Promise<PgQueryResult> {
    const text =
      typeof sql === "string"
        ? sql
        : (sql && typeof sql.text === "string" ? sql.text : "");

    if (!text) return noopResult();

    // Allow common "SELECT 1" etc.
    if (/^\s*select\s+/i.test(text)) return noopResult();

    // For INSERT/UPDATE/DELETE: if they use RETURNING, provide a plausible row.
    return returningResult(text);
  }

  release(): void {
    // no-op
  }
}

class NoDbPool {
  async connect(): Promise<NoDbClient> {
    return new NoDbClient();
  }

  async query(sql: any): Promise<PgQueryResult> {
    const c = await this.connect();
    try {
      return await c.query(sql);
    } finally {
      c.release();
    }
  }

  async end(): Promise<void> {
    // no-op
  }
}

// Exported singleton pool.
export const pool: Pool = (isSmokeNoDb()
  ? (new NoDbPool() as unknown as Pool)
  : new Pool({ connectionString: requireDatabaseUrl() }));