// DEV NOTE: FULL-UI-04C coach onboarding behavioral proof - replaces the
// source-text checks test/full_ui_04c_coach_commercial.test.mjs previously
// ran against the now-removed public/app/coach_onboarding_ui.js rendering
// functions.
import assert from "node:assert/strict";
import test from "node:test";

import React from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";

import { CoachOnboardingPanel } from "../screens/coach/CoachOnboardingPanel";

function jsonResponse(body: unknown, ok = true, status = ok ? 200 : 400): Response {
  return { ok, status, text: async () => JSON.stringify(body) } as Response;
}

type ServerState = Record<string, unknown>;

function baseState(overrides: Record<string, unknown> = {}): ServerState {
  return {
    onboarding_status: "incomplete",
    current_stage: "profile",
    profile: {},
    current_terms_version: "terms_v1",
    terms_accepted: false,
    accepted_terms_version: null,
    history: [],
    ...overrides
  };
}

function installMocks(options: {
  initialState?: ServerState;
  onSaveProfile?: (body: Record<string, unknown>) => ServerState;
  onAcceptTerms?: (body: Record<string, unknown>) => ServerState;
  onSaveAccessibility?: (body: Record<string, unknown>) => ServerState;
  onComplete?: () => ServerState;
}) {
  const { initialState = baseState(), onSaveProfile, onAcceptTerms, onSaveAccessibility, onComplete } = options;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = String(input);
    if (path.startsWith("/account/detail")) return jsonResponse({ account: { user_id: "coach_1" }, csrf_token: "csrf" });
    if (path === "/account/coach-onboarding" && (!init || init.method === undefined || init.method === "GET")) {
      return jsonResponse(initialState);
    }
    if (path === "/account/coach-onboarding/profile") {
      const body = JSON.parse(String(init?.body ?? "{}"));
      const result = onSaveProfile ? onSaveProfile(body) : baseState({ current_stage: "terms", profile: body });
      return jsonResponse(result);
    }
    if (path === "/account/coach-onboarding/terms") {
      const body = JSON.parse(String(init?.body ?? "{}"));
      const result = onAcceptTerms ? onAcceptTerms(body) : baseState({
        current_stage: "accessibility",
        terms_accepted: true,
        accepted_terms_version: body.terms_version
      });
      return jsonResponse(result);
    }
    if (path === "/account/coach-onboarding/accessibility") {
      const body = JSON.parse(String(init?.body ?? "{}"));
      const result = onSaveAccessibility ? onSaveAccessibility(body) : baseState({
        current_stage: "review",
        terms_accepted: true,
        accessibility_preferences: body.accessibility_preferences
      });
      return jsonResponse(result);
    }
    if (path === "/account/coach-onboarding/complete") {
      const result = onComplete ? onComplete() : baseState({ onboarding_status: "completed" });
      return jsonResponse(result);
    }
    return jsonResponse({ error: `unhandled_request_${path}` }, false, 404);
  }) as typeof fetch;
}

test.afterEach(() => {
  cleanup();
  delete document.documentElement.dataset.a11yReducedMotion;
  delete document.documentElement.dataset.a11yHighContrast;
  delete document.documentElement.dataset.a11yLargerText;
  delete document.documentElement.dataset.a11yScreenReaderOptimised;
});

test("shows the incomplete-onboarding status and the profile stage on first load", async () => {
  installMocks({});
  render(<CoachOnboardingPanel />);
  await screen.findByText("Incomplete onboarding");
  assert.ok(screen.getByText("Current step: Profile"));
  assert.ok(screen.getByText("Identity details"));
});

