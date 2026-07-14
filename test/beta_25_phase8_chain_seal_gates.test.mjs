// DEV NOTE: BETA-25 Phase 8 chain and seal-gate proof.

import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import {
  materialiseBeta12Phase5
} from "../engine/dist/src/phases/beta12Phase5Materialisation.js";

import {
  projectBeta18Phase7
} from "../engine/dist/src/phases/beta18Phase7SchemaBinding.js";

import {
  appendBeta13Phase6EventLog
} from "../engine/dist/src/runtime/beta13_phase6_event_schema.js";

import {
  replayBeta14Phase6RuntimeEvents
} from "../engine/dist/src/runtime/beta14_phase6_runtime_reducer.js";

import {
  sealBeta23RunnerVerdict
} from "../ci/lib/beta23_runner_verdict_lib.mjs";

import {
  BETA25_FAILURE_TOKENS,
  BETA25_PHASE8_INPUT_KEYS,
  BETA25_SEAL_GATE_OUTPUT_KEYS,
  BETA25_SEAL_GATE_STATE_KEYS,
  beta25Phase8ChainSealGatesContract,
  buildBeta25ChainSealManifest,
  evaluateBeta25Phase8ChainSealGates,
  verifyBeta25ChainSealManifest
} from "../ci/lib/beta25_phase8_chain_seal_gates_lib.mjs";

function readText(path) {
  return fs.readFileSync(
    path,
    "utf8"
  );
}

function readJson(path) {
  return JSON.parse(
    readText(path)
  );
}

function clone(value) {
  return JSON.parse(
    JSON.stringify(value)
  );
}

function buildPhaseChain() {
  const phase4 = readJson(
    "test/fixtures/beta_12_phase5/powerlifting.json"
  );

  const phase5Result =
    materialiseBeta12Phase5(
      phase4
    );

  assert.equal(
    phase5Result.ok,
    true
  );

  const phase5 =
    phase5Result.phase5;
  const session =
    phase5.executable_session;

  let events = [];

  for (
    const raw
    of [
      {
        event_type:
          "SESSION_START"
      },
      {
        event_type:
          "WORK_ITEM_START",
        work_item_id:
          session.planned_items[0]
            .item_id
      },
      {
        event_type:
          "WORK_ITEM_DONE",
        work_item_id:
          session.planned_items[0]
            .item_id
      },
      {
        event_type:
          "SESSION_END",
        end_code:
          "completed"
      }
    ]
  ) {
    events =
      appendBeta13Phase6EventLog(
        session,
        events,
        session.session_id,
        raw
      );
  }

  const executionState =
    replayBeta14Phase6RuntimeEvents(
      session,
      events
    );

  const phase6 = {
    canonical_input_hash:
      phase5.canonical_input_hash,
    selection_hash:
      phase5.selection_hash,
    execution_status:
      executionState.status,
    execution_state:
      executionState
  };

  const phase7 =
    projectBeta18Phase7({
      phase7_projection_id:
        "beta25_phase7_projection_001",
      content_format:
        "application/json",
      phase6_output:
        phase6
    });

  return {
    phase5,
    phase6,
    phase7
  };
}

function acceptedRunner(
  chain,
  overrides = {}
) {
  const result =
    sealBeta23RunnerVerdict({
      verdict: "ACCEPTED",
      canonical_input_hash:
        chain.phase6
          .canonical_input_hash,
      selection_hash:
        chain.phase5
          .selection_hash,
      projection_hash:
        chain.phase7
          .projection_hash,
      replayed_phase_scope: [
        "phase1",
        "phase2",
        "phase3",
        "phase4",
        "phase5",
        "phase6",
        "phase7"
      ],
      engine_version:
        "EB2-1.0.0",
      enum_bundle_version:
        "EB2-1.0.0",
      replay_suite_version:
        "1.0.0",
      failure_tokens: [],
      ...overrides
    });

  assert.equal(
    result.ok,
    true
  );

  return result.runner_verdict;
}

function rejectedRunner(chain) {
  const result =
    sealBeta23RunnerVerdict({
      verdict: "REJECTED",
      canonical_input_hash:
        chain.phase6
          .canonical_input_hash,
      selection_hash: null,
      projection_hash: null,
      replayed_phase_scope: [],
      engine_version:
        "EB2-1.0.0",
      enum_bundle_version:
        "EB2-1.0.0",
      replay_suite_version:
        "1.0.0",
      failure_tokens: [
        "beta21_replay_divergence"
      ]
    });

  assert.equal(
    result.ok,
    true
  );

  return result.runner_verdict;
}

function validInput() {
  const chain =
    buildPhaseChain();

  return {
    chain,
    phase8Input: {
      phase5_output:
        chain.phase5,
      phase6_output:
        chain.phase6,
      phase7_output:
        chain.phase7,
      runner_verdict:
        acceptedRunner(chain)
    },
    gateState: {
      cl_passed: true,
      ci_passed: true,
      pre_seal_state:
        "inactive"
    }
  };
}

