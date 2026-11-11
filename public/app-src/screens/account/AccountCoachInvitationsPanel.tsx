import React from "react";

import { type JsonRecord } from "../../api/transport";
import { coachLabel } from "../../utils/coachName";
import { useRole } from "../../utils/role";
import { useAccountCoachInvitations } from "./useAccountCoachInvitations";

// DEV NOTE: FULL-UI-24 - a coach invites an athlete by email, never by the
// athlete's internal user_id; the athlete accepts here by clicking a real
// button, never by typing any id. This panel mounts inside the shared
// #view-account section used by both actors, athlete-only - matches
// AccountBrandingPanel.tsx's useRole() gate. The underlying route 403s
// for a coach session, so the role check must come before ever rendering
// the hook's own error state, not just before rendering the data.
export function AccountCoachInvitationsPanel() {
  const isAthlete = useRole() === "athlete";
  const { loading, error, invitations, actingId, actionError, accept, decline } = useAccountCoachInvitations();

  if (!isAthlete) return null;
  if (loading && invitations.length === 0) return null;
  if (error) return <p role="status" className="muted small error">{error}</p>;
  if (invitations.length === 0) return null;

  return (
    <article className="panel">
      <p className="eyebrow">Coach invitations</p>
      <h3>Pending coach invitations</h3>
      {actionError ? <p role="status" className="muted small error">{actionError}</p> : null}
      <div className="record-list">
        {invitations.map((invitation: JsonRecord) => {
          const relationshipId = String(invitation.relationship_id ?? "");
          const busy = actingId === relationshipId;
          return (
            <article className="record-row" key={relationshipId}>
              <div>
                <strong>{coachLabel(invitation)}</strong>
                <p className="muted small">{String(invitation.coach_email ?? "")}</p>
              </div>
              <div className="inline-controls">
                <button type="button" className="button secondary" disabled={busy} onClick={() => decline(relationshipId)}>Decline</button>
                <button type="button" className="button primary" disabled={busy} onClick={() => accept(relationshipId)}>Accept</button>
              </div>
            </article>
          );
        })}
      </div>
    </article>
  );
}

// The same invitations on Today, in the "Waiting for your coach" card - the
// invitation notification opens Today, so it must be answerable there.
export function TodayCoachInvitations() {
  const { loading, invitations, actingId, actionError, accept, decline } = useAccountCoachInvitations();
  if (loading && invitations.length === 0) return null;
  if (invitations.length === 0) return null;
  return (
    <div className="record-list today-coach-invitations" data-testid="today-coach-invitations">
      {actionError ? <p role="status" className="muted small error">{actionError}</p> : null}
      {invitations.map((invitation: JsonRecord) => {
        const relationshipId = String(invitation.relationship_id ?? "");
        const busy = actingId === relationshipId;
        return (
          <article className="record-row" key={relationshipId}>
            <div>
              <strong>{coachLabel(invitation)} invited you to train with them</strong>
              <p className="muted small">Accept and they can assign your programme.</p>
            </div>
            <div className="inline-controls">
              <button type="button" className="button secondary" disabled={busy} onClick={() => decline(relationshipId)}>Decline</button>
              <button type="button" className="button primary" disabled={busy} onClick={() => accept(relationshipId)}>Accept</button>
            </div>
          </article>
        );
      })}
    </div>
  );
}
