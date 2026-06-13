// @law: Repo Governance
// @severity: medium
// @scope: repo
/**
 * DEV NOTE: S-V1-13 athlete registration/invitation guard.
 * Purpose: proves the athlete registration/invitation path is product/auth
 * state only and cannot affect engine truth or create relationship authority.
 * Boundary: checks the contract doc, app-source module, target test, negative
 * fixture, and lint registration. It does not implement auth providers,
 * database migrations, payment, UI, social, team/org invites, marketplace,
 * discovery, relationship authority, assignment authority, or engine behaviour.
 * Determinism: reads fixed repository files and imports one deterministic module.
 * Failure: emits CI_V1_ATHLETE_REGISTRATION_INVITATION when the path widens.
 */

import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const ROOT = process.cwd();
const GUARD = "S-V1-13";
const TOKEN = "CI_V1_ATHLETE_REGISTRATION_INVITATION";

const FILES = {
  doc: "docs/v1/V1_ATHLETE_REGISTRATION_INVITATION.md",
  releaseBoundary: "docs/v1/V1_RELEASE_BOUNDARY.md",
  acceptanceGate: "docs/v1/V1_ACCEPTANCE_GATE.md",
  notInScope: "docs/v1/V1_NOT_IN_SCOPE.md",
  authorityMap: "docs/v1/V1_DOC_AUTHORITY_MAP.md",
  engineUiAuthBoundary: "docs/roadmap/V1_ENGINE_UI_AUTH_BOUNDARY.md",
  accountBoundary: "docs/v1/V1_ACCOUNT_MODEL_BOUNDARY.md",
  coachProvisioning: "docs/v1/V1_COACH_REGISTRATION_PROVISIONING.md",
  module: "src/athleteRegistrationInvitation.mjs",
  test: "test/s_v1_13_athlete_registration_invitation.test.mjs",
  fixture: "ci/fixtures/v1_athlete_registration_invitation_negative/s_v1_13_athlete_invitation_scope_leakage.json",
  packageJson: "package.json"
};

const DOC_MARKERS = [
  "Status: active v1 athlete-registration/invitation boundary document.",
  "Slice: S-V1-13.",
  "The only valid account_role is athlete.",
  "The only valid invitation_target_role is athlete.",
  "The only valid invitation_scope is athlete_account_access.",
  "Athlete identity is product/auth state only.",
  "Athlete registration cannot affect engine truth.",
  "Athlete invitation cannot affect engine truth.",
  "relationship_created = false for invitation records",
  "Accepted invitations in S-V1-13 still do not create a coach-athlete relationship.",
  "Invite copy must not imply coaching outcome, safety, suitability, or readiness.",
  "If athlete registration or invitation data changes engine truth, this slice is invalid."
];

const POINTER_MARKERS = {
  [FILES.releaseBoundary]: [
    "S-V1-13:ATHLETE-REGISTRATION-INVITATION:START",
    "docs/v1/V1_ATHLETE_REGISTRATION_INVITATION.md",
    "Athlete registration cannot affect engine truth.",
    "Athlete invitation cannot affect engine truth."
  ],
  [FILES.acceptanceGate]: [
    "S-V1-13:ATHLETE-REGISTRATION-ACCEPTANCE:START",
    "athlete identity can be provisioned with account_role = athlete",
    "accepted athlete invitation is still not relationship creation",
    "invite copy remains factual and does not imply coaching outcome, safety, suitability, or readiness"
  ],
  [FILES.notInScope]: [
    "S-V1-13:ATHLETE-REGISTRATION-NON-SCOPE:START",
    "friends",
    "social",
    "team invites",
    "organisation invites",
    "marketplace",
    "coach discovery"
  ],
  [FILES.authorityMap]: [
    "S-V1-13:ATHLETE-REGISTRATION-AUTHORITY:START",
    "docs/v1/V1_ATHLETE_REGISTRATION_INVITATION.md",
    "ci/guards/s_v1_13_athlete_registration_invitation_guard.mjs"
  ],
  [FILES.engineUiAuthBoundary]: [
    "S-V1-13:ATHLETE-REGISTRATION-ENGINE-AUTH-BOUNDARY:START",
    "Athlete registration/invitation is product/auth state only.",
    "Engine output must not depend on athlete identity"
  ]
};

const MODULE_REQUIRED_MARKERS = [
  "athleteRegistrationInvitationSurfaceId",
  "validateAthleteRegistrationInput",
  "createAthleteRegistrationRecord",
  "validateAthleteInvitationInput",
  "createAthleteInvitationRecord",
  "compileIgnoringAthleteRegistrationInvitation",
  "product_auth_state_only: true",
  "engine_visible: false",
  "relationship_created: false",
  "athlete_registration_role_not_athlete",
  "athlete_invitation_target_not_athlete",
  "athlete_invitation_scope_invalid",
  "athlete_invitation_engine_or_relationship_field_refused"
];

