// @law: Repo Governance
// @severity: medium
// @scope: repo
/**
 * DEV NOTE: S-V1-12 coach registration/provisioning guard.
 * Purpose: proves the coach registration/provisioning path is product/auth state
 * only and cannot affect deterministic compile output.
 * Boundary: checks the contract doc, app-source module, target test, negative
 * fixture, and lint registration. It does not implement auth providers,
 * database migrations, payment, UI, marketplace, discovery, or engine behaviour.
 * Determinism: reads fixed repository files and imports one deterministic module.
 * Failure: emits CI_V1_COACH_REGISTRATION_PROVISIONING when the path widens.
 */

import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const ROOT = process.cwd();
const GUARD = "S-V1-12";
const TOKEN = "CI_V1_COACH_REGISTRATION_PROVISIONING";

const FILES = {
  doc: "docs/v1/V1_COACH_REGISTRATION_PROVISIONING.md",
  releaseBoundary: "docs/v1/V1_RELEASE_BOUNDARY.md",
  acceptanceGate: "docs/v1/V1_ACCEPTANCE_GATE.md",
  notInScope: "docs/v1/V1_NOT_IN_SCOPE.md",
  authorityMap: "docs/v1/V1_DOC_AUTHORITY_MAP.md",
  engineUiAuthBoundary: "docs/roadmap/V1_ENGINE_UI_AUTH_BOUNDARY.md",
  accountBoundary: "docs/v1/V1_ACCOUNT_MODEL_BOUNDARY.md",
  module: "src/coachRegistrationProvisioning.mjs",
  test: "test/s_v1_12_coach_registration_provisioning.test.mjs",
  fixture: "ci/fixtures/v1_coach_registration_provisioning_negative/s_v1_12_coach_registration_scope_leakage.json",
  packageJson: "package.json"
};

const DOC_MARKERS = [
  "Status: active v1 provisioning-boundary document.",
  "Slice: S-V1-12.",
  "The only valid account_role is coach.",
  "Coach identity is product/auth state only.",
  "Coach registration cannot affect deterministic compile output.",
  "product_auth_state_only = true",
  "engine_visible = false",
  "Copy remains factual.",
  "If the actor is not a coach, this path refuses the request.",
  "If coach registration data changes deterministic compile output, this slice is invalid."
];

const POINTER_MARKERS = {
  [FILES.releaseBoundary]: [
    "S-V1-12:COACH-REGISTRATION-PROVISIONING:START",
    "docs/v1/V1_COACH_REGISTRATION_PROVISIONING.md",
    "Coach registration cannot affect deterministic compile output."
  ],
  [FILES.acceptanceGate]: [
    "S-V1-12:COACH-REGISTRATION-ACCEPTANCE:START",
    "coach identity can be provisioned with account_role = coach",
    "copy remains factual"
  ],
  [FILES.notInScope]: [
    "S-V1-12:COACH-REGISTRATION-NON-SCOPE:START",
    "enterprise account management",
    "coach discovery",
    "marketplace"
  ],
  [FILES.authorityMap]: [
    "S-V1-12:COACH-REGISTRATION-AUTHORITY:START",
    "docs/v1/V1_COACH_REGISTRATION_PROVISIONING.md",
    "ci/guards/s_v1_12_coach_registration_provisioning_guard.mjs"
  ],
  [FILES.engineUiAuthBoundary]: [
    "S-V1-12:COACH-REGISTRATION-ENGINE-AUTH-BOUNDARY:START",
    "Coach registration/provisioning is product/auth state only.",
    "Engine output must not depend on coach identity"
  ]
};

const MODULE_REQUIRED_MARKERS = [
  "coachRegistrationProvisioningSurfaceId",
  "validateCoachRegistrationProvisioningInput",
  "createCoachRegistrationProvisioningRecord",
  "compileIgnoringCoachRegistrationProvisioning",
  "product_auth_state_only: true",
  "engine_visible: false",
  "coach_registration_role_not_coach",
  "coach_registration_engine_visible_field_refused"
];

const TEST_REQUIRED_MARKERS = [
  "S-V1-12 provisions coach identity as product auth state only",
  "S-V1-12 refuses non-coach account roles",
  "S-V1-12 refuses engine-visible registration fields",
  "S-V1-12 coach identity changes do not affect deterministic compile output",
  "S-V1-12 copy identifiers remain factual and non-advisory"
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
  "session_token"
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
    fail("Required S-V1-12 file is missing.", { path: relPath });
    return "";
  }

  return fs.readFileSync(absPath, "utf8");
}

function readRequiredJson(relPath) {
  const text = readRequiredText(relPath);

  try {
    return JSON.parse(text);
  } catch (error) {
    fail("Required S-V1-12 JSON fixture is invalid.", {
      path: relPath,
      error: String(error?.message || error)
    });
    return null;
  }
}

