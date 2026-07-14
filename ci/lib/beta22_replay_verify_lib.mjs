// DEV NOTE: BETA-22 verify-only Phase 1-7 replay orchestration.
// This CI library consumes committed BETA-21 vectors and explicit BETA-22
// bindings. It never writes fixtures, alters inputs, skips phases, retries,
// falls back, or changes engine implementation.

import crypto from "node:crypto";
import fs from "node:fs";

import {
  phase1Validate
} from "../../engine/dist/src/phases/phase1.js";

import {
  phase2CanonicaliseAndHash
} from "../../engine/dist/src/phases/phase2.js";

import {
  phase3ResolveConstraintsAndLoadRegistries
} from "../../engine/dist/src/phases/phase3.js";

import {
  enumerateBeta11Phase4
} from "../../engine/dist/src/phases/beta11Phase4Enumeration.js";

import {
  materialiseBeta12Phase5
} from "../../engine/dist/src/phases/beta12Phase5Materialisation.js";

import {
  validateBeta13Phase6EventLog
} from "../../engine/dist/src/runtime/beta13_phase6_event_schema.js";

import {
  replayBeta14Phase6RuntimeEvents
} from "../../engine/dist/src/runtime/beta14_phase6_runtime_reducer.js";

import {
  projectBeta20Phase7
} from "../../engine/dist/src/phases/beta20Phase7HashCopyGuard.js";

import {
  betaCanonicalHash,
  betaCanonicalJson
} from "../../engine/dist/src/phases/betaCanonical.js";

import {
  BETA21_FAILURE_TOKENS,
  BETA21_VECTOR_IDS,
  validateBeta21ReplayVectorSuite
} from "./beta21_replay_vector_envelope_lib.mjs";

export const BETA22_REPEAT_COUNT = 3;

export const BETA22_PHASE_ORDER =
  Object.freeze([
    "phase1",
    "phase2",
    "phase3",
    "phase4",
    "phase5",
    "phase6",
    "phase7"
  ]);

export const BETA22_FAILURE_TOKENS =
  Object.freeze([
    "beta22_verify_mode_required",
    "beta22_update_mode_forbidden",
    "beta22_cli_argument_invalid",
    "beta22_manifest_invalid",
    "beta22_vector_invalid",
    "beta22_pin_mismatch",
    "beta22_replay_binding_invalid",
    "beta22_phase_execution_failed",
    "beta22_phase_output_missing",
    "beta22_phase_output_divergence",
    "beta22_input_mutation",
    "beta22_repeat_divergence",
    "beta22_phase_skipped"
  ]);

export const beta22ReplayVerifyContract =
  Object.freeze({
    contract_id:
      "beta22_replay_verify_runner",
    slice_id: "BETA-22",
    version: "1.0.0",
    mode: "verify_only",
    ci_surface_only: true,
    repeat_count:
      BETA22_REPEAT_COUNT,
    phase_order:
      BETA22_PHASE_ORDER,
    comparison:
      "byte_exact_canonical_json_utf8",
    update_mode_allowed: false,
    input_mutation_allowed: false,
    missing_data_inference_allowed:
      false,
    phase_skip_allowed: false,
    altered_input_retry_allowed:
      false,
    fallback_allowed: false
  });

const EXPECTED_PHASE_CONTRACT_PINS =
  Object.freeze({
    phase1:
      "phase1@1.0.0",
    phase2:
      "phase2@1.0.0",
    phase3:
      "phase3@1.0.0",
    phase4:
      "beta11_phase4_enumeration@1.0.0",
    phase5:
      "beta12_phase5_materialisation@1.0.0",
    phase6_event_schema:
      "beta13_phase6_event_schema@1.0.0",
    phase6_reducer:
      "beta14_phase6_runtime_reducer@1.0.0",
    phase7_schema:
      "beta18_phase7_schema_binding@1.0.0",
    phase7_projection:
      "beta19_phase7_factual_projection@1.0.0",
    phase7_hash_guard:
      "beta20_phase7_hash_copy_guard@1.0.0"
  });

const UPDATE_FLAGS =
  Object.freeze([
    "--update",
    "--write",
    "--accept",
    "--refresh",
    "--record"
  ]);

const HASH_RE =
  /^[a-f0-9]{64}$/u;

function isRecord(value) {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value)
  );
}

function clone(value) {
  return JSON.parse(
    JSON.stringify(value)
  );
}

function deepFreeze(value) {
  if (
    value === null ||
    (
      typeof value !== "object" &&
      typeof value !== "function"
    )
  ) {
    return value;
  }

  if (Object.isFrozen(value)) {
    return value;
  }

  Object.freeze(value);

  for (
    const child
    of Object.values(value)
  ) {
    deepFreeze(child);
  }

  return value;
}

