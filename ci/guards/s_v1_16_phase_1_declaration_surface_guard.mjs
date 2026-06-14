// @law: Repo Governance
// @severity: medium
// @scope: repo
/**
 * DEV NOTE: S-V1-16 Phase 1 declaration surface guard.
 * Purpose: proves factual user-declared declaration surface behaviour while
 * preserving existing Phase 1 acceptance proof and engine boundary.
 * Boundary: checks docs, app-source module, target test, negative fixture,
 * existing Phase 1 record suite, and lint registration. It does not implement
 * engine behaviour, persistence, UI, auth providers, registry content, scoring,
 * assignment authority, or proof implementation.
 * Determinism: reads fixed repository files and imports one deterministic module.
 * Failure: emits CI_V1_PHASE_1_DECLARATION_SURFACE when declaration scope widens.
 */

import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const ROOT = process.cwd();
const GUARD = "S-V1-16";
const TOKEN = "CI_V1_PHASE_1_DECLARATION_SURFACE";

const FILES = {
  doc: "docs/v1/V1_PHASE_1_DECLARATION_SURFACE.md",
  releaseBoundary: "docs/v1/V1_RELEASE_BOUNDARY.md",
  acceptanceGate: "docs/v1/V1_ACCEPTANCE_GATE.md",
  notInScope: "docs/v1/V1_NOT_IN_SCOPE.md",
  authorityMap: "docs/v1/V1_DOC_AUTHORITY_MAP.md",
  engineUiAuthBoundary: "docs/roadmap/V1_ENGINE_UI_AUTH_BOUNDARY.md",
  accountBoundary: "docs/v1/V1_ACCOUNT_MODEL_BOUNDARY.md",
  relationshipPermissions: "docs/v1/V1_RELATIONSHIP_PERMISSION_GUARDS.md",
  phase1SuiteScript: "ci/scripts/run_phase1_acceptance_record_tests.mjs",
  phase1SuiteData: "docs/v0/phase1_acceptance_record_tests.json",
  module: "src/phase1DeclarationSurface.mjs",
  test: "test/s_v1_16_phase_1_declaration_surface.test.mjs",
  fixture: "ci/fixtures/v1_phase_1_declaration_surface_negative/s_v1_16_phase_1_declaration_scope_leakage.json",
  packageJson: "package.json"
};

const DOC_MARKERS = [
  "Status: active v1 Phase 1 declaration-surface boundary document.",
  "Slice: S-V1-16.",
  "records factual user-declared Phase 1 declaration state before compile admission",
  "Unknown top-level fields fail closed.",
  "Unknown payload fields fail closed.",
  "The declaration is not an assessment.",
  "The declaration is not advice.",
  "The declaration is not a clearance.",
  "The declaration is not a readiness score.",
  "S-V1-16 does not alter the deterministic engine.",
  "assertPhase1DeclarationAcceptedBeforeCompile",
  "The existing Phase 1 acceptance record test suite remains the current proof",
  "If declaration state changes engine truth, this slice is invalid."
];

const POINTER_MARKERS = {
  [FILES.releaseBoundary]: [
    "S-V1-16:PHASE-1-DECLARATION-SURFACE:START",
    "docs/v1/V1_PHASE_1_DECLARATION_SURFACE.md",
    "Unknown top-level fields and unknown declaration payload fields fail closed.",
    "Declaration copy must not imply medical advice"
  ],
  [FILES.acceptanceGate]: [
    "S-V1-16:PHASE-1-DECLARATION-SURFACE:START",
    "valid declaration input is accepted",
    "missing required payload fields are rejected",
    "copy remains factual and claim-safe",
    "the existing Phase 1 acceptance record suite remains green"
  ],
  [FILES.notInScope]: [
    "S-V1-16:PHASE-1-DECLARATION-SURFACE-NON-SCOPE:START",
    "medical assessment",
    "diagnosis",
    "safety clearance",
    "suitability clearance",
    "readiness scoring",
    "recommendation"
  ],
  [FILES.authorityMap]: [
    "S-V1-16:PHASE-1-DECLARATION-SURFACE-AUTHORITY:START",
    "docs/v1/V1_PHASE_1_DECLARATION_SURFACE.md",
    "ci/guards/s_v1_16_phase_1_declaration_surface_guard.mjs",
    "ci/scripts/run_phase1_acceptance_record_tests.mjs"
  ],
  [FILES.engineUiAuthBoundary]: [
    "S-V1-16:PHASE-1-DECLARATION-SURFACE-ENGINE-AUTH-BOUNDARY:START",
    "Phase 1 declaration surface state is factual product/app state",
    "Engine output must not depend on declaration form copy"
  ]
};

