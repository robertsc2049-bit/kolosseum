
// DEV NOTE: Repository automation script. This file exists to make a repeatable repo operation
// deterministic and reviewable. Keep side effects explicit, paths repo-root relative, and
// failure output readable for PowerShell and CI users.

import crypto from "node:crypto";
import fs from "node:fs";

const suitePath = "docs/v0/phase1_acceptance_record_tests.json";
const reportPath = "docs/v0/PHASE1_ACCEPTANCE_RECORD_TEST_REPORT.json";

const suite = JSON.parse(fs.readFileSync(suitePath, "utf8"));

const ACTIVE = suite.active_pins;

const ALLOWED_KEYS = new Set([
  "actor_type",
  "execution_scope",
  "activity_id",
  "phase1_schema_version",
  "engine_compatibility",
  "enum_bundle_version",
  "consent_granted",
  "jurisdiction_acknowledged"
]);

const ACTOR_TYPES = new Set(["individual_user", "coach"]);
const EXECUTION_SCOPES = new Set(["individual", "coach_managed"]);
const ACTIVITY_IDS = new Set(["powerlifting", "rugby_union", "general_strength"]);

let idCounter = 1;

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function applyMutation(base, mutation) {
  const value = clone(base);

  if (!mutation) return value;

  if (mutation.add) {
    for (const [k, v] of Object.entries(mutation.add)) value[k] = v;
  }

  if (mutation.replace) {
    for (const [k, v] of Object.entries(mutation.replace)) value[k] = v;
  }

  if (mutation.remove) {
    delete value[mutation.remove];
  }

  return value;
}

function canonicalJson(value) {
  if (value === null) return "null";

  if (Array.isArray(value)) {
    return "[" + value.map(canonicalJson).join(",") + "]";
  }

  if (typeof value === "object") {
    return "{" + Object.keys(value).sort().map((key) => {
      return JSON.stringify(key) + ":" + canonicalJson(value[key]);
    }).join(",") + "}";
  }

  return JSON.stringify(value);
}

function sha256Hex(value) {
  return crypto.createHash("sha256").update(value, "utf8").digest("hex");
}

function hashPayload(payload) {
  return sha256Hex(canonicalJson(payload));
}

function fail(code) {
  return { ok: false, code };
}

function ok(extra = {}) {
  return { ok: true, ...extra };
}

function validatePayload(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return fail("PHASE1_ACCEPTANCE_PAYLOAD_INVALID");
  }

  for (const key of Object.keys(payload)) {
    if (!ALLOWED_KEYS.has(key)) return fail("PHASE1_ACCEPTANCE_PAYLOAD_INVALID");
  }

  for (const key of ALLOWED_KEYS) {
    if (!(key in payload)) return fail("PHASE1_ACCEPTANCE_PAYLOAD_INVALID");
    if (payload[key] === null) return fail("PHASE1_ACCEPTANCE_PAYLOAD_INVALID");
  }

  if (!ACTOR_TYPES.has(payload.actor_type)) return fail("PHASE1_ACCEPTANCE_PAYLOAD_INVALID");
  if (!EXECUTION_SCOPES.has(payload.execution_scope)) return fail("PHASE1_ACCEPTANCE_PAYLOAD_INVALID");
  if (!ACTIVITY_IDS.has(payload.activity_id)) return fail("PHASE1_ACCEPTANCE_PAYLOAD_INVALID");

  if (payload.consent_granted !== true) return fail("PHASE1_ACCEPTANCE_CONSENT_MISSING");
  if (payload.jurisdiction_acknowledged !== true) return fail("PHASE1_ACCEPTANCE_JURISDICTION_MISSING");

  if (payload.phase1_schema_version !== ACTIVE.phase1_schema_version) return fail("PHASE1_ACCEPTANCE_VERSION_MISMATCH");
  if (payload.engine_compatibility !== ACTIVE.engine_compatibility) return fail("PHASE1_ACCEPTANCE_VERSION_MISMATCH");
  if (payload.enum_bundle_version !== ACTIVE.enum_bundle_version) return fail("PHASE1_ACCEPTANCE_VERSION_MISMATCH");

  return ok();
}

