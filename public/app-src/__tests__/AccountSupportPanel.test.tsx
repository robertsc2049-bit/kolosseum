// DEV NOTE: platform status + error reporting behavioral proof - replaces
// the source-text regex checks against the now-removed app.js
// refreshPlatformStatus()/openSupportReportForm()/submitSupportReport()/
// retrySupportFailedRequest()/renderSupportHistory() rendering block.
import assert from "node:assert/strict";
import test from "node:test";

import React from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

import { AccountSupportPanel } from "../screens/account/AccountSupportPanel";

function jsonResponse(body: unknown, ok = true, status = ok ? 200 : 400): Response {
  return {
    ok,
    status,
    text: async () => JSON.stringify(body)
  } as Response;
}

function installMocks(options: {
  health?: Record<string, unknown>;
  healthFails?: boolean;
  reports?: Record<string, unknown>[];
  submitFails?: boolean;
}) {
  const { health = { status: "ok" }, healthFails = false, reports = [], submitFails = false } = options;
  let currentReports = reports;

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = String(input);
    const method = init?.method ?? "GET";
    if (path.startsWith("/account/detail")) {
      return jsonResponse({ account: { user_id: "athlete_1" }, csrf_token: "csrf-abc" });
    }
    if (path.startsWith("/health")) {
      if (healthFails) return jsonResponse({ error: "unavailable" }, false, 500);
      return jsonResponse(health);
    }
    if (path.startsWith("/account/support/reports") && method === "GET") {
      return jsonResponse({ ok: true, reports: currentReports });
    }
    if (path.startsWith("/account/support/reports") && method === "POST") {
      if (submitFails) return jsonResponse({ error: "support_report_description_invalid" }, false, 400);
      const body = JSON.parse(String(init?.body ?? "{}"));
      const record = { ...body, status: "submitted", created_at_iso8601: "2026-08-26T00:00:00.000Z" };
      currentReports = [record, ...currentReports];
      return jsonResponse({ ok: true, report: record }, true, 201);
    }
    return jsonResponse({ error: `unhandled_request_${path}` }, false, 404);
  }) as typeof fetch;
}

test.afterEach(() => {
  cleanup();
});

test("checks platform status on mount and shows operational", async () => {
  installMocks({});
  render(<AccountSupportPanel />);
  await waitFor(() => screen.getByText("Operational"));
  assert.equal(screen.queryByText("Not checked yet"), null);
});

test("shows unavailable when the health check fails", async () => {
  installMocks({ healthFails: true });
  render(<AccountSupportPanel />);
  await waitFor(() => screen.getByText("Unavailable"));
});

test("re-checking status via the button updates the value", async () => {
  installMocks({ health: { status: "degraded" } });
  render(<AccountSupportPanel />);
  await waitFor(() => screen.getByText("Degraded"));

  fireEvent.click(screen.getByText("Check platform status"));
  await waitFor(() => screen.getByText("Degraded"));
});

test("shows a factual empty state when no reports have been submitted", async () => {
  installMocks({});
  render(<AccountSupportPanel />);
  await waitFor(() => screen.getByText("No problems reported yet."));
});

test("opening the report form shows a correlation ID, route, timestamp and browser summary", async () => {
  installMocks({});
  render(<AccountSupportPanel />);
  await waitFor(() => screen.getByText("Operational"));

  fireEvent.click(screen.getByRole("button", { name: "Report a problem" }));

  await waitFor(() => screen.getByText("Correlation ID"));
  const panel = document.querySelector(".support-report-panel") as HTMLElement;
  assert.ok(panel.textContent?.includes("Route"));
  assert.ok(panel.textContent?.includes("Timestamp"));
  assert.ok(panel.textContent?.includes("Browser context"));
  assert.equal(document.querySelectorAll(".support-report-panel .commercial-fact").length, 4);
});

test("the retry button is hidden when opened without a failure context", async () => {
  installMocks({});
  render(<AccountSupportPanel />);
  await waitFor(() => screen.getByText("Operational"));

  fireEvent.click(screen.getByRole("button", { name: "Report a problem" }));
  await waitFor(() => screen.getByText("Correlation ID"));

  assert.equal(screen.queryByText("Retry the failed request"), null);
});

