// The phone-first pickers from beta phone testing: the date of birth is typed
// (no calendar), choosing a sport never happens by itself, and the coach
// screens' sport dropdown never picks one either.
import assert from "node:assert/strict";
import test from "node:test";

import React, { useState } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import { ActivityCategoryFilter } from "../components/ActivityCategoryFilter";
import { DateOfBirthInput, toIsoDate } from "../components/DateOfBirthInput";
import { SportPicker } from "../components/SportPicker";

test.afterEach(() => cleanup());

test("a typed date of birth becomes an ISO date only once it is a real date", () => {
  assert.equal(toIsoDate("15", "1", "1990"), "1990-01-15");
  assert.equal(toIsoDate("29", "02", "2004"), "2004-02-29", "leap day");
  assert.equal(toIsoDate("29", "02", "2003"), "", "no 29 February in 2003");
  assert.equal(toIsoDate("31", "04", "1990"), "", "April has 30 days");
  assert.equal(toIsoDate("15", "01", "90"), "", "the year needs four digits");
  assert.equal(toIsoDate("", "01", "1990"), "");
});

test("the date of birth boxes take digits only and report the date as it is typed", () => {
  const seen: string[] = [];
  render(<DateOfBirthInput value="" onChange={(iso) => seen.push(iso)} />);
  fireEvent.change(screen.getByLabelText("Date of birth day"), { target: { value: "0a7" } });
  assert.equal((screen.getByLabelText("Date of birth day") as HTMLInputElement).value, "07");
  fireEvent.change(screen.getByLabelText("Date of birth month"), { target: { value: "03" } });
  fireEvent.change(screen.getByLabelText("Date of birth year"), { target: { value: "1995" } });
  assert.deepEqual(seen, ["", "", "1995-03-07"]);
});

function SportHarness() {
  const [value, setValue] = useState("");
  return <SportPicker value={value} onChange={setValue} label="Your sport (optional)" allowNone />;
}

test("an athlete who picks no sport has no sport, and the picker says so", () => {
  render(<SportHarness />);
  assert.equal((screen.getByLabelText("Not yet") as HTMLInputElement).checked, true);
  assert.equal((screen.getByLabelText("Powerlifting") as HTMLInputElement).checked, false);
  assert.ok(screen.getByText("No sport chosen yet"));
  fireEvent.click(screen.getByLabelText("Rugby union"));
  assert.ok(screen.getByText("Your sport: Rugby union"));
});

function FilterHarness() {
  const [value, setValue] = useState("");
  return (
    <>
      <ActivityCategoryFilter value={value} onChange={setValue} sportLabel="Activity" />
      <output data-testid="chosen">{value}</output>
    </>
  );
}

test("the sport dropdown never chooses powerlifting by itself", () => {
  render(<FilterHarness />);
  assert.equal(screen.getByTestId("chosen").textContent, "", "nothing picked on first render");
  assert.equal((screen.getByLabelText("Activity") as HTMLSelectElement).value, "");
});
