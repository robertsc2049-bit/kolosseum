// DEV NOTE: BETA-29 integrated production beta rehearsal proof.

import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import test from "node:test";

import {
  assertBeta16CompileAdmission,
  createBeta16AcknowledgementRecord,
  createBeta16AuthRecord,
  createBeta16Phase1DeclarationRecord
} from "../dist/src/api/beta16_app_path_service.js";

import {
  buildBeta17CoachArtefactView,
  createBeta17AssignmentRecord,
  createBeta17CoachProfileRecord,
  createBeta17RelationshipRecord
} from "../dist/src/api/beta17_coach_managed_service.js";

import {
  phase1Validate
} from "../engine/dist/src/phases/phase1.js";

import {
  betaCanonicalJson
} from "../engine/dist/src/phases/betaCanonical.js";

import {
  projectBeta18Phase7
} from "../engine/dist/src/phases/beta18Phase7SchemaBinding.js";

import {
  executeBeta22ReplayOnce
} from "../ci/lib/beta22_replay_verify_lib.mjs";

import {
  sealBeta23RunnerVerdict
} from "../ci/lib/beta23_runner_verdict_lib.mjs";

import {
  createBeta26EvidenceImmutableStore
} from "../replay/runtime/beta26EvidenceImmutableStore.mjs";

import {
  createBeta27ProjectionEvidenceExportService,
  createBeta27StoredProjectionRecord
} from "../replay/runtime/beta27ProjectionEvidenceExport.mjs";

function readText(relativePath) {
  return fs.readFileSync(
    relativePath,
    "utf8"
  );
}

function readJson(relativePath) {
  return JSON.parse(
    readText(relativePath)
  );
}

function clone(value) {
  return JSON.parse(
    JSON.stringify(value)
  );
}

function sha256File(relativePath) {
  return crypto
    .createHash("sha256")
    .update(
      fs.readFileSync(relativePath)
    )
    .digest("hex");
}

const individualFixture =
  readJson(
    "test/fixtures/beta_16_app_path_phase1_6/clean_individual_user.json"
  );

const coachFixture =
  readJson(
    "test/fixtures/beta_17_coach_managed_path/clean_coach_managed_path.json"
  );

const vectorDocument =
  readJson(
    "replay/suite/beta_phase1_7/vectors.json"
  );

const bindingDocument =
  readJson(
    "replay/suite/beta_phase1_7/verify_inputs.json"
  );

function vectorById(vectorId) {
  const matches =
    vectorDocument.vectors
      .filter(
        (entry) =>
          entry.cve_header
            .vector_id ===
          vectorId
      );

  assert.equal(
    matches.length,
    1
  );

  return matches[0];
}

function bindingById(vectorId) {
  const matches =
    bindingDocument.bindings
      .filter(
        (entry) =>
          entry.vector_id ===
          vectorId
      );

  assert.equal(
    matches.length,
    1
  );

  return matches[0];
}

function completeVector(vectorId) {
  const vector =
    vectorById(vectorId);

  const binding =
    bindingById(vectorId);

  const replay =
    executeBeta22ReplayOnce(
      clone(vector),
      clone(binding)
    );

  assert.equal(
    replay.ok,
    true
  );

  assert.equal(
    replay.verdict,
    "ACCEPTED"
  );

  assert.deepEqual(
    replay.phase_attempt_counts,
    {
      phase1: 1,
      phase2: 1,
      phase3: 1,
      phase4: 1,
      phase5: 1,
      phase6: 1,
      phase7: 1
    }
  );

  const phase5 =
    JSON.parse(
      replay.phase_bytes.phase5
    );

  const executionState =
    JSON.parse(
      replay.phase_bytes.phase6
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

  const replayPhase7 =
    JSON.parse(
      replay.phase_bytes.phase7
    );

  assert.equal(
    replayPhase7.projection_hash,
    replay.phase_hashes
      .phase7_projection_hash_sha256
  );

  const phase7 =
    projectBeta18Phase7({
      phase7_projection_id:
        vectorId +
        "_phase8_projection",
      content_format:
        "application/json",
      phase6_output:
        phase6
    });

  const verdictResult =
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
    verdictResult.ok,
    true
  );

  assert.equal(
    verdictResult
      .runner_verdict
      .verdict,
    "ACCEPTED"
  );

  const evidenceStore =
    createBeta26EvidenceImmutableStore();

  const sealed =
    evidenceStore.seal({
      phase8_input: {
        phase5_output:
          phase5,
        phase6_output:
          phase6,
        phase7_output:
          phase7,
        runner_verdict:
          verdictResult.runner_verdict
      },
      gate_state: {
        cl_passed: true,
        ci_passed: true,
        pre_seal_state:
          "inactive"
      }
    });

  assert.equal(
    sealed.ok,
    true,
    JSON.stringify(sealed)
  );

  assert.equal(
    typeof sealed
      .evidence_envelope_id,
    "string"
  );

  assert.equal(
    sealed
      .evidence_envelope_id
      .length > 0,
    true
  );

  return {
    vector,
    replay,
    phase5,
    phase6,
    phase7,
    verdict:
      verdictResult.runner_verdict,
    evidenceStore,
    sealed
  };
}

