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
  { route_id: "athlete_session_open", pattern: "#/athlete/session", view: "session", actors: ["athlete"], entity_key: null },
  { route_id: "athlete_history", pattern: "#/athlete/history", view: "history", actors: ["athlete"], entity_key: null },
  { route_id: "athlete_history_detail", pattern: "#/athlete/history/:session_id", view: "history", actors: ["athlete"], entity_key: "session_id" },
  { route_id: "athlete_programme", pattern: "#/athlete/programme", view: "programme", actors: ["athlete"], entity_key: null },
  { route_id: "athlete_attendance_events", pattern: "#/athlete/attendance", view: "attendance", actors: ["athlete"], entity_key: null },
  { route_id: "coach_overview", pattern: "#/coach/overview", view: "coach-overview", actors: ["coach"], entity_key: null },
  { route_id: "coach_athletes", pattern: "#/coach/athletes", view: "athletes", actors: ["coach"], entity_key: null },
  { route_id: "coach_athlete_detail", pattern: "#/coach/athletes/:athlete_id", view: "athletes", actors: ["coach"], entity_key: "athlete_id" },
  { route_id: "coach_events", pattern: "#/coach/events", view: "events", actors: ["coach"], entity_key: null },
  { route_id: "coach_event_detail", pattern: "#/coach/events/:event_id", view: "events", actors: ["coach"], entity_key: "event_id" },
  { route_id: "coach_programmes", pattern: "#/coach/programmes", view: "templates", actors: ["coach"], entity_key: null },
  { route_id: "coach_programme_detail", pattern: "#/coach/programmes/:template_id", view: "templates", actors: ["coach"], entity_key: "template_id" },
  { route_id: "coach_programme_builder", pattern: "#/coach/programmes/build/:draft", view: "templates", actors: ["coach"], entity_key: "draft" },
  { route_id: "coach_review", pattern: "#/coach/review", view: "review", actors: ["coach"], entity_key: null },
  { route_id: "coach_review_athlete", pattern: "#/coach/review/:athlete_id", view: "review", actors: ["coach"], entity_key: "athlete_id" },
  { route_id: "coach_review_session", pattern: "#/coach/review/session/:session_id", view: "review", actors: ["coach"], entity_key: "session_id" },
  { route_id: "coach_marketplace", pattern: "#/coach/marketplace", view: "marketplace", actors: ["coach"], entity_key: null },
  { route_id: "coach_progress_overview", pattern: "#/coach/progress", view: "coach-progress", actors: ["coach"], entity_key: null },
  { route_id: "coach_progress_athlete", pattern: "#/coach/progress/:athlete_id", view: "coach-progress", actors: ["coach"], entity_key: "athlete_id" },
  { route_id: "coach_attendance_events", pattern: "#/coach/attendance", view: "coach-attendance", actors: ["coach"], entity_key: null },
  { route_id: "shared_calculator", pattern: "#/calculator", view: "calculator", actors: ["athlete", "coach"], entity_key: null },
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
    if (view === "coach-progress" && entity.athlete_id) return serializeProductRoute("coach_progress_athlete", entity);
    if (view === "coach-progress") return serializeProductRoute("coach_progress_overview");
    if (view === "coach-attendance") return serializeProductRoute("coach_attendance_events");
  }
  else {
    if (view === "onboarding") return serializeProductRoute("athlete_onboarding");
    if (view === "session" && entity.session_id) return serializeProductRoute("athlete_session", entity);
    if (view === "session") return serializeProductRoute("athlete_session_open");
    if (view === "history" && entity.session_id) return serializeProductRoute("athlete_history_detail", entity);
    if (view === "history") return serializeProductRoute("athlete_history");
    if (view === "today") return serializeProductRoute("athlete_today");
    if (view === "attendance") return serializeProductRoute("athlete_attendance_events");
    if (view === "programme") return serializeProductRoute("athlete_programme");
  }

  if (view === "account") return serializeProductRoute("shared_account");
  if (view === "calculator") return serializeProductRoute("shared_calculator");
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

  if (route.route_id === "coach_programme_detail" && params.template_id) {
    document.dispatchEvent(new CustomEvent("kolosseum:open-programme-detail", { detail: { template_id: params.template_id } }));
    return true;
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

  if (route.route_id === "coach_programme_builder") {
    document.dispatchEvent(new CustomEvent("kolosseum:open-builder-route", { detail: { draft: params.draft } }));
    return true;
  }

  if (route.route_id === "coach_review_session") {
    document.dispatchEvent(new CustomEvent("kolosseum:open-review-session", { detail: { session_id: params.session_id } }));
    return true;
  }

  if (route.route_id === "coach_progress_athlete") {
    document.dispatchEvent(new CustomEvent("kolosseum:open-analysis-athlete", { detail: { athlete_user_id: params.athlete_id } }));
    return true;
  }

  return route.entity_key === null;
}

