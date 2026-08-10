// @law: Repo Governance
// @severity: medium
// @scope: repo
/**
 * DEV NOTE: S-V1-P-06 device sync contract-ingestion guard.
 * Purpose: proves device connection and metric ingestion surfaces create factual records only.
 * Boundary: no live provider SDK dependency, no engine import, no provider-computed score ever stored - rejected outright at ingestion.
 * Determinism: reads committed repository files only and emits one stable failure token.
 * Failure: emits CI_V1_DEVICE_SYNC_CONTRACT_INGESTION when device-sync scope widens, a deterministic surface becomes mutable,
 * or S-V1-P-06 code ships without S-V1-P-05's boundary document already in place.
 */

import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const GUARD = "S-V1-P-06";
const TOKEN = "CI_V1_DEVICE_SYNC_CONTRACT_INGESTION";

const FILES = Object.freeze({
  source: "src/v1DeviceSyncContract.mjs",
  service: "src/api/device_sync_service.ts",
  routes: "src/api/device_sync.routes.ts",
  test: "test/s_v1_p_06_device_sync_contract_ingestion.test.mjs",
  guard: "ci/guards/s_v1_p_06_device_sync_contract_ingestion_guard.mjs",
  boundaryDoc: "docs/v1/V1_DEVICE_SYNC_BOUNDARY_CONTRACT.md",
  copy: "copy/device_sync_copy.json",
  packageJson: "package.json",
  guardsIndex: "docs/GUARDS_INDEX.md",
  failureTokenIndex: "docs/dev/FAILURE_TOKEN_INDEX.md"
});

const REQUIRED_SNIPPETS = Object.freeze({
  [FILES.source]: [
    "S_V1_P_06_DEVICE_SYNC_CONTRACT_INGESTION_VERSION",
    "DEVICE_SYNC_PROVIDERS",
    "apple_health",
    "garmin",
    "whoop",
    "manual_import",
    "DEVICE_SYNC_METRIC_TYPES",
    "resting_heart_rate_bpm",
    "steps_count",
    "sleep_duration_minutes",
    "body_weight_kg",
    "createDeviceConnection",
    "disconnectDeviceConnection",
    "handleDeviceSyncIngestionWebhook",
    "assertDeviceSyncNoEngineMutation",
    "DEVICE_SYNC_FORBIDDEN_PROVIDER_SCORE_FIELDS",
    "readiness_score",
    "recovery_score",
    "strain_score",
    "live_provider_call: \"not_performed_in_contract_slice\"",
    "engine_legality: \"not_mutated\"",
    "compile_output: \"not_mutated\"",
    "substitution_selection: \"not_mutated\"",
    "replay_record: \"not_mutated\"",
    "proof_record: \"not_mutated\"",
    "factual_history_record: \"not_mutated\""
  ],
  [FILES.service]: [
    "connectDevice",
    "disconnectDevice",
    "ingestDeviceMetric",
    "listDeviceConnectionsForAthlete",
    "listDeviceMetricHistoryForAthlete",
    "listDeviceConnectionsForCoach",
    "listDeviceMetricHistoryForCoach",
    "device_connection_record",
    "device_metric_entry",
    "logBodyMetricEntryAsDeviceSync"
  ],
  [FILES.routes]: [
    "/connect",
    "/disconnect",
    "/ingest",
    "/connections",
    "/metrics"
  ],
  [FILES.test]: [
    "device connection is a frozen record with an opaque provider account reference",
    "ingestion webhook rejects a payload carrying a provider-computed score field outright",
    "ingestion webhook routes body_weight_kg to body_metric_entry and other metric types to device_metric_entry",
    "device sync result never mutates a deterministic engine surface",
    "disconnect never deletes or edits a prior fact"
  ],
  [FILES.boundaryDoc]: [
    "S-V1-P-05",
    "CI_V1_DEVICE_SYNC_BOUNDARY_CONTRACT"
  ],
  [FILES.copy]: [
    "device_sync.connected",
    "device_sync.disconnected",
    "device_sync.metric_synced",
    "device_sync.provider_score_rejected",
    "device_sync.no_engine_change"
  ],
  [FILES.packageJson]: [
    "node --test test/s_v1_p_06_device_sync_contract_ingestion.test.mjs",
    "node ci/guards/s_v1_p_06_device_sync_contract_ingestion_guard.mjs"
  ],
  [FILES.guardsIndex]: [
    "s_v1_p_06_device_sync_contract_ingestion_guard.mjs"
  ],
  [FILES.failureTokenIndex]: [
    TOKEN
  ]
});

