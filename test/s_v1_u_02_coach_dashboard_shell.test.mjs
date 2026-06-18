import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

import {
  buildCoachAssignedAthleteRows,
  buildCoachDashboardShell,
  compileIgnoringCoachDashboardShell,
  listAssignedCoachAthleteIds,
  tryBuildCoachDashboardShell
} from "../src/coachDashboardShell.mjs";

import {
  getCoachDashboardShellResponse
} from "../src/api/coachDashboardShellApi.mjs";

import {
  projectCoachAssignedShell
} from "../src/coachAssignedShellProjection.mjs";

const fixture = JSON.parse(fs.readFileSync("ci/fixtures/v1_coach_dashboard_shell/s_v1_u_02_coach_dashboard_shell_cases.json", "utf8"));

function baseInput() {
  return {
    actor: fixture.actor,
    relationships: fixture.relationships,
    athletes: fixture.athletes,
    assignments: fixture.assignments,
    sessions: fixture.sessions
  };
}

function patchedInput(patch) {
  return {
    ...baseInput(),
    ...patch
  };
}

test("S-V1-U-02 returns assigned coach athlete rows only", () => {
  const assignedIds = listAssignedCoachAthleteIds(baseInput());
  assert.deepEqual(assignedIds, fixture.expected_visible_athlete_ids);

  const rows = buildCoachAssignedAthleteRows(baseInput());
  assert.equal(rows.length, 1);
  assert.equal(rows[0].athlete_user_id, "athlete_001");
  assert.equal(rows[0].assignment_count, 1);
  assert.equal(rows[0].recorded_session_count, 1);
  assert.equal(rows[0].engine_visible, false);
  assert.deepEqual(rows[0].review_surfaces, [
    "factual_history",
    "session_artefacts",
    "live_session_status"
  ]);
});

test("S-V1-U-02 dashboard shell is product permission state only", () => {
  const shell = buildCoachDashboardShell(baseInput());

  assert.equal(shell.slice_id, "S-V1-U-02");
  assert.equal(shell.surface_id, "v1_coach_dashboard_shell");
  assert.equal(shell.permission_surface_id, "coach_dashboard_shell");
  assert.equal(shell.visible_athlete_count, 1);
  assert.equal(shell.product_permission_state_only, true);
  assert.equal(shell.engine_visible, false);
  assert.equal(shell.assigned_athlete_rows[0].athlete_user_id, "athlete_001");
  assert.equal(shell.assigned_athlete_rows.some((row) => row.athlete_user_id === "athlete_002"), false);
  assert.equal(shell.assigned_athlete_rows.some((row) => row.athlete_user_id === "athlete_003"), false);
});

test("S-V1-U-02 API adapter refuses non-coach actor without engine token", () => {
  const response = getCoachDashboardShellResponse(patchedInput({
    actor: {
      actor_type: "athlete",
      user_id: "athlete_001"
    }
  }));

  assert.equal(response.status, 403);
  assert.equal(response.body.ok, false);
  assert.equal(response.body.code, "coach_dashboard_actor_not_coach");
  assert.equal(response.body.engine_visible, false);
});

test("S-V1-U-02 refuses unknown broad dashboard fields", () => {
  const result = tryBuildCoachDashboardShell(patchedInput({
    team_dashboard: []
  }));

  assert.equal(result.ok, false);
  assert.equal(result.code, "coach_dashboard_unknown_key");
});

test("S-V1-U-02 UI renderer emits copy ids and factual fields", () => {
  const shell = buildCoachDashboardShell(baseInput());
  const view = projectCoachAssignedShell(shell);

  assert.equal(view.surface_id, "v1_coach_dashboard_shell");
  assert.equal(view.title.copy_id, "coach_dashboard_shell.title");
  assert.equal(view.rows.length, 1);
  assert.equal(view.rows[0].labels.assigned.copy_id, "coach_dashboard_shell.assigned_athletes");
  assert.equal(view.rows[0].labels.recorded_sessions.copy_id, "coach_dashboard_shell.recorded_sessions");
  assert.equal(view.rows[0].labels.last_recorded_event.copy_id, "coach_dashboard_shell.last_recorded_event");
  assert.equal(view.rows[0].engine_visible, false);
});

test("S-V1-U-02 shell does not alter compile input", () => {
  const compileInput = Object.freeze({
    phase1_schema_version: "kolosseum.master.phase1.input.schema.v1_0_1",
    activity_id: "powerlifting"
  });

  const output = compileIgnoringCoachDashboardShell(compileInput);

  assert.equal(output.compile_input, compileInput);
  assert.equal(output.coach_dashboard_shell_visible_to_engine, false);
  assert.equal(output.engine_visible, false);
});