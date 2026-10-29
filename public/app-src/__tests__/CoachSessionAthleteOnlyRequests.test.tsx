// The athlete panels stay mounted whatever account is signed in, so a coach/
// org owner/admin session must not call any athlete-only endpoint (each one
// answers 403). Pins every such read the panels make on load and after a
// sign-in refetch.
import assert from "node:assert/strict";
import test from "node:test";

import React from "react";
import { act, cleanup, render, waitFor } from "@testing-library/react";

import { AccountCoachInvitationsPanel } from "../screens/account/AccountCoachInvitationsPanel";
import { AccountOrgMessagesPanel } from "../screens/account/AccountOrgMessagesPanel";
import { AthleteAttendanceEventsPanel } from "../screens/athlete/AthleteAttendanceEventsPanel";
import { AthleteHistoryPanel } from "../screens/athlete/AthleteHistoryPanel";
import { AthleteMyProgrammePanel } from "../screens/athlete/AthleteMyProgrammePanel";
import { AthleteOnboardingPanel } from "../screens/athlete/AthleteOnboardingPanel";
import { AthleteProgressReportsPanel } from "../screens/athlete/AthleteProgressReports";
import { AthleteSelfBodyMetricsPanel } from "../screens/athlete/AthleteSelfBodyMetricsPanel";
import { AthleteSelfDeviceSyncPanel } from "../screens/athlete/AthleteSelfDeviceSyncPanel";
import { AthleteSelfGoalsPanel } from "../screens/athlete/AthleteSelfGoalsPanel";
import { AthleteSelfHabitsPanel } from "../screens/athlete/AthleteSelfHabitsPanel";
import { AthleteSelfNutritionPanel } from "../screens/athlete/AthleteSelfNutritionPanel";
import { AthleteSelfProgressInsightsPanel } from "../screens/athlete/AthleteSelfProgressInsightsPanel";
import { AthleteSelfProgressPhotosPanel } from "../screens/athlete/AthleteSelfProgressPhotosPanel";
import { AthleteSelfWeeklyCheckinsPanel } from "../screens/athlete/AthleteSelfWeeklyCheckinsPanel";
import { AthleteTodayRecentActivityList } from "../screens/athlete/AthleteTodayRecentActivityPanel";
import { OtherTrainingPanel } from "../screens/athlete/OtherTrainingPanel";
import { ENTRY_AUTH_SUCCEEDED_EVENT } from "../screens/entry/useEntryAuth";

const ATHLETE_ONLY_PATHS = [
  "/coach-workspace/relationship-invitations",
  "/messages/athlete/org-messages/threads",
  "/coach-workspace/org-context/mine",
  "/account/onboarding/",
  "/attendance-events/mine",
  "/weekly-checkins",
  "/progress-insights",
  "/device-sync/",
  "/athlete-goals",
  "/body-metrics",
  "/habits",
  "/progress-photos",
  "/sessions/beta-athlete-history"
];

function jsonResponse(body: unknown, ok = true, status = ok ? 200 : 400): Response {
  return { ok, status, text: async () => JSON.stringify(body), json: async () => body } as Response;
}

function installMocks(actorType: string) {
  const requested: string[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const path = String(input);
    requested.push(path);
    if (path.startsWith("/account/detail")) return jsonResponse({ account: { user_id: `${actorType}_1`, actor_type: actorType }, csrf_token: "csrf-abc" });
    return jsonResponse({ ok: false, error: "forbidden" }, false, 403);
  }) as typeof fetch;
  return requested;
}

function renderAthletePanels() {
  return render(
    <>
      <AccountCoachInvitationsPanel />
      <AccountOrgMessagesPanel />
      <AthleteAttendanceEventsPanel />
      <AthleteHistoryPanel />
      <AthleteMyProgrammePanel />
      <AthleteOnboardingPanel />
      <AthleteProgressReportsPanel />
      <AthleteSelfBodyMetricsPanel />
      <AthleteSelfDeviceSyncPanel />
      <AthleteSelfGoalsPanel />
      <AthleteSelfHabitsPanel />
      <AthleteSelfNutritionPanel />
      <AthleteSelfProgressInsightsPanel />
      <AthleteSelfProgressPhotosPanel />
      <AthleteSelfWeeklyCheckinsPanel />
      <AthleteTodayRecentActivityList />
      <OtherTrainingPanel />
    </>
  );
}

function athleteOnlyRequests(requested: string[]) {
  return requested.filter((path) => ATHLETE_ONLY_PATHS.some((prefix) => path.startsWith(prefix)));
}

test.afterEach(() => cleanup());

for (const actorType of ["coach", "org_owner", "admin"]) {
  test(`a ${actorType} session makes no athlete-only requests from the always-mounted athlete panels`, async () => {
    const requested = installMocks(actorType);
    renderAthletePanels();
    await waitFor(() => assert.ok(requested.some((path) => path.startsWith("/account/detail"))));
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 30));
    });
    await act(async () => {
      document.dispatchEvent(new CustomEvent(ENTRY_AUTH_SUCCEEDED_EVENT));
      document.dispatchEvent(new CustomEvent("kolosseum:account-role-known"));
      await new Promise((resolve) => setTimeout(resolve, 30));
    });
    assert.deepEqual(athleteOnlyRequests(requested), []);
  });
}

test("an athlete session still makes the athlete reads", async () => {
  const requested = installMocks("athlete");
  renderAthletePanels();
  await waitFor(() => {
    const athleteReads = athleteOnlyRequests(requested);
    for (const prefix of ATHLETE_ONLY_PATHS) {
      assert.ok(athleteReads.some((path) => path.startsWith(prefix)), `expected a request to ${prefix}`);
    }
  });
});
