// @law: Repo Governance
// @severity: medium
// @scope: repo
/*
 * DEV NOTE: S-V1-F-01 founder test pack guard.
 * Purpose: proves the controlled-launch founder manual test pack exists, is
 * fixture-only, and does not become product law or production-data authority.
 * Boundary: docs, fixture accounts, tests, and package wiring only.
 * Failure behaviour: fails closed on missing coverage, live authority language,
 * production account leakage, or missing proof wiring.
 */
import fs from "node:fs";

const TOKEN = "CI_V1_FOUNDER_TEST_PACK";

const DOC_PATH = "docs/v1/V1_FOUNDER_TEST_PACK.md";
const FIXTURE_PATH = "ci/fixtures/v1_founder_test_pack/s_v1_f_01_founder_fixture_accounts.json";
const TEST_PATH = "test/s_v1_f_01_founder_test_pack.test.mjs";
const PACKAGE_PATH = "package.json";

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

const REQUIRED_DOC_PHRASES = [
  "S-V1-F-01 creates the founder test pack for controlled v1 launch.",
  "The pack is evidence for founder testing only. It does not create product law.",
  "The pack does not authorise production data access.",
  "The pack does not add post-v1 product scope.",
  "Fixture accounts must use non-production identifiers and non-routable example domains.",
  "Manual test observations must not be treated as product law",
  "Coach registration or provisioning.",
  "Athlete registration or invitation.",
  "Coach-athlete relationship acceptance.",
  "Phase 1 declaration.",
  "Programme assignment.",
  "Deterministic compile path.",
  "Mobile session execution.",
  "Split and return.",
  "Stop, skip, and partial completion.",
  "Factual history.",
  "Coach factual artefact view.",
  "Coach notes as engine-invisible records.",
  "Live session status as read-only factual visibility.",
  "Proof artefact view and export boundary.",
  "Controlled-launch payment path.",
  "Legal document surfaces.",
  "Support, status, error reporting, backup/restore evidence, and runbook checks."
];

const FORBIDDEN_DOC_PHRASES = [
  "authorises production data access",
  "creates product law",
  "creates engine law",
  "creates registry law",
  "live provider call is allowed",
  "team runtime is included",
  "organisation runtime is included",
  "gym runtime is included",
  "marketplace is included",
  "messaging is included"
];

function readText(path) {
  if (!fs.existsSync(path)) {
    throw new Error(`S-V1-F-01 missing required file: ${path}`);
  }
  return fs.readFileSync(path, "utf8");
}

function readJson(path) {
  return JSON.parse(readText(path));
}

function fail(message, details = {}) {
  const error = new Error(message);
  error.details = details;
  throw error;
}

function assertContains(text, phrase, path) {
  if (!text.includes(phrase)) {
    fail("S-V1-F-01 required phrase missing.", { path, phrase });
  }
}

function assertNotContains(text, phrase, path) {
  if (text.toLowerCase().includes(phrase.toLowerCase())) {
    fail("S-V1-F-01 forbidden phrase present.", { path, phrase });
  }
}

function validateDoc() {
  const doc = readText(DOC_PATH);

  for (const phrase of REQUIRED_DOC_PHRASES) {
    assertContains(doc, phrase, DOC_PATH);
  }

  for (const phrase of FORBIDDEN_DOC_PHRASES) {
    assertNotContains(doc, phrase, DOC_PATH);
  }

  return doc;
}

