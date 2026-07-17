// DEV NOTE: BETA-21 deterministic Phase 1-7 replay-vector packaging.
// This CI/replay library invokes existing phase contracts and records hashes.
// It does not modify or replace any engine implementation.

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
  appendBeta13Phase6EventLog
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

export const BETA21_FAILURE_TOKENS =
  Object.freeze([
    "beta21_replay_divergence",
    "beta21_invalid_failure_token",
    "beta21_missing_phase_output"
  ]);

export const BETA21_VECTOR_IDS =
  Object.freeze([
    "beta21_individual_powerlifting",
    "beta21_individual_general_strength",
    "beta21_coach_managed_rugby_union",
    "beta21_split_continue",
    "beta21_partial_completion",
    "beta21_negative_divergence",
    "beta21_negative_invalid_token",
    "beta21_negative_missing_phase_output"
  ]);

export const beta21ReplayVectorEnvelopeContract =
  Object.freeze({
    contract_id:
      "beta21_replay_vector_envelope",
    slice_id: "BETA-21",
    version: "1.0.0",
    cve_version:
      "BETA-CVE-1.0.0",
    extends_cve_version:
      "CVE-1.0.0",
    phases_under_test:
      Object.freeze([
        "phase1",
        "phase2",
        "phase3",
        "phase4",
        "phase5",
        "phase6",
        "phase7"
      ]),
    positive_vector_count: 5,
    negative_shell_count: 3,
    implementation_mutation_allowed:
      false
  });

const POSITIVE_DEFINITIONS =
  Object.freeze([
    Object.freeze({
      vector_id:
        "beta21_individual_powerlifting",
      execution_scope:
        "individual",
      activity_id:
        "powerlifting",
      scenario:
        "completed"
    }),
    Object.freeze({
      vector_id:
        "beta21_individual_general_strength",
      execution_scope:
        "individual",
      activity_id:
        "general_strength",
      scenario:
        "completed"
    }),
    Object.freeze({
      vector_id:
        "beta21_coach_managed_rugby_union",
      execution_scope:
        "coach_managed",
      activity_id:
        "rugby_union",
      scenario:
        "completed"
    }),
    Object.freeze({
      vector_id:
        "beta21_split_continue",
      execution_scope:
        "individual",
      activity_id:
        "powerlifting",
      scenario:
        "split_continue"
    }),
    Object.freeze({
      vector_id:
        "beta21_partial_completion",
      execution_scope:
        "individual",
      activity_id:
        "general_strength",
      scenario:
        "partial_completion"
    })
  ]);

