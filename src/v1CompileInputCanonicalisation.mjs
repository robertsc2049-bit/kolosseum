import crypto from "node:crypto";

export const v1CompileInputCanonicalisationSurfaceId = "v1_compile_input_canonicalisation";
export const v1CompileInputCanonicalisationVersion = "1.0.0";
export const v1CompileInputCanonicalisationFailureCode = "v1_compile_input_canonicalisation_failure";
export const v1CompileInputCanonicalisationFailureCopyId = "V1_COMPILE_INPUT_CANONICALISATION_REJECTED";

const COMPILE_INPUT_VERSION = "S-V1-30";
const COMPILE_INPUT_STATUS = "canonical_v1_compile_input";

const REQUIRED_ROOT_KEYS = Object.freeze([
  "accepted_declaration",
  "activity_id",
  "engine_visible_fields",
  "programme_assignment",
  "programme_template",
  "registry_bundle"
]);

const REQUIRED_ENGINE_VISIBLE_FIELDS = Object.freeze([
  "activity_id",
  "compile_input_status",
  "compile_input_version",
  "engine_visible_fields",
  "phase1_declaration_payload",
  "phase1_declaration_payload_sha256",
  "programme_assignment_hash",
  "programme_assignment_id",
  "registry_bundle_hash",
  "registry_bundle_version",
  "template_contract_version",
  "template_coverage_contract_version",
  "template_id",
  "template_registry_version"
]);

const ACCEPTED_DECLARATION_KEYS = Object.freeze([
  "declaration_payload",
  "declaration_payload_sha256",
  "engine_compatibility",
  "enum_bundle_version",
  "phase1_schema_version"
]);

const DECLARATION_PAYLOAD_KEYS = Object.freeze([
  "activity_id",
  "consent_granted",
  "engine_compatibility",
  "enum_bundle_version",
  "jurisdiction_acknowledged",
  "phase1_schema_version"
]);

const PROGRAMME_ASSIGNMENT_KEYS = Object.freeze([
  "assignment_hash",
  "assignment_id",
  "assignment_status",
  "compile_input_status",
  "engine_visible"
]);

const PROGRAMME_TEMPLATE_KEYS = Object.freeze([
  "activity_id",
  "coverage_contract_version",
  "template_contract_version",
  "template_id",
  "template_registry_version"
]);

const REGISTRY_BUNDLE_KEYS = Object.freeze([
  "activity_registry_version",
  "equipment_registry_version",
  "exercise_registry_version",
  "registry_bundle_hash",
  "registry_bundle_version",
  "template_registry_version"
]);

const FORBIDDEN_NON_ENGINE_KEYS = Object.freeze([
  "account",
  "account_id",
  "account_state",
  "assigned_athlete_id",
  "assigned_by_coach_id",
  "athlete_id",
  "auth",
  "auth_provider_id",
  "billing",
  "billingState",
  "billing_state",
  "billing_status",
  "coach_id",
  "coach_note",
  "coach_notes",
  "commercial_state",
  "copy",
  "copy_acknowledgement_id",
  "copy_id",
  "copy_ids",
  "drawer_state",
  "marketplace_state",
  "message_thread",
  "notes",
  "payment",
  "paymentState",
  "payment_state",
  "presentation",
  "presentation_state",
  "relationship",
  "relationship_id",
  "relationship_state",
  "relationship_status",
  "selected_tab",
  "subscription",
  "subscriptionState",
  "subscription_state",
  "support_state",
  "ui",
  "uiState",
  "ui_state"
]);

function fail(reason, message, details = {}) {
  const error = new Error(message);
  error.name = "V1CompileInputCanonicalisationError";
  error.code = v1CompileInputCanonicalisationFailureCode;
  error.copy_id = v1CompileInputCanonicalisationFailureCopyId;
  error.reason = reason;
  error.details = Object.freeze({ ...details });
  error.engine_decision = false;
  throw error;
}

function isPlainObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function assertPlainObject(value, reason, details = {}) {
  if (!isPlainObject(value)) {
    fail(reason, "v1 compile input value must be an object", details);
  }
}

function assertNonEmptyString(value, reason, details = {}) {
  if (typeof value !== "string" || value.trim() === "") {
    fail(reason, "v1 compile input string field is required", details);
  }
}

function assertBoolean(value, reason, details = {}) {
  if (typeof value !== "boolean") {
    fail(reason, "v1 compile input boolean field is required", details);
  }
}

