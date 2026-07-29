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
  { route_id: "coach_overview", pattern: "#/coach/overview", view: "coach-overview", actors: ["coach"], entity_key: null },
  { route_id: "coach_athletes", pattern: "#/coach/athletes", view: "athletes", actors: ["coach"], entity_key: null },
  { route_id: "coach_athlete_detail", pattern: "#/coach/athletes/:athlete_id", view: "athletes", actors: ["coach"], entity_key: "athlete_id" },
  { route_id: "coach_events", pattern: "#/coach/events", view: "events", actors: ["coach"], entity_key: null },
  { route_id: "coach_event_detail", pattern: "#/coach/events/:event_id", view: "events", actors: ["coach"], entity_key: "event_id" },
  { route_id: "coach_programmes", pattern: "#/coach/programmes", view: "templates", actors: ["coach"], entity_key: null },
  { route_id: "coach_programme_detail", pattern: "#/coach/programmes/:template_id", view: "templates", actors: ["coach"], entity_key: "template_id" },
  { route_id: "coach_review", pattern: "#/coach/review", view: "review", actors: ["coach"], entity_key: null },
  { route_id: "coach_review_athlete", pattern: "#/coach/review/:athlete_id", view: "review", actors: ["coach"], entity_key: "athlete_id" },
  { route_id: "shared_account", pattern: "#/account", view: "account", actors: ["athlete", "coach"], entity_key: null }
]);

function segments(value) {
  return String(value ?? "")
    .replace(/^#/u, "")
    .replace(/^\/+/u, "")
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
    if (view === "athletes" && entity.athlete_id) {
      return serializeProductRoute("coach_athlete_detail", entity);
    }
    if (view === "athletes") return serializeProductRoute("coach_athletes");
    if (view === "events" && entity.event_id) {
      return serializeProductRoute("coach_event_detail", entity);
    }
    if (view === "events") return serializeProductRoute("coach_events");
    if (view === "templates" && entity.template_id) {
      return serializeProductRoute("coach_programme_detail", entity);
    }
    if (view === "templates") return serializeProductRoute("coach_programmes");
    if (view === "review" && entity.athlete_id) {
      return serializeProductRoute("coach_review_athlete", entity);
    }
    if (view === "review") return serializeProductRoute("coach_review");
  }
  else {
    if (view === "onboarding") return serializeProductRoute("athlete_onboarding");
    if (view === "session" && entity.session_id) {
      return serializeProductRoute("athlete_session", entity);
    }
    if (view === "history") return serializeProductRoute("athlete_history");
    if (view === "today") return serializeProductRoute("athlete_today");
  }

  if (view === "account") return serializeProductRoute("shared_account");
  return fallbackRouteForActor(actor);
}

function readRole() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
    return parsed?.role === "coach" ? "coach" : parsed?.role === "athlete" ? "athlete" : null;
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

  if (route.route_id === "coach_athlete_detail") {
    const selector = `.open-athlete-profile[data-athlete-id="${escapeSelector(params.athlete_id)}"]`;
    const button = await waitForSelector(selector);
    if (button) {
      button.click();
      return true;
    }
  }

  if (route.route_id === "athlete_session") {
    const selector = `[data-session-id="${escapeSelector(params.session_id)}"]`;
    const card = await waitForSelector(selector);
    if (card) {
      card.click();
      return true;
    }
  }

  if (route.route_id === "coach_event_detail") {
    const selector = `[data-event-id="${escapeSelector(params.event_id)}"]`;
    return markRouteTarget(await waitForSelector(selector));
  }

  if (route.route_id === "coach_programme_detail") {
    const selector = `[data-template-id="${escapeSelector(params.template_id)}"]`;
    const target = await waitForSelector(selector);
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

  if (route.route_id === "coach_review_athlete") {
    const select = await waitForSelector("#reviewAthlete");
    if (select) {
      select.value = params.athlete_id;
      select.dispatchEvent(new Event("change", { bubbles: true }));
      document.getElementById("loadReviewButton")?.click();
      return true;
    }
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
      const onboardingHash = serializeProductRoute("athlete_onboarding");
      history.replaceState({ kolosseum_route: onboardingHash }, "", onboardingHash);
      if (!options.silent) {
        showRouteNotice("Complete athlete onboarding before opening the training workspace.");
      }
      return parseProductRoute(onboardingHash);
    }

    return route;
  }
  catch {
    const onboardingHash = serializeProductRoute("athlete_onboarding");
    history.replaceState({ kolosseum_route: onboardingHash }, "", onboardingHash);
    return parseProductRoute(onboardingHash);
  }
}