function sha256Bytes(value) {
  return crypto
    .createHash("sha256")
    .update(value)
    .digest("hex");
}

function failure(
  failureToken,
  details = {}
) {
  return deepFreeze({
    ok: false,
    verdict: "REJECTED",
    failure_token:
      failureToken,
    details:
      clone(details)
  });
}

function abort(
  failureToken,
  details = {}
) {
  const error =
    new Error(failureToken);

  error.beta22_failure_token =
    failureToken;

  error.beta22_details =
    clone(details);

  throw error;
}

function assertRecord(
  value,
  failureToken,
  details = {}
) {
  if (!isRecord(value)) {
    abort(
      failureToken,
      details
    );
  }
}

function assertSuccess(
  result,
  phaseName
) {
  if (
    !result ||
    result.ok !== true
  ) {
    abort(
      "beta22_phase_execution_failed",
      {
        phase: phaseName,
        source_failure_token:
          result?.failure_token ??
          result?.error_code ??
          null
      }
    );
  }

  return result;
}

function exactKeys(
  value,
  expectedKeys
) {
  if (!isRecord(value)) {
    return false;
  }

  return (
    Object.keys(value)
      .sort()
      .join("\u0000") ===
    [...expectedKeys]
      .sort()
      .join("\u0000")
  );
}

function exactArray(
  actual,
  expected
) {
  return (
    Array.isArray(actual) &&
    actual.join("\u0000") ===
      expected.join("\u0000")
  );
}

function phaseBytes(
  phaseOutputs
) {
  const output = {};

  for (
    const phase
    of BETA22_PHASE_ORDER
  ) {
    if (
      !Object.prototype
        .hasOwnProperty.call(
          phaseOutputs,
          phase
        )
    ) {
      abort(
        "beta22_phase_skipped",
        {
          phase
        }
      );
    }

    output[phase] =
      betaCanonicalJson(
        phaseOutputs[phase]
      );
  }

  return deepFreeze(output);
}

function phaseAttempts() {
  return {
    phase1: 0,
    phase2: 0,
    phase3: 0,
    phase4: 0,
    phase5: 0,
    phase6: 0,
    phase7: 0
  };
}

function incrementPhase(
  attempts,
  phase
) {
  attempts[phase] += 1;

  if (attempts[phase] !== 1) {
    abort(
      "beta22_phase_execution_failed",
      {
        phase,
        reason:
          "phase_attempt_count_not_one"
      }
    );
  }
}

function assertPositiveVector(
  vector
) {
  assertRecord(
    vector,
    "beta22_vector_invalid"
  );

  if (
    vector.cve_header
      ?.vector_class !==
      "positive" ||
    vector.expected
      ?.verdict !==
      "PASS" ||
    vector.expected
      ?.failure_token !==
      null ||
    vector.negative_case !==
      null
  ) {
    abort(
      "beta22_vector_invalid",
      {
        vector_id:
          vector.cve_header
            ?.vector_id ??
          null,
        reason:
          "positive_vector_required"
      }
    );
  }

  if (
    !exactArray(
      vector.cve_header
        ?.phases_under_test,
      BETA22_PHASE_ORDER
    )
  ) {
    abort(
      "beta22_phase_skipped",
      {
        vector_id:
          vector.cve_header
            ?.vector_id ??
          null,
        actual:
          vector.cve_header
            ?.phases_under_test ??
          null
      }
    );
  }

  if (
    vector.cve_header
      .implementation_mutation_allowed !==
      false
  ) {
    abort(
      "beta22_vector_invalid",
      {
        vector_id:
          vector.cve_header
            .vector_id,
        reason:
          "implementation_mutation_requested"
      }
    );
  }
}