function assertIncludes(relPath, text, marker) {
  if (!text.includes(marker)) {
    fail("Required S-V1-12 marker is missing.", {
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
  "Account state must not alter engine truth.",
  "The active v1 account roles are exactly:"
]) {
  assertIncludes(FILES.accountBoundary, accountDoc, marker);
}

const moduleText = readRequiredText(FILES.module);
for (const marker of MODULE_REQUIRED_MARKERS) {
  assertIncludes(FILES.module, moduleText, marker);
}

for (const marker of FORBIDDEN_MODULE_MARKERS) {
  if (moduleText.includes(marker)) {
    fail("S-V1-12 module includes a forbidden implementation marker.", {
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
  "node --test test/s_v1_12_coach_registration_provisioning.test.mjs",
  "node ci/guards/s_v1_12_coach_registration_provisioning_guard.mjs"
]) {
  if (!packageJsonText.includes(command)) {
    fail("S-V1-12 command must be registered in lint:fast.", { command });
  }
}

const fixture = readRequiredJson(FILES.fixture);

const moduleUrl = pathToFileURL(path.join(ROOT, FILES.module)).href;
const provisioning = await import(`${moduleUrl}?cacheBust=${Date.now()}`);

const requiredExports = [
  "validateCoachRegistrationProvisioningInput",
  "createCoachRegistrationProvisioningRecord",
  "compileIgnoringCoachRegistrationProvisioning",
  "stableCoachProvisioningJson"
];

for (const exportName of requiredExports) {
  if (typeof provisioning[exportName] !== "function") {
    fail("S-V1-12 module export is missing or not a function.", { exportName });
  }
}

if (fixture) {
  if (fixture.fixture_id !== "s_v1_12_coach_registration_scope_leakage") {
    fail("Unexpected S-V1-12 fixture id.", {
      path: FILES.fixture,
      fixture_id: fixture.fixture_id
    });
  }

  if (fixture.slice !== "S-V1-12") {
    fail("Unexpected S-V1-12 fixture slice.", {
      path: FILES.fixture,
      slice: fixture.slice
    });
  }

  if (!Array.isArray(fixture.cases) || fixture.cases.length < 8) {
    fail("S-V1-12 fixture must contain positive and negative coach registration cases.", {
      path: FILES.fixture,
      count: Array.isArray(fixture.cases) ? fixture.cases.length : null
    });
  } else {
    for (const testCase of fixture.cases) {
      const result = provisioning.createCoachRegistrationProvisioningRecord(testCase.input);
      const actualOk = result.status === 201 && result.body?.ok === true;

      if (actualOk !== testCase.expected_ok) {
        fail("S-V1-12 fixture expectation failed.", {
          path: FILES.fixture,
          case_id: testCase.case_id,
          expected_ok: testCase.expected_ok,
          actual_ok: actualOk,
          result
        });
      }

      if (!actualOk && testCase.expected_token !== TOKEN) {
        fail("S-V1-12 negative fixture must expect the stable token.", {
          path: FILES.fixture,
          case_id: testCase.case_id,
          expected_token: testCase.expected_token
        });
      }

      if (actualOk) {
        if (result.body.coach.account_role !== "coach") {
          fail("S-V1-12 positive fixture did not produce coach role.", {
            case_id: testCase.case_id
          });
        }

        if (result.body.coach.product_auth_state_only !== true || result.body.coach.engine_visible !== false) {
          fail("S-V1-12 positive fixture produced engine-visible coach state.", {
            case_id: testCase.case_id
          });
        }
      }
    }
  }
}

const phaseLikeInput = {
  actor_type: "coach",
  execution_scope: "coach_managed",
  activity_id: "powerlifting",
  consent_granted: true,
  governing_authority_id: "coach_001",
  subject_id: "athlete_001"
};

const firstCoach = provisioning.createCoachRegistrationProvisioningRecord({
  coach_user_id: "coach_001",
  email: "coach.one@example.com",
  display_name: "Coach One",
  account_role: "coach",
  account_state: "invited",
  accepted_terms_version: "terms_v1",
  created_at_iso8601: "2026-06-13T12:00:00.000Z"
});

const secondCoach = provisioning.createCoachRegistrationProvisioningRecord({
  coach_user_id: "coach_002",
  email: "coach.two@example.com",
  display_name: "Coach Two",
  account_role: "coach",
  account_state: "active",
  accepted_terms_version: "terms_v2",
  created_at_iso8601: "2026-06-13T13:00:00.000Z"
});

const firstCompile = provisioning.compileIgnoringCoachRegistrationProvisioning(phaseLikeInput, [firstCoach.body.coach]);
const secondCompile = provisioning.compileIgnoringCoachRegistrationProvisioning(phaseLikeInput, [secondCoach.body.coach]);

if (firstCompile !== secondCompile) {
  fail("Coach registration/provisioning changed deterministic compile probe output.", {
    firstCompile,
    secondCompile
  });
}

if (process.exitCode && process.exitCode !== 0) {
  throw new Error("S-V1-12 coach registration/provisioning guard failed.");
}

console.log(JSON.stringify({
  ok: true,
  guard: GUARD,
  token: TOKEN,
  fixture_cases_checked: fixture?.cases?.length || 0,
  message: "V1 coach registration/provisioning boundary passed."
}, null, 2));