test("shows the unavailable state on a load failure, with a working retry", async () => {
  let fail = true;
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const path = String(input);
    if (path.startsWith("/account/detail")) return jsonResponse({ account: { user_id: "coach_1" }, csrf_token: "csrf" });
    if (path === "/account/coach-onboarding") {
      return fail ? jsonResponse({ error: "coach_onboarding_coach_required" }, false, 403) : jsonResponse(baseState());
    }
    return jsonResponse({ error: "unhandled" }, false, 404);
  }) as typeof fetch;

  render(<CoachOnboardingPanel />);
  await screen.findByText("Coach onboarding is available to coach accounts only.");

  fail = false;
  await act(async () => {
    screen.getByText("Retry").click();
  });

  await screen.findByText("Incomplete onboarding");
});

test("saving the profile moves to the terms stage and shows a confirmation and history entry", async () => {
  installMocks({
    onSaveProfile: (body) => baseState({
      current_stage: "terms",
      profile: body,
      history: [{ event_type: "coach_onboarding_profile_saved", occurred_at_iso8601: "2026-08-28T10:00:00.000Z" }]
    })
  });
  render(<CoachOnboardingPanel />);
  await screen.findByText("Identity details");

  fireEvent.change(screen.getByLabelText("Display name"), { target: { value: "Coach Test" } });
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: "coach@example.test" } });
  await act(async () => {
    fireEvent.click(screen.getByText("Save coach profile"));
  });

  await screen.findByText("Coach profile saved.");
  assert.ok(screen.getByText("Explicit acceptance"));
  assert.ok(screen.getByText("Coach Onboarding Profile Saved"));
});

test("accepting terms sends the current terms version and moves to the review stage", async () => {
  let sentTermsVersion: unknown = null;
  installMocks({
    initialState: baseState({ current_stage: "terms", current_terms_version: "terms_v7" }),
    onAcceptTerms: (body) => {
      sentTermsVersion = body.terms_version;
      return baseState({ current_stage: "review", terms_accepted: true, accepted_terms_version: body.terms_version as string });
    }
  });
  render(<CoachOnboardingPanel />);
  await screen.findByText("Explicit acceptance");
  assert.ok(screen.getByText("Current version: terms_v7"));

  fireEvent.click(screen.getByLabelText(/I accept the current coach terms/u));
  await act(async () => {
    fireEvent.click(screen.getByText("Accept coach terms"));
  });

  await screen.findByText("Coach terms accepted.");
  assert.equal(sentTermsVersion, "terms_v7");
  assert.ok(screen.getByText("Confirm coach onboarding"));
});

test("saving accessibility preferences moves to the review stage and shows a confirmation", async () => {
  installMocks({
    initialState: baseState({ current_stage: "accessibility", terms_accepted: true })
  });
  render(<CoachOnboardingPanel />);
  await screen.findByText("Presentation preferences");

  fireEvent.click(screen.getByText("Higher contrast"));
  await act(async () => {
    fireEvent.click(screen.getByText("Save accessibility preferences"));
  });

  await screen.findByText("Accessibility preferences saved.");
  assert.ok(screen.getByText("Confirm coach onboarding"));
});

test("declared accessibility preferences are actually applied to the page immediately after saving", async () => {
  // Same bug class as PR #865: a declared, validated, stored preference
  // with no downstream effect. Must be visible on <html> right after
  // save, not only after the next route resolution.
  installMocks({
    initialState: baseState({ current_stage: "accessibility", terms_accepted: true }),
    onSaveAccessibility: (body) => baseState({
      current_stage: "review",
      terms_accepted: true,
      accessibility_preferences: body.accessibility_preferences
    })
  });
  render(<CoachOnboardingPanel />);
  await screen.findByText("Presentation preferences");

  fireEvent.click(screen.getByText("Reduce motion"));
  fireEvent.click(screen.getByText("Screen-reader optimised"));
  await act(async () => {
    fireEvent.click(screen.getByText("Save accessibility preferences"));
  });

  await screen.findByText("Accessibility preferences saved.");
  assert.equal(document.documentElement.dataset.a11yReducedMotion, "true");
  assert.equal(document.documentElement.dataset.a11yHighContrast, "false");
  assert.equal(document.documentElement.dataset.a11yLargerText, "false");
  assert.equal(document.documentElement.dataset.a11yScreenReaderOptimised, "true");
});

