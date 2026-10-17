// Squad tools: who's available today (the reason only where the server sent
// it), the squad's test results side by side, and the squad as a CSV.
import assert from "node:assert/strict";
import test from "node:test";

import React from "react";
import { cleanup, render, screen } from "@testing-library/react";

import { AvailabilityBadge, SquadTesting, squadCsv } from "../screens/coach/SquadTools";

test.afterEach(() => cleanup());

test("availability: the reason shows on hover only when it was sent", () => {
  render(<>
    <AvailabilityBadge availability={{ status: "unavailable", reason: "Head injury stand-down", until: "2026-10-25" }} />
    <AvailabilityBadge availability={{ status: "modified" }} />
  </>);
  assert.equal(screen.getByText("Unavailable").getAttribute("title"), "Head injury stand-down until 2026-10-25");
  assert.equal(screen.getByText("Modified").getAttribute("title"), null, "a teammate's reason isn't sent, so isn't shown");
});

const testing = [{
  test_id: "cmj_cm", name: "Countermovement jump", unit: "cm", athletes: 3, average: 44.3, swc: 1.5, swc_source: "typical",
  best: { display_name: "Wing", value: 52 }, positions: [{ position: "prop", athletes: 2, average: 39 }],
  results: [
    { athlete_user_id: "u3", display_name: "Wing", position: "wing", value: 52, percentile: 100, vs_position: null, date: "2026-10-13" },
    { athlete_user_id: "u2", display_name: "Prop B", position: "prop", value: 40, percentile: 50, vs_position: 1, date: "2026-10-13" },
    { athlete_user_id: "u1", display_name: "Prop A", position: "prop", value: 38, percentile: 0, vs_position: -1, date: "2026-10-13" }
  ]
}];

test("squad testing: everyone's result ranked, with position averages and the smallest worthwhile change", () => {
  render(<SquadTesting testing={testing} />);
  const text = screen.getByTestId("team-testing").textContent ?? "";
  assert.ok(text.includes("Countermovement jump: squad average 44.3 cm (3 tested) · best 52 cm"));
  assert.ok(text.includes("Smallest worthwhile change: 1.5 cm (typical for the test"));
  assert.ok(text.includes("Position averages: prop 39"));
  const rowsShown = [...document.querySelectorAll("[data-testid=team-testing] tbody tr")].map((row) => row.textContent);
  assert.match(rowsShown[0] ?? "", /^Wing/u);
  assert.match(rowsShown[1] ?? "", /\+1/u);
});

test("the squad CSV: one row per athlete, tests as columns, commas safely quoted", () => {
  const csv = squadCsv([
    { display_name: "Prop A", position: "loose_head_prop", yours: true, availability: { status: "modified" }, adherence: { latest_pct: 100 }, load: { acute_chronic: 1.6 }, readiness: { z: -1.4 }, strength: [{ name: "Back squat", latest: 200, relative_to_bodyweight: 1.7, status: "rising" }], tests_latest: { cmj_cm: { value: 38 } } },
    { display_name: "Smith, J", position: "wing", coach_name: "Alex", availability: { status: "available" }, adherence: { latest_pct: 67 }, load: { acute_chronic: 1 }, readiness: { z: 0 }, strength: [], tests_latest: {} }
  ], testing, () => "On track");
  const lines = csv.split("\n");
  assert.equal(lines[0], "Athlete,Position,Coach,Status,Availability,Sessions done %,Load vs usual,Readiness z,Main lifts,Countermovement jump (cm)");
  assert.equal(lines[1], "Prop A,loose head prop,You,On track,Modified,100,1.6,-1.4,Back squat 200 kg (1.7x BW) rising,38");
  assert.equal(lines[2], "\"Smith, J\",wing,Alex,On track,Available,67,1,0,,");
});
