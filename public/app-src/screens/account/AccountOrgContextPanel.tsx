import React, { useEffect, useState } from "react";

import { loadAccountDetail } from "../../api/client";
import { type JsonRecord } from "../../api/transport";
import { formatDate } from "../../utils/format";
import { useRole } from "../../utils/role";
import { useAccountOrgContext } from "./useAccountOrgContext";

function visibilityModeLabel(mode: unknown): string {
  return mode === "shared" ? "Team" : "Gym";
}

// DEV NOTE: Part O.7 - mirrors AccountOrgMessagesPanel.tsx's athlete-side
// role gate: the underlying /coach-workspace/org-memberships route 403s
// for an athlete session, so the role check must come before ever
// rendering the hook's own error state.
export function AccountOrgContextPanel() {
  const isCoach = useRole() === "coach";
  const { loading, error, entries, actingId, actionError, accept, leave } = useAccountOrgContext();
  const [ownCoachUserId, setOwnCoachUserId] = useState<string | null>(null);

  useEffect(() => {
    loadAccountDetail()
      .then((account) => setOwnCoachUserId(String((account.account as JsonRecord | undefined)?.user_id ?? "")))
      .catch(() => {});
  }, []);

  if (!isCoach) return null;
  if (loading && entries.length === 0) return null;
  if (error) return <p role="status" className="muted small error">{error}</p>;
  if (entries.length === 0) return null;

  return (
    <article className="panel">
      <p className="eyebrow">Organisations</p>
      <h3>Your organisations</h3>
      {actionError ? <p role="status" className="muted small error">{actionError}</p> : null}
      {entries.map((entry, index) => {
        const membership = entry.membership;
        const membershipId = String(membership.membership_id ?? index);
        const busy = actingId === membershipId;
        return (
          <div className="record-row coach-org-context-entry" key={membershipId}>
            <strong>{String(membership.org_name ?? "")}</strong>
            <span className={`badge ${membership.visibility_mode === "shared" ? "active" : "neutral"}`}>{visibilityModeLabel(membership.visibility_mode)}</span>
            <p className="muted small">
              {membership.activated_at_iso8601 ? `Joined ${formatDate(membership.activated_at_iso8601)}` : `Invited ${formatDate(membership.invited_at_iso8601)}`}
            </p>
            {membership.membership_status === "invited" ? (
              <button type="button" className="button primary small-button" disabled={busy} onClick={() => accept(membershipId)}>Accept invitation</button>
            ) : null}
            {membership.membership_status === "active" ? (
              <button type="button" className="button secondary small-button" disabled={busy} onClick={() => leave(membershipId)}>Leave organisation</button>
            ) : null}
            {membership.visibility_mode === "shared" && entry.roster.length > 0 ? (
              <div className="record-list">
                {entry.roster.map((fellow: JsonRecord, fellowIndex) => (
                  <p className="muted small" key={String(fellow.coach_user_id ?? fellowIndex)}>
                    {String(fellow.coach_display_name || fellow.coach_user_id)}
                    {fellow.coach_user_id === ownCoachUserId ? " (You)" : ""}
                    {fellow.coach_email ? ` - ${String(fellow.coach_email)}` : ""}
                    {fellow.activated_at_iso8601 ? ` · Joined ${formatDate(fellow.activated_at_iso8601)}` : ""}
                  </p>
                ))}
              </div>
            ) : null}
          </div>
        );
      })}
    </article>
  );
}
