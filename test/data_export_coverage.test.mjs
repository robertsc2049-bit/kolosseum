// "Download my data" must cover everything Kolosseum keeps about a person
// (UK GDPR Article 15). Every table in schema.sql with a user id column must
// either be read by one of the export modules or be listed below with the
// reason it's left out - so a new feature's table can't silently miss the
// export again.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

const EXPORT_MODULES = [
  "src/api/data_rights_service.ts",
  "src/api/org_owner_data_rights_service.ts",
  "src/api/data_export_records.ts",
  "src/api/message_safety_service.ts",
  "src/api/athlete_history_service.ts"
];

// Deliberately not in anyone's copy of their data, and why.
const LEFT_OUT = {
  beta_accounts: "legacy sign-up row: the same email, name and role are in the account category",
  product_admin_accounts: "Kolosseum staff accounts, not app users",
  product_admin_sessions: "Kolosseum staff sign-in sessions",
  product_admin_audit_records: "Kolosseum staff's own record of the actions they took",
  product_admin_backup_codes: "Kolosseum staff two-step sign-in backup codes (secrets)",
  product_admin_sign_in_challenges: "Kolosseum staff sign-in steps (secrets)",
  product_admin_security_events: "Kolosseum staff's own two-step sign-in history",
  product_auth_sessions: "sign-in session secrets: handing them out would let someone sign in as the person",
  product_auth_challenges: "one-time sign-in and verification codes (secrets)",
  product_org_owner_sessions: "sign-in session secrets for gym owners",
  product_test_accounts: "Kolosseum's internal mark on accounts it made for testing"
};

function userKeyedTables(schema) {
  const tables = new Map();
  for (const match of schema.matchAll(/CREATE TABLE(?: IF NOT EXISTS)?\s+([a-z_0-9]+)\s*\(([\s\S]*?)\n\);/giu)) {
    const columns = [...match[2].matchAll(/^\s*([a-z_0-9]+)\s+[A-Za-z]/gmu)].map((c) => c[1]);
    tables.set(match[1], new Set(columns));
  }
  for (const match of schema.matchAll(/ALTER TABLE(?: IF EXISTS)?\s+([a-z_0-9]+)\s+ADD COLUMN(?: IF NOT EXISTS)?\s+([a-z_0-9]+)/giu)) {
    tables.get(match[1])?.add(match[2]);
  }
  return [...tables].filter(([, columns]) => [...columns].some((c) => c.endsWith("user_id"))).map(([name]) => name);
}

const schema = read("schema.sql");
const exporters = EXPORT_MODULES.map(read).join("\n");
const tables = userKeyedTables(schema);

test("schema.sql parses into the user-keyed tables we know about", () => {
  assert.ok(tables.length >= 45, `only ${tables.length} user-keyed tables parsed`);
  for (const known of ["product_accounts", "product_messages", "product_package_payments", "product_video_submissions", "org_owner_support_requests"]) {
    assert.ok(tables.includes(known), known);
  }
});

test("every table holding a person's data is in their export, or left out on purpose with a reason", () => {
  const missing = tables.filter((table) => !LEFT_OUT[table] && !new RegExp(`\\b${table}\\b`, "u").test(exporters));
  assert.deepEqual(missing, [], `add these to data_export_records.ts (or to LEFT_OUT with a reason): ${missing.join(", ")}`);
});

test("nothing is both exported and listed as left out, and every left-out table still exists", () => {
  for (const table of Object.keys(LEFT_OUT)) {
    assert.ok(tables.includes(table), `${table} is no longer a user-keyed table - drop it from LEFT_OUT`);
    assert.doesNotMatch(exporters, new RegExp(`\\b${table}\\b`, "u"), `${table} is exported - drop it from LEFT_OUT`);
  }
});

test("every product record about the person is exported, not just a hand-picked list of types", () => {
  const records = read("src/api/data_export_records.ts");
  assert.match(records, /record_type <> ALL\(\$2::text\[\]\)\s+AND \(subject_user_id = \$1/u);
});

test("every category an export fills is one the export boundary allows", async () => {
  const { GDPR_EXPORT_ALLOWED_DATA_CATEGORIES } = await import("../src/v1GdprExportHandling.mjs");
  for (const file of ["src/api/data_rights_service.ts", "src/api/org_owner_data_rights_service.ts"]) {
    const source = read(file);
    const block = source.slice(source.indexOf("const dataSources = {"), source.indexOf("const categoryPreviewCounts"));
    const categories = [...block.matchAll(/^\s{4}([a-z_0-9]+)(?::|,)/gmu)].map((m) => m[1]);
    assert.ok(categories.length > 5, file);
    for (const category of categories) assert.ok(GDPR_EXPORT_ALLOWED_DATA_CATEGORIES.includes(category), `${file}: ${category}`);
  }
});