function assertStaticPins(
  vector
) {
  const pins =
    vector.pins;

  assertRecord(
    pins,
    "beta22_pin_mismatch",
    {
      vector_id:
        vector.cve_header
          .vector_id
    }
  );

  const canonicalInput =
    vector
      .canonical_phase1_input;

  if (
    betaCanonicalHash(
      canonicalInput
    ) !==
      vector
        .canonical_phase1_input_hash_sha256
  ) {
    abort(
      "beta22_vector_invalid",
      {
        vector_id:
          vector.cve_header
            .vector_id,
        reason:
          "canonical_phase1_hash_mismatch"
      }
    );
  }

  if (
    pins.engine_version !==
      canonicalInput
        ?.engine_version ||
    pins.enum_bundle_version !==
      canonicalInput
        ?.enum_bundle_version ||
    pins.schema_versions
      ?.phase1_schema_version !==
      canonicalInput
        ?.phase1_schema_version ||
    pins.schema_versions
      ?.phase1_input_schema_id !==
      "kolosseum.master.phase1.input.schema.v1_0_0" ||
    pins.schema_versions
      ?.beta21_vector_schema_id !==
      "kolosseum.beta21.replay_vector_suite.v1" ||
    pins.schema_versions
      ?.beta21_vector_schema_version !==
      "1.0.0" ||
    betaCanonicalJson(
      pins.phase_contract_versions
    ) !==
    betaCanonicalJson(
      EXPECTED_PHASE_CONTRACT_PINS
    )
  ) {
    abort(
      "beta22_pin_mismatch",
      {
        vector_id:
          vector.cve_header
            .vector_id,
        reason:
          "static_pin_mismatch"
      }
    );
  }

  if (
    !Array.isArray(
      pins.registry_references
    ) ||
    pins.registry_references
      .length !== 2
  ) {
    abort(
      "beta22_pin_mismatch",
      {
        vector_id:
          vector.cve_header
            .vector_id,
        reason:
          "registry_reference_count"
      }
    );
  }

  const active =
    pins.registry_references[0];

  const snapshot =
    pins.registry_references[1];

  if (
    active.registry_id !==
      "active_registry_index" ||
    active.path !==
      "registries/registry_index.json" ||
    !HASH_RE.test(
      String(active.sha256)
    ) ||
    snapshot.registry_id !==
      "phase3_loaded_registry_snapshot" ||
    snapshot.path !==
      null ||
    !HASH_RE.test(
      String(snapshot.sha256)
    )
  ) {
    abort(
      "beta22_pin_mismatch",
      {
        vector_id:
          vector.cve_header
            .vector_id,
        reason:
          "registry_reference_shape"
      }
    );
  }
}

function assertRegistryPins(
  vector,
  phase3Output
) {
  const active =
    vector.pins
      .registry_references[0];

  const snapshot =
    vector.pins
      .registry_references[1];

  const activeBytes =
    fs.readFileSync(
      active.path
    );

  const activeIndex =
    JSON.parse(
      activeBytes.toString(
        "utf8"
      )
    );

  if (
    active.version !==
      activeIndex.version ||
    active.sha256 !==
      sha256Bytes(
        activeBytes
      ) ||
    snapshot.version !==
      String(
        phase3Output
          .registry_index_version
      ) ||
    snapshot.sha256 !==
      betaCanonicalHash({
        registry_index_version:
          phase3Output
            .registry_index_version,
        loaded_registries:
          phase3Output
            .loaded_registries
      })
  ) {
    abort(
      "beta22_pin_mismatch",
      {
        vector_id:
          vector.cve_header
            .vector_id,
        reason:
          "current_registry_pin_mismatch"
      }
    );
  }
}

function assertBinding(
  vector,
  binding,
  phase2Output,
  phase3Output
) {
  assertRecord(
    binding,
    "beta22_replay_binding_invalid",
    {
      vector_id:
        vector.cve_header
          .vector_id
    }
  );

  if (
    !exactKeys(
      binding,
      [
        "vector_id",
        "phase4_input",
        "phase7"
      ]
    ) ||
    binding.vector_id !==
      vector.cve_header
        .vector_id
  ) {
    abort(
      "beta22_replay_binding_invalid",
      {
        vector_id:
          vector.cve_header
            .vector_id,
        reason:
          "binding_identity"
      }
    );
  }

  const phase4Input =
    binding.phase4_input;

  if (
    !isRecord(phase4Input) ||
    phase4Input
      .constraints_resolved !==
      true ||
    phase4Input
      .canonical_input_hash !==
      phase2Output
        .canonical_input_hash ||
    phase4Input
      .registry_index_version !==
      phase3Output
        .registry_index_version ||
    betaCanonicalJson(
      phase4Input
        .loaded_registries
    ) !==
    betaCanonicalJson(
      phase3Output
        .loaded_registries
    ) ||
    phase4Input
      .allowed_solution_space_descriptor
      ?.activity_id !==
      vector.cve_header
        .activity_id ||
    !HASH_RE.test(
      String(
        phase4Input
          .constraint_hash
      )
    ) ||
    phase4Input
      .constraint_hash !==
      betaCanonicalHash(
        phase4Input
          .allowed_solution_space_descriptor
      )
  ) {
    abort(
      "beta22_replay_binding_invalid",
      {
        vector_id:
          vector.cve_header
            .vector_id,
        reason:
          "phase4_binding_mismatch"
      }
    );
  }

  if (
    !isRecord(
      binding.phase7
    ) ||
    binding.phase7
      .phase7_projection_id !==
      `${vector.cve_header.vector_id}_projection` ||
    binding.phase7
      .content_format !==
      "application/json"
  ) {
    abort(
      "beta22_replay_binding_invalid",
      {
        vector_id:
          vector.cve_header
            .vector_id,
        reason:
          "phase7_binding_mismatch"
      }
    );
  }
}

