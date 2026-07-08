import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const DOC_PATH = "docs/v1/V1_FOUNDER_TEST_PACK.md";
const FIXTURE_PATH = "ci/fixtures/v1_founder_test_pack/s_v1_f_01_founder_fixture_accounts.json";

const REQUIRED_COVERAGE = [
  "coach_registration",
  "athlete_registration",
  "relationship",
  "declaration",
  "assignment",
  "compile",
  "execution",
  "split_return",
  "partial_completion",
  "history",
  "artefacts",
  "notes",
  "live_status",
  "proof_export",
  "payment",
  "legal",
  "support"
];

function readText(path) {
  return fs.readFileSync(path, "utf8");
}

function readFixture() {
  return JSON.parse(readText(FIXTURE_PATH));
}

test("S-V1-F-01 founder test pack document exists and is manual only", () => {
  const doc = readText(DOC_PATH);

  assert.match(doc, /# V1 Founder Test Pack/);
  assert.match(doc, /Slice: S-V1-F-01\./);
  assert.match(doc, /manual controlled-launch test surface only/i);
  assert.match(doc, /does not create product law/i);
  assert.match(doc, /does not authorise production data access/i);
  assert.match(doc, /does not add post-v1 product scope/i);
});

test("S-V1-F-01 covers the required founder manual test flow", () => {
  const doc = readText(DOC_PATH);
  const fixture = readFixture();

  assert.deepEqual(fixture.required_coverage, REQUIRED_COVERAGE);

  for (const coverage of REQUIRED_COVERAGE) {
    assert.ok(
      fixture.manual_test_scripts.some((script) => script.coverage === coverage),
      `missing manual script coverage: ${coverage}`
    );
  }

  const requiredDocPhrases = [
    "Coach registration or provisioning",
    "Athlete registration or invitation",
    "Coach-athlete relationship acceptance",
    "Phase 1 declaration",
    "Programme assignment",
    "Deterministic compile path",
    "Mobile session execution",
    "Split and return",
    "Stop, skip, and partial completion",
    "Factual history",
    "Coach factual artefact view",
    "Coach notes as engine-invisible records",
    "Live session status as read-only factual visibility",
    "Proof artefact view and export boundary",
    "Controlled-launch payment path",
    "Legal document surfaces",
    "Support, status, error reporting, backup/restore evidence, and runbook checks"
  ];

  for (const phrase of requiredDocPhrases) {
    assert.ok(doc.includes(phrase), `missing founder test pack phrase: ${phrase}`);
  }
});

test("S-V1-F-01 fixture accounts are fixture-only and non-production", () => {
  const fixture = readFixture();

  assert.equal(fixture.slice_id, "S-V1-F-01");
  assert.equal(fixture.environment, "fixture_only");
  assert.equal(fixture.production_data_allowed, false);
  assert.equal(fixture.product_law_created, false);
  assert.equal(fixture.post_v1_scope_allowed, false);
  assert.equal(fixture.live_provider_calls_allowed, false);

  assert.equal(fixture.fixture_accounts.length, 4);

  const roles = new Set(fixture.fixture_accounts.map((account) => account.role));
  assert.ok(roles.has("coach"));
  assert.ok(roles.has("athlete"));

  for (const account of fixture.fixture_accounts) {
    assert.match(account.account_id, /^fixture_/);
    assert.match(account.email, /@example\.test$/);
    assert.doesNotMatch(account.email, /@kolosseum\.|@gmail\.|@hotmail\.|@outlook\./i);
    assert.ok(account.purpose.length > 10);
  }
});

test("S-V1-F-01 manual scripts use fixture references and avoid live authority", () => {
  const fixture = readFixture();
  const accountIds = new Set(fixture.fixture_accounts.map((account) => account.account_id));
  const recordIds = new Set(Object.values(fixture.fixture_records));
  const relationshipIds = new Set(fixture.fixture_relationships.map((relationship) => relationship.relationship_id));
  const allowedRefs = new Set([...accountIds, ...recordIds, ...relationshipIds]);

  assert.equal(fixture.manual_test_scripts.length, REQUIRED_COVERAGE.length);

  for (const script of fixture.manual_test_scripts) {
    assert.match(script.test_id, /^F01-\d{3}$/);
    assert.ok(REQUIRED_COVERAGE.includes(script.coverage), `unknown coverage: ${script.coverage}`);
    assert.ok(script.title.length > 5);
    assert.ok(script.expected_record.length > 15);
    assert.ok(Array.isArray(script.fixture_refs));
    assert.ok(script.fixture_refs.length >= 1);
    assert.ok(Array.isArray(script.not_allowed));
    assert.ok(script.not_allowed.length >= 3);

    for (const ref of script.fixture_refs) {
      assert.ok(allowedRefs.has(ref), `unknown fixture ref: ${ref}`);
    }
  }
});

test("S-V1-F-01 does not create product, engine, registry, or post-v1 authority", () => {
  const doc = readText(DOC_PATH);
  const fixture = readFixture();
  const combined = `${doc}\n${JSON.stringify(fixture, null, 2)}`.toLowerCase();

  const requiredBoundaries = [
    "does not create product law",
    "production data",
    "post-v1 product scope",
    "engine truth",
    "fixture-only"
  ];

  for (const phrase of requiredBoundaries) {
    assert.ok(combined.includes(phrase), `missing boundary phrase: ${phrase}`);
  }

  const forbiddenAuthorityPhrases = [
    "creates product law",
    "authorises production data access",
    "connect to production database",
    "live provider call is allowed",
    "marketplace is included",
    "team runtime is included",
    "organisation runtime is included",
    "gym runtime is included"
  ];

  for (const phrase of forbiddenAuthorityPhrases) {
    assert.ok(!combined.includes(phrase), `forbidden authority phrase present: ${phrase}`);
  }
});

test("S-V1-F-01 package proof script is wired", () => {
  const pkg = JSON.parse(readText("package.json"));
  const command = "node --test test/s_v1_f_01_founder_test_pack.test.mjs && node ci/guards/s_v1_f_01_founder_test_pack_guard.mjs";

  assert.equal(pkg.scripts["proof:s-v1-f-01"], command);
  assert.ok(pkg.scripts["lint:fast:inline"].includes(command));
  assert.ok(pkg.scripts["lint:fast"].includes(command));
});