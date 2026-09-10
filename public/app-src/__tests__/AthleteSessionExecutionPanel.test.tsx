// DEV NOTE: FULL-UI-15C session execution behavioral proof - replaces the
// source-text regex checks full_ui_15c_session_execution_surface.test.mjs
// used to run against the now-removed app.js
// renderAthleteSession()/renderExerciseFocus()/hideAllActionPanels()/
// confirmSkipWithReason() family. localStorage is seeded with
// kolosseum.product.app.v1's activeSessionId, matching how legacy's own
// saveState() persists it - see useAthleteSessionExecution.ts's
// readActiveSessionId().
import assert from "node:assert/strict";
import test from "node:test";

import React from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

import { AthleteSessionExecutionPanel } from "../screens/athlete/AthleteSessionExecutionPanel";

const STORAGE_KEY = "kolosseum.product.app.v1";

function jsonResponse(body: unknown, ok = true, status = ok ? 200 : 400): Response {
  return {
    ok,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body)
  } as Response;
}

function baseExercise(overrides: Record<string, unknown> = {}) {
  return {
    exercise_id: "back_squat",
    display_name: "Back squat",
    segment: "working",
    sets: 4,
    rep_range: { minimum: 5, maximum: 5 },
    rest_seconds: 180,
    ...overrides
  };
}

function baseSessionState(overrides: Record<string, unknown> = {}) {
  return {
    started: false,
    execution_status: "in_progress",
    current_step: { type: "EXERCISE", exercise: baseExercise() },
    completed_exercises: [],
    remaining_exercises: [baseExercise()],
    dropped_exercises: [],
    ...overrides
  };
}

function installMocks(options: {
  sessionState?: Record<string, unknown> | null;
  sessionFails?: boolean;
  onEvent?: (path: string, method: string, body: unknown) => void;
  extraSetIsPr?: boolean;
  addExerciseIsPr?: boolean;
}) {
  const { sessionState = baseSessionState(), sessionFails = false, onEvent, extraSetIsPr, addExerciseIsPr } = options;
  let currentSessionState = sessionState;

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = String(input);
    const method = init?.method ?? "GET";
    const body = typeof init?.body === "string" ? JSON.parse(init.body) : undefined;
    onEvent?.(path, method, body);

    if (path.startsWith("/account/detail")) {
      return jsonResponse({ account: { user_id: "athlete_1" }, csrf_token: "csrf-abc" });
    }
    if (/\/sessions\/[^/]+\/state$/u.test(path) && method === "GET") {
      if (sessionFails) return jsonResponse({ error: "session_unavailable" }, false, 503);
      return jsonResponse(currentSessionState);
    }
    if (/\/sessions\/[^/]+\/start$/u.test(path)) {
      currentSessionState = { ...currentSessionState, started: true } as Record<string, unknown>;
      return jsonResponse({ ok: true });
    }
    if (/\/sessions\/[^/]+\/events$/u.test(path)) {
      if (
        body?.type === "COMPLETE_STEP" ||
        body?.type === "COMPLETE_EXERCISE" ||
        body?.type === "COMPLETE_GROUP" ||
        body?.type === "AMRAP_RESULT_REPORT" ||
        body?.type === "EMOM_RESULT_REPORT" ||
        body?.type === "FOR_TIME_RESULT_REPORT"
      ) {
        currentSessionState = {
          ...currentSessionState,
          completed_exercises: [baseExercise()],
          remaining_exercises: [],
          execution_status: "completed"
        } as Record<string, unknown>;
      }
      if (body?.type === "SKIP_EXERCISE") {
        currentSessionState = {
          ...currentSessionState,
          remaining_exercises: [],
          dropped_exercises: [baseExercise()],
          execution_status: "partial"
        } as Record<string, unknown>;
      }
      if (body?.type === "EXTRA_SET_REPORT") {
        return jsonResponse({ ok: true, is_pr: extraSetIsPr === true });
      }
      if (body?.type === "EXTRA_EXERCISE_REPORT") {
        return jsonResponse({ ok: true, is_pr: addExerciseIsPr === true });
      }
      return jsonResponse({ ok: true });
    }
    if (/\/sessions\/[^/]+\/substitution-request$/u.test(path)) {
      return jsonResponse({
        ok: true,
        result: {
          substitution_status: "substitution_applied",
          substitution_output: { target_exercise_id: "front_squat", substitution_edge_id: "edge_1" }
        }
      });
    }
    if (path.startsWith("/templates/exercises")) {
      return jsonResponse({
        ok: true,
        exercises: [
          { exercise_id: "bicep_curl", display_name: "Bicep curl" },
          { exercise_id: "tricep_pushdown", display_name: "Tricep pushdown" }
        ]
      });
    }
    if (/\/exercises\/[^/]+\/content$/u.test(path)) {
      return jsonResponse({ instruction: { detailed: ["Brace and descend."] }, coaching_cues: ["Chest up"], common_faults: [] });
    }
    if (/\/exercises\/[^/]+\/reference-media$/u.test(path)) {
      return jsonResponse({ reference_media: null });
    }
    if (path === "/video-feedback") {
      return jsonResponse({ ok: true });
    }
    return jsonResponse({ error: `unhandled_request_${path}` }, false, 404);
  }) as typeof fetch;
}

