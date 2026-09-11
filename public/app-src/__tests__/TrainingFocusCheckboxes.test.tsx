// DEV NOTE: TrainingFocusCheckboxes.tsx behavioral proof - unlike
// AccessibilityCheckboxes.tsx's fixed-key boolean record, this is a
// variable-length array-of-selected-ids toggle, so these tests focus on
// add/remove-from-array correctness.
import assert from "node:assert/strict";
import test from "node:test";

import React, { useState } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import { TRAINING_FOCUS_OPTIONS, TrainingFocusCheckboxes } from "../components/TrainingFocusCheckboxes";

function Harness({ initial = [] as string[] }: { initial?: string[] }) {
  const [value, setValue] = useState<string[]>(initial);
  return <TrainingFocusCheckboxes value={value} onChange={setValue} />;
}

test.afterEach(() => {
  cleanup();
});

test("renders one checkbox per training focus option, all unchecked by default", () => {
  render(<Harness />);
  for (const option of TRAINING_FOCUS_OPTIONS) {
    const checkbox = screen.getByLabelText(option.label) as HTMLInputElement;
    assert.equal(checkbox.checked, false);
  }
});

test("checking a box adds its id to the array", () => {
  render(<Harness />);
  fireEvent.click(screen.getByLabelText("Strength"));
  assert.equal((screen.getByLabelText("Strength") as HTMLInputElement).checked, true);
  assert.equal((screen.getByLabelText("Power") as HTMLInputElement).checked, false);
});

test("multiple selections accumulate independently", () => {
  render(<Harness />);
  fireEvent.click(screen.getByLabelText("Strength"));
  fireEvent.click(screen.getByLabelText("Power"));
  fireEvent.click(screen.getByLabelText("Plyometric"));

  assert.equal((screen.getByLabelText("Strength") as HTMLInputElement).checked, true);
  assert.equal((screen.getByLabelText("Power") as HTMLInputElement).checked, true);
  assert.equal((screen.getByLabelText("Plyometric") as HTMLInputElement).checked, true);
  assert.equal((screen.getByLabelText("Conditioning") as HTMLInputElement).checked, false);
});

test("unchecking a box removes only that one id from the array, leaving the rest selected", () => {
  render(<Harness initial={["strength", "power", "conditioning"]} />);

  assert.equal((screen.getByLabelText("Strength") as HTMLInputElement).checked, true);
  assert.equal((screen.getByLabelText("Power") as HTMLInputElement).checked, true);
  assert.equal((screen.getByLabelText("Conditioning") as HTMLInputElement).checked, true);

  fireEvent.click(screen.getByLabelText("Power"));

  assert.equal((screen.getByLabelText("Strength") as HTMLInputElement).checked, true);
  assert.equal((screen.getByLabelText("Power") as HTMLInputElement).checked, false);
  assert.equal((screen.getByLabelText("Conditioning") as HTMLInputElement).checked, true);
});

test("every declared option id matches the backend's ATHLETE_TRAINING_FOCUS_OPTIONS list", () => {
  const ids = TRAINING_FOCUS_OPTIONS.map((option) => option.id).sort();
  assert.deepEqual(ids, [
    "body_composition", "conditioning", "plyometric",
    "power", "strength", "strength_and_conditioning"
  ]);
});
