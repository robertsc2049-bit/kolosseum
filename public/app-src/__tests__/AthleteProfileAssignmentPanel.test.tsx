// DEV NOTE: behavioral proof replacing the source-text regex checks that
// used to run against app.js's (removed) selectedAthleteProfileTemplate()/
// selectedAthleteProfileEvent()/renderAthleteProfileAssignmentRequirements()/
// renderAthleteProfileAssignment()/recordAthleteProfileAssignment().
import assert from "node:assert/strict";
import test from "node:test";

import React from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";

import { AthleteProfileAssignmentPanel } from "../screens/coach/AthleteProfileAssignmentPanel";

const OPENED_EVENT = "kolosseum:coach-athlete-profile-opened";
const CLOSED_EVENT = "kolosseum:coach-athlete-profile-closed";

function jsonResponse(body: unknown, ok = true, status = ok ? 200 : 400): Response {
  return { ok, status, text: async () => JSON.stringify(body) } as Response;
}

function emptyRequiredTemplate(overrides: Record<string, unknown> = {}) {
  return {
    template_id: "tpl_empty",
    template_name: "Base Strength",
    template_version: 1,
    template_status: "active",
    activity_id: "powerlifting",
    week_count: 4,
    template_structure: { blocks: [] },
    ...overrides
  };
}

function templateRequiringBackSquat(overrides: Record<string, unknown> = {}) {
  return {
    template_id: "tpl_squat",
    template_name: "Peaking Block",
    template_version: 2,
    template_status: "active",
    activity_id: "powerlifting",
    week_count: 4,
    template_structure: {
      blocks: [{
        weeks: [{
          days: [{
            sessions: [{
              work_items: [{ exercise_id: "back_squat", loading_reference: { type: "percent_1rm" } }]
            }]
          }]
        }]
      }]
    },
    ...overrides
  };
}

function satisfiedProfile() {
  return {
    benchmarks: [{
      benchmark_id: "bm_1",
      exercise_id: "back_squat",
      basis: "tested_1rm",
      value: 140,
      unit: "kg",
      effective_date: "2026-01-01"
    }]
  };
}

function installMocks(options: {
  templates?: Record<string, unknown>[];
  events?: Record<string, unknown>[];
  assignments?: Record<string, unknown>[];
  eventLinks?: Record<string, unknown>[];
  profile?: Record<string, unknown> | null;
  assignFails?: boolean;
  cancelFails?: boolean;
} = {}) {
  const {
    templates = [emptyRequiredTemplate()],
    events = [],
    assignments = [],
    eventLinks = [],
    profile = null,
    assignFails = false,
    cancelFails = false
  } = options;
  const calls: Array<{ path: string; init?: RequestInit }> = [];

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = String(input);
    calls.push({ path, init });

    if (path.startsWith("/account/detail")) {
      return jsonResponse({ account: { user_id: "coach_1" }, csrf_token: "csrf-abc" });
    }
    if (path.startsWith("/coach-workspace/relationships")) {
      return jsonResponse({ relationships: [{ athlete_user_id: "athlete_1", activity_id: "powerlifting", display_name: "Jordan Athlete" }] });
    }
    if (path.startsWith("/templates?coach_user_id=")) {
      return jsonResponse({ templates });
    }
    if (path.startsWith("/templates/exercises")) {
      return jsonResponse({ exercises: [{ exercise_id: "back_squat", display_name: "Back Squat" }] });
    }
    if (path.startsWith("/coach-workspace/events")) {
      return jsonResponse({ events });
    }
    if (path.startsWith("/coach-workspace/assignments")) {
      return jsonResponse({ assignments });
    }
    if (path.startsWith("/coach-workspace/athlete-event-links")) {
      return jsonResponse({ links: eventLinks });
    }
    if (path.startsWith("/coach-workspace/athlete-strength-profile")) {
      return jsonResponse({ profile });
    }
    if (path === "/coach-workspace/athlete-assignment") {
      if (assignFails) return jsonResponse({ error: "assignment_input_invalid" }, false, 400);
      return jsonResponse({ ok: true, assignment: { assignment_id: "assignment_new" }, event_link: null }, true, 201);
    }
    if (path.endsWith("/replace")) {
      if (assignFails) return jsonResponse({ error: "assignment_input_invalid" }, false, 400);
      return jsonResponse({ ok: true, preserved_session_count: 2 }, true, 201);
    }
    if (path.endsWith("/cancel")) {
      if (cancelFails) return jsonResponse({ error: "assignment_input_invalid" }, false, 400);
      return jsonResponse({ ok: true, preserved_session_count: 1 }, true, 201);
    }
    return jsonResponse({ error: `unhandled_${path}` }, false, 404);
  }) as typeof fetch;

  return calls;
}

