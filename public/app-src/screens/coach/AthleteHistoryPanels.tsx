import React from "react";

import { type JsonRecord } from "../../api/transport";
import { formatDate } from "../../utils/format";
import { useAthleteHistory } from "./useAthleteHistory";

// DEV NOTE: current programme, current event, and the assignment/
// strength/bodyweight/event-link history lists from
// public/app.js's renderAthleteDetail() (part of FULL-UI-04B). Session
// history stays legacy for now - it carries its own bespoke pain/skip/
// substitution/RPE/split-return rendering (see
// test/full_ui_04b_coach_athlete_detail.test.mjs), disproportionately
// more complex than these five uniform list renders and better scoped as
// its own future slice. Note history is already React (see
// AthleteCoachNotesPanel.tsx); the metric-card counts
// (athleteDetailAssignmentCount etc.) and the overall panel hide/show and
// status line stay legacy-owned since they're shared with session/note
// counts that remain legacy data.

function EmptyState({ heading, detail }: { heading: string; detail: string }) {
  return (
    <div className="empty-state compact-empty">
      <h4>{heading}</h4>
      <p>{detail}</p>
    </div>
  );
}

function recordDate(record: JsonRecord): string {
  return String(
    record.updated_at_iso8601 ??
      record.requested_at_iso8601 ??
      record.created_at_iso8601 ??
      record.stored_effective_at ??
      record.updated_at ??
      record.created_at ??
      ""
  );
}

function titleCase(value: unknown): string {
  return String(value ?? "")
    .replaceAll("_", " ")
    .replace(/\b\w/gu, (letter) => letter.toUpperCase());
}

function findTemplate(templateId: unknown, templates: JsonRecord[]): JsonRecord | null {
  const id = String(templateId ?? "");
  return templates.find((template) => String(template.template_id ?? "") === id) ?? null;
}

function findEvent(eventId: unknown, events: JsonRecord[]): JsonRecord | null {
  const id = String(eventId ?? "");
  return events.find((eventRecord) => String(eventRecord.event_id ?? "") === id) ?? null;
}

