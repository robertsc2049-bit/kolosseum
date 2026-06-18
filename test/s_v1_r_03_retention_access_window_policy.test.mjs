import assert from "node:assert/strict";
import test from "node:test";

import {
  RETENTION_ACCESS_WINDOW_BLOCKED_REASONS,
  RETENTION_ACCESS_WINDOW_POLICY_BOUNDARY,
  createRetentionAccessWindowPolicyRecord,
  compileIgnoringRetentionAccessWindowPolicy,
  evaluateRetentionAccessWindowPolicy,
  getRetentionAccessWindowPolicyContract
} from "../src/v1RetentionAccessWindowPolicy.mjs";

const activeAccessInput = Object.freeze({
  requester_user_id: "ath_001",
  subject_user_id: "ath_001",
  access_record: Object.freeze({
    access_record_id: "access_001",
    state: "active",
    access_starts_at: "2026-08-01T00:00:00Z",
    access_ends_at: "2026-09-01T00:00:00Z",
    source: "controlled_launch"
  }),
  request: Object.freeze({
    surface: "product_access",
    requested_at: "2026-08-15T12:00:00Z",
    source_bound: false
  })
});

const activeCoachViewInput = Object.freeze({
  requester_user_id: "coach_001",
  subject_user_id: "ath_001",
  access_record: Object.freeze({
    access_record_id: "access_001",
    state: "active",
    access_starts_at: "2026-08-01T00:00:00Z",
    access_ends_at: "2026-09-01T00:00:00Z",
    source: "controlled_launch"
  }),
  relationship_record: Object.freeze({
    relationship_id: "rel_001",
    state: "accepted",
    relationship_scope: "individual",
    coach_user_id: "coach_001",
    athlete_user_id: "ath_001"
  }),
  request: Object.freeze({
    surface: "coach_assigned_view",
    requested_at: "2026-08-15T12:00:00Z",
    source_bound: false
  })
});

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function joined(...parts) {
  return parts.join("");
}

test("S-V1-R-03 allows product access inside an active controlled-launch access window", () => {
  const verdict = evaluateRetentionAccessWindowPolicy(activeAccessInput);

  assert.equal(verdict.allowed, true);
  assert.equal(verdict.blocked_reason, null);
  assert.equal(verdict.access_window_kind, "active_product_access");
  assert.equal(verdict.engine_boundary.product_policy_only, true);
  assert.deepEqual(verdict.engine_boundary, RETENTION_ACCESS_WINDOW_POLICY_BOUNDARY);

  const record = createRetentionAccessWindowPolicyRecord(verdict);
  assert.equal(record.allowed, true);
  assert.equal(record.access_window_kind, "active_product_access");
  assert.equal(record.engine_boundary.mutates_engine_output, false);
});

test("S-V1-R-03 blocks product access after the access window closes", () => {
  const verdict = evaluateRetentionAccessWindowPolicy({
    ...activeAccessInput,
    request: {
      ...activeAccessInput.request,
      requested_at: "2026-09-01T00:00:00Z"
    }
  });

  assert.equal(verdict.allowed, false);
  assert.equal(verdict.blocked_reason, RETENTION_ACCESS_WINDOW_BLOCKED_REASONS.accessWindowClosed);
  assert.equal(verdict.engine_boundary.changes_compile_output, false);
});

test("S-V1-R-03 keeps source-bound own-data export separate from paid product access", () => {
  const verdict = evaluateRetentionAccessWindowPolicy({
    requester_user_id: "ath_001",
    subject_user_id: "ath_001",
    access_record: {
      access_record_id: "access_ended",
      state: "ended",
      access_starts_at: "2026-08-01T00:00:00Z",
      access_ends_at: "2026-09-01T00:00:00Z"
    },
    request: {
      surface: "source_bound_export",
      requested_at: "2026-10-01T10:00:00Z",
      source_bound: true,
      export_scope: "own_user_data"
    }
  });

  assert.equal(verdict.allowed, true);
  assert.equal(verdict.access_window_kind, "source_bound_own_data_export");
  assert.equal(verdict.export_scope, "own_user_data");
  assert.equal(verdict.source_bound, true);
  assert.equal(verdict.engine_boundary.reads_engine_input, false);
});

