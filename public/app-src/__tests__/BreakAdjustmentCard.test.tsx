import assert from "node:assert/strict";
import test from "node:test";

import React from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";

import { BreakAdjustmentCard } from "../screens/athlete/BreakAdjustmentCard";

test.afterEach(() => cleanup());

function installMocks(saveOk = true) {
  const sent: unknown[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = String(input);
    const reply = (body: unknown, ok = true) => ({ ok, status: ok ? 200 : 500, text: async () => JSON.stringify(body) } as Response);
    if (path.startsWith("/account/detail")) return reply({ csrf_token: "t" });
    if (init?.method === "PUT") {
      sent.push(JSON.parse(String(init.body)));
      return saveOk ? reply({ enabled: true, changed_at: "2026-11-24T10:00:00.000Z" }) : reply({ error: "nope" }, false);
    }
    return reply({ enabled: false, changed_at: null });
  }) as typeof fetch;
  return sent;
}

test("off, never changed; ticking it saves and says when it was turned on", async () => {
  const sent = installMocks();
  render(<BreakAdjustmentCard />);
  const tick = await screen.findByLabelText("Adjust for breaks") as HTMLInputElement;
  assert.equal(tick.checked, false);
  assert.equal(screen.queryByTestId("break-adjustment-logged"), null);
  await act(async () => { fireEvent.click(tick); });
  assert.deepEqual(sent, [{ enabled: true }]);
  assert.equal((screen.getByLabelText("Adjust for breaks") as HTMLInputElement).checked, true);
  assert.match(screen.getByTestId("break-adjustment-logged").textContent ?? "", /^Turned on .*2026.*Each change is recorded on your account\.$/u);
});

test("a save that fails says so and leaves it as it was", async () => {
  installMocks(false);
  render(<BreakAdjustmentCard />);
  const tick = await screen.findByLabelText("Adjust for breaks");
  await act(async () => { fireEvent.click(tick); });
  assert.ok(screen.getByRole("alert"));
  assert.equal((screen.getByLabelText("Adjust for breaks") as HTMLInputElement).checked, false);
});
