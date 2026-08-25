import React, { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { AccountIdentityPanel } from "./screens/account/AccountIdentityPanel";
import { AthleteStrengthProfilePanel } from "./screens/coach/AthleteStrengthProfilePanel";

// DEV NOTE: mounts once at script load into divs that always exist in
// public/app/index.html (which the legacy router shows/hides unchanged -
// see each panel's own event listeners for how it learns when it becomes
// relevant). Do not mount other screens from this same entry point without
// first re-reading the migration plan's per-screen scoping.
const accountContainer = document.getElementById("account-identity-root");
if (accountContainer) {
  createRoot(accountContainer).render(
    <StrictMode>
      <AccountIdentityPanel />
    </StrictMode>
  );
}

const athleteProfileContainer = document.getElementById("athlete-profile-editor-root");
if (athleteProfileContainer) {
  createRoot(athleteProfileContainer).render(
    <StrictMode>
      <AthleteStrengthProfilePanel />
    </StrictMode>
  );
}
