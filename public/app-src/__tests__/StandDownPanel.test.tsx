import assert from "node:assert/strict";
import test from "node:test";

import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import { StandDownPanel } from "../components/StandDownPanel";

test.afterEach(() => cleanup());

test("a rugby player records a head-injury stand-down with the date her doctor gave", () => {
  const recorded: Record<string, unknown>[] = [];
  render(<StandDownPanel standDown={null} busy={false} error={null} whose="your" onRecord={(input) => recorded.push(input)} onEnd={() => undefined} />);
  fireEvent.click(screen.getByText("Record a head injury or medical stand-down"));
  assert.ok(screen.getByText(/No sessions will be created until the date your medical professional gives/u));
  assert.equal((screen.getByLabelText("Stand-down reason") as HTMLSelectElement).value, "head_injury");
  const record = screen.getByText("Record stand-down") as HTMLButtonElement;
  assert.equal(record.disabled, true, "needs a date");
  fireEvent.change(screen.getByLabelText("No training until"), { target: { value: "2026-10-15" } });
  fireEvent.click(record);
  assert.deepEqual(recorded, [{ reason: "head_injury", until_date: "2026-10-15" }]);
});

test("an active stand-down can only be ended once a medical professional has cleared her", () => {
  let ended = 0;
  render(<StandDownPanel standDown={{ reason: "head_injury", until_date: "2026-10-15", recorded_by: "coach" }} busy={false} error={null} whose="your" onRecord={() => undefined} onEnd={() => { ended += 1; }} />);
  assert.ok(screen.getByText("Stood down from training until 2026-10-15"));
  assert.ok(screen.getByText(/Recorded by the coach\. No sessions until then - follow your medical professional's return-to-play plan\./u));
  const end = screen.getByText("End stand-down") as HTMLButtonElement;
  assert.equal(end.disabled, true);
  fireEvent.click(screen.getByLabelText("A medical professional has cleared me to train"));
  fireEvent.click(end);
  assert.equal(ended, 1);
});
