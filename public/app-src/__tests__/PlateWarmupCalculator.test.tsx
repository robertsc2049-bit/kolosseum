import assert from "node:assert/strict";
import test from "node:test";

import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import { PlateWarmupCalculator } from "../components/PlateWarmupCalculator";

test.afterEach(() => {
  cleanup();
});

function openCalculator() {
  fireEvent.click(screen.getByText("Plate calculator & warm-up ramp"));
}

test("pre-fills the target weight and unit from a load-type exercise", () => {
  const { container } = render(<PlateWarmupCalculator exercise={{ intensity: { type: "load", value: 100, unit: "kg" } }} />);
  openCalculator();

  assert.equal((screen.getByLabelText("Target weight") as HTMLInputElement).value, "100");
  assert.equal((screen.getByLabelText("Unit") as HTMLSelectElement).value, "kg");
  assert.ok(screen.getByText("1 × 25kg"));
  assert.ok(screen.getByText("1 × 15kg"));
  assert.ok(screen.getByText("Bar: 20kg × 8-10"));
  assert.equal(container.querySelectorAll(".barbell-diagram-plate").length, 2);
});

test("shows just the bar in the diagram, with no plate rects, before a target weight is entered", () => {
  const { container } = render(<PlateWarmupCalculator exercise={{ intensity: { type: "rpe", value: 8 } }} />);
  openCalculator();

  assert.equal(container.querySelector(".barbell-diagram"), null);
});

test("starts empty and computes on manual entry for a non-numeric-intensity exercise", () => {
  render(<PlateWarmupCalculator exercise={{ intensity: { type: "rpe", value: 8 } }} />);
  openCalculator();

  assert.equal((screen.getByLabelText("Target weight") as HTMLInputElement).value, "");
  assert.ok(screen.getByText("Enter a target weight to see the plate breakdown and warm-up ramp."));

  fireEvent.change(screen.getByLabelText("Target weight"), { target: { value: "225" } });
  fireEvent.change(screen.getByLabelText("Unit"), { target: { value: "lb" } });

  assert.ok(screen.getByText("2 × 45lb"));
});

test("switching units resets the bar weight and the available-plates list to the other unit's standard set", () => {
  render(<PlateWarmupCalculator exercise={{ intensity: { type: "load", value: 100, unit: "kg" } }} />);
  openCalculator();

  assert.equal((screen.getByLabelText("Bar weight") as HTMLInputElement).value, "20");
  assert.ok(screen.getByText("1 × 25kg"));
  assert.ok(screen.getByText("Available plates: 25kg, 20kg, 15kg, 10kg, 5kg, 2.5kg, 1.25kg"));

  fireEvent.change(screen.getByLabelText("Unit"), { target: { value: "lb" } });

  assert.equal((screen.getByLabelText("Bar weight") as HTMLInputElement).value, "45");
  assert.ok(screen.getByText("1 × 25lb"));
  assert.ok(screen.getByText("1 × 2.5lb"));
  assert.ok(screen.getByText("Available plates: 45lb, 35lb, 25lb, 10lb, 5lb, 2.5lb"));
});

test("the collars checkbox is labeled with the real per-collar weight (2.5kg each), matching kolosseum.tools/ironclock's own '2.5kg each / 5kg pair' button copy - not just the 5kg pair total", () => {
  render(<PlateWarmupCalculator exercise={{ intensity: { type: "load", value: 100, unit: "kg" } }} />);
  openCalculator();

  assert.ok(screen.getByText("Weighted collars (2.5kg each / 5kg pair)"));
});

test("enabling weighted collars subtracts their pair weight before splitting plates, and shows a note with the extra weight", () => {
  const { container } = render(<PlateWarmupCalculator exercise={{ intensity: { type: "load", value: 95, unit: "kg" } }} />);
  openCalculator();

  // The dynamic "+ Nkg weighted collars" note (distinct from the static
  // checkbox label of the same name, which is already on the page) only
  // appears once collars are actually enabled.
  assert.equal(screen.queryByText("+ 5kg weighted collars"), null);

  fireEvent.click(screen.getByLabelText("Weighted collars (2.5kg each / 5kg pair)"));

  assert.ok(screen.getByText("1 × 25kg"));
  assert.ok(screen.getByText("1 × 10kg"));
  assert.equal(screen.queryByText(/× 2\.5kg/), null, "this target's plate breakdown has no 2.5kg plate");
  assert.ok(screen.getByText("+ 5kg weighted collars"));

  // The collar element itself carries no text label, matching
  // kolosseum.tools/ironclock's own unlabeled collar div.
  const labels = Array.from(container.querySelectorAll(".barbell-diagram-plate-label")).map((node) => node.textContent);
  assert.deepEqual(labels, ["25", "10"]);
});

