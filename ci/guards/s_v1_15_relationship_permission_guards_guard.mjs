// @law: Repo Governance
// @severity: medium
// @scope: repo
/**
 * DEV NOTE: S-V1-15 relationship permission guards guard.
 * Purpose: proves reusable coach-athlete permission guard functions fail closed,
 * report product/auth failure, and remain outside engine truth.
 * Boundary: checks the contract doc, app-source module, target test, negative
 * fixture, and lint registration. It does not implement engine behaviour,
 * registry content, broad RBAC, organisation/team/gym/federation roles,
 * database migrations, auth providers, UI, social, messaging, marketplace,
 * assignment authority, or server surface rewiring.
 * Determinism: reads fixed repository files and imports deterministic modules.
 * Failure: emits CI_V1_RELATIONSHIP_PERMISSION_GUARDS when guard scope widens.
 */

import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const ROOT = process.cwd();
const GUARD = "S-V1-15";
const TOKEN = "CI_V1_RELATIONSHIP_PERMISSION_GUARDS";

const FILES = {
  doc: "docs/v1/V1_RELATIONSHIP_PERMISSION_GUARDS.md",
  releaseBoundary: "docs/v1/V1_RELEASE_BOUNDARY.md",
  acceptanceGate: "docs/v1/V1_ACCEPTANCE_GATE.md",
  notInScope: "docs/v1/V1_NOT_IN_SCOPE.md",
  authorityMap: "docs/v1/V1_DOC_AUTHORITY_MAP.md",
  engineUiAuthBoundary: "docs/roadmap/V1_ENGINE_UI_AUTH_BOUNDARY.md",
  relationshipAcceptance: "docs/v1/V1_COACH_ATHLETE_RELATIONSHIP_ACCEPTANCE.md",
  relationshipModule: "src/coachAthleteRelationshipAcceptance.mjs",
  module: "src/relationshipPermissionGuards.mjs",
  test: "test/s_v1_15_relationship_permission_guards.test.mjs",
  fixture: "ci/fixtures/v1_relationship_permission_guards_negative/s_v1_15_relationship_permission_guard_scope_leakage.json",
  packageJson: "package.json"
};

const DOC_MARKERS = [
  "Status: active v1 relationship-permission guard boundary document.",
  "Slice: S-V1-15.",
  "assertCoachCanViewAthlete",
  "assertAthleteCanViewOwnData",
  "assertCoachAthleteAccess",
  "Permission failure is product/auth failure, not engine decision.",
  "The stable product/auth failure code is:",
  "relationship_permission_product_auth_failure",
  "The only active reusable surface ids for S-V1-15 are:",
  "coach_notes",
  "session_artefacts",
  "live_session_status",
  "factual_history",
  "S-V1-15 does not rewire those surfaces yet.",
  "If relationship permission guard data changes engine truth, this slice is invalid."
];

const POINTER_MARKERS = {
  [FILES.releaseBoundary]: [
    "S-V1-15:RELATIONSHIP-PERMISSION-GUARDS:START",
    "docs/v1/V1_RELATIONSHIP_PERMISSION_GUARDS.md",
    "Permission failure is product/auth failure, not engine decision.",
    "The guards are reusable by coach notes, factual artefact viewing, live session status, and factual history surfaces."
  ],
  [FILES.acceptanceGate]: [
    "S-V1-15:RELATIONSHIP-PERMISSION-GUARDS:START",
    "assertCoachCanViewAthlete allows assigned coach access only",
    "permission failure is product/auth failure, not engine decision",
    "permission guard state does not mutate engine truth"
  ],
  [FILES.notInScope]: [
    "S-V1-15:RELATIONSHIP-PERMISSION-GUARDS-NON-SCOPE:START",
    "broad RBAC",
    "organisation roles",
    "team roles",
    "server surface rewiring"
  ],
  [FILES.authorityMap]: [
    "S-V1-15:RELATIONSHIP-PERMISSION-GUARDS-AUTHORITY:START",
    "docs/v1/V1_RELATIONSHIP_PERMISSION_GUARDS.md",
    "ci/guards/s_v1_15_relationship_permission_guards_guard.mjs"
  ],
  [FILES.engineUiAuthBoundary]: [
    "S-V1-15:RELATIONSHIP-PERMISSION-GUARDS-ENGINE-AUTH-BOUNDARY:START",
    "Permission failure is product/auth failure, not engine decision.",
    "Engine output must not depend on permission guard result"
  ]
};

const MODULE_REQUIRED_MARKERS = [
  "RelationshipPermissionGuardError",
  "assertRelationshipPermissionInput",
  "assertCoachCanViewAthlete",
  "assertAthleteCanViewOwnData",
  "assertCoachAthleteAccess",
  "assertSurfaceCanUseRelationshipPermissionGuard",
  "compileIgnoringRelationshipPermissionGuards",
  "relationship_permission_product_auth_failure",
  "product_auth_failure: true",
  "engine_decision: false",
  "engine_visible: false",
  "coach_notes",
  "session_artefacts",
  "live_session_status",
  "factual_history"
];