function assertArray(value, reason, details = {}) {
  if (!Array.isArray(value)) {
    fail(reason, "v1 compile input array field is required", details);
  }
}

function assertExactKeys(value, expectedKeys, reasonPrefix, path) {
  assertPlainObject(value, `${reasonPrefix}_object_required`, { path });

  const actualKeys = Object.keys(value).sort();
  const sortedExpectedKeys = [...expectedKeys].sort();

  for (const key of sortedExpectedKeys) {
    if (!actualKeys.includes(key)) {
      fail(`${reasonPrefix}_missing_required_field`, "v1 compile input is missing a required field", {
        path,
        key
      });
    }
  }

  for (const key of actualKeys) {
    if (!sortedExpectedKeys.includes(key)) {
      fail(`${reasonPrefix}_unknown_field_refused`, "v1 compile input contains an unknown field", {
        path,
        key
      });
    }
  }
}

function assertNoForbiddenNonEngineKeysDeep(value, pathParts = []) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoForbiddenNonEngineKeysDeep(item, [...pathParts, String(index)]));
    return;
  }

  if (!isPlainObject(value)) {
    return;
  }

  for (const [key, child] of Object.entries(value)) {
    if (FORBIDDEN_NON_ENGINE_KEYS.includes(key)) {
      fail("v1_compile_input_forbidden_non_engine_field_refused", "non-engine field cannot enter v1 compile input", {
        path: [...pathParts, key].join(".")
      });
    }

    assertNoForbiddenNonEngineKeysDeep(child, [...pathParts, key]);
  }
}

function assertHashLike(value, reason, details = {}) {
  assertNonEmptyString(value, reason, details);

  if (!/^[a-f0-9]{64}$/u.test(value)) {
    fail(reason, "v1 compile input hash must be 64 lowercase hexadecimal characters", details);
  }
}

function assertEngineVisibleFieldList(value) {
  assertArray(value, "v1_compile_input_engine_visible_fields_required", {
    field: "engine_visible_fields"
  });

  const actual = [...value].sort();
  const expected = [...REQUIRED_ENGINE_VISIBLE_FIELDS].sort();

  if (actual.length !== expected.length) {
    fail("v1_compile_input_engine_visible_fields_mismatch", "engine visible field list must be explicit and complete", {
      expected,
      actual
    });
  }

  for (let index = 0; index < expected.length; index += 1) {
    if (actual[index] !== expected[index]) {
      fail("v1_compile_input_engine_visible_fields_mismatch", "engine visible field list must be explicit and complete", {
        expected,
        actual
      });
    }
  }
}

function canonicalise(value) {
  if (value === null) {
    return null;
  }

  if (Array.isArray(value)) {
    return value.map(canonicalise);
  }

  if (isPlainObject(value)) {
    return Object.keys(value)
      .sort()
      .reduce((accumulator, key) => {
        accumulator[key] = canonicalise(value[key]);
        return accumulator;
      }, {});
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      fail("v1_compile_input_non_finite_number_refused", "non-finite numbers cannot be canonicalised", {});
    }

    return value;
  }

  if (["string", "boolean"].includes(typeof value)) {
    return value;
  }

  fail("v1_compile_input_unsupported_value_refused", "unsupported value cannot be canonicalised", {
    value_type: typeof value
  });
}

export function stableCanonicalJson(value) {
  return JSON.stringify(canonicalise(value));
}

export function sha256Hex(value) {
  return crypto.createHash("sha256").update(value, "utf8").digest("hex");
}

