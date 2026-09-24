import {
  installAthleteOnboardingUi,
  openAthleteOnboardingView,
  resolveAthleteOnboardingGate
} from "./athlete_onboarding_ui.js";

import {
  installCoachOnboardingUi,
  openCoachOnboardingView,
  resolveCoachOnboardingGate
} from "./coach_onboarding_ui.js";

const STORAGE_KEY = "kolosseum.product.app.v1";

export const PRODUCT_ROUTE_MAP = Object.freeze([
  { route_id: "athlete_onboarding", pattern: "#/athlete/onboarding", view: "onboarding", actors: ["athlete"], entity_key: null },
  { route_id: "coach_onboarding", pattern: "#/coach/onboarding", view: "coach-onboarding", actors: ["coach"], entity_key: null },
  { route_id: "athlete_today", pattern: "#/athlete/today", view: "today", actors: ["athlete"], entity_key: null },
  { route_id: "athlete_session", pattern: "#/athlete/session/:session_id", view: "session", actors: ["athlete"], entity_key: "session_id" },
  { route_id: "athlete_history", pattern: "#/athlete/history", view: "history", actors: ["athlete"], entity_key: null },
  { route_id: "athlete_history_detail", pattern: "#/athlete/history/:session_id", view: "history", actors: ["athlete"], entity_key: "session_id" },
  { route_id: "athlete_attendance_events", pattern: "#/athlete/attendance", view: "attendance", actors: ["athlete"], entity_key: null },
  { route_id: "coach_overview", pattern: "#/coach/overview", view: "coach-overview", actors: ["coach"], entity_key: null },
  { route_id: "coach_athletes", pattern: "#/coach/athletes", view: "athletes", actors: ["coach"], entity_key: null },
  { route_id: "coach_athlete_detail", pattern: "#/coach/athletes/:athlete_id", view: "athletes", actors: ["coach"], entity_key: "athlete_id" },
  { route_id: "coach_events", pattern: "#/coach/events", view: "events", actors: ["coach"], entity_key: null },
  { route_id: "coach_event_detail", pattern: "#/coach/events/:event_id", view: "events", actors: ["coach"], entity_key: "event_id" },
  { route_id: "coach_programmes", pattern: "#/coach/programmes", view: "templates", actors: ["coach"], entity_key: null },
  { route_id: "coach_programme_detail", pattern: "#/coach/programmes/:template_id", view: "templates", actors: ["coach"], entity_key: "template_id" },
  { route_id: "coach_review", pattern: "#/coach/review", view: "review", actors: ["coach"], entity_key: null },
  { route_id: "coach_review_athlete", pattern: "#/coach/review/:athlete_id", view: "review", actors: ["coach"], entity_key: "athlete_id" },
  { route_id: "coach_marketplace", pattern: "#/coach/marketplace", view: "marketplace", actors: ["coach"], entity_key: null },
  { route_id: "coach_progress_overview", pattern: "#/coach/progress", view: "coach-progress", actors: ["coach"], entity_key: null },
  { route_id: "coach_attendance_events", pattern: "#/coach/attendance", view: "coach-attendance", actors: ["coach"], entity_key: null },
  { route_id: "shared_account", pattern: "#/account", view: "account", actors: ["athlete", "coach"], entity_key: null }
]);

