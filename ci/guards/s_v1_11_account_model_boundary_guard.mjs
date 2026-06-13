// @law: Repo Governance
// @severity: medium
// @scope: repo
/**
 * DEV NOTE: S-V1-11 account model boundary guard.
 * Purpose: proves active v1 account scope is coach and athlete only before auth
 * or account implementation widens the product boundary.
 * Boundary: documentation, negative fixture, and CI registration only. This guard
 * must not implement auth, create schemas, create routes, create migrations,
 * grant access, activate dormant roles, or change engine behaviour.
 * Determinism: reads fixed repository files and fixture data only; no network,
 * database, clock, runtime, API, or GitHub state is used.
 * Failure: emits CI_V1_ACCOUNT_MODEL_BOUNDARY when account scope widens or
 * account state becomes engine truth.
 */

import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const GUARD = "S-V1-11";
const TOKEN = "CI_V1_ACCOUNT_MODEL_BOUNDARY";

const FILES = {
  accountBoundary: "docs/v1/V1_ACCOUNT_MODEL_BOUNDARY.md",
  releaseBoundary: "docs/v1/V1_RELEASE_BOUNDARY.md",
  acceptanceGate: "docs/v1/V1_ACCEPTANCE_GATE.md",
  notInScope: "docs/v1/V1_NOT_IN_SCOPE.md",
  authorityMap: "docs/v1/V1_DOC_AUTHORITY_MAP.md",
  engineUiAuthBoundary: "docs/roadmap/V1_ENGINE_UI_AUTH_BOUNDARY.md",
  s10Guard: "ci/guards/s_v1_10_release_boundary_file_closure_guard.mjs",
  fixture: "ci/fixtures/v1_account_model_boundary_negative/s_v1_11_account_scope_leakage.json",
  packageJson: "package.json"
};

const ACCOUNT_DOC_REQUIRED = [
  "Status: active v1 account-boundary document.",
  "Slice: S-V1-11.",
  "V1 supports coach and athlete only.",
  "The active v1 account roles are exactly:",
  "- coach",
  "- athlete",
  "Dormant future roles may be documented only as dormant.",
  "Account state is platform state only.",
  "Account state must not alter engine truth.",
  "If engine output changes because of account state, the implementation is invalid.",
  "If an account role is not coach or athlete, it is not active v1 account scope.",
  "If account state changes engine truth, the slice is invalid.",
  "organisation_admin",
  "organization_admin",
  "team_admin",
  "gym_admin",
  "unit_admin",
  "federation_admin",
  "enterprise_admin",
  "marketplace_seller",
  "marketplace_buyer",
  "support_operator",
  "auditor",
  "auth provider implementation",
  "database migrations",
  "payment implementation",
  "engine behaviour"
];

const POINTER_MARKERS = {
  [FILES.releaseBoundary]: [
    "S-V1-11:ACCOUNT-MODEL-BOUNDARY:START",
    "V1 supports coach and athlete only.",
    "docs/v1/V1_ACCOUNT_MODEL_BOUNDARY.md",
    "Account state is platform state only and must not alter engine truth"
  ],
  [FILES.acceptanceGate]: [
    "S-V1-11:ACCOUNT-MODEL-ACCEPTANCE:START",
    "V1 acceptance requires the account model to remain coach and athlete only.",
    "Account state must not alter engine truth.",
    "Dormant future roles may be documented only as dormant."
  ],
  [FILES.notInScope]: [
    "S-V1-11:ACCOUNT-MODEL-NON-SCOPE:START",
    "The only active v1 account roles are coach and athlete.",
    "These roles may be documented only as dormant.",
    "enterprise billing",
    "marketplace"
  ],
  [FILES.authorityMap]: [
    "S-V1-11:ACCOUNT-MODEL-AUTHORITY:START",
    "docs/v1/V1_ACCOUNT_MODEL_BOUNDARY.md",
    "ci/guards/s_v1_11_account_model_boundary_guard.mjs",
    "No lower-authority document, schema, fixture, route, UI surface, account state, billing state, support state, dormant future role, or implementation note may widen active v1 account scope beyond coach and athlete."
  ],
  [FILES.engineUiAuthBoundary]: [
    "S-V1-11:ACCOUNT-MODEL-ENGINE-AUTH-BOUNDARY:START",
    "V1 supports coach and athlete accounts only.",
    "Account state is platform state only.",
    "Engine output must not depend on account role, account status, invite status, verification status, billing status, entitlement status, support status, or dormant future role state."
  ]
};

const ALLOWED_ACTIVE_ROLES = new Set(["coach", "athlete"]);
const DORMANT_ALLOWED_ROLES = new Set([
  "organisation_admin",
  "organization_admin",
  "team_admin",
  "gym_admin",
  "unit_admin",
  "federation_admin",
  "enterprise_admin",
  "marketplace_seller",
  "marketplace_buyer",
  "support_operator",
  "auditor"
]);

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
    fail("Required S-V1-11 account-boundary file is missing.", { path: relPath });
    return "";
  }

  return fs.readFileSync(absPath, "utf8");
}

function readRequiredJson(relPath) {
  const text = readRequiredText(relPath);

  try {
    return JSON.parse(text);
  } catch (error) {
    fail("Required S-V1-11 JSON fixture is invalid.", {
      path: relPath,
      error: String(error?.message || error)
    });
    return null;
  }
}

function assertIncludes(relPath, text, marker) {
  if (!text.includes(marker)) {
    fail("Required S-V1-11 account-boundary marker is missing.", {
      path: relPath,
      marker
    });
  }
}

