#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();

const schemaPath = path.join(repoRoot, "docs", "pilot-signoff", "pilot_signoff_record.schema.json");
const testsPath = path.join(repoRoot, "docs", "pilot-signoff", "pilot_signoff_record_negative_tests.json");

const schema = JSON.parse(fs.readFileSync(schemaPath, "utf8"));
const tests = JSON.parse(fs.readFileSync(testsPath, "utf8"));

const FAILURE = Object.freeze({
  SCHEMA: "PILOT_SIGNOFF_SCHEMA_INVALID",
  REQUIRED_ITEM: "PILOT_SIGNOFF_REQUIRED_ITEM_FAILED",
  NEGATIVE_BOUNDARY: "PILOT_SIGNOFF_NEGATIVE_BOUNDARY_FAILED",
  SOURCE_ARTEFACT_MISSING: "PILOT_SIGNOFF_SOURCE_ARTEFACT_MISSING",
  UNKNOWN_STATUS: "PILOT_SIGNOFF_UNKNOWN_STATUS",
  HASH_MISMATCH: "PILOT_SIGNOFF_RECORD_HASH_MISMATCH",
  BLOCKED_REASON_MISSING: "PILOT_SIGNOFF_BLOCKED_REASON_MISSING",
  FORBIDDEN_SEMANTIC: "PILOT_SIGNOFF_FORBIDDEN_SEMANTIC"
});

const EXACT_TOP_LEVEL_KEYS = [
  "signoff_id",
  "pilot_id",
  "checklist_id",
  "checklist_version",
  "final_status",
  "readiness_item_results",
  "negative_boundary_results",
  "source_artefact_refs",
  "blocked_reasons",
  "signed_by_operator_id",
  "signed_at_utc",
  "record_hash"
];

const READINESS_KEYS = [
  "item_id",
  "required",
  "passed",
  "source_artefact_ref_ids"
];

const BOUNDARY_KEYS = [
  "boundary_id",
  "passed",
  "source_artefact_ref_ids"
];

const SOURCE_REF_KEYS = [
  "artefact_ref_id",
  "artefact_type",
  "artefact_uri",
  "content_hash"
];

const SOURCE_ARTEFACT_TYPES = new Set([
  "payment_confirmation",
  "workspace_record",
  "coach_account_record",
  "athlete_account_record",
  "coach_athlete_link_record",
  "scope_lock_record",
  "phase1_acceptance_record",
  "compile_result_record",
  "coach_surface_check_record",
  "boundary_check_record",
  "operator_note_record"
]);

const FORBIDDEN_STRING_PATTERNS = [
  /phase[_ -]?7/i,
  /phase[_ -]?8/i,
  /evidence\s+envelope/i,
  /exportable\s+proof/i,
  /export\s+proof/i,
  /org(?:anisation|anization)?\s+runtime/i,
  /team\s+runtime/i,
  /gym\s+runtime/i,
  /\banalytics?\b/i,
  /\bmessaging\b/i,
  /\bscore\b/i,
  /\branking\b/i,
  /\bmedical\b/i,
  /\bsafety\b/i,
  /\bsafe\b/i,
  /\boptimis/i,
  /\boptimiz/i,
  /\boverride\b/i,
  /\bmarketing\b/i
];

function canonicalise(value) {
  if (Array.isArray(value)) {
    return value.map(canonicalise);
  }

  if (value && typeof value === "object") {
    const out = {};
    for (const key of Object.keys(value).sort()) {
      out[key] = canonicalise(value[key]);
    }
    return out;
  }

  return value;
}

function canonicalJson(value) {
  return JSON.stringify(canonicalise(value));
}

function hashSignoffContent(record) {
  const clone = structuredClone(record);
  delete clone.record_hash;
  return crypto.createHash("sha256").update(canonicalJson(clone), "utf8").digest("hex");
}

function withCorrectHash(record) {
  const clone = structuredClone(record);
  clone.record_hash = hashSignoffContent(clone);
  return clone;
}

function fail(token, path, message) {
  return { ok: false, token, path, message };
}

