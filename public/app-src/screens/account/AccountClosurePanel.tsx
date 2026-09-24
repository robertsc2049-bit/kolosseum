import React, { useState } from "react";

import { requestAccountClosure } from "../../api/client";
import { ACCOUNT_SESSION_ENDED_EVENT } from "./SignOutPanel";

// DEV NOTE: ported from app.js's closePersistentAccount() - on success,
// dispatches the same kolosseum:account-session-ended bridge SignOutPanel
// uses (legacy's resetAccountState()/redirect is shared by both flows). On
// failure (e.g. the confirmation text is rejected server-side), stays on
// the page and shows its own inline error instead - legacy's does not
// reset/redirect on failure either, since only a recorded closure request
// should end the session.
export function AccountClosurePanel({ csrfToken }: { csrfToken: string }) {
  const [confirmation, setConfirmation] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setResult(null);

    try {
      const response = await requestAccountClosure({ confirmation: confirmation.trim() }, csrfToken);
      setResult(`Closure request recorded: ${String(response.closure_request_id)}`);
      document.dispatchEvent(new CustomEvent(ACCOUNT_SESSION_ENDED_EVENT));
    }
    catch {
      setResult("Closure request could not be recorded. Check the confirmation text and try again.");
      setSubmitting(false);
    }
  }

  return (
    <form className="panel danger-panel closure-panel" onSubmit={handleSubmit}>
      <div>
        <h3>Close account</h3>
        <p className="muted">Type CLOSE to request account closure and revoke every active session.</p>
      </div>

      <div className="closure-controls">
        <input
          autoComplete="off"
          placeholder="Type CLOSE"
          required
          value={confirmation}
          onChange={(event) => setConfirmation(event.target.value)}
        />
        <button className="button danger" type="submit" disabled={submitting}>Request closure</button>
      </div>

      {result ? <p className="inline-result">{result}</p> : null}
    </form>
  );
}
