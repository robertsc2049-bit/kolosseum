import test from "node:test";
import assert from "node:assert/strict";

import {
  buildTemplateAssignmentUi,
  submitTemplateAssignmentFromUi,
  serialiseTemplateAssignmentUiProbe
} from "../src/v1TemplateAssignmentUi.mjs";
import { handleTemplateAssignmentUiRequest } from "../src/api/v1TemplateAssignmentUiApi.mjs";
import { projectTemplateAssignmentUi } from "../src/v1TemplateAssignmentProjection.mjs";

function baseInput() {
  return {
    actor: {
      actor_type: "coach",
      user_id: "coach-1"
    },
    relationships: [
      {
        relationship_id: "rel-1",
        relationship_scope: "individual",
        relationship_status: "accepted",
        coach_user_id: "coach-1",
        athlete_user_id: "athlete-1"
      },
      {
        relationship_id: "rel-2",
        relationship_scope: "individual",
        relationship_status: "revoked",
        coach_user_id: "coach-1",
        athlete_user_id: "athlete-2"
      },
      {
        relationship_id: "rel-3",
        relationship_scope: "individual",
        relationship_status: "accepted",
        coach_user_id: "coach-2",
        athlete_user_id: "athlete-3"
      }
    ],
    athletes: [
      {
        athlete_user_id: "athlete-1",
        athlete_display_id: "ATH-001"
      },
      {
        athlete_user_id: "athlete-2",
        athlete_display_id: "ATH-002"
      },
      {
        athlete_user_id: "athlete-3",
        athlete_display_id: "ATH-003"
      }
    ],
    templates: [
      {
        template_id: "template-1",
        template_display_name: "Powerlifting base block",
        template_version: "1.0.0",
        activity_id: "powerlifting",
        template_status: "assignable",
        assignable_by_coach_user_ids: ["coach-1"],
        visible_summary: "Four weekly strength sessions"
      },
      {
        template_id: "template-2",
        template_display_name: "Strongman base block",
        template_version: "1.0.0",
        activity_id: "strongman",
        template_status: "assignable",
        assignable_by_coach_user_ids: ["coach-2"],
        visible_summary: "Event practice and strength sessions"
      }
    ]
  };
}

test("S-V1-U-04 builds assignment UI for authorised coach only", () => {
  const ui = buildTemplateAssignmentUi(baseInput());

  assert.equal(ui.surface_id, "v1_template_assignment_ui");
  assert.equal(ui.coach_user_id, "coach-1");
  assert.equal(ui.can_submit_assignment, true);
  assert.equal(ui.athlete_rows.length, 1);
  assert.equal(ui.athlete_rows[0].athlete_user_id, "athlete-1");
  assert.equal(ui.athlete_rows[0].relationship_id, "rel-1");
  assert.equal(ui.template_rows.length, 1);
  assert.equal(ui.template_rows[0].template_id, "template-1");
  assert.equal(ui.engine_visible, false);
});

test("S-V1-U-04 projection exposes copy ids and no hidden internals", () => {
  const projection = projectTemplateAssignmentUi(buildTemplateAssignmentUi(baseInput()));

  assert.equal(projection.surface_id, "v1_template_assignment_ui");
  assert.equal(projection.title.copy_id, "template_assignment_ui.title");
  assert.equal(projection.athlete_rows[0].label.copy_id, "template_assignment_ui.athlete");
  assert.equal(projection.template_rows[0].labels.template.copy_id, "template_assignment_ui.template");
  assert.equal(projection.submit.copy_id, "template_assignment_ui.submit");
  assert.equal(projection.submit.enabled, true);

  const text = JSON.stringify(projection);
  for (const hidden of ["formula_text", "progression_logic", "template_internals", "calculation_source"]) {
    assert.equal(text.includes(hidden), false);
  }
});

test("S-V1-U-04 rejects non-coach actor through API adapter", () => {
  const input = baseInput();
  input.actor = {
    actor_type: "athlete",
    user_id: "athlete-1"
  };

  const response = handleTemplateAssignmentUiRequest({
    method: "GET",
    body: input
  });

  assert.equal(response.status, 403);
  assert.equal(response.body.ok, false);
  assert.equal(response.body.reason, "template_assignment_ui_actor_not_coach");
  assert.equal(response.body.engine_visible, false);
});

test("S-V1-U-04 records assignment envelope for assigned athlete and assignable template", () => {
  const input = {
    ...baseInput(),
    assignment_request: {
      assignment_request_id: "assignment-request-1",
      athlete_user_id: "athlete-1",
      template_id: "template-1",
      requested_at: "2026-06-18T14:50:00.000Z"
    }
  };

  const assignment = submitTemplateAssignmentFromUi(input);

  assert.equal(assignment.surface_id, "v1_template_assignment_ui");
  assert.equal(assignment.assignment_status, "recorded");
  assert.equal(assignment.coach_user_id, "coach-1");
  assert.equal(assignment.athlete_user_id, "athlete-1");
  assert.equal(assignment.relationship_id, "rel-1");
  assert.equal(assignment.template_id, "template-1");
  assert.equal(assignment.declared_compile_path_required, true);
  assert.equal(assignment.hidden_template_internals_exposed, false);
  assert.equal(assignment.engine_visible, false);
});

test("S-V1-U-04 rejects assignment to unassigned athlete", () => {
  const input = {
    ...baseInput(),
    assignment_request: {
      assignment_request_id: "assignment-request-2",
      athlete_user_id: "athlete-2",
      template_id: "template-1",
      requested_at: "2026-06-18T14:55:00.000Z"
    }
  };

  assert.throws(
    () => submitTemplateAssignmentFromUi(input),
    /template_assignment_ui_athlete_not_assigned/
  );
});

test("S-V1-U-04 rejects template hidden internals before UI exposure", () => {
  const input = baseInput();
  input.templates = [
    {
      ...input.templates[0],
      progression_logic: "internal"
    }
  ];

  assert.throws(
    () => buildTemplateAssignmentUi(input),
    /template_assignment_ui_hidden_internal_present/
  );
});

test("S-V1-U-04 API POST returns assignment envelope without engine token", () => {
  const response = handleTemplateAssignmentUiRequest({
    method: "POST",
    body: {
      ...baseInput(),
      assignment_request: {
        assignment_request_id: "assignment-request-3",
        athlete_user_id: "athlete-1",
        template_id: "template-1",
        requested_at: "2026-06-18T15:00:00.000Z"
      }
    }
  });

  assert.equal(response.status, 200);
  assert.equal(response.body.ok, true);
  assert.equal(response.body.assignment.assignment_status, "recorded");
  assert.equal(response.body.assignment.engine_visible, false);
  assert.equal(Object.hasOwn(response.body.assignment, "engine_token"), false);
});

test("S-V1-U-04 assignment UI cannot mutate deterministic probe", () => {
  const probe = {
    engine_version: "EB2-1.0.0",
    phase1_schema_version: "phase1.v1",
    athlete_user_id: "athlete-1",
    template_id: "template-1"
  };

  const before = serialiseTemplateAssignmentUiProbe(probe);

  submitTemplateAssignmentFromUi({
    ...baseInput(),
    assignment_request: {
      assignment_request_id: "assignment-request-4",
      athlete_user_id: "athlete-1",
      template_id: "template-1",
      requested_at: "2026-06-18T15:05:00.000Z"
    }
  });

  const after = serialiseTemplateAssignmentUiProbe(probe);
  assert.equal(after, before);
});