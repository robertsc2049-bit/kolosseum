// DEV NOTE: FULL-UI-03C server-backed athlete onboarding. The wizard/
// completed-declaration rendering moved to React - see
// public/app-src/screens/athlete/AthleteOnboardingPanel.tsx/
// useAthleteOnboarding.ts, mounted at #athlete-onboarding-root
// (public/app/index.html's #view-onboarding section and the
// #athleteOnboardingNav sidebar button are now static markup there,
// matching every other screen, instead of being created here at runtime).
// This file keeps only what route_bootstrap.js needs to import as a plain,
// non-bundled ES module: resolveAthleteOnboardingGate() (the onboarding
// gate every athlete route resolution runs, which cannot live in the React
// bundle) and its dependencies, plus openAthleteOnboardingView()/
// installAthleteOnboardingUi() - the same lightweight view-switching and
// nav-button/reload-guard wiring the route resolver already called before,
// trimmed of the DOM-creation logic that's no longer needed now the markup
// is static. Browser state is presentation-only; completion and history
// come from the server.

const STORAGE_KEY = "kolosseum.product.app.v1";
const ROUTE = "#/athlete/onboarding";
const RELOAD_KEY = "kolosseum.athlete_onboarding.reload_required";
const INSTRUCTION_DENSITIES = ["minimal", "standard", "detailed"];
let installed = false;

function stored() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null") ?? {}; }
  catch { return {}; }
}
async function request(method, path, body) {
  const headers = {};
  if (body !== undefined) headers["content-type"] = "application/json";
  if (!['GET', 'HEAD'].includes(method)) {
    const csrf = String(stored().csrfToken ?? "");
    if (csrf) headers["x-kolosseum-csrf"] = csrf;
  }
  const response = await fetch(path, {
    method, credentials: "same-origin", headers,
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const text = await response.text().catch(() => "");
  let payload = null;
  try { payload = text ? JSON.parse(text) : null; }
  catch { payload = { raw: text }; }
  if (!response.ok) {
    const error = new Error(String(payload?.error ?? `athlete_onboarding_request_${response.status}`));
    error.status = response.status;
    error.payload = payload;
    throw error;
  }
  return payload;
}

export const loadAthleteOnboardingState = () => request("GET", "/account/onboarding/");

function accessibility(value = {}) {
  return {
    reduced_motion: value.reduced_motion === true,
    high_contrast: value.high_contrast === true,
    larger_text: value.larger_text === true,
    screen_reader_optimised: value.screen_reader_optimised === true
  };
}

// Applies the athlete's declared presentation preferences to the live page via
// data attributes on <html>, matched by CSS in styles.css (accessibility) and
// read directly by app.js's exercise-howto renderer (instruction density).
// This is the only place a declared preference is allowed to change how
// anything is styled or how much written content is shown - it never reads
// or writes ability/safety/readiness fields. AthleteOnboardingPanel.tsx has
// its own copy of this same function, applied immediately after a same-tab
// confirm/save rather than waiting for the next route resolution.
function applyAccessibilityPreferences(fields) {
  if (typeof document === "undefined") return;
  const a = accessibility(fields?.accessibility_preferences);
  const root = document.documentElement;
  root.dataset.a11yReducedMotion = String(a.reduced_motion);
  root.dataset.a11yHighContrast = String(a.high_contrast);
  root.dataset.a11yLargerText = String(a.larger_text);
  root.dataset.a11yScreenReaderOptimised = String(a.screen_reader_optimised);
  root.dataset.instructionDensity = INSTRUCTION_DENSITIES.includes(fields?.instruction_density)
    ? fields.instruction_density
    : "standard";
}

function visible() {
  for (const view of document.querySelectorAll(".view")) view.hidden = view.id !== "view-onboarding";
  for (const button of document.querySelectorAll(".nav-item")) button.classList.toggle("active", button.id === "athleteOnboardingNav");
  const title = document.getElementById("topbarTitle");
  if (title) title.textContent = "Declarations";
  document.getElementById("sidebar")?.classList.remove("open");
}

export async function openAthleteOnboardingView() {
  visible();
}

export async function resolveAthleteOnboardingGate() {
  try {
    const result = await loadAthleteOnboardingState();
    applyAccessibilityPreferences(result.current_effective_declaration?.fields);
    return result;
  }
  catch (error) { if (error?.status === 401) return null; throw error; }
}

// DEV NOTE: the #athleteOnboardingNav button is static markup now (see
// index.html), but deliberately has no [data-view] attribute - giving it
// one would bind app.js's generic setView() handler too, and "onboarding"
// is not in renderRoleNavigation()'s athlete permittedViews set, so a
// same-tab click would render correctly once but then get silently reset
// back to "today" the next time that function runs. This bespoke click
// handler (matching the route pushState + view-switch this file's own
// dynamic button used before static markup) avoids that entirely.
export function installAthleteOnboardingUi() {
  if (installed || typeof document === "undefined") return;
  installed = true;

  document.getElementById("athleteOnboardingNav")?.addEventListener("click", () => {
    if (location.hash !== ROUTE) history.pushState({ kolosseum_route: ROUTE }, "", ROUTE);
    void openAthleteOnboardingView();
  });

  // A full page navigation (not a SPA hash change) after confirming
  // onboarding or saving preferences, so legacy app.js's own cached
  // state/elements fully re-initialise against the now-completed
  // onboarding status rather than continuing to run against whatever they
  // read before completion.
  document.addEventListener("click", (event) => {
    if (sessionStorage.getItem(RELOAD_KEY) !== "1") return;
    const control = event.target.closest("[data-view], [data-view-link]");
    const view = control?.dataset.view ?? control?.dataset.viewLink;
    if (!view || view === "onboarding" || view === "account") return;
    event.preventDefault(); event.stopImmediatePropagation();
    sessionStorage.removeItem(RELOAD_KEY);
    location.assign(view === "history" ? "/app/#/athlete/history" : "/app/#/athlete/today");
  }, true);
}
