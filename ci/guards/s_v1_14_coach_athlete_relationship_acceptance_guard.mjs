// @law: Repo Governance
// @severity: medium
// @scope: repo
/**
 * DEV NOTE: S-V1-14 coach-athlete relationship acceptance guard.
 * Purpose: proves explicit individual relationship acceptance gates assigned-only
 * coach visibility and athlete own-data visibility without mutating engine truth.
 * Boundary: checks the contract doc, app-source module, target test, negative
 * fixture, and lint registration. It does not implement auth providers,
 * database migrations, payment, UI, teams, organisations, gyms, federations,
 * social connections, messaging, marketplace, assignment authority, or engine behaviour.
 * Determinism: reads fixed repository files and imports one deterministic module.
 * Failure: emits CI_V1_COACH_ATHLETE_RELATIONSHIP_ACCEPTANCE when relationship scope widens.
 */

import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const ROOT = process.cwd();
const GUARD = "S-V1-14";
const TOKEN = "CI_V1_COACH_ATHLETE_RELATIONSHIP_ACCEPTANCE";

const FILES = {
  doc: "docs/v1/V1_COACH_ATHLETE_RELATIONSHIP_ACCEPTANCE.md",
  releaseBoundary: "docs/v1/V1_RELEASE_BOUNDARY.md",
  acceptanceGate: "docs/v1/V1_ACCEPTANCE_GATE.md",
  notInScope: "docs/v1/V1_NOT_IN_SCOPE.md",
  authorityMap: "docs/v1/V1_DOC_AUTHORITY_MAP.md",
  engineUiAuthBoundary: "docs/roadmap/V1_ENGINE_UI_AUTH_BOUNDARY.md",
  accountBoundary: "docs/v1/V1_ACCOUNT_MODEL_BOUNDARY.md",
  coachProvisioning: "docs/v1/V1_COACH_REGISTRATION_PROVISIONING.md",
  athleteInvitation: "docs/v1/V1_ATHLETE_REGISTRATION_INVITATION.md",
  module: "src/coachAthleteRelationshipAcceptance.mjs",
  test: "test/s_v1_14_coach_athlete_relationship_acceptance.test.mjs",
  fixture: "ci/fixtures/v1_coach_athlete_relationship_acceptance_negative/s_v1_14_relationship_scope_leakage.json",
  packageJson: "package.json"
};

const DOC_MARKERS = [
  "Status: active v1 coach-athlete relationship acceptance boundary document.",
  "Slice: S-V1-14.",
  "Coach can view assigned athletes only.",
  "Athlete can view own data only unless explicitly permitted.",
  "Relationship changes do not mutate engine truth.",
  "Accepted athlete invitation is not enough by itself.",
  "Accepted relationship state is required.",
  "The only valid relationship_scope is individual_coach_athlete.",
  "product_permission_state_only = true",
  "engine_visible = false",
  "If a coach is not assigned to an athlete through an accepted individual coach-athlete relationship, coach access is refused.",
  "If an athlete is not viewing their own data, athlete access is refused.",
  "If relationship data changes engine truth, this slice is invalid."
];

const POINTER_MARKERS = {
  [FILES.releaseBoundary]: [
    "S-V1-14:COACH-ATHLETE-RELATIONSHIP-ACCEPTANCE:START",
    "docs/v1/V1_COACH_ATHLETE_RELATIONSHIP_ACCEPTANCE.md",
    "Coach can view assigned athletes only.",
    "Relationship changes do not mutate engine truth."
  ],
  [FILES.acceptanceGate]: [
    "S-V1-14:COACH-ATHLETE-RELATIONSHIP-ACCEPTANCE:START",
    "accepted individual coach-athlete relationship allows assigned coach visibility",
    "unassigned coach access is refused",
    "athlete can view own data"
  ],
  [FILES.notInScope]: [
    "S-V1-14:COACH-ATHLETE-RELATIONSHIP-NON-SCOPE:START",
    "teams",
    "organisations",
    "organizations",
    "friends",
    "social connections",
    "messaging",
    "chat"
  ],
  [FILES.authorityMap]: [
    "S-V1-14:COACH-ATHLETE-RELATIONSHIP-AUTHORITY:START",
    "docs/v1/V1_COACH_ATHLETE_RELATIONSHIP_ACCEPTANCE.md",
    "ci/guards/s_v1_14_coach_athlete_relationship_acceptance_guard.mjs"
  ],
  [FILES.engineUiAuthBoundary]: [
    "S-V1-14:COACH-ATHLETE-RELATIONSHIP-ENGINE-AUTH-BOUNDARY:START",
    "Coach-athlete relationship acceptance is product permission state only.",
    "Engine output must not depend on relationship_id"
  ]
};

