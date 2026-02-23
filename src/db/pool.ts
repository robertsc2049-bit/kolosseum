import { Pool } from "pg";

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
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

export const pool = new Pool({
  connectionString: requireDatabaseUrl(),
});