const MODULE_REQUIRED_MARKERS = [
  "phase1DeclarationSurfaceId",
  "validatePhase1DeclarationInput",
  "createPhase1DeclarationRecord",
  "assertPhase1DeclarationAcceptedBeforeCompile",
  "compileIgnoringPhase1DeclarationSurface",
  "user_declared_factual_state: true",
  "product_declaration_state_only: true",
  "engine_visible: false",
  "phase1_declaration_unknown_field_refused",
  "phase1_declaration_payload_unknown_field_refused",
  "phase1_declaration_payload_consent_not_declared",
  "phase1_declaration_payload_jurisdiction_not_declared"
];

const TEST_REQUIRED_MARKERS = [
  "S-V1-16 accepts valid factual user-declared Phase 1 declaration",
  "S-V1-16 rejects missing required top-level fields",
  "S-V1-16 rejects missing required payload fields",
  "S-V1-16 rejects unknown top-level and payload fields",
  "S-V1-16 rejects forbidden authority fields and treats non-scope fields as unknown input",
  "S-V1-16 declaration state does not mutate engine truth probe output",
  "S-V1-16 declaration copy remains factual and claim-safe"
];

const FORBIDDEN_MODULE_MARKERS = [
  "from \"../engine",
  "from \"./engine",
  "from \"../server",
  "from \"./server",
  "from \"../shared",
  "from \"./shared",
  "Date.now",
  "crypto.randomUUID",
  "fetch(",
  "process.env",
  "stripe",
  "password",
  "session_token",
  "assessment_result_create",
  "clearance_create",
  "readiness_score_create",
  "recommendation_create",
  "diagnosis_create"
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
    fail("Required S-V1-16 file is missing.", { path: relPath });
    return "";
  }

  return fs.readFileSync(absPath, "utf8");
}

function readRequiredJson(relPath) {
  const text = readRequiredText(relPath);

  try {
    return JSON.parse(text);
  } catch (error) {
    fail("Required S-V1-16 JSON fixture is invalid.", {
      path: relPath,
      error: String(error?.message || error)
    });
    return null;
  }
}

function assertIncludes(relPath, text, marker) {
  if (!text.includes(marker)) {
    fail("Required S-V1-16 marker is missing.", {
      path: relPath,
      marker
    });
  }
}

for (const relPath of Object.values(FILES)) {
  readRequiredText(relPath);
}

const docText = readRequiredText(FILES.doc);
for (const marker of DOC_MARKERS) {
  assertIncludes(FILES.doc, docText, marker);
}

for (const [relPath, markers] of Object.entries(POINTER_MARKERS)) {
  const text = readRequiredText(relPath);
  for (const marker of markers) {
    assertIncludes(relPath, text, marker);
  }
}

const accountDoc = readRequiredText(FILES.accountBoundary);
for (const marker of [
  "V1 supports coach and athlete only.",
  "Account state must not alter engine truth."
]) {
  assertIncludes(FILES.accountBoundary, accountDoc, marker);
}

const permissionDoc = readRequiredText(FILES.relationshipPermissions);
for (const marker of [
  "Permission failure is product/auth failure, not engine decision.",
  "If relationship permission guard data changes engine truth, this slice is invalid."
]) {
  assertIncludes(FILES.relationshipPermissions, permissionDoc, marker);
}

const phase1SuiteScriptText = readRequiredText(FILES.phase1SuiteScript);
assertIncludes(
  FILES.phase1SuiteScript,
  phase1SuiteScriptText,
  "phase1_acceptance_record_tests.json"
);

const phase1SuiteDataText = readRequiredText(FILES.phase1SuiteData);
for (const marker of [
  "valid_declaration_can_be_accepted_and_hashed",
  "unknown_payload_field_refused",
  "missing_required_payload_field_refused",
  "compile_refuses_missing_declaration",
  "compile_allows_current_valid_declaration"
]) {
  assertIncludes(FILES.phase1SuiteData, phase1SuiteDataText, marker);
}

const moduleText = readRequiredText(FILES.module);
for (const marker of MODULE_REQUIRED_MARKERS) {
  assertIncludes(FILES.module, moduleText, marker);
}

for (const marker of FORBIDDEN_MODULE_MARKERS) {
  if (moduleText.includes(marker)) {
    fail("S-V1-16 module includes a forbidden implementation marker.", {
      path: FILES.module,
      marker
    });
  }
}

const testText = readRequiredText(FILES.test);
for (const marker of TEST_REQUIRED_MARKERS) {
  assertIncludes(FILES.test, testText, marker);
}

const packageJsonText = readRequiredText(FILES.packageJson);
for (const command of [
  "node --test test/s_v1_16_phase_1_declaration_surface.test.mjs",
  "node ci/guards/s_v1_16_phase_1_declaration_surface_guard.mjs",
  "node ci/scripts/run_phase1_acceptance_record_tests.mjs"
]) {
  if (!packageJsonText.includes(command)) {
    fail("S-V1-16 command or required existing Phase 1 suite must be registered in lint:fast.", { command });
  }
}

const fixture = readRequiredJson(FILES.fixture);

