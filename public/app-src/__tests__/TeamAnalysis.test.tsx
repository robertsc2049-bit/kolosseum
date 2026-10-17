// A coach in a rugby club's team org sees the squad as a team: what stands
// out for the group, by position and by coach, then every athlete - their
// own athletes open in full, a teammate's pain is only a flag.
import assert from "node:assert/strict";
import test from "node:test";

import React from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";

import { CoachAnalysisPanel } from "../screens/coach/CoachAnalysisPanel";
import { __resetSharedReadsForTests } from "../api/transport";

function jsonResponse(body: unknown, ok = true, status = ok ? 200 : 400): Response {
  return { ok, status, json: async () => body, text: async () => JSON.stringify(body) } as Response;
}

const summary = {
  athletes: 8, trained: 7,
  status: { needs_a_look: 3, keep_an_eye_on: 1, on_track: 3, no_training: 1 },
  adherence: { average_pct: 88, under_70: 2, counted: 7 },
  load: { average_ratio: 1.21, high: 3, low: 0, counted: 7 },
  readiness: { low: 3, counted: 7 },
  pain: { athletes_with_recurring_pain: 1 },
  lifts: { counted: 8, rising: 4, steady: 2, plateau: 0, falling: 2 },
  weekly: [{ week_start: "2026-09-28", adherence_pct: 95, load_ratio: 1.0, readiness_low: 0 }, { week_start: "2026-10-05", adherence_pct: 88, load_ratio: 1.21, readiness_low: 3 }]
};
const teamData = {
  ok: true, weeks: 8, org: { org_id: "org_rfc", org_name: "Riverside RFC" },
  summary,
  findings: [{ id: "group_load_high", section: "load", level: "watch", text: "3 athletes of 7 had a big jump in training load last week (over 1.3× their usual).", action: "Ease the next week for everyone affected." }],
  by_position: [
    { key: "prop", label: "Prop", athletes: 3, summary: { ...summary, athletes: 3, load: { average_ratio: 1.52, high: 3, low: 0, counted: 3 } }, findings: [{ id: "group_load_high", level: "alert", text: "3 athletes of 3 had a big jump in training load last week (over 1.3× their usual)." }] },
    { key: "centre", label: "Centre", athletes: 2, summary: { ...summary, athletes: 2 }, findings: [] }
  ],
  by_coach: [{ key: "c1", label: "Sam", athletes: 4, summary, findings: [] }, { key: "c2", label: "Alex", athletes: 4, summary, findings: [] }],
  athletes: [
    { athlete_user_id: "u_prop_a", display_name: "Prop A", yours: true, coach_name: "Sam", position: "prop", attention: 6, last_session: "2026-10-10", findings: [{ id: "pain_knee", level: "alert", text: "Knee pain reported in 2 different weeks (Back squat)." }], adherence: { latest_pct: 100 }, load: { acute_chronic: 1.6 } },
    { athlete_user_id: "u_centre", display_name: "Centre B", yours: false, coach_name: "Alex", position: "centre", attention: 3, last_session: "2026-10-10", findings: [{ id: "pain_reported", level: "alert", text: "Recurring pain reported - the detail is with their coach." }], adherence: { latest_pct: 67 }, load: { acute_chronic: 1.0 } }
  ]
};

function installMocks() {
  const paths: string[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const path = String(input);
    paths.push(path);
    if (path === "/coach-workspace/analysis") return jsonResponse({ ok: true, weeks: 8, athletes: [] });
    if (path === "/coach-workspace/org-memberships") {
      return jsonResponse({ ok: true, memberships: [
        { org_id: "org_rfc", org_name: "Riverside RFC", membership_status: "active", visibility_mode: "shared" },
        { org_id: "org_gym", org_name: "City Gym", membership_status: "active", visibility_mode: "individual" }
      ] });
    }
    if (path === "/coach-workspace/organisations/org_rfc/team-analysis") return jsonResponse(teamData);
    if (path.startsWith("/coach-workspace/athletes/u_prop_a/analysis")) return jsonResponse({ ok: true, weeks: 12, athlete: { display_name: "Prop A" }, findings: [], analysis: null });
    return jsonResponse({ error: "unhandled" }, false, 404);
  }) as typeof fetch;
  return paths;
}

test.beforeEach(() => { window.location.hash = "#/coach/progress"; __resetSharedReadsForTests(); });
test.afterEach(() => cleanup());

test("a coach in a team org opens the team: group findings with next steps, by position and coach, every athlete", async () => {
  const paths = installMocks();
  render(<CoachAnalysisPanel />);
  await screen.findByText("Team: Riverside RFC");
  assert.equal(screen.queryByText("Team: City Gym"), null, "a gym's coaches keep their athletes private - no team view");
  await act(async () => { fireEvent.click(screen.getByText("Team: Riverside RFC")); });
  await screen.findByTestId("team-analysis");
  assert.ok(paths.includes("/coach-workspace/organisations/org_rfc/team-analysis"));
  assert.ok(screen.getByText("3 athletes of 7 had a big jump in training load last week (over 1.3× their usual)."));
  assert.ok(screen.getByText("Ease the next week for everyone affected."), "next step shown");
  const tiles = screen.getByTestId("team-tiles").textContent ?? "";
  assert.ok(tiles.includes("7 of 8") && tiles.includes("88%") && tiles.includes("1.21×") && tiles.includes("details with their coach"));
  const positions = screen.getByTestId("team-by-position").textContent ?? "";
  assert.ok(positions.includes("Prop") && positions.includes("1.52×") && positions.includes("3 athletes of 3 had a big jump"));
  assert.ok(screen.getByTestId("team-by-coach").textContent?.includes("Alex"));
  const everyone = screen.getByTestId("team-athletes");
  assert.ok(everyone.textContent?.includes("Recurring pain reported - the detail is with their coach."));
  assert.equal(everyone.querySelectorAll(".analysis-athlete-link").length, 1, "only your own athlete opens");
  assert.ok(screen.getByTestId("explain-team"));

  await act(async () => { fireEvent.click(screen.getByText("Prop A")); });
  assert.ok(paths.some((p) => p.startsWith("/coach-workspace/athletes/u_prop_a/analysis")), "your own athlete opens in full");
});

test("a coach with no team orgs sees no team switch", async () => {
  installMocks();
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const path = String(input);
    if (path === "/coach-workspace/analysis") return jsonResponse({ ok: true, weeks: 8, athletes: [] });
    if (path === "/coach-workspace/org-memberships") return jsonResponse({ ok: true, memberships: [] });
    return jsonResponse({ error: "unhandled" }, false, 404);
  }) as typeof fetch;
  render(<CoachAnalysisPanel />);
  await screen.findByText("No athletes yet");
  assert.equal(screen.queryByText("My athletes"), null);
});
