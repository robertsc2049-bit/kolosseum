// DEV NOTE: FULL-UI-65 coach branding preference UI. Coach-only settings
// panel on the Account view; the athlete-facing render of this same data
// (the "My coach" card's accent colour and tagline) lives in app.js,
// fed by coach_brand_color/coach_brand_tagline on the relationship
// payload - see relationship_invitation_service.ts's withCoachDisplay.

import {
  loadAccountDetail,
  loadCoachBrandPreference,
  saveCoachBrandPreference
} from "./account_ui.js";

const STORAGE_KEY = "kolosseum.product.app.v1";

const elements = {
  view: document.getElementById("view-account"),
  panel: document.getElementById("accountBrandingPanel"),
  form: document.getElementById("coachBrandingForm"),
  colorInput: document.getElementById("coachBrandColorInput"),
  taglineInput: document.getElementById("coachBrandTaglineInput"),
  status: document.getElementById("coachBrandingStatus"),
  preview: document.getElementById("coachBrandingPreview")
};

let busy = false;

function clean(value) {
  return String(value ?? "").trim();
}

function readRole() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}") ?? {};
    return clean(stored.role);
  }
  catch {
    return "";
  }
}

function showMessage(message, tone = "neutral") {
  if (!elements.status) return;
  elements.status.hidden = !message;
  elements.status.textContent = message;
  elements.status.dataset.tone = tone;
}

function errorMessage(error) {
  const code = clean(error?.payload?.error ?? error?.message ?? "coach_branding_request_failed");
  const messages = {
    coach_branding_coach_brand_color_invalid: "Choose a valid colour.",
    coach_branding_coach_brand_tagline_too_long: "Tagline must be 120 characters or fewer.",
    account_session_missing: "Sign in to edit branding.",
    account_session_invalid: "The sign-in session has expired."
  };
  return messages[code] ?? "Branding could not be saved.";
}

function renderPreview() {
  if (!elements.preview) return;
  const color = clean(elements.colorInput?.value) || "#d2a952";
  const tagline = clean(elements.taglineInput?.value);
  elements.preview.style.setProperty("--coach-brand-color", color);
  elements.preview.innerHTML = `
    <strong>Your athletes will see this next to your name</strong>
    ${tagline ? `<p class="muted small">${tagline.replace(/</gu, "&lt;")}</p>` : ""}
  `;
}

async function refreshBranding({ quiet = false } = {}) {
  if (!elements.panel) return;
  try {
    const payload = await loadCoachBrandPreference();
    const preference = payload?.brand_preference;
    if (preference && elements.colorInput) {
      elements.colorInput.value = clean(preference.brand_color) || "#d2a952";
    }
    if (preference && elements.taglineInput) {
      elements.taglineInput.value = clean(preference.brand_tagline);
    }
    renderPreview();
    if (!quiet) showMessage("Branding refreshed.", "success");
  }
  catch (error) {
    if (!quiet) showMessage(errorMessage(error), "error");
  }
}

async function saveBranding(event) {
  event.preventDefault();
  if (busy) return;
  busy = true;

  try {
    const detail = await loadAccountDetail();
    const csrfToken = clean(detail?.csrf_token);

    await saveCoachBrandPreference(
      {
        brand_color: clean(elements.colorInput?.value) || "#d2a952",
        brand_tagline: clean(elements.taglineInput?.value) || undefined
      },
      csrfToken
    );

    showMessage("Branding saved.", "success");
    renderPreview();
  }
  catch (error) {
    showMessage(errorMessage(error), "error");
  }
  finally {
    busy = false;
  }
}

function accountViewVisible() {
  return Boolean(elements.view && elements.view.hidden === false);
}

function activateBrandingView() {
  if (!elements.panel) return;

  const isCoach = readRole() === "coach";
  elements.panel.hidden = !isCoach;

  if (isCoach && accountViewVisible()) {
    void refreshBranding({ quiet: true });
  }
}

function initialise() {
  if (!elements.panel) return;

  elements.form?.addEventListener("submit", (event) => {
    void saveBranding(event);
  });

  elements.colorInput?.addEventListener("input", renderPreview);
  elements.taglineInput?.addEventListener("input", renderPreview);

  if (elements.view) {
    const observer = new MutationObserver(activateBrandingView);
    observer.observe(elements.view, { attributes: true, attributeFilter: ["hidden"] });
  }

  renderPreview();
  activateBrandingView();
}

initialise();