test("the review stage shows the saved profile, accepted terms and accessibility preferences, and completing shows the completed panel", async () => {
  installMocks({
    initialState: baseState({
      current_stage: "review",
      profile: { display_name: "Coach Review Test", email: "review@example.test" },
      terms_accepted: true,
      accepted_terms_version: "terms_v3",
      accessibility_preferences: { reduced_motion: true, high_contrast: false, larger_text: false, screen_reader_optimised: false }
    }),
    onComplete: () => baseState({
      onboarding_status: "completed",
      profile: { display_name: "Coach Review Test", email: "review@example.test" },
      terms_accepted: true,
      accepted_terms_version: "terms_v3"
    })
  });
  render(<CoachOnboardingPanel />);
  await screen.findByText("Confirm coach onboarding");
  assert.ok(screen.getByText("Coach Review Test"));
  assert.ok(screen.getByText("terms_v3"));
  assert.ok(screen.getByText("reduced motion"));

  await act(async () => {
    fireEvent.click(screen.getByText("Complete coach onboarding"));
  });

  await screen.findByText("Coach workspace available");
  assert.ok(screen.getByText("Open coach workspace"));
  assert.ok(screen.getByText("Update coach profile"));
  assert.ok(screen.getByText("Open commercial account"));
});

test("completing onboarding navigates to the coach workspace route", async () => {
  installMocks({
    initialState: baseState({ current_stage: "review" }),
    onComplete: () => baseState({ onboarding_status: "completed" })
  });
  render(<CoachOnboardingPanel />);
  await screen.findByText("Confirm coach onboarding");

  await act(async () => {
    fireEvent.click(screen.getByText("Complete coach onboarding"));
  });

  await screen.findByText("Coach workspace available");
  assert.equal(window.location.hash, "#/coach/overview");
  window.location.hash = "";
});

test("the completed view keeps the profile and accessibility forms visible for editing, alongside the completed panel", async () => {
  installMocks({
    initialState: baseState({
      onboarding_status: "completed",
      profile: { display_name: "Coach Completed", email: "completed@example.test" },
      terms_accepted: true,
      accessibility_preferences: { reduced_motion: true, high_contrast: false, larger_text: false, screen_reader_optimised: false }
    })
  });
  render(<CoachOnboardingPanel />);
  await screen.findByText("Coach workspace available");

  assert.ok(screen.getByText("Identity details"));
  assert.equal((screen.getByLabelText("Display name") as HTMLInputElement).value, "Coach Completed");
  assert.ok(screen.getByText("Presentation preferences"));
});

test("a validation failure on saving the profile shows a mapped error and does not advance the stage", async () => {
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = String(input);
    if (path.startsWith("/account/detail")) return jsonResponse({ account: { user_id: "coach_1" }, csrf_token: "csrf" });
    if (path === "/account/coach-onboarding" && (!init || init.method === undefined || init.method === "GET")) return jsonResponse(baseState());
    if (path === "/account/coach-onboarding/profile") {
      return jsonResponse({ error: "coach_onboarding_profile_invalid" }, false, 422);
    }
    return jsonResponse({ error: "unhandled" }, false, 404);
  }) as typeof fetch;

  render(<CoachOnboardingPanel />);
  await screen.findByText("Identity details");

  fireEvent.change(screen.getByLabelText("Display name"), { target: { value: "Coach Test" } });
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: "coach@example.test" } });
  await act(async () => {
    fireEvent.click(screen.getByText("Save coach profile"));
  });

  await screen.findByText("Check the coach profile details.");
  assert.ok(screen.getByText("Identity details"));
});

test("the history list shows a factual empty state when there are no records", async () => {
  installMocks({ initialState: baseState({ history: [] }) });
  render(<CoachOnboardingPanel />);
  await screen.findByText("No coach onboarding records.");
});