// Where the page was scrolled to when something was opened from it, so going
// back returns there.
const scrollPlaces = new Map();
function rememberScroll(hash) {
  scrollPlaces.set(hash, window.scrollY);
}
function returnToScroll(hash) {
  const top = scrollPlaces.get(hash);
  if (!top) return;
  scrollPlaces.delete(hash);
  // The list fills in as its records arrive; stop once it's tall enough.
  let tries = 0;
  const go = () => {
    window.scrollTo(0, top);
    tries += 1;
    if (Math.abs(window.scrollY - top) > 2 && tries < 12) setTimeout(go, 100);
  };
  requestAnimationFrame(go);
}

function pushRoute(hash) {
  rememberScroll(location.hash);
  history.pushState({ kolosseum_route: hash, opened_from: location.hash }, "", hash);
}

// What's open on a screen (an athlete's profile, a programme, a session) is a
// place of its own: opening it adds to the history, so Back closes it.
function placeOpened(routeId, params) {
  const hash = serializeProductRoute(routeId, params);
  if (!hash || hash === location.hash || !actorCanAccessRoute(readRole(), parseProductRoute(hash))) return;
  // The same kind of place (a new programme's first save): not another step.
  if (parseProductRoute(location.hash)?.route_id === routeId) {
    history.replaceState({ ...history.state, kolosseum_route: hash }, "", hash);
    return;
  }
  pushRoute(hash);
}

