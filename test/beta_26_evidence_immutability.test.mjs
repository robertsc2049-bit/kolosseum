// DEV NOTE: BETA-26 sealed EvidenceEnvelope immutability tests.

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
  BETA24_EVIDENCE_ENVELOPE_KEYS
} from "../ci/lib/beta24_phase8_evidence_schema_lib.mjs";

import {
  BETA26_AUDIT_EVENT_TYPES,
  BETA26_FAILURE_TOKENS,
  BETA26_STORE_API_KEYS,
  beta26EvidenceImmutabilityContract,
  buildBeta26EvidenceImmutabilityManifest,
  createBeta26EvidenceImmutableStore,
  verifyBeta26EvidenceImmutabilityManifest,
  verifyBeta26StoredEvidenceRecord
} from "../replay/runtime/beta26EvidenceImmutableStore.mjs";

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
        "beta26_phase7_projection_001",
      content_format:
        "application/json",
      phase6_output:
        phase6
    });

  const runnerResult =
    sealBeta23RunnerVerdict({
      verdict:
        "ACCEPTED",
      canonical_input_hash:
        phase6.canonical_input_hash,
      selection_hash:
        phase5.selection_hash,
      projection_hash:
        phase7.projection_hash,
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
      failure_tokens: []
    });

  assert.equal(
    runnerResult.ok,
    true
  );

  return {
    phase5,
    phase6,
    phase7,
    runner:
      runnerResult
        .runner_verdict
  };
}

function validRequest() {
  const chain =
    buildPhaseChain();

  return {
    phase8_input: {
      phase5_output:
        chain.phase5,
      phase6_output:
        chain.phase6,
      phase7_output:
        chain.phase7,
      runner_verdict:
        chain.runner
    },
    gate_state: {
      cl_passed: true,
      ci_passed: true,
      pre_seal_state:
        "inactive"
    }
  };
}

function sealValid(store) {
  const result =
    store.seal(
      validRequest()
    );

  assert.equal(
    result.ok,
    true
  );

  return result;
}

function expectFailure(
  result,
  token
) {
  assert.equal(
    result.ok,
    false
  );

  assert.equal(
    result.failure_token,
    token
  );
}

function manifestFileTexts() {
  return {
    contract:
      readText(
        "replay/contracts/beta26_evidence_immutability_contract.json"
      ),
    failure_tokens:
      readText(
        "replay/contracts/beta26_evidence_immutability_failure_tokens.json"
      ),
    runtime_store:
      readText(
        "replay/runtime/beta26EvidenceImmutableStore.mjs"
      ),
    beta24_contract:
      readText(
        "replay/contracts/beta24_phase8_evidence_schema_contract.json"
      ),
    beta24_schema:
      readText(
        "replay/contracts/beta24_phase8_evidence_envelope.schema.json"
      ),
    beta24_manifest:
      readText(
        "replay/suite/beta_phase1_8/evidence_schema_manifest.json"
      ),
    beta25_contract:
      readText(
        "replay/contracts/beta25_phase8_chain_seal_gates_contract.json"
      ),
    beta25_manifest:
      readText(
        "replay/suite/beta_phase1_8/chain_seal_gates_manifest.json"
      ),
    activation_source:
      readText(
        "src/api/evidence_activation_v1.ts"
      ),
    export_source:
      readText(
        "src/v1ExportBoundaryContract.mjs"
      )
  };
}

test(
  "BETA-26 contract closes all evidence mutation and illegal creation paths",
  () => {
    assert.deepEqual(
      readJson(
        "replay/contracts/beta26_evidence_immutability_contract.json"
      ),
      beta26EvidenceImmutabilityContract
    );

    assert.deepEqual(
      readJson(
        "replay/contracts/beta26_evidence_immutability_failure_tokens.json"
      ).tokens,
      BETA26_FAILURE_TOKENS
    );

    assert.equal(
      beta26EvidenceImmutabilityContract
        .update_after_seal_allowed,
      false
    );

    assert.equal(
      beta26EvidenceImmutabilityContract
        .delete_after_seal_allowed,
      false
    );

    assert.equal(
      beta26EvidenceImmutabilityContract
        .manual_creation_allowed,
      false
    );

    assert.equal(
      beta26EvidenceImmutabilityContract
        .partial_envelope_allowed,
      false
    );

    assert.equal(
      beta26EvidenceImmutabilityContract
        .regeneration_after_failure_allowed,
      false
    );

    assert.equal(
      beta26EvidenceImmutabilityContract
        .export_time_mutation_allowed,
      false
    );

    assert.deepEqual(
      beta26EvidenceImmutabilityContract
        .audit_event_types,
      BETA26_AUDIT_EVENT_TYPES
    );

    assert.deepEqual(
      beta26EvidenceImmutabilityContract
        .store_api,
      BETA26_STORE_API_KEYS
    );
  }
);