const moduleUrl = pathToFileURL(path.join(ROOT, FILES.module)).href;
const declarationSurface = await import(`${moduleUrl}?cacheBust=${Date.now()}`);

const requiredExports = [
  "validatePhase1DeclarationInput",
  "createPhase1DeclarationRecord",
  "assertPhase1DeclarationAcceptedBeforeCompile",
  "compileIgnoringPhase1DeclarationSurface",
  "stablePhase1DeclarationJson",
  "phase1DeclarationSha256"
];

for (const exportName of requiredExports) {
  if (typeof declarationSurface[exportName] !== "function") {
    fail("S-V1-16 module export is missing or not a function.", { exportName });
  }
}

if (fixture) {
  if (fixture.fixture_id !== "s_v1_16_phase_1_declaration_scope_leakage") {
    fail("Unexpected S-V1-16 fixture id.", {
      path: FILES.fixture,
      fixture_id: fixture.fixture_id
    });
  }

  if (fixture.slice !== "S-V1-16") {
    fail("Unexpected S-V1-16 fixture slice.", {
      path: FILES.fixture,
      slice: fixture.slice
    });
  }

  if (!Array.isArray(fixture.cases) || fixture.cases.length < 9) {
    fail("S-V1-16 fixture must contain positive and negative declaration cases.", {
      path: FILES.fixture,
      count: Array.isArray(fixture.cases) ? fixture.cases.length : null
    });
  } else {
    for (const testCase of fixture.cases) {
      const result = declarationSurface.createPhase1DeclarationRecord(testCase.input);
      const actualOk = result.status === 201 && result.body?.ok === true;

      if (actualOk !== testCase.expected_ok) {
        fail("S-V1-16 fixture expectation failed.", {
          path: FILES.fixture,
          case_id: testCase.case_id,
          expected_ok: testCase.expected_ok,
          actual_ok: actualOk,
          result
        });
      }

      if (!actualOk && testCase.expected_token !== TOKEN) {
        fail("S-V1-16 negative fixture must expect the stable token.", {
          path: FILES.fixture,
          case_id: testCase.case_id,
          expected_token: testCase.expected_token
        });
      }

      if (!actualOk && (result.body?.product_declaration_state_only !== true || result.body?.engine_visible !== false)) {
        fail("S-V1-16 negative fixture did not preserve product declaration boundary.", {
          path: FILES.fixture,
          case_id: testCase.case_id,
          result
        });
      }
    }
  }
}

const accepted = declarationSurface.createPhase1DeclarationRecord({
  declaration_id: "declaration_guard_001",
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
  declared_at_iso8601: "2026-06-13T12:00:00.000Z",
  accepted_terms_version: "terms_v1",
  copy_acknowledgement_id: "PHASE_1_DECLARATION_USER_DECLARED_FACTUAL"
});

if (accepted.status !== 201 || accepted.body?.declaration?.user_declared_factual_state !== true) {
  fail("S-V1-16 accepted declaration guard probe failed.", {
    result: accepted
  });
}

declarationSurface.assertPhase1DeclarationAcceptedBeforeCompile(accepted.body.declaration);

const phaseLikeInput = {
  actor_type: "individual_user",
  execution_scope: "individual",
  activity_id: "powerlifting",
  consent_granted: true,
  jurisdiction_acknowledged: true
};

const beforeCompile = declarationSurface.compileIgnoringPhase1DeclarationSurface(phaseLikeInput, [accepted.body.declaration]);
const afterCompile = declarationSurface.compileIgnoringPhase1DeclarationSurface(phaseLikeInput, [{
  ...accepted.body.declaration,
  declaration_state: "rejected"
}]);

if (beforeCompile !== afterCompile) {
  fail("S-V1-16 declaration surface changed engine truth probe output.", {
    beforeCompile,
    afterCompile
  });
}

const copyJoined = [
  ...declarationSurface.phase1DeclarationCopyIds,
  ...Object.values(declarationSurface.phase1DeclarationCopyText)
].join(" ").toLowerCase();

for (const forbidden of [
  "medical",
  "diagnosis",
  "assessment",
  "clearance",
  "safe",
  "safety",
  "suitable",
  "suitability",
  "readiness",
  "risk",
  "recommend",
  "recommended",
  "optimal",
  "score",
  "approved",
  "advice"
]) {
  if (copyJoined.includes(forbidden)) {
    fail("S-V1-16 declaration copy leaked forbidden wording.", {
      forbidden
    });
  }
}

if (process.exitCode && process.exitCode !== 0) {
  throw new Error("S-V1-16 Phase 1 declaration surface guard failed.");
}

console.log(JSON.stringify({
  ok: true,
  guard: GUARD,
  token: TOKEN,
  fixture_cases_checked: fixture?.cases?.length || 0,
  message: "V1 Phase 1 declaration surface boundary passed."
}, null, 2));