function seedActiveSession(sessionId: string | null) {
  if (sessionId) {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ activeSessionId: sessionId }));
  }
  else {
    window.localStorage.removeItem(STORAGE_KEY);
  }
}

test.afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

test("shows a factual empty state when there is no active session", async () => {
  seedActiveSession(null);
  installMocks({});
  render(<AthleteSessionExecutionPanel />);

  await waitFor(() => assert.equal(screen.getAllByText("No session selected").length, 2));
  assert.ok(screen.getByText("Return to Today and create a session."));
});

test("shows the service-unavailable state with a working retry button", async () => {
  seedActiveSession("session_1");
  installMocks({ sessionFails: true });
  render(<AthleteSessionExecutionPanel />);

  await waitFor(() => assert.equal(screen.getAllByText("Session could not be loaded").length, 2));
  assert.ok(screen.getByText("The session record could not be fetched. Check your connection and try again."));

  installMocks({ sessionFails: false });
  await act(async () => {
    fireEvent.click(screen.getByText("Retry"));
  });
  await waitFor(() => screen.getByText("Start session"));
});

test("loads the session and shows Start session before the session has started", async () => {
  seedActiveSession("session_1");
  installMocks({});
  render(<AthleteSessionExecutionPanel />);

  await waitFor(() => assert.ok(document.querySelector(".exercise-focus h3")));
  assert.equal(document.querySelector(".exercise-focus h3")?.textContent, "Back squat");
  assert.ok(screen.getByText("Start session"));
  assert.equal(screen.queryByText("Mark exercise complete"), null);
  assert.ok(screen.getByText("5–5 reps"));
  assert.ok(screen.getByText("180s rest"));
});

test("starting a session reveals the full action button set", async () => {
  seedActiveSession("session_1");
  installMocks({});
  render(<AthleteSessionExecutionPanel />);
  await waitFor(() => screen.getByText("Start session"));

  await act(async () => {
    fireEvent.click(screen.getByText("Start session"));
  });

  await waitFor(() => screen.getByText("Mark exercise complete"));
  assert.ok(screen.getByText("Skip exercise"));
  assert.ok(screen.getByText("Report pain"));
  assert.ok(screen.getByText("Report RPE"));
  assert.ok(screen.getByText("Report Borg"));
  assert.ok(screen.getByText("Report CR10"));
  assert.ok(screen.getByText("Request substitution"));
  assert.ok(screen.getByText("Record form-check video"));
  assert.ok(screen.getByText("Stop and return later"));
});

test("the RPE panel shows a live reps-in-the-tank hint next to the raw 1-10 value", async () => {
  seedActiveSession("session_1");
  installMocks({ sessionState: baseSessionState({ started: true }) });
  render(<AthleteSessionExecutionPanel />);
  await waitFor(() => screen.getByText("Mark exercise complete"));

  await act(async () => {
    fireEvent.click(screen.getByText("Report RPE"));
  });

  await waitFor(() => screen.getByText("RPE 8 - 2 reps in the tank"));

  await act(async () => {
    fireEvent.change(screen.getByLabelText("RPE (1-10)"), { target: { value: "10" } });
  });
  assert.ok(screen.getByText("RPE 10 - 0 reps in the tank - maximum effort"));
});

