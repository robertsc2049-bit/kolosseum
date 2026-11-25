import assert from "node:assert/strict";
import test from "node:test";

import {
  PRODUCT_ROUTE_MAP,
  actorCanAccessRoute,
  fallbackRouteForActor,
  parseProductRoute,
  routeForView,
  serializeProductRoute
} from "../public/app/route_bootstrap.js";

test("FULL-UI-01 route map exposes current athlete and coach product views", () => {
  assert.ok(PRODUCT_ROUTE_MAP.some((route) => route.route_id === "athlete_today"));
  assert.ok(PRODUCT_ROUTE_MAP.some((route) => route.route_id === "coach_athlete_detail"));
  assert.ok(PRODUCT_ROUTE_MAP.some((route) => route.route_id === "coach_event_detail"));
  assert.ok(PRODUCT_ROUTE_MAP.some((route) => route.route_id === "coach_programme_detail"));
  assert.ok(PRODUCT_ROUTE_MAP.some((route) => route.route_id === "coach_review_athlete"));
  assert.ok(PRODUCT_ROUTE_MAP.some((route) => route.route_id === "coach_marketplace"));
});

// DEV NOTE: found via a post-migration audit sweep - the marketplace nav
// item/view was fully React-rendered but had no PRODUCT_ROUTE_MAP entry at
// all, so navigating there never produced a real #/coach/marketplace hash
// (routeForView() silently fell through to fallbackRouteForActor() instead,
// per the "else" branch this test's own file's coverage didn't previously
// reach) - unreachable via a bookmarked/typed/shared URL, and a refresh
// while on Marketplace would have silently redirected to Coach Overview.
test("FULL-UI-01 the marketplace is a real, actor-gated, bookmarkable route", () => {
  const hash = routeForView("coach", "marketplace");
  assert.equal(hash, "#/coach/marketplace");

  const route = parseProductRoute(hash);
  assert.equal(route?.route_id, "coach_marketplace");
  assert.equal(actorCanAccessRoute("coach", route), true);
  assert.equal(actorCanAccessRoute("athlete", route), false);
});

test("FULL-UI-01 entity routes serialize and parse deterministically", () => {
  const athleteHash = serializeProductRoute("coach_athlete_detail", {
    athlete_id: "athlete 01"
  });
  assert.equal(athleteHash, "#/coach/athletes/athlete%2001");
  assert.deepEqual(parseProductRoute(athleteHash)?.params, {
    athlete_id: "athlete 01"
  });

  const sessionHash = routeForView("athlete", "session", {
    session_id: "session-1"
  });
  assert.equal(sessionHash, "#/athlete/session/session-1");
});

test("FULL-UI-01 actor access is fail-closed", () => {
  const coachRoute = parseProductRoute("#/coach/events");
  assert.equal(actorCanAccessRoute("coach", coachRoute), true);
  assert.equal(actorCanAccessRoute("athlete", coachRoute), false);
  assert.equal(fallbackRouteForActor("coach"), "#/coach/overview");
  assert.equal(fallbackRouteForActor("athlete"), "#/athlete/today");
  assert.equal(parseProductRoute("#/unknown"), null);
});

test("what's open on a screen has an address of its own, and the screen's address is the one to go back to", () => {
  for (const [routeId, params, hash, view, actor] of [
    ["coach_programme_builder", { draft: "new" }, "#/coach/programmes/build/new", "templates", "coach"],
    ["coach_review_session", { session_id: "s1" }, "#/coach/review/session/s1", "review", "coach"],
    ["coach_progress_athlete", { athlete_id: "a1" }, "#/coach/progress/a1", "coach-progress", "coach"],
    ["athlete_session_open", {}, "#/athlete/session", "session", "athlete"],
    ["shared_calculator", {}, "#/calculator", "calculator", "athlete"]
  ]) {
    assert.equal(serializeProductRoute(routeId, params), hash);
    assert.equal(parseProductRoute(hash)?.route_id, routeId);
    assert.equal(actorCanAccessRoute(actor, parseProductRoute(hash)), true);
    if (Object.keys(params).length) assert.equal(parseProductRoute(routeForView(actor, view, {}))?.entity_key, null);
  }
  assert.equal(parseProductRoute("#/coach/programmes/some_template_v1")?.route_id, "coach_programme_detail");
  assert.equal(parseProductRoute("#/coach/review/athlete_1")?.route_id, "coach_review_athlete");
});