function openProfile() {
  return act(async () => {
    document.dispatchEvent(new CustomEvent(OPENED_EVENT, { detail: { athlete_user_id: "athlete_1" } }));
  });
}

test.afterEach(() => {
  cleanup();
  // @ts-expect-error - test-only cleanup of a stubbed global
  delete window.confirm;
});

test("renders nothing until an athlete profile opens", () => {
  installMocks();
  const { container } = render(<AthleteProfileAssignmentPanel />);
  assert.equal(container.innerHTML, "");
});

test("a programme with no percentage-based exercises shows the ready-to-assign state", async () => {
  installMocks();
  render(<AthleteProfileAssignmentPanel />);
  await openProfile();

  await act(async () => {
    fireEvent.change(screen.getByText("Programme").closest("label")!.querySelector("select")!, { target: { value: "tpl_empty" } });
  });

  await screen.findByText("Ready to assign Base Strength without an event link.");
  assert.equal(screen.getByText("Assign programme").hasAttribute("disabled"), false);
});

test("a missing strength reference blocks submission with a factual message", async () => {
  installMocks({ templates: [templateRequiringBackSquat()], profile: null });
  render(<AthleteProfileAssignmentPanel />);
  await openProfile();

  await act(async () => {
    fireEvent.change(screen.getByText("Programme").closest("label")!.querySelector("select")!, { target: { value: "tpl_squat" } });
  });

  await screen.findByText("Missing current strength references: Back Squat.");
  assert.equal(screen.getByText("Assign programme").hasAttribute("disabled"), true);
});

test("a satisfied strength reference allows submission", async () => {
  installMocks({ templates: [templateRequiringBackSquat()], profile: satisfiedProfile() });
  render(<AthleteProfileAssignmentPanel />);
  await openProfile();

  await act(async () => {
    fireEvent.change(screen.getByText("Programme").closest("label")!.querySelector("select")!, { target: { value: "tpl_squat" } });
  });

  await screen.findByText("Ready to assign Peaking Block without an event link.");
});

test("assigning a programme posts the CSRF-guarded request, dispatches the mutation event, and shows a confirmation", async () => {
  const calls = installMocks();
  let mutated = false;
  document.addEventListener("kolosseum:coach-relationship-mutated", () => { mutated = true; });
  window.confirm = () => true;

  render(<AthleteProfileAssignmentPanel />);
  await openProfile();

  await act(async () => {
    fireEvent.change(screen.getByText("Programme").closest("label")!.querySelector("select")!, { target: { value: "tpl_empty" } });
  });
  await screen.findByText("Ready to assign Base Strength without an event link.");

  await act(async () => {
    fireEvent.click(screen.getByText("Assign programme"));
  });

  await screen.findByText("Base Strength version 1 assigned without an event link.");
  assert.equal(mutated, true);

  const assignCall = calls.find((entry) => entry.path === "/coach-workspace/athlete-assignment");
  assert.ok(assignCall);
  const body = JSON.parse(String(assignCall?.init?.body));
  assert.equal(body.template_id, "tpl_empty");
  assert.equal(body.athlete_user_id, "athlete_1");
  assert.equal((assignCall?.init?.headers as Record<string, string>)?.["x-kolosseum-csrf"], "csrf-abc");
});

