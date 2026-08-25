// DEV NOTE: coach_athlete_detail strength-reference editor behavioral proof
// - replaces the source-text regex checks product_template_builder_surface
// .test.mjs / product_coach_programme_workspace.test.mjs previously ran
// against the now-removed app.js functions (saveOpenAthleteProfile,
// addAthleteBenchmark, removeAthleteBenchmark, updateAthleteBenchmarkControl,
// syncAthleteProfileHeader) for exactly these strength_* capabilities.
import assert from "node:assert/strict";
import test from "node:test";

import React from "react";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";

import { AthleteStrengthProfilePanel } from "../screens/coach/AthleteStrengthProfilePanel";

type FetchCall = { input: RequestInfo | URL; init?: RequestInit };

function jsonResponse(body: unknown, ok = true, status = ok ? 200 : 400): Response {
  return {
    ok,
    status,
    text: async () => JSON.stringify(body)
  } as Response;
}

function installFetchMock(handler: (call: FetchCall) => Response) {
  const calls: FetchCall[] = [];
  const original = globalThis.fetch;

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ input, init });
    return handler({ input, init });
  }) as typeof fetch;

  return {
    calls,
    restore: () => {
      globalThis.fetch = original;
    }
  };
}

const exercises = [
  { exercise_id: "back_squat", display_name: "Back Squat" },
  { exercise_id: "bench_press", display_name: "Bench Press" }
];

function baseProfile(overrides: Record<string, unknown> = {}) {
  return {
    record_sha256: "sha-abc123",
    preferred_weight_unit: "kg",
    load_rounding_increment: 2.5,
    bodyweight: 82,
    bodyweight_unit: "kg",
    benchmarks: [
      {
        benchmark_id: "ref_squat_1",
        exercise_id: "back_squat",
        value: 150,
        unit: "kg",
        basis: "tested_1rm",
        effective_date: "2026-07-01",
        source_note: "Meet PR",
        replaces_reference_id: null
      }
    ],
    ...overrides
  };
}

async function openPanel(profile: Record<string, unknown>, extraHandlers: Record<string, () => Response> = {}) {
  const mock = installFetchMock(({ input, init }) => {
    const path = String(input);
    const method = init?.method ?? "GET";

    if (path === "/account/detail" && method === "GET") {
      return jsonResponse({ csrf_token: "csrf-athlete" });
    }
    if (path.startsWith("/coach-workspace/athlete-strength-profile?") && method === "GET") {
      return jsonResponse({ profile });
    }
    if (path === "/templates/exercises" && method === "GET") {
      return jsonResponse({ exercises });
    }

    const key = `${method} ${path}`;
    if (extraHandlers[key]) return extraHandlers[key]();

    return jsonResponse({ error: `unhandled_request_${key}` }, false, 404);
  });

  render(<AthleteStrengthProfilePanel />);

  act(() => {
    document.dispatchEvent(
      new CustomEvent("kolosseum:coach-athlete-profile-opened", {
        detail: { athlete_user_id: "athlete_test123" }
      })
    );
  });

  await waitFor(() => screen.getByText("Save athlete profile"));

  return mock;
}

test.afterEach(() => {
  cleanup();
});

test("renders nothing until the coach opens an athlete's profile", () => {
  installFetchMock(() => jsonResponse({}, false, 404));
  render(<AthleteStrengthProfilePanel />);
  assert.equal(screen.queryByText("Save athlete profile"), null);
});

