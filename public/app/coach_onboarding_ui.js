// DEV NOTE: FULL-UI-04C server-backed coach onboarding. The profile/terms/
// completion rendering moved to React - see
// public/app-src/screens/coach/CoachOnboardingPanel.tsx/
// useCoachOnboarding.ts, mounted at #coach-onboarding-root
// (public/app/index.html's #view-coach-onboarding section and the
// #coachOnboardingNav sidebar button are now static markup there, matching
// every other screen, instead of being created here at runtime). This file
// keeps only what route_bootstrap.js needs to import as a plain,
// non-bundled ES module: resolveCoachOnboardingGate() (the onboarding gate
// every coach route resolution runs, which cannot live in the React
// bundle) and its dependency, plus openCoachOnboardingView() - the same
// lightweight view-switching route_bootstrap.js already called before,
// trimmed of the DOM-creation/rendering logic that's no longer needed now
// the markup is static and the nav button ("coach-onboarding" is a
// permitted coach view) is picked up by app.js's generic [data-view] click
// binding without a bespoke handler. Browser state is presentation-only;
// completion and history come from the server.

import { loadCoachOnboardingState } from "./account_ui.js";

function visible() {
  for (const section of document.querySelectorAll(".view")) section.hidden = section.id !== "view-coach-onboarding";
  for (const navigation of document.querySelectorAll(".nav-item")) navigation.classList.toggle("active", navigation.id === "coachOnboardingNav");
  document.getElementById("sidebar")?.classList.remove("open");
}

export function installCoachOnboardingUi() {
  // Static markup + app.js's generic [data-view] click binding already
  // wire the nav button - nothing left to install at runtime.
}

export async function resolveCoachOnboardingGate() {
  try {
    return await loadCoachOnboardingState();
  }
  catch (error) {
    if (error?.status === 401) return null;
    throw error;
  }
}

export async function openCoachOnboardingView() {
  visible();
}
