import React, { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { AccountIdentityPanel } from "./screens/account/AccountIdentityPanel";
import { AthleteProgressInsightsPanel } from "./screens/coach/AthleteProgressInsightsPanel";
import { AthleteStrengthProfilePanel } from "./screens/coach/AthleteStrengthProfilePanel";
import { AthleteWeeklyCheckinsPanel } from "./screens/coach/AthleteWeeklyCheckinsPanel";

// DEV NOTE: mounts once at script load into divs that always exist in
// public/app/index.html (which the legacy router shows/hides unchanged -
// see each panel's own event listeners for how it learns when it becomes
// relevant). Do not mount other screens from this same entry point without
// first re-reading the migration plan's per-screen scoping.
function mount(containerId: string, node: React.ReactNode) {
  const container = document.getElementById(containerId);
  if (!container) return;
  createRoot(container).render(<StrictMode>{node}</StrictMode>);
}

mount("account-identity-root", <AccountIdentityPanel />);
mount("athlete-profile-editor-root", <AthleteStrengthProfilePanel />);
mount("athlete-progress-insights-root", <AthleteProgressInsightsPanel />);
mount("athlete-weekly-checkins-root", <AthleteWeeklyCheckinsPanel />);