// DEV NOTE: ported from kolosseum.tools/ironclock's `available` Set - not
// every gym has every plate. 25kg specifically, since ironclock gives it
// its own "25kg available" quick toggle rather than assuming every gym
// has one.
test("every plate, including 25kg, is individually available to untick - not every gym has one", () => {
  render(<PlateWarmupCalculator exercise={{ intensity: { type: "load", value: 100, unit: "kg" } }} />);
  openCalculator();

  assert.ok(screen.getByText("1 × 25kg"));

  fireEvent.click(screen.getByRole("button", { name: "25kg available" }));

  assert.equal(screen.queryByText("1 × 25kg"), null);
  assert.ok(screen.getByText("2 × 20kg"));
});

test("all plates default to available (the standard set) with fractional micro-plates excluded, matching ironclock's own DEFAULT_AVAILABLE", () => {
  render(<PlateWarmupCalculator exercise={{ intensity: { type: "load", value: 100, unit: "kg" } }} />);
  openCalculator();
  fireEvent.click(screen.getByText("Full plate settings"));

  for (const plate of ["25kg", "20kg", "15kg", "10kg", "5kg", "2.5kg", "1.25kg"]) {
    assert.equal(screen.getByRole("button", { name: plate }).getAttribute("aria-pressed"), "true", `expected ${plate} to default to available`);
  }
  for (const plate of ["0.5kg", "0.25kg"]) {
    assert.equal(screen.getByRole("button", { name: plate }).getAttribute("aria-pressed"), "false", `expected ${plate} to default to unavailable`);
  }
});

test("adding the 0.25kg plate to the available list reaches an otherwise-unreachable exact target", () => {
  render(<PlateWarmupCalculator exercise={{ intensity: { type: "load", value: 100.5, unit: "kg" } }} />);
  openCalculator();

  assert.ok(screen.getByText("Target cannot be loaded exactly with the selected plates. Rounded down by 0.5kg."));
  assert.ok(screen.getByText("Rounded"));
  assert.equal(screen.queryByText("1 × 0.25kg"), null);

  fireEvent.click(screen.getByRole("button", { name: "0.25kg available" }));

  assert.ok(screen.getByText("1 × 0.25kg"));
  assert.ok(screen.getByText("Exact"));
  assert.equal(screen.queryByText("Target cannot be loaded exactly with the selected plates. Rounded up by 0.5kg."), null);
  assert.equal(screen.queryByText("Target cannot be loaded exactly with the selected plates. Rounded down by 0.5kg."), null);
});

// DEV NOTE: ported from kolosseum.tools/ironclock's stepTarget()/stepKg -
// the +/- step size is 2 x the smallest currently-available plate, so it
// changes whenever any plate (not just fractional ones) is toggled.
test("the +/- stepper buttons round the target by 2.5kg by default, and clicking - never goes below 0", () => {
  render(<PlateWarmupCalculator exercise={{ intensity: { type: "load", value: 100, unit: "kg" } }} />);
  openCalculator();

  const target = screen.getByLabelText("Target weight") as HTMLInputElement;
  fireEvent.click(screen.getByLabelText("increase target weight"));
  assert.equal(target.value, "102.5");

  fireEvent.change(target, { target: { value: "100" } });
  fireEvent.click(screen.getByLabelText("decrease target weight"));
  assert.equal(target.value, "97.5");

  fireEvent.change(target, { target: { value: "1" } });
  fireEvent.click(screen.getByLabelText("decrease target weight"));
  assert.equal(target.value, "0");
});

