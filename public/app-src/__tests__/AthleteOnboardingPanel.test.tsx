// DEV NOTE: FULL-UI-03C athlete onboarding behavioral proof - replaces the
// source-text regex checks test/full_ui_03c_athlete_onboarding.test.mjs
// previously ran against the now-removed public/app/athlete_onboarding_ui.js
// rendering functions. Two tests below (accessibility preferences and
// instruction density actually applying to <html>) directly preserve the
// "same bug class as PR #865" regression protection that file's own tests
// established - a declared, validated, stored preference must have a real
// downstream effect, not just be accepted and forgotten.
import assert from "node:assert/strict";
import test from "node:test";

import React from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

import { AthleteOnboardingPanel } from "../screens/athlete/AthleteOnboardingPanel";

function jsonResponse(body: unknown, ok = true, status = ok ? 200 : 400): Response {
  return { ok, status, text: async () => JSON.stringify(body) } as Response;
}

type ServerState = Record<string, unknown>;

function draftState(overrides: Record<string, unknown> = {}): ServerState {
  return {
    onboarding_status: "incomplete",
    current_stage: "activity",
    saved_draft_state: false,
    draft: { fields: {} },
    ...overrides
  };
}

function completedState(fields: Record<string, unknown>, overrides: Record<string, unknown> = {}): ServerState {
  return {
    onboarding_status: "completed",
    current_effective_declaration: {
      declaration_id: "decl_1",
      declaration_version: 1,
      effective_at_iso8601: "2026-08-01T10:00:00.000Z",
      fields
    },
    historical_declarations: [],
    ...overrides
  };
}

function installMocks(options: {
  initialState?: ServerState;
  onDraftSave?: (body: Record<string, unknown>) => ServerState | { fail: true; fieldErrors?: Record<string, string> };
  onConfirm?: () => ServerState | { fail: true };
  onPreferences?: (body: Record<string, unknown>) => ServerState;
}) {
  const { initialState = draftState(), onDraftSave, onConfirm, onPreferences } = options;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = String(input);
    if (path.startsWith("/account/detail")) return jsonResponse({ account: { user_id: "athlete_1" }, csrf_token: "csrf" });
    if (path === "/account/onboarding/" && (!init || init.method === undefined || init.method === "GET")) {
      return jsonResponse(initialState);
    }
    if (path === "/account/onboarding/draft") {
      const body = JSON.parse(String(init?.body ?? "{}"));
      const result = onDraftSave
        ? onDraftSave(body)
        : draftState({
            current_stage: body.current_stage,
            draft: { fields: body.fields },
            saved_draft_state: true,
            saved_draft_at_iso8601: "2026-08-28T00:00:00.000Z"
          });
      if ("fail" in result) {
        return jsonResponse({ error: "athlete_onboarding_validation_failed", field_errors: result.fieldErrors ?? {} }, false, 422);
      }
      return jsonResponse(result);
    }
    if (path === "/account/onboarding/confirm") {
      const result = onConfirm ? onConfirm() : completedState({});
      if ("fail" in result) return jsonResponse({ error: "athlete_onboarding_validation_failed" }, false, 422);
      return jsonResponse(result);
    }
    if (path === "/account/onboarding/preferences") {
      const body = JSON.parse(String(init?.body ?? "{}"));
      const result = onPreferences ? onPreferences(body) : completedState(body);
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
  delete document.documentElement.dataset.instructionDensity;
  sessionStorage.clear();
});

test("shows the incomplete-onboarding status and stage 1 of 7 on first load, with Back disabled", async () => {
  installMocks({});
  render(<AthleteOnboardingPanel />);
  await screen.findByText("Incomplete onboarding");
  assert.ok(screen.getByText("Stage 1 of 7"));
  assert.ok(screen.getByText("Activity declaration"));
  assert.equal((screen.getByText("Back") as HTMLButtonElement).disabled, true);
});

