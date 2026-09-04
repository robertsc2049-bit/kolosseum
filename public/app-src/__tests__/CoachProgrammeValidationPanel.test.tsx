// DEV NOTE: FULL-UI-05A programme activation validation summary
// (read-only) behavioral proof - covers programmeActivationIssues()/
// templateRecordToDraft() (programmeDraft.ts, ported from
// public/app/app.js) and CoachProgrammeValidationPanel.tsx's rendering of
// them. The event-plan-bound validation branch is out of scope - see
// programmeDraft.ts's own DEV NOTE.
import assert from "node:assert/strict";
import test from "node:test";

import React from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";

import { CoachProgrammeValidationPanel } from "../screens/coach/CoachProgrammeValidationPanel";
import { programmeActivationIssues } from "../screens/coach/programmeDraft";

const COACH_USER_ID = "coach_test123";

function jsonResponse(body: unknown, ok = true, status = ok ? 200 : 400): Response {
  return { ok, status, text: async () => JSON.stringify(body) } as Response;
}

function workItem(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    work_item_id: "item_1",
    order_index: 1,
    exercise_id: "back_squat",
    planned_sets: 3,
    prescription_mode: "reps",
    rep_prescription: { type: "fixed", value: 8 },
    rest_seconds: 90,
    role: "primary",
    coaching_notes: "",
    segment: "working",
    group_id: "",
    group_type: "straight",
    loading_reference: { type: "bodyweight" },
    ...overrides
  };
}

function session(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    session_id: "session_1",
    order_index: 1,
    title: "Session 1",
    coaching_notes: "",
    work_items: [workItem()],
    ...overrides
  };
}

function week(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    week_id: "week_1",
    order_index: 1,
    days: [{ day_id: "day_1", order_index: 1, sessions: [session()] }],
    ...overrides
  };
}

function block(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    block_id: "block_1",
    order_index: 1,
    name: "Block 1",
    description: "",
    block_type: "general",
    week_count: 1,
    weeks: [week()],
    ...overrides
  };
}

function template(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    template_id: "tmpl_1_v1",
    template_family_id: "tmpl_1",
    template_name: "Base Strength Block",
    template_version: 1,
    template_status: "draft",
    activity_id: "powerlifting",
    description: "",
    event_plan: null,
    template_structure: { blocks: [block()] },
    ...overrides
  };
}

test.afterEach(() => {
  cleanup();
});

// --- Pure function coverage: programmeActivationIssues() ---

test("a fully valid draft produces zero issues", () => {
  const issues = programmeActivationIssues(template(), [{ exercise_id: "back_squat" }]);
  assert.deepEqual(issues, []);
});

test("a missing programme name is flagged", () => {
  const issues = programmeActivationIssues(template({ template_name: "" }), []);
  assert.ok(issues.some((issue) => issue.code === "template_name_required"));
});

test("an unsupported activity is flagged", () => {
  const issues = programmeActivationIssues(template({ activity_id: "cycling" }), []);
  assert.ok(issues.some((issue) => issue.code === "activity_id_invalid"));
});

test("an exercise outside the active registry is flagged, but only when the registry is non-empty", () => {
  const withRegistry = programmeActivationIssues(template(), [{ exercise_id: "some_other_exercise" }]);
  assert.ok(withRegistry.some((issue) => issue.code === "exercise_not_in_active_registry"));

  const withEmptyRegistry = programmeActivationIssues(template(), []);
  assert.ok(!withEmptyRegistry.some((issue) => issue.code === "exercise_not_in_active_registry"));
});

test("a duplicate exercise within one session is flagged", () => {
  const duplicated = template({
    template_structure: {
      blocks: [block({
        weeks: [week({
          days: [{ day_id: "day_1", order_index: 1, sessions: [session({
            work_items: [workItem({ work_item_id: "a" }), workItem({ work_item_id: "b" })]
          })] }]
        })]
      })]
    }
  });
  const issues = programmeActivationIssues(duplicated, [{ exercise_id: "back_squat" }]);
  assert.ok(issues.some((issue) => issue.code === "duplicate_exercise_in_session"));
});

test("an invalid percent-1RM load is flagged", () => {
  const invalidLoad = template({
    template_structure: {
      blocks: [block({
        weeks: [week({
          days: [{ day_id: "day_1", order_index: 1, sessions: [session({
            work_items: [workItem({ loading_reference: { type: "percent_1rm", value: 150 } })]
          })] }]
        })]
      })]
    }
  });
  const issues = programmeActivationIssues(invalidLoad, [{ exercise_id: "back_squat" }]);
  assert.ok(issues.some((issue) => issue.code === "percent_1rm_invalid"));
});

test("an invalid Borg load is flagged", () => {
  const invalidBorg = template({
    template_structure: {
      blocks: [block({
        weeks: [week({
          days: [{ day_id: "day_1", order_index: 1, sessions: [session({
            work_items: [workItem({ loading_reference: { type: "borg", value: 25 } })]
          })] }]
        })]
      })]
    }
  });

  const issues = programmeActivationIssues(invalidBorg, [{ exercise_id: "back_squat" }]);
  assert.ok(issues.some((issue) => issue.code === "borg_value_invalid"));
});

