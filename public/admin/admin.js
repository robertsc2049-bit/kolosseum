// DEV NOTE: FULL-UI-21 founder/admin operations client. Deliberately a
// standalone module - it never imports anything from public/app/, never
// reads the athlete/coach session cookie, and never calls any /account,
// /coach-workspace, /sessions or /blocks endpoint. Every operational
// action requires an explicit second "Confirm" click before it is sent,
// and every mutating request carries a fresh correlation_id so a repeated
// click replays rather than duplicates.

const state = {
  csrfToken: "",
  challengeToken: "",
  twoStep: null,
  usedBackupCode: false,
  selectedUserId: null,
  pendingStateChange: null,
  pendingTestMarking: null,
  dataRightsExports: [],
  dataRightsDeletions: [],
  auditRecords: [],
  commercialRecords: [],
  supportRequests: [],
  orgOwnerSupportRequests: [],
  selectedOrgOwnerUserId: null,
  pendingOrgOwnerStateChange: null,
  orgOwnerDataRightsExports: [],
  orgOwnerDataRightsDeletions: []
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
  el("orgOwnerAccountSearchSection").hidden = false;
  el("entitlementSection").hidden = false;
  el("supportSection").hidden = false;
  el("orgOwnerSupportSection").hidden = false;
  el("dataRightsReviewSection").hidden = false;
  el("orgOwnerDataRightsReviewSection").hidden = false;
  el("auditSection").hidden = false;
  el("exerciseDemoVideoSection").hidden = false;
  el("gymListingSection").hidden = false;
  el("messageReportSection").hidden = false;
  el("sellerTaxSection").hidden = false;

  refreshCommercialRecords();
  refreshSupportRequests();
  refreshOrgOwnerSupportRequests();
  refreshDataRightsReview();
  refreshOrgOwnerDataRightsReview();
  refreshAuditRecords();
  refreshExerciseDemoVideos().catch(console.error);
  refreshGymListings().catch(console.error);
  refreshMessageReports().catch(console.error);
  refreshSystemStatus().catch(console.error);
}

// Backups (backup_health.ts): when the last backup and off-server copy
// finished, or what's wrong. Nothing shows where there's no backup status
// (local development).
function sinceLabel(iso) {
  if (!iso) return "never";
  const minutes = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60000));
  if (minutes < 90) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.round(minutes / 60);
  return hours < 48 ? `${hours} hours ago` : `${Math.round(hours / 24)} days ago`;
}

async function refreshSystemStatus() {
  const box = el("systemStatus");
  const { backups } = await api("GET", "/admin/system-status");
  if (!backups.checked) {
    box.hidden = true;
    return;
  }
  const line = `Backups: last ${sinceLabel(backups.backup_last_ok)}` + (backups.offsite_state === "on" ? ` · copied off the server ${sinceLabel(backups.offsite_last_ok)}${backups.offsite_encrypted === "on" ? ", encrypted" : backups.offsite_encrypted === "off" ? ", not encrypted" : ""}` : "");
  box.className = backups.healthy ? "muted" : "error-text";
  box.innerHTML = backups.healthy
    ? `<p>${escapeHtml(line)}</p>`
    : `<p><strong>Backups need attention.</strong> ${escapeHtml(line)}</p><ul>${backups.problems.map((problem) => `<li>${escapeHtml(problem)}</li>`).join("")}</ul>`;
  box.hidden = false;
}

// Two-step sign-in (src/api/admin_two_step.ts): password, then a code from
// an authenticator app or a backup code. In production an admin who hasn't
// set it up has to before the console does anything else.
const TWO_STEP_MESSAGES = {
  admin_two_step_code_invalid: "That code didn't work. Enter the latest code from your app, or a backup code.",
  admin_two_step_expired: "That took too long. Sign in again.",
  admin_temporarily_locked: "Too many wrong tries. Wait 15 minutes, then sign in again.",
  admin_two_step_unavailable: "Two-step sign-in isn't available: the server has no KOLOSSEUM_ADMIN_TWO_STEP_KEY.",
  admin_two_step_already_on: "Two-step sign-in is already on."
};
const twoStepMessage = (error, fallback) => TWO_STEP_MESSAGES[error?.message] ?? fallback;
// Setting up or replacing codes takes an authenticator code only.
const appCodeMessage = (error, fallback) => (error?.message === "admin_two_step_code_invalid"
  ? "That code didn't match. Enter the code your app shows now."
  : twoStepMessage(error, fallback));

function showSignInError(text) {
  el("adminSignInError").textContent = text;
  el("adminSignInError").hidden = false;
}

function restartSignIn() {
  state.challengeToken = "";
  el("adminTwoStepForm").hidden = true;
  el("adminTwoStepCode").value = "";
  el("adminSignInForm").hidden = false;
  el("adminSignInPassword").value = "";
  el("adminSignInPassword").focus();
}

async function signIn(event) {
  event.preventDefault();
  el("adminSignInError").hidden = true;

  try {
    const result = await api("POST", "/admin/sign-in", {
      email: el("adminSignInEmail").value,
      password: el("adminSignInPassword").value
    });
    if (result.two_step_required) {
      state.challengeToken = result.challenge_token;
      el("adminSignInForm").hidden = true;
      el("adminTwoStepForm").hidden = false;
      el("adminTwoStepCode").focus();
      return;
    }
    signedIn(result);
  }
  catch (error) {
    showSignInError(error.message === "admin_temporarily_locked" ? TWO_STEP_MESSAGES.admin_temporarily_locked : "Sign-in failed.");
    console.error(error);
  }
}

async function submitTwoStepCode(event) {
  event.preventDefault();
  el("adminSignInError").hidden = true;
  try {
    const result = await api("POST", "/admin/sign-in/two-step", {
      challenge_token: state.challengeToken,
      code: el("adminTwoStepCode").value
    });
    state.challengeToken = "";
    signedIn(result);
  }
  catch (error) {
    el("adminTwoStepCode").value = "";
    showSignInError(twoStepMessage(error, "Sign-in failed."));
    if (error.message === "admin_two_step_expired" || error.message === "admin_temporarily_locked") restartSignIn();
    else el("adminTwoStepCode").focus();
  }
}