test("loads the opened athlete's profile with prefilled settings and benchmarks, and saves via POST with the CSRF header", async () => {
  const mock = await openPanel(baseProfile(), {
    "POST /coach-workspace/athlete-strength-profile": () =>
      jsonResponse({ profile: baseProfile({ record_sha256: "sha-def456" }) })
  });

  const preferredUnit = screen.getByLabelText("Preferred load unit") as HTMLSelectElement;
  await waitFor(() => assert.equal(preferredUnit.value, "kg"));
  assert.equal((screen.getByLabelText("Bodyweight") as HTMLInputElement).value, "82");
  assert.equal((screen.getByLabelText("Reference load") as HTMLInputElement).value, "150");
  assert.equal(screen.getByText("Tested 1RM · 150 kg · Effective 2026-07-01 · Source: Meet PR", { exact: false }) !== null, true);
  assert.ok(screen.getByText("Current"));

  await act(async () => {
    fireEvent.submit(screen.getByText("Save athlete profile").closest("form")!);
  });

  await waitFor(() => screen.getByText("Athlete profile saved."));

  const saveCall = mock.calls.find(
    (call) => String(call.input) === "/coach-workspace/athlete-strength-profile" && call.init?.method === "POST"
  );
  assert.ok(saveCall, "expected a POST /coach-workspace/athlete-strength-profile request");
  assert.equal((saveCall!.init?.headers as Record<string, string>)["x-kolosseum-csrf"], "csrf-athlete");

  const body = JSON.parse(String(saveCall!.init?.body));
  assert.equal(body.athlete_user_id, "athlete_test123");
  assert.equal(body.preferred_weight_unit, "kg");
  assert.equal(body.expected_current_record_sha256, "sha-abc123");
  assert.equal(body.benchmarks.length, 1);
  assert.equal(body.benchmarks[0].benchmark_id, "ref_squat_1");
});

test("adding a new strength record posts it alongside the existing persisted benchmark", async () => {
  const mock = await openPanel(baseProfile());

  fireEvent.click(screen.getByText("Add strength record"));

  const valueInputs = screen.getAllByLabelText("Reference load") as HTMLInputElement[];
  assert.equal(valueInputs.length, 2);
  assert.equal(valueInputs[0].disabled, true, "the persisted record stays immutable");
  assert.equal(valueInputs[1].disabled, false, "the new draft record is editable");

  fireEvent.change(valueInputs[1], { target: { value: "205" } });

  await act(async () => {
    fireEvent.submit(screen.getByText("Save athlete profile").closest("form")!);
  });

  await waitFor(() => screen.getByText("Athlete profile could not be saved. Check your connection and try again."));

  const saveCall = mock.calls.find(
    (call) => String(call.input) === "/coach-workspace/athlete-strength-profile" && call.init?.method === "POST"
  );
  const body = JSON.parse(String(saveCall!.init?.body));
  assert.equal(body.benchmarks.length, 2);
  assert.equal(body.benchmarks[1].benchmark_id, "");
  assert.equal(body.benchmarks[1].value, 205);
});

test("a persisted benchmark row is immutable and shows Immutable record instead of a remove control", async () => {
  await openPanel(baseProfile());

  const row = screen.getByText("Meet PR", { exact: false }).closest(".benchmark-row") as HTMLElement;
  const removeButton = within(row).getByText("Immutable record") as HTMLButtonElement;
  assert.equal(removeButton.disabled, true);
});

test("closing the profile clears the panel back to rendering nothing", async () => {
  await openPanel(baseProfile());

  act(() => {
    document.dispatchEvent(new CustomEvent("kolosseum:coach-athlete-profile-closed"));
  });

  await waitFor(() => assert.equal(screen.queryByText("Save athlete profile"), null));
});

test("a benchmark source note containing markup is rendered as inert text, never as HTML", async () => {
  await openPanel(
    baseProfile({
      benchmarks: [
        {
          benchmark_id: "ref_squat_1",
          exercise_id: "back_squat",
          value: 150,
          unit: "kg",
          basis: "tested_1rm",
          effective_date: "2026-07-01",
          source_note: '<img src=x onerror="window.pwned=true">',
          replaces_reference_id: null
        }
      ]
    })
  );

  assert.equal((globalThis as Record<string, unknown>).pwned, undefined);
  assert.equal(document.querySelectorAll("img").length, 0);
  assert.match(document.body.textContent ?? "", /<img src=x onerror="window\.pwned=true">/u);
});