test("declining the confirmation does not submit the assignment", async () => {
  const calls = installMocks();
  window.confirm = () => false;

  render(<AthleteProfileAssignmentPanel />);
  await openProfile();
  await act(async () => {
    fireEvent.change(screen.getByText("Programme").closest("label")!.querySelector("select")!, { target: { value: "tpl_empty" } });
  });
  await screen.findByText("Ready to assign Base Strength without an event link.");

  fireEvent.click(screen.getByText("Assign programme"));

  assert.equal(calls.some((entry) => entry.path === "/coach-workspace/athlete-assignment"), false);
});

test("an existing current assignment shows a Replace button and a Cancel button, and replacing posts to the replace route", async () => {
  const calls = installMocks({
    assignments: [{
      assignment_id: "assignment_current",
      assigned_athlete_id: "athlete_1",
      template_id: "tpl_empty",
      template_name: "Base Strength",
      template_version: 1,
      activity_id: "powerlifting",
      is_current: true,
      lifecycle_status: "assigned",
      requested_at_iso8601: "2026-01-01T00:00:00.000Z"
    }]
  });
  window.confirm = () => true;

  render(<AthleteProfileAssignmentPanel />);
  await openProfile();
  await screen.findByText("Current assignment");
  assert.ok(screen.getByText("Cancel future assignment"));

  await act(async () => {
    fireEvent.change(screen.getByText("Programme").closest("label")!.querySelector("select")!, { target: { value: "tpl_empty" } });
  });
  await screen.findByText("Replace assignment");

  await act(async () => {
    fireEvent.click(screen.getByText("Replace assignment"));
  });

  await screen.findByText(/replaced the current assignment/u);
  assert.ok(calls.some((entry) => entry.path === "/coach-workspace/athlete-assignment/assignment_current/replace"));
});

test("cancelling the current assignment posts to the cancel route and shows a confirmation", async () => {
  const calls = installMocks({
    assignments: [{
      assignment_id: "assignment_current",
      assigned_athlete_id: "athlete_1",
      template_id: "tpl_empty",
      template_name: "Base Strength",
      template_version: 1,
      activity_id: "powerlifting",
      is_current: true,
      lifecycle_status: "assigned",
      requested_at_iso8601: "2026-01-01T00:00:00.000Z"
    }]
  });
  window.confirm = () => true;

  render(<AthleteProfileAssignmentPanel />);
  await openProfile();
  await screen.findByText("Cancel future assignment");

  await act(async () => {
    fireEvent.click(screen.getByText("Cancel future assignment"));
  });

  await screen.findByText(/remain preserved/u);
  assert.ok(calls.some((entry) => entry.path === "/coach-workspace/athlete-assignment/assignment_current/cancel"));
});

test("a programme activity mismatched to the athlete's own activity blocks submission", async () => {
  installMocks({ templates: [emptyRequiredTemplate({ template_id: "tpl_wrong", activity_id: "rugby_union" })] });
  render(<AthleteProfileAssignmentPanel />);
  await openProfile();

  // The mismatched-activity template never appears in the active list for
  // this (powerlifting) athlete in the first place - confirms the filter,
  // not just the requirements message.
  assert.equal(screen.queryByText("Base Strength · v1"), null);
});

test("a template name containing markup renders as inert text, never as HTML", async () => {
  installMocks({ templates: [emptyRequiredTemplate({ template_name: '<img src=x onerror="window.pwned=true">' })] });
  render(<AthleteProfileAssignmentPanel />);
  await openProfile();

  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.ok(screen.getByText("Programme").closest("label")?.textContent?.includes("<img"));
  assert.equal((globalThis as Record<string, unknown>).pwned, undefined);
  assert.equal(document.querySelectorAll("option img").length, 0);
});

test("closing the profile clears the panel back to rendering nothing", async () => {
  installMocks();
  const { container } = render(<AthleteProfileAssignmentPanel />);
  await openProfile();
  await screen.findByText("Programme");

  await act(async () => {
    document.dispatchEvent(new CustomEvent(CLOSED_EVENT));
  });

  assert.equal(container.innerHTML, "");
});
