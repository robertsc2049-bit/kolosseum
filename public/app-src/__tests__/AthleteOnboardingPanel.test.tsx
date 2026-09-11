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
  activityChange?: Record<string, unknown> | null;
  onActivityChange?: (body: Record<string, unknown>) => Record<string, unknown>;
  onActivityProposalResponse?: (body: Record<string, unknown>) => Record<string, unknown>;
}) {
  const { initialState = draftState(), onDraftSave, onConfirm, onPreferences, activityChange = null, onActivityChange, onActivityProposalResponse } = options;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = String(input);
    if (path.startsWith("/account/detail")) return jsonResponse({ account: { user_id: "athlete_1" }, csrf_token: "csrf" });
    if (path === "/account/onboarding/activity-change" && (!init || init.method === undefined || init.method === "GET")) {
      return jsonResponse({ activity_change: activityChange });
    }
    if (path === "/account/onboarding/activity") {
      const body = JSON.parse(String(init?.body ?? "{}"));
      return jsonResponse(onActivityChange ? onActivityChange(body) : { request_state: "applied" });
    }
    if (path === "/account/onboarding/activity-proposal-response") {
      const body = JSON.parse(String(init?.body ?? "{}"));
      return jsonResponse(onActivityProposalResponse ? onActivityProposalResponse(body) : { request_state: "applied" });
    }
    if (path === "/account/onboarding/activity-proposal-cancel") {
      return jsonResponse({ request_state: "cancelled" });
    }
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
  await screen.findByText("Set up your account");
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

  await screen.findByText("Set up your account");
});

test("advancing a stage saves the draft and moves forward, showing a saved-draft status", async () => {
  installMocks({});
  render(<AthleteOnboardingPanel />);
  await screen.findByText("Activity declaration");

  fireEvent.change(screen.getByLabelText("Activity (optional)"), { target: { value: "powerlifting" } });
  await act(async () => {
    fireEvent.click(screen.getByText("Save and continue"));
  });

  await screen.findByText("Draft saved");
  assert.ok(screen.getByText("Execution-scope declaration"));
  assert.ok(screen.getByText("Stage 2 of 7"));
});

test("sport is optional - Save and continue proceeds from the activity stage with nothing chosen", async () => {
  let savedFields: Record<string, unknown> | null = null;
  installMocks({
    onDraftSave: (body) => {
      savedFields = body.fields as Record<string, unknown>;
      return draftState({
        current_stage: body.current_stage,
        draft: { fields: body.fields },
        saved_draft_state: true,
        saved_draft_at_iso8601: "2026-08-28T00:00:00.000Z"
      });
    }
  });
  render(<AthleteOnboardingPanel />);
  await screen.findByText("Activity declaration");

  assert.equal((screen.getByLabelText("Activity (optional)") as HTMLSelectElement).value, "");

  await act(async () => {
    fireEvent.click(screen.getByText("Save and continue"));
  });

  await screen.findByText("Draft saved");
  assert.ok(screen.getByText("Execution-scope declaration"));
  assert.equal(Object.prototype.hasOwnProperty.call(savedFields ?? {}, "activity_id"), false);
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
  assert.equal(screen.getAllByText("Check your answers").length, 2);
  assert.ok(screen.getByText("Activity declaration"));
});

test("reaching the review stage shows all declared facts, and confirming shows the completed declaration", async () => {
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

  assert.ok(screen.getByText("Powerlifting"));
  assert.ok(screen.getByText("Individual"));
  assert.ok(screen.getByText("Accepted"));
  assert.ok(screen.getByText("England wales"));
  assert.ok(screen.getByText("reduced motion"));
  assert.ok(screen.getByText("Detailed"));
  assert.ok(screen.getByLabelText("About execution scope"));
  assert.ok(screen.getByLabelText("About jurisdiction"));

  await act(async () => {
    fireEvent.click(screen.getByText("Confirm declaration"));
  });

  await screen.findByText("Setup complete");
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

  await screen.findByText("Setup complete");
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

  await screen.findByText("Setup complete");
  assert.equal(sessionStorage.getItem("kolosseum.athlete_onboarding.reload_required"), "1");
});

