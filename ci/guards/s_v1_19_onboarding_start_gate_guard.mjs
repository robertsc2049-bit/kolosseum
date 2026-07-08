// @law: Repo Governance
// @severity: high
// @scope: repo
/**
 * DEV NOTE: S-V1-19 Onboarding Start Gate guard.
 * Purpose: proves executable-session flow is blocked until factual account,
 * relationship, and declaration state exists.
 * Boundary: checks docs, source, target test, fixture, lint registration, and
 * upstream v1 proofs. It does not add UI, persistence, assignment, substitution,
 * proof implementation, real compile route mutation, or engine mutation.
 * Determinism: reads fixed repository files and imports deterministic modules.
 * Failure: emits CI_V1_ONBOARDING_START_GATE when the gate is missing or widened.
 */

import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const ROOT = process.cwd();
const GUARD = "S-V1-19";
const TOKEN = "CI_V1_ONBOARDING_START_GATE";

const FILES = {
  doc: "docs/v1/V1_ONBOARDING_START_GATE.md",
  releaseBoundary: "docs/v1/V1_RELEASE_BOUNDARY.md",
  acceptanceGate: "docs/v1/V1_ACCEPTANCE_GATE.md",
  notInScope: "docs/v1/V1_NOT_IN_SCOPE.md",
  authorityMap: "docs/v1/V1_DOC_AUTHORITY_MAP.md",
  engineUiAuthBoundary: "docs/roadmap/V1_ENGINE_UI_AUTH_BOUNDARY.md",
  module: "src/onboardingStartGate.mjs",
  test: "test/s_v1_19_onboarding_start_gate.test.mjs",
  fixture: "ci/fixtures/v1_onboarding_start_gate_negative/s_v1_19_onboarding_start_gate_negative.json",
  onboardingTriggerContract: "shared/pilot-lifecycle/onboardingStartGateContract.mjs",
  packageJson: "package.json"
};

const REQUIRED_DOC_MARKERS = [
  "Status: active v1 onboarding start-gate boundary document.",
  "Slice: S-V1-19.",
  "athlete account is active",
  "individual coach-athlete relationship is accepted",
  "declaration compile gate admits a current valid accepted declaration",
  "CI_V1_ONBOARDING_START_GATE",
  "No blocked reason may imply advice, judgement, safety, suitability, medical meaning, outcome quality, or action recommendation."
];

const REQUIRED_POINTERS = {
  [FILES.releaseBoundary]: [
    "S-V1-19:ONBOARDING-START-GATE:START",
    "docs/v1/V1_ONBOARDING_START_GATE.md",
    "S-V1-19 emits factual blocked reason ids only."
  ],
  [FILES.acceptanceGate]: [
    "S-V1-19:ONBOARDING-START-GATE:START",
    "missing athlete account blocks with factual reason",
    "valid path is allowed"
  ],
  [FILES.notInScope]: [
    "S-V1-19:ONBOARDING-START-GATE-NON-SCOPE:START",
    "team onboarding",
    "engine phase mutation"
  ],
  [FILES.authorityMap]: [
    "S-V1-19:ONBOARDING-START-GATE-AUTHORITY:START",
    "docs/v1/V1_ONBOARDING_START_GATE.md",
    "ci/guards/s_v1_19_onboarding_start_gate_guard.mjs"
  ],
  [FILES.engineUiAuthBoundary]: [
    "S-V1-19:ONBOARDING-START-GATE-ENGINE-AUTH-BOUNDARY:START",
    "Onboarding start-gate state is product/app validity state only.",
    "Engine output must not depend on onboarding state or blocked reasons."
  ]
};

const REQUIRED_MODULE_MARKERS = [
  "onboardingStartGateSurfaceId",
  "onboardingStartGateBlockedReasons",
  "OnboardingStartGateError",
  "resolveOnboardingStartGate",
  "assertOnboardingStartGateAllowsExecutableSessionFlow",
  "compileIgnoringOnboardingStartGate",
  "assertOnboardingStarted(input.onboarding_events)",
  "isAcceptedIndividualCoachAthleteRelationship",
  "assertPhase1DeclarationCompileGate"
];

const REQUIRED_TEST_MARKERS = [
  "S-V1-19 blocked reason registry is exact and factual",
  "S-V1-19 blocks missing onboarding trigger with factual reason",
  "S-V1-19 blocks missing athlete account with factual reason",
  "S-V1-19 blocks inactive athlete account with factual reason",
  "S-V1-19 blocks missing relationship with factual reason",
  "S-V1-19 blocks non-accepted relationship with factual reason",
  "S-V1-19 blocks missing declaration with factual reason",
  "S-V1-19 blocks superseded declaration with factual reason",
  "S-V1-19 blocks mismatched declaration hash with factual reason",
  "S-V1-19 valid path is allowed",
  "S-V1-19 product state cannot mutate engine-facing probe output"
];

const REQUIRED_BLOCKED_REASONS = [
  "onboarding_start_trigger_missing",
  "onboarding_start_trigger_invalid",
  "athlete_account_missing",
  "athlete_account_inactive",
  "coach_athlete_relationship_missing",
  "coach_athlete_relationship_not_accepted",
  "phase1_declaration_missing",
  "phase1_declaration_not_current_valid"
];

