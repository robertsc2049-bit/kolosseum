const STORAGE_KEY = "kolosseum.product.app.v1";

function readState() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}") ?? {};
  }
  catch {
    return {};
  }
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function titleCase(value) {
  return String(value ?? "")
    .replaceAll("_", " ")
    .replace(/\b\w/gu, (match) => match.toUpperCase());
}

function planFor(eventRecord) {
  return eventRecord?.event_plan && typeof eventRecord.event_plan === "object"
    ? eventRecord.event_plan
    : {};
}

function formatDate(value) {
  if (!value) return "Date not recorded";
  const parsed = Date.parse(`${value}T12:00:00.000Z`);
  if (!Number.isFinite(parsed)) return String(value);
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric"
  }).format(new Date(parsed));
}

function countdown(value) {
  if (!value) return "Date not recorded";
  const eventTime = Date.parse(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(eventTime)) return "Date not recorded";
  const today = new Date();
  const todayTime = Date.UTC(
    today.getUTCFullYear(),
    today.getUTCMonth(),
    today.getUTCDate()
  );
  const days = Math.ceil((eventTime - todayTime) / 86_400_000);
  if (days < 0) return "Event date passed";
  if (days === 0) return "Today";
  if (days === 1) return "1 day";
  return `${days} days`;
}