function assertPhaseAttemptClosure(
  attempts
) {
  for (
    const phase
    of BETA22_PHASE_ORDER
  ) {
    if (attempts[phase] !== 1) {
      abort(
        "beta22_phase_skipped",
        {
          phase,
          attempts:
            attempts[phase]
        }
      );
    }
  }
}

function compareExpectedHashes(
  vector,
  actualHashes
) {
  for (
    const key
    of [
      "phase5_output_hash_sha256",
      "phase6_output_hash_sha256",
      "phase6_reducer_state_hash_sha256",
      "phase7_output_hash_sha256",
      "phase7_projection_hash_sha256"
    ]
  ) {
    if (
      vector.expected[key] !==
      actualHashes[key]
    ) {
      abort(
        "beta22_phase_output_divergence",
        {
          vector_id:
            vector.cve_header
              .vector_id,
          field: key,
          expected:
            vector.expected[key],
          actual:
            actualHashes[key]
        }
      );
    }
  }
}

export function parseBeta22CliMode(
  args
) {
  const values =
    Array.isArray(args)
      ? args.map(String)
      : [];

  const blocked =
    values.find(
      (value) =>
        UPDATE_FLAGS.includes(
          value
        )
    );

  if (blocked) {
    return failure(
      "beta22_update_mode_forbidden",
      {
        argument: blocked
      }
    );
  }

  if (values.length === 0) {
    return failure(
      "beta22_verify_mode_required"
    );
  }

  if (
    values.length !== 1 ||
    values[0] !== "--verify"
  ) {
    return failure(
      "beta22_cli_argument_invalid",
      {
        arguments: values
      }
    );
  }

  return deepFreeze({
    ok: true,
    mode: "verify"
  });
}

