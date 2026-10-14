// A coach handed an organisation after its owner was erased sees it on their
// overview and takes it over by choosing an org-app password
// (CoachOrgHandoverCard.tsx); with nothing handed to them, nothing shows.
import assert from "node:assert/strict";
import test from "node:test";

import React from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

import { CoachOrgHandoverCard } from "../screens/coach/CoachOrgHandoverCard";

test.afterEach(() => cleanup());

const json = (status: number, body: unknown) => ({ ok: status < 400, status, text: async () => JSON.stringify(body) }) as Response;

test("nothing handed over, nothing shown", async () => {
  globalThis.fetch = (async () => json(200, { ok: true, handovers: [] })) as typeof fetch;
  const { container } = render(<CoachOrgHandoverCard />);
  await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
  assert.equal(container.innerHTML, "");
});

test("a coach takes over Iron Gym with a 12+ character password and is told how to sign in to the organisation app", async () => {
  const posts: { path: string; body: unknown }[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = String(input);
    if (path === "/coach-workspace/org-handovers") return json(200, { ok: true, handovers: [{ org_id: "org_1", org_name: "Iron Gym" }] });
    if (path === "/account/detail") return json(200, { csrf_token: "csrf-1" });
    posts.push({ path, body: typeof init?.body === "string" ? JSON.parse(init.body) : null });
    return json(200, { ok: true, handover: { org_id: "org_1", org_name: "Iron Gym", org_owner_email: "coach@example.com" } });
  }) as typeof fetch;
  const { container } = render(<CoachOrgHandoverCard />);
  await waitFor(() => assert.ok(screen.getByText(/has been handed to you/u)));
  const button = screen.getByText("Take over Iron Gym") as HTMLButtonElement;
  const input = container.querySelector("input[type=password]") as HTMLInputElement;
  fireEvent.change(input, { target: { value: "short" } });
  assert.equal(button.disabled, true, "too short");
  fireEvent.change(input, { target: { value: "IronGymOwner2026!" } });
  assert.equal(button.disabled, false);
  await act(async () => { fireEvent.click(button); });
  await waitFor(() => assert.ok(screen.getByText(/You now run Iron Gym\. Sign in to the organisation app at \/org with coach@example\.com/u)));
  assert.deepEqual(posts, [{ path: "/coach-workspace/org-handovers/org_1/accept", body: { password: "IronGymOwner2026!" } }]);
});

test("if an org account already uses their email, the coach is told to contact support", async () => {
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const path = String(input);
    if (path === "/coach-workspace/org-handovers") return json(200, { ok: true, handovers: [{ org_id: "org_1", org_name: "Iron Gym" }] });
    if (path === "/account/detail") return json(200, { csrf_token: "csrf-1" });
    return json(409, { ok: false, code: "CONFLICT", error: "org_handover_email_in_use", details: { failure_token: "org_handover_email_in_use" } });
  }) as typeof fetch;
  const { container } = render(<CoachOrgHandoverCard />);
  await waitFor(() => assert.ok(screen.getByText("Take over Iron Gym")));
  fireEvent.change(container.querySelector("input[type=password]") as HTMLInputElement, { target: { value: "IronGymOwner2026!" } });
  await act(async () => { fireEvent.click(screen.getByText("Take over Iron Gym")); });
  await waitFor(() => assert.ok(screen.getByText(/already uses your email\. Contact support/u)));
});
