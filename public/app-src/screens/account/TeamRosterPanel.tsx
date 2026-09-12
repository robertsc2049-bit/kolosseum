import React, { useState } from "react";

import { type JsonRecord } from "../../api/transport";
import { PositionSelect } from "../../components/PositionSelect";
import { useRole } from "../../utils/role";
import { type TeamOrgEntry, useTeamRoster } from "./useTeamRoster";

function AthleteRow({ orgId, athlete, busy, onOverride }: {
  orgId: string;
  athlete: JsonRecord;
  busy: boolean;
  onOverride: (athleteUserId: string, position: string) => void;
}) {
  const athleteUserId = String(athlete.athlete_user_id ?? "");
  const activityId = String(athlete.activity_id ?? "");
  const [selected, setSelected] = useState(String(athlete.position ?? ""));

  return (
    <div className="record-row team-roster-entry">
      <strong>{String(athlete.display_name ?? athleteUserId)}</strong>
      <span className="muted small">{activityId ? activityId.replaceAll("_", " ") : "No activity declared"}</span>
      {activityId ? (
        <>
          <PositionSelect activityId={activityId} value={selected} onChange={setSelected} label="Position" />
          <button
            type="button"
            className="button secondary small-button"
            disabled={busy || !selected || selected === athlete.position}
            onClick={() => onOverride(athleteUserId, selected)}
          >
            {busy ? "Updating…" : "Override position"}
          </button>
        </>
      ) : null}
    </div>
  );
}

function TeamOrgSection({ entry, overridingKey, onOverride }: {
  entry: TeamOrgEntry;
  overridingKey: string | null;
  onOverride: (orgId: string, athleteUserId: string, position: string) => void;
}) {
  if (entry.roster.length === 0) return null;
  return (
    <div className="record-row">
      <strong>{entry.orgName}</strong>
      <div className="record-list">
        {entry.roster.map((athlete, index) => (
          <AthleteRow
            key={String(athlete.athlete_user_id ?? index)}
            orgId={entry.orgId}
            athlete={athlete}
            busy={overridingKey === `${entry.orgId}:${String(athlete.athlete_user_id ?? "")}`}
            onOverride={(athleteUserId, position) => onOverride(entry.orgId, athleteUserId, position)}
          />
        ))}
      </div>
    </div>
  );
}

// DEV NOTE: slice 3 of the sport-declaration redesign - direct team-coach
// position override, no athlete confirmation needed (unlike the plain 1:1
// propose/confirm tier in AthleteRelationshipDetailPanel.tsx). Only ever
// shows athletes from the coach's own ACTIVE shared-visibility org
// memberships - useTeamRoster.ts's own fetch already scopes to that.
export function TeamRosterPanel() {
  const isCoach = useRole() === "coach";
  const { loading, error, orgs, overridingKey, overrideError, overridePosition } = useTeamRoster();

  if (!isCoach) return null;
  if (loading && orgs.length === 0) return null;
  if (error) return <p role="status" className="muted small error">{error}</p>;

  const hasAnyRoster = orgs.some((entry) => entry.roster.length > 0);
  if (!hasAnyRoster) return null;

  return (
    <article className="panel">
      <p className="eyebrow">Team roster</p>
      <h3>Athlete positions</h3>
      <p className="muted small">
        Directly update a teammate's position - no athlete confirmation needed, since you're an active coach on their shared-visibility team.
      </p>
      {overrideError ? <p role="status" className="muted small error">{overrideError}</p> : null}
      {orgs.map((entry) => (
        <TeamOrgSection
          key={entry.orgId}
          entry={entry}
          overridingKey={overridingKey}
          onOverride={(orgId, athleteUserId, position) => overridePosition(orgId, athleteUserId, position).catch(() => {})}
        />
      ))}
    </article>
  );
}