export function executeBeta22ReplayOnce(
  vector,
  binding
) {
  const vectorBefore =
    betaCanonicalJson(vector);

  const bindingBefore =
    betaCanonicalJson(binding);

  const attempts =
    phaseAttempts();

  let currentPhase =
    "phase1";

  try {
    assertPositiveVector(
      vector
    );

    assertStaticPins(
      vector
    );

    incrementPhase(
      attempts,
      "phase1"
    );

    const phase1 =
      assertSuccess(
        phase1Validate(
          clone(
            vector
              .canonical_phase1_input
          )
        ),
        "phase1"
      );

    const phase1Output =
      phase1.canonical_input;

    if (
      betaCanonicalJson(
        phase1Output
      ) !==
      betaCanonicalJson(
        vector
          .canonical_phase1_input
      )
    ) {
      abort(
        "beta22_phase_output_divergence",
        {
          vector_id:
            vector.cve_header
              .vector_id,
          phase:
            "phase1"
        }
      );
    }

    currentPhase =
      "phase2";

    incrementPhase(
      attempts,
      "phase2"
    );

    const phase2 =
      assertSuccess(
        phase2CanonicaliseAndHash(
          clone(
            phase1Output
          )
        ),
        "phase2"
      );

    const phase2Output =
      phase2.phase2;

    if (
      phase2Output
        .canonical_input_hash !==
      vector
        .canonical_phase1_input_hash_sha256
    ) {
      abort(
        "beta22_phase_output_divergence",
        {
          vector_id:
            vector.cve_header
              .vector_id,
          phase:
            "phase2",
          field:
            "canonical_input_hash"
        }
      );
    }

    currentPhase =
      "phase3";

    incrementPhase(
      attempts,
      "phase3"
    );

    const phase3 =
      assertSuccess(
        phase3ResolveConstraintsAndLoadRegistries(
          clone(
            phase1Output
          ),
          {
            canonical_input_hash:
              phase2Output
                .canonical_input_hash
          }
        ),
        "phase3"
      );

    const phase3Output =
      phase3.phase3;

    assertRegistryPins(
      vector,
      phase3Output
    );

    assertBinding(
      vector,
      binding,
      phase2Output,
      phase3Output
    );

    currentPhase =
      "phase4";

    incrementPhase(
      attempts,
      "phase4"
    );

    const phase4 =
      assertSuccess(
        enumerateBeta11Phase4(
          clone(
            binding
              .phase4_input
          )
        ),
        "phase4"
      );

    const phase4Output =
      phase4.phase4;

    currentPhase =
      "phase5";

    incrementPhase(
      attempts,
      "phase5"
    );

    const phase5 =
      assertSuccess(
        materialiseBeta12Phase5(
          clone(
            phase4Output
          )
        ),
        "phase5"
      );

    const phase5Output =
      phase5.phase5;

    currentPhase =
      "phase6";

    incrementPhase(
      attempts,
      "phase6"
    );

    const suppliedEvents =
      clone(
        vector.execution_plan
          .phase6_events
      );

    const validatedEvents =
      validateBeta13Phase6EventLog(
        phase5Output
          .executable_session,
        suppliedEvents
      );

    if (
      betaCanonicalJson(
        validatedEvents
      ) !==
      betaCanonicalJson(
        vector.execution_plan
          .phase6_events
      )
    ) {
      abort(
        "beta22_phase_output_divergence",
        {
          vector_id:
            vector.cve_header
              .vector_id,
          phase:
            "phase6",
          field:
            "phase6_events"
        }
      );
    }

    const phase6Output =
      replayBeta14Phase6RuntimeEvents(
        phase5Output
          .executable_session,
        validatedEvents
      );

    currentPhase =
      "phase7";

    incrementPhase(
      attempts,
      "phase7"
    );

    const phase7Output =
      projectBeta20Phase7({
        phase7_projection_id:
          binding.phase7
            .phase7_projection_id,
        content_format:
          binding.phase7
            .content_format,
        phase6_output: {
          canonical_input_hash:
            phase5Output
              .canonical_input_hash,
          selection_hash:
            phase5Output
              .selection_hash,
          execution_status:
            phase6Output.status,
          execution_state:
            phase6Output
        }
      });

    const outputs = {
      phase1:
        phase1Output,
      phase2:
        phase2Output,
      phase3:
        phase3Output,
      phase4:
        phase4Output,
      phase5:
        phase5Output,
      phase6:
        phase6Output,
      phase7:
        phase7Output
    };

    assertPhaseAttemptClosure(
      attempts
    );

    if (
      betaCanonicalJson(vector) !==
        vectorBefore ||
      betaCanonicalJson(binding) !==
        bindingBefore
    ) {
      abort(
        "beta22_input_mutation",
        {
          vector_id:
            vector.cve_header
              .vector_id
        }
      );
    }

    const hashes = {
      phase5_output_hash_sha256:
        betaCanonicalHash(
          phase5Output
        ),
      phase6_output_hash_sha256:
        betaCanonicalHash(
          phase6Output
        ),
      phase6_reducer_state_hash_sha256:
        phase6Output
          .reducer_state_hash,
      phase7_output_hash_sha256:
        betaCanonicalHash(
          phase7Output
        ),
      phase7_projection_hash_sha256:
        phase7Output
          .projection_hash
    };

    return deepFreeze({
      ok: true,
      verdict: "ACCEPTED",
      vector_id:
        vector.cve_header
          .vector_id,
      phase_bytes:
        phaseBytes(
          outputs
        ),
      phase_hashes:
        hashes,
      phase_attempt_counts:
        attempts
    });
  }
  catch (error) {
    if (
      error?.beta22_failure_token
    ) {
      return failure(
        error
          .beta22_failure_token,
        {
          vector_id:
            vector?.cve_header
              ?.vector_id ??
            null,
          ...(
            error.beta22_details ??
            {}
          )
        }
      );
    }

    return failure(
      "beta22_phase_execution_failed",
      {
        vector_id:
          vector?.cve_header
            ?.vector_id ??
          null,
        phase:
          currentPhase,
        source_failure_token:
          error?.failure_token ??
          error?.code ??
          null,
        message:
          error instanceof Error
            ? error.message
            : String(error)
      }
    );
  }
}

function expectedEntryFor(
  expectedOutputs,
  vectorId
) {
  if (
    !isRecord(
      expectedOutputs
    ) ||
    !Array.isArray(
      expectedOutputs.outputs
    )
  ) {
    abort(
      "beta22_phase_output_missing",
      {
        vector_id:
          vectorId,
        reason:
          "expected_outputs_document"
      }
    );
  }

  const matches =
    expectedOutputs.outputs
      .filter(
        (entry) =>
          entry?.vector_id ===
          vectorId
      );

  if (matches.length !== 1) {
    abort(
      "beta22_phase_output_missing",
      {
        vector_id:
          vectorId,
        reason:
          "expected_output_entry_count",
        count:
          matches.length
      }
    );
  }

  return matches[0];
}

function bindingFor(
  bindings,
  vectorId
) {
  if (
    !isRecord(bindings) ||
    !Array.isArray(
      bindings.bindings
    )
  ) {
    abort(
      "beta22_replay_binding_invalid",
      {
        vector_id:
          vectorId,
        reason:
          "binding_document"
      }
    );
  }

  const matches =
    bindings.bindings
      .filter(
        (entry) =>
          entry?.vector_id ===
          vectorId
      );

  if (matches.length !== 1) {
    abort(
      "beta22_replay_binding_invalid",
      {
        vector_id:
          vectorId,
        reason:
          "binding_entry_count",
        count:
          matches.length
      }
    );
  }

  return matches[0];
}