test("the completed view shows historical (superseded) declarations, never their raw internal id", async () => {
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
  const { container } = render(<AthleteOnboardingPanel />);
  await screen.findByText("Historical declarations");

  assert.ok(screen.getByText("Superseded declaration"));
  assert.ok(container.querySelector(".declaration-history")?.textContent?.includes("General strength"));
  assert.equal(screen.queryByText(/decl_old/u), null, "the raw internal declaration id must never be shown");
});

test("editing preferences pre-fills the current values, and saving applies the new density to the page immediately", async () => {
  const fields = {
    activity_id: "powerlifting",
    accessibility_preferences: { reduced_motion: false, high_contrast: false, larger_text: false, screen_reader_optimised: false },
    instruction_density: "standard",
    training_focus: ["strength"]
  };
  installMocks({
    initialState: completedState(fields),
    onPreferences: (body) => completedState({
      ...fields,
      accessibility_preferences: body.accessibility_preferences,
      instruction_density: body.instruction_density,
      training_focus: body.training_focus
    })
  });
  render(<AthleteOnboardingPanel />);
  await screen.findByText("Current effective declaration");

  await act(async () => {
    fireEvent.click(screen.getByText("Edit preferences"));
  });

  await screen.findByText("Edit preferences", { selector: "h3" });
  // Pre-filled from the current declaration's training_focus.
  assert.equal((screen.getByLabelText("Strength") as HTMLInputElement).checked, true);

  fireEvent.click(screen.getByText("Larger text"));
  fireEvent.change(screen.getByLabelText("Instruction density"), { target: { value: "detailed" } });
  fireEvent.click(screen.getByLabelText("Power"));

  await act(async () => {
    fireEvent.click(screen.getByText("Save new declaration"));
  });

  await waitFor(() => assert.equal(document.documentElement.dataset.instructionDensity, "detailed"));
  assert.equal(document.documentElement.dataset.a11yLargerText, "true");
  assert.equal(screen.queryByText("Edit preferences", { selector: "h3" }), null);
  assert.ok(screen.getByText("Strength, Power"));
});

test("training focus defaults to 'None selected' and can be set from empty, then cleared back to empty", async () => {
  const fields = { activity_id: "powerlifting" };
  let lastBody: Record<string, unknown> | null = null;
  installMocks({
    initialState: completedState(fields),
    onPreferences: (body) => {
      lastBody = body;
      return completedState({ ...fields, training_focus: body.training_focus });
    }
  });
  render(<AthleteOnboardingPanel />);
  await screen.findByText("Current effective declaration");

  assert.ok(screen.getByText("None selected"));

  await act(async () => {
    fireEvent.click(screen.getByText("Edit preferences"));
  });
  await screen.findByText("Edit preferences", { selector: "h3" });

  fireEvent.click(screen.getByLabelText("Conditioning"));
  fireEvent.click(screen.getByLabelText("Plyometric"));

  await act(async () => {
    fireEvent.click(screen.getByText("Save new declaration"));
  });

  await waitFor(() => assert.ok(screen.queryByText("Conditioning, Plyometric")));
  assert.deepEqual(lastBody?.training_focus, ["conditioning", "plyometric"]);
});

test("the completed view offers a change-activity control, and submitting it posts the new activity and timing", async () => {
  let lastBody: Record<string, unknown> | null = null;
  installMocks({
    initialState: completedState({ activity_id: "powerlifting" }),
    onActivityChange: (body) => {
      lastBody = body;
      return { request_state: "applied" };
    }
  });
  render(<AthleteOnboardingPanel />);
  await screen.findByText("Change activity", { selector: "h3" });

  fireEvent.change(screen.getByLabelText("New activity"), { target: { value: "crossfit" } });
  await act(async () => {
    fireEvent.click(screen.getByText("Change activity", { selector: "button" }));
  });

  await waitFor(() => assert.ok(lastBody));
  assert.equal((lastBody as Record<string, unknown>).new_activity_id, "crossfit");
  assert.equal((lastBody as Record<string, unknown>).apply_at, "immediately");
});