test("the Borg panel shows a live anchor hint next to the raw 6-20 value", async () => {
  seedActiveSession("session_1");
  installMocks({ sessionState: baseSessionState({ started: true }) });
  render(<AthleteSessionExecutionPanel />);
  await waitFor(() => screen.getByText("Mark exercise complete"));

  await act(async () => {
    fireEvent.click(screen.getByText("Report Borg"));
  });

  await waitFor(() => screen.getByText("Borg 13 - somewhat hard effort"));

  await act(async () => {
    fireEvent.change(screen.getByLabelText("Borg (6-20)"), { target: { value: "19" } });
  });
  assert.ok(screen.getByText("Borg 19 - extremely hard effort"));
});

test("the CR10 panel shows a live anchor hint next to the raw 0-10 half-point value", async () => {
  seedActiveSession("session_1");
  installMocks({ sessionState: baseSessionState({ started: true }) });
  render(<AthleteSessionExecutionPanel />);
  await waitFor(() => screen.getByText("Mark exercise complete"));

  await act(async () => {
    fireEvent.click(screen.getByText("Report CR10"));
  });

  await waitFor(() => screen.getByText("CR10 5 - somewhat hard effort"));

  await act(async () => {
    fireEvent.change(screen.getByLabelText("Modified Borg / CR10 (0-10)"), { target: { value: "7.5" } });
  });
  assert.ok(screen.getByText("CR10 7.5 - very hard effort"));
});

test("completing the current exercise starts a rest timer and refreshes the session", async () => {
  seedActiveSession("session_1");
  installMocks({ sessionState: baseSessionState({ started: true }) });
  render(<AthleteSessionExecutionPanel />);
  await waitFor(() => screen.getByText("Mark exercise complete"));

  await act(async () => {
    fireEvent.click(screen.getByText("Mark exercise complete"));
  });

  await waitFor(() => screen.getByText("Resting"));
  assert.ok(screen.getByText("3:00"));
  await waitFor(() => screen.getByText("Session complete"));

  // Stop the real setInterval this starts - it otherwise keeps ticking in
  // the background for the rest of this file's process (matching legacy's
  // own rest timer, which is never cleared on navigation either - see
  // useAthleteSessionExecution.ts's DEV NOTE) and was observed to pollute a
  // later test's timing (see feedback_react_test_act_wrapping_gap.md for
  // the general class of "later test hangs for real seconds" symptom this
  // produces - the fix here is the same: fully settle every timer/promise
  // a test itself started before letting afterEach's cleanup() run).
  await act(async () => {
    fireEvent.click(screen.getByText("Skip rest"));
  });
});

test("skipping an exercise requires a reason and posts SKIP_EXERCISE", async () => {
  seedActiveSession("session_1");
  let lastEventBody: unknown = null;
  installMocks({
    sessionState: baseSessionState({ started: true }),
    onEvent: (path, method, body) => {
      if (path.endsWith("/events") && method === "POST") lastEventBody = body;
    }
  });
  render(<AthleteSessionExecutionPanel />);
  await waitFor(() => screen.getByText("Mark exercise complete"));

  fireEvent.click(screen.getByText("Skip exercise"));
  await waitFor(() => screen.getByText("Skip this exercise?"));

  fireEvent.change(document.getElementById("skipReasonSelect") as HTMLSelectElement, { target: { value: "pain_or_discomfort" } });
  await act(async () => {
    fireEvent.click(screen.getByText("Confirm skip"));
  });

  await waitFor(() => assert.equal((lastEventBody as { type?: string } | null)?.type, "SKIP_EXERCISE"));
  assert.equal((lastEventBody as { reason_code?: string } | null)?.reason_code, "pain_or_discomfort");
});

test("reporting pain posts a pain_reported flag with no free text", async () => {
  seedActiveSession("session_1");
  let lastEventBody: unknown = null;
  installMocks({
    sessionState: baseSessionState({ started: true }),
    onEvent: (path, method, body) => {
      if (path.endsWith("/events") && method === "POST") lastEventBody = body;
    }
  });
  render(<AthleteSessionExecutionPanel />);
  await waitFor(() => screen.getByText("Mark exercise complete"));

  fireEvent.click(screen.getByText("Report pain"));
  await waitFor(() => screen.getByText("Report pain during this exercise?"));
  await act(async () => {
    fireEvent.click(screen.getByText("Record pain reported"));
  });

  await waitFor(() => assert.equal((lastEventBody as { type?: string } | null)?.type, "PAIN_REPORT"));
  assert.equal((lastEventBody as { pain_reported?: boolean } | null)?.pain_reported, true);
});