test(
  "BETA-26 seals complete canonical bytes and verifies both checksums on read",
  () => {
    const store =
      createBeta26EvidenceImmutableStore();

    const sealed =
      sealValid(store);

    const read =
      store.read(
        sealed
          .evidence_envelope_id
      );

    assert.equal(
      read.ok,
      true
    );

    assert.equal(
      read
        .sealed_bytes_checksum_sha256,
      sealed
        .sealed_bytes_checksum_sha256
    );

    const envelope =
      JSON.parse(
        read.sealed_bytes
      );

    assert.deepEqual(
      Object.keys(envelope).sort(),
      [...BETA24_EVIDENCE_ENVELOPE_KEYS].sort()
    );

    assert.equal(
      envelope.runner_verdict,
      "ACCEPTED"
    );

    assert.equal(
      Object.isFrozen(
        read
          .evidence_envelope
      ),
      true
    );
  }
);

test(
  "BETA-26 update after seal is denied and stored bytes remain unchanged",
  () => {
    const store =
      createBeta26EvidenceImmutableStore();

    const sealed =
      sealValid(store);

    const before =
      store.read(
        sealed
          .evidence_envelope_id
      );

    expectFailure(
      store.attemptUpdate(
        sealed
          .evidence_envelope_id,
        "{}"
      ),
      "beta26_update_denied"
    );

    const after =
      store.read(
        sealed
          .evidence_envelope_id
      );

    assert.equal(
      after.sealed_bytes,
      before.sealed_bytes
    );

    assert.equal(
      after
        .sealed_bytes_checksum_sha256,
      before
        .sealed_bytes_checksum_sha256
    );
  }
);

test(
  "BETA-26 delete is denied because no legal admin deletion path exists",
  () => {
    const store =
      createBeta26EvidenceImmutableStore();

    const sealed =
      sealValid(store);

    expectFailure(
      store.attemptDelete(
        sealed
          .evidence_envelope_id
      ),
      "beta26_delete_denied"
    );

    assert.equal(
      store.read(
        sealed
          .evidence_envelope_id
      ).ok,
      true
    );
  }
);

test(
  "BETA-26 complete manual envelope creation is denied",
  () => {
    const sourceStore =
      createBeta26EvidenceImmutableStore();

    const sealed =
      sealValid(sourceStore);

    const bytes =
      sourceStore.read(
        sealed
          .evidence_envelope_id
      ).sealed_bytes;

    const targetStore =
      createBeta26EvidenceImmutableStore();

    expectFailure(
      targetStore
        .attemptManualCreation(
          bytes
        ),
      "beta26_manual_creation_denied"
    );

    expectFailure(
      targetStore.read(
        sealed
          .evidence_envelope_id
      ),
      "beta26_evidence_not_found"
    );
  }
);

test(
  "BETA-26 partial manual envelope creation is denied",
  () => {
    const store =
      createBeta26EvidenceImmutableStore();

    const partial =
      JSON.stringify({
        evidence_envelope_id:
          `beta24_evidence_envelope_${"a".repeat(24)}`,
        engine_version:
          "EB2-1.0.0"
      });

    expectFailure(
      store
        .attemptManualCreation(
          partial
        ),
      "beta26_partial_envelope_denied"
    );
  }
);

test(
  "BETA-26 a failed seal cannot be regenerated with the same evidence identity",
  () => {
    const store =
      createBeta26EvidenceImmutableStore();

    const request =
      validRequest();

    request
      .gate_state
      .ci_passed =
      false;

    expectFailure(
      store.seal(request),
      "beta26_seal_denied"
    );

    request
      .gate_state
      .ci_passed =
      true;

    expectFailure(
      store.seal(request),
      "beta26_regeneration_denied"
    );
  }
);

