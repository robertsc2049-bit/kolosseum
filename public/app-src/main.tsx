import React, { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { AccountIdentityPanel } from "./screens/account/AccountIdentityPanel";

// DEV NOTE: mounts once at script load into a div that always exists in
// public/app/index.html's #view-account section (which the legacy router
// shows/hides unchanged - see AccountIdentityPanel's route-change listener
// for how this island learns when it becomes the active view). Do not
// mount other screens from this same entry point without first re-reading
// the migration plan's per-screen scoping.
const container = document.getElementById("account-identity-root");
if (container) {
  createRoot(container).render(
    <StrictMode>
      <AccountIdentityPanel />
    </StrictMode>
  );
}