async function resolvedCoachRoute(route, options) {
  installCoachOnboardingUi();

  if (route?.route_id === "shared_account") return route;

  try {
    const state = await resolveCoachOnboardingGate();

    if (!state) {
      const onboardingHash = serializeProductRoute("coach_onboarding");
      history.replaceState({ kolosseum_route: onboardingHash }, "", onboardingHash);
      return parseProductRoute(onboardingHash);
    }

    if (
      state.onboarding_status !== "completed" &&
      route?.route_id !== "coach_onboarding"
    ) {
      const onboardingHash = serializeProductRoute("coach_onboarding");
      history.replaceState({ kolosseum_route: onboardingHash }, "", onboardingHash);

      if (!options.silent) {
        showRouteNotice("Complete coach onboarding before opening the coach workspace.");
      }

      return parseProductRoute(onboardingHash);
    }

    return route;
  }
  catch {
    const onboardingHash = serializeProductRoute("coach_onboarding");
    history.replaceState({ kolosseum_route: onboardingHash }, "", onboardingHash);
    return parseProductRoute(onboardingHash);
  }
}

export async function applyCurrentProductRoute(options = {}) {
  const actor = readRole();
  if (!actor) return false;

  let route = parseProductRoute(location.hash);
  if (!route || !actorCanAccessRoute(actor, route)) {
    const fallback = fallbackRouteForActor(actor);
    history.replaceState({ kolosseum_route: fallback }, "", fallback);
    route = parseProductRoute(fallback);
    if (!options.silent) {
      showRouteNotice("That page is not available for this account. The workspace home page has been opened.");
    }
  }

  if (actor === "athlete") {
    route = await resolvedAthleteRoute(route, options);
  }
  else if (actor === "coach") {
    route = await resolvedCoachRoute(route, options);
  }

  applyingRoute = true;
  try {
    if (route.route_id === "athlete_onboarding") {
      await openAthleteOnboardingView();
    }
    else if (route.route_id === "coach_onboarding") {
      await openCoachOnboardingView();
    }
    else {
      const navigation = document.querySelector(`[data-view="${escapeSelector(route.view)}"]`);
      navigation?.click();
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

  const event = element.closest("[data-event-id]");
  if (event?.dataset.eventId) return { event_id: event.dataset.eventId };

  const template = element.closest("[data-template-id]");
  if (template?.dataset.templateId) return { template_id: template.dataset.templateId };

  const session = element.closest("[data-session-id]");
  if (session?.dataset.sessionId) return { session_id: session.dataset.sessionId };

  return {};
}

function syncRouteFromElement(element, replace = false) {
  const actor = readRole();
  if (!actor || applyingRoute) return;

  const entity = entityFromElement(element);
  const viewControl = element.closest("[data-view], [data-view-link]");
  const activeView = viewControl?.dataset.view ?? viewControl?.dataset.viewLink ?? (
    [...document.querySelectorAll(".view")].find((section) => !section.hidden)?.id.replace(/^view-/u, "")
  );

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
  document.addEventListener(
    "click",
    (event) => {
      const element = event.target.closest(
        "[data-view], [data-view-link], [data-athlete-id], [data-event-id], [data-template-id], [data-session-id]"
      );
      if (element) syncRouteFromElement(element);
    },
    true
  );

  document.getElementById("entryForm")?.addEventListener("submit", scheduleRouteApplication);

  addEventListener("hashchange", () => applyCurrentProductRoute());
  addEventListener("popstate", () => applyCurrentProductRoute());

  const observer = new MutationObserver(() => {
    const visible = [...document.querySelectorAll(".view")].find((section) => !section.hidden);
    if (visible) syncRouteFromElement(visible, true);
  });

  const views = document.querySelector(".views");
  if (views) {
    observer.observe(views, {
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
