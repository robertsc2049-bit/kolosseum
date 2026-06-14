// @law: Repo Governance
// @severity: medium
// @scope: repo
/**
 * DEV NOTE: S-V1-17 Declaration Acceptance Record guard.
 * Purpose: proves accepted declaration records carry deterministic hash/source
 * metadata, preserve immutable identity, and remain inside the existing Phase 1
 * declaration validity contract.
 * Boundary: checks docs, source, target test, fixture, lint registration, and
 * the existing Phase 1 acceptance record suite. It does not add engine phases,
 * persistence, UI, assignment authority, or a second declaration system.
 * Determinism: reads fixed repository files and imports one deterministic module.
 * Failure: emits CI_V1_DECLARATION_ACCEPTANCE_RECORD when record scope widens.
 */

import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const ROOT = process.cwd();
const GUARD = "S-V1-17";
const TOKEN = "CI_V1_DECLARATION_ACCEPTANCE_RECORD";

const FILES = {
  doc: "docs/v1/V1_DECLARATION_ACCEPTANCE_RECORD.md",
  surfaceDoc: "docs/v1/V1_PHASE_1_DECLARATION_SURFACE.md",
  releaseBoundary: "docs/v1/V1_RELEASE_BOUNDARY.md",
  acceptanceGate: "docs/v1/V1_ACCEPTANCE_GATE.md",
  notInScope: "docs/v1/V1_NOT_IN_SCOPE.md",
  authorityMap: "docs/v1/V1_DOC_AUTHORITY_MAP.md",
  engineUiAuthBoundary: "docs/roadmap/V1_ENGINE_UI_AUTH_BOUNDARY.md",
  module: "src/phase1DeclarationSurface.mjs",
  test: "test/s_v1_17_declaration_acceptance_record.test.mjs",
  fixture: "ci/fixtures/v1_declaration_acceptance_record_negative/s_v1_17_declaration_acceptance_record_negative.json",
  phase1SuiteScript: "ci/scripts/run_phase1_acceptance_record_tests.mjs",
  phase1SuiteData: "docs/v0/phase1_acceptance_record_tests.json",
  packageJson: "package.json"
};

const REQUIRED_DOC_MARKERS = [
  "Status: active v1 acceptance-record boundary document.",
  "Slice: S-V1-17.",
  "deterministic hash metadata",
  "factual source metadata",
  "The only allowed lifecycle change is setting `superseded_at_iso8601`",
  "Compile-admission validity is a contract check only.",
  "the existing Phase 1 acceptance record suite remains green"
];

const REQUIRED_POINTERS = {
  [FILES.surfaceDoc]: [
    "S-V1-17:DECLARATION-ACCEPTANCE-RECORD:START",
    "docs/v1/V1_DECLARATION_ACCEPTANCE_RECORD.md",
    "S-V1-17 does not create a second declaration system."
  ],
  [FILES.releaseBoundary]: [
    "S-V1-17:DECLARATION-ACCEPTANCE-RECORD:START",
    "deterministic hash metadata",
    "factual source metadata"
  ],
  [FILES.acceptanceGate]: [
    "S-V1-17:DECLARATION-ACCEPTANCE-RECORD:START",
    "immutable accepted fields cannot be changed",
    "superseded records fail compile-admission precondition",
    "hash mismatch fails closed"
  ],
  [FILES.notInScope]: [
    "S-V1-17:DECLARATION-ACCEPTANCE-RECORD-NON-SCOPE:START",
    "a second declaration system",
    "engine output changes",
    "database persistence"
  ],
  [FILES.authorityMap]: [
    "S-V1-17:DECLARATION-ACCEPTANCE-RECORD-AUTHORITY:START",
    "docs/v1/V1_DECLARATION_ACCEPTANCE_RECORD.md",
    "ci/guards/s_v1_17_declaration_acceptance_record_guard.mjs"
  ],
  [FILES.engineUiAuthBoundary]: [
    "S-V1-17:DECLARATION-ACCEPTANCE-RECORD-ENGINE-AUTH-BOUNDARY:START",
    "Accepted declaration record metadata is product/app validity metadata",
    "Engine output must not depend on source metadata"
  ]
};

const REQUIRED_MODULE_MARKERS = [
  "phase1AcceptedDeclarationRecordVersion",
  "phase1AcceptedDeclarationImmutableFields",
  "makeAcceptedDeclarationHashMetadata",
  "makeAcceptedDeclarationSourceMetadata",
  "accepted_declaration_record: true",
  "hash_metadata: makeAcceptedDeclarationHashMetadata",
  "source_metadata: makeAcceptedDeclarationSourceMetadata",
  "assertAcceptedDeclarationRecordIntegrity",
  "assertAcceptedDeclarationRecordImmutable",
  "supersedeAcceptedDeclarationRecord",
  "assertAcceptedDeclarationRecordIntegrity(record);"
];

const REQUIRED_TEST_MARKERS = [
  "S-V1-17 creates accepted declaration record with hash and source metadata",
  "S-V1-17 accepted declaration record freezes direct record and nested metadata",
  "S-V1-17 immutable accepted fields cannot change by candidate replacement",
  "S-V1-17 supersession preserves payload hash and source metadata",
  "S-V1-17 superseded declaration cannot pass compile-admission precondition",
  "S-V1-17 hash mismatch fails closed through compile-admission precondition and integrity check",
  "S-V1-17 hash metadata mismatch fails closed",
  "S-V1-17 source metadata mismatch fails closed"
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
  "dashboard"
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
    fail("Required S-V1-17 file is missing.", { path: relPath });
    return "";
  }

  return fs.readFileSync(absPath, "utf8");
}