function assertAcceptedDeclaration(value, activityId) {
  assertExactKeys(value, ACCEPTED_DECLARATION_KEYS, "v1_compile_input_accepted_declaration", "accepted_declaration");
  assertExactKeys(
    value.declaration_payload,
    DECLARATION_PAYLOAD_KEYS,
    "v1_compile_input_declaration_payload",
    "accepted_declaration.declaration_payload"
  );

  assertHashLike(value.declaration_payload_sha256, "v1_compile_input_declaration_hash_invalid", {
    field: "accepted_declaration.declaration_payload_sha256"
  });

  assertNonEmptyString(value.phase1_schema_version, "v1_compile_input_phase1_schema_version_required", {
    field: "accepted_declaration.phase1_schema_version"
  });
  assertNonEmptyString(value.engine_compatibility, "v1_compile_input_engine_compatibility_required", {
    field: "accepted_declaration.engine_compatibility"
  });
  assertNonEmptyString(value.enum_bundle_version, "v1_compile_input_enum_bundle_version_required", {
    field: "accepted_declaration.enum_bundle_version"
  });

  if (value.declaration_payload.activity_id !== activityId) {
    fail("v1_compile_input_activity_mismatch", "accepted declaration activity must match compile input activity", {
      root_activity_id: activityId,
      declaration_activity_id: value.declaration_payload.activity_id
    });
  }

  if (value.declaration_payload.phase1_schema_version !== value.phase1_schema_version) {
    fail("v1_compile_input_declaration_version_mismatch", "declaration payload version fields must match", {
      field: "phase1_schema_version"
    });
  }

  if (value.declaration_payload.engine_compatibility !== value.engine_compatibility) {
    fail("v1_compile_input_declaration_version_mismatch", "declaration payload version fields must match", {
      field: "engine_compatibility"
    });
  }

  if (value.declaration_payload.enum_bundle_version !== value.enum_bundle_version) {
    fail("v1_compile_input_declaration_version_mismatch", "declaration payload version fields must match", {
      field: "enum_bundle_version"
    });
  }

  assertBoolean(value.declaration_payload.consent_granted, "v1_compile_input_consent_boolean_required", {
    field: "accepted_declaration.declaration_payload.consent_granted"
  });
  assertBoolean(value.declaration_payload.jurisdiction_acknowledged, "v1_compile_input_jurisdiction_boolean_required", {
    field: "accepted_declaration.declaration_payload.jurisdiction_acknowledged"
  });

  if (value.declaration_payload.consent_granted !== true || value.declaration_payload.jurisdiction_acknowledged !== true) {
    fail("v1_compile_input_declaration_acknowledgement_invalid", "compile input requires accepted factual declaration acknowledgements", {});
  }
}

function assertProgrammeAssignment(value) {
  assertExactKeys(value, PROGRAMME_ASSIGNMENT_KEYS, "v1_compile_input_programme_assignment", "programme_assignment");

  assertNonEmptyString(value.assignment_id, "v1_compile_input_assignment_id_required", {
    field: "programme_assignment.assignment_id"
  });
  assertHashLike(value.assignment_hash, "v1_compile_input_assignment_hash_invalid", {
    field: "programme_assignment.assignment_hash"
  });
  assertNonEmptyString(value.assignment_status, "v1_compile_input_assignment_status_required", {
    field: "programme_assignment.assignment_status"
  });
  assertNonEmptyString(value.compile_input_status, "v1_compile_input_assignment_compile_status_required", {
    field: "programme_assignment.compile_input_status"
  });
  assertBoolean(value.engine_visible, "v1_compile_input_assignment_engine_visible_boolean_required", {
    field: "programme_assignment.engine_visible"
  });

  if (value.compile_input_status !== "not_consumed_until_declared_compile_input") {
    fail("v1_compile_input_assignment_compile_status_invalid", "assignment must not be pre-consumed by compile", {
      compile_input_status: value.compile_input_status
    });
  }

  if (value.engine_visible !== false) {
    fail("v1_compile_input_assignment_engine_visible_refused", "assignment record must remain engine-invisible before canonical projection", {});
  }
}

function assertProgrammeTemplate(value, activityId) {
  assertExactKeys(value, PROGRAMME_TEMPLATE_KEYS, "v1_compile_input_programme_template", "programme_template");

  assertNonEmptyString(value.template_id, "v1_compile_input_template_id_required", {
    field: "programme_template.template_id"
  });
  assertNonEmptyString(value.activity_id, "v1_compile_input_template_activity_required", {
    field: "programme_template.activity_id"
  });
  assertNonEmptyString(value.template_contract_version, "v1_compile_input_template_contract_required", {
    field: "programme_template.template_contract_version"
  });
  assertNonEmptyString(value.coverage_contract_version, "v1_compile_input_template_coverage_contract_required", {
    field: "programme_template.coverage_contract_version"
  });
  assertNonEmptyString(value.template_registry_version, "v1_compile_input_template_registry_version_required", {
    field: "programme_template.template_registry_version"
  });

  if (value.activity_id !== activityId) {
    fail("v1_compile_input_activity_mismatch", "programme template activity must match compile input activity", {
      root_activity_id: activityId,
      template_activity_id: value.activity_id
    });
  }
}

function assertRegistryBundle(value) {
  assertExactKeys(value, REGISTRY_BUNDLE_KEYS, "v1_compile_input_registry_bundle", "registry_bundle");

  assertHashLike(value.registry_bundle_hash, "v1_compile_input_registry_bundle_hash_invalid", {
    field: "registry_bundle.registry_bundle_hash"
  });

  for (const field of REGISTRY_BUNDLE_KEYS) {
    if (field === "registry_bundle_hash") {
      continue;
    }

    assertNonEmptyString(value[field], "v1_compile_input_registry_bundle_version_required", {
      field: `registry_bundle.${field}`
    });
  }
}

