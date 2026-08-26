// DEV NOTE: FULL-UI-19 data rights behavioral proof - replaces the
// source-text regex checks against the now-removed app.js
// loadDataRightsState()/requestDataExportAction()/
// triggerDataExportDownload()/reviewDataDeletionAction()/
// confirmDataDeletionAction() rendering block.
import assert from "node:assert/strict";
import test from "node:test";

import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

import { AccountDataRightsPanel } from "../screens/account/AccountDataRightsPanel";

const CLIENT_REQUEST_ID_KEY = "kolosseum.data_rights.deletion_client_request_id";

function jsonResponse(body: unknown, ok = true, status = ok ? 200 : 400): Response {
  return {
    ok,
    status,
    text: async () => JSON.stringify(body)
  } as Response;
}

function installMocks(options: {
  exports?: Record<string, unknown>[];
  deletionRequests?: Record<string, unknown>[];
  exportStatusFails?: boolean;
  deletionStatusFails?: boolean;
  deletionConfirmFails?: boolean;
  deletionConfirmReplayed?: boolean;
}) {
  const {
    exports = [],
    deletionRequests = [],
    exportStatusFails = false,
    deletionStatusFails = false,
    deletionConfirmFails = false,
    deletionConfirmReplayed = false
  } = options;

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = String(input);
    const method = init?.method ?? "GET";

    if (path.startsWith("/account/detail")) {
      return jsonResponse({ account: { user_id: "athlete_1" }, csrf_token: "csrf-abc" });
    }
    if (path === "/account/data-rights/export" && method === "GET") {
      if (exportStatusFails) return jsonResponse({ error: "service_unavailable" }, false, 500);
      return jsonResponse({ exports });
    }
    if (path === "/account/data-rights/export" && method === "POST") {
      return jsonResponse({ export_request_id: "export_req_1", status: "ready" }, true, 202);
    }
    if (path.startsWith("/account/data-rights/export/") && path.endsWith("/download")) {
      return jsonResponse({ account: { user_id: "athlete_1" }, records: [] });
    }
    if (path === "/account/data-rights/deletion" && method === "GET") {
      if (deletionStatusFails) return jsonResponse({ error: "service_unavailable" }, false, 500);
      return jsonResponse({ deletion_requests: deletionRequests });
    }
    if (path === "/account/data-rights/deletion/preview") {
      return jsonResponse({
        factual_notice: "Some records are retained for billing reasons.",
        retention_notices: [{ retention_reason: "billing_history", copy: "Billing records are kept.", record_count: 2 }]
      });
    }
    if (path === "/account/data-rights/deletion" && method === "POST") {
      if (deletionConfirmFails) return jsonResponse({ error: "data_rights_deletion_confirmation_required" }, false, 400);
      return jsonResponse({ deletion_request_id: "deletion_req_1", replayed: Boolean(deletionConfirmReplayed) }, true, 202);
    }
    return jsonResponse({ error: `unhandled_request_${path}` }, false, 404);
  }) as typeof fetch;
}

test.afterEach(() => {
  cleanup();
  window.localStorage.removeItem(CLIENT_REQUEST_ID_KEY);
});

test("shows a factual empty state for both export and deletion when nothing has been requested yet", async () => {
  installMocks({});
  render(<AccountDataRightsPanel />);

  await waitFor(() => screen.getByText("No export requested yet."));
  assert.ok(screen.getByText("No deletion requested yet."));
});

test("shows service unavailable only when both reads fail, and retry re-fetches", async () => {
  installMocks({ exportStatusFails: true, deletionStatusFails: true });
  render(<AccountDataRightsPanel />);

  await waitFor(() => screen.getByText("Data rights status could not be loaded."));

  installMocks({});
  fireEvent.click(screen.getByText("Retry"));
  await waitFor(() => screen.getByText("No export requested yet."));
});

test("one failing read does not hide the other's successfully-loaded data", async () => {
  installMocks({ exportStatusFails: true, deletionRequests: [{ deletion_request_id: "d1", reason_code: "user_requested_erasure", queue_status: "queued_for_review", requested_at_iso8601: "2026-08-20T10:00:00.000Z", retention_boundary: { retained_record_count: 3 } }] });
  render(<AccountDataRightsPanel />);

  await waitFor(() => screen.getByText("3 retained"));
  assert.equal(screen.queryByText("Data rights status could not be loaded."), null);
});