test(
  "BETA-26 explicit regeneration after successful sealing is denied",
  () => {
    const store =
      createBeta26EvidenceImmutableStore();

    const sealed =
      sealValid(store);

    expectFailure(
      store
        .attemptRegeneration(
          sealed
            .evidence_envelope_id
        ),
      "beta26_regeneration_denied"
    );
  }
);

test(
  "BETA-26 stored-byte checksum mismatch fails closed",
  () => {
    const store =
      createBeta26EvidenceImmutableStore();

    const sealed =
      sealValid(store);

    const read =
      store.read(
        sealed
          .evidence_envelope_id
      );

    const tamperedBytes =
      read.sealed_bytes.replace(
        '"ACCEPTED"',
        '"REJECTED"'
      );

    const forgedRecord = {
      evidence_envelope_id:
        sealed
          .evidence_envelope_id,
      sealed_bytes:
        tamperedBytes,
      sealed_bytes_checksum_sha256:
        read
          .sealed_bytes_checksum_sha256
    };

    expectFailure(
      verifyBeta26StoredEvidenceRecord(
        forgedRecord
      ),
      "beta26_checksum_mismatch"
    );
  }
);

test(
  "BETA-26 export returns exact stored bytes and rejects export-time mutation",
  () => {
    const store =
      createBeta26EvidenceImmutableStore();

    const sealed =
      sealValid(store);

    const read =
      store.read(
        sealed
          .evidence_envelope_id
      );

    const exported =
      store.exportBytes(
        sealed
          .evidence_envelope_id
      );

    assert.equal(
      exported.ok,
      true
    );

    assert.equal(
      exported.sealed_bytes,
      read.sealed_bytes
    );

    assert.equal(
      exported
        .sealed_bytes_checksum_sha256,
      read
        .sealed_bytes_checksum_sha256
    );

    expectFailure(
      store.exportBytes(
        sealed
          .evidence_envelope_id,
        {
          transform:
            "replace"
        }
      ),
      "beta26_export_mutation_denied"
    );

    assert.equal(
      store.read(
        sealed
          .evidence_envelope_id
      ).sealed_bytes,
      read.sealed_bytes
    );
  }
);

test(
  "BETA-26 emits append-only audit events for attempts successes denials and mutation denials",
  () => {
    const store =
      createBeta26EvidenceImmutableStore();

    const sealed =
      sealValid(store);

    store.attemptUpdate(
      sealed
        .evidence_envelope_id
    );

    store.attemptManualCreation(
      JSON.stringify({
        evidence_envelope_id:
          `beta24_evidence_envelope_${"b".repeat(24)}`
      })
    );

    const audit =
      store.readAuditLog();

    const eventTypes =
      audit.map(
        (event) =>
          event.event_type
      );

    for (
      const eventType
      of BETA26_AUDIT_EVENT_TYPES
    ) {
      assert.equal(
        eventTypes.includes(
          eventType
        ),
        true,
        eventType
      );
    }

    assert.equal(
      new Set(
        audit.map(
          (event) =>
            event.audit_event_id
        )
      ).size,
      audit.length
    );

    assert.equal(
      Object.isFrozen(audit),
      true
    );

    assert.equal(
      audit.every(
        (event) =>
          Object.isFrozen(event)
      ),
      true
    );
  }
);

test(
  "BETA-26 manifest binds storage law and upstream evidence surfaces",
  () => {
    const actual =
      readJson(
        "replay/suite/beta_phase1_8/evidence_immutability_manifest.json"
      );

    const expected =
      buildBeta26EvidenceImmutabilityManifest(
        manifestFileTexts()
      );

    assert.deepEqual(
      actual,
      expected
    );

    assert.equal(
      verifyBeta26EvidenceImmutabilityManifest(
        actual,
        manifestFileTexts()
      ).ok,
      true
    );
  }
);

test(
  "BETA-26 v0 compatibility uses exact path exclusions only",
  () => {
    const source =
      readText(
        "ci/scripts/kolosseum_v0_test_suite_core.mjs"
      );

    for (
      const exactPath
      of [
        "replay/runtime/beta26EvidenceImmutableStore.mjs",
        "replay/contracts/beta26_evidence_immutability_contract.json",
        "replay/contracts/beta26_evidence_immutability_failure_tokens.json",
        "replay/suite/beta_phase1_8/evidence_immutability_manifest.json"
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
