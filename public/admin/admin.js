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
  pendingTestMarking: null
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
  const tbody = el("commercialRecordsList");
  tbody.innerHTML = "";
  for (const record of result.records ?? []) {
    const row = document.createElement("tr");
    row.innerHTML = `<td>${record.user_id}</td><td>${record.record_type}</td><td>${record.billing_access_state ?? "-"}</td><td>${record.effective_at_iso8601 ?? ""}</td>`;
    tbody.appendChild(row);
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
  const tbody = el("supportRequestsList");
  tbody.innerHTML = "";
  for (const report of result.reports ?? []) {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${report.correlation_id}</td>
      <td>${report.user_id}</td>
      <td>${report.description}</td>
      <td>${report.status}</td>
      <td>
        <button type="button" class="details-support" data-correlation-id="${report.correlation_id}">Details</button>
        <button type="button" class="ack-support" data-correlation-id="${report.correlation_id}" data-current-status="${report.status}">Acknowledge</button>
        <button type="button" class="close-support" data-correlation-id="${report.correlation_id}" data-current-status="${report.status}">Close</button>
      </td>
    `;
    tbody.appendChild(row);

    const detailRow = document.createElement("tr");
    detailRow.className = "support-detail-row";
    detailRow.hidden = true;
    detailRow.innerHTML = `<td colspan="5">${supportContextDetailMarkup(report)}</td>`;
    tbody.appendChild(detailRow);
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

  const exportsBody = el("exportRequestsList");
  exportsBody.innerHTML = "";
  for (const request of exportsResult.requests ?? []) {
    const row = document.createElement("tr");
    row.innerHTML = `<td>${request.export_request_id}</td><td>${request.user_id}</td><td>${request.status}</td><td>${request.requested_at_iso8601 ?? ""}</td><td>${request.ready_at_iso8601 ?? ""}</td><td>${request.expires_at_iso8601 ?? ""}</td><td>${request.downloaded_at_iso8601 ?? "Not downloaded"}</td>`;
    exportsBody.appendChild(row);
  }

  const deletionsBody = el("deletionRequestsList");
  deletionsBody.innerHTML = "";
  for (const request of deletionsResult.requests ?? []) {
    const row = document.createElement("tr");
    row.innerHTML = `<td>${request.deletion_request_id}</td><td>${request.user_id}</td><td>${request.reason_code}</td><td>${request.queue_status}</td><td>${request.requested_at_iso8601 ?? ""}</td>`;
    deletionsBody.appendChild(row);
  }
}

async function refreshAuditRecords() {
  const result = await api("GET", "/admin/audit-records");
  const tbody = el("auditRecordsList");
  tbody.innerHTML = "";
  for (const record of result.records ?? []) {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${record.actor_user_id}</td>
      <td>${record.action_type}</td>
      <td>${record.target_record_type}:${record.target_record_id}</td>
      <td>${JSON.stringify(record.before_state)}</td>
      <td>${JSON.stringify(record.after_state)}</td>
      <td>${record.correlation_id}</td>
      <td>${record.created_at_iso8601 ?? ""}</td>
    `;
    tbody.appendChild(row);
  }
}

el("adminSignInForm").addEventListener("submit", signIn);
el("adminSignOutButton").addEventListener("click", signOut);
el("accountSearchForm").addEventListener("submit", searchAccounts);
el("accountToggleStateButton").addEventListener("click", requestAccountStateToggle);
el("accountToggleStateConfirmButton").addEventListener("click", () => confirmAccountStateToggle().catch(console.error));
el("accountToggleTestButton").addEventListener("click", requestTestMarkingToggle);
el("accountToggleTestConfirmButton").addEventListener("click", () => confirmTestMarkingToggle().catch(console.error));
