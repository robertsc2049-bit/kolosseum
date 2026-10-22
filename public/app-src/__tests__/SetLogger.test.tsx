// A powerlifter with a VBT device switches on bar speed and logs a squat set
// with its mean velocity; without it, the set logger is unchanged.
import assert from "node:assert/strict";
import test from "node:test";

import React from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";

import { SetLogger } from "../screens/athlete/SetLogger";

const squat = { exercise_id: "back_squat", sets: 3, reps: 5, resolved_load: { value: 140, unit: "kg" } };

test.beforeEach(() => { try { window.localStorage.clear(); } catch { /* none */ } });
test.afterEach(() => cleanup());

test("bar speed is off until she switches it on; then it's logged with the set and remembered", async () => {
  const calls: unknown[][] = [];
  const logSet = async (...args: unknown[]) => { calls.push(args); return true; };
  render(<SetLogger exercise={squat} setLogs={[]} busy={false} logSet={logSet} />);
  assert.equal(screen.queryByLabelText("Set 1 bar speed (m/s)"), null);
  await act(async () => { fireEvent.click(screen.getByLabelText("Log bar speed (from a VBT device)")); });
  await act(async () => { fireEvent.change(screen.getByLabelText("Set 1 bar speed (m/s)"), { target: { value: "0.62" } }); });
  await act(async () => { fireEvent.click(screen.getByText("Log set 1")); });
  assert.deepEqual(calls[0], ["back_squat", 1, 5, { value: 140, unit: "kg" }, 0.62, null]);
  assert.equal(window.localStorage.getItem("kolosseum.logBarSpeed"), "1");
  await act(async () => { fireEvent.change(screen.getByLabelText("Set 2 bar speed (m/s)"), { target: { value: "6" } }); });
  await act(async () => { fireEvent.click(screen.getByText("Log set 2")); });
  assert.equal(calls.length, 1, "an impossible speed isn't sent");
  assert.ok(screen.getByText("Bar speed is in m/s, between 0.05 and 3 - or leave it blank."));
});

test("a logged set shows its bar speed; without speed on, a set is logged as before", async () => {
  const calls: unknown[][] = [];
  render(<SetLogger exercise={squat} setLogs={[{ set_index: 1, reps: 5, load_value: 140, load_unit: "kg", velocity_mps: 0.58 }]} busy={false} logSet={async (...args: unknown[]) => { calls.push(args); return true; }} />);
  assert.ok(screen.getByText("5 reps × 140 kg · 0.58 m/s"));
  await act(async () => { fireEvent.click(screen.getByText("Log set 2")); });
  assert.deepEqual(calls[0], ["back_squat", 2, 5, { value: 140, unit: "kg" }, null, null]);
});

test("a weightlifter marks a missed clean & jerk as a missed jerk; other lifts don't ask", async () => {
  const calls: unknown[][] = [];
  render(<SetLogger exercise={{ exercise_id: "clean_and_jerk", sets: 3, reps: 1, resolved_load: { value: 120, unit: "kg" } }} setLogs={[]} busy={false} logSet={async (...args: unknown[]) => { calls.push(args); return true; }} />);
  await act(async () => { fireEvent.change(screen.getByLabelText("Set 1 reps"), { target: { value: "0" } }); });
  await act(async () => { fireEvent.change(screen.getByLabelText("Set 1 missed"), { target: { value: "jerk" } }); });
  await act(async () => { fireEvent.click(screen.getByText("Log set 1")); });
  assert.deepEqual(calls[0], ["clean_and_jerk", 1, 0, { value: 120, unit: "kg" }, null, "jerk"]);
  cleanup();
  render(<SetLogger exercise={squat} setLogs={[]} busy={false} logSet={async () => true} />);
  assert.equal(screen.queryByLabelText("Set 1 missed"), null);
});

test("a pull-up with no weight set says to leave it blank for bodyweight or enter what was added", () => {
  render(<SetLogger exercise={{ exercise_id: "pull_up", sets: 4, reps: 5, intensity: { type: "rpe", value: 8 } }} setLogs={[{ set_index: 1, reps: 4, load_value: 20, load_unit: "kg", missed_part: null }]} busy={false} logSet={async () => true} />);
  assert.ok(screen.getByText(/leave the weight blank for bodyweight, or enter what you added/u));
});
