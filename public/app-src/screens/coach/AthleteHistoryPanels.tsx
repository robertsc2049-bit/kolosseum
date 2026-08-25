import React from "react";

import { type JsonRecord } from "../../api/transport";
import { formatDate } from "../../utils/format";
import { useAthleteHistory } from "./useAthleteHistory";

// DEV NOTE: current programme, current event, and the assignment/
// strength/bodyweight/event-link/session history lists from
// public/app.js's renderAthleteDetail() (part of FULL-UI-04B). Note
// history is already React (see AthleteCoachNotesPanel.tsx); the
// metric-card counts (athleteDetailAssignmentCount etc.), the overall
// panel hide/show and the status line stay legacy-owned since they're
// shared with note data that isn't moving. Session history's "Review"
// and "Add note" buttons used to be bound by legacy's
// bindAthleteDetailActions() via data-athlete-detail-action delegation -
// now retired since nothing in a legacy-rendered DOM carries that
// attribute any more - and are replaced by two reverse-bridge custom
// events (kolosseum:open-session-review,
// kolosseum:open-session-note-form) that app.js listens for and handles
// exactly as bindAthleteDetailActions() used to, since both actions
// (switching to the Review view with an athlete pre-selected; revealing
// the legacy note-creation form) reach into legacy-only state/DOM
// (elements.reviewAthlete, loadCoachReview(), elements.athleteDetailNoteForm).

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

// DEV NOTE: click the legacy nav button before setting the hash, not
// after - clicking it also runs legacy's reverse-sync
// (syncRouteFromElement), which serializes the *entityless* route for
// the view being switched to and would otherwise clobber a
// template_id/event_id-bearing hash set beforehand.
function openProgramme(templateId: string) {
  (document.querySelector('[data-view="templates"]') as HTMLElement | null)?.click();
  if (templateId) location.hash = `#/coach/programmes/${encodeURIComponent(templateId)}`;
}

function openEvent(eventId: string) {
  (document.querySelector('[data-view="events"]') as HTMLElement | null)?.click();
  if (eventId) location.hash = `#/coach/events/${encodeURIComponent(eventId)}`;
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

function openSessionReview(athleteUserId: string) {
  document.dispatchEvent(
    new CustomEvent("kolosseum:open-session-review", { detail: { athlete_user_id: athleteUserId } })
  );
}

function openSessionNoteForm(sessionId: string, artefactId: string) {
  document.dispatchEvent(
    new CustomEvent("kolosseum:open-session-note-form", { detail: { session_id: sessionId, artefact_id: artefactId } })
  );
}

export function AthleteSessionHistoryList() {
  const { athleteUserId, loading, error, detail } = useAthleteHistory();
  const records = historyArray(detail, "session_history");
  if (!athleteUserId) return null;
  if (error) return <p role="status" className="muted small error">{error}</p>;
  if (loading && !detail) return null;

  if (records.length === 0) {
    return <EmptyState heading="No session history" detail="Coach-managed session records will appear here after execution begins." />;
  }

  return (
    <>
      {records.map((session, index) => {
        const skipReasons = Array.isArray(session.skip_reasons) ? (session.skip_reasons as unknown[]) : [];
        const substitutions = Array.isArray(session.substitutions) ? (session.substitutions as JsonRecord[]) : [];
        const rpeReports = Array.isArray(session.rpe_reports) ? (session.rpe_reports as JsonRecord[]) : [];

        return (
          <article className="record-card" key={String(session.session_id ?? index)}>
            <div>
              <h4>Training session</h4>
              <p>
                {formatDate(session.updated_at as string | undefined)} · {Number(session.runtime_event_count ?? 0)} recorded events
              </p>
              {skipReasons.length > 0 ? (
                <p className="muted small">Skipped: {skipReasons.map((reason) => titleCase(reason)).join(", ")}</p>
              ) : null}
              {substitutions.length > 0 ? (
                <p className="muted small">
                  Substituted:{" "}
                  {substitutions
                    .map((entry) => `${titleCase(entry.exercise_id)} → ${titleCase(entry.substituted_exercise_id)}`)
                    .join(", ")}
                </p>
              ) : null}
              {rpeReports.length > 0 ? (
                <p className="muted small">
                  RPE: {rpeReports.map((entry) => `${titleCase(entry.exercise_id)} ${Number(entry.rpe_value)}`).join(", ")}
                </p>
              ) : null}
              {session.split_return_decision ? (
                <p className="muted small">Return decision: {titleCase(session.split_return_decision)}</p>
              ) : null}
            </div>

            <div className="record-meta">
              <span className="badge neutral">{titleCase(session.session_status ?? "recorded")}</span>
              {session.pain_reported ? <span className="badge partial">Pain reported</span> : null}
              {session.split_entered ? <span className="badge partial">Split session</span> : null}
              <button
                className="button secondary small-button"
                type="button"
                onClick={() => openSessionReview(athleteUserId)}
              >
                Review
              </button>
              <button
                className="button secondary small-button"
                type="button"
                onClick={() => openSessionNoteForm(String(session.session_id ?? ""), String(session.artefact_id ?? ""))}
              >
                Add note
              </button>
            </div>
          </article>
        );
      })}
    </>
  );
}
