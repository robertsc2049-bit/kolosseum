// DEV NOTE: FULL-UI-31 / S-V1-P-06 device sync static surface contract.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const contract = read("src/v1DeviceSyncContract.mjs");
const service = read("src/api/device_sync_service.ts");
const routes = read("src/api/device_sync.routes.ts");
const serverTs = read("src/server.ts");
const schema = read("schema.sql");
const recordStore = read("src/api/beta_product_record_store.ts");
const appJs = read("public/app/app.js");
const indexHtml = read("public/app/index.html");
const manifest = JSON.parse(read("product/ui/function_manifest.json"));

const forbiddenEngineImports = /session_state_write_service\.js|session_state_query_service\.js|block_compile_write_service\.js|engine_runner_service\.js|@kolosseum\/engine|engine\/src\//u;

test("device sync is mounted at its own /device-sync prefix with the expected routes", () => {
  assert.match(serverTs, /app\.use\("\/device-sync", deviceSyncRouter\)/u);

  for (const routePath of [
    '"/connect"',
    '"/disconnect"',
    '"/ingest"',
    '"/connections"',
    '"/connections/coach/:athlete_user_id"',
    '"/metrics"',
    '"/metrics/coach/:athlete_user_id"'
  ]) {
    assert.ok(routes.includes(routePath), `expected device sync route ${routePath}`);
  }
});

test("identity is resolved from the session cookie only, never a client-supplied user_id", () => {
  assert.doesNotMatch(routes, /request\.body\.(?:coach_|athlete_)?user_id|request\.query\.(?:coach_|athlete_)?user_id/u);
  assert.match(routes, /async function authenticatedAthlete/u);
  assert.match(routes, /authenticatedAthlete\(request, true\)/u);
  assert.match(routes, /authenticatedAthlete\(request, false\)/u);
});

test("connect, disconnect and ingest are athlete-self only - the coach surface is deliberately read-only, list-only", () => {
  assert.match(routes, /deviceSyncRouter\.post\(\s*"\/connect"/u);
  assert.match(routes, /deviceSyncRouter\.post\(\s*"\/disconnect"/u);
  assert.match(routes, /deviceSyncRouter\.post\(\s*"\/ingest"/u);
  assert.doesNotMatch(routes, /authenticatedCoach\(request, true\)/u, "no coach write path anywhere in this file");
});

test("no live provider SDK is imported anywhere in the contract, service or routes", () => {
  for (const source of [contract, service, routes]) {
    assert.doesNotMatch(source, forbiddenEngineImports);
    assert.doesNotMatch(source, /from ["']garmin|from ["']whoop|from ["']apple-healthkit|from ["']healthkit|from ["']google-fit|from ["']fitbit/iu);
  }
});

test("a provider-computed score field is rejected outright, not silently dropped", () => {
  assert.match(contract, /DEVICE_SYNC_FORBIDDEN_PROVIDER_SCORE_FIELDS/u);
  assert.match(contract, /readiness_score/u);
  assert.match(contract, /recovery_score/u);
  assert.match(contract, /strain_score/u);
  assert.match(contract, /PROVIDER_SCORE_FIELD_REJECTED/u);
});

test("device_connection_record and device_metric_entry are wired into the shared record store's supported-type surface", () => {
  for (const recordType of ["device_connection_record", "device_metric_entry"]) {
    assert.match(recordStore, new RegExp(`"${recordType}"`, "u"));
    assert.match(recordStore, new RegExp(`case "${recordType}":`, "u"));
  }
  assert.match(schema, /beta_product_records_full_ui_31_type_migration/u);
  for (const recordType of ["device_connection_record", "device_metric_entry"]) {
    assert.match(schema, new RegExp(`'${recordType}'`, "u"));
  }
});

test("every stored device-sync record is a factual, immutable, engine-invisible fact - never scored or inferred", () => {
  for (const field of [
    "factual_user_supplied_state: true",
    "immutable_reference_history: true",
    "inference_applied: false",
    "readiness_semantics: false",
    "safety_semantics: false",
    "suitability_semantics: false",
    "recommendation_semantics: false",
    "engine_visible: false",
    "compile_reference_visible: false"
  ]) {
    assert.ok(service.includes(field), `expected device_sync_service.ts to declare ${field}`);
  }
});

test("weight ingestion routes through body_metrics_service with source device_synced, never a duplicated fact type", () => {
  assert.match(service, /logBodyMetricEntryAsDeviceSync/u);
  assert.match(service, /routing_target === "body_metric_entry"/u);
});

test("disconnect reads the prior fact and appends a new status fact - it never issues an UPDATE or DELETE", () => {
  assert.doesNotMatch(service, /UPDATE\s+beta_product_records|DELETE\s+FROM\s+beta_product_records/iu);
  assert.match(service, /disconnectDeviceConnection/u);
});

test("the athlete connect form and coach read-only panels exist as real controls, and rendered text is escaped", () => {
  assert.match(indexHtml, /id="deviceConnectForm"/u);
  assert.match(indexHtml, /id="deviceConnectionList"/u);
  assert.match(indexHtml, /id="deviceMetricHistory"/u);
  assert.match(indexHtml, /id="athleteDetailDeviceConnectionList"/u);
  assert.match(indexHtml, /id="athleteDetailDeviceMetricHistory"/u);

  assert.match(appJs, /async function refreshDeviceSync/u);
  assert.match(appJs, /async function connectDeviceSync/u);
  assert.match(appJs, /async function disconnectDeviceSync/u);
  assert.match(appJs, /async function refreshCoachAthleteDeviceSync/u);
  assert.match(appJs, /escapeHtml\(providerLabel\)/u);
});

test("device metric history renders a 'Synced from <provider>' source badge, never a bare provider score", () => {
  assert.match(appJs, /Synced from \$\{escapeHtml\(providerLabel\)\}/u);
});

test("the FULL-UI-31 manifest area declares all six functions as implemented with real tests", () => {
  const area = manifest.product_areas.find((entry) => entry.area_id === "device_sync");
  assert.ok(area, "expected a device_sync product area");
  assert.equal(area.slice_id, "FULL-UI-31");
  assert.equal(area.state, "implemented");

  const functionIds = area.functions.map((fn) => fn.function_id);
  assert.deepEqual(
    functionIds.sort(),
    [
      "device_connect",
      "device_connections_list_athlete",
      "device_disconnect",
      "device_metric_history_athlete",
      "device_metric_history_coach",
      "device_metric_ingest"
    ]
  );

  for (const fn of area.functions) {
    assert.equal(fn.state, "implemented");
    assert.equal(fn.integration_test, "test/s_v1_p_06_device_sync_contract_ingestion_persistent.integration.test.mjs");
    assert.ok(fn.direct_test);
  }

  assert.ok(manifest.delivery_slices.some((slice) => slice.slice_id === "FULL-UI-31" && slice.state === "implemented"));
});