const TEST_REQUIRED_MARKERS = [
  "S-V1-15 assertCoachCanViewAthlete allows assigned accepted individual relationship",
  "S-V1-15 assertCoachCanViewAthlete fails closed for unassigned coach",
  "S-V1-15 assertAthleteCanViewOwnData allows own data and rejects another athlete",
  "S-V1-15 permission failure is product auth failure not engine decision",
  "S-V1-15 permission guard state does not mutate engine truth probe output",
  "S-V1-15 copy identifiers remain factual and non-advisory"
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
  "team_role_create",
  "organisation_role_create",
  "organization_role_create",
  "gym_role_create",
  "federation_role_create",
  "broad_rbac_create",
  "social_graph_create",
  "friend_connection_create",
  "message_thread_create",
  "chat_thread_create",
  "marketplace_connection_create"
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
    fail("Required S-V1-15 file is missing.", { path: relPath });
    return "";
  }

  return fs.readFileSync(absPath, "utf8");
}

function readRequiredJson(relPath) {
  const text = readRequiredText(relPath);

  try {
    return JSON.parse(text);
  } catch (error) {
    fail("Required S-V1-15 JSON fixture is invalid.", {
      path: relPath,
      error: String(error?.message || error)
    });
    return null;
  }
}

function assertIncludes(relPath, text, marker) {
  if (!text.includes(marker)) {
    fail("Required S-V1-15 marker is missing.", {
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

const relationshipDoc = readRequiredText(FILES.relationshipAcceptance);
for (const marker of [
  "Coach can view assigned athletes only.",
  "Athlete can view own data only unless explicitly permitted.",
  "Relationship changes do not mutate engine truth."
]) {
  assertIncludes(FILES.relationshipAcceptance, relationshipDoc, marker);
}

const relationshipModuleText = readRequiredText(FILES.relationshipModule);
for (const marker of [
  "isAcceptedIndividualCoachAthleteRelationship",
  "canCoachViewAssignedAthlete",
  "canAthleteViewAthleteData",
  "compileIgnoringCoachAthleteRelationship"
]) {
  assertIncludes(FILES.relationshipModule, relationshipModuleText, marker);
}

const moduleText = readRequiredText(FILES.module);
for (const marker of MODULE_REQUIRED_MARKERS) {
  assertIncludes(FILES.module, moduleText, marker);
}

for (const marker of FORBIDDEN_MODULE_MARKERS) {
  if (moduleText.includes(marker)) {
    fail("S-V1-15 module includes a forbidden implementation marker.", {
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
  "node --test test/s_v1_15_relationship_permission_guards.test.mjs",
  "node ci/guards/s_v1_15_relationship_permission_guards_guard.mjs"
]) {
  if (!packageJsonText.includes(command)) {
    fail("S-V1-15 command must be registered in lint:fast.", { command });
  }
}

const fixture = readRequiredJson(FILES.fixture);

const moduleUrl = pathToFileURL(path.join(ROOT, FILES.module)).href;
const permissionGuards = await import(`${moduleUrl}?cacheBust=${Date.now()}`);

const requiredExports = [
  "RelationshipPermissionGuardError",
  "assertRelationshipPermissionInput",
  "assertCoachCanViewAthlete",
  "assertAthleteCanViewOwnData",
  "assertCoachAthleteAccess",
  "assertSurfaceCanUseRelationshipPermissionGuard",
  "canCoachAthleteAccess",
  "compileIgnoringRelationshipPermissionGuards",
  "denyRelationshipPermission"
];

for (const exportName of requiredExports) {
  if (typeof permissionGuards[exportName] !== "function") {
    fail("S-V1-15 module export is missing or not a function.", { exportName });
  }
}

const acceptedRelationship = {
  relationship_id: "relationship_001",
  coach_user_id: "coach_001",
  athlete_user_id: "athlete_001",
  relationship_state: "accepted",
  relationship_scope: "individual_coach_athlete",
  accepted_at_iso8601: "2026-06-13T13:00:00.000Z",
  created_at_iso8601: "2026-06-13T12:00:00.000Z",
  updated_at_iso8601: "2026-06-13T13:00:00.000Z",
  revoked_at_iso8601: null,
  expires_at_iso8601: null
};

for (const surfaceId of ["coach_notes", "session_artefacts", "live_session_status", "factual_history"]) {
  permissionGuards.assertSurfaceCanUseRelationshipPermissionGuard(surfaceId);
}

try {
  permissionGuards.assertSurfaceCanUseRelationshipPermissionGuard("team_dashboard");
  fail("Unknown surface id did not fail closed.");
} catch (error) {
  if (!(error instanceof permissionGuards.RelationshipPermissionGuardError)) {
    fail("Unknown surface did not throw RelationshipPermissionGuardError.");
  }
}

permissionGuards.assertCoachCanViewAthlete({
  coach_user_id: "coach_001",
  athlete_user_id: "athlete_001",
  surface_id: "coach_notes",
  relationships: [acceptedRelationship]
});

for (const badInput of [
  {
    coach_user_id: "coach_002",
    athlete_user_id: "athlete_001",
    surface_id: "coach_notes",
    relationships: [acceptedRelationship]
  },
  {
    coach_user_id: "coach_001",
    athlete_user_id: "athlete_001",
    surface_id: "coach_notes",
    relationships: []
  },
  {
    coach_user_id: "coach_001",
    athlete_user_id: "athlete_001",
    surface_id: "team_dashboard",
    relationships: [acceptedRelationship]
  }
]) {
  try {
    permissionGuards.assertCoachCanViewAthlete(badInput);
    fail("Invalid coach access input did not fail closed.", { badInput });
  } catch (error) {
    if (!(error instanceof permissionGuards.RelationshipPermissionGuardError)) {
      fail("Invalid coach access threw unexpected error type.", {
        error: String(error?.message || error)
      });
    }

    if (error.engine_decision !== false || error.engine_visible !== false || error.product_auth_failure !== true) {
      fail("Permission failure must be product/auth failure, not engine decision.", {
        reason: error.reason
      });
    }
  }
}

permissionGuards.assertAthleteCanViewOwnData({
  requester_athlete_user_id: "athlete_001",
  target_athlete_user_id: "athlete_001",
  surface_id: "factual_history"
});

try {
  permissionGuards.assertAthleteCanViewOwnData({
    requester_athlete_user_id: "athlete_001",
    target_athlete_user_id: "athlete_002",
    surface_id: "factual_history"
  });
  fail("Athlete other-data access did not fail closed.");
} catch (error) {
  if (!(error instanceof permissionGuards.RelationshipPermissionGuardError)) {
    fail("Athlete other-data access threw unexpected error type.");
  }
}

if (fixture) {
  if (fixture.fixture_id !== "s_v1_15_relationship_permission_guard_scope_leakage") {
    fail("Unexpected S-V1-15 fixture id.", {
      path: FILES.fixture,
      fixture_id: fixture.fixture_id
    });
  }

  if (fixture.slice !== "S-V1-15") {
    fail("Unexpected S-V1-15 fixture slice.", {
      path: FILES.fixture,
      slice: fixture.slice
    });
  }

  if (!Array.isArray(fixture.cases) || fixture.cases.length < 12) {
    fail("S-V1-15 fixture must contain positive and negative permission guard cases.", {
      path: FILES.fixture,
      count: Array.isArray(fixture.cases) ? fixture.cases.length : null
    });
  } else {
    for (const testCase of fixture.cases) {
      const decision = permissionGuards.canCoachAthleteAccess(testCase.input);
      const actualOk = decision.allowed === true;

      if (actualOk !== testCase.expected_ok) {
        fail("S-V1-15 fixture expectation failed.", {
          path: FILES.fixture,
          case_id: testCase.case_id,
          expected_ok: testCase.expected_ok,
          actual_ok: actualOk,
          decision
        });
      }

      if (!actualOk && testCase.expected_token !== TOKEN) {
        fail("S-V1-15 negative fixture must expect the stable token.", {
          path: FILES.fixture,
          case_id: testCase.case_id,
          expected_token: testCase.expected_token
        });
      }

      if (!actualOk && (decision.engine_decision !== false || decision.engine_visible !== false || decision.product_auth_failure !== true)) {
        fail("S-V1-15 negative fixture did not produce product/auth failure boundary.", {
          path: FILES.fixture,
          case_id: testCase.case_id,
          decision
        });
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

const allowed = permissionGuards.canCoachAthleteAccess({
  actor: {
    actor_type: "coach",
    user_id: "coach_001"
  },
  target_athlete_user_id: "athlete_001",
  surface_id: "coach_notes",
  relationships: [acceptedRelationship]
});

const denied = permissionGuards.canCoachAthleteAccess({
  actor: {
    actor_type: "coach",
    user_id: "coach_002"
  },
  target_athlete_user_id: "athlete_001",
  surface_id: "coach_notes",
  relationships: [acceptedRelationship]
});

const beforeCompile = permissionGuards.compileIgnoringRelationshipPermissionGuards(phaseLikeInput, [allowed]);
const afterCompile = permissionGuards.compileIgnoringRelationshipPermissionGuards(phaseLikeInput, [denied]);

if (beforeCompile !== afterCompile) {
  fail("Relationship permission guard state changed engine truth probe output.", {
    beforeCompile,
    afterCompile
  });
}

if (process.exitCode && process.exitCode !== 0) {
  throw new Error("S-V1-15 relationship permission guards guard failed.");
}

console.log(JSON.stringify({
  ok: true,
  guard: GUARD,
  token: TOKEN,
  fixture_cases_checked: fixture?.cases?.length || 0,
  message: "V1 relationship permission guards boundary passed."
}, null, 2));
