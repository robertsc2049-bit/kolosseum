import assert from "node:assert/strict";
import test from "node:test";

import React from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

import { GroupAssignSection } from "../screens/coach/GroupAssignSection";

function jsonResponse(body: unknown, ok = true, status = ok ? 200 : 400): Response {
  return { ok, status, json: async () => body, text: async () => JSON.stringify(body) } as Response;
}

// A powerlifting block with a % of 1RM back squat.
const template = {
  template_id: "tpl_1", template_name: "Meet prep", template_version: 1, activity_id: "powerlifting", template_status: "active",
  template_structure: { blocks: [{ weeks: [{ days: [{ sessions: [{ work_items: [{ exercise_id: "back_squat", loading_reference: { type: "percent_1rm", value: 80 } }] }] }] }] }] }
};
const relationships = [
  { athlete_user_id: "a1", display_name: "Asha", activity_id: "powerlifting", relationship_state: "accepted" },
  { athlete_user_id: "a2", display_name: "Ben", activity_id: "powerlifting", relationship_state: "accepted" },
  { athlete_user_id: "a3", display_name: "Cara", activity_id: "powerlifting", relationship_state: "accepted" },
  { athlete_user_id: "a4", display_name: "Dev", activity_id: "rugby_union", relationship_state: "accepted" },
  { athlete_user_id: "a5", display_name: "Eli", activity_id: "powerlifting", relationship_state: "invited" }
];
const assignments = [{ assignment_id: "as_ben", assigned_athlete_id: "a2", is_current: true, lifecycle_status: "assigned", requested_at_iso8601: "2026-09-01T00:00:00Z" }];
const squatMax = { preferred_weight_unit: "kg", benchmarks: [{ benchmark_id: "b1", exercise_id: "back_squat", value: 150, unit: "kg", basis: "tested_1rm", effective_date: "2026-09-01", source_note: "", replaces_reference_id: null }] };

function installMocks() {
  const posts: Array<{ path: string; body: Record<string, unknown> }> = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = String(input);
    const method = init?.method ?? "GET";
    if (path.startsWith("/account/detail")) return jsonResponse({ account: { user_id: "coach_1" }, csrf_token: "csrf" });
    if (path.startsWith("/coach-workspace/athlete-strength-profile")) {
      const id = new URL(path, "http://x").searchParams.get("athlete_user_id");
      return jsonResponse({ profile: id === "a3" ? null : squatMax });
    }
    if (method === "POST" && path.startsWith("/coach-workspace/athlete-assignment")) {
      posts.push({ path, body: typeof init?.body === "string" ? JSON.parse(init.body) : {} });
      return jsonResponse({ assignment: { assignment_id: "new" } }, true, 201);
    }
    return jsonResponse({ error: `unhandled_${path}` }, false, 404);
  }) as typeof fetch;
  return posts;
}

test.afterEach(() => cleanup());

test("a powerlifting coach assigns a meet block to three lifters at once; one without a squat max is flagged, not assigned", async () => {
  const posts = installMocks();
  let assigned = 0;
  render(<GroupAssignSection template={template} relationships={relationships} assignments={assignments} onAssigned={() => { assigned += 1; }} />);
  assert.equal(screen.queryByText(/Dev/u), null, "a rugby player is not offered a powerlifting programme");
  assert.equal(screen.queryByText(/Eli/u), null, "an invited athlete is not offered");
  assert.ok(screen.getByText("Ben (has a programme)"));
  fireEvent.click(screen.getByText("Select all"));
  await act(async () => {
    fireEvent.click(screen.getByText("Assign to 3 athletes"));
  });
  await waitFor(() => assert.ok(screen.getByText(/Cara: /u)));
  assert.ok(screen.getByText("Asha: Assigned."));
  assert.ok(screen.getByText("Ben: Assigned (replaced their current programme)."));
  assert.ok(screen.getByText("Cara: Not assigned - needs a current max for: back squat."));
  assert.deepEqual(posts.map((p) => p.path), ["/coach-workspace/athlete-assignment", "/coach-workspace/athlete-assignment/as_ben/replace"]);
  assert.deepEqual(posts.map((p) => p.body.athlete_user_id), ["a1", "a2"]);
  assert.ok(posts.every((p) => p.body.template_id === "tpl_1" && p.body.coach_user_id === "coach_1" && String(p.body.request_id).startsWith("assignment_")));
  assert.equal(assigned, 1, "the programme detail refreshes once");
});
