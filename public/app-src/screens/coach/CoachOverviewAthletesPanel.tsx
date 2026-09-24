import React from "react";

import { titleCase } from "../../utils/format";
import { type CoachOverviewAthleteEntry, useCoachOverviewAthletes } from "./useCoachOverviewAthletes";

// DEV NOTE: part of FULL-UI-03's Coach Overview dashboard - ported from
// app.js's (removed) renderCoachDashboard()/renderCoachWorkspace()
// connected-athletes rendering and coachAthleteCard(). See
// useCoachOverviewAthletes.ts's DEV NOTE for the third data source this
// card alone needs. "Open profile" dispatches the same
// kolosseum:open-athlete-profile-request event AthleteDirectoryPanel.tsx
// already uses.
function openProfile(athleteUserId: string) {
  document.dispatchEvent(
    new CustomEvent("kolosseum:open-athlete-profile-request", { detail: { athlete_user_id: athleteUserId } })
  );
}

function AthleteCard({ athlete }: { athlete: CoachOverviewAthleteEntry }) {
  return (
    <article className="record-card athlete-record-card">
      <div>
        <h3>{athlete.displayName}</h3>
        <p>{titleCase(athlete.activityId)}</p>
      </div>
      <div className="record-meta athlete-record-meta">
        <span className="badge complete">Connected</span>
        <span className={`badge ${athlete.hasProfile ? "active" : "neutral"}`}>
          {athlete.hasProfile
            ? `${athlete.referenceCount} strength reference${athlete.referenceCount === 1 ? "" : "s"}`
            : "Profile not recorded"}
        </span>
        <span className="badge neutral">{athlete.assignmentCount} assignment{athlete.assignmentCount === 1 ? "" : "s"}</span>
        <button className="button secondary small-button" type="button" onClick={() => openProfile(athlete.athleteUserId)}>
          Open profile
        </button>
      </div>
    </article>
  );
}

export function CoachOverviewAthletesPanel() {
  const { loading, error, athletes, pendingInvitationCount } = useCoachOverviewAthletes();

  if (loading && athletes.length === 0) {
    return <p className="muted small">Loading connected athletes…</p>;
  }

  if (error) {
    return <p role="status" className="muted small error">{error}</p>;
  }

  return (
    <>
      <p className="dashboard-pending-summary">
        {pendingInvitationCount
          ? `${pendingInvitationCount} pending athlete invitation${pendingInvitationCount === 1 ? "" : "s"} awaiting acceptance.`
          : "No pending athlete invitations."}
      </p>

      {athletes.length === 0 ? (
        <div className="empty-state dashboard-empty-state">
          <h4>No connected athletes</h4>
          <p>Connect an athlete to begin programme assignment and session review.</p>
        </div>
      ) : (
        athletes.map((athlete) => <AthleteCard key={athlete.athleteUserId} athlete={athlete} />)
      )}
    </>
  );
}
