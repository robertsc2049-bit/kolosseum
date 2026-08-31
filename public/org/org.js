// DEV NOTE: Parts O.1/O.2/O.3/O.4/O.5 - org-owner dashboard shell +
// identity, organisation list/create, the coach roster view (invite by
// email, list, remove), the seat-plan billing view (status + update), the
// athlete-visibility view (org_visibility_service.ts's own individual/
// shared boundary - aggregate counts only vs a full per-athlete roster,
// decided entirely server-side by the org's declared visibility_mode), and
// the org<->coach / org<->athlete messaging inboxes. O.5 is text-only -
// it sends no attachment (mirrors sendMessageRequest's own text-only
// branch in public/app/app.js) but still renders any attachment already
// present on a received message (photo/video), read-only. Athlete-thread
// counterpart names reuse O.4's shared-mode visibility data (athlete
// messaging is itself gated to shared orgs only, so this always has
// names to draw from); coach-thread names reuse O.2's roster join.
// Deliberately a standalone module, mirroring
// public/admin/admin.js's shape exactly - it never imports anything from
// public/app/, never reads the athlete/coach session cookie, and never
// calls any /account, /coach-workspace, /sessions, /blocks or /messages
// endpoint. Every route called here already exists and is already
// covered by real Postgres integration tests (parts B.1/B.2) - this file
// adds no new backend routes, only a UI on top of what already worked
// via curl.

const state = {
  csrfToken: "",
  selectedOrgId: null,
  selectedThreadKind: null,
  selectedThreadId: null,
  selectedCounterpartId: null,
  selectedCounterpartName: "",
  selectedAttendanceEventId: null,
  reschedulingOccurrenceId: null
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
    const error = new Error(payload?.error ?? payload?.reason ?? `request_failed_${response.status}`);
    error.status = response.status;
    throw error;
  }
  return payload;
}

function showSignedOut() {
  el("orgSignInSection").hidden = false;
  el("orgRegisterSection").hidden = false;
  el("orgWorkspaceSection").hidden = true;
  el("orgListSection").hidden = true;
  el("orgCreateSection").hidden = true;
}

async function showWorkspace(displayName) {
  el("orgSignInSection").hidden = true;
  el("orgRegisterSection").hidden = true;
  el("orgWorkspaceSection").hidden = false;
  el("orgListSection").hidden = false;
  el("orgCreateSection").hidden = false;
  el("orgDisplayName").textContent = displayName;

  await refreshOrganisations();
}

function visibilityModeLabel(mode) {
  return mode === "shared" ? "Team" : "Gym";
}