function assertExpectedPhaseBytes(
  vectorId,
  entry
) {
  if (
    !isRecord(entry) ||
    !exactKeys(
      entry,
      [
        "vector_id",
        "phase_outputs"
      ]
    ) ||
    entry.vector_id !==
      vectorId ||
    !isRecord(
      entry.phase_outputs
    )
  ) {
    abort(
      "beta22_phase_output_missing",
      {
        vector_id:
          vectorId,
        reason:
          "expected_output_shape"
      }
    );
  }

  for (
    const phase
    of BETA22_PHASE_ORDER
  ) {
    if (
      typeof entry
        .phase_outputs[phase] !==
        "string"
    ) {
      abort(
        "beta22_phase_output_missing",
        {
          vector_id:
            vectorId,
          phase
        }
      );
    }
  }

  if (
    Object.keys(
      entry.phase_outputs
    ).length !==
    BETA22_PHASE_ORDER.length
  ) {
    abort(
      "beta22_phase_output_missing",
      {
        vector_id:
          vectorId,
        reason:
          "unexpected_phase_output_key"
      }
    );
  }
}

export function verifyBeta22PositiveVector(
  vector,
  binding,
  expectedEntry,
  repeatCount =
    BETA22_REPEAT_COUNT
) {
  const vectorBefore =
    betaCanonicalJson(vector);

  const bindingBefore =
    betaCanonicalJson(binding);

  const expectedBefore =
    betaCanonicalJson(
      expectedEntry
    );

  try {
    if (
      repeatCount !==
      BETA22_REPEAT_COUNT
    ) {
      abort(
        "beta22_repeat_divergence",
        {
          vector_id:
            vector?.cve_header
              ?.vector_id ??
            null,
          expected:
            BETA22_REPEAT_COUNT,
          actual:
            repeatCount
        }
      );
    }

    assertExpectedPhaseBytes(
      vector.cve_header
        .vector_id,
      expectedEntry
    );

    let firstRunBytes =
      null;

    const runResults = [];

    for (
      let repeat = 1;
      repeat <= repeatCount;
      repeat++
    ) {
      const replay =
        executeBeta22ReplayOnce(
          vector,
          binding
        );

      if (!replay.ok) {
        return replay;
      }

      compareExpectedHashes(
        vector,
        replay.phase_hashes
      );

      for (
        const phase
        of BETA22_PHASE_ORDER
      ) {
        const actual =
          replay.phase_bytes[phase];

        const expected =
          expectedEntry
            .phase_outputs[phase];

        if (actual !== expected) {
          abort(
            "beta22_phase_output_divergence",
            {
              vector_id:
                vector.cve_header
                  .vector_id,
              phase,
              repeat
            }
          );
        }

        if (
          firstRunBytes !==
            null &&
          actual !==
            firstRunBytes[phase]
        ) {
          abort(
            "beta22_repeat_divergence",
            {
              vector_id:
                vector.cve_header
                  .vector_id,
              phase,
              repeat
            }
          );
        }
      }

      if (firstRunBytes === null) {
        firstRunBytes =
          clone(
            replay.phase_bytes
          );
      }

      runResults.push({
        repeat,
        phase_attempt_counts:
          clone(
            replay
              .phase_attempt_counts
          )
      });
    }

    if (
      betaCanonicalJson(vector) !==
        vectorBefore ||
      betaCanonicalJson(binding) !==
        bindingBefore ||
      betaCanonicalJson(
        expectedEntry
      ) !==
        expectedBefore
    ) {
      abort(
        "beta22_input_mutation",
        {
          vector_id:
            vector.cve_header
              .vector_id
        }
      );
    }

    return deepFreeze({
      ok: true,
      verdict: "ACCEPTED",
      vector_id:
        vector.cve_header
          .vector_id,
      repeat_count:
        repeatCount,
      runs:
        runResults
    });
  }
  catch (error) {
    if (
      error?.beta22_failure_token
    ) {
      return failure(
        error
          .beta22_failure_token,
        {
          vector_id:
            vector?.cve_header
              ?.vector_id ??
            null,
          ...(
            error.beta22_details ??
            {}
          )
        }
      );
    }

    return failure(
      "beta22_phase_execution_failed",
      {
        vector_id:
          vector?.cve_header
            ?.vector_id ??
          null,
        message:
          error instanceof Error
            ? error.message
            : String(error)
      }
    );
  }
}

