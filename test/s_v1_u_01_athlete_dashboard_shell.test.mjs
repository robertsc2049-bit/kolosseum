import assert from "node:assert/strict";
import test from "node:test";

import {
  ATHLETE_DASHBOARD_BLOCKED_REASONS,
  ATHLETE_DASHBOARD_SHELL_BOUNDARY,
  ATHLETE_DASHBOARD_SHELL_COPY_IDS,
  compileIgnoringAthleteDashboardShell,
  createAthleteDashboardShellReadModel,
  getAthleteDashboardShellContract,
  lintAthleteDashboardShellCopy
} from "../src/v1AthleteDashboardShell.mjs";

const ownDashboardInput = Object.freeze({
  viewer_user_id: "ath_001",
  athlete_user_id: "ath_001",
  assignments: Object.freeze([
    Object.freeze({
      assignment_id: "assignment_002",
      athlete_user_id: "ath_001",
      programme_id: "programme_002",
      title: "Block B",
      status: "active",
      assigned_at: "2026-08-08T09:00:00Z",
      next_session_id: "session_002"
    }),
    Object.freeze({
      assignment_id: "assignment_001",
      athlete_user_id: "ath_001",
      programme_id: "programme_001",
      title: "Block A",
      status: "completed",
      assigned_at: "2026-08-01T09:00:00Z"
    })
  ]),
  sessions: Object.freeze([
    Object.freeze({
      session_id: "session_002",
      athlete_user_id: "ath_001",
      assignment_id: "assignment_002",
      status: "not_started",
      scheduled_at: "2026-08-10T18:00:00Z",
      completed_work_items: 0,
      skipped_work_items: 0,
      partial_work_items: 0,
      substitution_count: 0
    }),
    Object.freeze({
      session_id: "session_001",
      athlete_user_id: "ath_001",
      assignment_id: "assignment_001",
      status: "completed",
      scheduled_at: "2026-08-04T18:00:00Z",
      started_at: "2026-08-04T18:05:00Z",
      completed_work_items: 4,
      skipped_work_items: 1,
      partial_work_items: 0,
      substitution_count: 1
    })
  ]),
  factual_history_entries: Object.freeze([
    Object.freeze({
      history_id: "history_002",
      athlete_user_id: "ath_001",
      source_record_id: "session_002",
      history_type: "session_status",
      recorded_at: "2026-08-10T18:00:00Z",
      facts: Object.freeze({
        status: "not_started"
      })
    }),
    Object.freeze({
      history_id: "history_001",
      athlete_user_id: "ath_001",
      source_record_id: "session_001",
      history_type: "session_event",
      recorded_at: "2026-08-04T19:00:00Z",
      facts: Object.freeze({
        status: "completed",
        completed_work_items: 4,
        skipped_work_items: 1,
        substitution_count: 1
      })
    })
  ])
});

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function joined(...parts) {
  return parts.join("");
}

test("S-V1-U-01 renders own assignments sessions and factual history sections", () => {
  const dashboard = createAthleteDashboardShellReadModel(ownDashboardInput);

  assert.equal(dashboard.allowed, true);
  assert.equal(dashboard.blocked_reason, null);
  assert.equal(dashboard.title_copy_id, ATHLETE_DASHBOARD_SHELL_COPY_IDS.title);
  assert.equal(dashboard.boundary_copy_id, ATHLETE_DASHBOARD_SHELL_COPY_IDS.boundary);
  assert.deepEqual(dashboard.summary_counts, {
    assignment_count: 2,
    session_count: 2,
    factual_history_entry_count: 2,
    completed_session_count: 1,
    in_progress_session_count: 0,
    stopped_session_count: 0
  });

  assert.deepEqual(
    dashboard.sections.map((section) => section.section_id),
    ["own_assignments", "own_sessions", "factual_history"]
  );

  assert.deepEqual(
    dashboard.sections.map((section) => section.item_count),
    [2, 2, 2]
  );

  assert.equal(dashboard.sections[0].items[0].assignment_id, "assignment_002");
  assert.equal(dashboard.sections[1].items[0].session_id, "session_001");
  assert.equal(dashboard.sections[2].items[0].history_id, "history_002");
  assert.deepEqual(dashboard.engine_boundary, ATHLETE_DASHBOARD_SHELL_BOUNDARY);
});

test("S-V1-U-01 blocks dashboard access when viewer is not the athlete subject", () => {
  const dashboard = createAthleteDashboardShellReadModel({
    ...ownDashboardInput,
    viewer_user_id: "ath_002"
  });

  assert.equal(dashboard.allowed, false);
  assert.equal(dashboard.blocked_reason, ATHLETE_DASHBOARD_BLOCKED_REASONS.viewer_not_subject);
  assert.equal(dashboard.engine_boundary.own_data_only, true);
});

