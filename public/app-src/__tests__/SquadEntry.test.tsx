// A rugby S&C coach gets the squad's data in on one screen: everyone's effort
// for Tuesday's team session, a CMJ test day, and the GPS export from the
// weekend's match.
import assert from "node:assert/strict";
import test from "node:test";

import React from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";

import { SquadEntry, guessMapping, isoDate, matchAthlete, parseCsv } from "../screens/coach/SquadEntry";
import { __resetSharedReadsForTests } from "../api/transport";

function jsonResponse(body: unknown, ok = true, status = ok ? 200 : 400): Response {
  return { ok, status, json: async () => body, text: async () => JSON.stringify(body) } as Response;
}
const posts: Array<{ path: string; body: Record<string, unknown> }> = [];
function installMocks() {
  posts.length = 0;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = String(input);
    if (path === "/account/detail") return jsonResponse({ ok: true, csrf_token: "csrf-1" });
    if (init?.method === "POST") {
      const body = typeof init.body === "string" ? JSON.parse(init.body) : {};
      posts.push({ path, body });
      const count = Array.isArray(body.entries) ? body.entries.length : Array.isArray(body.rows) ? body.rows.length : 0;
      return jsonResponse({ ok: true, added: count, skipped: [] });
    }
    return jsonResponse({ error: "unhandled" }, false, 404);
  }) as typeof fetch;
}
const squad = [
  { athlete_user_id: "a1", display_name: "Tom Hale", email: "tom@example.test" },
  { athlete_user_id: "a2", display_name: "Sione Vaka", email: "sione@example.test" },
  { athlete_user_id: "a3", display_name: "Ollie Pratt", email: null }
];

test.beforeEach(() => { __resetSharedReadsForTests(); installMocks(); });
test.afterEach(() => cleanup());

test("a Catapult-style CSV: quoted names with commas, BOM, CRLF", () => {
  const rows = parseCsv("﻿Player Name,Date,Total Distance (m),HSR (m)\r\n\"Hale, Tom\",13/10/2026,\"6,210\",512\r\n\r\nSione Vaka,13/10/2026,5400,388\r\n");
  assert.deepEqual(rows, [["Player Name", "Date", "Total Distance (m)", "HSR (m)"], ["Hale, Tom", "13/10/2026", "6,210", "512"], ["Sione Vaka", "13/10/2026", "5400", "388"]]);
});

test("columns are guessed from typical export headers", () => {
  const mapping = guessMapping(["Player Name", "Session Date", "Total Duration", "Total Distance", "High Speed Running", "Sprint Distance", "Player Load", "Avg HR", "Max HR"]);
  assert.deepEqual(mapping, { athlete: 0, date: 1, duration_min: 2, total_distance_m: 3, hsr_m: 4, sprint_m: 5, player_load: 6, avg_hr: 7, max_hr: 8 });
});

test("UK and ISO dates, and athletes matched by email then name", () => {
  assert.equal(isoDate("13/10/2026"), "2026-10-13");
  assert.equal(isoDate("3.9.2026"), "2026-09-03");
  assert.equal(isoDate("2026-10-13T09:00:00"), "2026-10-13");
  assert.equal(isoDate("Oct 13"), null);
  assert.equal(matchAthlete("SIONE@example.test", squad)?.athlete_user_id, "a2");
  assert.equal(matchAthlete(" ollie pratt ", squad)?.athlete_user_id, "a3");
  assert.equal(matchAthlete("Unknown Trialist", squad), null);
});

test("Tuesday's team session: efforts for two of three players, saved in one go", async () => {
  render(<SquadEntry athletes={squad} />);
  await act(async () => { fireEvent.click(screen.getByText("Squad session")); });
  await act(async () => {
    fireEvent.change(screen.getByLabelText("Effort for Tom Hale"), { target: { value: "7" } });
    fireEvent.change(screen.getByLabelText("Effort for Sione Vaka"), { target: { value: "8.5" } });
  });
  await act(async () => { fireEvent.click(screen.getByText("Save for 2 athletes")); });
  assert.equal(posts[0].path, "/coach-workspace/squad/sessions");
  assert.equal(posts[0].body.minutes, 90);
  assert.equal(posts[0].body.kind, "practice");
  assert.deepEqual(posts[0].body.entries, [{ athlete_user_id: "a1", srpe: 7 }, { athlete_user_id: "a2", srpe: 8.5 }]);
  assert.match(String(posts[0].body.client_request_id), /^sq_/u);
  assert.ok(screen.getByText("Saved for 2 athletes."));
});

test("CMJ test day records only those tested; the head-coach view hides test day", async () => {
  render(<SquadEntry athletes={squad} />);
  await act(async () => { fireEvent.click(screen.getByText("Test day")); });
  await act(async () => { fireEvent.change(screen.getByLabelText("Ollie Pratt result (cm)"), { target: { value: "46.5" } }); });
  await act(async () => { fireEvent.click(screen.getByText("Record 1 result")); });
  assert.equal(posts[0].path, "/coach-workspace/squad/test-day");
  assert.deepEqual([posts[0].body.test_id, posts[0].body.entries], ["cmj_cm", [{ athlete_user_id: "a3", value: 46.5 }]]);
  cleanup();
  render(<SquadEntry athletes={squad} testsAllowed={false} />);
  assert.equal(screen.queryByText("Test day"), null);
});

test("importing the match GPS file: preview says who didn't match, then the matched rows are sent", async () => {
  render(<SquadEntry athletes={squad} />);
  await act(async () => { fireEvent.click(screen.getByText("Import GPS / HR")); });
  const csv = "Player Name,Date,Total Distance (m),HSR (m),Sprint (m)\nTom Hale,17/10/2026,\"6,210\",512,140\nsione@example.test,17/10/2026,5400,388,\nTrialist Jones,17/10/2026,4800,300,90\n";
  const file = new File([csv], "match_v_northside.csv", { type: "text/csv" });
  const input = screen.getByTestId("gps-import").querySelector("input[type=file]")!;
  await act(async () => { fireEvent.change(input, { target: { files: [file] } }); });
  const preview = await screen.findByTestId("gps-preview");
  assert.match(preview.textContent ?? "", /2 of 3 rows ready\. Not matched to an athlete: Trialist Jones\./u);
  await act(async () => { fireEvent.click(screen.getByText("Import 2 sessions")); });
  assert.equal(posts[0].path, "/coach-workspace/squad/external-load");
  assert.equal(posts[0].body.source, "match_v_northside");
  assert.deepEqual(posts[0].body.rows, [
    { athlete_user_id: "a1", date: "2026-10-17", total_distance_m: 6210, hsr_m: 512, sprint_m: 140 },
    { athlete_user_id: "a2", date: "2026-10-17", total_distance_m: 5400, hsr_m: 388 }
  ]);
});

test("two athletes with the same name: a GPS row by name matches neither, and the grid shows their emails", async () => {
  const twins = [...squad, { athlete_user_id: "a4", display_name: "Tom Hale", email: "tom.h2@example.test" }];
  assert.equal(matchAthlete("Tom Hale", twins), null, "never guess between two Tom Hales");
  assert.equal(matchAthlete("tom.h2@example.test", twins)?.athlete_user_id, "a4");
  render(<SquadEntry athletes={twins} />);
  await act(async () => { fireEvent.click(screen.getByText("Squad session")); });
  assert.ok(screen.getByLabelText("Effort for Tom Hale (tom@example.test)"));
  assert.ok(screen.getByLabelText("Effort for Tom Hale (tom.h2@example.test)"));
  assert.ok(screen.getByLabelText("Effort for Sione Vaka"));
});