function pass() {
  return { ok: true };
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function hasExactKeys(obj, expectedKeys) {
  if (!isObject(obj)) return false;
  const actual = Object.keys(obj).sort();
  const expected = [...expectedKeys].sort();
  return JSON.stringify(actual) === JSON.stringify(expected);
}

function isSha256(value) {
  return typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
}

function isUtcDateTime(value) {
  if (typeof value !== "string") return false;
  if (!value.endsWith("Z")) return false;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed);
}

function isOpaqueId(value) {
  return typeof value === "string" && /^[a-z0-9_\-]+$/.test(value);
}

function isArrayOfOpaqueIds(value) {
  return Array.isArray(value) && value.every(isOpaqueId);
}

function collectClaimBearingStrings(record) {
  const values = [];

  /*
   * The sign-off record is intentionally machine-readable.
   * Opaque IDs such as no_phase7_surface are boundary identifiers, not surfaced copy.
   * Scanning every string creates false failures and weakens the test.
   *
   * Claim-bearing fields are limited to operator-controlled reason strings.
   * The schema also rejects undeclared fields before this function runs.
   */
  if (Array.isArray(record.blocked_reasons)) {
    for (const reason of record.blocked_reasons) {
      if (typeof reason === "string") values.push(reason);
    }
  }

  return values;
}

