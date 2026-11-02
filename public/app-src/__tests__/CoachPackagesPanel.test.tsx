// A coach's packages: add one with its price and what's included, edit it,
// remove it; validation messages come through.
import assert from "node:assert/strict";
import test from "node:test";

import React from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";

import { CoachPackagesPanel } from "../screens/account/CoachPackagesPanel";
import { PackageList } from "../components/PackageList";

function jsonResponse(body: unknown, status = 200): Response {
  return { ok: status < 400, status, text: async () => JSON.stringify(body) } as Response;
}

type Call = { method: string; path: string; body: Record<string, unknown> | null };

const ONLINE = {
  package_id: "pkg_1", name: "Online coaching", price: 80, currency: "GBP", billing: "monthly", description: null, price_label: "£80 a month",
  includes: { programming: true, checkin_calls: 2, in_person_sessions: 0, session_reviews: "weekly", messaging: true },
  includes_summary: ["Programming", "2 check-in calls a month", "Weekly session review", "Messaging with your coach"]
};

function installFetch(options: { invalid?: boolean } = {}) {
  const calls: Call[] = [];
  let packages: Record<string, unknown>[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = String(input);
    const method = init?.method ?? "GET";
    const body = typeof init?.body === "string" ? JSON.parse(init.body) : null;
    calls.push({ method, path, body });
    if (path.startsWith("/account/detail")) return jsonResponse({ account: { user_id: "coach_1" }, csrf_token: "csrf" });
    if (path === "/coach-branding/packages" && method === "POST") {
      if (options.invalid) return jsonResponse({ error: "package_invalid", field_errors: { includes: "Say what's included." } }, 422);
      packages = [ONLINE];
      return jsonResponse({ ok: true, packages }, 201);
    }
    if (path === "/coach-branding/packages/pkg_1" && method === "PUT") { packages = [{ ...ONLINE, price: 90, price_label: "£90 a month" }]; return jsonResponse({ ok: true, packages }); }
    if (path === "/coach-branding/packages/pkg_1/archive") { packages = []; return jsonResponse({ ok: true, packages }); }
    if (path === "/coach-branding/packages") return jsonResponse({ ok: true, packages });
    return jsonResponse({ error: "unhandled" }, 404);
  }) as typeof fetch;
  return calls;
}

test.afterEach(() => cleanup());

test("a coach adds a package with what's included, edits its price and removes it", async () => {
  const calls = installFetch();
  render(<CoachPackagesPanel />);
  await screen.findByText("No packages yet.");
  fireEvent.click(screen.getByRole("button", { name: "Add a package" }));
  fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Online coaching" } });
  fireEvent.change(screen.getByLabelText("Price"), { target: { value: "80" } });
  fireEvent.change(screen.getByLabelText("Check-in calls a month"), { target: { value: "2" } });
  fireEvent.change(screen.getByLabelText("Session reviews"), { target: { value: "weekly" } });
  fireEvent.click(screen.getByLabelText("Messaging"));
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Add package" }));
  });
  await screen.findByText("£80 a month");
  screen.getByText("2 check-in calls a month");
  assert.deepEqual(calls.find((c) => c.method === "POST")?.body, {
    name: "Online coaching", price: 80, currency: "GBP", billing: "monthly", description: "",
    includes: { programming: true, checkin_calls: 2, in_person_sessions: 0, session_reviews: "weekly", messaging: true }
  });

  fireEvent.click(screen.getByRole("button", { name: "Edit" }));
  assert.equal((screen.getByLabelText("Name") as HTMLInputElement).value, "Online coaching");
  fireEvent.change(screen.getByLabelText("Price"), { target: { value: "90" } });
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Save package" }));
  });
  await screen.findByText("£90 a month");

  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Remove" }));
  });
  await screen.findByText("No packages yet.");
});

test("a weekly package asks for calls a week; a refusal says why", async () => {
  installFetch({ invalid: true });
  render(<CoachPackagesPanel />);
  await screen.findByText("No packages yet.");
  fireEvent.click(screen.getByRole("button", { name: "Add a package" }));
  fireEvent.change(screen.getByLabelText("Paid"), { target: { value: "weekly" } });
  screen.getByLabelText("Check-in calls a week");
  fireEvent.change(screen.getByLabelText("Name"), { target: { value: "x" } });
  fireEvent.change(screen.getByLabelText("Price"), { target: { value: "10" } });
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Add package" }));
  });
  await screen.findByText("Say what's included.");
});

test("a gym's packages say who delivers them", () => {
  render(<PackageList packages={[{ ...ONLINE, delivered_by: [{ coach_user_id: "c1", display_name: "Chris Roberts" }] }]} showDeliveredBy />);
  screen.getByText("With Chris Roberts");
  screen.getByText("Weekly session review");
});