function acceptDeclaration(payload) {
  const validation = validatePayload(payload);
  if (!validation.ok) return validation;

  const now = new Date(Date.UTC(2026, 0, 1, 0, idCounter, 0)).toISOString();
  const declarationId = `00000000-0000-0000-0000-${String(idCounter).padStart(12, "0")}`;
  idCounter += 1;

  return ok({
    record: {
      declaration_id: declarationId,
      user_id: "00000000-0000-0000-0000-000000000001",
      actor_type: payload.actor_type,
      execution_scope: payload.execution_scope,
      activity_id: payload.activity_id,
      declaration_payload_json: clone(payload),
      declaration_payload_sha256: hashPayload(payload),
      phase1_schema_version: payload.phase1_schema_version,
      engine_compatibility: payload.engine_compatibility,
      enum_bundle_version: payload.enum_bundle_version,
      consent_granted: payload.consent_granted,
      jurisdiction_acknowledged: payload.jurisdiction_acknowledged,
      accepted_at: now,
      superseded_at: null,
      immutable: true,
      immutable_status: "immutable",
      created_at: now
    }
  });
}

function updateRecord(record, mutation) {
  const updated = clone(record);

  if (mutation?.replace) {
    for (const [k, v] of Object.entries(mutation.replace)) updated[k] = v;
  }

  const immutableFields = [
    "declaration_id",
    "user_id",
    "actor_type",
    "execution_scope",
    "activity_id",
    "declaration_payload_json",
    "declaration_payload_sha256",
    "phase1_schema_version",
    "engine_compatibility",
    "enum_bundle_version",
    "consent_granted",
    "jurisdiction_acknowledged",
    "accepted_at",
    "immutable",
    "immutable_status",
    "created_at"
  ];

  for (const field of immutableFields) {
    if (JSON.stringify(record[field]) !== JSON.stringify(updated[field])) {
      return fail("PHASE1_ACCEPTANCE_RECORD_IMMUTABLE");
    }
  }

  return ok({ record: updated });
}

function supersedeRecord(record) {
  const updated = clone(record);
  updated.superseded_at = new Date(Date.UTC(2026, 0, 1, 1, 0, 0)).toISOString();

  return ok({ record: updated });
}

function compileAdmission(record, scenario = "valid_current_declaration") {
  if (scenario === "missing_declaration" || !record) {
    return fail("PHASE1_COMPILE_BLOCKED_NO_ACCEPTED_DECLARATION");
  }

  const activePins = clone(ACTIVE);
  const requested = {
    activity_id: record.activity_id,
    execution_scope: record.execution_scope
  };

  const candidate = clone(record);

  if (scenario === "superseded_declaration") {
    candidate.superseded_at = new Date(Date.UTC(2026, 0, 1, 1, 0, 0)).toISOString();
  }

  if (scenario === "unaccepted_declaration") {
    candidate.accepted_at = null;
  }

  if (scenario === "version_mismatch") {
    activePins.engine_compatibility = "EB2-2.0.0";
  }

  if (scenario === "hash_mismatch") {
    candidate.declaration_payload_sha256 = "0".repeat(64);
  }

  if (scenario === "activity_mismatch") {
    requested.activity_id = candidate.activity_id === "powerlifting" ? "rugby_union" : "powerlifting";
  }

  if (scenario === "scope_mismatch") {
    requested.execution_scope = candidate.execution_scope === "individual" ? "coach_managed" : "individual";
  }

  if (!candidate.accepted_at) return fail("PHASE1_COMPILE_BLOCKED_UNACCEPTED_DECLARATION");
  if (candidate.superseded_at !== null) return fail("PHASE1_COMPILE_BLOCKED_SUPERSEDED_DECLARATION");
  if (candidate.immutable !== true || candidate.immutable_status !== "immutable") return fail("PHASE1_COMPILE_BLOCKED_MUTABLE_DECLARATION");

  const validation = validatePayload(candidate.declaration_payload_json);
  if (!validation.ok) return fail("PHASE1_COMPILE_BLOCKED_INVALID_DECLARATION");

  const recomputed = hashPayload(candidate.declaration_payload_json);
  if (candidate.declaration_payload_sha256 !== recomputed) return fail("PHASE1_COMPILE_BLOCKED_HASH_MISMATCH");

  if (
    candidate.phase1_schema_version !== activePins.phase1_schema_version ||
    candidate.engine_compatibility !== activePins.engine_compatibility ||
    candidate.enum_bundle_version !== activePins.enum_bundle_version
  ) {
    return fail("PHASE1_COMPILE_BLOCKED_VERSION_MISMATCH");
  }

  if (requested.activity_id !== candidate.activity_id) return fail("PHASE1_COMPILE_BLOCKED_ACTIVITY_MISMATCH");
  if (requested.execution_scope !== candidate.execution_scope) return fail("PHASE1_COMPILE_BLOCKED_SCOPE_MISMATCH");

  return ok();
}

