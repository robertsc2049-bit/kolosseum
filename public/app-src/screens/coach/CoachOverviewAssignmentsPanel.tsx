import React from "react";

import { type JsonRecord } from "../../api/transport";
import { useCoachOverviewAssignments } from "./useCoachOverviewAssignments";

// DEV NOTE: part of FULL-UI-03's Coach Overview dashboard - ported from
// app.js's (removed) renderCoachDashboard() assignment-queue block. See
// useCoachOverviewAssignments.ts's DEV NOTE for why "Connected athletes"/
// "Open sessions"/"Completed since review" stay legacy for now. "Open
// profile" dispatches the same kolosseum:open-athlete-profile-request
// event AthleteDirectoryPanel.tsx already uses, with an extra
// focus_assignment flag to preserve the scroll-to-assignment-panel
// nicety the removed "open-assignment" dashboard-action branch provided.
function openAssignmentProfile(athleteUserId: string) {
  document.dispatchEvent(
    new CustomEvent("kolosseum:open-athlete-profile-request", {
      detail: { athlete_user_id: athleteUserId, focus_assignment: true }
    })
  );
}

export function CoachOverviewAssignmentsPanel() {
  const { loading, error, unassignedAthletes, totalConnectedAthletes } = useCoachOverviewAssignments();

  if (loading && totalConnectedAthletes === 0 && unassignedAthletes.length === 0) {
    return <p className="muted small">Loading assignment actions…</p>;
  }

  if (error) {
    return <p role="status" className="muted small error">{error}</p>;
  }

  if (unassignedAthletes.length === 0) {
    return (
      <div className="empty-state dashboard-empty-state">
        <h4>No assignment actions</h4>
        <p>
          {totalConnectedAthletes > 0
            ? "Every connected athlete has at least one recorded assignment."
            : "Connect an athlete before creating an assignment."}
        </p>
      </div>
    );
  }

  return (
    <>
      {unassignedAthletes.slice(0, 8).map((athlete: JsonRecord, index) => {
        const athleteUserId = String(athlete.athlete_user_id ?? "");
        return (
          <article className="record-card dashboard-record-card" key={athleteUserId || index}>
            <div>
              <h4>{String(athlete.display_name ?? athleteUserId)}</h4>
              <p>No programme assignment is currently recorded.</p>
            </div>
            <div className="record-meta">
              <span className="badge neutral">Action required</span>
              <button className="button secondary small-button" type="button" onClick={() => openAssignmentProfile(athleteUserId)}>
                Open profile
              </button>
            </div>
          </article>
        );
      })}
    </>
  );
}
