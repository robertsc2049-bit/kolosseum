import React, { useState } from "react";

import { useInviteAthleteByEmail } from "./useInviteAthleteByEmail";
import { CoachingRequestsPanel } from "./CoachingRequestsPanel";

// DEV NOTE: ported from index.html's #inviteAthleteByEmailForm ("Lawful
// invitation / Invite athlete by email").
export function InviteAthleteByEmailPanel() {
  const { submitting, error, notice, invite } = useInviteAthleteByEmail();
  const [email, setEmail] = useState("");

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const ok = await invite(email);
    if (ok) setEmail("");
  }

  return (
    <>
    <CoachingRequestsPanel />
    <form className="panel form-panel" onSubmit={(event) => { handleSubmit(event).catch(() => {}); }}>
      <div>
        <p className="eyebrow">Invite</p>
        <h3>Invite an athlete by email</h3>
        <p className="muted small">
          They'll see the invitation when they sign in, and join your
          roster once they accept.
        </p>
      </div>

      <label className="field">
        <span>Athlete email</span>
        <input
          type="email"
          required
          autoComplete="off"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
      </label>

      {error ? <p role="status" className="muted small error">{error}</p> : null}
      {notice ? <p role="status" className="muted small">{notice}</p> : null}

      <button className="button primary" type="submit" disabled={submitting}>Send invitation</button>
    </form>
    </>
  );
}
