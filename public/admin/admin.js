// DEV NOTE: FULL-UI-21 founder/admin operations client. Deliberately a
// standalone module - it never imports anything from public/app/, never
// reads the athlete/coach session cookie, and never calls any /account,
// /coach-workspace, /sessions or /blocks endpoint. Every operational
// action requires an explicit second "Confirm" click before it is sent,
// and every mutating request carries a fresh correlation_id so a repeated
// click replays rather than duplicates.

const state = {
  csrfToken: "",
  selectedUserId: null,
  pendingStateChange: null,
  pendingTestMarking: null,
  dataRightsExports: [],
  dataRightsDeletions: [],
  auditRecords: [],
  commercialRecords: [],
  supportRequests: []
};

function el(id) {
  return document.getElementById(id);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function generateCorrelationId() {
  return typeof crypto?.randomUUID === "function"
    ? crypto.randomUUID()
    : `corr-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

async function api(method, path, body) {
  const headers = {};
  if (body !== undefined) headers["content-type"] = "application/json";
  if (method !== "GET") headers["x-kolosseum-csrf"] = state.csrfToken;

  const response = await fetch(path, {
    method,
    credentials: "same-origin",
    headers,
    body: body === undefined ? undefined : JSON.stringify(body)
  });

  const text = await response.text();
  let payload = null;
  try { payload = text ? JSON.parse(text) : null; } catch { payload = null; }

  if (!response.ok) {
    const error = new Error(payload?.reason ?? payload?.failure_token ?? payload?.error ?? `request_failed_${response.status}`);
    error.status = response.status;
    throw error;
  }
  return payload;
}

function showWorkspace() {
  el("adminSignInSection").hidden = true;
  el("adminWorkspaceSection").hidden = false;
  el("accountSearchSection").hidden = false;
  el("entitlementSection").hidden = false;
  el("supportSection").hidden = false;
  el("dataRightsReviewSection").hidden = false;
  el("auditSection").hidden = false;

  refreshCommercialRecords();
  refreshSupportRequests();
  refreshDataRightsReview();
  refreshAuditRecords();
}

async function signIn(event) {
  event.preventDefault();
  el("adminSignInError").hidden = true;

  try {
    const result = await api("POST", "/admin/sign-in", {
      email: el("adminSignInEmail").value,
      password: el("adminSignInPassword").value
    });
    state.csrfToken = result.csrf_token;
    el("adminDisplayName").textContent = result.admin.display_name;
    showWorkspace();
  }
  catch (error) {
    el("adminSignInError").hidden = false;
    el("adminSignInError").textContent = "Sign-in failed.";
    console.error(error);
  }
}

async function signOut() {
  await api("POST", "/admin/sign-out", {}).catch(() => {});
  location.reload();
}

function renderAccountSearchResults(accounts) {
  const tbody = el("accountSearchResults");
  tbody.innerHTML = "";
  for (const account of accounts) {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td><button type="button" class="open-account-detail" data-user-id="${account.user_id}">${account.user_id}</button></td>
      <td>${account.email}</td>
      <td>${account.display_name}</td>
      <td>${account.actor_type}</td>
      <td>${account.account_state}</td>
    `;
    tbody.appendChild(row);
  }
  tbody.querySelectorAll(".open-account-detail").forEach((button) => {
    button.addEventListener("click", () => openAccountDetail(button.dataset.userId));
  });
}

async function searchAccounts(event) {
  event.preventDefault();
  const query = el("accountSearchQuery").value.trim();
  const result = await api("GET", `/admin/accounts?query=${encodeURIComponent(query)}`);
  renderAccountSearchResults(result.accounts ?? []);
}