test("shows the unavailable state on a load failure, with a working retry", async () => {
  let fail = true;
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const path = String(input);
    if (path.startsWith("/account/detail")) return jsonResponse({ account: { user_id: "athlete_1" }, csrf_token: "csrf" });
    if (path === "/account/onboarding/") {
      return fail ? jsonResponse({ error: "athlete_onboarding_athlete_required" }, false, 403) : jsonResponse(draftState());
    }
    return jsonResponse({ error: "unhandled" }, false, 404);
  }) as typeof fetch;

  render(<AthleteOnboardingPanel />);
  await screen.findByText("Onboarding is unavailable");

  fail = false;
  await act(async () => {
    screen.getByText("Retry").click();
  });

  await screen.findByText("Incomplete onboarding");
});

test("advancing a stage saves the draft and moves forward, showing a saved-draft status", async () => {
  installMocks({});
  render(<AthleteOnboardingPanel />);
  await screen.findByText("Activity declaration");

  fireEvent.change(screen.getByLabelText("Activity"), { target: { value: "powerlifting" } });
  await act(async () => {
    fireEvent.click(screen.getByText("Save and continue"));
  });

  await screen.findByText("Saved draft state");
  assert.ok(screen.getByText("Execution-scope declaration"));
  assert.ok(screen.getByText("Stage 2 of 7"));
});

test("the Back button is enabled past the first stage and moves backward", async () => {
  installMocks({ initialState: draftState({ current_stage: "execution_scope", draft: { fields: { activity_id: "powerlifting" } } }) });
  render(<AthleteOnboardingPanel />);
  await screen.findByText("Execution-scope declaration");

  const backButton = screen.getByText("Back") as HTMLButtonElement;
  assert.equal(backButton.disabled, false);

  await act(async () => {
    backButton.click();
  });

  await screen.findByText("Activity declaration");
});

test("a validation failure shows field errors and does not advance the stage", async () => {
  installMocks({
    initialState: draftState(),
    onDraftSave: () => ({ fail: true, fieldErrors: { activity_id: "activity_id is required" } })
  });
  render(<AthleteOnboardingPanel />);
  await screen.findByText("Activity declaration");

  await act(async () => {
    fireEvent.click(screen.getByText("Save and continue"));
  });

  await screen.findByText(/activity_id is required/u);
  assert.equal(screen.getAllByText("Validation failure").length, 2);
  assert.ok(screen.getByText("Activity declaration"));
});

test("reaching the review stage shows all six declared facts, and confirming shows the completed declaration", async () => {
  const fields = {
    activity_id: "powerlifting",
    execution_scope: "individual",
    product_acknowledged: true,
    jurisdiction_code: "england_wales",
    accessibility_preferences: { reduced_motion: true, high_contrast: false, larger_text: false, screen_reader_optimised: false },
    instruction_density: "detailed"
  };
  installMocks({
    initialState: draftState({ current_stage: "review", draft: { fields } }),
    onConfirm: () => completedState(fields)
  });
  render(<AthleteOnboardingPanel />);
  await screen.findByText("Review and confirmation");

  assert.ok(screen.getByText("powerlifting"));
  assert.ok(screen.getByText("individual"));
  assert.ok(screen.getByText("Accepted"));
  assert.ok(screen.getByText("england wales"));
  assert.ok(screen.getByText("reduced motion"));
  assert.ok(screen.getByText("detailed"));

  await act(async () => {
    fireEvent.click(screen.getByText("Confirm declaration"));
  });

  await screen.findByText("Completed onboarding");
  assert.ok(screen.getByText("Current effective declaration"));
});

