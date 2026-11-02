// Copy and adapt on a programme's page: the choices it offers follow the
// programme, every choice is sent, the new draft opens, and a recognised
// programme warns before its loads change.
import assert from "node:assert/strict";
import test from "node:test";

import React from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";

import { CopyAndAdaptSection } from "../screens/coach/CopyAndAdaptSection";

function jsonResponse(body: unknown, status = 200): Response {
  return { ok: status < 400, status, text: async () => JSON.stringify(body) } as Response;
}

const week = (sessions: number) => ({ days: Array.from({ length: sessions }, () => ({ sessions: [{ work_items: [] }] })) });
const TEMPLATE = {
  template_id: "tpl_src", template_name: "Powerlifting block",
  template_structure: { blocks: [{ weeks: [week(3), week(3), week(3), week(3)] }, { weeks: [week(3), week(3), week(3), week(3)] }] }
};

type Call = { method: string; path: string; body: Record<string, unknown> | null };

function installFetch(status = 201) {
  const calls: Call[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = String(input);
    const method = init?.method ?? "GET";
    calls.push({ method, path, body: typeof init?.body === "string" ? JSON.parse(init.body) : null });
    if (path.startsWith("/account/detail")) return jsonResponse({ account: { user_id: "coach_1" }, csrf_token: "csrf-abc" });
    if (path === "/templates/tpl_src/adapt") {
      return status === 201 ? jsonResponse({ ok: true, template: { template_id: "tpl_new" } }, 201) : jsonResponse({ error: "programme_adapt_invalid", field_errors: { weeks: "Choose 1 to 52 weeks." } }, 422);
    }
    return jsonResponse({ error: "unhandled" }, 404);
  }) as typeof fetch;
  return calls;
}

test.afterEach(() => cleanup());

test("offers this programme's days and length, sends every choice and opens the copy", async () => {
  const calls = installFetch();
  const opened: string[] = [];
  const listener = (event: Event) => opened.push(String(((event as CustomEvent).detail as { template_id: string }).template_id));
  document.addEventListener("kolosseum:open-programme-detail", listener);
  render(<CopyAndAdaptSection template={TEMPLATE} />);
  fireEvent.click(screen.getByRole("button", { name: "Copy and adapt" }));
  assert.equal((screen.getByLabelText("Name of the copy") as HTMLInputElement).value, "Powerlifting block (copy)");
  assert.deepEqual(Array.from((screen.getByLabelText("Training days a week") as HTMLSelectElement).options).map((o) => o.text), ["1 - keeps the first 1", "2 - keeps the first 2", "3 (as now)"]);
  screen.getByText("Now 8 weeks. Shorter cuts weeks from the end; longer repeats the last block.");

  fireEvent.change(screen.getByLabelText("Name of the copy"), { target: { value: "Sam - 2 days" } });
  fireEvent.change(screen.getByLabelText("Training days a week"), { target: { value: "2" } });
  fireEvent.change(screen.getByLabelText("Length in weeks"), { target: { value: "6" } });
  fireEvent.change(screen.getByLabelText("Loads"), { target: { value: "-5" } });
  fireEvent.change(screen.getByLabelText("RPE targets"), { target: { value: "-1" } });
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Make the copy" }));
  });
  document.removeEventListener("kolosseum:open-programme-detail", listener);
  assert.deepEqual(calls.find((c) => c.method === "POST")?.body, { template_name: "Sam - 2 days", days_per_week: 2, weeks: 6, load_change_percent: -5, rpe_change: -1 });
  assert.deepEqual(opened, ["tpl_new"]);
  assert.equal(screen.queryByTestId("copy-and-adapt"), null);
});

test("shows why a copy was refused", async () => {
  installFetch(422);
  render(<CopyAndAdaptSection template={TEMPLATE} />);
  fireEvent.click(screen.getByRole("button", { name: "Copy and adapt" }));
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Make the copy" }));
  });
  await screen.findByText("Choose 1 to 52 weeks.");
});

test("a recognised programme warns only when its loads would change", () => {
  installFetch();
  render(<CopyAndAdaptSection template={{ ...TEMPLATE, template_name: "5/3/1 (based on Wendler 5/3/1)" }} />);
  fireEvent.click(screen.getByRole("button", { name: "Copy and adapt" }));
  assert.equal(screen.queryByRole("note"), null);
  fireEvent.change(screen.getByLabelText("Loads"), { target: { value: "5" } });
  assert.equal(screen.getByRole("note").textContent, "This is based on a recognised programme. Changing its loads means the copy is no longer the original.");
});