test(
  "BETA-29 clean individual completes the composed Phase 1-8 path",
  () => {
    const auth =
      createBeta16AuthRecord(
        clone(
          individualFixture.auth_input
        )
      );

    const acknowledgement =
      createBeta16AcknowledgementRecord(
        clone(
          individualFixture
            .acknowledgement_input
        )
      );

    const declaration =
      createBeta16Phase1DeclarationRecord(
        clone(
          individualFixture
            .declaration_input
        )
      );

    assert.equal(auth.status, 201);
    assert.equal(
      acknowledgement.status,
      201
    );
    assert.equal(
      declaration.status,
      201
    );

    const admission =
      assertBeta16CompileAdmission(
        {
          auth_record:
            auth.body.auth_record,
          acknowledgement_record:
            acknowledgement.body
              .acknowledgement_record,
          declaration_record:
            declaration.body
              .declaration_record
        },
        clone(
          individualFixture
            .declaration_input
            .phase1_input
        )
      );

    assert.equal(
      admission.admitted,
      true
    );

    const vector =
      vectorById(
        "beta21_individual_powerlifting"
      );

    assert.equal(
      betaCanonicalJson(
        individualFixture
          .declaration_input
          .phase1_input
      ),
      betaCanonicalJson(
        vector.canonical_phase1_input
      )
    );

    const completed =
      completeVector(
        "beta21_individual_powerlifting"
      );

    assert.equal(
      completed.vector
        .cve_header
        .execution_scope,
      "individual"
    );

    assert.equal(
      completed.phase6
        .execution_status,
      "completed"
    );

    assert.equal(
      completed.verdict.verdict,
      "ACCEPTED"
    );

    assert.equal(
      completed.sealed.ok,
      true
    );
  }
);

test(
  "BETA-29 coach-managed path remains operational and reaches sealed evidence",
  () => {
    const profileResult =
      createBeta17CoachProfileRecord(
        clone(
          coachFixture
            .coach_profile_input
        )
      );

    assert.equal(
      profileResult.status,
      201
    );

    const profile =
      profileResult.body
        .coach_profile;

    const relationshipResult =
      createBeta17RelationshipRecord(
        clone(
          coachFixture
            .accepted_relationship_input
        )
      );

    assert.equal(
      relationshipResult.status,
      201
    );

    const relationship =
      relationshipResult.body
        .relationship;

    const assignment =
      createBeta17AssignmentRecord({
        ...clone(
          coachFixture.assignment_input
        ),
        coach_profile:
          profile,
        relationship
      });

    assert.equal(
      assignment.status,
      201
    );

    assert.equal(
      assignment.body
        .assignment
        .assignment_status,
      "assigned"
    );

    const artefactView =
      buildBeta17CoachArtefactView({
        coach_profile:
          profile,
        relationship,
        athlete_user_id:
          coachFixture
            .accepted_relationship_input
            .athlete_user_id,
        artefacts: [
          clone(
            coachFixture.artefact
          )
        ]
      });

    assert.equal(
      artefactView.status,
      200
    );

    assert.equal(
      artefactView.body
        .artefact_view
        .read_only,
      true
    );

    const completed =
      completeVector(
        "beta21_coach_managed_rugby_union"
      );

    assert.equal(
      completed.vector
        .cve_header
        .execution_scope,
      "coach_managed"
    );

    assert.equal(
      completed.verdict.verdict,
      "ACCEPTED"
    );

    assert.equal(
      completed.sealed.ok,
      true
    );
  }
);

