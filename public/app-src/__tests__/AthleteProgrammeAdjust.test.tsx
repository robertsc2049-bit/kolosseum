// A coach's change for one athlete: kept exactly as set after a break unless
// they tick that it should be made lighter too.
import assert from "node:assert/strict";
import test from "node:test";

import React from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";

import { AthleteProgrammeAdjust, overrideSummary } from "../screens/coach/AthleteProgrammeAdjust";

const PROGRAMME = { status: "active", blocks: [{ weeks: [{ week_number: 1, sessions: [{ session_index: 0, title: "Squat day", state: "current", exercises: [{ exercise_id: "back_squat", name: "Back squat", segment: "working", sets: 5, reps: "5" }] }] }] }] };

function installMocks(): Record<string, unknown>[] {
  const saved: Record<string, unknown>[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = String(input);
    if (path.endsWith("/programme-overrides")) saved.push(JSON.parse(String(init?.body)));
    const body = path.endsWith("/programme-print") ? PROGRAMME : path.startsWith("/account/detail") ? { csrf_token: "t" } : { ok: true };
    return { ok: true, status: 200, text: async () => JSON.stringify(body) } as Response;
  }) as typeof fetch;
  return saved;
}

async function openForm() {
  render(<AthleteProgrammeAdjust athleteUserId="athlete_1" />);
  await act(async () => { fireEvent.click(screen.getByText("Adjust for this athlete")); });
  await act(async () => { fireEvent.click(await screen.findByText("Adjust")); });
}

test.afterEach(() => cleanup());

test("the break option appears once a number is set, is off, and nothing is sent for it", async () => {
  const saved = installMocks();
  await openForm();
  assert.equal(screen.queryByLabelText(/first week back after a break/u), null, "nothing set yet");
  fireEvent.change(screen.getByLabelText("Weight (kg)"), { target: { value: "120" } });
  assert.equal((screen.getByLabelText(/first week back after a break/u) as HTMLInputElement).checked, false);
  assert.ok(screen.getByText(/stays exactly as you set it, even after 10\+ days away/u));
  await act(async () => { fireEvent.click(screen.getByText("Save for this athlete")); });
  assert.equal(saved[0].load_kg, 120);
  assert.equal("lighter_after_break" in saved[0], false);
});

test("ticked, it is sent, and the change says so", async () => {
  const saved = installMocks();
  await openForm();
  fireEvent.change(screen.getByLabelText("Weight (kg)"), { target: { value: "120" } });
  fireEvent.click(screen.getByLabelText(/first week back after a break/u));
  await act(async () => { fireEvent.click(screen.getByText("Save for this athlete")); });
  assert.equal(saved[0].lighter_after_break, true);
  assert.equal(overrideSummary({ load_kg: 120, lighter_after_break: true }), "120 kg, lighter after a break");
});