function signedIn(result) {
  state.csrfToken = result.csrf_token;
  el("adminDisplayName").textContent = result.admin.display_name;
  state.twoStep = result.two_step ?? null;
  state.usedBackupCode = result.used_backup_code === true;
  if (state.twoStep?.required && !state.twoStep.enabled) {
    el("adminSignInSection").hidden = true;
    openTwoStepSetup(true);
    return;
  }
  showWorkspace();
  renderTwoStepStatus();
}

function dateLabel(iso) {
  return iso ? new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "";
}

function renderTwoStepStatus() {
  const status = state.twoStep;
  const line = el("adminTwoStepStatus");
  const button = el("adminTwoStepManageButton");
  button.hidden = true;
  line.className = "muted";
  if (!status) { line.textContent = ""; return; }
  if (!status.available) {
    line.textContent = "Two-step sign-in is off: the server has no KOLOSSEUM_ADMIN_TWO_STEP_KEY.";
    line.className = "error-text";
    return;
  }
  if (!status.enabled) {
    line.textContent = "Two-step sign-in is off.";
    button.textContent = "Set it up";
    button.hidden = false;
    return;
  }
  const left = status.backup_codes_left;
  line.textContent = `Two-step sign-in is on (since ${dateLabel(status.enabled_at_iso8601)}). ${left} backup code${left === 1 ? "" : "s"} left.`
    + (state.usedBackupCode ? " You just used one." : "");
  if (left <= 2) line.className = "error-text";
  button.textContent = "New backup codes";
  button.hidden = false;
}

function openTwoStepSetup(mandatory) {
  el("adminTwoStepSetupSection").hidden = false;
  el("adminTwoStepSetupSignOut").hidden = !mandatory;
  el("adminTwoStepSetupSteps").hidden = true;
  el("adminTwoStepSetupError").hidden = true;
  el("adminTwoStepStartButton").hidden = false;
  el("adminTwoStepSetupIntro").textContent = (mandatory ? "Before you can use the admin console, set up two-step sign-in. " : "")
    + "After your password, you'll also enter a 6-digit code from an authenticator app on your phone (Google Authenticator, 1Password, Authy and so on). Someone with only your password can't get in.";
  el("adminTwoStepSetupSection").scrollIntoView({ block: "start" });
}

async function startTwoStepSetup() {
  el("adminTwoStepSetupError").hidden = true;
  try {
    const result = await api("POST", "/admin/two-step/setup", {});
    // The QR code is an SVG drawn by our own server from the setup key.
    el("adminTwoStepQr").innerHTML = result.qr_svg;
    el("adminTwoStepSecret").textContent = result.secret_base32.match(/.{1,4}/gu).join(" ");
    el("adminTwoStepStartButton").hidden = true;
    el("adminTwoStepSetupSteps").hidden = false;
    el("adminTwoStepConfirmCode").focus();
  }
  catch (error) {
    el("adminTwoStepSetupError").textContent = twoStepMessage(error, `Couldn't start: ${error.message}`);
    el("adminTwoStepSetupError").hidden = false;
  }
}

function showBackupCodes(codes) {
  el("adminBackupCodesList").innerHTML = codes.map((code) => `<li>${escapeHtml(code)}</li>`).join("");
  el("adminBackupCodesSection").hidden = false;
  el("adminBackupCodesSection").scrollIntoView({ block: "start" });
}

async function confirmTwoStepSetup(event) {
  event.preventDefault();
  el("adminTwoStepSetupError").hidden = true;
  try {
    const result = await api("POST", "/admin/two-step/setup/confirm", { code: el("adminTwoStepConfirmCode").value });
    state.twoStep = result.two_step;
    state.usedBackupCode = false;
    el("adminTwoStepConfirmCode").value = "";
    el("adminTwoStepQr").innerHTML = "";
    el("adminTwoStepSecret").textContent = "";
    el("adminTwoStepSetupSection").hidden = true;
    renderTwoStepStatus();
    showBackupCodes(result.backup_codes);
  }
  catch (error) {
    el("adminTwoStepConfirmCode").value = "";
    el("adminTwoStepSetupError").textContent = appCodeMessage(error, `Couldn't turn it on: ${error.message}`);
    el("adminTwoStepSetupError").hidden = false;
  }
}

function backupCodesSaved() {
  el("adminBackupCodesSection").hidden = true;
  el("adminBackupCodesList").innerHTML = "";
  if (el("adminWorkspaceSection").hidden) showWorkspace();
  renderTwoStepStatus();
}

function manageTwoStep() {
  if (!state.twoStep?.enabled) {
    openTwoStepSetup(false);
    return;
  }
  el("adminReplaceCodesForm").hidden = false;
  el("adminReplaceCodesError").hidden = true;
  el("adminReplaceCodesCode").focus();
}

