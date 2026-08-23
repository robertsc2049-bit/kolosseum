import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import {
  FullUi09cEventLifecycleError,
  filterStandaloneEventLibrary,
  validateStandaloneEventDates
} from "../dist/src/api/full_ui_09c_event_lifecycle_service.js";

function eventRecord({
  eventId,
  name,
  activityId,
  status,
  eventDate,
  location = ""
}) {
  return {
    event_id: eventId,
    event_status: status,
    activity_id: activityId,
    event_plan: {
      event_name: name,
      event_type: "test_day",
      event_date: eventDate,
      location,
      timezone: "Europe/London"
    }
  };
}

test("FULL-UI-09C validates event dates against a server date", () => {
  const accepted = validateStandaloneEventDates({
    programme_start_date: "2026-08-01",
    event_date: "2026-09-01",
    current_date: "2026-07-30"
  });

  assert.equal(accepted.programme_start_date, "2026-08-01");
  assert.equal(accepted.event_date, "2026-09-01");

  assert.throws(
    () => validateStandaloneEventDates({
      programme_start_date: "2026-07-29",
      event_date: "2026-09-01",
      current_date: "2026-07-30"
    }),
    (error) =>
      error instanceof FullUi09cEventLifecycleError &&
      error.reason === "event_programme_start_date_in_past"
  );

  assert.throws(
    () => validateStandaloneEventDates({
      programme_start_date: "2026-09-01",
      event_date: "2026-09-01",
      current_date: "2026-07-30"
    }),
    (error) =>
      error instanceof FullUi09cEventLifecycleError &&
      error.reason === "event_date_order_invalid"
  );
});

test("FULL-UI-09C filters server event records and retains deterministic ordering", () => {
  const records = [
    eventRecord({
      eventId: "event_b",
      name: "Autumn Match",
      activityId: "rugby_union",
      status: "active",
      eventDate: "2026-09-10",
      location: "Mansfield"
    }),
    eventRecord({
      eventId: "event_a",
      name: "Autumn Meet",
      activityId: "powerlifting",
      status: "active",
      eventDate: "2026-09-10",
      location: "Nottingham"
    }),
    eventRecord({
      eventId: "event_old",
      name: "Spring Meet",
      activityId: "powerlifting",
      status: "archived",
      eventDate: "2026-03-10"
    })
  ];

  assert.deepEqual(
    filterStandaloneEventLibrary(records, {
      search: "autumn",
      status: "active",
      date_scope: "future",
      current_date: "2026-07-30"
    }).map((record) => record.event_id),
    ["event_a", "event_b"]
  );

  assert.deepEqual(
    filterStandaloneEventLibrary(records, {
      activity_id: "powerlifting",
      current_date: "2026-07-30"
    }).map((record) => record.event_id),
    ["event_old", "event_a"]
  );
});

test("FULL-UI-09C exposes authenticated detail and lifecycle actions", () => {
  const routes = fs.readFileSync(
    "src/api/coach_workspace.routes.ts",
    "utf8"
  );
  const handlers = fs.readFileSync(
    "src/api/full_ui_09c_event_lifecycle.handlers.ts",
    "utf8"
  );
  const sessionAuth = fs.readFileSync(
    "src/api/coach_session_auth.ts",
    "utf8"
  );
  const service = fs.readFileSync(
    "src/api/full_ui_09c_event_lifecycle_service.ts",
    "utf8"
  );

  for (const route of [
    '"/events/library"',
    '"/events/create"',
    '"/events/:event_id"',
    '"/events/:event_id/version"',
    '"/events/:event_id/cancel"',
    '"/events/:event_id/archive"',
    '"/events/:event_id/athletes/:athlete_id/link"',
    '"/events/:event_id/athletes/:athlete_id/unlink"'
  ]) {
    assert.match(routes, new RegExp(route.replaceAll("/", "\\/")));
  }

  // Every mutating and reading handler derives coach identity from the shared,
  // verified product-session boundary rather than a client-supplied id.
  assert.match(handlers, /authenticatedCoach/u);
  assert.match(sessionAuth, /resolveProductSession/u);
  assert.match(sessionAuth, /assertProductCsrf/u);
  assert.match(handlers, /coach_event_detail/u);

  assert.match(service, /event_version_created/u);
  assert.match(service, /event_cancelled/u);
  assert.match(service, /event_archived/u);
  assert.match(service, /cancellation_state/u);
  assert.match(service, /archive_state/u);
  assert.match(service, /immutable_event_history/u);
  assert.match(service, /immutable_link_history/u);
  assert.match(service, /creates_team_runtime: false/u);
  assert.match(service, /creates_roster_runtime: false/u);
  assert.match(service, /creates_organisation_runtime: false/u);
});

// assertNoDateConflict previously had exactly one caller
// (linkAthleteToStandaloneEvent) - re-versioning an event to a new date
// never re-checked it against athletes already linked to that same
// event, so a version could quietly create the exact same-date
// double-booking linking itself refuses to create.
test("FULL-UI-09C re-checks the same-date conflict rule when an event is re-versioned, for every athlete currently linked to it", () => {
  const service = fs.readFileSync(
    "src/api/full_ui_09c_event_lifecycle_service.ts",
    "utf8"
  );

  assert.match(service, /export async function assertNoDateConflict/u);
  assert.match(service, /export async function latestOwnedEvent/u);

  const versionFunctionBody = service.slice(
    service.indexOf("export async function createStandaloneEventVersion"),
    service.indexOf("export async function cancelStandaloneEvent")
  );
  assert.match(versionFunctionBody, /for \(const link of await currentLinksForEvent\(client, coachUserId, eventId\)\) \{/u);
  assert.match(versionFunctionBody, /await assertNoDateConflict\(client, coachUserId, linkedAthleteUserId, versionedEventForConflictCheck\);/u);
});