test("an invalid CR10 load is flagged", () => {
  const invalidCr10 = template({
    template_structure: {
      blocks: [block({
        weeks: [week({
          days: [{ day_id: "day_1", order_index: 1, sessions: [session({
            work_items: [workItem({ loading_reference: { type: "cr10", value: 5.25 } })]
          })] }]
        })]
      })]
    }
  });

  const issues = programmeActivationIssues(invalidCr10, [{ exercise_id: "back_squat" }]);
  assert.ok(issues.some((issue) => issue.code === "cr10_value_invalid"));
});

test("an out-of-range rest period is flagged", () => {
  const invalidRest = template({
    template_structure: {
      blocks: [block({
        weeks: [week({
          days: [{ day_id: "day_1", order_index: 1, sessions: [session({
            work_items: [workItem({ rest_seconds: 5000 })]
          })] }]
        })]
      })]
    }
  });
  const issues = programmeActivationIssues(invalidRest, [{ exercise_id: "back_squat" }]);
  assert.ok(issues.some((issue) => issue.code === "rest_seconds_invalid"));
});

test("a session exceeding twelve exercises is flagged", () => {
  const tooMany = template({
    template_structure: {
      blocks: [block({
        weeks: [week({
          days: [{
            day_id: "day_1",
            order_index: 1,
            sessions: [session({ work_items: Array.from({ length: 13 }, (_, index) => workItem({ work_item_id: `item_${index}`, exercise_id: `exercise_${index}` })) })]
          }]
        })]
      })]
    }
  });
  const issues = programmeActivationIssues(tooMany, [{ exercise_id: "back_squat" }]);
  assert.ok(issues.some((issue) => issue.code === "session_work_item_count_invalid"));
});

test("a non-draft persisted programme is never flagged as completable at all", () => {
  const issues = programmeActivationIssues(template({ template_status: "active" }), [{ exercise_id: "back_squat" }]);
  assert.ok(issues.some((issue) => issue.code === "only_draft_can_complete"));
});

// --- Component coverage: CoachProgrammeValidationPanel ---

function installMocks(templates: Record<string, unknown>[], templateExercises: Record<string, unknown>[] = [{ exercise_id: "back_squat" }]) {
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const path = String(input);
    if (path.startsWith("/account/detail")) return jsonResponse({ account: { user_id: COACH_USER_ID } });
    if (path.startsWith("/templates?coach_user_id")) return jsonResponse({ templates });
    if (path.startsWith("/templates/exercises")) return jsonResponse({ exercises: templateExercises });
    return jsonResponse({ error: `unhandled_request_${path}` }, false, 404);
  }) as typeof fetch;
}

function openDetail(templateId: string) {
  return act(async () => {
    document.dispatchEvent(new CustomEvent("kolosseum:open-programme-detail", { detail: { template_id: templateId } }));
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

test("shows the factual persisted-state message for a non-draft version", async () => {
  installMocks([template({ template_status: "complete" })]);
  render(<CoachProgrammeValidationPanel />);
  await openDetail("tmpl_1_v1");
  await screen.findByText("This persisted version is complete. Completion checks apply to draft versions only.");
});

test("shows a clean pass message for a fully valid draft, with no edit button", async () => {
  installMocks([template()]);
  render(<CoachProgrammeValidationPanel />);
  await openDetail("tmpl_1_v1");
  await screen.findByText(/All visible completion checks pass/u);
  assert.equal(screen.queryByText("Open draft builder"), null);
});

test("lists every issue with its path, message and code, and offers Open draft builder", async () => {
  installMocks([template({ template_name: "" })]);
  render(<CoachProgrammeValidationPanel />);
  await openDetail("tmpl_1_v1");

  await screen.findByText("1 completion issue recorded.");
  assert.ok(screen.getByText("Programme name is required."));
  assert.ok(screen.getByText("template_name_required"));
  assert.ok(screen.getByText("Open draft builder"));
});

test("pluralises the issue count correctly", async () => {
  installMocks([template({ template_name: "", activity_id: "cycling" })]);
  render(<CoachProgrammeValidationPanel />);
  await openDetail("tmpl_1_v1");
  await screen.findByText("2 completion issues recorded.");
});

test("Open draft builder dispatches the edit-programme bridge event with the template id", async () => {
  installMocks([template({ template_name: "" })]);
  render(<CoachProgrammeValidationPanel />);
  await openDetail("tmpl_1_v1");
  await screen.findByText("Open draft builder");

  let captured: { eventName: string; templateId: string } | null = null;
  const original = document.dispatchEvent.bind(document);
  document.dispatchEvent = ((event: Event) => {
    if (event instanceof CustomEvent && event.type === "kolosseum:edit-programme") {
      captured = { eventName: event.type, templateId: (event.detail as { template_id?: string })?.template_id ?? "" };
    }
    return original(event);
  }) as typeof document.dispatchEvent;

  try {
    fireEvent.click(screen.getByText("Open draft builder"));
  }
  finally {
    document.dispatchEvent = original;
  }

  assert.deepEqual(captured, { eventName: "kolosseum:edit-programme", templateId: "tmpl_1_v1" });
});

test("refetches when a legacy kolosseum:templates-changed event fires for the currently open programme", async () => {
  installMocks([template({ template_name: "" })]);
  render(<CoachProgrammeValidationPanel />);
  await openDetail("tmpl_1_v1");
  await screen.findByText("template_name_required");

  installMocks([template({ template_name: "Now Named" })]);
  await act(async () => {
    document.dispatchEvent(new CustomEvent("kolosseum:templates-changed"));
  });

  await screen.findByText(/All visible completion checks pass/u);
});
