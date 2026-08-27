// DEV NOTE: behavioral proof replacing the source-text regex checks that
// used to run against app.js's (removed) connectAthlete()/
// syncConnectAthleteRelationshipForm().
import assert from "node:assert/strict";
import test from "node:test";

import React from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";

import { ConnectAthletePanel } from "../screens/coach/ConnectAthletePanel";

function jsonResponse(body: unknown, ok = true, status = ok ? 200 : 400): Response {
  return { ok, status, text: async () => JSON.stringify(body) } as Response;
}

function installMocks(options: { connectFails?: boolean } = {}) {
  const { connectFails = false } = options;
  const calls: Array<{ path: string; init?: RequestInit }> = [];

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = String(input);
    calls.push({ path, init });

    if (path.startsWith("/account/detail")) {
      return jsonResponse({ account: { user_id: "coach_1" }, csrf_token: "csrf-abc" });
    }
    if (path === "/sessions/beta-coach-relationship") {
      if (connectFails) return jsonResponse({ error: "relationship_input_invalid" }, false, 400);
      return jsonResponse({ ok: true });
    }
    return jsonResponse({ error: `unhandled_${path}` }, false, 404);
  }) as typeof fetch;

  return calls;
}

test.afterEach(() => {
  cleanup();
});

test("the invitation expiry field only shows for a pending-invitation relationship state", () => {
  installMocks();
  render(<ConnectAthletePanel />);

  assert.equal(screen.queryByText("Invitation expiry"), null);

  fireEvent.change(screen.getByDisplayValue("Accepted connection"), { target: { value: "invited" } });
  assert.ok(screen.getByText("Invitation expiry"));
  assert.ok(screen.getByText("The athlete supplied this code or authorised this pending invitation."));
});

test("connecting an accepted athlete posts the relationship record and dispatches the mutation event", async () => {
  const calls = installMocks();
  let mutated = false;
  document.addEventListener("kolosseum:coach-relationship-mutated", () => { mutated = true; });

  render(<ConnectAthletePanel />);

  fireEvent.change(screen.getAllByRole("textbox")[0], { target: { value: "Jordan Athlete" } });
  fireEvent.change(screen.getAllByRole("textbox")[1], { target: { value: "athlete_code_1" } });
  fireEvent.click(screen.getByRole("checkbox"));

  await act(async () => {
    fireEvent.click(screen.getByText("Record relationship"));
  });

  await screen.findByText("Jordan Athlete connected.");
  assert.equal(mutated, true);

  const connectCall = calls.find((entry) => entry.path === "/sessions/beta-coach-relationship");
  assert.ok(connectCall);
  const body = JSON.parse(String(connectCall?.init?.body));
  assert.equal(body.athlete_user_id, "athlete_code_1");
  assert.equal(body.relationship_state, "accepted");
  assert.equal(body.relationship_scope, "individual_coach_athlete");
  assert.equal(body.revoked_at_iso8601, null);
  assert.equal((connectCall?.init?.headers as Record<string, string>)?.["x-kolosseum-csrf"], "csrf-abc");
});

test("connecting with a pending invitation shows the invitation-specific confirmation", async () => {
  installMocks();
  render(<ConnectAthletePanel />);

  fireEvent.change(screen.getAllByRole("textbox")[0], { target: { value: "Jordan Athlete" } });
  fireEvent.change(screen.getAllByRole("textbox")[1], { target: { value: "athlete_code_1" } });
  fireEvent.change(screen.getByDisplayValue("Accepted connection"), { target: { value: "invited" } });
  fireEvent.click(screen.getByRole("checkbox"));

  await act(async () => {
    fireEvent.click(screen.getByText("Record relationship"));
  });

  await screen.findByText("Invitation for Jordan Athlete recorded.");
});

test("a failed submission shows a factual error", async () => {
  installMocks({ connectFails: true });
  render(<ConnectAthletePanel />);

  fireEvent.change(screen.getAllByRole("textbox")[0], { target: { value: "Jordan Athlete" } });
  fireEvent.change(screen.getAllByRole("textbox")[1], { target: { value: "athlete_code_1" } });
  fireEvent.click(screen.getByRole("checkbox"));

  await act(async () => {
    fireEvent.click(screen.getByText("Record relationship"));
  });

  await screen.findByText("The relationship record could not be saved.");
});