test("S-V1-U-01 blocks mixed-owner assignment session and factual history records", () => {
  const assignmentBlocked = createAthleteDashboardShellReadModel({
    ...ownDashboardInput,
    assignments: [
      ...ownDashboardInput.assignments,
      {
        assignment_id: "assignment_foreign",
        athlete_user_id: "ath_002",
        programme_id: "programme_999",
        status: "active",
        assigned_at: "2026-08-08T09:00:00Z"
      }
    ]
  });

  assert.equal(assignmentBlocked.allowed, false);
  assert.equal(assignmentBlocked.blocked_reason, ATHLETE_DASHBOARD_BLOCKED_REASONS.record_not_owned_by_athlete);
  assert.equal(assignmentBlocked.record_surface, "assignments");

  const sessionBlocked = createAthleteDashboardShellReadModel({
    ...ownDashboardInput,
    sessions: [
      ...ownDashboardInput.sessions,
      {
        session_id: "session_foreign",
        athlete_user_id: "ath_002",
        status: "completed",
        completed_work_items: 1,
        skipped_work_items: 0,
        partial_work_items: 0,
        substitution_count: 0
      }
    ]
  });

  assert.equal(sessionBlocked.allowed, false);
  assert.equal(sessionBlocked.blocked_reason, ATHLETE_DASHBOARD_BLOCKED_REASONS.record_not_owned_by_athlete);
  assert.equal(sessionBlocked.record_surface, "sessions");

  const historyBlocked = createAthleteDashboardShellReadModel({
    ...ownDashboardInput,
    factual_history_entries: [
      ...ownDashboardInput.factual_history_entries,
      {
        history_id: "history_foreign",
        athlete_user_id: "ath_002",
        source_record_id: "session_foreign",
        history_type: "session_event",
        recorded_at: "2026-08-04T19:00:00Z"
      }
    ]
  });

  assert.equal(historyBlocked.allowed, false);
  assert.equal(historyBlocked.blocked_reason, ATHLETE_DASHBOARD_BLOCKED_REASONS.record_not_owned_by_athlete);
  assert.equal(historyBlocked.record_surface, "factual_history_entries");
});

test("S-V1-U-01 copy lint permits factual shell copy and blocks non-scope wording", () => {
  const clean = lintAthleteDashboardShellCopy();
  assert.equal(clean.ok, true);

  const blocked = lintAthleteDashboardShellCopy({
    BAD_COPY: `This is your ${joined("rank")} view.`
  });

  assert.equal(blocked.ok, false);
  assert.equal(blocked.failures[0].term, joined("rank"));
});

test("S-V1-U-01 dashboard shell does not alter engine input or output probes", () => {
  const phaseLikeInput = Object.freeze({
    activity_id: "powerlifting",
    execution_scope: "coach_managed",
    source_phase1_hash: "phase1_hash_001",
    planned_item_ids: ["wi_001", "wi_002"]
  });

  const beforeInput = clone(phaseLikeInput);
  const dashboard = createAthleteDashboardShellReadModel(ownDashboardInput);
  const baseProbe = compileIgnoringAthleteDashboardShell(phaseLikeInput, []);
  const dashboardProbe = compileIgnoringAthleteDashboardShell(phaseLikeInput, [dashboard]);

  assert.deepEqual(phaseLikeInput, beforeInput);
  assert.equal(baseProbe.stable_probe_json, dashboardProbe.stable_probe_json);
  assert.equal(dashboardProbe.ignored_dashboard_record_count, 1);
  assert.equal(dashboardProbe.engine_boundary.reads_engine_input, false);
  assert.equal(dashboardProbe.engine_boundary.writes_engine_input, false);
  assert.equal(dashboardProbe.engine_boundary.mutates_engine_output, false);
  assert.equal(dashboardProbe.engine_boundary.changes_compile_output, false);
  assert.equal(dashboardProbe.engine_boundary.triggers_substitution, false);
});

test("S-V1-U-01 contract stays inside athlete dashboard shell non-scope", () => {
  const contract = getAthleteDashboardShellContract();

  assert.equal(contract.surface_id, "v1_athlete_dashboard_shell");
  assert.deepEqual(contract.surfaces, ["own_assignments", "own_sessions", "factual_history"]);
  assert.equal(contract.boundary.ui_shell_only, true);
  assert.equal(contract.boundary.read_model_only, true);
  assert.equal(contract.boundary.own_data_only, true);
  assert.equal(contract.boundary.creates_social_feed, false);
  assert.equal(contract.boundary.creates_friend_connections, false);
  assert.equal(contract.boundary.creates_rankings, false);
  assert.equal(contract.boundary.creates_post_v1_exchange_surface, false);
  assert.equal(contract.boundary.mutates_runtime_events, false);
  assert.equal(contract.boundary.mutates_replay_or_proof, false);
});