test("an athlete who completed onboarding without declaring an activity sees 'Declare activity' instead of 'Change activity'", async () => {
  let lastBody: Record<string, unknown> | null = null;
  installMocks({
    initialState: completedState({}),
    onActivityChange: (body) => {
      lastBody = body;
      return { request_state: "applied" };
    }
  });
  render(<AthleteOnboardingPanel />);
  await screen.findByText("Declare activity", { selector: "h3" });

  assert.equal(screen.queryByText("Change activity", { selector: "h3" }), null);
  assert.ok(screen.getByText("You haven't declared an activity yet - do so whenever you're ready."));

  const sportSelect = screen.getByLabelText("Activity") as HTMLSelectElement;
  assert.equal(sportSelect.value, "");
  assert.ok(screen.getByText("Choose"));

  const declareButton = screen.getByText("Declare activity", { selector: "button" }) as HTMLButtonElement;
  assert.equal(declareButton.disabled, true);

  fireEvent.change(sportSelect, { target: { value: "crossfit" } });
  await act(async () => {
    fireEvent.click(declareButton);
  });

  await waitFor(() => assert.ok(lastBody));
  assert.equal((lastBody as Record<string, unknown>).new_activity_id, "crossfit");
  assert.equal((lastBody as Record<string, unknown>).apply_at, "immediately");
});

test("a coach-proposed activity change shows Confirm/Decline, and confirming posts the response", async () => {
  let lastBody: Record<string, unknown> | null = null;
  installMocks({
    initialState: completedState({ activity_id: "powerlifting" }),
    activityChange: { request_id: "req_1", requested_by: "coach", new_activity_id: "crossfit", request_state: "proposed" },
    onActivityProposalResponse: (body) => {
      lastBody = body;
      return { request_state: "applied" };
    }
  });
  render(<AthleteOnboardingPanel />);
  await screen.findByText("Activity change proposed");
  assert.ok(screen.getByText(/coach proposed changing your activity to Crossfit/iu));

  await act(async () => {
    fireEvent.click(screen.getByText("Confirm"));
  });

  await waitFor(() => assert.ok(lastBody));
  assert.equal((lastBody as Record<string, unknown>).request_id, "req_1");
  assert.equal((lastBody as Record<string, unknown>).response, "confirmed");
});

test("declining a coach-proposed activity change posts a decline and never applies it", async () => {
  let lastBody: Record<string, unknown> | null = null;
  installMocks({
    initialState: completedState({ activity_id: "powerlifting" }),
    activityChange: { request_id: "req_1", requested_by: "coach", new_activity_id: "crossfit", request_state: "proposed" },
    onActivityProposalResponse: (body) => {
      lastBody = body;
      return { request_state: "declined" };
    }
  });
  render(<AthleteOnboardingPanel />);
  await screen.findByText("Activity change proposed");

  await act(async () => {
    fireEvent.click(screen.getByText("Decline"));
  });

  await waitFor(() => assert.ok(lastBody));
  assert.equal((lastBody as Record<string, unknown>).response, "declined");
  assert.equal((lastBody as Record<string, unknown>).apply_at, undefined, "a decline must never carry a timing choice");
});

test("a queued (deferred) activity change shows pending status with a cancel action", async () => {
  installMocks({
    initialState: completedState({ activity_id: "powerlifting" }),
    activityChange: { request_id: "req_2", requested_by: "athlete", new_activity_id: "hyrox", request_state: "queued" }
  });
  render(<AthleteOnboardingPanel />);
  await screen.findByText("Activity change pending");
  assert.ok(screen.getByText(/change to Hyrox once your current session finishes/iu));
  assert.ok(screen.getByText("Cancel this change"));
});

test("cancelling the preference editor discards changes without saving", async () => {
  installMocks({ initialState: completedState({ activity_id: "powerlifting" }) });
  render(<AthleteOnboardingPanel />);
  await screen.findByText("Current effective declaration");

  await act(async () => {
    fireEvent.click(screen.getByText("Edit preferences"));
  });
  await screen.findByText("Edit preferences", { selector: "h3" });

  fireEvent.click(screen.getByText("Cancel"));
  assert.equal(screen.queryByText("Edit preferences", { selector: "h3" }), null);
});