async function api(method, path, body) {
  const state = readState();
  const headers = { Accept: "application/json" };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (method !== "GET") {
    headers["x-kolosseum-csrf"] = String(state.csrfToken ?? "");
  }

  const response = await fetch(`/api/coach-workspace${path}`, {
    method,
    headers,
    credentials: "same-origin",
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const payload = response.status === 204
    ? {}
    : await response.json().catch(() => ({}));

  if (!response.ok) {
    const reason = payload?.details?.reason ?? payload?.error ?? "Event action failed";
    throw new Error(titleCase(reason));
  }
  return payload;
}

function setStatus(message, error = false) {
  const element = document.getElementById("eventLifecycleStatus");
  if (!element) return;
  element.textContent = message;
  element.className = error ? "form-error" : "muted small";
  element.hidden = !message;
}

function selectedEventIdFromHash() {
  const match = location.hash.match(/^#\/coach\/events\/([^/?#]+)$/u);
  return match ? decodeURIComponent(match[1]) : "";
}

function ensureStyles() {
  if (document.getElementById("eventLifecycleStyles")) return;
  const style = document.createElement("style");
  style.id = "eventLifecycleStyles";
  style.textContent = `
    .event-lifecycle-controls { display:grid; grid-template-columns:minmax(180px,2fr) repeat(3,minmax(130px,1fr)); gap:12px; margin:16px 0; }
    .event-lifecycle-result { display:flex; justify-content:space-between; gap:12px; align-items:center; margin-bottom:12px; }
    .event-lifecycle-card { cursor:pointer; }
    .event-lifecycle-card:focus-within { outline:2px solid currentColor; outline-offset:2px; }
    .event-lifecycle-detail { margin-top:20px; }
    .event-lifecycle-detail[hidden] { display:none; }
    .event-lifecycle-actions { display:flex; flex-wrap:wrap; gap:10px; margin:14px 0; }
    .event-lifecycle-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:16px; }
    .event-lifecycle-facts { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:10px; margin:14px 0; }
    .event-lifecycle-facts div { border:1px solid rgba(127,127,127,.25); border-radius:10px; padding:10px; }
    .event-lifecycle-facts span { display:block; font-size:.8rem; opacity:.75; }
    .event-lifecycle-athlete { display:flex; justify-content:space-between; gap:12px; align-items:center; }
    .event-profile-actions { margin-top:12px; padding-top:12px; border-top:1px solid rgba(127,127,127,.25); }
    @media (max-width:900px) {
      .event-lifecycle-controls,.event-lifecycle-grid,.event-lifecycle-facts { grid-template-columns:1fr; }
    }
  `;
  document.head.append(style);
}

function ensureEventSurface() {
  const list = document.getElementById("eventList");
  if (!list || document.getElementById("eventLifecycleControls")) return;

  const controls = document.createElement("div");
  controls.id = "eventLifecycleControls";
  controls.className = "event-lifecycle-controls";
  controls.setAttribute("aria-label", "Event library filters");
  controls.innerHTML = `
    <label class="field"><span>Search events</span><input id="eventLifecycleSearch" type="search" autocomplete="off" placeholder="Name, type or location" /></label>
    <label class="field"><span>State</span><select id="eventLifecycleStatusFilter"><option value="all">All states</option><option value="active">Scheduled</option><option value="cancelled">Cancelled</option><option value="archived">Archived</option></select></label>
    <label class="field"><span>Activity</span><select id="eventLifecycleActivityFilter"><option value="all">All activities</option><option value="powerlifting">Powerlifting</option><option value="general_strength">General strength</option><option value="rugby_union">Rugby union</option></select></label>
    <label class="field"><span>Date</span><select id="eventLifecycleDateFilter"><option value="all">All dates</option><option value="future">Current and future</option><option value="past">Past</option></select></label>
  `;

  const resultLine = document.createElement("div");
  resultLine.className = "event-lifecycle-result";
  resultLine.innerHTML = `
    <p id="eventLifecycleResultCount" class="muted small">0 events</p>
    <p id="eventLifecycleStatus" class="muted small" role="status"></p>
  `;

  list.before(controls, resultLine);

  const detail = document.createElement("section");
  detail.id = "eventLifecycleDetail";
  detail.className = "panel event-lifecycle-detail";
  detail.hidden = true;
  list.closest("article.panel")?.after(detail);

  for (const id of [
    "eventLifecycleSearch",
    "eventLifecycleStatusFilter",
    "eventLifecycleActivityFilter",
    "eventLifecycleDateFilter"
  ]) {
    document.getElementById(id)?.addEventListener("input", () => {
      void loadEventLibrary();
    });
    document.getElementById(id)?.addEventListener("change", () => {
      void loadEventLibrary();
    });
  }

  list.addEventListener("click", (event) => {
    const button = event.target.closest("[data-open-event-id]");
    if (!button) return;
    const eventId = button.dataset.openEventId;
    if (!eventId) return;
    location.hash = `#/coach/events/${encodeURIComponent(eventId)}`;
    void loadEventDetail(eventId);
  });
}

function queryString() {
  const parameters = new URLSearchParams();
  const search = document.getElementById("eventLifecycleSearch")?.value ?? "";
  const status = document.getElementById("eventLifecycleStatusFilter")?.value ?? "all";
  const activity = document.getElementById("eventLifecycleActivityFilter")?.value ?? "all";
  const dateScope = document.getElementById("eventLifecycleDateFilter")?.value ?? "all";
  if (search.trim()) parameters.set("search", search.trim());
  if (status !== "all") parameters.set("status", status);
  if (activity !== "all") parameters.set("activity_id", activity);
  if (dateScope !== "all") parameters.set("date_scope", dateScope);
  return parameters.toString();
}

function renderEventLibrary(events) {
  const list = document.getElementById("eventList");
  const count = document.getElementById("eventLifecycleResultCount");
  if (!list || !count) return;

  count.textContent = `${events.length} event${events.length === 1 ? "" : "s"}`;
  list.innerHTML = events.length
    ? events.map((eventRecord) => {
        const plan = planFor(eventRecord);
        const linked = Number(eventRecord.linked_athlete_count ?? 0);
        return `
          <article class="record-card event-lifecycle-card">
            <div>
              <p class="eyebrow">${escapeHtml(titleCase(eventRecord.activity_id))}</p>
              <h3>${escapeHtml(plan.event_name || "Event")}</h3>
              <p>${escapeHtml(titleCase(plan.event_type))} · ${escapeHtml(formatDate(plan.event_date))}${plan.location ? ` · ${escapeHtml(plan.location)}` : ""}</p>
            </div>
            <div class="record-meta">
              <strong>${escapeHtml(countdown(plan.event_date))}</strong>
              <span class="badge neutral">${escapeHtml(titleCase(eventRecord.event_status))}</span>
              <span class="badge ${linked ? "active" : "neutral"}">${linked} athlete${linked === 1 ? "" : "s"}</span>
              <button class="button secondary small-button" type="button" data-open-event-id="${escapeHtml(eventRecord.event_id)}">Open event</button>
            </div>
          </article>
        `;
      }).join("")
    : `<div class="empty-state"><div class="empty-icon">E</div><h3>No matching events</h3><p>Change the event filters or create an event.</p></div>`;
}

async function loadEventLibrary() {
  ensureEventSurface();
  try {
    setStatus("Loading event library…");
    const suffix = queryString();
    const payload = await api("GET", `/events/library${suffix ? `?${suffix}` : ""}`);
    renderEventLibrary(Array.isArray(payload.events) ? payload.events : []);
    setStatus("Event library loaded.");

    const eventId = selectedEventIdFromHash();
    if (eventId) await loadEventDetail(eventId);
  }
  catch (error) {
    setStatus(error.message, true);
  }
}

function eventFormValues(form) {
  const data = new FormData(form);
  return {
    event_name: String(data.get("event_name") ?? "").trim(),
    activity_id: String(data.get("activity_id") ?? "").trim(),
    event_type: String(data.get("event_type") ?? "").trim(),
    programme_start_date: String(data.get("programme_start_date") ?? "").trim(),
    event_date: String(data.get("event_date") ?? "").trim(),
    location: String(data.get("location") ?? "").trim(),
    timezone: String(data.get("timezone") ?? "Europe/London").trim(),
    notes: String(data.get("notes") ?? "").trim()
  };
}

function detailEditForm(eventRecord) {
  const plan = planFor(eventRecord);
  return `
    <form id="eventLifecycleVersionForm" class="form-panel">
      <p class="eyebrow">New immutable version</p>
      <label class="field"><span>Event name</span><input name="event_name" value="${escapeHtml(plan.event_name)}" required maxlength="120" /></label>
      <label class="field"><span>Activity</span><select name="activity_id"><option value="powerlifting" ${eventRecord.activity_id === "powerlifting" ? "selected" : ""}>Powerlifting</option><option value="general_strength" ${eventRecord.activity_id === "general_strength" ? "selected" : ""}>General strength</option><option value="rugby_union" ${eventRecord.activity_id === "rugby_union" ? "selected" : ""}>Rugby union</option></select></label>
      <label class="field"><span>Event type</span><input name="event_type" value="${escapeHtml(plan.event_type)}" required /></label>
      <div class="profile-settings-grid"><label class="field"><span>Preparation start date</span><input name="programme_start_date" type="date" value="${escapeHtml(plan.programme_start_date)}" required /></label><label class="field"><span>Event date</span><input name="event_date" type="date" value="${escapeHtml(plan.event_date)}" required /></label></div>
      <label class="field"><span>Location</span><input name="location" value="${escapeHtml(plan.location)}" maxlength="200" /></label>
      <label class="field"><span>Timezone</span><input name="timezone" value="${escapeHtml(plan.timezone || "Europe/London")}" maxlength="80" /></label>
      <label class="field"><span>Notes</span><textarea name="notes" maxlength="1000">${escapeHtml(plan.notes)}</textarea></label>
      <button class="button primary" type="submit">Create new version</button>
    </form>
  `;
}

function linkForm(detail) {
  const state = readState();
  const linked = new Set((detail.linked_athletes ?? []).map((item) => item.athlete_user_id));
  const athletes = (state.coachAthletes ?? []).filter((athlete) => !linked.has(athlete.userId));
  const templates = (state.coachTemplates ?? []).filter(
    (template) => template.template_state === "active" && template.activity_id === detail.event.activity_id
  );

  return `
    <form id="eventLifecycleLinkForm" class="form-panel">
      <p class="eyebrow">Link athlete</p>
      <label class="field"><span>Athlete</span><select name="athlete_user_id" required>${athletes.length ? athletes.map((athlete) => `<option value="${escapeHtml(athlete.userId)}">${escapeHtml(athlete.displayName || athlete.userId)}</option>`).join("") : '<option value="">No unlinked athletes</option>'}</select></label>
      <label class="field"><span>Programme</span><select name="template_id"><option value="">No programme</option>${templates.map((template) => `<option value="${escapeHtml(template.template_id)}">${escapeHtml(template.template_name)} · v${Number(template.template_version ?? 1)}</option>`).join("")}</select></label>
      <button class="button primary" type="submit" ${athletes.length ? "" : "disabled"}>Link athlete</button>
    </form>
  `;
}

function renderEventDetail(detail) {
  const panel = document.getElementById("eventLifecycleDetail");
  if (!panel) return;
  const eventRecord = detail.event ?? {};
  const plan = planFor(eventRecord);
  const active = eventRecord.event_status === "active";
  const linked = Array.isArray(detail.linked_athletes) ? detail.linked_athletes : [];

  panel.hidden = false;
  panel.innerHTML = `
    <div class="panel-header">
      <div><p class="eyebrow">Event detail</p><h3>${escapeHtml(plan.event_name || "Event")}</h3><p class="muted">Stable route · ${escapeHtml(detail.event_id)}</p></div>
      <button id="eventLifecycleCloseDetail" class="button secondary" type="button">Close detail</button>
    </div>
    <div class="event-lifecycle-facts">
      <div><span>State</span><strong>${escapeHtml(titleCase(eventRecord.event_status))}</strong></div>
      <div><span>Version</span><strong>${Number(eventRecord.event_version ?? 1)}</strong></div>
      <div><span>Countdown</span><strong>${escapeHtml(countdown(plan.event_date))}</strong></div>
      <div><span>Date</span><strong>${escapeHtml(formatDate(plan.event_date))}</strong></div>
      <div><span>Activity</span><strong>${escapeHtml(titleCase(eventRecord.activity_id))}</strong></div>
      <div><span>Type</span><strong>${escapeHtml(titleCase(plan.event_type))}</strong></div>
      <div><span>Location</span><strong>${escapeHtml(plan.location || "Not recorded")}</strong></div>
      <div><span>Timezone</span><strong>${escapeHtml(plan.timezone || "Not recorded")}</strong></div>
      <div><span>Lifecycle records</span><strong>${Number(detail.lifecycle_records?.length ?? 0)}</strong></div>
    </div>
    <p>${escapeHtml(plan.notes || "No event notes recorded.")}</p>
    <div class="event-lifecycle-actions">
      ${active ? '<button id="eventLifecycleCancel" class="button secondary" type="button">Cancel event</button>' : ""}
      ${eventRecord.event_status !== "archived" ? '<button id="eventLifecycleArchive" class="button secondary" type="button">Archive event</button>' : ""}
    </div>
    <div class="event-lifecycle-grid">
      <article>
        <p class="eyebrow">Linked athletes</p>
        <div id="eventLifecycleAthletes" class="record-list">
          ${linked.length ? linked.map((item) => `
            <article class="record-card event-lifecycle-athlete">
              <div><h4>${escapeHtml(item.display_name || item.athlete_user_id)}</h4><p>${escapeHtml(item.linked_programme?.template_name || "No linked programme")}</p></div>
              <button class="button secondary small-button" type="button" data-unlink-athlete-id="${escapeHtml(item.athlete_user_id)}">Unlink</button>
            </article>
          `).join("") : '<div class="empty-state compact-empty"><p>No athletes are currently linked.</p></div>'}
        </div>
        ${active ? linkForm(detail) : ""}
      </article>
      <article>
        ${active ? detailEditForm(eventRecord) : '<div class="empty-state compact-empty"><p>This event no longer accepts factual edits.</p></div>'}
      </article>
    </div>
    <details><summary>Historical preservation</summary><p>${Number(detail.historical_preservation?.event_versions_retained ?? 0)} event records · ${Number(detail.historical_preservation?.link_records_retained ?? 0)} link records · ${Number(detail.historical_preservation?.assignment_records_retained ?? 0)} assignment records · ${Number(detail.historical_preservation?.session_records_retained ?? 0)} session records.</p></details>
  `;

  document.getElementById("eventLifecycleCloseDetail")?.addEventListener("click", () => {
    panel.hidden = true;
    location.hash = "#/coach/events";
  });

  document.getElementById("eventLifecycleVersionForm")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      setStatus("Creating event version…");
      await api("POST", `/events/${encodeURIComponent(detail.event_id)}/version`, {
        ...eventFormValues(event.currentTarget),
        expected_current_record_sha256: eventRecord.record_sha256
      });
      await loadEventLibrary();
      setStatus("New event version created.");
    }
    catch (error) {
      setStatus(error.message, true);
    }
  });

  document.getElementById("eventLifecycleLinkForm")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const athleteUserId = String(data.get("athlete_user_id") ?? "");
    try {
      setStatus("Linking athlete…");
      await api("POST", `/events/${encodeURIComponent(detail.event_id)}/athletes/${encodeURIComponent(athleteUserId)}/link`, {
        template_id: String(data.get("template_id") ?? ""),
        request_id: `event_link_${Date.now()}`
      });
      await loadEventLibrary();
      setStatus("Athlete linked.");
    }
    catch (error) {
      setStatus(error.message, true);
    }
  });

  panel.querySelectorAll("[data-unlink-athlete-id]").forEach((button) => {
    button.addEventListener("click", async () => {
      try {
        setStatus("Unlinking athlete…");
        await api("POST", `/events/${encodeURIComponent(detail.event_id)}/athletes/${encodeURIComponent(button.dataset.unlinkAthleteId)}/unlink`, {});
        await loadEventLibrary();
        setStatus("Athlete unlinked. Historical records retained.");
      }
      catch (error) {
        setStatus(error.message, true);
      }
    });
  });

  document.getElementById("eventLifecycleCancel")?.addEventListener("click", async () => {
    if (!confirm(`Cancel ${plan.event_name || "this event"}?`)) return;
    try {
      await api("POST", `/events/${encodeURIComponent(detail.event_id)}/cancel`, {
        expected_current_record_sha256: eventRecord.record_sha256
      });
      await loadEventLibrary();
      setStatus("Event cancelled.");
    }
    catch (error) {
      setStatus(error.message, true);
    }
  });

  document.getElementById("eventLifecycleArchive")?.addEventListener("click", async () => {
    if (!confirm(`Archive ${plan.event_name || "this event"}?`)) return;
    try {
      await api("POST", `/events/${encodeURIComponent(detail.event_id)}/archive`, {
        expected_current_record_sha256: eventRecord.record_sha256
      });
      await loadEventLibrary();
      setStatus("Event archived.");
    }
    catch (error) {
      setStatus(error.message, true);
    }
  });

  panel.scrollIntoView({ behavior: "smooth", block: "start" });
}

