import { serializeProductRoute } from "../route_bootstrap.js";
import { loadPersistentAccountDetail } from "./account.js";
import { coachPart } from "./coachPart.js";
import { elements } from "./elements.js";
import { initials, roleLabel } from "./format.js";
import { handleError } from "./notices.js";
import { loadAthleteToday, loadSessionState, refreshHistory } from "./sessions.js";
import { saveState, state } from "./state.js";

// FULL-UI-22 cross-product quality: unsaved-change protection, extended
// beyond the programme builder (its own longer-standing draft/dirty
// tracking is unchanged) to the coach note form. A simple, non-persisted
// dirty flag is enough here - unlike a programme draft, a half-written
// note isn't meant to survive a reload, only to warn against an
// accidental departure that would silently discard it. The coach note
// form itself moved to React (CoachReviewPanel.tsx) - it dispatches
// kolosseum:coach-note-dirty-changed to keep this flag in sync, since
// setView()'s navigation guard below and the beforeunload guard both stay
// legacy concerns.
export let coachNoteDirty = false;

document.addEventListener("kolosseum:coach-note-dirty-changed", (event) => {
  coachNoteDirty = Boolean(event.detail?.dirty);
});

function confirmCoachNoteDeparture() {
  if (!coachNoteDirty) return true;
  return globalThis.confirm(
    "This note has unsaved changes. Leave without saving?"
  );
}

export function actorHomeView(actorType) {
  return actorType === "coach"
    ? "coach-overview"
    : "today";
}

function viewTitle(view) {
  const titles = {
    today: "Today",
    session: "Session",
    history: "History",
    programme: "My programme",
    "coach-onboarding": "Coach setup",
    attendance: "Attendance",
    "coach-attendance": "Classes",
    "coach-progress": "Analysis",
    "coach-overview": "Overview",
    athletes: "Athletes",
    events: "Competitions",
    templates: "Programmes",
    marketplace: "Marketplace",
    review: "Review",
    account: "Account",
    calculator: "Barbell calculator"
  };

  return titles[view] ?? "Kolosseum";
}

// A new screen: the page's title says which, and focus moves to its heading so
// a keyboard or screen reader carries on from there rather than from the menu.
// Never on the first screen, and never out of something being typed in.
let announcedView = null;
function announceView(view) {
  document.title = viewTitle(view) === "Kolosseum" ? "Kolosseum" : `${viewTitle(view)} - Kolosseum`;
  const first = announcedView === null;
  const same = announcedView === view;
  announcedView = view;
  if (first || same || elements.appShell?.hidden) return;
  if (/^(INPUT|SELECT|TEXTAREA)$/u.test(document.activeElement?.tagName ?? "")) return;
  elements.topbarTitle.focus({ preventScroll: true });
}

export function setView(view) {
  if (!confirmCoachNoteDeparture()) {
    document.dispatchEvent(new CustomEvent("kolosseum:view-kept"));
    return false;
  }

  if (view !== "templates" && coachPart()?.leaveTemplateBuilder() === false) {
    document.dispatchEvent(new CustomEvent("kolosseum:view-kept"));
    return false;
  }

  state.view = view;
  saveState();

  for (const section of document.querySelectorAll(".view")) {
    section.hidden = section.id !== `view-${view}`;
  }

  for (const button of document.querySelectorAll(".nav-item, .tab-item[data-view]")) {
    button.classList.toggle("active", button.dataset.view === view);
    if (button.dataset.view === view) button.setAttribute("aria-current", "page");
    else button.removeAttribute("aria-current");
  }

  elements.topbarTitle.textContent = viewTitle(view);
  setNavigationDrawerOpen(false);
  announceView(view);
  // This screen's panels mount now, before anything below talks to them.
  document.dispatchEvent(new CustomEvent("kolosseum:view-shown", { detail: { view } }));

  if (view === "today" && state.role === "athlete") {
    loadAthleteToday().catch(handleError);
  }

  if (view === "history" && state.role === "athlete") {
    refreshHistory({ quiet: true }).catch(handleError);
  }

  if (view === "session" && state.role === "athlete" && state.activeSessionId) {
    loadSessionState().catch(handleError);
  }

  coachPart()?.coachViewShown(view);

  if (view === "account") {
    loadPersistentAccountDetail({
      quiet: true
    }).catch(handleError);
  }
}

export function renderRoleNavigation() {
  const athlete = state.role === "athlete";

  for (const item of document.querySelectorAll(".athlete-nav")) item.hidden = !athlete;
  for (const item of document.querySelectorAll(".coach-nav")) item.hidden = athlete;

  elements.workspaceLabel.textContent = athlete ? "Athlete workspace" : "Coach workspace";
  elements.topbarEyebrow.textContent = athlete ? "Athlete workspace" : "Coach workspace";
  elements.sidebarRole.textContent = roleLabel();

  const fallbackView = actorHomeView(state.role);
  const permittedViews = athlete
    ? new Set(["today", "session", "history", "account", "calculator"])
    : new Set(["coach-onboarding", "coach-overview", "athletes", "events", "templates", "review", "account", "calculator"]);

  if (!permittedViews.has(state.view)) state.view = fallbackView;
}

export function renderIdentity() {
  const name = state.profile?.displayName ?? "Kolosseum user";
  const avatar = initials(name);

  elements.sidebarName.textContent = name;
  elements.sidebarAvatar.textContent = avatar;
  elements.topbarAccount.textContent = avatar;
  elements.todayGreeting.textContent = `Welcome, ${name.split(/\s+/u)[0]}`;
  elements.coachGreeting.textContent = `Welcome, ${/^coach\s/iu.test(name) ? name : name.split(/\s+/u)[0]}`;
}

