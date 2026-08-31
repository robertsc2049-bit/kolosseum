import React, { useState } from "react";

import { useConnectAthlete } from "./useConnectAthlete";

// DEV NOTE: ported from index.html's #connectAthleteForm ("Relationship
// record / Add athlete") - the manual, account-code-based relationship
// form. See useConnectAthlete.ts for the mutation + cross-stack refresh
// wiring.
const ACTIVITIES = [
  ["powerlifting", "Powerlifting"],
  ["general_strength", "General strength"],
  ["rugby_union", "Rugby union"],
  ["strongman", "Strongman"]
] as const;

export function ConnectAthletePanel() {
  const { submitting, error, connect } = useConnectAthlete();
  const [displayName, setDisplayName] = useState("");
  const [athleteUserId, setAthleteUserId] = useState("");
  const [activityId, setActivityId] = useState<string>("powerlifting");
  const [relationshipState, setRelationshipState] = useState<"accepted" | "invited">("accepted");
  const [expiryDate, setExpiryDate] = useState("");
  const [consent, setConsent] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const invited = relationshipState === "invited";

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!consent) return;

    const ok = await connect({
      athleteUserId: athleteUserId.trim(),
      displayName: displayName.trim(),
      activityId,
      relationshipState,
      expiryDate
    });

    if (ok) {
      setNotice(invited ? `Invitation for ${displayName.trim()} recorded.` : `${displayName.trim()} connected.`);
      setDisplayName("");
      setAthleteUserId("");
      setActivityId("powerlifting");
      setRelationshipState("accepted");
      setExpiryDate("");
      setConsent(false);
    }
  }

  return (
    <form className="panel form-panel" onSubmit={(event) => { handleSubmit(event).catch(() => {}); }}>
      <div>
        <p className="eyebrow">Relationship record</p>
        <h3>Add athlete</h3>
      </div>

      <label className="field">
        <span>Athlete name</span>
        <input
          required
          maxLength={80}
          value={displayName}
          onChange={(event) => setDisplayName(event.target.value)}
        />
      </label>

      <label className="field">
        <span>Athlete account code</span>
        <input
          required
          autoComplete="off"
          value={athleteUserId}
          onChange={(event) => setAthleteUserId(event.target.value)}
        />
      </label>

      <label className="field">
        <span>Activity</span>
        <select value={activityId} onChange={(event) => setActivityId(event.target.value)}>
          {ACTIVITIES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </label>

      <label className="field">
        <span>Relationship state</span>
        <select
          value={relationshipState}
          onChange={(event) => setRelationshipState(event.target.value === "invited" ? "invited" : "accepted")}
        >
          <option value="accepted">Accepted connection</option>
          <option value="invited">Pending invitation</option>
        </select>
      </label>

      {invited ? (
        <label className="field">
          <span>Invitation expiry</span>
          <input type="date" value={expiryDate} onChange={(event) => setExpiryDate(event.target.value)} />
        </label>
      ) : null}

      <label className="check-line">
        <input type="checkbox" required checked={consent} onChange={(event) => setConsent(event.target.checked)} />
        <span>
          {invited
            ? "The athlete supplied this code or authorised this pending invitation."
            : "The athlete supplied this code and accepted this connection."}
        </span>
      </label>

      {error ? <p role="status" className="muted small error">{error}</p> : null}
      {notice ? <p role="status" className="muted small">{notice}</p> : null}

      <button className="button primary" type="submit" disabled={submitting}>Record relationship</button>
    </form>
  );
}