test(
  "BETA-29 projection and evidence exports remain byte-identical",
  () => {
    const completed =
      completeVector(
        "beta21_individual_powerlifting"
      );

    const ownerId =
      individualFixture.auth_input
        .user_id;

    const projectionRecordResult =
      createBeta27StoredProjectionRecord(
        ownerId,
        completed.phase7
      );

    assert.equal(
      projectionRecordResult.ok,
      true
    );

    const projectionRecord =
      projectionRecordResult
        .projection_record;

    const evidenceEnvelopeId =
      completed.sealed
        .evidence_envelope_id;

    const service =
      createBeta27ProjectionEvidenceExportService({
        projection_records: [
          projectionRecord
        ],
        evidence_store:
          completed.evidenceStore,
        evidence_owner_by_id: {
          [evidenceEnvelopeId]:
            ownerId
        }
      });

    const projectionRequest = {
      actor: {
        actor_id:
          ownerId,
        actor_type:
          "individual_user"
      },
      relationship: null,
      artifact_type:
        "phase7_projection_json",
      artifact_id:
        projectionRecord
          .artifact_id
    };

    const projectionFirst =
      service.requestExport(
        projectionRequest
      );

    const projectionSecond =
      service.requestExport(
        projectionRequest
      );

    assert.equal(
      projectionFirst.ok,
      true
    );

    assert.equal(
      projectionFirst.json_bytes,
      projectionSecond.json_bytes
    );

    assert.equal(
      projectionFirst.json_bytes,
      projectionRecord.stored_bytes
    );

    const evidenceRequest = {
      actor: {
        actor_id:
          ownerId,
        actor_type:
          "individual_user"
      },
      relationship: null,
      artifact_type:
        "phase8_evidence_envelope_json",
      artifact_id:
        evidenceEnvelopeId
    };

    const evidenceFirst =
      service.requestExport(
        evidenceRequest
      );

    const evidenceSecond =
      service.requestExport(
        evidenceRequest
      );

    const storedEvidence =
      completed.evidenceStore
        .exportBytes(
          evidenceEnvelopeId
        );

    assert.equal(
      evidenceFirst.ok,
      true
    );

    assert.equal(
      evidenceFirst.json_bytes,
      evidenceSecond.json_bytes
    );

    assert.equal(
      evidenceFirst.json_bytes,
      storedEvidence.sealed_bytes
    );

    assert.equal(
      evidenceFirst
        .byte_checksum_sha256,
      storedEvidence
        .sealed_bytes_checksum_sha256
    );
  }
);

test(
  "BETA-29 organisation team unit and gym runtime declarations remain unreachable",
  () => {
    const base =
      individualFixture
        .declaration_input
        .phase1_input;

    for (
      const actorType
      of [
        "org",
        "team",
        "unit",
        "gym"
      ]
    ) {
      const result =
        phase1Validate({
          ...clone(base),
          actor_type:
            actorType
        });

      assert.equal(
        result.ok,
        false,
        actorType
      );
    }

    for (
      const executionScope
      of [
        "org_managed",
        "team_managed",
        "unit_managed",
        "gym_managed"
      ]
    ) {
      const result =
        phase1Validate({
          ...clone(base),
          execution_scope:
            executionScope,
          governing_authority_id:
            "forbidden_runtime_authority"
        });

      assert.equal(
        result.ok,
        false,
        executionScope
      );
    }

    const positiveVectors =
      vectorDocument.vectors
        .filter(
          (entry) =>
            entry.cve_header
              .vector_class ===
            "positive"
        );

    const scopes =
      new Set(
        positiveVectors.map(
          (entry) =>
            entry.cve_header
              .execution_scope
        )
      );

    assert.deepEqual(
      [...scopes].sort(),
      [
        "coach_managed",
        "individual"
      ]
    );
  }
);

