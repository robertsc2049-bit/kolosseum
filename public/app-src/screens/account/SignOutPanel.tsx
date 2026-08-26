import React, { useState } from "react";

import { signOutAccount } from "../../api/client";

// DEV NOTE: dispatched whether the sign-out request succeeds or fails -
// legacy's clearLocalSession() clears local session state and redirects in
// a `finally` block regardless, since the goal (this browser no longer
// acting as this account) holds even if the server-side revoke call
// itself failed. See app.js's listener for this event.
export const ACCOUNT_SESSION_ENDED_EVENT = "kolosseum:account-session-ended";

export function SignOutPanel({ csrfToken }: { csrfToken: string }) {
  const [signingOut, setSigningOut] = useState(false);

  async function handleSignOut() {
    if (signingOut) return;
    setSigningOut(true);
    try {
      if (csrfToken) await signOutAccount(csrfToken);
    }
    catch {
      // Ending the session locally does not depend on the server-side
      // revoke call succeeding - see the DEV NOTE above.
    }
    finally {
      document.dispatchEvent(new CustomEvent(ACCOUNT_SESSION_ENDED_EVENT));
    }
  }

  return (
    <article className="panel danger-panel">
      <div>
        <h3>Sign out</h3>
        <p className="muted">Revokes this server session and clears local browser identity.</p>
      </div>
      <button className="button danger" type="button" disabled={signingOut} onClick={() => handleSignOut()}>Sign out</button>
    </article>
  );
}
