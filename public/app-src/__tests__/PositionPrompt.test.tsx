import assert from "node:assert/strict";
import test from "node:test";

import React from "react";
import { cleanup, render, screen } from "@testing-library/react";

import { POSITION_PROMPT, PositionSelect } from "../components/PositionSelect";

test.afterEach(() => cleanup());

test("a rugby player with no position is told positions train differently; a prop, or a powerlifter, is not", () => {
  const { rerender } = render(<PositionSelect activityId="rugby_union" value="" onChange={() => {}} />);
  assert.ok(screen.getByText(POSITION_PROMPT));
  rerender(<PositionSelect activityId="rugby_union" value="loosehead_prop" onChange={() => {}} />);
  assert.equal(screen.queryByText(POSITION_PROMPT), null);
  rerender(<PositionSelect activityId="athletics" value="athlete" onChange={() => {}} />);
  assert.ok(screen.getByText(POSITION_PROMPT), "athletics 'Not specified' is prompted too");
  rerender(<PositionSelect activityId="powerlifting" value="" onChange={() => {}} />);
  assert.equal(screen.queryByText(POSITION_PROMPT), null);
});
