import React, { StrictMode } from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";

import { AccountBrandingPanel } from "./screens/account/AccountBrandingPanel";
import { AccountIdentityHeaderCard, AccountCodeCard } from "./screens/account/AccountIdentityHeaderPanel";
import { AccountCoachCodePanel } from "./screens/account/AccountCoachCodePanel";
import { AccountCoachInvitationsPanel } from "./screens/account/AccountCoachInvitationsPanel";
import { AthleteCoachingRequestsPanel } from "./screens/account/AthleteCoachingRequestsPanel";
import { AccountCoachRelationshipPanel } from "./screens/account/AccountCoachRelationshipPanel";
import { AccountDataRightsPanel } from "./screens/account/AccountDataRightsPanel";
import { AccountIdentityPanel } from "./screens/account/AccountIdentityPanel";
import { NotificationBellPanel } from "./screens/account/NotificationBellPanel";
import { AccountOrgContextPanel } from "./screens/account/AccountOrgContextPanel";
import { TeamRosterPanel } from "./screens/account/TeamRosterPanel";
import { AccountOrgMessagesPanel } from "./screens/account/AccountOrgMessagesPanel";
import { CoachOrgMessagesPanel } from "./screens/account/CoachOrgMessagesPanel";
import { AccountSupportPanel } from "./screens/account/AccountSupportPanel";
import { CommercialPanel } from "./screens/account/CommercialPanel";
import { AthleteHistoryPanel } from "./screens/athlete/AthleteHistoryPanel";
import { AthleteOnboardingPanel } from "./screens/athlete/AthleteOnboardingPanel";
import { AthleteMyProgrammePanel } from "./screens/athlete/AthleteMyProgrammePanel";
import { AthleteProgressReportsPanel } from "./screens/athlete/AthleteProgressReports";
import { OtherTrainingPanel } from "./screens/athlete/OtherTrainingPanel";
import { AthleteSelfBodyMetricsPanel } from "./screens/athlete/AthleteSelfBodyMetricsPanel";
import { AthleteSelfDeviceSyncPanel } from "./screens/athlete/AthleteSelfDeviceSyncPanel";
import { AthleteSelfGoalsPanel } from "./screens/athlete/AthleteSelfGoalsPanel";
import { AthleteSelfHabitsPanel } from "./screens/athlete/AthleteSelfHabitsPanel";
import { AthleteSelfNutritionPanel } from "./screens/athlete/AthleteSelfNutritionPanel";
import { AthleteSelfProgressPhotosPanel } from "./screens/athlete/AthleteSelfProgressPhotosPanel";
import { AthleteSelfProgressInsightsPanel } from "./screens/athlete/AthleteSelfProgressInsightsPanel";
import { AthleteSelfWeeklyCheckinsPanel } from "./screens/athlete/AthleteSelfWeeklyCheckinsPanel";
import { AthleteSessionExecutionPanel } from "./screens/athlete/AthleteSessionExecutionPanel";
import { AthleteTodayHistoryCountBadge, AthleteTodayRecentActivityList } from "./screens/athlete/AthleteTodayRecentActivityPanel";
import { AthleteTodayInstallPrompt, AthleteTodayCreateSessionButton, AthleteTodayEventCard, AthleteTodaySessionCard } from "./screens/athlete/AthleteTodayPanel";
import { TodayWeeklyCheckin } from "./screens/athlete/TodayWeeklyCheckin";
import { TodayReadiness } from "./screens/athlete/TodayReadiness";
import { PainCheckInCard } from "./screens/athlete/PainCheckInCard";
import { AthleteDirectoryPanel } from "./screens/coach/AthleteDirectoryPanel";
import { AthleteProfileAssignmentPanel } from "./screens/coach/AthleteProfileAssignmentPanel";
import { AthleteRelationshipDetailPanel } from "./screens/coach/AthleteRelationshipDetailPanel";
import {
  AthleteAssignmentHistoryList,
  AthleteBodyweightHistoryList,
  AthleteCurrentEventCard,
  AthleteCurrentProgrammeCard,
  AthleteEventLinkHistoryList,
  AthleteSessionHistoryList,
  AthleteStrengthHistoryList
} from "./screens/coach/AthleteHistoryPanels";
import { AthleteBodyMetricsPanel } from "./screens/coach/AthleteBodyMetricsPanel";
import { AthleteCoachNotesPanel } from "./screens/coach/AthleteCoachNotesPanel";
import { AthleteDeviceSyncPanel } from "./screens/coach/AthleteDeviceSyncPanel";
import { AthleteGoalsPanel } from "./screens/coach/AthleteGoalsPanel";
import { AthleteHabitsPanel } from "./screens/coach/AthleteHabitsPanel";
import { AthleteNutritionPanel } from "./screens/coach/AthleteNutritionPanel";
import { AthleteOrgMessagesPanel } from "./screens/coach/AthleteOrgMessagesPanel";
import { AthleteProgressInsightsPanel } from "./screens/coach/AthleteProgressInsightsPanel";
import { AthletePainFlagsPanel } from "./screens/coach/AthletePainFlagsPanel";
import { AthleteProgressPhotosPanel } from "./screens/coach/AthleteProgressPhotosPanel";
import { AthleteStrengthProfilePanel } from "./screens/coach/AthleteStrengthProfilePanel";
import { AthleteWeeklyCheckinsPanel } from "./screens/coach/AthleteWeeklyCheckinsPanel";
import { CoachEventCreatePanel } from "./screens/coach/CoachEventCreatePanel";
import { CoachEventDetailPanel } from "./screens/coach/CoachEventDetailPanel";
import { CoachEventsListPanel, CoachEventsMetricCards } from "./screens/coach/CoachEventsLibraryPanel";
import { CoachMarketplacePanel } from "./screens/coach/CoachMarketplacePanel";
import { CoachOnboardingPanel } from "./screens/coach/CoachOnboardingPanel";
import { CoachProgrammeLibraryPanel, CoachProgrammeMetricsPanel } from "./screens/coach/CoachProgrammeLibraryPanel";
import { CoachProgrammeDetailHeader, CoachProgrammeDetailPanel } from "./screens/coach/CoachProgrammeDetailPanel";
import { CoachProgrammeValidationPanel } from "./screens/coach/CoachProgrammeValidationPanel";
import { CoachProgrammePreviewPanel } from "./screens/coach/CoachProgrammePreviewPanel";
import { CoachProgrammeMarketplaceSharingPanel } from "./screens/coach/CoachProgrammeMarketplaceSharingPanel";
import { CoachAnalysisPanel } from "./screens/coach/CoachAnalysisPanel";
import { AttendanceEventCreatePanel } from "./screens/coach/AttendanceEventCreatePanel";
import { AttendanceEventDetailPanel } from "./screens/coach/AttendanceEventDetailPanel";
import { AthleteAttendanceEventsPanel } from "./screens/athlete/AthleteAttendanceEventsPanel";
import { CoachProgrammeBuilderFactsPanel } from "./screens/coach/CoachProgrammeBuilderFactsPanel";
import { CoachProgrammeBuilderValidationList } from "./screens/coach/CoachProgrammeBuilderValidationList";
import { CoachProgrammeBuilderTree } from "./screens/coach/CoachProgrammeBuilderTree";
import { CoachProgrammeBuilderSaveBadge, CoachProgrammeBuilderSaveDetail } from "./screens/coach/CoachProgrammeBuilderSaveStatus";
import { CoachProgrammeIdentityFields } from "./screens/coach/CoachProgrammeIdentityFields";
import { CoachProgrammeEventFields } from "./screens/coach/CoachProgrammeEventFields";
import { CoachProgrammeEventBindingPicker } from "./screens/coach/CoachProgrammeEventBindingPicker";
import { CoachReviewPanel } from "./screens/coach/CoachReviewPanel";
import { CoachVideoFeedbackQueuePanel } from "./screens/coach/CoachVideoFeedbackQueuePanel";
import { CoachAthleteMessagePanel } from "./screens/coach/CoachAthleteMessagePanel";
import { CoachBroadcastPanel } from "./screens/coach/CoachBroadcastPanel";
import { CoachOverviewAssignmentsPanel } from "./screens/coach/CoachOverviewAssignmentsPanel";
import { CoachOverviewMetricsPanel } from "./screens/coach/CoachOverviewMetricsPanel";
import { CoachOverviewAthletesPanel } from "./screens/coach/CoachOverviewAthletesPanel";
import { CoachOverviewEventsPanel } from "./screens/coach/CoachOverviewEventsPanel";
import { CoachOverviewOpenSessionsPanel, CoachOverviewReviewQueuePanel } from "./screens/coach/CoachOverviewSessionReviewPanel";
import { ConnectAthletePanel } from "./screens/coach/ConnectAthletePanel";
import { InviteAthleteByEmailPanel } from "./screens/coach/InviteAthleteByEmailPanel";
import { CoachingRequestsPanel } from "./screens/coach/CoachingRequestsPanel";
import { VerifyEmailPrompt } from "./screens/account/VerifyEmailPrompt";
import { CoachPaymentsPanel } from "./screens/coach/CoachPaymentsPanel";
import { CoachLinkRequestCard } from "./screens/athlete/CoachLinkRequestCard";
import { AthleteFirstStepsGuide } from "./screens/athlete/AthleteFirstStepsGuide";
import { CoachFirstProgrammeGuide } from "./screens/coach/CoachFirstProgrammeGuide";
import { AthleteCheckinsCard } from "./screens/athlete/AthleteCheckinsCard";
import { CoachAthleteCheckinsPanel } from "./screens/coach/CoachAthleteCheckinsPanel";
import { EntryAuthPanel } from "./screens/entry/EntryAuthPanel";
import { BarbellCalculatorPanel } from "./screens/tools/BarbellCalculatorPanel";
import { capturePendingCoachFromUrl } from "./utils/pendingCoach";
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