const NEGATIVE_DEFINITIONS =
  Object.freeze([
    Object.freeze({
      vector_id:
        "beta21_negative_divergence",
      failure_token:
        "beta21_replay_divergence",
      kind:
        "divergence",
      target_phase:
        "phase7",
      shell_payload:
        Object.freeze({
          comparison:
            "expected_output_hash_mismatch"
        })
    }),
    Object.freeze({
      vector_id:
        "beta21_negative_invalid_token",
      failure_token:
        "beta21_invalid_failure_token",
      kind:
        "invalid_token",
      target_phase:
        "replay_verdict",
      shell_payload:
        Object.freeze({
          provided_failure_token:
            "unregistered_failure_token"
        })
    }),
    Object.freeze({
      vector_id:
        "beta21_negative_missing_phase_output",
      failure_token:
        "beta21_missing_phase_output",
      kind:
        "missing_phase_output",
      target_phase:
        "phase6",
      shell_payload:
        Object.freeze({
          missing_output:
            "phase6_output"
        })
    })
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

function fail(
  failure_token,
  details = {}
) {
  return Object.freeze({
    ok: false,
    failure_token,
    details:
      Object.freeze({
        ...details
      })
  });
}

function assertSuccess(
  result,
  phaseName
) {
  if (
    !result ||
    result.ok !== true
  ) {
    const token =
      result?.failure_token ??
      result?.error_code ??
      "unknown_failure";

    throw new Error(
      `BETA-21 ${phaseName} failed: ${token}`
    );
  }

  return result;
}

function phase1Seed(
  activityId,
  executionScope
) {
  const input = {
    consent_granted: true,
    engine_version:
      "EB2-1.0.0",
    enum_bundle_version:
      "EB2-1.0.0",
    phase1_schema_version:
      "1.0.0",
    actor_type:
      "athlete",
    execution_scope:
      executionScope,
    activity_id:
      activityId,
    nd_mode: false,
    instruction_density:
      "standard",
    exposure_prompt_density:
      "standard",
    bias_mode: "none"
  };

  if (
    executionScope ===
      "coach_managed"
  ) {
    input.governing_authority_id =
      "beta21_governing_authority";
  }

  return input;
}

const PHASE4_REPLAY_FIXTURES =
  Object.freeze({
    general_strength:
      "test/fixtures/beta_11_phase4/general_strength.json",
    powerlifting:
      "test/fixtures/beta_11_phase4/powerlifting.json",
    rugby_union:
      "test/fixtures/beta_11_phase4/rugby_union.json"
  });

function buildPhase4ReplayInput(
  canonicalInput,
  canonicalInputHash,
  registryPhase3Output
) {
  const fixturePath =
    PHASE4_REPLAY_FIXTURES[
      canonicalInput.activity_id
    ];

  if (
    typeof fixturePath !==
      "string"
  ) {
    throw new Error(
      `BETA-21 has no Phase 4 replay fixture for ${canonicalInput.activity_id}`
    );
  }

  const fixture =
    JSON.parse(
      fs.readFileSync(
        fixturePath,
        "utf8"
      )
    );

  const descriptor =
    clone(
      fixture
        .allowed_solution_space_descriptor
    );

  if (
    !isRecord(descriptor) ||
    descriptor.activity_id !==
      canonicalInput.activity_id ||
    !Array.isArray(
      descriptor.exercise_ids
    ) ||
    descriptor.exercise_ids.length ===
      0
  ) {
    throw new Error(
      `BETA-21 Phase 4 replay fixture is invalid for ${canonicalInput.activity_id}`
    );
  }

  return {
    constraints_resolved:
      true,
    notes: [],
    registry_index_version:
      registryPhase3Output
        .registry_index_version,
    loaded_registries:
      clone(
        registryPhase3Output
          .loaded_registries
      ),
    constraints: {},
    canonical_input_hash:
      canonicalInputHash,
    constraint_hash:
      betaCanonicalHash(
        descriptor
      ),
    allowed_solution_space_descriptor:
      descriptor
  };
}

function appendEvent(
  session,
  events,
  rawEvent
) {
  return appendBeta13Phase6EventLog(
    session,
    events,
    session.session_id,
    rawEvent
  );
}

function buildEvents(
  session,
  scenario
) {
  const workItemIds =
    session.planned_items.map(
      (item) =>
        item.item_id
    );

  let events = [];

  events = appendEvent(
    session,
    events,
    {
      event_type:
        "SESSION_START"
    }
  );

  if (
    scenario ===
      "split_continue"
  ) {
    events = appendEvent(
      session,
      events,
      {
        event_type:
          "SPLIT_ENTER"
      }
    );

    events = appendEvent(
      session,
      events,
      {
        event_type:
          "SPLIT_RETURN_DECISION",
        decision:
          "continue"
      }
    );
  }

  for (
    const workItemId
    of workItemIds
  ) {
    events = appendEvent(
      session,
      events,
      {
        event_type:
          "WORK_ITEM_START",
        work_item_id:
          workItemId
      }
    );

    events = appendEvent(
      session,
      events,
      {
        event_type:
          "WORK_ITEM_DONE",
        work_item_id:
          workItemId
      }
    );

    if (
      scenario ===
        "partial_completion"
    ) {
      break;
    }
  }

  events = appendEvent(
    session,
    events,
    {
      event_type:
        "SESSION_END",
      end_code:
        scenario ===
          "partial_completion"
          ? "stopped"
          : "completed"
    }
  );

  return events;
}

function registryReferences(
  phase3Output
) {
  const registryIndexPath =
    "registries/registry_index.json";

  const registryIndexBytes =
    fs.readFileSync(
      registryIndexPath
    );

  const registryIndex =
    JSON.parse(
      registryIndexBytes
        .toString("utf8")
    );

  return [
    {
      registry_id:
        "active_registry_index",
      version:
        registryIndex.version,
      path:
        registryIndexPath,
      sha256:
        sha256Bytes(
          registryIndexBytes
        )
    },
    {
      registry_id:
        "phase3_loaded_registry_snapshot",
      version:
        String(
          phase3Output
            .registry_index_version ??
          registryIndex.version
        ),
      path: null,
      sha256:
        betaCanonicalHash({
          registry_index_version:
            phase3Output
              .registry_index_version,
          loaded_registries:
            phase3Output
              .loaded_registries
        })
    }
  ];
}

function schemaPins() {
  return {
    phase1_input_schema_id:
      "kolosseum.master.phase1.input.schema.v1_0_0",
    phase1_schema_version:
      "1.0.0",
    beta21_vector_schema_id:
      "kolosseum.beta21.replay_vector_suite.v1",
    beta21_vector_schema_version:
      "1.0.0"
  };
}

function phaseContractPins() {
  return {
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
  };
}

function buildPositiveVector(
  definition
) {
  const rawPhase1 =
    phase1Seed(
      definition.activity_id,
      definition.execution_scope
    );

  const phase1 =
    assertSuccess(
      phase1Validate(
        clone(rawPhase1)
      ),
      "phase1"
    );

  const phase2 =
    assertSuccess(
      phase2CanonicaliseAndHash(
        phase1.canonical_input
      ),
      "phase2"
    );

  const phase3 =
    assertSuccess(
      phase3ResolveConstraintsAndLoadRegistries(
        phase1.canonical_input,
        {
          canonical_input_hash:
            phase2.phase2
              .canonical_input_hash
        }
      ),
      "phase3"
    );

  const phase4ReplayInput =
    buildPhase4ReplayInput(
      phase1.canonical_input,
      phase2.phase2
        .canonical_input_hash,
      phase3.phase3
    );

  const phase4 =
    assertSuccess(
      enumerateBeta11Phase4(
        phase4ReplayInput
      ),
      "phase4"
    );

  const phase5 =
    assertSuccess(
      materialiseBeta12Phase5(
        phase4.phase4
      ),
      "phase5"
    );

  const session =
    phase5.phase5
      .executable_session;

  const events =
    buildEvents(
      session,
      definition.scenario
    );

  const phase6State =
    replayBeta14Phase6RuntimeEvents(
      session,
      events
    );

  const expectedStatus =
    definition.scenario ===
      "partial_completion"
      ? "partial"
      : "completed";

  if (
    phase6State.status !==
      expectedStatus
  ) {
    throw new Error(
      `BETA-21 scenario ${definition.vector_id} expected ${expectedStatus} but produced ${phase6State.status}`
    );
  }

  const phase7Input = {
    phase7_projection_id:
      `${definition.vector_id}_projection`,
    content_format:
      "application/json",
    phase6_output: {
      canonical_input_hash:
        phase5.phase5
          .canonical_input_hash,
      selection_hash:
        phase5.phase5
          .selection_hash,
      execution_status:
        phase6State.status,
      execution_state:
        phase6State
    }
  };

  const phase7 =
    projectBeta20Phase7(
      phase7Input
    );

  return deepFreeze({
    cve_header: {
      cve_version:
        "BETA-CVE-1.0.0",
      extends_cve_version:
        "CVE-1.0.0",
      vector_id:
        definition.vector_id,
      vector_version:
        "1.0.0",
      vector_class:
        "positive",
      actor_type:
        phase1
          .canonical_input
          .actor_type,
      execution_scope:
        phase1
          .canonical_input
          .execution_scope,
      activity_id:
        phase1
          .canonical_input
          .activity_id,
      phases_under_test: [
        "phase1",
        "phase2",
        "phase3",
        "phase4",
        "phase5",
        "phase6",
        "phase7"
      ],
      implementation_mutation_allowed:
        false
    },
    pins: {
      engine_version:
        phase1
          .canonical_input
          .engine_version,
      enum_bundle_version:
        phase1
          .canonical_input
          .enum_bundle_version,
      schema_versions:
        schemaPins(),
      phase_contract_versions:
        phaseContractPins(),
      registry_references:
        registryReferences(
          phase3.phase3
        )
    },
    canonical_phase1_input:
      clone(
        phase1.canonical_input
      ),
    canonical_phase1_input_hash_sha256:
      phase2.phase2
        .canonical_input_hash,
    execution_plan: {
      scenario:
        definition.scenario,
      phase6_events:
        clone(events)
    },
    expected: {
      verdict: "PASS",
      failure_token: null,
      phase5_output_hash_sha256:
        betaCanonicalHash(
          phase5.phase5
        ),
      phase6_output_hash_sha256:
        betaCanonicalHash(
          phase6State
        ),
      phase6_reducer_state_hash_sha256:
        phase6State
          .reducer_state_hash,
      phase7_output_hash_sha256:
        betaCanonicalHash(
          phase7
        ),
      phase7_projection_hash_sha256:
        phase7
          .projection_hash
    },
    negative_case: null
  });
}

function buildNegativeVector(
  definition,
  basePositive
) {
  return deepFreeze({
    cve_header: {
      cve_version:
        "BETA-CVE-1.0.0",
      extends_cve_version:
        "CVE-1.0.0",
      vector_id:
        definition.vector_id,
      vector_version:
        "1.0.0",
      vector_class:
        "negative_shell",
      actor_type:
        basePositive
          .cve_header
          .actor_type,
      execution_scope:
        basePositive
          .cve_header
          .execution_scope,
      activity_id:
        basePositive
          .cve_header
          .activity_id,
      phases_under_test: [
        "phase1",
        "phase2",
        "phase3",
        "phase4",
        "phase5",
        "phase6",
        "phase7"
      ],
      implementation_mutation_allowed:
        false
    },
    pins:
      clone(
        basePositive.pins
      ),
    canonical_phase1_input:
      clone(
        basePositive
          .canonical_phase1_input
      ),
    canonical_phase1_input_hash_sha256:
      basePositive
        .canonical_phase1_input_hash_sha256,
    execution_plan: {
      scenario:
        "not_executed",
      phase6_events: []
    },
    expected: {
      verdict: "FAIL",
      failure_token:
        definition.failure_token,
      phase5_output_hash_sha256:
        null,
      phase6_output_hash_sha256:
        null,
      phase6_reducer_state_hash_sha256:
        null,
      phase7_output_hash_sha256:
        null,
      phase7_projection_hash_sha256:
        null
    },
    negative_case: {
      kind:
        definition.kind,
      target_phase:
        definition.target_phase,
      shell_payload:
        clone(
          definition
            .shell_payload
        )
    }
  });
}

export function buildBeta21ReplayVectorSuite() {
  const positive =
    POSITIVE_DEFINITIONS.map(
      buildPositiveVector
    );

  const negative =
    NEGATIVE_DEFINITIONS.map(
      (definition) =>
        buildNegativeVector(
          definition,
          positive[0]
        )
    );

  return deepFreeze({
    schema_version:
      "kolosseum.beta21.replay_vector_suite.v1.0.0",
    slice_id:
      "BETA-21",
    suite_id:
      "beta_phase1_7",
    vectors: [
      ...positive,
      ...negative
    ]
  });
}

export function renderBeta21ReplayVectorSuite(
  suite
) {
  return `${JSON.stringify(
    suite,
    null,
    2
  )}\n`;
}

export function buildBeta21ReplayVectorManifest(
  suiteText
) {
  const suite =
    JSON.parse(suiteText);

  const vectorIds =
    suite.vectors.map(
      (vector) =>
        vector
          .cve_header
          .vector_id
    );

  const positiveCount =
    suite.vectors.filter(
      (vector) =>
        vector
          .cve_header
          .vector_class ===
        "positive"
    ).length;

  const negativeCount =
    suite.vectors.length -
    positiveCount;

  return deepFreeze({
    schema_version:
      "kolosseum.beta21.replay_vector_manifest.v1.0.0",
    slice_id:
      "BETA-21",
    suite_id:
      "beta_phase1_7",
    suite_path:
      "replay/suite/beta_phase1_7/vectors.json",
    suite_sha256:
      sha256Bytes(
        Buffer.from(
          suiteText,
          "utf8"
        )
      ),
    vector_ids:
      vectorIds,
    positive_vector_count:
      positiveCount,
    negative_shell_count:
      negativeCount
  });
}

function exactKeys(
  value,
  expected
) {
  if (!isRecord(value)) {
    return false;
  }

  return (
    Object.keys(value)
      .sort()
      .join("\u0000") ===
    [...expected]
      .sort()
      .join("\u0000")
  );
}

function missingPositiveHash(
  expected
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
      typeof expected[key] !==
        "string" ||
      !HASH_RE.test(
        expected[key]
      )
    ) {
      return key;
    }
  }

  return null;
}

