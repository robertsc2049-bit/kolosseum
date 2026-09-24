// DEV NOTE: LAUNCH-00 release authority guard. This script validates the closed-world
// public-launch preparation boundary against current UI, registry, historical release,
// and administrative authority surfaces. It does not activate product scope or mutate
// repository files.

import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const TOKEN = "LAUNCH_00_CURRENT_RELEASE_AUTHORITY";
const repoRoot = process.cwd();

const paths = {
  boundaryJson: "docs/releases/PUBLIC_LAUNCH_RELEASE_BOUNDARY.json",
  boundaryMd: "docs/releases/PUBLIC_LAUNCH_RELEASE_BOUNDARY.md",
  activePointer: "docs/roadmap/ACTIVE_RELEASE_BOUNDARY.md",
  uiManifest: "product/ui/function_manifest.json",
  fullUiReport: "docs/product/FULL_UI_GAP_REPORT.md",
  regFull09: "ci/evidence/reg_full_09_final_registry_acceptance.v1.json",
  admin08: "docs/roadmap/ADMIN_08_FINAL_REPOSITORY_ADMINISTRATIVE_ACCEPTANCE_GATE.md",
  controlledLaunchMd: "docs/releases/CONTROLLED_LAUNCH_GO_NO_GO_RECORD.md",
  controlledLaunchJson: "docs/releases/CONTROLLED_LAUNCH_GO_NO_GO_RECORD.json",
  negativeArea: "ci/fixtures/launch_00_current_release_authority_negative/excluded_product_area_activation.json",
  negativeActor: "ci/fixtures/launch_00_current_release_authority_negative/excluded_actor_activation.json",
  negativeActivity: "ci/fixtures/launch_00_current_release_authority_negative/unsupported_activity_activation.json"
};

function fail(code, detail = "") {
  const suffix = detail ? `: ${detail}` : "";
  console.error(`${TOKEN}: FAIL ${code}${suffix}`);
  process.exitCode = 1;
}

function readText(relPath) {
  return fs.readFileSync(path.resolve(repoRoot, relPath), "utf8");
}

function readJson(relPath) {
  return JSON.parse(readText(relPath));
}

function exactSet(actual, expected) {
  if (!Array.isArray(actual) || !Array.isArray(expected)) return false;
  if (actual.length !== expected.length) return false;
  const a = [...actual].sort();
  const b = [...expected].sort();
  return a.every((value, index) => value === b[index]);
}

function overlap(left, right) {
  const rhs = new Set(right);
  return left.filter((value) => rhs.has(value));
}

function section(text, heading, nextHeading) {
  const start = text.indexOf(heading);
  if (start < 0) return "";
  const from = start + heading.length;
  const end = nextHeading ? text.indexOf(nextHeading, from) : -1;
  return text.slice(from, end < 0 ? text.length : end);
}

function gitBlobSha(relPath) {
  const result = spawnSync("git", ["hash-object", relPath], {
    cwd: repoRoot,
    encoding: "utf8"
  });
  if (result.status !== 0) return null;
  return String(result.stdout || "").trim();
}

function parseBoundaryArg() {
  const index = process.argv.indexOf("--boundary");
  if (index < 0) return paths.boundaryJson;
  const value = process.argv[index + 1];
  if (!value) {
    fail("LAUNCH_00_BOUNDARY_ARG_MISSING");
    return null;
  }
  return path.isAbsolute(value) ? value : path.resolve(repoRoot, value);
}

function readBoundary(boundaryArg) {
  if (!boundaryArg) return null;
  const absolute = path.isAbsolute(boundaryArg) ? boundaryArg : path.resolve(repoRoot, boundaryArg);
  return JSON.parse(fs.readFileSync(absolute, "utf8"));
}