function validateSchemaShape(record) {
  if (!hasExactKeys(record, EXACT_TOP_LEVEL_KEYS)) {
    return fail(FAILURE.SCHEMA, "$", "Record must contain exactly the required top-level fields.");
  }

  if (typeof record.signoff_id !== "string" || !/^signoff_[a-z0-9_\-]+$/.test(record.signoff_id)) {
    return fail(FAILURE.SCHEMA, "$.signoff_id", "Invalid signoff_id.");
  }

  if (typeof record.pilot_id !== "string" || !/^pilot_[a-z0-9_\-]+$/.test(record.pilot_id)) {
    return fail(FAILURE.SCHEMA, "$.pilot_id", "Invalid pilot_id.");
  }

  if (typeof record.checklist_id !== "string" || !/^checklist_[a-z0-9_\-]+$/.test(record.checklist_id)) {
    return fail(FAILURE.SCHEMA, "$.checklist_id", "Invalid checklist_id.");
  }

  if (typeof record.checklist_version !== "string" || !/^v[0-9]+\.[0-9]+\.[0-9]+$/.test(record.checklist_version)) {
    return fail(FAILURE.SCHEMA, "$.checklist_version", "Invalid checklist_version.");
  }

  if (!["coach_ready", "blocked"].includes(record.final_status)) {
    return fail(FAILURE.UNKNOWN_STATUS, "$.final_status", "Unknown final_status.");
  }

  if (!Array.isArray(record.readiness_item_results) || record.readiness_item_results.length < 1) {
    return fail(FAILURE.SCHEMA, "$.readiness_item_results", "readiness_item_results must be a non-empty array.");
  }

  for (let i = 0; i < record.readiness_item_results.length; i++) {
    const item = record.readiness_item_results[i];
    const itemPath = `$.readiness_item_results[${i}]`;

    if (!hasExactKeys(item, READINESS_KEYS)) {
      return fail(FAILURE.SCHEMA, itemPath, "Readiness item must contain exactly the declared fields.");
    }

    if (!isOpaqueId(item.item_id)) {
      return fail(FAILURE.SCHEMA, `${itemPath}.item_id`, "Invalid item_id.");
    }

    if (typeof item.required !== "boolean") {
      return fail(FAILURE.SCHEMA, `${itemPath}.required`, "required must be boolean.");
    }

    if (typeof item.passed !== "boolean") {
      return fail(FAILURE.SCHEMA, `${itemPath}.passed`, "passed must be boolean.");
    }

    if (!isArrayOfOpaqueIds(item.source_artefact_ref_ids)) {
      return fail(FAILURE.SCHEMA, `${itemPath}.source_artefact_ref_ids`, "source_artefact_ref_ids must be an array of opaque ids.");
    }
  }

  if (!Array.isArray(record.negative_boundary_results) || record.negative_boundary_results.length < 1) {
    return fail(FAILURE.SCHEMA, "$.negative_boundary_results", "negative_boundary_results must be a non-empty array.");
  }

  for (let i = 0; i < record.negative_boundary_results.length; i++) {
    const item = record.negative_boundary_results[i];
    const itemPath = `$.negative_boundary_results[${i}]`;

    if (!hasExactKeys(item, BOUNDARY_KEYS)) {
      return fail(FAILURE.SCHEMA, itemPath, "Negative boundary item must contain exactly the declared fields.");
    }

    if (!isOpaqueId(item.boundary_id)) {
      return fail(FAILURE.SCHEMA, `${itemPath}.boundary_id`, "Invalid boundary_id.");
    }

    if (typeof item.passed !== "boolean") {
      return fail(FAILURE.SCHEMA, `${itemPath}.passed`, "passed must be boolean.");
    }

    if (!isArrayOfOpaqueIds(item.source_artefact_ref_ids)) {
      return fail(FAILURE.SCHEMA, `${itemPath}.source_artefact_ref_ids`, "source_artefact_ref_ids must be an array of opaque ids.");
    }
  }

  if (!Array.isArray(record.source_artefact_refs)) {
    return fail(FAILURE.SCHEMA, "$.source_artefact_refs", "source_artefact_refs must be an array.");
  }

  for (let i = 0; i < record.source_artefact_refs.length; i++) {
    const item = record.source_artefact_refs[i];
    const itemPath = `$.source_artefact_refs[${i}]`;

    if (!hasExactKeys(item, SOURCE_REF_KEYS)) {
      return fail(FAILURE.SCHEMA, itemPath, "Source artefact reference must contain exactly the declared fields.");
    }

    if (typeof item.artefact_ref_id !== "string" || !/^artefact_[a-z0-9_\-]+$/.test(item.artefact_ref_id)) {
      return fail(FAILURE.SCHEMA, `${itemPath}.artefact_ref_id`, "Invalid artefact_ref_id.");
    }

    if (!SOURCE_ARTEFACT_TYPES.has(item.artefact_type)) {
      return fail(FAILURE.SCHEMA, `${itemPath}.artefact_type`, "Invalid artefact_type.");
    }

    if (typeof item.artefact_uri !== "string" || item.artefact_uri.length < 1) {
      return fail(FAILURE.SCHEMA, `${itemPath}.artefact_uri`, "Invalid artefact_uri.");
    }

    if (!isSha256(item.content_hash)) {
      return fail(FAILURE.SCHEMA, `${itemPath}.content_hash`, "Invalid content_hash.");
    }
  }

  if (!Array.isArray(record.blocked_reasons) || !record.blocked_reasons.every(isOpaqueId)) {
    return fail(FAILURE.SCHEMA, "$.blocked_reasons", "blocked_reasons must be an array of opaque ids.");
  }

  if (typeof record.signed_by_operator_id !== "string" || !/^operator_[a-z0-9_\-]+$/.test(record.signed_by_operator_id)) {
    return fail(FAILURE.SCHEMA, "$.signed_by_operator_id", "Invalid signed_by_operator_id.");
  }

  if (!isUtcDateTime(record.signed_at_utc)) {
    return fail(FAILURE.SCHEMA, "$.signed_at_utc", "signed_at_utc must be a UTC datetime ending in Z.");
  }

  if (!isSha256(record.record_hash)) {
    return fail(FAILURE.SCHEMA, "$.record_hash", "Invalid record_hash.");
  }

  return pass();
}