function expectFailure(
  phase8Input,
  gateState,
  token,
  binding = null
) {
  const result =
    evaluateBeta25Phase8ChainSealGates(
      phase8Input,
      gateState
    );

  assert.equal(
    result.ok,
    false
  );

  assert.equal(
    result.failure_token,
    token
  );

  if (binding !== null) {
    assert.equal(
      result.details.binding,
      binding
    );
  }
}

function manifestFileTexts() {
  return {
    contract:
      readText(
        "replay/contracts/beta25_phase8_chain_seal_gates_contract.json"
      ),
    failure_tokens:
      readText(
        "replay/contracts/beta25_phase8_chain_seal_gates_failure_tokens.json"
      ),
    beta24_contract:
      readText(
        "replay/contracts/beta24_phase8_evidence_schema_contract.json"
      ),
    beta24_schema:
      readText(
        "replay/contracts/beta24_phase8_evidence_envelope.schema.json"
      ),
    beta23_contract:
      readText(
        "replay/contracts/beta23_runner_verdict_contract.json"
      ),
    beta23_schema:
      readText(
        "replay/contracts/beta23_runner_verdict.schema.json"
      ),
    phase5_source:
      readText(
        "engine/src/phases/beta12Phase5Materialisation.ts"
      ),
    phase6_source:
      readText(
        "engine/src/runtime/beta14_phase6_runtime_reducer.js"
      ),
    phase7_source:
      readText(
        "engine/src/phases/beta18Phase7SchemaBinding.ts"
      ),
    cl_gate_source:
      readText(
        "src/betaClGateSeparation.mjs"
      )
  };
}

test(
  "BETA-25 exposes exact closed Phase8Input and seal-gate state contracts",
  () => {
    assert.deepEqual(
      beta25Phase8ChainSealGatesContract
        .phase8_input_fields,
      BETA25_PHASE8_INPUT_KEYS
    );

    assert.deepEqual(
      beta25Phase8ChainSealGatesContract
        .seal_gate_state_fields,
      BETA25_SEAL_GATE_STATE_KEYS
    );

    assert.deepEqual(
      beta25Phase8ChainSealGatesContract
        .seal_gate_output_fields,
      BETA25_SEAL_GATE_OUTPUT_KEYS
    );

    assert.equal(
      beta25Phase8ChainSealGatesContract
        .phase8_input_additional_properties,
      false
    );

    assert.equal(
      beta25Phase8ChainSealGatesContract
        .evidence_envelope_materialisation,
      false
    );

    assert.deepEqual(
      readJson(
        "replay/contracts/beta25_phase8_chain_seal_gates_contract.json"
      ),
      beta25Phase8ChainSealGatesContract
    );

    assert.deepEqual(
      readJson(
        "replay/contracts/beta25_phase8_chain_seal_gates_failure_tokens.json"
      ).tokens,
      BETA25_FAILURE_TOKENS
    );
  }
);

test(
  "BETA-25 authorises sealing only when CL CI replay chain and pre-seal gates pass",
  () => {
    const {
      phase8Input,
      gateState
    } = validInput();

    const result =
      evaluateBeta25Phase8ChainSealGates(
        phase8Input,
        gateState
      );

    assert.equal(
      result.ok,
      true
    );

    assert.equal(
      result.seal_gate
        .evidence_seal_authorised,
      true
    );

    assert.deepEqual(
      Object.keys(
        result.seal_gate
      ),
      BETA25_SEAL_GATE_OUTPUT_KEYS
    );

    assert.match(
      result.seal_gate
        .phase8_seal_gate_id,
      /^beta25_phase8_seal_gate_[a-f0-9]{24}$/u
    );

    assert.equal(
      result.seal_gate
        .pre_seal_state,
      "inactive"
    );

    assert.equal(
      Object.isFrozen(result),
      true
    );

    assert.equal(
      Object.isFrozen(
        result.seal_gate
      ),
      true
    );
  }
);

test(
  "BETA-25 Phase8Input rejects extra fields",
  () => {
    const {
      phase8Input,
      gateState
    } = validInput();

    phase8Input.payment_state =
      "paid";

    expectFailure(
      phase8Input,
      gateState,
      "beta25_extra_input_field"
    );
  }
);

test(
  "BETA-25 blocks evidence after CL refusal CI failure or active pre-seal state",
  () => {
    for (
      const [field, value, token]
      of [
        [
          "cl_passed",
          false,
          "beta25_cl_refused"
        ],
        [
          "ci_passed",
          false,
          "beta25_ci_failed"
        ],
        [
          "pre_seal_state",
          "active",
          "beta25_pre_seal_active"
        ]
      ]
    ) {
      const {
        phase8Input,
        gateState
      } = validInput();

      gateState[field] = value;

      expectFailure(
        phase8Input,
        gateState,
        token
      );
    }
  }
);