async function openAccountDetail(userId) {
  const result = await api("GET", `/admin/accounts/${encodeURIComponent(userId)}`);
  const account = result.account;
  state.selectedUserId = account.user_id;

  el("accountDetailSection").hidden = false;
  el("accountDetailUserId").textContent = account.user_id;
  el("accountDetailActorType").textContent = account.actor_type;
  el("accountDetailState").textContent = account.account_state;
  el("accountDetailTestFlag").textContent = account.is_test_account ? "Yes" : "No";
  el("accountDetailTestReasonWrap").hidden = !account.test_account_reason;
  el("accountDetailTestReason").textContent = account.test_account_reason ?? "";
  el("accountDetailEmail").textContent = account.email ?? "";
  el("accountDetailEmailVerified").textContent = account.email_verified ? "Yes" : "No";
  el("accountActionResult").hidden = true;

  el("accountToggleStateConfirmButton").hidden = true;
  el("accountToggleTestConfirmButton").hidden = true;
  el("accountTestMarkingReason").hidden = true;
  el("accountTestMarkingReason").value = "";
  state.pendingStateChange = null;
  state.pendingTestMarking = null;

  const historyBody = el("accountEventHistory");
  historyBody.innerHTML = "";
  for (const event of account.events ?? []) {
    const row = document.createElement("tr");
    row.innerHTML = `<td>${event.event_type}</td><td>${event.occurred_at_iso8601 ?? ""}</td>`;
    historyBody.appendChild(row);
  }
}

function requestAccountStateToggle() {
  if (!state.selectedUserId) return;
  const currentState = el("accountDetailState").textContent;
  const nextState = currentState === "active" ? "suspended" : "active";
  state.pendingStateChange = { correlation_id: generateCorrelationId(), account_state: nextState };
  el("accountToggleStateConfirmButton").hidden = false;
  el("accountToggleStateConfirmButton").textContent = `Confirm: set state to ${nextState}`;
}

async function confirmAccountStateToggle() {
  if (!state.pendingStateChange || !state.selectedUserId) return;
  const pending = state.pendingStateChange;
  const outcome = await api("POST", `/admin/accounts/${encodeURIComponent(state.selectedUserId)}/state`, pending);
  el("accountActionResult").hidden = false;
  el("accountActionResult").textContent = `Audit record ${outcome.audit.audit_record_id}: ${JSON.stringify(outcome.audit.before_state)} -> ${JSON.stringify(outcome.audit.after_state)}`;
  el("accountToggleStateConfirmButton").hidden = true;
  state.pendingStateChange = null;
  await openAccountDetail(state.selectedUserId);
  await refreshAuditRecords();
}

function requestTestMarkingToggle() {
  if (!state.selectedUserId) return;
  const currentlyMarked = el("accountDetailTestFlag").textContent === "Yes";
  state.pendingTestMarking = { correlation_id: generateCorrelationId(), marked: !currentlyMarked };
  el("accountToggleTestConfirmButton").hidden = false;
  el("accountToggleTestConfirmButton").textContent = `Confirm: ${currentlyMarked ? "unmark" : "mark"} as test account`;
  el("accountTestMarkingReason").hidden = currentlyMarked;
  if (!currentlyMarked) el("accountTestMarkingReason").value = "";
}

async function confirmTestMarkingToggle() {
  if (!state.pendingTestMarking || !state.selectedUserId) return;
  const pending = {
    ...state.pendingTestMarking,
    reason: state.pendingTestMarking.marked ? el("accountTestMarkingReason").value.trim() : null
  };
  const outcome = await api("POST", `/admin/accounts/${encodeURIComponent(state.selectedUserId)}/test-marking`, pending);
  el("accountActionResult").hidden = false;
  el("accountActionResult").textContent = `Audit record ${outcome.audit.audit_record_id}: ${JSON.stringify(outcome.audit.before_state)} -> ${JSON.stringify(outcome.audit.after_state)}`;
  el("accountToggleTestConfirmButton").hidden = true;
  el("accountTestMarkingReason").hidden = true;
  state.pendingTestMarking = null;
  await openAccountDetail(state.selectedUserId);
  await refreshAuditRecords();
}

