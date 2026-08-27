import React from "react";

import { type JsonRecord } from "../../api/transport";
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
                <strong>{String(invitation.coach_display_name ?? "")}</strong>
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