// DEV NOTE: FULL-UI-02 profile_update/email_verification/password_change/
// sign_out/account_close_request migrated to React (public/app-src/
// screens/account/) - see the kolosseum:account-identity-updated and
// kolosseum:account-session-ended listeners below for how this legacy
// module stays in sync with React-driven identity updates and session
// endings.

// DEV NOTE: FULL-UI-19 data rights export/deletion moved to React
// (AccountDataRightsPanel.tsx into #account-data-rights-root, see
// useAccountDataRights.ts) - it independently fetches export/deletion
// status on mount and calls /account/data-rights/* directly. No bridges
// remain here.

// The first screen has just been read from the server, so it's reachable; the
// browser says when that changes.
export function showConnection(online) {
  elements.connectionStatus.textContent = online ? "Connected" : "Offline";
  elements.connectionStatus.classList.toggle("offline", !online);
}
window.addEventListener("online", () => showConnection(true));
window.addEventListener("offline", () => showConnection(false));

for (const button of document.querySelectorAll("[data-view]")) {
  button.addEventListener("click", () => {
    // The Athletes menu item always means the roster: an athlete profile left
    // open earlier takes over the page now, so close it first.
    if (button.dataset.view === "athletes" && state.selectedCoachAthleteId) coachPart()?.closeAthleteProfile();
    setView(button.dataset.view);
  });
}

for (const button of document.querySelectorAll("[data-view-link]")) {
  button.addEventListener("click", () => setView(button.dataset.viewLink));
}

// DEV NOTE: FULL-UI-20 platform status + error reporting moved to React
// (AccountSupportPanel.tsx into #account-support-root, see
// useAccountSupport.ts) - it independently fetches GET /health and
// GET /account/support/reports on mount, and POSTs new reports to
// /account/support/reports. Two small bridges remain here:
// - the global error-notice's "Report this problem" button (in
//   showNotice() below) dispatches kolosseum:open-support-report instead
//   of calling openSupportReportForm() directly, since a report can be
//   opened from any failed request anywhere in the app.
// - the React panel's "Return to a safe screen" button dispatches
//   kolosseum:recover-to-safe-screen, handled by the tiny listener below,
//   since only legacy knows state.role/setView().
document.addEventListener("kolosseum:recover-to-safe-screen", () => {
  setView(state.role === "coach" ? "coach-overview" : "today");
});

// DEV NOTE: FULL-UI-18 factual in-product notifications (bell + dropdown
// panel) moved to React - see
// public/app-src/screens/account/NotificationBellPanel.tsx/
// useNotifications.ts, mounted at #notification-bell-root. Opening a
// notification with a real target still needs
// serializeProductRoute()/the full PRODUCT_ROUTE_MAP, which stays here -
// React dispatches this one bridge event with the notification's raw
// deep_link instead of porting the routing table.
document.addEventListener("kolosseum:open-notification-target", (event) => {
  try {
    location.hash = serializeProductRoute(event.detail?.route_id, event.detail?.params ?? {});
  }
  catch {
    // The target is no longer resolvable (e.g. a stale/removed route) -
    // the notification's own "This item is no longer available" state
    // already communicates this; silently no-op here rather than
    // surfacing a confusing navigation error.
  }
});

// The sidebar is a drawer on phones and tablets: opened from the menu
// button or the tab bar's More, closed by choosing a screen, tapping
// outside it or pressing Escape.
const drawerMedia = window.matchMedia("(max-width: 900px)");
function setNavigationDrawerOpen(open, { focusMenu = false, returnFocus = false } = {}) {
  elements.sidebar.classList.toggle("open", open);
  document.body.classList.toggle("nav-drawer-open", open);
  const more = document.getElementById("tabMoreButton");
  more?.setAttribute("aria-expanded", String(open));
  // Closed on a phone the menu is only slid off screen: inert keeps it out of
  // the keyboard's and a screen reader's way, and open it's the only way on.
  elements.sidebar.inert = drawerMedia.matches && !open;
  for (const behind of document.querySelectorAll(".topbar, .views")) behind.inert = drawerMedia.matches && open;
  if (open && focusMenu) {
    const items = [...elements.sidebar.querySelectorAll(".nav-item")].filter((item) => item.offsetParent !== null);
    (items.find((item) => item.classList.contains("active")) ?? items[0])?.focus();
  }
  if (!open && returnFocus) more?.focus();
}
drawerMedia.addEventListener("change", () => setNavigationDrawerOpen(false));
document.addEventListener("kolosseum:close-menu", () => setNavigationDrawerOpen(false));
setNavigationDrawerOpen(false);

elements.menuButton.addEventListener("click", () => {
  setNavigationDrawerOpen(!elements.sidebar.classList.contains("open"), { focusMenu: true });
});
document.getElementById("tabMoreButton")?.addEventListener("click", () => {
  setNavigationDrawerOpen(!elements.sidebar.classList.contains("open"), { focusMenu: true });
});
document.getElementById("skipToContent")?.addEventListener("click", () => document.getElementById("mainContent")?.focus());
document.addEventListener("click", (event) => {
  if (!elements.sidebar.classList.contains("open")) return;
  const target = event.target;
  if (!(target instanceof Element)) return;
  if (target.closest("#sidebar, #menuButton, #tabMoreButton")) return;
  setNavigationDrawerOpen(false);
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && elements.sidebar.classList.contains("open")) setNavigationDrawerOpen(false, { returnFocus: true });
});

elements.topbarAccount.addEventListener("click", () => setView("account"));

document.addEventListener("kolosseum:continue-history-session", (event) => {
  const sessionId = event.detail?.session_id;
  if (!sessionId) return;
  state.activeSessionId = sessionId;
  state.activeSessionState = null;
  saveState();
  setView("session");
});