async function refreshCommercialRecords() {
  const result = await api("GET", "/admin/commercial");
  state.commercialRecords = result.records ?? [];
  renderCommercialRecords();
}

function filteredCommercialRecords() {
  const search = (el("commercialRecordsSearch")?.value ?? "").trim().toLowerCase();
  if (!search) return state.commercialRecords;
  return state.commercialRecords.filter((record) =>
    [record.user_id, record.record_type, record.billing_access_state]
      .some((value) => String(value ?? "").toLowerCase().includes(search))
  );
}

function renderCommercialRecords() {
  const tbody = el("commercialRecordsList");
  tbody.innerHTML = "";
  const records = filteredCommercialRecords();
  for (const record of records) {
    const row = document.createElement("tr");
    row.innerHTML = `<td>${escapeHtml(record.user_id)}</td><td>${escapeHtml(record.record_type)}</td><td>${escapeHtml(record.billing_access_state ?? "-")}</td><td>${escapeHtml(record.effective_at_iso8601 ?? "")}</td>`;
    tbody.appendChild(row);
  }
  if (state.commercialRecords.length > 0 && records.length === 0) {
    const emptyRow = document.createElement("tr");
    emptyRow.innerHTML = `<td colspan="4" class="muted">No entitlement records match.</td>`;
    tbody.appendChild(emptyRow);
  }
}

function supportContextDetailMarkup(report) {
  const browserContext = report.browser_context ?? {};
  const failureContext = report.failure_context ?? {};

  const browserLines = [
    ["User agent", browserContext.user_agent],
    ["Language", browserContext.language],
    ["Viewport", (browserContext.viewport_width && browserContext.viewport_height) ? `${browserContext.viewport_width}x${browserContext.viewport_height}` : null],
    ["Timezone offset (minutes)", browserContext.timezone_offset_minutes]
  ].filter(([, value]) => value !== null && value !== undefined && value !== "");

  const failureLines = [
    ["Failed request", (failureContext.method && failureContext.path) ? `${failureContext.method} ${failureContext.path}` : null],
    ["Status", failureContext.status],
    ["Reason", failureContext.reason],
    ["Retryable", typeof failureContext.retryable === "boolean" ? (failureContext.retryable ? "yes" : "no") : null]
  ].filter(([, value]) => value !== null && value !== undefined && value !== "");

  const listItems = (lines) => lines.map(([label, value]) => `<li><strong>${escapeHtml(label)}:</strong> ${escapeHtml(value)}</li>`).join("");

  return `
    <dl>
      <dt>Route</dt><dd>${escapeHtml(report.route_hash || "-")}</dd>
      <dt>Occurred at</dt><dd>${escapeHtml(report.occurred_at_iso8601 || "-")}</dd>
    </dl>
    <p>Browser context</p>
    <ul>${listItems(browserLines) || "<li>No browser context recorded.</li>"}</ul>
    <p>Failure context</p>
    <ul>${listItems(failureLines) || "<li>No failed-request context attached.</li>"}</ul>
  `;
}

async function refreshSupportRequests() {
  const result = await api("GET", "/admin/support-requests");
  state.supportRequests = result.reports ?? [];
  renderSupportRequests();
}

function filteredSupportRequests() {
  const search = (el("supportRequestsSearch")?.value ?? "").trim().toLowerCase();
  if (!search) return state.supportRequests;
  return state.supportRequests.filter((report) =>
    [report.correlation_id, report.user_id, report.description, report.status]
      .some((value) => String(value ?? "").toLowerCase().includes(search))
  );
}