test("adding an extra set to an already-completed exercise posts EXTRA_SET_REPORT with reps and load", async () => {
  seedActiveSession("session_1");
  let lastEventBody: unknown = null;
  installMocks({
    sessionState: baseSessionState({
      started: true,
      completed_exercises: [baseExercise({ exercise_id: "back_squat", display_name: "Back squat" })],
      remaining_exercises: [baseExercise({ exercise_id: "bench_press", display_name: "Bench press" })],
      current_step: { type: "EXERCISE", exercise: baseExercise({ exercise_id: "bench_press", display_name: "Bench press" }) }
    }),
    onEvent: (path, method, body) => {
      if (path.endsWith("/events") && method === "POST") lastEventBody = body;
    }
  });
  render(<AthleteSessionExecutionPanel />);
  await waitFor(() => screen.getByText("Add extra set"));

  fireEvent.click(screen.getByText("Add extra set"));
  await waitFor(() => screen.getByText("Log extra set"));

  fireEvent.change(screen.getByLabelText("Reps"), { target: { value: "3" } });
  fireEvent.change(screen.getByLabelText("Weight (optional)"), { target: { value: "100" } });

  await act(async () => {
    fireEvent.click(screen.getByText("Log extra set"));
  });

  await waitFor(() => assert.equal((lastEventBody as { type?: string } | null)?.type, "EXTRA_SET_REPORT"));
  const posted = lastEventBody as { exercise_id?: string; reps?: number; load_value?: number; load_unit?: string } | null;
  assert.equal(posted?.exercise_id, "back_squat");
  assert.equal(posted?.reps, 3);
  assert.equal(posted?.load_value, 100);
  assert.equal(posted?.load_unit, "kg");

  await waitFor(() => screen.getByText("Extra set logged."));
});

test("adding an extra set with a negative load (assisted exercise) posts EXTRA_SET_REPORT with a negative load_value", async () => {
  seedActiveSession("session_1");
  let lastEventBody: unknown = null;
  installMocks({
    sessionState: baseSessionState({
      started: true,
      completed_exercises: [baseExercise({ exercise_id: "back_squat", display_name: "Back squat" })],
      remaining_exercises: [baseExercise({ exercise_id: "bench_press", display_name: "Bench press" })],
      current_step: { type: "EXERCISE", exercise: baseExercise({ exercise_id: "bench_press", display_name: "Bench press" }) }
    }),
    onEvent: (path, method, body) => {
      if (path.endsWith("/events") && method === "POST") lastEventBody = body;
    }
  });
  render(<AthleteSessionExecutionPanel />);
  await waitFor(() => screen.getByText("Add extra set"));

  fireEvent.click(screen.getByText("Add extra set"));
  await waitFor(() => screen.getByText("Log extra set"));

  fireEvent.change(screen.getByLabelText("Reps"), { target: { value: "3" } });
  fireEvent.change(screen.getByLabelText("Weight (optional)"), { target: { value: "-20" } });

  await act(async () => {
    fireEvent.click(screen.getByText("Log extra set"));
  });

  await waitFor(() => assert.equal((lastEventBody as { type?: string } | null)?.type, "EXTRA_SET_REPORT"));
  const posted = lastEventBody as { exercise_id?: string; reps?: number; load_value?: number; load_unit?: string } | null;
  assert.equal(posted?.load_value, -20);
  assert.equal(posted?.load_unit, "kg");

  await waitFor(() => screen.getByText("Extra set logged."));
});