export function assertV1CompileInputCandidate(input) {
  assertPlainObject(input, "v1_compile_input_candidate_object_required");
  assertNoForbiddenNonEngineKeysDeep(input);
  assertExactKeys(input, REQUIRED_ROOT_KEYS, "v1_compile_input_root", "root");

  assertNonEmptyString(input.activity_id, "v1_compile_input_activity_required", {
    field: "activity_id"
  });

  assertAcceptedDeclaration(input.accepted_declaration, input.activity_id);
  assertProgrammeAssignment(input.programme_assignment);
  assertProgrammeTemplate(input.programme_template, input.activity_id);
  assertRegistryBundle(input.registry_bundle);
  assertEngineVisibleFieldList(input.engine_visible_fields);

  if (input.registry_bundle.template_registry_version !== input.programme_template.template_registry_version) {
    fail("v1_compile_input_template_registry_version_mismatch", "template registry version must match registry bundle", {
      template_registry_version: input.programme_template.template_registry_version,
      registry_template_version: input.registry_bundle.template_registry_version
    });
  }

  return true;
}

export function buildV1CompileInput(input) {
  assertV1CompileInputCandidate(input);

  const canonicalInput = Object.freeze({
    activity_id: input.activity_id,
    compile_input_status: COMPILE_INPUT_STATUS,
    compile_input_version: COMPILE_INPUT_VERSION,
    engine_visible_fields: Object.freeze([...REQUIRED_ENGINE_VISIBLE_FIELDS].sort()),
    phase1_declaration_payload: Object.freeze(canonicalise(input.accepted_declaration.declaration_payload)),
    phase1_declaration_payload_sha256: input.accepted_declaration.declaration_payload_sha256,
    programme_assignment_hash: input.programme_assignment.assignment_hash,
    programme_assignment_id: input.programme_assignment.assignment_id,
    registry_bundle_hash: input.registry_bundle.registry_bundle_hash,
    registry_bundle_version: input.registry_bundle.registry_bundle_version,
    template_contract_version: input.programme_template.template_contract_version,
    template_coverage_contract_version: input.programme_template.coverage_contract_version,
    template_id: input.programme_template.template_id,
    template_registry_version: input.programme_template.template_registry_version
  });

  const canonicalJson = stableCanonicalJson(canonicalInput);
  const canonicalHash = sha256Hex(canonicalJson);

  return Object.freeze({
    surface_id: v1CompileInputCanonicalisationSurfaceId,
    version: v1CompileInputCanonicalisationVersion,
    compile_input_status: COMPILE_INPUT_STATUS,
    canonical_json: canonicalJson,
    canonical_hash: canonicalHash,
    canonical_input: canonicalInput,
    hash_metadata: Object.freeze({
      algorithm: "sha256",
      canonical_json: "stable_sorted_keys",
      hash_field: "canonical_hash"
    }),
    engine_decision: false
  });
}

export function tryBuildV1CompileInput(input) {
  try {
    return Object.freeze({
      ok: true,
      compile_input: buildV1CompileInput(input)
    });
  } catch (error) {
    if (error && error.name === "V1CompileInputCanonicalisationError") {
      return Object.freeze({
        ok: false,
        error: Object.freeze({
          code: error.code,
          copy_id: error.copy_id,
          reason: error.reason,
          details: error.details,
          engine_decision: false
        })
      });
    }

    throw error;
  }
}

export const v1CompileInputCanonicalisationContract = Object.freeze({
  surface_id: v1CompileInputCanonicalisationSurfaceId,
  version: v1CompileInputCanonicalisationVersion,
  failure_code: v1CompileInputCanonicalisationFailureCode,
  failure_copy_id: v1CompileInputCanonicalisationFailureCopyId,
  compile_input_version: COMPILE_INPUT_VERSION,
  compile_input_status: COMPILE_INPUT_STATUS,
  required_root_keys: REQUIRED_ROOT_KEYS,
  required_engine_visible_fields: REQUIRED_ENGINE_VISIBLE_FIELDS,
  forbidden_non_engine_keys: FORBIDDEN_NON_ENGINE_KEYS,
  canonical_json: "stable_sorted_keys",
  hash_algorithm: "sha256"
});
