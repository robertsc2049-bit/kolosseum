import React from "react";

import { type JsonRecord } from "../../api/transport";
import { formatDate, titleCase } from "../../utils/format";
import { useAthleteTodayRecentActivity } from "./useAthleteTodayRecentActivity";

// DEV NOTE: ported from app.js's renderTodayRecent()/recordCard()/
// bindSessionCards() - see useAthleteTodayRecentActivity.ts for what changed
// in the data source. A session card's click dispatches
// kolosseum:continue-history-session, the same bridge event
// AthleteHistoryPanel.tsx's "Continue session" button already uses - app.js
// still owns that listener (sets state.activeSessionId and navigates to the
// Session view).

function dispatchContinueSession(sessionId: string) {
  document.dispatchEvent(new CustomEvent("kolosseum:continue-history-session", { detail: { session_id: sessionId } }));
}

export function AthleteTodayHistoryCountBadge() {
  const { sessionCount } = useAthleteTodayRecentActivity();
  return <>{sessionCount}</>;
}

export function AthleteTodayRecentActivityList() {
  const { loading, recentSessions } = useAthleteTodayRecentActivity();

  if (loading && recentSessions.length === 0) {
    return (
      <div className="record-list">
        <div className="empty-state"><p>Loading recent sessions…</p></div>
      </div>
    );
  }

  if (recentSessions.length === 0) {
    return (
      <div className="record-list">
        <div className="empty-state"><p>No recent sessions are recorded.</p></div>
      </div>
    );
  }

  return (
    <div className="record-list">
      {recentSessions.map((session: JsonRecord, index: number) => {
        const sessionId = String(session.session_id ?? "");
        const status = titleCase(String(session.status ?? "recorded"));
        return (
          <article
            className="record-card interactive"
            key={sessionId || index}
            data-session-id={sessionId}
            onClick={() => dispatchContinueSession(sessionId)}
          >
            <div>
              <h3>Training session</h3>
              <p>{formatDate(session.updated_at ?? session.created_at)}</p>
            </div>
            <div className="record-meta">
              <span className="badge neutral">{status}</span>
              <span className="badge neutral">{Number(session.runtime_event_count ?? 0)} events</span>
            </div>
          </article>
        );
      })}
    </div>
  );
}