test("logging an extra set that is a personal record shows a PR badge alongside the confirmation", async () => {
  seedActiveSession("session_1");
  installMocks({
    sessionState: baseSessionState({
      started: true,
      completed_exercises: [baseExercise({ exercise_id: "back_squat", display_name: "Back squat" })],
      remaining_exercises: [baseExercise({ exercise_id: "bench_press", display_name: "Bench press" })],
      current_step: { type: "EXERCISE", exercise: baseExercise({ exercise_id: "bench_press", display_name: "Bench press" }) }
    }),
    extraSetIsPr: true
  });
  render(<AthleteSessionExecutionPanel />);
  await waitFor(() => screen.getByText("Add extra set"));

  fireEvent.click(screen.getByText("Add extra set"));
  await waitFor(() => screen.getByText("Log extra set"));

  fireEvent.change(screen.getByLabelText("Reps"), { target: { value: "3" } });
  fireEvent.change(screen.getByLabelText("Weight (optional)"), { target: { value: "120" } });

  await act(async () => {
    fireEvent.click(screen.getByText("Log extra set"));
  });

  await waitFor(() => screen.getByText("Extra set logged."));
  assert.ok(screen.getByText("PR"));
});

test("adding a brand-new exercise not on the prescribed plan posts EXTRA_EXERCISE_REPORT with reps and load", async () => {
  seedActiveSession("session_1");
  let lastEventBody: unknown = null;
  installMocks({
    onEvent: (path, method, body) => {
      if (path.endsWith("/events") && method === "POST") lastEventBody = body;
    }
  });
  render(<AthleteSessionExecutionPanel />);
  await waitFor(() => screen.getByText("Add exercise"));

  fireEvent.click(screen.getByText("Add exercise"));
  await waitFor(() => screen.getByRole("option", { name: "Tricep pushdown" }));

  fireEvent.change(screen.getByLabelText("Exercise"), { target: { value: "tricep_pushdown" } });
  fireEvent.change(screen.getByLabelText("Reps"), { target: { value: "12" } });
  fireEvent.change(screen.getByLabelText("Weight (optional)"), { target: { value: "15" } });

  await act(async () => {
    fireEvent.click(screen.getByText("Log exercise"));
  });

  await waitFor(() => assert.equal((lastEventBody as { type?: string } | null)?.type, "EXTRA_EXERCISE_REPORT"));
  const posted = lastEventBody as { exercise_id?: string; reps?: number; load_value?: number; load_unit?: string } | null;
  assert.equal(posted?.exercise_id, "tricep_pushdown");
  assert.equal(posted?.reps, 12);
  assert.equal(posted?.load_value, 15);
  assert.equal(posted?.load_unit, "kg");

  await waitFor(() => screen.getByText("Tricep pushdown added."));
});

test("substitution check offers a lawful substitute which can be completed", async () => {
  seedActiveSession("session_1");
  let lastEventBody: unknown = null;
  installMocks({
    sessionState: baseSessionState({ started: true }),
    onEvent: (path, method, body) => {
      if (path.endsWith("/events") && method === "POST") lastEventBody = body;
    }
  });
  render(<AthleteSessionExecutionPanel />);
  await waitFor(() => screen.getByText("Mark exercise complete"));

  fireEvent.click(screen.getByText("Request substitution"));
  await waitFor(() => screen.getByText("Request a substitution"));

  await act(async () => {
    fireEvent.click(screen.getByText("Check for substitute"));
  });

  await waitFor(() => screen.getByText(/Substitute available/u));

  await act(async () => {
    fireEvent.click(screen.getByText("Complete with substitute"));
  });

  await waitFor(() => assert.equal((lastEventBody as { type?: string } | null)?.type, "COMPLETE_EXERCISE"));
  assert.equal((lastEventBody as { substituted_exercise_id?: string } | null)?.substituted_exercise_id, "front_squat");
});

test("video upload shows a factual validation error before any request when no file is chosen", async () => {
  seedActiveSession("session_1");
  installMocks({ sessionState: baseSessionState({ started: true }) });
  render(<AthleteSessionExecutionPanel />);
  await waitFor(() => screen.getByText("Mark exercise complete"));

  fireEvent.click(screen.getByText("Record form-check video"));
  await waitFor(() => screen.getByText("Record a form-check video"));

  await act(async () => {
    fireEvent.click(screen.getByText("Upload video"));
  });

  await waitFor(() => screen.getByText("Choose a video to upload."));
});

