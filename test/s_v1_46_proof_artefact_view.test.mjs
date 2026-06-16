import assert from "node:assert/strict";
import test from "node:test";

import {
  S_V1_46_PROOF_ARTEFACT_VIEW_CONTRACT_ID,
  S_V1_46_PROOF_ARTEFACT_VIEW_FAILURE_CODES,
  S_V1_46_PROOF_ARTEFACT_VIEW_COPY_IDS,
  buildProofArtefactView,
  handleProofArtefactViewApiRequest,
  renderProofArtefactView,
} from "../src/v1ProofArtefactViewContract.mjs";

const HASH_A = "a".repeat(64);
const HASH_B = "b".repeat(64);

function baseRequest(overrides = {}) {
  const request = {
    viewer: {
      actor_id: "athlete_1",
      actor_type: "athlete",
    },
    relationship: null,
    artefact: {
      artefact_id: "artefact_1",
      artefact_type: "replay_boundary_record",
      athlete_id: "athlete_1",
      source: {
        source_id: "replay_boundary_1",
        source_type: "replay_boundary_record",
        source_bound: true,
        replay_verdict: "ACCEPTED",
        source_hash_sha256: HASH_A,
        recorded_at_utc: "2026-06-16T10:00:00Z",
        evidence_envelope: {
          envelope_id: "envelope_1",
          artefact_id: "artefact_1",
          source_id: "replay_boundary_1",
          source_bound: true,
          replay_verdict: "ACCEPTED",
          envelope_hash_sha256: HASH_B,
          generated_at_utc: "2026-06-16T10:01:00Z",
          failure_tokens: [],
        },
      },
    },
    viewed_at_utc: "2026-06-16T10:02:00Z",
  };

  return {
    ...request,
    ...overrides,
    viewer: {
      ...request.viewer,
      ...(overrides.viewer ?? {}),
    },
    artefact: {
      ...request.artefact,
      ...(overrides.artefact ?? {}),
      source: {
        ...request.artefact.source,
        ...(overrides.artefact?.source ?? {}),
        evidence_envelope:
          overrides.artefact?.source && Object.prototype.hasOwnProperty.call(overrides.artefact.source, "evidence_envelope")
            ? overrides.artefact.source.evidence_envelope
            : request.artefact.source.evidence_envelope,
      },
    },
  };
}

test("S-V1-46 builds a source-bound proof artefact view for the owning athlete", () => {
  const result = buildProofArtefactView(baseRequest());

  assert.equal(result.ok, true);
  assert.equal(result.view.contract_id, S_V1_46_PROOF_ARTEFACT_VIEW_CONTRACT_ID);
  assert.equal(result.view.permission_scope, "self");
  assert.equal(result.view.source.source_bound, true);
  assert.equal(result.view.source.replay_verdict, "ACCEPTED");
  assert.equal(result.view.proof_state, "accepted");
  assert.equal(result.view.envelope_state, "recorded");
  assert.equal(result.view.evidence_envelope.envelope_id, "envelope_1");
  assert.equal(Object.isFrozen(result.view), true);
});

test("S-V1-46 builds a permission-scoped proof artefact view for an active assigned coach", () => {
  const result = buildProofArtefactView(
    baseRequest({
      viewer: {
        actor_id: "coach_1",
        actor_type: "coach",
      },
      relationship: {
        relationship_id: "relationship_1",
        coach_id: "coach_1",
        athlete_id: "athlete_1",
        status: "active",
        permitted_artefact_ids: ["artefact_1"],
      },
    }),
  );

  assert.equal(result.ok, true);
  assert.equal(result.view.permission_scope, "assigned_coach");
  assert.equal(result.view.artefact.athlete_id, "athlete_1");
});

test("S-V1-46 blocks unrelated coach access", () => {
  const result = buildProofArtefactView(
    baseRequest({
      viewer: {
        actor_id: "coach_2",
        actor_type: "coach",
      },
      relationship: {
        relationship_id: "relationship_1",
        coach_id: "coach_1",
        athlete_id: "athlete_1",
        status: "active",
        permitted_artefact_ids: ["artefact_1"],
      },
    }),
  );

  assert.equal(result.ok, false);
  assert.equal(result.error.code, S_V1_46_PROOF_ARTEFACT_VIEW_FAILURE_CODES.PERMISSION_DENIED);
});

