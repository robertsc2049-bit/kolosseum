import React, { useState } from "react";

import { useCoachBroadcast } from "./useCoachBroadcast";

// DEV NOTE: ported from index.html's #coachBroadcastForm ("Broadcast /
// Message all athletes").
export function CoachBroadcastPanel() {
  const { submitting, sentSummary, readStatus, send, refresh } = useCoachBroadcast();
  const [bodyText, setBodyText] = useState("");

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const ok = await send(bodyText);
    if (ok) setBodyText("");
  }

  return (
    <form className="panel form-panel" onSubmit={(event) => { handleSubmit(event).catch(() => {}); }}>
      <div>
        <p className="eyebrow">Broadcast</p>
        <h3>Message all athletes</h3>
        <p className="muted small">
          Sends the same message into every accepted athlete's thread
          right now - the same as sending it to each one individually.
        </p>
      </div>

      <label className="field">
        <span>Message</span>
        <textarea
          maxLength={4000}
          required
          value={bodyText}
          onChange={(event) => setBodyText(event.target.value)}
        />
      </label>

      <button className="button primary" type="submit" disabled={submitting}>Send to all athletes</button>

      {sentSummary ? <p role="status" className="muted small">{sentSummary}</p> : null}

      {readStatus ? (
        <div className="broadcast-read-status">
          <div className="inline-controls">
            <span className="muted small">
              Read by {readStatus.readCount} of {readStatus.sentCount} athlete{readStatus.sentCount === 1 ? "" : "s"}.
            </span>
            <button
              type="button"
              className="button secondary small-button"
              onClick={() => { refresh().catch(() => {}); }}
            >
              Refresh
            </button>
          </div>
          <ul className="broadcast-read-list">
            {readStatus.athletes.map((entry) => (
              <li key={entry.athlete_user_id}>
                <span className={`badge ${entry.read ? "complete" : "neutral"}`}>{entry.read ? "Read" : "Unread"}</span>
                {" "}
                {entry.display_name}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </form>
  );
}
