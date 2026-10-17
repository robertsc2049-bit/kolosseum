// A coach prints their athlete's programme: a cover with the maxes the
// weights are worked out from and the bodyweight history, the overview,
// then every week - each weight with the % of max it comes from.
import assert from "node:assert/strict";
import test from "node:test";

import React from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";

import { CoachProgrammePrintButton, coachPrintWeeks } from "../screens/coach/CoachProgrammePrintButton";

function jsonResponse(body: unknown, ok = true, status = ok ? 200 : 400): Response {
  return { ok, status, json: async () => body, text: async () => JSON.stringify(body) } as Response;
}

const squat = { exercise_id: "back_squat", name: "Back squat", segment: "working", sets: 5, reps: "5", load: "115 kg", percent: 72.5, rest_seconds: 240, notes: "" };
const row = { exercise_id: "barbell_row", name: "Barbell row", segment: "working", sets: 4, reps: "8", load: "RPE 7", percent: null, rest_seconds: 120, notes: "" };
const copy = {
  ok: true, status: "active", source: "coach", viewer: "coach",
  programme: { name: "Meet prep", total_sessions: 2 },
  current: { session_index: 0, week_number: 1, block_name: "Accumulation" },
  completed_sessions: 0,
  cover: { athlete_name: "Sam Lifter", coach_name: "Morgan", started_on: "2026-10-01", bodyweight: { value: 74, unit: "kg", as_of: "2026-10-01" }, maxes: [{ name: "Back squat", value: 160, unit: "kg", basis: "Tested 1RM", date: "2026-10-01" }], bodyweight_history: [{ value: 75, unit: "kg", date: "2026-09-01" }, { value: 74, unit: "kg", date: "2026-10-01" }] },
  blocks: [{ name: "Accumulation", block_type: "volume", weeks: [{ week_number: 1, sessions: [{ session_index: 0, title: "Squat day", state: "current", date: null, exercises: [squat, row] }, { session_index: 1, title: "Bench day", state: "upcoming", date: null, exercises: [row] }] }] }]
};

function installMocks(body: unknown) {
  const paths: string[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    paths.push(String(input));
    return jsonResponse(body);
  }) as typeof fetch;
  return paths;
}

test.afterEach(() => { cleanup(); document.body.classList.remove("printing-programme"); });

test("the coach's copy: cover with maxes and bodyweight history, the overview, then each week with the % beside every weight", async () => {
  const paths = installMocks(copy);
  let printed = 0;
  window.print = () => { printed += 1; };
  render(<CoachProgrammePrintButton athleteUserId="athlete_1" />);
  await act(async () => { fireEvent.click(screen.getByText("Print programme")); });
  assert.ok(paths.includes("/coach-workspace/athletes/athlete_1/programme-print"));
  assert.equal(printed, 1);
  const sheet = document.getElementById("programme-print-root");
  assert.deepEqual([...(sheet?.children ?? [])].map((child) => child.className), ["print-cover", "print-overview", "print-week"]);
  const cover = sheet?.querySelector("[data-testid='print-cover']")?.textContent ?? "";
  assert.match(cover, /coach's copy/iu);
  assert.ok(cover.includes("Back squat160 kgTested 1RM"), cover);
  assert.ok(cover.includes("75 kg (1 Sept 2026) → 74 kg (1 Oct 2026)") || cover.includes("75 kg (Sep 1, 2026) → 74 kg (Oct 1, 2026)"), cover);
  assert.ok(cover.includes("Progress"));
  const weekSquat = [...(sheet?.querySelectorAll(".print-week tr") ?? [])].find((tr) => tr.textContent?.includes("Back squat"));
  assert.ok(weekSquat?.textContent?.includes("115 kg (72.5%)"), weekSquat?.textContent ?? "");
  await act(async () => { window.dispatchEvent(new window.Event("afterprint")); });
  assert.equal(document.getElementById("programme-print-root"), null, "the sheet goes once printed");
});

test("an athlete without a programme from this coach is told so, and nothing prints", async () => {
  installMocks({ ok: true, status: "none" });
  let printed = 0;
  window.print = () => { printed += 1; };
  render(<CoachProgrammePrintButton athleteUserId="athlete_1" />);
  await act(async () => { fireEvent.click(screen.getByText("Print programme")); });
  await screen.findByText("This athlete has no programme from you to print.");
  assert.equal(printed, 0);
});

test("RPE work stays RPE on the coach's copy; a weight shows its %", () => {
  const weeks = coachPrintWeeks(copy as never);
  assert.deepEqual(weeks[0].sessions[0].exercises.map((exercise) => exercise.load), ["115 kg (72.5%)", "RPE 7"]);
});
