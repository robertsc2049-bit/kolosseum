import React, { useState } from "react";

import { ActivityCategoryFilter } from "../../components/ActivityCategoryFilter";
import { useConnectAthlete } from "./useConnectAthlete";

// DEV NOTE: ported from index.html's #connectAthleteForm ("Relationship
// record / Add athlete") - the manual, account-code-based relationship
// form. See useConnectAthlete.ts for the mutation + cross-stack refresh
// wiring.

export function ConnectAthletePanel() {
  const { submitting, error, connect } = useConnectAthlete();
  const [displayName, setDisplayName] = useState("");
  const [athleteUserId, setAthleteUserId] = useState("");
  const [activityId, setActivityId] = useState<string>("powerlifting");
  const [expiryDate, setExpiryDate] = useState("");
  const [consent, setConsent] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  // Invite only: the athlete accepts it themselves, signed in to their own
  // account. A coach can never record a connection as already accepted.

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!consent) return;

    const ok = await connect({
      athleteUserId: athleteUserId.trim(),
      displayName: displayName.trim(),
      activityId,
      relationshipState: "invited",
      expiryDate
    });

    if (ok) {
      setNotice(`Invitation sent to ${displayName.trim()}. You're connected once they accept it in their app.`);
      setDisplayName("");
      setAthleteUserId("");
      setActivityId("powerlifting");
      setExpiryDate("");
      setConsent(false);
    }
  }

  return (
    <form className="panel form-panel" onSubmit={(event) => { handleSubmit(event).catch(() => {}); }}>
      <div>
        <p className="eyebrow">Account code</p>
        <h3>Invite an athlete by account code</h3>
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

      <ActivityCategoryFilter value={activityId} onChange={setActivityId} sportLabel="Activity" />

      <label className="field">
        <span>Invitation expiry (optional)</span>
        <input type="date" value={expiryDate} onChange={(event) => setExpiryDate(event.target.value)} />
      </label>

      <label className="check-line">
        <input type="checkbox" required checked={consent} onChange={(event) => setConsent(event.target.checked)} />
        <span>
The athlete gave me this code and expects my invitation.
        </span>
      </label>

      {error ? <p role="status" className="muted small error">{error}</p> : null}
      {notice ? <p role="status" className="muted small">{notice}</p> : null}

      <button className="button primary" type="submit" disabled={submitting}>Send invitation</button>
    </form>
  );
}
