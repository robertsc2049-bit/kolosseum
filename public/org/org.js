// DEV NOTE: Parts O.1/O.2 - org-owner dashboard shell + identity +
// organisation list/create, plus the coach roster view (invite by email,
// list, remove). Deliberately a standalone module, mirroring
// public/admin/admin.js's shape exactly - it never imports anything from
// public/app/, never reads the athlete/coach session cookie, and never
// calls any /account, /coach-workspace, /sessions, /blocks or /messages
// endpoint. Every route called here already exists and is already
// covered by real Postgres integration tests (parts B.1/B.2) - this file
// adds no new backend routes, only a UI on top of what already worked
// via curl.

const state = {
  csrfToken: "",
  selectedOrgId: null
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
      </div>
    </article>
  `).join("");

  for (const button of container.querySelectorAll("[data-manage-roster]")) {
    button.addEventListener("click", () => {
      showRosterSection(button.getAttribute("data-manage-roster"), button.getAttribute("data-org-name"));
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
}

boot();