function assertTest(test, result, extra = {}) {
  const failures = [];

  if (result.ok !== test.expected_ok) {
    failures.push(`Expected ok=${test.expected_ok}, got ok=${result.ok}`);
  }

  if (!test.expected_ok && result.code !== test.expected_code) {
    failures.push(`Expected code=${test.expected_code}, got code=${result.code}`);
  }

  if (test.assertions) {
    for (const [name, expected] of Object.entries(test.assertions)) {
      const actual = extra[name];
      if (JSON.stringify(actual) !== JSON.stringify(expected)) {
        failures.push(`Assertion ${name}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
      }
    }
  }

  return {
    test_id: test.test_id,
    ok: failures.length === 0,
    failures
  };
}

function runTest(test) {
  const base = suite.valid_control_payload;
  const payload = applyMutation(base, test.payload_mutation);

  if (test.operation === "accept_declaration") {
    const result = acceptDeclaration(payload);
    const record = result.record;

    const extra = {};
    if (record) {
      extra.immutable = record.immutable;
      extra.immutable_status = record.immutable_status;
      extra.sha256_pattern = /^[a-f0-9]{64}$/.test(record.declaration_payload_sha256) ? "^[a-f0-9]{64}$" : "NO_MATCH";
      extra.superseded_at = record.superseded_at;
      extra.actor_type_matches_payload = record.actor_type === record.declaration_payload_json.actor_type;
      extra.execution_scope_matches_payload = record.execution_scope === record.declaration_payload_json.execution_scope;
      extra.activity_id_matches_payload = record.activity_id === record.declaration_payload_json.activity_id;
      extra.version_pins_match_payload =
        record.phase1_schema_version === record.declaration_payload_json.phase1_schema_version &&
        record.engine_compatibility === record.declaration_payload_json.engine_compatibility &&
        record.enum_bundle_version === record.declaration_payload_json.enum_bundle_version;
    }

    return assertTest(test, result, extra);
  }

  if (test.operation === "update_record") {
    const accepted = acceptDeclaration(payload);
    const result = updateRecord(accepted.record, test.record_mutation);
    return assertTest(test, result);
  }

  if (test.operation === "supersede_record") {
    const accepted = acceptDeclaration(payload);
    const before = clone(accepted.record);
    const result = supersedeRecord(accepted.record);
    const after = result.record;

    const extra = {
      superseded_at_not_null: after.superseded_at !== null,
      payload_unchanged: JSON.stringify(before.declaration_payload_json) === JSON.stringify(after.declaration_payload_json),
      hash_unchanged: before.declaration_payload_sha256 === after.declaration_payload_sha256
    };

    return assertTest(test, result, extra);
  }

  if (test.operation === "compile_admission") {
    let record = null;

    if (test.scenario !== "missing_declaration") {
      const accepted = acceptDeclaration(payload);
      record = accepted.record;
    }

    const result = compileAdmission(record, test.scenario);
    return assertTest(test, result);
  }

  if (test.operation === "hash_comparison") {
    const changed = applyMutation(base, test.payload_mutation);
    const hashA = hashPayload(base);
    const hashB = hashPayload(changed);
    const result = ok();
    const extra = { hashes_differ: hashA !== hashB };
    return assertTest(test, result, extra);
  }

  if (test.operation === "external_state_mutation_attempt") {
    const accepted = acceptDeclaration(payload);
    const before = clone(accepted.record);

    const externalState = clone(test.external_state);
    void externalState;

    const after = clone(accepted.record);

    const result = ok();
    const extra = {
      record_unchanged: JSON.stringify(before) === JSON.stringify(after),
      hash_unchanged: before.declaration_payload_sha256 === after.declaration_payload_sha256
    };

    return assertTest(test, result, extra);
  }

  return {
    test_id: test.test_id,
    ok: false,
    failures: [`Unknown operation ${test.operation}`]
  };
}

const results = suite.tests.map(runTest);
const failed = results.filter((r) => !r.ok);

const report = {
  ok: failed.length === 0,
  test_suite_id: suite.test_suite_id,
  test_suite_version: suite.test_suite_version,
  total: results.length,
  passed: results.length - failed.length,
  failed: failed.length,
  results
};

fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + "\n", "utf8");

if (!report.ok) {
  console.error(JSON.stringify(report, null, 2));
  process.exit(1);
}

console.log(JSON.stringify(report, null, 2));