function eventPlanOf(eventRecord: JsonRecord | null): JsonRecord | null {
  return eventRecord?.event_plan && typeof eventRecord.event_plan === "object"
    ? (eventRecord.event_plan as JsonRecord)
    : null;
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

function openProgramme(templateId: string) {
  if (templateId) location.hash = `#/coach/programmes/${encodeURIComponent(templateId)}`;
  (document.querySelector('[data-view="templates"]') as HTMLElement | null)?.click();
}

function openEvent(eventId: string) {
  if (eventId) location.hash = `#/coach/events/${encodeURIComponent(eventId)}`;
  (document.querySelector('[data-view="events"]') as HTMLElement | null)?.click();
}

function exerciseDisplayName(exerciseId: unknown, exercises: JsonRecord[]): string {
  const found = exercises.find((exercise) => exercise.exercise_id === exerciseId);
  return String(found?.display_name ?? titleCase(exerciseId));
}

function convertedStrengthValue(value: unknown, sourceUnit: string, displayUnit: string): number | null {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  if (sourceUnit === displayUnit) return Number(numeric.toFixed(3));
  const converted = sourceUnit === "kg" ? numeric * 2.2046226218487757 : numeric / 2.2046226218487757;
  return Number(converted.toFixed(3));
}

function strengthSourceLabel(sourceType: unknown): string {
  if (sourceType === "estimated_1rm") return "Estimated 1RM";
  if (sourceType === "training_max") return "Training max";
  return "Tested 1RM";
}

function formatStrengthReferenceSummary(benchmark: JsonRecord, displayUnit: unknown): string {
  const sourceValue = Number(benchmark.value ?? benchmark.source_value ?? 0);
  const sourceUnit = benchmark.unit === "lb" || benchmark.source_unit === "lb" ? "lb" : "kg";
  const targetUnit = displayUnit === "lb" ? "lb" : "kg";
  const converted = convertedStrengthValue(sourceValue, sourceUnit, targetUnit);
  const conversionText = sourceUnit === targetUnit ? "" : ` · ${converted} ${targetUnit}`;
  const sourceNote = String(benchmark.source_note ?? "").trim();

  return [
    strengthSourceLabel(benchmark.basis ?? benchmark.source_type),
    `${sourceValue} ${sourceUnit}${conversionText}`,
    `Effective ${String(benchmark.effective_date ?? "")}`,
    sourceNote ? `Source: ${sourceNote}` : ""
  ]
    .filter(Boolean)
    .join(" · ");
}

function historyArray(detail: JsonRecord | null, field: string): JsonRecord[] {
  return Array.isArray(detail?.[field]) ? (detail![field] as JsonRecord[]) : [];
}

export function AthleteCurrentProgrammeCard() {
  const { athleteUserId, loading, error, detail, templates } = useAthleteHistory();
  if (!athleteUserId) return null;
  if (error) return <p role="status" className="muted small error">{error}</p>;
  if (loading && !detail) return null;

  const currentAssignment =
    detail?.current_assignment && typeof detail.current_assignment === "object"
      ? (detail.current_assignment as JsonRecord)
      : null;

  if (!currentAssignment) {
    return <EmptyState heading="No programme assignment" detail="No persisted programme assignment exists for this athlete." />;
  }

  const template = findTemplate(currentAssignment.template_id, templates);
  const templateId = String(currentAssignment.template_id ?? "");

  return (
    <article className="record-card">
      <div>
        <h4>{String(template?.template_name ?? currentAssignment.template_id ?? "Programme")}</h4>
        <p>
          Version {Number(currentAssignment.template_version ?? template?.template_version ?? 0)} ·{" "}
          {formatDate(recordDate(currentAssignment))}
        </p>
      </div>
      <button className="button secondary small-button" type="button" onClick={() => openProgramme(templateId)}>
        Open programme
      </button>
    </article>
  );
}

export function AthleteCurrentEventCard() {
  const { athleteUserId, loading, error, detail, events } = useAthleteHistory();
  if (!athleteUserId) return null;
  if (error) return <p role="status" className="muted small error">{error}</p>;
  if (loading && !detail) return null;

  const currentEventLink =
    detail?.current_event_link && typeof detail.current_event_link === "object"
      ? (detail.current_event_link as JsonRecord)
      : null;

  if (!currentEventLink) {
    return <EmptyState heading="No event link" detail="The current assignment is not linked to a persisted event." />;
  }

  const linkedEvent = findEvent(currentEventLink.event_id, events);
  const linkedEventPlan = eventPlanOf(linkedEvent);
  const eventId = String(currentEventLink.event_id ?? "");

  return (
    <article className="record-card">
      <div>
        <h4>{String(linkedEventPlan?.event_name ?? currentEventLink.event_id ?? "Event")}</h4>
        <p>
          {linkedEventPlan?.event_date ? formatDate(linkedEventPlan.event_date) : "Date not available"}
          {linkedEventPlan?.event_date ? ` · ${countdownLabel(linkedEventPlan.event_date)}` : ""}
        </p>
      </div>
      <button className="button secondary small-button" type="button" onClick={() => openEvent(eventId)}>
        Open event
      </button>
    </article>
  );
}

export function AthleteAssignmentHistoryList() {
  const { athleteUserId, loading, error, detail, templates } = useAthleteHistory();
  const records = historyArray(detail, "assignment_history");
  if (!athleteUserId) return null;
  if (error) return <p role="status" className="muted small error">{error}</p>;
  if (loading && !detail) return null;

  if (records.length === 0) {
    return <EmptyState heading="No assignment history" detail="Programme assignments will appear here after they are recorded." />;
  }

  return (
    <>
      {records.map((assignment, index) => {
        const template = findTemplate(assignment.template_id, templates);
        const templateId = String(assignment.template_id ?? "");
        return (
          <article className="record-card" key={String(assignment.assignment_id ?? index)}>
            <div>
              <h4>{String(template?.template_name ?? assignment.template_id ?? "Programme")}</h4>
              <p>
                {titleCase(assignment.activity_id)} · {formatDate(recordDate(assignment))}
              </p>
            </div>
            <div className="record-meta">
              <span className="badge neutral">
                Version {Number(assignment.template_version ?? template?.template_version ?? 0)}
              </span>
              <button className="button secondary small-button" type="button" onClick={() => openProgramme(templateId)}>
                Open
              </button>
            </div>
          </article>
        );
      })}
    </>
  );
}

export function AthleteStrengthHistoryList() {
  const { athleteUserId, loading, error, detail, exercises } = useAthleteHistory();
  const records = historyArray(detail, "strength_profile_history");
  if (!athleteUserId) return null;
  if (error) return <p role="status" className="muted small error">{error}</p>;
  if (loading && !detail) return null;

  if (records.length === 0) {
    return <EmptyState heading="No strength history" detail="Saved strength-reference profiles will appear here." />;
  }

  return (
    <>
      {records.map((profile, index) => {
        const benchmarks = Array.isArray(profile.benchmarks) ? (profile.benchmarks as JsonRecord[]) : [];
        const benchmarkText = benchmarks.length
          ? benchmarks
              .map(
                (benchmark) =>
                  `${exerciseDisplayName(benchmark.exercise_id, exercises)}: ${formatStrengthReferenceSummary(benchmark, profile.preferred_weight_unit)}`
              )
              .join(" · ")
          : "No strength references";

        return (
          <article className="record-card" key={String(profile.profile_id ?? index)}>
            <div>
              <h4>
                {benchmarks.length} strength reference{benchmarks.length === 1 ? "" : "s"}
              </h4>
              <p>{benchmarkText}</p>
            </div>
            <span className="badge neutral">{formatDate(recordDate(profile))}</span>
          </article>
        );
      })}
    </>
  );
}

export function AthleteBodyweightHistoryList() {
  const { athleteUserId, loading, error, detail } = useAthleteHistory();
  const records = historyArray(detail, "bodyweight_history");
  if (!athleteUserId) return null;
  if (error) return <p role="status" className="muted small error">{error}</p>;
  if (loading && !detail) return null;

  if (records.length === 0) {
    return <EmptyState heading="No bodyweight history" detail="Saved bodyweight records will appear here." />;
  }

  return (
    <>
      {records.map((record, index) => (
        <article className="record-card" key={String(record.record_id ?? index)}>
          <div>
            <h4>
              {Number(record.bodyweight)} {String(record.unit ?? "")}
            </h4>
            <p>Factual recorded bodyweight</p>
          </div>
          <span className="badge neutral">{formatDate(record.effective_at as string | undefined)}</span>
        </article>
      ))}
    </>
  );
}

export function AthleteEventLinkHistoryList() {
  const { athleteUserId, loading, error, detail, events } = useAthleteHistory();
  const records = historyArray(detail, "event_link_history");
  if (!athleteUserId) return null;
  if (error) return <p role="status" className="muted small error">{error}</p>;
  if (loading && !detail) return null;

  if (records.length === 0) {
    return <EmptyState heading="No event-link history" detail="Event links will appear here after this athlete is linked to a persisted event." />;
  }

  return (
    <>
      {records.map((link, index) => {
        const linkedEvent = findEvent(link.event_id, events);
        const linkedEventPlan = eventPlanOf(linkedEvent);
        return (
          <article className="record-card" key={String(link.link_id ?? index)}>
            <div>
              <h4>{String(linkedEventPlan?.event_name ?? link.event_id ?? "Event")}</h4>
              <p>
                {titleCase(link.lifecycle_action ?? link.link_state)}
                {link.unlink_reason ? ` · ${titleCase(link.unlink_reason)}` : ""} · {formatDate(recordDate(link))}
              </p>
            </div>
            <span className="badge neutral">{titleCase(link.link_state)}</span>
          </article>
        );
      })}
    </>
  );
}
