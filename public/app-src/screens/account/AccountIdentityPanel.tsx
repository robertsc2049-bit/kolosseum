import React, { useEffect, useState } from "react";

import { AccountClosurePanel } from "./AccountClosurePanel";
import { ConsentHistoryPanel } from "./ConsentHistoryPanel";
import { EmailVerificationPanel } from "./EmailVerificationPanel";
import { PasswordForm } from "./PasswordForm";
import { ProfileForm } from "./ProfileForm";
import { SignOutPanel } from "./SignOutPanel";
import { useAccountDetail } from "./useAccountDetail";

// DEV NOTE: legacy route_bootstrap.js already dispatches this event on every
// route resolution (see applyCurrentProductRoute). Listening for it here,
// rather than adding a parallel router, is how this island learns when the
// shared_account route becomes active - so its data is refetched each time
// the user navigates back to #/account, not only once at page load.
const ROUTE_CHANGE_EVENT = "kolosseum:route-change";

export function AccountIdentityPanel() {
  const [refreshToken, setRefreshToken] = useState(0);
  const { loading, error, account, terms, consentHistory, csrfToken, refresh } =
    useAccountDetail(refreshToken);

  useEffect(() => {
    function handleRouteChange(event: Event) {
      const detail = (event as CustomEvent).detail as { route_id?: string } | undefined;
      if (detail?.route_id === "shared_account") {
        setRefreshToken((current) => current + 1);
      }
    }

    document.addEventListener(ROUTE_CHANGE_EVENT, handleRouteChange);
    return () => document.removeEventListener(ROUTE_CHANGE_EVENT, handleRouteChange);
  }, []);

  // DEV NOTE: sign-out/closure render unconditionally, even while loading or
  // errored - unlike the rest of this panel's identity data, being able to
  // leave the account never depended on this fetch succeeding (legacy's
  // static buttons worked the same way, independent of any account-detail
  // fetch status).
  if (loading && !account) {
    return (
      <>
        <div className="panel form-panel">
          <p className="muted">Loading account settings…</p>
        </div>
        <SignOutPanel csrfToken={csrfToken} />
        <AccountClosurePanel csrfToken={csrfToken} />
      </>
    );
  }

  if (error) {
    return (
      <>
        <div className="panel form-panel">
          <p role="status" className="muted small error">{error}</p>
          <button className="button secondary" type="button" onClick={() => refresh()}>
            Retry
          </button>
        </div>
        <SignOutPanel csrfToken={csrfToken} />
        <AccountClosurePanel csrfToken={csrfToken} />
      </>
    );
  }

  return (
    <>
      <ProfileForm account={account} csrfToken={csrfToken} onSaved={() => refresh()} />
      <EmailVerificationPanel
        emailVerified={account?.email_verified === true}
        csrfToken={csrfToken}
        onVerified={() => refresh()}
      />
      <PasswordForm csrfToken={csrfToken} />
      <ConsentHistoryPanel account={account} terms={terms} consentHistory={consentHistory} />
      <SignOutPanel csrfToken={csrfToken} />
      <AccountClosurePanel csrfToken={csrfToken} />
    </>
  );
}