test("adding the 0.25kg plate to the available list shrinks the stepper's step size to 0.5kg", () => {
  render(<PlateWarmupCalculator exercise={{ intensity: { type: "load", value: 100, unit: "kg" } }} />);
  openCalculator();

  fireEvent.click(screen.getByRole("button", { name: "0.25kg available" }));

  const target = screen.getByLabelText("Target weight") as HTMLInputElement;
  fireEvent.click(screen.getByLabelText("increase target weight"));
  assert.equal(target.value, "100.5");

  fireEvent.change(target, { target: { value: "100" } });
  fireEvent.click(screen.getByLabelText("decrease target weight"));
  assert.equal(target.value, "99.5");
});

test("lb always steps by a flat 5lb, unaffected by which plates are available - the same asymmetry as kolosseum.tools/ironclock, whose lb display never derived its step from a plate set", () => {
  render(<PlateWarmupCalculator exercise={{ intensity: { type: "load", value: 100, unit: "lb" } }} />);
  openCalculator();

  const target = screen.getByLabelText("Target weight") as HTMLInputElement;
  fireEvent.click(screen.getByLabelText("increase target weight"));
  assert.equal(target.value, "105");

  fireEvent.click(screen.getByRole("button", { name: "0.5lb available" }));
  fireEvent.change(target, { target: { value: "100" } });
  fireEvent.click(screen.getByLabelText("increase target weight"));
  assert.equal(target.value, "105");
});

// DEV NOTE: the always-visible per-plate checkbox list this replaced made
// the calculator feel too busy. Matching kolosseum.tools/ironclock's own
// pattern instead: a few quick-toggle plates inline, everything else
// tucked behind a "Full plate settings" panel.
test("only the quick-toggle plates (largest standard plate + both fractional plates) show inline - the rest stay tucked behind Full plate settings", () => {
  render(<PlateWarmupCalculator exercise={{ intensity: { type: "load", value: 100, unit: "kg" } }} />);
  openCalculator();

  assert.ok(screen.getByRole("button", { name: "25kg available" }));
  assert.ok(screen.getByRole("button", { name: "0.5kg available" }));
  assert.ok(screen.getByRole("button", { name: "0.25kg available" }));
  // The bare "20kg" toggle (as opposed to the quick row's "20kg available")
  // only exists inside the Full plate settings dialog, which is closed by
  // default - its absence here is what proves the dialog isn't open yet.
  assert.equal(screen.queryByRole("button", { name: "20kg" }), null);
  assert.equal(screen.queryByRole("dialog"), null);
  assert.ok(screen.getByText("Available plates: 25kg, 20kg, 15kg, 10kg, 5kg, 2.5kg, 1.25kg"), "the always-visible summary line still reflects the full available set");
});

test("Full plate settings opens a dialog grouping every plate into Large plates and Change plates, matching ironclock's own modal grouping", () => {
  render(<PlateWarmupCalculator exercise={{ intensity: { type: "load", value: 100, unit: "kg" } }} />);
  openCalculator();

  fireEvent.click(screen.getByText("Full plate settings"));

  assert.ok(screen.getByRole("dialog", { name: "Plate settings" }));
  assert.ok(screen.getByText("Large plates available"));
  assert.ok(screen.getByText("Change plates available"));
  for (const plate of ["25kg", "20kg", "15kg", "10kg", "5kg"]) {
    assert.ok(screen.getByRole("button", { name: plate }), `expected ${plate} in the Large plates group`);
  }
  for (const plate of ["2.5kg", "1.25kg", "0.5kg", "0.25kg"]) {
    assert.ok(screen.getByRole("button", { name: plate }), `expected ${plate} in the Change plates group`);
  }
});

test("closing the settings dialog with Escape works, and Reset to default restores the standard plate set after customizing it", () => {
  render(<PlateWarmupCalculator exercise={{ intensity: { type: "load", value: 100, unit: "kg" } }} />);
  openCalculator();

  fireEvent.click(screen.getByText("Full plate settings"));
  fireEvent.click(screen.getByRole("button", { name: "20kg" }));
  assert.ok(screen.getByText("Available plates: 25kg, 15kg, 10kg, 5kg, 2.5kg, 1.25kg"));

  fireEvent.keyDown(window, { key: "Escape" });
  assert.equal(screen.queryByRole("dialog"), null);

  fireEvent.click(screen.getByText("Full plate settings"));
  fireEvent.click(screen.getByText("Reset to default"));
  assert.ok(screen.getByText("Available plates: 25kg, 20kg, 15kg, 10kg, 5kg, 2.5kg, 1.25kg"));
});