test("S-V1-R-03 refuses broad or non-source-bound export requests", () => {
  const notSourceBound = evaluateRetentionAccessWindowPolicy({
    requester_user_id: "ath_001",
    subject_user_id: "ath_001",
    request: {
      surface: "source_bound_export",
      requested_at: "2026-10-01T10:00:00Z",
      source_bound: false,
      export_scope: "own_user_data"
    }
  });

  assert.equal(notSourceBound.allowed, false);
  assert.equal(notSourceBound.blocked_reason, RETENTION_ACCESS_WINDOW_BLOCKED_REASONS.sourceBoundExportRequired);

  const otherUser = evaluateRetentionAccessWindowPolicy({
    requester_user_id: "ath_002",
    subject_user_id: "ath_001",
    request: {
      surface: "source_bound_export",
      requested_at: "2026-10-01T10:00:00Z",
      source_bound: true,
      export_scope: "own_user_data"
    }
  });

  assert.equal(otherUser.allowed, false);
  assert.equal(otherUser.blocked_reason, RETENTION_ACCESS_WINDOW_BLOCKED_REASONS.ownDataExportOnly);

  const broad = evaluateRetentionAccessWindowPolicy({
    requester_user_id: "ath_001",
    subject_user_id: "ath_001",
    request: {
      surface: "source_bound_export",
      requested_at: "2026-10-01T10:00:00Z",
      source_bound: true,
      export_scope: "all_users"
    }
  });

  assert.equal(broad.allowed, false);
  assert.equal(broad.blocked_reason, RETENTION_ACCESS_WINDOW_BLOCKED_REASONS.broadExportScopeRefused);
});

test("S-V1-R-03 assigned coach view requires accepted relationship and active product access", () => {
  const allowed = evaluateRetentionAccessWindowPolicy(activeCoachViewInput);

  assert.equal(allowed.allowed, true);
  assert.equal(allowed.access_window_kind, "assigned_coach_product_view");
  assert.equal(allowed.relationship_id, "rel_001");

  const revoked = evaluateRetentionAccessWindowPolicy({
    ...activeCoachViewInput,
    relationship_record: {
      ...activeCoachViewInput.relationship_record,
      state: "revoked"
    }
  });

  assert.equal(revoked.allowed, false);
  assert.equal(revoked.blocked_reason, RETENTION_ACCESS_WINDOW_BLOCKED_REASONS.relationshipNotAccepted);

  const closedWindow = evaluateRetentionAccessWindowPolicy({
    ...activeCoachViewInput,
    request: {
      ...activeCoachViewInput.request,
      requested_at: "2026-09-01T00:00:00Z"
    }
  });

  assert.equal(closedWindow.allowed, false);
  assert.equal(closedWindow.blocked_reason, RETENTION_ACCESS_WINDOW_BLOCKED_REASONS.accessWindowClosed);
});

test("S-V1-R-03 refuses enterprise retention and organisation export fields", () => {
  assert.throws(
    () => evaluateRetentionAccessWindowPolicy({
      ...activeAccessInput,
      enterprise_retention_days: 2555
    }),
    /retention_access_window_policy_forbidden_broad_scope_field/
  );

  assert.throws(
    () => evaluateRetentionAccessWindowPolicy({
      ...activeAccessInput,
      request: {
        ...activeAccessInput.request,
        [joined("organisation", "_export_scope")]: "all_records"
      }
    }),
    /retention_access_window_policy_forbidden_broad_scope_field/
  );
});

test("S-V1-R-03 policy does not alter engine input or output probes", () => {
  const phaseLikeInput = Object.freeze({
    activity_id: "powerlifting",
    execution_scope: "coach_managed",
    source_phase1_hash: "phase1_hash_001",
    planned_item_ids: ["wi_001", "wi_002"]
  });

  const beforeInput = clone(phaseLikeInput);
  const verdict = evaluateRetentionAccessWindowPolicy(activeAccessInput);
  const policyRecord = createRetentionAccessWindowPolicyRecord(verdict);

  const baseProbe = compileIgnoringRetentionAccessWindowPolicy(phaseLikeInput, []);
  const policyProbe = compileIgnoringRetentionAccessWindowPolicy(phaseLikeInput, [policyRecord]);

  assert.deepEqual(phaseLikeInput, beforeInput);
  assert.equal(baseProbe.stable_probe_json, policyProbe.stable_probe_json);
  assert.equal(policyProbe.ignored_policy_record_count, 1);
  assert.equal(policyProbe.engine_boundary.reads_engine_input, false);
  assert.equal(policyProbe.engine_boundary.writes_engine_input, false);
  assert.equal(policyProbe.engine_boundary.mutates_engine_output, false);
  assert.equal(policyProbe.engine_boundary.changes_compile_output, false);
});

test("S-V1-R-03 contract remains product-policy only", () => {
  const contract = getRetentionAccessWindowPolicyContract();

  assert.equal(contract.policy_id, "v1_controlled_launch_retention_access_window_policy");
  assert.deepEqual(contract.surfaces, ["product_access", "coach_assigned_view", "source_bound_export"]);
  assert.deepEqual(contract.export_scopes, ["own_user_data"]);
  assert.equal(contract.boundary.product_policy_only, true);
  assert.equal(contract.boundary.creates_enterprise_retention, false);
  assert.equal(contract.boundary.creates_organisation_export, false);
  assert.equal(contract.boundary.creates_broad_legal_overhaul, false);
  assert.equal(contract.boundary.triggers_substitution, false);
  assert.equal(contract.boundary.mutates_replay_or_proof, false);
});