function evaluateAccountModel(accountModel) {
  if (!accountModel || typeof accountModel !== "object" || Array.isArray(accountModel)) {
    return {
      ok: false,
      reason: "account_model_missing_or_invalid"
    };
  }

  const activeRoles = Array.isArray(accountModel.active_roles)
    ? accountModel.active_roles.map((role) => String(role))
    : [];

  const activeRoleSet = new Set(activeRoles);

  if (activeRoleSet.size !== activeRoles.length) {
    return {
      ok: false,
      reason: "duplicate_active_roles"
    };
  }

  if (activeRoles.length !== ALLOWED_ACTIVE_ROLES.size) {
    return {
      ok: false,
      reason: "active_role_count_mismatch",
      active_roles: activeRoles
    };
  }

  for (const role of activeRoles) {
    if (!ALLOWED_ACTIVE_ROLES.has(role)) {
      return {
        ok: false,
        reason: "forbidden_active_role",
        role
      };
    }
  }

  for (const requiredRole of ALLOWED_ACTIVE_ROLES) {
    if (!activeRoleSet.has(requiredRole)) {
      return {
        ok: false,
        reason: "missing_required_active_role",
        role: requiredRole
      };
    }
  }

  const futureRoles = Array.isArray(accountModel.future_roles) ? accountModel.future_roles : [];
  for (const futureRole of futureRoles) {
    if (!futureRole || typeof futureRole !== "object" || Array.isArray(futureRole)) {
      return {
        ok: false,
        reason: "future_role_invalid"
      };
    }

    const role = String(futureRole.role || "");
    const status = String(futureRole.status || "");

    if (!DORMANT_ALLOWED_ROLES.has(role)) {
      return {
        ok: false,
        reason: "unknown_future_role",
        role
      };
    }

    if (status !== "dormant") {
      return {
        ok: false,
        reason: "future_role_not_dormant",
        role,
        status
      };
    }
  }

  if (accountModel.account_state_can_alter_engine_truth !== false) {
    return {
      ok: false,
      reason: "account_state_can_alter_engine_truth"
    };
  }

  if (accountModel.enterprise_billing_scope !== false) {
    return {
      ok: false,
      reason: "enterprise_billing_scope_active"
    };
  }

  if (accountModel.marketplace_scope !== false) {
    return {
      ok: false,
      reason: "marketplace_scope_active"
    };
  }

  return {
    ok: true
  };
}

for (const relPath of Object.values(FILES)) {
  readRequiredText(relPath);
}

const accountDoc = readRequiredText(FILES.accountBoundary);
for (const marker of ACCOUNT_DOC_REQUIRED) {
  assertIncludes(FILES.accountBoundary, accountDoc, marker);
}

for (const [relPath, markers] of Object.entries(POINTER_MARKERS)) {
  const text = readRequiredText(relPath);
  for (const marker of markers) {
    assertIncludes(relPath, text, marker);
  }
}

const s10GuardText = readRequiredText(FILES.s10Guard);
for (const marker of [
  "S-V1-10 guard intentionally checks forbidden implementation prefixes only",
  "It must not freeze future v1 slices to the S-V1-10 changed-file allowlist."
]) {
  assertIncludes(FILES.s10Guard, s10GuardText, marker);
}

const packageJson = readRequiredText(FILES.packageJson);
if (!packageJson.includes("node ci/guards/s_v1_11_account_model_boundary_guard.mjs")) {
  fail("S-V1-11 guard must be registered in the existing lint:fast guard chain.");
}

const fixture = readRequiredJson(FILES.fixture);
if (fixture) {
  if (fixture.fixture_id !== "s_v1_11_account_scope_leakage") {
    fail("Unexpected S-V1-11 fixture id.", {
      path: FILES.fixture,
      fixture_id: fixture.fixture_id
    });
  }

  if (fixture.slice !== "S-V1-11") {
    fail("Unexpected S-V1-11 fixture slice.", {
      path: FILES.fixture,
      slice: fixture.slice
    });
  }

  if (!Array.isArray(fixture.allowed_active_roles) || fixture.allowed_active_roles.join("|") !== "coach|athlete") {
    fail("S-V1-11 fixture allowed_active_roles must be coach and athlete only.", {
      path: FILES.fixture
    });
  }

  if (!Array.isArray(fixture.cases) || fixture.cases.length < 10) {
    fail("S-V1-11 fixture must contain positive and negative account boundary cases.", {
      path: FILES.fixture,
      count: Array.isArray(fixture.cases) ? fixture.cases.length : null
    });
  } else {
    for (const testCase of fixture.cases) {
      const result = evaluateAccountModel(testCase.account_model);
      const actualOk = result.ok === true;

      if (actualOk !== testCase.expected_ok) {
        fail("S-V1-11 account model negative fixture expectation failed.", {
          path: FILES.fixture,
          case_id: testCase.case_id,
          expected_ok: testCase.expected_ok,
          actual_ok: actualOk,
          reason: result.reason || null
        });
      }

      if (!actualOk && testCase.expected_token !== TOKEN) {
        fail("S-V1-11 negative fixture must expect the stable account-boundary token.", {
          path: FILES.fixture,
          case_id: testCase.case_id,
          expected_token: testCase.expected_token
        });
      }
    }
  }
}

if (process.exitCode && process.exitCode !== 0) {
  throw new Error("S-V1-11 account model boundary guard failed.");
}

console.log(JSON.stringify({
  ok: true,
  guard: GUARD,
  token: TOKEN,
  docs_checked: Object.keys(POINTER_MARKERS).length + 1,
  fixture_cases_checked: fixture?.cases?.length || 0,
  message: "V1 account model boundary passed."
}, null, 2));
