// DEV NOTE: LAUNCH-03 public account-access guard. It validates the existing
// persisted athlete/coach account boundary and relationship permission wiring.
// It must not create auth providers, billing provider calls, org scope, or engine input.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = process.cwd();
const canonicalPath = "docs/releases/PUBLIC_LAUNCH_ACCOUNT_ACCESS.json";
const TOKEN = "PUBLIC_LAUNCH_ACCOUNT_ACCESS";

export const LAUNCH_03_REASON_CODES = Object.freeze({
  AUTHORITY_INVALID: "launch_03_authority_invalid",
  ROLE_SCOPE_INVALID: "launch_03_role_scope_invalid",
  IDENTITY_POLICY_INVALID: "launch_03_identity_policy_invalid",
  RELATIONSHIP_POLICY_INVALID: "launch_03_relationship_policy_invalid",
  ENGINE_COUPLING_INVALID: "launch_03_engine_coupling_invalid",
  ROUTE_PROOF_INVALID: "launch_03_route_proof_invalid",
  PERSISTENT_PROOF_INVALID: "launch_03_persistent_proof_invalid"
});

function readText(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}
function readJson(relativePath) {
  return JSON.parse(readText(relativePath));
}
function sameArray(left, right) {
  return Array.isArray(left) && left.length === right.length && left.every((value, index) => value === right[index]);
}
function fail(reason_code, details = {}) {
  return { ok: false, reason_code, details };
}

export function validateLaunch03Authority(authority) {
  if (!authority || typeof authority !== "object" || Array.isArray(authority) || authority.slice_id !== "LAUNCH-03") {
    return fail(LAUNCH_03_REASON_CODES.AUTHORITY_INVALID);
  }
  if (!sameArray(authority.active_public_roles, ["athlete", "coach"])) {
    return fail(LAUNCH_03_REASON_CODES.ROLE_SCOPE_INVALID, { active_public_roles: authority.active_public_roles });
  }
  for (const blocked of ["org_owner", "organisation_owner", "organization_owner", "team_owner", "gym_owner", "federation_admin", "enterprise_admin", "shared"]) {
    if (!authority.rejected_active_roles?.includes(blocked)) {
      return fail(LAUNCH_03_REASON_CODES.ROLE_SCOPE_INVALID, { missing_rejected_role: blocked });
    }
  }
  const identity = authority.identity_policy ?? {};
  if (identity.unique_identity_required !== true || identity.explicit_account_state_required !== true || identity.explicit_role_required !== true || identity.implicit_role_promotion_permitted !== false || identity.server_authoritative !== true) {
    return fail(LAUNCH_03_REASON_CODES.IDENTITY_POLICY_INVALID);
  }
  const relationship = authority.relationship_access ?? {};
  if (relationship.scope !== "individual_coach_athlete" || relationship.accepted_state_required_for_coach_access !== true || relationship.athlete_self_access_requires_relationship !== false || relationship.unassigned_coach_access !== "denied" || relationship.organisation_team_gym_scope_active !== false) {
    return fail(LAUNCH_03_REASON_CODES.RELATIONSHIP_POLICY_INVALID);
  }
  const engine = authority.engine_isolation ?? {};
  for (const key of ["account_fields_are_engine_truth", "authentication_metadata_in_deterministic_engine_input", "account_state_can_change_compile_output", "role_can_change_compile_output", "session_token_can_change_compile_output", "email_verification_can_change_compile_output", "relationship_permission_is_engine_truth"]) {
    if (engine[key] !== false) return fail(LAUNCH_03_REASON_CODES.ENGINE_COUPLING_INVALID, { key, value: engine[key] });
  }
  if (authority.commercial_entry?.billing_provider_activation_gate !== "LAUNCH-04" || authority.commercial_entry?.checkout_required_in_launch_03 !== false) {
    return fail(LAUNCH_03_REASON_CODES.AUTHORITY_INVALID, { field: "commercial_entry" });
  }
  return { ok: true };
}

export function runLaunch03Guard(authorityPath = canonicalPath) {
  const authority = readJson(authorityPath);
  const validation = validateLaunch03Authority(authority);
  if (!validation.ok) return validation;

  const surface = readJson("docs/releases/PUBLIC_LAUNCH_SURFACE_MANIFEST.json");
  for (const area of ["identity_account", "athlete_onboarding", "relationships"]) {
    if (!surface.area_classifications?.launch_active?.includes(area)) return fail(LAUNCH_03_REASON_CODES.AUTHORITY_INVALID, { missing_launch_active_area: area });
  }
  for (const area of ["organisation_billing", "messaging", "attendance_events"]) {
    if (surface.area_classifications?.launch_active?.includes(area)) return fail(LAUNCH_03_REASON_CODES.ROLE_SCOPE_INVALID, { forbidden_launch_area: area });
  }

  const accountRoutes = readText(authority.sources.account_routes);
  for (const route of Object.values(authority.public_routes)) {
    const leaf = String(route).replace(/^\/account/u, "");
    if (leaf && !accountRoutes.includes(`"${leaf}"`)) return fail(LAUNCH_03_REASON_CODES.ROUTE_PROOF_INVALID, { route });
  }
  const accountService = readText(authority.sources.account_service);
  for (const token of ["athlete", "coach", "validateEmail", "email_canonical", "account_state", "email_verified_at", "expires_at", "revoked_at"]) {
    if (!accountService.includes(token)) return fail(LAUNCH_03_REASON_CODES.ROUTE_PROOF_INVALID, { missing_account_service_token: token });
  }
  if (!/function\s+validateEmail[\s\S]*?toLowerCase\(\)/u.test(accountService)) {
    return fail(LAUNCH_03_REASON_CODES.IDENTITY_POLICY_INVALID, { missing_identity_proof: "validateEmail_lowercase_canonicalisation" });
  }
  const relationshipSource = readText(authority.sources.relationship_permission);
  for (const token of ["individual_coach_athlete", "canCoachViewAssignedAthlete", "canAthleteViewAthleteData", "coach_not_assigned_to_athlete", "engine_visible: false"]) {
    if (!relationshipSource.includes(token)) return fail(LAUNCH_03_REASON_CODES.RELATIONSHIP_POLICY_INVALID, { missing_relationship_token: token });
  }

  const integration = readJson(authority.persistent_proof.integration_manifest);
  for (const proofPath of [authority.persistent_proof.identity_account, authority.persistent_proof.relationship_lifecycle]) {
    if (!fs.existsSync(path.join(root, proofPath)) || !integration.commands?.includes(`node ${proofPath}`)) {
      return fail(LAUNCH_03_REASON_CODES.PERSISTENT_PROOF_INVALID, { proofPath });
    }
  }
  return { ok: true, pass_token: `${TOKEN}: PASS` };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const authorityArgIndex = process.argv.indexOf("--authority");
  const authorityPath = authorityArgIndex >= 0 ? process.argv[authorityArgIndex + 1] : canonicalPath;
  const result = runLaunch03Guard(authorityPath);
  if (!result.ok) {
    console.error(`${TOKEN}: FAIL ${result.reason_code} ${JSON.stringify(result.details ?? {})}`);
    process.exit(1);
  }
  console.log(result.pass_token);
}
