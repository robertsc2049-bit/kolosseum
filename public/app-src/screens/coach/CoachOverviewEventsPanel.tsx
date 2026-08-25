import React, { useMemo } from "react";

import { type JsonRecord } from "../../api/transport";
import { formatDate } from "../../utils/format";
import { useCoachOverviewEvents } from "./useCoachOverviewEvents";

// DEV NOTE: part of FULL-UI-03's Coach Overview dashboard - ported from
// app.js's renderCoachDashboard() "Upcoming events" block. The metric
// counts, "Connected athletes"/"Action queue"/"Open sessions"/
// "Completed since review" panels and the dashboard status line all stay
// legacy for now - they need athlete strength-profile lookups and
// session-artefact/review-record data this slice doesn't otherwise touch,
// disproportionately more than this one self-contained list. Read-only:
// "Open event" reaches only into the still-legacy Events view via hash
// navigation, the same mechanism AthleteHistoryPanels.tsx's
// current-event/event-link cards use (not shared into a common utility -
// see this file's own copy below - to avoid touching that already-shipped
// and tested file for a three-line helper).

function eventPlanOf(eventRecord: JsonRecord): JsonRecord | null {
  return eventRecord.event_plan && typeof eventRecord.event_plan === "object"
    ? (eventRecord.event_plan as JsonRecord)
    : null;
}

function eventDateOf(eventRecord: JsonRecord): string {
  const plan = eventPlanOf(eventRecord);
  return String(plan?.event_date ?? eventRecord.event_date ?? "");
}

function eventNameOf(eventRecord: JsonRecord): string {
  const plan = eventPlanOf(eventRecord);
  return String(plan?.event_name ?? eventRecord.event_name ?? "Event");
}

function eventTypeOf(eventRecord: JsonRecord): string {
  const plan = eventPlanOf(eventRecord);
  return String(plan?.event_type ?? eventRecord.event_type ?? "event");
}

function eventIdOf(eventRecord: JsonRecord): string {
  return String(eventRecord.event_id ?? eventRecord.id ?? "");
}

function titleCase(value: unknown): string {
  return String(value ?? "")
    .replaceAll("_", " ")
    .replace(/\b\w/gu, (letter) => letter.toUpperCase());
}

function todayDateOnly(): string {
  return new Date().toISOString().slice(0, 10);
}

function dateOnlyEpochDay(value: unknown): number | null {
  const text = String(value ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(text)) return null;
  const parsed = Date.parse(`${text}T00:00:00.000Z`);
  return Number.isFinite(parsed) ? Math.floor(parsed / 86400000) : null;
}

function countdownLabel(eventDate: unknown, fromDate: string = todayDateOnly()): string {
  const from = dateOnlyEpochDay(fromDate);
  const to = dateOnlyEpochDay(eventDate);
  if (from === null || to === null) return "Set dates";
  const days = to - from;
  if (days < 0) return `${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"} ago`;
  if (days === 0) return "Today";
  const weeks = Math.floor(days / 7);
  const remainder = days % 7;
  return weeks > 0 ? `${weeks}w ${remainder}d` : `${days} day${days === 1 ? "" : "s"}`;
}

// DEV NOTE: click the legacy nav button before setting the hash, not
// after - clicking it also runs legacy's reverse-sync
// (syncRouteFromElement), which serializes the *entityless* route for
// the view being switched to and would otherwise clobber an
// event_id-bearing hash set beforehand.
function openEventDetail(eventId: string) {
  (document.querySelector('[data-view="events"]') as HTMLElement | null)?.click();
  if (eventId) location.hash = `#/coach/events/${encodeURIComponent(eventId)}`;
}

export function CoachOverviewEventsPanel() {
  const { loading, error, events } = useCoachOverviewEvents();

  const upcoming = useMemo(() => {
    const today = todayDateOnly();
    return events
      .filter((eventRecord) => {
        const eventDate = eventDateOf(eventRecord);
        return eventDate && eventDate >= today;
      })
      .sort((left, right) => eventDateOf(left).localeCompare(eventDateOf(right)))
      .slice(0, 8);
  }, [events]);

  if (loading && events.length === 0) {
    return <p className="muted small">Loading upcoming events…</p>;
  }

  if (error) {
    return <p role="status" className="muted small error">{error}</p>;
  }

  if (upcoming.length === 0) {
    return (
      <div className="empty-state dashboard-empty-state">
        <h4>No upcoming events</h4>
        <p>Create an event date anchor to display it on the coach dashboard.</p>
      </div>
    );
  }

  return (
    <>
      {upcoming.map((eventRecord, index) => {
        const eventId = eventIdOf(eventRecord);
        const eventDate = eventDateOf(eventRecord);
        return (
          <article className="record-card dashboard-record-card" key={eventId || index}>
            <div>
              <h4>{eventNameOf(eventRecord)}</h4>
              <p>
                {titleCase(eventTypeOf(eventRecord))} · {formatDate(eventDate)} · {countdownLabel(eventDate)}
              </p>
            </div>
            <div className="record-meta">
              <span className="badge neutral">{Number(eventRecord.linked_athlete_count ?? 0)} athlete links</span>
              <button className="button secondary small-button" type="button" onClick={() => openEventDetail(eventId)}>
                Open event
              </button>
            </div>
          </article>
        );
      })}
    </>
  );
}
