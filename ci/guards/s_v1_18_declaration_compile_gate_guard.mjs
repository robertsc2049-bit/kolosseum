// @law: Repo Governance
// @severity: high
// @scope: repo
/**
 * DEV NOTE: S-V1-18 Declaration Compile Gate guard.
 * Purpose: proves compile admission is bound to current valid accepted declaration
 * records and that product-only state cannot alter engine-facing compile truth.
 * Boundary: checks docs, source, target test, fixture, lint registration, and
 * the existing Phase 1 proof suite. It does not mutate the real compile route,
 * engine phases, persistence, UI, assignment, substitution, or proof surfaces.
 * Determinism: reads fixed repository files and imports one deterministic module.
 * Failure: emits CI_V1_DECLARATION_COMPILE_GATE when the gate is missing or widened.
 */

import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const ROOT = process.cwd();
const GUARD = "S-V1-18";
const TOKEN = "CI_V1_DECLARATION_COMPILE_GATE";

const FILES = {
  doc: "docs/v1/V1_DECLARATION_COMPILE_GATE.md",
  acceptanceRecordDoc: "docs/v1/V1_DECLARATION_ACCEPTANCE_RECORD.md",
  surfaceDoc: "docs/v1/V1_PHASE_1_DECLARATION_SURFACE.md",
  releaseBoundary: "docs/v1/V1_RELEASE_BOUNDARY.md",
  acceptanceGate: "docs/v1/V1_ACCEPTANCE_GATE.md",
  notInScope: "docs/v1/V1_NOT_IN_SCOPE.md",
  authorityMap: "docs/v1/V1_DOC_AUTHORITY_MAP.md",
  engineUiAuthBoundary: "docs/roadmap/V1_ENGINE_UI_AUTH_BOUNDARY.md",
  module: "src/phase1DeclarationSurface.mjs",
  test: "test/s_v1_18_declaration_compile_gate.test.mjs",
  fixture: "ci/fixtures/v1_declaration_compile_gate_negative/s_v1_18_declaration_compile_gate_negative.json",
  phase1SuiteScript: "ci/scripts/run_phase1_acceptance_record_tests.mjs",
  phase1SuiteData: "docs/v0/phase1_acceptance_record_tests.json",
  packageJson: "package.json"
};

const REQUIRED_DOC_MARKERS = [
  "Status: active v1 declaration compile-gate boundary document.",
  "Slice: S-V1-18.",
  "Compile admission must require a current valid accepted declaration record.",
  "CI_V1_DECLARATION_COMPILE_GATE",
  "compile gate refuses missing declaration",
  "compile gate refuses superseded declaration",
  "compile gate allows current valid accepted declaration"
];

const REQUIRED_POINTERS = {
  [FILES.acceptanceRecordDoc]: [
    "S-V1-18:DECLARATION-COMPILE-GATE:START",
    "docs/v1/V1_DECLARATION_COMPILE_GATE.md",
    "S-V1-18 reuses `assertPhase1DeclarationAcceptedBeforeCompile`"
  ],
  [FILES.surfaceDoc]: [
    "S-V1-18:DECLARATION-COMPILE-GATE:START",
    "docs/v1/V1_DECLARATION_COMPILE_GATE.md",
    "The gate does not run engine phases and does not change engine output."
  ],
  [FILES.releaseBoundary]: [
    "S-V1-18:DECLARATION-COMPILE-GATE:START",
    "missing, unaccepted, superseded, mismatched, or invalid accepted declaration records"
  ],
  [FILES.acceptanceGate]: [
    "S-V1-18:DECLARATION-COMPILE-GATE:START",
    "missing declaration fails closed",
    "product state cannot alter compile probe output"
  ],
  [FILES.notInScope]: [
    "S-V1-18:DECLARATION-COMPILE-GATE-NON-SCOPE:START",
    "real compile route mutation",
    "payment implementation"
  ],
  [FILES.authorityMap]: [
    "S-V1-18:DECLARATION-COMPILE-GATE-AUTHORITY:START",
    "docs/v1/V1_DECLARATION_COMPILE_GATE.md",
    "ci/guards/s_v1_18_declaration_compile_gate_guard.mjs"
  ],
  [FILES.engineUiAuthBoundary]: [
    "S-V1-18:DECLARATION-COMPILE-GATE-ENGINE-AUTH-BOUNDARY:START",
    "Declaration compile-gate state is product/app validity state",
    "Engine output must not depend on declaration source metadata"
  ]
};