function renderOrganisations(organisations) {
  const container = el("orgList");
  if (organisations.length === 0) {
    container.innerHTML = `
      <div class="empty-state compact-empty">
        <p>No organisations yet. Create one below.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = organisations.map((organisation) => `
    <article class="record-card">
      <div>
        <h3>${escapeHtml(organisation.org_name)}</h3>
        <p>Created ${escapeHtml(formatDate(organisation.created_at_iso8601))}</p>
      </div>
      <div class="record-meta">
        <span class="badge ${organisation.visibility_mode === "shared" ? "active" : "neutral"}">${visibilityModeLabel(organisation.visibility_mode)}</span>
        <button class="button secondary" type="button" data-manage-roster="${escapeHtml(organisation.org_id)}" data-org-name="${escapeHtml(organisation.org_name)}">Manage roster</button>
        <button class="button secondary" type="button" data-manage-billing="${escapeHtml(organisation.org_id)}" data-org-name="${escapeHtml(organisation.org_name)}">Manage billing</button>
        <button class="button secondary" type="button" data-view-athletes="${escapeHtml(organisation.org_id)}" data-org-name="${escapeHtml(organisation.org_name)}">View athletes</button>
        <button class="button secondary" type="button" data-view-progress="${escapeHtml(organisation.org_id)}" data-org-name="${escapeHtml(organisation.org_name)}">Progress</button>
        <button class="button secondary" type="button" data-view-attendance="${escapeHtml(organisation.org_id)}" data-org-name="${escapeHtml(organisation.org_name)}">Attendance</button>
        <button class="button secondary" type="button" data-view-messages="${escapeHtml(organisation.org_id)}" data-org-name="${escapeHtml(organisation.org_name)}">Messages</button>
        <button class="button secondary" type="button" data-view-audit="${escapeHtml(organisation.org_id)}" data-org-name="${escapeHtml(organisation.org_name)}">Activity log</button>
      </div>
    </article>
  `).join("");

  for (const button of container.querySelectorAll("[data-manage-roster]")) {
    button.addEventListener("click", () => {
      showRosterSection(button.getAttribute("data-manage-roster"), button.getAttribute("data-org-name"));
    });
  }

  for (const button of container.querySelectorAll("[data-manage-billing]")) {
    button.addEventListener("click", () => {
      showBillingSection(button.getAttribute("data-manage-billing"), button.getAttribute("data-org-name"));
    });
  }

  for (const button of container.querySelectorAll("[data-view-athletes]")) {
    button.addEventListener("click", () => {
      showVisibilitySection(button.getAttribute("data-view-athletes"), button.getAttribute("data-org-name"));
    });
  }

  for (const button of container.querySelectorAll("[data-view-progress]")) {
    button.addEventListener("click", () => {
      showProgressSection(button.getAttribute("data-view-progress"), button.getAttribute("data-org-name"));
    });
  }

  for (const button of container.querySelectorAll("[data-view-attendance]")) {
    button.addEventListener("click", () => {
      showAttendanceSection(button.getAttribute("data-view-attendance"), button.getAttribute("data-org-name"));
    });
  }

  for (const button of container.querySelectorAll("[data-view-messages]")) {
    button.addEventListener("click", () => {
      showMessagesSection(button.getAttribute("data-view-messages"), button.getAttribute("data-org-name"));
    });
  }

  for (const button of container.querySelectorAll("[data-view-audit]")) {
    button.addEventListener("click", () => {
      showAuditSection(button.getAttribute("data-view-audit"), button.getAttribute("data-org-name"));
    });
  }
}

function membershipStatusLabel(status) {
  if (status === "active") return "Active";
  if (status === "removed") return "Removed";
  return "Invited";
}

function renderRoster(roster) {
  const container = el("orgRosterList");
  if (roster.length === 0) {
    container.innerHTML = `
      <div class="empty-state compact-empty">
        <p>No coaches invited yet. Invite one above.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = roster.map((membership) => `
    <article class="record-card">
      <div>
        <h3>${escapeHtml(membership.coach_display_name || membership.coach_user_id)}</h3>
        <p>${escapeHtml(membership.coach_email || "")}</p>
        <p class="muted small">
          Invited ${escapeHtml(formatDate(membership.invited_at_iso8601))}
          ${membership.activated_at_iso8601 ? ` &middot; Joined ${escapeHtml(formatDate(membership.activated_at_iso8601))}` : ""}
          ${membership.removed_at_iso8601 ? ` &middot; Removed ${escapeHtml(formatDate(membership.removed_at_iso8601))}` : ""}
        </p>
      </div>
      <div class="record-meta">
        <span class="badge ${membership.membership_status === "active" ? "active" : "neutral"}">${membershipStatusLabel(membership.membership_status)}</span>
        ${membership.membership_status === "removed"
          ? ""
          : `<button class="button secondary" type="button" data-remove-membership="${escapeHtml(membership.membership_id)}">Remove</button>`}
      </div>
    </article>
  `).join("");

  for (const button of container.querySelectorAll("[data-remove-membership]")) {
    button.addEventListener("click", () => {
      removeMembership(button.getAttribute("data-remove-membership")).catch(console.error);
    });
  }
}

async function refreshRoster() {
  const result = await api("GET", `/org/organisations/${encodeURIComponent(state.selectedOrgId)}/roster`);
  renderRoster(Array.isArray(result.roster) ? result.roster : []);
}

function showRosterSection(orgId, orgName) {
  state.selectedOrgId = orgId;
  el("orgListSection").hidden = true;
  el("orgCreateSection").hidden = true;
  el("orgBillingSection").hidden = true;
  el("orgVisibilitySection").hidden = true;
  el("orgMessagesSection").hidden = true;
  el("orgThreadDetailSection").hidden = true;
  el("orgAuditSection").hidden = true;
  el("orgProgressSection").hidden = true;
  el("orgAttendanceSection").hidden = true;
  el("orgAttendanceDetailSection").hidden = true;
  el("orgRosterSection").hidden = false;
  el("orgRosterOrgName").textContent = orgName;
  el("orgRosterInviteForm").reset();
  el("orgRosterInviteError").hidden = true;
  el("orgRosterError").hidden = true;
  refreshRoster().catch(console.error);
}

function hideRosterSection() {
  state.selectedOrgId = null;
  el("orgRosterSection").hidden = true;
  el("orgListSection").hidden = false;
  el("orgCreateSection").hidden = false;
}

function renderBillingStatus(billing) {
  const container = el("orgBillingStatus");
  container.innerHTML = `
    <article class="record-card">
      <div>
        <h3>${billing.seat_plan_configured ? `${escapeHtml(billing.seat_limit)} seats` : "No seat plan configured"}</h3>
        <p>${escapeHtml(billing.occupied_seat_count)} occupied${billing.available_seat_count === null ? "" : `, ${escapeHtml(billing.available_seat_count)} available`}</p>
      </div>
      <div class="record-meta">
        <span class="badge ${billing.seat_plan_configured ? "active" : "neutral"}">${billing.seat_plan_configured ? "Configured" : "Unrestricted"}</span>
      </div>
    </article>
  `;
}

async function refreshBilling() {
  const result = await api("GET", `/org/organisations/${encodeURIComponent(state.selectedOrgId)}/billing`);
  renderBillingStatus(result.billing);
}

function showBillingSection(orgId, orgName) {
  state.selectedOrgId = orgId;
  el("orgListSection").hidden = true;
  el("orgCreateSection").hidden = true;
  el("orgRosterSection").hidden = true;
  el("orgVisibilitySection").hidden = true;
  el("orgMessagesSection").hidden = true;
  el("orgThreadDetailSection").hidden = true;
  el("orgAuditSection").hidden = true;
  el("orgProgressSection").hidden = true;
  el("orgAttendanceSection").hidden = true;
  el("orgAttendanceDetailSection").hidden = true;
  el("orgBillingSection").hidden = false;
  el("orgBillingOrgName").textContent = orgName;
  el("orgBillingSeatPlanForm").reset();
  el("orgBillingError").hidden = true;
  refreshBilling().catch(console.error);
}

function hideBillingSection() {
  state.selectedOrgId = null;
  el("orgBillingSection").hidden = true;
  el("orgListSection").hidden = false;
  el("orgCreateSection").hidden = false;
}

function relationshipStateLabel(relationshipState) {
  if (relationshipState === "accepted") return "Active";
  if (relationshipState === "invited") return "Invited";
  if (relationshipState === "declined") return "Declined";
  if (relationshipState === "revoked") return "Revoked";
  return "Expired";
}

function coachLabel(coachUserId, coachNamesById) {
  return coachNamesById.get(coachUserId) || coachUserId;
}

function renderVisibility(visibility, coachNamesById) {
  const container = el("orgVisibilityList");
  if (visibility.coaches.length === 0) {
    container.innerHTML = `
      <div class="empty-state compact-empty">
        <p>No coaches on this organisation's roster yet.</p>
      </div>
    `;
    return;
  }

  if (visibility.visibility_mode === "individual") {
    container.innerHTML = visibility.coaches.map((coach) => `
      <article class="record-card">
        <div>
          <h3>${escapeHtml(coachLabel(coach.coach_user_id, coachNamesById))}</h3>
          <p>${escapeHtml(coach.active_athlete_count)} active, ${escapeHtml(coach.invited_athlete_count)} invited</p>
        </div>
        <div class="record-meta">
          <span class="badge ${coach.membership_status === "active" ? "active" : "neutral"}">${membershipStatusLabel(coach.membership_status)}</span>
        </div>
      </article>
    `).join("");
    return;
  }

  container.innerHTML = visibility.coaches.map((coach) => `
    <article class="record-card">
      <div>
        <h3>${escapeHtml(coachLabel(coach.coach_user_id, coachNamesById))}</h3>
        <p>${coach.athletes.length === 0 ? "No athletes yet." : coach.athletes.map((athlete) => `
          ${escapeHtml(athlete.display_name)} (${escapeHtml(athlete.email || "no email")}) - ${escapeHtml(relationshipStateLabel(athlete.relationship_state))}
        `).join("<br />")}</p>
      </div>
      <div class="record-meta">
        <span class="badge ${coach.membership_status === "active" ? "active" : "neutral"}">${membershipStatusLabel(coach.membership_status)}</span>
      </div>
    </article>
  `).join("");
}

async function refreshVisibility() {
  const [rosterResult, visibilityResult] = await Promise.all([
    api("GET", `/org/organisations/${encodeURIComponent(state.selectedOrgId)}/roster`),
    api("GET", `/org/organisations/${encodeURIComponent(state.selectedOrgId)}/athlete-visibility`)
  ]);

  const coachNamesById = new Map();
  for (const membership of Array.isArray(rosterResult.roster) ? rosterResult.roster : []) {
    if (membership.coach_display_name) coachNamesById.set(membership.coach_user_id, membership.coach_display_name);
  }

  renderVisibility(visibilityResult.visibility, coachNamesById);
}

function showVisibilitySection(orgId, orgName) {
  state.selectedOrgId = orgId;
  el("orgListSection").hidden = true;
  el("orgCreateSection").hidden = true;
  el("orgRosterSection").hidden = true;
  el("orgBillingSection").hidden = true;
  el("orgMessagesSection").hidden = true;
  el("orgThreadDetailSection").hidden = true;
  el("orgAuditSection").hidden = true;
  el("orgProgressSection").hidden = true;
  el("orgAttendanceSection").hidden = true;
  el("orgAttendanceDetailSection").hidden = true;
  el("orgVisibilitySection").hidden = false;
  el("orgVisibilityOrgName").textContent = orgName;
  el("orgVisibilityError").hidden = true;
  refreshVisibility().catch((error) => {
    el("orgVisibilityError").hidden = false;
    el("orgVisibilityError").textContent = "Could not load athlete visibility.";
    console.error(error);
  });
}

function hideVisibilitySection() {
  state.selectedOrgId = null;
  el("orgVisibilitySection").hidden = true;
  el("orgListSection").hidden = false;
  el("orgCreateSection").hidden = false;
}

// Progress graphs slice 4 - an org-wide progress rollup, one compact
// adherence chart per accepted athlete across every coach on this
// organisation's roster. Only ever populated for a 'shared'-mode
// ("team") org - an 'individual'-mode ("gym") org's rollup call always
// rejects with org_progress_rollup_not_available_for_individual_org,
// shown here as a factual explanation rather than a generic error (the
// "Progress" button itself always renders for every organisation,
// matching the existing "View athletes" button precedent - the server
// decides what comes back, never the client).
//
// renderLineChartSvg/adherenceSeriesPoints below deliberately duplicate
// public/app-src/components/LineChart.tsx's geometry and design exactly
// (same viewBox width, same padding, the same single-point-is-a-dot
// rule, the same default color cycle reusing the identical CSS custom
// properties from public/app/styles.css, which this app already links -
// see index.html) rather than being imported from a shared module: this
// file is a deliberately standalone, import-free module (see "org.js is
// wholly separate..." below), and public/org/ has no bundler in any case
// to share a .tsx React component with.
const PROGRESS_CHART_COLORS = ["var(--k-accent)", "var(--k-warning)", "var(--k-danger)", "var(--k-accent-bright)"];
const PROGRESS_CHART_VIEWBOX_WIDTH = 300;

function progressChartCoordinate(point, index, total, height, minValue, valueRange, paddingY) {
  const x = total > 1 ? (index / (total - 1)) * PROGRESS_CHART_VIEWBOX_WIDTH : PROGRESS_CHART_VIEWBOX_WIDTH / 2;
  const y = height - paddingY - ((point.value - minValue) / valueRange) * (height - paddingY * 2);
  return { x, y };
}

function progressChartPathFor(points, height, minValue, valueRange, paddingY) {
  return points
    .map((point, index) => {
      const { x, y } = progressChartCoordinate(point, index, points.length, height, minValue, valueRange, paddingY);
      return `${index === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");
}

// series: [{ id, label, color?, points: [{ date, value }] }]
function renderLineChartSvg(series, options = {}) {
  const height = options.height ?? 80;
  const compact = options.compact ?? false;
  const emptyLabel = options.emptyLabel ?? "Not enough data yet.";

  const nonEmptySeries = series.filter((entry) => entry.points.length > 0);
  if (nonEmptySeries.length === 0) {
    return `<div class="empty-state compact-empty"><p>${escapeHtml(emptyLabel)}</p></div>`;
  }

  const allValues = nonEmptySeries.flatMap((entry) => entry.points.map((point) => point.value));
  const minValue = Math.min(...allValues);
  const maxValue = Math.max(...allValues);
  const valueRange = maxValue - minValue || 1;
  const paddingY = compact ? 4 : 10;

  const marks = nonEmptySeries.map((entry, seriesIndex) => {
    const color = entry.color ?? PROGRESS_CHART_COLORS[seriesIndex % PROGRESS_CHART_COLORS.length];
    if (entry.points.length === 1) {
      const { x, y } = progressChartCoordinate(entry.points[0], 0, 1, height, minValue, valueRange, paddingY);
      return `<circle cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="3" fill="${color}" />`;
    }
    return `<path d="${progressChartPathFor(entry.points, height, minValue, valueRange, paddingY)}" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />`;
  }).join("");

  const legend = !compact && nonEmptySeries.length > 1
    ? `<div class="line-chart-legend">${nonEmptySeries.map((entry, seriesIndex) => {
        const color = entry.color ?? PROGRESS_CHART_COLORS[seriesIndex % PROGRESS_CHART_COLORS.length];
        return `<span class="line-chart-legend-item"><span class="line-chart-legend-swatch" style="background:${color}"></span>${escapeHtml(entry.label)}</span>`;
      }).join("")}</div>`
    : "";

  const ariaLabel = nonEmptySeries.map((entry) => entry.label).join(", ");

  return `
    <div class="line-chart${compact ? " line-chart-compact" : ""}">
      <svg viewBox="0 0 ${PROGRESS_CHART_VIEWBOX_WIDTH} ${height}" preserveAspectRatio="none" style="width:100%;height:${height}px;display:block" role="img" aria-label="${escapeHtml(ariaLabel)}">
        ${marks}
      </svg>
      ${legend}
    </div>
  `;
}

// Mirrors CoachProgressOverviewPanel.tsx's adherenceSeriesPoints() exactly -
// the one compact metric every athlete has data for, filtering out any
// window with no adherence_percentage to plot.
function adherenceSeriesPoints(insights) {
  const series = insights?.session_adherence?.series;
  if (!Array.isArray(series)) return [];
  return series
    .filter((window) => window.adherence_percentage !== null)
    .map((window) => ({ date: String(window.window_end_date ?? ""), value: Number(window.adherence_percentage) }));
}

// Progress graphs slice 5 - an "individual"-mode ("gym") org's rollup
// never carries an athlete_user_id, display_name or email (see
// org_progress_rollup_service.ts's own DEV NOTE) - only a per-coach
// AVERAGE adherence trend, itself withheld (insufficient_cohort) until
// enough athletes contribute that the average could not trivially be
// reverse-engineered to reveal one specific athlete's own number.
function aggregateAdherenceSeriesPoints(coach) {
  return (coach.adherence_series || [])
    .filter((window) => window.average_adherence_percentage !== null)
    .map((window) => ({ date: window.window_end_date, value: window.average_adherence_percentage }));
}

function renderAggregateProgress(coaches, coachNamesById) {
  const container = el("orgProgressList");
  if (coaches.length === 0) {
    container.innerHTML = `
      <div class="empty-state compact-empty">
        <p>No coaches on this organisation's roster yet.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = coaches.map((coach) => `
    <article class="record-card">
      <div class="record-meta">
        <span class="badge ${coach.insufficient_cohort ? "neutral" : "active"}">${coach.insufficient_cohort ? "Unavailable" : "Average adherence"}</span>
      </div>
      <div>
        <h3>${escapeHtml(coachLabel(coach.coach_user_id, coachNamesById))}</h3>
        <p class="muted small">${escapeHtml(coach.active_athlete_count)} active athlete${coach.active_athlete_count === 1 ? "" : "s"}</p>
      </div>
      ${coach.insufficient_cohort
        ? `<div class="empty-state compact-empty"><p>Not enough athletes yet for a privacy-safe average (fewer than 3).</p></div>`
        : renderLineChartSvg(
            [{ id: "average-adherence", label: "Average adherence %", points: aggregateAdherenceSeriesPoints(coach) }],
            { compact: true, emptyLabel: "Not enough sessions to chart yet." }
          )}
    </article>
  `).join("");
}

function renderRosterProgress(coaches, coachNamesById) {
  const container = el("orgProgressList");
  const athleteCount = coaches.reduce((total, coach) => total + coach.athletes.length, 0);

  if (athleteCount === 0) {
    container.innerHTML = `
      <div class="empty-state compact-empty">
        <p>No connected athletes yet.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = coaches.flatMap((coach) =>
    coach.athletes.map((athlete) => `
      <article class="record-card">
        <div class="record-meta">
          <span class="badge neutral">${athlete.insights ? "Adherence" : "Unavailable"}</span>
        </div>
        <div>
          <h3>${escapeHtml(athlete.display_name)}</h3>
          <p class="muted small">Coached by ${escapeHtml(coachLabel(coach.coach_user_id, coachNamesById))}</p>
        </div>
        ${renderLineChartSvg(
          [{ id: "adherence", label: "Adherence %", points: adherenceSeriesPoints(athlete.insights) }],
          {
            compact: true,
            emptyLabel: athlete.insights
              ? "Not enough sessions to chart yet."
              : "Progress could not be loaded for this athlete."
          }
        )}
      </article>
    `)
  ).join("");
}

function renderProgress(rollup, coachNamesById) {
  const coaches = Array.isArray(rollup.coaches) ? rollup.coaches : [];
  if (rollup.visibility_mode === "individual") {
    renderAggregateProgress(coaches, coachNamesById);
    return;
  }
  renderRosterProgress(coaches, coachNamesById);
}

async function refreshProgress() {
  const rosterResult = await api("GET", `/org/organisations/${encodeURIComponent(state.selectedOrgId)}/roster`);
  const coachNamesById = new Map();
  for (const membership of Array.isArray(rosterResult.roster) ? rosterResult.roster : []) {
    if (membership.coach_display_name) coachNamesById.set(membership.coach_user_id, membership.coach_display_name);
  }

  const result = await api("GET", `/org/organisations/${encodeURIComponent(state.selectedOrgId)}/progress-rollup`);
  renderProgress(result.rollup, coachNamesById);
}

function showProgressSection(orgId, orgName) {
  state.selectedOrgId = orgId;
  el("orgListSection").hidden = true;
  el("orgCreateSection").hidden = true;
  el("orgRosterSection").hidden = true;
  el("orgBillingSection").hidden = true;
  el("orgVisibilitySection").hidden = true;
  el("orgMessagesSection").hidden = true;
  el("orgThreadDetailSection").hidden = true;
  el("orgAuditSection").hidden = true;
  el("orgAttendanceSection").hidden = true;
  el("orgAttendanceDetailSection").hidden = true;
  el("orgProgressSection").hidden = false;
  el("orgProgressOrgName").textContent = orgName;
  el("orgProgressError").hidden = true;
  el("orgProgressList").innerHTML = "";
  refreshProgress().catch((error) => {
    el("orgProgressError").hidden = false;
    el("orgProgressError").textContent = "Could not load progress data.";
    console.error(error);
  });
}

function hideProgressSection() {
  state.selectedOrgId = null;
  el("orgProgressSection").hidden = true;
  el("orgAttendanceSection").hidden = true;
  el("orgAttendanceDetailSection").hidden = true;
  el("orgListSection").hidden = false;
  el("orgCreateSection").hidden = false;
}

// Attendance events slice 4 - gym-mode (individual-visibility) org-wide
// events, org-owner-only. Mirrors the "View athletes"/"Progress" pattern
// exactly: the Attendance button always renders for every organisation
// (the server decides what's allowed, never the client), and a
// shared-mode org's create attempt is shown as a factual explanation
// rather than a generic error. Creation deliberately has NO athlete
// picker - see attendance_event_gym_roster_service.ts's own DEV NOTE for
// why every currently-accepted athlete across the org's active coaches
// is auto-invited server-side instead.
function attendanceEventStatusLabel(status) {
  return status === "cancelled" ? "Cancelled" : "Active";
}

function occurrenceStatusLabel(status) {
  if (status === "skipped") return "Skipped";
  if (status === "rescheduled") return "Rescheduled";
  return "Scheduled";
}

function rsvpLabel(state_) {
  if (state_ === "attending") return "Attending";
  if (state_ === "maybe") return "Maybe";
  if (state_ === "not_attending") return "Not attending";
  return "No response yet";
}

function formatOccurrence(occurrence) {
  const date = occurrence.occurrence_date || "";
  const start = occurrence.start_time || null;
  const end = occurrence.end_time || null;
  if (start && end) return `${date}, ${start}–${end}`;
  if (start) return `${date}, ${start}`;
  return date;
}

function renderAttendanceEvents(events) {
  const container = el("orgAttendanceList");
  if (events.length === 0) {
    container.innerHTML = `
      <div class="empty-state compact-empty">
        <p>No gym-wide events created yet.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = events.map((eventRecord) => `
    <article class="record-card">
      <div class="record-meta">
        <span class="badge ${eventRecord.status === "cancelled" ? "neutral" : "active"}">${attendanceEventStatusLabel(eventRecord.status)}</span>
      </div>
      <h3>${escapeHtml(eventRecord.title)}</h3>
      <button class="button secondary small-button" type="button" data-open-attendance-event="${escapeHtml(eventRecord.event_id)}">Open event</button>
    </article>
  `).join("");

  for (const button of container.querySelectorAll("[data-open-attendance-event]")) {
    button.addEventListener("click", () => {
      showAttendanceDetail(button.getAttribute("data-open-attendance-event")).catch(console.error);
    });
  }
}

async function refreshAttendanceEvents() {
  const result = await api("GET", `/org/organisations/${encodeURIComponent(state.selectedOrgId)}/attendance-events`);
  renderAttendanceEvents(Array.isArray(result.events) ? result.events : []);
}

function selectedWeekdayTokens() {
  return Array.from(el("orgAttendanceWeekdaysFieldset").querySelectorAll("[data-weekday]"))
    .filter((input) => input.checked)
    .map((input) => input.getAttribute("data-weekday"));
}

function selectedEndsType() {
  const checked = el("orgAttendanceCreateForm").querySelector('input[name="orgAttendanceEndsType"]:checked');
  return checked ? checked.value : "after_count";
}

async function createAttendanceEvent(event) {
  event.preventDefault();
  el("orgAttendanceCreateError").hidden = true;
  el("orgAttendanceCreateSuccess").hidden = true;

  const repeats = el("orgAttendanceRepeats").checked;
  let recurrenceRule = null;
  if (repeats) {
    const endsType = selectedEndsType();
    recurrenceRule = {
      frequency: el("orgAttendanceFrequency").value,
      interval: Number.parseInt(el("orgAttendanceInterval").value, 10) || 1,
      weekdays: el("orgAttendanceFrequency").value === "weekly" ? selectedWeekdayTokens() : [],
      ends: endsType === "on_date"
        ? { type: "on_date", value: el("orgAttendanceEndsOnDate").value }
        : { type: "after_count", value: Number.parseInt(el("orgAttendanceEndsAfterCount").value, 10) || 1 }
    };
  }

  try {
    const result = await api("POST", `/org/organisations/${encodeURIComponent(state.selectedOrgId)}/attendance-events`, {
      title: el("orgAttendanceTitle").value.trim(),
      description: el("orgAttendanceDescription").value.trim(),
      location: el("orgAttendanceLocation").value.trim(),
      activity_label: el("orgAttendanceActivity").value.trim(),
      occurrence_date: el("orgAttendanceDate").value,
      start_time: el("orgAttendanceStartTime").value || null,
      end_time: el("orgAttendanceEndTime").value || null,
      recurrence_rule: recurrenceRule
    });

    el("orgAttendanceCreateForm").reset();
    el("orgAttendanceRecurrenceFields").hidden = true;
    el("orgAttendanceCreateSuccess").hidden = false;
    el("orgAttendanceCreateSuccess").textContent =
      `${result.event.title} created (${result.invited_count} athlete${result.invited_count === 1 ? "" : "s"} invited).`;
    await refreshAttendanceEvents();
  }
  catch (error) {
    el("orgAttendanceCreateError").hidden = false;
    el("orgAttendanceCreateError").textContent = error.message;
  }
}

function showAttendanceSection(orgId, orgName) {
  state.selectedOrgId = orgId;
  el("orgListSection").hidden = true;
  el("orgCreateSection").hidden = true;
  el("orgRosterSection").hidden = true;
  el("orgBillingSection").hidden = true;
  el("orgVisibilitySection").hidden = true;
  el("orgMessagesSection").hidden = true;
  el("orgThreadDetailSection").hidden = true;
  el("orgAuditSection").hidden = true;
  el("orgProgressSection").hidden = true;
  el("orgAttendanceDetailSection").hidden = true;
  el("orgAttendanceSection").hidden = false;
  el("orgAttendanceOrgName").textContent = orgName;
  el("orgAttendanceCreateForm").reset();
  el("orgAttendanceRecurrenceFields").hidden = true;
  el("orgAttendanceCreateError").hidden = true;
  el("orgAttendanceCreateSuccess").hidden = true;
  el("orgAttendanceError").hidden = true;
  refreshAttendanceEvents().catch((error) => {
    el("orgAttendanceError").hidden = false;
    el("orgAttendanceError").textContent = "Could not load attendance events.";
    console.error(error);
  });
}

function hideAttendanceSection() {
  state.selectedOrgId = null;
  el("orgAttendanceSection").hidden = true;
  el("orgListSection").hidden = false;
  el("orgCreateSection").hidden = false;
}

function renderAttendanceOccurrences(occurrences, roster) {
  const container = el("orgAttendanceDetailOccurrences");
  container.innerHTML = occurrences.map((occurrence) => {
    const canAct = occurrence.status !== "skipped";
    return `
      <article class="record-card">
        <div class="button-row" style="justify-content: space-between;">
          <span>
            <span class="badge ${occurrence.status === "skipped" ? "neutral" : occurrence.status === "rescheduled" ? "warning" : "active"}">${occurrenceStatusLabel(occurrence.status)}</span>
            ${escapeHtml(formatOccurrence(occurrence))}
          </span>
          ${canAct ? `
            <div class="button-row">
              <button class="button secondary small-button" type="button" data-reschedule-occurrence="${escapeHtml(occurrence.occurrence_id)}">Reschedule</button>
              <button class="button secondary small-button" type="button" data-skip-occurrence="${escapeHtml(occurrence.occurrence_id)}">Skip</button>
            </div>
          ` : ""}
        </div>
        ${occurrence.status === "rescheduled" && occurrence.rescheduled_to_date
          ? `<p class="muted small">Moved to ${escapeHtml(occurrence.rescheduled_to_date)}${occurrence.rescheduled_to_start_time ? `, ${escapeHtml(occurrence.rescheduled_to_start_time)}` : ""}</p>`
          : ""}
        ${roster.length > 0 ? `
          <div class="record-list">
            ${roster.map((entry) => `
              <div class="record-meta">
                <span>${escapeHtml(entry.display_name)}</span>
                <span class="badge neutral">${rsvpLabel(entry.rsvp_by_occurrence?.[occurrence.occurrence_id] ?? null)}</span>
              </div>
            `).join("")}
          </div>
        ` : ""}
      </article>
    `;
  }).join("");

  for (const button of container.querySelectorAll("[data-skip-occurrence]")) {
    button.addEventListener("click", () => {
      skipAttendanceOccurrence(button.getAttribute("data-skip-occurrence")).catch(console.error);
    });
  }
  for (const button of container.querySelectorAll("[data-reschedule-occurrence]")) {
    button.addEventListener("click", () => {
      openRescheduleForm(button.getAttribute("data-reschedule-occurrence"));
    });
  }
}

function renderAttendanceRoster(roster) {
  const container = el("orgAttendanceDetailRoster");
  if (roster.length === 0) {
    container.innerHTML = `
      <div class="empty-state compact-empty">
        <p>No athletes invited yet.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = roster.map((entry) => `
    <article class="record-card">
      <div>
        <h3>${escapeHtml(entry.display_name)}</h3>
        <p class="muted small">${escapeHtml(entry.email || "no email")}</p>
      </div>
    </article>
  `).join("");
}

async function refreshAttendanceDetail() {
  const result = await api(
    "GET",
    `/org/organisations/${encodeURIComponent(state.selectedOrgId)}/attendance-events/${encodeURIComponent(state.selectedAttendanceEventId)}`
  );
  el("orgAttendanceDetailTitle").textContent = result.event.title;
  renderAttendanceOccurrences(Array.isArray(result.occurrences) ? result.occurrences : [], Array.isArray(result.roster) ? result.roster : []);
  renderAttendanceRoster(Array.isArray(result.roster) ? result.roster : []);
  el("orgAttendanceCancelEventButton").hidden = result.event.status === "cancelled";
}

async function showAttendanceDetail(eventId) {
  state.selectedAttendanceEventId = eventId;
  state.reschedulingOccurrenceId = null;
  el("orgAttendanceSection").hidden = true;
  el("orgAttendanceDetailSection").hidden = false;
  el("orgAttendanceRescheduleForm").hidden = true;
  el("orgAttendanceDetailError").hidden = true;
  try {
    await refreshAttendanceDetail();
  }
  catch (error) {
    el("orgAttendanceDetailError").hidden = false;
    el("orgAttendanceDetailError").textContent = "Could not load event detail.";
    console.error(error);
  }
}

function hideAttendanceDetailSection() {
  state.selectedAttendanceEventId = null;
  state.reschedulingOccurrenceId = null;
  el("orgAttendanceDetailSection").hidden = true;
  el("orgAttendanceSection").hidden = false;
  refreshAttendanceEvents().catch(console.error);
}

async function skipAttendanceOccurrence(occurrenceId) {
  try {
    await api(
      "POST",
      `/org/organisations/${encodeURIComponent(state.selectedOrgId)}/attendance-events/${encodeURIComponent(state.selectedAttendanceEventId)}/occurrences/${encodeURIComponent(occurrenceId)}/skip`
    );
    await refreshAttendanceDetail();
  }
  catch (error) {
    el("orgAttendanceDetailError").hidden = false;
    el("orgAttendanceDetailError").textContent = error.message;
  }
}

function openRescheduleForm(occurrenceId) {
  state.reschedulingOccurrenceId = occurrenceId;
  el("orgAttendanceRescheduleForm").hidden = false;
  el("orgAttendanceRescheduleDate").value = "";
  el("orgAttendanceRescheduleStartTime").value = "";
  el("orgAttendanceRescheduleEndTime").value = "";
}

function closeRescheduleForm() {
  state.reschedulingOccurrenceId = null;
  el("orgAttendanceRescheduleForm").hidden = true;
}

async function confirmReschedule() {
  const occurrenceId = state.reschedulingOccurrenceId;
  if (!occurrenceId) return;
  try {
    await api(
      "POST",
      `/org/organisations/${encodeURIComponent(state.selectedOrgId)}/attendance-events/${encodeURIComponent(state.selectedAttendanceEventId)}/occurrences/${encodeURIComponent(occurrenceId)}/reschedule`,
      {
        new_date: el("orgAttendanceRescheduleDate").value,
        new_start_time: el("orgAttendanceRescheduleStartTime").value || null,
        new_end_time: el("orgAttendanceRescheduleEndTime").value || null
      }
    );
    closeRescheduleForm();
    await refreshAttendanceDetail();
  }
  catch (error) {
    el("orgAttendanceDetailError").hidden = false;
    el("orgAttendanceDetailError").textContent = error.message;
  }
}

async function cancelAttendanceEventFromDetail() {
  try {
    await api(
      "POST",
      `/org/organisations/${encodeURIComponent(state.selectedOrgId)}/attendance-events/${encodeURIComponent(state.selectedAttendanceEventId)}/cancel`
    );
    await refreshAttendanceDetail();
  }
  catch (error) {
    el("orgAttendanceDetailError").hidden = false;
    el("orgAttendanceDetailError").textContent = error.message;
  }
}

function auditActionTypeLabel(actionType) {
  const labels = {
    org_created: "Organisation created",
    coach_invited: "Coach invited",
    coach_membership_activated: "Coach joined",
    coach_membership_removed: "Coach removed",
    coach_membership_left: "Coach left",
    seat_plan_changed: "Seat plan changed"
  };
  return labels[actionType] || actionType;
}

function auditActorRoleLabel(actorRole) {
  return actorRole === "org_owner" ? "You" : "Coach";
}

function renderAuditLog(auditLog) {
  const container = el("orgAuditList");
  if (auditLog.length === 0) {
    container.innerHTML = `
      <div class="empty-state compact-empty">
        <p>No recorded activity yet.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = auditLog.map((record) => `
    <article class="record-card">
      <div>
        <h3>${escapeHtml(auditActionTypeLabel(record.action_type))}</h3>
        <p>${escapeHtml(auditActorRoleLabel(record.actor_role))} · ${escapeHtml(formatDate(record.created_at))}</p>
      </div>
      <div class="record-meta">
        <span class="badge neutral">${escapeHtml(record.actor_role)}</span>
      </div>
    </article>
  `).join("");
}

async function refreshAuditLog() {
  const result = await api("GET", `/org/organisations/${encodeURIComponent(state.selectedOrgId)}/audit-log`);
  renderAuditLog(Array.isArray(result.audit_log) ? result.audit_log : []);
}

function showAuditSection(orgId, orgName) {
  state.selectedOrgId = orgId;
  el("orgListSection").hidden = true;
  el("orgCreateSection").hidden = true;
  el("orgRosterSection").hidden = true;
  el("orgBillingSection").hidden = true;
  el("orgVisibilitySection").hidden = true;
  el("orgMessagesSection").hidden = true;
  el("orgThreadDetailSection").hidden = true;
  el("orgProgressSection").hidden = true;
  el("orgAttendanceSection").hidden = true;
  el("orgAttendanceDetailSection").hidden = true;
  el("orgAuditSection").hidden = false;
  el("orgAuditOrgName").textContent = orgName;
  el("orgAuditError").hidden = true;
  refreshAuditLog().catch((error) => {
    el("orgAuditError").hidden = false;
    el("orgAuditError").textContent = "Could not load the activity log.";
    console.error(error);
  });
}

function hideAuditSection() {
  state.selectedOrgId = null;
  el("orgAuditSection").hidden = true;
  el("orgListSection").hidden = false;
  el("orgCreateSection").hidden = false;
}

function formatAttachmentSize(bytes) {
  if (typeof bytes !== "number" || !Number.isFinite(bytes) || bytes <= 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function renderMessageAttachment(attachment) {
  if (!attachment) return "";
  const sizeLabel = formatAttachmentSize(attachment.byte_size);
  const sizeCaption = sizeLabel ? `<p class="message-attachment-size muted">${escapeHtml(sizeLabel)}</p>` : "";
  if (attachment.media_type === "image") {
    return `<img class="message-attachment-image" src="${escapeHtml(attachment.url)}" alt="Attached photo" loading="lazy" />${sizeCaption}`;
  }
  return `
    <video class="message-attachment-video" controls preload="metadata"
      ${attachment.thumbnail_url ? `poster="${escapeHtml(attachment.thumbnail_url)}"` : ""}>
      <source src="${escapeHtml(attachment.url)}" />
    </video>
    ${sizeCaption}
  `;
}

// Threads only exist once a first message has been sent (findOrCreateThread
// in both org_coach_messaging_service.ts and org_athlete_messaging_service.ts
// creates them lazily on send). Every messageable counterpart therefore
// needs an entry here whether or not a thread exists yet - "Message" starts
// a new conversation (no thread_id, resolved after the first send), "Open"
// continues an existing one.
function buildCombinedThreadList(counterparts, threadsByCounterpartId) {
  const withThread = [];
  const withoutThread = [];

  for (const counterpart of counterparts) {
    const thread = threadsByCounterpartId.get(counterpart.id) || null;
    (thread ? withThread : withoutThread).push({ ...counterpart, thread });
  }

  withThread.sort((a, b) => (b.thread.updated_at_iso8601 || "").localeCompare(a.thread.updated_at_iso8601 || ""));
  withoutThread.sort((a, b) => a.name.localeCompare(b.name));
  return [...withThread, ...withoutThread];
}

function renderThreadList(container, entries, kind) {
  if (entries.length === 0) {
    container.innerHTML = `
      <div class="empty-state compact-empty">
        <p>No ${kind === "coach" ? "coaches" : "athletes"} to message yet.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = entries.map((entry, index) => `
    <article class="record-card">
      <div>
        <h3>${escapeHtml(entry.name)}</h3>
        <p>${entry.thread ? `Updated ${escapeHtml(formatDate(entry.thread.updated_at_iso8601))}` : "No messages yet"}</p>
      </div>
      <div class="record-meta">
        ${Number(entry.thread?.unread_count) > 0 ? `<span class="badge active">${Number(entry.thread.unread_count)} unread</span>` : ""}
        <button class="button secondary" type="button" data-open-counterpart="${index}">${entry.thread ? "Open" : "Message"}</button>
      </div>
    </article>
  `).join("");

  for (const button of container.querySelectorAll("[data-open-counterpart]")) {
    button.addEventListener("click", () => {
      const entry = entries[Number(button.getAttribute("data-open-counterpart"))];
      if (!entry) return;
      showThreadDetail(kind, entry.thread, entry.id, entry.name);
    });
  }
}

async function refreshMessages() {
  const [rosterResult, coachThreadsResult, athleteThreadsResult] = await Promise.all([
    api("GET", `/org/organisations/${encodeURIComponent(state.selectedOrgId)}/roster`),
    api("GET", `/org/organisations/${encodeURIComponent(state.selectedOrgId)}/messages/threads`),
    api("GET", `/org/organisations/${encodeURIComponent(state.selectedOrgId)}/athlete-messages/threads`)
  ]);

  const coachCounterparts = [];
  for (const membership of Array.isArray(rosterResult.roster) ? rosterResult.roster : []) {
    if (membership.membership_status === "removed") continue;
    coachCounterparts.push({ id: membership.coach_user_id, name: membership.coach_display_name || membership.coach_user_id });
  }

  // Athlete messaging is itself gated to shared-visibility orgs only, so an
  // individual-mode org's visibility call below always resolves to
  // visibility_mode "individual" and simply yields no athlete counterparts
  // to message - matching the same boundary org_athlete_messaging_service.ts
  // enforces server-side.
  const athleteCounterparts = [];
  try {
    const visibilityResult = await api("GET", `/org/organisations/${encodeURIComponent(state.selectedOrgId)}/athlete-visibility`);
    if (visibilityResult.visibility.visibility_mode === "shared") {
      for (const coach of visibilityResult.visibility.coaches) {
        for (const athlete of coach.athletes) {
          if (athlete.relationship_state === "accepted") {
            athleteCounterparts.push({ id: athlete.athlete_user_id, name: athlete.display_name });
          }
        }
      }
    }
  }
  catch (error) {
    console.error(error);
  }

  const coachThreadsByCoachId = new Map();
  for (const thread of Array.isArray(coachThreadsResult.threads) ? coachThreadsResult.threads : []) {
    coachThreadsByCoachId.set(thread.coach_user_id, thread);
  }
  const athleteThreadsByAthleteId = new Map();
  for (const thread of Array.isArray(athleteThreadsResult.threads) ? athleteThreadsResult.threads : []) {
    athleteThreadsByAthleteId.set(thread.athlete_user_id, thread);
  }

  renderThreadList(el("orgCoachThreadList"), buildCombinedThreadList(coachCounterparts, coachThreadsByCoachId), "coach");
  renderThreadList(el("orgAthleteThreadList"), buildCombinedThreadList(athleteCounterparts, athleteThreadsByAthleteId), "athlete");
}

function showMessagesSection(orgId, orgName) {
  state.selectedOrgId = orgId;
  el("orgListSection").hidden = true;
  el("orgCreateSection").hidden = true;
  el("orgRosterSection").hidden = true;
  el("orgBillingSection").hidden = true;
  el("orgVisibilitySection").hidden = true;
  el("orgThreadDetailSection").hidden = true;
  el("orgAuditSection").hidden = true;
  el("orgProgressSection").hidden = true;
  el("orgAttendanceSection").hidden = true;
  el("orgAttendanceDetailSection").hidden = true;
  el("orgMessagesSection").hidden = false;
  el("orgMessagesOrgName").textContent = orgName;
  el("orgMessagesError").hidden = true;
  refreshMessages().catch((error) => {
    el("orgMessagesError").hidden = false;
    el("orgMessagesError").textContent = "Could not load messages.";
    console.error(error);
  });
}

function hideMessagesSection() {
  state.selectedOrgId = null;
  el("orgMessagesSection").hidden = true;
  el("orgListSection").hidden = false;
  el("orgCreateSection").hidden = false;
}

function threadMessagesRoute() {
  return state.selectedThreadKind === "coach"
    ? `/org/organisations/${encodeURIComponent(state.selectedOrgId)}/messages/threads/${encodeURIComponent(state.selectedThreadId)}`
    : `/org/organisations/${encodeURIComponent(state.selectedOrgId)}/athlete-messages/threads/${encodeURIComponent(state.selectedThreadId)}`;
}

function threadSendRoute() {
  return state.selectedThreadKind === "coach"
    ? `/org/organisations/${encodeURIComponent(state.selectedOrgId)}/messages/coaches/${encodeURIComponent(state.selectedCounterpartId)}/send`
    : `/org/organisations/${encodeURIComponent(state.selectedOrgId)}/athlete-messages/athletes/${encodeURIComponent(state.selectedCounterpartId)}/send`;
}

function renderThreadMessages(messages) {
  const container = el("orgThreadMessageList");
  if (messages.length === 0) {
    container.innerHTML = `
      <div class="empty-state compact-empty">
        <p>No messages yet. Say hello below.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = messages.map((message) => `
    <article class="record-card">
      <div>
        <h3>${message.sender_role === "org_owner" ? "You" : escapeHtml(state.selectedCounterpartName)}</h3>
        ${message.body_text ? `<p>${escapeHtml(message.body_text)}</p>` : ""}
        ${renderMessageAttachment(message.attachment)}
      </div>
      <div class="record-meta">
        <span class="muted small">${escapeHtml(formatDate(message.created_at_iso8601))}</span>
      </div>
    </article>
  `).join("");
}

async function refreshThreadMessages() {
  // No thread exists yet for a not-yet-started conversation - nothing to
  // fetch, the reply form's first successful send resolves this via the
  // sent message's own thread_id (see sendThreadReply).
  if (!state.selectedThreadId) {
    renderThreadMessages([]);
    return;
  }
  const result = await api("GET", threadMessagesRoute());
  renderThreadMessages(Array.isArray(result.messages) ? result.messages : []);
}

function showThreadDetail(kind, thread, counterpartId, counterpartName) {
  state.selectedThreadKind = kind;
  state.selectedThreadId = thread ? thread.thread_id : null;
  state.selectedCounterpartId = counterpartId;
  state.selectedCounterpartName = counterpartName;

  el("orgMessagesSection").hidden = true;
  el("orgThreadDetailSection").hidden = false;
  el("orgThreadCounterpartName").textContent = counterpartName;
  el("orgThreadReplyForm").reset();
  el("orgThreadReplyError").hidden = true;
  refreshThreadMessages().catch(console.error);
}

function hideThreadDetailSection() {
  state.selectedThreadKind = null;
  state.selectedThreadId = null;
  state.selectedCounterpartId = null;
  state.selectedCounterpartName = "";
  el("orgThreadDetailSection").hidden = true;
  el("orgMessagesSection").hidden = false;

  // Opening the thread we just left may have marked it read server-side -
  // refresh the list so its unread badge reflects that immediately.
  refreshMessages().catch(console.error);
}

async function sendThreadReply(event) {
  event.preventDefault();
  el("orgThreadReplyError").hidden = true;

  try {
    const result = await api("POST", threadSendRoute(), {
      body_text: el("orgThreadReplyText").value,
      client_request_id: `org_owner_msg_${Date.now()}_${Math.random().toString(36).slice(2)}`
    });
    // A not-yet-started conversation has no thread_id until this first
    // send resolves one via findOrCreateThread - capture it so the
    // now-real thread can be refetched below.
    if (!state.selectedThreadId && result.thread) state.selectedThreadId = result.thread.thread_id;
    el("orgThreadReplyForm").reset();
    await refreshThreadMessages();
  }
  catch (error) {
    el("orgThreadReplyError").hidden = false;
    el("orgThreadReplyError").textContent = "Could not send that message.";
    console.error(error);
  }
}

async function updateSeatPlan(event) {
  event.preventDefault();
  el("orgBillingError").hidden = true;

  try {
    await api("POST", `/org/organisations/${encodeURIComponent(state.selectedOrgId)}/billing/seat-plan`, {
      seat_limit: Number(el("orgBillingSeatLimit").value)
    });
    el("orgBillingSeatPlanForm").reset();
    await refreshBilling();
  }
  catch (error) {
    el("orgBillingError").hidden = false;
    el("orgBillingError").textContent = error.message === "org_billing_seat_limit_below_occupied"
      ? "That limit is below the number of coaches already occupying a seat."
      : error.message === "org_billing_seat_limit_invalid"
        ? "Enter a whole number of seats greater than zero."
        : "Could not update the seat plan.";
    console.error(error);
  }
}

async function inviteCoach(event) {
  event.preventDefault();
  el("orgRosterInviteError").hidden = true;

  try {
    await api("POST", `/org/organisations/${encodeURIComponent(state.selectedOrgId)}/roster/invite`, {
      coach_email: el("orgRosterInviteEmail").value
    });
    el("orgRosterInviteForm").reset();
    await refreshRoster();
  }
  catch (error) {
    el("orgRosterInviteError").hidden = false;
    el("orgRosterInviteError").textContent = error.message === "org_roster_coach_not_found"
      ? "No active coach account found with that email."
      : error.message === "org_roster_coach_already_member"
        ? "That coach is already on this roster."
        : "Could not invite that coach.";
    console.error(error);
  }
}

async function removeMembership(membershipId) {
  el("orgRosterError").hidden = true;

  try {
    await api("POST", `/org/organisations/${encodeURIComponent(state.selectedOrgId)}/roster/${encodeURIComponent(membershipId)}/remove`, {});
    await refreshRoster();
  }
  catch (error) {
    el("orgRosterError").hidden = false;
    el("orgRosterError").textContent = "Could not remove that coach.";
    console.error(error);
  }
}

function formatDate(iso) {
  if (!iso) return "";
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

async function refreshOrganisations() {
  const result = await api("GET", "/org/organisations");
  renderOrganisations(Array.isArray(result.organisations) ? result.organisations : []);
}

async function signIn(event) {
  event.preventDefault();
  el("orgSignInError").hidden = true;

  try {
    const result = await api("POST", "/org/sign-in", {
      email: el("orgSignInEmail").value,
      password: el("orgSignInPassword").value
    });
    state.csrfToken = result.csrf_token;
    await showWorkspace(result.org_owner.display_name);
  }
  catch (error) {
    el("orgSignInError").hidden = false;
    el("orgSignInError").textContent = "Sign-in failed.";
    console.error(error);
  }
}

async function register(event) {
  event.preventDefault();
  el("orgRegisterError").hidden = true;

  try {
    const result = await api("POST", "/org/register", {
      display_name: el("orgRegisterDisplayName").value,
      email: el("orgRegisterEmail").value,
      password: el("orgRegisterPassword").value
    });
    state.csrfToken = result.csrf_token;
    await showWorkspace(result.org_owner.display_name);
  }
  catch (error) {
    el("orgRegisterError").hidden = false;
    el("orgRegisterError").textContent = error.message === "org_owner_email_already_registered"
      ? "An account with that email already exists."
      : "Registration failed. Check the form and try again.";
    console.error(error);
  }
}

async function signOut() {
  await api("POST", "/org/sign-out", {}).catch(() => {});
  location.reload();
}

async function createOrganisation(event) {
  event.preventDefault();
  el("orgCreateError").hidden = true;

  try {
    await api("POST", "/org/organisations", {
      org_name: el("orgCreateName").value,
      visibility_mode: el("orgCreateVisibilityMode").value
    });
    el("orgCreateForm").reset();
    await refreshOrganisations();
  }
  catch (error) {
    el("orgCreateError").hidden = false;
    el("orgCreateError").textContent = error.message === "org_roster_org_name_required"
      ? "Enter an organisation name."
      : "Could not create the organisation.";
    console.error(error);
  }
}

function boot() {
  // No session-resume-on-load, matching public/admin/admin.js's own
  // precedent exactly - GET /org/session only confirms the cookie
  // resolves to a real user_id, it carries no display_name or
  // csrf_token, so a hard refresh always asks the owner to sign in again
  // rather than showing a half-populated workspace.
  showSignedOut();

  el("orgSignInForm").addEventListener("submit", (event) => signIn(event).catch(console.error));
  el("orgRegisterForm").addEventListener("submit", (event) => register(event).catch(console.error));
  el("orgSignOutButton").addEventListener("click", () => signOut().catch(console.error));
  el("orgCreateForm").addEventListener("submit", (event) => createOrganisation(event).catch(console.error));
  el("orgRosterInviteForm").addEventListener("submit", (event) => inviteCoach(event).catch(console.error));
  el("orgRosterBackButton").addEventListener("click", () => hideRosterSection());
  el("orgBillingSeatPlanForm").addEventListener("submit", (event) => updateSeatPlan(event).catch(console.error));
  el("orgBillingBackButton").addEventListener("click", () => hideBillingSection());
  el("orgVisibilityBackButton").addEventListener("click", () => hideVisibilitySection());
  el("orgProgressBackButton").addEventListener("click", () => hideProgressSection());
  el("orgAuditBackButton").addEventListener("click", () => hideAuditSection());
  el("orgAttendanceBackButton").addEventListener("click", () => hideAttendanceSection());
  el("orgAttendanceCreateForm").addEventListener("submit", (event) => createAttendanceEvent(event).catch(console.error));
  el("orgAttendanceRepeats").addEventListener("change", () => {
    el("orgAttendanceRecurrenceFields").hidden = !el("orgAttendanceRepeats").checked;
  });
  el("orgAttendanceDetailBackButton").addEventListener("click", () => hideAttendanceDetailSection());
  el("orgAttendanceRescheduleConfirmButton").addEventListener("click", () => confirmReschedule().catch(console.error));
  el("orgAttendanceRescheduleCancelButton").addEventListener("click", () => closeRescheduleForm());
  el("orgAttendanceCancelEventButton").addEventListener("click", () => cancelAttendanceEventFromDetail().catch(console.error));
  el("orgMessagesBackButton").addEventListener("click", () => hideMessagesSection());
  el("orgThreadDetailBackButton").addEventListener("click", () => hideThreadDetailSection());
  el("orgThreadReplyForm").addEventListener("submit", (event) => sendThreadReply(event).catch(console.error));
}

boot();