test("requesting an export shows the export id and refreshes the list with a download button for a ready export", async () => {
  installMocks({});
  render(<AccountDataRightsPanel />);
  await waitFor(() => screen.getByText("No export requested yet."));

  installMocks({ exports: [{ export_request_id: "export_req_1", status: "ready", requested_at_iso8601: "2026-08-26T00:00:00.000Z" }] });
  fireEvent.click(screen.getByText("Request data export"));

  await waitFor(() => screen.getByText("Export ready: export_req_1"));
  await waitFor(() => screen.getByText("Download"));
});

test("reviewing deletion shows the retention preview and retained record counts", async () => {
  installMocks({});
  render(<AccountDataRightsPanel />);
  await waitFor(() => screen.getByText("No export requested yet."));

  fireEvent.click(screen.getByText("Review deletion consequences"));

  await waitFor(() => screen.getByText("Some records are retained for billing reasons."));
  assert.ok(screen.getByText("2 records"));
});

test("confirming deletion requires typing DELETE and shows the confirmation result", async () => {
  installMocks({});
  render(<AccountDataRightsPanel />);
  await waitFor(() => screen.getByText("No export requested yet."));

  fireEvent.click(screen.getByText("Review deletion consequences"));
  await waitFor(() => screen.getByPlaceholderText("Type DELETE"));

  fireEvent.change(screen.getByPlaceholderText("Type DELETE"), { target: { value: "DELETE" } });
  fireEvent.click(screen.getByText("Request deletion"));

  await waitFor(() => screen.getByText("Deletion requested: deletion_req_1"));
});

test("shows an error result when the server rejects the deletion confirmation", async () => {
  installMocks({ deletionConfirmFails: true });
  render(<AccountDataRightsPanel />);
  await waitFor(() => screen.getByText("No export requested yet."));

  fireEvent.click(screen.getByText("Review deletion consequences"));
  await waitFor(() => screen.getByPlaceholderText("Type DELETE"));

  fireEvent.change(screen.getByPlaceholderText("Type DELETE"), { target: { value: "not delete" } });
  fireEvent.click(screen.getByText("Request deletion"));

  await waitFor(() => screen.getByText("The deletion request could not be completed."));
});

test("a replayed deletion confirmation shows already-requested wording", async () => {
  installMocks({ deletionConfirmReplayed: true });
  render(<AccountDataRightsPanel />);
  await waitFor(() => screen.getByText("No export requested yet."));

  fireEvent.click(screen.getByText("Review deletion consequences"));
  await waitFor(() => screen.getByPlaceholderText("Type DELETE"));
  fireEvent.change(screen.getByPlaceholderText("Type DELETE"), { target: { value: "DELETE" } });
  fireEvent.click(screen.getByText("Request deletion"));

  await waitFor(() => screen.getByText("Deletion already requested: deletion_req_1"));
});

test("the deletion client_request_id survives a failed submit and clears only once a request is recorded", async () => {
  installMocks({ deletionConfirmFails: true });
  render(<AccountDataRightsPanel />);
  await waitFor(() => screen.getByText("No export requested yet."));

  fireEvent.click(screen.getByText("Review deletion consequences"));
  await waitFor(() => screen.getByPlaceholderText("Type DELETE"));
  fireEvent.change(screen.getByPlaceholderText("Type DELETE"), { target: { value: "not delete" } });
  fireEvent.click(screen.getByText("Request deletion"));
  await waitFor(() => screen.getByText("The deletion request could not be completed."));

  const idAfterFailure = window.localStorage.getItem(CLIENT_REQUEST_ID_KEY);
  assert.ok(idAfterFailure, "expected the idempotency key to survive a failed submit");

  installMocks({ deletionConfirmReplayed: false });
  fireEvent.click(screen.getByText("Request deletion"));
  await waitFor(() => screen.getByText("Deletion requested: deletion_req_1"));

  assert.equal(window.localStorage.getItem(CLIENT_REQUEST_ID_KEY), null);
});

test("a reason code and retention notice containing markup render as inert text, never as HTML", async () => {
  installMocks({
    deletionRequests: [{ deletion_request_id: "d1", reason_code: "<img src=x onerror=\"window.pwned=true\">", queue_status: "queued_for_review", requested_at_iso8601: "2026-08-20T10:00:00.000Z", retention_boundary: {} }]
  });
  render(<AccountDataRightsPanel />);

  await waitFor(() => screen.getByText(/img src=x/iu));
  assert.equal((globalThis as Record<string, unknown>).pwned, undefined);
  assert.equal(document.querySelectorAll(".record-card img").length, 0);
});
