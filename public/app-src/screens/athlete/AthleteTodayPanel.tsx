import React from "react";

import { type JsonRecord } from "../../api/transport";
import { countdownLabel, formatDate, titleCase } from "../../utils/format";
import { useAthleteToday } from "./useAthleteToday";

// DEV NOTE: FULL-UI-14C Today screen - ported from app.js's renderToday()/
// renderTodayProgramme()/renderTodayResolvedLoad()/renderTodayNotes()/
// renderTodayEvent(). Session execution (createSession/startSession/the
// Session view itself) stays fully legacy - see the "Create session" and
// "Continue session" handlers below, both of which trigger the existing
// legacy flow rather than reimplementing it. "Recent activity"
// (today-history-count-root/today-recent-activity-root) is its own React
// island now too - see AthleteTodayRecentActivityPanel.tsx/
// useAthleteTodayRecentActivity.ts.

const MESSAGE_STATE_COPY: Record<string, { icon: string; heading: string; body: string; badgeLabel: string; badgeClass: string }> = {
  no_current_assignment: {
    icon: "•",
    heading: "No active programme",
    body: "You don't have a coach-assigned programme right now. Ask your coach to assign one, or start a self-directed session below.",
    badgeLabel: "No programme",
    badgeClass: "neutral"
  },
  relationship_ended: {
    icon: "•",
    heading: "Coaching relationship ended",
    body: "Your coaching relationship for this programme is no longer active. Contact your coach to reconnect.",
    badgeLabel: "Relationship ended",
    badgeClass: "partial"
  },
  missing_strength_reference: {
    icon: "•",
    heading: "Waiting on a strength reference",
    body: "This programme needs a working-max reference your coach hasn't recorded yet. Ask your coach to add it to your profile before you can continue.",
    badgeLabel: "Reference needed",
    badgeClass: "partial"
  },
  programme_complete: {
    icon: "✓",
    heading: "Programme complete",
    body: "You've completed every session in this programme. Your coach will assign what's next.",
    badgeLabel: "Complete",
    badgeClass: "complete"
  },
  no_session: {
    icon: "+",
    heading: "No session is open",
    body: "Start your next session from this programme when you're ready to train.",
    badgeLabel: "No session",
    badgeClass: "neutral"
  },
  session_already_complete: {
    icon: "✓",
    heading: "Session complete",
    body: "You already completed this session. Start the next one from this programme when you're ready.",
    badgeLabel: "Session complete",
    badgeClass: "complete"
  }
};

function todaySessionLabel(session: JsonRecord | null): string {
  if (!session) return "";
  const parts: string[] = [];
  if (session.template_block_name) parts.push(`Block: ${String(session.template_block_name)}`);
  if (Number.isInteger(session.template_week_index_global)) {
    parts.push(`Week ${session.template_week_index_global}`);
  }
  if (Number.isInteger(session.template_session_index) && session.total_session_count) {
    parts.push(`Session ${Number(session.template_session_index) + 1} of ${session.total_session_count}`);
  }
  return parts.join(" · ");
}

function countsFromSession(sessionState: JsonRecord | null) {
  return {
    completed: Array.isArray(sessionState?.completed_exercises) ? (sessionState!.completed_exercises as unknown[]) : [],
    remaining: Array.isArray(sessionState?.remaining_exercises) ? (sessionState!.remaining_exercises as unknown[]) : [],
    dropped: Array.isArray(sessionState?.dropped_exercises) ? (sessionState!.dropped_exercises as unknown[]) : []
  };
}

function sessionClassification(sessionState: JsonRecord | null): { label: string; className: string } {
  const counts = countsFromSession(sessionState);
  const total = counts.completed.length + counts.remaining.length + counts.dropped.length;
  const currentStep = sessionState?.current_step as JsonRecord | undefined;

  if (currentStep?.type === "RETURN_DECISION") return { label: "Return decision", className: "active" };
  if (total > 0 && counts.remaining.length === 0 && counts.dropped.length > 0) {
    return { label: "Partially completed", className: "partial" };
  }
  if (total > 0 && counts.remaining.length === 0) return { label: "Completed", className: "complete" };
  if (sessionState?.started === true) return { label: "In progress", className: "active" };
  return { label: "Planned", className: "neutral" };
}

function statusBadge(today: JsonRecord | null, sessionState: JsonRecord | null): { label: string; className: string } {
  const stateKey = String(today?.state ?? "service_unavailable");
  if (stateKey === "service_unavailable") return { label: "Unavailable", className: "partial" };
  const messageCopy = MESSAGE_STATE_COPY[stateKey];
  if (messageCopy) return { label: messageCopy.badgeLabel, className: messageCopy.badgeClass };
  return sessionClassification(sessionState);
}

function createSessionButtonLabel(today: JsonRecord | null): string {
  const stateKey = String(today?.state ?? "service_unavailable");
  if (stateKey === "session_already_complete") return "Start next session";
  if (stateKey === "no_session") return "Start session";
  if (stateKey === "ok") return "Create another session";
  return "Create session";
}

function requestCreateSession() {
  document.dispatchEvent(new CustomEvent("kolosseum:create-session"));
}

// DEV NOTE: reuses the sidebar's own always-bound [data-view="session"] nav
// item rather than reimplementing setView("session") - same pure-navigation
// pattern used elsewhere (see AthleteHistoryPanels.tsx's openProgramme).
function continueToSession() {
  (document.querySelector('[data-view="session"]') as HTMLElement | null)?.click();
}

