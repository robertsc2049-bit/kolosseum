// DEV NOTE: FULL-UI-12C event-calendar binding picker behavioral proof -
// covers CoachProgrammeEventBindingPicker.tsx's rendering of the event
// selector/bind-button/status banner, driven by the
// kolosseum:programme-draft-changed bridge event the still-legacy builder
// broadcasts, plus a mocked GET for the event library and binding status
// (see useCoachProgrammeEventBinding.ts's own DEV NOTE). The actual bind
// mutation stays legacy, verified live against a real seeded coach account
// (see PR description) rather than re-implemented in this test file - here
// we only assert that clicking "Bind event" dispatches the
// kolosseum:bind-template-event bridge event with the selected event id.
import assert from "node:assert/strict";
import test from "node:test";

import React from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";

import { CoachProgrammeEventBindingPicker } from "../screens/coach/CoachProgrammeEventBindingPicker";
import { newTemplateBlock, type ProgrammeDraft } from "../screens/coach/programmeDraft";

function jsonResponse(body: unknown, ok = true, status = ok ? 200 : 400): Response {
  return { ok, status, text: async () => JSON.stringify(body) } as Response;
}

let libraryResponse: unknown[] = [];
let bindingStatusResponse: Record<string, unknown> | null = null;

function draft(overrides: Partial<ProgrammeDraft> = {}): ProgrammeDraft {
  return {
    template_id: "",
    template_family_id: "",
    template_version: 1,
    template_status: "draft",
    template_name: "Base Strength Block",
    description: "",
    activity_id: "powerlifting",
    event_plan: null,
    event_compile_summary: null,
    bound_event_id: "",
    bound_event_record_sha256: "",
    blocks: [newTemplateBlock(1)],
    ...overrides
  };
}

function libraryEvent(overrides: Record<string, unknown> = {}) {
  return {
    event_id: "event_1",
    event_plan: { event_name: "British Championships", event_date: "2026-11-21" },
    ...overrides
  };
}