function renderSupportRequests() {
  const tbody = el("supportRequestsList");
  tbody.innerHTML = "";
  const reports = filteredSupportRequests();
  for (const report of reports) {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${escapeHtml(report.correlation_id)}</td>
      <td>${escapeHtml(report.user_id)}</td>
      <td>${escapeHtml(report.description)}</td>
      <td>${escapeHtml(report.status)}</td>
      <td>
        <button type="button" class="details-support" data-correlation-id="${escapeHtml(report.correlation_id)}">Details</button>
        ${report.status === "submitted"
          ? `<button type="button" class="ack-support" data-correlation-id="${escapeHtml(report.correlation_id)}">Acknowledge</button>`
          : ""
        }
        ${report.status !== "closed"
          ? `<button type="button" class="close-support" data-correlation-id="${escapeHtml(report.correlation_id)}">Close</button>`
          : ""
        }
      </td>
    `;
    tbody.appendChild(row);

    const detailRow = document.createElement("tr");
    detailRow.className = "support-detail-row";
    detailRow.hidden = true;
    detailRow.innerHTML = `<td colspan="5">${supportContextDetailMarkup(report)}</td>`;
    tbody.appendChild(detailRow);
  }
  if (state.supportRequests.length > 0 && reports.length === 0) {
    const emptyRow = document.createElement("tr");
    emptyRow.innerHTML = `<td colspan="5" class="muted">No support requests match.</td>`;
    tbody.appendChild(emptyRow);
  }

  tbody.querySelectorAll(".details-support").forEach((button) => {
    button.addEventListener("click", () => {
      const detailRow = button.closest("tr").nextElementSibling;
      detailRow.hidden = !detailRow.hidden;
      button.textContent = detailRow.hidden ? "Details" : "Hide details";
    });
  });
  tbody.querySelectorAll(".ack-support").forEach((button) => {
    button.addEventListener("click", () => confirmAndChangeSupportStatus(button.dataset.correlationId, "acknowledged"));
  });
  tbody.querySelectorAll(".close-support").forEach((button) => {
    button.addEventListener("click", () => confirmAndChangeSupportStatus(button.dataset.correlationId, "closed"));
  });
}

async function confirmAndChangeSupportStatus(targetCorrelationId, newStatus) {
  await api("POST", `/admin/support-requests/${encodeURIComponent(targetCorrelationId)}/status`, {
    correlation_id: generateCorrelationId(),
    status: newStatus
  });
  await refreshSupportRequests();
  await refreshAuditRecords();
}

async function refreshDataRightsReview() {
  const [exportsResult, deletionsResult] = await Promise.all([
    api("GET", "/admin/data-rights/exports"),
    api("GET", "/admin/data-rights/deletions")
  ]);

  state.dataRightsExports = exportsResult.requests ?? [];
  state.dataRightsDeletions = deletionsResult.requests ?? [];
  renderDataRightsReview();
}

function filteredExportRequests() {
  const search = (el("exportRequestsSearch")?.value ?? "").trim().toLowerCase();
  if (!search) return state.dataRightsExports;
  return state.dataRightsExports.filter((request) =>
    [request.export_request_id, request.user_id, request.status]
      .some((value) => String(value ?? "").toLowerCase().includes(search))
  );
}

function filteredDeletionRequests() {
  const search = (el("deletionRequestsSearch")?.value ?? "").trim().toLowerCase();
  if (!search) return state.dataRightsDeletions;
  return state.dataRightsDeletions.filter((request) =>
    [request.deletion_request_id, request.user_id, request.reason_code, request.queue_status]
      .some((value) => String(value ?? "").toLowerCase().includes(search))
  );
}

function renderDataRightsReview() {
  const exportsBody = el("exportRequestsList");
  exportsBody.innerHTML = "";
  const exportRequests = filteredExportRequests();
  for (const request of exportRequests) {
    const row = document.createElement("tr");
    row.innerHTML = `<td>${escapeHtml(request.export_request_id)}</td><td>${escapeHtml(request.user_id)}</td><td>${escapeHtml(request.status)}</td><td>${escapeHtml(request.requested_at_iso8601 ?? "")}</td><td>${escapeHtml(request.ready_at_iso8601 ?? "")}</td><td>${escapeHtml(request.expires_at_iso8601 ?? "")}</td><td>${escapeHtml(request.downloaded_at_iso8601 ?? "Not downloaded")}</td>`;
    exportsBody.appendChild(row);
  }
  if (state.dataRightsExports.length > 0 && exportRequests.length === 0) {
    const emptyRow = document.createElement("tr");
    emptyRow.innerHTML = `<td colspan="7" class="muted">No export requests match.</td>`;
    exportsBody.appendChild(emptyRow);
  }

  const deletionsBody = el("deletionRequestsList");
  deletionsBody.innerHTML = "";
  const deletionRequests = filteredDeletionRequests();
  for (const request of deletionRequests) {
    const row = document.createElement("tr");
    row.innerHTML = `<td>${escapeHtml(request.deletion_request_id)}</td><td>${escapeHtml(request.user_id)}</td><td>${escapeHtml(request.reason_code)}</td><td>${escapeHtml(request.queue_status)}</td><td>${escapeHtml(request.requested_at_iso8601 ?? "")}</td>`;
    deletionsBody.appendChild(row);
  }
  if (state.dataRightsDeletions.length > 0 && deletionRequests.length === 0) {
    const emptyRow = document.createElement("tr");
    emptyRow.innerHTML = `<td colspan="5" class="muted">No deletion requests match.</td>`;
    deletionsBody.appendChild(emptyRow);
  }
}

async function refreshAuditRecords() {
  const result = await api("GET", "/admin/audit-records");
  state.auditRecords = result.records ?? [];
  renderAuditRecords();
}

function filteredAuditRecords() {
  const search = (el("auditRecordsSearch")?.value ?? "").trim().toLowerCase();
  if (!search) return state.auditRecords;
  return state.auditRecords.filter((record) =>
    [record.actor_user_id, record.action_type, record.target_record_type, record.target_record_id, record.correlation_id]
      .some((value) => String(value ?? "").toLowerCase().includes(search))
  );
}

function renderAuditRecords() {
  const tbody = el("auditRecordsList");
  tbody.innerHTML = "";
  const records = filteredAuditRecords();
  for (const record of records) {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${escapeHtml(record.actor_user_id)}</td>
      <td>${escapeHtml(record.action_type)}</td>
      <td>${escapeHtml(record.target_record_type)}:${escapeHtml(record.target_record_id)}</td>
      <td>${escapeHtml(JSON.stringify(record.before_state))}</td>
      <td>${escapeHtml(JSON.stringify(record.after_state))}</td>
      <td>${escapeHtml(record.correlation_id)}</td>
      <td>${escapeHtml(record.created_at_iso8601 ?? "")}</td>
    `;
    tbody.appendChild(row);
  }
  if (state.auditRecords.length > 0 && records.length === 0) {
    const emptyRow = document.createElement("tr");
    emptyRow.innerHTML = `<td colspan="7" class="muted">No audit records match.</td>`;
    tbody.appendChild(emptyRow);
  }
}

el("adminSignInForm").addEventListener("submit", signIn);
el("adminSignOutButton").addEventListener("click", signOut);
el("accountSearchForm").addEventListener("submit", searchAccounts);
el("accountToggleStateButton").addEventListener("click", requestAccountStateToggle);
el("accountToggleStateConfirmButton").addEventListener("click", () => confirmAccountStateToggle().catch(console.error));
el("accountToggleTestButton").addEventListener("click", requestTestMarkingToggle);
el("accountToggleTestConfirmButton").addEventListener("click", () => confirmTestMarkingToggle().catch(console.error));
el("exportRequestsSearch").addEventListener("input", renderDataRightsReview);
el("deletionRequestsSearch").addEventListener("input", renderDataRightsReview);
el("auditRecordsSearch").addEventListener("input", renderAuditRecords);
el("commercialRecordsSearch").addEventListener("input", renderCommercialRecords);
el("supportRequestsSearch").addEventListener("input", renderSupportRequests);
