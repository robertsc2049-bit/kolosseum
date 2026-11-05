import React, { useState } from "react";

import { REPORT_REASONS, blockUser, reportMessage } from "../api/messageSafetyClient";
import { type JsonRecord } from "../api/transport";

// Under a message you received: report it to Kolosseum, or block the person
// who sent it (their messages stop reaching you; unblock under Account).
// Nothing is shown under your own messages or a message already removed.
export function MessageSafetyActions({ message, received }: { message: JsonRecord; received: boolean }) {
  const [mode, setMode] = useState<"idle" | "report" | "block">("idle");
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [blocked, setBlocked] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!received || message.removed === true) return null;
  const messageId = String(message.message_id ?? "");
  const senderId = String(message.sender_user_id ?? "");

  async function submitReport(event: React.FormEvent) {
    event.preventDefault();
    if (!reason) {
      setError("Choose a reason.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await reportMessage(messageId, reason, note);
      setDone("Reported - thank you. Kolosseum will look at it and let you know the outcome.");
      setMode("idle");
    }
    catch {
      setError("Your report could not be sent. Try again.");
    }
    finally {
      setBusy(false);
    }
  }

  async function confirmBlock() {
    setBusy(true);
    setError(null);
    try {
      await blockUser(senderId);
      setBlocked(true);
      setDone("Blocked. Their messages won't reach you. You can unblock them under Account, Blocked people.");
      setMode("idle");
    }
    catch {
      setError("They could not be blocked. Try again.");
    }
    finally {
      setBusy(false);
    }
  }

  // After a report, blocking the sender is still offered.
  if (done && (blocked || mode !== "block")) {
    return (
      <div className="message-safety">
        <p className="muted small message-safety-done" role="status">{done}</p>
        {!blocked && mode === "idle" ? (
          <div className="message-safety-actions">
            <button className="text-button small" type="button" onClick={() => setMode("block")}>Block</button>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="message-safety">
      {mode === "idle" ? (
        <div className="message-safety-actions">
          <button className="text-button small" type="button" onClick={() => setMode("report")}>Report</button>
          <button className="text-button small" type="button" onClick={() => setMode("block")}>Block</button>
        </div>
      ) : null}
      {mode === "report" ? (
        <form className="message-safety-form" onSubmit={(event) => { submitReport(event).catch(() => {}); }}>
          <fieldset>
            <legend>Why are you reporting this message?</legend>
            {REPORT_REASONS.map(([value, label]) => (
              <label className="radio-field" key={value}>
                <input type="radio" name={`report-reason-${messageId}`} value={value} checked={reason === value} onChange={() => setReason(value)} />
                <span>{label}</span>
              </label>
            ))}
          </fieldset>
          <label className="field">
            <span>Anything else we should know (optional)</span>
            <textarea maxLength={1000} value={note} onChange={(event) => setNote(event.target.value)}></textarea>
          </label>
          <p className="muted small">The person who sent it isn't told who reported it. If you're in danger, call 999.</p>
          {error ? <p className="field-error" role="alert">{error}</p> : null}
          <div className="inline-controls">
            <button className="button secondary" type="button" onClick={() => { setMode("idle"); setError(null); }}>Cancel</button>
            <button className="button primary" type="submit" disabled={busy}>Send report</button>
          </div>
        </form>
      ) : null}
      {mode === "block" ? (
        <div className="message-safety-form">
          <p>Block this person? Their messages, including group messages, won't reach you. You can still message them, and nothing else changes - you can end a coaching relationship separately.</p>
          {error ? <p className="field-error" role="alert">{error}</p> : null}
          <div className="inline-controls">
            <button className="button secondary" type="button" onClick={() => { setMode("idle"); setError(null); }}>Cancel</button>
            <button className="button primary" type="button" disabled={busy} onClick={() => { confirmBlock().catch(() => {}); }}>Block</button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