function readRequiredJson(relPath) {
  const text = readRequiredText(relPath);

  try {
    return JSON.parse(text);
  } catch (error) {
    fail("Required S-V1-17 JSON fixture is invalid.", {
      path: relPath,
      error: String(error?.message || error)
    });
    return null;
  }
}

function assertIncludes(relPath, text, marker) {
  if (!text.includes(marker)) {
    fail("Required S-V1-17 marker is missing.", {
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
    fail("S-V1-17 active source contains forbidden v0-scope marker.", {
      path: FILES.module,
      marker
    });
  }
}

const testText = readRequiredText(FILES.test);
for (const marker of REQUIRED_TEST_MARKERS) {
  assertIncludes(FILES.test, testText, marker);
}

const phase1SuiteScriptText = readRequiredText(FILES.phase1SuiteScript);
assertIncludes(
  FILES.phase1SuiteScript,
  phase1SuiteScriptText,
  "phase1_acceptance_record_tests.json"
);

const phase1SuiteDataText = readRequiredText(FILES.phase1SuiteData);
for (const marker of [
  "accepted_record_cannot_mutate_payload",
  "accepted_record_can_be_superseded_once",
  "compile_refuses_superseded_declaration",
  "compile_refuses_hash_mismatch",
  "compile_allows_current_valid_declaration"
]) {
  assertIncludes(FILES.phase1SuiteData, phase1SuiteDataText, marker);
}

const packageJsonText = readRequiredText(FILES.packageJson);
for (const command of [
  "node --test test/s_v1_17_declaration_acceptance_record.test.mjs",
  "node ci/guards/s_v1_17_declaration_acceptance_record_guard.mjs"
]) {
  assertIncludes(FILES.packageJson, packageJsonText, command);
}

const fixture = readRequiredJson(FILES.fixture);

const moduleUrl = pathToFileURL(path.join(ROOT, FILES.module)).href;
const declarationSurface = await import(moduleUrl);

const requiredExports = [
  "assertAcceptedDeclarationRecordIntegrity",
  "assertAcceptedDeclarationRecordImmutable",
  "supersedeAcceptedDeclarationRecord",
  "createPhase1DeclarationRecord",
  "assertPhase1DeclarationAcceptedBeforeCompile",
  "phase1DeclarationSha256"
];

for (const exportName of requiredExports) {
  if (typeof declarationSurface[exportName] !== "function") {
    fail("S-V1-17 module export is missing or not a function.", { exportName });
  }
}

const validInput = {
  declaration_id: "declaration_guard_v1_17_001",
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

const accepted = declarationSurface.createPhase1DeclarationRecord(validInput);

if (accepted.status !== 201 || accepted.body?.declaration?.accepted_declaration_record !== true) {
  fail("S-V1-17 accepted record guard probe failed.", { accepted });
} else {
  const record = accepted.body.declaration;

  declarationSurface.assertAcceptedDeclarationRecordIntegrity(record);
  declarationSurface.assertAcceptedDeclarationRecordImmutable(record, { ...record });
  declarationSurface.assertPhase1DeclarationAcceptedBeforeCompile(record);

  const superseded = declarationSurface.supersedeAcceptedDeclarationRecord(record, "2026-06-15T12:00:00.000Z");

  try {
    declarationSurface.assertPhase1DeclarationAcceptedBeforeCompile(superseded);
    fail("S-V1-17 superseded record unexpectedly passed compile-admission precondition.");
  } catch (error) {
    if (error?.code !== "phase1_declaration_superseded") {
      fail("S-V1-17 superseded record emitted wrong error.", {
        code: error?.code
      });
    }
  }

  try {
    declarationSurface.assertAcceptedDeclarationRecordIntegrity({
      ...record,
      declaration_payload_sha256: "0".repeat(64)
    });
    fail("S-V1-17 hash mismatch unexpectedly passed integrity check.");
  } catch (error) {
    if (error?.code !== "phase1_declaration_hash_mismatch") {
      fail("S-V1-17 hash mismatch emitted wrong error.", {
        code: error?.code
      });
    }
  }
}

if (fixture) {
  if (fixture.fixture_id !== "s_v1_17_declaration_acceptance_record_negative") {
    fail("Unexpected S-V1-17 fixture id.", {
      path: FILES.fixture,
      fixture_id: fixture.fixture_id
    });
  }

  if (fixture.slice !== "S-V1-17") {
    fail("Unexpected S-V1-17 fixture slice.", {
      path: FILES.fixture,
      slice: fixture.slice
    });
  }

  if (!Array.isArray(fixture.cases) || fixture.cases.length < 5) {
    fail("S-V1-17 fixture must contain positive and negative acceptance-record cases.", {
      path: FILES.fixture,
      count: Array.isArray(fixture.cases) ? fixture.cases.length : null
    });
  }
}

if (process.exitCode && process.exitCode !== 0) {
  throw new Error("S-V1-17 declaration acceptance record guard failed.");
}

console.log(JSON.stringify({
  ok: true,
  guard: GUARD,
  token: TOKEN,
  fixture_cases_checked: fixture?.cases?.length || 0,
  message: "V1 declaration acceptance record boundary passed."
}, null, 2));