const MODULE_REQUIRED_MARKERS = [
  "coachAthleteRelationshipAcceptanceSurfaceId",
  "validateCoachAthleteRelationshipInput",
  "createCoachAthleteRelationshipRecord",
  "isAcceptedIndividualCoachAthleteRelationship",
  "canCoachViewAssignedAthlete",
  "canAthleteViewAthleteData",
  "decideCoachAthleteRelationshipAccess",
  "compileIgnoringCoachAthleteRelationship",
  "product_permission_state_only: true",
  "engine_visible: false",
  "coach_athlete_relationship_scope_invalid",
  "coach_athlete_relationship_engine_or_scope_field_refused"
];

const TEST_REQUIRED_MARKERS = [
  "S-V1-14 assigned coach can view assigned athlete only",
  "S-V1-14 unassigned coach access is rejected",
  "S-V1-14 athlete can view own data only",
  "S-V1-14 refuses forbidden relationship scopes",
  "S-V1-14 relationship changes do not mutate engine truth probe output",
  "S-V1-14 copy identifiers remain factual and non-advisory"
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
  "team_relationship_create",
  "organisation_relationship_create",
  "organization_relationship_create",
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
    fail("Required S-V1-14 file is missing.", { path: relPath });
    return "";
  }

  return fs.readFileSync(absPath, "utf8");
}

function readRequiredJson(relPath) {
  const text = readRequiredText(relPath);

  try {
    return JSON.parse(text);
  } catch (error) {
    fail("Required S-V1-14 JSON fixture is invalid.", {
      path: relPath,
      error: String(error?.message || error)
    });
    return null;
  }
}

