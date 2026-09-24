// DEV NOTE: FULL-UI-24/FULL-UI-65 coach account code panel - behavioral
// proof for the legacy athleteCoachLinkPanel fallback, ported to
// AccountCoachCodePanel.tsx. Covers the role gate (via the shared useRole()
// hook, so a same-tab sign-in re-evaluates it) and the save/clear
// round-trip into the shared localStorage blob.
import assert from "node:assert/strict";
import test from "node:test";

import React from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";

import { AccountCoachCodePanel } from "../screens/account/AccountCoachCodePanel";

const STORAGE_KEY = "kolosseum.product.app.v1";

function seedState(overrides: Record<string, unknown>) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(overrides));
}

function readState(): Record<string, unknown> {
  return JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "{}");
}

test.afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

test("renders nothing for a coach account", () => {
  seedState({ role: "coach" });
  const { container } = render(<AccountCoachCodePanel />);
  assert.equal(container.innerHTML, "");
});

test("renders nothing when no role is known yet", () => {
  const { container } = render(<AccountCoachCodePanel />);
  assert.equal(container.innerHTML, "");
});

test("renders the saved coach code for an athlete account", () => {
  seedState({ role: "athlete", coachCode: "COACH-42" });
  render(<AccountCoachCodePanel />);
  assert.equal(screen.getByPlaceholderText("Coach account code").getAttribute("value"), "COACH-42");
});

test("saving a code persists it to the shared storage blob and shows a confirmation", () => {
  seedState({ role: "athlete" });
  render(<AccountCoachCodePanel />);

  fireEvent.change(screen.getByPlaceholderText("Coach account code"), { target: { value: "  NEW-CODE  " } });
  fireEvent.click(screen.getByText("Save code"));

  assert.equal(readState().coachCode, "NEW-CODE");
  assert.ok(screen.getByText("Coach account code saved."));
});

test("saving an empty code clears it and shows a distinct confirmation", () => {
  seedState({ role: "athlete", coachCode: "OLD-CODE" });
  render(<AccountCoachCodePanel />);

  fireEvent.change(screen.getByPlaceholderText("Coach account code"), { target: { value: "   " } });
  fireEvent.click(screen.getByText("Save code"));

  assert.equal(readState().coachCode, "");
  assert.ok(screen.getByText("Coach account code cleared."));
});

test("dispatching kolosseum:account-role-known re-evaluates the role gate for a same-tab sign-in", async () => {
  const { container } = render(<AccountCoachCodePanel />);
  assert.equal(container.innerHTML, "");

  seedState({ role: "athlete" });
  await act(async () => {
    document.dispatchEvent(new CustomEvent("kolosseum:account-role-known"));
  });

  assert.ok(screen.getByPlaceholderText("Coach account code"));
});
