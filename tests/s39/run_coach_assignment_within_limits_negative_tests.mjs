
// DEV NOTE: Human-maintained repo surface. Keep this file aligned with canonical contracts,
// deterministic checks, and developer handover standards. Do not introduce hidden defaults,
// broad discovery, or unreviewed boundary changes.

import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();

const files = {
  md: path.join(repoRoot, "docs", "slices", "S39_COACH_ASSIGNMENT_WITHIN_LIMITS.md"),
  sql: path.join(repoRoot, "db", "schema", "coach_assignments.sql"),
  tests: path.join(repoRoot, "tests", "s39", "coach_assignment_within_limits.negative.json")
};

function read(file) {
  return fs.readFileSync(file, "utf8");
}

function fail(message) {
  console.error(JSON.stringify({ ok: false, slice: "S39", error: message }, null, 2));
  process.exit(1);
}

function assertIncludes(name, content, needle) {
  if (!content.includes(needle)) {
    fail(`${name} missing required content: ${needle}`);
  }
}

function assertNotIncludes(name, content, needle) {
  if (content.includes(needle)) {
    fail(`${name} contains forbidden content: ${needle}`);
  }
}

for (const [key, file] of Object.entries(files)) {
  if (!fs.existsSync(file)) {
    fail(`Missing required file: ${file}`);
  }
}

const md = read(files.md);
const sql = read(files.sql);
const testsRaw = read(files.tests);
const tests = JSON.parse(testsRaw);

const requiredMarkdown = [
  "Coach assignment is a platform access and visibility action only.",
  "Coach assignment must never create, modify, recompile, reselect, substitute, progress, repair, enrich, explain, or validate engine output.",
  "Coach assignment controls platform visibility/access only.",
  "Tier cap denial must not change target artefact content.",
  "target_hash_before_assignment == target_hash_after_assignment",
  "Payment/tier state cannot change artefact content",
  "Phase 1",
  "accepted active coach-athlete link",
  "coach_tier_seat_cap_exceeded",
  "exactly one target"
];

for (const needle of requiredMarkdown) {
  assertIncludes("markdown", md, needle);
}

const requiredSql = [
  "create type public.coach_assignment_status",
  "create table if not exists public.coach_assignments",
  "assignment_id uuid primary key",
  "coach_user_id uuid not null",
  "athlete_user_id uuid not null",
  "session_id uuid null",
  "compiled_artefact_id uuid null",
  "assignment_status public.coach_assignment_status not null",
  "assigned_artefact_hash text not null",
  "coach_assignments_exactly_one_target_chk",
  "coach_assignments_status_revoked_at_chk",
  "coach_assignments_hash_shape_chk",
  "coach_assignments_unique_active_session_target",
  "coach_assignments_unique_active_compiled_artefact_target",
  "prevent_coach_assignment_target_mutation",
  "revoked assignments cannot be reactivated"
];

for (const needle of requiredSql) {
  assertIncludes("sql", sql, needle);
}

const forbiddenBoundaryDrift = [
  "readiness score",
  "readiness scoring enabled",
  "safety assessment",
  "injury prevention",
  "optimise",
  "optimize",
  "medical recommendation",
  "coach override",
  "force progression allowed",
  "registry edit allowed"
];

for (const needle of forbiddenBoundaryDrift) {
  assertNotIncludes("markdown", md.toLowerCase(), needle.toLowerCase());
  assertNotIncludes("sql", sql.toLowerCase(), needle.toLowerCase());
}

if (tests.schema_version !== "kolosseum.s39.coach_assignment_within_limits.negative_tests.v1.0.0") {
  fail("negative test schema_version mismatch");
}

if (!Array.isArray(tests.tests)) {
  fail("negative tests must contain tests array");
}

if (tests.tests.length < 20) {
  fail(`expected at least 20 negative tests, got ${tests.tests.length}`);
}

const requiredTestIds = [
  "S39_NEG_001_UNLINKED_COACH_CANNOT_ASSIGN",
  "S39_NEG_010_ASSIGNMENT_CANNOT_EDIT_PHASE1",
  "S39_NEG_011_ASSIGNMENT_CANNOT_FORCE_SUBSTITUTION",
  "S39_NEG_012_ASSIGNMENT_CANNOT_BYPASS_COMPILE_GATE",
  "S39_NEG_014_ASSIGNMENT_DOES_NOT_CHANGE_ARTEFACT_HASH",
  "S39_NEG_015_PAYMENT_STATE_CANNOT_CHANGE_ARTEFACT_CONTENT",
  "S39_NEG_016_TIER_CAP_DENIAL_CANNOT_CHANGE_ARTEFACT_CONTENT",
  "S39_NEG_021_ASSIGNMENT_CANNOT_MUTATE_REGISTRIES"
];

const ids = new Set(tests.tests.map(t => t.id));

for (const id of requiredTestIds) {
  if (!ids.has(id)) {
    fail(`missing required negative test id: ${id}`);
  }
}

for (const test of tests.tests) {
  if (!test.id || typeof test.id !== "string") {
    fail("each test requires string id");
  }

  if (!Array.isArray(test.must_not)) {
    fail(`${test.id} must include must_not array`);
  }

  const forbiddenMustNotOmission = [
    "mutate_artefact"
  ];

  const hasHashInvariant = JSON.stringify(test).includes("hash_before == hash_after");
  const isHashTest = test.id.includes("HASH") || test.id.includes("PAYMENT") || test.id.includes("TIER_CAP");

  if (isHashTest && !hasHashInvariant && !JSON.stringify(test.must_not).includes("mutate_artefact")) {
    fail(`${test.id} must assert hash/content non-mutation`);
  }
}

console.log(JSON.stringify({
  ok: true,
  slice: "S39",
  checked_files: files,
  negative_test_count: tests.tests.length
}, null, 2));