function broadcast(value: ProgrammeDraft | null) {
  return act(async () => {
    document.dispatchEvent(new CustomEvent("kolosseum:programme-draft-changed", { detail: { draft: value } }));
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

test.beforeEach(() => {
  libraryResponse = [];
  bindingStatusResponse = null;

  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const path = String(input);

    if (path.includes("/coach-workspace/events/library")) {
      return jsonResponse({ ok: true, events: libraryResponse });
    }
    if (path.includes("/event-binding")) {
      return jsonResponse(bindingStatusResponse ?? { ok: true, bound: false, template_id: "t1" });
    }
    if (path.startsWith("/account/detail")) {
      return jsonResponse({ ok: true, account: { user_id: "coach_1" }, csrf_token: "csrf" });
    }
    return jsonResponse({ error: `unhandled_request_${path}` }, false, 404);
  }) as typeof fetch;
});

test.afterEach(() => {
  cleanup();
});

test("renders nothing until the legacy builder broadcasts an open draft", () => {
  const { container } = render(<CoachProgrammeEventBindingPicker />);
  assert.equal(container.innerHTML, "");
});

test("renders the manual-entry placeholder and disabled Bind button for an unbound draft with an empty library", async () => {
  render(<CoachProgrammeEventBindingPicker />);
  await broadcast(draft());

  const select = await screen.findByLabelText("Bind to an existing event") as HTMLSelectElement;
  assert.ok(Array.from(select.options).some((option) => option.value === "" && option.textContent?.includes("manually")));

  const button = screen.getByRole("button", { name: "Bind event" }) as HTMLButtonElement;
  assert.equal(button.disabled, true);
});

test("populates the dropdown from the fetched event library and enables Bind once one is selected", async () => {
  libraryResponse = [libraryEvent()];
  render(<CoachProgrammeEventBindingPicker />);
  await broadcast(draft());

  const option = await screen.findByText(/British Championships/u);
  assert.ok(option);

  const select = screen.getByLabelText("Bind to an existing event") as HTMLSelectElement;
  await act(async () => {
    fireEvent.change(select, { target: { value: "event_1" } });
  });

  const button = screen.getByRole("button", { name: "Bind event" }) as HTMLButtonElement;
  assert.equal(button.disabled, false);
});

test("clicking Bind dispatches kolosseum:bind-template-event with the selected event id", async () => {
  libraryResponse = [libraryEvent()];
  render(<CoachProgrammeEventBindingPicker />);
  await broadcast(draft());

  await screen.findByText(/British Championships/u);
  const select = screen.getByLabelText("Bind to an existing event") as HTMLSelectElement;
  fireEvent.change(select, { target: { value: "event_1" } });

  let receivedEventId = "";
  const handler = (event: Event) => {
    receivedEventId = (event as CustomEvent<{ event_id?: string }>).detail?.event_id ?? "";
  };
  document.addEventListener("kolosseum:bind-template-event", handler);

  const button = screen.getByRole("button", { name: "Bind event" });
  fireEvent.click(button);

  document.removeEventListener("kolosseum:bind-template-event", handler);
  assert.equal(receivedEventId, "event_1");
});

test("shows the bound/current status banner and a disabled 'Bound' button once fully reconciled", async () => {
  bindingStatusResponse = {
    ok: true,
    bound: true,
    template_id: "t1",
    event_id: "event_1",
    accessible: true,
    event_status: "active",
    is_current: true
  };
  render(<CoachProgrammeEventBindingPicker />);
  await broadcast(draft({ template_id: "t1", bound_event_id: "event_1", event_plan: { event_name: "British Championships" } }));

  const banner = await screen.findByText("This programme is bound to the current version of this event.");
  assert.equal(banner.className, "assignment-requirements complete");

  const button = screen.getByRole("button", { name: "Bound" }) as HTMLButtonElement;
  assert.equal(button.disabled, true);
});

test("shows a warning banner and 'Rebind event' when the bound event was cancelled", async () => {
  bindingStatusResponse = {
    ok: true,
    bound: true,
    template_id: "t1",
    event_id: "event_1",
    accessible: true,
    event_status: "cancelled",
    is_current: true
  };
  render(<CoachProgrammeEventBindingPicker />);
  await broadcast(draft({ template_id: "t1", bound_event_id: "event_1", event_plan: { event_name: "British Championships" } }));

  const banner = await screen.findByText(
    "The bound event has been cancelled. Activation is blocked until you rebind to another event."
  );
  assert.equal(banner.className, "assignment-requirements warning");
  assert.ok(screen.getByRole("button", { name: "Rebind event" }));
});

test("shows the newer-version warning and an enabled 'Rebind to latest version' button when the bound event is stale", async () => {
  bindingStatusResponse = {
    ok: true,
    bound: true,
    template_id: "t1",
    event_id: "event_1",
    accessible: true,
    event_status: "active",
    is_current: false
  };
  render(<CoachProgrammeEventBindingPicker />);
  await broadcast(draft({ template_id: "t1", bound_event_id: "event_1", event_plan: { event_name: "British Championships" } }));

  await screen.findByText(/newer version/u);
  const button = screen.getByRole("button", { name: "Rebind to latest version" }) as HTMLButtonElement;
  assert.equal(button.disabled, false);
});

test("renders a synthetic '(bound)' option when the bound event has fallen out of the active library", async () => {
  libraryResponse = [];
  bindingStatusResponse = {
    ok: true,
    bound: true,
    template_id: "t1",
    event_id: "event_1",
    accessible: false,
    event_status: null,
    is_current: false
  };
  render(<CoachProgrammeEventBindingPicker />);
  await broadcast(draft({ template_id: "t1", bound_event_id: "event_1", event_plan: { event_name: "British Championships" } }));

  await screen.findByText("British Championships (bound)");
});

test("clears back to nothing once the legacy builder broadcasts a null draft (closed)", async () => {
  const { container } = render(<CoachProgrammeEventBindingPicker />);
  await broadcast(draft());
  await screen.findByLabelText("Bind to an existing event");

  await broadcast(null);
  assert.equal(container.innerHTML, "");
});
