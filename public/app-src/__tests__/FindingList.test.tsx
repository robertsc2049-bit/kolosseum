// What stands out, readable by a busy coach: the top 5 first with the rest
// one tap away, and a suggested next step under each finding.
import assert from "node:assert/strict";
import test from "node:test";

import React from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";

import { FindingList, type Finding } from "../screens/coach/FindingList";

const finding = (n: number, level: Finding["level"]): Finding => ({ id: `f${n}`, section: "load", level, text: `Finding ${n}.`, action: `Do thing ${n}.` });
const twelve = [
  ...[1, 2, 3].map((n) => finding(n, "alert")),
  ...[4, 5, 6, 7, 8].map((n) => finding(n, "watch")),
  ...[9, 10, 11, 12].map((n) => finding(n, "good"))
];

test.afterEach(() => cleanup());

test("twelve findings: the top 5 show, each with its next step; the rest one tap away", async () => {
  render(<FindingList findings={twelve} />);
  assert.equal(document.querySelectorAll(".analysis-finding").length, 5);
  assert.ok(screen.getByText("Finding 1."));
  assert.ok(screen.getByText("Do thing 1."), "the next step is shown");
  assert.equal(screen.queryByText("Finding 6."), null);
  await act(async () => { fireEvent.click(screen.getByText("Show all 12")); });
  assert.equal(document.querySelectorAll(".analysis-finding").length, 12);
  await act(async () => { fireEvent.click(screen.getByText("Show the top 5 only")); });
  assert.equal(document.querySelectorAll(".analysis-finding").length, 5);
});

test("the roster's compact list and a printed report show every finding given, without next steps or a toggle", () => {
  render(<FindingList findings={twelve.slice(0, 3)} compact />);
  assert.equal(document.querySelectorAll(".analysis-finding").length, 3);
  assert.equal(screen.queryByText("Do thing 1."), null);
  cleanup();
  render(<FindingList findings={twelve} showAll />);
  assert.equal(document.querySelectorAll(".analysis-finding").length, 12);
  assert.equal(screen.queryByText("Show all 12"), null);
});
