// A coach who sells packages is asked for their tax details, fixes what the
// server says is wrong, saves, and sees them back with the tax number masked.
import assert from "node:assert/strict";
import test from "node:test";

import React from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";

import { CoachTaxDetailsPanel, maskTaxNumber } from "../screens/account/CoachTaxDetailsPanel";

function jsonResponse(body: unknown, status = 200): Response {
  return { ok: status < 400, status, text: async () => JSON.stringify(body) } as Response;
}

test.afterEach(() => cleanup());

test("a coach who sells packages adds their tax details, fixing what's wrong first", async () => {
  const puts: Record<string, unknown>[] = [];
  let saved: Record<string, unknown> | null = null;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = String(input);
    const method = init?.method ?? "GET";
    if (path.startsWith("/account/detail")) return jsonResponse({ account: { user_id: "coach_1" }, csrf_token: "csrf" });
    if (path === "/check-ins/tax-details" && method === "PUT") {
      const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
      puts.push(body);
      if (body.tax_number !== "QQ123456C") return jsonResponse({ ok: false, error: "tax_details_invalid", field_errors: { tax_number: "A National Insurance number looks like QQ123456C." } }, 422);
      saved = { ...body, postcode: "LS1 1AB", updated_at: "2026-11-03T10:00:00Z" };
    }
    if (path === "/check-ins/tax-details") return jsonResponse({ ok: true, tax_details: saved, sells_packages: true });
    return jsonResponse({ error: "unhandled" }, 404);
  }) as typeof fetch;

  render(<CoachTaxDetailsPanel />);
  await screen.findByText("You sell packages - add your tax details.");
  fireEvent.click(screen.getByRole("button", { name: "Add tax details" }));
  fireEvent.change(screen.getByLabelText("Full legal name"), { target: { value: "Christopher Roberts" } });
  fireEvent.change(screen.getByLabelText("Date of birth"), { target: { value: "1988-06-15" } });
  fireEvent.change(screen.getByLabelText("National Insurance number"), { target: { value: "QQ12" } });
  fireEvent.change(screen.getByLabelText("Home address"), { target: { value: "1 High Street" } });
  fireEvent.change(screen.getByLabelText("Town or city"), { target: { value: "Leeds" } });
  fireEvent.change(screen.getByLabelText("Postcode"), { target: { value: "ls1 1ab" } });
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Save tax details" }));
  });
  await screen.findByText("Check the details marked below.");
  screen.getByText("A National Insurance number looks like QQ123456C.");

  // The label now carries the error too. (No u flag: it hangs RTL queries under node:test.)
  fireEvent.change(screen.getByLabelText(/^National Insurance number/), { target: { value: "QQ123456C" } });
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Save tax details" }));
  });
  await screen.findByText("Tax details saved.");
  assert.deepEqual(
    [puts[1].seller_type, puts[1].legal_name, puts[1].date_of_birth, puts[1].tax_number_type, puts[1].company_number, puts[1].country],
    ["individual", "Christopher Roberts", "1988-06-15", "nino", "", "GB"]
  );
  screen.getByText("Christopher Roberts");
  screen.getByText("1 High Street, Leeds, LS1 1AB");
  screen.getByText("National Insurance number: QQ••••56C");
  assert.equal(screen.queryByText("QQ123456C"), null, "the full number isn't shown");
  screen.getByRole("button", { name: "Change tax details" });
});

test("a company gives its registration number instead of a date of birth", async () => {
  globalThis.fetch = (async () => jsonResponse({ ok: true, tax_details: null, sells_packages: false })) as typeof fetch;
  render(<CoachTaxDetailsPanel />);
  await screen.findByText("Not added yet. You'll need these once you sell packages.");
  fireEvent.click(screen.getByRole("button", { name: "Add tax details" }));
  fireEvent.click(screen.getByLabelText("A company"));
  screen.getByLabelText("Company name (as registered)");
  screen.getByLabelText("Company registration number");
  assert.equal(screen.queryByLabelText("Date of birth"), null);
  assert.equal(maskTaxNumber("1234567890"), "12•••••890");
});