test(
  "BETA-25 blocks missing and rejected RunnerVerdict states",
  () => {
    const missing = validInput();

    delete missing.phase8Input
      .runner_verdict;

    expectFailure(
      missing.phase8Input,
      missing.gateState,
      "beta25_runner_missing"
    );

    const rejected = validInput();

    rejected.phase8Input
      .runner_verdict =
      rejectedRunner(
        rejected.chain
      );

    expectFailure(
      rejected.phase8Input,
      rejected.gateState,
      "beta25_replay_rejected"
    );
  }
);

test(
  "BETA-25 blocks Phase 5 to Phase 6 canonical and selection chain breaks",
  () => {
    for (
      const [field, binding]
      of [
        [
          "canonical_input_hash",
          "phase5_phase6_canonical_input_hash"
        ],
        [
          "selection_hash",
          "phase5_phase6_selection_hash"
        ]
      ]
    ) {
      const candidate = validInput();

      candidate.phase8Input
        .phase6_output = {
        ...candidate.phase8Input
          .phase6_output,
        [field]: "f".repeat(64)
      };

      expectFailure(
        candidate.phase8Input,
        candidate.gateState,
        "beta25_evidence_chain_break"
      );

      assert.equal(
        binding.startsWith(
          "phase5_phase6"
        ),
        true
      );
    }
  }
);

test(
  "BETA-25 blocks Phase 6 to Phase 7 canonical selection status and state chain breaks",
  () => {
    const mutations = [
      (candidate) => {
        candidate.phase8Input
          .phase7_output
          .canonical_input_hash =
          "a".repeat(64);
      },
      (candidate) => {
        candidate.phase8Input
          .phase7_output
          .selection_hash =
          "b".repeat(64);
      },
      (candidate) => {
        candidate.phase8Input
          .phase7_output
          .execution_status =
          "partial";
      },
      (candidate) => {
        candidate.phase8Input
          .phase7_output
          .execution_state = {
          ...candidate.phase8Input
            .phase7_output
            .execution_state,
          ended_by_event_id:
            "beta25_different_event"
        };
      }
    ];

    for (const mutate of mutations) {
      const candidate = validInput();
      candidate.phase8Input =
        clone(
          candidate.phase8Input
        );
      mutate(candidate);

      expectFailure(
        candidate.phase8Input,
        candidate.gateState,
        "beta25_evidence_chain_break"
      );
    }
  }
);

test(
  "BETA-25 blocks RunnerVerdict canonical selection and projection hash mismatches",
  () => {
    for (
      const [field, binding]
      of [
        [
          "canonical_input_hash",
          "runner_canonical_input_hash"
        ],
        [
          "selection_hash",
          "runner_selection_hash"
        ],
        [
          "projection_hash",
          "runner_projection_hash"
        ]
      ]
    ) {
      const candidate = validInput();

      candidate.phase8Input
        .runner_verdict =
        acceptedRunner(
          candidate.chain,
          {
            [field]:
              "e".repeat(64)
          }
        );

      expectFailure(
        candidate.phase8Input,
        candidate.gateState,
        "beta25_evidence_chain_break",
        binding
      );
    }
  }
);

test(
  "BETA-25 invalid RunnerVerdict checksum blocks sealing",
  () => {
    const candidate = validInput();

    candidate.phase8Input =
      clone(
        candidate.phase8Input
      );

    candidate.phase8Input
      .runner_verdict
      .runner_verdict_checksum_sha256 =
      "0".repeat(64);

    expectFailure(
      candidate.phase8Input,
      candidate.gateState,
      "beta25_runner_invalid"
    );
  }
);

test(
  "BETA-25 manifest binds Phase 5 6 7 RunnerVerdict evidence schema and CL source bytes",
  () => {
    const actual = readJson(
      "replay/suite/beta_phase1_8/chain_seal_gates_manifest.json"
    );

    const expected =
      buildBeta25ChainSealManifest(
        manifestFileTexts()
      );

    assert.deepEqual(
      actual,
      expected
    );

    assert.equal(
      verifyBeta25ChainSealManifest(
        actual,
        manifestFileTexts()
      ).ok,
      true
    );
  }
);

test(
  "BETA-25 v0 compatibility uses exact replay exclusions only",
  () => {
    const source = readText(
      "ci/scripts/kolosseum_v0_test_suite_core.mjs"
    );

    for (
      const exactPath
      of [
        "replay/contracts/beta25_phase8_chain_seal_gates_contract.json",
        "replay/contracts/beta25_phase8_chain_seal_gates_failure_tokens.json",
        "replay/suite/beta_phase1_8/chain_seal_gates_manifest.json"
      ]
    ) {
      assert.equal(
        source.split(
          `"${exactPath}"`
        ).length - 1,
        1,
        exactPath
      );
    }
  }
);