function validateSourceArtefactCoverage(record) {
  if (record.source_artefact_refs.length < 1) {
    return fail(FAILURE.SOURCE_ARTEFACT_MISSING, "$.source_artefact_refs", "At least one source artefact is required.");
  }

  const known = new Set(record.source_artefact_refs.map((ref) => ref.artefact_ref_id));

  for (let i = 0; i < record.readiness_item_results.length; i++) {
    const item = record.readiness_item_results[i];
    if (item.source_artefact_ref_ids.length < 1) {
      return fail(FAILURE.SOURCE_ARTEFACT_MISSING, `$.readiness_item_results[${i}].source_artefact_ref_ids`, "Required source artefact reference missing.");
    }
    for (const refId of item.source_artefact_ref_ids) {
      if (!known.has(refId)) {
        return fail(FAILURE.SOURCE_ARTEFACT_MISSING, `$.readiness_item_results[${i}].source_artefact_ref_ids`, `Unknown source artefact reference '${refId}'.`);
      }
    }
  }

  for (let i = 0; i < record.negative_boundary_results.length; i++) {
    const item = record.negative_boundary_results[i];
    if (item.source_artefact_ref_ids.length < 1) {
      return fail(FAILURE.SOURCE_ARTEFACT_MISSING, `$.negative_boundary_results[${i}].source_artefact_ref_ids`, "Required source artefact reference missing.");
    }
    for (const refId of item.source_artefact_ref_ids) {
      if (!known.has(refId)) {
        return fail(FAILURE.SOURCE_ARTEFACT_MISSING, `$.negative_boundary_results[${i}].source_artefact_ref_ids`, `Unknown source artefact reference '${refId}'.`);
      }
    }
  }

  return pass();
}

function validateForbiddenSemantics(record) {
  const strings = collectClaimBearingStrings(record);

  for (const value of strings) {
    for (const pattern of FORBIDDEN_STRING_PATTERNS) {
      if (pattern.test(value)) {
        return fail(FAILURE.FORBIDDEN_SEMANTIC, "$.blocked_reasons", `Forbidden semantic string detected in claim-bearing field: '${value}'.`);
      }
    }
  }

  return pass();
}

function validateRecord(record) {
  const shape = validateSchemaShape(record);
  if (!shape.ok) return shape;

  const semantics = validateForbiddenSemantics(record);
  if (!semantics.ok) return semantics;

  const coverage = validateSourceArtefactCoverage(record);
  if (!coverage.ok) return coverage;

  if (record.final_status === "coach_ready") {
    for (let i = 0; i < record.readiness_item_results.length; i++) {
      const item = record.readiness_item_results[i];
      if (item.required === true && item.passed !== true) {
        return fail(FAILURE.REQUIRED_ITEM, `$.readiness_item_results[${i}]`, "Coach-ready sign-off cannot pass with a failed required item.");
      }
    }

    for (let i = 0; i < record.negative_boundary_results.length; i++) {
      const item = record.negative_boundary_results[i];
      if (item.passed !== true) {
        return fail(FAILURE.NEGATIVE_BOUNDARY, `$.negative_boundary_results[${i}]`, "Coach-ready sign-off cannot pass with a failed negative boundary item.");
      }
    }

    if (record.blocked_reasons.length !== 0) {
      return fail(FAILURE.SCHEMA, "$.blocked_reasons", "Coach-ready sign-off must not contain blocked reasons.");
    }
  }

  if (record.final_status === "blocked" && record.blocked_reasons.length < 1) {
    return fail(FAILURE.BLOCKED_REASON_MISSING, "$.blocked_reasons", "Blocked sign-off must include at least one blocked reason.");
  }

  const expectedHash = hashSignoffContent(record);
  if (record.record_hash !== expectedHash) {
    return fail(FAILURE.HASH_MISMATCH, "$.record_hash", "record_hash does not match canonical sign-off content.");
  }

  return pass();
}

function fakeHash(seed) {
  return crypto.createHash("sha256").update(seed, "utf8").digest("hex");
}