function mountReady(): void {
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

function mount(containerId: string, node: React.ReactNode, { now = false }: { now?: boolean } = {}) {
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

// A coach's share link opens /app/?coach=<slug> - keep it before anything renders.
capturePendingCoachFromUrl();

mount("entry-auth-root", <EntryAuthPanel />);
mount("verify-email-prompt-root", <VerifyEmailPrompt />);
mount("barbell-calculator-root", <BarbellCalculatorPanel />);
mount("account-identity-header-root", <AccountIdentityHeaderCard />);
mount("account-code-root", <AccountCodeCard />);
mount("account-identity-root", <AccountIdentityPanel />);
mount("notification-bell-root", <NotificationBellPanel />);
mount("account-data-rights-root", <AccountDataRightsPanel />);
mount("account-support-root", <AccountSupportPanel />);
mount("account-branding-root", <AccountBrandingPanel />);
// Back from Stripe's checkout: it reads the result from the address.
mount("account-commercial-root", <CommercialPanel />, { now: window.location.search !== "" });
mount("account-coach-invitations-root", <AccountCoachInvitationsPanel />);
mount("account-coach-relationship-root", <AccountCoachRelationshipPanel />);
mount("account-coaching-requests-root", <AthleteCoachingRequestsPanel />);
mount("account-coach-code-root", <AccountCoachCodePanel />);
mount("account-org-messages-root", <AccountOrgMessagesPanel />);
mount("account-org-context-root", <AccountOrgContextPanel />);
mount("coach-org-messages-root", <CoachOrgMessagesPanel />);
mount("account-team-roster-root", <TeamRosterPanel />);
mount("athlete-profile-editor-root", <AthleteStrengthProfilePanel />);
mount("athlete-profile-assignment-root", <AthleteProfileAssignmentPanel />);
mount("coach-athlete-message-root", <CoachAthleteMessagePanel />);
mount("coach-athlete-checkins-root", <CoachAthleteCheckinsPanel />);
mount("athlete-progress-insights-root", <AthleteProgressInsightsPanel />);
mount("athlete-pain-flags-root", <AthletePainFlagsPanel />);
mount("athlete-weekly-checkins-root", <AthleteWeeklyCheckinsPanel />);
mount("athlete-goals-root", <AthleteGoalsPanel />);
mount("athlete-habits-root", <AthleteHabitsPanel />);
mount("athlete-device-sync-root", <AthleteDeviceSyncPanel />);
mount("athlete-body-metrics-root", <AthleteBodyMetricsPanel />);
mount("athlete-nutrition-root", <AthleteNutritionPanel />);
mount("athlete-progress-photos-root", <AthleteProgressPhotosPanel />);
mount("athlete-coach-notes-root", <AthleteCoachNotesPanel />);
mount("athlete-org-messages-root", <AthleteOrgMessagesPanel />);
mount("athlete-history-current-programme-root", <AthleteCurrentProgrammeCard />);
mount("athlete-history-current-event-root", <AthleteCurrentEventCard />);
mount("athlete-history-assignment-root", <AthleteAssignmentHistoryList />);
mount("athlete-history-strength-root", <AthleteStrengthHistoryList />);
mount("athlete-history-bodyweight-root", <AthleteBodyweightHistoryList />);
mount("athlete-history-event-link-root", <AthleteEventLinkHistoryList />);
mount("athlete-history-session-root", <AthleteSessionHistoryList />);
mount("athlete-progress-reports-root", <AthleteProgressReportsPanel />);
mount("athlete-other-training-root", <OtherTrainingPanel />);
mount("athlete-directory-root", <AthleteDirectoryPanel />);
mount("invite-athlete-root", <InviteAthleteByEmailPanel />);
mount("coaching-requests-root", <CoachingRequestsPanel />);
mount("coach-payments-root", <CoachPaymentsPanel />);
mount("coach-broadcast-root", <CoachBroadcastPanel />);
mount("connect-athlete-root", <ConnectAthletePanel />);
mount("athlete-relationship-detail-root", <AthleteRelationshipDetailPanel />);
mount("coach-overview-events-root", <CoachOverviewEventsPanel />);
mount("coach-overview-assignments-root", <CoachOverviewAssignmentsPanel />);
mount("coach-overview-metrics-root", <CoachOverviewMetricsPanel />);
mount("coach-overview-athletes-root", <CoachOverviewAthletesPanel />);
mount("coach-overview-open-sessions-root", <CoachOverviewOpenSessionsPanel />);
mount("coach-overview-review-queue-root", <CoachOverviewReviewQueuePanel />);
mount("coach-events-metrics-root", <CoachEventsMetricCards />);
mount("coach-events-list-root", <CoachEventsListPanel />);
mount("coach-event-create-root", <CoachEventCreatePanel />);
mount("coach-event-detail-root", <CoachEventDetailPanel />);
mount("coach-marketplace-root", <CoachMarketplacePanel />);
// The coach's Analysis page (was the Progress roster): who needs a look,
// and each athlete's pattern trends.
mount("coach-progress-overview-root", <CoachAnalysisPanel />);
mount("attendance-event-create-root", <AttendanceEventCreatePanel />);
mount("attendance-event-detail-root", <AttendanceEventDetailPanel />);
mount("athlete-attendance-events-root", <AthleteAttendanceEventsPanel />);
mount("coach-review-root", <CoachReviewPanel />);
mount("coach-video-feedback-queue-root", <CoachVideoFeedbackQueuePanel />);
mount("athlete-today-create-session-root", <AthleteTodayCreateSessionButton />);
mount("coach-link-request-root", <CoachLinkRequestCard />);
mount("athlete-checkins-root", <AthleteCheckinsCard />);
mount("athlete-first-steps-root", <AthleteFirstStepsGuide />);
mount("coach-first-programme-root", <CoachFirstProgrammeGuide />);
mount("athlete-today-pain-check-in-root", <PainCheckInCard dueOnly />);
mount("athlete-today-readiness-root", <TodayReadiness />);
mount("athlete-today-session-root", <AthleteTodaySessionCard />);
mount("athlete-today-event-root", <AthleteTodayEventCard />);
mount("athlete-today-install-root", <AthleteTodayInstallPrompt />);
mount("today-weekly-checkin-root", <TodayWeeklyCheckin />);
mount("today-history-count-root", <AthleteTodayHistoryCountBadge />);
mount("today-recent-activity-root", <AthleteTodayRecentActivityList />);
mount("athlete-history-root", <AthleteHistoryPanel />);
mount("athlete-my-programme-root", <AthleteMyProgrammePanel />);
mount("athlete-onboarding-root", <AthleteOnboardingPanel />);
mount("coach-onboarding-root", <CoachOnboardingPanel />);
mount("templates-metrics-root", <CoachProgrammeMetricsPanel />);
mount("templates-library-root", <CoachProgrammeLibraryPanel />);
mount("programme-detail-header-root", <CoachProgrammeDetailHeader />);
mount("programme-detail-root", <CoachProgrammeDetailPanel />);
mount("programme-validation-root", <CoachProgrammeValidationPanel />);
mount("programme-preview-root", <CoachProgrammePreviewPanel />);
mount("programme-marketplace-sharing-root", <CoachProgrammeMarketplaceSharingPanel />);
mount("programme-builder-facts-root", <CoachProgrammeBuilderFactsPanel />);
mount("templateBuilderValidationList", <CoachProgrammeBuilderValidationList />);
mount("templateBlocks", <CoachProgrammeBuilderTree />);
mount("programme-builder-save-badge-root", <CoachProgrammeBuilderSaveBadge />);
mount("programme-builder-save-detail-root", <CoachProgrammeBuilderSaveDetail />);
mount("template-identity-root", <CoachProgrammeIdentityFields />);
mount("template-event-binding-root", <CoachProgrammeEventBindingPicker />);
mount("template-event-fields-root", <CoachProgrammeEventFields />);
mount("athlete-self-weekly-checkins-root", <AthleteSelfWeeklyCheckinsPanel />);
mount("athlete-self-progress-insights-root", <AthleteSelfProgressInsightsPanel />);
mount("athlete-self-device-sync-root", <AthleteSelfDeviceSyncPanel />);
mount("athlete-self-goals-root", <AthleteSelfGoalsPanel />);
mount("athlete-self-body-metrics-root", <AthleteSelfBodyMetricsPanel />);
mount("athlete-self-nutrition-root", <AthleteSelfNutritionPanel />);
mount("athlete-self-habits-root", <AthleteSelfHabitsPanel />);
mount("athlete-self-progress-photos-root", <AthleteSelfProgressPhotosPanel />);
mount("athlete-session-root", <AthleteSessionExecutionPanel />);

mountReady();
document.addEventListener("kolosseum:view-shown", mountReady);
document.addEventListener("kolosseum:account-role-known", mountReady);
// Anything shown some other way (a tab, sign-in, a section opened by hand).
new MutationObserver(mountReady).observe(document.body, { subtree: true, attributes: true, attributeFilter: ["hidden"] });