function assertIncludes(relPath, text, marker) {
  if (!text.includes(marker)) {
    fail("Required S-V1-14 marker is missing.", {
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

const coachDoc = readRequiredText(FILES.coachProvisioning);
for (const marker of [
  "Coach identity is product/auth state only.",
  "Coach registration cannot affect deterministic compile output."
]) {
  assertIncludes(FILES.coachProvisioning, coachDoc, marker);
}

const athleteDoc = readRequiredText(FILES.athleteInvitation);
for (const marker of [
  "Athlete identity is product/auth state only.",
  "Accepted invitations in S-V1-13 still do not create a coach-athlete relationship."
]) {
  assertIncludes(FILES.athleteInvitation, athleteDoc, marker);
}

const moduleText = readRequiredText(FILES.module);
for (const marker of MODULE_REQUIRED_MARKERS) {
  assertIncludes(FILES.module, moduleText, marker);
}

for (const marker of FORBIDDEN_MODULE_MARKERS) {
  if (moduleText.includes(marker)) {
    fail("S-V1-14 module includes a forbidden implementation marker.", {
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
  "node --test test/s_v1_14_coach_athlete_relationship_acceptance.test.mjs",
  "node ci/guards/s_v1_14_coach_athlete_relationship_acceptance_guard.mjs"
]) {
  if (!packageJsonText.includes(command)) {
    fail("S-V1-14 command must be registered in lint:fast.", { command });
  }
}

const fixture = readRequiredJson(FILES.fixture);

const moduleUrl = pathToFileURL(path.join(ROOT, FILES.module)).href;
const relationship = await import(`${moduleUrl}?cacheBust=${Date.now()}`);

const requiredExports = [
  "validateCoachAthleteRelationshipInput",
  "createCoachAthleteRelationshipRecord",
  "isAcceptedIndividualCoachAthleteRelationship",
  "canCoachViewAssignedAthlete",
  "canAthleteViewAthleteData",
  "decideCoachAthleteRelationshipAccess",
  "compileIgnoringCoachAthleteRelationship",
  "stableCoachAthleteRelationshipJson"
];

for (const exportName of requiredExports) {
  if (typeof relationship[exportName] !== "function") {
    fail("S-V1-14 module export is missing or not a function.", { exportName });
  }
}

const validRelationshipInput = {
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

const acceptedRecord = relationship.createCoachAthleteRelationshipRecord(validRelationshipInput);

if (acceptedRecord.status !== 201 || acceptedRecord.body?.relationship?.engine_visible !== false) {
  fail("S-V1-14 accepted relationship did not produce product permission state only.");
}

const assignedDecision = relationship.decideCoachAthleteRelationshipAccess({
  actor: {
    actor_type: "coach",
    user_id: "coach_001"
  },
  target_athlete_user_id: "athlete_001",
  relationships: [acceptedRecord.body.relationship]
});

if (assignedDecision.allowed !== true) {
  fail("Assigned coach visibility was not granted for accepted individual relationship.", {
    decision: assignedDecision
  });
}

const unassignedDecision = relationship.decideCoachAthleteRelationshipAccess({
  actor: {
    actor_type: "coach",
    user_id: "coach_002"
  },
  target_athlete_user_id: "athlete_001",
  relationships: [acceptedRecord.body.relationship]
});

if (unassignedDecision.allowed !== false) {
  fail("Unassigned coach visibility was granted.", {
    decision: unassignedDecision
  });
}

const ownDataDecision = relationship.decideCoachAthleteRelationshipAccess({
  actor: {
    actor_type: "athlete",
    user_id: "athlete_001"
  },
  target_athlete_user_id: "athlete_001",
  relationships: [acceptedRecord.body.relationship]
});

if (ownDataDecision.allowed !== true) {
  fail("Athlete own-data visibility was not granted.", {
    decision: ownDataDecision
  });
}

const otherDataDecision = relationship.decideCoachAthleteRelationshipAccess({
  actor: {
    actor_type: "athlete",
    user_id: "athlete_001"
  },
  target_athlete_user_id: "athlete_002",
  relationships: [acceptedRecord.body.relationship]
});

if (otherDataDecision.allowed !== false) {
  fail("Athlete was allowed to view another athlete's data.", {
    decision: otherDataDecision
  });
}

if (fixture) {
  if (fixture.fixture_id !== "s_v1_14_relationship_scope_leakage") {
    fail("Unexpected S-V1-14 fixture id.", {
      path: FILES.fixture,
      fixture_id: fixture.fixture_id
    });
  }

  if (fixture.slice !== "S-V1-14") {
    fail("Unexpected S-V1-14 fixture slice.", {
      path: FILES.fixture,
      slice: fixture.slice
    });
  }

  if (!Array.isArray(fixture.cases) || fixture.cases.length < 10) {
    fail("S-V1-14 fixture must contain positive and negative relationship cases.", {
      path: FILES.fixture,
      count: Array.isArray(fixture.cases) ? fixture.cases.length : null
    });
  } else {
    for (const testCase of fixture.cases) {
      let actualOk;

      if (testCase.case_type === "access") {
        const decision = relationship.decideCoachAthleteRelationshipAccess({
          actor: testCase.actor,
          target_athlete_user_id: testCase.target_athlete_user_id,
          relationships: [acceptedRecord.body.relationship]
        });

        actualOk = decision.allowed === true;
      } else {
        const result = relationship.createCoachAthleteRelationshipRecord(testCase.input);
        actualOk = result.status === 201 && result.body?.ok === true;

        if (actualOk && result.body.relationship.engine_visible !== false) {
          fail("S-V1-14 positive relationship fixture produced engine-visible state.", {
            case_id: testCase.case_id
          });
        }
      }

      if (actualOk !== testCase.expected_ok) {
        fail("S-V1-14 fixture expectation failed.", {
          path: FILES.fixture,
          case_id: testCase.case_id,
          expected_ok: testCase.expected_ok,
          actual_ok: actualOk
        });
      }

      if (!actualOk && testCase.expected_token !== TOKEN) {
        fail("S-V1-14 negative fixture must expect the stable token.", {
          path: FILES.fixture,
          case_id: testCase.case_id,
          expected_token: testCase.expected_token
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

const invitedRecord = relationship.createCoachAthleteRelationshipRecord({
  ...validRelationshipInput,
  relationship_state: "invited",
  accepted_at_iso8601: null
});

const firstCompile = relationship.compileIgnoringCoachAthleteRelationship(
  phaseLikeInput,
  [invitedRecord.body.relationship]
);
const secondCompile = relationship.compileIgnoringCoachAthleteRelationship(
  phaseLikeInput,
  [acceptedRecord.body.relationship, assignedDecision, unassignedDecision]
);

if (firstCompile !== secondCompile) {
  fail("Coach-athlete relationship/access state changed engine truth probe output.", {
    firstCompile,
    secondCompile
  });
}

if (process.exitCode && process.exitCode !== 0) {
  throw new Error("S-V1-14 coach-athlete relationship acceptance guard failed.");
}

console.log(JSON.stringify({
  ok: true,
  guard: GUARD,
  token: TOKEN,
  fixture_cases_checked: fixture?.cases?.length || 0,
  message: "V1 coach-athlete relationship acceptance boundary passed."
}, null, 2));