test(
  "BETA-29 contract manifest command and operational checklists are bound",
  () => {
    const contract =
      readJson(
        "replay/contracts/beta29_production_beta_rehearsal_contract.json"
      );

    const manifest =
      readJson(
        "replay/suite/beta_phase1_8/production_beta_rehearsal_manifest.json"
      );

    const pkg =
      readJson(
        "package.json"
      );

    assert.equal(
      contract.slice_id,
      "BETA-29"
    );

    assert.equal(
      contract.proof_command_windows,
      "npm.cmd run rehearsal:beta"
    );

    assert.deepEqual(
      contract.required_assertions,
      [
        "clean_individual_phase1_8",
        "coach_managed_path",
        "runner_verdict_accepted",
        "phase8_evidence_sealed",
        "projection_export_byte_identical",
        "evidence_export_byte_identical",
        "forbidden_copy_scan_passed",
        "org_team_unit_gym_runtime_unreachable"
      ]
    );

    assert.equal(
      contract.boundaries
        .new_product_features,
      false
    );

    assert.equal(
      contract.boundaries
        .runtime_scope_broadened,
      false
    );

    assert.equal(
      pkg.scripts["rehearsal:beta"],
      "node ci/scripts/run_beta_29_production_beta_rehearsal.mjs && node ci/guards/beta_29_production_beta_rehearsal_guard.mjs"
    );

    assert.equal(
      pkg.scripts["proof:beta-29"],
      "npm run rehearsal:beta"
    );

    assert.equal(
      pkg.scripts["lint:fast:inline"]
        .includes(
          "npm run proof:beta-29"
        ),
      true
    );

    assert.equal(
      manifest.slice_id,
      "BETA-29"
    );

    assert.equal(
      manifest.source_count,
      Object.keys(
        manifest.paths
      ).length
    );

    for (
      const [key, relativePath]
      of Object.entries(
        manifest.paths
      )
    ) {
      assert.equal(
        fs.existsSync(relativePath),
        true,
        relativePath
      );

      assert.equal(
        sha256File(relativePath),
        manifest.sha256[key],
        relativePath
      );
    }

    const rehearsalDocument =
      readText(
        "docs/releases/BETA_29_PRODUCTION_BETA_REHEARSAL.md"
      );

    const openingChecklist =
      readText(
        "docs/releases/BETA_29_BETA_OPENING_CHECKLIST.md"
      );

    const operationsRunbook =
      readText(
        "docs/ops/V1_RUNBOOK.md"
      );

    const releaseWorkflow =
      readText(
        ".github/workflows/release.yml"
      );

    for (
      const marker
      of [
        "# BETA-29 Production Beta Rehearsal",
        "npm.cmd run rehearsal:beta",
        "No product feature",
        "Phase 1 through Phase 8",
        "byte-identical"
      ]
    ) {
      assert.equal(
        rehearsalDocument.includes(
          marker
        ),
        true,
        marker
      );
    }

    for (
      const heading
      of [
        "## Beta opening checklist",
        "## Rollback checklist",
        "## Release tag checklist",
        "## Support and incident checklist"
      ]
    ) {
      assert.equal(
        openingChecklist.includes(
          heading
        ),
        true,
        heading
      );
    }

    assert.equal(
      operationsRunbook.includes(
        "incident_recording"
      ),
      true
    );

    assert.equal(
      operationsRunbook.includes(
        "pause_conditions"
      ),
      true
    );

    assert.equal(
      releaseWorkflow.includes(
        '- "rc-*"'
      ),
      true
    );

    assert.equal(
      releaseWorkflow.includes(
        "npm run ci"
      ),
      true
    );

    assert.equal(
      releaseWorkflow.includes(
        "npm run determinism:check"
      ),
      true
    );

    assert.equal(
      releaseWorkflow.includes(
        "/health"
      ),
      true
    );

    const runner =
      readText(
        "ci/scripts/run_beta_29_production_beta_rehearsal.mjs"
      );

    for (
      const required
      of [
        "test/beta_29_production_beta_rehearsal.test.mjs",
        "ci/scripts/run_beta_22_replay_verify.mjs",
        "ci/scripts/kolosseum_v0_test_suite.mjs",
        "ci/scripts/run_beta_28_secret_scan.mjs",
        "ci/scripts/run_beta_28_dependency_audit.mjs"
      ]
    ) {
      assert.equal(
        runner.includes(required),
        true,
        required
      );
    }
  }
);
