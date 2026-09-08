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
  render(<PlateWarmupCalculator exercise={{ intensity: { type: "load", value: 100, unit: "kg" } }} />);
  openCalculator();

  assert.equal((screen.getByLabelText("Target weight") as HTMLInputElement).value, "100");
  assert.equal((screen.getByLabelText("Unit") as HTMLSelectElement).value, "kg");
  assert.ok(screen.getByText("1 × 25kg"));
  assert.ok(screen.getByText("1 × 15kg"));
  assert.ok(screen.getByText("Bar: 20kg × 8-10"));
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

test("switching units resets the bar weight and recomputes with the other plate set", () => {
  render(<PlateWarmupCalculator exercise={{ intensity: { type: "load", value: 100, unit: "kg" } }} />);
  openCalculator();

  assert.equal((screen.getByLabelText("Bar weight") as HTMLInputElement).value, "20");
  assert.ok(screen.getByText("1 × 25kg"));

  fireEvent.change(screen.getByLabelText("Unit"), { target: { value: "lb" } });

  assert.equal((screen.getByLabelText("Bar weight") as HTMLInputElement).value, "45");
  assert.ok(screen.getByText("1 × 25lb"));
  assert.ok(screen.getByText("1 × 2.5lb"));
});
