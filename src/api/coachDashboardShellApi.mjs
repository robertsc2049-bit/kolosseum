/**
 * DEV NOTE: S-V1-U-02 coach dashboard shell API adapter.
 * Purpose: maps supplied product records into a transport response for the coach dashboard shell.
 * Boundary: delegates permission and read-model construction to src/coachDashboardShell.mjs; it does not import engine code, mutate session state, read payment state, create dashboards outside this slice, or create persistence behaviour.
 * Determinism: pure adapter over explicit request body.
 * Failure: product/auth failures are returned as factual HTTP-style response objects without engine tokens.
 */

import {
  buildCoachDashboardShell,
  tryBuildCoachDashboardShell
} from "../coachDashboardShell.mjs";

export function getCoachDashboardShellResponse(requestBody) {
  const result = tryBuildCoachDashboardShell(requestBody);

  if (!result.ok) {
    return Object.freeze({
      status: result.code === "coach_dashboard_actor_not_coach" ? 403 : 400,
      body: Object.freeze({
        ok: false,
        code: result.code,
        details: result.details,
        engine_visible: false
      })
    });
  }

  return Object.freeze({
    status: 200,
    body: Object.freeze({
      ok: true,
      coach_dashboard_shell: result.body,
      engine_visible: false
    })
  });
}

export function requireCoachDashboardShellResponse(requestBody) {
  return Object.freeze({
    status: 200,
    body: Object.freeze({
      ok: true,
      coach_dashboard_shell: buildCoachDashboardShell(requestBody),
      engine_visible: false
    })
  });
}