function main() {
  const boundaryPath = parseBoundaryArg();
  if (!boundaryPath) return;

  let boundary;
  let uiManifest;
  let regFull09;
  let boundaryMd;
  let activePointer;
  let fullUiReport;
  let admin08;
  let controlledLaunchMd;
  let controlledLaunchJson;

  try {
    boundary = readBoundary(boundaryPath);
    uiManifest = readJson(paths.uiManifest);
    regFull09 = readJson(paths.regFull09);
    boundaryMd = readText(paths.boundaryMd);
    activePointer = readText(paths.activePointer);
    fullUiReport = readText(paths.fullUiReport);
    admin08 = readText(paths.admin08);
    controlledLaunchMd = readText(paths.controlledLaunchMd);
    controlledLaunchJson = readJson(paths.controlledLaunchJson);
  } catch (error) {
    fail("LAUNCH_00_REQUIRED_SURFACE_UNREADABLE", String(error?.message ?? error));
    return;
  }

  if (boundary.schema_version !== "LAUNCH-00.1.0.0") fail("LAUNCH_00_SCHEMA_VERSION");
  if (boundary.slice_id !== "LAUNCH-00") fail("LAUNCH_00_SLICE_ID");
  if (boundary.release?.release_id !== "kolosseum_public_launch") fail("LAUNCH_00_RELEASE_ID");
  if (boundary.release?.release_name !== "Kolosseum Public Launch") fail("LAUNCH_00_RELEASE_NAME");
  if (boundary.release?.authority_kind !== "release_preparation_boundary") fail("LAUNCH_00_AUTHORITY_KIND");
  if (boundary.release?.activation_state !== "not_yet_authorised") fail("LAUNCH_00_ACTIVATION_STATE");
  if (boundary.release?.final_acceptance_gate !== "LAUNCH-10") fail("LAUNCH_00_FINAL_GATE");
  if (boundary.release?.final_acceptance_statement !== "PUBLIC_LAUNCH_ACCEPTANCE: GO") fail("LAUNCH_00_FINAL_STATEMENT");

  if (boundary.supersession?.supersedes_founder_group_only_boundary_for_this_release !== true) {
    fail("LAUNCH_00_SUPERSESSION_MISSING");
  }
  if (boundary.supersession?.historical_records_remain_final_for_their_original_scope !== true) {
    fail("LAUNCH_00_HISTORICAL_SCOPE_NOT_PRESERVED");
  }
  if (boundary.supersession?.historical_records_must_not_be_rewritten !== true) {
    fail("LAUNCH_00_HISTORICAL_IMMUTABILITY_MISSING");
  }
  if (boundary.supersession?.retroactive_v1_scope_rewrite !== false) {
    fail("LAUNCH_00_RETROACTIVE_V1_REWRITE");
  }
  if (boundary.supersession?.does_not_itself_authorise_public_launch !== true) {
    fail("LAUNCH_00_SELF_AUTHORISATION_FORBIDDEN");
  }

  const expectedPublicActors = ["athlete", "coach"];
  const expectedOperatorActors = ["founder_admin"];
  const expectedExcludedActors = ["org_owner", "shared"];
  if (!exactSet(boundary.actors?.public, expectedPublicActors)) fail("LAUNCH_00_PUBLIC_ACTOR_DRIFT");
  if (!exactSet(boundary.actors?.operator_only, expectedOperatorActors)) fail("LAUNCH_00_OPERATOR_ACTOR_DRIFT");
  if (!exactSet(boundary.actors?.excluded_from_public_launch, expectedExcludedActors)) fail("LAUNCH_00_EXCLUDED_ACTOR_DRIFT");

  const manifestActors = Array.isArray(uiManifest.actors) ? uiManifest.actors : [];
  for (const actor of [...expectedPublicActors, ...expectedOperatorActors, ...expectedExcludedActors]) {
    if (!manifestActors.includes(actor)) fail("LAUNCH_00_ACTOR_NOT_IN_UI_MANIFEST", actor);
  }

  const permittedActivities = boundary.activities?.permitted ?? [];
  if (boundary.activities?.closed_world !== true) fail("LAUNCH_00_ACTIVITY_SCOPE_NOT_CLOSED");
  if (regFull09.status !== "PASS") fail("LAUNCH_00_REG_FULL_09_NOT_PASS");
  if (!exactSet(permittedActivities, regFull09.supported_activity_scope ?? [])) {
    fail("LAUNCH_00_ACTIVITY_SCOPE_REG_FULL_09_DRIFT");
  }

  const areas = Array.isArray(uiManifest.product_areas) ? uiManifest.product_areas : [];
  const areaIds = areas.map((area) => area.area_id);
  const publicAreas = boundary.product_areas?.public_launch_candidate ?? [];
  const operatorAreas = boundary.product_areas?.operator_only ?? [];
  const excludedAreas = boundary.product_areas?.implemented_not_launched ?? [];

  if (boundary.product_areas?.closed_world !== true) fail("LAUNCH_00_PRODUCT_AREA_SCOPE_NOT_CLOSED");

  const overlapPublicOperator = overlap(publicAreas, operatorAreas);
  const overlapPublicExcluded = overlap(publicAreas, excludedAreas);
  const overlapOperatorExcluded = overlap(operatorAreas, excludedAreas);
  if (overlapPublicOperator.length) fail("LAUNCH_00_AREA_CLASSIFICATION_OVERLAP", overlapPublicOperator.join(","));
  if (overlapPublicExcluded.length) fail("LAUNCH_00_EXCLUDED_AREA_ACTIVE", overlapPublicExcluded.join(","));
  if (overlapOperatorExcluded.length) fail("LAUNCH_00_AREA_CLASSIFICATION_OVERLAP", overlapOperatorExcluded.join(","));

  const classifiedAreas = [...publicAreas, ...operatorAreas, ...excludedAreas];
  if (!exactSet(classifiedAreas, areaIds)) {
    const missing = areaIds.filter((id) => !classifiedAreas.includes(id));
    const unknown = classifiedAreas.filter((id) => !areaIds.includes(id));
    fail("LAUNCH_00_PRODUCT_AREA_CLASSIFICATION_DRIFT", `missing=${missing.join(",")} unknown=${unknown.join(",")}`);
  }

  for (const id of classifiedAreas) {
    if (!areas.some((area) => area.area_id === id)) fail("LAUNCH_00_AREA_NOT_IN_UI_MANIFEST", id);
  }

  const publicFunctions = areas
    .filter((area) => publicAreas.includes(area.area_id))
    .flatMap((area) => Array.isArray(area.functions) ? area.functions : []);
  for (const fn of publicFunctions) {
    if (!fn?.function_id) fail("LAUNCH_00_FUNCTION_ID_MISSING");
    if (fn?.state !== "implemented") fail("LAUNCH_00_PUBLIC_FUNCTION_NOT_IMPLEMENTED", String(fn?.function_id ?? "unknown"));
  }

  const allFunctions = areas.flatMap((area) => Array.isArray(area.functions) ? area.functions : []);
  const partial = allFunctions.filter((fn) => fn.state === "partial");
  const missing = allFunctions.filter((fn) => fn.state === "missing");
  if (partial.length) fail("LAUNCH_00_FULL_UI_PARTIAL", String(partial.length));
  if (missing.length) fail("LAUNCH_00_FULL_UI_MISSING", String(missing.length));
  if (!fullUiReport.includes("- partial: 0") || !fullUiReport.includes("- missing: 0")) {
    fail("LAUNCH_00_FULL_UI_REPORT_DRIFT");
  }

  const commercialIds = boundary.commercial_surfaces?.permitted_existing_function_ids ?? [];
  const coachCommercial = areas.find((area) => area.area_id === boundary.commercial_surfaces?.permitted_candidate_area);
  const coachCommercialIds = (coachCommercial?.functions ?? []).map((fn) => fn.function_id);
  for (const id of commercialIds) {
    if (!coachCommercialIds.includes(id)) fail("LAUNCH_00_COMMERCIAL_FUNCTION_NOT_IN_MANIFEST", id);
  }
  if (boundary.commercial_surfaces?.pricing_defined_by_launch_00 !== false) fail("LAUNCH_00_PRICING_SCOPE_LEAK");
  if (boundary.commercial_surfaces?.payment_implementation_defined_by_launch_00 !== false) fail("LAUNCH_00_PAYMENT_IMPLEMENTATION_SCOPE_LEAK");

  const requiredInvariantKeys = [
    "payment_state_can_alter_engine_truth",
    "entitlement_state_can_alter_engine_truth",
    "ui_state_can_alter_engine_truth",
    "commercial_state_can_alter_engine_truth",
    "product_state_can_alter_engine_truth",
    "coach_notes_can_alter_engine_truth",
    "notification_state_can_alter_engine_truth"
  ];
  for (const key of requiredInvariantKeys) {
    if (boundary.engine_truth_invariants?.[key] !== false) fail("LAUNCH_00_ENGINE_TRUTH_INVARIANT", key);
  }

  const requiredGates = Array.from({ length: 10 }, (_, index) => `LAUNCH-${String(index + 1).padStart(2, "0")}`);
  if (!exactSet(boundary.required_downstream_gates ?? [], requiredGates)) fail("LAUNCH_00_DOWNSTREAM_GATE_DRIFT");

  const requiredNonScope = [
    "payment_implementation",
    "pricing_definition",
    "account_registration_changes",
    "ui_changes",
    "database_migrations",
    "programme_imports",
    "marketplace_activation",
    "organisation_activation",
    "new_registry_content",
    "engine_behaviour_changes"
  ];
  if (!exactSet(boundary.non_scope ?? [], requiredNonScope)) fail("LAUNCH_00_NON_SCOPE_DRIFT");

  const publicSection = section(boundaryMd, "## Public launch candidate product areas", "## Operator-only area");
  const operatorSection = section(boundaryMd, "## Operator-only area", "## Implemented but not launched");
  const excludedSection = section(boundaryMd, "## Implemented but not launched", "## Commercial surface position");
  const activitySection = section(boundaryMd, "## Permitted activity scope", "## Public launch candidate product areas");
  const actorSection = section(boundaryMd, "## Public launch actors", "## Permitted activity scope");

  for (const id of publicAreas) {
    if (!publicSection.includes(`\`${id}\``)) fail("LAUNCH_00_MD_PUBLIC_AREA_DRIFT", id);
  }
  for (const id of operatorAreas) {
    if (!operatorSection.includes(`\`${id}\``)) fail("LAUNCH_00_MD_OPERATOR_AREA_DRIFT", id);
  }
  for (const id of excludedAreas) {
    if (!excludedSection.includes(`\`${id}\``)) fail("LAUNCH_00_MD_EXCLUDED_AREA_DRIFT", id);
  }
  for (const activity of permittedActivities) {
    if (!activitySection.includes(`\`${activity}\``)) fail("LAUNCH_00_MD_ACTIVITY_DRIFT", activity);
  }
  for (const actor of expectedPublicActors) {
    if (!actorSection.includes(actor)) fail("LAUNCH_00_MD_ACTOR_DRIFT", actor);
  }

  if (!boundaryMd.includes("Kolosseum Public Launch")) fail("LAUNCH_00_MD_RELEASE_NAME");
  if (!boundaryMd.includes("PUBLIC_LAUNCH_ACCEPTANCE: GO")) fail("LAUNCH_00_MD_FINAL_GATE_TOKEN");
  if (!boundaryMd.includes("does not itself authorise public launch")) fail("LAUNCH_00_MD_NO_SELF_AUTHORISATION");

  if (!activePointer.includes("docs/releases/PUBLIC_LAUNCH_RELEASE_BOUNDARY.md")) fail("LAUNCH_00_ACTIVE_POINTER_MD_MISSING");
  if (!activePointer.includes("docs/releases/PUBLIC_LAUNCH_RELEASE_BOUNDARY.json")) fail("LAUNCH_00_ACTIVE_POINTER_JSON_MISSING");
  if (!activePointer.includes("LAUNCH-10")) fail("LAUNCH_00_ACTIVE_POINTER_FINAL_GATE_MISSING");

  if (!admin08.includes("REPOSITORY_ADMIN_CLOSURE: PASS")) fail("LAUNCH_00_ADMIN_08_CONTRACT_MISSING");
  if (!admin08.includes("ADMIN-08 is not a repair slice")) fail("LAUNCH_00_ADMIN_08_BOUNDARY_DRIFT");

  if (controlledLaunchJson.decision !== "GO") fail("LAUNCH_00_HISTORICAL_CONTROLLED_LAUNCH_RESULT_DRIFT");
  if (controlledLaunchJson.decision_scope !== "controlled_launch_only") fail("LAUNCH_00_HISTORICAL_CONTROLLED_LAUNCH_SCOPE_DRIFT");
  if (controlledLaunchJson.decision_rules?.go_authorises_open_availability !== false) fail("LAUNCH_00_HISTORICAL_OPEN_AVAILABILITY_DRIFT");
  if (!controlledLaunchMd.includes("named founder group only")) fail("LAUNCH_00_HISTORICAL_FOUNDER_SCOPE_DRIFT");

  const pins = boundary.historical_record_pins ?? {};
  for (const relPath of [paths.controlledLaunchMd, paths.controlledLaunchJson]) {
    const expectedSha = pins[relPath];
    const actualSha = gitBlobSha(relPath);
    if (!expectedSha || actualSha !== expectedSha) {
      fail("LAUNCH_00_HISTORICAL_RECORD_CHANGED", `${relPath} expected=${expectedSha ?? "missing"} actual=${actualSha ?? "unreadable"}`);
    }
  }

  for (const fixturePath of [paths.negativeArea, paths.negativeActor, paths.negativeActivity]) {
    let fixture;
    try {
      fixture = readJson(fixturePath);
    } catch (error) {
      fail("LAUNCH_00_NEGATIVE_FIXTURE_UNREADABLE", fixturePath);
      continue;
    }
    if (fixture.slice_id !== "LAUNCH-00" || fixture.expected_result !== "reject") {
      fail("LAUNCH_00_NEGATIVE_FIXTURE_CONTRACT", fixturePath);
    }
  }

  if (!process.exitCode) {
    console.log(`${TOKEN}: PASS`);
  }
}

main();
