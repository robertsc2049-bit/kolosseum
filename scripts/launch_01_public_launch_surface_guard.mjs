// DEV NOTE: LAUNCH-01 closed-world public launch surface guard.
// It classifies the exact current UI inventory against LAUNCH-00. It does not
// change application routing, commercial state, registry content, or engine truth.

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const TOKEN = "PUBLIC_LAUNCH_SURFACE";
const root = process.cwd();
const NON_PERSISTED = new Set(["navigation_cache", "not_implemented"]);

let failures = 0;

function fail(code, detail = "") {
  failures += 1;
  console.error(`${TOKEN}: FAIL ${code}${detail ? `: ${detail}` : ""}`);
}

function exactSet(actual, expected) {
  if (!Array.isArray(actual) || !Array.isArray(expected) || actual.length !== expected.length) return false;
  const a = [...actual].sort();
  const b = [...expected].sort();
  return a.every((value, index) => value === b[index]);
}

function readText(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function readJson(filePath) {
  return JSON.parse(readText(filePath));
}

function arg(name, fallback) {
  const index = process.argv.indexOf(name);
  if (index < 0) return fallback;
  const value = process.argv[index + 1];
  if (!value) throw new Error(`${name} requires a value`);
  return path.isAbsolute(value) ? value : path.resolve(root, value);
}

function gitBlobSha(text) {
  const bytes = Buffer.from(text, "utf8");
  return crypto.createHash("sha1").update(`blob ${bytes.length}\0`).update(bytes).digest("hex");
}

function locateFunction(areas, functionId) {
  for (const area of areas) {
    const fn = (area.functions ?? []).find((entry) => entry.function_id === functionId);
    if (fn) return { area, fn };
  }
  return null;
}

function buildRecord({ area, fn, classification, routeById, crossCutting, launch00, surface }) {
  const route = fn.route_id ? routeById.get(fn.route_id) ?? null : null;
  const commercial = area.area_id === surface.commercial_policy.area_id
    ? {
        state: "downstream_gated_candidate",
        required_activation_gates: [...surface.commercial_policy.required_activation_gates],
        changes_engine_truth: false
      }
    : null;

  let routeAction;
  if (crossCutting.has(fn.function_id)) {
    routeAction = {
      mode: "cross_cutting_all_lawful_routes",
      route_id: null,
      route_pattern: null,
      api_routes: Array.isArray(fn.api_routes) ? fn.api_routes : []
    };
  } else {
    routeAction = {
      mode: fn.route_id ? "route" : "action",
      route_id: fn.route_id ?? null,
      route_pattern: route?.pattern ?? null,
      api_routes: Array.isArray(fn.api_routes) ? fn.api_routes : []
    };
  }

  return {
    function_id: fn.function_id,
    product_area: area.area_id,
    actor: [...(fn.actors ?? [])],
    route_action: routeAction,
    persistence: fn.persistence ?? null,
    owning_authority: {
      implementation_slice: area.slice_id ?? null,
      release_boundary: launch00.slice_id,
      launch_surface: surface.slice_id
    },
    direct_test: fn.direct_test ?? null,
    persistent_integration_proof: fn.integration_test ?? null,
    commercial_entitlement: commercial,
    engine_impact: "none_on_deterministic_engine_truth",
    launch_classification: classification
  };
}

function main() {
  let surfacePath;
  let uiPath;
  let emitPath = null;
  try {
    surfacePath = arg("--surface-manifest", path.resolve(root, "docs/releases/PUBLIC_LAUNCH_SURFACE_MANIFEST.json"));
    uiPath = arg("--ui-manifest", path.resolve(root, "product/ui/function_manifest.json"));
    if (process.argv.includes("--emit")) emitPath = arg("--emit", null);
  } catch (error) {
    fail("ARGUMENT_ERROR", String(error?.message ?? error));
    return;
  }

  let surface;
  let ui;
  let launch00;
  let fullUiShip;
  let gapReport;
  let surfaceText;
  let uiText;
  let launch00Text;
  try {
    surfaceText = readText(surfacePath);
    uiText = readText(uiPath);
    launch00Text = readText(path.resolve(root, "docs/releases/PUBLIC_LAUNCH_RELEASE_BOUNDARY.json"));
    surface = JSON.parse(surfaceText);
    ui = JSON.parse(uiText);
    launch00 = JSON.parse(launch00Text);
    fullUiShip = readJson(path.resolve(root, "docs/product/FULL_UI_25_SHIP_RECORD.json"));
    gapReport = readText(path.resolve(root, "docs/product/FULL_UI_GAP_REPORT.md"));
  } catch (error) {
    fail("REQUIRED_SURFACE_UNREADABLE", String(error?.message ?? error));
    return;
  }

  if (surface.schema_version !== "LAUNCH-01.1.0.0") fail("SCHEMA_VERSION");
  if (surface.slice_id !== "LAUNCH-01") fail("SLICE_ID");
  if (surface.release?.authority !== "LAUNCH-00") fail("RELEASE_AUTHORITY");
  if (surface.release?.final_acceptance_gate !== "LAUNCH-10") fail("FINAL_GATE");
  if (surface.release?.public_launch_authorised !== false) fail("PREMATURE_PUBLIC_LAUNCH_AUTHORITY");
  if (surface.closed_world?.enabled !== true) fail("CLOSED_WORLD_DISABLED");
  if (surface.closed_world?.unknown_areas_fail !== true) fail("UNKNOWN_AREA_POLICY");
  if (surface.closed_world?.unknown_functions_fail !== true) fail("UNKNOWN_FUNCTION_POLICY");

  const expectedCategories = [
    "launch_active",
    "launch_operator_only",
    "implemented_not_launched",
    "historical",
    "diagnostic",
    "future"
  ];
  if (!exactSet(surface.classification_categories, expectedCategories)) fail("CLASSIFICATION_VOCABULARY_DRIFT");

  const areas = Array.isArray(ui.product_areas) ? ui.product_areas : [];
  const routes = Array.isArray(ui.routes) ? ui.routes : [];
  const routeById = new Map(routes.map((route) => [route.route_id, route]));
  const functions = areas.flatMap((area) => Array.isArray(area.functions) ? area.functions : []);

  if (areas.length > surface.closed_world.expected_product_area_count) fail("UNKNOWN_AREA_APPEARED", String(areas.length));
  if (areas.length < surface.closed_world.expected_product_area_count) fail("PRODUCT_AREA_OMITTED", String(areas.length));
  if (functions.length > surface.closed_world.expected_function_count) fail("UNKNOWN_FUNCTION_APPEARED", String(functions.length));
  if (functions.length < surface.closed_world.expected_function_count) fail("FUNCTION_OMITTED", String(functions.length));

  const functionIds = functions.map((fn) => fn.function_id);
  if (new Set(functionIds).size !== functionIds.length) fail("DUPLICATE_FUNCTION_ID");
  const areaIds = areas.map((area) => area.area_id);
  if (new Set(areaIds).size !== areaIds.length) fail("DUPLICATE_AREA_ID");

  const partial = functions.filter((fn) => fn.state === "partial");
  const missing = functions.filter((fn) => fn.state === "missing");
  if (partial.length) fail("FULL_UI_PARTIAL", String(partial.length));
  if (missing.length) fail("FULL_UI_MISSING", String(missing.length));
  if (!gapReport.includes("- implemented: 317") || !gapReport.includes("- partial: 0") || !gapReport.includes("- missing: 0")) {
    fail("FULL_UI_REPORT_DRIFT");
  }

  const groups = surface.area_classifications ?? {};
  const activeAreas = groups.launch_active ?? [];
  const operatorAreas = groups.launch_operator_only ?? [];
  const excludedAreas = groups.implemented_not_launched ?? [];
  const historicalAreas = groups.historical ?? [];
  const diagnosticAreas = groups.diagnostic ?? [];
  const futureAreas = groups.future ?? [];

  const launch00Active = launch00.product_areas?.public_launch_candidate ?? [];
  const launch00Operator = launch00.product_areas?.operator_only ?? [];
  const launch00Excluded = launch00.product_areas?.implemented_not_launched ?? [];

  for (const areaId of activeAreas) {
    if (launch00Active.includes(areaId)) continue;
    if (launch00Operator.includes(areaId)) fail("OPERATOR_ONLY_AREA_PUBLIC", areaId);
    else if (launch00Excluded.includes(areaId)) fail("POST_V1_SURFACE_ACTIVE_WITHOUT_AUTHORITY", areaId);
    else fail("ACTIVE_AREA_WITHOUT_RELEASE_AUTHORITY", areaId);
  }
  if (!exactSet(activeAreas, launch00Active)) fail("LAUNCH_ACTIVE_SCOPE_DRIFT");
  if (!exactSet(operatorAreas, launch00Operator)) fail("OPERATOR_SCOPE_DRIFT");
  if (!exactSet(excludedAreas, launch00Excluded)) fail("EXCLUDED_SCOPE_DRIFT");
  if (historicalAreas.length || diagnosticAreas.length || futureAreas.length) fail("UNAUTHORISED_SECONDARY_CLASSIFICATION");

  const classByArea = new Map();
  for (const category of expectedCategories) {
    for (const areaId of groups[category] ?? []) {
      if (classByArea.has(areaId)) fail("AREA_CLASSIFICATION_OVERLAP", areaId);
      classByArea.set(areaId, category);
    }
  }
  if (!exactSet([...classByArea.keys()], areaIds)) {
    const omitted = areaIds.filter((id) => !classByArea.has(id));
    const unknown = [...classByArea.keys()].filter((id) => !areaIds.includes(id));
    fail("AREA_CLASSIFICATION_INCOMPLETE", `omitted=${omitted.join(",")} unknown=${unknown.join(",")}`);
  }

  const overrides = surface.closed_world?.function_overrides ?? {};
  for (const [functionId, override] of Object.entries(overrides)) {
    const located = locateFunction(areas, functionId);
    if (!located) {
      fail("UNKNOWN_FUNCTION_OVERRIDE", functionId);
      continue;
    }
    const baseClass = classByArea.get(located.area.area_id);
    if (override === "launch_active" && baseClass === "launch_operator_only") {
      fail("OPERATOR_ONLY_FUNCTION_PUBLIC", functionId);
    } else if (override === "launch_active" && baseClass !== "launch_active") {
      fail("EXCLUDED_FUNCTION_REACHABLE", functionId);
    } else {
      fail("FUNCTION_OVERRIDE_FORBIDDEN", functionId);
    }
  }

  const publicActors = launch00.actors?.public ?? [];
  const operatorActors = launch00.actors?.operator_only ?? [];
  if (!exactSet(surface.actor_policy?.launch_active, publicActors)) fail("PUBLIC_ACTOR_POLICY_DRIFT");
  if (!exactSet(surface.actor_policy?.launch_operator_only, operatorActors)) fail("OPERATOR_ACTOR_POLICY_DRIFT");

  const crossCutting = new Set(
    (areas.find((area) => area.area_id === surface.reachability_policy?.cross_cutting_area)?.functions ?? [])
      .map((fn) => fn.function_id)
  );
  for (const id of surface.reachability_policy?.cross_cutting_function_exceptions ?? []) crossCutting.add(id);
  const forbiddenPersistence = new Set(surface.reachability_policy?.forbidden_completion_modes ?? []);
  const materialized = [];

  for (const area of areas) {
    const classification = classByArea.get(area.area_id);
    for (const fn of area.functions ?? []) {
      if (!classification) {
        fail("FUNCTION_WITHOUT_CLASSIFICATION", fn.function_id ?? area.area_id);
        continue;
      }
      if (!fn.function_id) fail("FUNCTION_ID_MISSING", area.area_id);
      if (fn.state !== "implemented") fail("CURRENT_FUNCTION_NOT_IMPLEMENTED", String(fn.function_id));

      let effectiveClass = classification;
      if (Object.hasOwn(overrides, fn.function_id)) effectiveClass = overrides[fn.function_id];
      const launchVisible = effectiveClass === "launch_active" || effectiveClass === "launch_operator_only";

      if (launchVisible) {
        if (!fn.direct_test) fail("LAUNCH_FUNCTION_DIRECT_TEST_MISSING", fn.function_id);
        if (forbiddenPersistence.has(fn.persistence)) fail("UNLAWFUL_COMPLETION_MODE", `${fn.function_id}:${fn.persistence}`);
        if (!NON_PERSISTED.has(fn.persistence) && !fn.integration_test) fail("PERSISTENT_INTEGRATION_PROOF_MISSING", fn.function_id);

        if (!crossCutting.has(fn.function_id)) {
          const hasRoute = Boolean(fn.route_id);
          const hasAction = Array.isArray(fn.api_routes) && fn.api_routes.length > 0;
          if (!hasRoute && !hasAction) fail("LAUNCH_FUNCTION_ROUTE_ACTION_MISSING", fn.function_id);
          if (fn.route_id && !routeById.has(fn.route_id)) fail("LAUNCH_FUNCTION_ROUTE_UNKNOWN", `${fn.function_id}:${fn.route_id}`);
        }

        const actors = Array.isArray(fn.actors) ? fn.actors : [];
        if (!actors.length) fail("LAUNCH_FUNCTION_ACTOR_MISSING", fn.function_id);
        if (effectiveClass === "launch_active") {
          for (const actor of actors) {
            if (!publicActors.includes(actor)) fail("LAUNCH_FUNCTION_ACTOR_UNLAWFUL", `${fn.function_id}:${actor}`);
          }
          if (fn.route_id) {
            const route = routeById.get(fn.route_id);
            for (const actor of route?.actors ?? []) {
              if (!publicActors.includes(actor)) fail("PUBLIC_ROUTE_ACTOR_UNLAWFUL", `${fn.route_id}:${actor}`);
            }
          }
        } else {
          for (const actor of actors) {
            if (!operatorActors.includes(actor)) fail("OPERATOR_FUNCTION_ACTOR_UNLAWFUL", `${fn.function_id}:${actor}`);
          }
          if (fn.route_id) {
            const route = routeById.get(fn.route_id);
            for (const actor of route?.actors ?? []) {
              if (publicActors.includes(actor)) fail("OPERATOR_ONLY_ROUTE_PUBLIC", `${fn.route_id}:${actor}`);
            }
          }
        }
      }

      if (effectiveClass === "launch_active" && area.area_id === surface.commercial_policy?.area_id) {
        if (!(surface.commercial_policy?.function_ids ?? []).includes(fn.function_id)) {
          fail("COMMERCIAL_FUNCTION_WITHOUT_AUTHORITY", fn.function_id);
        }
      }

      materialized.push(buildRecord({ area, fn, classification: effectiveClass, routeById, crossCutting, launch00, surface }));
    }
  }

  if (materialized.length !== functions.length) fail("MATERIALIZED_FUNCTION_COUNT_DRIFT");
  if (materialized.some((record) => !expectedCategories.includes(record.launch_classification))) fail("MATERIALIZED_CLASSIFICATION_UNKNOWN");

  const commercialIds = launch00.commercial_surfaces?.permitted_existing_function_ids ?? [];
  if (!exactSet(surface.commercial_policy?.function_ids, commercialIds)) fail("COMMERCIAL_FUNCTION_SCOPE_DRIFT");
  if (!exactSet(surface.commercial_policy?.required_activation_gates, launch00.commercial_surfaces?.activation_requires ?? [])) {
    fail("COMMERCIAL_ACTIVATION_GATE_DRIFT");
  }
  if (surface.commercial_policy?.entitlement_can_change_engine_truth !== false) fail("ENTITLEMENT_ENGINE_OVERRIDE");

  for (const value of Object.values(surface.engine_truth_invariants ?? {})) {
    if (value !== false) fail("ENGINE_TRUTH_INVARIANT_BROKEN");
  }
  if (surface.engine_truth_invariants?.payment_flag_can_change_compile_output !== false) fail("PAYMENT_FLAG_ENGINE_OVERRIDE");
  if (surface.engine_truth_invariants?.ui_state_can_change_compile_output !== false) fail("UI_STATE_ENGINE_OVERRIDE");

  if (!String(fullUiShip.reconciliation_audit?.no_copied_id_workflow ?? "").startsWith("confirmed")) fail("COPIED_ID_PROOF_MISSING");
  if (!String(fullUiShip.reconciliation_audit?.no_raw_database_edit_workflow ?? "").startsWith("confirmed")) fail("RAW_DATABASE_EDIT_PROOF_MISSING");
  if (surface.reachability_policy?.manual_identifier_transfer_is_launch_workflow !== false) fail("COPIED_ID_WORKFLOW_ALLOWED");
  if (surface.reachability_policy?.manual_database_edit_is_launch_workflow !== false) fail("MANUAL_DATABASE_WORKFLOW_ALLOWED");
  if (surface.reachability_policy?.diagnostic_routes_are_product_ui !== false) fail("DIAGNOSTIC_ROUTE_PUBLIC");

  if (gitBlobSha(uiText) !== surface.sources?.ui_function_manifest_blob_sha) fail("UI_MANIFEST_BLOB_PIN_DRIFT");
  if (gitBlobSha(launch00Text) !== surface.sources?.launch_00_boundary_blob_sha) fail("LAUNCH_00_BLOB_PIN_DRIFT");

  if (failures === 0 && emitPath) {
    const counts = Object.fromEntries(expectedCategories.map((category) => [
      category,
      materialized.filter((record) => record.launch_classification === category).length
    ]));
    const payload = {
      schema_version: "LAUNCH-01.MATERIALIZED.1.0.0",
      slice_id: "LAUNCH-01",
      release_id: surface.release.release_id,
      source_ui_manifest_blob_sha: surface.sources.ui_function_manifest_blob_sha,
      counts,
      records: materialized
    };
    fs.writeFileSync(emitPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  }

  if (failures === 0) {
    const activeCount = materialized.filter((record) => record.launch_classification === "launch_active").length;
    const operatorCount = materialized.filter((record) => record.launch_classification === "launch_operator_only").length;
    console.log(`${TOKEN}: PASS functions=${materialized.length} launch_active=${activeCount} operator_only=${operatorCount}`);
  } else {
    process.exitCode = 1;
  }
}

main();