function segments(value) {
  return String(value ?? "")
    .replace(/^#/u, "")
    .replace(/^\/+?/u, "")
    .split("/")
    .filter(Boolean)
    .map((part) => decodeURIComponent(part));
}

function routeSegments(route) {
  return segments(route.pattern);
}

export function parseProductRoute(hash) {
  const candidate = segments(hash);

  for (const route of PRODUCT_ROUTE_MAP) {
    const pattern = routeSegments(route);
    if (candidate.length !== pattern.length) continue;

    const params = {};
    let matches = true;
    for (let index = 0; index < pattern.length; index += 1) {
      const expected = pattern[index];
      const actual = candidate[index];
      if (expected.startsWith(":")) {
        if (!actual) {
          matches = false;
          break;
        }
        params[expected.slice(1)] = actual;
      }
      else if (expected !== actual) {
        matches = false;
        break;
      }
    }
    if (matches) return { ...route, params };
  }

  return null;
}

export function serializeProductRoute(routeId, params = {}) {
  const route = PRODUCT_ROUTE_MAP.find((entry) => entry.route_id === routeId);
  if (!route) return null;

  const parts = routeSegments(route).map((part) => {
    if (!part.startsWith(":")) return part;
    const key = part.slice(1);
    const value = String(params[key] ?? "").trim();
    if (!value) throw new Error("PRODUCT_ROUTE_PARAMETER_REQUIRED:" + key);
    return encodeURIComponent(value);
  });

  return "#/" + parts.join("/");
}

export function actorCanAccessRoute(actor, route) {
  return Boolean(route && route.actors.includes(actor));
}

export function fallbackRouteForActor(actor) {
  return actor === "coach"
    ? serializeProductRoute("coach_overview")
    : serializeProductRoute("athlete_today");
}

export function routeForView(actor, view, entity = {}) {
  if (actor === "coach") {
    if (view === "coach-onboarding") return serializeProductRoute("coach_onboarding");
    if (view === "coach-overview") return serializeProductRoute("coach_overview");
    if (view === "athletes" && entity.athlete_id) return serializeProductRoute("coach_athlete_detail", entity);
    if (view === "athletes") return serializeProductRoute("coach_athletes");
    if (view === "events" && entity.event_id) return serializeProductRoute("coach_event_detail", entity);
    if (view === "events") return serializeProductRoute("coach_events");
    if (view === "templates" && entity.template_id) return serializeProductRoute("coach_programme_detail", entity);
    if (view === "templates") return serializeProductRoute("coach_programmes");
    if (view === "review" && entity.athlete_id) return serializeProductRoute("coach_review_athlete", entity);
    if (view === "review") return serializeProductRoute("coach_review");
    if (view === "marketplace") return serializeProductRoute("coach_marketplace");
    if (view === "coach-progress") return serializeProductRoute("coach_progress_overview");
    if (view === "coach-attendance") return serializeProductRoute("coach_attendance_events");
  }
  else {
    if (view === "onboarding") return serializeProductRoute("athlete_onboarding");
    if (view === "session" && entity.session_id) return serializeProductRoute("athlete_session", entity);
    if (view === "history" && entity.session_id) return serializeProductRoute("athlete_history_detail", entity);
    if (view === "history") return serializeProductRoute("athlete_history");
    if (view === "today") return serializeProductRoute("athlete_today");
    if (view === "attendance") return serializeProductRoute("athlete_attendance_events");
  }

  if (view === "account") return serializeProductRoute("shared_account");
  return fallbackRouteForActor(actor);
}

function readRole() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
    return parsed?.role === "coach"
      ? "coach"
      : parsed?.role === "athlete"
        ? "athlete"
        : null;
  }
  catch {
    return null;
  }
}

