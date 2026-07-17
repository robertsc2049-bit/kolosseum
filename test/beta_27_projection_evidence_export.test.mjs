// DEV NOTE: BETA-27 byte-identical projection and evidence export proof.

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
  createBeta26EvidenceImmutableStore
} from "../replay/runtime/beta26EvidenceImmutableStore.mjs";

import {
  BETA27_ARTIFACT_TYPES,
  BETA27_AUDIT_EVENT_TYPES,
  BETA27_EXPORTABLE_COACH_STATUSES,
  BETA27_FAILURE_TOKENS,
  beta27ProjectionEvidenceExportContract,
  buildBeta27ProjectionEvidenceExportManifest,
  createBeta27ProjectionEvidenceExportService,
  createBeta27StoredProjectionRecord,
  verifyBeta27ProjectionEvidenceExportManifest,
  verifyBeta27StoredProjectionRecord
} from "../replay/runtime/beta27ProjectionEvidenceExport.mjs";

import {
  handleBeta27ProjectionEvidenceExportApiRequest
} from "../src/api/beta27ProjectionEvidenceExportApi.mjs";

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

function buildProjection() {
  const fixture =
    readJson(
      "test/fixtures/beta_18_phase7_schema_binding/completed_projection.json"
    );

  return projectBeta18Phase7(
    fixture.phase7_input
  );
}

function buildEvidenceRequest() {
  const phase4 =
    readJson(
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
        "beta27_phase7_evidence_projection",
      content_format:
        "application/json",
      phase6_output:
        phase6
    });

  const runner =
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
    runner.ok,
    true
  );

  return {
    phase8_input: {
      phase5_output:
        phase5,
      phase6_output:
        phase6,
      phase7_output:
        phase7,
      runner_verdict:
        runner.runner_verdict
    },
    gate_state: {
      cl_passed: true,
      ci_passed: true,
      pre_seal_state:
        "inactive"
    }
  };
}

function buildService(
  projectionRecordOverride = null
) {
  const ownerId =
    "individual_user_001";

  const projection =
    buildProjection();

  const projectionRecordResult =
    createBeta27StoredProjectionRecord(
      ownerId,
      projection
    );

  assert.equal(
    projectionRecordResult.ok,
    true
  );

  const projectionRecord =
    projectionRecordOverride ??
    projectionRecordResult
      .projection_record;

  const evidenceStore =
    createBeta26EvidenceImmutableStore();

  const sealed =
    evidenceStore.seal(
      buildEvidenceRequest()
    );

  assert.equal(
    sealed.ok,
    true
  );

  const service =
    createBeta27ProjectionEvidenceExportService({
      projection_records: [
        projectionRecord
      ],
      evidence_store:
        evidenceStore,
      evidence_owner_by_id: {
        [sealed.evidence_envelope_id]:
          ownerId
      }
    });

  return {
    service,
    ownerId,
    projection,
    projectionRecord,
    evidenceStore,
    evidenceEnvelopeId:
      sealed.evidence_envelope_id
  };
}

function individualRequest(
  artifactType,
  artifactId,
  actorId =
    "individual_user_001"
) {
  return {
    actor: {
      actor_id:
        actorId,
      actor_type:
        "individual_user"
    },
    relationship: null,
    artifact_type:
      artifactType,
    artifact_id:
      artifactId
  };
}

function coachRequest(
  artifactType,
  artifactId,
  status
) {
  return {
    actor: {
      actor_id:
        "coach_001",
      actor_type:
        "coach"
    },
    relationship: {
      relationship_id:
        "relationship_001",
      coach_id:
        "coach_001",
      individual_user_id:
        "individual_user_001",
      status,
      permitted_export_types: [
        "phase7_projection_json",
        "phase8_evidence_envelope_json"
      ]
    },
    artifact_type:
      artifactType,
    artifact_id:
      artifactId
  };
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
        "replay/contracts/beta27_projection_evidence_export_contract.json"
      ),
    failure_tokens:
      readText(
        "replay/contracts/beta27_projection_evidence_export_failure_tokens.json"
      ),
    runtime_export:
      readText(
        "replay/runtime/beta27ProjectionEvidenceExport.mjs"
      ),
    api_adapter:
      readText(
        "src/api/beta27ProjectionEvidenceExportApi.mjs"
      ),
    phase7_source:
      readText(
        "engine/src/phases/beta18Phase7SchemaBinding.ts"
      ),
    beta26_runtime:
      readText(
        "replay/runtime/beta26EvidenceImmutableStore.mjs"
      ),
    beta26_contract:
      readText(
        "replay/contracts/beta26_evidence_immutability_contract.json"
      ),
    proof_view_source:
      readText(
        "src/v1ProofArtefactViewContract.mjs"
      ),
    legacy_export_source:
      readText(
        "src/v1ExportBoundaryContract.mjs"
      )
  };
}