async function loadEventDetail(eventId) {
  if (!eventId) return;
  try {
    setStatus("Loading event detail…");
    const payload = await api("GET", `/events/${encodeURIComponent(eventId)}`);
    renderEventDetail(payload.detail ?? {});
    setStatus("Event detail loaded.");
  }
  catch (error) {
    const panel = document.getElementById("eventLifecycleDetail");
    if (panel) panel.hidden = true;
    setStatus(error.message, true);
  }
}

function secureCreateForm() {
  const form = document.getElementById("eventForm");
  if (!form || form.dataset.fullUi09cBound === "true") return;
  form.dataset.fullUi09cBound = "true";
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    event.stopImmediatePropagation();
    try {
      setStatus("Creating event…");
      const payload = await api("POST", "/events/create", {
        event_id: "",
        event_name: document.getElementById("eventName")?.value.trim() ?? "",
        activity_id: document.getElementById("eventActivity")?.value ?? "",
        event_type: document.getElementById("eventType")?.value ?? "",
        programme_start_date: document.getElementById("eventProgrammeStartDate")?.value ?? "",
        event_date: document.getElementById("eventDate")?.value ?? "",
        location: document.getElementById("eventLocation")?.value.trim() ?? "",
        timezone: document.getElementById("eventTimezone")?.value.trim() || "Europe/London",
        notes: document.getElementById("eventNotes")?.value.trim() ?? ""
      });
      form.reset();
      document.getElementById("eventTimezone").value = "Europe/London";
      await loadEventLibrary();
      const eventId = payload.event?.event_id;
      if (eventId) location.hash = `#/coach/events/${encodeURIComponent(eventId)}`;
      setStatus("Event created.");
    }
    catch (error) {
      setStatus(error.message, true);
    }
  }, true);
}