// Closed on the page: the step that opened it is taken back.
function placeClosed(routeId) {
  const current = parseProductRoute(location.hash);
  if (current?.route_id !== routeId) return;
  const bare = routeForView(readRole(), current.view, {});
  if (history.state?.opened_from === bare) history.back();
  else history.replaceState({ kolosseum_route: bare }, "", bare);
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

// DEV NOTE: one route change, one application. Changing location.hash fires
// both popstate and hashchange, and a sign-in re-applies the route three
// more times (scheduleRouteApplication) - each application clicked the
// view's nav button again, so setView() refetched the whole screen (and
// re-opened an athlete profile) two to four times per navigation
// (2026-11-22 walkthrough: GET /templates 24 times in a handful of
// screens). An application already running for the same hash is shared,
// and a silent re-application of the route last applied, whose view is
// already showing, has nothing left to do. A real navigation (not silent)
// always applies, so every screen change still loads fresh records.
let routeInFlight = null;
let lastAppliedHash = "";

function visibleViewName() {
  return [...document.querySelectorAll(".view")]
    .find((section) => !section.hidden)
    ?.id.replace(/^view-/u, "") ?? "";
}

export function applyCurrentProductRoute(options = {}) {
  const hash = location.hash;
  if (routeInFlight?.hash === hash) return routeInFlight.promise;
  if (options.silent && hash && hash === lastAppliedHash && parseProductRoute(hash)?.view === visibleViewName()) {
    return Promise.resolve(true);
  }

  const promise = applyProductRouteNow(options)
    .then((applied) => {
      if (applied) lastAppliedHash = location.hash;
      return applied;
    })
    .finally(() => {
      if (routeInFlight?.promise === promise) routeInFlight = null;
    });
  routeInFlight = { hash, promise };
  return promise;
}

async function applyProductRouteNow(options) {
  // Until the server has said who's signed in (the workspace is shown then,
  // which applies the route), the stored role may be another account's.
  if (document.getElementById("appShell")?.hidden) return false;
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

  // This role's screens, so what's opened below finds its panel listening.
  await globalThis.kolosseumWorkspaceReady?.(actor);

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
      // Going back to a screen closes what was open on it, unless they choose
      // to stay (the builder, with something unsaved).
      if (visibleViewName() === route.view && route.route_id !== "coach_programme_builder") {
        const closing = new CustomEvent("kolosseum:close-place", { detail: { view: route.view, opening: route.entity_key !== null }, cancelable: true });
        if (!document.dispatchEvent(closing)) {
          if (closing.detail.stay) history.pushState({ kolosseum_route: closing.detail.stay, opened_from: location.hash }, "", closing.detail.stay);
          return true;
        }
      }
      document.querySelector(`[data-view="${escapeSelector(route.view)}"]`)?.click();
      document.getElementById("sidebar")?.classList.remove("open");
    }

    if (options.returning) returnToScroll(location.hash);
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
  // Opening: the address says where to go, and hasn't been followed yet. The
  // screen shown meanwhile doesn't get to change it.
  if (replace && !lastAppliedHash) return;

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
  const currentRoute = parseProductRoute(location.hash);
  if (Object.keys(entity).length === 0) {
    if (currentRoute?.view === activeView && currentRoute.entity_key) {
      // The menu item of the screen you're on means the screen itself. (The
      // builder stays: it has its own way out, which asks first.)
      if (!replace && viewControl && currentRoute.route_id !== "coach_programme_builder") {
        document.dispatchEvent(new CustomEvent("kolosseum:close-place", { detail: { view: activeView }, cancelable: true }));
        const bare = routeForView(actor, activeView, {});
        history.replaceState({ kolosseum_route: bare }, "", bare);
      }
      return;
    }
  }

  const hash = routeForView(actor, activeView, entity);
  if (!hash || hash === location.hash) return;
  // A button that moved to another screen is a step too.
  if (replace && currentRoute?.view === activeView) history.replaceState({ kolosseum_route: hash }, "", hash);
  else pushRoute(hash);
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

  // They chose to stay (something unsaved): the address goes back to this screen.
  document.addEventListener("kolosseum:view-kept", () => {
    const view = [...document.querySelectorAll(".view")].find((section) => !section.hidden)?.id.replace(/^view-/u, "");
    const hash = routeForView(readRole(), view, {});
    if (hash && hash !== location.hash) history.replaceState({ kolosseum_route: hash }, "", hash);
  });

  // DEV NOTE: FULL-UI-02D the entry form moved to React (EntryAuthPanel.tsx)
  // - a submit-triggered scheduleRouteApplication() here would need
  // rebinding on every re-render anyway. The #appShell hidden-attribute
  // MutationObserver below already covers the exact same moment (a
  // successful sign-in/register unhides the shell synchronously as part of
  // app.js's enterApplication()), so no replacement listener is needed.
  addEventListener("hashchange", () => applyCurrentProductRoute());
  addEventListener("popstate", () => applyCurrentProductRoute({ returning: true }));
  document.addEventListener("kolosseum:place-opened", (event) => placeOpened(event.detail?.route_id, event.detail?.params ?? {}));
  document.addEventListener("kolosseum:place-closed", (event) => placeClosed(event.detail?.route_id));

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
      // Signed out: the next sign-in applies its route afresh.
      if (appShell.hidden) lastAppliedHash = "";
      else scheduleRouteApplication();
    }).observe(appShell, { attributes: true, attributeFilter: ["hidden"] });
  }

  setTimeout(() => applyCurrentProductRoute({ silent: true }), 0);
}

if (typeof document !== "undefined" && typeof window !== "undefined") {
  installProductRouting();
}