test("video upload succeeds for a supported file and closes the panel", async () => {
  seedActiveSession("session_1");
  installMocks({ sessionState: baseSessionState({ started: true }) });
  render(<AthleteSessionExecutionPanel />);
  await waitFor(() => screen.getByText("Mark exercise complete"));

  fireEvent.click(screen.getByText("Record form-check video"));
  await waitFor(() => screen.getByText("Record a form-check video"));

  const file = new File(["binary"], "form-check.mp4", { type: "video/mp4" });
  const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
  fireEvent.change(fileInput, { target: { files: [file] } });

  await act(async () => {
    fireEvent.click(screen.getByText("Upload video"));
  });

  await waitFor(() => assert.equal(screen.queryByText("Record a form-check video"), null));
});

test("the return-decision step shows continue/finish controls instead of the usual action buttons", async () => {
  seedActiveSession("session_1");
  installMocks({
    sessionState: baseSessionState({ started: true, current_step: { type: "RETURN_DECISION" } })
  });
  render(<AthleteSessionExecutionPanel />);

  await waitFor(() => screen.getByText("Continue this session?"));
  assert.ok(screen.getByText("Continue remaining work"));
  assert.ok(screen.getByText("Finish without remaining work"));
  assert.equal(screen.queryByText("Mark exercise complete"), null);
});

function groupExercise(overrides: Record<string, unknown> = {}) {
  return {
    exercise_id: "power_clean",
    display_name: "Power clean",
    segment: "working",
    ...overrides
  };
}

test("a complex GROUP_WORKOUT step shows every member exercise and a single Mark complex complete button, posting COMPLETE_GROUP once", async () => {
  seedActiveSession("session_1");
  let lastEventBody: unknown = null;
  installMocks({
    sessionState: baseSessionState({
      started: true,
      current_step: {
        type: "GROUP_WORKOUT",
        group_id: "complex1",
        group_type: "complex",
        exercises: [groupExercise(), groupExercise({ exercise_id: "thruster", display_name: "Thruster" })]
      }
    }),
    onEvent: (path, method, body) => {
      if (path.endsWith("/events") && method === "POST") lastEventBody = body;
    }
  });
  render(<AthleteSessionExecutionPanel />);

  await waitFor(() => screen.getByText("Power clean + Thruster"));
  assert.ok(screen.getByText("Complex"));
  assert.equal(screen.queryByText("Mark exercise complete"), null);
  assert.ok(screen.getByText("Mark complex complete"));

  await act(async () => {
    fireEvent.click(screen.getByText("Mark complex complete"));
  });

  await waitFor(() => screen.getByText("Session complete"));
  assert.equal((lastEventBody as { type?: string } | null)?.type, "COMPLETE_GROUP");
  assert.equal((lastEventBody as { group_id?: string } | null)?.group_id, "complex1");
});

test("an amrap GROUP_WORKOUT step shows the shared time cap, rounds/extra-reps inputs, and posts AMRAP_RESULT_REPORT with the entered values", async () => {
  seedActiveSession("session_1");
  let lastEventBody: unknown = null;
  installMocks({
    sessionState: baseSessionState({
      started: true,
      current_step: {
        type: "GROUP_WORKOUT",
        group_id: "amrapA",
        group_type: "amrap",
        time_cap_seconds: 720,
        exercises: [groupExercise({ exercise_id: "toes_to_bar", display_name: "Toes to bar" }), groupExercise({ exercise_id: "pull_up", display_name: "Pull-up" })]
      }
    }),
    onEvent: (path, method, body) => {
      if (path.endsWith("/events") && method === "POST") lastEventBody = body;
    }
  });
  render(<AthleteSessionExecutionPanel />);

  await waitFor(() => screen.getByText("Toes to bar + Pull-up"));
  assert.ok(screen.getByText("AMRAP"));
  assert.ok(screen.getByText("Time cap: 12 minutes"));

  await act(async () => {
    fireEvent.change(screen.getByLabelText("Rounds completed"), { target: { value: "6" } });
    fireEvent.change(screen.getByLabelText("Extra reps"), { target: { value: "4" } });
  });

  await act(async () => {
    fireEvent.click(screen.getByText("Record AMRAP result"));
  });

  await waitFor(() => screen.getByText("Session complete"));
  const amrapBody = lastEventBody as { type?: string; group_id?: string; rounds_completed?: number; extra_reps?: number } | null;
  assert.equal(amrapBody?.type, "AMRAP_RESULT_REPORT");
  assert.equal(amrapBody?.group_id, "amrapA");
  assert.equal(amrapBody?.rounds_completed, 6);
  assert.equal(amrapBody?.extra_reps, 4);
});