test("S-V1-46 blocks pending and revoked relationship access", () => {
  for (const status of ["pending", "revoked"]) {
    const result = buildProofArtefactView(
      baseRequest({
        viewer: {
          actor_id: "coach_1",
          actor_type: "coach",
        },
        relationship: {
          relationship_id: "relationship_1",
          coach_id: "coach_1",
          athlete_id: "athlete_1",
          status,
          permitted_artefact_ids: ["artefact_1"],
        },
      }),
    );

    assert.equal(result.ok, false);
    assert.equal(result.error.code, S_V1_46_PROOF_ARTEFACT_VIEW_FAILURE_CODES.PERMISSION_DENIED);
  }
});

test("S-V1-46 represents missing envelope as not_available and not as accepted proof", () => {
  const result = buildProofArtefactView(
    baseRequest({
      artefact: {
        source: {
          evidence_envelope: null,
        },
      },
    }),
  );

  assert.equal(result.ok, true);
  assert.equal(result.view.proof_state, "not_available");
  assert.equal(result.view.envelope_state, "not_available");
  assert.equal(result.view.evidence_envelope, null);
  assert.notEqual(result.view.proof_state, "accepted");
});

test("S-V1-46 rejects unbound source records", () => {
  const result = buildProofArtefactView(
    baseRequest({
      artefact: {
        source: {
          source_bound: false,
        },
      },
    }),
  );

  assert.equal(result.ok, false);
  assert.equal(result.error.code, S_V1_46_PROOF_ARTEFACT_VIEW_FAILURE_CODES.SOURCE_NOT_BOUND);
});

test("S-V1-46 rejects envelope records that do not match the artefact source", () => {
  const result = buildProofArtefactView(
    baseRequest({
      artefact: {
        source: {
          evidence_envelope: {
            envelope_id: "envelope_1",
            artefact_id: "other_artefact",
            source_id: "replay_boundary_1",
            source_bound: true,
            replay_verdict: "ACCEPTED",
            envelope_hash_sha256: HASH_B,
            generated_at_utc: "2026-06-16T10:01:00Z",
            failure_tokens: [],
          },
        },
      },
    }),
  );

  assert.equal(result.ok, false);
  assert.equal(result.error.code, S_V1_46_PROOF_ARTEFACT_VIEW_FAILURE_CODES.ENVELOPE_MISMATCH);
});

test("S-V1-46 API adapter returns permission status without mutating the read model", () => {
  const accepted = handleProofArtefactViewApiRequest(baseRequest());
  assert.equal(accepted.status, 200);
  assert.equal(accepted.body.ok, true);

  const denied = handleProofArtefactViewApiRequest(
    baseRequest({
      viewer: {
        actor_id: "athlete_2",
        actor_type: "athlete",
      },
    }),
  );

  assert.equal(denied.status, 403);
  assert.equal(denied.body.error.code, S_V1_46_PROOF_ARTEFACT_VIEW_FAILURE_CODES.PERMISSION_DENIED);
});

test("S-V1-46 renderer emits copy ids rather than inline user-facing text", () => {
  const result = buildProofArtefactView(baseRequest());
  const rendered = renderProofArtefactView(result.view);

  assert.equal(rendered.ok, true);
  assert.equal(rendered.rendered.surface_id, "v1.proof_artefact_view");
  assert.equal(rendered.rendered.title_copy_id, S_V1_46_PROOF_ARTEFACT_VIEW_COPY_IDS.TITLE);
  assert.equal(rendered.rendered.rows.length, 5);

  for (const row of rendered.rendered.rows) {
    assert.match(row.label_copy_id, /^v1\.proof_artefact_view\./);
    assert.equal(typeof row.value, "string");
  }
});

test("S-V1-46 read model is deterministic for identical explicit input", () => {
  const request = baseRequest();

  const first = buildProofArtefactView(request);
  const second = buildProofArtefactView(request);

  assert.deepEqual(first, second);
  assert.equal(first.view.view_id, second.view.view_id);
});

test("S-V1-46 output contains no external attestation, comparison, readiness, safety, or effectiveness language", () => {
  const result = buildProofArtefactView(baseRequest());
  const payload = JSON.stringify(result);

  assert.doesNotMatch(payload, /\bcertif(?:y|ied|ication)\b/i);
  assert.doesNotMatch(payload, /\brank(?:ed|ing)?\b/i);
  assert.doesNotMatch(payload, /\bready|readiness\b/i);
  assert.doesNotMatch(payload, /\bsafe|safety\b/i);
  assert.doesNotMatch(payload, /\beffective|effectiveness\b/i);
  assert.doesNotMatch(payload, /\boptimal|optimise|optimize\b/i);
});