test(
  "BETA-27 contract fixes exact artefact access and immutable export boundaries",
  () => {
    assert.deepEqual(
      readJson(
        "replay/contracts/beta27_projection_evidence_export_contract.json"
      ),
      beta27ProjectionEvidenceExportContract
    );

    assert.deepEqual(
      readJson(
        "replay/contracts/beta27_projection_evidence_export_failure_tokens.json"
      ).tokens,
      BETA27_FAILURE_TOKENS
    );

    assert.deepEqual(
      beta27ProjectionEvidenceExportContract
        .artifact_types,
      BETA27_ARTIFACT_TYPES
    );

    assert.deepEqual(
      beta27ProjectionEvidenceExportContract
        .coach_export_relationship_statuses,
      BETA27_EXPORTABLE_COACH_STATUSES
    );

    assert.equal(
      beta27ProjectionEvidenceExportContract
        .regeneration_on_export,
      false
    );

    assert.equal(
      beta27ProjectionEvidenceExportContract
        .export_timestamp_in_artifact_bytes,
      false
    );

    assert.equal(
      beta27ProjectionEvidenceExportContract
        .metadata_mutation,
      false
    );
  }
);

test(
  "BETA-27 repeated Phase 7 export is byte-identical",
  () => {
    const {
      service,
      projectionRecord
    } = buildService();

    const request =
      individualRequest(
        "phase7_projection_json",
        projectionRecord.artifact_id
      );

    const first =
      service.requestExport(
        request
      );

    const second =
      service.requestExport(
        request
      );

    assert.equal(
      first.ok,
      true
    );

    assert.equal(
      second.ok,
      true
    );

    assert.equal(
      first.json_bytes,
      second.json_bytes
    );

    assert.equal(
      first.json_bytes,
      projectionRecord.stored_bytes
    );

    assert.equal(
      first.byte_checksum_sha256,
      projectionRecord
        .stored_bytes_checksum_sha256
    );

    assert.equal(
      first.json_bytes.includes(
        "exported_at"
      ),
      false
    );
  }
);

test(
  "BETA-27 repeated sealed evidence export is byte-identical",
  () => {
    const {
      service,
      evidenceStore,
      evidenceEnvelopeId
    } = buildService();

    const request =
      individualRequest(
        "phase8_evidence_envelope_json",
        evidenceEnvelopeId
      );

    const first =
      service.requestExport(
        request
      );

    const second =
      service.requestExport(
        request
      );

    const stored =
      evidenceStore.exportBytes(
        evidenceEnvelopeId
      );

    assert.equal(
      first.ok,
      true
    );

    assert.equal(
      second.ok,
      true
    );

    assert.equal(
      first.json_bytes,
      second.json_bytes
    );

    assert.equal(
      first.json_bytes,
      stored.sealed_bytes
    );

    assert.equal(
      first.byte_checksum_sha256,
      stored
        .sealed_bytes_checksum_sha256
    );

    assert.equal(
      first.json_bytes.includes(
        "exported_at"
      ),
      false
    );

    assert.equal(
      first.json_bytes.includes(
        "requested_at"
      ),
      false
    );
  }
);

test(
  "BETA-27 individual may export own artefacts only",
  () => {
    const {
      service,
      projectionRecord
    } = buildService();

    assert.equal(
      service.requestExport(
        individualRequest(
          "phase7_projection_json",
          projectionRecord.artifact_id
        )
      ).ok,
      true
    );

    expectFailure(
      service.requestExport(
        individualRequest(
          "phase7_projection_json",
          projectionRecord.artifact_id,
          "individual_user_999"
        )
      ),
      "beta27_access_denied"
    );
  }
);

test(
  "BETA-27 active and archived policy-permitted coach access succeeds",
  () => {
    for (
      const status
      of [
        "active",
        "archived"
      ]
    ) {
      const {
        service,
        projectionRecord,
        evidenceEnvelopeId
      } = buildService();

      assert.equal(
        service.requestExport(
          coachRequest(
            "phase7_projection_json",
            projectionRecord.artifact_id,
            status
          )
        ).ok,
        true
      );

      assert.equal(
        service.requestExport(
          coachRequest(
            "phase8_evidence_envelope_json",
            evidenceEnvelopeId,
            status
          )
        ).ok,
        true
      );
    }
  }
);