const REQUIRED_MODULE_MARKERS = [
  "phase1DeclarationCompileGateSurfaceId",
  "phase1_declaration_compile_gate_input_invalid",
  "phase1_declaration_compile_gate_phase_input_invalid",
  "assertPhase1DeclarationCompileGate",
  "assertPhase1DeclarationAcceptedBeforeCompile(input.declaration_record)",
  "compileIgnoringPhase1DeclarationSurface("
];

const REQUIRED_TEST_MARKERS = [
  "S-V1-18 compile gate refuses missing declaration",
  "S-V1-18 compile gate refuses unaccepted declaration",
  "S-V1-18 compile gate refuses superseded declaration",
  "S-V1-18 compile gate refuses hash mismatch",
  "S-V1-18 compile gate refuses invalid accepted declaration metadata",
  "S-V1-18 compile gate allows current valid declaration",
  "S-V1-18 product state cannot mutate declaration truth or compile probe output"
];

const FORBIDDEN_ACTIVE_SOURCE_MARKERS = [
  "medical_assessment",
  "diagnosis",
  "clinical_advice",
  "safety_clearance",
  "suitability_clearance",
  "readiness_score",
  "risk_score",
  "return_to_play_clearance",
  "fit_for_duty_status",
  "recommendation",
  "recommended_action",
  "readiness",
  "ranking",
  "dashboard",
  "coach_notes",
  "coachNotes",
  "billing",
  "payment",
  "subscription",
  "presentation_state",
  "ui_state"
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
    fail("Required S-V1-18 file is missing.", { path: relPath });
    return "";
  }

  return fs.readFileSync(absPath, "utf8");
}

function readRequiredJson(relPath) {
  const text = readRequiredText(relPath);

  try {
    return JSON.parse(text);
  } catch (error) {
    fail("Required S-V1-18 JSON fixture is invalid.", {
      path: relPath,
      error: String(error?.message || error)
    });
    return null;
  }
}

