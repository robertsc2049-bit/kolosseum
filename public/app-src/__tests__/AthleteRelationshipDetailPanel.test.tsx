// DEV NOTE: behavioral proof replacing the source-text regex checks that
// used to run against app.js's (removed) openAthleteRelationshipDetail()/
// closeAthleteRelationshipDetail()/transitionCoachRelationship().
import assert from "node:assert/strict";
import test from "node:test";

import React from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";

import { AthleteRelationshipDetailPanel } from "../screens/coach/AthleteRelationshipDetailPanel";

function jsonResponse(body: unknown, ok = true, status = ok ? 200 : 400): Response {
  return { ok, status, text: async () => JSON.stringify(body) } as Response;
}

function baseRelationshipEntry(overrides: Record<string, unknown> = {}) {
  return {
    athlete_user_id: "athlete_1",
    display_name: "Jordan Athlete",
    activity_id: "powerlifting",
    relationship_state: "accepted",
    relationship: {
      relationship_id: "rel_1",
      relationship_state: "accepted",
      relationship_scope: "individual_coach_athlete",
      created_at_iso8601: "2026-01-01T00:00:00.000Z",
      accepted_at_iso8601: "2026-01-01T00:00:00.000Z",
      updated_at_iso8601: "2026-01-01T00:00:00.000Z",
      expires_at_iso8601: null,
      revoked_at_iso8601: null
    },
    ...overrides
  };
}

function installMocks(options: {
  relationships?: Record<string, unknown>[];
  transitionFails?: boolean;
  activityChange?: Record<string, unknown> | null;
  onProposeActivityChange?: (body: Record<string, unknown>) => Record<string, unknown>;
} = {}) {
  const { relationships = [baseRelationshipEntry()], transitionFails = false, activityChange = null, onProposeActivityChange } = options;
  const calls: Array<{ path: string; init?: RequestInit }> = [];

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = String(input);
    calls.push({ path, init });

    if (path.startsWith("/account/detail")) {
      return jsonResponse({ account: { user_id: "coach_1" }, csrf_token: "csrf-abc" });
    }
    if (path.startsWith("/coach-workspace/relationships")) {
      return jsonResponse({ relationships });
    }
    if (path.startsWith("/coach-workspace/athlete-activity-change-proposal")) {
      const body = JSON.parse(String(init?.body ?? "{}"));
      const proposal = onProposeActivityChange
        ? onProposeActivityChange(body)
        : { request_id: "req_1", requested_by: "coach", new_activity_id: body.activity_id, request_state: "proposed" };
      return jsonResponse({ ok: true, proposal });
    }
    if (path.startsWith("/coach-workspace/athlete-activity-change")) {
      return jsonResponse({ ok: true, activity_change: activityChange });
    }
    if (path === "/sessions/beta-coach-relationship") {
      if (transitionFails) return jsonResponse({ error: "relationship_input_invalid" }, false, 400);
      return jsonResponse({ ok: true });
    }
    return jsonResponse({ error: `unhandled_${path}` }, false, 404);
  }) as typeof fetch;

  return calls;
}

function openAudit(athleteUserId = "athlete_1") {
  return act(async () => {
    document.dispatchEvent(
      new CustomEvent("kolosseum:open-relationship-audit-request", { detail: { athlete_user_id: athleteUserId } })
    );
  });
}

test.afterEach(() => {
  cleanup();
  // @ts-expect-error - test-only cleanup of a stubbed global
  delete window.confirm;
});

test("renders nothing until an open-request event fires", () => {
  installMocks();
  const { container } = render(<AthleteRelationshipDetailPanel />);
  assert.equal(container.innerHTML, "");
});

test("opening for an accepted athlete shows the audit facts and both action buttons", async () => {
  installMocks();
  render(<AthleteRelationshipDetailPanel />);

  await openAudit();
  await screen.findByText("Jordan Athlete");

  assert.ok(screen.getByText("Accepted · Powerlifting"));
  assert.equal(screen.queryByText("athlete_1"), null, "the raw internal athlete id must never be shown");
  assert.equal(screen.queryByText("rel_1"), null, "the raw internal relationship id must never be shown");
  assert.ok(screen.getByText("Open training profile"));
  assert.ok(screen.getByText("Revoke relationship"));
});

test("opening for a pending-invitation athlete shows Cancel invitation but not Open training profile", async () => {
  installMocks({ relationships: [baseRelationshipEntry({ relationship_state: "invited" })] });
  render(<AthleteRelationshipDetailPanel />);

  await openAudit();
  await screen.findByText("Jordan Athlete");

  assert.equal(screen.queryByText("Open training profile"), null);
  assert.ok(screen.getByText("Cancel invitation"));
});

test("shows the athlete's declared training focus as a factual, read-only line", async () => {
  installMocks({ relationships: [baseRelationshipEntry({ training_focus: ["strength", "strength_and_conditioning"] })] });
  render(<AthleteRelationshipDetailPanel />);

  await openAudit();
  await screen.findByText("Jordan Athlete");

  assert.ok(screen.getByText("Training focus: Strength, Strength & conditioning"));
});

test("shows a factual 'none declared' line when the athlete declared no training focus", async () => {
  installMocks();
  render(<AthleteRelationshipDetailPanel />);

  await openAudit();
  await screen.findByText("Jordan Athlete");

  assert.ok(screen.getByText("Training focus: None declared"));
});

test("an unknown athlete shows a factual not-found notice", async () => {
  installMocks({ relationships: [] });
  render(<AthleteRelationshipDetailPanel />);

  await openAudit();
  await screen.findByText("The relationship record could not be found.");
});

