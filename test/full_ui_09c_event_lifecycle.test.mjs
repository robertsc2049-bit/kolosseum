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

  assert.match(handlers, /resolveProductSession/u);
  assert.match(handlers, /assertProductCsrf/u);
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
