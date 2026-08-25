import React, { useMemo } from "react";

import { type JsonRecord } from "../../api/transport";
import { countdownLabel, formatDate, titleCase } from "../../utils/format";
import { useCoachEventsLibrary } from "./useCoachEventsLibrary";

// DEV NOTE: the Events screen's event library (part of FULL-UI-12C) -
// ported from app.js's renderCoachEvents(). The create-event form
// (#eventForm, with its own live countdown/weeks preview,
// renderCoachEventPreview()) stays legacy - this slice is read-only. The
// three metric counts (Events/Upcoming/Athlete links) move here too,
// unlike prior slices that left counts legacy, since renderCoachEvents()
// was the ONLY function reading/writing them (confirmed via grep) - no
// other legacy code needed them left behind.
function eventPlanOf(eventRecord: JsonRecord): JsonRecord {
  return eventRecord.event_plan && typeof eventRecord.event_plan === "object"
    ? (eventRecord.event_plan as JsonRecord)
    : {};
}

function eventCompileOf(eventRecord: JsonRecord): JsonRecord {
  return eventRecord.event_compile_summary && typeof eventRecord.event_compile_summary === "object"
    ? (eventRecord.event_compile_summary as JsonRecord)
    : {};
}

function todayDateOnly(): string {
  return new Date().toISOString().slice(0, 10);
}

export function CoachEventsMetricCards() {
  const { events } = useCoachEventsLibrary();

  const { upcomingCount, linkedCount } = useMemo(() => {
    const today = todayDateOnly();
    const upcoming = events.filter((eventRecord) => {
      const eventDate = String(eventPlanOf(eventRecord).event_date ?? "");
      return eventDate && eventDate >= today;
    });
    const linked = events.reduce((total, eventRecord) => total + Number(eventRecord.linked_athlete_count ?? 0), 0);
    return { upcomingCount: upcoming.length, linkedCount: linked };
  }, [events]);

  return (
    <>
      <article className="panel metric-card">
        <span>Events</span>
        <strong>{events.length}</strong>
      </article>
      <article className="panel metric-card">
        <span>Upcoming</span>
        <strong>{upcomingCount}</strong>
      </article>
      <article className="panel metric-card">
        <span>Athlete links</span>
        <strong>{linkedCount}</strong>
      </article>
    </>
  );
}

export function CoachEventsListPanel() {
  const { loading, error, events } = useCoachEventsLibrary();

  if (loading && events.length === 0) {
    return <p className="muted small">Loading events…</p>;
  }

  if (error) {
    return <p role="status" className="muted small error">{error}</p>;
  }

  if (events.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-icon">E</div>
        <h3>No events compiled</h3>
        <p>Create an event date anchor, then link athletes and programmes from each athlete profile.</p>
      </div>
    );
  }

  return (
    <>
      {events.map((eventRecord, index) => {
        const plan = eventPlanOf(eventRecord);
        const compile = eventCompileOf(eventRecord);
        const linkedAthletes = Number(eventRecord.linked_athlete_count ?? 0);
        const eventId = String(eventRecord.event_id ?? "");

        return (
          <article className="record-card coach-event-card" data-event-id={eventId} key={eventId || index}>
            <div>
              <p className="eyebrow">{titleCase(eventRecord.activity_id ?? "event")}</p>
              <h3>{String(plan.event_name ?? "Event")}</h3>
              <p>
                {titleCase(plan.event_type ?? "event")} · {formatDate(plan.event_date)}
                {plan.location ? ` · ${String(plan.location)}` : ""}
                {plan.timezone ? ` · ${String(plan.timezone)}` : ""}
              </p>
              {plan.notes ? <p className="coach-event-notes">{String(plan.notes)}</p> : null}
            </div>
            <div className="record-meta coach-event-meta">
              <strong>{countdownLabel(plan.event_date)}</strong>
              <span className="badge neutral">{Number(compile.required_week_count ?? 0)} weeks</span>
              <span className={`badge ${linkedAthletes > 0 ? "active" : "neutral"}`}>
                {linkedAthletes} athlete{linkedAthletes === 1 ? "" : "s"}
              </span>
            </div>
          </article>
        );
      })}
    </>
  );
}