function escapeSelector(value) {
  if (globalThis.CSS?.escape) return globalThis.CSS.escape(String(value));
  return String(value).replace(/["\\]/gu, "\\$&");
}

function showRouteNotice(message) {
  const notice = document.getElementById("notice");
  if (!notice) return;
  notice.textContent = message;
  notice.className = "notice error";
  notice.hidden = false;
}

function markRouteTarget(element) {
  for (const current of document.querySelectorAll(".route-target")) {
    current.classList.remove("route-target");
  }
  if (!element) return false;
  element.classList.add("route-target");
  if (!element.hasAttribute("tabindex")) element.setAttribute("tabindex", "-1");
  element.scrollIntoView({ block: "center", behavior: "smooth" });
  element.focus({ preventScroll: true });
  return true;
}

function waitForSelector(selector, attempts = 30) {
  return new Promise((resolve) => {
    const find = (remaining) => {
      const element = document.querySelector(selector);
      if (element || remaining <= 0) {
        resolve(element);
        return;
      }
      setTimeout(() => find(remaining - 1), 100);
    };
    find(attempts);
  });
}

let applyingRoute = false;

async function applyEntityRoute(route) {
  const params = route.params ?? {};

  // DEV NOTE: React owns the athlete directory now
  // (AthleteDirectoryPanel.tsx) - its "Open profile" button dispatches
  // kolosseum:open-athlete-profile-request directly (app.js listens and
  // calls the still-legacy openAthleteProfile()) rather than rendering a
  // data-athlete-id attribute for a waitForSelector-based click
  // simulation to find - that attribute was never part of the React
  // port's markup, so this deep link was unreachable via a raw hash
  // (bookmark, shared link, or the notification bell's own "Open") until
  // fixed here, following the same pattern already used for
  // coach_event_detail below.
  if (route.route_id === "coach_athlete_detail" && params.athlete_id) {
    document.dispatchEvent(
      new CustomEvent("kolosseum:open-athlete-profile-request", { detail: { athlete_user_id: params.athlete_id } })
    );
    return true;
  }

  if (route.route_id === "athlete_session") {
    const card = await waitForSelector(
      `[data-session-id="${escapeSelector(params.session_id)}"]`
    );
    if (card) {
      card.click();
      return true;
    }
  }

  // DEV NOTE: React owns the event detail/lifecycle view now
  // (CoachEventDetailPanel.tsx/useCoachEventDetail.ts, mounted at
  // #coach-event-detail-root) - this deep link dispatches
  // kolosseum:open-event-detail the same way coach_review_athlete below
  // dispatches kolosseum:open-session-review, rather than the old
  // synchronous [data-event-id] card lookup (that card only ever
  // highlighted the row - it never opened anything, since no detail view
  // existed to open). The hook's own fetch validates event_id once it
  // resolves and dispatches kolosseum:coach-event-detail-not-found
  // (handled below) for a stale/invalid id.
  if (route.route_id === "coach_event_detail" && params.event_id) {
    document.dispatchEvent(
      new CustomEvent("kolosseum:open-event-detail", { detail: { event_id: params.event_id } })
    );
    return true;
  }

  if (route.route_id === "athlete_history_detail") {
    document.dispatchEvent(
      new CustomEvent("kolosseum:history-detail-route", {
        detail: { session_id: params.session_id }
      })
    );
    return true;
  }

  if (route.route_id === "coach_programme_detail") {
    const target = await waitForSelector(
      `[data-template-id="${escapeSelector(params.template_id)}"]`
    );
    if (target) {
      const detail = target.matches(".template-detail")
        ? target
        : target.querySelector(".template-detail");
      const edit = target.matches(".template-edit")
        ? target
        : target.querySelector(".template-edit");
      if (detail) detail.click();
      else if (edit) edit.click();
      else markRouteTarget(target.closest(".template-card") ?? target);
      return true;
    }
  }

  // DEV NOTE: React owns the review queue now (CoachReviewPanel.tsx/
  // useCoachReview.ts, mounted at #coach-review-root) - its athlete filter
  // listens for the same kolosseum:open-session-review event this file's
  // other coach-review entry points already dispatch, so this deep link
  // does the same rather than reaching into a now-removed #reviewAthlete
  // select. The hook's own athlete list loads asynchronously (unlike the
  // old select's synchronous options), so it validates athlete_id itself
  // once loaded and dispatches kolosseum:coach-review-athlete-not-found
  // (handled below) for a stale/invalid id, rather than this function
  // validating synchronously before returning.
  if (route.route_id === "coach_review_athlete" && params.athlete_id) {
    document.dispatchEvent(
      new CustomEvent("kolosseum:open-session-review", { detail: { athlete_user_id: params.athlete_id } })
    );
    return true;
  }

  return route.entity_key === null;
}

async function resolvedAthleteRoute(route, options) {
  installAthleteOnboardingUi();
  if (route?.route_id === "shared_account") return route;

  try {
    const state = await resolveAthleteOnboardingGate();
    if (!state) return route;
    if (state.onboarding_status !== "completed" && route?.route_id !== "athlete_onboarding") {
      const hash = serializeProductRoute("athlete_onboarding");
      history.replaceState({ kolosseum_route: hash }, "", hash);
      if (!options.silent) showRouteNotice("Complete athlete onboarding before opening the training workspace.");
      return parseProductRoute(hash);
    }
    return route;
  }
  catch {
    const hash = serializeProductRoute("athlete_onboarding");
    history.replaceState({ kolosseum_route: hash }, "", hash);
    return parseProductRoute(hash);
  }
}

async function resolvedCoachRoute(route, options) {
  installCoachOnboardingUi();
  if (route?.route_id === "shared_account") return route;

  try {
    const state = await resolveCoachOnboardingGate();
    if (!state || (state.onboarding_status !== "completed" && route?.route_id !== "coach_onboarding")) {
      const hash = serializeProductRoute("coach_onboarding");
      history.replaceState({ kolosseum_route: hash }, "", hash);
      if (!options.silent) showRouteNotice("Complete coach onboarding before opening the coach workspace.");
      return parseProductRoute(hash);
    }
    return route;
  }
  catch {
    const hash = serializeProductRoute("coach_onboarding");
    history.replaceState({ kolosseum_route: hash }, "", hash);
    return parseProductRoute(hash);
  }
}

export async function applyCurrentProductRoute(options = {}) {
  const actor = readRole();
  if (!actor) return false;

  // DEV NOTE: this guard against syncRouteFromElement's reverse sync
  // (see its own DEV NOTE below) must cover the ENTIRE route-resolution
  // window, not just the DOM-mutating part below - resolvedCoachRoute()/
  // resolvedAthleteRoute() await a real onboarding-gate fetch, and a
  // coincidental, unrelated re-render elsewhere in the app can land its
  // MutationObserver callback in that gap. Previously applyingRoute was
  // set true only after that await, so a stray sync landing in the gap
  // would see location.hash already updated to the new route but the
  // view not yet switched, and "helpfully" reset the hash back to
  // whatever view was still visible - silently downgrading a just-opened
  // entity-detail deep link (e.g. #/coach/events/:event_id) back to its
  // bare list route moments after it opened.
  applyingRoute = true;

  let route = parseProductRoute(location.hash);
  if (!route || !actorCanAccessRoute(actor, route)) {
    const hash = fallbackRouteForActor(actor);
    history.replaceState({ kolosseum_route: hash }, "", hash);
    route = parseProductRoute(hash);
    if (!options.silent) {
      showRouteNotice("That page is not available for this account. The workspace home page has been opened.");
    }
  }

  route = actor === "athlete"
    ? await resolvedAthleteRoute(route, options)
    : await resolvedCoachRoute(route, options);

  try {
    if (route.route_id === "athlete_onboarding") {
      await openAthleteOnboardingView();
    }
    else if (route.route_id === "coach_onboarding") {
      await openCoachOnboardingView();
    }
    else {
      document.querySelector(`[data-view="${escapeSelector(route.view)}"]`)?.click();
      document.getElementById("sidebar")?.classList.remove("open");
    }

    const entityApplied = await applyEntityRoute(route);
    if (!entityApplied && route.entity_key) {
      showRouteNotice("The requested record is not available in this workspace.");
    }

    document.dispatchEvent(
      new CustomEvent("kolosseum:route-change", {
        detail: {
          route_id: route.route_id,
          view: route.view,
          params: route.params
        }
      })
    );
    return true;
  }
  finally {
    setTimeout(() => {
      applyingRoute = false;
    }, 0);
  }
}

function entityFromElement(element) {
  const athlete = element.closest("[data-athlete-id]");
  if (athlete?.dataset.athleteId) return { athlete_id: athlete.dataset.athleteId };
  const event = element.closest("[data-event-id], [data-open-event-id]");
  if (event?.dataset.eventId) return { event_id: event.dataset.eventId };
  if (event?.dataset.openEventId) return { event_id: event.dataset.openEventId };
  const template = element.closest("[data-template-id]");
  if (template?.dataset.templateId) return { template_id: template.dataset.templateId };
  const historyDetail = element.closest("[data-history-detail-id]");
  if (historyDetail?.dataset.historyDetailId) return { session_id: historyDetail.dataset.historyDetailId };
  const session = element.closest("[data-session-id]");
  if (session?.dataset.sessionId) return { session_id: session.dataset.sessionId };
  return {};
}

function syncRouteFromElement(element, replace = false) {
  const actor = readRole();
  if (!actor || applyingRoute) return;

  const entity = entityFromElement(element);
  const viewControl = element.closest("[data-view], [data-view-link]");
  const activeView = viewControl?.dataset.view ?? viewControl?.dataset.viewLink ??
    [...document.querySelectorAll(".view")]
      .find((section) => !section.hidden)
      ?.id.replace(/^view-/u, "");

  // DEV NOTE: a mutation-triggered resync (the .views MutationObserver
  // below, or a click on some element with no [data-*-id] of its own)
  // reports no entity at all - entityFromElement() only ever walks UP the
  // ancestor chain from the element it's given, and neither a bare .view
  // section nor an unrelated button carries the open record's id. Without
  // this guard, that "no entity" result would downgrade an already-open
  // entity-detail route (e.g. #/coach/events/:event_id) back to its bare
  // list route the moment anything else in the view re-renders - which is
  // exactly what used to happen here: opening an event triggered
  // setView()'s own refreshCoachEvents(), whose list re-render fired this
  // observer and silently closed the event right back onto #/coach/events.
  if (Object.keys(entity).length === 0) {
    const currentRoute = parseProductRoute(location.hash);
    if (currentRoute?.view === activeView && currentRoute.entity_key) return;
  }

  const hash = routeForView(actor, activeView, entity);
  if (!hash || hash === location.hash) return;
  if (replace) history.replaceState({ kolosseum_route: hash }, "", hash);
  else history.pushState({ kolosseum_route: hash }, "", hash);
}

function scheduleRouteApplication() {
  for (const delay of [150, 600, 1500]) {
    setTimeout(() => applyCurrentProductRoute({ silent: true }), delay);
  }
}

function installProductRouting() {
  // DEV NOTE: see the coach_review_athlete branch in applyEntityRoute()
  // above - CoachReviewPanel's useCoachReview.ts dispatches this once it
  // has loaded its own athlete list and found the requested athlete_id is
  // not a real connected athlete, so the deep link reports the same
  // "record is not available" notice the removed #reviewAthlete
  // hasOption check used to report synchronously.
  document.addEventListener("kolosseum:coach-review-athlete-not-found", () => {
    showRouteNotice("The requested record is not available in this workspace.");
  });

  // DEV NOTE: see the coach_event_detail branch in applyEntityRoute() above
  // - useCoachEventDetail.ts dispatches this when its own GET
  // /coach-workspace/events/:event_id fetch resolves 404 for a stale/
  // invalid event_id, the same async-validation pattern used for
  // coach-review-athlete-not-found above.
  document.addEventListener("kolosseum:coach-event-detail-not-found", () => {
    showRouteNotice("The requested record is not available in this workspace.");
  });

  document.addEventListener(
    "click",
    (event) => {
      const element = event.target.closest(
        "[data-view], [data-view-link], [data-athlete-id], [data-event-id], [data-open-event-id], [data-template-id], [data-session-id], [data-history-detail-id]"
      );
      if (element) syncRouteFromElement(element);
    },
    true
  );

  // DEV NOTE: FULL-UI-02D the entry form moved to React (EntryAuthPanel.tsx)
  // - a submit-triggered scheduleRouteApplication() here would need
  // rebinding on every re-render anyway. The #appShell hidden-attribute
  // MutationObserver below already covers the exact same moment (a
  // successful sign-in/register unhides the shell synchronously as part of
  // app.js's enterApplication()), so no replacement listener is needed.
  addEventListener("hashchange", () => applyCurrentProductRoute());
  addEventListener("popstate", () => applyCurrentProductRoute());

  const views = document.querySelector(".views");
  if (views) {
    new MutationObserver(() => {
      const visible = [...document.querySelectorAll(".view")].find((section) => !section.hidden);
      if (visible) syncRouteFromElement(visible, true);
    }).observe(views, {
      subtree: true,
      attributes: true,
      attributeFilter: ["hidden"]
    });
  }

  const appShell = document.getElementById("appShell");
  if (appShell) {
    new MutationObserver(() => {
      if (!appShell.hidden) scheduleRouteApplication();
    }).observe(appShell, { attributes: true, attributeFilter: ["hidden"] });
  }

  setTimeout(() => applyCurrentProductRoute({ silent: true }), 0);
}

if (typeof document !== "undefined" && typeof window !== "undefined") {
  installProductRouting();
}