function validateFixture() {
  const fixture = readJson(FIXTURE_PATH);

  if (fixture.slice_id !== "S-V1-F-01") {
    fail("S-V1-F-01 fixture slice id mismatch.", { value: fixture.slice_id });
  }

  if (fixture.environment !== "fixture_only") {
    fail("S-V1-F-01 fixture environment must be fixture_only.", { value: fixture.environment });
  }

  for (const [key, expected] of Object.entries({
    production_data_allowed: false,
    product_law_created: false,
    post_v1_scope_allowed: false,
    live_provider_calls_allowed: false
  })) {
    if (fixture[key] !== expected) {
      fail("S-V1-F-01 fixture boundary flag mismatch.", { key, value: fixture[key], expected });
    }
  }

  if (JSON.stringify(fixture.required_coverage) !== JSON.stringify(REQUIRED_COVERAGE)) {
    fail("S-V1-F-01 fixture required coverage must match the locked coverage list.", {
      actual: fixture.required_coverage,
      expected: REQUIRED_COVERAGE
    });
  }

  const accounts = Array.isArray(fixture.fixture_accounts) ? fixture.fixture_accounts : [];
  if (accounts.length < 4) {
    fail("S-V1-F-01 fixture must include at least four fixture accounts.");
  }

  const roles = new Set(accounts.map((account) => account.role));
  if (!roles.has("coach") || !roles.has("athlete")) {
    fail("S-V1-F-01 fixture must include coach and athlete accounts.", { roles: [...roles] });
  }

  for (const account of accounts) {
    if (!String(account.account_id || "").startsWith("fixture_")) {
      fail("S-V1-F-01 account id must be fixture-prefixed.", { account });
    }

    if (!String(account.email || "").endsWith("@example.test")) {
      fail("S-V1-F-01 account email must use example.test.", { account });
    }

    if (/@(gmail|hotmail|outlook|kolosseum)\./i.test(String(account.email || ""))) {
      fail("S-V1-F-01 fixture account appears to use a real or product email domain.", { account });
    }
  }

  const scripts = Array.isArray(fixture.manual_test_scripts) ? fixture.manual_test_scripts : [];
  if (scripts.length !== REQUIRED_COVERAGE.length) {
    fail("S-V1-F-01 manual test script count must match coverage count.", {
      scripts: scripts.length,
      coverage: REQUIRED_COVERAGE.length
    });
  }

  const scriptCoverage = new Set(scripts.map((script) => script.coverage));
  for (const coverage of REQUIRED_COVERAGE) {
    if (!scriptCoverage.has(coverage)) {
      fail("S-V1-F-01 manual test script missing required coverage.", { coverage });
    }
  }

  const allowedRefs = new Set([
    ...accounts.map((account) => account.account_id),
    ...(fixture.fixture_relationships || []).map((relationship) => relationship.relationship_id),
    ...Object.values(fixture.fixture_records || {})
  ]);

  for (const script of scripts) {
    if (!/^F01-\d{3}$/.test(String(script.test_id || ""))) {
      fail("S-V1-F-01 manual test id must use F01-nnn format.", { script });
    }

    if (!Array.isArray(script.fixture_refs) || script.fixture_refs.length === 0) {
      fail("S-V1-F-01 manual test must name fixture refs.", { script });
    }

    for (const ref of script.fixture_refs) {
      if (!allowedRefs.has(ref)) {
        fail("S-V1-F-01 manual test references unknown fixture id.", { ref, test_id: script.test_id });
      }
    }

    if (!Array.isArray(script.not_allowed) || script.not_allowed.length < 3) {
      fail("S-V1-F-01 manual test must name at least three non-scope constraints.", { script });
    }
  }

  return fixture;
}

function validatePackage() {
  const pkg = readJson(PACKAGE_PATH);
  const command = "node --test test/s_v1_f_01_founder_test_pack.test.mjs && node ci/guards/s_v1_f_01_founder_test_pack_guard.mjs";

  if (pkg.scripts?.["proof:s-v1-f-01"] !== command) {
    fail("S-V1-F-01 package proof script missing or mismatched.", {
      actual: pkg.scripts?.["proof:s-v1-f-01"],
      expected: command
    });
  }

  for (const scriptName of ["lint:fast:inline", "lint:fast"]) {
    if (!String(pkg.scripts?.[scriptName] || "").includes(command)) {
      fail("S-V1-F-01 command missing from package script.", { scriptName, command });
    }
  }
}

function validateTestFile() {
  const testText = readText(TEST_PATH);

  for (const coverage of REQUIRED_COVERAGE) {
    assertContains(testText, coverage, TEST_PATH);
  }

  assertContains(testText, "does not create product law", TEST_PATH);
  assertContains(testText, "production_data_allowed", TEST_PATH);
  assertContains(testText, "post_v1_scope_allowed", TEST_PATH);
}

validateDoc();
validateFixture();
validatePackage();
validateTestFile();

console.log(JSON.stringify({
  ok: true,
  guard: "S-V1-F-01",
  token: TOKEN,
  coverage_checked: REQUIRED_COVERAGE.length,
  message: "Founder test pack remains fixture-only manual controlled-launch evidence."
}, null, 2));
