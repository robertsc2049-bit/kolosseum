import { useEffect, useState } from "react";

import { useAccountDetail } from "./useAccountDetail";

// DEV NOTE: FULL-UI-02 the #view-account header (avatar/name/email/role/
// state/verification badges) and the "Account code" card - ported from
// app.js's renderAccount()'s badge/avatar/code logic, which ProfileForm.tsx's
// own DEV NOTE explicitly deferred when the rest of the identity form
// migrated. Reuses the same useAccountDetail hook AccountIdentityPanel.tsx
// uses - a second, independent fetch since this mounts into a separate DOM
// root, matching that hook's own documented "a second, redundant fetch...
// is accepted as harmless" tradeoff. Refetches on
// kolosseum:account-identity-updated (ProfileForm.tsx's own post-save
// signal) and kolosseum:account-detail-refreshed (dispatched by app.js's
// loadPersistentAccountDetail(), covering both the "Refresh account" button
// and account-view entry).
const IDENTITY_UPDATED_EVENT = "kolosseum:account-identity-updated";
const DETAIL_REFRESHED_EVENT = "kolosseum:account-detail-refreshed";

export function useAccountIdentityHeader() {
  const [refreshToken, setRefreshToken] = useState(0);
  const state = useAccountDetail(refreshToken);

  useEffect(() => {
    function bump() {
      setRefreshToken((current) => current + 1);
    }
    document.addEventListener(IDENTITY_UPDATED_EVENT, bump);
    document.addEventListener(DETAIL_REFRESHED_EVENT, bump);
    return () => {
      document.removeEventListener(IDENTITY_UPDATED_EVENT, bump);
      document.removeEventListener(DETAIL_REFRESHED_EVENT, bump);
    };
  }, []);

  return state;
}