async function replaceBackupCodes(event) {
  event.preventDefault();
  el("adminReplaceCodesError").hidden = true;
  try {
    const result = await api("POST", "/admin/two-step/backup-codes", { code: el("adminReplaceCodesCode").value });
    state.twoStep = result.two_step;
    state.usedBackupCode = false;
    el("adminReplaceCodesCode").value = "";
    el("adminReplaceCodesForm").hidden = true;
    renderTwoStepStatus();
    showBackupCodes(result.backup_codes);
  }
  catch (error) {
    el("adminReplaceCodesCode").value = "";
    el("adminReplaceCodesError").textContent = appCodeMessage(error, `Couldn't replace them: ${error.message}`);
    el("adminReplaceCodesError").hidden = false;
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

async function refreshAccountSearchResults() {
  const query = el("accountSearchQuery").value.trim();
  const result = await api("GET", `/admin/accounts?query=${encodeURIComponent(query)}`);
  renderAccountSearchResults(result.accounts ?? []);
}

async function searchAccounts(event) {
  event.preventDefault();
  await refreshAccountSearchResults();
}

async function openAccountDetail(userId) {
  const result = await api("GET", `/admin/accounts/${encodeURIComponent(userId)}`);
  const account = result.account;
  state.selectedUserId = account.user_id;

  el("accountDetailSection").hidden = false;
  el("accountDetailUserId").textContent = account.user_id;
  el("accountDetailActorType").textContent = Array.isArray(account.roles) ? account.roles.join(" + ") : account.actor_type;
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
  // An athlete without the coach role can be given it.
  el("accountAddCoachRoleButton").hidden = !(Array.isArray(account.roles) ? !account.roles.includes("coach") : account.actor_type === "athlete");
  el("accountAddCoachRoleConfirmButton").hidden = true;
  state.pendingStateChange = null;
  state.pendingTestMarking = null;
  state.pendingCoachConversion = null;

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
  await refreshAccountSearchResults();
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

// Give an athlete account the coach role too: same login, their athlete
// side kept; they switch between the two in the app.
function requestCoachConversion() {
  if (!state.selectedUserId) return;
  state.pendingCoachConversion = { correlation_id: generateCorrelationId() };
  el("accountAddCoachRoleConfirmButton").hidden = false;
}

async function confirmCoachConversion() {
  if (!state.pendingCoachConversion || !state.selectedUserId) return;
  const outcome = await api("POST", `/admin/accounts/${encodeURIComponent(state.selectedUserId)}/add-coach-role`, state.pendingCoachConversion);
  el("accountActionResult").hidden = false;
  el("accountActionResult").textContent = `Audit record ${outcome.audit.audit_record_id}: ${JSON.stringify(outcome.audit.before_state)} -> ${JSON.stringify(outcome.audit.after_state)}`;
  el("accountAddCoachRoleConfirmButton").hidden = true;
  state.pendingCoachConversion = null;
  await openAccountDetail(state.selectedUserId);
  await refreshAccountSearchResults();
  await refreshAuditRecords();
}

// DEV NOTE: FULL-UI-80 - org owner is a wholly separate identity surface
// (no actor_type/email_verified/test-account concept), mirrored here as its
// own parallel search/detail flow rather than folding into the account
// search/detail functions above.
function renderOrgOwnerAccountSearchResults(accounts) {
  const tbody = el("orgOwnerAccountSearchResults");
  tbody.innerHTML = "";
  for (const account of accounts) {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td><button type="button" class="open-org-owner-account-detail" data-user-id="${escapeHtml(account.user_id)}">${escapeHtml(account.user_id)}</button></td>
      <td>${escapeHtml(account.email)}</td>
      <td>${escapeHtml(account.display_name)}</td>
      <td>${escapeHtml(account.account_state)}</td>
    `;
    tbody.appendChild(row);
  }
  tbody.querySelectorAll(".open-org-owner-account-detail").forEach((button) => {
    button.addEventListener("click", () => openOrgOwnerAccountDetail(button.dataset.userId));
  });
}

async function refreshOrgOwnerAccountSearchResults() {
  const query = el("orgOwnerAccountSearchQuery").value.trim();
  const result = await api("GET", `/admin/org-owner-accounts?query=${encodeURIComponent(query)}`);
  renderOrgOwnerAccountSearchResults(result.accounts ?? []);
}

async function searchOrgOwnerAccounts(event) {
  event.preventDefault();
  await refreshOrgOwnerAccountSearchResults();
}

async function openOrgOwnerAccountDetail(userId) {
  const result = await api("GET", `/admin/org-owner-accounts/${encodeURIComponent(userId)}`);
  const account = result.account;
  state.selectedOrgOwnerUserId = account.user_id;

  el("orgOwnerAccountDetailSection").hidden = false;
  el("orgOwnerAccountDetailUserId").textContent = account.user_id;
  el("orgOwnerAccountDetailState").textContent = account.account_state;
  el("orgOwnerAccountDetailEmail").textContent = account.email ?? "";
  el("orgOwnerAccountActionResult").hidden = true;

  el("orgOwnerAccountToggleStateConfirmButton").hidden = true;
  state.pendingOrgOwnerStateChange = null;

  const organisationsBody = el("orgOwnerOrganisationsOwned");
  organisationsBody.innerHTML = "";
  for (const org of account.organisations_owned ?? []) {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${escapeHtml(org.org_id)}</td>
      <td>${escapeHtml(org.org_name)}</td>
      <td>${escapeHtml(org.org_state)}</td>
      <td>${escapeHtml(org.seat_limit ?? "Unrestricted")}</td>
      <td>${escapeHtml(org.visibility_mode)}</td>
    `;
    organisationsBody.appendChild(row);
  }
}

function requestOrgOwnerAccountStateToggle() {
  if (!state.selectedOrgOwnerUserId) return;
  const currentState = el("orgOwnerAccountDetailState").textContent;
  const nextState = currentState === "active" ? "suspended" : "active";
  state.pendingOrgOwnerStateChange = { correlation_id: generateCorrelationId(), account_state: nextState };
  el("orgOwnerAccountToggleStateConfirmButton").hidden = false;
  el("orgOwnerAccountToggleStateConfirmButton").textContent = `Confirm: set state to ${nextState}`;
}

async function confirmOrgOwnerAccountStateToggle() {
  if (!state.pendingOrgOwnerStateChange || !state.selectedOrgOwnerUserId) return;
  const pending = state.pendingOrgOwnerStateChange;
  const outcome = await api("POST", `/admin/org-owner-accounts/${encodeURIComponent(state.selectedOrgOwnerUserId)}/state`, pending);
  el("orgOwnerAccountActionResult").hidden = false;
  el("orgOwnerAccountActionResult").textContent = `Audit record ${outcome.audit.audit_record_id}: ${JSON.stringify(outcome.audit.before_state)} -> ${JSON.stringify(outcome.audit.after_state)}`;
  el("orgOwnerAccountToggleStateConfirmButton").hidden = true;
  state.pendingOrgOwnerStateChange = null;
  await openOrgOwnerAccountDetail(state.selectedOrgOwnerUserId);
  await refreshOrgOwnerAccountSearchResults();
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

// FULL-UI-95 org-owner support/error-reporting parity - mirrors the
// athlete/coach support-request block above field-for-field
// (org_owner_support_requests has the same shape as product_support_requests),
// reusing supportContextDetailMarkup() as-is since both share the same
// route_hash/occurred_at_iso8601/browser_context/failure_context fields.
async function refreshOrgOwnerSupportRequests() {
  const result = await api("GET", "/admin/org-owner-support-requests");
  state.orgOwnerSupportRequests = result.reports ?? [];
  renderOrgOwnerSupportRequests();
}

function filteredOrgOwnerSupportRequests() {
  const search = (el("orgOwnerSupportRequestsSearch")?.value ?? "").trim().toLowerCase();
  if (!search) return state.orgOwnerSupportRequests;
  return state.orgOwnerSupportRequests.filter((report) =>
    [report.correlation_id, report.user_id, report.description, report.status]
      .some((value) => String(value ?? "").toLowerCase().includes(search))
  );
}

function renderOrgOwnerSupportRequests() {
  const tbody = el("orgOwnerSupportRequestsList");
  tbody.innerHTML = "";
  const reports = filteredOrgOwnerSupportRequests();
  for (const report of reports) {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${escapeHtml(report.correlation_id)}</td>
      <td>${escapeHtml(report.user_id)}</td>
      <td>${escapeHtml(report.description)}</td>
      <td>${escapeHtml(report.status)}</td>
      <td>
        <button type="button" class="details-org-owner-support" data-correlation-id="${escapeHtml(report.correlation_id)}">Details</button>
        ${report.status === "submitted"
          ? `<button type="button" class="ack-org-owner-support" data-correlation-id="${escapeHtml(report.correlation_id)}">Acknowledge</button>`
          : ""
        }
        ${report.status !== "closed"
          ? `<button type="button" class="close-org-owner-support" data-correlation-id="${escapeHtml(report.correlation_id)}">Close</button>`
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
  if (state.orgOwnerSupportRequests.length > 0 && reports.length === 0) {
    const emptyRow = document.createElement("tr");
    emptyRow.innerHTML = `<td colspan="5" class="muted">No support requests match.</td>`;
    tbody.appendChild(emptyRow);
  }

  tbody.querySelectorAll(".details-org-owner-support").forEach((button) => {
    button.addEventListener("click", () => {
      const detailRow = button.closest("tr").nextElementSibling;
      detailRow.hidden = !detailRow.hidden;
      button.textContent = detailRow.hidden ? "Details" : "Hide details";
    });
  });
  tbody.querySelectorAll(".ack-org-owner-support").forEach((button) => {
    button.addEventListener("click", () => confirmAndChangeOrgOwnerSupportStatus(button.dataset.correlationId, "acknowledged"));
  });
  tbody.querySelectorAll(".close-org-owner-support").forEach((button) => {
    button.addEventListener("click", () => confirmAndChangeOrgOwnerSupportStatus(button.dataset.correlationId, "closed"));
  });
}

async function confirmAndChangeOrgOwnerSupportStatus(targetCorrelationId, newStatus) {
  await api("POST", `/admin/org-owner-support-requests/${encodeURIComponent(targetCorrelationId)}/status`, {
    correlation_id: generateCorrelationId(),
    status: newStatus
  });
  await refreshOrgOwnerSupportRequests();
  await refreshAuditRecords();
}

// Gym listings (gym_listing_service.ts): approve, turn down or hide a gym's
// free listing. Athletes only find approved ones.
async function refreshGymListings() {
  const status = el("gymListingStatusFilter").value;
  const result = await api("GET", `/admin/gym-listings${status ? `?status=${encodeURIComponent(status)}` : ""}`);
  renderGymListings(result.gym_listings ?? []);
}

function renderGymListings(listings) {
  const tbody = el("gymListingList");
  tbody.innerHTML = listings.length ? "" : `<tr><td colspan="6" class="muted">No gym listings here.</td></tr>`;
  for (const listing of listings) {
    const row = document.createElement("tr");
    const actions = [["approve", "Approve", "approved"], ["reject", "Turn down", "rejected"], ["hide", "Hide", "hidden"]]
      .filter(([, , status]) => status !== listing.listing_status)
      .map(([decision, label]) => `<button type="button" class="review-gym-listing" data-org-id="${escapeHtml(listing.org_id)}" data-decision="${decision}">${label}</button>`)
      .join(" ");
    row.innerHTML = `
      <td>${escapeHtml(listing.display_name)}<br /><span class="muted">${escapeHtml(listing.org_name)}${listing.org_state === "active" ? "" : ` (${escapeHtml(listing.org_state)})`}</span></td>
      <td>${escapeHtml(listing.area)}</td>
      <td>${escapeHtml(listing.owner_email ?? "")}</td>
      <td>${escapeHtml(listing.equipment.join(", ") || "None listed")}</td>
      <td>${escapeHtml(listing.listing_status)}${listing.review_note ? `<br /><span class="muted">${escapeHtml(listing.review_note)}</span>` : ""}</td>
      <td>${actions}</td>
    `;
    tbody.appendChild(row);
  }
  tbody.querySelectorAll(".review-gym-listing").forEach((button) => {
    button.addEventListener("click", () => reviewGymListing(button.dataset.orgId, button.dataset.decision));
  });
}

async function reviewGymListing(orgId, decision) {
  const note = decision === "approve" ? "" : window.prompt("A note for the gym's owner (optional):", "") ?? null;
  if (note === null) return;
  const result = el("gymListingResult");
  try {
    await api("POST", `/admin/gym-listings/${encodeURIComponent(orgId)}/review`, { decision, note });
    result.textContent = "Gym listing updated.";
  }
  catch (error) {
    result.textContent = `The gym listing couldn't be updated (${error.message}).`;
  }
  result.hidden = false;
  await refreshGymListings();
}

el("gymListingStatusFilter").addEventListener("change", () => { refreshGymListings().catch(console.error); });

// Reported messages (message_safety_service.ts): each report with what was
// said and the messages before it; dismiss, remove, or remove and restrict.
async function refreshMessageReports() {
  const status = el("messageReportStatusFilter").value;
  const result = await api("GET", `/admin/message-reports?status=${encodeURIComponent(status)}`);
  renderMessageReports(result.reports ?? []);
}

function messageLine(message) {
  const body = message.body_text ? escapeHtml(message.body_text) : "";
  const media = message.attachment_media_type || message.attachment?.media_type;
  const attachment = media ? ` <span class="muted">[${escapeHtml(media)} attached]</span>` : "";
  return `${body}${attachment}`;
}

function renderMessageReports(reports) {
  const list = el("messageReportList");
  list.innerHTML = reports.length ? "" : `<p class="muted">No reported messages here.</p>`;
  for (const report of reports) {
    const card = document.createElement("article");
    card.className = "message-report";
    const context = (report.context_before ?? []).map((entry) => `<li><span class="muted">${escapeHtml(entry.sender_role)} · ${escapeHtml(new Date(entry.sent_at).toLocaleString("en-GB"))}</span><br />${messageLine(entry)}</li>`).join("");
    const decided = report.status !== "open";
    card.innerHTML = `
      <h3>${escapeHtml(report.reason_label)} <span class="muted">· reported ${escapeHtml(new Date(report.reported_at_iso8601).toLocaleString("en-GB"))}</span></h3>
      <p><strong>From:</strong> ${escapeHtml(report.sender.name)} (${escapeHtml(report.sender.kind)}, ${escapeHtml(report.sender.email)})${report.sender_restricted ? ` <strong>- restricted from messaging</strong> <button type="button" class="lift-restriction" data-user-id="${escapeHtml(report.sender.user_id)}">Lift restriction</button>` : ""}<br />
      <strong>Reported by:</strong> ${escapeHtml(report.reporter.name)} (${escapeHtml(report.reporter.kind)}, ${escapeHtml(report.reporter.email)})</p>
      ${report.note ? `<p><strong>Their note:</strong> ${escapeHtml(report.note)}</p>` : ""}
      ${context ? `<details><summary>The ${report.context_before.length} message${report.context_before.length === 1 ? "" : "s"} before it</summary><ol>${context}</ol></details>` : ""}
      <blockquote>${messageLine(report.message)}<br /><span class="muted">Sent ${escapeHtml(new Date(report.message.sent_at).toLocaleString("en-GB"))}${report.message.removed ? " · removed" : ""}</span></blockquote>
      ${decided
        ? `<p class="muted">Decided: ${escapeHtml(report.status.replaceAll("_", " "))}${report.decision_note ? ` - ${escapeHtml(report.decision_note)}` : ""} (${escapeHtml(new Date(report.decided_at_iso8601).toLocaleString("en-GB"))})</p>`
        : `<p><button type="button" class="decide-report" data-report-id="${escapeHtml(report.report_id)}" data-decision="dismiss">Dismiss - no rule broken</button>
           <button type="button" class="decide-report" data-report-id="${escapeHtml(report.report_id)}" data-decision="remove">Remove the message</button>
           <button type="button" class="decide-report" data-report-id="${escapeHtml(report.report_id)}" data-decision="remove_and_restrict">Remove and stop them messaging</button></p>`}
    `;
    list.appendChild(card);
  }
  list.querySelectorAll(".decide-report").forEach((button) => {
    button.addEventListener("click", () => { decideMessageReport(button.dataset.reportId, button.dataset.decision).catch(console.error); });
  });
  list.querySelectorAll(".lift-restriction").forEach((button) => {
    button.addEventListener("click", () => { liftMessagingRestriction(button.dataset.userId).catch(console.error); });
  });
}

async function decideMessageReport(reportId, decision) {
  const note = decision === "dismiss"
    ? ""
    : window.prompt("The reason, shown to the sender (e.g. 'Abusive language towards an athlete'):", "");
  if (note === null) return;
  if (decision !== "dismiss" && !note.trim()) {
    window.alert("A reason is needed to remove a message.");
    return;
  }
  const result = el("messageReportResult");
  try {
    await api("POST", `/admin/message-reports/${encodeURIComponent(reportId)}/decide`, { decision, note });
    result.textContent = decision === "dismiss" ? "Report dismissed." : "Message removed.";
  }
  catch (error) {
    result.textContent = `The report couldn't be decided (${error.message}).`;
  }
  result.hidden = false;
  await refreshMessageReports();
}

async function liftMessagingRestriction(userId) {
  if (!window.confirm("Let this person send messages again?")) return;
  const result = el("messageReportResult");
  try {
    await api("POST", `/admin/messaging-restrictions/${encodeURIComponent(userId)}/lift`, {});
    result.textContent = "Restriction lifted.";
  }
  catch (error) {
    result.textContent = `The restriction couldn't be lifted (${error.message}).`;
  }
  result.hidden = false;
  await refreshMessageReports();
}

el("messageReportStatusFilter").addEventListener("change", () => { refreshMessageReports().catch(console.error); });

// Deletion requests must be erased within 30 days (privacy notice 8.2);
// the server works out each one's due-by date and state
// (deletion_request_deadlines.ts) and the queue lists the oldest open first.
function deadlineCell(request) {
  if (request.deadline_state === "done" || !request.due_by_iso8601) return `<td class="deadline muted">-</td>`;
  const due = escapeHtml(String(request.due_by_iso8601).slice(0, 10));
  const days = Number(request.days_left);
  const label = request.deadline_state === "overdue"
    ? `Overdue by ${-days} day${days === -1 ? "" : "s"}`
    : `${days} day${days === 1 ? "" : "s"} left`;
  return `<td class="deadline deadline-${escapeHtml(request.deadline_state)}">${due}<br />${escapeHtml(label)}</td>`;
}

function deadlineSummary(requests) {
  const open = requests.filter((request) => request.queue_status !== "completed");
  if (!open.length) return "No deletion requests waiting.";
  const overdue = open.filter((request) => request.deadline_state === "overdue").length;
  const dueSoon = open.filter((request) => request.deadline_state === "due_soon").length;
  const parts = [`${open.length} waiting to be erased`];
  if (overdue) parts.push(`${overdue} overdue`);
  if (dueSoon) parts.push(`${dueSoon} due within 9 days`);
  return `${parts.join(", ")}. Each must be erased within 30 days of the request.`;
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

  el("deletionDeadlineSummary").textContent = deadlineSummary(state.dataRightsDeletions);
  const deletionsBody = el("deletionRequestsList");
  deletionsBody.innerHTML = "";
  const deletionRequests = filteredDeletionRequests();
  for (const request of deletionRequests) {
    const row = document.createElement("tr");
    const eraseCell = request.queue_status === "completed"
      ? `<td class="muted">Erased</td>`
      : `<td><button type="button" class="confirm" data-erase-request="${escapeHtml(request.deletion_request_id)}" data-erase-user="${escapeHtml(request.user_id)}">Erase</button></td>`;
    row.innerHTML = `${deadlineCell(request)}<td>${escapeHtml(request.deletion_request_id)}</td><td>${escapeHtml(request.user_id)}</td><td>${escapeHtml(request.reason_code)}</td><td>${escapeHtml(request.queue_status)}</td><td>${escapeHtml(request.requested_at_iso8601 ?? "")}</td>${eraseCell}`;
    deletionsBody.appendChild(row);
  }
  if (state.dataRightsDeletions.length > 0 && deletionRequests.length === 0) {
    const emptyRow = document.createElement("tr");
    emptyRow.innerHTML = `<td colspan="7" class="muted">No deletion requests match.</td>`;
    deletionsBody.appendChild(emptyRow);
  }
}

// GDPR erasure of a reviewed deletion request. Irreversible, so the admin
// types the account's user id to confirm. Training sessions, billing and
// terms acceptances are kept (no longer linked to anyone); everything else
// of theirs - data and files - is deleted.
async function eraseDeletionRequest(deletionRequestId, userId) {
  const typed = window.prompt(
    `Erase account ${userId}?

This permanently deletes their profile, messages, photos, videos, notifications and other personal data, and anonymises the training, billing and terms records that are kept. It can't be undone.

Type the user id to confirm:`
  );
  if (typed === null) return;
  if (typed.trim() !== userId) {
    window.alert("The user id didn't match - nothing was erased.");
    return;
  }
  try {
    const result = await api("POST", `/admin/data-rights/deletions/${encodeURIComponent(deletionRequestId)}/erase`, { correlation_id: generateCorrelationId() });
    const removed = result.audit?.files_removed;
    window.alert(`Erased ${userId}.${removed && removed.failed ? ` ${removed.failed} file(s) couldn't be removed - check the server.` : ""}`);
  }
  catch (error) {
    window.alert(error.message === "admin_deletion_request_already_erased" ? "That request has already been erased." : `Couldn't erase: ${error.message}`);
  }
  await refreshDataRightsReview();
  await refreshAuditRecords();
}

async function refreshOrgOwnerDataRightsReview() {
  const [exportsResult, deletionsResult] = await Promise.all([
    api("GET", "/admin/org-owner-data-rights/exports"),
    api("GET", "/admin/org-owner-data-rights/deletions")
  ]);

  state.orgOwnerDataRightsExports = exportsResult.requests ?? [];
  state.orgOwnerDataRightsDeletions = deletionsResult.requests ?? [];
  renderOrgOwnerDataRightsReview();
}

function filteredOrgOwnerExportRequests() {
  const search = (el("orgOwnerExportRequestsSearch")?.value ?? "").trim().toLowerCase();
  if (!search) return state.orgOwnerDataRightsExports;
  return state.orgOwnerDataRightsExports.filter((request) =>
    [request.export_request_id, request.user_id, request.status]
      .some((value) => String(value ?? "").toLowerCase().includes(search))
  );
}

function filteredOrgOwnerDeletionRequests() {
  const search = (el("orgOwnerDeletionRequestsSearch")?.value ?? "").trim().toLowerCase();
  if (!search) return state.orgOwnerDataRightsDeletions;
  return state.orgOwnerDataRightsDeletions.filter((request) =>
    [request.deletion_request_id, request.user_id, request.reason_code, request.queue_status]
      .some((value) => String(value ?? "").toLowerCase().includes(search))
  );
}

function renderOrgOwnerDataRightsReview() {
  const exportsBody = el("orgOwnerExportRequestsList");
  exportsBody.innerHTML = "";
  const exportRequests = filteredOrgOwnerExportRequests();
  for (const request of exportRequests) {
    const row = document.createElement("tr");
    row.innerHTML = `<td>${escapeHtml(request.export_request_id)}</td><td>${escapeHtml(request.user_id)}</td><td>${escapeHtml(request.status)}</td><td>${escapeHtml(request.requested_at_iso8601 ?? "")}</td><td>${escapeHtml(request.ready_at_iso8601 ?? "")}</td><td>${escapeHtml(request.expires_at_iso8601 ?? "")}</td><td>${escapeHtml(request.downloaded_at_iso8601 ?? "Not downloaded")}</td>`;
    exportsBody.appendChild(row);
  }
  if (state.orgOwnerDataRightsExports.length > 0 && exportRequests.length === 0) {
    const emptyRow = document.createElement("tr");
    emptyRow.innerHTML = `<td colspan="7" class="muted">No export requests match.</td>`;
    exportsBody.appendChild(emptyRow);
  }

  el("orgOwnerDeletionDeadlineSummary").textContent = deadlineSummary(state.orgOwnerDataRightsDeletions);
  const deletionsBody = el("orgOwnerDeletionRequestsList");
  deletionsBody.innerHTML = "";
  const deletionRequests = filteredOrgOwnerDeletionRequests();
  for (const request of deletionRequests) {
    const row = document.createElement("tr");
    const eraseCell = request.queue_status === "completed"
      ? `<td class="muted">Erased</td>`
      : `<td><button type="button" class="confirm" data-org-owner-erase-request="${escapeHtml(request.deletion_request_id)}" data-org-owner-erase-user="${escapeHtml(request.user_id)}">Erase</button></td>`;
    row.innerHTML = `${deadlineCell(request)}<td>${escapeHtml(request.deletion_request_id)}</td><td>${escapeHtml(request.user_id)}</td><td>${escapeHtml(request.reason_code)}</td><td>${escapeHtml(request.queue_status)}</td><td>${escapeHtml(request.requested_at_iso8601 ?? "")}</td>${eraseCell}`;
    deletionsBody.appendChild(row);
  }
  if (state.orgOwnerDataRightsDeletions.length > 0 && deletionRequests.length === 0) {
    const emptyRow = document.createElement("tr");
    emptyRow.innerHTML = `<td colspan="7" class="muted">No deletion requests match.</td>`;
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

// Coaches' tax details and quarterly totals as a CSV, for the yearly HMRC
// digital platform report (src/api/seller_tax_service.ts).
function csvCell(value) {
  const textValue = String(value ?? "");
  // Quote everything; a leading = + - @ is prefixed so spreadsheets don't run it as a formula.
  const safe = /^[=+\-@\t\r]/u.test(textValue) && !/^-\d+(\.\d+)?$/u.test(textValue) ? `'${textValue}` : textValue;
  return `"${safe.replaceAll('"', '""')}"`;
}

async function downloadSellerTaxReport(event) {
  event.preventDefault();
  const result = el("sellerTaxResult");
  const year = el("sellerTaxYear").value;
  try {
    const { report } = await api("GET", `/admin/seller-tax-report?year=${encodeURIComponent(year)}`);
    const lines = [report.columns.map(csvCell).join(",")];
    for (const row of report.rows) lines.push(report.columns.map((column) => csvCell(row[column])).join(","));
    const blob = new Blob([`${lines.join("\r\n")}\r\n`], { type: "text/csv;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `kolosseum-seller-tax-${report.year}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    const missing = report.rows.filter((row) => row.details_added !== "yes").length;
    result.textContent = `${report.rows.length} row${report.rows.length === 1 ? "" : "s"} for ${report.year}${missing ? ` - ${missing} without tax details yet` : ""}.`;
  }
  catch (error) {
    result.textContent = error.message === "seller_tax_report_year_invalid" ? "Choose a year from 2024 to this year." : `Couldn't build the report (${error.message}).`;
  }
  result.hidden = false;
}

el("sellerTaxYear").value = String(new Date().getFullYear() - (new Date().getMonth() === 0 ? 1 : 0));
el("sellerTaxForm").addEventListener("submit", (event) => { downloadSellerTaxReport(event).catch(console.error); });

// Platform default exercise demo videos (src/api/exercise_demo_video_service.ts).
async function refreshExerciseDemoVideos() {
  const result = await api("GET", "/admin/exercise-demo-videos");
  const tbody = el("exerciseDemoVideoList");
  tbody.innerHTML = "";
  const demos = result.demo_videos ?? [];
  for (const demo of demos) {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${escapeHtml(demo.exercise_id)}</td>
      <td><a href="${escapeHtml(demo.watch_url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(demo.provider)}: ${escapeHtml(demo.video_id)}</a></td>
      <td><button type="button" data-remove-demo="${escapeHtml(demo.exercise_id)}">Remove</button></td>
    `;
    tbody.appendChild(row);
  }
  if (demos.length === 0) {
    const emptyRow = document.createElement("tr");
    emptyRow.innerHTML = `<td colspan="3" class="muted">No default demos set yet.</td>`;
    tbody.appendChild(emptyRow);
  }
}

function showDemoVideoResult(text) {
  el("exerciseDemoVideoResult").textContent = text;
  el("exerciseDemoVideoResult").hidden = false;
}

async function saveExerciseDemoVideo(event) {
  event.preventDefault();
  const exerciseId = el("exerciseDemoVideoExerciseId").value.trim();
  try {
    await api("PUT", `/admin/exercise-demo-videos/${encodeURIComponent(exerciseId)}`, { video_url: el("exerciseDemoVideoUrl").value.trim() });
    showDemoVideoResult(`Default demo set for ${exerciseId}.`);
    el("exerciseDemoVideoUrl").value = "";
    await refreshExerciseDemoVideos();
  }
  catch (error) {
    showDemoVideoResult(error.message === "exercise_not_found" ? `No exercise with id ${exerciseId}.`
      : error.message === "demo_video_link_invalid" ? "That isn't a YouTube or Vimeo video link."
      : `Couldn't save: ${error.message}`);
  }
}

async function removeExerciseDemoVideo(exerciseId) {
  if (!window.confirm(`Remove the default demo for ${exerciseId}?`)) return;
  await api("DELETE", `/admin/exercise-demo-videos/${encodeURIComponent(exerciseId)}`);
  showDemoVideoResult(`Removed the default demo for ${exerciseId}.`);
  await refreshExerciseDemoVideos();
}

// Org-owner GDPR erasure: choose who takes over each organisation, then
// confirm with the owner's user id (src/api/gdpr_erasure_service.ts).
const orgOwnerErase = { requestId: "", userId: "", organisations: [] };

async function openOrgOwnerErase(requestId, userId) {
  const result = await api("GET", `/admin/org-owner-data-rights/deletions/${encodeURIComponent(requestId)}/erase-plan`);
  orgOwnerErase.requestId = requestId;
  orgOwnerErase.userId = userId;
  orgOwnerErase.organisations = result.plan?.organisations ?? [];
  el("orgOwnerEraseUserId").textContent = userId;
  el("orgOwnerEraseConfirm").value = "";
  el("orgOwnerEraseResult").hidden = true;
  const container = el("orgOwnerEraseOrganisations");
  container.innerHTML = "";
  if (orgOwnerErase.organisations.length === 0) {
    container.innerHTML = `<p class="muted">They don't own any organisations.</p>`;
  }
  for (const org of orgOwnerErase.organisations) {
    const block = document.createElement("p");
    if (org.coaches.length === 0) {
      block.innerHTML = `<strong>${escapeHtml(org.org_name)}</strong>: no active coaches - it will be closed.`;
    }
    else {
      const options = org.coaches.map((c) => `<option value="${escapeHtml(c.coach_user_id)}">${escapeHtml(c.display_name)} (${escapeHtml(c.email)})</option>`).join("");
      block.innerHTML = `<label><strong>${escapeHtml(org.org_name)}</strong> - hand it to<br /><select data-org-handover="${escapeHtml(org.org_id)}"><option value="">Choose a coach</option>${options}</select></label>`;
    }
    container.appendChild(block);
  }
  el("orgOwnerErasePanel").hidden = false;
  el("orgOwnerErasePanel").scrollIntoView({ block: "center" });
}

function showOrgOwnerEraseResult(text) {
  el("orgOwnerEraseResult").textContent = text;
  el("orgOwnerEraseResult").hidden = false;
}

async function submitOrgOwnerErase() {
  if (el("orgOwnerEraseConfirm").value.trim() !== orgOwnerErase.userId) {
    showOrgOwnerEraseResult("The user id didn't match - nothing was erased.");
    return;
  }
  const handovers = {};
  for (const org of orgOwnerErase.organisations) {
    if (org.coaches.length === 0) { handovers[org.org_id] = null; continue; }
    const chosen = document.querySelector(`[data-org-handover="${CSS.escape(org.org_id)}"]`)?.value ?? "";
    if (!chosen) { showOrgOwnerEraseResult(`Choose a coach to hand ${org.org_name} to.`); return; }
    handovers[org.org_id] = chosen;
  }
  try {
    const result = await api("POST", `/admin/org-owner-data-rights/deletions/${encodeURIComponent(orgOwnerErase.requestId)}/erase`, { correlation_id: generateCorrelationId(), handovers });
    const orgs = result.audit?.after_state?.organisations ?? [];
    const handed = orgs.filter((o) => o.outcome === "handed_over").length;
    const closed = orgs.filter((o) => o.outcome === "closed").length;
    showOrgOwnerEraseResult(`Erased ${orgOwnerErase.userId}. ${handed} organisation(s) handed over - the coach takes it over from their coach workspace; ${closed} closed.`);
  }
  catch (error) {
    showOrgOwnerEraseResult(error.message === "admin_deletion_request_already_erased" ? "That request has already been erased." : `Couldn't erase: ${error.message}`);
  }
  await refreshOrgOwnerDataRightsReview();
  await refreshAuditRecords();
}

el("adminSignInForm").addEventListener("submit", signIn);
el("adminTwoStepForm").addEventListener("submit", (event) => submitTwoStepCode(event).catch(console.error));
el("adminTwoStepRestart").addEventListener("click", restartSignIn);
el("adminTwoStepSetupSignOut").addEventListener("click", signOut);
el("adminTwoStepStartButton").addEventListener("click", () => startTwoStepSetup().catch(console.error));
el("adminTwoStepConfirmForm").addEventListener("submit", (event) => confirmTwoStepSetup(event).catch(console.error));
el("adminBackupCodesDone").addEventListener("click", backupCodesSaved);
el("adminTwoStepManageButton").addEventListener("click", manageTwoStep);
el("adminReplaceCodesForm").addEventListener("submit", (event) => replaceBackupCodes(event).catch(console.error));
el("adminReplaceCodesCancel").addEventListener("click", () => { el("adminReplaceCodesForm").hidden = true; });
el("orgOwnerDeletionRequestsList").addEventListener("click", (event) => {
  const button = event.target?.closest?.("[data-org-owner-erase-request]");
  if (button) openOrgOwnerErase(button.dataset.orgOwnerEraseRequest, button.dataset.orgOwnerEraseUser).catch((error) => showOrgOwnerEraseResult(`Couldn't load the organisations: ${error.message}`));
});
el("orgOwnerEraseSubmit").addEventListener("click", () => submitOrgOwnerErase().catch(console.error));
el("orgOwnerEraseCancel").addEventListener("click", () => { el("orgOwnerErasePanel").hidden = true; });
el("deletionRequestsList").addEventListener("click", (event) => {
  const button = event.target?.closest?.("[data-erase-request]");
  if (button) eraseDeletionRequest(button.dataset.eraseRequest, button.dataset.eraseUser).catch(console.error);
});
el("exerciseDemoVideoForm").addEventListener("submit", (event) => saveExerciseDemoVideo(event).catch(console.error));
el("exerciseDemoVideoList").addEventListener("click", (event) => {
  const exerciseId = event.target?.dataset?.removeDemo;
  if (exerciseId) removeExerciseDemoVideo(exerciseId).catch(console.error);
});
el("adminSignOutButton").addEventListener("click", signOut);
el("accountSearchForm").addEventListener("submit", searchAccounts);
el("accountToggleStateButton").addEventListener("click", requestAccountStateToggle);
el("accountToggleStateConfirmButton").addEventListener("click", () => confirmAccountStateToggle().catch(console.error));
el("accountToggleTestButton").addEventListener("click", requestTestMarkingToggle);
el("accountAddCoachRoleButton").addEventListener("click", requestCoachConversion);
el("accountAddCoachRoleConfirmButton").addEventListener("click", () => confirmCoachConversion().catch(console.error));
el("accountToggleTestConfirmButton").addEventListener("click", () => confirmTestMarkingToggle().catch(console.error));
el("exportRequestsSearch").addEventListener("input", renderDataRightsReview);
el("deletionRequestsSearch").addEventListener("input", renderDataRightsReview);
el("auditRecordsSearch").addEventListener("input", renderAuditRecords);
el("commercialRecordsSearch").addEventListener("input", renderCommercialRecords);
el("supportRequestsSearch").addEventListener("input", renderSupportRequests);
el("orgOwnerSupportRequestsSearch").addEventListener("input", renderOrgOwnerSupportRequests);
el("orgOwnerAccountSearchForm").addEventListener("submit", (event) => searchOrgOwnerAccounts(event).catch(console.error));
el("orgOwnerAccountToggleStateButton").addEventListener("click", requestOrgOwnerAccountStateToggle);
el("orgOwnerAccountToggleStateConfirmButton").addEventListener("click", () => confirmOrgOwnerAccountStateToggle().catch(console.error));
el("orgOwnerExportRequestsSearch").addEventListener("input", renderOrgOwnerDataRightsReview);
el("orgOwnerDeletionRequestsSearch").addEventListener("input", renderOrgOwnerDataRightsReview);