function enhanceAthleteProfile() {
  const container = document.getElementById("athleteEventLinks");
  if (!container || container.dataset.fullUi09cBound === "true") return;
  container.dataset.fullUi09cBound = "true";

  container.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-profile-unlink-event-id]");
    if (!button) return;
    const athleteUserId = readState().selectedCoachAthleteId;
    if (!athleteUserId) return;
    try {
      await api("POST", `/events/${encodeURIComponent(button.dataset.profileUnlinkEventId)}/athletes/${encodeURIComponent(athleteUserId)}/unlink`, {});
      await loadEventLibrary();
      setStatus("Athlete unlinked from event. Historical records retained.");
    }
    catch (error) {
      setStatus(error.message, true);
    }
  });

  const observer = new MutationObserver(() => {
    container.querySelectorAll(".athlete-event-link-card").forEach((card) => {
      if (card.querySelector("[data-profile-unlink-event-id]")) return;
      const state = readState();
      const athleteUserId = state.selectedCoachAthleteId;
      const links = state.athleteEventLinks?.[athleteUserId] ?? [];
      const heading = card.querySelector("h3")?.textContent ?? "";
      const link = links.find((item) => planFor(item.event).event_name === heading);
      if (!link?.event_id) return;
      const button = document.createElement("button");
      button.type = "button";
      button.className = "button secondary small-button";
      button.dataset.profileUnlinkEventId = link.event_id;
      button.textContent = "Unlink event";
      card.querySelector(".record-meta")?.append(button);
    });
  });
  observer.observe(container, { childList: true, subtree: true });
}

function initialise() {
  ensureStyles();
  ensureEventSurface();
  secureCreateForm();
  enhanceAthleteProfile();

  document.getElementById("refreshEventsButton")?.addEventListener("click", () => {
    void loadEventLibrary();
  }, true);

  window.addEventListener("hashchange", () => {
    const eventId = selectedEventIdFromHash();
    if (eventId) void loadEventDetail(eventId);
  });

  const observer = new MutationObserver(() => {
    ensureEventSurface();
    secureCreateForm();
    enhanceAthleteProfile();
  });
  observer.observe(document.body, { childList: true, subtree: true });

  if (readState().role === "coach") {
    void loadEventLibrary();
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initialise, { once: true });
}
else {
  initialise();
}
