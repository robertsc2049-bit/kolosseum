import React, { useState } from "react";

import { useInviteAthleteByEmail } from "./useInviteAthleteByEmail";

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
    <form className="panel form-panel" onSubmit={(event) => { handleSubmit(event).catch(() => {}); }}>
      <div>
        <p className="eyebrow">Lawful invitation</p>
        <h3>Invite athlete by email</h3>
        <p className="muted small">
          The athlete receives this invitation in their own account and
          accepts it themselves - no account code is exchanged.
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
  );
}
