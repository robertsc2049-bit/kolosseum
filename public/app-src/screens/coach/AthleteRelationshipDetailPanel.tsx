import React from "react";

import { type JsonRecord } from "../../api/transport";
import { formatDate, titleCase } from "../../utils/format";
import { useAthleteRelationshipDetail } from "./useAthleteRelationshipDetail";

// DEV NOTE: ported from index.html's #athleteRelationshipDetailPanel
// ("Relationship audit"). See useAthleteRelationshipDetail.ts for the
// open/close bridge-event wiring with app.js's trimmed
// openAthleteRelationshipDetail()/closeAthleteRelationshipDetail().
function requestOpenProfile(athleteUserId: string) {
  document.dispatchEvent(
    new CustomEvent("kolosseum:open-athlete-profile-request", { detail: { athlete_user_id: athleteUserId } })
  );
}

// Matches legacy's exact fact order, with the derived "Effective state"
// spliced in after the second (stored) entry.
const FACTS_BEFORE_EFFECTIVE: Array<[string, keyof JsonRecord]> = [
  ["Relationship ID", "relationship_id"],
  ["Stored state", "relationship_state"]
];
const FACTS_AFTER_EFFECTIVE: Array<[string, keyof JsonRecord]> = [
  ["Scope", "relationship_scope"],
  ["Created", "created_at_iso8601"],
  ["Accepted", "accepted_at_iso8601"],
  ["Updated", "updated_at_iso8601"],
  ["Expires", "expires_at_iso8601"],
  ["Revoked", "revoked_at_iso8601"]
];

function factValue(label: string, raw: unknown): string {
  return label.includes("ID") || label === "Scope" || label.toLowerCase().includes("state")
    ? String(raw ?? "Not recorded")
    : formatDate(raw);
}

function FactRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="relationship-audit-fact">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

export function AthleteRelationshipDetailPanel() {
  const { open, loading, notFound, athleteUserId, displayName, activityId, effectiveState, relationship, transitioning, transitionError, close, transition } = useAthleteRelationshipDetail();

  if (!open) return null;

  const accepted = effectiveState === "accepted";
  const invited = effectiveState === "invited" || effectiveState === "expired";
  const action = accepted ? "revoke" : "cancel";
  const verb = accepted ? "revoke this accepted relationship" : "cancel this invitation";

  function handleTransitionClick() {
    if (!window.confirm(`Confirm that you want to ${verb}. Historical records will be preserved.`)) return;
    transition(action).catch(() => {});
  }

  return (
    <article className="panel athlete-relationship-detail-panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Relationship audit</p>
          <h3>{loading ? "Loading…" : displayName}</h3>
          {!loading && !notFound ? (
            <p className="muted">{titleCase(effectiveState)} · {titleCase(activityId)} · {athleteUserId}</p>
          ) : null}
        </div>

        <button className="button secondary" type="button" onClick={close}>Close audit</button>
      </div>

      {notFound ? <p role="status" className="muted small error">The relationship record could not be found.</p> : null}

      {!loading && !notFound ? (
        <>
          <dl className="relationship-audit-grid">
            {FACTS_BEFORE_EFFECTIVE.map(([label, key]) => (
              <FactRow key={label} label={label} value={factValue(label, relationship[key])} />
            ))}
            <FactRow label="Effective state" value={effectiveState} />
            {FACTS_AFTER_EFFECTIVE.map(([label, key]) => (
              <FactRow key={label} label={label} value={factValue(label, relationship[key])} />
            ))}
          </dl>

          {transitionError ? <p role="status" className="muted small error">{transitionError}</p> : null}

          <div className="relationship-detail-actions">
            {accepted ? (
              <button
                className="button secondary"
                type="button"
                onClick={() => requestOpenProfile(athleteUserId)}
              >
                Open training profile
              </button>
            ) : null}

            {accepted || invited ? (
              <button
                className="button danger"
                type="button"
                disabled={transitioning}
                onClick={handleTransitionClick}
              >
                {accepted ? "Revoke relationship" : "Cancel invitation"}
              </button>
            ) : null}
          </div>
        </>
      ) : null}
    </article>
  );
}