export function validateBeta21ReplayVectorSuite(
  suite
) {
  if (
    !exactKeys(
      suite,
      [
        "schema_version",
        "slice_id",
        "suite_id",
        "vectors"
      ]
    )
  ) {
    return fail(
      "beta21_replay_divergence",
      {
        reason:
          "suite_shape_invalid"
      }
    );
  }

  if (
    suite.schema_version !==
      "kolosseum.beta21.replay_vector_suite.v1.0.0" ||
    suite.slice_id !==
      "BETA-21" ||
    suite.suite_id !==
      "beta_phase1_7" ||
    !Array.isArray(
      suite.vectors
    ) ||
    suite.vectors.length !==
      BETA21_VECTOR_IDS.length
  ) {
    return fail(
      "beta21_replay_divergence",
      {
        reason:
          "suite_identity_invalid"
      }
    );
  }

  const ids =
    suite.vectors.map(
      (vector) =>
        vector?.cve_header
          ?.vector_id
    );

  if (
    ids.join("\u0000") !==
    BETA21_VECTOR_IDS.join(
      "\u0000"
    )
  ) {
    return fail(
      "beta21_replay_divergence",
      {
        reason:
          "vector_order_invalid"
      }
    );
  }

  for (
    const vector
    of suite.vectors
  ) {
    if (
      !exactKeys(
        vector,
        [
          "cve_header",
          "pins",
          "canonical_phase1_input",
          "canonical_phase1_input_hash_sha256",
          "execution_plan",
          "expected",
          "negative_case"
        ]
      )
    ) {
      return fail(
        "beta21_replay_divergence",
        {
          vector_id:
            vector?.cve_header
              ?.vector_id,
          reason:
            "vector_shape_invalid"
        }
      );
    }

    if (
      vector.cve_header
        .implementation_mutation_allowed !==
        false
    ) {
      return fail(
        "beta21_replay_divergence",
        {
          vector_id:
            vector.cve_header
              .vector_id,
          reason:
            "implementation_mutation_requested"
        }
      );
    }

    if (
      betaCanonicalHash(
        vector
          .canonical_phase1_input
      ) !==
      vector
        .canonical_phase1_input_hash_sha256
    ) {
      return fail(
        "beta21_replay_divergence",
        {
          vector_id:
            vector.cve_header
              .vector_id,
          reason:
            "phase1_hash_mismatch"
        }
      );
    }

    const expected =
      vector.expected;

    if (
      vector.cve_header
        .vector_class ===
        "positive"
    ) {
      const missing =
        missingPositiveHash(
          expected
        );

      if (missing !== null) {
        return fail(
          "beta21_missing_phase_output",
          {
            vector_id:
              vector.cve_header
                .vector_id,
            field: missing
          }
        );
      }

      if (
        expected.verdict !==
          "PASS" ||
        expected.failure_token !==
          null ||
        vector.negative_case !==
          null
      ) {
        return fail(
          "beta21_replay_divergence",
          {
            vector_id:
              vector.cve_header
                .vector_id,
            reason:
              "positive_verdict_invalid"
          }
        );
      }
    }
    else {
      if (
        expected.verdict !==
          "FAIL" ||
        !BETA21_FAILURE_TOKENS
          .includes(
            expected.failure_token
          )
      ) {
        return fail(
          "beta21_invalid_failure_token",
          {
            vector_id:
              vector.cve_header
                .vector_id,
            failure_token:
              expected.failure_token
          }
        );
      }

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
        if (expected[key] !== null) {
          return fail(
            "beta21_replay_divergence",
            {
              vector_id:
                vector.cve_header
                  .vector_id,
              reason:
                "negative_shell_contains_output_hash",
              field: key
            }
          );
        }
      }

      if (
        !isRecord(
          vector.negative_case
        )
      ) {
        return fail(
          "beta21_replay_divergence",
          {
            vector_id:
              vector.cve_header
                .vector_id,
            reason:
              "negative_case_missing"
          }
        );
      }
    }
  }

  return Object.freeze({
    ok: true
  });
}

export function verifyBeta21ReplayVectorSuite(
  suppliedSuite
) {
  const validation =
    validateBeta21ReplayVectorSuite(
      suppliedSuite
    );

  if (!validation.ok) {
    return validation;
  }

  const expectedSuite =
    buildBeta21ReplayVectorSuite();

  if (
    betaCanonicalJson(
      suppliedSuite
    ) !==
    betaCanonicalJson(
      expectedSuite
    )
  ) {
    return fail(
      "beta21_replay_divergence",
      {
        reason:
          "current_implementation_hash_divergence"
      }
    );
  }

  return Object.freeze({
    ok: true,
    verdict: "PASS",
    vector_count:
      suppliedSuite
        .vectors
        .length
  });
}