function assertIncludes(relPath, text, marker) {
  if (!text.includes(marker)) {
    fail("Required S-V1-18 marker is missing.", {
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
    fail("S-V1-18 active source contains forbidden product-state or v0-scope marker.", {
      path: FILES.module,
      marker
    });
  }
}

const testText = readRequiredText(FILES.test);
for (const marker of REQUIRED_TEST_MARKERS) {
  assertIncludes(FILES.test, testText, marker);
}

const phase1SuiteDataText = readRequiredText(FILES.phase1SuiteData);
for (const marker of [
  "compile_refuses_missing_declaration",
  "compile_refuses_superseded_declaration",
  "compile_refuses_hash_mismatch",
  "compile_allows_current_valid_declaration",
  "payment_coach_and_presentation_state_do_not_mutate_record"
]) {
  assertIncludes(FILES.phase1SuiteData, phase1SuiteDataText, marker);
}

const packageJsonText = readRequiredText(FILES.packageJson);
for (const command of [
  "node --test test/s_v1_18_declaration_compile_gate.test.mjs",
  "node ci/guards/s_v1_18_declaration_compile_gate_guard.mjs"
]) {
  assertIncludes(FILES.packageJson, packageJsonText, command);
}

const fixture = readRequiredJson(FILES.fixture);

const moduleUrl = pathToFileURL(path.join(ROOT, FILES.module)).href;
const declarationSurface = await import(moduleUrl);

const requiredExports = [
  "assertPhase1DeclarationCompileGate",
  "createPhase1DeclarationRecord",
  "supersedeAcceptedDeclarationRecord"
];

for (const exportName of requiredExports) {
  if (typeof declarationSurface[exportName] !== "function") {
    fail("S-V1-18 module export is missing or not a function.", { exportName });
  }
}

const validInput = {
  declaration_id: "declaration_guard_v1_18_001",
  declared_by_user_id: "user_001",
  subject_user_id: "user_001",
  declaration_source: "user_declared",
  declaration_scope: "phase1_compile_prerequisite",
  declaration_state: "accepted",
  declaration_payload: {
    actor_type: "individual_user",
    execution_scope: "individual",
    activity_id: "powerlifting",
    phase1_schema_version: "1.0.0",
    engine_compatibility: "EB2-1.0.0",
    enum_bundle_version: "EB2-1.0.0",
    consent_granted: true,
    jurisdiction_acknowledged: true
  },
  declared_at_iso8601: "2026-06-14T12:00:00.000Z",
  accepted_terms_version: "terms_v1",
  copy_acknowledgement_id: "PHASE_1_DECLARATION_USER_DECLARED_FACTUAL"
};

const phaseLikeInput = {
  actor_type: "individual_user",
  execution_scope: "individual",
  activity_id: "powerlifting",
  consent_granted: true,
  jurisdiction_acknowledged: true
};

const accepted = declarationSurface.createPhase1DeclarationRecord(validInput);

if (accepted.status !== 201) {
  fail("S-V1-18 accepted record guard probe failed.", { accepted });
} else {
  const record = accepted.body.declaration;

  const allowed = declarationSurface.assertPhase1DeclarationCompileGate({
    phase_like_input: phaseLikeInput,
    declaration_record: record
  });

  if (allowed.ok !== true || allowed.compile_admission !== "declaration_current_valid") {
    fail("S-V1-18 current valid declaration was not admitted.", { allowed });
  }

  try {
    declarationSurface.assertPhase1DeclarationCompileGate({
      phase_like_input: phaseLikeInput,
      declaration_record: null
    });
    fail("S-V1-18 missing declaration unexpectedly passed compile gate.");
  } catch (error) {
    if (error?.code !== "phase1_declaration_required_before_compile") {
      fail("S-V1-18 missing declaration emitted wrong error.", { code: error?.code });
    }
  }

  const superseded = declarationSurface.supersedeAcceptedDeclarationRecord(record, "2026-06-15T12:00:00.000Z");

  try {
    declarationSurface.assertPhase1DeclarationCompileGate({
      phase_like_input: phaseLikeInput,
      declaration_record: superseded
    });
    fail("S-V1-18 superseded declaration unexpectedly passed compile gate.");
  } catch (error) {
    if (error?.code !== "phase1_declaration_superseded") {
      fail("S-V1-18 superseded declaration emitted wrong error.", { code: error?.code });
    }
  }

  try {
    declarationSurface.assertPhase1DeclarationCompileGate({
      phase_like_input: phaseLikeInput,
      declaration_record: {
        ...record,
        declaration_payload_sha256: "0".repeat(64)
      }
    });
    fail("S-V1-18 hash mismatch unexpectedly passed compile gate.");
  } catch (error) {
    if (error?.code !== "phase1_declaration_hash_mismatch") {
      fail("S-V1-18 hash mismatch emitted wrong error.", { code: error?.code });
    }
  }

  const stateA = { payment_state: "paid", coach_notes: "a", presentation_state: "compact" };
  const stateB = { payment_state: "failed", coach_notes: "b", presentation_state: "detailed" };

  const first = declarationSurface.assertPhase1DeclarationCompileGate({
    phase_like_input: phaseLikeInput,
    declaration_record: record,
    external_product_state: stateA
  });

  const second = declarationSurface.assertPhase1DeclarationCompileGate({
    phase_like_input: phaseLikeInput,
    declaration_record: record,
    external_product_state: stateB
  });

  if (first.compile_probe_output !== second.compile_probe_output) {
    fail("S-V1-18 product state changed compile probe output.", {
      first: first.compile_probe_output,
      second: second.compile_probe_output
    });
  }

  if (first.declaration_payload_sha256 !== second.declaration_payload_sha256) {
    fail("S-V1-18 product state changed declaration hash.");
  }
}

if (fixture) {
  if (fixture.fixture_id !== "s_v1_18_declaration_compile_gate_negative") {
    fail("Unexpected S-V1-18 fixture id.", {
      path: FILES.fixture,
      fixture_id: fixture.fixture_id
    });
  }

  if (fixture.failure_token !== TOKEN) {
    fail("Unexpected S-V1-18 fixture failure token.", {
      path: FILES.fixture,
      failure_token: fixture.failure_token
    });
  }

  if (!Array.isArray(fixture.cases) || fixture.cases.length < 7) {
    fail("S-V1-18 fixture must contain compile-gate positive and negative cases.", {
      path: FILES.fixture,
      count: Array.isArray(fixture.cases) ? fixture.cases.length : null
    });
  }
}

if (process.exitCode && process.exitCode !== 0) {
  throw new Error("S-V1-18 declaration compile gate guard failed.");
}

console.log(JSON.stringify({
  ok: true,
  guard: GUARD,
  token: TOKEN,
  fixture_cases_checked: fixture?.cases?.length || 0,
  message: "V1 declaration compile gate boundary passed."
}, null, 2));