const FORBIDDEN_SOURCE_IMPORTS = Object.freeze([
  "@kolosseum/engine",
  "from \"../engine",
  "from \"./engine",
  "from \"../../engine",
  "engine/src/",
  "from \"garmin-connect\"",
  "from 'garmin-connect'",
  "from \"@garmin/",
  "from \"whoop\"",
  "from 'whoop'",
  "from \"apple-healthkit\"",
  "from 'apple-healthkit'",
  "from \"healthkit\"",
  "from 'healthkit'",
  "from \"google-fit\"",
  "from 'google-fit'",
  "from \"fitbit\"",
  "from 'fitbit'"
]);

const FORBIDDEN_COPY_TERMS = Object.freeze([
  "recommended",
  "recommendation",
  "readiness",
  "recovery",
  "strain",
  "fatigue",
  "medical",
  "diagnosis",
  "rehab",
  "optimal"
]);

const FORBIDDEN_PACKAGE_NAME_FRAGMENTS = Object.freeze([
  "garmin",
  "whoop",
  "healthkit",
  "google-fit",
  "fitbit"
]);

const errors = [];

function fail(message, details = {}) {
  errors.push({ message, details });
}

function read(relativePath) {
  const fullPath = path.join(ROOT, relativePath);
  if (!fs.existsSync(fullPath)) {
    fail(`Missing required file: ${relativePath}`);
    return "";
  }

  return fs.readFileSync(fullPath, "utf8").replace(/\r\n/g, "\n");
}

function assertIncludes(text, needle, file) {
  if (!text.includes(needle)) {
    fail(`${file} must include ${needle}`);
  }
}

function assertNotIncludes(text, needle, file) {
  if (text.includes(needle)) {
    fail(`${file} must not include ${needle}`);
  }
}

for (const file of Object.values(FILES)) {
  read(file);
}

for (const [file, snippets] of Object.entries(REQUIRED_SNIPPETS)) {
  const text = read(file);
  for (const snippet of snippets) {
    assertIncludes(text, snippet, file);
  }
}

const source = read(FILES.source);
const service = read(FILES.service);
const routes = read(FILES.routes);
for (const fileLabel of [FILES.source, FILES.service, FILES.routes]) {
  const text = fileLabel === FILES.source ? source : fileLabel === FILES.service ? service : routes;
  for (const forbiddenImport of FORBIDDEN_SOURCE_IMPORTS) {
    assertNotIncludes(text, forbiddenImport, fileLabel);
  }
}

const copyText = read(FILES.copy).toLowerCase();
for (const term of FORBIDDEN_COPY_TERMS) {
  assertNotIncludes(copyText, term, FILES.copy);
}

const packageJson = JSON.parse(read(FILES.packageJson));
for (const fragment of FORBIDDEN_PACKAGE_NAME_FRAGMENTS) {
  const dependencyNames = [
    ...Object.keys(packageJson.dependencies ?? {}),
    ...Object.keys(packageJson.devDependencies ?? {})
  ];
  if (dependencyNames.some((name) => name.toLowerCase().includes(fragment))) {
    fail(`S-V1-P-06 must not add a live device-provider SDK dependency in this contract slice: ${fragment}`);
  }
}

const guardText = read(FILES.guard);
assertIncludes(guardText, `const TOKEN = "${TOKEN}";`, FILES.guard);
assertIncludes(guardText, "DEV NOTE:", FILES.guard);

if (errors.length > 0) {
  console.error(JSON.stringify({
    ok: false,
    guard: GUARD,
    token: TOKEN,
    failures: errors
  }, null, 2));
  process.exitCode = 1;
}
else {
  console.log(JSON.stringify({
    ok: true,
    guard: "s_v1_p_06_device_sync_contract_ingestion_guard",
    token: TOKEN,
    message: "Device sync contract-ingestion passed."
  }, null, 2));
}