const FORBIDDEN_ACTIVE_SOURCE_MARKERS = [
  "recommendation",
  "recommended_action",
  "coaching_advice",
  "medical_clearance",
  "medical_assessment",
  "diagnosis",
  "clinical_advice",
  "safe_to_train",
  "safety_clearance",
  "suitability_clearance",
  "readiness",
  "readiness_score",
  "risk_score",
  "team_onboarding",
  "team_role",
  "organisation_role",
  "organization_role",
  "unit_role",
  "federation_role",
  "enterprise_role"
];

function fail(message, details = {}) {
  console.error(JSON.stringify({
    ok: false,
    guard: GUARD,
    token: TOKEN,
    message,
    ...details
  }, null, 2));

  process.exitCode = 1;
}

function repoPath(relPath) {
  return path.join(ROOT, relPath);
}

function readRequiredText(relPath) {
  const absPath = repoPath(relPath);

  if (!fs.existsSync(absPath)) {
    fail("Required S-V1-19 file is missing.", { path: relPath });
    return "";
  }

  return fs.readFileSync(absPath, "utf8");
}

function readRequiredJson(relPath) {
  const text = readRequiredText(relPath);

  try {
    return JSON.parse(text);
  } catch (error) {
    fail("Required S-V1-19 JSON fixture is invalid.", {
      path: relPath,
      error: String(error?.message || error)
    });
    return null;
  }
}

function assertIncludes(relPath, text, marker) {
  if (!text.includes(marker)) {
    fail("Required S-V1-19 marker is missing.", {
      path: relPath,
      marker
    });
  }
}

for (const relPath of Object.values(FILES)) {
  readRequiredText(relPath);
}

const docText = readRequiredText(FILES.doc);
for (const marker of REQUIRED_DOC_MARKERS) {
  assertIncludes(FILES.doc, docText, marker);
}

for (const [relPath, markers] of Object.entries(REQUIRED_POINTERS)) {
  const text = readRequiredText(relPath);
  for (const marker of markers) {
    assertIncludes(relPath, text, marker);
  }
}

const moduleText = readRequiredText(FILES.module);
for (const marker of REQUIRED_MODULE_MARKERS) {
  assertIncludes(FILES.module, moduleText, marker);
}

for (const marker of FORBIDDEN_ACTIVE_SOURCE_MARKERS) {
  if (moduleText.includes(marker)) {
    fail("S-V1-19 active source contains forbidden marker.", {
      path: FILES.module,
      marker
    });
  }
}

const testText = readRequiredText(FILES.test);
for (const marker of REQUIRED_TEST_MARKERS) {
  assertIncludes(FILES.test, testText, marker);
}

const onboardingTriggerText = readRequiredText(FILES.onboardingTriggerContract);
for (const marker of [
  "coach_invite_sent",
  "athlete_invite_sent",
  "link_acceptance_recorded",
  "phase1_declaration_started",
  "first_compile_attempt_started",
  "assertOnboardingStarted"
]) {
  assertIncludes(FILES.onboardingTriggerContract, onboardingTriggerText, marker);
}

const packageJsonText = readRequiredText(FILES.packageJson);
for (const command of [
  "node --test test/s_v1_19_onboarding_start_gate.test.mjs",
  "node ci/guards/s_v1_19_onboarding_start_gate_guard.mjs"
]) {
  assertIncludes(FILES.packageJson, packageJsonText, command);
}

const fixture = readRequiredJson(FILES.fixture);

if (fixture) {
  if (fixture.fixture_id !== "s_v1_19_onboarding_start_gate_negative") {
    fail("Unexpected S-V1-19 fixture id.", {
      path: FILES.fixture,
      fixture_id: fixture.fixture_id
    });
  }

  if (fixture.failure_token !== TOKEN) {
    fail("Unexpected S-V1-19 fixture failure token.", {
      path: FILES.fixture,
      failure_token: fixture.failure_token
    });
  }

  if (JSON.stringify(fixture.allowed_blocked_reasons) !== JSON.stringify(REQUIRED_BLOCKED_REASONS)) {
    fail("S-V1-19 fixture blocked reasons are not exact.", {
      path: FILES.fixture,
      allowed_blocked_reasons: fixture.allowed_blocked_reasons
    });
  }

  if (!Array.isArray(fixture.cases) || fixture.cases.length < 8) {
    fail("S-V1-19 fixture must contain blocked and valid path cases.", {
      path: FILES.fixture,
      count: Array.isArray(fixture.cases) ? fixture.cases.length : null
    });
  }
}

const moduleUrl = pathToFileURL(path.join(ROOT, FILES.module)).href;
const onboardingGate = await import(moduleUrl);

for (const exportName of [
  "resolveOnboardingStartGate",
  "assertOnboardingStartGateAllowsExecutableSessionFlow",
  "compileIgnoringOnboardingStartGate"
]) {
  if (typeof onboardingGate[exportName] !== "function") {
    fail("S-V1-19 module export is missing or not a function.", { exportName });
  }
}

if (JSON.stringify(onboardingGate.onboardingStartGateBlockedReasons) !== JSON.stringify(REQUIRED_BLOCKED_REASONS)) {
  fail("S-V1-19 module blocked reason registry is not exact.", {
    blocked_reasons: onboardingGate.onboardingStartGateBlockedReasons
  });
}

if (process.exitCode && process.exitCode !== 0) {
  throw new Error("S-V1-19 onboarding start gate guard failed.");
}

console.log(JSON.stringify({
  ok: true,
  guard: GUARD,
  token: TOKEN,
  fixture_cases_checked: fixture?.cases?.length || 0,
  message: "V1 onboarding start gate boundary passed."
}, null, 2));