function assertVerifyDocuments(
  bindings,
  expectedOutputs,
  contract
) {
  if (
    !isRecord(contract) ||
    betaCanonicalJson(contract) !==
      betaCanonicalJson(
        beta22ReplayVerifyContract
      )
  ) {
    abort(
      "beta22_manifest_invalid",
      {
        reason:
          "verify_contract_mismatch"
      }
    );
  }

  if (
    !isRecord(bindings) ||
    !exactKeys(
      bindings,
      [
        "schema_version",
        "slice_id",
        "suite_id",
        "inference_allowed",
        "fallback_allowed",
        "retry_with_altered_input_allowed",
        "bindings"
      ]
    ) ||
    bindings.schema_version !==
      "kolosseum.beta22.replay_verify_inputs.v1.0.0" ||
    bindings.slice_id !==
      "BETA-22" ||
    bindings.suite_id !==
      "beta_phase1_7" ||
    bindings.inference_allowed !==
      false ||
    bindings.fallback_allowed !==
      false ||
    bindings.retry_with_altered_input_allowed !==
      false ||
    !Array.isArray(
      bindings.bindings
    ) ||
    bindings.bindings.length !==
      5 ||
    !exactArray(
      bindings.bindings.map(
        (entry) =>
          entry?.vector_id
      ),
      BETA21_VECTOR_IDS.slice(
        0,
        5
      )
    )
  ) {
    abort(
      "beta22_replay_binding_invalid",
      {
        reason:
          "verify_inputs_document"
      }
    );
  }

  if (
    !isRecord(expectedOutputs) ||
    !exactKeys(
      expectedOutputs,
      [
        "schema_version",
        "slice_id",
        "suite_id",
        "encoding",
        "comparison",
        "outputs"
      ]
    ) ||
    expectedOutputs.schema_version !==
      "kolosseum.beta22.expected_phase_outputs.v1.0.0" ||
    expectedOutputs.slice_id !==
      "BETA-22" ||
    expectedOutputs.suite_id !==
      "beta_phase1_7" ||
    expectedOutputs.encoding !==
      "utf-8" ||
    expectedOutputs.comparison !==
      "byte_exact_canonical_json" ||
    !Array.isArray(
      expectedOutputs.outputs
    ) ||
    expectedOutputs.outputs.length !==
      5 ||
    !exactArray(
      expectedOutputs.outputs.map(
        (entry) =>
          entry?.vector_id
      ),
      BETA21_VECTOR_IDS.slice(
        0,
        5
      )
    )
  ) {
    abort(
      "beta22_phase_output_missing",
      {
        reason:
          "expected_outputs_document"
      }
    );
  }
}

export function verifyBeta22Suite({
  suite,
  bindings,
  expectedOutputs,
  contract
}) {
  try {
    const beta21Validation =
      validateBeta21ReplayVectorSuite(
        suite
      );

    if (!beta21Validation.ok) {
      abort(
        "beta22_vector_invalid",
        {
          source_failure_token:
            beta21Validation
              .failure_token
        }
      );
    }

    assertVerifyDocuments(
      bindings,
      expectedOutputs,
      contract
    );

    const suiteBefore =
      betaCanonicalJson(suite);

    const bindingsBefore =
      betaCanonicalJson(bindings);

    const expectedBefore =
      betaCanonicalJson(
        expectedOutputs
      );

    const positiveVectors =
      suite.vectors.filter(
        (vector) =>
          vector.cve_header
            .vector_class ===
          "positive"
      );

    const negativeShells =
      suite.vectors.filter(
        (vector) =>
          vector.cve_header
            .vector_class ===
          "negative_shell"
      );

    const results = [];

    for (
      const vector
      of positiveVectors
    ) {
      const binding =
        bindingFor(
          bindings,
          vector.cve_header
            .vector_id
        );

      const expectedEntry =
        expectedEntryFor(
          expectedOutputs,
          vector.cve_header
            .vector_id
        );

      const result =
        verifyBeta22PositiveVector(
          vector,
          binding,
          expectedEntry,
          BETA22_REPEAT_COUNT
        );

      if (!result.ok) {
        return result;
      }

      results.push(result);
    }

    for (
      const vector
      of negativeShells
    ) {
      if (
        vector.execution_plan
          .scenario !==
          "not_executed" ||
        vector.execution_plan
          .phase6_events.length !==
          0 ||
        !BETA21_FAILURE_TOKENS
          .includes(
            vector.expected
              .failure_token
          )
      ) {
        abort(
          "beta22_vector_invalid",
          {
            vector_id:
              vector.cve_header
                .vector_id,
            reason:
              "negative_shell_invalid"
          }
        );
      }

      results.push(
        deepFreeze({
          ok: true,
          verdict: "REJECTED",
          vector_id:
            vector.cve_header
              .vector_id,
          repeat_count: 0,
          failure_token:
            vector.expected
              .failure_token
        })
      );
    }

    if (
      betaCanonicalJson(suite) !==
        suiteBefore ||
      betaCanonicalJson(bindings) !==
        bindingsBefore ||
      betaCanonicalJson(
        expectedOutputs
      ) !==
        expectedBefore
    ) {
      abort(
        "beta22_input_mutation"
      );
    }

    return deepFreeze({
      ok: true,
      mode: "verify",
      verdict: "ACCEPTED",
      repeat_count:
        BETA22_REPEAT_COUNT,
      vector_count:
        suite.vectors.length,
      accepted_vector_count:
        positiveVectors.length,
      rejected_vector_count:
        negativeShells.length,
      vector_results:
        results
    });
  }
  catch (error) {
    if (
      error?.beta22_failure_token
    ) {
      return failure(
        error
          .beta22_failure_token,
        error.beta22_details ??
          {}
      );
    }

    return failure(
      "beta22_phase_execution_failed",
      {
        message:
          error instanceof Error
            ? error.message
            : String(error)
      }
    );
  }
}