test("the retry button appears when opened from a failed GET request", async () => {
  installMocks({});
  render(<AccountSupportPanel />);
  await waitFor(() => screen.getByText("Operational"));

  act(() => {
    document.dispatchEvent(
      new CustomEvent("kolosseum:open-support-report", {
        detail: { failureContext: { status: 500, reason: "server_error", method: "GET", path: "/some/path" } }
      })
    );
  });

  await waitFor(() => screen.getByText("Retry the failed request"));
});

test("blocks submission client-side when the description is empty", async () => {
  installMocks({});
  render(<AccountSupportPanel />);
  await waitFor(() => screen.getByText("Operational"));

  fireEvent.click(screen.getByRole("button", { name: "Report a problem" }));
  await waitFor(() => screen.getByText("Correlation ID"));

  const form = document.querySelector("form") as HTMLFormElement;
  fireEvent.submit(form);

  await waitFor(() => screen.getByText("Enter a description before submitting."));
});

test("submits a report and shows the correlation ID in the confirmation", async () => {
  installMocks({});
  render(<AccountSupportPanel />);
  await waitFor(() => screen.getByText("Operational"));

  fireEvent.click(screen.getByRole("button", { name: "Report a problem" }));
  await waitFor(() => screen.getByText("Correlation ID"));

  const correlationId = document.querySelector(".support-report-panel .commercial-fact strong")?.textContent;
  const textarea = document.querySelector("textarea") as HTMLTextAreaElement;
  fireEvent.change(textarea, { target: { value: "The page crashed when I tapped submit." } });

  const form = document.querySelector("form") as HTMLFormElement;
  fireEvent.submit(form);

  await waitFor(() => screen.getByText(`Report submitted. Correlation ID: ${correlationId}`));
});

test("shows an error message when the server rejects the report", async () => {
  installMocks({ submitFails: true });
  render(<AccountSupportPanel />);
  await waitFor(() => screen.getByText("Operational"));

  fireEvent.click(screen.getByRole("button", { name: "Report a problem" }));
  await waitFor(() => screen.getByText("Correlation ID"));

  const textarea = document.querySelector("textarea") as HTMLTextAreaElement;
  fireEvent.change(textarea, { target: { value: "Something broke." } });
  fireEvent.submit(document.querySelector("form") as HTMLFormElement);

  await waitFor(() => screen.getByText("Report could not be submitted."));
});

test("cancel closes the report form", async () => {
  installMocks({});
  render(<AccountSupportPanel />);
  await waitFor(() => screen.getByText("Operational"));

  fireEvent.click(screen.getByRole("button", { name: "Report a problem" }));
  await waitFor(() => screen.getByText("Correlation ID"));

  fireEvent.click(screen.getByText("Cancel"));
  await waitFor(() => assert.equal(screen.queryByText("Correlation ID"), null));
});

test("recover-to-safe-screen closes the form and dispatches the legacy bridge event", async () => {
  installMocks({});
  render(<AccountSupportPanel />);
  await waitFor(() => screen.getByText("Operational"));

  fireEvent.click(screen.getByRole("button", { name: "Report a problem" }));
  await waitFor(() => screen.getByText("Correlation ID"));

  let bridgeFired = false;
  document.addEventListener("kolosseum:recover-to-safe-screen", () => {
    bridgeFired = true;
  });

  fireEvent.click(screen.getByText("Return to a safe screen"));

  await waitFor(() => assert.equal(screen.queryByText("Correlation ID"), null));
  assert.ok(bridgeFired);
});

test("renders submitted reports with status badge, description and date", async () => {
  installMocks({
    reports: [
      { correlation_id: "corr-1", description: "Upload timed out", status: "submitted", created_at_iso8601: "2026-08-20T10:00:00.000Z" }
    ]
  });

  render(<AccountSupportPanel />);
  await waitFor(() => screen.getByText("Upload timed out"));

  const row = document.querySelector(".support-history-row") as HTMLElement;
  assert.equal(row.querySelector(".support-history-status")?.textContent, "Submitted");
});

test("a report description containing markup renders as inert text, never as HTML", async () => {
  installMocks({
    reports: [
      { correlation_id: "corr-1", description: '<img src=x onerror="window.pwned=true">', status: "submitted", created_at_iso8601: "2026-08-20T10:00:00.000Z" }
    ]
  });

  render(<AccountSupportPanel />);

  await waitFor(() => screen.getByText(/img src=x/iu));
  assert.equal((globalThis as Record<string, unknown>).pwned, undefined);
  assert.equal(document.querySelectorAll(".support-history-row img").length, 0);
});
