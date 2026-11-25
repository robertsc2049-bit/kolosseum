import React, { StrictMode } from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";

import { readRole } from "./utils/role";

// DEV NOTE: mounts once at script load into divs that always exist in
// public/app/index.html (which the legacy router shows/hides unchanged -
// see each panel's own event listeners for how it learns when it becomes
// relevant). Do not mount other screens from this same entry point without
// first re-reading the migration plan's per-screen scoping.
//
// A screen's panels fetch when they mount, so they mount when they're first
// needed: the other role's never, and most screens the first time they're
// shown (app.js's setView announces each one, and mounting is synchronous so
// an event sent straight after still finds its listener). Screens other code
// talks to while hidden (below) mount as soon as the role is known.
const ATHLETE_VIEWS = new Set(["view-today", "view-session", "view-history", "view-programme", "view-attendance", "view-onboarding"]);
const COACH_VIEWS = new Set(["view-coach-overview", "view-athletes", "view-events", "view-templates", "view-marketplace", "view-review", "view-coach-progress", "view-coach-attendance", "view-coach-onboarding"]);
const WHEN_SHOWN = new Set(["view-history", "view-events", "view-review", "view-programme", "view-attendance", "view-onboarding", "view-marketplace", "view-coach-progress", "view-coach-attendance", "view-coach-onboarding", "view-account", "view-calculator"]);
type Waiting = { container: HTMLElement; node: React.ReactNode; role: string | null; whenShown: boolean; signedOut: boolean };
const waiting = new Set<Waiting>();

// Events that open a screen and say what to show in it: if the panel they're
// for mounts because of one, it hears it too.
const OPENING_EVENTS: Record<string, string> = {
  "coach-review-root": "kolosseum:open-session-review",
  "coach-event-detail-root": "kolosseum:open-event-detail",
  "athlete-history-root": "kolosseum:history-detail-route"
};
const lastOpening = new Map<string, { detail: unknown; at: number }>();
for (const name of Object.values(OPENING_EVENTS)) {
  document.addEventListener(name, (event) => lastOpening.set(name, { detail: (event as CustomEvent).detail, at: Date.now() }), true);
}

function ready({ container, role, whenShown, signedOut }: Waiting): boolean {
  if (signedOut) return container.closest("[hidden]") === null;
  const signedIn = document.getElementById("appShell")?.hidden === false;
  if (role !== null && (!signedIn || readRole() !== role)) return false;
  return !whenShown || (signedIn && container.closest("[hidden]") === null);
}

export function mountReady(): void {
  const due = [...waiting].filter(ready);
  if (due.length === 0) return;
  for (const entry of due) waiting.delete(entry);
  flushSync(() => {
    for (const { container, node } of due) createRoot(container).render(<StrictMode>{node}</StrictMode>);
  });
  for (const { container } of due) {
    const name = OPENING_EVENTS[container.id];
    const said = name ? lastOpening.get(name) : undefined;
    if (!name || !said || Date.now() - said.at > 2000) continue;
    lastOpening.delete(name);
    setTimeout(() => document.dispatchEvent(new CustomEvent(name, { detail: said.detail })), 0);
  }
}

export function mount(containerId: string, node: React.ReactNode, { now = false }: { now?: boolean } = {}) {
  const container = document.getElementById(containerId);
  if (!container) return;
  const view = container.closest(".view")?.id ?? "";
  // History's Wellbeing tab: eight panels behind a tab.
  const inTab = container.closest('#view-history [data-tab-panel="wellbeing"]') !== null;
  waiting.add({
    container, node,
    role: ATHLETE_VIEWS.has(view) ? "athlete" : COACH_VIEWS.has(view) ? "coach" : null,
    whenShown: !now && (WHEN_SHOWN.has(view) || inTab),
    signedOut: container.closest("#entryView") !== null
  });
}