export function buildBeta22VerifyManifest(
  fileTexts
) {
  const required = [
    "contract",
    "failure_tokens",
    "vectors",
    "vector_manifest",
    "verify_inputs",
    "expected_outputs"
  ];

  for (
    const key
    of required
  ) {
    if (
      typeof fileTexts?.[key] !==
        "string"
    ) {
      abort(
        "beta22_manifest_invalid",
        {
          reason:
            "manifest_source_missing",
          source: key
        }
      );
    }
  }

  const vectors =
    JSON.parse(
      fileTexts.vectors
    );

  const positiveIds =
    vectors.vectors
      .filter(
        (vector) =>
          vector.cve_header
            .vector_class ===
          "positive"
      )
      .map(
        (vector) =>
          vector.cve_header
            .vector_id
      );

  const negativeIds =
    vectors.vectors
      .filter(
        (vector) =>
          vector.cve_header
            .vector_class ===
          "negative_shell"
      )
      .map(
        (vector) =>
          vector.cve_header
            .vector_id
      );

  return deepFreeze({
    schema_version:
      "kolosseum.beta22.replay_verify_manifest.v1.0.0",
    slice_id: "BETA-22",
    suite_id:
      "beta_phase1_7",
    mode: "verify_only",
    repeat_count:
      BETA22_REPEAT_COUNT,
    phase_order:
      BETA22_PHASE_ORDER,
    paths: {
      contract:
        "replay/contracts/beta22_replay_verify_contract.json",
      failure_tokens:
        "replay/contracts/beta22_replay_verify_failure_tokens.json",
      vectors:
        "replay/suite/beta_phase1_7/vectors.json",
      vector_manifest:
        "replay/suite/beta_phase1_7/manifest.json",
      verify_inputs:
        "replay/suite/beta_phase1_7/verify_inputs.json",
      expected_outputs:
        "replay/suite/beta_phase1_7/expected_outputs.json"
    },
    sha256: {
      contract:
        sha256Bytes(
          Buffer.from(
            fileTexts.contract,
            "utf8"
          )
        ),
      failure_tokens:
        sha256Bytes(
          Buffer.from(
            fileTexts
              .failure_tokens,
            "utf8"
          )
        ),
      vectors:
        sha256Bytes(
          Buffer.from(
            fileTexts.vectors,
            "utf8"
          )
        ),
      vector_manifest:
        sha256Bytes(
          Buffer.from(
            fileTexts
              .vector_manifest,
            "utf8"
          )
        ),
      verify_inputs:
        sha256Bytes(
          Buffer.from(
            fileTexts
              .verify_inputs,
            "utf8"
          )
        ),
      expected_outputs:
        sha256Bytes(
          Buffer.from(
            fileTexts
              .expected_outputs,
            "utf8"
          )
        )
    },
    accepted_vector_ids:
      positiveIds,
    rejected_shell_ids:
      negativeIds
  });
}

export function verifyBeta22Manifest(
  manifest,
  fileTexts
) {
  try {
    const expected =
      buildBeta22VerifyManifest(
        fileTexts
      );

    if (
      betaCanonicalJson(manifest) !==
      betaCanonicalJson(expected)
    ) {
      abort(
        "beta22_manifest_invalid",
        {
          reason:
            "manifest_content_mismatch"
        }
      );
    }

    if (
      !exactArray(
        manifest
          .accepted_vector_ids,
        BETA21_VECTOR_IDS.slice(
          0,
          5
        )
      ) ||
      !exactArray(
        manifest
          .rejected_shell_ids,
        BETA21_VECTOR_IDS.slice(
          5
        )
      )
    ) {
      abort(
        "beta22_manifest_invalid",
        {
          reason:
            "manifest_vector_order"
        }
      );
    }

    return deepFreeze({
      ok: true
    });
  }
  catch (error) {
    if (
      error?.beta22_failure_token
    ) {
      return failure(
        error
          .beta22_failure_token,
        error.beta22_details ??
          {}
      );
    }

    return failure(
      "beta22_manifest_invalid",
      {
        message:
          error instanceof Error
            ? error.message
            : String(error)
      }
    );
  }
}