export function AthleteTodayCreateSessionButton() {
  const { today } = useAthleteToday();
  return (
    <button className="button primary" type="button" onClick={requestCreateSession}>
      {createSessionButtonLabel(today)}
    </button>
  );
}

export function AthleteTodaySessionCard() {
  const { loading, today, sessionState, refresh } = useAthleteToday();
  const badge = statusBadge(today, sessionState);

  if (loading && !today) {
    return (
      <div className="panel session-hero">
        <div className="panel-kicker">
          <span>Current session</span>
          <span className="badge neutral">Loading…</span>
        </div>
      </div>
    );
  }

  const stateKey = String(today?.state ?? "service_unavailable");

  if (stateKey === "service_unavailable") {
    return (
      <div className="panel session-hero">
        <div className="panel-kicker">
          <span>Current session</span>
          <span className={`badge ${badge.className}`}>{badge.label}</span>
        </div>
        <div className="empty-state">
          <div className="empty-icon">!</div>
          <h3>Today is unavailable right now</h3>
          <p>We could not reach the server to load your current programme. Check your connection and try again.</p>
          <button className="button secondary" type="button" onClick={() => refresh()}>Retry</button>
        </div>
      </div>
    );
  }

  const assignment = (today?.assignment ?? null) as JsonRecord | null;
  const session = (today?.session ?? null) as JsonRecord | null;
  const notes = Array.isArray(today?.notes) ? (today!.notes as JsonRecord[]) : [];
  const messageCopy = MESSAGE_STATE_COPY[stateKey];
  const firstPlannedItem = Array.isArray(session?.planned_items) ? (session!.planned_items[0] as JsonRecord | undefined) : undefined;
  const resolvedLoad = firstPlannedItem?.resolved_load as JsonRecord | undefined;
  const resolvedLoadSource = resolvedLoad?.source as JsonRecord | undefined;
  const activityId = String(assignment?.activity_id ?? "training");
  const sessionNotes = session?.template_session_coaching_notes;

  return (
    <div className="panel session-hero">
      <div className="panel-kicker">
        <span>Current session</span>
        <span className={`badge ${badge.className}`}>{badge.label}</span>
      </div>

      {assignment ? (
        <div className="today-programme-summary">
          <p className="eyebrow">{String(assignment.template_name || "Assigned programme")}</p>
          <p className="muted">{assignment.template_version ? `Version ${assignment.template_version}` : ""}</p>
          <p className="muted">{todaySessionLabel(session)}</p>
        </div>
      ) : null}

      {messageCopy ? (
        <div className="empty-state">
          <div className="empty-icon">{messageCopy.icon}</div>
          <h3>{messageCopy.heading}</h3>
          <p>{messageCopy.body}</p>
        </div>
      ) : null}

      {stateKey === "ok" ? (
        <div>
          <p className="eyebrow">{titleCase(activityId)}</p>
          <h3>{session?.template_session_title ? String(session.template_session_title) : `${titleCase(activityId)} session`}</h3>
          {sessionNotes ? <p className="muted">{String(sessionNotes)}</p> : null}
          <div className="metric-row">
            <div><strong>{countsFromSession(sessionState).completed.length}</strong><span>Completed</span></div>
            <div><strong>{countsFromSession(sessionState).remaining.length}</strong><span>Remaining</span></div>
            <div><strong>{countsFromSession(sessionState).dropped.length}</strong><span>Dropped</span></div>
          </div>
          {resolvedLoad ? (
            <div className="today-resolved-load">
              <p className="today-resolved-load-value">{`${resolvedLoad.value} ${resolvedLoad.unit}`}</p>
              <p className="muted">
                {resolvedLoadSource
                  ? `${resolvedLoadSource.source_type === "estimated_1rm" ? "Estimated 1RM" : resolvedLoadSource.source_type === "training_max" ? "Training max" : "Tested 1RM"} · effective ${formatDate(resolvedLoadSource.effective_date)}`
                  : ""}
              </p>
            </div>
          ) : null}
          <button className="button primary" type="button" onClick={continueToSession}>Open session</button>
        </div>
      ) : null}

      {notes.length > 0 ? (
        <div className="today-notes">
          <p className="eyebrow">From your coach</p>
          <ul className="today-notes-list">
            {notes.map((note) => (
              <li key={String(note.note_id ?? note.created_at_iso8601)}>
                {String(note.note_text ?? "")}
                <br />
                <small className="muted">{formatDate(note.created_at_iso8601)}</small>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

export function AthleteTodayEventCard() {
  const { today } = useAthleteToday();
  const stateKey = String(today?.state ?? "service_unavailable");
  if (stateKey === "service_unavailable") return null;

  const event = (today?.event ?? null) as JsonRecord | null;
  if (!event) return null;

  if (event.status === "unavailable") {
    return (
      <div className="panel compact-panel event-countdown-card">
        <div className="panel-kicker">
          <span>Next event</span>
          <span className="badge neutral">Unavailable</span>
        </div>
        <strong className="large-number">—</strong>
        <h3>This event is no longer available</h3>
        <p className="muted">{titleCase(event.reason ?? "event_unavailable")}</p>
      </div>
    );
  }

  return (
    <div className="panel compact-panel event-countdown-card">
      <div className="panel-kicker">
        <span>Next event</span>
        <span className="badge neutral">{titleCase(event.event_type ?? "event")}</span>
      </div>
      <strong className="large-number">{countdownLabel(event.event_date)}</strong>
      <h3>{String(event.event_name || "Event")}</h3>
      <p className="muted">
        {formatDate(event.event_date)}
        {event.location ? ` · ${String(event.location)}` : ""}
      </p>
    </div>
  );
}