test("an emom GROUP_WORKOUT step shows round-length/total-rounds and posts EMOM_RESULT_REPORT with the entered rounds completed/missed", async () => {
  seedActiveSession("session_1");
  let lastEventBody: unknown = null;
  installMocks({
    sessionState: baseSessionState({
      started: true,
      current_step: {
        type: "GROUP_WORKOUT",
        group_id: "emom1",
        group_type: "emom",
        round_seconds: 60,
        total_rounds: 10,
        exercises: [groupExercise({ exercise_id: "kettlebell_deadlift", display_name: "Kettlebell deadlift" }), groupExercise({ exercise_id: "goblet_squat", display_name: "Goblet squat" })]
      }
    }),
    onEvent: (path, method, body) => {
      if (path.endsWith("/events") && method === "POST") lastEventBody = body;
    }
  });
  render(<AthleteSessionExecutionPanel />);

  await waitFor(() => screen.getByText("Kettlebell deadlift + Goblet squat"));
  assert.ok(screen.getByText("EMOM"));
  assert.ok(screen.getByText("10 rounds, one every 60 seconds"));

  await act(async () => {
    fireEvent.change(screen.getByLabelText("Rounds completed"), { target: { value: "9" } });
    fireEvent.change(screen.getByLabelText("Rounds missed"), { target: { value: "1" } });
  });

  await act(async () => {
    fireEvent.click(screen.getByText("Record EMOM result"));
  });

  await waitFor(() => screen.getByText("Session complete"));
  const emomBody = lastEventBody as { type?: string; group_id?: string; rounds_completed?: number; rounds_missed?: number } | null;
  assert.equal(emomBody?.type, "EMOM_RESULT_REPORT");
  assert.equal(emomBody?.group_id, "emom1");
  assert.equal(emomBody?.rounds_completed, 9);
  assert.equal(emomBody?.rounds_missed, 1);
});

test("a for_time GROUP_WORKOUT step shows an elapsed-time input by default and posts FOR_TIME_RESULT_REPORT with it", async () => {
  seedActiveSession("session_1");
  let lastEventBody: unknown = null;
  installMocks({
    sessionState: baseSessionState({
      started: true,
      current_step: {
        type: "GROUP_WORKOUT",
        group_id: "fortime1",
        group_type: "for_time",
        time_cap_seconds: 600,
        exercises: [groupExercise({ exercise_id: "toes_to_bar", display_name: "Toes to bar" }), groupExercise({ exercise_id: "pull_up", display_name: "Pull-up" })]
      }
    }),
    onEvent: (path, method, body) => {
      if (path.endsWith("/events") && method === "POST") lastEventBody = body;
    }
  });
  render(<AthleteSessionExecutionPanel />);

  await waitFor(() => screen.getByText("Toes to bar + Pull-up"));
  assert.ok(screen.getByText("For time"));
  assert.ok(screen.getByText("Time cap: 10 minutes"));
  assert.ok(screen.getByLabelText("Elapsed time (seconds)"));

  await act(async () => {
    fireEvent.change(screen.getByLabelText("Elapsed time (seconds)"), { target: { value: "480" } });
  });

  await act(async () => {
    fireEvent.click(screen.getByText("Record for-time result"));
  });

  await waitFor(() => screen.getByText("Session complete"));
  const forTimeBody = lastEventBody as { type?: string; group_id?: string; elapsed_seconds?: number; hit_time_cap?: boolean } | null;
  assert.equal(forTimeBody?.type, "FOR_TIME_RESULT_REPORT");
  assert.equal(forTimeBody?.group_id, "fortime1");
  assert.equal(forTimeBody?.elapsed_seconds, 480);
  assert.equal(forTimeBody?.hit_time_cap, false);
});

