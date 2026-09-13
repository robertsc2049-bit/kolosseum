// DEV NOTE: standalone barbell calculator tool - covers
// BarbellCalculatorPanel.tsx, which wraps PlateWarmupCalculator.tsx's
// shared PlateWarmupCalculatorFields body with no pre-fill (see that
// component's own DEV NOTE). Unlike PlateWarmupCalculator.test.tsx, there
// is no <details> disclosure to open first and no exercise prop - the
// panel's content is visible immediately.
import assert from "node:assert/strict";
import test from "node:test";

import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import { BarbellCalculatorPanel } from "../screens/tools/BarbellCalculatorPanel";

test.afterEach(() => {
  cleanup();
});

test("renders immediately with an empty target and the kg bar/unit defaults, no exercise pre-fill", () => {
  render(<BarbellCalculatorPanel />);

  assert.ok(screen.getByText("Barbell calculator"));
  assert.equal((screen.getByLabelText("Target weight") as HTMLInputElement).value, "");
  assert.equal((screen.getByLabelText("Unit") as HTMLSelectElement).value, "kg");
  assert.equal((screen.getByLabelText("Bar weight") as HTMLInputElement).value, "20");
  assert.ok(screen.getByText("Enter a target weight to see the plate breakdown and warm-up ramp."));
});

test("computes the plate breakdown and warm-up ramp on manual entry", () => {
  render(<BarbellCalculatorPanel />);

  fireEvent.change(screen.getByLabelText("Target weight"), { target: { value: "142.5" } });

  assert.ok(screen.getByText("2 × 25kg"));
  assert.ok(screen.getByText("1 × 10kg"));
  assert.ok(screen.getByText("1 × 1.25kg"));
  assert.ok(screen.getByText("Bar: 20kg × 8-10"));
});

test("switching units resets the bar weight and recomputes with the other plate set", () => {
  render(<BarbellCalculatorPanel />);

  fireEvent.change(screen.getByLabelText("Target weight"), { target: { value: "225" } });
  fireEvent.change(screen.getByLabelText("Unit"), { target: { value: "lb" } });

  assert.equal((screen.getByLabelText("Bar weight") as HTMLInputElement).value, "45");
  assert.ok(screen.getByText("2 × 45lb"));
});

test("shows the closest-achievable note when the target cannot be loaded exactly", () => {
  render(<BarbellCalculatorPanel />);

  fireEvent.change(screen.getByLabelText("Target weight"), { target: { value: "101" } });

  assert.ok(screen.getByText(/Closest achievable:/u));
});
