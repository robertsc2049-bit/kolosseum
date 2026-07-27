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