test("Open training profile dispatches the open-profile-request bridge event", async () => {
  installMocks();
  render(<AthleteRelationshipDetailPanel />);
  await openAudit();
  await screen.findByText("Jordan Athlete");

  let requestedAthleteId: string | undefined;
  document.addEventListener("kolosseum:open-athlete-profile-request", (event) => {
    requestedAthleteId = (event as CustomEvent).detail?.athlete_user_id;
  });

  fireEvent.click(screen.getByText("Open training profile"));
  assert.equal(requestedAthleteId, "athlete_1");
});

test("revoking asks for confirmation, then posts the revoke record and dispatches the mutation event", async () => {
  const calls = installMocks();
  window.confirm = () => true;
  let mutated = false;
  document.addEventListener("kolosseum:coach-relationship-mutated", () => { mutated = true; });

  render(<AthleteRelationshipDetailPanel />);
  await openAudit();
  await screen.findByText("Jordan Athlete");

  await act(async () => {
    fireEvent.click(screen.getByText("Revoke relationship"));
  });

  assert.equal(mutated, true);
  assert.equal(screen.queryByText("Jordan Athlete"), null);

  const transitionCall = calls.find((entry) => entry.path === "/sessions/beta-coach-relationship");
  assert.ok(transitionCall);
  const body = JSON.parse(String(transitionCall?.init?.body));
  assert.equal(body.relationship_state, "revoked");
  assert.equal(body.athlete_user_id, "athlete_1");
});

test("declining the confirmation does not submit a transition", async () => {
  const calls = installMocks();
  window.confirm = () => false;

  render(<AthleteRelationshipDetailPanel />);
  await openAudit();
  await screen.findByText("Jordan Athlete");

  fireEvent.click(screen.getByText("Revoke relationship"));

  assert.equal(calls.some((entry) => entry.path === "/sessions/beta-coach-relationship"), false);
  assert.ok(screen.getByText("Jordan Athlete"));
});

test("a failed transition shows a factual error and keeps the panel open", async () => {
  installMocks({ transitionFails: true });
  window.confirm = () => true;

  render(<AthleteRelationshipDetailPanel />);
  await openAudit();
  await screen.findByText("Jordan Athlete");

  await act(async () => {
    fireEvent.click(screen.getByText("Revoke relationship"));
  });

  await screen.findByText("The relationship could not be revoked.");
  assert.ok(screen.getByText("Jordan Athlete"));
});

test("Close audit hides the panel", async () => {
  installMocks();
  render(<AthleteRelationshipDetailPanel />);
  await openAudit();
  await screen.findByText("Jordan Athlete");

  fireEvent.click(screen.getByText("Close audit"));
  assert.equal(screen.queryByText("Jordan Athlete"), null);
});

test("the close-relationship-audit bridge event (dispatched by openAthleteProfile()) also hides the panel", async () => {
  installMocks();
  render(<AthleteRelationshipDetailPanel />);
  await openAudit();
  await screen.findByText("Jordan Athlete");

  await act(async () => {
    document.dispatchEvent(new CustomEvent("kolosseum:close-relationship-audit"));
  });

  assert.equal(screen.queryByText("Jordan Athlete"), null);
});

test("an accepted athlete shows a propose-activity-change control, and submitting it posts the new activity", async () => {
  const calls = installMocks();
  render(<AthleteRelationshipDetailPanel />);
  await openAudit();
  await screen.findByText("Jordan Athlete");

  await screen.findByText("Propose a new activity");
  fireEvent.change(screen.getByLabelText("Propose a new activity"), { target: { value: "crossfit" } });

  await act(async () => {
    fireEvent.click(screen.getByText("Propose activity change"));
  });

  const proposeCall = calls.find((entry) => entry.path.startsWith("/coach-workspace/athlete-activity-change-proposal"));
  assert.ok(proposeCall);
  const body = JSON.parse(String(proposeCall?.init?.body));
  assert.equal(body.athlete_user_id, "athlete_1");
  assert.equal(body.activity_id, "crossfit");
});

test("an outstanding proposed activity change shows its status instead of the propose control", async () => {
  installMocks({
    activityChange: { request_id: "req_1", requested_by: "coach", new_activity_id: "crossfit", request_state: "proposed" }
  });
  render(<AthleteRelationshipDetailPanel />);
  await openAudit();
  await screen.findByText("Jordan Athlete");

  await screen.findByText(/Awaiting the athlete's response to change to Crossfit/iu);
  assert.equal(screen.queryByText("Propose activity change"), null);
});

test("a queued activity change shows the deferred-apply status", async () => {
  installMocks({
    activityChange: { request_id: "req_2", requested_by: "athlete", new_activity_id: "hyrox", request_state: "queued" }
  });
  render(<AthleteRelationshipDetailPanel />);
  await openAudit();
  await screen.findByText("Jordan Athlete");

  await screen.findByText(/Will change to Hyrox once the athlete's current session finishes/iu);
});

test("a display name containing markup renders as inert text, never as HTML", async () => {
  installMocks({ relationships: [baseRelationshipEntry({ display_name: '<img src=x onerror="window.pwned=true">' })] });
  render(<AthleteRelationshipDetailPanel />);

  await openAudit();
  await new Promise((resolve) => setTimeout(resolve, 10));

  assert.ok(document.querySelector(".panel-header")?.textContent?.includes("<img"));
  assert.equal((globalThis as Record<string, unknown>).pwned, undefined);
  assert.equal(document.querySelectorAll(".panel-header img").length, 0);
});
