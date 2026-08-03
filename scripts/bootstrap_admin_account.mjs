
// DEV NOTE: Repository automation script. This file exists to make a repeatable repo operation
// deterministic and reviewable. Keep side effects explicit, paths repo-root relative, and
// failure output readable for PowerShell and CI users.

// scripts/bootstrap_admin_account.mjs
//
// Creates the first (or an additional) founder/admin account. There is
// deliberately no HTTP route that can do this - a founder/admin account
// must only ever be created by an operator running this script manually,
// gated behind an explicit environment variable, never through a public
// endpoint.
//
// Usage (PowerShell or bash):
//   ADMIN_BOOTSTRAP_TOKEN=<any-non-empty-value-you-choose> \
//   node scripts/bootstrap_admin_account.mjs --email founder@example.com --name "Founder Name" --password "at-least-16-characters"

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { Pool } from "pg";

function loadDotEnv(dotenvPath) {
  if (!fs.existsSync(dotenvPath)) return;
  const raw = fs.readFileSync(dotenvPath, "utf8");
  for (const line of raw.split(/\r?\n/u)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

loadDotEnv(path.resolve(process.cwd(), ".env"));

function die(message) {
  console.error(message);
  process.exit(1);
}

if (!process.env.ADMIN_BOOTSTRAP_TOKEN) {
  die(
    "ADMIN_BOOTSTRAP_TOKEN is not set. Set it to any non-empty value in your " +
    "own shell before running this script - this is the explicit operator " +
    "gate that keeps founder/admin account creation out of any public code path."
  );
}

function argValue(flag) {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const email = String(argValue("--email") ?? "").trim().toLowerCase();
const displayName = String(argValue("--name") ?? "").trim();
const password = String(argValue("--password") ?? "");

if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(email)) {
  die("Pass a valid --email <address>.");
}
if (!displayName) {
  die("Pass a --name <display name>.");
}
if (password.length < 16) {
  die("Pass a --password <at least 16 characters>.");
}

function randomId(prefix) {
  return `${prefix}_${crypto.randomUUID().replaceAll("-", "")}`;
}

function randomToken(bytes = 24) {
  return crypto.randomBytes(bytes).toString("base64url");
}

function derivePassword(rawPassword, salt) {
  return new Promise((resolve, reject) => {
    crypto.scrypt(
      rawPassword,
      salt,
      64,
      { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 },
      (error, key) => {
        if (error) reject(error);
        else resolve(Buffer.from(key).toString("base64url"));
      }
    );
  });
}

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  try {
    const existing = await pool.query(
      "SELECT user_id FROM product_admin_accounts WHERE email_canonical = $1",
      [email]
    );
    if (existing.rows[0]) {
      die(`An admin account already exists for ${email} (user_id=${existing.rows[0].user_id}).`);
    }

    const userId = randomId("admin");
    const salt = randomToken(24);
    const hash = await derivePassword(password, salt);

    await pool.query(
      `
      INSERT INTO product_admin_accounts (user_id, email_canonical, display_name, password_salt, password_hash)
      VALUES ($1, $2, $3, $4, $5)
      `,
      [userId, email, displayName, salt, hash]
    );

    console.log(`Created founder/admin account: user_id=${userId} email=${email}`);
  }
  finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
