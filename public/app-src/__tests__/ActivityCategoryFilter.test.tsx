// DEV NOTE: ActivityCategoryFilter.tsx is a pure client-side filter, not a
// resolution/mapping mechanism - these tests prove the filtering/reset
// logic and the completeness invariant (every locked activity is reachable
// through at least one category), matching this codebase's InfoTooltip.
// test.tsx idiom for a shared components/ file.
import assert from "node:assert/strict";
import test from "node:test";

import React, { useState } from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";

import {
  ActivityCategoryFilter,
  CATEGORIES,
  CATEGORY_ACTIVITY_IDS,
  sportOptionsForCategory
} from "../components/ActivityCategoryFilter";
// eslint-disable-next-line import/no-unresolved
import { V1_ACTIVITY_IDS } from "../../../shared/v1-boundary/v1ActivityRegistry.mjs";

function Harness({
  initialValue = "powerlifting",
  allowEmptySport = false
}: {
  initialValue?: string;
  allowEmptySport?: boolean;
}) {
  const [value, setValue] = useState(initialValue);
  return (
    <ActivityCategoryFilter value={value} onChange={setValue} sportLabel="Activity" allowEmptySport={allowEmptySport} />
  );
}

test.afterEach(() => {
  cleanup();
});

test("with no category chosen, the sport select shows every locked activity", () => {
  render(<Harness />);
  const sportSelect = screen.getByLabelText("Activity") as HTMLSelectElement;
  const optionValues = Array.from(sportSelect.options).map((option) => option.value);
  assert.deepEqual(optionValues, [...V1_ACTIVITY_IDS]);
});

test("picking a category narrows the sport select to exactly that category's grouping", async () => {
  render(<Harness initialValue="powerlifting" />);

  await act(async () => {
    fireEvent.change(screen.getByLabelText("Training category"), { target: { value: "body_composition" } });
  });

  const sportSelect = screen.getByLabelText("Activity") as HTMLSelectElement;
  const optionValues = Array.from(sportSelect.options).map((option) => option.value);
  assert.deepEqual(optionValues, [...CATEGORY_ACTIVITY_IDS.body_composition]);
  assert.equal(sportSelect.value, "general_strength");
});

test("picking a category that excludes the current value updates the value to the first activity in the new filtered set", async () => {
  render(<Harness initialValue="powerlifting" />);

  await act(async () => {
    fireEvent.change(screen.getByLabelText("Training category"), { target: { value: "conditioning" } });
  });

  assert.equal((screen.getByLabelText("Activity") as HTMLSelectElement).value, "hyrox");
});

test("with allowEmptySport, a category change that excludes the current value clears the sport selection instead", async () => {
  render(<Harness initialValue="powerlifting" allowEmptySport />);

  await act(async () => {
    fireEvent.change(screen.getByLabelText("Training category"), { target: { value: "conditioning" } });
  });

  assert.equal((screen.getByLabelText("Activity") as HTMLSelectElement).value, "");
});

test("the empty 'Choose' placeholder only renders when allowEmptySport is set", () => {
  render(<Harness />);
  assert.equal(screen.queryByText("Choose"), null);
  cleanup();
  render(<Harness allowEmptySport />);
  assert.ok(screen.getByText("Choose"));
});

test("an externally-supplied value that no longer belongs to the active category resets the category filter to All sports", async () => {
  function ResettableHarness() {
    const [value, setValue] = useState("general_strength");
    return (
      <div>
        <ActivityCategoryFilter value={value} onChange={setValue} sportLabel="Activity" />
        <button type="button" onClick={() => setValue("powerlifting")}>Reset externally</button>
      </div>
    );
  }

  render(<ResettableHarness />);

  await act(async () => {
    fireEvent.change(screen.getByLabelText("Training category"), { target: { value: "body_composition" } });
  });
  assert.equal((screen.getByLabelText("Training category") as HTMLSelectElement).value, "body_composition");

  await act(async () => {
    fireEvent.click(screen.getByText("Reset externally"));
  });

  assert.equal((screen.getByLabelText("Training category") as HTMLSelectElement).value, "");
  assert.equal((screen.getByLabelText("Activity") as HTMLSelectElement).value, "powerlifting");
});

test("every category grouping is non-empty and their union covers every locked activity exactly", () => {
  const seen = new Set<string>();
  for (const category of CATEGORIES) {
    const ids = CATEGORY_ACTIVITY_IDS[category.id];
    assert.ok(ids && ids.length > 0, `${category.id} must map to at least one activity`);
    for (const id of ids) seen.add(id);
  }
  assert.deepEqual([...seen].sort(), [...V1_ACTIVITY_IDS].sort());
});

test("sportOptionsForCategory falls back to every activity for an unknown or empty category id", () => {
  assert.equal(sportOptionsForCategory("").length, V1_ACTIVITY_IDS.length);
  assert.equal(sportOptionsForCategory("not_a_real_category").length, V1_ACTIVITY_IDS.length);
});