test(
  "BETA-27 revoked coach is blocked",
  () => {
    const {
      service,
      projectionRecord
    } = buildService();

    expectFailure(
      service.requestExport(
        coachRequest(
          "phase7_projection_json",
          projectionRecord.artifact_id,
          "revoked"
        )
      ),
      "beta27_revoked_coach_denied"
    );
  }
);

test(
  "BETA-27 coach without export policy permission is blocked",
  () => {
    const {
      service,
      projectionRecord
    } = buildService();

    const request =
      coachRequest(
        "phase7_projection_json",
        projectionRecord.artifact_id,
        "active"
      );

    request.relationship
      .permitted_export_types = [];

    expectFailure(
      service.requestExport(
        request
      ),
      "beta27_relationship_policy_denied"
    );
  }
);

test(
  "BETA-27 projection hash mismatch fails before export",
  () => {
    const projection =
      buildProjection();

    const valid =
      createBeta27StoredProjectionRecord(
        "individual_user_001",
        projection
      );

    assert.equal(
      valid.ok,
      true
    );

    const tampered =
      clone(
        valid.projection_record
      );

    tampered.stored_bytes =
      tampered.stored_bytes.replace(
        '"completed"',
        '"partial"'
      );

    const {
      service
    } = buildService(
      tampered
    );

    expectFailure(
      service.requestExport(
        individualRequest(
          "phase7_projection_json",
          tampered.artifact_id
        )
      ),
      "beta27_hash_mismatch"
    );
  }
);

test(
  "BETA-27 stored projection verification is closed and checksum-bound",
  () => {
    const {
      projectionRecord
    } = buildService();

    assert.equal(
      verifyBeta27StoredProjectionRecord(
        projectionRecord
      ).ok,
      true
    );

    const extra =
      clone(
        projectionRecord
      );

    extra.exported_at =
      "2026-07-14T00:00:00Z";

    expectFailure(
      verifyBeta27StoredProjectionRecord(
        extra
      ),
      "beta27_projection_invalid"
    );
  }
);

test(
  "BETA-27 API adapter returns exact stored bytes as the successful body",
  () => {
    const {
      service,
      projectionRecord
    } = buildService();

    const response =
      handleBeta27ProjectionEvidenceExportApiRequest(
        service,
        {
          body:
            individualRequest(
              "phase7_projection_json",
              projectionRecord.artifact_id
            )
        }
      );

    assert.equal(
      response.statusCode,
      200
    );

    assert.equal(
      response.headers[
        "content-type"
      ],
      "application/json"
    );

    assert.equal(
      response.body,
      projectionRecord.stored_bytes
    );
  }
);

test(
  "BETA-27 emits requested delivered and denied audit events",
  () => {
    const {
      service,
      projectionRecord
    } = buildService();

    service.requestExport(
      individualRequest(
        "phase7_projection_json",
        projectionRecord.artifact_id
      )
    );

    service.requestExport(
      individualRequest(
        "phase7_projection_json",
        projectionRecord.artifact_id,
        "individual_user_999"
      )
    );

    const audit =
      service.readAuditLog();

    const eventTypes =
      audit.map(
        (event) =>
          event.event_type
      );

    for (
      const eventType
      of BETA27_AUDIT_EVENT_TYPES
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
  "BETA-27 manifest binds export service and upstream truth surfaces",
  () => {
    const actual =
      readJson(
        "replay/suite/beta_phase1_8/projection_evidence_export_manifest.json"
      );

    const expected =
      buildBeta27ProjectionEvidenceExportManifest(
        manifestFileTexts()
      );

    assert.deepEqual(
      actual,
      expected
    );

    assert.equal(
      verifyBeta27ProjectionEvidenceExportManifest(
        actual,
        manifestFileTexts()
      ).ok,
      true
    );
  }
);

test(
  "BETA-27 v0 compatibility uses exact path exclusions only",
  () => {
    const source =
      readText(
        "ci/scripts/kolosseum_v0_test_suite_core.mjs"
      );

    for (
      const exactPath
      of [
        "replay/runtime/beta27ProjectionEvidenceExport.mjs",
        "src/api/beta27ProjectionEvidenceExportApi.mjs",
        "replay/contracts/beta27_projection_evidence_export_contract.json",
        "replay/contracts/beta27_projection_evidence_export_failure_tokens.json",
        "replay/suite/beta_phase1_8/projection_evidence_export_manifest.json"
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