const TEST_REQUIRED_MARKERS = [
  "S-V1-13 provisions athlete identity as product auth state only",
  "S-V1-13 creates athlete invitation as product auth state only",
  "S-V1-13 accepts athlete invitation without creating relationship authority",
  "S-V1-13 refuses non-athlete registration roles",
  "S-V1-13 refuses non-athlete invitation targets and non-account scopes",
  "S-V1-13 invitation state changes do not affect engine truth probe output",
  "S-V1-13 invite copy identifiers remain factual and non-advisory"
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
  "friend_request_create",
  "social_graph",
  "team_invitation_create",
  "organisation_invitation_create",
  "organization_invitation_create",
  "marketplace"
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
    fail("Required S-V1-13 file is missing.", { path: relPath });
    return "";
  }

  return fs.readFileSync(absPath, "utf8");
}

function readRequiredJson(relPath) {
  const text = readRequiredText(relPath);

  try {
    return JSON.parse(text);
  } catch (error) {
    fail("Required S-V1-13 JSON fixture is invalid.", {
      path: relPath,
      error: String(error?.message || error)
    });
    return null;
  }
}

function assertIncludes(relPath, text, marker) {
  if (!text.includes(marker)) {
    fail("Required S-V1-13 marker is missing.", {
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

const moduleText = readRequiredText(FILES.module);
for (const marker of MODULE_REQUIRED_MARKERS) {
  assertIncludes(FILES.module, moduleText, marker);
}

for (const marker of FORBIDDEN_MODULE_MARKERS) {
  if (moduleText.includes(marker)) {
    fail("S-V1-13 module includes a forbidden implementation marker.", {
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
  "node --test test/s_v1_13_athlete_registration_invitation.test.mjs",
  "node ci/guards/s_v1_13_athlete_registration_invitation_guard.mjs"
]) {
  if (!packageJsonText.includes(command)) {
    fail("S-V1-13 command must be registered in lint:fast.", { command });
  }
}

const fixture = readRequiredJson(FILES.fixture);

const moduleUrl = pathToFileURL(path.join(ROOT, FILES.module)).href;
const athleteInvitation = await import(`${moduleUrl}?cacheBust=${Date.now()}`);

const requiredExports = [
  "validateAthleteRegistrationInput",
  "createAthleteRegistrationRecord",
  "validateAthleteInvitationInput",
  "createAthleteInvitationRecord",
  "compileIgnoringAthleteRegistrationInvitation",
  "stableAthleteInvitationJson"
];

for (const exportName of requiredExports) {
  if (typeof athleteInvitation[exportName] !== "function") {
    fail("S-V1-13 module export is missing or not a function.", { exportName });
  }
}

if (fixture) {
  if (fixture.fixture_id !== "s_v1_13_athlete_invitation_scope_leakage") {
    fail("Unexpected S-V1-13 fixture id.", {
      path: FILES.fixture,
      fixture_id: fixture.fixture_id
    });
  }

  if (fixture.slice !== "S-V1-13") {
    fail("Unexpected S-V1-13 fixture slice.", {
      path: FILES.fixture,
      slice: fixture.slice
    });
  }

  if (!Array.isArray(fixture.cases) || fixture.cases.length < 10) {
    fail("S-V1-13 fixture must contain positive and negative athlete invitation cases.", {
      path: FILES.fixture,
      count: Array.isArray(fixture.cases) ? fixture.cases.length : null
    });
  } else {
    for (const testCase of fixture.cases) {
      let result;

      if (testCase.case_type === "registration") {
        result = athleteInvitation.createAthleteRegistrationRecord(testCase.input);
      } else if (testCase.case_type === "invitation") {
        result = athleteInvitation.createAthleteInvitationRecord(testCase.input);
      } else {
        fail("S-V1-13 fixture case_type must be registration or invitation.", {
          path: FILES.fixture,
          case_id: testCase.case_id,
          case_type: testCase.case_type
        });
        continue;
      }

      const actualOk = result.status === 201 && result.body?.ok === true;

      if (actualOk !== testCase.expected_ok) {
        fail("S-V1-13 fixture expectation failed.", {
          path: FILES.fixture,
          case_id: testCase.case_id,
          expected_ok: testCase.expected_ok,
          actual_ok: actualOk,
          result
        });
      }

      if (!actualOk && testCase.expected_token !== TOKEN) {
        fail("S-V1-13 negative fixture must expect the stable token.", {
          path: FILES.fixture,
          case_id: testCase.case_id,
          expected_token: testCase.expected_token
        });
      }

      if (actualOk && testCase.case_type === "registration") {
        if (result.body.athlete.account_role !== "athlete") {
          fail("S-V1-13 positive registration fixture did not produce athlete role.", {
            case_id: testCase.case_id
          });
        }

        if (result.body.athlete.product_auth_state_only !== true || result.body.athlete.engine_visible !== false) {
          fail("S-V1-13 positive registration fixture produced engine-visible athlete state.", {
            case_id: testCase.case_id
          });
        }
      }

      if (actualOk && testCase.case_type === "invitation") {
        if (result.body.invitation.invitation_target_role !== "athlete") {
          fail("S-V1-13 positive invitation fixture did not produce athlete target role.", {
            case_id: testCase.case_id
          });
        }

        if (
          result.body.invitation.product_auth_state_only !== true ||
          result.body.invitation.engine_visible !== false ||
          result.body.invitation.relationship_created !== false
        ) {
          fail("S-V1-13 positive invitation fixture widened beyond product/auth invitation state.", {
            case_id: testCase.case_id
          });
        }

        if (
          Object.hasOwn(testCase, "expected_relationship_created") &&
          result.body.invitation.relationship_created !== testCase.expected_relationship_created
        ) {
          fail("S-V1-13 fixture expected relationship_created false.", {
            case_id: testCase.case_id,
            actual: result.body.invitation.relationship_created
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

const firstAthlete = athleteInvitation.createAthleteRegistrationRecord({
  athlete_user_id: "athlete_001",
  email: "athlete.one@example.com",
  display_name: "Athlete One",
  account_role: "athlete",
  account_state: "invited",
  accepted_terms_version: "terms_v1",
  created_at_iso8601: "2026-06-13T12:00:00.000Z"
});

const secondAthlete = athleteInvitation.createAthleteRegistrationRecord({
  athlete_user_id: "athlete_002",
  email: "athlete.two@example.com",
  display_name: "Athlete Two",
  account_role: "athlete",
  account_state: "active",
  accepted_terms_version: "terms_v2",
  created_at_iso8601: "2026-06-13T13:00:00.000Z"
});

const firstCompile = athleteInvitation.compileIgnoringAthleteRegistrationInvitation(phaseLikeInput, [firstAthlete.body.athlete]);
const secondCompile = athleteInvitation.compileIgnoringAthleteRegistrationInvitation(phaseLikeInput, [secondAthlete.body.athlete]);

if (firstCompile !== secondCompile) {
  fail("Athlete registration changed engine truth probe output.", {
    firstCompile,
    secondCompile
  });
}

const invitedRecord = athleteInvitation.createAthleteInvitationRecord({
  invite_id: "invite_001",
  invited_by_coach_user_id: "coach_001",
  athlete_email: "athlete.one@example.com",
  athlete_display_name: "Athlete One",
  invitation_target_role: "athlete",
  invitation_scope: "athlete_account_access",
  invitation_state: "invited",
  invited_at_iso8601: "2026-06-13T12:00:00.000Z",
  expires_at_iso8601: "2026-06-20T12:00:00.000Z",
  accepted_at_iso8601: null,
  accepted_by_athlete_user_id: null
});

const acceptedRecord = athleteInvitation.createAthleteInvitationRecord({
  invite_id: "invite_001",
  invited_by_coach_user_id: "coach_001",
  athlete_email: "athlete.one@example.com",
  athlete_display_name: "Athlete One",
  invitation_target_role: "athlete",
  invitation_scope: "athlete_account_access",
  invitation_state: "accepted",
  invited_at_iso8601: "2026-06-13T12:00:00.000Z",
  expires_at_iso8601: "2026-06-20T12:00:00.000Z",
  accepted_at_iso8601: "2026-06-13T13:00:00.000Z",
  accepted_by_athlete_user_id: "athlete_001"
});

const invitedCompile = athleteInvitation.compileIgnoringAthleteRegistrationInvitation(phaseLikeInput, [invitedRecord.body.invitation]);
const acceptedCompile = athleteInvitation.compileIgnoringAthleteRegistrationInvitation(phaseLikeInput, [acceptedRecord.body.invitation]);

if (invitedCompile !== acceptedCompile) {
  fail("Athlete invitation state changed engine truth probe output.", {
    invitedCompile,
    acceptedCompile
  });
}

if (acceptedRecord.body.invitation.relationship_created !== false) {
  fail("Accepted athlete invitation created relationship authority.");
}

if (process.exitCode && process.exitCode !== 0) {
  throw new Error("S-V1-13 athlete registration/invitation guard failed.");
}

console.log(JSON.stringify({
  ok: true,
  guard: GUARD,
  token: TOKEN,
  fixture_cases_checked: fixture?.cases?.length || 0,
  message: "V1 athlete registration/invitation boundary passed."
}, null, 2));