test("checking 'hit the time cap' on a for_time step hides the elapsed-time input and reports the group's own time cap as elapsed_seconds", async () => {
  seedActiveSession("session_1");
  let lastEventBody: unknown = null;
  installMocks({
    sessionState: baseSessionState({
      started: true,
      current_step: {
        type: "GROUP_WORKOUT",
        group_id: "fortime1",
        group_type: "for_time",
        time_cap_seconds: 600,
        exercises: [groupExercise({ exercise_id: "toes_to_bar", display_name: "Toes to bar" }), groupExercise({ exercise_id: "pull_up", display_name: "Pull-up" })]
      }
    }),
    onEvent: (path, method, body) => {
      if (path.endsWith("/events") && method === "POST") lastEventBody = body;
    }
  });
  render(<AthleteSessionExecutionPanel />);

  await waitFor(() => screen.getByText("Toes to bar + Pull-up"));

  await act(async () => {
    fireEvent.click(screen.getByText("Hit the time cap before finishing"));
  });

  assert.equal(screen.queryByLabelText("Elapsed time (seconds)"), null);

  await act(async () => {
    fireEvent.click(screen.getByText("Record for-time result"));
  });

  await waitFor(() => screen.getByText("Session complete"));
  const forTimeCapBody = lastEventBody as { type?: string; group_id?: string; elapsed_seconds?: number; hit_time_cap?: boolean } | null;
  assert.equal(forTimeCapBody?.type, "FOR_TIME_RESULT_REPORT");
  assert.equal(forTimeCapBody?.group_id, "fortime1");
  assert.equal(forTimeCapBody?.elapsed_seconds, 600);
  assert.equal(forTimeCapBody?.hit_time_cap, true);
});

test("expanding how-to loads written instructions for the current exercise", async () => {
  seedActiveSession("session_1");
  installMocks({});
  render(<AthleteSessionExecutionPanel />);
  await waitFor(() => assert.ok(document.querySelector(".exercise-focus h3")));

  const details = document.querySelector("details.exercise-howto") as HTMLDetailsElement;
  await act(async () => {
    details.open = true;
    fireEvent(details, new Event("toggle", { bubbles: false }));
  });

  await waitFor(() => screen.getByText("Brace and descend."));
  assert.ok(screen.getByText("Chest up"));
});

test("an exercise name containing markup renders as inert text, never as HTML", async () => {
  seedActiveSession("session_1");
  installMocks({
    sessionState: baseSessionState({
      current_step: { type: "EXERCISE", exercise: baseExercise({ display_name: '<img src=x onerror="window.pwned=true">' }) }
    })
  });
  render(<AthleteSessionExecutionPanel />);

  await waitFor(() => assert.ok(document.querySelector(".exercise-focus h3")?.textContent?.includes("<img")));
  assert.equal((globalThis as Record<string, unknown>).pwned, undefined);
  assert.equal(document.querySelectorAll(".exercise-focus img").length, 0);
});

test("the RPE, Borg and CR10 panels and both Weight (optional) fields each show an info tooltip trigger", async () => {
  seedActiveSession("session_1");
  installMocks({
    sessionState: baseSessionState({
      started: true,
      completed_exercises: [baseExercise({ exercise_id: "back_squat", display_name: "Back squat" })],
      remaining_exercises: [baseExercise({ exercise_id: "bench_press", display_name: "Bench press" })],
      current_step: { type: "EXERCISE", exercise: baseExercise({ exercise_id: "bench_press", display_name: "Bench press" }) }
    })
  });
  render(<AthleteSessionExecutionPanel />);
  await waitFor(() => screen.getByText("Mark exercise complete"));

  fireEvent.click(screen.getByText("Report RPE"));
  await waitFor(() => screen.getByLabelText("About RPE"));
  fireEvent.click(screen.getByText("Cancel"));

  fireEvent.click(screen.getByText("Report Borg"));
  await waitFor(() => screen.getByLabelText("About the Borg scale"));
  fireEvent.click(screen.getByText("Cancel"));

  fireEvent.click(screen.getByText("Report CR10"));
  await waitFor(() => screen.getByLabelText("About CR10"));
  fireEvent.click(screen.getByText("Cancel"));

  fireEvent.click(screen.getByText("Add extra set"));
  await waitFor(() => screen.getByText("Log extra set"));
  assert.ok(screen.getByLabelText("About negative weight values"));
  fireEvent.click(screen.getByText("Cancel"));

  fireEvent.click(screen.getByText("Add exercise"));
  await waitFor(() => screen.getByLabelText("Reps"));
  assert.ok(screen.getByLabelText("About negative weight values"));
});
