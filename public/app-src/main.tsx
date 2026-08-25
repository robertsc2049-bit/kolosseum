import React, { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { AccountIdentityPanel } from "./screens/account/AccountIdentityPanel";
import { AthleteBodyMetricsPanel } from "./screens/coach/AthleteBodyMetricsPanel";
import { AthleteCoachNotesPanel } from "./screens/coach/AthleteCoachNotesPanel";
import { AthleteDeviceSyncPanel } from "./screens/coach/AthleteDeviceSyncPanel";
import { AthleteGoalsPanel } from "./screens/coach/AthleteGoalsPanel";
import { AthleteNutritionPanel } from "./screens/coach/AthleteNutritionPanel";
import { AthleteOrgMessagesPanel } from "./screens/coach/AthleteOrgMessagesPanel";
import { AthleteProgressInsightsPanel } from "./screens/coach/AthleteProgressInsightsPanel";
import { AthleteProgressPhotosPanel } from "./screens/coach/AthleteProgressPhotosPanel";
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
mount("athlete-goals-root", <AthleteGoalsPanel />);
mount("athlete-device-sync-root", <AthleteDeviceSyncPanel />);
mount("athlete-body-metrics-root", <AthleteBodyMetricsPanel />);
mount("athlete-nutrition-root", <AthleteNutritionPanel />);
mount("athlete-progress-photos-root", <AthleteProgressPhotosPanel />);
mount("athlete-coach-notes-root", <AthleteCoachNotesPanel />);
mount("athlete-org-messages-root", <AthleteOrgMessagesPanel />);
