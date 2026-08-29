import React, { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { AccountBrandingPanel } from "./screens/account/AccountBrandingPanel";
import { AccountIdentityHeaderCard, AccountCodeCard } from "./screens/account/AccountIdentityHeaderPanel";
import { AccountCoachCodePanel } from "./screens/account/AccountCoachCodePanel";
import { AccountCoachInvitationsPanel } from "./screens/account/AccountCoachInvitationsPanel";
import { AccountCoachRelationshipPanel } from "./screens/account/AccountCoachRelationshipPanel";
import { AccountDataRightsPanel } from "./screens/account/AccountDataRightsPanel";
import { AccountIdentityPanel } from "./screens/account/AccountIdentityPanel";
import { AccountOrgContextPanel } from "./screens/account/AccountOrgContextPanel";
import { AccountOrgMessagesPanel } from "./screens/account/AccountOrgMessagesPanel";
import { AccountSupportPanel } from "./screens/account/AccountSupportPanel";
import { CommercialPanel } from "./screens/account/CommercialPanel";
import { AthleteHistoryPanel } from "./screens/athlete/AthleteHistoryPanel";
import { AthleteOnboardingPanel } from "./screens/athlete/AthleteOnboardingPanel";
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
import { AthleteTodayCreateSessionButton, AthleteTodayEventCard, AthleteTodaySessionCard } from "./screens/athlete/AthleteTodayPanel";
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
import { CoachProgrammeBuilderFactsPanel } from "./screens/coach/CoachProgrammeBuilderFactsPanel";
import { CoachProgrammeBuilderValidationList } from "./screens/coach/CoachProgrammeBuilderValidationList";
import { CoachProgrammeBuilderTree } from "./screens/coach/CoachProgrammeBuilderTree";
import { CoachProgrammeBuilderSaveBadge, CoachProgrammeBuilderSaveDetail } from "./screens/coach/CoachProgrammeBuilderSaveStatus";
import { CoachProgrammeIdentityFields } from "./screens/coach/CoachProgrammeIdentityFields";
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

// DEV NOTE: mounts once at script load into divs that always exist in
// public/app/index.html (which the legacy router shows/hides unchanged -
// see each panel's own event listeners for how it learns when it becomes
// relevant). Do not mount other screens from this same entry point without
// first re-reading the migration plan's per-screen scoping.
function mount(containerId: string, node: React.ReactNode) {
  const container = document.getElementById(containerId);
  if (!container) return;
  createRoot(container).render(<StrictMode>{node}</StrictMode>);
}

mount("account-identity-header-root", <AccountIdentityHeaderCard />);
mount("account-code-root", <AccountCodeCard />);
mount("account-identity-root", <AccountIdentityPanel />);
mount("account-data-rights-root", <AccountDataRightsPanel />);
mount("account-support-root", <AccountSupportPanel />);
mount("account-branding-root", <AccountBrandingPanel />);
mount("account-commercial-root", <CommercialPanel />);
mount("account-coach-invitations-root", <AccountCoachInvitationsPanel />);
mount("account-coach-relationship-root", <AccountCoachRelationshipPanel />);
mount("account-coach-code-root", <AccountCoachCodePanel />);
mount("account-org-messages-root", <AccountOrgMessagesPanel />);
mount("account-org-context-root", <AccountOrgContextPanel />);
mount("athlete-profile-editor-root", <AthleteStrengthProfilePanel />);
mount("athlete-profile-assignment-root", <AthleteProfileAssignmentPanel />);
mount("coach-athlete-message-root", <CoachAthleteMessagePanel />);
mount("athlete-progress-insights-root", <AthleteProgressInsightsPanel />);
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
mount("athlete-directory-root", <AthleteDirectoryPanel />);
mount("invite-athlete-root", <InviteAthleteByEmailPanel />);
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
mount("coach-review-root", <CoachReviewPanel />);
mount("coach-video-feedback-queue-root", <CoachVideoFeedbackQueuePanel />);
mount("athlete-today-create-session-root", <AthleteTodayCreateSessionButton />);
mount("athlete-today-session-root", <AthleteTodaySessionCard />);
mount("athlete-today-event-root", <AthleteTodayEventCard />);
mount("today-history-count-root", <AthleteTodayHistoryCountBadge />);
mount("today-recent-activity-root", <AthleteTodayRecentActivityList />);
mount("athlete-history-root", <AthleteHistoryPanel />);
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
mount("athlete-self-weekly-checkins-root", <AthleteSelfWeeklyCheckinsPanel />);
mount("athlete-self-progress-insights-root", <AthleteSelfProgressInsightsPanel />);
mount("athlete-self-device-sync-root", <AthleteSelfDeviceSyncPanel />);
mount("athlete-self-goals-root", <AthleteSelfGoalsPanel />);
mount("athlete-self-body-metrics-root", <AthleteSelfBodyMetricsPanel />);
mount("athlete-self-nutrition-root", <AthleteSelfNutritionPanel />);
mount("athlete-self-habits-root", <AthleteSelfHabitsPanel />);
mount("athlete-self-progress-photos-root", <AthleteSelfProgressPhotosPanel />);
mount("athlete-session-root", <AthleteSessionExecutionPanel />);