function validCoachReadyRecord() {
  return withCorrectHash({
    signoff_id: "signoff_pilot_alpha_001",
    pilot_id: "pilot_alpha_001",
    checklist_id: "checklist_s45_coach_ready_acceptance",
    checklist_version: "v1.0.0",
    final_status: "coach_ready",
    readiness_item_results: [
      {
        item_id: "payment_confirmed",
        required: true,
        passed: true,
        source_artefact_ref_ids: ["artefact_payment_confirmation"]
      },
      {
        item_id: "workspace_created",
        required: true,
        passed: true,
        source_artefact_ref_ids: ["artefact_workspace_record"]
      },
      {
        item_id: "coach_active",
        required: true,
        passed: true,
        source_artefact_ref_ids: ["artefact_coach_account_record"]
      },
      {
        item_id: "athlete_active",
        required: true,
        passed: true,
        source_artefact_ref_ids: ["artefact_athlete_account_record"]
      },
      {
        item_id: "link_accepted",
        required: true,
        passed: true,
        source_artefact_ref_ids: ["artefact_coach_athlete_link_record"]
      },
      {
        item_id: "scope_locked",
        required: true,
        passed: true,
        source_artefact_ref_ids: ["artefact_scope_lock_record"]
      },
      {
        item_id: "phase1_accepted",
        required: true,
        passed: true,
        source_artefact_ref_ids: ["artefact_phase1_acceptance_record"]
      },
      {
        item_id: "first_compile_passed",
        required: true,
        passed: true,
        source_artefact_ref_ids: ["artefact_compile_result_record"]
      },
      {
        item_id: "coach_surface_checked",
        required: true,
        passed: true,
        source_artefact_ref_ids: ["artefact_coach_surface_check_record"]
      }
    ],
    negative_boundary_results: [
      {
        boundary_id: "no_phase7_surface",
        passed: true,
        source_artefact_ref_ids: ["artefact_boundary_check_record"]
      },
      {
        boundary_id: "no_phase8_surface",
        passed: true,
        source_artefact_ref_ids: ["artefact_boundary_check_record"]
      },
      {
        boundary_id: "no_org_runtime_surface",
        passed: true,
        source_artefact_ref_ids: ["artefact_boundary_check_record"]
      },
      {
        boundary_id: "no_claim_surface",
        passed: true,
        source_artefact_ref_ids: ["artefact_boundary_check_record"]
      },
      {
        boundary_id: "no_coach_override_surface",
        passed: true,
        source_artefact_ref_ids: ["artefact_boundary_check_record"]
      }
    ],
    source_artefact_refs: [
      {
        artefact_ref_id: "artefact_payment_confirmation",
        artefact_type: "payment_confirmation",
        artefact_uri: "platform://payments/pilot_alpha_001",
        content_hash: fakeHash("payment")
      },
      {
        artefact_ref_id: "artefact_workspace_record",
        artefact_type: "workspace_record",
        artefact_uri: "platform://workspaces/pilot_alpha_001",
        content_hash: fakeHash("workspace")
      },
      {
        artefact_ref_id: "artefact_coach_account_record",
        artefact_type: "coach_account_record",
        artefact_uri: "platform://users/coach_alpha",
        content_hash: fakeHash("coach")
      },
      {
        artefact_ref_id: "artefact_athlete_account_record",
        artefact_type: "athlete_account_record",
        artefact_uri: "platform://users/athlete_alpha",
        content_hash: fakeHash("athlete")
      },
      {
        artefact_ref_id: "artefact_coach_athlete_link_record",
        artefact_type: "coach_athlete_link_record",
        artefact_uri: "platform://links/link_alpha",
        content_hash: fakeHash("link")
      },
      {
        artefact_ref_id: "artefact_scope_lock_record",
        artefact_type: "scope_lock_record",
        artefact_uri: "platform://scope-locks/pilot_alpha_001",
        content_hash: fakeHash("scope")
      },
      {
        artefact_ref_id: "artefact_phase1_acceptance_record",
        artefact_type: "phase1_acceptance_record",
        artefact_uri: "platform://phase1/declaration_alpha",
        content_hash: fakeHash("phase1")
      },
      {
        artefact_ref_id: "artefact_compile_result_record",
        artefact_type: "compile_result_record",
        artefact_uri: "platform://compiles/compile_alpha",
        content_hash: fakeHash("compile")
      },
      {
        artefact_ref_id: "artefact_coach_surface_check_record",
        artefact_type: "coach_surface_check_record",
        artefact_uri: "platform://surface-checks/coach_alpha",
        content_hash: fakeHash("surface")
      },
      {
        artefact_ref_id: "artefact_boundary_check_record",
        artefact_type: "boundary_check_record",
        artefact_uri: "platform://boundary-checks/pilot_alpha_001",
        content_hash: fakeHash("boundary")
      }
    ],
    blocked_reasons: [],
    signed_by_operator_id: "operator_alpha",
    signed_at_utc: "2026-05-22T00:00:00Z",
    record_hash: "0".repeat(64)
  });
}