test("declared accessibility preferences are actually applied to the page immediately after confirmation", async () => {
  // Same bug class as PR #865: a declared, validated, stored preference
  // with no downstream effect. Must be visible on <html> right after
  // confirm, not only after the next full page load / route resolution.
  const fields = {
    activity_id: "powerlifting",
    accessibility_preferences: { reduced_motion: true, high_contrast: true, larger_text: false, screen_reader_optimised: true },
    instruction_density: "minimal"
  };
  installMocks({
    initialState: draftState({ current_stage: "review", draft: { fields } }),
    onConfirm: () => completedState(fields)
  });
  render(<AthleteOnboardingPanel />);
  await screen.findByText("Review and confirmation");

  await act(async () => {
    fireEvent.click(screen.getByText("Confirm declaration"));
  });

  await screen.findByText("Completed onboarding");
  assert.equal(document.documentElement.dataset.a11yReducedMotion, "true");
  assert.equal(document.documentElement.dataset.a11yHighContrast, "true");
  assert.equal(document.documentElement.dataset.a11yLargerText, "false");
  assert.equal(document.documentElement.dataset.a11yScreenReaderOptimised, "true");
  assert.equal(document.documentElement.dataset.instructionDensity, "minimal");
});

test("sets the reload-required flag after confirmation", async () => {
  const fields = { activity_id: "powerlifting" };
  installMocks({
    initialState: draftState({ current_stage: "review", draft: { fields } }),
    onConfirm: () => completedState(fields)
  });
  render(<AthleteOnboardingPanel />);
  await screen.findByText("Review and confirmation");

  await act(async () => {
    fireEvent.click(screen.getByText("Confirm declaration"));
  });

  await screen.findByText("Completed onboarding");
  assert.equal(sessionStorage.getItem("kolosseum.athlete_onboarding.reload_required"), "1");
});

test("the completed view shows historical (superseded) declarations as immutable records", async () => {
  installMocks({
    initialState: completedState(
      { activity_id: "powerlifting" },
      {
        historical_declarations: [
          { declaration_id: "decl_old", effective_at_iso8601: "2026-01-01T00:00:00.000Z", fields: { activity_id: "general_strength" } }
        ]
      }
    )
  });
  render(<AthleteOnboardingPanel />);
  await screen.findByText("Historical declarations");

  assert.ok(screen.getByText("Superseded declaration"));
  assert.ok(screen.getByText("general strength"));
  assert.ok(screen.getByText(/Immutable declaration decl_old/u));
});

test("editing preferences pre-fills the current values, and saving applies the new density to the page immediately", async () => {
  const fields = {
    activity_id: "powerlifting",
    accessibility_preferences: { reduced_motion: false, high_contrast: false, larger_text: false, screen_reader_optimised: false },
    instruction_density: "standard"
  };
  installMocks({
    initialState: completedState(fields),
    onPreferences: (body) => completedState({
      ...fields,
      accessibility_preferences: body.accessibility_preferences,
      instruction_density: body.instruction_density
    })
  });
  render(<AthleteOnboardingPanel />);
  await screen.findByText("Current effective declaration");

  await act(async () => {
    fireEvent.click(screen.getByText("Edit accessibility and instruction density"));
  });

  await screen.findByText("Edit lawful preferences");
  fireEvent.click(screen.getByText("Larger text"));
  fireEvent.change(screen.getByLabelText("Instruction density"), { target: { value: "detailed" } });

  await act(async () => {
    fireEvent.click(screen.getByText("Save new declaration"));
  });

  await waitFor(() => assert.equal(document.documentElement.dataset.instructionDensity, "detailed"));
  assert.equal(document.documentElement.dataset.a11yLargerText, "true");
  assert.equal(screen.queryByText("Edit lawful preferences"), null);
});

test("cancelling the preference editor discards changes without saving", async () => {
  installMocks({ initialState: completedState({ activity_id: "powerlifting" }) });
  render(<AthleteOnboardingPanel />);
  await screen.findByText("Current effective declaration");

  await act(async () => {
    fireEvent.click(screen.getByText("Edit accessibility and instruction density"));
  });
  await screen.findByText("Edit lawful preferences");

  fireEvent.click(screen.getByText("Cancel"));
  assert.equal(screen.queryByText("Edit lawful preferences"), null);
});