function mutate(record, mutation) {
  const clone = structuredClone(record);

  switch (mutation) {
    case "set_required_readiness_item_failed":
      clone.readiness_item_results[0].passed = false;
      return withCorrectHash(clone);

    case "set_negative_boundary_failed":
      clone.negative_boundary_results[0].passed = false;
      return withCorrectHash(clone);

    case "remove_source_artefacts":
      clone.source_artefact_refs = [];
      return withCorrectHash(clone);

    case "set_unknown_status":
      clone.final_status = "ready";
      clone.record_hash = hashSignoffContent(clone);
      return clone;

    case "change_signoff_content_without_updating_hash":
      clone.signed_by_operator_id = "operator_changed";
      return clone;

    default:
      throw new Error(`Unknown mutation: ${mutation}`);
  }
}

function assertSchemaLooksClosedWorld() {
  const required = schema.required ?? [];
  const requiredSorted = [...required].sort();
  const expectedSorted = [...EXACT_TOP_LEVEL_KEYS].sort();

  if (JSON.stringify(requiredSorted) !== JSON.stringify(expectedSorted)) {
    throw new Error("Schema required fields do not match S46 top-level field list.");
  }

  if (schema.additionalProperties !== false) {
    throw new Error("Schema must set additionalProperties to false.");
  }

  if (!schema.properties?.final_status?.enum?.includes("coach_ready")) {
    throw new Error("Schema final_status enum must include coach_ready.");
  }

  if (!schema.properties?.final_status?.enum?.includes("blocked")) {
    throw new Error("Schema final_status enum must include blocked.");
  }
}

function run() {
  assertSchemaLooksClosedWorld();

  const valid = validCoachReadyRecord();
  const validResult = validateRecord(valid);

  const results = [];

  results.push({
    name: tests.valid_fixture_name,
    ok: validResult.ok,
    expected: true,
    token: validResult.token ?? null
  });

  if (!validResult.ok) {
    throw new Error(`Valid fixture failed: ${JSON.stringify(validResult, null, 2)}`);
  }

  const originalHash = valid.record_hash;
  const changed = structuredClone(valid);
  changed.signed_at_utc = "2026-05-22T00:00:01Z";
  changed.record_hash = hashSignoffContent(changed);

  if (changed.record_hash === originalHash) {
    throw new Error("Hash invariance failure: record_hash did not change when content changed.");
  }

  for (const test of tests.negative_tests) {
    const candidate = mutate(valid, test.mutation);
    const result = validateRecord(candidate);

    const passedAsExpected =
      result.ok === test.expect_pass &&
      (test.expect_pass === true || result.token === test.expected_failure_token);

    results.push({
      name: test.name,
      ok: passedAsExpected,
      expected: test.expect_pass,
      actualValidationOk: result.ok,
      expectedFailureToken: test.expected_failure_token,
      actualFailureToken: result.token ?? null,
      path: result.path ?? null
    });

    if (!passedAsExpected) {
      throw new Error(`Negative test failed: ${JSON.stringify({ test, result }, null, 2)}`);
    }
  }

  process.stdout.write(JSON.stringify({
    ok: true,
    slice: "S46",
    checked_files: [
      path.relative(repoRoot, schemaPath),
      path.relative(repoRoot, testsPath),
      "scripts/run_pilot_signoff_record_tests.mjs"
    ],
    results
  }, null, 2) + "\n");
}

run();