import {
  changeAccountPassword,
  completeEmailVerification,
  completePasswordReset,
  confirmDataDeletion as submitDataDeletionConfirmationRequest,
  downloadDataExport as fetchDataExportDownload,
  loadAccountDetail as fetchAccountDetail,
  loadCurrentTerms,
  loadDataDeletionPreview,
  loadDataDeletionStatus,
  loadDataExportStatus,
  registerAccount,
  requestAccountClosure,
  requestDataExport as submitDataExportRequest,
  requestEmailVerification,
  requestPasswordReset,
  restoreAccountSession,
  signInAccount,
  signOutAccount,
  updateAccountProfile
} from "./account_ui.js";

// FULL-UI-18 factual in-product notifications.
import { serializeProductRoute } from "./route_bootstrap.js";

const STORAGE_KEY = "kolosseum.product.app.v1";

const DEFAULT_STATE = Object.freeze({
  version: 1,
  role: null,
  profile: null,
  coachProfile: null,
  authRecord: null,
  acknowledgementRecord: null,
  declarationRecord: null,
  phase1Input: null,
  activeSessionId: null,
  activeSessionState: null,
  history: [],
  localSessions: [],
  view: "today",
  coachAthletes: [],
  coachRelationships: [],
  coachAthleteSearch: "",
  coachAthleteRelationshipFilter: "all",
  coachAssignments: [],
  coachEvents: [],
  athleteEventLinks: {},
  standaloneEventLibrary: [],
  templateEventBindingStatus: null,
  athleteToday: null,
  coachTemplates: [],
  templateLibrarySearch: "",
  templateLibraryStatusFilter: "all",
  templateLibraryActivityFilter: "all",
  templateLibrarySort: "updated_desc",
  selectedTemplateId: "",
  templateExercises: [],
  templateDraft: null,
  templateDraftSavedSnapshot: "",
  templateDraftSavedAt: "",
  templateDraftWasOpen: false,
  templateDraftRecovered: false,
  templateDraftDirty: false,
  athleteProfiles: {},
  athleteProfileDraft: null,
  selectedCoachAthleteId: "",
  coachArtefactCount: 0,
  coachDashboardArtefacts: [],
  coachDashboardFailures: [],
  coachDashboardUpdatedAt: "",
  coachReviewRecords: [],
  coachReviewSearch: "",
  coachReviewFilter: "awaiting",
  coachReviewUpdatedAt: "",
  selectedCoachReviewSessionId: "",
  coachVideoFeedbackQueue: [],
  selectedVideoFeedbackSubmissionId: "",
  athleteDetails: {},
  coachCode: "",
  pendingRelationshipInvitations: [],
  athleteRelationships: [],
  csrfToken: "",
  serverAccount: null,
  accountDetail: null,
  currentTerms: null,
  liveMessageThreadId: null,
  athleteOrgMessageThreads: [],
  athleteOrgContexts: [],
  coachOrgContexts: [],
  coachAthleteOrgMessageThreads: []
});

const state = loadState();

const elements = {
  bootScreen: document.getElementById("bootScreen"),
  entryView: document.getElementById("entryView"),
  entryForm: document.getElementById("entryForm"),
  entryMode: document.getElementById("entryMode"),
  entryCreateTab: document.getElementById("entryCreateTab"),
  entrySignInTab: document.getElementById("entrySignInTab"),
  entryHeading: document.getElementById("entryHeading"),
  entryDescription: document.getElementById("entryDescription"),
  entryCreateFields: document.getElementById("entryCreateFields"),
  entryNameField: document.getElementById("entryNameField"),
  entryRoleChoice: document.getElementById("entryRoleChoice"),
  entryConsentFields: document.getElementById("entryConsentFields"),
  entryName: document.getElementById("entryName"),
  entryEmail: document.getElementById("entryEmail"),
  entryPassword: document.getElementById("entryPassword"),
  forgotPasswordButton: document.getElementById("forgotPasswordButton"),
  passwordResetRequestForm: document.getElementById("passwordResetRequestForm"),
  resetRequestEmail: document.getElementById("resetRequestEmail"),
  resetRequestResult: document.getElementById("resetRequestResult"),
  cancelPasswordResetButton: document.getElementById("cancelPasswordResetButton"),
  passwordResetCompleteForm: document.getElementById("passwordResetCompleteForm"),
  resetCompleteEmail: document.getElementById("resetCompleteEmail"),
  resetCompleteCode: document.getElementById("resetCompleteCode"),
  resetCompletePassword: document.getElementById("resetCompletePassword"),
  resetCompleteResult: document.getElementById("resetCompleteResult"),
  cancelPasswordResetCompleteButton: document.getElementById("cancelPasswordResetCompleteButton"),
  entryActivityField: document.getElementById("entryActivityField"),
  entryActivity: document.getElementById("entryActivity"),
  entryBetaConsent: document.getElementById("entryBetaConsent"),
  entryDeclarationConsent: document.getElementById("entryDeclarationConsent"),
  entrySubmit: document.getElementById("entrySubmit"),
  entryError: document.getElementById("entryError"),
  appShell: document.getElementById("appShell"),
  sidebar: document.getElementById("sidebar"),
  workspaceLabel: document.getElementById("workspaceLabel"),
  sidebarAvatar: document.getElementById("sidebarAvatar"),
  sidebarName: document.getElementById("sidebarName"),
  sidebarRole: document.getElementById("sidebarRole"),
  menuButton: document.getElementById("menuButton"),
  topbarEyebrow: document.getElementById("topbarEyebrow"),
  topbarTitle: document.getElementById("topbarTitle"),
  topbarAccount: document.getElementById("topbarAccount"),
  connectionStatus: document.getElementById("connectionStatus"),
  notificationBellButton: document.getElementById("notificationBellButton"),
  notificationUnreadBadge: document.getElementById("notificationUnreadBadge"),
  notificationPanel: document.getElementById("notificationPanel"),
  notificationMarkAllReadButton: document.getElementById("notificationMarkAllReadButton"),
  notificationLoading: document.getElementById("notificationLoading"),
  notificationServiceUnavailable: document.getElementById("notificationServiceUnavailable"),
  notificationRetryButton: document.getElementById("notificationRetryButton"),
  notificationEmpty: document.getElementById("notificationEmpty"),
  notificationList: document.getElementById("notificationList"),
  platformStatusValue: document.getElementById("platformStatusValue"),
  platformStatusChecked: document.getElementById("platformStatusChecked"),
  checkPlatformStatusButton: document.getElementById("checkPlatformStatusButton"),
  openSupportReportButton: document.getElementById("openSupportReportButton"),
  supportReportPanel: document.getElementById("supportReportPanel"),
  supportReportCorrelationId: document.getElementById("supportReportCorrelationId"),
  supportReportRoute: document.getElementById("supportReportRoute"),
  supportReportTimestamp: document.getElementById("supportReportTimestamp"),
  supportReportBrowserSummary: document.getElementById("supportReportBrowserSummary"),
  supportReportForm: document.getElementById("supportReportForm"),
  supportReportDescription: document.getElementById("supportReportDescription"),
  supportRetryButton: document.getElementById("supportRetryButton"),
  supportRecoveryButton: document.getElementById("supportRecoveryButton"),
  cancelSupportReportButton: document.getElementById("cancelSupportReportButton"),
  supportReportResult: document.getElementById("supportReportResult"),
  supportHistoryEmpty: document.getElementById("supportHistoryEmpty"),
  supportHistoryList: document.getElementById("supportHistoryList"),
  notice: document.getElementById("notice"),
  busyOverlay: document.getElementById("busyOverlay"),
  busyText: document.getElementById("busyText"),

  todayGreeting: document.getElementById("todayGreeting"),
  createSessionButton: document.getElementById("createSessionButton"),
  todayServiceUnavailable: document.getElementById("todayServiceUnavailable"),
  todayRetryButton: document.getElementById("todayRetryButton"),
  todayProgrammeSummary: document.getElementById("todayProgrammeSummary"),
  todayProgrammeName: document.getElementById("todayProgrammeName"),
  todayProgrammeVersion: document.getElementById("todayProgrammeVersion"),
  todayBlockWeek: document.getElementById("todayBlockWeek"),
  todaySessionEmpty: document.getElementById("todaySessionEmpty"),
  todaySessionEmptyIcon: document.getElementById("todaySessionEmptyIcon"),
  todaySessionEmptyHeading: document.getElementById("todaySessionEmptyHeading"),
  todaySessionEmptyBody: document.getElementById("todaySessionEmptyBody"),
  todaySessionContent: document.getElementById("todaySessionContent"),
  todayStatusBadge: document.getElementById("todayStatusBadge"),
  todayActivity: document.getElementById("todayActivity"),
  todaySessionTitle: document.getElementById("todaySessionTitle"),
  todaySessionNotes: document.getElementById("todaySessionNotes"),
  todayCompleted: document.getElementById("todayCompleted"),
  todayRemaining: document.getElementById("todayRemaining"),
  todayDropped: document.getElementById("todayDropped"),
  todayResolvedLoad: document.getElementById("todayResolvedLoad"),
  todayResolvedLoadValue: document.getElementById("todayResolvedLoadValue"),
  todayResolvedLoadSource: document.getElementById("todayResolvedLoadSource"),
  continueSessionButton: document.getElementById("continueSessionButton"),
  todayNotes: document.getElementById("todayNotes"),
  todayNotesList: document.getElementById("todayNotesList"),
  todayHistoryCount: document.getElementById("todayHistoryCount"),
  todayRecentList: document.getElementById("todayRecentList"),
  todayEventCard: document.getElementById("todayEventCard"),
  todayEventType: document.getElementById("todayEventType"),
  todayEventCountdown: document.getElementById("todayEventCountdown"),
  todayEventName: document.getElementById("todayEventName"),
  todayEventDate: document.getElementById("todayEventDate"),

  sessionActivity: document.getElementById("sessionActivity"),
  sessionTitle: document.getElementById("sessionTitle"),
  sessionSubtitle: document.getElementById("sessionSubtitle"),
  sessionStatusBadge: document.getElementById("sessionStatusBadge"),
  sessionLoading: document.getElementById("sessionLoading"),
  sessionServiceUnavailable: document.getElementById("sessionServiceUnavailable"),
  sessionRetryButton: document.getElementById("sessionRetryButton"),
  sessionEmpty: document.getElementById("sessionEmpty"),
  sessionWorkspace: document.getElementById("sessionWorkspace"),
  sessionProgressText: document.getElementById("sessionProgressText"),
  currentExercise: document.getElementById("currentExercise"),
  returnDecision: document.getElementById("returnDecision"),
  skipReasonPanel: document.getElementById("skipReasonPanel"),
  skipReasonSelect: document.getElementById("skipReasonSelect"),
  confirmSkipButton: document.getElementById("confirmSkipButton"),
  cancelSkipButton: document.getElementById("cancelSkipButton"),
  painReportPanel: document.getElementById("painReportPanel"),
  confirmPainReportButton: document.getElementById("confirmPainReportButton"),
  cancelPainReportButton: document.getElementById("cancelPainReportButton"),
  rpeReportPanel: document.getElementById("rpeReportPanel"),
  rpeReportValue: document.getElementById("rpeReportValue"),
  confirmRpeReportButton: document.getElementById("confirmRpeReportButton"),
  cancelRpeReportButton: document.getElementById("cancelRpeReportButton"),
  substitutionPanel: document.getElementById("substitutionPanel"),
  checkSubstitutionButton: document.getElementById("checkSubstitutionButton"),
  cancelSubstitutionButton: document.getElementById("cancelSubstitutionButton"),
  substitutionResult: document.getElementById("substitutionResult"),
  restTimerPanel: document.getElementById("restTimerPanel"),
  restTimerRemaining: document.getElementById("restTimerRemaining"),
  skipRestButton: document.getElementById("skipRestButton"),
  sessionActions: document.getElementById("sessionActions"),
  startSessionButton: document.getElementById("startSessionButton"),
  completeExerciseButton: document.getElementById("completeExerciseButton"),
  skipExerciseButton: document.getElementById("skipExerciseButton"),
  reportPainButton: document.getElementById("reportPainButton"),
  reportRpeButton: document.getElementById("reportRpeButton"),
  requestSubstitutionButton: document.getElementById("requestSubstitutionButton"),
  recordVideoFeedbackButton: document.getElementById("recordVideoFeedbackButton"),
  videoFeedbackPanel: document.getElementById("videoFeedbackPanel"),
  videoFeedbackFileInput: document.getElementById("videoFeedbackFileInput"),
  videoFeedbackCaptionInput: document.getElementById("videoFeedbackCaptionInput"),
  videoFeedbackStatus: document.getElementById("videoFeedbackStatus"),
  uploadVideoFeedbackButton: document.getElementById("uploadVideoFeedbackButton"),
  cancelVideoFeedbackButton: document.getElementById("cancelVideoFeedbackButton"),
  splitSessionButton: document.getElementById("splitSessionButton"),
  returnContinueButton: document.getElementById("returnContinueButton"),
  returnSkipButton: document.getElementById("returnSkipButton"),
  sessionProgressBar: document.getElementById("sessionProgressBar"),
  sessionCompletedCount: document.getElementById("sessionCompletedCount"),
  sessionRemainingCount: document.getElementById("sessionRemainingCount"),
  sessionDroppedCount: document.getElementById("sessionDroppedCount"),
  sessionCompletionSummary: document.getElementById("sessionCompletionSummary"),
  sessionCompletionHeading: document.getElementById("sessionCompletionHeading"),
  sessionCompletionBody: document.getElementById("sessionCompletionBody"),
  sessionCompletionCompletedCount: document.getElementById("sessionCompletionCompletedCount"),
  sessionCompletionDroppedCount: document.getElementById("sessionCompletionDroppedCount"),
  exerciseQueue: document.getElementById("exerciseQueue"),

  refreshHistoryButton: document.getElementById("refreshHistoryButton"),
  exportHistoryButton: document.getElementById("exportHistoryButton"),
  historyList: document.getElementById("historyList"),
  historyLoading: document.getElementById("historyLoading"),
  historyServiceUnavailable: document.getElementById("historyServiceUnavailable"),
  historyRetryButton: document.getElementById("historyRetryButton"),
  historyFilterStatus: document.getElementById("historyFilterStatus"),
  historyFilterDateFrom: document.getElementById("historyFilterDateFrom"),
  historyFilterDateTo: document.getElementById("historyFilterDateTo"),
  historyFilterActivity: document.getElementById("historyFilterActivity"),
  historyFilterProgramme: document.getElementById("historyFilterProgramme"),
  historyFilterEvent: document.getElementById("historyFilterEvent"),
  applyHistoryFiltersButton: document.getElementById("applyHistoryFiltersButton"),
  clearHistoryFiltersButton: document.getElementById("clearHistoryFiltersButton"),
  historyDetailPanel: document.getElementById("historyDetailPanel"),
  progressPhotoUploadForm: document.getElementById("progressPhotoUploadForm"),
  progressPhotoFileInput: document.getElementById("progressPhotoFileInput"),
  progressPhotoTakenAt: document.getElementById("progressPhotoTakenAt"),
  progressPhotoCaption: document.getElementById("progressPhotoCaption"),
  progressPhotoStatus: document.getElementById("progressPhotoStatus"),
  progressPhotoGrid: document.getElementById("progressPhotoGrid"),
  bodyMetricLogForm: document.getElementById("bodyMetricLogForm"),
  bodyMetricTypeSelect: document.getElementById("bodyMetricTypeSelect"),
  bodyMetricValueInput: document.getElementById("bodyMetricValueInput"),
  bodyMetricDateInput: document.getElementById("bodyMetricDateInput"),
  bodyMetricNoteInput: document.getElementById("bodyMetricNoteInput"),
  bodyMetricStatus: document.getElementById("bodyMetricStatus"),
  bodyMetricHistory: document.getElementById("bodyMetricHistory"),
  nutritionForm: document.getElementById("nutritionForm"),
  nutritionDateInput: document.getElementById("nutritionDateInput"),
  nutritionCaloriesInput: document.getElementById("nutritionCaloriesInput"),
  nutritionProteinInput: document.getElementById("nutritionProteinInput"),
  nutritionCarbsInput: document.getElementById("nutritionCarbsInput"),
  nutritionFatInput: document.getElementById("nutritionFatInput"),
  nutritionStatus: document.getElementById("nutritionStatus"),
  nutritionSummary: document.getElementById("nutritionSummary"),
  athleteDetailNutritionSummary: document.getElementById("athleteDetailNutritionSummary"),
  progressInsightsAdherenceSummary: document.getElementById("progressInsightsAdherenceSummary"),
  progressInsightsStrengthList: document.getElementById("progressInsightsStrengthList"),
  progressInsightsHabitList: document.getElementById("progressInsightsHabitList"),
  progressInsightsBodyMetricList: document.getElementById("progressInsightsBodyMetricList"),
  habitCreateForm: document.getElementById("habitCreateForm"),
  habitLabelInput: document.getElementById("habitLabelInput"),
  habitCadenceSelect: document.getElementById("habitCadenceSelect"),
  habitStatus: document.getElementById("habitStatus"),
  habitList: document.getElementById("habitList"),
  athleteGoalCreateForm: document.getElementById("athleteGoalCreateForm"),
  athleteGoalLabelInput: document.getElementById("athleteGoalLabelInput"),
  athleteGoalMetricSelect: document.getElementById("athleteGoalMetricSelect"),
  athleteGoalTargetValueField: document.getElementById("athleteGoalTargetValueField"),
  athleteGoalTargetValueInput: document.getElementById("athleteGoalTargetValueInput"),
  athleteGoalTargetDateInput: document.getElementById("athleteGoalTargetDateInput"),
  athleteGoalStatus: document.getElementById("athleteGoalStatus"),
  athleteGoalList: document.getElementById("athleteGoalList"),
  athleteDetailGoalList: document.getElementById("athleteDetailGoalList"),
  weeklyCheckinForm: document.getElementById("weeklyCheckinForm"),
  weeklyCheckinWeekStartInput: document.getElementById("weeklyCheckinWeekStartInput"),
  weeklyCheckinEnergyInput: document.getElementById("weeklyCheckinEnergyInput"),
  weeklyCheckinMotivationInput: document.getElementById("weeklyCheckinMotivationInput"),
  weeklyCheckinSleepInput: document.getElementById("weeklyCheckinSleepInput"),
  weeklyCheckinNoteInput: document.getElementById("weeklyCheckinNoteInput"),
  weeklyCheckinStatus: document.getElementById("weeklyCheckinStatus"),
  weeklyCheckinList: document.getElementById("weeklyCheckinList"),
  athleteDetailWeeklyCheckinList: document.getElementById("athleteDetailWeeklyCheckinList"),
  deviceConnectForm: document.getElementById("deviceConnectForm"),
  deviceProviderSelect: document.getElementById("deviceProviderSelect"),
  deviceSyncStatus: document.getElementById("deviceSyncStatus"),
  deviceConnectionList: document.getElementById("deviceConnectionList"),
  deviceMetricHistory: document.getElementById("deviceMetricHistory"),

  coachGreeting: document.getElementById("coachGreeting"),
  coachAthleteCount: document.getElementById("coachAthleteCount"),
  coachAssignmentCount: document.getElementById("coachAssignmentCount"),
  coachArtefactCount: document.getElementById("coachArtefactCount"),
  coachOverviewAthletes: document.getElementById("coachOverviewAthletes"),
  coachOpenSessionCount: document.getElementById("coachOpenSessionCount"),
  coachCompletedSessionCount: document.getElementById("coachCompletedSessionCount"),
  coachUpcomingEventCount: document.getElementById("coachUpcomingEventCount"),
  coachDashboardStatus: document.getElementById("coachDashboardStatus"),
  coachDashboardRefreshButton: document.getElementById("coachDashboardRefreshButton"),
  coachOverviewAssignments: document.getElementById("coachOverviewAssignments"),
  coachOverviewOpenSessions: document.getElementById("coachOverviewOpenSessions"),
  coachOverviewReviewQueue: document.getElementById("coachOverviewReviewQueue"),
  coachOverviewEvents: document.getElementById("coachOverviewEvents"),
  connectAthleteForm: document.getElementById("connectAthleteForm"),
  connectAthleteName: document.getElementById("connectAthleteName"),
  connectAthleteId: document.getElementById("connectAthleteId"),
  connectAthleteActivity: document.getElementById("connectAthleteActivity"),
  connectAthleteRelationshipState: document.getElementById("connectAthleteRelationshipState"),
  connectAthleteExpiryField: document.getElementById("connectAthleteExpiryField"),
  connectAthleteExpiry: document.getElementById("connectAthleteExpiry"),
  connectAthleteConsent: document.getElementById("connectAthleteConsent"),
  connectAthleteConsentText: document.getElementById("connectAthleteConsentText"),
  refreshAthleteDirectoryButton: document.getElementById("refreshAthleteDirectoryButton"),
  athleteDirectoryStatus: document.getElementById("athleteDirectoryStatus"),
  inviteAthleteByEmailForm: document.getElementById("inviteAthleteByEmailForm"),
  inviteAthleteEmail: document.getElementById("inviteAthleteEmail"),
  coachBroadcastForm: document.getElementById("coachBroadcastForm"),
  coachBroadcastBodyText: document.getElementById("coachBroadcastBodyText"),
  coachBroadcastStatus: document.getElementById("coachBroadcastStatus"),
  eventsStatus: document.getElementById("eventsStatus"),
  athleteDirectorySearch: document.getElementById("athleteDirectorySearch"),
  athleteRelationshipFilter: document.getElementById("athleteRelationshipFilter"),
  athleteRelationshipCounts: document.getElementById("athleteRelationshipCounts"),
  athleteRoster: document.getElementById("athleteRoster"),
  athleteRelationshipDetailPanel: document.getElementById("athleteRelationshipDetailPanel"),
  athleteRelationshipDetailHeading: document.getElementById("athleteRelationshipDetailHeading"),
  athleteRelationshipDetailState: document.getElementById("athleteRelationshipDetailState"),
  athleteRelationshipAuditFacts: document.getElementById("athleteRelationshipAuditFacts"),
  closeAthleteRelationshipDetailButton: document.getElementById("closeAthleteRelationshipDetailButton"),
  athleteRelationshipProfileButton: document.getElementById("athleteRelationshipProfileButton"),
  athleteRelationshipTransitionButton: document.getElementById("athleteRelationshipTransitionButton"),
  athleteProfilePanel: document.getElementById("athleteProfilePanel"),
  athleteProfileHeading: document.getElementById("athleteProfileHeading"),
  athleteProfileActivity: document.getElementById("athleteProfileActivity"),
  athleteProfileForm: document.getElementById("athleteProfileForm"),
  athletePreferredUnit: document.getElementById("athletePreferredUnit"),
  athleteRoundingIncrement: document.getElementById("athleteRoundingIncrement"),
  athleteBodyweight: document.getElementById("athleteBodyweight"),
  athleteBodyweightUnit: document.getElementById("athleteBodyweightUnit"),
  athleteBenchmarkList: document.getElementById("athleteBenchmarkList"),
  addAthleteBenchmarkButton: document.getElementById("addAthleteBenchmarkButton"),
  closeAthleteProfileButton: document.getElementById("closeAthleteProfileButton"),
  athleteProfileStatus: document.getElementById("athleteProfileStatus"),
  eventForm: document.getElementById("eventForm"),
  eventName: document.getElementById("eventName"),
  eventActivity: document.getElementById("eventActivity"),
  eventType: document.getElementById("eventType"),
  eventProgrammeStartDate: document.getElementById("eventProgrammeStartDate"),
  eventDate: document.getElementById("eventDate"),
  eventLocation: document.getElementById("eventLocation"),
  eventTimezone: document.getElementById("eventTimezone"),
  eventNotes: document.getElementById("eventNotes"),
  eventPreviewCountdown: document.getElementById("eventPreviewCountdown"),
  eventPreviewWeeks: document.getElementById("eventPreviewWeeks"),
  eventCount: document.getElementById("eventCount"),
  eventUpcomingCount: document.getElementById("eventUpcomingCount"),
  eventLinkedCount: document.getElementById("eventLinkedCount"),
  refreshEventsButton: document.getElementById("refreshEventsButton"),
  eventList: document.getElementById("eventList"),
  athleteAssignmentPanel: document.getElementById("athleteAssignmentPanel"),
  athleteAssignmentForm: document.getElementById("athleteAssignmentForm"),
  athleteAssignmentEvent: document.getElementById("athleteAssignmentEvent"),
  athleteAssignmentTemplate: document.getElementById("athleteAssignmentTemplate"),
  athleteAssignmentRequirements: document.getElementById("athleteAssignmentRequirements"),
  athleteAssignmentButton: document.getElementById("athleteAssignmentButton"),
  athleteAssignmentResult: document.getElementById("athleteAssignmentResult"),
  athleteAssignmentCurrent: document.getElementById("athleteAssignmentCurrent"),
  athleteAssignmentHistory: document.getElementById("athleteAssignmentHistory"),
  athleteAssignmentCancelButton: document.getElementById("athleteAssignmentCancelButton"),
  athleteEventLinks: document.getElementById("athleteEventLinks"),
  athleteDetailHistoryPanel: document.getElementById("athleteDetailHistoryPanel"),
  athleteDetailRefreshButton: document.getElementById("athleteDetailRefreshButton"),
  athleteDetailStatus: document.getElementById("athleteDetailStatus"),
  athleteDetailAssignmentCount: document.getElementById("athleteDetailAssignmentCount"),
  athleteDetailStrengthCount: document.getElementById("athleteDetailStrengthCount"),
  athleteDetailBodyweightCount: document.getElementById("athleteDetailBodyweightCount"),
  athleteDetailEventCount: document.getElementById("athleteDetailEventCount"),
  athleteDetailSessionCount: document.getElementById("athleteDetailSessionCount"),
  athleteDetailNoteCount: document.getElementById("athleteDetailNoteCount"),
  athleteDetailCurrentProgramme: document.getElementById("athleteDetailCurrentProgramme"),
  athleteDetailCurrentEvent: document.getElementById("athleteDetailCurrentEvent"),
  athleteDetailAssignmentHistory: document.getElementById("athleteDetailAssignmentHistory"),
  athleteDetailStrengthHistory: document.getElementById("athleteDetailStrengthHistory"),
  athleteDetailBodyweightHistory: document.getElementById("athleteDetailBodyweightHistory"),
  athleteDetailEventHistory: document.getElementById("athleteDetailEventHistory"),
  athleteDetailSessionHistory: document.getElementById("athleteDetailSessionHistory"),
  athleteDetailNoteHistory: document.getElementById("athleteDetailNoteHistory"),
  athleteDetailNoteForm: document.getElementById("athleteDetailNoteForm"),
  athleteDetailNoteSessionId: document.getElementById("athleteDetailNoteSessionId"),
  athleteDetailNoteArtefactId: document.getElementById("athleteDetailNoteArtefactId"),
  athleteDetailNoteText: document.getElementById("athleteDetailNoteText"),
  athleteDetailNoteVisibility: document.getElementById("athleteDetailNoteVisibility"),
  athleteDetailNoteCancelButton: document.getElementById("athleteDetailNoteCancelButton"),
  athleteDetailMessageHistory: document.getElementById("athleteDetailMessageHistory"),
  athleteDetailMessageButton: document.getElementById("athleteDetailMessageButton"),
  athleteDetailMessageForm: document.getElementById("athleteDetailMessageForm"),
  athleteDetailMessageText: document.getElementById("athleteDetailMessageText"),
  athleteDetailMessageAttachment: document.getElementById("athleteDetailMessageAttachment"),
  athleteDetailMessageCancelButton: document.getElementById("athleteDetailMessageCancelButton"),
  athleteDetailOrgMessageHistory: document.getElementById("athleteDetailOrgMessageHistory"),
  athleteDetailProgressPhotos: document.getElementById("athleteDetailProgressPhotos"),
  athleteDetailBodyMetricHistory: document.getElementById("athleteDetailBodyMetricHistory"),
  athleteDetailHabitList: document.getElementById("athleteDetailHabitList"),
  athleteDetailProgressInsights: document.getElementById("athleteDetailProgressInsights"),
  athleteDetailDeviceConnectionList: document.getElementById("athleteDetailDeviceConnectionList"),
  athleteDetailDeviceMetricHistory: document.getElementById("athleteDetailDeviceMetricHistory"),
  templateLibraryView: document.getElementById("templateLibraryView"),
  templateBuilderView: document.getElementById("templateBuilderView"),
  newTemplateButton: document.getElementById("newTemplateButton"),
  refreshTemplatesButton: document.getElementById("refreshTemplatesButton"),
  templateLibraryList: document.getElementById("templateLibraryList"),
  templateLibrarySearch: document.getElementById("templateLibrarySearch"),
  templateLibraryStatusFilter: document.getElementById("templateLibraryStatusFilter"),
  templateLibraryActivityFilter: document.getElementById("templateLibraryActivityFilter"),
  templateLibrarySort: document.getElementById("templateLibrarySort"),
  templateLibraryClearFilters: document.getElementById("templateLibraryClearFilters"),
  templateLibraryResultCount: document.getElementById("templateLibraryResultCount"),
  templateLibraryStatus: document.getElementById("templateLibraryStatus"),
  templateDraftRecovery: document.getElementById("templateDraftRecovery"),
  templateDraftRecoveryTitle: document.getElementById("templateDraftRecoveryTitle"),
  templateDraftRecoveryText: document.getElementById("templateDraftRecoveryText"),
  templateDraftRecoveryResumeButton: document.getElementById("templateDraftRecoveryResumeButton"),
  templateDraftRecoveryDiscardButton: document.getElementById("templateDraftRecoveryDiscardButton"),
  templateDraftCount: document.getElementById("templateDraftCount"),
  templateCompleteCount: document.getElementById("templateCompleteCount"),
  templateActiveCount: document.getElementById("templateActiveCount"),
  templateArchivedCount: document.getElementById("templateArchivedCount"),
  templateSupersededCount: document.getElementById("templateSupersededCount"),
  templateDetailPanel: document.getElementById("templateDetailPanel"),
  templateDetailTitle: document.getElementById("templateDetailTitle"),
  templateDetailStatus: document.getElementById("templateDetailStatus"),
  templateDetailCloseButton: document.getElementById("templateDetailCloseButton"),
  templateDetailMeta: document.getElementById("templateDetailMeta"),
  templateDetailDescription: document.getElementById("templateDetailDescription"),
  templateDetailActions: document.getElementById("templateDetailActions"),
  templateDetailVersionFamily: document.getElementById("templateDetailVersionFamily"),
  templateDetailUsage: document.getElementById("templateDetailUsage"),
  templateDetailValidation: document.getElementById("templateDetailValidation"),
  templateDetailPreview: document.getElementById("templateDetailPreview"),
  backToTemplatesButton: document.getElementById("backToTemplatesButton"),
  saveTemplateButton: document.getElementById("saveTemplateButton"),
  saveCompleteTemplateButton: document.getElementById("saveCompleteTemplateButton"),
  activateTemplateButton: document.getElementById("activateTemplateButton"),
  templateBuilderSaveState: document.getElementById("templateBuilderSaveState"),
  templateBuilderSaveDetail: document.getElementById("templateBuilderSaveDetail"),
  templateBuilderDiscardButton: document.getElementById("templateBuilderDiscardButton"),
  templateBuilderValidation: document.getElementById("templateBuilderValidation"),
  templateBuilderValidationList: document.getElementById("templateBuilderValidationList"),
  templateBuilderTitle: document.getElementById("templateBuilderTitle"),
  templateName: document.getElementById("templateName"),
  templateActivity: document.getElementById("templateActivity"),
  templateDescription: document.getElementById("templateDescription"),
  templateEventBindingSelect: document.getElementById("templateEventBindingSelect"),
  bindTemplateEventButton: document.getElementById("bindTemplateEventButton"),
  templateEventBindingStatus: document.getElementById("templateEventBindingStatus"),
  templateEventEnabled: document.getElementById("templateEventEnabled"),
  templateEventFields: document.getElementById("templateEventFields"),
  templateEventName: document.getElementById("templateEventName"),
  templateEventType: document.getElementById("templateEventType"),
  templateProgrammeStartDate: document.getElementById("templateProgrammeStartDate"),
  templateEventDate: document.getElementById("templateEventDate"),
  templateEventLocation: document.getElementById("templateEventLocation"),
  templateEventTimezone: document.getElementById("templateEventTimezone"),
  templateEventNotes: document.getElementById("templateEventNotes"),
  templateEventCountdown: document.getElementById("templateEventCountdown"),
  templateEventRequiredWeeks: document.getElementById("templateEventRequiredWeeks"),
  templateEventAllocatedWeeks: document.getElementById("templateEventAllocatedWeeks"),
  templateEventWeekBalance: document.getElementById("templateEventWeekBalance"),
  templateEventAllocationState: document.getElementById("templateEventAllocationState"),
  compileEventCalendarButton: document.getElementById("compileEventCalendarButton"),
  fitFinalBlockButton: document.getElementById("fitFinalBlockButton"),
  templateVersion: document.getElementById("templateVersion"),
  templateBlockCount: document.getElementById("templateBlockCount"),
  templateWeekCount: document.getElementById("templateWeekCount"),
  templateSessionCount: document.getElementById("templateSessionCount"),
  templateBlocks: document.getElementById("templateBlocks"),
  addTemplateBlockButton: document.getElementById("addTemplateBlockButton"),
  assignmentForm: document.getElementById("assignmentForm"),
  assignmentAthlete: document.getElementById("assignmentAthlete"),
  assignmentTemplate: document.getElementById("assignmentTemplate"),
  assignmentEventSummary: document.getElementById("assignmentEventSummary"),
  assignmentRequirements: document.getElementById("assignmentRequirements"),
  assignmentSubmitButton: document.getElementById("assignmentSubmitButton"),
  assignmentResult: document.getElementById("assignmentResult"),
  assignmentCurrentState: document.getElementById("assignmentCurrentState"),
  assignmentHistoryList: document.getElementById("assignmentHistoryList"),
  assignmentCancelButton: document.getElementById("assignmentCancelButton"),
  reviewAthlete: document.getElementById("reviewAthlete"),
  reviewSearch: document.getElementById("reviewSearch"),
  reviewStatusFilter: document.getElementById("reviewStatusFilter"),
  loadReviewButton: document.getElementById("loadReviewButton"),
  reviewStatus: document.getElementById("reviewStatus"),
  reviewAllCount: document.getElementById("reviewAllCount"),
  reviewAwaitingCount: document.getElementById("reviewAwaitingCount"),
  reviewReviewedCount: document.getElementById("reviewReviewedCount"),
  reviewOpenCount: document.getElementById("reviewOpenCount"),
  reviewList: document.getElementById("reviewList"),
  reviewDetail: document.getElementById("reviewDetail"),
  reviewDetailContent: document.getElementById("reviewDetailContent"),
  refreshVideoFeedbackQueueButton: document.getElementById("refreshVideoFeedbackQueueButton"),
  videoFeedbackQueueStatus: document.getElementById("videoFeedbackQueueStatus"),
  videoFeedbackQueueList: document.getElementById("videoFeedbackQueueList"),
  videoFeedbackDetail: document.getElementById("videoFeedbackDetail"),
  videoFeedbackDetailContent: document.getElementById("videoFeedbackDetailContent"),
  coachNoteForm: document.getElementById("coachNoteForm"),
  coachNoteHeading: document.getElementById("coachNoteHeading"),
  coachNoteSessionId: document.getElementById("coachNoteSessionId"),
  coachNoteArtefactId: document.getElementById("coachNoteArtefactId"),
  coachNoteText: document.getElementById("coachNoteText"),
  coachNoteVisibility: document.getElementById("coachNoteVisibility"),

  accountAvatar: document.getElementById("accountAvatar"),
  accountName: document.getElementById("accountName"),
  accountEmail: document.getElementById("accountEmail"),
  accountRoleBadge: document.getElementById("accountRoleBadge"),
  accountStateBadge: document.getElementById("accountStateBadge"),
  accountVerificationBadge: document.getElementById("accountVerificationBadge"),
  refreshAccountButton: document.getElementById("refreshAccountButton"),
  accountProfileForm: document.getElementById("accountProfileForm"),
  accountProfileName: document.getElementById("accountProfileName"),
  accountProfileEmail: document.getElementById("accountProfileEmail"),
  accountProfileResult: document.getElementById("accountProfileResult"),
  requestVerificationButton: document.getElementById("requestVerificationButton"),
  completeVerificationButton: document.getElementById("completeVerificationButton"),
  verificationCode: document.getElementById("verificationCode"),
  verificationResult: document.getElementById("verificationResult"),
  accountPasswordForm: document.getElementById("accountPasswordForm"),
  currentPassword: document.getElementById("currentPassword"),
  newPassword: document.getElementById("newPassword"),
  passwordChangeResult: document.getElementById("passwordChangeResult"),
  accountConsentHistory: document.getElementById("accountConsentHistory"),
  entryTermsVersion: document.getElementById("entryTermsVersion"),
  entryConsentVersion: document.getElementById("entryConsentVersion"),
  accountCurrentTermsVersion: document.getElementById("accountCurrentTermsVersion"),
  accountAcceptedTermsVersion: document.getElementById("accountAcceptedTermsVersion"),
  accountCurrentConsentVersion: document.getElementById("accountCurrentConsentVersion"),
  accountAcceptedConsentVersion: document.getElementById("accountAcceptedConsentVersion"),
  accountClosureForm: document.getElementById("accountClosureForm"),
  accountClosureConfirmation: document.getElementById("accountClosureConfirmation"),
  accountClosureResult: document.getElementById("accountClosureResult"),
  dataRightsLoading: document.getElementById("dataRightsLoading"),
  dataRightsServiceUnavailable: document.getElementById("dataRightsServiceUnavailable"),
  dataRightsRetryButton: document.getElementById("dataRightsRetryButton"),
  requestDataExportButton: document.getElementById("requestDataExportButton"),
  dataExportResult: document.getElementById("dataExportResult"),
  dataExportList: document.getElementById("dataExportList"),
  reviewDataDeletionButton: document.getElementById("reviewDataDeletionButton"),
  dataDeletionReviewPanel: document.getElementById("dataDeletionReviewPanel"),
  dataDeletionRetentionNotice: document.getElementById("dataDeletionRetentionNotice"),
  dataDeletionRetentionList: document.getElementById("dataDeletionRetentionList"),
  dataDeletionConfirmForm: document.getElementById("dataDeletionConfirmForm"),
  dataDeletionConfirmation: document.getElementById("dataDeletionConfirmation"),
  dataDeletionResult: document.getElementById("dataDeletionResult"),
  dataDeletionList: document.getElementById("dataDeletionList"),
  accountCode: document.getElementById("accountCode"),
  copyAccountCodeButton: document.getElementById("copyAccountCodeButton"),
  signOutButton: document.getElementById("signOutButton")
};

function cloneDefaultState() {
  return JSON.parse(JSON.stringify(DEFAULT_STATE));
}

function normalisePersistedTemplateDraft(draft) {
  if (!draft || typeof draft !== "object") return null;

  const rawBlocks = Array.isArray(draft.blocks)
    ? draft.blocks
    : Array.isArray(draft.weeks)
      ? [{
          block_id: "",
          order_index: 1,
          name: "Block 1",
          description: "",
          block_type: "general",
          week_count: draft.weeks.length,
          weeks: draft.weeks
        }]
      : [];

  const normaliseWorkItem = (workItem, workItemIndex) => {
    const fallbackReps = Number(workItem?.planned_reps ?? 5);
    const fallbackDuration = Number(workItem?.planned_duration_seconds ?? 30);
    const fallbackDistance = Number(workItem?.planned_distance_value ?? 20);
    const loadMode = ["fixed_weight", "bodyweight", "rpe"].includes(workItem?.load_mode)
      ? workItem.load_mode
      : "percent_1rm";

    return {
      work_item_id: String(workItem?.work_item_id ?? ""),
      order_index: workItemIndex + 1,
      exercise_id: String(workItem?.exercise_id ?? ""),
      planned_sets: Number(workItem?.planned_sets ?? 3),
      prescription_mode: ["duration", "distance"].includes(workItem?.prescription_mode)
        ? workItem.prescription_mode
        : "reps",
      rep_mode: workItem?.rep_mode === "range" ? "range" : "fixed",
      planned_reps: fallbackReps,
      rep_min: Number(workItem?.rep_min ?? fallbackReps),
      rep_max: Number(workItem?.rep_max ?? fallbackReps),
      tempo: String(workItem?.tempo ?? ""),
      duration_mode: workItem?.duration_mode === "range" ? "range" : "fixed",
      planned_duration_seconds: fallbackDuration,
      duration_min_seconds: Number(workItem?.duration_min_seconds ?? fallbackDuration),
      duration_max_seconds: Number(workItem?.duration_max_seconds ?? fallbackDuration),
      distance_mode: workItem?.distance_mode === "range" ? "range" : "fixed",
      distance_unit: workItem?.distance_unit === "feet" ? "feet" : "meters",
      planned_distance_value: fallbackDistance,
      distance_min_value: Number(workItem?.distance_min_value ?? fallbackDistance),
      distance_max_value: Number(workItem?.distance_max_value ?? fallbackDistance),
      load_mode: loadMode,
      percent_1rm: Number(workItem?.percent_1rm ?? 75),
      weight_value: Number(workItem?.weight_value ?? 20),
      weight_unit: workItem?.weight_unit === "lb" ? "lb" : "kg",
      rpe_value: Number(workItem?.rpe_value ?? 8),
      rest_seconds: Number(workItem?.rest_seconds ?? 120),
      role: workItem?.role === "primary" ? "primary" : "accessory",
      coaching_notes: String(workItem?.coaching_notes ?? ""),
      segment: ["warm_up", "cool_down"].includes(workItem?.segment) ? workItem.segment : "working",
      group_id: String(workItem?.group_id ?? ""),
      group_type: ["superset", "circuit"].includes(workItem?.group_type) ? workItem.group_type : "straight"
    };
  };

  const blocks = rawBlocks.map((block, blockIndex) => ({
    block_id: String(block?.block_id ?? ""),
    order_index: blockIndex + 1,
    name: String(block?.name ?? `Block ${blockIndex + 1}`),
    description: String(block?.description ?? ""),
    block_type: ["general", "volume", "strength", "peak", "deload", "custom"].includes(block?.block_type)
      ? block.block_type
      : "general",
    week_count: Number(block?.week_count ?? (Array.isArray(block?.weeks) ? block.weeks.length : 1)),
    calendar_start_date: String(block?.calendar_start_date ?? ""),
    calendar_end_date: String(block?.calendar_end_date ?? ""),
    weeks: Array.isArray(block?.weeks)
      ? block.weeks.map((week, weekIndex) => ({
          week_id: String(week?.week_id ?? ""),
          order_index: weekIndex + 1,
          calendar_start_date: String(week?.calendar_start_date ?? ""),
          calendar_end_date: String(week?.calendar_end_date ?? ""),
          days_until_event_at_week_start: Number.isInteger(week?.days_until_event_at_week_start)
            ? Number(week.days_until_event_at_week_start)
            : null,
          partial_week: week?.partial_week === true,
          sessions: Array.isArray(week?.sessions)
            ? week.sessions.map((session, sessionIndex) => ({
                session_id: String(session?.session_id ?? ""),
                order_index: sessionIndex + 1,
                title: String(session?.title ?? `Session ${sessionIndex + 1}`),
                coaching_notes: String(session?.coaching_notes ?? ""),
                work_items: Array.isArray(session?.work_items)
                  ? session.work_items.map(normaliseWorkItem)
                  : []
              }))
            : []
        }))
      : []
  }));

  const eventPlan = draft.event_plan && typeof draft.event_plan === "object"
    ? {
        event_plan_id: String(draft.event_plan.event_plan_id ?? ""),
        event_name: String(draft.event_plan.event_name ?? ""),
        event_type: String(draft.event_plan.event_type ?? ""),
        event_date: String(draft.event_plan.event_date ?? ""),
        programme_start_date: String(draft.event_plan.programme_start_date ?? ""),
        location: String(draft.event_plan.location ?? ""),
        timezone: String(draft.event_plan.timezone ?? "Europe/London"),
        notes: String(draft.event_plan.notes ?? "")
      }
    : null;

  return {
    ...draft,
    event_plan: eventPlan,
    event_compile_summary: draft.event_compile_summary && typeof draft.event_compile_summary === "object"
      ? draft.event_compile_summary
      : null,
    bound_event_id: String(draft.bound_event_id ?? ""),
    bound_event_record_sha256: String(draft.bound_event_record_sha256 ?? ""),
    blocks
  };
}

function loadState() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
    if (!parsed || parsed.version !== 1) {
      return cloneDefaultState();
    }

    return {
      ...cloneDefaultState(),
      ...parsed,
      coachAthletes: Array.isArray(parsed.coachAthletes) ? parsed.coachAthletes : [],
      coachAssignments: Array.isArray(parsed.coachAssignments) ? parsed.coachAssignments : [],
      coachEvents: Array.isArray(parsed.coachEvents) ? parsed.coachEvents : [],
      athleteEventLinks: parsed.athleteEventLinks && typeof parsed.athleteEventLinks === "object"
        ? parsed.athleteEventLinks
        : {},
      coachTemplates: Array.isArray(parsed.coachTemplates) ? parsed.coachTemplates : [],
      templateLibrarySearch: String(parsed.templateLibrarySearch ?? ""),
      templateLibraryStatusFilter: ["all", "draft", "complete", "active", "archived", "superseded"].includes(parsed.templateLibraryStatusFilter)
        ? parsed.templateLibraryStatusFilter
        : "all",
      templateLibraryActivityFilter: ["all", "powerlifting", "general_strength", "rugby_union"].includes(parsed.templateLibraryActivityFilter)
        ? parsed.templateLibraryActivityFilter
        : "all",
      templateLibrarySort: ["updated_desc", "name_asc", "version_desc", "usage_desc"].includes(parsed.templateLibrarySort)
        ? parsed.templateLibrarySort
        : "updated_desc",
      selectedTemplateId: String(parsed.selectedTemplateId ?? ""),
      templateExercises: Array.isArray(parsed.templateExercises) ? parsed.templateExercises : [],
      templateDraft: normalisePersistedTemplateDraft(parsed.templateDraft),
      athleteProfiles: parsed.athleteProfiles && typeof parsed.athleteProfiles === "object"
        ? parsed.athleteProfiles
        : {},
      athleteProfileDraft: parsed.athleteProfileDraft && typeof parsed.athleteProfileDraft === "object"
        ? parsed.athleteProfileDraft
        : null,
      selectedCoachAthleteId: String(parsed.selectedCoachAthleteId ?? ""),
      history: Array.isArray(parsed.history) ? parsed.history : [],
      localSessions: Array.isArray(parsed.localSessions) ? parsed.localSessions : [],
      currentTerms: null
    };
  }
  catch {
    return cloneDefaultState();
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function createId(prefix) {
  const id = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}_${Math.random().toString(16).slice(2)}`;
  return `${prefix}_${id.replaceAll("-", "")}`;
}

function nowIso() {
  return new Date().toISOString();
}

function todayDateOnly() {
  return new Date().toISOString().slice(0, 10);
}

function dateOnlyEpochDay(value) {
  const text = String(value ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(text)) return null;
  const parsed = Date.parse(`${text}T00:00:00.000Z`);
  return Number.isFinite(parsed) ? Math.floor(parsed / 86400000) : null;
}

function addDateOnlyDays(value, days) {
  const epochDay = dateOnlyEpochDay(value);
  if (epochDay === null) return "";
  return new Date((epochDay + Number(days)) * 86400000).toISOString().slice(0, 10);
}

function dateOnlyDifference(fromDate, toDate) {
  const from = dateOnlyEpochDay(fromDate);
  const to = dateOnlyEpochDay(toDate);
  return from === null || to === null ? null : to - from;
}

function countdownLabel(eventDate, fromDate = todayDateOnly()) {
  const days = dateOnlyDifference(fromDate, eventDate);
  if (days === null) return "Set dates";
  if (days < 0) return `${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"} ago`;
  if (days === 0) return "Today";
  const weeks = Math.floor(days / 7);
  const remainder = days % 7;
  return weeks > 0
    ? `${weeks}w ${remainder}d`
    : `${days} day${days === 1 ? "" : "s"}`;
}

function initials(name) {
  const words = String(name ?? "").trim().split(/\s+/u).filter(Boolean);
  return (words.slice(0, 2).map((word) => word[0]).join("") || "K").toUpperCase();
}

function titleCase(value) {
  return String(value ?? "")
    .replaceAll("_", " ")
    .replace(/\b\w/gu, (letter) => letter.toUpperCase());
}

function formatDate(value) {
  if (!value) return "Date not recorded";

  const isDateOnly = /^\d{4}-\d{2}-\d{2}$/u.test(String(value));
  const parsed = new Date(isDateOnly ? `${value}T12:00:00.000Z` : value);
  if (Number.isNaN(parsed.getTime())) return "Date not recorded";

  return new Intl.DateTimeFormat("en-GB", isDateOnly
    ? {
        day: "numeric",
        month: "short",
        year: "numeric",
        timeZone: "UTC"
      }
    : {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      }
  ).format(parsed);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function showBusy(message) {
  elements.busyText.textContent = message;
  elements.busyOverlay.hidden = false;
}

function hideBusy() {
  elements.busyOverlay.hidden = true;
}

// FULL-UI-22 cross-product quality: a single reusable duplicate-submit
// guard. Disables the relevant button for the duration of the async
// action (covering both a mouse double-click and a keyboard double-
// Enter) and always re-enables it afterwards, success or failure.
// `buttonSource` is either the button itself, or a function that derives
// it from the handler's own arguments (e.g. a form submit event).
function guardedAction(buttonSource, asyncFn) {
  return async (...args) => {
    const button = typeof buttonSource === "function" ? buttonSource(...args) : buttonSource;
    if (button?.disabled) return;
    if (button) button.disabled = true;
    try {
      await asyncFn(...args);
    }
    finally {
      if (button) button.disabled = false;
    }
  };
}

function submitButtonOf(event) {
  return event?.target?.querySelector?.('button[type="submit"]') ?? null;
}

// FULL-UI-22 cross-product quality: a route-level service-unavailable +
// retry state, reusing whatever status line a view already has (never a
// new dedicated panel per view) so a failed load leaves a persistent,
// actionable message instead of silently going stale or only flashing
// the global toast. The global error notice (with its own "Report this
// problem" action) still fires too - this is additive, not a
// replacement.
function catchWithViewRetry(statusElement, retryFn, message) {
  const handler = (error) => {
    if (statusElement) {
      statusElement.textContent = "";
      statusElement.classList.add("error");

      const text = document.createElement("span");
      text.textContent = message;

      const retryButton = document.createElement("button");
      retryButton.type = "button";
      retryButton.className = "button secondary status-retry-button";
      retryButton.textContent = "Retry";
      retryButton.addEventListener("click", () => {
        statusElement.classList.remove("error");
        statusElement.textContent = "Retrying...";
        retryFn().catch(handler);
      });

      statusElement.append(text, " ", retryButton);
    }
    handleError(error);
  };
  return handler;
}

let noticeTimer = null;

// FULL-UI-22 cross-product quality: unsaved-change protection, extended
// beyond the programme builder (its own longer-standing draft/dirty
// tracking is unchanged) to the coach note form. A simple, non-persisted
// dirty flag is enough here - unlike a programme draft, a half-written
// note isn't meant to survive a reload, only to warn against an
// accidental departure that would silently discard it.
let coachNoteDirty = false;

function confirmCoachNoteDeparture() {
  if (!coachNoteDirty || elements.coachNoteForm.hidden) return true;
  return globalThis.confirm(
    "This note has unsaved changes. Leave without saving?"
  );
}

function showNotice(message, type = "success", options = {}) {
  clearTimeout(noticeTimer);
  elements.notice.textContent = message;
  elements.notice.classList.toggle("error", type === "error");
  // An error is announced assertively (interrupts) since it usually
  // requires the person to notice and act; a success/status message is
  // announced politely (waits its turn) so it doesn't interrupt anything.
  elements.notice.setAttribute("aria-live", type === "error" ? "assertive" : "polite");
  elements.notice.hidden = false;

  const existingActions = elements.notice.querySelector(".notice-actions");
  if (existingActions) existingActions.remove();

  if (type === "error" && options.failureContext) {
    const actions = document.createElement("div");
    actions.className = "notice-actions";
    const reportButton = document.createElement("button");
    reportButton.type = "button";
    reportButton.className = "button secondary notice-report-button";
    reportButton.textContent = "Report this problem";
    reportButton.addEventListener("click", () => openSupportReportForm(options.failureContext));
    actions.appendChild(reportButton);
    elements.notice.appendChild(actions);
    return;
  }

  noticeTimer = setTimeout(() => {
    elements.notice.hidden = true;
  }, 4200);
}

async function readJson(response) {
  const text = await response.text().catch(() => "");
  try {
    return text ? JSON.parse(text) : null;
  }
  catch {
    return { raw: text };
  }
}

function factualAccountStateMessage(accountState) {
  const messages = {
    suspended: "This account is suspended. Workspace access is unavailable.",
    closed: "This account is closed. Sign-in and workspace access are unavailable.",
    deleted: "This account has been deleted. Sign-in and workspace access are unavailable."
  };

  return messages[String(accountState ?? "")] ??
    "This account is not currently active.";
}

function friendlyError(payload, status) {
  const reason = String(
    payload?.reason ??
    payload?.failure_token ??
    payload?.error ??
    `request_${status}`
  );

  if (reason === "account_unavailable") {
    return factualAccountStateMessage(
      payload?.account_state
    );
  }

  const messages = {
    account_email_invalid: "Enter a valid email address.",
    account_display_name_invalid: "Enter a display name of 80 characters or fewer.",
    account_password_too_short: "Passwords must contain at least 12 characters.",
    account_password_too_long: "The password is too long.",
    account_actor_type_invalid: "Choose an athlete or coach account.",
    account_activity_invalid: "Choose a supported primary activity.",
    account_acceptance_required: "Accept the terms and account consent before continuing.",
    account_acceptance_version_mismatch: "The terms or consent version changed. Review the current versions and try again.",
    account_email_already_registered: "An account already uses this email address.",
    account_existing_role_mismatch: "This existing identity belongs to a different account type.",
    account_sign_in_failed: "The email or password is incorrect.",
    account_temporarily_locked: "Sign-in is temporarily locked after repeated failed attempts.",
    account_session_missing: "Sign in to continue.",
    account_session_invalid: "The sign-in session has expired.",
    account_csrf_invalid: "The account request could not be authorised. Refresh and try again.",
    account_unavailable: "This account is not currently active.",
    account_challenge_invalid: "The six-digit code is invalid or expired.",
    account_current_password_invalid: "The current password is incorrect.",
    account_closure_confirmation_required: "Type CLOSE exactly to request closure.",
    auth_email_invalid: "Enter a valid email address.",
    auth_display_name_required: "Enter your display name.",
    acknowledgement_not_accepted: "Both beta acknowledgements are required.",
    jurisdiction_not_acknowledged: "Both beta acknowledgements are required.",
    stored_relationship_access_denied: "This athlete connection is not active.",
    stored_relationship_or_assignment_access_denied: "Connect the athlete and record an assignment first.",
    stored_compile_context_missing: "The athlete must complete account setup before this assignment can run.",
    stored_assignment_missing: "No current assignment was found for this coach.",
    athlete_history_access_denied: "Training history is not available for this account.",
    relationship_identity_required: "Enter a valid athlete account code.",
    coach_note_text_required: "Enter a note before recording it.",
    coach_access_denied: "This coach account is not active.",
    template_name_invalid: "Enter a programme name.",
    blocks_required: "Add at least one training block.",
    block_count_invalid: "A programme must contain between one and twelve training blocks.",
    block_name_too_long: "Training block names must be 120 characters or fewer.",
    block_type_invalid: "Choose a supported training block type.",
    week_count_per_block_invalid: "Each training block must contain between one and 52 weeks.",
    total_week_count_invalid: "A programme cannot contain more than 104 weeks.",
    weeks_required: "Add at least one week.",
    session_count_per_week_invalid: "Each week must contain between one and seven sessions.",
    session_work_item_count_invalid: "Each session must contain between one and 12 exercises.",
    session_coaching_notes_too_long: "Session coaching notes must be 500 characters or fewer.",
    work_item_coaching_notes_too_long: "Exercise coaching notes must be 500 characters or fewer.",
    work_item_segment_invalid: "Choose warm-up, working, or cool-down for each exercise.",
    work_item_group_type_invalid: "Choose superset, circuit, or leave the exercise ungrouped.",
    work_item_group_type_requires_group: "Grouping type requires a group of at least two exercises.",
    work_item_group_too_small: "A group needs at least two exercises.",
    work_item_group_not_contiguous: "Grouped exercises must be next to each other in the session.",
    work_item_group_type_mismatch: "All exercises in a group must share the same grouping type.",
    exercise_not_in_active_registry: "Choose exercises from the active exercise registry.",
    duplicate_exercise_in_session: "Each exercise in a session must be unique.",
    planned_sets_invalid: "Sets must be between 1 and 20.",
    planned_reps_invalid: "Fixed reps must be between 1 and 100.",
    rep_mode_invalid: "Choose fixed reps or a rep range.",
    rep_range_min_invalid: "The minimum reps must be between 1 and 100.",
    rep_range_max_invalid: "The maximum reps must be between 1 and 100.",
    rep_range_order_invalid: "The maximum reps cannot be lower than the minimum reps.",
    prescription_mode_invalid: "Choose reps, duration, or distance for each exercise.",
    work_item_tempo_invalid: "Tempo must look like 3-1-X-0.",
    duration_mode_invalid: "Choose a fixed hold or a hold range.",
    planned_duration_seconds_invalid: "The hold must be between 1 and 1,800 seconds.",
    duration_range_min_invalid: "The minimum hold must be between 1 and 1,800 seconds.",
    duration_range_max_invalid: "The maximum hold must be between 1 and 1,800 seconds.",
    duration_range_order_invalid: "The maximum hold cannot be lower than the minimum hold.",
    distance_mode_invalid: "Choose a fixed distance or a distance range.",
    distance_unit_invalid: "Choose meters or feet.",
    planned_distance_value_invalid: "Distance must be between 0.1 and 10,000.",
    distance_range_min_invalid: "The minimum distance must be between 0.1 and 10,000.",
    distance_range_max_invalid: "The maximum distance must be between 0.1 and 10,000.",
    distance_range_order_invalid: "The maximum distance cannot be lower than the minimum distance.",
    load_mode_invalid: "Choose percentage, weight, bodyweight, or RPE loading.",
    percent_1rm_invalid: "Percentage must be between 1 and 100.",
    weight_value_invalid: "Weight must be between 0.25 and 1,000.",
    weight_value_invalid_precision_invalid: "Weight may use up to three decimal places.",
    weight_unit_invalid: "Choose kilograms or pounds.",
    rpe_value_invalid: "RPE must be a whole number between 1 and 10.",
    stored_rpe_value_invalid: "RPE must be a whole number between 1 and 10.",
    rest_seconds_invalid: "Rest must be between 0 and 900 seconds.",
    active_or_archived_template_is_immutable: "Active and archived templates cannot be edited. Duplicate the template to create a new version.",
    only_draft_can_complete: "Only a draft template can be marked complete.",
    only_complete_can_activate: "Only a complete template can be activated.",
    template_not_found: "The template could not be found.",
    stored_template_not_active: "Select an active template owned by this coach.",
    stored_template_activity_mismatch: "The template activity does not match the athlete activity.",
    assigned_template_sessions_exhausted: "Every session in this assigned programme has already been created.",
    athlete_one_rep_max_missing: "The athlete profile is missing a current 1RM reference required by this session.",
    relationship_access_denied: "This coach-athlete relationship is not active.",
    profile_identity_required: "Select a connected athlete.",
    benchmark_value_invalid: "Strength reference values must be between 0.25 and 1,500.",
    benchmark_exercise_invalid: "Choose an exercise from the active registry.",
    benchmark_effective_date_invalid: "Enter a valid effective date.",
    load_rounding_increment_invalid: "Load rounding must be between 0.25 and 25.",
    bodyweight_invalid: "Bodyweight must be between 10 and 500.",
    event_plan_invalid: "Complete the event details before compiling the calendar.",
    event_plan_unknown_field: "The event contains an unsupported field.",
    event_plan_id_invalid: "The event plan identifier is invalid.",
    event_name_invalid: "Enter an event name of 120 characters or fewer.",
    event_type_invalid_for_activity: "Choose an event type supported by this programme activity.",
    event_date_invalid: "Enter a valid event date.",
    programme_start_date_invalid: "Enter a valid programme start date.",
    event_must_follow_programme_start: "The event date must be after the programme start date.",
    event_week_count_invalid: "The event must be between one and 104 training weeks from the programme start.",
    event_location_too_long: "The event location must be 200 characters or fewer.",
    event_timezone_invalid: "Enter a valid timezone such as Europe/London.",
    event_notes_too_long: "Event notes must be 1,000 characters or fewer.",
    block_week_count_invalid: "Each block must contain between one and 52 weeks.",
    block_week_count_mismatch: "The block week input must match the weeks currently contained in that block.",
    event_week_allocation_unbalanced: "The programme blocks must allocate exactly the number of weeks available before the event.",
    event_date_in_past: "The event date cannot be in the past when a programme is activated.",
    event_programme_week_count_mismatch: "The programme week count must match the event preparation calendar.",
    event_not_active: "Select an active event.",
    event_activity_mismatch: "The event activity does not match the athlete.",
    template_not_active_for_activity: "Select an active programme for this athlete activity.",
    relationship_access_denied: "The coach-athlete relationship is not active."
  };

  return messages[reason] ?? genericFriendlyMessageForStatus(status);
}

// FULL-UI-22 cross-product quality: an unmapped internal reason/failure
// token must never become the user's only message on its own - it stays
// available in console.error()/support-report context for diagnosis, but
// the person using the product always sees plain, factual, actionable
// copy instead of a raw code.
function genericFriendlyMessageForStatus(status) {
  if (status === 401) return "Sign in again to continue.";
  if (status === 403) return "This action is not available for this account.";
  if (status === 404) return "That record could not be found.";
  if (status === 409) return "That could not be completed because something changed. Refresh and try again.";
  if (status === 423) return "This account is not currently active.";
  if (status === 429) return "Too many attempts. Wait a moment and try again.";
  if (typeof status === "number" && status >= 500) return "Something went wrong on our end. Try again in a moment.";
  return "That request could not be completed. Try again, or report this problem if it continues.";
}

async function api(method, path, body) {
  const headers = {};

  if (body !== undefined) {
    headers["content-type"] =
      "application/json";
  }

  if (method !== "GET") {
    headers["x-kolosseum-csrf"] =
      String(state.csrfToken ?? "");
  }

  const response = await fetch(path, {
    method,
    credentials: "same-origin",
    headers,
    body:
      body === undefined
        ? undefined
        : JSON.stringify(body)
  });

  const payload = await readJson(response);

  if (!response.ok) {
    const error = new Error(
      friendlyError(
        payload,
        response.status
      )
    );

    error.payload = payload;
    error.status = response.status;
    error.requestMethod = method;
    error.requestPath = path;

    throw error;
  }

  return payload;
}

function buildPhase1Input(activityId) {
  return {
    consent_granted: true,
    engine_version: "EB2-1.0.0",
    enum_bundle_version: "EB2-1.0.0",
    phase1_schema_version: "1.0.0",
    actor_type: "athlete",
    execution_scope: "individual",
    activity_id: activityId,
    nd_mode: false,
    instruction_density: "standard",
    exposure_prompt_density: "standard",
    bias_mode: "none"
  };
}

function currentAccountId() {
  return state.role === "coach"
    ? state.profile?.coachUserId ?? ""
    : state.profile?.userId ?? "";
}

function countsFromSession(sessionState) {
  return {
    completed: Array.isArray(sessionState?.completed_exercises) ? sessionState.completed_exercises : [],
    remaining: Array.isArray(sessionState?.remaining_exercises) ? sessionState.remaining_exercises : [],
    dropped: Array.isArray(sessionState?.dropped_exercises) ? sessionState.dropped_exercises : []
  };
}

function upsertLocalSession(sessionId, patch = {}) {
  const existingIndex = state.localSessions.findIndex((session) => session.session_id === sessionId);
  const existing = existingIndex >= 0 ? state.localSessions[existingIndex] : {
    session_id: sessionId,
    block_id: "",
    status: "planned",
    assignment_id: null,
    runtime_event_count: 0,
    created_at: nowIso(),
    updated_at: nowIso()
  };

  const next = {
    ...existing,
    ...patch,
    session_id: sessionId,
    updated_at: patch.updated_at ?? nowIso()
  };

  if (existingIndex >= 0) state.localSessions.splice(existingIndex, 1, next);
  else state.localSessions.push(next);

  saveState();
  return next;
}

function mergeHistory(serverSessions) {
  const merged = new Map();

  for (const session of state.localSessions) {
    merged.set(session.session_id, session);
  }

  for (const session of serverSessions) {
    merged.set(session.session_id, {
      ...(merged.get(session.session_id) ?? {}),
      ...session
    });
  }

  return [...merged.values()].sort((left, right) => {
    const leftTime = Date.parse(left.created_at ?? left.updated_at ?? "") || 0;
    const rightTime = Date.parse(right.created_at ?? right.updated_at ?? "") || 0;
    return leftTime - rightTime || String(left.session_id).localeCompare(String(right.session_id));
  });
}

function sessionClassification(sessionState) {
  const counts = countsFromSession(sessionState);
  const total = counts.completed.length + counts.remaining.length + counts.dropped.length;

  if (sessionState?.current_step?.type === "RETURN_DECISION") {
    return { label: "Return decision", className: "active", key: "return" };
  }

  if (total > 0 && counts.remaining.length === 0 && counts.dropped.length > 0) {
    return { label: "Partially completed", className: "partial", key: "partial" };
  }

  if (total > 0 && counts.remaining.length === 0) {
    return { label: "Completed", className: "complete", key: "complete" };
  }

  if (sessionState?.started === true) {
    return { label: "In progress", className: "active", key: "active" };
  }

  return { label: "Planned", className: "neutral", key: "planned" };
}

function setBadge(element, classification) {
  element.textContent = classification.label;
  element.className = `badge ${classification.className}`;
}

function exerciseName(exercise) {
  return String(
    exercise?.display_name ??
    exercise?.exercise_name ??
    exercise?.exercise_id ??
    exercise?.item_id ??
    "Exercise"
  );
}

function exerciseDetails(exercise) {
  const details = [];

  if (Number.isInteger(exercise?.sets)) {
    details.push(`${exercise.sets} sets`);
  }

  const repRange = exercise?.rep_range && typeof exercise.rep_range === "object"
    ? exercise.rep_range
    : null;

  const durationRange = exercise?.duration_range && typeof exercise.duration_range === "object"
    ? exercise.duration_range
    : null;

  const distanceRange = exercise?.distance_range && typeof exercise.distance_range === "object"
    ? exercise.distance_range
    : null;

  if (
    Number.isInteger(repRange?.minimum) &&
    Number.isInteger(repRange?.maximum)
  ) {
    details.push(`${repRange.minimum}–${repRange.maximum} reps`);
  }
  else if (
    Number.isInteger(durationRange?.minimum) &&
    Number.isInteger(durationRange?.maximum)
  ) {
    details.push(`Hold ${durationRange.minimum}–${durationRange.maximum}s`);
  }
  else if (Number.isInteger(exercise?.duration_seconds)) {
    details.push(`Hold ${exercise.duration_seconds}s`);
  }
  else if (
    Number.isFinite(distanceRange?.minimum) &&
    Number.isFinite(distanceRange?.maximum)
  ) {
    const unit = exercise?.distance_unit === "feet" ? "ft" : "m";
    details.push(`${distanceRange.minimum}–${distanceRange.maximum}${unit}`);
  }
  else if (Number.isFinite(exercise?.distance_value)) {
    const unit = exercise?.distance_unit === "feet" ? "ft" : "m";
    details.push(`${exercise.distance_value}${unit}`);
  }
  else if (Number.isInteger(exercise?.reps)) {
    details.push(`${exercise.reps} reps`);
  }

  const tempo = String(exercise?.tempo ?? "");
  if (tempo) {
    details.push(`Tempo ${tempo}`);
  }

  const intensity = exercise?.intensity && typeof exercise.intensity === "object"
    ? exercise.intensity
    : null;

  if (intensity?.type === "percent_1rm" && Number.isFinite(Number(intensity.value))) {
    const resolved = exercise?.resolved_load && typeof exercise.resolved_load === "object"
      ? exercise.resolved_load
      : null;

    if (resolved && Number.isFinite(Number(resolved.value))) {
      const unit = resolved.unit === "lb" ? "lb" : "kg";
      details.push(`${Number(intensity.value)}% 1RM · ${Number(resolved.value)} ${unit}`);

      const source =
        resolved?.source &&
        typeof resolved.source === "object"
          ? resolved.source
          : null;

      if (source) {
        details.push(
          `${strengthSourceLabel(
            source.source_type
          )} source · ${Number(
            source.source_value
          )} ${source.source_unit === "lb" ? "lb" : "kg"} · effective ${String(
            source.effective_date ??
            ""
          )}`
        );
      }
    }
    else {
      details.push(`${Number(intensity.value)}% 1RM`);
    }
  }
  else if (intensity?.type === "load" && Number.isFinite(Number(intensity.value))) {
    const unit = intensity.unit === "lb" ? "lb" : "kg";
    details.push(`${Number(intensity.value)} ${unit}`);
  }
  else if (intensity?.type === "bodyweight") {
    details.push("Bodyweight");
  }
  else if (intensity?.type === "rpe" && Number.isFinite(Number(intensity.value))) {
    details.push(`RPE ${Number(intensity.value)}`);
  }

  if (Number.isInteger(exercise?.rest_seconds)) {
    details.push(`${exercise.rest_seconds}s rest`);
  }

  return details;
}

function roleLabel() {
  return state.role === "coach" ? "Coach" : "Athlete";
}

function actorHomeView(actorType) {
  return actorType === "coach"
    ? "coach-overview"
    : "today";
}

function viewTitle(view) {
  const titles = {
    today: "Today",
    session: "Session",
    history: "History",
    "coach-onboarding": "Coach setup",
    "coach-overview": "Overview",
    athletes: "Athletes",
    events: "Events",
    templates: "Programmes",
    assign: "Assign",
    review: "Review",
    account: "Account"
  };

  return titles[view] ?? "Kolosseum";
}

function setView(view) {
  if (!confirmCoachNoteDeparture()) {
    return false;
  }

  if (
    view !== "templates" &&
    elements.templateBuilderView &&
    !elements.templateBuilderView.hidden
  ) {
    if (!confirmTemplateBuilderDeparture()) {
      return false;
    }

    closeTemplateBuilder({
      force: true,
      silent: true,
      updateRoute: false
    });
  }

  state.view = view;
  saveState();

  for (const section of document.querySelectorAll(".view")) {
    section.hidden = section.id !== `view-${view}`;
  }

  for (const button of document.querySelectorAll(".nav-item")) {
    button.classList.toggle("active", button.dataset.view === view);
  }

  elements.topbarTitle.textContent = viewTitle(view);
  elements.sidebar.classList.remove("open");

  if (view === "today" && state.role === "athlete") {
    loadAthleteToday().catch(handleError);
  }

  if (view === "history" && state.role === "athlete") {
    refreshHistory().catch(handleError);
  }

  if (view === "session" && state.role === "athlete" && state.activeSessionId) {
    loadSessionState().catch(handleError);
  }

  if (view === "events" && state.role === "coach") {
    renderCoachEvents();
    refreshCoachEvents({ quiet: true }).catch(
      catchWithViewRetry(
        elements.eventsStatus,
        () => refreshCoachEvents({ quiet: true }),
        "Events could not be loaded."
      )
    );
  }

  if (view === "templates" && state.role === "coach") {
    renderTemplateLibrary();
    refreshProgrammeLibrary({ quiet: true }).catch(
      catchWithViewRetry(
        elements.templateLibraryStatus,
        () => refreshProgrammeLibrary({ quiet: true }),
        "Programme library could not be loaded."
      )
    );
  }

  if (view === "coach-overview" && state.role === "coach") {
    renderCoachDashboard();

    refreshCoachDashboard({
      quiet: true
    }).catch(
      catchWithViewRetry(
        elements.coachDashboardStatus,
        () => refreshCoachDashboard({ quiet: true }),
        "Coach dashboard could not be loaded."
      )
    );
  }

  if (view === "review" && state.role === "coach") {
    renderCoachSelectors();
    refreshVideoFeedbackQueue({ quiet: true }).catch(handleError);
  }

  if (view === "account") {
    renderAccount();

    loadPersistentAccountDetail({
      quiet: true
    }).catch(handleError);

    loadDataRightsState({ quiet: true }).catch(handleError);
    refreshPlatformStatus().catch(() => {});
    refreshSupportHistory().catch(() => {});
    refreshPendingRelationshipInvitations().catch(handleError);
    refreshAthleteRelationships().catch(handleError);
    refreshCoachOrgContext().catch(handleError);
  }
}

function renderRoleNavigation() {
  const athlete = state.role === "athlete";

  for (const item of document.querySelectorAll(".athlete-nav")) item.hidden = !athlete;
  for (const item of document.querySelectorAll(".coach-nav")) item.hidden = athlete;

  elements.workspaceLabel.textContent = athlete ? "Athlete workspace" : "Coach workspace";
  elements.topbarEyebrow.textContent = athlete ? "Athlete workspace" : "Coach workspace";
  elements.sidebarRole.textContent = roleLabel();

  const fallbackView = actorHomeView(state.role);
  const permittedViews = athlete
    ? new Set(["today", "session", "history", "account"])
    : new Set(["coach-onboarding", "coach-overview", "athletes", "events", "templates", "review", "account"]);

  if (!permittedViews.has(state.view)) state.view = fallbackView;
}

function renderIdentity() {
  const name = state.profile?.displayName ?? "Kolosseum user";
  const avatar = initials(name);

  elements.sidebarName.textContent = name;
  elements.sidebarAvatar.textContent = avatar;
  elements.topbarAccount.textContent = avatar;
  elements.accountAvatar.textContent = avatar;
  elements.todayGreeting.textContent = `Welcome, ${name.split(/\s+/u)[0]}`;
  elements.coachGreeting.textContent = `Welcome, ${name.split(/\s+/u)[0]}`;
}

function applyAccountIdentity(
  account
) {
  if (
    !account ||
    typeof account !== "object"
  ) {
    throw new Error(
      "The server did not return an account."
    );
  }

  state.serverAccount = account;
  state.role = account.actor_type;

  if (account.actor_type === "coach") {
    state.profile = {
      coachUserId: account.user_id,
      displayName: account.display_name,
      email: account.email
    };
  }
  else {
    state.profile = {
      userId: account.user_id,
      displayName: account.display_name,
      email: account.email,
      activityId:
        state.phase1Input?.activity_id ??
        state.profile?.activityId ??
        "powerlifting"
    };
  }
}

function applyAccountSession(
  response
) {
  applyAccountIdentity(
    response.account
  );

  state.csrfToken =
    response.csrf_token ??
    state.csrfToken ??
    "";

  const bootstrap =
    response.bootstrap &&
    typeof response.bootstrap === "object"
      ? response.bootstrap
      : {};

  if (state.role === "coach") {
    state.coachProfile =
      bootstrap.coach_profile ??
      state.coachProfile;

    if (!state.coachProfile) {
      throw new Error(
        "The coach profile could not be restored."
      );
    }

    state.view =
      state.view === "account"
        ? "account"
        : actorHomeView(state.role);
  }
  else {
    state.authRecord =
      bootstrap.auth_record ??
      state.authRecord;

    state.acknowledgementRecord =
      bootstrap.acknowledgement_record ??
      state.acknowledgementRecord;

    state.declarationRecord =
      bootstrap.declaration_record ??
      state.declarationRecord;

    state.phase1Input =
      state.declarationRecord
        ?.engine_phase1_input ??
      state.phase1Input;

    if (
      !state.authRecord ||
      !state.acknowledgementRecord ||
      !state.declarationRecord ||
      !state.phase1Input
    ) {
      throw new Error(
        "The athlete declaration could not be restored."
      );
    }

    state.profile.activityId =
      state.phase1Input.activity_id;

    state.view =
      state.view === "account"
        ? "account"
        : actorHomeView(state.role);
  }

  saveState();
}

function resetAccountState() {
  const currentTerms =
    state.currentTerms;

  Object.assign(
    state,
    cloneDefaultState()
  );

  state.currentTerms =
    currentTerms;

  localStorage.removeItem(
    STORAGE_KEY
  );
}

function setEntryMode(mode) {
  const createMode =
    mode === "create";

  elements.entryMode.value =
    createMode
      ? "create"
      : "sign-in";

  elements.entryCreateFields.hidden =
    !createMode;

  elements.entryName.required =
    createMode;

  elements.entryBetaConsent.required =
    createMode;

  elements.entryDeclarationConsent.required =
    createMode;

  elements.entryPassword.autocomplete =
    createMode
      ? "new-password"
      : "current-password";

  elements.entryCreateTab.classList.toggle(
    "active",
    createMode
  );

  elements.entrySignInTab.classList.toggle(
    "active",
    !createMode
  );

  elements.entryHeading.textContent =
    createMode
      ? "Create your account"
      : "Sign in";

  elements.entryDescription.textContent =
    createMode
      ? "Create persistent product access for this installation."
      : "Open an existing athlete or coach workspace.";

  elements.entrySubmit.textContent =
    createMode
      ? "Create account"
      : "Sign in";

  elements.forgotPasswordButton.hidden =
    createMode;

  elements.entryError.hidden = true;
  renderTermsState();
}

function showEntryMessage(
  message,
  error = false
) {
  elements.entryError.textContent =
    message;

  elements.entryError.classList.toggle(
    "success-message",
    !error
  );

  elements.entryError.hidden = false;
}

function showPasswordResetRequest() {
  elements.entryForm.hidden = true;
  elements.passwordResetCompleteForm.hidden = true;
  elements.passwordResetRequestForm.hidden = false;
  elements.resetRequestEmail.value =
    elements.entryEmail.value;
  elements.resetRequestResult.hidden = true;
}

function showPasswordResetComplete(
  email = "",
  code = ""
) {
  elements.entryForm.hidden = true;
  elements.passwordResetRequestForm.hidden = true;
  elements.passwordResetCompleteForm.hidden = false;
  elements.resetCompleteEmail.value =
    email;
  elements.resetCompleteCode.value =
    code;
  elements.resetCompleteResult.hidden = true;
}

function showSignInForm() {
  elements.passwordResetRequestForm.hidden = true;
  elements.passwordResetCompleteForm.hidden = true;
  elements.entryForm.hidden = false;
  setEntryMode("sign-in");
}

async function handleEntrySubmit(
  event
) {
  event.preventDefault();

  elements.entryError.hidden = true;

  const mode =
    elements.entryMode.value;

  const email =
    elements.entryEmail.value
      .trim()
      .toLowerCase();

  const password =
    elements.entryPassword.value;

  showBusy(
    mode === "create"
      ? "Creating account…"
      : "Signing in…"
  );

  try {
    let response;

    if (mode === "create") {
      const role =
        new FormData(
          elements.entryForm
        ).get("role");

      const displayName =
        elements.entryName.value.trim();

      if (!currentTermsAvailable()) {
        throw new Error(
          "Current terms and consent versions are unavailable. Account creation is disabled."
        );
      }

      if (
        !elements.entryBetaConsent.checked ||
        !elements.entryDeclarationConsent.checked
      ) {
        throw new Error(
          "Accept the terms and account consent before continuing."
        );
      }

      response = await registerAccount({
        actor_type: role,
        display_name: displayName,
        email,
        password,
        activity_id:
          role === "athlete"
            ? elements.entryActivity.value
            : null,
        accepted_terms: true,
        accepted_consent: true,
        accepted_terms_version:
          state.currentTerms
            .current_terms_version,
        accepted_consent_version:
          state.currentTerms
            .current_consent_version
      });
    }
    else {
      response = await signInAccount({
        email,
        password
      });
    }

    applyAccountSession(response);

    await enterApplication();

    showNotice(
      mode === "create"
        ? "Account created."
        : "Signed in."
    );
  }
  catch (error) {
    showEntryMessage(
      friendlyError(
        error.payload,
        error.status ?? 400
      ),
      true
    );
  }
  finally {
    hideBusy();
  }
}

async function handleResetRequest(
  event
) {
  event.preventDefault();

  const email =
    elements.resetRequestEmail.value
      .trim()
      .toLowerCase();

  const response =
    await requestPasswordReset({
      email
    });

  const developmentCode =
    String(
      response?.development_code ??
      ""
    );

  elements.resetRequestResult.hidden = false;
  elements.resetRequestResult.textContent =
    developmentCode
      ? `Development code: ${developmentCode}`
      : "The request was recorded.";

  showPasswordResetComplete(
    email,
    developmentCode
  );
}

async function handleResetComplete(
  event
) {
  event.preventDefault();

  await completePasswordReset({
    email:
      elements.resetCompleteEmail.value
        .trim()
        .toLowerCase(),
    code:
      elements.resetCompleteCode.value
        .trim(),
    new_password:
      elements.resetCompletePassword.value
  });

  elements.entryEmail.value =
    elements.resetCompleteEmail.value;

  elements.entryPassword.value = "";

  showSignInForm();

  showEntryMessage(
    "Password reset complete. Sign in with the new password."
  );
}

async function createSession() {
  showBusy("Creating session…");

  try {
    // A freshly-resolved coach id from the server-authoritative Today state
    // always wins over the older, potentially-stale coachCode cache - this
    // is what actually decides whose assignment the next session comes from.
    const coachUserId = state.athleteToday?.coach_user_id || state.coachCode;

    const body = coachUserId
      ? {
          phase1_input: state.phase1Input,
          beta_user_id: state.profile.userId,
          beta_coach_user_id: coachUserId
        }
      : {
          phase1_input: state.phase1Input,
          beta_path_context: {
            auth_record: state.authRecord,
            acknowledgement_record: state.acknowledgementRecord,
            declaration_record: state.declarationRecord
          }
        };

    const response = await api(
      "POST",
      "/blocks/compile?create_session=true&beta_path=true",
      body
    );

    state.activeSessionId = response.session_id ?? null;
    state.activeSessionState = null;

    if (state.activeSessionId) {
      upsertLocalSession(state.activeSessionId, {
        block_id: response.block_id ?? "",
        status: "planned",
        assignment_id: response.beta_path?.assignment_id ?? null,
        template_id: response.beta_path?.template_id ?? null,
        template_session_title: response.beta_path?.template_session_title ?? null,
        template_session_coaching_notes: response.beta_path?.template_session_coaching_notes ?? null,
        event_plan: response.beta_path?.event_plan ?? null,
        event_compile_summary: response.beta_path?.event_compile_summary ?? null,
        runtime_event_count: 0
      });
    }

    saveState();

    if (!state.activeSessionId) {
      throw new Error("The server did not return a session.");
    }

    await loadSessionState();
    await loadAthleteToday();
    setView("session");
    showNotice("Session created.");
  }
  finally {
    hideBusy();
  }
}

async function startSession() {
  if (!state.activeSessionId) return;

  showBusy("Starting session…");
  try {
    await api("POST", `/sessions/${encodeURIComponent(state.activeSessionId)}/start`, {});
    const local = state.localSessions.find((session) => session.session_id === state.activeSessionId);
    upsertLocalSession(state.activeSessionId, {
      status: "in_progress",
      runtime_event_count: Number(local?.runtime_event_count ?? 0) + 1
    });
    await loadSessionState();
    showNotice("Session started.");
  }
  finally {
    hideBusy();
  }
}

function newClientRequestId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `crid_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

async function postSessionEvent(event, clientRequestId = newClientRequestId()) {
  if (!state.activeSessionId) return;

  showBusy("Recording session…");
  try {
    await api("POST", `/sessions/${encodeURIComponent(state.activeSessionId)}/events`, {
      ...event,
      client_request_id: clientRequestId
    });
    const local = state.localSessions.find((session) => session.session_id === state.activeSessionId);
    upsertLocalSession(state.activeSessionId, {
      runtime_event_count: Number(local?.runtime_event_count ?? 0) + 1
    });
    await loadSessionState();
    await refreshHistory({ quiet: true });
  }
  finally {
    hideBusy();
  }
}

async function loadSessionState() {
  if (!state.activeSessionId) {
    state.activeSessionState = null;
    elements.sessionLoading.hidden = true;
    elements.sessionServiceUnavailable.hidden = true;
    renderAthleteSession();
    return null;
  }

  elements.sessionServiceUnavailable.hidden = true;
  elements.sessionLoading.hidden = false;
  elements.sessionEmpty.hidden = true;
  elements.sessionWorkspace.hidden = true;

  let sessionState;
  try {
    sessionState = await api(
      "GET",
      `/sessions/${encodeURIComponent(state.activeSessionId)}/state`
    );
  }
  catch (error) {
    elements.sessionLoading.hidden = true;
    elements.sessionServiceUnavailable.hidden = false;
    throw error;
  }

  elements.sessionLoading.hidden = true;

  state.activeSessionState = sessionState;

  const classification = sessionClassification(sessionState);
  upsertLocalSession(state.activeSessionId, {
    status: classification.key
  });

  saveState();
  renderAthleteSession();
  renderToday();
  return sessionState;
}

let currentFocusExerciseId = null;
let currentFocusExerciseLabel = null;
let restTimerIntervalId = null;
const exerciseContentCache = new Map();
const exerciseReferenceMediaCache = new Map();

function referenceMediaMarkup(referenceMedia) {
  if (!referenceMedia?.video_url) return "";
  return `
    <p class="exercise-howto-heading">Reference video</p>
    <a class="exercise-reference-media-link" href="${escapeHtml(referenceMedia.video_url)}" target="_blank" rel="noopener noreferrer">
      ${referenceMedia.thumbnail_url ? `<img class="exercise-reference-media-thumbnail" src="${escapeHtml(referenceMedia.thumbnail_url)}" alt="Reference video thumbnail" loading="lazy" />` : ""}
      <span>Watch reference video</span>
    </a>
  `;
}

function renderExerciseHowto(container, content, referenceMedia, respectDensity = true) {
  const detailedSteps = Array.isArray(content?.instruction?.detailed) ? content.instruction.detailed : [];
  // The athlete's declared instruction-density onboarding preference (applied
  // to <html> by athlete_onboarding_ui.js's applyAccessibilityPreferences)
  // controls how much written detail the athlete's own session view shows:
  // "minimal" keeps steps only, "standard" adds coaching cues, "detailed"
  // adds common faults too. It is an athlete-only declared preference, so
  // the coach's template-builder call site passes respectDensity=false and
  // always sees full content regardless of any athlete's setting.
  const density = respectDensity ? (document.documentElement.dataset.instructionDensity || "standard") : "detailed";
  const cues = density !== "minimal" && Array.isArray(content?.coaching_cues) ? content.coaching_cues : [];
  const faults = density === "detailed" && Array.isArray(content?.common_faults) ? content.common_faults : [];
  const referenceMediaHtml = referenceMediaMarkup(referenceMedia);

  if (!detailedSteps.length && !cues.length && !faults.length && !referenceMediaHtml) {
    container.innerHTML = '<p class="muted">No written instructions are available for this exercise yet.</p>';
    return;
  }

  container.innerHTML = `
    ${detailedSteps.length ? `
      <ol class="exercise-howto-steps">
        ${detailedSteps.map((step) => `<li>${escapeHtml(step)}</li>`).join("")}
      </ol>
    ` : ""}
    ${cues.length ? `
      <p class="exercise-howto-heading">Coaching cues</p>
      <ul class="exercise-howto-list">
        ${cues.map((cue) => `<li>${escapeHtml(cue)}</li>`).join("")}
      </ul>
    ` : ""}
    ${faults.length ? `
      <p class="exercise-howto-heading">Common faults</p>
      <ul class="exercise-howto-list">
        ${faults.map((fault) => `<li>${escapeHtml(fault)}</li>`).join("")}
      </ul>
    ` : ""}
    ${referenceMediaHtml}
  `;
}

async function loadExerciseHowto(exerciseId, container, respectDensity = true) {
  if (!exerciseId || !container) return;

  if (exerciseContentCache.has(exerciseId) && exerciseReferenceMediaCache.has(exerciseId)) {
    renderExerciseHowto(container, exerciseContentCache.get(exerciseId), exerciseReferenceMediaCache.get(exerciseId), respectDensity);
    return;
  }

  container.innerHTML = '<p class="muted">Loading…</p>';

  try {
    const [content, referenceMediaResult] = await Promise.all([
      exerciseContentCache.has(exerciseId)
        ? Promise.resolve(exerciseContentCache.get(exerciseId))
        : api("GET", `/exercises/${encodeURIComponent(exerciseId)}/content`),
      exerciseReferenceMediaCache.has(exerciseId)
        ? Promise.resolve(exerciseReferenceMediaCache.get(exerciseId))
        : api("GET", `/exercises/${encodeURIComponent(exerciseId)}/reference-media`).catch(() => null)
    ]);
    exerciseContentCache.set(exerciseId, content);
    const referenceMedia = referenceMediaResult?.reference_media ?? null;
    exerciseReferenceMediaCache.set(exerciseId, referenceMedia);
    renderExerciseHowto(container, content, referenceMedia, respectDensity);
  }
  catch (error) {
    container.innerHTML = '<p class="muted">Instructions could not be loaded right now.</p>';
  }
}

function hideAllActionPanels() {
  elements.skipReasonPanel.hidden = true;
  elements.painReportPanel.hidden = true;
  elements.rpeReportPanel.hidden = true;
  elements.substitutionPanel.hidden = true;
  elements.substitutionResult.hidden = true;
  elements.substitutionResult.innerHTML = "";
  for (const box of document.querySelectorAll(".substitution-equipment-option")) {
    box.checked = false;
  }
  elements.videoFeedbackPanel.hidden = true;
  elements.videoFeedbackFileInput.value = "";
  elements.videoFeedbackCaptionInput.value = "";
  elements.videoFeedbackStatus.hidden = true;
  elements.videoFeedbackStatus.textContent = "";
}

function formatRestClock(totalSeconds) {
  const safeSeconds = Math.max(0, Math.round(totalSeconds));
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function playRestCompleteCue() {
  try {
    if (typeof navigator.vibrate === "function") {
      navigator.vibrate([180, 80, 180]);
    }
  }
  catch {
    // Vibration is a best-effort cue; ignore if unsupported or blocked.
  }

  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    const context = new AudioContextClass();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = 880;
    gain.gain.setValueAtTime(0.15, context.currentTime);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.4);
    oscillator.onended = () => context.close();
  }
  catch {
    // AudioContext can be blocked pre-interaction in some browsers; the
    // visual done-state is the primary cue, this is a best-effort extra.
  }
}

function stopRestTimer() {
  if (restTimerIntervalId !== null) {
    clearInterval(restTimerIntervalId);
    restTimerIntervalId = null;
  }
  elements.restTimerPanel.hidden = true;
  elements.restTimerPanel.classList.remove("rest-timer-done");
}

function startRestTimer(totalSeconds) {
  stopRestTimer();

  let remaining = totalSeconds;
  elements.restTimerPanel.hidden = false;
  elements.restTimerRemaining.textContent = formatRestClock(remaining);

  restTimerIntervalId = setInterval(() => {
    remaining -= 1;

    if (remaining <= 0) {
      clearInterval(restTimerIntervalId);
      restTimerIntervalId = null;
      elements.restTimerRemaining.textContent = "Rest complete";
      elements.restTimerPanel.classList.add("rest-timer-done");
      playRestCompleteCue();
      setTimeout(() => {
        elements.restTimerPanel.hidden = true;
        elements.restTimerPanel.classList.remove("rest-timer-done");
      }, 2500);
      return;
    }

    elements.restTimerRemaining.textContent = formatRestClock(remaining);
  }, 1000);
}

function maybeStartRestTimer() {
  const restSeconds = Number(state.activeSessionState?.current_step?.exercise?.rest_seconds);
  if (Number.isInteger(restSeconds) && restSeconds > 0) {
    startRestTimer(restSeconds);
  }
}

function openSkipReasonPanel() {
  if (!currentFocusExerciseId) return;
  hideAllActionPanels();
  elements.skipReasonPanel.hidden = false;
}

function openPainReportPanel() {
  if (!currentFocusExerciseId) return;
  hideAllActionPanels();
  elements.painReportPanel.hidden = false;
}

function openRpeReportPanel() {
  if (!currentFocusExerciseId) return;
  hideAllActionPanels();
  elements.rpeReportPanel.hidden = false;
}

function openSubstitutionPanel() {
  if (!currentFocusExerciseId) return;
  hideAllActionPanels();
  elements.substitutionPanel.hidden = false;
}

async function confirmSkipWithReason() {
  const exerciseId = currentFocusExerciseId;
  if (!exerciseId) return;
  const reasonCode = elements.skipReasonSelect.value;

  hideAllActionPanels();
  await postSessionEvent({
    type: "SKIP_EXERCISE",
    exercise_id: exerciseId,
    reason_code: reasonCode
  });
}

async function confirmPainReport() {
  const exerciseId = currentFocusExerciseId;
  if (!exerciseId) return;

  hideAllActionPanels();
  await postSessionEvent({
    type: "PAIN_REPORT",
    exercise_id: exerciseId,
    pain_reported: true
  });
  showNotice("Pain reported for this exercise.");
}

async function confirmRpeReport() {
  const exerciseId = currentFocusExerciseId;
  if (!exerciseId) return;

  const rpeValue = Number(elements.rpeReportValue.value);
  hideAllActionPanels();
  await postSessionEvent({
    type: "RPE_REPORT",
    exercise_id: exerciseId,
    rpe_value: rpeValue
  });
  showNotice("RPE reported for this exercise.");
}

let lastSubstitutionResult = null;

function renderSubstitutionResult(outcome) {
  elements.substitutionResult.hidden = false;

  if (outcome?.ok === true) {
    const result = outcome.result;
    if (result.substitution_status === "substitution_applied") {
      elements.substitutionResult.innerHTML = `
        <p><strong>Substitute available:</strong> ${escapeHtml(result.substitution_output.target_exercise_id)}</p>
        <div class="button-row">
          <button id="applySubstitutionCompleteButton" class="button primary" type="button">Complete with substitute</button>
          <button id="applySubstitutionSkipButton" class="button secondary" type="button">Skip with substitute</button>
        </div>
      `;
      document.getElementById("applySubstitutionCompleteButton").addEventListener("click", () => {
        applySubstitution("COMPLETE_EXERCISE").catch(handleError);
      });
      document.getElementById("applySubstitutionSkipButton").addEventListener("click", () => {
        applySubstitution("SKIP_EXERCISE").catch(handleError);
      });
    }
    else {
      elements.substitutionResult.innerHTML = `<p>No substitution is required for the selected equipment.</p>`;
    }
  }
  else {
    elements.substitutionResult.innerHTML = `<p>No lawful substitute is available for this exercise.</p>`;
  }
}

async function checkSubstitution() {
  const exerciseId = currentFocusExerciseId;
  if (!exerciseId || !state.activeSessionId) return;

  const unavailableEquipmentIds = [...document.querySelectorAll(".substitution-equipment-option:checked")]
    .map((box) => box.value);

  showBusy("Checking substitution…");
  try {
    const outcome = await api(
      "POST",
      `/sessions/${encodeURIComponent(state.activeSessionId)}/substitution-request`,
      { exercise_id: exerciseId, unavailable_equipment_ids: unavailableEquipmentIds }
    );
    lastSubstitutionResult = { exerciseId, outcome };
    renderSubstitutionResult(outcome);
  }
  finally {
    hideBusy();
  }
}

async function applySubstitution(eventType) {
  if (!lastSubstitutionResult || lastSubstitutionResult.exerciseId !== currentFocusExerciseId) return;
  const outcome = lastSubstitutionResult.outcome;
  if (outcome?.ok !== true || outcome.result?.substitution_status !== "substitution_applied") return;

  const exerciseId = currentFocusExerciseId;
  hideAllActionPanels();
  if (eventType === "COMPLETE_EXERCISE") maybeStartRestTimer();
  await postSessionEvent({
    type: eventType,
    exercise_id: exerciseId,
    substituted_exercise_id: outcome.result.substitution_output.target_exercise_id,
    substitution_edge_id: outcome.result.substitution_output.substitution_edge_id
  });
}

function openVideoFeedbackPanel() {
  if (!currentFocusExerciseId) return;
  hideAllActionPanels();
  elements.videoFeedbackPanel.hidden = false;
}

// Fast feedback only - never the actual security boundary, which is the
// server's own content-sniffed validation (video_submission_storage.ts).
// Reuses the exact video type/size limits already defined for messaging
// attachments (ATTACHMENT_VIDEO_TYPES/ATTACHMENT_MAX_VIDEO_BYTES, below)
// since the server-side ceiling is the same 50MB.
function validateVideoFeedbackClientSide(file) {
  if (!file) return "Choose a video to upload.";
  if (!ATTACHMENT_VIDEO_TYPES.includes(file.type)) {
    return "That file type isn't supported. Use an MP4/MOV video.";
  }
  if (file.size > ATTACHMENT_MAX_VIDEO_BYTES) {
    return "Videos must be 50MB or smaller.";
  }
  return null;
}

async function uploadExerciseVideo() {
  const exerciseId = currentFocusExerciseId;
  const sessionId = state.activeSessionId;
  if (!exerciseId || !sessionId) return;

  const file = elements.videoFeedbackFileInput?.files?.[0];
  const validationError = validateVideoFeedbackClientSide(file);
  if (validationError) {
    elements.videoFeedbackStatus.hidden = false;
    elements.videoFeedbackStatus.textContent = validationError;
    return;
  }

  const formData = new FormData();
  formData.append("video", file);
  formData.append("session_id", sessionId);
  formData.append("work_item_id", exerciseId);
  formData.append("exercise_label", currentFocusExerciseLabel || "Exercise");
  formData.append("client_request_id", newClientRequestId());
  if (elements.videoFeedbackCaptionInput?.value) {
    formData.append("caption", elements.videoFeedbackCaptionInput.value);
  }

  showBusy("Uploading video…");
  try {
    const response = await fetch("/video-feedback", {
      method: "POST",
      credentials: "same-origin",
      headers: { "x-kolosseum-csrf": String(state.csrfToken ?? "") },
      body: formData
    });
    const payload = await readJson(response);
    if (!response.ok) {
      const error = new Error(friendlyError(payload, response.status));
      error.payload = payload;
      error.status = response.status;
      throw error;
    }

    hideAllActionPanels();
    showNotice("Video uploaded. Your coach will be able to review it.");
  }
  catch (error) {
    elements.videoFeedbackStatus.hidden = false;
    elements.videoFeedbackStatus.textContent = friendlyError(error.payload, error.status) || "Video could not be uploaded.";
  }
  finally {
    hideBusy();
  }
}

function renderExerciseFocus(step, classification) {
  elements.returnDecision.hidden = true;
  elements.sessionActions.hidden = false;
  elements.startSessionButton.hidden = true;
  elements.completeExerciseButton.hidden = true;
  elements.skipExerciseButton.hidden = true;
  elements.reportPainButton.hidden = true;
  elements.reportRpeButton.hidden = true;
  elements.requestSubstitutionButton.hidden = true;
  elements.recordVideoFeedbackButton.hidden = true;
  elements.splitSessionButton.hidden = true;
  hideAllActionPanels();
  currentFocusExerciseId = null;
  currentFocusExerciseLabel = null;

  if (!step) {
    elements.currentExercise.innerHTML = `
      <div class="exercise-focus">
        <p class="eyebrow">${escapeHtml(classification.label)}</p>
        <h3>Session record complete</h3>
        <p class="muted">No further exercise is currently recorded.</p>
      </div>
    `;
    return;
  }

  if (step.type === "RETURN_DECISION") {
    elements.currentExercise.innerHTML = "";
    elements.returnDecision.hidden = false;
    elements.sessionActions.hidden = true;
    return;
  }

  const exercise = step.exercise ?? {};
  const details = exerciseDetails(exercise);
  currentFocusExerciseId = String(exercise?.exercise_id ?? exercise?.item_id ?? "") || null;
  currentFocusExerciseLabel = exerciseName(exercise) || null;

  const segment = String(exercise?.segment ?? "working");
  const groupType = String(exercise?.group_type ?? "");
  const coachingNotes = String(exercise?.coaching_notes ?? "").trim();

  elements.currentExercise.innerHTML = `
    <div class="exercise-focus">
      <p class="eyebrow">Current exercise</p>
      <h3>${escapeHtml(exerciseName(exercise))}</h3>
      <div class="exercise-detail-row">
        ${segment !== "working" ? `<span class="badge neutral">${escapeHtml(titleCase(segment))}</span>` : ""}
        ${exercise?.group_id ? `<span class="badge neutral">${escapeHtml(titleCase(groupType))}</span>` : ""}
        ${details.map((detail) => `<span class="exercise-detail">${escapeHtml(detail)}</span>`).join("")}
      </div>
      ${coachingNotes ? `<p class="muted exercise-coaching-note">${escapeHtml(coachingNotes)}</p>` : ""}
      <details class="exercise-howto" data-exercise-id="${escapeHtml(currentFocusExerciseId ?? "")}">
        <summary>How to perform this exercise</summary>
        <div class="exercise-howto-body"></div>
      </details>
    </div>
  `;

  if (state.activeSessionState?.started === true) {
    elements.completeExerciseButton.hidden = false;
    elements.skipExerciseButton.hidden = false;
    elements.reportPainButton.hidden = false;
    elements.reportRpeButton.hidden = false;
    elements.requestSubstitutionButton.hidden = false;
    elements.recordVideoFeedbackButton.hidden = false;
    elements.splitSessionButton.hidden = false;
  }
  else {
    elements.startSessionButton.hidden = false;
  }
}

function renderExerciseQueue(sessionState) {
  const counts = countsFromSession(sessionState);
  const currentId = sessionState?.current_step?.exercise?.exercise_id ??
    sessionState?.current_step?.exercise?.item_id ??
    null;

  const rows = [
    ...counts.completed.map((exercise) => ({ exercise, status: "complete" })),
    ...counts.remaining.map((exercise, index) => ({
      exercise,
      status: (exercise.exercise_id ?? exercise.item_id) === currentId || index === 0 ? "current" : "remaining"
    })),
    ...counts.dropped.map((exercise) => ({ exercise, status: "dropped" }))
  ];

  elements.exerciseQueue.innerHTML = rows.length
    ? rows.map(({ exercise, status }, index) => {
        const statusLabel = status === "complete"
          ? "Completed"
          : status === "dropped"
            ? "Dropped"
            : status === "current"
              ? "Current"
              : "Upcoming";

        const segment = String(exercise?.segment ?? "working");
        const groupType = String(exercise?.group_type ?? "");
        const coachingNotes = String(exercise?.coaching_notes ?? "").trim();

        return `
          <div class="exercise-row ${status} ${exercise?.group_id ? "exercise-row-grouped" : ""}">
            <span class="exercise-order">${index + 1}</span>
            <div>
              <strong>${escapeHtml(exerciseName(exercise))}</strong>
              ${segment !== "working" ? `<span class="badge neutral">${escapeHtml(titleCase(segment))}</span>` : ""}
              ${exercise?.group_id ? `<span class="badge neutral">${escapeHtml(titleCase(groupType))}</span>` : ""}
              <small>${escapeHtml(exerciseDetails(exercise).join(" · ") || "Recorded exercise")}</small>
              ${coachingNotes ? `<small class="exercise-coaching-note">${escapeHtml(coachingNotes)}</small>` : ""}
            </div>
            <span class="badge ${status === "complete" ? "complete" : status === "dropped" ? "partial" : status === "current" ? "active" : "neutral"}">${statusLabel}</span>
          </div>
        `;
      }).join("")
    : '<div class="empty-state"><p>No exercise records are available.</p></div>';
}

function renderAthleteSession() {
  const sessionState = state.activeSessionState;

  if (!state.activeSessionId || !sessionState) {
    elements.sessionEmpty.hidden = false;
    elements.sessionWorkspace.hidden = true;
    elements.sessionTitle.textContent = "No session selected";
    elements.sessionSubtitle.textContent = "Create or open a session to begin.";
    setBadge(elements.sessionStatusBadge, { label: "No session", className: "neutral" });
    return;
  }

  elements.sessionEmpty.hidden = true;
  elements.sessionWorkspace.hidden = false;

  const counts = countsFromSession(sessionState);
  const total = counts.completed.length + counts.remaining.length + counts.dropped.length;
  const classification = sessionClassification(sessionState);
  const activity = state.profile?.activityId ?? state.phase1Input?.activity_id ?? "training";

  elements.sessionActivity.textContent = titleCase(activity);
  elements.sessionTitle.textContent = `${titleCase(activity)} session`;
  elements.sessionSubtitle.textContent = total
    ? `${total} exercises recorded in this session.`
    : "Session record loaded.";
  setBadge(elements.sessionStatusBadge, classification);

  elements.sessionCompletedCount.textContent = String(counts.completed.length);
  elements.sessionRemainingCount.textContent = String(counts.remaining.length);
  elements.sessionDroppedCount.textContent = String(counts.dropped.length);
  elements.sessionProgressText.textContent = `${counts.completed.length} of ${total} complete`;

  const progress = total === 0 ? 0 : Math.round((counts.completed.length / total) * 100);
  elements.sessionProgressBar.style.width = `${progress}%`;

  renderExerciseFocus(sessionState.current_step, classification);
  renderExerciseQueue(sessionState);
  renderSessionCompletionSummary(sessionState, counts);
}

function renderSessionCompletionSummary(sessionState, counts) {
  const executionStatus = sessionState?.execution_status;
  const isEnded = executionStatus === "completed" || executionStatus === "partial";

  elements.sessionCompletionSummary.hidden = !isEnded;
  if (!isEnded) return;

  elements.sessionCompletionHeading.textContent =
    executionStatus === "completed" ? "Session complete" : "Session partially completed";
  elements.sessionCompletionBody.textContent =
    executionStatus === "completed"
      ? "Every exercise in this session was completed."
      : "This session ended with one or more exercises dropped.";
  elements.sessionCompletionCompletedCount.textContent = String(counts.completed.length);
  elements.sessionCompletionDroppedCount.textContent = String(counts.dropped.length);
}

async function refreshHistory(options = {}) {
  if (state.role !== "athlete") return [];

  elements.historyServiceUnavailable.hidden = true;
  elements.historyLoading.hidden = false;

  let history;
  try {
    history = await api("POST", "/sessions/beta-athlete-history", {
      athlete_user_id: state.profile.userId
    });
  }
  catch (error) {
    elements.historyLoading.hidden = true;
    elements.historyServiceUnavailable.hidden = false;
    throw error;
  }

  elements.historyLoading.hidden = true;

  const serverSessions = Array.isArray(history.sessions) ? history.sessions : [];
  state.history = mergeHistory(serverSessions);
  state.historyEnriched = serverSessions;
  state.historyFiltered = null;
  saveState();
  populateHistoryFilterOptions(serverSessions);
  renderHistoryList(serverSessions);
  renderToday();
  refreshProgressPhotos({ quiet: true }).catch(() => {});
  refreshBodyMetrics({ quiet: true }).catch(() => {});
  refreshHabits({ quiet: true }).catch(() => {});
  refreshAthleteGoals({ quiet: true }).catch(() => {});
  refreshWeeklyCheckins({ quiet: true }).catch(() => {});
  refreshDeviceSync({ quiet: true }).catch(() => {});
  refreshProgressInsights({ quiet: true }).catch(() => {});

  if (!options.quiet) showNotice("Training history refreshed.");
  return state.history;
}

function populateHistoryFilterOptions(sessions) {
  const activities = new Set();
  const programmes = new Map();
  const events = new Map();

  for (const session of sessions) {
    if (session.activity_id) activities.add(session.activity_id);
    const programme = session.provenance?.programme;
    if (programme?.template_id) programmes.set(programme.template_id, programme.template_name || programme.template_id);
    const event = session.provenance?.event;
    if (event?.event_id) events.set(event.event_id, event.event_name || event.event_id);
  }

  const previousActivity = elements.historyFilterActivity.value;
  const previousProgramme = elements.historyFilterProgramme.value;
  const previousEvent = elements.historyFilterEvent.value;

  elements.historyFilterActivity.innerHTML = '<option value="">All activities</option>' +
    [...activities].map((id) => `<option value="${escapeHtml(id)}">${escapeHtml(titleCase(id))}</option>`).join("");
  elements.historyFilterProgramme.innerHTML = '<option value="">All programmes</option>' +
    [...programmes.entries()].map(([id, name]) => `<option value="${escapeHtml(id)}">${escapeHtml(name)}</option>`).join("");
  elements.historyFilterEvent.innerHTML = '<option value="">All events</option>' +
    [...events.entries()].map(([id, name]) => `<option value="${escapeHtml(id)}">${escapeHtml(name)}</option>`).join("");

  elements.historyFilterActivity.value = previousActivity;
  elements.historyFilterProgramme.value = previousProgramme;
  elements.historyFilterEvent.value = previousEvent;
}

async function applyHistoryFilters() {
  if (state.role !== "athlete") return;

  const filters = {
    status: elements.historyFilterStatus.value,
    date_from: elements.historyFilterDateFrom.value,
    date_to: elements.historyFilterDateTo.value,
    activity_id: elements.historyFilterActivity.value,
    template_id: elements.historyFilterProgramme.value,
    event_id: elements.historyFilterEvent.value
  };

  showBusy("Applying filters…");
  try {
    const result = await api("POST", "/sessions/beta-athlete-history", {
      athlete_user_id: state.profile.userId,
      ...filters
    });
    state.historyFiltered = Array.isArray(result.sessions) ? result.sessions : [];
    renderHistoryList(state.historyFiltered);
  }
  finally {
    hideBusy();
  }
}

function clearHistoryFilters() {
  elements.historyFilterStatus.value = "";
  elements.historyFilterDateFrom.value = "";
  elements.historyFilterDateTo.value = "";
  elements.historyFilterActivity.value = "";
  elements.historyFilterProgramme.value = "";
  elements.historyFilterEvent.value = "";
  state.historyFiltered = null;
  renderHistoryList(state.historyEnriched ?? []);
}

async function exportHistory() {
  if (state.role !== "athlete") return;

  showBusy("Preparing export…");
  try {
    const result = await api("POST", "/sessions/beta-athlete-history-export", {
      athlete_user_id: state.profile.userId
    });

    const blob = new Blob([JSON.stringify(result, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${result.export_id || "athlete-history-export"}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);

    showNotice("Training history export generated.");
  }
  finally {
    hideBusy();
  }
}

function syncHistoryDetailRoute(sessionId) {
  // Toggling historyDetailPanel's hidden attribute lands inside the shared
  // .views MutationObserver (route_bootstrap.js), which resyncs the hash from
  // whichever top-level .view section is visible - #view-history itself,
  // which carries no session entity - clobbering the detail URL we just set.
  // Re-asserting it here, after the async fetch/render settles, is a self-
  // healing fix that does not require touching that shared observer.
  const detailHash = `#/athlete/history/${encodeURIComponent(sessionId)}`;
  if (location.hash !== detailHash) {
    history.replaceState({ kolosseum_route: detailHash }, "", detailHash);
  }
}

async function openHistoryDetail(sessionId) {
  if (!sessionId || state.role !== "athlete") return;

  elements.historyDetailPanel.hidden = false;
  elements.historyDetailPanel.innerHTML = `
    <div class="panel-header"><div><p class="eyebrow">Session detail</p><h3>Loading…</h3></div></div>
  `;

  try {
    const [detail, videoFeedbackResponse] = await Promise.all([
      api("POST", "/sessions/beta-athlete-history-detail", {
        athlete_user_id: state.profile.userId,
        session_id: sessionId
      }),
      api("GET", `/video-feedback/submissions?session_id=${encodeURIComponent(sessionId)}`)
        .catch(() => ({ submissions: [] }))
    ]);
    renderHistoryDetail(detail, Array.isArray(videoFeedbackResponse.submissions) ? videoFeedbackResponse.submissions : []);
    syncHistoryDetailRoute(sessionId);
  }
  catch (error) {
    elements.historyDetailPanel.innerHTML = `
      <div class="panel-header">
        <div><p class="eyebrow">Session detail</p><h3>Could not load this session</h3></div>
        <button id="closeHistoryDetailButton" class="button secondary" type="button">Close detail</button>
      </div>
      <p class="muted">${escapeHtml(error?.message ?? "The session record could not be fetched.")}</p>
    `;
    document.getElementById("closeHistoryDetailButton")?.addEventListener("click", closeHistoryDetail);
  }
}

function closeHistoryDetail() {
  elements.historyDetailPanel.hidden = true;
  elements.historyDetailPanel.innerHTML = "";
  if (location.hash.startsWith("#/athlete/history/")) {
    location.hash = "#/athlete/history";
  }
}

function renderVideoSubmissionCard(submission) {
  const feedback = Array.isArray(submission.feedback) ? submission.feedback : [];
  const statusClass = submission.review_status === "reviewed" ? "complete" : "neutral";
  return `
    <div class="history-exercise-row video-feedback-submission">
      <div>
        <strong>${escapeHtml(submission.exercise_label || "Exercise")}</strong>
        <span class="badge ${statusClass}">${submission.review_status === "reviewed" ? "Reviewed" : "Awaiting review"}</span>
      </div>
      <video class="message-attachment-video" controls preload="metadata"
        ${submission.thumbnail_url ? `poster="${escapeHtml(submission.thumbnail_url)}"` : ""}>
        <source src="${escapeHtml(submission.url)}">
      </video>
      ${submission.caption ? `<p class="muted">${escapeHtml(submission.caption)}</p>` : ""}
      ${feedback.map((entry) => `
        <p class="muted exercise-coaching-note">Coach: ${escapeHtml(entry.feedback_text)}</p>
      `).join("")}
    </div>
  `;
}

function renderHistoryDetail(detail, videoSubmissions = []) {
  const programme = detail.provenance?.programme;
  const assignment = detail.provenance?.assignment;
  const event = detail.provenance?.event;
  const canContinue = detail.execution_status === "ready" || detail.execution_status === "in_progress";

  elements.historyDetailPanel.innerHTML = `
    <div class="panel-header">
      <div>
        <p class="eyebrow">Session detail</p>
        <h3>${escapeHtml(programme?.template_name || "Training session")}</h3>
        <p class="muted">${escapeHtml(formatDate(detail.created_at))} · ${escapeHtml(titleCase(detail.execution_status))}</p>
      </div>
      <div class="button-row">
        ${canContinue ? `<button id="continueHistorySessionButton" class="button primary" type="button">Continue session</button>` : ""}
        <button id="closeHistoryDetailButton" class="button secondary" type="button">Close detail</button>
      </div>
    </div>

    <div class="history-facts">
      <div><span>Status</span><strong>${escapeHtml(titleCase(detail.execution_status))}</strong></div>
      <div><span>Split entered</span><strong>${detail.split_entered ? "Yes" : "No"}</strong></div>
      <div><span>Return decision</span><strong>${escapeHtml(titleCase(detail.split_return_decision || "None"))}</strong></div>
      <div><span>Programme</span><strong>${escapeHtml(programme ? `${programme.template_name} (v${programme.template_version})` : "Not recorded")}</strong></div>
      <div><span>Assignment</span><strong>${escapeHtml(assignment?.assignment_id || "Not recorded")}</strong></div>
      <div><span>Event</span><strong>${escapeHtml(event?.event_name || "No linked event")}</strong></div>
    </div>

    <div class="panel-header"><div><p class="eyebrow">Planned versus recorded</p><h4>Exercises</h4></div></div>
    <div id="historyDetailExercises">
      ${(Array.isArray(detail.exercises) ? detail.exercises : []).map((exercise) => `
        <div class="history-exercise-row">
          <strong>${escapeHtml(exerciseName(exercise.planned))}</strong>
          <span class="badge ${exercise.recorded_state === "completed" ? "complete" : exercise.recorded_state === "dropped" ? "partial" : "neutral"}">${escapeHtml(titleCase(exercise.recorded_state))}</span>
          ${exercise.skip_reason ? `<small>Skip reason: ${escapeHtml(titleCase(exercise.skip_reason))}</small>` : ""}
          ${exercise.pain_reported ? "<small>Pain reported</small>" : ""}
          ${exercise.rpe_reported ? `<small>RPE reported: ${escapeHtml(String(exercise.rpe_reported))}</small>` : ""}
          ${exercise.substitution ? `<small>Substituted with ${escapeHtml(exercise.substitution.substituted_exercise_id)}</small>` : ""}
        </div>
      `).join("")}
    </div>

    ${videoSubmissions.length ? `
      <div class="panel-header"><div><p class="eyebrow">Form-check videos</p><h4>Video feedback</h4></div></div>
      <div id="historyDetailVideoFeedback">
        ${videoSubmissions.map(renderVideoSubmissionCard).join("")}
      </div>
    ` : ""}

    ${Array.isArray(detail.split_return_events) && detail.split_return_events.length ? `
      <div class="panel-header"><div><p class="eyebrow">Split and return record</p><h4>Events</h4></div></div>
      <div class="record-list">
        ${detail.split_return_events.map((event) => `
          <div class="history-exercise-row">
            <strong>${escapeHtml(titleCase(event.type))}</strong>
            <small>${escapeHtml(formatDate(event.created_at))}</small>
          </div>
        `).join("")}
      </div>
    ` : ""}
  `;

  document.getElementById("closeHistoryDetailButton")?.addEventListener("click", closeHistoryDetail);
  document.getElementById("continueHistorySessionButton")?.addEventListener("click", () => {
    state.activeSessionId = detail.session_id;
    state.activeSessionState = null;
    saveState();
    setView("session");
  });
}

function historyRecordCard(session) {
  const date = formatDate(session.updated_at ?? session.created_at);
  const executionStatus = session.execution_status ?? session.status ?? "recorded";
  const statusClass = executionStatus === "completed"
    ? "complete"
    : executionStatus === "partial"
      ? "partial"
      : executionStatus === "in_progress"
        ? "active"
        : "neutral";
  const programmeName = session.provenance?.programme?.template_name;
  const eventName = session.provenance?.event?.event_name;

  return `
    <article class="record-card interactive" data-history-detail-id="${escapeHtml(session.session_id)}">
      <div>
        <h3>${escapeHtml(programmeName || "Training session")}</h3>
        <p>${escapeHtml(date)}${eventName ? ` · ${escapeHtml(eventName)}` : ""}</p>
      </div>
      <div class="record-meta">
        <span class="badge ${statusClass}">${escapeHtml(titleCase(executionStatus))}</span>
        <span class="badge neutral">${Number(session.completed_count ?? 0)} completed</span>
        ${session.dropped_count ? `<span class="badge partial">${Number(session.dropped_count)} dropped</span>` : ""}
      </div>
    </article>
  `;
}

function renderHistoryList(sessions) {
  elements.historyList.innerHTML = sessions.length
    ? [...sessions].reverse().map((session) => historyRecordCard(session)).join("")
    : `
      <div class="panel empty-state">
        <div class="empty-icon">H</div>
        <h3>No sessions recorded</h3>
        <p>Your persisted session history will appear here.</p>
      </div>
    `;

  bindHistoryCards(elements.historyList);
}

function bindHistoryCards(container) {
  for (const card of container.querySelectorAll("[data-history-detail-id]")) {
    card.addEventListener("click", () => {
      openHistoryDetail(card.dataset.historyDetailId);
    });
  }
}

function recordCard(session, interactive = true) {
  const date = formatDate(session.updated_at ?? session.created_at);
  const status = titleCase(session.status ?? "recorded");

  return `
    <article class="record-card ${interactive ? "interactive" : ""}" ${interactive ? `data-session-id="${escapeHtml(session.session_id)}"` : ""}>
      <div>
        <h3>Training session</h3>
        <p>${escapeHtml(date)}</p>
      </div>
      <div class="record-meta">
        <span class="badge neutral">${escapeHtml(status)}</span>
        <span class="badge neutral">${Number(session.runtime_event_count ?? 0)} events</span>
      </div>
    </article>
  `;
}

function renderHistory() {
  elements.historyList.innerHTML = state.history.length
    ? [...state.history].reverse().map((session) => recordCard(session)).join("")
    : `
      <div class="panel empty-state">
        <div class="empty-icon">H</div>
        <h3>No sessions recorded</h3>
        <p>Your persisted session history will appear here.</p>
      </div>
    `;

  bindSessionCards(elements.historyList);
}

function bindSessionCards(container) {
  for (const card of container.querySelectorAll("[data-session-id]")) {
    card.addEventListener("click", () => {
      state.activeSessionId = card.dataset.sessionId;
      state.activeSessionState = null;
      saveState();
      setView("session");
    });
  }
}

// FULL-UI-14C: server-authoritative copy for every declared Today state.
// Coach notes are rendered separately (renderTodayNotes) and never feed into
// any of this - they cannot change which state, session, exercise, load, or
// order is shown.
const TODAY_STATE_COPY = Object.freeze({
  no_current_assignment: Object.freeze({
    icon: "•",
    heading: "No active programme",
    body: "You don't have a coach-assigned programme right now. Ask your coach to assign one, or start a self-directed session below.",
    badge: { label: "No programme", className: "neutral" }
  }),
  relationship_ended: Object.freeze({
    icon: "•",
    heading: "Coaching relationship ended",
    body: "Your coaching relationship for this programme is no longer active. Contact your coach to reconnect.",
    badge: { label: "Relationship ended", className: "partial" }
  }),
  missing_strength_reference: Object.freeze({
    icon: "•",
    heading: "Waiting on a strength reference",
    body: "This programme needs a working-max reference your coach hasn't recorded yet. Ask your coach to add it to your profile before you can continue.",
    badge: { label: "Reference needed", className: "partial" }
  }),
  programme_complete: Object.freeze({
    icon: "✓",
    heading: "Programme complete",
    body: "You've completed every session in this programme. Your coach will assign what's next.",
    badge: { label: "Complete", className: "complete" }
  }),
  no_session: Object.freeze({
    icon: "+",
    heading: "No session is open",
    body: "Start your next session from this programme when you're ready to train.",
    badge: { label: "No session", className: "neutral" }
  }),
  session_already_complete: Object.freeze({
    icon: "✓",
    heading: "Session complete",
    body: "You already completed this session. Start the next one from this programme when you're ready.",
    badge: { label: "Session complete", className: "complete" }
  })
});

function todaySessionLabel(session) {
  const parts = [];
  if (session?.template_block_name) parts.push(`Block: ${session.template_block_name}`);
  if (Number.isInteger(session?.template_week_index_global)) {
    parts.push(`Week ${session.template_week_index_global}`);
  }
  if (Number.isInteger(session?.template_session_index) && session?.total_session_count) {
    parts.push(`Session ${session.template_session_index + 1} of ${session.total_session_count}`);
  }
  return parts.join(" · ");
}

function renderTodayProgramme(today) {
  const assignment = today?.assignment ?? null;
  elements.todayProgrammeSummary.hidden = !assignment;
  if (!assignment) return;

  elements.todayProgrammeName.textContent = assignment.template_name || "Assigned programme";
  elements.todayProgrammeVersion.textContent = assignment.template_version
    ? `Version ${assignment.template_version}`
    : "";
  elements.todayBlockWeek.textContent = todaySessionLabel(today.session);
}

function renderTodayResolvedLoad(session) {
  const firstItem = Array.isArray(session?.planned_items) ? session.planned_items[0] : null;
  const resolved = firstItem?.resolved_load;

  elements.todayResolvedLoad.hidden = !resolved;
  if (!resolved) return;

  elements.todayResolvedLoadValue.textContent = `${resolved.value} ${resolved.unit}`;
  const source = resolved.source;
  elements.todayResolvedLoadSource.textContent = source
    ? `${strengthSourceLabel(source.source_type)} · effective ${formatDate(source.effective_date)}`
    : "";
}

function renderTodayNotes(notes) {
  const list = Array.isArray(notes) ? notes : [];
  elements.todayNotes.hidden = list.length === 0;
  elements.todayNotesList.innerHTML = list
    .map((note) => `<li>${escapeHtml(note.note_text)}<br /><small class="muted">${formatDate(note.created_at_iso8601)}</small></li>`)
    .join("");
}

function renderTodayEvent(event) {
  if (!event) {
    elements.todayEventCard.hidden = true;
    return;
  }

  if (event.status === "unavailable") {
    elements.todayEventCard.hidden = false;
    elements.todayEventType.textContent = "Unavailable";
    elements.todayEventCountdown.textContent = "—";
    elements.todayEventName.textContent = "This event is no longer available";
    elements.todayEventDate.textContent = titleCase(event.reason ?? "event_unavailable");
    return;
  }

  elements.todayEventCard.hidden = false;
  elements.todayEventType.textContent = titleCase(event.event_type ?? "event");
  elements.todayEventCountdown.textContent = countdownLabel(event.event_date);
  elements.todayEventName.textContent = event.event_name || "Event";
  elements.todayEventDate.textContent = `${formatDate(event.event_date)}${event.location ? ` · ${event.location}` : ""}`;
}

function renderTodayRecent() {
  elements.todayHistoryCount.textContent = String(state.history.length);
  const latest = [...state.history].reverse().slice(0, 4);
  elements.todayRecentList.innerHTML = latest.length
    ? latest.map((session) => recordCard(session)).join("")
    : '<div class="empty-state"><p>No recent sessions are recorded.</p></div>';
  bindSessionCards(elements.todayRecentList);
}

function renderToday() {
  const today = state.athleteToday;

  elements.todayServiceUnavailable.hidden = true;
  elements.todayProgrammeSummary.hidden = true;
  elements.todaySessionEmpty.hidden = true;
  elements.todaySessionContent.hidden = true;

  renderTodayRecent();

  if (!today || today.state === "service_unavailable") {
    elements.todayServiceUnavailable.hidden = false;
    elements.todayEventCard.hidden = true;
    elements.todayNotes.hidden = true;
    setBadge(elements.todayStatusBadge, { label: "Unavailable", className: "partial" });
    elements.createSessionButton.textContent = "Create session";
    return;
  }

  renderTodayNotes(today.notes);
  renderTodayEvent(today.event);
  renderTodayProgramme(today);

  const messageStates = [
    "no_current_assignment",
    "relationship_ended",
    "missing_strength_reference",
    "programme_complete",
    "no_session",
    "session_already_complete"
  ];

  if (messageStates.includes(today.state)) {
    const copy = TODAY_STATE_COPY[today.state];
    elements.todaySessionEmpty.hidden = false;
    elements.todaySessionEmptyIcon.textContent = copy.icon;
    elements.todaySessionEmptyHeading.textContent = copy.heading;
    elements.todaySessionEmptyBody.textContent = copy.body;
    setBadge(elements.todayStatusBadge, copy.badge);

    if (today.state === "session_already_complete") {
      elements.createSessionButton.textContent = "Start next session";
    }
    else if (today.state === "no_session") {
      elements.createSessionButton.textContent = "Start session";
    }
    else {
      elements.createSessionButton.textContent = "Create session";
    }
    return;
  }

  // today.state === "ok": a real, server-selected session exists to continue.
  const sessionState = state.activeSessionId === today.session?.session_id
    ? state.activeSessionState
    : null;

  elements.todaySessionContent.hidden = false;
  elements.createSessionButton.textContent = "Create another session";

  if (sessionState) {
    const counts = countsFromSession(sessionState);
    const classification = sessionClassification(sessionState);
    setBadge(elements.todayStatusBadge, classification);
    elements.todayCompleted.textContent = String(counts.completed.length);
    elements.todayRemaining.textContent = String(counts.remaining.length);
    elements.todayDropped.textContent = String(counts.dropped.length);
  }
  else {
    setBadge(elements.todayStatusBadge, { label: "In progress", className: "active" });
    elements.todayCompleted.textContent = "0";
    elements.todayRemaining.textContent = "4";
    elements.todayDropped.textContent = "0";
  }

  elements.todayActivity.textContent = titleCase(state.profile?.activityId ?? "training");
  elements.todaySessionTitle.textContent = today.session?.template_session_title
    ? String(today.session.template_session_title)
    : `${titleCase(state.profile?.activityId ?? "training")} session`;

  const sessionNotes = today.session?.template_session_coaching_notes;
  elements.todaySessionNotes.hidden = !sessionNotes;
  elements.todaySessionNotes.textContent = sessionNotes ? String(sessionNotes) : "";

  renderTodayResolvedLoad(today.session);
}

// Fetches the athlete's single, server-authoritative Today state. This is
// the only thing allowed to decide which session is current - it must be
// re-run on every load/refresh, never inferred from cached localStorage
// state, and its session_id always wins over whatever was last cached.
async function loadAthleteToday() {
  if (state.role !== "athlete" || !state.profile?.userId) return null;

  try {
    const response = await api("POST", "/sessions/beta-athlete-today", {
      athlete_user_id: state.profile.userId
    });
    state.athleteToday = response;
  }
  catch {
    state.athleteToday = { state: "service_unavailable" };
  }

  const serverSessionId = state.athleteToday?.session?.session_id ?? null;

  if (serverSessionId) {
    if (state.activeSessionId !== serverSessionId) {
      state.activeSessionId = serverSessionId;
      state.activeSessionState = null;
    }
    saveState();
    if (!state.activeSessionState) {
      try {
        await loadSessionState();
      }
      catch {
        // Today can still render from the server-reported facts above even
        // if the deeper session-state fetch fails; the session view itself
        // will retry when opened.
      }
    }
  }
  else {
    // No session to continue right now - a leftover cached session id must
    // never be allowed to drive Today's next-action decision.
    state.activeSessionId = null;
    state.activeSessionState = null;
    saveState();
  }

  renderToday();
  return state.athleteToday;
}


// FULL-UI-04A factual coach–athlete directory and relationship lifecycle.

function mapCoachAthleteDirectoryRow(raw, existing = null) {
  const userId = String(
    raw?.athlete_user_id ??
    existing?.userId ??
    ""
  );

  const relationship =
    raw?.relationship &&
    typeof raw.relationship === "object"
      ? raw.relationship
      : existing?.relationship ?? null;

  return {
    userId,
    displayName: String(
      raw?.display_name ??
      existing?.displayName ??
      userId
    ),
    email: String(
      raw?.email ??
      existing?.email ??
      ""
    ),
    activityId: String(
      raw?.activity_id ??
      existing?.activityId ??
      "powerlifting"
    ),
    relationship,
    relationshipState: String(
      raw?.relationship_state ??
      relationship?.relationship_state ??
      "unknown"
    ),
    relationshipExpired:
      raw?.relationship_expired === true
  };
}

function relationshipEffectiveState(entry) {
  if (entry?.relationshipExpired === true) {
    return "expired";
  }

  const stored = String(
    entry?.relationshipState ??
    entry?.relationship?.relationship_state ??
    "unknown"
  ).toLowerCase();

  const expiresAt = String(
    entry?.relationship?.expires_at_iso8601 ??
    ""
  );

  if (
    stored === "invited" &&
    expiresAt &&
    Number.isFinite(Date.parse(expiresAt)) &&
    Date.parse(expiresAt) <= Date.now()
  ) {
    return "expired";
  }

  return stored;
}

function relationshipBadgeClass(value) {
  if (value === "accepted") return "complete";
  if (value === "invited") return "active";
  return "neutral";
}

function relationshipEntryByAthleteId(athleteUserId) {
  const relationships =
    Array.isArray(state.coachRelationships)
      ? state.coachRelationships
      : [];

  return relationships.find(
    (entry) =>
      entry.userId === athleteUserId
  ) ?? null;
}

function relationshipAssignmentForAthlete(athleteUserId) {
  return state.coachAssignments.find(
    (assignment) =>
      assignment.athleteUserId ===
      athleteUserId
  ) ?? null;
}

function relationshipProgrammeLabel(athleteUserId) {
  const assignment =
    relationshipAssignmentForAthlete(
      athleteUserId
    );

  if (!assignment) {
    return "No programme assigned";
  }

  const template =
    state.coachTemplates.find(
      (entry) =>
        String(entry.template_id ?? "") ===
        assignment.templateId
    );

  const name = String(
    template?.template_name ??
    assignment.record?.template_name ??
    assignment.templateId ??
    "Programme"
  );

  const version =
    Number(
      assignment.templateVersion ??
      assignment.record?.template_version ??
      0
    );

  return version > 0
    ? `${name} · v${version}`
    : name;
}

function relationshipDateValue(value) {
  const text = String(value ?? "");
  return text
    ? formatDate(text)
    : "Not recorded";
}

function syncConnectAthleteRelationshipForm() {
  const invited =
    elements.connectAthleteRelationshipState
      ?.value === "invited";

  if (elements.connectAthleteExpiryField) {
    elements.connectAthleteExpiryField.hidden =
      !invited;
  }

  if (elements.connectAthleteExpiry) {
    elements.connectAthleteExpiry.disabled =
      !invited;

    if (!invited) {
      elements.connectAthleteExpiry.value = "";
    }
  }

  if (elements.connectAthleteConsentText) {
    elements.connectAthleteConsentText.textContent =
      invited
        ? "The athlete supplied this code or authorised this pending invitation."
        : "The athlete supplied this code and accepted this connection.";
  }
}

async function refreshCoachRelationships(
  options = {}
) {
  if (
    state.role !== "coach" ||
    !state.profile?.coachUserId
  ) {
    return [];
  }

  if (!options.quiet) {
    showBusy(
      "Loading athlete relationships…"
    );
  }

  try {
    const response =
      await api(
        "GET",
        `/coach-workspace/relationships?coach_user_id=${encodeURIComponent(state.profile.coachUserId)}`
      );

    const currentRelationships =
      Array.isArray(state.coachRelationships)
        ? state.coachRelationships
        : [];

    const existingById =
      new Map(
        currentRelationships.map(
          (entry) => [
            entry.userId,
            entry
          ]
        )
      );

    state.coachRelationships =
      (
        Array.isArray(
          response.relationships
        )
          ? response.relationships
          : []
      )
        .map((entry) => {
          const userId = String(
            entry?.athlete_user_id ??
            ""
          );

          return mapCoachAthleteDirectoryRow(
            entry,
            existingById.get(userId)
          );
        })
        .filter(
          (entry) => entry.userId
        );

    saveState();
    renderCoachAthleteDirectory();

    return state.coachRelationships;
  }
  finally {
    if (!options.quiet) {
      hideBusy();
    }
  }
}

function renderCoachAthleteDirectory() {
  if (
    !elements.athleteRoster ||
    !elements.athleteRelationshipCounts
  ) {
    return;
  }

  const relationships =
    Array.isArray(state.coachRelationships)
      ? state.coachRelationships
      : [];

  const records =
    relationships.length > 0
      ? relationships
      : state.coachAthletes.map(
          (entry) => ({
            ...entry,
            relationshipState:
              entry.relationship
                ?.relationship_state ??
              "accepted",
            relationshipExpired: false
          })
        );

  const counts = {
    accepted: 0,
    invited: 0,
    expired: 0,
    revoked: 0
  };

  for (const record of records) {
    const effectiveState =
      relationshipEffectiveState(record);

    if (
      Object.prototype.hasOwnProperty.call(
        counts,
        effectiveState
      )
    ) {
      counts[effectiveState] += 1;
    }
  }

  elements.athleteRelationshipCounts.innerHTML =
    [
      ["Accepted", counts.accepted],
      ["Pending", counts.invited],
      ["Expired", counts.expired],
      ["Revoked", counts.revoked]
    ]
      .map(
        ([label, value]) => `
          <article class="metric-card relationship-metric-card">
            <span>${escapeHtml(label)}</span>
            <strong>${Number(value)}</strong>
          </article>
        `
      )
      .join("");

  const query =
    String(
      state.coachAthleteSearch ?? ""
    )
      .trim()
      .toLowerCase();

  const filter =
    String(
      state.coachAthleteRelationshipFilter ??
      "all"
    );

  const visible =
    records.filter((record) => {
      const effectiveState =
        relationshipEffectiveState(record);

      if (
        filter !== "all" &&
        effectiveState !== filter
      ) {
        return false;
      }

      if (!query) {
        return true;
      }

      return [
        record.displayName,
        record.email,
        record.userId,
        record.activityId
      ].some(
        (value) =>
          String(value ?? "")
            .toLowerCase()
            .includes(query)
      );
    });

  elements.athleteRoster.innerHTML =
    visible.length
      ? visible
          .map((record) => {
            const effectiveState =
              relationshipEffectiveState(
                record
              );

            const accepted =
              effectiveState === "accepted";

            const programme =
              relationshipProgrammeLabel(
                record.userId
              );

            return `
              <article
                class="record-card athlete-record-card relationship-directory-card"
              >
                <div>
                  <p class="eyebrow">
                    ${escapeHtml(
                      titleCase(record.activityId)
                    )}
                  </p>

                  <h3>
                    ${escapeHtml(record.displayName)}
                  </h3>

                  <p>
                    ${escapeHtml(
                      record.email ||
                      record.userId
                    )}
                  </p>

                  <p class="muted small">
                    ${escapeHtml(programme)}
                  </p>
                </div>

                <div class="record-meta athlete-record-meta">
                  <span class="badge ${relationshipBadgeClass(effectiveState)}">
                    ${escapeHtml(
                      titleCase(effectiveState)
                    )}
                  </span>

                  <button
                    class="button secondary small-button"
                    type="button"
                    data-relationship-action="audit"
                    data-relationship-athlete-id="${escapeHtml(record.userId)}"
                  >
                    View audit
                  </button>

                  ${
                    accepted
                      ? `
                        <button
                          class="button secondary small-button open-athlete-profile"
                          type="button"
                          data-athlete-id="${escapeHtml(record.userId)}"
                        >
                          Open profile
                        </button>
                      `
                      : ""
                  }
                </div>
              </article>
            `;
          })
          .join("")
      : `
        <div class="empty-state">
          <div class="empty-icon">A</div>
          <h3>No matching relationships</h3>
          <p>Change the search or relationship-state filter.</p>
        </div>
      `;

  bindCoachAthleteActions();
}

function closeAthleteRelationshipDetail() {
  if (
    elements.athleteRelationshipDetailPanel
  ) {
    elements.athleteRelationshipDetailPanel.hidden =
      true;
  }
}

function openAthleteRelationshipDetail(
  athleteUserId
) {
  const entry =
    relationshipEntryByAthleteId(
      athleteUserId
    );

  if (!entry) {
    throw new Error(
      "The relationship record could not be found."
    );
  }

  const relationship =
    entry.relationship &&
    typeof entry.relationship === "object"
      ? entry.relationship
      : {};

  const effectiveState =
    relationshipEffectiveState(entry);

  elements.athleteRelationshipDetailPanel.hidden =
    false;

  elements.athleteRelationshipDetailHeading.textContent =
    entry.displayName;

  elements.athleteRelationshipDetailState.textContent =
    `${titleCase(effectiveState)} · ${titleCase(entry.activityId)} · ${entry.userId}`;

  const facts = [
    ["Relationship ID", relationship.relationship_id],
    ["Stored state", relationship.relationship_state],
    ["Effective state", effectiveState],
    ["Scope", relationship.relationship_scope],
    ["Created", relationship.created_at_iso8601],
    ["Accepted", relationship.accepted_at_iso8601],
    ["Updated", relationship.updated_at_iso8601],
    ["Expires", relationship.expires_at_iso8601],
    ["Revoked", relationship.revoked_at_iso8601]
  ];

  elements.athleteRelationshipAuditFacts.innerHTML =
    facts
      .map(
        ([label, value]) => `
          <div class="relationship-audit-fact">
            <dt>${escapeHtml(label)}</dt>
            <dd>${escapeHtml(
              label.includes("ID") ||
              label === "Scope" ||
              label.includes("state")
                ? String(value ?? "Not recorded")
                : relationshipDateValue(value)
            )}</dd>
          </div>
        `
      )
      .join("");

  const accepted =
    effectiveState === "accepted";

  const invited =
    effectiveState === "invited" ||
    effectiveState === "expired";

  elements.athleteRelationshipProfileButton.hidden =
    !accepted;

  elements.athleteRelationshipProfileButton.dataset.athleteId =
    entry.userId;

  elements.athleteRelationshipTransitionButton.hidden =
    !(accepted || invited);

  elements.athleteRelationshipTransitionButton.dataset.relationshipAthleteId =
    entry.userId;

  elements.athleteRelationshipTransitionButton.dataset.relationshipAction =
    accepted
      ? "revoke"
      : "cancel";

  elements.athleteRelationshipTransitionButton.textContent =
    accepted
      ? "Revoke relationship"
      : "Cancel invitation";

  elements.athleteProfilePanel.hidden =
    true;

  elements.athleteRelationshipDetailPanel.scrollIntoView({
    behavior: "smooth",
    block: "start"
  });
}

async function transitionCoachRelationship(
  athleteUserId,
  action
) {
  const entry =
    relationshipEntryByAthleteId(
      athleteUserId
    );

  const relationship =
    entry?.relationship &&
    typeof entry.relationship === "object"
      ? entry.relationship
      : null;

  if (!entry || !relationship) {
    throw new Error(
      "The relationship record could not be found."
    );
  }

  const verb =
    action === "revoke"
      ? "revoke this accepted relationship"
      : "cancel this invitation";

  if (
    !window.confirm(
      `Confirm that you want to ${verb}. Historical records will be preserved.`
    )
  ) {
    return;
  }

  showBusy(
    action === "revoke"
      ? "Revoking relationship…"
      : "Cancelling invitation…"
  );

  try {
    const timestamp = nowIso();

    await api(
      "POST",
      "/sessions/beta-coach-relationship",
      {
        relationship_id:
          String(
            relationship.relationship_id ??
            createId("relationship")
          ),
        coach_user_id:
          state.profile.coachUserId,
        athlete_user_id:
          entry.userId,
        relationship_state:
          "revoked",
        relationship_scope:
          "individual_coach_athlete",
        accepted_at_iso8601:
          relationship.accepted_at_iso8601 ??
          null,
        created_at_iso8601:
          relationship.created_at_iso8601 ??
          timestamp,
        updated_at_iso8601:
          timestamp,
        revoked_at_iso8601:
          timestamp,
        expires_at_iso8601:
          relationship.expires_at_iso8601 ??
          null
      }
    );

    await Promise.all([
      refreshCoachAthletes({
        quiet: true
      }),
      refreshCoachAssignments({
        quiet: true
      })
    ]);

    if (
      state.selectedCoachAthleteId ===
      entry.userId
    ) {
      closeAthleteProfile();
    }

    closeAthleteRelationshipDetail();
    renderCoachWorkspace();
    renderCoachDashboard();

    showNotice(
      action === "revoke"
        ? "Relationship revoked. Historical records remain stored."
        : "Invitation cancelled. Historical records remain stored."
    );
  }
  finally {
    hideBusy();
  }
}


async function refreshCoachAthletes(options = {}) {
  if (state.role !== "coach") return [];

  if (!options.quiet) {
    showBusy(
      "Loading connected athletes…"
    );
  }

  try {
    const [acceptedResponse] =
      await Promise.all([
        api(
          "GET",
          `/coach-workspace/athletes?coach_user_id=${encodeURIComponent(state.profile.coachUserId)}`
        ),
        refreshCoachRelationships({
          quiet: true
        })
      ]);

    const existingById =
      new Map(
        state.coachAthletes.map(
          (athlete) => [
            athlete.userId,
            athlete
          ]
        )
      );

    state.coachAthletes =
      (
        Array.isArray(
          acceptedResponse.athletes
        )
          ? acceptedResponse.athletes
          : []
      )
        .map((athlete) => {
          const userId = String(
            athlete.athlete_user_id ??
            ""
          );

          return mapCoachAthleteDirectoryRow(
            athlete,
            existingById.get(userId)
          );
        })
        .filter(
          (athlete) => athlete.userId
        );

    saveState();
    renderCoachAthleteDirectory();

    return state.coachAthletes;
  }
  finally {
    if (!options.quiet) {
      hideBusy();
    }
  }
}

async function refreshCoachAssignments(options = {}) {
  if (state.role !== "coach") return [];

  if (!options.quiet) showBusy("Loading programme assignments…");

  try {
    const response = await api(
      "GET",
      `/coach-workspace/assignments?coach_user_id=${encodeURIComponent(state.profile.coachUserId)}`
    );

    state.coachAssignments = (Array.isArray(response.assignments) ? response.assignments : [])
      .map((assignment) => {
        const template = state.coachTemplates.find(
          (entry) => String(entry.template_id ?? "") === String(assignment.template_id ?? "")
        );

        return {
          assignmentId: String(assignment.assignment_id ?? ""),
          athleteUserId: String(assignment.assigned_athlete_id ?? ""),
          templateId: String(assignment.template_id ?? ""),
          templateVersion: Number(
            assignment.template_version ??
            template?.template_version ??
            0
          ),
          templateName: String(
            assignment.template_name ??
            template?.template_name ??
            assignment.template_id ??
            "Programme"
          ),
          activityId: String(assignment.activity_id ?? ""),
          assignmentStatus: String(
            assignment.lifecycle_status ??
            assignment.assignment_status ??
            "assigned"
          ),
          isCurrent: assignment.is_current === true,
          replacesAssignmentId: String(assignment.replaces_assignment_id ?? ""),
          cancelsAssignmentId: String(assignment.cancels_assignment_id ?? ""),
          eventId: String(assignment.event_id ?? ""),
          preservedSessionCount: Number(assignment.preserved_session_count ?? 0),
          recordedAt: String(assignment.requested_at_iso8601 ?? ""),
          record: assignment
        };
      })
      .filter((assignment) => assignment.assignmentId);

    saveState();
    renderAssignmentLifecycleSurfaces();
    return state.coachAssignments;
  }
  finally {
    if (!options.quiet) hideBusy();
  }
}

async function refreshCoachAthleteProfiles() {
  const outcomes = await Promise.allSettled(
    state.coachAthletes.map((athlete) =>
      loadAthleteProfile(athlete.userId, { quiet: true })
    )
  );

  for (const outcome of outcomes) {
    if (outcome.status === "rejected") {
      console.error(outcome.reason);
    }
  }
}

// FULL-UI-24: the coach names the athlete by email only - never the
// athlete's internal account code - and the athlete accepts the invitation
// themselves from their own account.
async function inviteAthleteByEmail(event) {
  event.preventDefault();

  const athleteEmail = elements.inviteAthleteEmail.value.trim();
  if (!athleteEmail) return;

  showBusy("Sending invitation…");

  try {
    await api("POST", "/coach-workspace/relationship-invitations", {
      athlete_email: athleteEmail
    });

    elements.inviteAthleteByEmailForm.reset();
    showNotice(`Invitation sent to ${athleteEmail}.`);
  }
  finally {
    hideBusy();
  }
}

async function confirmSendCoachBroadcast(event) {
  event.preventDefault();

  const bodyText = elements.coachBroadcastBodyText.value.trim();
  if (!bodyText) return;

  showBusy("Sending broadcast…");

  try {
    const result = await api("POST", "/messages/coach/broadcast", { body_text: bodyText });

    elements.coachBroadcastForm.reset();
    elements.coachBroadcastStatus.hidden = false;
    elements.coachBroadcastStatus.textContent =
      result.sent_count > 0
        ? `Sent to ${result.sent_count} athlete${result.sent_count === 1 ? "" : "s"}.`
        : "No accepted athletes to send to yet.";
    showNotice(
      result.sent_count > 0
        ? `Broadcast sent to ${result.sent_count} athlete${result.sent_count === 1 ? "" : "s"}.`
        : "No accepted athletes to send to yet."
    );
  }
  finally {
    hideBusy();
  }
}

async function connectAthlete(event) {
  event.preventDefault();

  const athleteUserId =
    elements.connectAthleteId.value.trim();

  const displayName =
    elements.connectAthleteName.value.trim();

  const activityId =
    elements.connectAthleteActivity.value;

  const relationshipState =
    elements.connectAthleteRelationshipState
      ?.value === "invited"
      ? "invited"
      : "accepted";

  const expiryDate =
    elements.connectAthleteExpiry
      ?.value ?? "";

  showBusy(
    relationshipState === "invited"
      ? "Recording invitation…"
      : "Connecting athlete…"
  );

  try {
    const timestamp = nowIso();

    const expiresAt =
      relationshipState === "invited" &&
      expiryDate
        ? new Date(
            `${expiryDate}T23:59:59.999Z`
          ).toISOString()
        : null;

    await api(
      "POST",
      "/sessions/beta-coach-relationship",
      {
        relationship_id:
          createId("relationship"),
        coach_user_id:
          state.profile.coachUserId,
        athlete_user_id:
          athleteUserId,
        relationship_state:
          relationshipState,
        relationship_scope:
          "individual_coach_athlete",
        accepted_at_iso8601:
          relationshipState === "accepted"
            ? timestamp
            : null,
        created_at_iso8601:
          timestamp,
        updated_at_iso8601:
          timestamp,
        revoked_at_iso8601:
          null,
        expires_at_iso8601:
          expiresAt
      }
    );

    await refreshCoachAthletes({
      quiet: true
    });

    const directoryEntry =
      relationshipEntryByAthleteId(
        athleteUserId
      );

    if (
      directoryEntry &&
      directoryEntry.displayName ===
        athleteUserId &&
      displayName
    ) {
      directoryEntry.displayName =
        displayName;
    }

    if (
      directoryEntry &&
      !directoryEntry.activityId
    ) {
      directoryEntry.activityId =
        activityId;
    }

    const acceptedEntry =
      state.coachAthletes.find(
        (entry) =>
          entry.userId === athleteUserId
      );

    if (
      acceptedEntry &&
      acceptedEntry.displayName ===
        athleteUserId &&
      displayName
    ) {
      acceptedEntry.displayName =
        displayName;
    }

    if (
      acceptedEntry &&
      !acceptedEntry.activityId
    ) {
      acceptedEntry.activityId =
        activityId;
    }

    saveState();

    elements.connectAthleteForm.reset();
    syncConnectAthleteRelationshipForm();
    renderCoachWorkspace();
    renderCoachDashboard();

    showNotice(
      relationshipState === "invited"
        ? `Invitation for ${displayName} recorded.`
        : `${displayName} connected.`
    );
  }
  finally {
    hideBusy();
  }
}

function activeCoachTemplates(activityId = null) {
  return state.coachTemplates.filter((template) => {
    if (programmeDisplayState(template) !== "active") return false;
    return activityId === null || template.activity_id === activityId;
  });
}

function profileRecordToDraft(profile, athlete) {
  return {
    coach_user_id: state.profile?.coachUserId ?? "",
    athlete_user_id: athlete.userId,
    expected_current_record_sha256:
      typeof profile?.record_sha256 === "string"
        ? profile.record_sha256
        : null,
    preferred_weight_unit: profile?.preferred_weight_unit === "lb" ? "lb" : "kg",
    load_rounding_increment: Number(
      profile?.load_rounding_increment ??
      (profile?.preferred_weight_unit === "lb" ? 5 : 2.5)
    ),
    bodyweight: profile?.bodyweight === null || typeof profile?.bodyweight === "undefined"
      ? ""
      : Number(profile.bodyweight),
    bodyweight_unit: profile?.bodyweight_unit === "lb" ? "lb" : "kg",
    strength_reference_lifecycle:
      profile?.strength_reference_lifecycle ??
      null,
    benchmarks: Array.isArray(profile?.benchmarks)
      ? profile.benchmarks.map((benchmark) => ({
          benchmark_id: String(benchmark.benchmark_id ?? ""),
          exercise_id: String(benchmark.exercise_id ?? ""),
          value: Number(benchmark.value ?? 0),
          unit: benchmark.unit === "lb" ? "lb" : "kg",
          basis: ["tested_1rm", "estimated_1rm", "training_max"].includes(benchmark.basis)
            ? benchmark.basis
            : "tested_1rm",
          effective_date: String(benchmark.effective_date ?? new Date().toISOString().slice(0, 10)),
          source_note: String(benchmark.source_note ?? ""),
          replaces_reference_id:
            String(
              benchmark.replaces_reference_id ??
              ""
            ),
          persisted: true
        }))
      : []
  };
}

function profileForAthlete(athleteUserId) {
  const profile = state.athleteProfiles?.[athleteUserId];
  return profile && typeof profile === "object" ? profile : null;
}

function currentProfileBenchmarks(
  profile,
  asOfDate =
    new Date()
      .toISOString()
      .slice(0, 10)
) {
  const authoritativeCurrent =
    Array.isArray(
      profile
        ?.strength_reference_lifecycle
        ?.current
    )
      ? profile
          .strength_reference_lifecycle
          .current
      : null;

  if (authoritativeCurrent) {
    return new Map(
      authoritativeCurrent.map(
        (reference) => [
          String(
            reference.exercise_id ??
            ""
          ),
          {
            benchmark_id:
              reference.reference_id,
            exercise_id:
              reference.exercise_id,
            value:
              reference.source_value,
            unit:
              reference.source_unit,
            basis:
              reference.source_type,
            effective_date:
              reference.effective_date,
            source_note:
              reference.source_note ??
              "",
            replaces_reference_id:
              reference
                .replaces_reference_id ??
              ""
          }
        ]
      )
    );
  }

  const current =
    new Map();

  const benchmarks =
    Array.isArray(
      profile?.benchmarks
    )
      ? profile.benchmarks
      : [];

  for (
    const benchmark of benchmarks
  ) {
    const exerciseId =
      String(
        benchmark
          ?.exercise_id ??
        ""
      );

    const effectiveDate =
      String(
        benchmark
          ?.effective_date ??
        ""
      );

    if (
      !exerciseId ||
      !effectiveDate ||
      effectiveDate > asOfDate
    ) {
      continue;
    }

    const existing =
      current.get(
        exerciseId
      );

    const candidateKey =
      `${effectiveDate}::${String(
        benchmark
          ?.benchmark_id ??
        ""
      )}`;

    const existingKey =
      existing
        ? `${String(
            existing.effective_date ??
            ""
          )}::${String(
            existing.benchmark_id ??
            ""
          )}`
        : "";

    if (
      !existing ||
      candidateKey > existingKey
    ) {
      current.set(
        exerciseId,
        benchmark
      );
    }
  }

  return current;
}

function convertedStrengthValue(
  value,
  sourceUnit,
  displayUnit
) {
  const numeric =
    Number(value);

  if (
    !Number.isFinite(numeric)
  ) {
    return null;
  }

  if (
    sourceUnit === displayUnit
  ) {
    return Number(
      numeric.toFixed(3)
    );
  }

  const converted =
    sourceUnit === "kg"
      ? numeric *
        2.2046226218487757
      : numeric /
        2.2046226218487757;

  return Number(
    converted.toFixed(3)
  );
}

function strengthSourceLabel(
  sourceType
) {
  if (
    sourceType ===
    "estimated_1rm"
  ) {
    return "Estimated 1RM";
  }

  if (
    sourceType ===
    "training_max"
  ) {
    return "Training max";
  }

  return "Tested 1RM";
}

function strengthReferenceStatus(
  benchmark,
  benchmarks,
  asOfDate =
    new Date()
      .toISOString()
      .slice(0, 10)
) {
  if (
    String(
      benchmark
        ?.effective_date ??
      ""
    ) > asOfDate
  ) {
    return "Scheduled";
  }

  const current =
    currentProfileBenchmarks({
      benchmarks
    }, asOfDate);

  return String(
    current
      .get(
        String(
          benchmark
            ?.exercise_id ??
          ""
        )
      )
      ?.benchmark_id ??
    ""
  ) ===
  String(
    benchmark
      ?.benchmark_id ??
    ""
  )
    ? "Current"
    : "Superseded";
}

function formatStrengthReferenceSummary(
  benchmark,
  displayUnit
) {
  const sourceValue =
    Number(
      benchmark?.value ??
      benchmark?.source_value ??
      0
    );

  const sourceUnit =
    benchmark?.unit === "lb" ||
    benchmark?.source_unit === "lb"
      ? "lb"
      : "kg";

  const targetUnit =
    displayUnit === "lb"
      ? "lb"
      : "kg";

  const converted =
    convertedStrengthValue(
      sourceValue,
      sourceUnit,
      targetUnit
    );

  const conversionText =
    sourceUnit === targetUnit
      ? ""
      : ` · ${converted} ${targetUnit}`;

  const sourceNote =
    String(
      benchmark?.source_note ??
      ""
    ).trim();

  return [
    strengthSourceLabel(
      benchmark?.basis ??
      benchmark?.source_type
    ),
    `${sourceValue} ${sourceUnit}${conversionText}`,
    `Effective ${String(
      benchmark?.effective_date ??
      ""
    )}`,
    sourceNote
      ? `Source: ${sourceNote}`
      : ""
  ]
    .filter(Boolean)
    .join(" · ");
}

function benchmarkExerciseOptions(selectedExerciseId = "") {
  return state.templateExercises
    .map((exercise) => `
      <option value="${escapeHtml(exercise.exercise_id)}" ${exercise.exercise_id === selectedExerciseId ? "selected" : ""}>
        ${escapeHtml(exercise.display_name)}
      </option>
    `)
    .join("");
}

function newAthleteBenchmark() {
  const exercise = state.templateExercises[0] ?? null;
  const preferredUnit = state.athleteProfileDraft?.preferred_weight_unit === "lb" ? "lb" : "kg";

  return {
    benchmark_id: "",
    exercise_id: exercise?.exercise_id ?? "",
    value: preferredUnit === "lb" ? 225 : 100,
    unit: preferredUnit,
    basis: "tested_1rm",
    effective_date: new Date().toISOString().slice(0, 10),
    source_note: "",
    replaces_reference_id: "",
    persisted: false
  };
}

function renderAthleteProfileEditor() {
  const athlete = state.coachAthletes.find(
    (entry) => entry.userId === state.selectedCoachAthleteId
  );
  const draft = state.athleteProfileDraft;

  if (!athlete || !draft) {
    elements.athleteProfilePanel.hidden = true;
    return;
  }

  elements.athleteProfilePanel.hidden = false;
  elements.athleteProfileHeading.textContent = athlete.displayName;
  elements.athleteProfileActivity.textContent = `${titleCase(athlete.activityId)} · ${athlete.userId}`;
  elements.athletePreferredUnit.value = draft.preferred_weight_unit;
  elements.athleteRoundingIncrement.value = String(draft.load_rounding_increment);
  elements.athleteBodyweight.value = draft.bodyweight === "" ? "" : String(draft.bodyweight);
  elements.athleteBodyweightUnit.value = draft.bodyweight_unit;

  elements.athleteBenchmarkList.innerHTML = draft.benchmarks.length
    ? draft.benchmarks.map((benchmark, index) => `
        <article class="benchmark-row" data-benchmark-index="${index}">
          <label class="field benchmark-exercise-field">
            <span>Exercise</span>
            <select data-profile-field="exercise_id" ${benchmark.persisted ? "disabled" : ""}>${benchmarkExerciseOptions(benchmark.exercise_id)}</select>
          </label>
          <label class="field benchmark-value-field">
            <span>Reference load</span>
            <input data-profile-field="value" type="number" min="0.25" max="1500" step="0.25" value="${Number(benchmark.value)}" ${benchmark.persisted ? "disabled" : ""} />
          </label>
          <label class="field benchmark-unit-field">
            <span>Unit</span>
            <select data-profile-field="unit" ${benchmark.persisted ? "disabled" : ""}>
              <option value="kg" ${benchmark.unit === "lb" ? "" : "selected"}>kg</option>
              <option value="lb" ${benchmark.unit === "lb" ? "selected" : ""}>lb</option>
            </select>
          </label>
          <label class="field benchmark-basis-field">
            <span>Record type</span>
            <select data-profile-field="basis" ${benchmark.persisted ? "disabled" : ""}>
              <option value="tested_1rm" ${benchmark.basis === "tested_1rm" ? "selected" : ""}>Tested 1RM</option>
              <option value="estimated_1rm" ${benchmark.basis === "estimated_1rm" ? "selected" : ""}>Estimated 1RM</option>
              <option value="training_max" ${benchmark.basis === "training_max" ? "selected" : ""}>Training max</option>
            </select>
          </label>
          <label class="field benchmark-date-field">
            <span>Effective date</span>
            <input data-profile-field="effective_date" type="date" value="${escapeHtml(benchmark.effective_date)}" ${benchmark.persisted ? "disabled" : ""} />
          </label>
          <label class="field benchmark-note-field">
            <span>Source note</span>
            <input data-profile-field="source_note" maxlength="240" value="${escapeHtml(benchmark.source_note)}" placeholder="Optional factual source" ${benchmark.persisted ? "disabled" : ""} />
          </label>
          <p class="muted small">
            ${escapeHtml(
              formatStrengthReferenceSummary(
                benchmark,
                draft.preferred_weight_unit
              )
            )}
          </p>
          <span class="badge neutral">
            ${escapeHtml(
              strengthReferenceStatus(
                benchmark,
                draft.benchmarks
              )
            )}
          </span>
          <button
            class="button danger small-button remove-athlete-benchmark"
            type="button"
            data-benchmark-index="${index}"
            ${benchmark.persisted ? "disabled" : ""}
          >
            ${benchmark.persisted ? "Immutable record" : "Remove"}
          </button>
        </article>
      `).join("")
    : `
      <div class="empty-state compact-empty">
        <h3>No strength references recorded</h3>
        <p>Add a tested 1RM, estimated 1RM, or training max for percentage-based exercises.</p>
      </div>
    `;

  const currentCount = currentProfileBenchmarks(draft).size;
  elements.athleteProfileStatus.textContent = `${draft.benchmarks.length} record${draft.benchmarks.length === 1 ? "" : "s"} · ${currentCount} current exercise reference${currentCount === 1 ? "" : "s"}`;
  renderAthleteProfileAssignment();
  renderAthleteDetail();
  elements.athleteProfilePanel.scrollIntoView({ behavior: "smooth", block: "start" });
}

function syncAthleteProfileHeader() {
  if (!state.athleteProfileDraft) return;

  state.athleteProfileDraft.preferred_weight_unit = elements.athletePreferredUnit.value;
  state.athleteProfileDraft.load_rounding_increment = Number(elements.athleteRoundingIncrement.value);
  state.athleteProfileDraft.bodyweight = elements.athleteBodyweight.value === ""
    ? ""
    : Number(elements.athleteBodyweight.value);
  state.athleteProfileDraft.bodyweight_unit = elements.athleteBodyweightUnit.value;
  saveState();
}

function updateAthleteBenchmarkControl(control) {
  const row = control.closest("[data-benchmark-index]");
  const index = Number(row?.dataset.benchmarkIndex);
  const field = control.dataset.profileField;
  const benchmark = state.athleteProfileDraft?.benchmarks?.[index];
  if (!benchmark || !field || benchmark.persisted) return;

  benchmark[field] = control.type === "number" ? Number(control.value) : control.value;
  saveState();
}

async function loadAthleteProfile(athleteUserId, options = {}) {
  const athlete = state.coachAthletes.find((entry) => entry.userId === athleteUserId);
  if (!athlete) throw new Error("Select a connected athlete.");

  if (!options.quiet) showBusy("Loading athlete profile…");

  try {
    const response = await api(
      "GET",
      `/coach-workspace/athlete-strength-profile?coach_user_id=${encodeURIComponent(state.profile.coachUserId)}&athlete_user_id=${encodeURIComponent(athleteUserId)}`
    );

    if (response.profile) {
      state.athleteProfiles[athleteUserId] = response.profile;
    }
    else {
      delete state.athleteProfiles[athleteUserId];
    }

    saveState();
    return response.profile ?? null;
  }
  finally {
    if (!options.quiet) hideBusy();
  }
}

// FULL-UI-04B factual athlete detail and history.
// Records are server-authoritative and read-only except for explicit,
// non-binding coach-note creation.

function athleteDetailFor(
  athleteUserId
) {
  const detail =
    state.athleteDetails?.[
      athleteUserId
    ];

  return (
    detail &&
    typeof detail === "object"
  )
    ? detail
    : null;
}

function athleteDetailEmpty(
  heading,
  detail
) {
  return `
    <div class="empty-state compact-empty">
      <h4>${escapeHtml(heading)}</h4>
      <p>${escapeHtml(detail)}</p>
    </div>
  `;
}

function athleteDetailTemplate(
  assignment
) {
  const templateId =
    String(
      assignment?.template_id ??
      ""
    );

  return state.coachTemplates.find(
    (template) =>
      String(
        template.template_id ??
        ""
      ) === templateId
  ) ?? null;
}

function athleteDetailEvent(
  eventLink
) {
  const eventId =
    String(
      eventLink?.event_id ??
      ""
    );

  return state.coachEvents.find(
    (eventRecord) =>
      String(
        eventRecord.event_id ??
        ""
      ) === eventId
  ) ?? null;
}

function athleteDetailRecordDate(
  record
) {
  return String(
    record?.updated_at_iso8601 ??
    record?.requested_at_iso8601 ??
    record?.created_at_iso8601 ??
    record?.stored_effective_at ??
    record?.updated_at ??
    record?.created_at ??
    ""
  );
}

function bindAthleteDetailActions() {
  for (
    const button of
    elements.athleteDetailHistoryPanel
      ?.querySelectorAll(
        "[data-athlete-detail-action]"
      ) ?? []
  ) {
    button.addEventListener(
      "click",
      async () => {
        const action =
          button.dataset
            .athleteDetailAction;

        if (action === "programme") {
          const templateId =
            button.dataset.templateId ??
            "";

          if (templateId) {
            location.hash =
              `#/coach/programmes/${encodeURIComponent(
                templateId
              )}`;
          }

          setView("templates");
          return;
        }

        if (action === "event") {
          const eventId =
            button.dataset.eventId ??
            "";

          if (eventId) {
            location.hash =
              `#/coach/events/${encodeURIComponent(
                eventId
              )}`;
          }

          setView("events");
          return;
        }

        if (action === "review") {
          const athleteUserId =
            state.selectedCoachAthleteId;

          setView("review");
          renderCoachSelectors();

          elements.reviewAthlete.value =
            athleteUserId;

          await loadCoachReview();
          return;
        }

        if (action === "note") {
          elements
            .athleteDetailNoteSessionId
            .value =
              button.dataset.sessionId ??
              "";

          elements
            .athleteDetailNoteArtefactId
            .value =
              button.dataset.artefactId ??
              "";

          elements.athleteDetailNoteText
            .value = "";

          elements.athleteDetailNoteForm
            .hidden = false;

          elements.athleteDetailNoteText
            .focus();
        }
      }
    );
  }
}

function renderAthleteDetail() {
  const athleteUserId =
    state.selectedCoachAthleteId;

  const athlete =
    state.coachAthletes.find(
      (entry) =>
        entry.userId === athleteUserId
    );

  const detail =
    athleteDetailFor(
      athleteUserId
    );

  if (
    !athlete ||
    !detail ||
    !elements.athleteDetailHistoryPanel
  ) {
    if (
      elements.athleteDetailHistoryPanel
    ) {
      elements
        .athleteDetailHistoryPanel
        .hidden = true;
    }

    return;
  }

  elements.athleteDetailHistoryPanel
    .hidden = false;

  const assignments =
    Array.isArray(
      detail.assignment_history
    )
      ? detail.assignment_history
      : [];

  const strengthProfiles =
    Array.isArray(
      detail.strength_profile_history
    )
      ? detail.strength_profile_history
      : [];

  const bodyweights =
    Array.isArray(
      detail.bodyweight_history
    )
      ? detail.bodyweight_history
      : [];

  const eventLinks =
    Array.isArray(
      detail.event_link_history
    )
      ? detail.event_link_history
      : [];

  const sessions =
    Array.isArray(
      detail.session_history
    )
      ? detail.session_history
      : [];

  const notes =
    Array.isArray(
      detail.note_history
    )
      ? detail.note_history
      : [];

  elements.athleteDetailAssignmentCount
    .textContent =
      String(assignments.length);

  elements.athleteDetailStrengthCount
    .textContent =
      String(strengthProfiles.length);

  elements.athleteDetailBodyweightCount
    .textContent =
      String(bodyweights.length);

  elements.athleteDetailEventCount
    .textContent =
      String(eventLinks.length);

  elements.athleteDetailSessionCount
    .textContent =
      String(sessions.length);

  elements.athleteDetailNoteCount
    .textContent =
      String(notes.length);

  const currentAssignment =
    detail.current_assignment &&
    typeof detail.current_assignment ===
      "object"
      ? detail.current_assignment
      : null;

  const currentTemplate =
    athleteDetailTemplate(
      currentAssignment
    );

  elements.athleteDetailCurrentProgramme
    .innerHTML =
      currentAssignment
        ? `
          <article class="record-card">
            <div>
              <h4>${escapeHtml(
                currentTemplate?.template_name ??
                currentAssignment.template_id ??
                "Programme"
              )}</h4>
              <p>
                Version ${Number(
                  currentAssignment.template_version ??
                  currentTemplate?.template_version ??
                  0
                )}
                ·
                ${escapeHtml(
                  formatDate(
                    athleteDetailRecordDate(
                      currentAssignment
                    )
                  )
                )}
              </p>
            </div>

            <button
              class="button secondary small-button"
              type="button"
              data-athlete-detail-action="programme"
              data-template-id="${escapeHtml(
                currentAssignment.template_id ??
                ""
              )}"
            >
              Open programme
            </button>
          </article>
        `
        : athleteDetailEmpty(
            "No programme assignment",
            "No persisted programme assignment exists for this athlete."
          );

  const currentEventLink =
    detail.current_event_link &&
    typeof detail.current_event_link ===
      "object"
      ? detail.current_event_link
      : null;

  const currentEvent =
    athleteDetailEvent(
      currentEventLink
    );

  const currentEventPlan =
    currentEvent
      ? coachEventPlan(currentEvent)
      : null;

  elements.athleteDetailCurrentEvent
    .innerHTML =
      currentEventLink
        ? `
          <article class="record-card">
            <div>
              <h4>${escapeHtml(
                currentEventPlan?.event_name ??
                currentEventLink.event_id ??
                "Event"
              )}</h4>
              <p>
                ${escapeHtml(
                  currentEventPlan?.event_date
                    ? formatDate(
                        currentEventPlan.event_date
                      )
                    : "Date not available"
                )}
                ${
                  currentEventPlan?.event_date
                    ? ` · ${escapeHtml(
                        countdownLabel(
                          currentEventPlan
                            .event_date
                        )
                      )}`
                    : ""
                }
              </p>
            </div>

            <button
              class="button secondary small-button"
              type="button"
              data-athlete-detail-action="event"
              data-event-id="${escapeHtml(
                currentEventLink.event_id ??
                ""
              )}"
            >
              Open event
            </button>
          </article>
        `
        : athleteDetailEmpty(
            "No event link",
            "The current assignment is not linked to a persisted event."
          );

  elements.athleteDetailAssignmentHistory
    .innerHTML =
      assignments.length
        ? assignments
            .map((assignment) => {
              const template =
                athleteDetailTemplate(
                  assignment
                );

              return `
                <article class="record-card">
                  <div>
                    <h4>${escapeHtml(
                      template?.template_name ??
                      assignment.template_id ??
                      "Programme"
                    )}</h4>
                    <p>
                      ${escapeHtml(
                        titleCase(
                          assignment.activity_id ??
                          athlete.activityId
                        )
                      )}
                      ·
                      ${escapeHtml(
                        formatDate(
                          athleteDetailRecordDate(
                            assignment
                          )
                        )
                      )}
                    </p>
                  </div>

                  <div class="record-meta">
                    <span class="badge neutral">
                      Version ${Number(
                        assignment.template_version ??
                        template?.template_version ??
                        0
                      )}
                    </span>

                    <button
                      class="button secondary small-button"
                      type="button"
                      data-athlete-detail-action="programme"
                      data-template-id="${escapeHtml(
                        assignment.template_id ??
                        ""
                      )}"
                    >
                      Open
                    </button>
                  </div>
                </article>
              `;
            })
            .join("")
        : athleteDetailEmpty(
            "No assignment history",
            "Programme assignments will appear here after they are recorded."
          );

  elements.athleteDetailStrengthHistory
    .innerHTML =
      strengthProfiles.length
        ? strengthProfiles
            .map((profile) => {
              const benchmarks =
                Array.isArray(
                  profile.benchmarks
                )
                  ? profile.benchmarks
                  : [];

              const benchmarkText =
                benchmarks.length
                  ? benchmarks
                      .map(
                        (benchmark) =>
                          `${exerciseDisplayName(
                            benchmark.exercise_id
                          )}: ${formatStrengthReferenceSummary(
                            benchmark,
                            profile.preferred_weight_unit
                          )}`
                      )
                      .join(" · ")
                  : "No strength references";

              return `
                <article class="record-card">
                  <div>
                    <h4>
                      ${benchmarks.length}
                      strength reference${
                        benchmarks.length === 1
                          ? ""
                          : "s"
                      }
                    </h4>

                    <p>${escapeHtml(
                      benchmarkText
                    )}</p>
                  </div>

                  <span class="badge neutral">
                    ${escapeHtml(
                      formatDate(
                        athleteDetailRecordDate(
                          profile
                        )
                      )
                    )}
                  </span>
                </article>
              `;
            })
            .join("")
        : athleteDetailEmpty(
            "No strength history",
            "Saved strength-reference profiles will appear here."
          );

  elements.athleteDetailBodyweightHistory
    .innerHTML =
      bodyweights.length
        ? bodyweights
            .map(
              (record) => `
                <article class="record-card">
                  <div>
                    <h4>
                      ${Number(
                        record.bodyweight
                      )}
                      ${escapeHtml(
                        record.unit ?? ""
                      )}
                    </h4>

                    <p>Factual recorded bodyweight</p>
                  </div>

                  <span class="badge neutral">
                    ${escapeHtml(
                      formatDate(
                        record.effective_at
                      )
                    )}
                  </span>
                </article>
              `
            )
            .join("")
        : athleteDetailEmpty(
            "No bodyweight history",
            "Saved bodyweight records will appear here."
          );

  elements.athleteDetailEventHistory
    .innerHTML =
      eventLinks.length
        ? eventLinks
            .map((link) => {
              const linkedEvent =
                athleteDetailEvent(link);

              const linkedEventPlan =
                linkedEvent
                  ? coachEventPlan(linkedEvent)
                  : null;

              return `
                <article class="record-card">
                  <div>
                    <h4>${escapeHtml(
                      linkedEventPlan?.event_name ??
                      link.event_id ??
                      "Event"
                    )}</h4>
                    <p>
                      ${escapeHtml(
                        titleCase(
                          link.lifecycle_action ??
                          link.link_state
                        )
                      )}
                      ${
                        link.unlink_reason
                          ? ` · ${escapeHtml(titleCase(link.unlink_reason))}`
                          : ""
                      }
                      ·
                      ${escapeHtml(
                        formatDate(
                          athleteDetailRecordDate(
                            link
                          )
                        )
                      )}
                    </p>
                  </div>

                  <span class="badge neutral">
                    ${escapeHtml(
                      titleCase(
                        link.link_state
                      )
                    )}
                  </span>
                </article>
              `;
            })
            .join("")
        : athleteDetailEmpty(
            "No event-link history",
            "Event links will appear here after this athlete is linked to a persisted event."
          );

  elements.athleteDetailSessionHistory
    .innerHTML =
      sessions.length
        ? sessions
            .map(
              (session) => `
                <article class="record-card">
                  <div>
                    <h4>Training session</h4>
                    <p>
                      ${escapeHtml(
                        formatDate(
                          session.updated_at
                        )
                      )}
                      ·
                      ${Number(
                        session.runtime_event_count ??
                        0
                      )}
                      recorded events
                    </p>
                    ${
                      Array.isArray(session.skip_reasons) && session.skip_reasons.length
                        ? `<p class="muted small">Skipped: ${session.skip_reasons.map((reason) => escapeHtml(titleCase(reason))).join(", ")}</p>`
                        : ""
                    }
                    ${
                      Array.isArray(session.substitutions) && session.substitutions.length
                        ? `<p class="muted small">Substituted: ${session.substitutions.map((entry) => `${escapeHtml(titleCase(entry.exercise_id))} → ${escapeHtml(titleCase(entry.substituted_exercise_id))}`).join(", ")}</p>`
                        : ""
                    }
                    ${
                      Array.isArray(session.rpe_reports) && session.rpe_reports.length
                        ? `<p class="muted small">RPE: ${session.rpe_reports.map((entry) => `${escapeHtml(titleCase(entry.exercise_id))} ${Number(entry.rpe_value)}`).join(", ")}</p>`
                        : ""
                    }
                    ${
                      session.split_return_decision
                        ? `<p class="muted small">Return decision: ${escapeHtml(titleCase(session.split_return_decision))}</p>`
                        : ""
                    }
                  </div>

                  <div class="record-meta">
                    <span class="badge neutral">
                      ${escapeHtml(
                        titleCase(
                          session.session_status ??
                          "recorded"
                        )
                      )}
                    </span>

                    ${session.pain_reported ? `<span class="badge partial">Pain reported</span>` : ""}
                    ${session.split_entered ? `<span class="badge partial">Split session</span>` : ""}

                    <button
                      class="button secondary small-button"
                      type="button"
                      data-athlete-detail-action="review"
                    >
                      Review
                    </button>

                    <button
                      class="button secondary small-button"
                      type="button"
                      data-athlete-detail-action="note"
                      data-session-id="${escapeHtml(
                        session.session_id ??
                        ""
                      )}"
                      data-artefact-id="${escapeHtml(
                        session.artefact_id ??
                        ""
                      )}"
                    >
                      Add note
                    </button>
                  </div>
                </article>
              `
            )
            .join("")
        : athleteDetailEmpty(
            "No session history",
            "Coach-managed session records will appear here after execution begins."
          );

  elements.athleteDetailNoteHistory
    .innerHTML =
      notes.length
        ? notes
            .map(
              (note) => `
                <article class="record-card">
                  <div>
                    <h4>
                      ${escapeHtml(
                        note.visibility ===
                          "athlete_visible"
                          ? "Athlete-visible note"
                          : "Coach-only note"
                      )}
                    </h4>

                    <p>${escapeHtml(
                      note.note_text ??
                      ""
                    )}</p>

                    <p class="muted small">
                      Session:
                      ${escapeHtml(
                        note.session_id ??
                        ""
                      )}
                    </p>
                  </div>

                  <span class="badge neutral">
                    ${escapeHtml(
                      formatDate(
                        note.created_at
                      )
                    )}
                  </span>
                </article>
              `
            )
            .join("")
        : athleteDetailEmpty(
            "No coach notes",
            "Non-binding notes recorded against sessions will appear here."
          );

  elements.athleteDetailStatus
    .textContent =
      `Loaded ${assignments.length} assignment, ${sessions.length} session and ${notes.length} note record${notes.length === 1 ? "" : "s"} for ${athlete.displayName}.`;

  bindAthleteDetailActions();
}

async function refreshAthleteDetail(
  athleteUserId,
  options = {}
) {
  if (
    !athleteUserId ||
    !state.profile?.coachUserId
  ) {
    return null;
  }

  if (!options.quiet) {
    showBusy(
      "Loading athlete detail…"
    );
  }

  if (
    elements.athleteDetailStatus
  ) {
    elements.athleteDetailStatus
      .textContent =
        "Loading persisted athlete records…";
  }

  try {
    const response =
      await api(
        "GET",
        `/coach-workspace/athlete-detail?coach_user_id=${encodeURIComponent(
          state.profile.coachUserId
        )}&athlete_user_id=${encodeURIComponent(
          athleteUserId
        )}`
      );

    state.athleteDetails ??= {};
    state.athleteDetails[
      athleteUserId
    ] = response.detail ?? null;

    saveState();
    renderAthleteDetail();

    if (!options.quiet) {
      showNotice(
        "Athlete detail refreshed."
      );
    }

    return response.detail ?? null;
  }
  catch (error) {
    if (
      elements.athleteDetailStatus
    ) {
      elements.athleteDetailStatus
        .textContent =
          "Athlete detail could not be loaded.";
    }

    throw error;
  }
  finally {
    if (!options.quiet) {
      hideBusy();
    }
  }
}

async function recordAthleteDetailNote(
  event
) {
  event.preventDefault();

  const athleteUserId =
    state.selectedCoachAthleteId;

  const athlete =
    state.coachAthletes.find(
      (entry) =>
        entry.userId === athleteUserId
    );

  if (!athlete?.relationship) {
    throw new Error(
      "Open an accepted athlete first."
    );
  }

  const noteText =
    elements.athleteDetailNoteText
      .value.trim();

  if (!noteText) {
    throw new Error(
      "Enter a coach note."
    );
  }

  showBusy("Recording note…");

  try {
    await api(
      "POST",
      "/sessions/beta-coach-notes",
      {
        coach_profile:
          state.coachProfile,
        relationship:
          athlete.relationship,
        athlete_user_id:
          athleteUserId,
        session_id:
          elements
            .athleteDetailNoteSessionId
            .value,
        artefact_id:
          elements
            .athleteDetailNoteArtefactId
            .value,
        note_text: noteText,
        visibility:
          elements
            .athleteDetailNoteVisibility
            .value
      }
    );

    elements.athleteDetailNoteForm
      .hidden = true;

    await refreshAthleteDetail(
      athleteUserId,
      {
        quiet: true
      }
    );

    showNotice(
      "Non-binding coach note recorded."
    );
  }
  finally {
    hideBusy();
  }
}

const ATTACHMENT_MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const ATTACHMENT_MAX_VIDEO_BYTES = 50 * 1024 * 1024;
const ATTACHMENT_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const ATTACHMENT_VIDEO_TYPES = ["video/mp4", "video/quicktime"];

// Fast feedback only - never the actual security boundary, which is the
// server's own content-sniffed validation (message_attachment_storage.ts).
function validateAttachmentClientSide(file) {
  if (!file) return null;
  const isImage = ATTACHMENT_IMAGE_TYPES.includes(file.type);
  const isVideo = ATTACHMENT_VIDEO_TYPES.includes(file.type);
  if (!isImage && !isVideo) {
    return "That file type isn't supported. Use a JPEG/PNG/WEBP photo or an MP4/MOV video.";
  }
  const maxBytes = isImage ? ATTACHMENT_MAX_IMAGE_BYTES : ATTACHMENT_MAX_VIDEO_BYTES;
  if (file.size > maxBytes) {
    return isImage ? "Photos must be 10MB or smaller." : "Videos must be 50MB or smaller.";
  }
  return null;
}

// api() (above) always JSON.stringify's the body - it can't send
// multipart/form-data. This is the one send path that needs a raw fetch
// instead, mirroring api()'s own CSRF/credentials handling by hand.
async function sendMessageRequest(path, bodyText, attachmentFile) {
  if (!attachmentFile) {
    return api("POST", path, { body_text: bodyText, client_request_id: newClientRequestId() });
  }

  const formData = new FormData();
  formData.append("body_text", bodyText);
  formData.append("client_request_id", newClientRequestId());
  formData.append("attachment", attachmentFile);

  const response = await fetch(path, {
    method: "POST",
    credentials: "same-origin",
    headers: { "x-kolosseum-csrf": String(state.csrfToken ?? "") },
    body: formData
  });

  const payload = await readJson(response);
  if (!response.ok) {
    const error = new Error(friendlyError(payload, response.status));
    error.payload = payload;
    error.status = response.status;
    error.requestMethod = "POST";
    error.requestPath = path;
    throw error;
  }
  return payload;
}

function formatAttachmentSize(bytes) {
  if (typeof bytes !== "number" || !Number.isFinite(bytes) || bytes <= 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function renderMessageAttachment(attachment) {
  if (!attachment) return "";
  const sizeLabel = formatAttachmentSize(attachment.byte_size);
  const sizeCaption = sizeLabel ? `<p class="message-attachment-size muted">${escapeHtml(sizeLabel)}</p>` : "";
  if (attachment.media_type === "image") {
    return `<img class="message-attachment-image" src="${escapeHtml(attachment.url)}" alt="Attached photo" loading="lazy">${sizeCaption}`;
  }
  return `
    <video class="message-attachment-video" controls preload="metadata"
      ${attachment.thumbnail_url ? `poster="${escapeHtml(attachment.thumbnail_url)}"` : ""}>
      <source src="${escapeHtml(attachment.url)}">
    </video>
    ${sizeCaption}
  `;
}

const PROGRESS_PHOTO_MAX_BYTES = 10 * 1024 * 1024;
const PROGRESS_PHOTO_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

function validateProgressPhotoClientSide(file) {
  if (!file) return "Choose a photo to upload.";
  if (!PROGRESS_PHOTO_IMAGE_TYPES.includes(file.type)) {
    return "That file type isn't supported. Use a JPEG/PNG/WEBP photo.";
  }
  if (file.size > PROGRESS_PHOTO_MAX_BYTES) {
    return "Photos must be 10MB or smaller.";
  }
  return null;
}

function renderProgressPhotoCard(photo) {
  const caption = photo.caption ? `<p>${escapeHtml(photo.caption)}</p>` : "";
  const sizeLabel = formatAttachmentSize(photo.byte_size);
  const sizeCaption = sizeLabel ? `<span class="muted small">${escapeHtml(sizeLabel)}</span>` : "";
  return `
    <article class="progress-photo-card">
      <img src="${escapeHtml(photo.url)}" alt="Progress photo" loading="lazy">
      <span class="muted small">${escapeHtml(formatDate(photo.taken_at_iso8601))}</span>
      ${sizeCaption}
      ${caption}
    </article>
  `;
}

function renderProgressPhotos() {
  if (!elements.progressPhotoGrid) return;

  const photos = Array.isArray(state.progressPhotos) ? state.progressPhotos : [];

  if (photos.length === 0) {
    elements.progressPhotoGrid.innerHTML = `
      <div class="empty-state compact-empty">
        <p>No progress photos yet.</p>
      </div>
    `;
    return;
  }

  elements.progressPhotoGrid.innerHTML = photos.map(renderProgressPhotoCard).join("");
}

async function refreshProgressPhotos(options = {}) {
  if (state.role !== "athlete") return;

  try {
    const response = await api("GET", "/progress-photos");
    state.progressPhotos = Array.isArray(response.photos) ? response.photos : [];
    renderProgressPhotos();
  }
  catch (error) {
    if (!options.quiet) throw error;
  }
}

async function uploadProgressPhoto() {
  const file = elements.progressPhotoFileInput?.files?.[0];
  const validationError = validateProgressPhotoClientSide(file);
  if (validationError) {
    elements.progressPhotoStatus.hidden = false;
    elements.progressPhotoStatus.textContent = validationError;
    return;
  }

  const formData = new FormData();
  formData.append("photo", file);
  if (elements.progressPhotoTakenAt?.value) {
    formData.append("taken_at_iso8601", new Date(elements.progressPhotoTakenAt.value).toISOString());
  }
  if (elements.progressPhotoCaption?.value) {
    formData.append("caption", elements.progressPhotoCaption.value);
  }

  showBusy("Uploading photo…");
  try {
    const response = await fetch("/progress-photos", {
      method: "POST",
      credentials: "same-origin",
      headers: { "x-kolosseum-csrf": String(state.csrfToken ?? "") },
      body: formData
    });
    const payload = await readJson(response);
    if (!response.ok) {
      const error = new Error(friendlyError(payload, response.status));
      error.payload = payload;
      error.status = response.status;
      throw error;
    }

    elements.progressPhotoUploadForm.reset();
    elements.progressPhotoStatus.hidden = true;
    await refreshProgressPhotos({ quiet: true });
    showNotice("Progress photo uploaded.");
  }
  catch (error) {
    elements.progressPhotoStatus.hidden = false;
    elements.progressPhotoStatus.textContent = friendlyError(error.payload, error.status) || "Photo could not be uploaded.";
  }
  finally {
    hideBusy();
  }
}

// Read-only coach view of an athlete's own progress photos - mirrors
// refreshCoachAthleteOrgMessages's shape. No coach-facing upload/delete
// route exists anywhere in this file.
async function refreshCoachAthleteProgressPhotos(athleteUserId, options = {}) {
  if (!athleteUserId || !elements.athleteDetailProgressPhotos) return;

  try {
    const response = await api("GET", `/progress-photos/coach/${encodeURIComponent(athleteUserId)}`);
    state.coachAthleteProgressPhotos = Array.isArray(response.photos) ? response.photos : [];
    renderCoachAthleteProgressPhotos();
  }
  catch (error) {
    if (!options.quiet) throw error;
  }
}

function renderCoachAthleteProgressPhotos() {
  if (!elements.athleteDetailProgressPhotos) return;

  const photos = Array.isArray(state.coachAthleteProgressPhotos) ? state.coachAthleteProgressPhotos : [];

  if (photos.length === 0) {
    elements.athleteDetailProgressPhotos.innerHTML = `
      <div class="empty-state compact-empty">
        <p>No progress photos yet.</p>
      </div>
    `;
    return;
  }

  elements.athleteDetailProgressPhotos.innerHTML = photos.map(renderProgressPhotoCard).join("");
}

const BODY_METRIC_TYPE_LABELS = {
  waist_circumference_cm: "Waist",
  chest_circumference_cm: "Chest",
  arm_circumference_cm: "Arm",
  thigh_circumference_cm: "Thigh",
  hip_circumference_cm: "Hip",
  body_fat_percentage: "Body fat",
  body_weight_kg: "Body weight",
  calories_kcal: "Calories",
  protein_g: "Protein",
  carbs_g: "Carbs",
  fat_g: "Fat"
};

// Nutrition entries are body_metric_entry records under the same open
// metric-type registry (see bodyMetricsAndHabitsLifecycle.mjs) - kept out
// of the generic "Body measurements" panel/list and given their own
// dedicated Nutrition panel instead, since a macro figure isn't a
// physical measurement.
const NUTRITION_METRIC_TYPES = ["calories_kcal", "protein_g", "carbs_g", "fat_g"];
const METRIC_UNIT_SUFFIX = {
  calories_kcal: " kcal",
  protein_g: "g",
  carbs_g: "g",
  fat_g: "g"
};

function bodyMetricSourceBadge(entry, options = {}) {
  if (entry.source === "coach_entered") return "Coach";
  if (entry.source === "device_synced") return "Device";
  return options.viewerIsCoach ? "Athlete" : "You";
}

function renderBodyMetricEntry(entry, options = {}) {
  const label = BODY_METRIC_TYPE_LABELS[entry.metric_type] || entry.metric_type;
  const unitSuffix = entry.unit === "percent" ? "%" : ` ${escapeHtml(entry.unit)}`;
  const sourceBadge = bodyMetricSourceBadge(entry, options);
  const note = entry.note ? `<p>${escapeHtml(entry.note)}</p>` : "";

  return `
    <article class="record-card">
      <div class="record-meta">
        <span class="badge neutral">${escapeHtml(sourceBadge)}</span>
        <span class="muted small">${escapeHtml(formatDate(entry.effective_date))}</span>
      </div>
      <strong>${escapeHtml(label)}: ${escapeHtml(String(entry.value))}${unitSuffix}</strong>
      ${note}
    </article>
  `;
}

function renderBodyMetricList(container, entries, options = {}) {
  if (!container) return;

  if (entries.length === 0) {
    container.innerHTML = `
      <div class="empty-state compact-empty">
        <p>No body-metric entries yet.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = entries.map((entry) => renderBodyMetricEntry(entry, options)).join("");
}

function groupNutritionEntriesByDate(entries) {
  const byDate = new Map();
  for (const entry of entries) {
    if (!NUTRITION_METRIC_TYPES.includes(entry.metric_type)) continue;
    if (!byDate.has(entry.effective_date)) byDate.set(entry.effective_date, {});
    const day = byDate.get(entry.effective_date);
    // Entries arrive newest-logged-first; the first one seen per
    // metric_type for a given date is therefore the most recently logged
    // value for that day, matching how every other metric_type already
    // treats "log again" as a correction, not an addend.
    if (!(entry.metric_type in day)) day[entry.metric_type] = entry.value;
  }
  return [...byDate.entries()].sort((a, b) => (a[0] < b[0] ? 1 : a[0] > b[0] ? -1 : 0));
}

function renderNutritionDayCard([date, macros]) {
  const parts = NUTRITION_METRIC_TYPES
    .filter((metricType) => metricType in macros)
    .map((metricType) => `${BODY_METRIC_TYPE_LABELS[metricType]} ${escapeHtml(String(macros[metricType]))}${METRIC_UNIT_SUFFIX[metricType]}`)
    .join(" · ");

  return `
    <article class="record-card">
      <div class="record-meta">
        <span class="muted small">${escapeHtml(formatDate(date))}</span>
      </div>
      <p>${parts}</p>
    </article>
  `;
}

function renderNutritionSummary(container, entries) {
  if (!container) return;

  const days = groupNutritionEntriesByDate(entries);

  if (days.length === 0) {
    container.innerHTML = `
      <div class="empty-state compact-empty">
        <p>No nutrition entries yet.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = days.map(renderNutritionDayCard).join("");
}

async function refreshBodyMetrics(options = {}) {
  if (state.role !== "athlete") return;

  try {
    const response = await api("GET", "/body-metrics");
    state.bodyMetricEntries = Array.isArray(response.entries) ? response.entries : [];
    renderBodyMetricList(
      elements.bodyMetricHistory,
      state.bodyMetricEntries.filter((entry) => !NUTRITION_METRIC_TYPES.includes(entry.metric_type))
    );
    renderNutritionSummary(elements.nutritionSummary, state.bodyMetricEntries);
  }
  catch (error) {
    if (!options.quiet) throw error;
  }
}

async function logBodyMetricEntry() {
  const metricType = elements.bodyMetricTypeSelect?.value;
  const value = Number(elements.bodyMetricValueInput?.value);
  const effectiveDate = elements.bodyMetricDateInput?.value;
  const note = elements.bodyMetricNoteInput?.value || undefined;

  if (!metricType || !Number.isFinite(value) || !effectiveDate) {
    elements.bodyMetricStatus.hidden = false;
    elements.bodyMetricStatus.textContent = "Choose a measurement, value and date.";
    return;
  }

  showBusy("Logging measurement…");
  try {
    await api("POST", "/body-metrics", { metric_type: metricType, value, effective_date: effectiveDate, note });
    elements.bodyMetricLogForm.reset();
    elements.bodyMetricStatus.hidden = true;
    await refreshBodyMetrics({ quiet: true });
    showNotice("Body-metric entry logged.");
  }
  catch (error) {
    elements.bodyMetricStatus.hidden = false;
    elements.bodyMetricStatus.textContent = friendlyError(error.payload, error.status) || "Entry could not be logged.";
  }
  finally {
    hideBusy();
  }
}

async function logNutritionEntry() {
  const effectiveDate = elements.nutritionDateInput?.value;
  const fields = [
    ["calories_kcal", elements.nutritionCaloriesInput],
    ["protein_g", elements.nutritionProteinInput],
    ["carbs_g", elements.nutritionCarbsInput],
    ["fat_g", elements.nutritionFatInput]
  ]
    .map(([metricType, inputElement]) => [metricType, inputElement?.value ?? ""])
    .filter(([, rawValue]) => rawValue !== "");

  if (!effectiveDate || fields.length === 0) {
    elements.nutritionStatus.hidden = false;
    elements.nutritionStatus.textContent = "Enter a date and at least one macro.";
    return;
  }

  showBusy("Logging nutrition…");
  try {
    for (const [metricType, rawValue] of fields) {
      await api("POST", "/body-metrics", { metric_type: metricType, value: Number(rawValue), effective_date: effectiveDate });
    }
    elements.nutritionForm.reset();
    elements.nutritionStatus.hidden = true;
    await refreshBodyMetrics({ quiet: true });
    showNotice("Nutrition logged.");
  }
  catch (error) {
    elements.nutritionStatus.hidden = false;
    elements.nutritionStatus.textContent = friendlyError(error.payload, error.status) || "Nutrition could not be logged.";
  }
  finally {
    hideBusy();
  }
}

async function refreshCoachAthleteBodyMetrics(athleteUserId, options = {}) {
  if (!athleteUserId || !elements.athleteDetailBodyMetricHistory) return;

  try {
    const response = await api("GET", `/body-metrics/coach/${encodeURIComponent(athleteUserId)}`);
    state.coachAthleteBodyMetricEntries = Array.isArray(response.entries) ? response.entries : [];
    renderBodyMetricList(
      elements.athleteDetailBodyMetricHistory,
      state.coachAthleteBodyMetricEntries.filter((entry) => !NUTRITION_METRIC_TYPES.includes(entry.metric_type)),
      { viewerIsCoach: true }
    );
    renderNutritionSummary(elements.athleteDetailNutritionSummary, state.coachAthleteBodyMetricEntries);
  }
  catch (error) {
    if (!options.quiet) throw error;
  }
}

// Habit streak counts are plain arithmetic over the athlete's own
// self-declared completion dates - rendered as bare integers with no
// color grading, percentage framing or comparison to a target the
// athlete didn't set themselves.
function renderHabitCard(habit, options = {}) {
  const archived = Boolean(habit.archived_at_iso8601);
  const actions = options.readOnly || archived
    ? ""
    : `
      <div class="inline-controls">
        <button class="button secondary" type="button" data-habit-action="complete" data-habit-id="${escapeHtml(habit.habit_id)}">Mark done today</button>
        <button class="button secondary" type="button" data-habit-action="archive" data-habit-id="${escapeHtml(habit.habit_id)}">Archive</button>
      </div>
    `;

  return `
    <article class="record-card">
      <div class="record-meta">
        <span class="badge neutral">${escapeHtml(titleCase(habit.cadence))}</span>
        ${archived ? '<span class="muted small">Archived</span>' : ""}
      </div>
      <strong>${escapeHtml(habit.habit_label)}</strong>
      <p>${habit.current_streak_length} day${habit.current_streak_length === 1 ? "" : "s"} logged in a row - longest ${habit.longest_streak_length}, ${habit.total_completions} total.</p>
      ${actions}
    </article>
  `;
}

function renderHabitList(container, habits, options = {}) {
  if (!container) return;

  if (habits.length === 0) {
    container.innerHTML = `
      <div class="empty-state compact-empty">
        <p>No habits yet.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = habits.map((habit) => renderHabitCard(habit, options)).join("");
}

async function refreshHabits(options = {}) {
  if (state.role !== "athlete") return;

  try {
    const response = await api("GET", "/habits");
    state.habits = Array.isArray(response.habits) ? response.habits : [];
    renderHabitList(elements.habitList, state.habits);
  }
  catch (error) {
    if (!options.quiet) throw error;
  }
}

async function createHabit() {
  const habitLabel = elements.habitLabelInput?.value?.trim();
  const cadence = elements.habitCadenceSelect?.value;

  if (!habitLabel || !cadence) {
    elements.habitStatus.hidden = false;
    elements.habitStatus.textContent = "Enter a habit and choose a cadence.";
    return;
  }

  showBusy("Creating habit…");
  try {
    await api("POST", "/habits", { habit_label: habitLabel, cadence });
    elements.habitCreateForm.reset();
    elements.habitStatus.hidden = true;
    await refreshHabits({ quiet: true });
    showNotice("Habit created.");
  }
  catch (error) {
    elements.habitStatus.hidden = false;
    elements.habitStatus.textContent = friendlyError(error.payload, error.status) || "Habit could not be created.";
  }
  finally {
    hideBusy();
  }
}

async function logHabitCompletionToday(habitId) {
  showBusy("Marking habit done…");
  try {
    const today = new Date().toISOString().slice(0, 10);
    await api("POST", `/habits/${encodeURIComponent(habitId)}/completions`, { completion_date: today });
    await refreshHabits({ quiet: true });
    showNotice("Habit marked done for today.");
  }
  catch (error) {
    showNotice(friendlyError(error.payload, error.status) || "Could not mark habit done.");
  }
  finally {
    hideBusy();
  }
}

async function archiveHabit(habitId) {
  showBusy("Archiving habit…");
  try {
    await api("POST", `/habits/${encodeURIComponent(habitId)}/archive`);
    await refreshHabits({ quiet: true });
    showNotice("Habit archived.");
  }
  catch (error) {
    showNotice(friendlyError(error.payload, error.status) || "Could not archive habit.");
  }
  finally {
    hideBusy();
  }
}

async function refreshCoachAthleteHabits(athleteUserId, options = {}) {
  if (!athleteUserId || !elements.athleteDetailHabitList) return;

  try {
    const response = await api("GET", `/habits/coach/${encodeURIComponent(athleteUserId)}`);
    state.coachAthleteHabits = Array.isArray(response.habits) ? response.habits : [];
    renderHabitList(elements.athleteDetailHabitList, state.coachAthleteHabits, { readOnly: true });
  }
  catch (error) {
    if (!options.quiet) throw error;
  }
}

// A goal's current_value/progress_percentage/is_goal_met are computed
// server-side on every request from the athlete's own body-metric entries
// - nothing here is stored. status changes only via an explicit resolve
// call from the athlete; it is never inferred from computed progress.
const ATHLETE_GOAL_STATUS_BADGE_CLASS = {
  active: "active",
  achieved: "complete",
  abandoned: "partial"
};

function renderAthleteGoalMetricLine(goal) {
  const label = BODY_METRIC_TYPE_LABELS[goal.metric_type] || titleCase(goal.metric_type);
  const unitSuffix = goal.target_unit === "percent" ? "%" : ` ${escapeHtml(goal.target_unit)}`;

  if (!goal.has_current_value) {
    return `<p class="muted small">${escapeHtml(label)}: target ${escapeHtml(String(goal.target_value))}${unitSuffix} - no measurement logged yet.</p>`;
  }

  const progressText = goal.progress_percentage !== null
    ? ` (${goal.progress_percentage}% of the way there)`
    : "";
  const metText = goal.is_goal_met ? " - target met" : "";

  return `<p class="muted small">${escapeHtml(label)}: ${escapeHtml(String(goal.current_value))}${unitSuffix} now, target ${escapeHtml(String(goal.target_value))}${unitSuffix}${progressText}${metText}.</p>`;
}

function renderAthleteGoalCard(goal, options = {}) {
  const statusBadgeClass = ATHLETE_GOAL_STATUS_BADGE_CLASS[goal.status] || "neutral";
  const metricLine = goal.metric_type ? renderAthleteGoalMetricLine(goal) : "";
  const targetDateLine = goal.target_date
    ? `<p class="muted small">Target date ${escapeHtml(formatDate(goal.target_date))}</p>`
    : "";

  const actions = options.readOnly || goal.status !== "active"
    ? ""
    : `
      <div class="inline-controls">
        <button class="button secondary" type="button" data-goal-action="achieved" data-goal-id="${escapeHtml(goal.goal_id)}">Mark achieved</button>
        <button class="button secondary" type="button" data-goal-action="abandoned" data-goal-id="${escapeHtml(goal.goal_id)}">Abandon</button>
      </div>
    `;

  return `
    <article class="record-card">
      <div class="record-meta">
        <span class="badge ${statusBadgeClass}">${escapeHtml(titleCase(goal.status))}</span>
      </div>
      <strong>${escapeHtml(goal.goal_label)}</strong>
      ${metricLine}
      ${targetDateLine}
      ${actions}
    </article>
  `;
}

function renderAthleteGoalList(container, goals, options = {}) {
  if (!container) return;

  if (goals.length === 0) {
    container.innerHTML = `
      <div class="empty-state compact-empty">
        <p>No goals yet.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = goals.map((goal) => renderAthleteGoalCard(goal, options)).join("");
}

async function refreshAthleteGoals(options = {}) {
  if (state.role !== "athlete") return;

  try {
    const response = await api("GET", "/athlete-goals");
    state.athleteGoals = Array.isArray(response.goals) ? response.goals : [];
    renderAthleteGoalList(elements.athleteGoalList, state.athleteGoals);
  }
  catch (error) {
    if (!options.quiet) throw error;
  }
}

function updateAthleteGoalTargetValueVisibility() {
  const metricType = elements.athleteGoalMetricSelect?.value ?? "";
  if (elements.athleteGoalTargetValueField) {
    elements.athleteGoalTargetValueField.hidden = !metricType;
  }
}

async function createAthleteGoal() {
  const goalLabel = elements.athleteGoalLabelInput?.value?.trim();
  const metricType = elements.athleteGoalMetricSelect?.value || "";
  const targetValue = elements.athleteGoalTargetValueInput?.value ?? "";
  const targetDate = elements.athleteGoalTargetDateInput?.value || null;

  if (!goalLabel) {
    elements.athleteGoalStatus.hidden = false;
    elements.athleteGoalStatus.textContent = "Enter a goal.";
    return;
  }

  if (metricType && targetValue === "") {
    elements.athleteGoalStatus.hidden = false;
    elements.athleteGoalStatus.textContent = "Enter a target value for the linked measurement.";
    return;
  }

  const payload = { goal_label: goalLabel, target_date: targetDate };
  if (metricType) {
    payload.metric_type = metricType;
    payload.target_value = Number(targetValue);
  }

  showBusy("Setting goal…");
  try {
    await api("POST", "/athlete-goals", payload);
    elements.athleteGoalCreateForm.reset();
    updateAthleteGoalTargetValueVisibility();
    elements.athleteGoalStatus.hidden = true;
    await refreshAthleteGoals({ quiet: true });
    showNotice("Goal set.");
  }
  catch (error) {
    elements.athleteGoalStatus.hidden = false;
    elements.athleteGoalStatus.textContent = friendlyError(error.payload, error.status) || "Goal could not be set.";
  }
  finally {
    hideBusy();
  }
}

async function resolveAthleteGoal(goalId, resolution) {
  showBusy(resolution === "achieved" ? "Marking goal achieved…" : "Abandoning goal…");
  try {
    await api("POST", `/athlete-goals/${encodeURIComponent(goalId)}/resolve`, { resolution });
    await refreshAthleteGoals({ quiet: true });
    showNotice(resolution === "achieved" ? "Goal marked achieved." : "Goal abandoned.");
  }
  catch (error) {
    showNotice(friendlyError(error.payload, error.status) || "Could not update goal.");
  }
  finally {
    hideBusy();
  }
}

async function refreshCoachAthleteGoals(athleteUserId, options = {}) {
  if (!athleteUserId || !elements.athleteDetailGoalList) return;

  try {
    const response = await api("GET", `/athlete-goals/coach/${encodeURIComponent(athleteUserId)}`);
    state.coachAthleteGoals = Array.isArray(response.goals) ? response.goals : [];
    renderAthleteGoalList(elements.athleteDetailGoalList, state.coachAthleteGoals, { readOnly: true });
  }
  catch (error) {
    if (!options.quiet) throw error;
  }
}

function defaultWeeklyCheckinWeekStartDate() {
  const now = new Date();
  const isoDayOfWeek = (now.getUTCDay() + 6) % 7;
  const monday = new Date(now.getTime() - isoDayOfWeek * 86400000);
  return monday.toISOString().slice(0, 10);
}

function renderWeeklyCheckinCard(checkin) {
  const noteLine = checkin.note ? `<p>${escapeHtml(checkin.note)}</p>` : "";
  return `
    <article class="record-card">
      <div class="record-meta">
        <span class="muted small">Week of ${escapeHtml(formatDate(checkin.week_start_date))}</span>
      </div>
      <p class="muted small">Energy ${escapeHtml(String(checkin.energy_level))}/5 · Motivation ${escapeHtml(String(checkin.motivation_level))}/5 · Sleep ${escapeHtml(String(checkin.sleep_quality))}/5</p>
      ${noteLine}
    </article>
  `;
}

function renderWeeklyCheckinList(container, checkins) {
  if (!container) return;

  if (checkins.length === 0) {
    container.innerHTML = `
      <div class="empty-state compact-empty">
        <p>No weekly check-ins yet.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = checkins.map(renderWeeklyCheckinCard).join("");
}

async function refreshWeeklyCheckins(options = {}) {
  if (state.role !== "athlete") return;

  try {
    const response = await api("GET", "/weekly-checkins");
    state.weeklyCheckins = Array.isArray(response.checkins) ? response.checkins : [];
    renderWeeklyCheckinList(elements.weeklyCheckinList, state.weeklyCheckins);
  }
  catch (error) {
    if (!options.quiet) throw error;
  }
}

async function submitWeeklyCheckin() {
  const weekStartDate = elements.weeklyCheckinWeekStartInput?.value || "";
  const energyLevel = elements.weeklyCheckinEnergyInput?.value ?? "";
  const motivationLevel = elements.weeklyCheckinMotivationInput?.value ?? "";
  const sleepQuality = elements.weeklyCheckinSleepInput?.value ?? "";
  const note = elements.weeklyCheckinNoteInput?.value?.trim() || undefined;

  if (!weekStartDate || energyLevel === "" || motivationLevel === "" || sleepQuality === "") {
    elements.weeklyCheckinStatus.hidden = false;
    elements.weeklyCheckinStatus.textContent = "Enter a week and all three ratings.";
    return;
  }

  const payload = {
    week_start_date: weekStartDate,
    energy_level: Number(energyLevel),
    motivation_level: Number(motivationLevel),
    sleep_quality: Number(sleepQuality),
    note
  };

  showBusy("Submitting check-in…");
  try {
    await api("POST", "/weekly-checkins", payload);
    elements.weeklyCheckinForm.reset();
    if (elements.weeklyCheckinWeekStartInput) {
      elements.weeklyCheckinWeekStartInput.value = defaultWeeklyCheckinWeekStartDate();
    }
    elements.weeklyCheckinStatus.hidden = true;
    await refreshWeeklyCheckins({ quiet: true });
    showNotice("Check-in submitted.");
  }
  catch (error) {
    elements.weeklyCheckinStatus.hidden = false;
    elements.weeklyCheckinStatus.textContent = friendlyError(error.payload, error.status) || "Check-in could not be submitted.";
  }
  finally {
    hideBusy();
  }
}

async function refreshCoachAthleteWeeklyCheckins(athleteUserId, options = {}) {
  if (!athleteUserId || !elements.athleteDetailWeeklyCheckinList) return;

  try {
    const response = await api("GET", `/weekly-checkins/coach/${encodeURIComponent(athleteUserId)}`);
    state.coachAthleteWeeklyCheckins = Array.isArray(response.checkins) ? response.checkins : [];
    renderWeeklyCheckinList(elements.athleteDetailWeeklyCheckinList, state.coachAthleteWeeklyCheckins);
  }
  catch (error) {
    if (!options.quiet) throw error;
  }
}

// Progress insights are computed server-side, on every request, from
// already-persisted session/strength/habit/body-metric facts - nothing
// here is stored. Every number rendered below is plain text, matching
// the codebase-wide convention (no charting library anywhere in this
// app) - the habit streak display is the closest existing precedent.
function progressInsightsAdherenceText(adherence) {
  if (!adherence.has_sufficient_data) {
    return "No sessions recorded in the last 30 days.";
  }
  return `${adherence.adherence_percentage}% adherence — ${adherence.completed_sessions} of ${adherence.total_sessions} sessions completed in the last 30 days.`;
}

function renderStrengthTrendCard(trend) {
  const changeText = trend.has_prior_value
    ? `${trend.delta > 0 ? "+" : ""}${trend.delta} ${escapeHtml(trend.current_unit)} (${trend.delta_percentage > 0 ? "+" : ""}${trend.delta_percentage}%) since ${escapeHtml(formatDate(trend.prior_effective_date))}`
    : "No prior benchmark to compare yet.";

  return `
    <article class="record-card">
      <div class="record-meta">
        <span class="badge neutral">${escapeHtml(exerciseDisplayName(trend.exercise_id))}</span>
        <span class="muted small">${escapeHtml(formatDate(trend.current_effective_date))}</span>
      </div>
      <strong>${escapeHtml(String(trend.current_value))} ${escapeHtml(trend.current_unit)}</strong>
      <p class="muted small">${changeText}</p>
    </article>
  `;
}

function renderHabitConsistencyCard(habit) {
  return `
    <article class="record-card">
      <div class="record-meta">
        <span class="badge neutral">${escapeHtml(titleCase(habit.cadence))}</span>
      </div>
      <strong>${escapeHtml(habit.habit_label)}</strong>
      <p class="muted small">${habit.completion_rate_percentage}% of expected completions in the last 30 days (${habit.window_completions}/${habit.window_expected_units})</p>
      <p class="muted small">Current streak ${habit.current_streak_length} · Longest streak ${habit.longest_streak_length}</p>
    </article>
  `;
}

function renderBodyMetricTrendCard(trend) {
  const label = BODY_METRIC_TYPE_LABELS[trend.metric_type] || titleCase(trend.metric_type);
  const unitSuffix = trend.unit === "percent" ? "%" : ` ${escapeHtml(trend.unit)}`;
  const changeText = trend.has_prior_value
    ? `${trend.delta > 0 ? "+" : ""}${trend.delta}${unitSuffix} (${trend.delta_percentage > 0 ? "+" : ""}${trend.delta_percentage}%) since ${escapeHtml(formatDate(trend.prior_effective_date))}`
    : "No entry from 30+ days ago to compare yet.";

  return `
    <article class="record-card">
      <div class="record-meta">
        <span class="badge neutral">${escapeHtml(label)}</span>
        <span class="muted small">${escapeHtml(formatDate(trend.latest_effective_date))}</span>
      </div>
      <strong>${escapeHtml(String(trend.latest_value))}${unitSuffix}</strong>
      <p class="muted small">${changeText}</p>
    </article>
  `;
}

function renderProgressInsightsSummary(insights) {
  if (elements.progressInsightsAdherenceSummary) {
    elements.progressInsightsAdherenceSummary.textContent = progressInsightsAdherenceText(insights.session_adherence);
  }

  if (elements.progressInsightsStrengthList) {
    elements.progressInsightsStrengthList.innerHTML = insights.strength_trends.length
      ? insights.strength_trends.map(renderStrengthTrendCard).join("")
      : '<div class="empty-state compact-empty"><p>No strength benchmarks recorded yet.</p></div>';
  }

  if (elements.progressInsightsHabitList) {
    elements.progressInsightsHabitList.innerHTML = insights.habit_consistency.length
      ? insights.habit_consistency.map(renderHabitConsistencyCard).join("")
      : '<div class="empty-state compact-empty"><p>No habits tracked yet.</p></div>';
  }

  if (elements.progressInsightsBodyMetricList) {
    elements.progressInsightsBodyMetricList.innerHTML = insights.body_metric_trends.length
      ? insights.body_metric_trends.map(renderBodyMetricTrendCard).join("")
      : '<div class="empty-state compact-empty"><p>No body-metric entries recorded yet.</p></div>';
  }
}

function renderProgressInsightsCompactList(container, insights) {
  if (!container) return;

  const sections = [
    `<p class="muted small">${escapeHtml(progressInsightsAdherenceText(insights.session_adherence))}</p>`,
    insights.strength_trends.map(renderStrengthTrendCard).join(""),
    insights.habit_consistency.map(renderHabitConsistencyCard).join(""),
    insights.body_metric_trends.map(renderBodyMetricTrendCard).join("")
  ].join("");

  container.innerHTML = sections;
}

async function refreshProgressInsights(options = {}) {
  if (state.role !== "athlete") return;

  try {
    const response = await api("GET", "/progress-insights");
    renderProgressInsightsSummary(response.insights);
  }
  catch (error) {
    if (!options.quiet) throw error;
  }
}

async function refreshCoachAthleteProgressInsights(athleteUserId, options = {}) {
  if (!athleteUserId || !elements.athleteDetailProgressInsights) return;

  try {
    const response = await api("GET", `/progress-insights/coach/${encodeURIComponent(athleteUserId)}`);
    renderProgressInsightsCompactList(elements.athleteDetailProgressInsights, response.insights);
  }
  catch (error) {
    if (!options.quiet) throw error;
  }
}

const DEVICE_PROVIDER_LABELS = {
  apple_health: "Apple Health",
  garmin: "Garmin",
  whoop: "Whoop",
  manual_import: "Manual import"
};

const DEVICE_METRIC_TYPE_LABELS = {
  resting_heart_rate_bpm: "Resting heart rate",
  steps_count: "Steps",
  sleep_duration_minutes: "Sleep duration"
};

function renderDeviceConnectionCard(connection) {
  const providerLabel = DEVICE_PROVIDER_LABELS[connection.provider] || connection.provider;
  const statusBadge = connection.connection_status === "active" ? "Connected" : "Disconnected";
  const disconnectButton = connection.connection_status === "active"
    ? `<button class="button ghost small" type="button" data-device-disconnect="${escapeHtml(connection.connection_id)}">Disconnect</button>`
    : "";

  return `
    <article class="record-card">
      <div class="record-meta">
        <span class="badge neutral">${escapeHtml(statusBadge)}</span>
        <span class="muted small">${escapeHtml(formatDate(connection.updated_at_iso8601))}</span>
      </div>
      <strong>${escapeHtml(providerLabel)}</strong>
      ${disconnectButton}
    </article>
  `;
}

function renderDeviceConnectionList(container, connections) {
  if (!container) return;

  if (connections.length === 0) {
    container.innerHTML = `
      <div class="empty-state compact-empty">
        <p>No connected devices yet.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = connections.map(renderDeviceConnectionCard).join("");
}

function renderDeviceMetricEntry(entry) {
  const label = DEVICE_METRIC_TYPE_LABELS[entry.metric_type] || entry.metric_type;
  const providerLabel = DEVICE_PROVIDER_LABELS[entry.provider] || entry.provider;

  return `
    <article class="record-card">
      <div class="record-meta">
        <span class="badge neutral">Synced from ${escapeHtml(providerLabel)}</span>
        <span class="muted small">${escapeHtml(formatDate(entry.reported_at_iso8601))}</span>
      </div>
      <strong>${escapeHtml(label)}: ${escapeHtml(String(entry.value))} ${escapeHtml(String(entry.unit ?? ""))}</strong>
    </article>
  `;
}

function renderDeviceMetricList(container, entries) {
  if (!container) return;

  if (entries.length === 0) {
    container.innerHTML = `
      <div class="empty-state compact-empty">
        <p>No synced metrics yet.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = entries.map(renderDeviceMetricEntry).join("");
}

async function refreshDeviceSync(options = {}) {
  if (state.role !== "athlete") return;

  try {
    const [connectionsResponse, metricsResponse] = await Promise.all([
      api("GET", "/device-sync/connections"),
      api("GET", "/device-sync/metrics")
    ]);
    state.deviceConnections = Array.isArray(connectionsResponse.connections) ? connectionsResponse.connections : [];
    state.deviceMetricEntries = Array.isArray(metricsResponse.entries) ? metricsResponse.entries : [];
    renderDeviceConnectionList(elements.deviceConnectionList, state.deviceConnections);
    renderDeviceMetricList(elements.deviceMetricHistory, state.deviceMetricEntries);
  }
  catch (error) {
    if (!options.quiet) throw error;
  }
}

async function connectDeviceSync() {
  const provider = elements.deviceProviderSelect?.value;
  if (!provider) {
    elements.deviceSyncStatus.hidden = false;
    elements.deviceSyncStatus.textContent = "Choose a device provider.";
    return;
  }

  showBusy("Connecting device…");
  try {
    await api("POST", "/device-sync/connect", {
      provider,
      provider_account_id: `${provider}_${Date.now()}_${Math.random().toString(36).slice(2)}`
    });
    elements.deviceSyncStatus.hidden = true;
    await refreshDeviceSync({ quiet: true });
    showNotice("Device connected.");
  }
  catch (error) {
    elements.deviceSyncStatus.hidden = false;
    elements.deviceSyncStatus.textContent = friendlyError(error.payload, error.status) || "Device could not be connected.";
  }
  finally {
    hideBusy();
  }
}

async function disconnectDeviceSync(connectionId) {
  showBusy("Disconnecting device…");
  try {
    await api("POST", "/device-sync/disconnect", { connection_id: connectionId });
    await refreshDeviceSync({ quiet: true });
    showNotice("Device disconnected.");
  }
  catch (error) {
    showNotice(friendlyError(error.payload, error.status) || "Could not disconnect device.");
  }
  finally {
    hideBusy();
  }
}

async function refreshCoachAthleteDeviceSync(athleteUserId, options = {}) {
  if (!athleteUserId || !elements.athleteDetailDeviceConnectionList) return;

  try {
    const [connectionsResponse, metricsResponse] = await Promise.all([
      api("GET", `/device-sync/connections/coach/${encodeURIComponent(athleteUserId)}`),
      api("GET", `/device-sync/metrics/coach/${encodeURIComponent(athleteUserId)}`)
    ]);
    state.coachAthleteDeviceConnections = Array.isArray(connectionsResponse.connections) ? connectionsResponse.connections : [];
    state.coachAthleteDeviceMetricEntries = Array.isArray(metricsResponse.entries) ? metricsResponse.entries : [];
    renderDeviceConnectionList(elements.athleteDetailDeviceConnectionList, state.coachAthleteDeviceConnections);
    renderDeviceMetricList(elements.athleteDetailDeviceMetricHistory, state.coachAthleteDeviceMetricEntries);
  }
  catch (error) {
    if (!options.quiet) throw error;
  }
}

async function refreshCoachAthleteMessages(athleteUserId, options = {}) {
  if (!athleteUserId || !elements.athleteDetailMessageHistory) return;

  try {
    const response = await api("GET", "/messages/coach/threads");
    const threads = Array.isArray(response.threads) ? response.threads : [];
    const thread = threads.find((entry) => entry.athlete_user_id === athleteUserId) ?? null;

    if (!thread) {
      state.liveMessageThreadId = null;
      state.coachAthleteMessages = [];
      renderCoachAthleteMessages();
      return;
    }

    state.liveMessageThreadId = thread.thread_id;
    const messagesResponse = await api(
      "GET",
      `/messages/coach/threads/${encodeURIComponent(thread.thread_id)}`
    );
    state.coachAthleteMessages = Array.isArray(messagesResponse.messages) ? messagesResponse.messages : [];
    renderCoachAthleteMessages();
  }
  catch (error) {
    if (!options.quiet) throw error;
  }
}

function renderCoachAthleteMessages() {
  if (!elements.athleteDetailMessageHistory) return;

  const messages = Array.isArray(state.coachAthleteMessages) ? state.coachAthleteMessages : [];

  if (messages.length === 0) {
    elements.athleteDetailMessageHistory.innerHTML = `
      <div class="empty-state compact-empty">
        <p>No messages yet.</p>
      </div>
    `;
    return;
  }

  elements.athleteDetailMessageHistory.innerHTML = messages.map((message) => `
    <article class="review-note-card">
      <div class="record-meta">
        <span class="badge neutral">${message.sender_role === "coach" ? "You" : "Athlete"}</span>
        <span class="muted small">${escapeHtml(formatDate(message.created_at_iso8601))}</span>
      </div>
      ${renderMessageAttachment(message.attachment)}
      ${message.body_text ? `<p>${escapeHtml(message.body_text)}</p>` : ""}
    </article>
  `).join("");
}

// Part O.8 - read-only coach visibility into an athlete's org-owner
// threads. A list, not a single thread, since an athlete could in
// principle have threads across more than one shared org this coach
// belongs to (in practice almost always 0 or 1). No send form - the coach
// never sends into this thread, it stays exactly two-party for writes.
async function refreshCoachAthleteOrgMessages(athleteUserId, options = {}) {
  if (!athleteUserId || !elements.athleteDetailOrgMessageHistory) return;

  try {
    const threadsResponse = await api(
      "GET",
      `/messages/coach/athletes/${encodeURIComponent(athleteUserId)}/org-messages/threads`
    );
    const threads = Array.isArray(threadsResponse.threads) ? threadsResponse.threads : [];

    state.coachAthleteOrgMessageThreads = await Promise.all(
      threads.map(async (thread) => {
        const messagesResponse = await api(
          "GET",
          `/messages/coach/org-messages/threads/${encodeURIComponent(thread.thread_id)}`
        );
        return { thread, messages: Array.isArray(messagesResponse.messages) ? messagesResponse.messages : [] };
      })
    );
    renderCoachAthleteOrgMessages();
  }
  catch (error) {
    if (!options.quiet) throw error;
  }
}

function renderCoachAthleteOrgMessages() {
  if (!elements.athleteDetailOrgMessageHistory) return;

  const entries = Array.isArray(state.coachAthleteOrgMessageThreads) ? state.coachAthleteOrgMessageThreads : [];

  if (entries.length === 0) {
    elements.athleteDetailOrgMessageHistory.innerHTML = `
      <div class="empty-state compact-empty">
        <p>No team messages yet.</p>
      </div>
    `;
    return;
  }

  elements.athleteDetailOrgMessageHistory.innerHTML = entries.map((entry) => `
    <div class="record-row org-message-thread">
      <strong>${escapeHtml(entry.thread.org_name)}</strong>
      <div class="record-list">
        ${entry.messages.map((message) => `
          <article class="review-note-card">
            <div class="record-meta">
              <span class="badge neutral">${message.sender_role === "org_owner" ? escapeHtml(entry.thread.org_name) : "Athlete"}</span>
              <span class="muted small">${escapeHtml(formatDate(message.created_at_iso8601))}</span>
            </div>
            ${renderMessageAttachment(message.attachment)}
            ${message.body_text ? `<p>${escapeHtml(message.body_text)}</p>` : ""}
          </article>
        `).join("")}
      </div>
    </div>
  `).join("");
}

function openComposeAthleteMessagePanel() {
  if (!state.selectedCoachAthleteId) return;
  elements.athleteDetailMessageText.value = "";
  if (elements.athleteDetailMessageAttachment) elements.athleteDetailMessageAttachment.value = "";
  elements.athleteDetailMessageForm.hidden = false;
  elements.athleteDetailMessageText.focus();
}

function closeComposeAthleteMessagePanel() {
  elements.athleteDetailMessageForm.hidden = true;
}

async function confirmSendAthleteMessage(event) {
  event.preventDefault();

  const athleteUserId = state.selectedCoachAthleteId;
  if (!athleteUserId) return;

  const bodyText = elements.athleteDetailMessageText.value.trim();
  const attachmentFile = elements.athleteDetailMessageAttachment?.files?.[0] ?? null;
  if (!bodyText && !attachmentFile) {
    throw new Error("Enter a message or attach a photo/video before sending.");
  }
  const attachmentError = validateAttachmentClientSide(attachmentFile);
  if (attachmentError) {
    throw new Error(attachmentError);
  }

  showBusy("Sending message…");
  try {
    await sendMessageRequest(
      `/messages/coach/athletes/${encodeURIComponent(athleteUserId)}/send`,
      bodyText,
      attachmentFile
    );

    closeComposeAthleteMessagePanel();
    await refreshCoachAthleteMessages(athleteUserId, { quiet: true });
    showNotice("Message sent.");
  }
  finally {
    hideBusy();
  }
}

async function openAthleteProfile(athleteUserId) {
  await loadTemplateExercises();

  const athlete =
    state.coachAthletes.find(
      (entry) =>
        entry.userId === athleteUserId
    );

  if (!athlete) {
    throw new Error(
      "Select an accepted connected athlete."
    );
  }

  closeAthleteRelationshipDetail();

  const profile =
    await loadAthleteProfile(
      athleteUserId
    );

  state.selectedCoachAthleteId =
    athleteUserId;

  state.athleteProfileDraft =
    profileRecordToDraft(
      profile,
      athlete
    );

  await Promise.all([
    refreshAthleteEventLinks(
      athleteUserId,
      {
        quiet: true
      }
    ),
    refreshAthleteDetail(
      athleteUserId,
      {
        quiet: true
      }
    ),
    refreshCoachAthleteMessages(
      athleteUserId,
      {
        quiet: true
      }
    ),
    refreshCoachAthleteOrgMessages(
      athleteUserId,
      {
        quiet: true
      }
    ),
    refreshCoachAthleteProgressPhotos(
      athleteUserId,
      {
        quiet: true
      }
    ),
    refreshCoachAthleteBodyMetrics(
      athleteUserId,
      {
        quiet: true
      }
    ),
    refreshCoachAthleteHabits(
      athleteUserId,
      {
        quiet: true
      }
    ),
    refreshCoachAthleteGoals(
      athleteUserId,
      {
        quiet: true
      }
    ),
    refreshCoachAthleteWeeklyCheckins(
      athleteUserId,
      {
        quiet: true
      }
    ),
    refreshCoachAthleteDeviceSync(
      athleteUserId,
      {
        quiet: true
      }
    ),
    refreshCoachAthleteProgressInsights(
      athleteUserId,
      {
        quiet: true
      }
    )
  ]);

  saveState();
  renderAthleteProfileEditor();
}

function closeAthleteProfile() {
  state.selectedCoachAthleteId = "";
  state.athleteProfileDraft = null;
  state.liveMessageThreadId = null;
  state.coachAthleteOrgMessageThreads = [];
  state.coachAthleteProgressPhotos = [];
  state.coachAthleteBodyMetricEntries = [];
  state.coachAthleteHabits = [];
  saveState();
  elements.athleteProfilePanel.hidden = true;
  elements.athleteAssignmentPanel.hidden = true;

  if (
    elements.athleteDetailHistoryPanel
  ) {
    elements.athleteDetailHistoryPanel
      .hidden = true;
  }

  if (
    elements.athleteDetailNoteForm
  ) {
    elements.athleteDetailNoteForm
      .hidden = true;
  }

  if (
    elements.athleteDetailMessageForm
  ) {
    elements.athleteDetailMessageForm
      .hidden = true;
  }
}

function addAthleteBenchmark() {
  if (!state.athleteProfileDraft) return;
  state.athleteProfileDraft.benchmarks.push(newAthleteBenchmark());
  saveState();
  renderAthleteProfileEditor();
}

function removeAthleteBenchmark(index) {
  if (!state.athleteProfileDraft) return;

  const benchmark =
    state
      .athleteProfileDraft
      .benchmarks[index];

  if (
    !benchmark ||
    benchmark.persisted
  ) {
    return;
  }

  state
    .athleteProfileDraft
    .benchmarks
    .splice(index, 1);

  saveState();
  renderAthleteProfileEditor();
}

async function saveOpenAthleteProfile(event) {
  event.preventDefault();
  const athlete = state.coachAthletes.find(
    (entry) => entry.userId === state.selectedCoachAthleteId
  );
  if (!athlete || !state.athleteProfileDraft) {
    throw new Error("Open an athlete profile first.");
  }

  syncAthleteProfileHeader();
  showBusy("Saving athlete profile…");

  try {
    const draft = state.athleteProfileDraft;
    const response = await api("POST", "/coach-workspace/athlete-strength-profile", {
      coach_user_id: state.profile.coachUserId,
      athlete_user_id: athlete.userId,
      preferred_weight_unit: draft.preferred_weight_unit,
      load_rounding_increment: Number(draft.load_rounding_increment),
      bodyweight: draft.bodyweight === "" ? null : Number(draft.bodyweight),
      bodyweight_unit: draft.bodyweight_unit,
      benchmarks: draft.benchmarks.map((benchmark) => ({
        benchmark_id: benchmark.benchmark_id,
        exercise_id: benchmark.exercise_id,
        value: Number(benchmark.value),
        unit: benchmark.unit,
        basis: benchmark.basis,
        effective_date: benchmark.effective_date,
        source_note: benchmark.source_note.trim(),
        replaces_reference_id:
          benchmark.replaces_reference_id ||
          null
      })),
      expected_current_record_sha256:
        typeof draft.expected_current_record_sha256 === "string"
          ? draft.expected_current_record_sha256
          : typeof state
              .athleteProfiles
              ?.[athlete.userId]
              ?.record_sha256 === "string"
            ? state
                .athleteProfiles[
                  athlete.userId
                ]
                .record_sha256
            : null
    });

    state.athleteProfiles[athlete.userId] = response.profile;
    state.athleteProfileDraft = profileRecordToDraft(response.profile, athlete);
    await refreshAthleteDetail(
      athlete.userId,
      { quiet: true }
    );
    saveState();
    renderAthleteProfileEditor();
    renderCoachWorkspace();
    renderAssignmentRequirements();
    showNotice(`${athlete.displayName}'s training profile was saved.`);
  }
  finally {
    hideBusy();
  }
}

function requiredOneRmExerciseIds(template) {
  const ids = new Set();
  const blocks = Array.isArray(template?.template_structure?.blocks)
    ? template.template_structure.blocks
    : [];

  for (const block of blocks) {
    for (const week of Array.isArray(block?.weeks) ? block.weeks : []) {
      for (const day of Array.isArray(week?.days) ? week.days : []) {
        for (const session of Array.isArray(day?.sessions) ? day.sessions : []) {
          for (const item of Array.isArray(session?.work_items) ? session.work_items : []) {
            if (item?.loading_reference?.type === "percent_1rm") {
              ids.add(String(item.exercise_id ?? ""));
            }
          }
        }
      }
    }
  }

  ids.delete("");
  return [...ids];
}

function exerciseDisplayName(exerciseId) {
  return state.templateExercises.find((exercise) => exercise.exercise_id === exerciseId)?.display_name
    ?? titleCase(exerciseId);
}

function renderAssignmentEventSummary(template) {
  const eventPlan = template?.event_plan && typeof template.event_plan === "object"
    ? template.event_plan
    : null;

  elements.assignmentEventSummary.hidden = !eventPlan;
  if (!eventPlan) {
    elements.assignmentEventSummary.innerHTML = "";
    return;
  }

  elements.assignmentEventSummary.innerHTML = `
    <div>
      <span class="eyebrow">Assigned event</span>
      <strong>${escapeHtml(eventPlan.event_name)}</strong>
      <span>${escapeHtml(titleCase(eventPlan.event_type))} · ${escapeHtml(formatDate(eventPlan.event_date))}</span>
    </div>
    <strong>${escapeHtml(countdownLabel(eventPlan.event_date))}</strong>
  `;
}

function renderAssignmentRequirements() {
  const athlete = state.coachAthletes.find(
    (entry) => entry.userId === elements.assignmentAthlete.value
  );
  const template = state.coachTemplates.find(
    (entry) => entry.template_id === elements.assignmentTemplate.value
  );

  renderAssignmentEventSummary(template);

  if (!athlete || !template) {
    elements.assignmentRequirements.className = "assignment-requirements neutral";
    elements.assignmentRequirements.textContent = "Select an athlete and programme to check percentage-load references.";
    elements.assignmentSubmitButton.disabled = true;
    return false;
  }

  const required = requiredOneRmExerciseIds(template);
  if (required.length === 0) {
    elements.assignmentRequirements.className = "assignment-requirements complete";
    elements.assignmentRequirements.textContent = "Assignment requirements complete. This programme has no percentage-based exercises.";
    elements.assignmentSubmitButton.disabled = false;
    return true;
  }

  const profile = profileForAthlete(athlete.userId);
  if (!profile) {
    elements.assignmentRequirements.className = "assignment-requirements warning";
    elements.assignmentRequirements.innerHTML = `Athlete profile required. Add 1RM references for: <strong>${required.map(exerciseDisplayName).map(escapeHtml).join(", ")}</strong>.`;
    elements.assignmentSubmitButton.disabled = true;
    return false;
  }

  const current = currentProfileBenchmarks(profile);
  const missing = required.filter((exerciseId) => !current.has(exerciseId));

  if (missing.length > 0) {
    elements.assignmentRequirements.className = "assignment-requirements warning";
    elements.assignmentRequirements.innerHTML = `Missing current strength references: <strong>${missing.map(exerciseDisplayName).map(escapeHtml).join(", ")}</strong>.`;
    elements.assignmentSubmitButton.disabled = true;
    return false;
  }

  elements.assignmentRequirements.className = "assignment-requirements complete";
  elements.assignmentRequirements.textContent = `Assignment requirements complete. ${required.length} percentage-based exercise reference${required.length === 1 ? "" : "s"} available.`;
  elements.assignmentSubmitButton.disabled = false;
  return true;
}

async function refreshAssignmentAthleteProfile() {
  const athleteUserId = elements.assignmentAthlete.value;
  if (!athleteUserId) {
    renderAssignmentRequirements();
    return;
  }

  try {
    await loadAthleteProfile(athleteUserId, { quiet: true });
  }
  catch (error) {
    console.error(error);
  }

  renderAssignmentRequirements();
}

function renderAssignmentTemplateOptions() {
  const athlete = state.coachAthletes.find(
    (entry) => entry.userId === elements.assignmentAthlete.value
  );

  const templates = activeCoachTemplates(athlete?.activityId ?? null);
  const previousValue = elements.assignmentTemplate.value;

  elements.assignmentTemplate.innerHTML = templates.length
    ? templates
        .map((template) => `
          <option value="${escapeHtml(template.template_id)}">
            ${escapeHtml(template.template_name)} · v${Number(template.template_version)} · ${Number(template.block_count ?? 1)} block${Number(template.block_count ?? 1) === 1 ? "" : "s"}
          </option>
        `)
        .join("")
    : '<option value="">No active programmes for this activity</option>';

  if (templates.some((template) => template.template_id === previousValue)) {
    elements.assignmentTemplate.value = previousValue;
  }

  elements.assignmentTemplate.disabled = templates.length === 0;
  renderAssignmentRequirements();
}

function renderCoachSelectors() {
  const options = state.coachAthletes.length
    ? state.coachAthletes
        .map((athlete) => `<option value="${escapeHtml(athlete.userId)}">${escapeHtml(athlete.displayName)}</option>`)
        .join("")
    : '<option value="">No connected athletes</option>';

  const assignmentValue = elements.assignmentAthlete.value;
  const reviewValue = elements.reviewAthlete.value;

  elements.assignmentAthlete.innerHTML = options;
  elements.reviewAthlete.innerHTML = options;

  if (
    assignmentValue &&
    state.coachAthletes.some((athlete) => athlete.userId === assignmentValue)
  ) {
    elements.assignmentAthlete.value = assignmentValue;
  }

  if (
    reviewValue &&
    state.coachAthletes.some((athlete) => athlete.userId === reviewValue)
  ) {
    elements.reviewAthlete.value = reviewValue;
  }

  elements.assignmentAthlete.disabled = state.coachAthletes.length === 0;
  elements.reviewAthlete.disabled = state.coachAthletes.length === 0;
  elements.loadReviewButton.disabled = state.coachAthletes.length === 0;

  renderAssignmentTemplateOptions();
}

function coachAthleteCard(athlete) {
  const assignments = state.coachAssignments.filter(
    (assignment) => assignment.athleteUserId === athlete.userId
  ).length;
  const profile = profileForAthlete(athlete.userId);
  const referenceCount = currentProfileBenchmarks(profile).size;

  return `
    <article class="record-card athlete-record-card" data-athlete-id="${escapeHtml(athlete.userId)}">
      <div>
        <h3>${escapeHtml(athlete.displayName)}</h3>
        <p>${escapeHtml(titleCase(athlete.activityId))}</p>
      </div>
      <div class="record-meta athlete-record-meta">
        <span class="badge complete">Connected</span>
        <span class="badge ${profile ? "active" : "neutral"}">${profile ? `${referenceCount} strength reference${referenceCount === 1 ? "" : "s"}` : "Profile not recorded"}</span>
        <span class="badge neutral">${assignments} assignment${assignments === 1 ? "" : "s"}</span>
        <button class="button secondary small-button open-athlete-profile" type="button" data-athlete-id="${escapeHtml(athlete.userId)}">Open profile</button>
      </div>
    </article>
  `;
}

function bindCoachAthleteActions() {
  for (
    const container of [
      elements.coachOverviewAthletes,
      elements.athleteRoster
    ]
  ) {
    if (!container) continue;

    for (
      const button of
      container.querySelectorAll(
        ".open-athlete-profile"
      )
    ) {
      if (
        button.dataset.profileActionBound ===
        "true"
      ) {
        continue;
      }

      button.dataset.profileActionBound =
        "true";

      button.addEventListener(
        "click",
        () => {
          setView("athletes");

          openAthleteProfile(
            button.dataset.athleteId
          ).catch(handleError);
        }
      );
    }
  }
}


// FULL-UI-03 factual coach dashboard.
// Dashboard records are derived from server-authoritative coach,
// assignment, event and artefact responses. No readiness,
// recommendation, ranking or engine mutation is produced.

function dashboardAthleteName(athleteUserId) {
  const athlete =
    state.coachAthletes.find(
      (entry) =>
        entry.userId === athleteUserId
    );

  return athlete?.displayName ??
    athleteUserId ??
    "Athlete";
}

function dashboardAssignmentAthleteId(assignment) {
  return String(
    assignment?.athleteUserId ??
    assignment?.athlete_user_id ??
    assignment?.assigned_athlete_id ??
    ""
  );
}

function dashboardAssignmentTemplateId(assignment) {
  return String(
    assignment?.templateId ??
    assignment?.template_id ??
    assignment?.programme_id ??
    ""
  );
}

function dashboardAssignmentRecordedAt(assignment) {
  return String(
    assignment?.recordedAt ??
    assignment?.recorded_at ??
    assignment?.requested_at_iso8601 ??
    assignment?.created_at ??
    ""
  );
}

function dashboardSessionStatus(artefact) {
  return String(
    artefact?.session_status ??
    artefact?.status ??
    "recorded"
  ).toLowerCase();
}

function dashboardSessionDate(artefact) {
  return String(
    artefact?.recorded_at ??
    artefact?.updated_at ??
    artefact?.created_at ??
    ""
  );
}

function dashboardSessionIsOpen(artefact) {
  return new Set([
    "not_started",
    "in_progress",
    "split",
    "stopped",
    "returned",
    "returnable",
    "paused"
  ]).has(
    dashboardSessionStatus(artefact)
  );
}

function dashboardEventDate(eventRecord) {
  const plan =
    typeof coachEventPlan === "function"
      ? coachEventPlan(eventRecord)
      : null;

  return String(
    plan?.event_date ??
    eventRecord?.event_date ??
    ""
  );
}

function dashboardEventName(eventRecord) {
  const plan =
    typeof coachEventPlan === "function"
      ? coachEventPlan(eventRecord)
      : null;

  return String(
    plan?.event_name ??
    eventRecord?.event_name ??
    "Event"
  );
}

function dashboardEventType(eventRecord) {
  const plan =
    typeof coachEventPlan === "function"
      ? coachEventPlan(eventRecord)
      : null;

  return String(
    plan?.event_type ??
    eventRecord?.event_type ??
    "event"
  );
}

function dashboardEventId(eventRecord) {
  return String(
    eventRecord?.event_id ??
    eventRecord?.id ??
    ""
  );
}

function dashboardProgrammeName(assignment) {
  const templateId =
    dashboardAssignmentTemplateId(
      assignment
    );

  const template =
    state.coachTemplates.find(
      (entry) =>
        String(
          entry.template_id ??
          entry.id ??
          ""
        ) === templateId
    );

  return String(
    template?.template_name ??
    assignment?.template_name ??
    assignment?.programme_name ??
    templateId ??
    "Programme"
  );
}

function dashboardEmptyState(
  heading,
  detail
) {
  return `
    <div class="empty-state dashboard-empty-state">
      <h4>${escapeHtml(heading)}</h4>
      <p>${escapeHtml(detail)}</p>
    </div>
  `;
}

function dashboardActionButton(
  label,
  action,
  values = {}
) {
  const attributes =
    Object.entries(values)
      .filter(([, value]) =>
        String(value ?? "").length > 0
      )
      .map(([key, value]) =>
        `data-${escapeHtml(key)}="${escapeHtml(value)}"`
      )
      .join(" ");

  return `
    <button
      class="button secondary small-button"
      type="button"
      data-dashboard-action="${escapeHtml(action)}"
      ${attributes}
    >
      ${escapeHtml(label)}
    </button>
  `;
}

function bindCoachDashboardActions() {
  for (
    const button of
    document.querySelectorAll(
      "[data-dashboard-action]"
    )
  ) {
    button.addEventListener(
      "click",
      async () => {
        const action =
          button.dataset.dashboardAction;

        const athleteUserId =
          button.dataset.athleteId ?? "";

        const eventId =
          button.dataset.eventId ?? "";

        if (action === "open-athlete") {
          setView("athletes");

          await openAthleteProfile(
            athleteUserId
          );

          return;
        }

        if (action === "open-assignment") {
          setView("athletes");

          await openAthleteProfile(
            athleteUserId
          );

          elements.athleteAssignmentPanel
            ?.scrollIntoView({
              behavior: "smooth",
              block: "start"
            });

          return;
        }

        if (action === "open-review") {
          setView("review");
          renderCoachSelectors();

          elements.reviewAthlete.value =
            athleteUserId;

          await loadCoachReview();

          return;
        }

        if (action === "open-event") {
          if (eventId) {
            location.hash =
              `#/coach/events/${encodeURIComponent(eventId)}`;
          }

          setView("events");
          return;
        }

        if (action === "open-programmes") {
          setView("templates");
        }
      }
    );
  }
}

function renderCoachDashboard() {
  if (
    !elements.coachOverviewAssignments ||
    !elements.coachOverviewOpenSessions ||
    !elements.coachOverviewReviewQueue ||
    !elements.coachOverviewEvents
  ) {
    return;
  }

  const artefacts =
    Array.isArray(
      state.coachDashboardArtefacts
    )
      ? state.coachDashboardArtefacts
      : [];

  const reviewRecords =
    Array.isArray(
      state.coachReviewRecords
    )
      ? state.coachReviewRecords
      : [];

  const reviewArtefacts =
    reviewRecords.map((record) => ({
      athlete:
        reviewAthleteForRecord(record) ?? {
          userId:
            String(
              record.athlete_user_id ??
              ""
            ),
          displayName:
            reviewAthleteName(record)
        },
      artefact: record
    }));

  const dashboardArtefacts =
    reviewArtefacts.length > 0
      ? reviewArtefacts
      : artefacts;

  const openSessions =
    dashboardArtefacts
      .filter((entry) =>
        dashboardSessionIsOpen(
          entry.artefact
        )
      )
      .sort((left, right) =>
        dashboardSessionDate(
          right.artefact
        ).localeCompare(
          dashboardSessionDate(
            left.artefact
          )
        )
      );

  const completedSessions =
    dashboardArtefacts
      .filter((entry) =>
        !dashboardSessionIsOpen(
          entry.artefact
        ) &&
        String(
          entry.artefact
            .review_status ??
          "unreviewed"
        ) === "unreviewed"
      )
      .sort((left, right) =>
        dashboardSessionDate(
          right.artefact
        ).localeCompare(
          dashboardSessionDate(
            left.artefact
          )
        )
      );

  const assignedAthleteIds =
    new Set(
      state.coachAssignments
        .map(
          dashboardAssignmentAthleteId
        )
        .filter(Boolean)
    );

  const assignmentActions =
    state.coachAthletes.filter(
      (athlete) =>
        !assignedAthleteIds.has(
          athlete.userId
        )
    );

  const today =
    typeof todayDateOnly === "function"
      ? todayDateOnly()
      : new Date()
          .toISOString()
          .slice(0, 10);

  const upcomingEvents =
    state.coachEvents
      .filter((eventRecord) => {
        const eventDate =
          dashboardEventDate(eventRecord);

        return (
          eventDate &&
          eventDate >= today
        );
      })
      .sort((left, right) =>
        dashboardEventDate(left)
          .localeCompare(
            dashboardEventDate(right)
          )
      );

  elements.coachAthleteCount.textContent =
    String(
      state.coachAthletes.length
    );

  elements.coachAssignmentCount.textContent =
    String(
      state.coachAssignments.length
    );

  elements.coachArtefactCount.textContent =
    String(
      artefacts.length
    );

  elements.coachOpenSessionCount.textContent =
    String(
      openSessions.length
    );

  elements.coachCompletedSessionCount.textContent =
    String(
      completedSessions.length
    );

  elements.coachUpcomingEventCount.textContent =
    String(
      upcomingEvents.length
    );

  const pendingRelationshipInvitations =
    (
      Array.isArray(state.coachRelationships)
        ? state.coachRelationships
        : []
    ).filter(
      (entry) =>
        relationshipEffectiveState(entry) === "invited"
    );

  const pendingRelationshipsSummary = `
    <p class="dashboard-pending-summary">
      ${
        pendingRelationshipInvitations.length
          ? `${pendingRelationshipInvitations.length} pending athlete invitation${pendingRelationshipInvitations.length === 1 ? "" : "s"} awaiting acceptance.`
          : "No pending athlete invitations."
      }
    </p>
  `;

  elements.coachOverviewAthletes.innerHTML =
    pendingRelationshipsSummary +
    (state.coachAthletes.length
      ? state.coachAthletes
          .slice(0, 6)
          .map(coachAthleteCard)
          .join("")
      : dashboardEmptyState(
          "No connected athletes",
          "Connect an athlete to begin programme assignment and session review."
        ));

  elements.coachOverviewAssignments.innerHTML =
    assignmentActions.length
      ? assignmentActions
          .slice(0, 8)
          .map((athlete) => `
            <article class="record-card dashboard-record-card">
              <div>
                <h4>${escapeHtml(athlete.displayName)}</h4>
                <p>No programme assignment is currently recorded.</p>
              </div>

              <div class="record-meta">
                <span class="badge neutral">
                  Action required
                </span>

                ${dashboardActionButton(
                  "Open profile",
                  "open-assignment",
                  {
                    "athlete-id": athlete.userId
                  }
                )}
              </div>
            </article>
          `)
          .join("")
      : dashboardEmptyState(
          "No assignment actions",
          state.coachAthletes.length
            ? "Every connected athlete has at least one recorded assignment."
            : "Connect an athlete before creating an assignment."
        );

  elements.coachOverviewOpenSessions.innerHTML =
    openSessions.length
      ? openSessions
          .slice(0, 8)
          .map(({ athlete, artefact }) => `
            <article class="record-card dashboard-record-card">
              <div>
                <h4>
                  ${escapeHtml(
                    athlete.displayName
                  )}
                </h4>

                <p>
                  ${escapeHtml(
                    titleCase(
                      dashboardSessionStatus(
                        artefact
                      )
                    )
                  )}
                  ·
                  ${Number(
                    artefact.runtime_event_count ??
                    0
                  )}
                  recorded events
                </p>
              </div>

              <div class="record-meta">
                <span class="badge neutral">
                  ${escapeHtml(
                    formatDate(
                      dashboardSessionDate(
                        artefact
                      )
                    )
                  )}
                </span>

                ${dashboardActionButton(
                  "Open live status",
                  "open-review",
                  {
                    "athlete-id":
                      athlete.userId
                  }
                )}
              </div>
            </article>
          `)
          .join("")
      : dashboardEmptyState(
          "No open sessions",
          "No connected athlete currently has an open recorded session."
        );

  elements.coachOverviewReviewQueue.innerHTML =
    completedSessions.length
      ? completedSessions
          .slice(0, 8)
          .map(({ athlete, artefact }) => `
            <article class="record-card dashboard-record-card">
              <div>
                <h4>
                  ${escapeHtml(
                    athlete.displayName
                  )}
                </h4>

                <p>
                  ${escapeHtml(
                    titleCase(
                      dashboardSessionStatus(
                        artefact
                      )
                    )
                  )}
                  ·
                  ${Number(
                    artefact.runtime_event_count ??
                    0
                  )}
                  recorded events
                </p>
              </div>

              <div class="record-meta">
                <span class="badge complete">
                  ${escapeHtml(
                    formatDate(
                      dashboardSessionDate(
                        artefact
                      )
                    )
                  )}
                </span>

                ${dashboardActionButton(
                  "Review record",
                  "open-review",
                  {
                    "athlete-id":
                      athlete.userId
                  }
                )}
              </div>
            </article>
          `)
          .join("")
      : dashboardEmptyState(
          "No completed session records",
          "Completed athlete sessions will appear here when factual artefacts are available."
        );

  elements.coachOverviewEvents.innerHTML =
    upcomingEvents.length
      ? upcomingEvents
          .slice(0, 8)
          .map((eventRecord) => {
            const eventDate =
              dashboardEventDate(
                eventRecord
              );

            return `
              <article class="record-card dashboard-record-card">
                <div>
                  <h4>
                    ${escapeHtml(
                      dashboardEventName(
                        eventRecord
                      )
                    )}
                  </h4>

                  <p>
                    ${escapeHtml(
                      titleCase(
                        dashboardEventType(
                          eventRecord
                        )
                      )
                    )}
                    ·
                    ${escapeHtml(
                      formatDate(eventDate)
                    )}
                    ·
                    ${escapeHtml(
                      countdownLabel(eventDate)
                    )}
                  </p>
                </div>

                <div class="record-meta">
                  <span class="badge neutral">
                    ${Number(
                      eventRecord.linked_athlete_count ??
                      0
                    )}
                    athlete links
                  </span>

                  ${dashboardActionButton(
                    "Open event",
                    "open-event",
                    {
                      "event-id":
                        dashboardEventId(
                          eventRecord
                        )
                    }
                  )}
                </div>
              </article>
            `;
          })
          .join("")
      : dashboardEmptyState(
          "No upcoming events",
          "Create an event date anchor to display it on the coach dashboard."
        );

  if (
    typeof bindCoachAthleteActions ===
    "function"
  ) {
    bindCoachAthleteActions();
  }

  bindCoachDashboardActions();

  const failures =
    Array.isArray(
      state.coachDashboardFailures
    )
      ? state.coachDashboardFailures
      : [];

  if (failures.length > 0) {
    elements.coachDashboardStatus.textContent =
      `Dashboard refreshed with ${failures.length} unavailable athlete record set${failures.length === 1 ? "" : "s"}. Available factual records are shown.`;

    elements.coachDashboardStatus.classList.add(
      "dashboard-status-warning"
    );
  }
  else if (state.coachDashboardUpdatedAt) {
    elements.coachDashboardStatus.textContent =
      `Dashboard refreshed ${formatDate(state.coachDashboardUpdatedAt)}.`;

    elements.coachDashboardStatus.classList.remove(
      "dashboard-status-warning"
    );
  }
}

async function refreshCoachDashboard(
  options = {}
) {
  if (
    state.role !== "coach" ||
    !state.profile?.coachUserId
  ) {
    return;
  }

  if (!options.quiet) {
    showBusy(
      "Refreshing coach dashboard…"
    );
  }

  elements.coachDashboardStatus.textContent =
    "Refreshing factual coach records…";

  try {
    const refreshers = [];

    if (
      typeof refreshCoachAthletes ===
      "function"
    ) {
      refreshers.push(
        refreshCoachAthletes({
          quiet: true
        })
      );
    }

    if (
      typeof refreshCoachAssignments ===
      "function"
    ) {
      refreshers.push(
        refreshCoachAssignments({
          quiet: true
        })
      );
    }

    if (
      typeof refreshCoachEvents ===
      "function"
    ) {
      refreshers.push(
        refreshCoachEvents({
          quiet: true
        })
      );
    }

    if (
      typeof refreshTemplates ===
      "function"
    ) {
      refreshers.push(
        refreshTemplates({
          quiet: true
        })
      );
    }

    await Promise.all(refreshers);

    const results =
      await Promise.all(
        state.coachAthletes.map(
          async (athlete) => {
            try {
              const response =
                await api(
                  "POST",
                  "/sessions/beta-coach-artefacts",
                  {
                    coach_user_id:
                      state.profile.coachUserId,
                    athlete_user_id:
                      athlete.userId
                  }
                );

              const artefacts =
                Array.isArray(
                  response.artefact_view
                    ?.artefacts
                )
                  ? response.artefact_view
                      .artefacts
                  : [];

              return {
                athlete,
                artefacts,
                failure: null
              };
            }
            catch {
              return {
                athlete,
                artefacts: [],
                failure:
                  athlete.userId
              };
            }
          }
        )
      );

    state.coachDashboardArtefacts =
      results.flatMap(
        ({ athlete, artefacts }) =>
          artefacts.map(
            (artefact) => ({
              athlete,
              artefact
            })
          )
      );

    state.coachDashboardFailures =
      results
        .map((result) =>
          result.failure
        )
        .filter(Boolean);

    try {
      await refreshCoachReviewQueue({
        quiet: true,
        render: false
      });
    }
    catch {
      state.coachReviewRecords = [];
      state.coachDashboardFailures = [
        ...state.coachDashboardFailures,
        "__review_state__"
      ];
    }

    state.coachDashboardUpdatedAt =
      nowIso();

    state.coachArtefactCount =
      state.coachDashboardArtefacts.length;

    saveState();
    renderCoachDashboard();

    if (!options.quiet) {
      showNotice(
        "Coach dashboard refreshed."
      );
    }
  }
  finally {
    if (!options.quiet) {
      hideBusy();
    }
  }
}

function renderCoachWorkspace() {
  const cards =
    state.coachAthletes.length
      ? state.coachAthletes
          .map(coachAthleteCard)
          .join("")
      : '<div class="empty-state"><p>No accepted athletes are connected yet.</p></div>';

  elements.coachAthleteCount.textContent =
    String(
      state.coachAthletes.length
    );

  elements.coachAssignmentCount.textContent =
    String(
      state.coachAssignments.length
    );

  elements.coachArtefactCount.textContent =
    String(
      state.coachArtefactCount
    );

  elements.coachOverviewAthletes.innerHTML =
    cards;

  renderCoachAthleteDirectory();
  bindCoachAthleteActions();
  renderCoachSelectors();

  if (
    state.selectedCoachAthleteId &&
    state.athleteProfileDraft
  ) {
    renderAthleteProfileEditor();
    renderAthleteProfileAssignment();
  }
}

async function recordAssignment(event) {
  event.preventDefault();

  const athleteUserId = elements.assignmentAthlete.value;
  const athlete = state.coachAthletes.find((entry) => entry.userId === athleteUserId);
  const template = state.coachTemplates.find(
    (entry) => entry.template_id === elements.assignmentTemplate.value
  );

  if (!athlete) {
    throw new Error("Select a connected athlete.");
  }

  if (!template || template.template_status !== "active") {
    throw new Error("Select an active template.");
  }

  if (template.activity_id !== athlete.activityId) {
    throw new Error("The programme activity does not match the athlete activity.");
  }

  if (!renderAssignmentRequirements()) {
    throw new Error("Complete the athlete strength references required by this programme before assigning it.");
  }

  const current = currentAssignmentForAthlete(athleteUserId);
  const lifecycleAction = current ? "replace" : "create";
  const confirmation = current
    ? `Replace ${assignmentTemplateName(current)} version ${assignmentTemplateVersion(current)} with ${template.template_name} version ${Number(template.template_version)} for ${athlete.displayName}? Existing compiled sessions remain attached to the earlier assignment.`
    : `Assign ${template.template_name} version ${Number(template.template_version)} to ${athlete.displayName}?`;

  if (!globalThis.confirm(confirmation)) return;

  elements.assignmentSubmitButton.disabled = true;
  showBusy(current ? "Replacing assignment…" : "Recording assignment…");

  try {
    const timestamp = nowIso();
    const response = current
      ? await api(
          "POST",
          `/coach-workspace/athlete-assignment/${encodeURIComponent(current.assignmentId)}/replace`,
          {
            request_id: createId("assignment_replace"),
            requested_at_iso8601: timestamp,
            coach_user_id: state.profile.coachUserId,
            athlete_user_id: athleteUserId,
            template_id: template.template_id,
            activity_id: athlete.activityId,
            event_id: ""
          }
        )
      : await api("POST", "/sessions/beta-coach-assignment", {
          request_id: createId("assignment_request"),
          requested_at_iso8601: timestamp,
          coach_user_id: state.profile.coachUserId,
          athlete_user_id: athleteUserId,
          template_id: template.template_id,
          activity_id: athlete.activityId
        });

    await Promise.all([
      refreshCoachAssignments({ quiet: true }),
      refreshAthleteDetail(athleteUserId, { quiet: true }).catch(() => null)
    ]);

    saveState();
    elements.assignmentResult.textContent = current
      ? `${template.template_name} version ${Number(template.template_version)} replaced the current assignment. ${Number(response.preserved_session_count ?? 0)} existing session${Number(response.preserved_session_count ?? 0) === 1 ? "" : "s"} remain attached to the earlier assignment.`
      : `${template.template_name} version ${Number(template.template_version)} assigned to ${athlete.displayName}. Percentage-based loads will resolve from the athlete profile when each session is created.`;
    elements.assignmentResult.hidden = false;
    renderCoachWorkspace();
    renderAssignmentLifecycleSurfaces();
    showNotice(lifecycleAction === "replace" ? "Assignment replaced." : "Assignment recorded.");
  }
  finally {
    elements.assignmentSubmitButton.disabled = false;
    hideBusy();
  }
}

// FULL-UI-06 immutable assignment lifecycle presentation.
// This surface displays persisted assignment actions and never changes engine truth.
function assignmentRecordsForAthlete(athleteUserId) {
  return state.coachAssignments
    .filter((assignment) => assignment.athleteUserId === String(athleteUserId ?? ""))
    .sort((left, right) => String(right.recordedAt ?? "").localeCompare(String(left.recordedAt ?? "")));
}

function currentAssignmentForAthlete(athleteUserId) {
  const records = assignmentRecordsForAthlete(athleteUserId);
  return records.find((assignment) => assignment.isCurrent === true) ??
    (records[0]?.assignmentStatus === "assigned" ? records[0] : null);
}

function assignmentTemplateRecord(assignment) {
  return state.coachTemplates.find(
    (template) => String(template.template_id ?? "") === String(assignment?.templateId ?? assignment?.record?.template_id ?? "")
  ) ?? null;
}

function assignmentTemplateName(assignment) {
  return String(
    assignment?.templateName ??
    assignment?.record?.template_name ??
    assignmentTemplateRecord(assignment)?.template_name ??
    assignment?.templateId ??
    "Programme"
  );
}

function assignmentTemplateVersion(assignment) {
  return Number(
    assignment?.templateVersion ??
    assignment?.record?.template_version ??
    assignmentTemplateRecord(assignment)?.template_version ??
    0
  );
}

function assignmentStateBadge(status) {
  const stateValue = String(status ?? "assigned");
  if (stateValue === "cancelled") return '<span class="badge warning">Cancelled</span>';
  if (stateValue === "replaced") return '<span class="badge neutral">Replaced</span>';
  return '<span class="badge complete">Current</span>';
}

function assignmentHistoryCards(athleteUserId) {
  const records = assignmentRecordsForAthlete(athleteUserId);

  if (records.length === 0) {
    return `
      <div class="empty-state compact-empty">
        <h4>No assignment history</h4>
        <p>Programme assignments will appear here after they are recorded.</p>
      </div>
    `;
  }

  return records.map((assignment) => {
    const eventId = String(assignment.eventId ?? assignment.record?.event_id ?? "");
    const eventRecord = state.coachEvents.find((candidate) => String(candidate.event_id ?? "") === eventId);
    const eventPlan = coachEventPlan(eventRecord);
    const preserved = Number(assignment.preservedSessionCount ?? assignment.record?.preserved_session_count ?? 0);

    return `
      <article class="record-card assignment-history-card" data-assignment-id="${escapeHtml(assignment.assignmentId)}">
        <div>
          <h4>${escapeHtml(assignmentTemplateName(assignment))}</h4>
          <p>${escapeHtml(titleCase(assignment.activityId || assignment.record?.activity_id || "training"))} · ${escapeHtml(formatDate(assignment.recordedAt))}</p>
          <p class="muted small">Assignment ${escapeHtml(assignment.assignmentId)}</p>
          ${eventPlan?.event_name
            ? `<p class="assignment-event-fact"><strong>Event:</strong> ${escapeHtml(eventPlan.event_name)} · ${escapeHtml(formatDate(eventPlan.event_date))}</p>`
            : '<p class="assignment-event-fact muted"><strong>Event:</strong> No event link</p>'}
          ${preserved > 0
            ? `<p class="muted small">${preserved} prior session${preserved === 1 ? "" : "s"} preserved.</p>`
            : ""}
        </div>
        <div class="record-meta">
          ${assignmentStateBadge(assignment.assignmentStatus)}
          <span class="badge neutral">Version ${assignmentTemplateVersion(assignment)}</span>
        </div>
      </article>
    `;
  }).join("");
}

function renderAssignmentCurrent(container, athleteUserId) {
  if (!container) return;
  const current = currentAssignmentForAthlete(athleteUserId);

  container.innerHTML = current
    ? `
      <article class="record-card assignment-current-card">
        <div>
          <p class="eyebrow">Current assignment</p>
          <h4>${escapeHtml(assignmentTemplateName(current))}</h4>
          <p>${escapeHtml(titleCase(current.activityId || "training"))} · Version ${assignmentTemplateVersion(current)}</p>
          <p class="muted small">Assigned ${escapeHtml(formatDate(current.recordedAt))}</p>
        </div>
        <span class="badge complete">Assigned</span>
      </article>
    `
    : `
      <div class="empty-state compact-empty">
        <p>No current programme assignment.</p>
      </div>
    `;
}

function renderAssignmentLifecycleSurfaces() {
  const profileAthleteId = state.selectedCoachAthleteId;
  const workspaceAthleteId = elements.assignmentAthlete?.value ?? "";
  const profileCurrent = currentAssignmentForAthlete(profileAthleteId);
  const workspaceCurrent = currentAssignmentForAthlete(workspaceAthleteId);

  renderAssignmentCurrent(elements.athleteAssignmentCurrent, profileAthleteId);
  renderAssignmentCurrent(elements.assignmentCurrentState, workspaceAthleteId);

  if (elements.athleteAssignmentHistory) {
    elements.athleteAssignmentHistory.innerHTML = assignmentHistoryCards(profileAthleteId);
  }

  if (elements.assignmentHistoryList) {
    elements.assignmentHistoryList.innerHTML = assignmentHistoryCards(workspaceAthleteId);
  }

  if (elements.athleteAssignmentButton) {
    elements.athleteAssignmentButton.textContent = profileCurrent
      ? "Replace assignment"
      : "Assign programme";
  }

  if (elements.assignmentSubmitButton) {
    elements.assignmentSubmitButton.textContent = workspaceCurrent
      ? "Replace assignment"
      : "Record assignment";
  }

  if (elements.athleteAssignmentCancelButton) {
    elements.athleteAssignmentCancelButton.hidden = !profileCurrent;
    elements.athleteAssignmentCancelButton.disabled = !profileCurrent;
  }

  if (elements.assignmentCancelButton) {
    elements.assignmentCancelButton.hidden = !workspaceCurrent;
    elements.assignmentCancelButton.disabled = !workspaceCurrent;
  }
}

async function cancelAssignmentForAthlete(athleteUserId, source = "profile") {
  const athlete = state.coachAthletes.find((entry) => entry.userId === athleteUserId);
  const current = currentAssignmentForAthlete(athleteUserId);

  if (!athlete || !current) {
    throw new Error("No current assignment is available to cancel.");
  }

  const confirmation = `Cancel ${assignmentTemplateName(current)} version ${assignmentTemplateVersion(current)} for ${athlete.displayName}? Future sessions cannot be created from it. Existing compiled sessions and history remain unchanged.`;
  if (!globalThis.confirm(confirmation)) return null;

  const button = source === "workspace"
    ? elements.assignmentCancelButton
    : elements.athleteAssignmentCancelButton;

  if (button) button.disabled = true;
  showBusy("Cancelling future assignment…");

  try {
    const response = await api(
      "POST",
      `/coach-workspace/athlete-assignment/${encodeURIComponent(current.assignmentId)}/cancel`,
      {
        request_id: createId("assignment_cancel"),
        requested_at_iso8601: nowIso(),
        coach_user_id: state.profile.coachUserId,
        athlete_user_id: athleteUserId
      }
    );

    await Promise.all([
      refreshCoachAssignments({ quiet: true }),
      refreshAthleteEventLinks(athleteUserId, { quiet: true }).catch(() => []),
      refreshAthleteDetail(athleteUserId, { quiet: true }).catch(() => null)
    ]);

    const preserved = Number(response.preserved_session_count ?? 0);
    const message = `Assignment cancelled for future session creation. ${preserved} existing session${preserved === 1 ? "" : "s"} remain preserved.`;

    if (source === "workspace") {
      elements.assignmentResult.textContent = message;
      elements.assignmentResult.hidden = false;
    }
    else {
      elements.athleteAssignmentResult.textContent = message;
      elements.athleteAssignmentResult.hidden = false;
    }

    renderCoachWorkspace();
    renderAthleteProfileAssignment();
    renderAssignmentLifecycleSurfaces();
    showNotice("Assignment cancelled. Existing sessions were preserved.");
    return response.assignment ?? null;
  }
  finally {
    if (button) button.disabled = false;
    hideBusy();
  }
}

// FULL-UI-07 durable factual review queue.
// Review state is server-authoritative product state and never changes engine truth.
function reviewAthleteForRecord(record) {
  return state.coachAthletes.find(
    (athlete) =>
      athlete.userId ===
      String(record?.athlete_user_id ?? "")
  ) ?? null;
}

function reviewAthleteName(record) {
  return String(
    reviewAthleteForRecord(record)?.displayName ??
    record?.athlete_display_name ??
    "Connected athlete"
  );
}

function reviewRecordStatus(record) {
  const status =
    String(
      record?.review_status ??
      "unreviewed"
    ).toLowerCase();

  return [
    "reviewed",
    "unreviewed",
    "open"
  ].includes(status)
    ? status
    : "unreviewed";
}

function reviewStatusBadge(record) {
  const status =
    reviewRecordStatus(record);

  if (status === "reviewed") {
    return '<span class="badge complete">Reviewed</span>';
  }

  if (status === "open") {
    return '<span class="badge neutral">Open · read only</span>';
  }

  return '<span class="badge warning">Awaiting review</span>';
}

function reviewRecordDate(record) {
  return String(
    record?.updated_at ??
    record?.created_at ??
    ""
  );
}

function reviewRecordMatches(
  record,
  query
) {
  const assignment =
    record?.assignment_provenance &&
    typeof record.assignment_provenance ===
      "object"
      ? record.assignment_provenance
      : {};

  const eventLink =
    record?.event_provenance &&
    typeof record.event_provenance ===
      "object"
      ? record.event_provenance
      : {};

  return [
    reviewAthleteName(record),
    record?.session_id,
    record?.session_title,
    record?.block_id,
    record?.assignment_id,
    assignment?.template_id,
    assignment?.template_name,
    assignment?.activity_id,
    eventLink?.event_id
  ]
    .map((value) =>
      String(value ?? "")
        .toLowerCase()
    )
    .join(" ")
    .includes(
      String(query ?? "")
        .trim()
        .toLowerCase()
    );
}

function filteredCoachReviewRecords() {
  const selectedAthleteId =
    String(
      elements.reviewAthlete?.value ??
      ""
    );

  const search =
    String(
      elements.reviewSearch?.value ??
      state.coachReviewSearch ??
      ""
    );

  const filter =
    String(
      elements.reviewStatusFilter?.value ??
      state.coachReviewFilter ??
      "awaiting"
    );

  return (
    Array.isArray(
      state.coachReviewRecords
    )
      ? state.coachReviewRecords
      : []
  )
    .filter((record) =>
      !selectedAthleteId ||
      String(
        record.athlete_user_id ??
        ""
      ) === selectedAthleteId
    )
    .filter((record) =>
      reviewRecordMatches(
        record,
        search
      )
    )
    .filter((record) => {
      const status =
        reviewRecordStatus(record);

      if (filter === "all") {
        return true;
      }

      if (filter === "awaiting") {
        return status ===
          "unreviewed";
      }

      return status === filter;
    })
    .sort((left, right) =>
      reviewRecordDate(right)
        .localeCompare(
          reviewRecordDate(left)
        )
    );
}

function reviewRecordCard(record) {
  const status =
    reviewRecordStatus(record);

  const notes =
    Number(record.note_count ?? 0);

  return `
    <article
      class="record-card review-record-card ${state.selectedCoachReviewSessionId === record.session_id ? "selected" : ""}"
      data-review-session-id="${escapeHtml(record.session_id)}"
    >
      <div>
        <p class="eyebrow">${escapeHtml(reviewAthleteName(record))}</p>
        <h3>${escapeHtml(record.session_title ?? "Training session")}</h3>
        <p>${escapeHtml(formatDate(reviewRecordDate(record)))} · ${Number(record.runtime_event_count ?? 0)} recorded events</p>
        <p class="muted small">Session ${escapeHtml(record.session_id)}</p>
      </div>
      <div class="record-meta review-record-actions">
        ${reviewStatusBadge(record)}
        <span class="badge neutral">${notes} note${notes === 1 ? "" : "s"}</span>
        <button
          class="button secondary small-button"
          type="button"
          data-review-action="detail"
          data-session-id="${escapeHtml(record.session_id)}"
        >View details</button>
        ${
          status === "unreviewed"
            ? `
              <button
                class="button primary small-button"
                type="button"
                data-review-action="reviewed"
                data-session-id="${escapeHtml(record.session_id)}"
              >Mark reviewed</button>
            `
            : status === "reviewed"
              ? `
                <button
                  class="button secondary small-button"
                  type="button"
                  data-review-action="unreviewed"
                  data-session-id="${escapeHtml(record.session_id)}"
                >Mark unreviewed</button>
              `
              : ""
        }
        <button
          class="button secondary small-button"
          type="button"
          data-review-action="note"
          data-session-id="${escapeHtml(record.session_id)}"
        >Add note</button>
      </div>
    </article>
  `;
}

function reviewNoteList(record) {
  const notes =
    Array.isArray(record?.notes)
      ? record.notes
      : [];

  if (notes.length === 0) {
    return `
      <div class="empty-state compact-empty">
        <p>No coach notes are recorded for this session.</p>
      </div>
    `;
  }

  return `
    <div class="review-note-list">
      ${notes.map((note) => `
        <article class="review-note-card">
          <div class="record-meta">
            <span class="badge neutral">${
              note.visibility === "athlete_visible"
                ? "Athlete visible"
                : "Coach only"
            }</span>
            <span class="muted small">${escapeHtml(formatDate(note.created_at))}</span>
          </div>
          <p>${escapeHtml(note.note_text ?? "")}</p>
          <p class="muted small">Non-binding product note · not included in engine input</p>
        </article>
      `).join("")}
    </div>
  `;
}

function renderCoachReviewDetail(record) {
  if (
    !elements.reviewDetail ||
    !elements.reviewDetailContent
  ) {
    return;
  }

  if (!record) {
    elements.reviewDetail.hidden =
      true;

    elements.reviewDetailContent.innerHTML =
      "";

    return;
  }

  const assignment =
    record.assignment_provenance &&
    typeof record.assignment_provenance ===
      "object"
      ? record.assignment_provenance
      : {};

  const eventLink =
    record.event_provenance &&
    typeof record.event_provenance ===
      "object"
      ? record.event_provenance
      : {};

  const status =
    reviewRecordStatus(record);

  elements.reviewDetail.hidden =
    false;

  elements.reviewDetailContent.innerHTML = `
    <div class="review-detail-heading">
      <div>
        <p class="eyebrow">Factual session detail</p>
        <h3>${escapeHtml(reviewAthleteName(record))}</h3>
        <p>${escapeHtml(record.session_title ?? "Training session")}</p>
      </div>
      ${reviewStatusBadge(record)}
    </div>

    <dl class="review-fact-grid">
      <div><dt>Session</dt><dd>${escapeHtml(record.session_id)}</dd></div>
      <div><dt>Status</dt><dd>${escapeHtml(titleCase(record.session_status ?? "recorded"))}</dd></div>
      <div><dt>Recorded events</dt><dd>${Number(record.runtime_event_count ?? 0)}</dd></div>
      <div><dt>Planned work items</dt><dd>${Number(record.planned_work_item_count ?? 0)}</dd></div>
      <div><dt>Block</dt><dd>${escapeHtml(record.block_id || "Not recorded")}</dd></div>
      <div><dt>Updated</dt><dd>${escapeHtml(formatDate(reviewRecordDate(record)))}</dd></div>
    </dl>

    <section class="review-provenance">
      <h4>Provenance</h4>
      <dl class="review-fact-grid">
        <div><dt>Assignment</dt><dd>${escapeHtml(record.assignment_id || "Not recorded")}</dd></div>
        <div><dt>Programme</dt><dd>${escapeHtml(assignment.template_name ?? assignment.template_id ?? "Not recorded")}</dd></div>
        <div><dt>Programme version</dt><dd>${Number(assignment.template_version ?? 0) || "Not recorded"}</dd></div>
        <div><dt>Activity</dt><dd>${escapeHtml(titleCase(assignment.activity_id ?? "not recorded"))}</dd></div>
        <div><dt>Event</dt><dd>${escapeHtml(eventLink.event_id ?? "No event link")}</dd></div>
        <div><dt>Artefact</dt><dd>${escapeHtml(record.artefact_id)}</dd></div>
      </dl>
    </section>

    <p class="review-boundary-copy ${
      status === "open"
        ? "live"
        : ""
    }">
      ${
        status === "open"
          ? "Live status is read-only. This surface displays recorded session facts and cannot control or override the active session."
          : "Review state is product metadata only. Marking a record reviewed or unreviewed does not change the session artefact, programme, assignment or engine truth."
      }
    </p>

    <div class="assignment-action-row">
      ${
        status === "unreviewed"
          ? `
            <button
              class="button primary"
              type="button"
              data-review-action="reviewed"
              data-session-id="${escapeHtml(record.session_id)}"
            >Mark reviewed</button>
          `
          : status === "reviewed"
            ? `
              <button
                class="button secondary"
                type="button"
                data-review-action="unreviewed"
                data-session-id="${escapeHtml(record.session_id)}"
              >Mark unreviewed</button>
            `
            : ""
      }
      <button
        class="button secondary"
        type="button"
        data-review-action="note"
        data-session-id="${escapeHtml(record.session_id)}"
      >Add non-binding note</button>
    </div>

    <section>
      <h4>Coach notes</h4>
      ${reviewNoteList(record)}
    </section>
  `;
}

function openReviewNote(record) {
  const athlete =
    reviewAthleteForRecord(record);

  if (!athlete?.relationship) {
    throw new Error(
      "An accepted athlete relationship is required to record a note."
    );
  }

  elements.coachNoteSessionId.value =
    record.session_id;

  elements.coachNoteArtefactId.value =
    record.artefact_id;

  elements.coachNoteForm.dataset.athleteId =
    record.athlete_user_id;

  elements.coachNoteHeading.textContent =
    `Add note for ${athlete.displayName}`;

  elements.coachNoteText.value = "";
  coachNoteDirty = false;
  elements.coachNoteForm.hidden = false;
  elements.coachNoteText.focus();
}

async function setCoachSessionReview(
  record,
  reviewStatus
) {
  if (
    !record ||
    reviewRecordStatus(record) ===
      "open"
  ) {
    throw new Error(
      "Open sessions cannot be marked reviewed."
    );
  }

  const actionCopy =
    reviewStatus === "reviewed"
      ? "Mark this completed session as reviewed?"
      : "Return this completed session to the awaiting-review queue?";

  if (!globalThis.confirm(actionCopy)) {
    return null;
  }

  showBusy(
    reviewStatus === "reviewed"
      ? "Recording reviewed state…"
      : "Returning session to review queue…"
  );

  try {
    const response = await api(
      "POST",
      `/coach-workspace/session-review/${encodeURIComponent(record.session_id)}`,
      {
        request_id:
          createId("session_review"),
        requested_at_iso8601:
          nowIso(),
        coach_user_id:
          state.profile.coachUserId,
        athlete_user_id:
          record.athlete_user_id,
        artefact_id:
          record.artefact_id,
        review_status:
          reviewStatus
      }
    );

    state.selectedCoachReviewSessionId =
      record.session_id;

    await refreshCoachReviewQueue({
      quiet: true,
      render: true
    });

    renderCoachDashboard();

    showNotice(
      reviewStatus === "reviewed"
        ? "Session marked reviewed."
        : "Session returned to the review queue."
    );

    return response.review ?? null;
  }
  finally {
    hideBusy();
  }
}

function bindCoachReviewActions() {
  for (
    const container of [
      elements.reviewList,
      elements.reviewDetailContent
    ]
  ) {
    if (!container) continue;

    for (
      const button of container.querySelectorAll(
        "[data-review-action]"
      )
    ) {
      button.addEventListener(
        "click",
        () => {
          const record =
            state.coachReviewRecords.find(
              (entry) =>
                entry.session_id ===
                button.dataset.sessionId
            );

          if (!record) return;

          const action =
            button.dataset.reviewAction;

          if (action === "detail") {
            state.selectedCoachReviewSessionId =
              record.session_id;

            saveState();
            renderCoachReviewWorkspace();
            return;
          }

          if (action === "note") {
            openReviewNote(record);
            return;
          }

          if (
            action === "reviewed" ||
            action === "unreviewed"
          ) {
            setCoachSessionReview(
              record,
              action
            ).catch(handleError);
          }
        }
      );
    }
  }
}

// FULL-UI-32 coach video review queue. Deliberately a small, self-
// contained subsystem rather than folded into the coachReviewRecords/
// filteredCoachReviewRecords machinery above - a different grain
// (per-exercise video submission, not per-session), with its own list +
// detail + delegated-action shape mirroring reviewRecordCard/
// renderCoachReviewDetail/bindCoachReviewActions.
function videoFeedbackQueueCard(submission) {
  const selected = state.selectedVideoFeedbackSubmissionId === submission.submission_id;
  return `
    <article class="record-card review-record-card interactive ${selected ? "selected" : ""}" data-video-feedback-queue-id="${escapeHtml(submission.submission_id)}">
      <div>
        <h3>${escapeHtml(submission.exercise_label || "Exercise")}</h3>
        <p>${escapeHtml(formatDate(submission.created_at))}</p>
      </div>
      <div class="record-meta">
        <span class="badge neutral">Awaiting review</span>
      </div>
    </article>
  `;
}

function renderVideoFeedbackDetail(submission) {
  if (!submission) {
    elements.videoFeedbackDetail.hidden = true;
    elements.videoFeedbackDetailContent.innerHTML = "";
    return;
  }

  elements.videoFeedbackDetail.hidden = false;
  elements.videoFeedbackDetailContent.innerHTML = `
    <div class="panel-header">
      <div>
        <p class="eyebrow">${escapeHtml(formatDate(submission.created_at))}</p>
        <h3>${escapeHtml(submission.exercise_label || "Exercise")}</h3>
      </div>
    </div>
    <video class="message-attachment-video" controls preload="metadata"
      ${submission.thumbnail_url ? `poster="${escapeHtml(submission.thumbnail_url)}"` : ""}>
      <source src="${escapeHtml(submission.url)}">
    </video>
    ${submission.caption ? `<p class="muted">${escapeHtml(submission.caption)}</p>` : ""}
    <label class="field">
      <span>Feedback for the athlete</span>
      <textarea id="videoFeedbackReplyText" required maxlength="4000"></textarea>
    </label>
    <button id="submitVideoFeedbackButton" class="button primary" type="button">Send feedback</button>
  `;

  document.getElementById("submitVideoFeedbackButton")?.addEventListener("click", () => {
    submitVideoFeedback(submission.submission_id).catch(handleError);
  });
}

function bindVideoFeedbackQueueActions() {
  for (const card of elements.videoFeedbackQueueList.querySelectorAll("[data-video-feedback-queue-id]")) {
    card.addEventListener("click", () => {
      state.selectedVideoFeedbackSubmissionId = card.dataset.videoFeedbackQueueId;
      renderVideoFeedbackQueueWorkspace();
    });
  }
}

function renderVideoFeedbackQueueWorkspace() {
  if (!elements.videoFeedbackQueueList) return;

  const submissions = Array.isArray(state.coachVideoFeedbackQueue) ? state.coachVideoFeedbackQueue : [];

  elements.videoFeedbackQueueList.innerHTML = submissions.length
    ? submissions.map(videoFeedbackQueueCard).join("")
    : `
      <div class="panel empty-state">
        <div class="empty-icon">V</div>
        <h3>No pending video submissions</h3>
        <p>Athlete form-check videos awaiting your feedback will appear here.</p>
      </div>
    `;

  let selected = submissions.find(
    (submission) => submission.submission_id === state.selectedVideoFeedbackSubmissionId
  ) ?? null;

  if (!selected && submissions.length > 0) {
    selected = submissions[0];
    state.selectedVideoFeedbackSubmissionId = selected.submission_id;
  }

  renderVideoFeedbackDetail(selected);
  bindVideoFeedbackQueueActions();
  saveState();
}

async function refreshVideoFeedbackQueue(options = {}) {
  try {
    const response = await api("GET", "/coach-workspace/video-feedback/queue");
    state.coachVideoFeedbackQueue = Array.isArray(response.submissions) ? response.submissions : [];
    elements.videoFeedbackQueueStatus.textContent = state.coachVideoFeedbackQueue.length
      ? `${state.coachVideoFeedbackQueue.length} video submission${state.coachVideoFeedbackQueue.length === 1 ? "" : "s"} awaiting review.`
      : "No pending video submissions.";
    renderVideoFeedbackQueueWorkspace();
  }
  catch (error) {
    if (!options.quiet) throw error;
    elements.videoFeedbackQueueStatus.textContent = "Video feedback queue could not be loaded.";
  }
}

async function submitVideoFeedback(submissionId) {
  const text = document.getElementById("videoFeedbackReplyText")?.value?.trim();
  if (!text) return;

  showBusy("Sending feedback…");
  try {
    await api(
      "POST",
      `/coach-workspace/video-feedback/submissions/${encodeURIComponent(submissionId)}/feedback`,
      { feedback_text: text }
    );
    state.coachVideoFeedbackQueue = (state.coachVideoFeedbackQueue ?? [])
      .filter((submission) => submission.submission_id !== submissionId);
    state.selectedVideoFeedbackSubmissionId = "";
    showNotice("Feedback sent.");
    elements.videoFeedbackQueueStatus.textContent = state.coachVideoFeedbackQueue.length
      ? `${state.coachVideoFeedbackQueue.length} video submission${state.coachVideoFeedbackQueue.length === 1 ? "" : "s"} awaiting review.`
      : "No pending video submissions.";
    renderVideoFeedbackQueueWorkspace();
  }
  finally {
    hideBusy();
  }
}

function renderCoachReviewWorkspace() {
  if (
    !elements.reviewList ||
    !elements.reviewStatus
  ) {
    return;
  }

  state.coachReviewSearch =
    String(
      elements.reviewSearch?.value ??
      state.coachReviewSearch ??
      ""
    );

  state.coachReviewFilter =
    String(
      elements.reviewStatusFilter?.value ??
      state.coachReviewFilter ??
      "awaiting"
    );

  const records =
    Array.isArray(
      state.coachReviewRecords
    )
      ? state.coachReviewRecords
      : [];

  const counts = {
    all: records.length,
    awaiting:
      records.filter(
        (record) =>
          reviewRecordStatus(record) ===
          "unreviewed"
      ).length,
    reviewed:
      records.filter(
        (record) =>
          reviewRecordStatus(record) ===
          "reviewed"
      ).length,
    open:
      records.filter(
        (record) =>
          reviewRecordStatus(record) ===
          "open"
      ).length
  };

  elements.reviewAllCount.textContent =
    String(counts.all);

  elements.reviewAwaitingCount.textContent =
    String(counts.awaiting);

  elements.reviewReviewedCount.textContent =
    String(counts.reviewed);

  elements.reviewOpenCount.textContent =
    String(counts.open);

  const filtered =
    filteredCoachReviewRecords();

  elements.reviewList.innerHTML =
    filtered.length
      ? filtered
          .map(reviewRecordCard)
          .join("")
      : `
        <div class="panel empty-state">
          <div class="empty-icon">R</div>
          <h3>No matching review records</h3>
          <p>Completed sessions awaiting review, reviewed records and open read-only sessions will appear here.</p>
        </div>
      `;

  let selected =
    records.find(
      (record) =>
        record.session_id ===
        state.selectedCoachReviewSessionId
    ) ?? null;

  if (
    !selected &&
    filtered.length > 0
  ) {
    selected = filtered[0];
    state.selectedCoachReviewSessionId =
      selected.session_id;
  }

  renderCoachReviewDetail(selected);
  bindCoachReviewActions();

  elements.reviewStatus.textContent =
    state.coachReviewUpdatedAt
      ? `Review records refreshed ${formatDate(state.coachReviewUpdatedAt)}. ${counts.awaiting} completed session${counts.awaiting === 1 ? "" : "s"} awaiting review.`
      : "Refresh to load factual review records.";

  saveState();
}

async function refreshCoachReviewQueue(
  options = {}
) {
  const coachUserId =
    String(
      state.profile?.coachUserId ??
      ""
    );

  if (!coachUserId) {
    state.coachReviewRecords = [];
    renderCoachReviewWorkspace();
    return [];
  }

  const response = await api(
    "GET",
    `/coach-workspace/reviews?coach_user_id=${encodeURIComponent(coachUserId)}`
  );

  state.coachReviewRecords =
    Array.isArray(response.records)
      ? response.records
      : [];

  state.coachReviewUpdatedAt =
    nowIso();

  state.coachArtefactCount =
    state.coachReviewRecords.length;

  saveState();

  if (options.render !== false) {
    renderCoachReviewWorkspace();
  }

  if (!options.quiet) {
    showNotice(
      "Review records refreshed."
    );
  }

  return state.coachReviewRecords;
}


async function loadCoachReview() {
  showBusy(
    "Loading factual review records…"
  );

  try {
    await refreshCoachReviewQueue({
      quiet: true,
      render: true
    });
  }
  finally {
    hideBusy();
  }
}

function renderCoachArtefacts(
  athlete,
  artefacts
) {
  state.coachReviewRecords =
    (
      Array.isArray(artefacts)
        ? artefacts
        : []
    ).map((artefact) => ({
      ...artefact,
      athlete_user_id:
        athlete.userId,
      athlete_display_name:
        athlete.displayName,
      review_status:
        dashboardSessionIsOpen(
          artefact
        )
          ? "open"
          : "unreviewed",
      notes: [],
      note_count: 0,
      read_only: true,
      calls_engine: false,
      engine_visible: false
    }));

  renderCoachReviewWorkspace();
}

async function recordCoachNote(event) {
  event.preventDefault();

  const athleteUserId =
    elements.coachNoteForm.dataset
      .athleteId;

  const athlete =
    state.coachAthletes.find(
      (entry) =>
        entry.userId === athleteUserId
    );

  if (!athlete?.relationship) {
    return;
  }

  showBusy("Recording note…");

  try {
    await api(
      "POST",
      "/sessions/beta-coach-notes",
      {
        coach_profile:
          state.coachProfile,
        relationship:
          athlete.relationship,
        athlete_user_id:
          athleteUserId,
        session_id:
          elements.coachNoteSessionId
            .value,
        artefact_id:
          elements.coachNoteArtefactId
            .value,
        note_text:
          elements.coachNoteText
            .value.trim(),
        visibility:
          elements.coachNoteVisibility
            .value
      }
    );

    elements.coachNoteForm.hidden =
      true;
    coachNoteDirty = false;

    if (
      athleteDetailFor(
        athleteUserId
      )
    ) {
      await refreshAthleteDetail(
        athleteUserId,
        {
          quiet: true
        }
      );
    }

    state.selectedCoachReviewSessionId =
      elements.coachNoteSessionId.value;

    await refreshCoachReviewQueue({
      quiet: true,
      render: true
    });

    showNotice(
      "Non-binding coach note recorded."
    );
  }
  finally {
    hideBusy();
  }
}


function templateExerciseOptions(selectedExerciseId = "") {
  return state.templateExercises
    .map((exercise) => `
      <option
        value="${escapeHtml(exercise.exercise_id)}"
        ${exercise.exercise_id === selectedExerciseId ? "selected" : ""}
      >
        ${escapeHtml(exercise.display_name)}
      </option>
    `)
    .join("");
}

function newTemplateWorkItem(index) {
  const exercise = state.templateExercises[index] ?? state.templateExercises[0] ?? null;

  return {
    work_item_id: "",
    order_index: index + 1,
    exercise_id: exercise?.exercise_id ?? "",
    planned_sets: 3,
    prescription_mode: "reps",
    rep_mode: "fixed",
    planned_reps: index === 0 ? 5 : 8,
    rep_min: index === 0 ? 4 : 8,
    rep_max: index === 0 ? 6 : 12,
    tempo: "",
    duration_mode: "fixed",
    planned_duration_seconds: 30,
    duration_min_seconds: 20,
    duration_max_seconds: 40,
    distance_mode: "fixed",
    distance_unit: "meters",
    planned_distance_value: 20,
    distance_min_value: 10,
    distance_max_value: 30,
    load_mode: "percent_1rm",
    percent_1rm: index === 0 ? 75 : 65,
    weight_value: index === 0 ? 100 : 20,
    weight_unit: "kg",
    rest_seconds: index === 0 ? 180 : 120,
    role: index === 0 ? "primary" : "accessory",
    coaching_notes: "",
    segment: "working",
    group_id: "",
    group_type: "straight"
  };
}

function newTemplateSession(orderIndex) {
  return {
    session_id: "",
    order_index: orderIndex,
    title: `Session ${orderIndex}`,
    coaching_notes: "",
    work_items: Array.from({ length: 4 }, (_, index) => newTemplateWorkItem(index))
  };
}

function newTemplateWeek(orderIndex) {
  return {
    week_id: "",
    order_index: orderIndex,
    calendar_start_date: "",
    calendar_end_date: "",
    days_until_event_at_week_start: null,
    partial_week: false,
    sessions: [newTemplateSession(1)]
  };
}

function newTemplateBlock(orderIndex) {
  return {
    block_id: "",
    order_index: orderIndex,
    name: `Block ${orderIndex}`,
    description: "",
    block_type: "general",
    week_count: 1,
    weeks: [newTemplateWeek(1)]
  };
}

function newTemplateDraft() {
  return {
    template_id: "",
    template_family_id: "",
    template_version: 1,
    template_status: "draft",
    template_name: "",
    description: "",
    activity_id: "powerlifting",
    event_plan: null,
    event_compile_summary: null,
    bound_event_id: "",
    bound_event_record_sha256: "",
    blocks: [newTemplateBlock(1)]
  };
}

function storedWorkItemToDraft(workItem, workItemIndex) {
  const repPrescription = workItem?.rep_prescription &&
    typeof workItem.rep_prescription === "object"
    ? workItem.rep_prescription
    : {};

  const durationPrescription = workItem?.duration_prescription &&
    typeof workItem.duration_prescription === "object"
    ? workItem.duration_prescription
    : {};

  const distancePrescription = workItem?.distance_prescription &&
    typeof workItem.distance_prescription === "object"
    ? workItem.distance_prescription
    : {};

  const loadingReference = workItem?.loading_reference &&
    typeof workItem.loading_reference === "object"
    ? workItem.loading_reference
    : {};

  const repMode = repPrescription.type === "range" ? "range" : "fixed";
  const durationMode = durationPrescription.type === "range" ? "range" : "fixed";
  const distanceMode = distancePrescription.type === "range" ? "range" : "fixed";
  const loadMode = loadingReference.type === "load"
    ? "fixed_weight"
    : loadingReference.type === "bodyweight"
      ? "bodyweight"
      : loadingReference.type === "rpe"
        ? "rpe"
        : "percent_1rm";
  const fallbackReps = Number(workItem?.planned_reps ?? 5);
  const fallbackDuration = Number(workItem?.planned_duration_seconds ?? 30);
  const fallbackDistance = Number(workItem?.planned_distance_value ?? 20);

  return {
    work_item_id: String(workItem?.work_item_id ?? ""),
    order_index: Number(workItem?.order_index ?? workItemIndex + 1),
    exercise_id: String(workItem?.exercise_id ?? ""),
    planned_sets: Number(workItem?.planned_sets ?? 3),
    prescription_mode: ["duration", "distance"].includes(workItem?.prescription_mode)
      ? workItem.prescription_mode
      : "reps",
    rep_mode: repMode,
    planned_reps: Number(repPrescription.value ?? fallbackReps),
    rep_min: Number(repPrescription.minimum ?? fallbackReps),
    rep_max: Number(repPrescription.maximum ?? fallbackReps),
    tempo: String(workItem?.tempo ?? ""),
    duration_mode: durationMode,
    planned_duration_seconds: Number(durationPrescription.value ?? fallbackDuration),
    duration_min_seconds: Number(durationPrescription.minimum ?? fallbackDuration),
    duration_max_seconds: Number(durationPrescription.maximum ?? fallbackDuration),
    distance_mode: distanceMode,
    distance_unit: distancePrescription.unit === "feet" ? "feet" : "meters",
    planned_distance_value: Number(distancePrescription.value ?? fallbackDistance),
    distance_min_value: Number(distancePrescription.minimum ?? fallbackDistance),
    distance_max_value: Number(distancePrescription.maximum ?? fallbackDistance),
    load_mode: loadMode,
    percent_1rm: loadingReference.type === "percent_1rm"
      ? Number(loadingReference.value ?? 75)
      : 75,
    weight_value: loadingReference.type === "load"
      ? Number(loadingReference.value ?? 20)
      : 20,
    weight_unit: loadingReference.unit === "lb" ? "lb" : "kg",
    rpe_value: loadingReference.type === "rpe"
      ? Number(loadingReference.value ?? 8)
      : 8,
    rest_seconds: Number(workItem?.rest_seconds ?? 120),
    role: workItem?.role === "primary" ? "primary" : "accessory",
    coaching_notes: String(workItem?.coaching_notes ?? ""),
    segment: ["warm_up", "cool_down"].includes(workItem?.segment) ? workItem.segment : "working",
    group_id: String(workItem?.group_id ?? ""),
    group_type: ["superset", "circuit"].includes(workItem?.group_type) ? workItem.group_type : "straight"
  };
}

function templateRecordToDraft(template) {
  const structure = template?.template_structure && typeof template.template_structure === "object"
    ? template.template_structure
    : {};
  const rawBlocks = Array.isArray(structure.blocks) ? structure.blocks : [];

  const blocks = rawBlocks
    .slice()
    .sort((left, right) => Number(left.order_index) - Number(right.order_index))
    .map((block, blockIndex) => {
      const rawWeeks = Array.isArray(block?.weeks) ? block.weeks : [];

      return {
        block_id: String(block?.block_id ?? ""),
        order_index: Number(block?.order_index ?? blockIndex + 1),
        name: String(block?.name ?? `Block ${blockIndex + 1}`),
        description: String(block?.description ?? ""),
        block_type: ["general", "volume", "strength", "peak", "deload", "custom"].includes(block?.block_type)
          ? block.block_type
          : "general",
        week_count: Number(block?.week_count ?? rawWeeks.length ?? 1),
        calendar_start_date: String(block?.calendar_start_date ?? ""),
        calendar_end_date: String(block?.calendar_end_date ?? ""),
        weeks: rawWeeks
          .slice()
          .sort((left, right) => Number(left.order_index) - Number(right.order_index))
          .map((week, weekIndex) => {
            const days = Array.isArray(week?.days) ? week.days : [];
            const sessions = days
              .slice()
              .sort((left, right) => Number(left.order_index) - Number(right.order_index))
              .flatMap((day) => {
                const daySessions = Array.isArray(day?.sessions) ? day.sessions : [];
                return daySessions
                  .slice()
                  .sort((left, right) => Number(left.order_index) - Number(right.order_index))
                  .map((session, sessionIndex) => ({
                    session_id: String(session?.session_id ?? ""),
                    order_index: Number(day?.order_index ?? session?.order_index ?? sessionIndex + 1),
                    title: String(session?.title ?? `Session ${sessionIndex + 1}`),
                    coaching_notes: String(session?.coaching_notes ?? ""),
                    work_items: (Array.isArray(session?.work_items) ? session.work_items : [])
                      .slice()
                      .sort((left, right) => Number(left.order_index) - Number(right.order_index))
                      .map(storedWorkItemToDraft)
                  }));
              });

            return {
              week_id: String(week?.week_id ?? ""),
              order_index: Number(week?.order_index ?? weekIndex + 1),
              calendar_start_date: String(week?.calendar_start_date ?? ""),
              calendar_end_date: String(week?.calendar_end_date ?? ""),
              days_until_event_at_week_start: Number.isInteger(week?.days_until_event_at_week_start)
                ? Number(week.days_until_event_at_week_start)
                : null,
              partial_week: week?.partial_week === true,
              sessions: sessions.length ? sessions : [newTemplateSession(1)]
            };
          })
      };
    });

  return {
    template_id: String(template?.template_id ?? ""),
    template_family_id: String(template?.template_family_id ?? ""),
    template_version: Number(template?.template_version ?? 1),
    template_status: String(template?.template_status ?? "draft"),
    template_name: String(template?.template_name ?? ""),
    description: String(template?.description ?? ""),
    activity_id: String(template?.activity_id ?? "powerlifting"),
    event_plan: template?.event_plan && typeof template.event_plan === "object"
      ? {
          event_plan_id: String(template.event_plan.event_plan_id ?? ""),
          event_name: String(template.event_plan.event_name ?? ""),
          event_type: String(template.event_plan.event_type ?? ""),
          event_date: String(template.event_plan.event_date ?? ""),
          programme_start_date: String(template.event_plan.programme_start_date ?? ""),
          location: String(template.event_plan.location ?? ""),
          timezone: String(template.event_plan.timezone ?? "Europe/London"),
          notes: String(template.event_plan.notes ?? "")
        }
      : null,
    event_compile_summary: template?.event_compile_summary && typeof template.event_compile_summary === "object"
      ? template.event_compile_summary
      : null,
    bound_event_id: String(template?.bound_event_id ?? ""),
    bound_event_record_sha256: String(template?.bound_event_record_sha256 ?? ""),
    blocks: blocks.length ? blocks : [newTemplateBlock(1)]
  };
}

async function loadTemplateExercises() {
  if (state.templateExercises.length > 0) return state.templateExercises;

  const response = await api("GET", "/templates/exercises");
  state.templateExercises = Array.isArray(response.exercises) ? response.exercises : [];
  saveState();

  if (state.templateExercises.length < 4) {
    throw new Error("The active exercise registry must contain at least four exercises.");
  }

  return state.templateExercises;
}

async function refreshTemplates(options = {}) {
  if (state.role !== "coach") return [];

  const coachUserId = state.profile?.coachUserId ?? "";
  const response = await api(
    "GET",
    `/templates?coach_user_id=${encodeURIComponent(coachUserId)}`
  );

  state.coachTemplates = Array.isArray(response.templates) ? response.templates : [];
  saveState();
  renderTemplateLibrary();
  renderCoachSelectors();

  if (!options.quiet) showNotice("Programme library refreshed.");
  return state.coachTemplates;
}


// FULL-UI-05A: factual programme library presentation.
// These helpers read persisted product records only and do not affect deterministic training computation.
function programmeFamilyId(template) {
  return String(
    template?.template_family_id ??
    template?.template_id ??
    ""
  );
}

function programmeVersionNumber(template) {
  const version = Number(template?.template_version ?? 0);
  return Number.isInteger(version) && version > 0 ? version : 1;
}

function programmeFamilyVersions(template) {
  const familyId = programmeFamilyId(template);

  return state.coachTemplates
    .filter((candidate) => programmeFamilyId(candidate) === familyId)
    .sort((left, right) => (
      programmeVersionNumber(left) - programmeVersionNumber(right) ||
      String(left.updated_at_iso8601 ?? "").localeCompare(
        String(right.updated_at_iso8601 ?? "")
      )
    ));
}

function programmeDisplayState(template) {
  const storedState = String(template?.template_status ?? "draft");

  if (storedState === "draft") return "draft";

  const version = programmeVersionNumber(template);
  const laterPublishedVersion = programmeFamilyVersions(template).some(
    (candidate) =>
      programmeVersionNumber(candidate) > version &&
      ["active", "archived"].includes(String(candidate.template_status ?? ""))
  );

  if (laterPublishedVersion) return "superseded";
  if (storedState === "archived") return "archived";
  if (storedState === "complete") return "complete";
  return "active";
}

function programmeAssignmentUsage(templateId) {
  const records = state.coachAssignments
    .filter((assignment) => {
      const recordedTemplateId = String(
        assignment?.templateId ??
        assignment?.record?.template_id ??
        ""
      );
      const storedStatus = String(
        assignment?.record?.assignment_status ??
        assignment?.assignmentStatus ??
        "assigned"
      );
      return (
        recordedTemplateId === String(templateId ?? "") &&
        storedStatus === "assigned"
      );
    })
    .filter((assignment, index, all) =>
      all.findIndex((candidate) =>
        String(candidate.assignmentId ?? candidate.record?.assignment_id ?? "") ===
        String(assignment.assignmentId ?? assignment.record?.assignment_id ?? "")
      ) === index
    )
    .sort((left, right) => String(
      right?.recordedAt ??
      right?.record?.requested_at_iso8601 ??
      ""
    ).localeCompare(String(
      left?.recordedAt ??
      left?.record?.requested_at_iso8601 ??
      ""
    )));

  const athleteIds = new Set(
    records
      .map((assignment) => String(
        assignment?.athleteUserId ??
        assignment?.record?.assigned_athlete_id ??
        ""
      ))
      .filter(Boolean)
  );

  return {
    records,
    assignmentCount: records.length,
    athleteCount: athleteIds.size,
    latestAt: String(
      records[0]?.recordedAt ??
      records[0]?.record?.requested_at_iso8601 ??
      ""
    )
  };
}

function programmeSearchText(template) {
  const eventPlan =
    template?.event_plan &&
    typeof template.event_plan === "object"
      ? template.event_plan
      : {};

  return [
    template?.template_name,
    template?.description,
    template?.activity_id,
    template?.template_id,
    template?.template_family_id,
    template?.template_version,
    template?.template_status,
    programmeDisplayState(template),
    eventPlan?.event_name,
    eventPlan?.event_type,
    eventPlan?.location
  ]
    .map((value) => String(value ?? "").toLowerCase())
    .join(" ");
}

function filteredProgrammeTemplates() {
  const search = String(state.templateLibrarySearch ?? "")
    .trim()
    .toLowerCase();

  const statusFilter = String(
    state.templateLibraryStatusFilter ?? "all"
  );

  const activityFilter = String(
    state.templateLibraryActivityFilter ?? "all"
  );

  const visible = state.coachTemplates.filter((template) => {
    if (
      statusFilter !== "all" &&
      programmeDisplayState(template) !== statusFilter
    ) {
      return false;
    }

    if (
      activityFilter !== "all" &&
      String(template.activity_id ?? "") !== activityFilter
    ) {
      return false;
    }

    return !search || programmeSearchText(template).includes(search);
  });

  const sortMode = String(state.templateLibrarySort ?? "updated_desc");

  visible.sort((left, right) => {
    if (sortMode === "name_asc") {
      return (
        String(left.template_name ?? "").localeCompare(
          String(right.template_name ?? "")
        ) ||
        programmeVersionNumber(right) - programmeVersionNumber(left)
      );
    }

    if (sortMode === "version_desc") {
      return (
        programmeVersionNumber(right) - programmeVersionNumber(left) ||
        String(left.template_name ?? "").localeCompare(
          String(right.template_name ?? "")
        )
      );
    }

    if (sortMode === "usage_desc") {
      return (
        programmeAssignmentUsage(right.template_id).assignmentCount -
          programmeAssignmentUsage(left.template_id).assignmentCount ||
        String(right.updated_at_iso8601 ?? "").localeCompare(
          String(left.updated_at_iso8601 ?? "")
        )
      );
    }

    return String(right.updated_at_iso8601 ?? "").localeCompare(
      String(left.updated_at_iso8601 ?? "")
    );
  });

  return visible;
}

function programmePreviewRepetitions(workItem) {
  if (workItem?.rep_mode === "range") {
    return `${Number(workItem.rep_min)}–${Number(workItem.rep_max)} reps`;
  }

  return `${Number(workItem?.planned_reps ?? 0)} reps`;
}

function programmePreviewDuration(workItem) {
  if (workItem?.duration_mode === "range") {
    return `Hold ${Number(workItem.duration_min_seconds)}–${Number(workItem.duration_max_seconds)}s`;
  }

  return `Hold ${Number(workItem?.planned_duration_seconds ?? 0)}s`;
}

function programmePreviewDistance(workItem) {
  const unit = workItem?.distance_unit === "feet" ? "ft" : "m";

  if (workItem?.distance_mode === "range") {
    return `${Number(workItem.distance_min_value)}–${Number(workItem.distance_max_value)}${unit}`;
  }

  return `${Number(workItem?.planned_distance_value ?? 0)}${unit}`;
}

function programmePreviewPrescription(workItem) {
  const prescriptionMode = ["duration", "distance"].includes(workItem?.prescription_mode)
    ? workItem.prescription_mode
    : "reps";

  if (prescriptionMode === "duration") return programmePreviewDuration(workItem);
  if (prescriptionMode === "distance") return programmePreviewDistance(workItem);
  return programmePreviewRepetitions(workItem);
}

function programmePreviewLoad(workItem) {
  if (workItem?.load_mode === "bodyweight") return "Bodyweight";

  if (workItem?.load_mode === "fixed_weight") {
    const unit = workItem?.weight_unit === "lb" ? "lb" : "kg";
    return `${Number(workItem?.weight_value ?? 0)} ${unit}`;
  }

  if (workItem?.load_mode === "rpe") {
    return `RPE ${Number(workItem?.rpe_value ?? 0)}`;
  }

  return `${Number(workItem?.percent_1rm ?? 0)}% 1RM`;
}

function programmePreviewHtml(template) {
  const draft = templateRecordToDraft(template);
  const blocks = Array.isArray(draft?.blocks) ? draft.blocks : [];

  if (blocks.length === 0) {
    return `
      <div class="empty-state compact-empty">
        <p>No persisted programme structure is available.</p>
      </div>
    `;
  }

  return blocks.map((block, blockIndex) => `
    <article class="programme-preview-block">
      <div class="programme-preview-block-heading">
        <div>
          <p class="eyebrow">Block ${blockIndex + 1}</p>
          <h5>${escapeHtml(block.name || `Block ${blockIndex + 1}`)}</h5>
        </div>
        <div class="template-status-line">
          <span class="badge neutral">${escapeHtml(titleCase(block.block_type))}</span>
          <span class="badge neutral">${block.weeks.length} week${block.weeks.length === 1 ? "" : "s"}</span>
        </div>
      </div>
      ${block.description
        ? `<p class="muted small">${escapeHtml(block.description)}</p>`
        : ""}
      <div class="programme-preview-weeks">
        ${block.weeks.map((week, weekIndex) => `
          <details class="programme-preview-week" ${blockIndex === 0 && weekIndex === 0 ? "open" : ""}>
            <summary>
              <span>Week ${weekIndex + 1}</span>
              <span>${week.sessions.length} session${week.sessions.length === 1 ? "" : "s"}</span>
            </summary>
            <div class="programme-preview-sessions">
              ${week.sessions.map((session, sessionIndex) => `
                <article class="programme-preview-session">
                  <div class="programme-preview-session-heading">
                    <strong>${escapeHtml(session.title || `Session ${sessionIndex + 1}`)}</strong>
                    <span class="badge neutral">
                      ${session.work_items.length} exercise${session.work_items.length === 1 ? "" : "s"}
                    </span>
                  </div>
                  ${session.coaching_notes
                    ? `<p class="muted small programme-preview-notes">${escapeHtml(session.coaching_notes)}</p>`
                    : ""}
                  <ol>
                    ${session.work_items.map((workItem) => `
                      <li>
                        <div>
                          <strong>${escapeHtml(exerciseDisplayName(workItem.exercise_id))}</strong>
                          <span>${escapeHtml(titleCase(workItem.role))}</span>
                          ${workItem.segment !== "working" ? `<span class="badge neutral">${escapeHtml(titleCase(workItem.segment))}</span>` : ""}
                          ${workItem.group_id ? `<span class="badge neutral">${escapeHtml(titleCase(workItem.group_type))}</span>` : ""}
                        </div>
                        <span>
                          ${Number(workItem.planned_sets)} sets ·
                          ${escapeHtml(programmePreviewPrescription(workItem))} ·
                          ${escapeHtml(programmePreviewLoad(workItem))} ·
                          ${Number(workItem.rest_seconds)}s rest
                          ${workItem.tempo ? ` · Tempo ${escapeHtml(workItem.tempo)}` : ""}
                        </span>
                        ${workItem.coaching_notes
                          ? `<p class="muted small programme-preview-notes">${escapeHtml(workItem.coaching_notes)}</p>`
                          : ""}
                      </li>
                    `).join("")}
                  </ol>
                </article>
              `).join("")}
            </div>
          </details>
        `).join("")}
      </div>
    </article>
  `).join("");
}

function programmeActivationIssues(template) {
  const draft = templateRecordToDraft(template);
  const issues = [];
  const supportedActivities = new Set([
    "powerlifting",
    "general_strength",
    "rugby_union"
  ]);
  const supportedBlockTypes = new Set([
    "general",
    "volume",
    "strength",
    "peak",
    "deload",
    "custom"
  ]);
  const registryIds = new Set(
    state.templateExercises
      .map((exercise) => String(exercise.exercise_id ?? ""))
      .filter(Boolean)
  );

  const addIssue = (code, message, path) => {
    issues.push({ code, message, path });
  };

  if (String(template?.template_status ?? "draft") !== "draft") {
    addIssue(
      "only_draft_can_complete",
      "Only a draft programme can be marked complete.",
      "programme"
    );
  }

  if (!String(draft?.template_name ?? "").trim()) {
    addIssue(
      "template_name_required",
      "Programme name is required.",
      "programme name"
    );
  }

  if (!supportedActivities.has(String(draft?.activity_id ?? ""))) {
    addIssue(
      "activity_id_invalid",
      "Choose a supported activity.",
      "activity"
    );
  }

  const blocks = Array.isArray(draft?.blocks) ? draft.blocks : [];

  if (blocks.length < 1 || blocks.length > 12) {
    addIssue(
      "block_count_invalid",
      "Programme must contain between one and 12 blocks.",
      "blocks"
    );
  }

  const totalWeeks = blocks.reduce(
    (total, block) =>
      total + (Array.isArray(block?.weeks) ? block.weeks.length : 0),
    0
  );

  if (totalWeeks < 1 || totalWeeks > 104) {
    addIssue(
      "total_week_count_invalid",
      "Programme must contain between one and 104 weeks.",
      "weeks"
    );
  }

  blocks.forEach((block, blockIndex) => {
    const blockPath = `Block ${blockIndex + 1}`;
    const weeks = Array.isArray(block?.weeks) ? block.weeks : [];

    if (!supportedBlockTypes.has(String(block?.block_type ?? ""))) {
      addIssue(
        "block_type_invalid",
        `${blockPath} has an unsupported block type.`,
        blockPath
      );
    }

    if (weeks.length < 1 || weeks.length > 52) {
      addIssue(
        "week_count_per_block_invalid",
        `${blockPath} must contain between one and 52 weeks.`,
        blockPath
      );
    }

    weeks.forEach((week, weekIndex) => {
      const weekPath = `${blockPath}, week ${weekIndex + 1}`;
      const sessions = Array.isArray(week?.sessions) ? week.sessions : [];

      if (sessions.length < 1 || sessions.length > 7) {
        addIssue(
          "session_count_per_week_invalid",
          `${weekPath} must contain between one and seven sessions.`,
          weekPath
        );
      }

      sessions.forEach((session, sessionIndex) => {
        const sessionPath = `${weekPath}, session ${sessionIndex + 1}`;
        const workItems = Array.isArray(session?.work_items)
          ? session.work_items
          : [];

        if (workItems.length < 1 || workItems.length > 12) {
          addIssue(
            "session_work_item_count_invalid",
            `${sessionPath} must contain between one and 12 exercises.`,
            sessionPath
          );
        }

        if (String(session?.coaching_notes ?? "").length > 500) {
          addIssue(
            "session_coaching_notes_too_long",
            `${sessionPath} coaching notes must be 500 characters or fewer.`,
            sessionPath
          );
        }

        const exerciseIds = workItems
          .map((workItem) => String(workItem?.exercise_id ?? ""))
          .filter(Boolean);

        if (new Set(exerciseIds).size !== exerciseIds.length) {
          addIssue(
            "duplicate_exercise_in_session",
            `${sessionPath} contains a duplicate exercise.`,
            sessionPath
          );
        }

        const groupOrderIndices = new Map();
        const groupTypes = new Map();
        workItems.forEach((workItem, workItemIndex) => {
          const groupId = String(workItem?.group_id ?? "");
          if (!groupId) return;
          const orderIndices = groupOrderIndices.get(groupId) ?? [];
          orderIndices.push(workItemIndex + 1);
          groupOrderIndices.set(groupId, orderIndices);
          groupTypes.set(groupId, groupTypes.get(groupId) ?? new Set());
          groupTypes.get(groupId).add(String(workItem?.group_type ?? ""));
        });

        for (const [groupId, orderIndices] of groupOrderIndices) {
          if (orderIndices.length < 2) {
            addIssue(
              "work_item_group_too_small",
              `${sessionPath} has a grouped exercise without a partner.`,
              sessionPath
            );
          }

          const sorted = [...orderIndices].sort((a, b) => a - b);
          for (let index = 1; index < sorted.length; index += 1) {
            if (sorted[index] !== sorted[index - 1] + 1) {
              addIssue(
                "work_item_group_not_contiguous",
                `${sessionPath} has a group with non-adjacent exercises.`,
                sessionPath
              );
              break;
            }
          }

          if (groupTypes.get(groupId).size > 1) {
            addIssue(
              "work_item_group_type_mismatch",
              `${sessionPath} has a group with mismatched grouping types.`,
              sessionPath
            );
          }
        }

        workItems.forEach((workItem, workItemIndex) => {
          const itemPath = `${sessionPath}, exercise ${workItemIndex + 1}`;
          const exerciseId = String(workItem?.exercise_id ?? "");

          if (!exerciseId) {
            addIssue(
              "exercise_required",
              `${itemPath} requires an exercise.`,
              itemPath
            );
          }
          else if (registryIds.size > 0 && !registryIds.has(exerciseId)) {
            addIssue(
              "exercise_not_in_active_registry",
              `${itemPath} is not in the active exercise registry.`,
              itemPath
            );
          }

          if (!["primary", "accessory"].includes(String(workItem?.role ?? ""))) {
            addIssue(
              "role_invalid",
              `${itemPath} requires a primary or accessory role.`,
              itemPath
            );
          }

          if (!["warm_up", "working", "cool_down"].includes(String(workItem?.segment ?? ""))) {
            addIssue(
              "work_item_segment_invalid",
              `${itemPath} requires a warm-up, working, or cool-down segment.`,
              itemPath
            );
          }

          const groupType = String(workItem?.group_type ?? "");
          if (!["straight", "superset", "circuit"].includes(groupType)) {
            addIssue(
              "work_item_group_type_invalid",
              `${itemPath} has an unsupported grouping type.`,
              itemPath
            );
          }
          else if (!String(workItem?.group_id ?? "") && groupType !== "straight") {
            addIssue(
              "work_item_group_type_requires_group",
              `${itemPath} has a grouping type without a group.`,
              itemPath
            );
          }

          if (String(workItem?.coaching_notes ?? "").length > 500) {
            addIssue(
              "work_item_coaching_notes_too_long",
              `${itemPath} coaching notes must be 500 characters or fewer.`,
              itemPath
            );
          }

          const sets = Number(workItem?.planned_sets);
          if (!Number.isInteger(sets) || sets < 1 || sets > 20) {
            addIssue(
              "planned_sets_invalid",
              `${itemPath} sets must be between one and 20.`,
              itemPath
            );
          }

          const prescriptionMode = ["duration", "distance"].includes(workItem?.prescription_mode)
            ? workItem.prescription_mode
            : "reps";

          if (!["reps", "duration", "distance"].includes(String(workItem?.prescription_mode ?? "reps"))) {
            addIssue(
              "prescription_mode_invalid",
              `${itemPath} has an unsupported prescription type.`,
              itemPath
            );
          }

          const tempo = String(workItem?.tempo ?? "");
          if (tempo && !/^[0-9Xx]-[0-9Xx]-[0-9Xx]-[0-9Xx]$/u.test(tempo)) {
            addIssue(
              "work_item_tempo_invalid",
              `${itemPath} tempo must look like 3-1-X-0.`,
              itemPath
            );
          }

          if (prescriptionMode === "reps") {
            if (workItem?.rep_mode === "range") {
              const minimum = Number(workItem?.rep_min);
              const maximum = Number(workItem?.rep_max);

              if (
                !Number.isInteger(minimum) ||
                minimum < 1 ||
                minimum > 100
              ) {
                addIssue(
                  "rep_range_min_invalid",
                  `${itemPath} minimum repetitions must be between one and 100.`,
                  itemPath
                );
              }

              if (
                !Number.isInteger(maximum) ||
                maximum < 1 ||
                maximum > 100
              ) {
                addIssue(
                  "rep_range_max_invalid",
                  `${itemPath} maximum repetitions must be between one and 100.`,
                  itemPath
                );
              }

              if (
                Number.isFinite(minimum) &&
                Number.isFinite(maximum) &&
                maximum < minimum
              ) {
                addIssue(
                  "rep_range_order_invalid",
                  `${itemPath} maximum repetitions cannot be lower than the minimum.`,
                  itemPath
                );
              }
            }
            else {
              const repetitions = Number(workItem?.planned_reps);
              if (
                !Number.isInteger(repetitions) ||
                repetitions < 1 ||
                repetitions > 100
              ) {
                addIssue(
                  "planned_reps_invalid",
                  `${itemPath} repetitions must be between one and 100.`,
                  itemPath
                );
              }
            }
          }
          else if (prescriptionMode === "duration") {
            if (!["fixed", "range"].includes(String(workItem?.duration_mode ?? ""))) {
              addIssue(
                "duration_mode_invalid",
                `${itemPath} has an unsupported duration mode.`,
                itemPath
              );
            }
            else if (workItem?.duration_mode === "range") {
              const minimum = Number(workItem?.duration_min_seconds);
              const maximum = Number(workItem?.duration_max_seconds);

              if (!Number.isInteger(minimum) || minimum < 1 || minimum > 1800) {
                addIssue(
                  "duration_range_min_invalid",
                  `${itemPath} minimum hold must be between one and 1,800 seconds.`,
                  itemPath
                );
              }

              if (!Number.isInteger(maximum) || maximum < 1 || maximum > 1800) {
                addIssue(
                  "duration_range_max_invalid",
                  `${itemPath} maximum hold must be between one and 1,800 seconds.`,
                  itemPath
                );
              }

              if (Number.isFinite(minimum) && Number.isFinite(maximum) && maximum < minimum) {
                addIssue(
                  "duration_range_order_invalid",
                  `${itemPath} maximum hold cannot be lower than the minimum.`,
                  itemPath
                );
              }
            }
            else {
              const duration = Number(workItem?.planned_duration_seconds);
              if (!Number.isInteger(duration) || duration < 1 || duration > 1800) {
                addIssue(
                  "planned_duration_seconds_invalid",
                  `${itemPath} hold must be between one and 1,800 seconds.`,
                  itemPath
                );
              }
            }
          }
          else if (prescriptionMode === "distance") {
            if (!["meters", "feet"].includes(String(workItem?.distance_unit ?? ""))) {
              addIssue(
                "distance_unit_invalid",
                `${itemPath} requires meters or feet.`,
                itemPath
              );
            }

            if (!["fixed", "range"].includes(String(workItem?.distance_mode ?? ""))) {
              addIssue(
                "distance_mode_invalid",
                `${itemPath} has an unsupported distance mode.`,
                itemPath
              );
            }
            else if (workItem?.distance_mode === "range") {
              const minimum = Number(workItem?.distance_min_value);
              const maximum = Number(workItem?.distance_max_value);

              if (!Number.isFinite(minimum) || minimum < 0.1 || minimum > 10000) {
                addIssue(
                  "distance_range_min_invalid",
                  `${itemPath} minimum distance must be between 0.1 and 10,000.`,
                  itemPath
                );
              }

              if (!Number.isFinite(maximum) || maximum < 0.1 || maximum > 10000) {
                addIssue(
                  "distance_range_max_invalid",
                  `${itemPath} maximum distance must be between 0.1 and 10,000.`,
                  itemPath
                );
              }

              if (Number.isFinite(minimum) && Number.isFinite(maximum) && maximum < minimum) {
                addIssue(
                  "distance_range_order_invalid",
                  `${itemPath} maximum distance cannot be lower than the minimum.`,
                  itemPath
                );
              }
            }
            else {
              const distance = Number(workItem?.planned_distance_value);
              if (!Number.isFinite(distance) || distance < 0.1 || distance > 10000) {
                addIssue(
                  "planned_distance_value_invalid",
                  `${itemPath} distance must be between 0.1 and 10,000.`,
                  itemPath
                );
              }
            }
          }

          const loadMode = String(workItem?.load_mode ?? "");
          if (!["percent_1rm", "fixed_weight", "bodyweight", "rpe"].includes(loadMode)) {
            addIssue(
              "load_mode_invalid",
              `${itemPath} has an unsupported loading mode.`,
              itemPath
            );
          }
          else if (loadMode === "percent_1rm") {
            const percentage = Number(workItem?.percent_1rm);
            if (!Number.isFinite(percentage) || percentage < 1 || percentage > 100) {
              addIssue(
                "percent_1rm_invalid",
                `${itemPath} percentage must be between one and 100.`,
                itemPath
              );
            }
          }
          else if (loadMode === "fixed_weight") {
            const weight = Number(workItem?.weight_value);
            if (!Number.isFinite(weight) || weight < 0.25 || weight > 1000) {
              addIssue(
                "weight_value_invalid",
                `${itemPath} fixed load must be between 0.25 and 1,000.`,
                itemPath
              );
            }

            if (!["kg", "lb"].includes(String(workItem?.weight_unit ?? ""))) {
              addIssue(
                "weight_unit_invalid",
                `${itemPath} requires kilograms or pounds.`,
                itemPath
              );
            }
          }
          else if (loadMode === "rpe") {
            const rpeValue = Number(workItem?.rpe_value);
            if (!Number.isInteger(rpeValue) || rpeValue < 1 || rpeValue > 10) {
              addIssue(
                "rpe_value_invalid",
                `${itemPath} RPE must be a whole number between one and 10.`,
                itemPath
              );
            }
          }

          const rest = Number(workItem?.rest_seconds);
          if (!Number.isInteger(rest) || rest < 0 || rest > 900) {
            addIssue(
              "rest_seconds_invalid",
              `${itemPath} rest must be between zero and 900 seconds.`,
              itemPath
            );
          }
        });
      });
    });
  });

  if (draft?.event_plan) {
    const summary = localEventCompileSummary(draft);

    if (!summary?.valid) {
      addIssue(
        "event_plan_invalid",
        summary?.reason ?? "Event calendar details are incomplete.",
        "event calendar"
      );
    }
    else {
      if (summary.allocation_state !== "balanced") {
        addIssue(
          "event_week_allocation_unbalanced",
          "Programme weeks must exactly match the event preparation calendar.",
          "event calendar"
        );
      }

      if (
        String(draft.event_plan.event_date ?? "") &&
        String(draft.event_plan.event_date) < todayDateOnly()
      ) {
        addIssue(
          "event_date_in_past",
          "Event date cannot be in the past when the programme is activated.",
          "event date"
        );
      }
    }
  }

  return issues;
}

function programmeVersionFamilyHtml(template) {
  const versions = programmeFamilyVersions(template);

  return versions.map((version) => {
    const displayState = programmeDisplayState(version);
    const isCurrent = version.template_id === template.template_id;

    return `
      <button
        class="programme-version-row template-version-open ${isCurrent ? "current" : ""}"
        type="button"
        data-template-id="${escapeHtml(version.template_id)}"
      >
        <span>
          <strong>Version ${programmeVersionNumber(version)}</strong>
          <small>${escapeHtml(version.template_name ?? "Programme")}</small>
        </span>
        <span>
          ${templateStatusBadge(displayState)}
          <small>${escapeHtml(formatDate(version.updated_at_iso8601))}</small>
        </span>
      </button>
    `;
  }).join("");
}

function programmeUsageHtml(template) {
  const usage = programmeAssignmentUsage(template.template_id);

  if (usage.records.length === 0) {
    return `
      <div class="empty-state compact-empty">
        <p>No assignment records use this exact programme version.</p>
      </div>
    `;
  }

  return `
    <div class="programme-usage-summary">
      <div><span>Assignments</span><strong>${usage.assignmentCount}</strong></div>
      <div><span>Athletes</span><strong>${usage.athleteCount}</strong></div>
      <div><span>Latest</span><strong>${escapeHtml(formatDate(usage.latestAt))}</strong></div>
    </div>
    <div class="programme-assignment-records">
      ${usage.records.map((assignment) => {
        const athleteId = String(
          assignment?.athleteUserId ??
          assignment?.record?.assigned_athlete_id ??
          ""
        );
        const athlete = state.coachAthletes.find(
          (candidate) => candidate.userId === athleteId
        );
        const assignmentId = String(
          assignment?.assignmentId ??
          assignment?.record?.assignment_id ??
          ""
        );
        const recordedAt = String(
          assignment?.recordedAt ??
          assignment?.record?.requested_at_iso8601 ??
          ""
        );
        const assignmentState = String(
          assignment?.record?.assignment_status ??
          "assigned"
        );

        return `
          <article class="programme-assignment-record">
            <div>
              <strong>${escapeHtml(athlete?.displayName ?? athleteId ?? "Athlete")}</strong>
              <small>${escapeHtml(assignmentId)}</small>
            </div>
            <div>
              <span class="badge neutral">${escapeHtml(titleCase(assignmentState))}</span>
              <small>${escapeHtml(formatDate(recordedAt))}</small>
            </div>
          </article>
        `;
      }).join("")}
    </div>
  `;
}

function programmeValidationHtml(template) {
  const issues = programmeActivationIssues(template);

  if (String(template.template_status ?? "") !== "draft") {
    return `
      <div class="assignment-requirements neutral">
        This persisted version is ${escapeHtml(programmeDisplayState(template))}.
        Completion checks apply to draft versions only.
      </div>
    `;
  }

  if (issues.length === 0) {
    return `
      <div class="assignment-requirements complete">
        All visible completion checks pass. The server remains authoritative when the template is marked complete.
      </div>
    `;
  }

  return `
    <div class="assignment-requirements warning">
      ${issues.length} completion issue${issues.length === 1 ? "" : "s"} recorded.
    </div>
    <ol class="programme-validation-list">
      ${issues.map((issue) => `
        <li>
          <strong>${escapeHtml(issue.path)}</strong>
          <span>${escapeHtml(issue.message)}</span>
          <code>${escapeHtml(issue.code)}</code>
        </li>
      `).join("")}
    </ol>
    <button
      class="button secondary small-button programme-validation-edit"
      type="button"
      data-template-id="${escapeHtml(template.template_id)}"
    >
      Open draft builder
    </button>
  `;
}

function renderProgrammeDetail() {
  const template = state.coachTemplates.find(
    (candidate) => candidate.template_id === state.selectedTemplateId
  );

  if (!template) {
    elements.templateDetailPanel.hidden = true;
    return;
  }

  const displayState = programmeDisplayState(template);
  const usage = programmeAssignmentUsage(template.template_id);
  const versions = programmeFamilyVersions(template);
  const counts = templateCounts(templateRecordToDraft(template));
  const eventPlan =
    template?.event_plan &&
    typeof template.event_plan === "object"
      ? template.event_plan
      : null;

  elements.templateDetailPanel.hidden = false;
  elements.templateDetailTitle.textContent =
    template.template_name ?? "Programme";

  elements.templateDetailStatus.innerHTML = `
    ${templateStatusBadge(displayState)}
    <span class="badge neutral">Version ${programmeVersionNumber(template)}</span>
    <span class="badge neutral">${escapeHtml(titleCase(template.activity_id))}</span>
  `;

  elements.templateDetailMeta.innerHTML = `
    <div><span>Family versions</span><strong>${versions.length}</strong></div>
    <div><span>Blocks</span><strong>${counts.blocks}</strong></div>
    <div><span>Weeks</span><strong>${counts.weeks}</strong></div>
    <div><span>Sessions</span><strong>${counts.sessions}</strong></div>
    <div><span>Assignments</span><strong>${usage.assignmentCount}</strong></div>
    <div><span>Updated</span><strong>${escapeHtml(formatDate(template.updated_at_iso8601))}</strong></div>
  `;

  elements.templateDetailDescription.textContent =
    String(template.description ?? "").trim() ||
    "No programme description was recorded.";

  const storedStatus = String(template.template_status ?? "draft");
  const actions = [
    `<button class="button secondary programme-detail-edit" type="button" data-template-id="${escapeHtml(template.template_id)}" ${storedStatus === "draft" ? "" : "hidden"}>Edit draft</button>`,
    `<button class="button secondary programme-detail-complete" type="button" data-template-id="${escapeHtml(template.template_id)}" ${storedStatus === "draft" ? "" : "hidden"}>Save complete template</button>`,
    `<button class="button primary programme-detail-activate" type="button" data-template-id="${escapeHtml(template.template_id)}" ${storedStatus === "complete" ? "" : "hidden"}>Activate programme</button>`,
    `<button class="button secondary programme-detail-duplicate" type="button" data-template-id="${escapeHtml(template.template_id)}" ${storedStatus === "draft" ? "hidden" : ""}>Duplicate version</button>`,
    `<button class="button secondary programme-detail-archive" type="button" data-template-id="${escapeHtml(template.template_id)}" ${storedStatus === "archived" ? "hidden" : ""}>Archive programme</button>`
  ];

  elements.templateDetailActions.innerHTML = actions.join("");
  elements.templateDetailVersionFamily.innerHTML =
    programmeVersionFamilyHtml(template);
  elements.templateDetailUsage.innerHTML =
    programmeUsageHtml(template);
  elements.templateDetailValidation.innerHTML =
    programmeValidationHtml(template);
  elements.templateDetailPreview.innerHTML =
    programmePreviewHtml(template);

  if (eventPlan) {
    elements.templateDetailMeta.insertAdjacentHTML(
      "beforeend",
      `<div><span>Event</span><strong>${escapeHtml(eventPlan.event_name ?? "Event")}</strong></div>`
    );
  }

  for (
    const button of
    elements.templateDetailPanel.querySelectorAll(
      ".template-version-open"
    )
  ) {
    button.addEventListener("click", () => {
      openProgrammeDetail(button.dataset.templateId);
    });
  }

  for (
    const button of
    elements.templateDetailPanel.querySelectorAll(
      ".programme-detail-edit, .programme-validation-edit"
    )
  ) {
    button.addEventListener("click", () => {
      const selected = state.coachTemplates.find(
        (candidate) => candidate.template_id === button.dataset.templateId
      );
      if (selected) openTemplateBuilder(templateRecordToDraft(selected));
    });
  }

  for (
    const button of
    elements.templateDetailPanel.querySelectorAll(
      ".programme-detail-complete"
    )
  ) {
    button.addEventListener("click", () => {
      completeTemplateById(button.dataset.templateId).catch(handleError);
    });
  }

  for (
    const button of
    elements.templateDetailPanel.querySelectorAll(
      ".programme-detail-activate"
    )
  ) {
    button.addEventListener("click", () => {
      activateTemplateById(button.dataset.templateId).catch(handleError);
    });
  }

  for (
    const button of
    elements.templateDetailPanel.querySelectorAll(
      ".programme-detail-duplicate"
    )
  ) {
    button.addEventListener("click", () => {
      duplicateTemplate(button.dataset.templateId).catch(handleError);
    });
  }

  for (
    const button of
    elements.templateDetailPanel.querySelectorAll(
      ".programme-detail-archive"
    )
  ) {
    button.addEventListener("click", () => {
      archiveTemplate(button.dataset.templateId).catch(handleError);
    });
  }
}

function openProgrammeDetail(templateId, options = {}) {
  const template = state.coachTemplates.find(
    (candidate) => candidate.template_id === String(templateId ?? "")
  );

  if (!template) return false;

  state.selectedTemplateId = template.template_id;
  saveState();
  renderProgrammeDetail();

  if (options.updateRoute !== false) {
    location.hash =
      `#/coach/programmes/${encodeURIComponent(template.template_id)}`;
  }

  if (options.scroll !== false) {
    elements.templateDetailPanel.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  }

  return true;
}

function closeProgrammeDetail(options = {}) {
  state.selectedTemplateId = "";
  saveState();
  elements.templateDetailPanel.hidden = true;

  if (options.updateRoute !== false) {
    location.hash = "#/coach/programmes";
  }
}

async function refreshProgrammeLibrary(options = {}) {
  if (state.role !== "coach" || !state.profile?.coachUserId) return [];

  elements.templateLibraryStatus.textContent = "Loading programme records…";

  if (!options.quiet) showBusy("Loading programme library…");

  try {
    const outcomes = await Promise.allSettled([
      refreshTemplates({ quiet: true }),
      refreshCoachAssignments({ quiet: true }),
      loadTemplateExercises()
    ]);

    const failures = outcomes.filter(
      (outcome) => outcome.status === "rejected"
    );

    for (const failure of failures) {
      console.error(failure.reason);
    }

    renderTemplateLibrary();

    elements.templateLibraryStatus.textContent = failures.length
      ? `${failures.length} programme data source${failures.length === 1 ? "" : "s"} could not be refreshed. Persisted records remain visible.`
      : `Updated ${new Intl.DateTimeFormat("en-GB", {
          hour: "2-digit",
          minute: "2-digit"
        }).format(new Date())}.`;

    if (failures.length > 0 && !options.quiet) {
      showNotice(
        "Some programme records could not be refreshed.",
        "error"
      );
    }

    return state.coachTemplates;
  }
  finally {
    if (!options.quiet) hideBusy();
  }
}
function templateStatusBadge(status) {
  if (status === "active") {
    return '<span class="badge complete">Active</span>';
  }

  if (status === "archived") {
    return '<span class="badge neutral">Archived</span>';
  }

  if (status === "superseded") {
    return '<span class="badge warning">Superseded</span>';
  }

  if (status === "complete") {
    return '<span class="badge status-complete">Complete</span>';
  }

  return '<span class="badge active">Draft</span>';
}

function templateCard(template) {
  const storedStatus = String(template.template_status ?? "draft");
  const displayState = programmeDisplayState(template);
  const sessionCount = Number(template.session_count ?? 0);
  const blockCount = Number(
    template.block_count ??
    template.template_structure?.blocks?.length ??
    1
  );
  const weekCount = Number(template.week_count ?? 0);
  const version = programmeVersionNumber(template);
  const versions = programmeFamilyVersions(template);
  const usage = programmeAssignmentUsage(template.template_id);
  const eventPlan =
    template?.event_plan &&
    typeof template.event_plan === "object"
      ? template.event_plan
      : null;

  const eventLine = eventPlan
    ? `
      <div class="template-event-line">
        <span class="badge neutral">${escapeHtml(titleCase(eventPlan.event_type))}</span>
        <strong>${escapeHtml(eventPlan.event_name)}</strong>
        <span>${escapeHtml(formatDate(eventPlan.event_date))}</span>
        <span>${escapeHtml(countdownLabel(eventPlan.event_date))}</span>
      </div>
    `
    : "";

  const editAction = storedStatus === "draft"
    ? `<button class="button secondary small-button template-edit" type="button" data-template-id="${escapeHtml(template.template_id)}">Edit</button>`
    : "";

  const completeAction = storedStatus === "draft"
    ? `<button class="button secondary small-button template-complete" type="button" data-template-id="${escapeHtml(template.template_id)}">Mark complete</button>`
    : "";

  const activateAction = storedStatus === "complete"
    ? `<button class="button primary small-button template-activate" type="button" data-template-id="${escapeHtml(template.template_id)}">Activate</button>`
    : "";

  const duplicateAction = storedStatus !== "draft"
    ? `<button class="button secondary small-button template-duplicate" type="button" data-template-id="${escapeHtml(template.template_id)}">Duplicate version</button>`
    : "";

  const archiveAction = storedStatus !== "archived"
    ? `<button class="button secondary small-button template-archive" type="button" data-template-id="${escapeHtml(template.template_id)}">Archive</button>`
    : "";

  return `
    <article
      class="template-card"
      data-template-id="${escapeHtml(template.template_id)}"
      data-template-state="${escapeHtml(displayState)}"
    >
      <div>
        <h3>${escapeHtml(template.template_name)}</h3>
        <p>
          ${escapeHtml(titleCase(template.activity_id))} ·
          Version ${version} of ${versions.length}
        </p>
        <div class="template-card-facts">
          <span>${blockCount} block${blockCount === 1 ? "" : "s"}</span>
          <span>${weekCount} week${weekCount === 1 ? "" : "s"}</span>
          <span>${sessionCount} session${sessionCount === 1 ? "" : "s"}</span>
          <span>${usage.assignmentCount} assignment${usage.assignmentCount === 1 ? "" : "s"}</span>
        </div>
        ${eventLine}
        <div class="template-status-line">
          ${templateStatusBadge(displayState)}
          <span class="badge neutral">${escapeHtml(formatDate(template.updated_at_iso8601))}</span>
        </div>
      </div>
      <div class="template-card-actions">
        <button
          class="button secondary small-button template-detail"
          type="button"
          data-template-id="${escapeHtml(template.template_id)}"
        >
          View detail
        </button>
        ${editAction}
        ${completeAction}
        ${activateAction}
        ${duplicateAction}
        ${archiveAction}
      </div>
    </article>
  `;
}

function bindTemplateLibraryActions() {
  for (
    const button of
    elements.templateLibraryList.querySelectorAll(".template-detail")
  ) {
    button.addEventListener("click", () => {
      openProgrammeDetail(button.dataset.templateId);
    });
  }

  for (
    const button of
    elements.templateLibraryList.querySelectorAll(".template-edit")
  ) {
    button.addEventListener("click", () => {
      const template = state.coachTemplates.find(
        (entry) => entry.template_id === button.dataset.templateId
      );
      if (template) openTemplateBuilder(templateRecordToDraft(template));
    });
  }

  for (
    const button of
    elements.templateLibraryList.querySelectorAll(".template-complete")
  ) {
    button.addEventListener("click", () => {
      completeTemplateById(button.dataset.templateId).catch(handleError);
    });
  }

  for (
    const button of
    elements.templateLibraryList.querySelectorAll(".template-activate")
  ) {
    button.addEventListener("click", () => {
      activateTemplateById(button.dataset.templateId).catch(handleError);
    });
  }

  for (
    const button of
    elements.templateLibraryList.querySelectorAll(".template-duplicate")
  ) {
    button.addEventListener("click", () => {
      duplicateTemplate(button.dataset.templateId).catch(handleError);
    });
  }

  for (
    const button of
    elements.templateLibraryList.querySelectorAll(".template-archive")
  ) {
    button.addEventListener("click", () => {
      archiveTemplate(button.dataset.templateId).catch(handleError);
    });
  }
}

function renderTemplateLibrary() {
  const counts = {
    draft: 0,
    complete: 0,
    active: 0,
    archived: 0,
    superseded: 0
  };

  for (const template of state.coachTemplates) {
    const displayState = programmeDisplayState(template);
    counts[displayState] = Number(counts[displayState] ?? 0) + 1;
  }

  elements.templateDraftCount.textContent = String(counts.draft);
  elements.templateCompleteCount.textContent = String(counts.complete);
  elements.templateActiveCount.textContent = String(counts.active);
  elements.templateArchivedCount.textContent = String(counts.archived);
  elements.templateSupersededCount.textContent = String(counts.superseded);

  elements.templateLibrarySearch.value =
    String(state.templateLibrarySearch ?? "");
  elements.templateLibraryStatusFilter.value =
    String(state.templateLibraryStatusFilter ?? "all");
  elements.templateLibraryActivityFilter.value =
    String(state.templateLibraryActivityFilter ?? "all");
  elements.templateLibrarySort.value =
    String(state.templateLibrarySort ?? "updated_desc");

  const visible = filteredProgrammeTemplates();
  elements.templateLibraryResultCount.textContent =
    `${visible.length} of ${state.coachTemplates.length} programme${state.coachTemplates.length === 1 ? "" : "s"}`;

  if (state.coachTemplates.length === 0) {
    elements.templateLibraryList.innerHTML = `
      <div class="empty-state">
        <h3>No programmes created</h3>
        <p>Create a programme with at least one training block before assigning training.</p>
      </div>
    `;
  }
  else if (visible.length === 0) {
    elements.templateLibraryList.innerHTML = `
      <div class="empty-state">
        <h3>No programmes match these filters</h3>
        <p>Clear or change the search, state or activity filters.</p>
      </div>
    `;
  }
  else {
    elements.templateLibraryList.innerHTML =
      visible.map(templateCard).join("");
  }

  bindTemplateLibraryActions();
  renderProgrammeDetail();
  renderTemplateRecovery();
}

const EVENT_TYPES_BY_ACTIVITY = Object.freeze({
  powerlifting: [
    ["powerlifting_meet", "Powerlifting meet"],
    ["strength_event", "Strength event"],
    ["test_day", "Test day"],
    ["other", "Other event"]
  ],
  general_strength: [
    ["strength_event", "Strength event"],
    ["test_day", "Test day"],
    ["other", "Other event"]
  ],
  rugby_union: [
    ["rugby_match", "Rugby match"],
    ["rugby_tournament", "Rugby tournament"],
    ["test_day", "Test day"],
    ["other", "Other event"]
  ]
});

function eventTypesForActivity(activityId) {
  return EVENT_TYPES_BY_ACTIVITY[activityId] ?? EVENT_TYPES_BY_ACTIVITY.general_strength;
}

function defaultEventType(activityId) {
  return eventTypesForActivity(activityId)[0][0];
}

function ensureDraftEventPlan() {
  const draft = state.templateDraft;
  if (!draft) return null;

  if (!draft.event_plan) {
    const startDate = todayDateOnly();
    draft.event_plan = {
      event_plan_id: "",
      event_name: "",
      event_type: defaultEventType(draft.activity_id),
      event_date: addDateOnlyDays(startDate, 84),
      programme_start_date: startDate,
      location: "",
      timezone: "Europe/London",
      notes: ""
    };
  }

  const allowedTypes = eventTypesForActivity(draft.activity_id).map(([value]) => value);
  if (!allowedTypes.includes(draft.event_plan.event_type)) {
    draft.event_plan.event_type = defaultEventType(draft.activity_id);
  }

  return draft.event_plan;
}

function eventTypeOptions(activityId, selected) {
  return eventTypesForActivity(activityId)
    .map(([value, label]) => `<option value="${value}" ${value === selected ? "selected" : ""}>${escapeHtml(label)}</option>`)
    .join("");
}

function localEventCompileSummary(draft) {
  const eventPlan = draft?.event_plan;
  if (!eventPlan) return null;

  if (!eventPlan.event_name.trim()) {
    return {
      valid: false,
      reason: "Enter an event name."
    };
  }

  if (!eventTypesForActivity(draft.activity_id).some(([value]) => value === eventPlan.event_type)) {
    return {
      valid: false,
      reason: "Choose an event type supported by this activity."
    };
  }

  if (!eventPlan.timezone.trim() || !/^[A-Za-z0-9_+\-/]+$/u.test(eventPlan.timezone.trim())) {
    return {
      valid: false,
      reason: "Enter a valid timezone such as Europe/London."
    };
  }

  const trainingDays = dateOnlyDifference(
    eventPlan.programme_start_date,
    eventPlan.event_date
  );

  if (trainingDays === null || trainingDays < 1) {
    return {
      valid: false,
      reason: "Event date must be after the programme start date."
    };
  }

  const requiredWeeks = Math.ceil(trainingDays / 7);
  if (requiredWeeks < 1 || requiredWeeks > 104) {
    return {
      valid: false,
      reason: "The event calendar must contain between 1 and 104 training weeks."
    };
  }

  const allocatedWeeks = draft.blocks.reduce(
    (total, block) => total + Number(block.weeks?.length ?? block.week_count ?? 0),
    0
  );
  const weekDelta = requiredWeeks - allocatedWeeks;
  let offset = 0;
  const weekSchedules = [];
  const blockSchedules = draft.blocks.map((block) => {
    const weekCount = Number(block.weeks?.length ?? block.week_count ?? 0);
    const startDate = addDateOnlyDays(eventPlan.programme_start_date, offset * 7);
    const theoreticalEnd = addDateOnlyDays(startDate, weekCount * 7 - 1);
    const finalTrainingDate = addDateOnlyDays(eventPlan.event_date, -1);
    const endDate = theoreticalEnd && finalTrainingDate && theoreticalEnd > finalTrainingDate
      ? finalTrainingDate
      : theoreticalEnd;
    const startWeekIndex = offset + 1;

    for (let weekOffset = 0; weekOffset < weekCount; weekOffset += 1) {
      const weekStart = addDateOnlyDays(eventPlan.programme_start_date, (offset + weekOffset) * 7);
      const theoreticalWeekEnd = addDateOnlyDays(weekStart, 6);
      const weekEnd = theoreticalWeekEnd && finalTrainingDate && theoreticalWeekEnd > finalTrainingDate
        ? finalTrainingDate
        : theoreticalWeekEnd;
      const daysAtStart = dateOnlyDifference(weekStart, eventPlan.event_date);

      weekSchedules.push({
        start_date: weekStart,
        end_date: weekEnd,
        days_until_event_at_week_start: daysAtStart,
        partial_week: dateOnlyDifference(weekStart, weekEnd) !== 6
      });
    }

    offset += weekCount;

    return {
      start_date: startDate,
      end_date: endDate,
      start_week_index: startWeekIndex,
      end_week_index: offset
    };
  });

  return {
    valid: true,
    training_day_count: trainingDays,
    required_week_count: requiredWeeks,
    allocated_week_count: allocatedWeeks,
    week_delta: weekDelta,
    allocation_state: weekDelta === 0
      ? "balanced"
      : weekDelta > 0
        ? "under_allocated"
        : "over_allocated",
    partial_final_week_days: trainingDays - ((requiredWeeks - 1) * 7),
    blockSchedules,
    weekSchedules
  };
}

function syncTemplateEventFields() {
  const draft = state.templateDraft;
  if (!draft || !draft.event_plan) return;

  draft.event_plan.event_name = elements.templateEventName.value;
  draft.event_plan.event_type = elements.templateEventType.value;
  draft.event_plan.programme_start_date = elements.templateProgrammeStartDate.value;
  draft.event_plan.event_date = elements.templateEventDate.value;
  draft.event_plan.location = elements.templateEventLocation.value;
  draft.event_plan.timezone = elements.templateEventTimezone.value;
  draft.event_plan.notes = elements.templateEventNotes.value;
  draft.event_compile_summary = null;
  saveState();
}

// FULL-UI-12C: when a template is bound to a standalone event, that event
// remains the single event-date truth. The typed fields below become a
// read-only display of the bound event's own facts - they are never a
// second, independently-editable copy of the date. Only
// bindSelectedEventToTemplate() (an explicit lawful action) may change what
// the template is bound to or pull in a newer event version.
function renderEventBindingPicker() {
  const draft = state.templateDraft;
  if (!draft) return;

  const bound = Boolean(draft.bound_event_id);

  // Preserve whatever the coach has currently picked in the dropdown (which
  // may not be bound yet) across a re-render triggered by their own
  // selection - only a real bind/rebind or a fresh library load should move
  // the selection.
  const previousValue = elements.templateEventBindingSelect.value;

  const options = ['<option value="">— Type event details manually —</option>']
    .concat(
      state.standaloneEventLibrary.map((event) => {
        const label = `${event.event_plan?.event_name ?? event.event_id} · ${formatDate(event.event_plan?.event_date)}`;
        return `<option value="${escapeHtml(event.event_id)}">${escapeHtml(label)}</option>`;
      })
    );

  if (bound && !state.standaloneEventLibrary.some((event) => event.event_id === draft.bound_event_id)) {
    const boundName = draft.event_plan?.event_name || draft.bound_event_id;
    options.push(`<option value="${escapeHtml(draft.bound_event_id)}">${escapeHtml(boundName)} (bound)</option>`);
  }

  elements.templateEventBindingSelect.innerHTML = options.join("");

  const availableValues = new Set(Array.from(elements.templateEventBindingSelect.options).map((option) => option.value));
  elements.templateEventBindingSelect.value = bound
    ? draft.bound_event_id
    : (availableValues.has(previousValue) ? previousValue : "");
  elements.templateEventEnabled.disabled = bound;

  const status = state.templateEventBindingStatus;
  const selectedForBind = elements.templateEventBindingSelect.value;

  if (!bound) {
    elements.bindTemplateEventButton.textContent = "Bind event";
    elements.bindTemplateEventButton.disabled = !selectedForBind;
    elements.templateEventBindingStatus.hidden = true;
    return;
  }

  elements.templateEventBindingStatus.hidden = false;

  if (!status || status.event_id !== draft.bound_event_id) {
    elements.bindTemplateEventButton.textContent = "Rebind event";
    elements.bindTemplateEventButton.disabled = true;
    elements.templateEventBindingStatus.className = "assignment-requirements neutral";
    elements.templateEventBindingStatus.textContent = "Checking the bound event's current state…";
    return;
  }

  if (!status.accessible) {
    elements.bindTemplateEventButton.textContent = "Bind a different event";
    elements.bindTemplateEventButton.disabled = !selectedForBind || selectedForBind === draft.bound_event_id;
    elements.templateEventBindingStatus.className = "assignment-requirements warning";
    elements.templateEventBindingStatus.textContent = "This event is no longer accessible. Select a different event to continue.";
    return;
  }

  if (status.event_status === "cancelled") {
    elements.bindTemplateEventButton.textContent = "Rebind event";
    elements.bindTemplateEventButton.disabled = !selectedForBind || selectedForBind === draft.bound_event_id;
    elements.templateEventBindingStatus.className = "assignment-requirements warning";
    elements.templateEventBindingStatus.textContent = "The bound event has been cancelled. Activation is blocked until you rebind to another event.";
    return;
  }

  if (status.event_status === "archived") {
    elements.bindTemplateEventButton.textContent = "Rebind event";
    elements.bindTemplateEventButton.disabled = !selectedForBind || selectedForBind === draft.bound_event_id;
    elements.templateEventBindingStatus.className = "assignment-requirements warning";
    elements.templateEventBindingStatus.textContent = "The bound event has been archived. Activation is blocked until you rebind to another event.";
    return;
  }

  if (!status.is_current) {
    elements.bindTemplateEventButton.textContent = "Rebind to latest version";
    elements.bindTemplateEventButton.disabled = false;
    elements.templateEventBindingStatus.className = "assignment-requirements warning";
    elements.templateEventBindingStatus.textContent = "This event has a newer version. The programme still shows the date and details bound earlier - rebind to pull in the latest version.";
    return;
  }

  elements.bindTemplateEventButton.textContent = "Bound";
  elements.bindTemplateEventButton.disabled = true;
  elements.templateEventBindingStatus.className = "assignment-requirements complete";
  elements.templateEventBindingStatus.textContent = "This programme is bound to the current version of this event.";
}

function renderEventCompiler() {
  const draft = state.templateDraft;
  if (!draft) return;

  renderEventBindingPicker();

  const bound = Boolean(draft.bound_event_id);
  const enabled = Boolean(draft.event_plan);
  elements.templateEventEnabled.checked = enabled;
  elements.templateEventFields.hidden = !enabled;

  if (!enabled) {
    elements.saveCompleteTemplateButton.disabled = false;
    return;
  }

  const eventPlan = ensureDraftEventPlan();
  elements.templateEventName.value = eventPlan.event_name;
  elements.templateEventType.innerHTML = eventTypeOptions(draft.activity_id, eventPlan.event_type);
  elements.templateProgrammeStartDate.value = eventPlan.programme_start_date;
  elements.templateEventDate.value = eventPlan.event_date;
  elements.templateEventLocation.value = eventPlan.location;
  elements.templateEventTimezone.value = eventPlan.timezone;
  elements.templateEventNotes.value = eventPlan.notes;
  elements.templateEventCountdown.textContent = countdownLabel(eventPlan.event_date);

  for (const field of [
    elements.templateEventName,
    elements.templateEventType,
    elements.templateProgrammeStartDate,
    elements.templateEventDate,
    elements.templateEventLocation,
    elements.templateEventTimezone,
    elements.templateEventNotes
  ]) {
    field.disabled = bound;
  }
  elements.compileEventCalendarButton.disabled = bound;

  const summary = localEventCompileSummary(draft);
  const allocated = templateCounts(draft).weeks;
  elements.templateEventAllocatedWeeks.textContent = String(allocated);

  if (!summary?.valid) {
    elements.templateEventRequiredWeeks.textContent = "—";
    elements.templateEventWeekBalance.textContent = "—";
    elements.templateEventAllocationState.className = "assignment-requirements warning";
    elements.templateEventAllocationState.textContent = summary?.reason ?? "Set a start date and event date to compile the calendar.";
    elements.fitFinalBlockButton.disabled = true;
    elements.saveCompleteTemplateButton.disabled = true;
    return;
  }

  let globalWeekIndex = 0;
  draft.blocks.forEach((block, index) => {
    block.calendar_start_date = summary.blockSchedules[index]?.start_date ?? "";
    block.calendar_end_date = summary.blockSchedules[index]?.end_date ?? "";

    block.weeks.forEach((week) => {
      const calendar = summary.weekSchedules[globalWeekIndex] ?? null;
      globalWeekIndex += 1;
      week.calendar_start_date = calendar?.start_date ?? "";
      week.calendar_end_date = calendar?.end_date ?? "";
      week.days_until_event_at_week_start = calendar?.days_until_event_at_week_start ?? null;
      week.partial_week = calendar?.partial_week === true;
    });
  });

  elements.templateEventRequiredWeeks.textContent = String(summary.required_week_count);
  elements.templateEventWeekBalance.textContent = summary.week_delta === 0
    ? "Balanced"
    : summary.week_delta > 0
      ? `${summary.week_delta} remaining`
      : `${Math.abs(summary.week_delta)} over`;

  const balanced = summary.week_delta === 0;
  elements.templateEventAllocationState.className = balanced
    ? "assignment-requirements complete"
    : "assignment-requirements warning";
  elements.templateEventAllocationState.textContent = balanced
    ? `${summary.required_week_count} training weeks are fully allocated. The final training week contains ${summary.partial_final_week_days} day${summary.partial_final_week_days === 1 ? "" : "s"} before the event.`
    : summary.week_delta > 0
      ? `Allocate ${summary.week_delta} more week${summary.week_delta === 1 ? "" : "s"} before activation.`
      : `Remove ${Math.abs(summary.week_delta)} week${Math.abs(summary.week_delta) === 1 ? "" : "s"} before activation.`;

  const precedingWeeks = draft.blocks.slice(0, -1).reduce((total, block) => total + block.weeks.length, 0);
  const finalTarget = summary.required_week_count - precedingWeeks;
  elements.fitFinalBlockButton.disabled = finalTarget < 1 || finalTarget > 52;

  const status = state.templateEventBindingStatus;
  const bindingBlocksActivation = bound && (
    !status ||
    status.event_id !== draft.bound_event_id ||
    !status.accessible ||
    status.event_status !== "active" ||
    !status.is_current
  );

  elements.saveCompleteTemplateButton.disabled =
    !balanced ||
    eventPlan.event_date < todayDateOnly() ||
    bindingBlocksActivation;
}

async function loadStandaloneEventLibraryForBuilder() {
  if (state.role !== "coach") return [];

  try {
    const response = await api("GET", "/coach-workspace/events/library?status=active");
    state.standaloneEventLibrary = Array.isArray(response.events) ? response.events : [];
  }
  catch {
    // The event library is a convenience picker; a load failure should not
    // block the rest of the builder from working.
    state.standaloneEventLibrary = [];
  }

  if (state.templateDraft) {
    renderEventBindingPicker();
  }

  return state.standaloneEventLibrary;
}

async function loadTemplateEventBindingStatusForDraft() {
  const draft = state.templateDraft;
  if (!draft?.template_id || !draft?.bound_event_id) {
    state.templateEventBindingStatus = null;
    return null;
  }

  const coachUserId = state.profile?.coachUserId ?? "";

  try {
    const response = await api(
      "GET",
      `/templates/${encodeURIComponent(draft.template_id)}/event-binding?coach_user_id=${encodeURIComponent(coachUserId)}`
    );
    state.templateEventBindingStatus = response.bound ? response : null;
  }
  catch {
    state.templateEventBindingStatus = null;
  }

  renderEventCompiler();
  return state.templateEventBindingStatus;
}

async function bindSelectedEventToTemplate() {
  const draft = state.templateDraft;
  if (!draft) return;

  const eventId = elements.templateEventBindingSelect.value;
  if (!eventId) return;

  showBusy("Binding to the selected event…");
  try {
    if (!draft.template_id) {
      await saveTemplateDraft({ quiet: true });
    }

    const response = await api(
      "POST",
      `/templates/${encodeURIComponent(state.templateDraft.template_id)}/bind-event`,
      {
        coach_user_id: state.profile.coachUserId,
        event_id: eventId
      }
    );

    const boundDraft = templateRecordToDraft(response.template);
    state.templateDraft = normalisePersistedTemplateDraft(boundDraft);
    state.templateDraftSavedSnapshot = templateDraftSnapshot(state.templateDraft);
    state.templateDraftSavedAt = String(response.template?.updated_at_iso8601 ?? nowIso());
    state.templateDraftDirty = false;
    saveState();

    await loadTemplateEventBindingStatusForDraft();
    await refreshProgrammeLibrary({ quiet: true });

    openTemplateBuilder(state.templateDraft, {
      preserveBaseline: true,
      skipRecoveryCheck: true
    });

    showNotice("Programme bound to the selected event.");
  }
  finally {
    hideBusy();
  }
}

function eventPreviewPayload() {
  const draft = state.templateDraft;
  if (!draft?.event_plan) throw new Error("Enable the event compiler first.");

  syncTemplateHeader();
  syncTemplateEventFields();
  reindexTemplateDraft();

  return {
    activity_id: draft.activity_id,
    ...draft.event_plan,
    blocks: draft.blocks.map((block) => ({
      block_id: block.block_id,
      order_index: Number(block.order_index),
      name: block.name,
      block_type: block.block_type,
      week_count: block.weeks.length
    }))
  };
}

async function previewEventCalendar() {
  showBusy("Compiling event calendar…");
  try {
    const response = await api(
      "POST",
      "/coach-workspace/event-compile-preview",
      eventPreviewPayload()
    );
    state.templateDraft.event_compile_summary = response.compile;
    if (response.compile?.event_plan_id) {
      state.templateDraft.event_plan.event_plan_id = response.compile.event_plan_id;
    }
    saveState();
    rerenderTemplateBuilder();
    showNotice("Event calendar compiled.");
  }
  finally {
    hideBusy();
  }
}

function resizeBlockWeeks(blockIndex, requestedCount) {
  const block = state.templateDraft?.blocks[blockIndex];
  if (!block) return;

  const totalWithoutBlock = templateCounts(state.templateDraft).weeks - block.weeks.length;
  const maximum = Math.min(52, 104 - totalWithoutBlock);
  const target = Math.max(1, Math.min(maximum, Math.trunc(Number(requestedCount) || 1)));

  while (block.weeks.length < target) {
    const source = block.weeks[block.weeks.length - 1] ?? newTemplateWeek(1);
    block.weeks.push(cloneTemplateNode(source));
  }

  if (block.weeks.length > target) {
    block.weeks.splice(target);
  }

  block.week_count = block.weeks.length;
  state.templateDraft.event_compile_summary = null;
}

function fitFinalBlockToEvent() {
  const draft = state.templateDraft;
  const summary = localEventCompileSummary(draft);
  if (!draft?.event_plan || !summary?.valid) {
    throw new Error("Set valid programme and event dates first.");
  }

  const finalIndex = draft.blocks.length - 1;
  const precedingWeeks = draft.blocks.slice(0, finalIndex)
    .reduce((total, block) => total + block.weeks.length, 0);
  const target = summary.required_week_count - precedingWeeks;

  if (target < 1 || target > 52) {
    throw new Error("The final block cannot absorb the remaining weeks. Adjust earlier blocks or add another block.");
  }

  resizeBlockWeeks(finalIndex, target);
  rerenderTemplateBuilder();
  showNotice(`Final block fitted to ${target} week${target === 1 ? "" : "s"}.`);
}

function templateCounts(draft) {
  const blocks = Array.isArray(draft?.blocks) ? draft.blocks : [];
  const weeks = blocks.reduce((total, block) => total + block.weeks.length, 0);
  const sessions = blocks.reduce(
    (total, block) => total + block.weeks.reduce(
      (weekTotal, week) => weekTotal + week.sessions.length,
      0
    ),
    0
  );
  return { blocks: blocks.length, weeks, sessions };
}

function updateTemplateFacts() {
  const draft = state.templateDraft;
  const counts = templateCounts(draft);
  elements.templateVersion.textContent = String(draft?.template_version ?? 1);
  elements.templateBlockCount.textContent = String(counts.blocks);
  elements.templateWeekCount.textContent = String(counts.weeks);
  elements.templateSessionCount.textContent = String(counts.sessions);
  elements.addTemplateBlockButton.disabled =
    counts.blocks >= 12 ||
    counts.weeks >= 104;
  renderEventCompiler();
}

function templateWorkItemAttributes(
  blockIndex,
  weekIndex,
  sessionIndex,
  workItemIndex,
  field
) {
  return `
    data-template-kind="work-item"
    data-block-index="${blockIndex}"
    data-week-index="${weekIndex}"
    data-session-index="${sessionIndex}"
    data-work-item-index="${workItemIndex}"
    data-field="${field}"
  `;
}

function renderTemplateRepControls(
  workItem,
  blockIndex,
  weekIndex,
  sessionIndex,
  workItemIndex
) {
  const rangeMode = workItem.rep_mode === "range";

  return `
    <fieldset class="template-prescription-card">
      <legend>Repetitions</legend>
      <div class="template-prescription-fields">
        <label class="template-method-field">
          <span>Method</span>
          <select ${templateWorkItemAttributes(blockIndex, weekIndex, sessionIndex, workItemIndex, "rep_mode")}>
            <option value="fixed" ${rangeMode ? "" : "selected"}>Fixed reps</option>
            <option value="range" ${rangeMode ? "selected" : ""}>Rep range</option>
          </select>
        </label>
        ${rangeMode
          ? `
            <label><span>Minimum</span><input type="number" min="1" max="100" step="1" value="${Number(workItem.rep_min)}" ${templateWorkItemAttributes(blockIndex, weekIndex, sessionIndex, workItemIndex, "rep_min")} /></label>
            <label><span>Maximum</span><input type="number" min="1" max="100" step="1" value="${Number(workItem.rep_max)}" ${templateWorkItemAttributes(blockIndex, weekIndex, sessionIndex, workItemIndex, "rep_max")} /></label>
          `
          : `
            <label><span>Reps</span><input type="number" min="1" max="100" step="1" value="${Number(workItem.planned_reps)}" ${templateWorkItemAttributes(blockIndex, weekIndex, sessionIndex, workItemIndex, "planned_reps")} /></label>
          `}
        <label class="template-tempo-field">
          <span>Tempo (optional)</span>
          <input type="text" maxlength="7" placeholder="3-1-X-0" value="${escapeHtml(workItem.tempo ?? "")}" ${templateWorkItemAttributes(blockIndex, weekIndex, sessionIndex, workItemIndex, "tempo")} />
        </label>
      </div>
    </fieldset>
  `;
}

function renderTemplateDurationControls(
  workItem,
  blockIndex,
  weekIndex,
  sessionIndex,
  workItemIndex
) {
  const rangeMode = workItem.duration_mode === "range";

  return `
    <fieldset class="template-prescription-card">
      <legend>Duration</legend>
      <div class="template-prescription-fields">
        <label class="template-method-field">
          <span>Method</span>
          <select ${templateWorkItemAttributes(blockIndex, weekIndex, sessionIndex, workItemIndex, "duration_mode")}>
            <option value="fixed" ${rangeMode ? "" : "selected"}>Fixed hold</option>
            <option value="range" ${rangeMode ? "selected" : ""}>Hold range</option>
          </select>
        </label>
        ${rangeMode
          ? `
            <label><span>Minimum (s)</span><input type="number" min="1" max="1800" step="1" value="${Number(workItem.duration_min_seconds)}" ${templateWorkItemAttributes(blockIndex, weekIndex, sessionIndex, workItemIndex, "duration_min_seconds")} /></label>
            <label><span>Maximum (s)</span><input type="number" min="1" max="1800" step="1" value="${Number(workItem.duration_max_seconds)}" ${templateWorkItemAttributes(blockIndex, weekIndex, sessionIndex, workItemIndex, "duration_max_seconds")} /></label>
          `
          : `
            <label><span>Seconds</span><input type="number" min="1" max="1800" step="1" value="${Number(workItem.planned_duration_seconds)}" ${templateWorkItemAttributes(blockIndex, weekIndex, sessionIndex, workItemIndex, "planned_duration_seconds")} /></label>
          `}
      </div>
    </fieldset>
  `;
}

function renderTemplateDistanceControls(
  workItem,
  blockIndex,
  weekIndex,
  sessionIndex,
  workItemIndex
) {
  const rangeMode = workItem.distance_mode === "range";

  return `
    <fieldset class="template-prescription-card">
      <legend>Distance</legend>
      <div class="template-prescription-fields">
        <label class="template-method-field">
          <span>Method</span>
          <select ${templateWorkItemAttributes(blockIndex, weekIndex, sessionIndex, workItemIndex, "distance_mode")}>
            <option value="fixed" ${rangeMode ? "" : "selected"}>Fixed distance</option>
            <option value="range" ${rangeMode ? "selected" : ""}>Distance range</option>
          </select>
        </label>
        ${rangeMode
          ? `
            <label><span>Minimum</span><input type="number" min="0.1" max="10000" step="0.1" value="${Number(workItem.distance_min_value)}" ${templateWorkItemAttributes(blockIndex, weekIndex, sessionIndex, workItemIndex, "distance_min_value")} /></label>
            <label><span>Maximum</span><input type="number" min="0.1" max="10000" step="0.1" value="${Number(workItem.distance_max_value)}" ${templateWorkItemAttributes(blockIndex, weekIndex, sessionIndex, workItemIndex, "distance_max_value")} /></label>
          `
          : `
            <label><span>Distance</span><input type="number" min="0.1" max="10000" step="0.1" value="${Number(workItem.planned_distance_value)}" ${templateWorkItemAttributes(blockIndex, weekIndex, sessionIndex, workItemIndex, "planned_distance_value")} /></label>
          `}
        <label><span>Unit</span><select ${templateWorkItemAttributes(blockIndex, weekIndex, sessionIndex, workItemIndex, "distance_unit")}><option value="meters" ${workItem.distance_unit === "feet" ? "" : "selected"}>meters</option><option value="feet" ${workItem.distance_unit === "feet" ? "selected" : ""}>feet</option></select></label>
      </div>
    </fieldset>
  `;
}

function renderTemplatePrescriptionControls(
  workItem,
  blockIndex,
  weekIndex,
  sessionIndex,
  workItemIndex
) {
  const prescriptionMode = ["duration", "distance"].includes(workItem.prescription_mode)
    ? workItem.prescription_mode
    : "reps";

  const controls = prescriptionMode === "duration"
    ? renderTemplateDurationControls(workItem, blockIndex, weekIndex, sessionIndex, workItemIndex)
    : prescriptionMode === "distance"
      ? renderTemplateDistanceControls(workItem, blockIndex, weekIndex, sessionIndex, workItemIndex)
      : renderTemplateRepControls(workItem, blockIndex, weekIndex, sessionIndex, workItemIndex);

  return `
    <div class="template-prescription-mode-field">
      <label class="template-method-field">
        <span>Prescribe by</span>
        <select ${templateWorkItemAttributes(blockIndex, weekIndex, sessionIndex, workItemIndex, "prescription_mode")}>
          <option value="reps" ${prescriptionMode === "reps" ? "selected" : ""}>Reps</option>
          <option value="duration" ${prescriptionMode === "duration" ? "selected" : ""}>Duration</option>
          <option value="distance" ${prescriptionMode === "distance" ? "selected" : ""}>Distance</option>
        </select>
      </label>
    </div>
    ${controls}
  `;
}

function renderTemplateLoadControls(
  workItem,
  blockIndex,
  weekIndex,
  sessionIndex,
  workItemIndex
) {
  const loadMode = ["fixed_weight", "bodyweight", "rpe"].includes(workItem.load_mode)
    ? workItem.load_mode
    : "percent_1rm";

  return `
    <fieldset class="template-prescription-card">
      <legend>Loading</legend>
      <div class="template-prescription-fields">
        <label class="template-method-field">
          <span>Method</span>
          <select ${templateWorkItemAttributes(blockIndex, weekIndex, sessionIndex, workItemIndex, "load_mode")}>
            <option value="percent_1rm" ${loadMode === "percent_1rm" ? "selected" : ""}>% of athlete 1RM</option>
            <option value="fixed_weight" ${loadMode === "fixed_weight" ? "selected" : ""}>Fixed weight</option>
            <option value="bodyweight" ${loadMode === "bodyweight" ? "selected" : ""}>Bodyweight</option>
            <option value="rpe" ${loadMode === "rpe" ? "selected" : ""}>RPE</option>
          </select>
        </label>
        ${loadMode === "percent_1rm"
          ? `
            <label><span>% 1RM</span><input type="number" min="1" max="100" step="0.5" value="${Number(workItem.percent_1rm)}" ${templateWorkItemAttributes(blockIndex, weekIndex, sessionIndex, workItemIndex, "percent_1rm")} /></label>
          `
          : loadMode === "fixed_weight"
            ? `
              <label><span>Weight</span><input type="number" min="0.25" max="1000" step="0.25" value="${Number(workItem.weight_value)}" ${templateWorkItemAttributes(blockIndex, weekIndex, sessionIndex, workItemIndex, "weight_value")} /></label>
              <label><span>Unit</span><select ${templateWorkItemAttributes(blockIndex, weekIndex, sessionIndex, workItemIndex, "weight_unit")}><option value="kg" ${workItem.weight_unit === "lb" ? "" : "selected"}>kg</option><option value="lb" ${workItem.weight_unit === "lb" ? "selected" : ""}>lb</option></select></label>
            `
            : loadMode === "rpe"
              ? `
                <label><span>RPE</span><input type="number" min="1" max="10" step="1" value="${Number(workItem.rpe_value)}" ${templateWorkItemAttributes(blockIndex, weekIndex, sessionIndex, workItemIndex, "rpe_value")} /></label>
              `
              : '<div class="template-bodyweight-note">No external load is prescribed.</div>'}
      </div>
    </fieldset>
  `;
}

function renderTemplateWorkItem(workItem, blockIndex, weekIndex, sessionIndex, workItemIndex, workItemCount) {
  const grouped = Boolean(workItem.group_id);

  return `
    <div class="template-work-item ${grouped ? "template-work-item-grouped" : ""}">
      <div class="template-work-item-header">
        <span class="exercise-order">${workItemIndex + 1}</span>
        <label class="template-exercise-field">
          <span>Exercise</span>
          <select ${templateWorkItemAttributes(blockIndex, weekIndex, sessionIndex, workItemIndex, "exercise_id")}>
            ${templateExerciseOptions(workItem.exercise_id)}
          </select>
        </label>
        <label class="template-role-field">
          <span>Role</span>
          <select ${templateWorkItemAttributes(blockIndex, weekIndex, sessionIndex, workItemIndex, "role")}>
            <option value="primary" ${workItem.role === "primary" ? "selected" : ""}>Primary</option>
            <option value="accessory" ${workItem.role === "accessory" ? "selected" : ""}>Accessory</option>
          </select>
        </label>
        <label class="template-segment-field">
          <span>Segment</span>
          <select ${templateWorkItemAttributes(blockIndex, weekIndex, sessionIndex, workItemIndex, "segment")}>
            <option value="warm_up" ${workItem.segment === "warm_up" ? "selected" : ""}>Warm-up</option>
            <option value="working" ${workItem.segment === "working" ? "selected" : ""}>Working</option>
            <option value="cool_down" ${workItem.segment === "cool_down" ? "selected" : ""}>Cool-down</option>
          </select>
        </label>
        <div class="builder-action-row">
          <button class="button secondary small-button move-template-work-item" type="button" aria-label="Move exercise up" title="Move exercise up" data-direction="-1" data-block-index="${blockIndex}" data-week-index="${weekIndex}" data-session-index="${sessionIndex}" data-work-item-index="${workItemIndex}" ${workItemIndex === 0 ? "disabled" : ""}>↑</button>
          <button class="button secondary small-button move-template-work-item" type="button" aria-label="Move exercise down" title="Move exercise down" data-direction="1" data-block-index="${blockIndex}" data-week-index="${weekIndex}" data-session-index="${sessionIndex}" data-work-item-index="${workItemIndex}" ${workItemIndex === workItemCount - 1 ? "disabled" : ""}>↓</button>
          <button class="button secondary small-button template-work-item-info-toggle" type="button" data-block-index="${blockIndex}" data-week-index="${weekIndex}" data-session-index="${sessionIndex}" data-work-item-index="${workItemIndex}">Exercise info</button>
          <button class="button secondary small-button duplicate-template-work-item" type="button" data-block-index="${blockIndex}" data-week-index="${weekIndex}" data-session-index="${sessionIndex}" data-work-item-index="${workItemIndex}" ${workItemCount >= 12 ? "disabled" : ""}>Duplicate</button>
          ${workItemCount > 1 ? `<button class="button danger small-button remove-template-work-item" type="button" data-block-index="${blockIndex}" data-week-index="${weekIndex}" data-session-index="${sessionIndex}" data-work-item-index="${workItemIndex}">Remove</button>` : ""}
        </div>
      </div>
      <div class="template-work-item-info" hidden></div>
      <div class="template-prescription-grid">
        <label class="template-sets-field">
          <span>Sets</span>
          <input type="number" min="1" max="20" step="1" value="${Number(workItem.planned_sets)}" ${templateWorkItemAttributes(blockIndex, weekIndex, sessionIndex, workItemIndex, "planned_sets")} />
        </label>
        ${renderTemplatePrescriptionControls(workItem, blockIndex, weekIndex, sessionIndex, workItemIndex)}
        ${renderTemplateLoadControls(workItem, blockIndex, weekIndex, sessionIndex, workItemIndex)}
        <label class="template-rest-field">
          <span>Rest seconds</span>
          <input type="number" min="0" max="900" step="5" value="${Number(workItem.rest_seconds)}" ${templateWorkItemAttributes(blockIndex, weekIndex, sessionIndex, workItemIndex, "rest_seconds")} />
        </label>
      </div>
      <div class="template-grouping-row">
        ${grouped
          ? `
            <label class="template-group-type-field">
              <span>Grouping</span>
              <select ${templateWorkItemAttributes(blockIndex, weekIndex, sessionIndex, workItemIndex, "group_type")}>
                <option value="superset" ${workItem.group_type === "superset" ? "selected" : ""}>Superset</option>
                <option value="circuit" ${workItem.group_type === "circuit" ? "selected" : ""}>Circuit</option>
              </select>
            </label>
            <button class="button secondary small-button ungroup-work-item" type="button" data-block-index="${blockIndex}" data-week-index="${weekIndex}" data-session-index="${sessionIndex}" data-work-item-index="${workItemIndex}">Ungroup</button>
          `
          : workItemIndex < workItemCount - 1
            ? `<button class="button secondary small-button group-with-next-work-item" type="button" data-block-index="${blockIndex}" data-week-index="${weekIndex}" data-session-index="${sessionIndex}" data-work-item-index="${workItemIndex}">Group with next</button>`
            : ""}
      </div>
      <label class="field template-work-item-notes-field">
        <span>Coaching notes</span>
        <textarea maxlength="500" ${templateWorkItemAttributes(blockIndex, weekIndex, sessionIndex, workItemIndex, "coaching_notes")}>${escapeHtml(workItem.coaching_notes)}</textarea>
      </label>
    </div>
  `;
}

function renderTemplateSession(session, blockIndex, weekIndex, sessionIndex, sessionCount) {
  return `
    <section class="template-session">
      <div class="template-session-header">
        <label class="field template-session-title-field">
          <span>Session title</span>
          <input
            value="${escapeHtml(session.title)}"
            data-template-kind="session"
            data-block-index="${blockIndex}"
            data-week-index="${weekIndex}"
            data-session-index="${sessionIndex}"
            data-field="title"
            maxlength="100"
          />
        </label>
        <div class="builder-action-row">
          <button class="button secondary small-button move-template-session" type="button" aria-label="Move session up" title="Move session up" data-direction="-1" data-block-index="${blockIndex}" data-week-index="${weekIndex}" data-session-index="${sessionIndex}" ${sessionIndex === 0 ? "disabled" : ""}>↑</button>
          <button class="button secondary small-button move-template-session" type="button" aria-label="Move session down" title="Move session down" data-direction="1" data-block-index="${blockIndex}" data-week-index="${weekIndex}" data-session-index="${sessionIndex}" ${sessionIndex === sessionCount - 1 ? "disabled" : ""}>↓</button>
          <button class="button secondary small-button duplicate-template-session" type="button" data-block-index="${blockIndex}" data-week-index="${weekIndex}" data-session-index="${sessionIndex}">Duplicate</button>
          ${sessionCount > 1 ? `<button class="button danger small-button remove-template-session" type="button" data-block-index="${blockIndex}" data-week-index="${weekIndex}" data-session-index="${sessionIndex}">Remove</button>` : ""}
        </div>
      </div>
      <label class="field template-session-notes-field">
        <span>Session coaching notes</span>
        <textarea maxlength="500" data-template-kind="session" data-block-index="${blockIndex}" data-week-index="${weekIndex}" data-session-index="${sessionIndex}" data-field="coaching_notes">${escapeHtml(session.coaching_notes)}</textarea>
      </label>
      <div class="template-work-items">
        ${session.work_items.map((workItem, workItemIndex) => renderTemplateWorkItem(workItem, blockIndex, weekIndex, sessionIndex, workItemIndex, session.work_items.length)).join("")}
      </div>
      <button class="button secondary add-template-work-item" type="button" data-block-index="${blockIndex}" data-week-index="${weekIndex}" data-session-index="${sessionIndex}" ${session.work_items.length >= 12 ? "disabled" : ""}>Add exercise</button>
    </section>
  `;
}

function renderTemplateWeek(week, blockIndex, weekIndex, weekCount) {
  return `
    <article class="template-week">
      <div class="template-week-header">
        <div>
          <p class="eyebrow">Week ${weekIndex + 1}</p>
          <h4>Training week</h4>
          ${week.calendar_start_date
            ? `<p class="template-week-calendar">${escapeHtml(formatDate(week.calendar_start_date))} – ${escapeHtml(formatDate(week.calendar_end_date))}${Number.isInteger(week.days_until_event_at_week_start) ? ` · ${week.days_until_event_at_week_start} days to event` : ""}${week.partial_week ? " · Partial week" : ""}</p>`
            : ""}
        </div>
        <div class="builder-action-row">
          <button class="button secondary small-button move-template-week" type="button" aria-label="Move week up" title="Move week up" data-direction="-1" data-block-index="${blockIndex}" data-week-index="${weekIndex}" ${weekIndex === 0 ? "disabled" : ""}>↑</button>
          <button class="button secondary small-button move-template-week" type="button" aria-label="Move week down" title="Move week down" data-direction="1" data-block-index="${blockIndex}" data-week-index="${weekIndex}" ${weekIndex === weekCount - 1 ? "disabled" : ""}>↓</button>
          <button class="button secondary small-button duplicate-template-week" type="button" data-block-index="${blockIndex}" data-week-index="${weekIndex}">Duplicate</button>
          ${weekCount > 1 ? `<button class="button danger small-button remove-template-week" type="button" data-block-index="${blockIndex}" data-week-index="${weekIndex}">Remove</button>` : ""}
        </div>
      </div>
      <div class="template-sessions">
        ${week.sessions.map((session, sessionIndex) => renderTemplateSession(session, blockIndex, weekIndex, sessionIndex, week.sessions.length)).join("")}
      </div>
      <button class="button secondary add-template-session" type="button" data-block-index="${blockIndex}" data-week-index="${weekIndex}" ${week.sessions.length >= 7 ? "disabled" : ""}>Add session</button>
    </article>
  `;
}

function renderTemplateBlocks() {
  const draft = state.templateDraft;
  if (!draft) {
    elements.templateBlocks.innerHTML = "";
    return;
  }

  const totalWeeks =
    templateCounts(draft).weeks;

  elements.templateBlocks.innerHTML = draft.blocks.map((block, blockIndex) => `
    <article class="template-block">
      <div class="template-block-header">
        <div>
          <p class="eyebrow">Training block ${blockIndex + 1}</p>
          <h3>${escapeHtml(block.name || `Block ${blockIndex + 1}`)}</h3>
        </div>
        <div class="builder-action-row">
          <button class="button secondary small-button move-template-block" type="button" aria-label="Move block up" title="Move block up" data-direction="-1" data-block-index="${blockIndex}" ${blockIndex === 0 ? "disabled" : ""}>↑</button>
          <button class="button secondary small-button move-template-block" type="button" aria-label="Move block down" title="Move block down" data-direction="1" data-block-index="${blockIndex}" ${blockIndex === draft.blocks.length - 1 ? "disabled" : ""}>↓</button>
          <button class="text-button small-inline-action add-template-week" type="button" data-block-index="${blockIndex}" ${block.weeks.length >= 52 || totalWeeks >= 104 ? "disabled" : ""}>+ Add week</button>
          <button class="button secondary small-button duplicate-template-block" type="button" data-block-index="${blockIndex}" ${draft.blocks.length >= 12 || totalWeeks + block.weeks.length > 104 ? "disabled" : ""}>Duplicate block</button>
          ${draft.blocks.length > 1 ? `<button class="button danger small-button remove-template-block" type="button" data-block-index="${blockIndex}">Remove block</button>` : ""}
        </div>
      </div>

      <div class="template-block-settings">
        <label class="field">
          <span>Block name</span>
          <input value="${escapeHtml(block.name)}" maxlength="120" data-template-kind="block" data-block-index="${blockIndex}" data-field="name" />
        </label>
        <label class="field">
          <span>Block type</span>
          <select data-template-kind="block" data-block-index="${blockIndex}" data-field="block_type">
            <option value="general" ${block.block_type === "general" ? "selected" : ""}>General</option>
            <option value="volume" ${block.block_type === "volume" ? "selected" : ""}>Volume</option>
            <option value="strength" ${block.block_type === "strength" ? "selected" : ""}>Strength</option>
            <option value="peak" ${block.block_type === "peak" ? "selected" : ""}>Peak</option>
            <option value="deload" ${block.block_type === "deload" ? "selected" : ""}>Deload</option>
            <option value="custom" ${block.block_type === "custom" ? "selected" : ""}>Custom</option>
          </select>
        </label>
        <label class="field template-block-week-count-field">
          <span>Weeks in block</span>
          <input type="number" min="1" max="52" step="1" value="${block.weeks.length}" data-template-kind="block" data-block-index="${blockIndex}" data-field="week_count" />
        </label>
        <label class="field template-block-description-field">
          <span>Block description</span>
          <input value="${escapeHtml(block.description)}" maxlength="500" data-template-kind="block" data-block-index="${blockIndex}" data-field="description" placeholder="Optional factual purpose or phase label" />
        </label>
      </div>

      ${draft.event_plan && block.calendar_start_date
        ? `<div class="block-calendar-strip"><span>${escapeHtml(formatDate(block.calendar_start_date))}</span><span>→</span><span>${escapeHtml(formatDate(block.calendar_end_date))}</span><strong>${block.weeks.length} week${block.weeks.length === 1 ? "" : "s"}</strong></div>`
        : ""}
      <div class="template-weeks">
        ${block.weeks.map((week, weekIndex) => renderTemplateWeek(week, blockIndex, weekIndex, block.weeks.length)).join("")}
      </div>
    </article>
  `).join("");
}

function reindexTemplateDraft() {
  if (!state.templateDraft) return;

  state.templateDraft.blocks.forEach((block, blockIndex) => {
    block.order_index = blockIndex + 1;
    block.week_count = block.weeks.length;
    block.weeks.forEach((week, weekIndex) => {
      week.order_index = weekIndex + 1;
      week.sessions.forEach((session, sessionIndex) => {
        session.order_index = sessionIndex + 1;
        session.work_items.forEach((workItem, workItemIndex) => {
          workItem.order_index = workItemIndex + 1;
        });
      });
    });
  });
}

function rerenderTemplateBuilder() {
  reindexTemplateDraft();
  saveState();
  renderTemplateBlocks();
  updateTemplateFacts();
  renderTemplateBuilderState();
}

// FULL-UI-05B: programme builder state, recovery, validation links and keyboard support.
// These helpers manage browser presentation state only. They do not call or alter the engine.
let templateBuilderSaving = false;
let templateBuilderSaveError = "";

function templateDraftSnapshot(draft) {
  if (!draft || typeof draft !== "object") return "";
  return JSON.stringify(normalisePersistedTemplateDraft(draft));
}

function templateDraftIsDirty() {
  if (!state.templateDraft || state.templateDraftWasOpen !== true) {
    return false;
  }

  return templateDraftSnapshot(state.templateDraft) !==
    String(state.templateDraftSavedSnapshot ?? "");
}

function hasRecoverableTemplateDraft() {
  return Boolean(
    state.templateDraft &&
    state.templateDraftWasOpen === true &&
    templateDraftIsDirty()
  );
}

function clearTemplateDraftState() {
  state.templateDraft = null;
  state.templateDraftSavedSnapshot = "";
  state.templateDraftSavedAt = "";
  state.templateDraftWasOpen = false;
  state.templateDraftRecovered = false;
  state.templateDraftDirty = false;
  templateBuilderSaveError = "";
}

function confirmTemplateBuilderDeparture() {
  if (!templateDraftIsDirty()) return true;

  return globalThis.confirm(
    "This programme has unsaved changes. Leave the builder and discard those changes?"
  );
}

function confirmRecoveredTemplateReplacement() {
  if (!hasRecoverableTemplateDraft()) return true;

  if (
    !globalThis.confirm(
      "A recovered programme draft has unsaved changes. Discard it and open another programme?"
    )
  ) {
    return false;
  }

  clearTemplateDraftState();
  saveState();
  return true;
}

function templateDraftValidationRecord() {
  const draft = state.templateDraft;
  if (!draft) return null;

  return {
    template_id: String(draft.template_id ?? ""),
    template_family_id: String(draft.template_family_id ?? ""),
    template_version: Number(draft.template_version ?? 1),
    template_status: String(draft.template_status ?? "draft"),
    template_name: String(draft.template_name ?? ""),
    description: String(draft.description ?? ""),
    activity_id: String(draft.activity_id ?? ""),
    event_plan: draft.event_plan ?? null,
    event_compile_summary: draft.event_compile_summary ?? null,
    template_structure: {
      blocks: (Array.isArray(draft.blocks) ? draft.blocks : []).map(
        (block, blockIndex) => ({
          block_id: String(block?.block_id ?? ""),
          order_index: blockIndex + 1,
          name: String(block?.name ?? ""),
          description: String(block?.description ?? ""),
          block_type: String(block?.block_type ?? ""),
          week_count: Array.isArray(block?.weeks) ? block.weeks.length : 0,
          weeks: (Array.isArray(block?.weeks) ? block.weeks : []).map(
            (week, weekIndex) => ({
              week_id: String(week?.week_id ?? ""),
              order_index: weekIndex + 1,
              calendar_start_date: String(week?.calendar_start_date ?? ""),
              calendar_end_date: String(week?.calendar_end_date ?? ""),
              days_until_event_at_week_start:
                Number.isInteger(week?.days_until_event_at_week_start)
                  ? Number(week.days_until_event_at_week_start)
                  : null,
              partial_week: week?.partial_week === true,
              days: (Array.isArray(week?.sessions) ? week.sessions : []).map(
                (session, sessionIndex) => ({
                  day_id: "",
                  order_index: sessionIndex + 1,
                  sessions: [{
                    session_id: String(session?.session_id ?? ""),
                    order_index: 1,
                    title: String(session?.title ?? ""),
                    coaching_notes: String(session?.coaching_notes ?? ""),
                    work_items: (
                      Array.isArray(session?.work_items)
                        ? session.work_items
                        : []
                    ).map((workItem, workItemIndex) => ({
                      work_item_id: String(workItem?.work_item_id ?? ""),
                      order_index: workItemIndex + 1,
                      exercise_id: String(workItem?.exercise_id ?? ""),
                      planned_sets: Number(workItem?.planned_sets),
                      prescription_mode: String(workItem?.prescription_mode ?? "reps"),
                      rep_mode: String(workItem?.rep_mode ?? ""),
                      planned_reps: Number(workItem?.planned_reps),
                      rep_min: Number(workItem?.rep_min),
                      rep_max: Number(workItem?.rep_max),
                      tempo: String(workItem?.tempo ?? ""),
                      duration_mode: String(workItem?.duration_mode ?? "fixed"),
                      planned_duration_seconds: Number(workItem?.planned_duration_seconds),
                      duration_min_seconds: Number(workItem?.duration_min_seconds),
                      duration_max_seconds: Number(workItem?.duration_max_seconds),
                      distance_mode: String(workItem?.distance_mode ?? "fixed"),
                      distance_unit: String(workItem?.distance_unit ?? "meters"),
                      planned_distance_value: Number(workItem?.planned_distance_value),
                      distance_min_value: Number(workItem?.distance_min_value),
                      distance_max_value: Number(workItem?.distance_max_value),
                      load_mode: String(workItem?.load_mode ?? ""),
                      percent_1rm: Number(workItem?.percent_1rm),
                      weight_value: Number(workItem?.weight_value),
                      weight_unit: String(workItem?.weight_unit ?? ""),
                      rpe_value: Number(workItem?.rpe_value),
                      rest_seconds: Number(workItem?.rest_seconds),
                      role: String(workItem?.role ?? ""),
                      coaching_notes: String(workItem?.coaching_notes ?? ""),
                      segment: String(workItem?.segment ?? "working"),
                      group_id: String(workItem?.group_id ?? ""),
                      group_type: String(workItem?.group_type ?? "straight")
                    }))
                  }]
                })
              )
            })
          )
        })
      )
    }
  };
}

function currentTemplateBuilderIssues() {
  const record = templateDraftValidationRecord();
  return record ? programmeActivationIssues(record) : [];
}

function templateValidationSelector(issue) {
  const code = String(issue?.code ?? "");
  const path = String(issue?.path ?? "");
  const message = String(issue?.message ?? "").toLowerCase();

  if (path === "programme name") return "#templateName";
  if (path === "activity") return "#templateActivity";
  if (path === "event date") return "#templateEventDate";

  if (path === "event calendar") {
    if (message.includes("event name")) return "#templateEventName";
    if (message.includes("timezone")) return "#templateEventTimezone";
    if (message.includes("start date")) return "#templateProgrammeStartDate";
    return "#templateEventDate";
  }

  if (path === "blocks" || path === "weeks") {
    return "#addTemplateBlockButton";
  }

  const blockMatch = /Block (\d+)/u.exec(path);
  const weekMatch = /week (\d+)/u.exec(path);
  const sessionMatch = /session (\d+)/u.exec(path);
  const exerciseMatch = /exercise (\d+)/u.exec(path);

  const blockIndex = blockMatch ? Number(blockMatch[1]) - 1 : null;
  const weekIndex = weekMatch ? Number(weekMatch[1]) - 1 : null;
  const sessionIndex = sessionMatch ? Number(sessionMatch[1]) - 1 : null;
  let workItemIndex = exerciseMatch ? Number(exerciseMatch[1]) - 1 : null;

  if (
    workItemIndex === null &&
    (
      code === "duplicate_exercise_in_session" ||
      code === "exercise_required" ||
      code === "exercise_not_in_active_registry"
    ) &&
    sessionIndex !== null
  ) {
    workItemIndex = 0;
  }

  if (blockIndex === null) return "#templateName";

  const attributes = [
    `[data-block-index="${blockIndex}"]`
  ];

  if (weekIndex !== null) {
    attributes.push(`[data-week-index="${weekIndex}"]`);
  }

  if (sessionIndex !== null) {
    attributes.push(`[data-session-index="${sessionIndex}"]`);
  }

  if (workItemIndex !== null) {
    attributes.push(`[data-work-item-index="${workItemIndex}"]`);
  }

  let field = "";

  if (
    code === "exercise_required" ||
    code === "exercise_not_in_active_registry" ||
    code === "duplicate_exercise_in_session"
  ) {
    field = "exercise_id";
  }
  else if (code === "role_invalid") {
    field = "role";
  }
  else if (code === "planned_sets_invalid") {
    field = "planned_sets";
  }
  else if (code === "planned_reps_invalid") {
    field = "planned_reps";
  }
  else if (code === "rep_range_min_invalid") {
    field = "rep_min";
  }
  else if (
    code === "rep_range_max_invalid" ||
    code === "rep_range_order_invalid"
  ) {
    field = "rep_max";
  }
  else if (code === "prescription_mode_invalid") {
    field = "prescription_mode";
  }
  else if (code === "work_item_tempo_invalid") {
    field = "tempo";
  }
  else if (code === "duration_mode_invalid") {
    field = "duration_mode";
  }
  else if (code === "planned_duration_seconds_invalid") {
    field = "planned_duration_seconds";
  }
  else if (code === "duration_range_min_invalid") {
    field = "duration_min_seconds";
  }
  else if (
    code === "duration_range_max_invalid" ||
    code === "duration_range_order_invalid"
  ) {
    field = "duration_max_seconds";
  }
  else if (code === "distance_mode_invalid") {
    field = "distance_mode";
  }
  else if (code === "distance_unit_invalid") {
    field = "distance_unit";
  }
  else if (code === "planned_distance_value_invalid") {
    field = "planned_distance_value";
  }
  else if (code === "distance_range_min_invalid") {
    field = "distance_min_value";
  }
  else if (
    code === "distance_range_max_invalid" ||
    code === "distance_range_order_invalid"
  ) {
    field = "distance_max_value";
  }
  else if (code === "load_mode_invalid") {
    field = "load_mode";
  }
  else if (code === "percent_1rm_invalid") {
    field = "percent_1rm";
  }
  else if (code === "weight_value_invalid") {
    field = "weight_value";
  }
  else if (code === "weight_unit_invalid") {
    field = "weight_unit";
  }
  else if (code === "rpe_value_invalid") {
    field = "rpe_value";
  }
  else if (code === "rest_seconds_invalid") {
    field = "rest_seconds";
  }
  else if (code === "block_type_invalid") {
    field = "block_type";
  }
  else if (code === "week_count_per_block_invalid") {
    field = "week_count";
  }
  else if (
    code === "session_count_per_week_invalid" ||
    code === "session_work_item_count_invalid"
  ) {
    field = "title";
  }
  else if (code === "session_coaching_notes_too_long") {
    field = "coaching_notes";
  }
  else if (code === "work_item_coaching_notes_too_long") {
    field = "coaching_notes";
  }
  else if (code === "work_item_segment_invalid") {
    field = "segment";
  }
  else if (
    code === "work_item_group_type_invalid" ||
    code === "work_item_group_type_requires_group" ||
    code === "work_item_group_too_small" ||
    code === "work_item_group_not_contiguous" ||
    code === "work_item_group_type_mismatch"
  ) {
    field = "group_type";
  }

  const kind =
    workItemIndex !== null
      ? "work-item"
      : sessionIndex !== null
        ? "session"
        : "block";

  const fieldSelector = field
    ? `[data-field="${field}"]`
    : "";

  return (
    `[data-template-kind="${kind}"]` +
    attributes.join("") +
    fieldSelector
  );
}

function focusTemplateValidationIssue(issueIndex) {
  const issues = currentTemplateBuilderIssues();
  const issue = issues[Number(issueIndex)];
  if (!issue) return false;

  const selector = templateValidationSelector(issue);
  const target = document.querySelector(selector);

  if (!target) {
    elements.templateBuilderValidation.scrollIntoView({
      block: "center",
      behavior: "smooth"
    });
    return false;
  }

  const focusTarget =
    target.matches("input, select, textarea, button")
      ? target
      : target.querySelector("input, select, textarea, button") ?? target;

  const highlight =
    focusTarget.closest(
      ".field, .template-block, .template-week, .template-session"
    ) ?? focusTarget;

  highlight.classList.add("builder-validation-target");

  if (!focusTarget.hasAttribute("tabindex") && !focusTarget.matches(
    "input, select, textarea, button, a[href]"
  )) {
    focusTarget.setAttribute("tabindex", "-1");
  }

  focusTarget.scrollIntoView({
    block: "center",
    behavior: "smooth"
  });

  focusTarget.focus({
    preventScroll: true
  });

  setTimeout(() => {
    highlight.classList.remove("builder-validation-target");
  }, 1800);

  return true;
}

function renderTemplateBuilderState() {
  if (
    !elements.templateBuilderSaveState ||
    !elements.templateBuilderValidation
  ) {
    return;
  }

  const draft = state.templateDraft;

  if (!draft) {
    elements.templateBuilderSaveState.textContent = "No draft open";
    elements.templateBuilderSaveState.className = "badge neutral";
    elements.templateBuilderSaveDetail.textContent =
      "Open or create a programme to begin.";
    elements.templateBuilderValidation.hidden = true;
    return;
  }

  const dirty = templateDraftIsDirty();
  state.templateDraftDirty = dirty;

  if (templateBuilderSaving) {
    elements.templateBuilderSaveState.textContent = "Saving…";
    elements.templateBuilderSaveState.className = "badge active";
    elements.templateBuilderSaveDetail.textContent =
      "Writing the draft to the server.";
  }
  else if (templateBuilderSaveError) {
    elements.templateBuilderSaveState.textContent = "Save failed";
    elements.templateBuilderSaveState.className = "badge warning";
    elements.templateBuilderSaveDetail.textContent =
      templateBuilderSaveError;
  }
  else if (dirty) {
    elements.templateBuilderSaveState.textContent = "Unsaved changes";
    elements.templateBuilderSaveState.className = "badge warning";
    elements.templateBuilderSaveDetail.textContent =
      state.templateDraftRecovered === true
        ? "Recovered browser changes have not been saved to the server."
        : "Changes are preserved in this browser but not yet saved to the server.";
  }
  else if (draft.template_id) {
    elements.templateBuilderSaveState.textContent = "Saved";
    elements.templateBuilderSaveState.className = "badge complete";
    elements.templateBuilderSaveDetail.textContent =
      state.templateDraftSavedAt
        ? `Last saved ${formatDate(state.templateDraftSavedAt)}.`
        : "This draft matches the server record.";
  }
  else {
    elements.templateBuilderSaveState.textContent = "New draft";
    elements.templateBuilderSaveState.className = "badge neutral";
    elements.templateBuilderSaveDetail.textContent =
      "Enter programme details, then save the draft.";
  }

  const issues = currentTemplateBuilderIssues();
  elements.templateBuilderValidation.hidden = false;

  if (issues.length === 0) {
    elements.templateBuilderValidation.className =
      "template-builder-validation complete";
    elements.templateBuilderValidationList.innerHTML = `
      <li class="template-builder-validation-pass">
        All visible completion checks pass. The server remains authoritative.
      </li>
    `;
  }
  else {
    elements.templateBuilderValidation.className =
      "template-builder-validation warning";
    elements.templateBuilderValidationList.innerHTML = issues
      .map((issue, index) => `
        <li>
          <button
            class="template-validation-link"
            type="button"
            data-builder-validation-index="${index}"
          >
            <span>${escapeHtml(issue.path)}</span>
            <strong>${escapeHtml(issue.message)}</strong>
            <code>${escapeHtml(issue.code)}</code>
          </button>
        </li>
      `)
      .join("");
  }

  elements.saveTemplateButton.disabled = templateBuilderSaving;
  elements.saveCompleteTemplateButton.disabled =
    templateBuilderSaving || issues.length > 0;
  elements.activateTemplateButton.disabled = templateBuilderSaving;
}

function renderTemplateRecovery() {
  if (!elements.templateDraftRecovery) return;

  const recoverable = hasRecoverableTemplateDraft();
  elements.templateDraftRecovery.hidden = !recoverable;

  if (!recoverable) return;

  const name =
    String(state.templateDraft?.template_name ?? "").trim() ||
    "Untitled programme";

  elements.templateDraftRecoveryTitle.textContent =
    `Recover ${name}`;

  elements.templateDraftRecoveryText.textContent =
    state.templateDraft?.template_id
      ? "Unsaved browser changes were found for this server draft."
      : "An unsaved new programme was found in this browser.";
}

function resumeRecoveredTemplateDraft() {
  if (!hasRecoverableTemplateDraft()) return false;

  return openTemplateBuilder(
    state.templateDraft,
    {
      preserveBaseline: true,
      recovered: true,
      skipRecoveryCheck: true
    }
  );
}

function discardRecoveredTemplateDraft() {
  if (!hasRecoverableTemplateDraft()) {
    clearTemplateDraftState();
    saveState();
    renderTemplateRecovery();
    return true;
  }

  if (
    !globalThis.confirm(
      "Discard the recovered programme changes stored in this browser?"
    )
  ) {
    return false;
  }

  clearTemplateDraftState();
  saveState();
  renderTemplateRecovery();
  showNotice("Recovered programme changes discarded.");
  return true;
}

function scheduleTemplateBuilderStateRefresh() {
  queueMicrotask(() => {
    if (
      !state.templateDraft ||
      elements.templateBuilderView.hidden
    ) {
      return;
    }

    templateBuilderSaveError = "";
    state.templateDraftDirty = templateDraftIsDirty();
    saveState();
    renderTemplateBuilderState();
  });
}

function openTemplateBuilder(draft, options = {}) {
  if (
    options.skipRecoveryCheck !== true &&
    hasRecoverableTemplateDraft()
  ) {
    if (!confirmRecoveredTemplateReplacement()) {
      return false;
    }
  }

  state.selectedTemplateId = "";
  state.templateDraft = normalisePersistedTemplateDraft(draft);

  if (!state.templateDraft) {
    throw new Error("The programme draft could not be opened.");
  }

  if (options.preserveBaseline !== true) {
    state.templateDraftSavedSnapshot =
      templateDraftSnapshot(state.templateDraft);
    state.templateDraftSavedAt = String(
      state.templateDraft.updated_at_iso8601 ?? ""
    );
  }

  state.templateDraftWasOpen = true;
  state.templateDraftRecovered = options.recovered === true;
  state.templateDraftDirty = templateDraftIsDirty();
  templateBuilderSaveError = "";

  elements.templateDetailPanel.hidden = true;
  elements.templateLibraryView.hidden = true;
  elements.templateBuilderView.hidden = false;
  elements.templateBuilderTitle.textContent = state.templateDraft.template_id
    ? `Edit ${state.templateDraft.template_name}`
    : "New programme";
  elements.templateName.value = state.templateDraft.template_name;
  elements.templateActivity.value = state.templateDraft.activity_id;
  elements.templateDescription.value = state.templateDraft.description;
  elements.saveTemplateButton.hidden =
    state.templateDraft.template_status !== "draft";
  elements.saveCompleteTemplateButton.hidden =
    state.templateDraft.template_status !== "draft";
  elements.activateTemplateButton.hidden =
    state.templateDraft.template_status !== "complete";

  saveState();
  rerenderTemplateBuilder();

  loadStandaloneEventLibraryForBuilder();
  loadTemplateEventBindingStatusForDraft();

  if (
    options.recovered === true &&
    elements.templateBuilderSaveState
  ) {
    elements.templateBuilderSaveState.focus({
      preventScroll: true
    });
  }

  return true;
}

function closeTemplateBuilder(options = {}) {
  if (
    options.force !== true &&
    !confirmTemplateBuilderDeparture()
  ) {
    return false;
  }

  clearTemplateDraftState();
  saveState();

  elements.templateBuilderView.hidden = true;
  elements.templateLibraryView.hidden = false;
  elements.templateDetailPanel.hidden = true;
  renderTemplateLibrary();

  if (options.updateRoute !== false) {
    location.hash = "#/coach/programmes";
  }

  if (options.silent !== true) {
    showNotice("Programme builder closed.");
  }

  return true;
}

function syncTemplateHeader() {
  if (!state.templateDraft) return;
  state.templateDraft.template_name = elements.templateName.value;
  state.templateDraft.activity_id = elements.templateActivity.value;
  state.templateDraft.description = elements.templateDescription.value;
  if (state.templateDraft.event_plan) {
    ensureDraftEventPlan();
  }
  saveState();
}

function updateTemplateFieldFromControl(control) {
  const draft = state.templateDraft;
  if (!draft) return;

  const kind = control.dataset.templateKind;
  const blockIndex = Number(control.dataset.blockIndex);
  const weekIndex = Number(control.dataset.weekIndex);
  const sessionIndex = Number(control.dataset.sessionIndex);
  const workItemIndex = Number(control.dataset.workItemIndex);
  const field = control.dataset.field;
  let target;

  if (kind === "block") {
    target = draft.blocks[blockIndex];
  }
  else if (kind === "session") {
    target = draft.blocks[blockIndex]?.weeks[weekIndex]?.sessions[sessionIndex];
  }
  else if (kind === "work-item") {
    target = draft.blocks[blockIndex]?.weeks[weekIndex]?.sessions[sessionIndex]?.work_items[workItemIndex];
  }

  if (!target || !field) return;

  if (kind === "block" && field === "week_count") {
    resizeBlockWeeks(blockIndex, Number(control.value));
    rerenderTemplateBuilder();
    return;
  }

  target[field] = control.type === "number" ? Number(control.value) : control.value;
  if (kind === "block") {
    state.templateDraft.event_compile_summary = null;
  }

  if (kind === "work-item" && ["rep_mode", "load_mode", "prescription_mode", "duration_mode", "distance_mode"].includes(field)) {
    rerenderTemplateBuilder();
    return;
  }

  saveState();
}

function cloneTemplateNode(value) {
  const cloned = JSON.parse(JSON.stringify(value));
  const clearIds = (node) => {
    if (!node || typeof node !== "object") return;
    for (const key of ["block_id", "week_id", "session_id", "work_item_id"]) {
      if (key in node) node[key] = "";
    }
    for (const child of Object.values(node)) {
      if (Array.isArray(child)) child.forEach(clearIds);
      else if (child && typeof child === "object") clearIds(child);
    }
  };
  clearIds(cloned);
  return cloned;
}

function addTemplateBlock() {
  if (
    !state.templateDraft ||
    state.templateDraft.blocks.length >= 12 ||
    templateCounts(state.templateDraft).weeks >= 104
  ) return;
  state.templateDraft.blocks.push(newTemplateBlock(state.templateDraft.blocks.length + 1));
  rerenderTemplateBuilder();
}

function removeTemplateBlock(blockIndex) {
  if (!state.templateDraft || state.templateDraft.blocks.length <= 1) return;
  state.templateDraft.blocks.splice(blockIndex, 1);
  rerenderTemplateBuilder();
}

function duplicateTemplateBlock(blockIndex) {
  if (!state.templateDraft || state.templateDraft.blocks.length >= 12) return;
  const source = state.templateDraft.blocks[blockIndex];
  if (
    !source ||
    templateCounts(state.templateDraft).weeks + source.weeks.length > 104
  ) return;
  const copy = cloneTemplateNode(source);
  copy.name = `${source.name} copy`;
  state.templateDraft.blocks.splice(blockIndex + 1, 0, copy);
  rerenderTemplateBuilder();
}

function moveArrayItem(list, index, direction) {
  const target = index + direction;
  if (target < 0 || target >= list.length) return;
  [list[index], list[target]] = [list[target], list[index]];
}

function moveTemplateBlock(blockIndex, direction) {
  if (!state.templateDraft) return;
  moveArrayItem(state.templateDraft.blocks, blockIndex, direction);
  rerenderTemplateBuilder();
}

function addTemplateWeek(blockIndex) {
  const block = state.templateDraft?.blocks[blockIndex];
  if (
    !block ||
    block.weeks.length >= 52 ||
    templateCounts(state.templateDraft).weeks >= 104
  ) return;
  resizeBlockWeeks(blockIndex, block.weeks.length + 1);
  rerenderTemplateBuilder();
}

function removeTemplateWeek(blockIndex, weekIndex) {
  const block = state.templateDraft?.blocks[blockIndex];
  if (!block || block.weeks.length <= 1) return;
  block.weeks.splice(weekIndex, 1);
  state.templateDraft.event_compile_summary = null;
  rerenderTemplateBuilder();
}

function duplicateTemplateWeek(blockIndex, weekIndex) {
  const block = state.templateDraft?.blocks[blockIndex];
  if (
    !block ||
    block.weeks.length >= 52 ||
    templateCounts(state.templateDraft).weeks >= 104
  ) return;
  const source = block.weeks[weekIndex];
  if (!source) return;
  block.weeks.splice(weekIndex + 1, 0, cloneTemplateNode(source));
  state.templateDraft.event_compile_summary = null;
  rerenderTemplateBuilder();
}

function moveTemplateWeek(blockIndex, weekIndex, direction) {
  const block = state.templateDraft?.blocks[blockIndex];
  if (!block) return;
  moveArrayItem(block.weeks, weekIndex, direction);
  rerenderTemplateBuilder();
}

function addTemplateSession(blockIndex, weekIndex) {
  const week = state.templateDraft?.blocks[blockIndex]?.weeks[weekIndex];
  if (!week || week.sessions.length >= 7) return;
  week.sessions.push(newTemplateSession(week.sessions.length + 1));
  rerenderTemplateBuilder();
}

function removeTemplateSession(blockIndex, weekIndex, sessionIndex) {
  const week = state.templateDraft?.blocks[blockIndex]?.weeks[weekIndex];
  if (!week || week.sessions.length <= 1) return;
  week.sessions.splice(sessionIndex, 1);
  rerenderTemplateBuilder();
}

function duplicateTemplateSession(blockIndex, weekIndex, sessionIndex) {
  const week = state.templateDraft?.blocks[blockIndex]?.weeks[weekIndex];
  if (!week || week.sessions.length >= 7) return;
  const source = week.sessions[sessionIndex];
  if (!source) return;
  const copy = cloneTemplateNode(source);
  copy.title = `${source.title} copy`;
  week.sessions.splice(sessionIndex + 1, 0, copy);
  rerenderTemplateBuilder();
}

function moveTemplateSession(blockIndex, weekIndex, sessionIndex, direction) {
  const week = state.templateDraft?.blocks[blockIndex]?.weeks[weekIndex];
  if (!week) return;
  moveArrayItem(week.sessions, sessionIndex, direction);
  rerenderTemplateBuilder();
}

function addTemplateWorkItem(blockIndex, weekIndex, sessionIndex) {
  const session = state.templateDraft?.blocks[blockIndex]?.weeks[weekIndex]?.sessions[sessionIndex];
  if (!session || session.work_items.length >= 12) return;
  session.work_items.push(newTemplateWorkItem(session.work_items.length));
  rerenderTemplateBuilder();
}

function removeTemplateWorkItem(blockIndex, weekIndex, sessionIndex, workItemIndex) {
  const session = state.templateDraft?.blocks[blockIndex]?.weeks[weekIndex]?.sessions[sessionIndex];
  if (!session || session.work_items.length <= 1) return;
  const removed = session.work_items[workItemIndex];
  session.work_items.splice(workItemIndex, 1);
  ungroupIfTooSmall(session, removed?.group_id);
  rerenderTemplateBuilder();
}

function duplicateTemplateWorkItem(blockIndex, weekIndex, sessionIndex, workItemIndex) {
  const session = state.templateDraft?.blocks[blockIndex]?.weeks[weekIndex]?.sessions[sessionIndex];
  if (!session || session.work_items.length >= 12) return;
  const source = session.work_items[workItemIndex];
  if (!source) return;
  const copy = cloneTemplateNode(source);
  copy.group_id = "";
  copy.group_type = "straight";
  session.work_items.splice(workItemIndex + 1, 0, copy);
  rerenderTemplateBuilder();
}

function moveTemplateWorkItem(blockIndex, weekIndex, sessionIndex, workItemIndex, direction) {
  const session = state.templateDraft?.blocks[blockIndex]?.weeks[weekIndex]?.sessions[sessionIndex];
  if (!session) return;
  moveArrayItem(session.work_items, workItemIndex, direction);
  rerenderTemplateBuilder();
}

function ungroupIfTooSmall(session, groupId) {
  if (!groupId) return;
  const remaining = session.work_items.filter((item) => item.group_id === groupId);
  if (remaining.length === 1) {
    remaining[0].group_id = "";
    remaining[0].group_type = "straight";
  }
}

function groupWorkItemWithNext(blockIndex, weekIndex, sessionIndex, workItemIndex) {
  const session = state.templateDraft?.blocks[blockIndex]?.weeks[weekIndex]?.sessions[sessionIndex];
  const current = session?.work_items[workItemIndex];
  const next = session?.work_items[workItemIndex + 1];
  if (!current || !next) return;

  const groupId = current.group_id || `group_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const groupType = current.group_type !== "straight" ? current.group_type : "superset";

  current.group_id = groupId;
  current.group_type = groupType;
  next.group_id = groupId;
  next.group_type = groupType;
  rerenderTemplateBuilder();
}

function ungroupWorkItem(blockIndex, weekIndex, sessionIndex, workItemIndex) {
  const session = state.templateDraft?.blocks[blockIndex]?.weeks[weekIndex]?.sessions[sessionIndex];
  const item = session?.work_items[workItemIndex];
  if (!item || !item.group_id) return;

  const groupId = item.group_id;
  item.group_id = "";
  item.group_type = "straight";
  ungroupIfTooSmall(session, groupId);
  rerenderTemplateBuilder();
}

function toggleTemplateWorkItemInfo(button, blockIndex, weekIndex, sessionIndex, workItemIndex) {
  const panel = button.closest(".template-work-item")?.querySelector(".template-work-item-info");
  if (!panel) return;

  if (!panel.hidden) {
    panel.hidden = true;
    return;
  }

  const workItem = state.templateDraft?.blocks[blockIndex]?.weeks[weekIndex]?.sessions[sessionIndex]?.work_items[workItemIndex];
  const exerciseId = String(workItem?.exercise_id ?? "").trim();

  panel.hidden = false;

  if (!exerciseId) {
    panel.innerHTML = '<p class="muted">Select an exercise to view instructions.</p>';
    return;
  }

  loadExerciseHowto(exerciseId, panel, false);
}

function templatePayloadFromDraft() {
  const draft = state.templateDraft;
  if (!draft) throw new Error("No programme is open.");

  syncTemplateHeader();
  if (draft.event_plan) {
    syncTemplateEventFields();
  }
  reindexTemplateDraft();

  if (!draft.template_name.trim()) {
    throw new Error("Enter a programme name.");
  }

  return {
    coach_user_id: state.profile.coachUserId,
    template_id: draft.template_id,
    template_family_id: draft.template_family_id,
    template_version: Number(draft.template_version),
    template_name: draft.template_name.trim(),
    description: draft.description.trim(),
    activity_id: draft.activity_id,
    event_plan: draft.event_plan
      ? {
          event_plan_id: draft.event_plan.event_plan_id,
          event_name: draft.event_plan.event_name.trim(),
          event_type: draft.event_plan.event_type,
          event_date: draft.event_plan.event_date,
          programme_start_date: draft.event_plan.programme_start_date,
          location: draft.event_plan.location.trim(),
          timezone: draft.event_plan.timezone.trim(),
          notes: draft.event_plan.notes.trim()
        }
      : null,
    // Echoed back unchanged: only bindSelectedEventToTemplate() may create or
    // move this binding (see the immutability guard in
    // saveCoachProgrammeTemplate on the server). An ordinary content save can
    // resize blocks/weeks but must never duplicate or drift the event date.
    bound_event_id: draft.bound_event_id || "",
    bound_event_record_sha256: draft.bound_event_record_sha256 || "",
    blocks: draft.blocks.map((block) => ({
      block_id: block.block_id,
      order_index: Number(block.order_index),
      name: block.name.trim(),
      description: block.description.trim(),
      block_type: block.block_type,
      week_count: block.weeks.length,
      weeks: block.weeks.map((week) => ({
        week_id: week.week_id,
        order_index: Number(week.order_index),
        sessions: week.sessions.map((session) => ({
          session_id: session.session_id,
          order_index: Number(session.order_index),
          title: session.title.trim(),
          coaching_notes: (session.coaching_notes ?? "").trim(),
          work_items: session.work_items.map((workItem) => ({
            work_item_id: workItem.work_item_id,
            order_index: Number(workItem.order_index),
            exercise_id: workItem.exercise_id,
            planned_sets: Number(workItem.planned_sets),
            prescription_mode: workItem.prescription_mode,
            rep_mode: workItem.rep_mode,
            planned_reps: Number(workItem.planned_reps),
            rep_min: Number(workItem.rep_min),
            rep_max: Number(workItem.rep_max),
            tempo: (workItem.tempo ?? "").trim(),
            duration_mode: workItem.duration_mode,
            planned_duration_seconds: Number(workItem.planned_duration_seconds),
            duration_min_seconds: Number(workItem.duration_min_seconds),
            duration_max_seconds: Number(workItem.duration_max_seconds),
            distance_mode: workItem.distance_mode,
            distance_unit: workItem.distance_unit,
            planned_distance_value: Number(workItem.planned_distance_value),
            distance_min_value: Number(workItem.distance_min_value),
            distance_max_value: Number(workItem.distance_max_value),
            load_mode: workItem.load_mode,
            percent_1rm: Number(workItem.percent_1rm),
            weight_value: Number(workItem.weight_value),
            weight_unit: workItem.weight_unit,
            rpe_value: Number(workItem.rpe_value),
            rest_seconds: Number(workItem.rest_seconds),
            role: workItem.role,
            coaching_notes: (workItem.coaching_notes ?? "").trim(),
            segment: workItem.segment,
            group_id: workItem.group_id,
            group_type: workItem.group_type
          }))
        }))
      }))
    })),
    updated_at_iso8601: nowIso()
  };
}

async function saveTemplateDraft(options = {}) {
  if (!state.templateDraft) {
    throw new Error("No programme is open.");
  }

  if (!options.quiet) {
    showBusy("Saving programme draft…");
  }

  templateBuilderSaving = true;
  templateBuilderSaveError = "";
  renderTemplateBuilderState();

  try {
    const payload = templatePayloadFromDraft();
    const response = await api("POST", "/templates", payload);
    const savedDraft = templateRecordToDraft(response.template);

    state.templateDraft = normalisePersistedTemplateDraft(savedDraft);
    state.templateDraftSavedSnapshot =
      templateDraftSnapshot(state.templateDraft);
    state.templateDraftSavedAt = String(
      response.template?.updated_at_iso8601 ??
      payload.updated_at_iso8601 ??
      nowIso()
    );
    state.templateDraftWasOpen = true;
    state.templateDraftRecovered = false;
    state.templateDraftDirty = false;

    await refreshProgrammeLibrary({ quiet: true });

    openTemplateBuilder(
      state.templateDraft,
      {
        preserveBaseline: true,
        skipRecoveryCheck: true
      }
    );

    if (!options.quiet) {
      showNotice("Programme draft saved.");
    }

    return response.template;
  }
  catch (error) {
    templateBuilderSaveError =
      error instanceof Error
        ? error.message
        : "The programme draft could not be saved.";

    state.templateDraftDirty = templateDraftIsDirty();
    saveState();
    renderTemplateBuilderState();
    throw error;
  }
  finally {
    templateBuilderSaving = false;
    renderTemplateBuilderState();

    if (!options.quiet) {
      hideBusy();
    }
  }
}

async function completeTemplateById(templateId) {
  const template = state.coachTemplates.find(
    (candidate) => candidate.template_id === String(templateId ?? "")
  );

  if (!template) throw new Error("The programme could not be found.");

  if (state.templateExercises.length === 0) {
    await loadTemplateExercises();
  }

  const issues = programmeActivationIssues(template);

  if (issues.length > 0) {
    openProgrammeDetail(template.template_id);
    showNotice(
      `Programme has ${issues.length} completion issue${issues.length === 1 ? "" : "s"}.`,
      "error"
    );
    return null;
  }

  showBusy("Saving complete template…");

  try {
    const response = await api(
      "POST",
      `/templates/${encodeURIComponent(templateId)}/complete`,
      { coach_user_id: state.profile.coachUserId }
    );

    await refreshProgrammeLibrary({ quiet: true });
    showNotice("Template marked complete. Ready to activate.");
    return response.template ?? null;
  }
  finally {
    hideBusy();
  }
}

async function completeOpenTemplate() {
  if (!state.templateDraft) return;
  let templateId = state.templateDraft.template_id;
  const saved = await saveTemplateDraft({ quiet: true });
  templateId = String(saved.template_id ?? templateId);
  const completed = await completeTemplateById(templateId);

  if (completed) {
    openTemplateBuilder(
      templateRecordToDraft(completed),
      {
        preserveBaseline: true,
        skipRecoveryCheck: true
      }
    );
  }
}

async function activateTemplateById(templateId) {
  showBusy("Activating programme…");

  try {
    const response = await api(
      "POST",
      `/templates/${encodeURIComponent(templateId)}/activate`,
      { coach_user_id: state.profile.coachUserId }
    );

    await refreshProgrammeLibrary({ quiet: true });
    closeTemplateBuilder();
    showNotice("Programme activated and available for assignment.");
    return response.template ?? null;
  }
  finally {
    hideBusy();
  }
}

async function activateOpenTemplate() {
  if (!state.templateDraft) return;
  await activateTemplateById(state.templateDraft.template_id);
}

async function duplicateTemplate(templateId) {
  if (!confirmRecoveredTemplateReplacement()) {
    return null;
  }

  showBusy("Creating new programme version…");

  try {
    const response = await api(
      "POST",
      `/templates/${encodeURIComponent(templateId)}/duplicate`,
      { coach_user_id: state.profile.coachUserId }
    );

    await refreshTemplates({ quiet: true });

    openTemplateBuilder(
      templateRecordToDraft(response.template),
      {
        skipRecoveryCheck: true
      }
    );

    showNotice("New draft programme version created.");
    return response.template ?? null;
  }
  finally {
    hideBusy();
  }
}

async function archiveTemplate(templateId) {
  const template = state.coachTemplates.find(
    (candidate) => candidate.template_id === String(templateId ?? "")
  );

  if (!template) throw new Error("The programme could not be found.");

  const usage = programmeAssignmentUsage(template.template_id);
  const confirmation = usage.assignmentCount > 0
    ? `Archive ${template.template_name} version ${programmeVersionNumber(template)}? ${usage.assignmentCount} assignment record${usage.assignmentCount === 1 ? "" : "s"} across ${usage.athleteCount} athlete${usage.athleteCount === 1 ? "" : "s"} retain this exact version.`
    : `Archive ${template.template_name} version ${programmeVersionNumber(template)}? No assignment records use this exact version.`;

  if (!globalThis.confirm(confirmation)) return null;

  showBusy("Archiving programme…");

  try {
    const response = await api(
      "POST",
      `/templates/${encodeURIComponent(templateId)}/archive`,
      { coach_user_id: state.profile.coachUserId }
    );

    await refreshProgrammeLibrary({ quiet: true });
    state.selectedTemplateId = String(templateId);
    saveState();
    renderTemplateLibrary();
    showNotice("Programme archived. Existing assignments retain this version.");
    return response.template ?? null;
  }
  finally {
    hideBusy();
  }
}
const COACH_EVENT_TYPES = Object.freeze({
  powerlifting: [
    ["powerlifting_meet", "Powerlifting meet"],
    ["strength_event", "Strength event"],
    ["test_day", "Test day"],
    ["other", "Other"]
  ],
  general_strength: [
    ["strength_event", "Strength event"],
    ["test_day", "Test day"],
    ["other", "Other"]
  ],
  rugby_union: [
    ["rugby_match", "Rugby match"],
    ["rugby_tournament", "Rugby tournament"],
    ["test_day", "Test day"],
    ["other", "Other"]
  ]
});

function coachEventPlan(eventRecord) {
  return eventRecord?.event_plan && typeof eventRecord.event_plan === "object"
    ? eventRecord.event_plan
    : null;
}

function coachEventCompile(eventRecord) {
  return eventRecord?.event_compile_summary && typeof eventRecord.event_compile_summary === "object"
    ? eventRecord.event_compile_summary
    : null;
}

function syncCoachEventTypeOptions() {
  const activityId = elements.eventActivity.value || "powerlifting";
  const previous = elements.eventType.value;
  const options = COACH_EVENT_TYPES[activityId] ?? COACH_EVENT_TYPES.powerlifting;

  elements.eventType.innerHTML = options
    .map(([value, label]) => `<option value="${escapeHtml(value)}">${escapeHtml(label)}</option>`)
    .join("");

  if (options.some(([value]) => value === previous)) {
    elements.eventType.value = previous;
  }
}

function renderCoachEventPreview() {
  syncCoachEventTypeOptions();
  const startDate = elements.eventProgrammeStartDate.value;
  const eventDate = elements.eventDate.value;
  const days = dateOnlyDifference(startDate, eventDate);

  elements.eventPreviewCountdown.textContent = eventDate
    ? countdownLabel(eventDate)
    : "Set event date";

  elements.eventPreviewWeeks.textContent = Number.isInteger(days) && days > 0
    ? String(Math.ceil(days / 7))
    : "—";
}

async function refreshCoachEvents(options = {}) {
  if (state.role !== "coach" || !state.profile?.coachUserId) return [];
  if (!options.quiet) showBusy("Loading events…");

  try {
    const response = await api(
      "GET",
      `/coach-workspace/events?coach_user_id=${encodeURIComponent(state.profile.coachUserId)}`
    );

    state.coachEvents = Array.isArray(response.events) ? response.events : [];
    saveState();
    renderCoachEvents();

    if (state.selectedCoachAthleteId) {
      renderAthleteProfileAssignment();
    }

    return state.coachEvents;
  }
  finally {
    if (!options.quiet) hideBusy();
  }
}

async function refreshAthleteEventLinks(athleteUserId, options = {}) {
  if (!athleteUserId || !state.profile?.coachUserId) return [];
  if (!options.quiet) showBusy("Loading athlete event links…");

  try {
    const response = await api(
      "GET",
      `/coach-workspace/athlete-event-links?coach_user_id=${encodeURIComponent(state.profile.coachUserId)}&athlete_user_id=${encodeURIComponent(athleteUserId)}`
    );

    state.athleteEventLinks[athleteUserId] = Array.isArray(response.links)
      ? response.links
      : [];
    saveState();
    return state.athleteEventLinks[athleteUserId];
  }
  finally {
    if (!options.quiet) hideBusy();
  }
}

function renderCoachEvents() {
  if (!elements.eventList) return;

  const today = todayDateOnly();
  const events = Array.isArray(state.coachEvents) ? state.coachEvents : [];
  const upcoming = events.filter((eventRecord) => {
    const plan = coachEventPlan(eventRecord);
    return plan?.event_date && plan.event_date >= today;
  });
  const linkedCount = events.reduce(
    (total, eventRecord) => total + Number(eventRecord.linked_athlete_count ?? 0),
    0
  );

  elements.eventCount.textContent = String(events.length);
  elements.eventUpcomingCount.textContent = String(upcoming.length);
  elements.eventLinkedCount.textContent = String(linkedCount);

  elements.eventList.innerHTML = events.length
    ? events.map((eventRecord) => {
        const plan = coachEventPlan(eventRecord) ?? {};
        const compile = coachEventCompile(eventRecord) ?? {};
        const linkedAthletes = Number(eventRecord.linked_athlete_count ?? 0);
        return `
          <article class="record-card coach-event-card" data-event-id="${escapeHtml(eventRecord.event_id ?? "")}">
            <div>
              <p class="eyebrow">${escapeHtml(titleCase(eventRecord.activity_id ?? "event"))}</p>
              <h3>${escapeHtml(plan.event_name ?? "Event")}</h3>
              <p>${escapeHtml(titleCase(plan.event_type ?? "event"))} · ${escapeHtml(formatDate(plan.event_date))}${plan.location ? ` · ${escapeHtml(plan.location)}` : ""}${plan.timezone ? ` · ${escapeHtml(plan.timezone)}` : ""}</p>
              ${plan.notes ? `<p class="coach-event-notes">${escapeHtml(plan.notes)}</p>` : ""}
            </div>
            <div class="record-meta coach-event-meta">
              <strong>${escapeHtml(countdownLabel(plan.event_date))}</strong>
              <span class="badge neutral">${Number(compile.required_week_count ?? 0)} weeks</span>
              <span class="badge ${linkedAthletes > 0 ? "active" : "neutral"}">${linkedAthletes} athlete${linkedAthletes === 1 ? "" : "s"}</span>
            </div>
          </article>
        `;
      }).join("")
    : `
      <div class="empty-state">
        <div class="empty-icon">E</div>
        <h3>No events compiled</h3>
        <p>Create an event date anchor, then link athletes and programmes from each athlete profile.</p>
      </div>
    `;

  renderCoachEventPreview();
}

async function createCoachEvent(event) {
  event.preventDefault();
  showBusy("Compiling event…");

  try {
    const timestamp = nowIso();
    const response = await api("POST", "/coach-workspace/events", {
      coach_user_id: state.profile.coachUserId,
      event_id: "",
      event_name: elements.eventName.value.trim(),
      activity_id: elements.eventActivity.value,
      event_type: elements.eventType.value,
      programme_start_date: elements.eventProgrammeStartDate.value,
      event_date: elements.eventDate.value,
      location: elements.eventLocation.value.trim(),
      timezone: elements.eventTimezone.value.trim() || "Europe/London",
      notes: elements.eventNotes.value.trim(),
      created_at_iso8601: timestamp,
      updated_at_iso8601: timestamp
    });

    await refreshCoachEvents({ quiet: true });
    elements.eventForm.reset();
    elements.eventActivity.value = response.event?.activity_id ?? "powerlifting";
    elements.eventTimezone.value = "Europe/London";
    syncCoachEventTypeOptions();
    renderCoachEventPreview();
    showNotice(`${coachEventPlan(response.event)?.event_name ?? "Event"} compiled.`);
  }
  finally {
    hideBusy();
  }
}

function selectedAthleteProfileTemplate() {
  return state.coachTemplates.find(
    (template) => template.template_id === elements.athleteAssignmentTemplate.value
  ) ?? null;
}

function selectedAthleteProfileEvent() {
  return state.coachEvents.find(
    (eventRecord) => eventRecord.event_id === elements.athleteAssignmentEvent.value
  ) ?? null;
}

function renderAthleteProfileAssignmentRequirements() {
  const athlete = state.coachAthletes.find(
    (entry) => entry.userId === state.selectedCoachAthleteId
  );
  const template = selectedAthleteProfileTemplate();
  const eventRecord = selectedAthleteProfileEvent();

  if (!athlete || !template) {
    elements.athleteAssignmentRequirements.className = "assignment-requirements neutral";
    elements.athleteAssignmentRequirements.textContent = "Select an active programme.";
    elements.athleteAssignmentButton.disabled = true;
    return false;
  }

  if (template.activity_id !== athlete.activityId) {
    elements.athleteAssignmentRequirements.className = "assignment-requirements warning";
    elements.athleteAssignmentRequirements.textContent = "The programme activity does not match this athlete.";
    elements.athleteAssignmentButton.disabled = true;
    return false;
  }

  if (eventRecord && eventRecord.activity_id !== athlete.activityId) {
    elements.athleteAssignmentRequirements.className = "assignment-requirements warning";
    elements.athleteAssignmentRequirements.textContent = "The event activity does not match this athlete.";
    elements.athleteAssignmentButton.disabled = true;
    return false;
  }

  if (eventRecord) {
    const compile = coachEventCompile(eventRecord) ?? {};
    if (Number(template.week_count) !== Number(compile.required_week_count)) {
      elements.athleteAssignmentRequirements.className = "assignment-requirements warning";
      elements.athleteAssignmentRequirements.textContent = `Programme has ${Number(template.week_count ?? 0)} weeks; this event calendar requires ${Number(compile.required_week_count ?? 0)} weeks.`;
      elements.athleteAssignmentButton.disabled = true;
      return false;
    }
  }

  const required = requiredOneRmExerciseIds(template);
  const profile = profileForAthlete(athlete.userId);
  const current = currentProfileBenchmarks(profile);
  const missing = required.filter((exerciseId) => !current.has(exerciseId));

  if (missing.length > 0) {
    elements.athleteAssignmentRequirements.className = "assignment-requirements warning";
    elements.athleteAssignmentRequirements.innerHTML = `Missing current strength references: <strong>${missing.map(exerciseDisplayName).map(escapeHtml).join(", ")}</strong>.`;
    elements.athleteAssignmentButton.disabled = true;
    return false;
  }

  elements.athleteAssignmentRequirements.className = "assignment-requirements complete";
  elements.athleteAssignmentRequirements.textContent = eventRecord
    ? `Ready to assign ${template.template_name} and link ${coachEventPlan(eventRecord)?.event_name ?? "the event"}.`
    : `Ready to assign ${template.template_name} without an event link.`;
  elements.athleteAssignmentButton.disabled = false;
  return true;
}

function renderAthleteProfileAssignment() {
  const athlete = state.coachAthletes.find(
    (entry) => entry.userId === state.selectedCoachAthleteId
  );

  if (!athlete) {
    elements.athleteAssignmentPanel.hidden = true;
    return;
  }

  elements.athleteAssignmentPanel.hidden = false;

  const eventValue = elements.athleteAssignmentEvent.value;
  const templateValue = elements.athleteAssignmentTemplate.value;
  const events = state.coachEvents.filter(
    (eventRecord) => eventRecord.event_status === "active" && eventRecord.activity_id === athlete.activityId
  );
  const templates = activeCoachTemplates(athlete.activityId);

  elements.athleteAssignmentEvent.innerHTML = [
    '<option value="">No event link</option>',
    ...events.map((eventRecord) => {
      const plan = coachEventPlan(eventRecord) ?? {};
      return `<option value="${escapeHtml(eventRecord.event_id)}">${escapeHtml(plan.event_name ?? "Event")} · ${escapeHtml(formatDate(plan.event_date))}</option>`;
    })
  ].join("");

  elements.athleteAssignmentTemplate.innerHTML = templates.length
    ? templates.map((template) => `<option value="${escapeHtml(template.template_id)}">${escapeHtml(template.template_name)} · v${Number(template.template_version)}</option>`).join("")
    : '<option value="">No active programmes for this activity</option>';

  if (events.some((eventRecord) => eventRecord.event_id === eventValue)) {
    elements.athleteAssignmentEvent.value = eventValue;
  }
  if (templates.some((template) => template.template_id === templateValue)) {
    elements.athleteAssignmentTemplate.value = templateValue;
  }

  elements.athleteAssignmentTemplate.disabled = templates.length === 0;

  const links = Array.isArray(state.athleteEventLinks[athlete.userId])
    ? state.athleteEventLinks[athlete.userId]
    : [];

  elements.athleteEventLinks.innerHTML = links.length
    ? links.map((link) => {
        const eventRecord = link.event && typeof link.event === "object" ? link.event : {};
        const plan = coachEventPlan(eventRecord) ?? {};
        const template = state.coachTemplates.find((entry) => entry.template_id === link.template_id);
        return `
          <article class="record-card athlete-event-link-card">
            <div>
              <p class="eyebrow">Current event link</p>
              <h3>${escapeHtml(plan.event_name ?? "Event")}</h3>
              <p>${escapeHtml(formatDate(plan.event_date))}${plan.location ? ` · ${escapeHtml(plan.location)}` : ""}</p>
            </div>
            <div class="record-meta">
              <strong>${escapeHtml(countdownLabel(plan.event_date))}</strong>
              <span class="badge active">${escapeHtml(template?.template_name ?? titleCase(link.template_id ?? "programme"))}</span>
            </div>
          </article>
        `;
      }).join("")
    : '<div class="empty-state compact-empty"><p>The current assignment has no event link.</p></div>';

  renderAthleteProfileAssignmentRequirements();
  renderAssignmentLifecycleSurfaces();
}

async function recordAthleteProfileAssignment(event) {
  event.preventDefault();
  const athlete = state.coachAthletes.find(
    (entry) => entry.userId === state.selectedCoachAthleteId
  );
  const template = selectedAthleteProfileTemplate();
  const eventRecord = selectedAthleteProfileEvent();

  if (!athlete || !template || !renderAthleteProfileAssignmentRequirements()) {
    throw new Error("Complete the athlete assignment requirements first.");
  }

  const current = currentAssignmentForAthlete(athlete.userId);
  const eventPlan = coachEventPlan(eventRecord);
  const confirmation = current
    ? `Replace ${assignmentTemplateName(current)} version ${assignmentTemplateVersion(current)} with ${template.template_name} version ${Number(template.template_version)}${eventPlan?.event_name ? ` linked to ${eventPlan.event_name}` : " without an event link"}? Existing compiled sessions remain unchanged.`
    : `Assign ${template.template_name} version ${Number(template.template_version)}${eventPlan?.event_name ? ` and link ${eventPlan.event_name}` : " without an event link"}?`;

  if (!globalThis.confirm(confirmation)) return;

  elements.athleteAssignmentButton.disabled = true;
  showBusy(current ? "Replacing programme assignment…" : "Assigning programme…");

  try {
    const payload = {
      request_id: createId(current ? "assignment_replace" : "assignment_request"),
      requested_at_iso8601: nowIso(),
      coach_user_id: state.profile.coachUserId,
      athlete_user_id: athlete.userId,
      template_id: template.template_id,
      activity_id: athlete.activityId,
      event_id: eventRecord?.event_id ?? ""
    };

    const response = current
      ? await api(
          "POST",
          `/coach-workspace/athlete-assignment/${encodeURIComponent(current.assignmentId)}/replace`,
          payload
        )
      : await api("POST", "/coach-workspace/athlete-assignment", payload);

    await Promise.all([
      refreshCoachAssignments({ quiet: true }),
      refreshCoachEvents({ quiet: true }),
      refreshAthleteEventLinks(athlete.userId, { quiet: true }),
      refreshAthleteDetail(athlete.userId, { quiet: true }).catch(() => null)
    ]);

    const preservedCount = Number(response.preserved_session_count ?? 0);
    elements.athleteAssignmentResult.hidden = false;
    elements.athleteAssignmentResult.textContent = current
      ? `${template.template_name} version ${Number(template.template_version)} replaced the current assignment. ${preservedCount} existing session${preservedCount === 1 ? "" : "s"} remain attached to the earlier assignment.`
      : response.event_link
        ? `${template.template_name} version ${Number(template.template_version)} assigned and linked to ${eventPlan?.event_name ?? "the event"}.`
        : `${template.template_name} version ${Number(template.template_version)} assigned without an event link.`;

    renderCoachWorkspace();
    renderAthleteProfileAssignment();
    showNotice(current ? "Athlete assignment replaced." : "Athlete assignment recorded.");
  }
  finally {
    elements.athleteAssignmentButton.disabled = false;
    hideBusy();
  }
}


function currentTermsAvailable() {
  return Boolean(
    state.currentTerms &&
    typeof state.currentTerms === "object" &&
    state.currentTerms
      .current_terms_version &&
    state.currentTerms
      .current_consent_version
  );
}

function renderTermsState() {
  const account =
    state.serverAccount ?? {};

  const terms =
    state.currentTerms ??
    state.accountDetail?.terms ??
    {};

  const currentTerms = String(
    terms.current_terms_version ??
    account.current_terms_version ??
    ""
  );

  const currentConsent = String(
    terms.current_consent_version ??
    account.current_consent_version ??
    ""
  );

  const acceptedTerms = String(
    account.accepted_terms_version ??
    ""
  );

  const acceptedConsent = String(
    account.accepted_consent_version ??
    ""
  );

  elements.entryTermsVersion.textContent =
    currentTerms || "unavailable";

  elements.entryConsentVersion.textContent =
    currentConsent || "unavailable";

  elements.accountCurrentTermsVersion.textContent =
    currentTerms || "Unavailable";

  elements.accountCurrentConsentVersion.textContent =
    currentConsent || "Unavailable";

  elements.accountAcceptedTermsVersion.textContent =
    acceptedTerms || "Not recorded";

  elements.accountAcceptedConsentVersion.textContent =
    acceptedConsent || "Not recorded";

  if (elements.entrySubmit) {
    elements.entrySubmit.disabled =
      elements.entryMode.value === "create" &&
      (!currentTerms || !currentConsent);
  }
}

async function loadServerTerms() {
  const terms =
    await loadCurrentTerms();

  state.currentTerms = terms;
  renderTermsState();

  return terms;
}

function renderAccountHistory() {
  const history = Array.isArray(
    state.accountDetail?.consent_history
  )
    ? state.accountDetail.consent_history
    : [];

  elements.accountConsentHistory.innerHTML =
    history.length
      ? history.map((event) => {
          const payload =
            event.event_payload &&
            typeof event.event_payload === "object"
              ? event.event_payload
              : {};

          const versions = [
            payload.terms_version
              ? `Terms ${payload.terms_version}`
              : "",
            payload.consent_version
              ? `Consent ${payload.consent_version}`
              : ""
          ].filter(Boolean);

          return `
            <article class="record-card">
              <div>
                <strong>${escapeHtml(titleCase(event.event_type))}</strong>
                <p>${escapeHtml(formatDate(event.occurred_at_iso8601))}</p>
                ${versions.length > 0
                  ? `<p class="muted small">${escapeHtml(versions.join(" · "))}</p>`
                  : ""}
              </div>
            </article>
          `;
        }).join("")
      : '<div class="empty-state compact-empty"><p>No consent or verification events recorded.</p></div>';
}

function renderAccount() {
  const id = currentAccountId();
  const account =
    state.serverAccount ?? {};

  elements.accountName.textContent =
    account.display_name ??
    state.profile?.displayName ??
    "Kolosseum user";

  elements.accountEmail.textContent =
    account.email ??
    state.profile?.email ??
    "";

  elements.accountRoleBadge.textContent =
    roleLabel();

  const accountState =
    String(
      account.account_state ??
      "active"
    );

  elements.accountStateBadge.textContent =
    titleCase(accountState);

  elements.accountStateBadge.className =
    accountState === "active"
      ? "badge complete"
      : accountState === "suspended"
        ? "badge warning"
        : "badge danger";

  elements.accountVerificationBadge.textContent =
    account.email_verified
      ? "Email verified"
      : "Email not verified";

  elements.accountVerificationBadge.className =
    account.email_verified
      ? "badge complete"
      : "badge neutral";

  elements.accountCode.textContent =
    id || "—";

  elements.accountProfileName.value =
    account.display_name ??
    state.profile?.displayName ??
    "";

  elements.accountProfileEmail.value =
    account.email ??
    state.profile?.email ??
    "";

  elements.requestVerificationButton.disabled =
    account.email_verified === true;

  elements.completeVerificationButton.disabled =
    account.email_verified === true;

  renderTermsState();
  renderAccountHistory();

  let coachLinkPanel =
    document.getElementById(
      "athleteCoachLinkPanel"
    );

  if (state.role === "athlete") {
    if (!coachLinkPanel) {
      coachLinkPanel =
        document.createElement(
          "article"
        );

      coachLinkPanel.id =
        "athleteCoachLinkPanel";

      coachLinkPanel.className =
        "panel";

      coachLinkPanel.innerHTML = `
        <p class="eyebrow">Coach-managed training</p>
        <h3>Coach account code</h3>
        <p class="muted">Enter the coach account code only after the coach has connected this athlete account.</p>
        <div class="inline-controls">
          <input id="coachCodeInput" autocomplete="off" placeholder="Coach account code" />
          <button id="saveCoachCodeButton" class="button secondary" type="button">Save code</button>
        </div>
      `;

      document
        .querySelector(
          "#view-account .two-column"
        )
        .insertAdjacentElement(
          "afterend",
          coachLinkPanel
        );

      coachLinkPanel
        .querySelector(
          "#saveCoachCodeButton"
        )
        .addEventListener(
          "click",
          () => {
            state.coachCode =
              coachLinkPanel
                .querySelector(
                  "#coachCodeInput"
                )
                .value
                .trim();

            saveState();

            showNotice(
              state.coachCode
                ? "Coach account code saved."
                : "Coach account code cleared."
            );
          }
        );
    }

    coachLinkPanel.hidden = false;

    coachLinkPanel
      .querySelector(
        "#coachCodeInput"
      )
      .value =
        state.coachCode ?? "";
  }
  else if (coachLinkPanel) {
    coachLinkPanel.hidden = true;
  }

  renderPendingRelationshipInvitations();
  renderAthleteRelationships();
}

// FULL-UI-24: a coach invites an athlete by email, never by the athlete's
// internal user_id; the athlete accepts here by clicking a real button, never
// by typing any id.
function renderPendingRelationshipInvitations() {
  let panel = document.getElementById("pendingRelationshipInvitationsPanel");

  if (state.role !== "athlete") {
    if (panel) panel.hidden = true;
    return;
  }

  if (!panel) {
    panel = document.createElement("article");
    panel.id = "pendingRelationshipInvitationsPanel";
    panel.className = "panel";

    document
      .querySelector("#view-account .two-column")
      .insertAdjacentElement("afterend", panel);
  }

  const invitations = Array.isArray(state.pendingRelationshipInvitations)
    ? state.pendingRelationshipInvitations
    : [];

  if (invitations.length === 0) {
    panel.hidden = true;
    return;
  }

  panel.hidden = false;
  panel.innerHTML = `
    <p class="eyebrow">Coach invitations</p>
    <h3>Pending coach invitations</h3>
    <div class="record-list">
      ${invitations.map((invitation) => `
        <article class="record-row" data-relationship-id="${escapeHtml(invitation.relationship_id)}">
          <div>
            <strong>${escapeHtml(invitation.coach_display_name)}</strong>
            <p class="muted small">${escapeHtml(invitation.coach_email ?? "")}</p>
          </div>
          <div class="inline-controls">
            <button type="button" class="button secondary decline-relationship-invitation-button">Decline</button>
            <button type="button" class="button primary accept-relationship-invitation-button">Accept</button>
          </div>
        </article>
      `).join("")}
    </div>
  `;

  for (const button of panel.querySelectorAll(".accept-relationship-invitation-button")) {
    button.addEventListener(
      "click",
      guardedAction(button, async () => {
        const relationshipId = button.closest("[data-relationship-id]")?.dataset.relationshipId;
        await acceptRelationshipInvitation(relationshipId);
      })
    );
  }

  for (const button of panel.querySelectorAll(".decline-relationship-invitation-button")) {
    button.addEventListener(
      "click",
      guardedAction(button, async () => {
        const relationshipId = button.closest("[data-relationship-id]")?.dataset.relationshipId;
        await declineRelationshipInvitation(relationshipId);
      })
    );
  }
}

async function refreshPendingRelationshipInvitations() {
  if (state.role !== "athlete") return [];

  const response = await api("GET", "/coach-workspace/relationship-invitations");
  state.pendingRelationshipInvitations = Array.isArray(response.invitations)
    ? response.invitations
    : [];

  renderPendingRelationshipInvitations();
  return state.pendingRelationshipInvitations;
}

async function acceptRelationshipInvitation(relationshipId) {
  if (!relationshipId) return;

  await api(
    "POST",
    `/coach-workspace/relationship-invitations/${encodeURIComponent(relationshipId)}/accept`
  );

  showNotice("Coach invitation accepted.");
  await refreshPendingRelationshipInvitations();
  await refreshAthleteRelationships().catch(handleError);
  await loadAthleteToday().catch(handleError);
}

async function declineRelationshipInvitation(relationshipId) {
  if (!relationshipId) return;

  await api(
    "POST",
    `/coach-workspace/relationship-invitations/${encodeURIComponent(relationshipId)}/decline`
  );

  showNotice("Coach invitation declined.");
  await refreshPendingRelationshipInvitations();
  await refreshAthleteRelationships().catch(handleError);
}

// FULL-UI-25: the athlete's own current and past coach relationships - a
// closed relationship is never deleted, only ever appended to, so its
// history remains visible here even after the athlete or coach ends it.
function renderAthleteRelationships() {
  let panel = document.getElementById("athleteRelationshipsPanel");

  if (state.role !== "athlete") {
    if (panel) panel.hidden = true;
    return;
  }

  if (!panel) {
    panel = document.createElement("article");
    panel.id = "athleteRelationshipsPanel";
    panel.className = "panel";

    document
      .querySelector("#view-account .two-column")
      .insertAdjacentElement("afterend", panel);
  }

  const relationships = Array.isArray(state.athleteRelationships)
    ? state.athleteRelationships
    : [];

  if (relationships.length === 0) {
    panel.hidden = true;
    return;
  }

  const current = relationships.filter((entry) => entry.relationship_state === "accepted");
  const past = relationships.filter((entry) => entry.relationship_state !== "accepted");
  const currentCoach = current[0] ?? null;

  panel.hidden = false;
  panel.innerHTML = `
    <p class="eyebrow">Coach relationships</p>
    <h3>My coach</h3>
    <div class="record-list">
      ${current.length > 0
        ? current.map((entry) => `
          <article class="record-row" data-relationship-id="${escapeHtml(entry.relationship_id)}"${entry.coach_brand_color ? ` style="border-left: 3px solid ${escapeHtml(entry.coach_brand_color)}"` : ""}>
            <div>
              <strong>${escapeHtml(entry.coach_display_name)}</strong>
              <p class="muted small">${escapeHtml(entry.coach_email ?? "")}</p>
              ${entry.coach_brand_tagline ? `<p class="muted small">${escapeHtml(entry.coach_brand_tagline)}</p>` : ""}
            </div>
            <button type="button" class="button secondary end-relationship-button">End relationship</button>
          </article>
        `).join("")
        : `<p class="muted small">No current coach.</p>`
      }
    </div>
    ${past.length > 0 ? `
      <p class="eyebrow">Past relationships</p>
      <div class="record-list">
        ${past.map((entry) => `
          <article class="record-row">
            <div>
              <strong>${escapeHtml(entry.coach_display_name)}</strong>
              <p class="muted small">${escapeHtml(titleCase(entry.relationship_state))}</p>
            </div>
          </article>
        `).join("")}
      </div>
    ` : ""}
    ${currentCoach ? `
      <p class="eyebrow">Messages</p>
      <div id="athleteMessageHistory" class="record-list"></div>
      <form id="athleteMessageForm" class="athlete-detail-note-form" data-coach-user-id="${escapeHtml(currentCoach.coach_user_id)}">
        <label class="field">
          <span>Message your coach</span>
          <textarea id="athleteMessageText" maxlength="4000"></textarea>
        </label>
        <label class="field">
          <span>Attach photo or video (optional)</span>
          <input type="file" id="athleteMessageAttachment" accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime" capture="environment">
        </label>
        <div class="inline-controls">
          <button class="button primary" type="submit">Send</button>
        </div>
      </form>
    ` : ""}
  `;

  for (const button of panel.querySelectorAll(".end-relationship-button")) {
    button.addEventListener(
      "click",
      guardedAction(button, async () => {
        const relationshipId = button.closest("[data-relationship-id]")?.dataset.relationshipId;
        await endAthleteRelationship(relationshipId);
      })
    );
  }

  const messageForm = panel.querySelector("#athleteMessageForm");
  if (messageForm) {
    messageForm.addEventListener(
      "submit",
      (event) => {
        confirmSendAthleteOwnMessage(event, messageForm.dataset.coachUserId).catch(handleError);
      }
    );
    renderAthleteOwnMessages();
  }
}

// Part O.7 - coach-side org/team context, the mirror of O.6's athlete-side
// panel. Read-only (no send action) - which org(s) a coach belongs to,
// and, only for shared (team) orgs, who else coaches there. Individual
// (gym) orgs render org name/badge only; listOrganisationRosterForCoach
// itself is the authority on that boundary (it returns an empty roster for
// individual mode), this is purely display.
async function refreshCoachOrgContext() {
  if (state.role !== "coach") return;

  const response = await api("GET", "/coach-workspace/org-memberships");
  const memberships = Array.isArray(response.memberships) ? response.memberships : [];
  const activeMemberships = memberships.filter((membership) => membership.membership_status !== "removed");

  state.coachOrgContexts = await Promise.all(
    activeMemberships.map(async (membership) => {
      if (membership.visibility_mode !== "shared") {
        return { membership, roster: [] };
      }
      const rosterResponse = await api(
        "GET",
        `/coach-workspace/organisations/${encodeURIComponent(membership.org_id)}/roster`
      );
      return { membership, roster: Array.isArray(rosterResponse.roster) ? rosterResponse.roster : [] };
    })
  );
  renderCoachOrgContext();
}

function coachOrgVisibilityModeLabel(mode) {
  return mode === "shared" ? "Team" : "Gym";
}

function renderCoachOrgContext() {
  let panel = document.getElementById("coachOrgContextPanel");

  if (state.role !== "coach") {
    if (panel) panel.hidden = true;
    return;
  }

  const entries = Array.isArray(state.coachOrgContexts) ? state.coachOrgContexts : [];

  if (entries.length === 0) {
    if (panel) panel.hidden = true;
    return;
  }

  if (!panel) {
    panel = document.createElement("article");
    panel.id = "coachOrgContextPanel";
    panel.className = "panel";

    document
      .querySelector("#view-account .two-column")
      .insertAdjacentElement("afterend", panel);
  }

  panel.hidden = false;
  panel.innerHTML = `
    <p class="eyebrow">Organisations</p>
    <h3>Your organisations</h3>
    ${entries.map((entry) => `
      <div class="record-row coach-org-context-entry">
        <strong>${escapeHtml(entry.membership.org_name)}</strong>
        <span class="badge ${entry.membership.visibility_mode === "shared" ? "active" : "neutral"}">${coachOrgVisibilityModeLabel(entry.membership.visibility_mode)}</span>
        <p class="muted small">
          ${entry.membership.activated_at_iso8601
            ? `Joined ${escapeHtml(formatDate(entry.membership.activated_at_iso8601))}`
            : `Invited ${escapeHtml(formatDate(entry.membership.invited_at_iso8601))}`}
        </p>
        ${entry.membership.visibility_mode === "shared"
          ? `
            <div class="record-list">
              ${entry.roster.map((fellow) => `
                <p class="muted small">
                  ${escapeHtml(fellow.coach_display_name || fellow.coach_user_id)}${fellow.coach_user_id === state.profile?.coachUserId ? " (You)" : ""}${fellow.coach_email ? ` - ${escapeHtml(fellow.coach_email)}` : ""}${fellow.activated_at_iso8601 ? ` &middot; Joined ${escapeHtml(formatDate(fellow.activated_at_iso8601))}` : ""}
                </p>
              `).join("")}
            </div>
          `
          : ""
        }
      </div>
    `).join("")}
  `;
}

async function refreshAthleteRelationships() {
  if (state.role !== "athlete") return [];

  const response = await api("GET", "/coach-workspace/relationships/mine");
  state.athleteRelationships = Array.isArray(response.relationships)
    ? response.relationships
    : [];

  await refreshAthleteOwnMessages().catch(() => {});
  await refreshAthleteOrgMessages().catch(() => {});
  renderAthleteRelationships();
  return state.athleteRelationships;
}

async function refreshAthleteOwnMessages() {
  if (state.role !== "athlete") return;

  const response = await api("GET", "/messages/athlete/threads");
  const threads = Array.isArray(response.threads) ? response.threads : [];
  const thread = threads[0] ?? null;

  if (!thread) {
    state.liveMessageThreadId = null;
    state.athleteMessages = [];
    renderAthleteOwnMessages();
    return;
  }

  state.liveMessageThreadId = thread.thread_id;
  const messagesResponse = await api(
    "GET",
    `/messages/athlete/threads/${encodeURIComponent(thread.thread_id)}`
  );
  state.athleteMessages = Array.isArray(messagesResponse.messages) ? messagesResponse.messages : [];
  renderAthleteOwnMessages();
}

function renderAthleteOwnMessages() {
  const container = document.getElementById("athleteMessageHistory");
  if (!container) return;

  const messages = Array.isArray(state.athleteMessages) ? state.athleteMessages : [];

  if (messages.length === 0) {
    container.innerHTML = `
      <div class="empty-state compact-empty">
        <p>No messages yet.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = messages.map((message) => `
    <article class="review-note-card">
      <div class="record-meta">
        <span class="badge neutral">${message.sender_role === "athlete" ? "You" : "Coach"}</span>
        <span class="muted small">${escapeHtml(formatDate(message.created_at_iso8601))}</span>
      </div>
      ${renderMessageAttachment(message.attachment)}
      ${message.body_text ? `<p>${escapeHtml(message.body_text)}</p>` : ""}
    </article>
  `).join("");
}

async function confirmSendAthleteOwnMessage(event, coachUserId) {
  event.preventDefault();
  if (!coachUserId) return;

  const textarea = document.getElementById("athleteMessageText");
  const bodyText = textarea?.value.trim() ?? "";
  const attachmentFile = document.getElementById("athleteMessageAttachment")?.files?.[0] ?? null;
  if (!bodyText && !attachmentFile) {
    throw new Error("Enter a message or attach a photo/video before sending.");
  }
  const attachmentError = validateAttachmentClientSide(attachmentFile);
  if (attachmentError) {
    throw new Error(attachmentError);
  }

  showBusy("Sending message…");
  try {
    await sendMessageRequest(
      `/messages/athlete/coaches/${encodeURIComponent(coachUserId)}/send`,
      bodyText,
      attachmentFile
    );

    if (textarea) textarea.value = "";
    const attachmentInput = document.getElementById("athleteMessageAttachment");
    if (attachmentInput) attachmentInput.value = "";

    await refreshAthleteOwnMessages();
    showNotice("Message sent.");
  }
  finally {
    hideBusy();
  }
}

// Part D.4 - org-owner<->athlete messaging, athlete side. A separate
// panel/concern from the coach-relationships code above (own function
// group, own state field) - plural by construction, since an athlete
// could in principle be reached by more than one team org, unlike the
// "My coach" singular assumption elsewhere on this page. The org owner
// side has no UI at all (API-only, same as every other org-owner
// capability), so this is the only place these threads are ever rendered.
//
// Part O.6 - the panel used to be gated entirely on a thread already
// existing, but threads are created lazily on first send
// (findOrCreateThread server-side) and this was the only place the
// frontend ever learned an org's org_id - so an athlete could never send
// the FIRST message to their own team; only the org owner could initiate
// (the same gap O.5 found and fixed on the owner's side). GET
// /coach-workspace/org-context/mine now supplies every org the athlete's
// accepted coach relationship(s) give team context for, independent of
// message history, so the panel and its send form can appear before any
// thread exists.
async function refreshAthleteOrgMessages() {
  if (state.role !== "athlete") return;

  const [threadsResponse, contextResponse] = await Promise.all([
    api("GET", "/messages/athlete/org-messages/threads"),
    api("GET", "/coach-workspace/org-context/mine").catch(() => ({ contexts: [] }))
  ]);
  const threads = Array.isArray(threadsResponse.threads) ? threadsResponse.threads : [];

  state.athleteOrgMessageThreads = await Promise.all(
    threads.map(async (thread) => {
      const messagesResponse = await api(
        "GET",
        `/messages/athlete/org-messages/threads/${encodeURIComponent(thread.thread_id)}`
      );
      return {
        thread,
        messages: Array.isArray(messagesResponse.messages) ? messagesResponse.messages : []
      };
    })
  );
  state.athleteOrgContexts = Array.isArray(contextResponse.contexts) ? contextResponse.contexts : [];
  renderAthleteOrgMessages();
}

// Merges org-context entries (always available once an accepted
// relationship + active org coach exists) with thread entries (only once
// a message has actually been sent) by org_id, so every team the athlete
// is genuinely part of appears - not just ones with prior messages.
function combinedAthleteOrgEntries() {
  const threadEntries = Array.isArray(state.athleteOrgMessageThreads) ? state.athleteOrgMessageThreads : [];
  const contexts = Array.isArray(state.athleteOrgContexts) ? state.athleteOrgContexts : [];
  const threadEntryByOrgId = new Map(threadEntries.map((entry) => [entry.thread.org_id, entry]));

  const combined = [];
  const seenOrgIds = new Set();

  for (const context of contexts) {
    const threadEntry = threadEntryByOrgId.get(context.org_id) || null;
    combined.push({
      org_id: context.org_id,
      org_name: threadEntry ? threadEntry.thread.org_name : context.org_name,
      visibility_mode: context.visibility_mode,
      threadEntry
    });
    seenOrgIds.add(context.org_id);
  }

  // A thread can exist for an org no longer returned by org-context (e.g.
  // the coach relationship later ended) - still show its history, but the
  // route itself (not this client) remains the authority on whether a
  // further send is allowed.
  for (const entry of threadEntries) {
    if (seenOrgIds.has(entry.thread.org_id)) continue;
    combined.push({
      org_id: entry.thread.org_id,
      org_name: entry.thread.org_name,
      visibility_mode: "shared",
      threadEntry: entry
    });
  }

  return combined;
}

function renderAthleteOrgMessages() {
  let panel = document.getElementById("athleteOrgMessagesPanel");

  if (state.role !== "athlete") {
    if (panel) panel.hidden = true;
    return;
  }

  const entries = combinedAthleteOrgEntries();

  if (entries.length === 0) {
    if (panel) panel.hidden = true;
    return;
  }

  if (!panel) {
    panel = document.createElement("article");
    panel.id = "athleteOrgMessagesPanel";
    panel.className = "panel";

    document
      .querySelector("#view-account .two-column")
      .insertAdjacentElement("afterend", panel);
  }

  panel.hidden = false;
  panel.innerHTML = `
    <p class="eyebrow">Organisation messages</p>
    <h3>Messages from your team</h3>
    ${entries.map((entry) => `
      <div class="record-row org-message-thread" data-thread-id="${escapeHtml(entry.threadEntry?.thread.thread_id ?? "")}">
        <strong>${escapeHtml(entry.org_name)}</strong>
        <div class="record-list">
          ${entry.threadEntry && entry.threadEntry.messages.length > 0
            ? entry.threadEntry.messages.map((message) => `
              <article class="review-note-card">
                <div class="record-meta">
                  <span class="badge neutral">${message.sender_role === "athlete" ? "You" : escapeHtml(entry.org_name)}</span>
                  <span class="muted small">${escapeHtml(formatDate(message.created_at_iso8601))}</span>
                </div>
                ${renderMessageAttachment(message.attachment)}
                ${message.body_text ? `<p>${escapeHtml(message.body_text)}</p>` : ""}
              </article>
            `).join("")
            : `<p class="muted small">No messages yet.</p>`
          }
        </div>
        ${entry.visibility_mode === "shared"
          ? `
            <form class="athlete-detail-note-form org-message-form" data-org-id="${escapeHtml(entry.org_id)}">
              <label class="field">
                <span>Reply to ${escapeHtml(entry.org_name)}</span>
                <textarea class="org-message-text" maxlength="4000"></textarea>
              </label>
              <label class="field">
                <span>Attach photo or video (optional)</span>
                <input type="file" class="org-message-attachment" accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime" capture="environment">
              </label>
              <div class="inline-controls">
                <button class="button primary" type="submit">Send</button>
              </div>
            </form>
          `
          : `<p class="muted small">Your coach's independent gym - no team messaging.</p>`
        }
      </div>
    `).join("")}
  `;

  for (const form of panel.querySelectorAll(".org-message-form")) {
    form.addEventListener(
      "submit",
      (event) => {
        confirmSendAthleteOrgMessage(event, form).catch(handleError);
      }
    );
  }
}

async function confirmSendAthleteOrgMessage(event, form) {
  event.preventDefault();
  const orgId = form.dataset.orgId;
  if (!orgId) return;

  const textarea = form.querySelector(".org-message-text");
  const bodyText = textarea?.value.trim() ?? "";
  const attachmentInput = form.querySelector(".org-message-attachment");
  const attachmentFile = attachmentInput?.files?.[0] ?? null;
  if (!bodyText && !attachmentFile) {
    throw new Error("Enter a message or attach a photo/video before sending.");
  }
  const attachmentError = validateAttachmentClientSide(attachmentFile);
  if (attachmentError) {
    throw new Error(attachmentError);
  }

  showBusy("Sending message…");
  try {
    await sendMessageRequest(
      `/messages/athlete/org-messages/organisations/${encodeURIComponent(orgId)}/send`,
      bodyText,
      attachmentFile
    );

    if (attachmentInput) attachmentInput.value = "";

    await refreshAthleteOrgMessages();
    showNotice("Message sent.");
  }
  finally {
    hideBusy();
  }
}

async function endAthleteRelationship(relationshipId) {
  if (!relationshipId) return;

  if (!globalThis.confirm("End this relationship with your coach? Historical records will be preserved.")) {
    return;
  }

  await api(
    "POST",
    `/coach-workspace/relationships/${encodeURIComponent(relationshipId)}/end`
  );

  showNotice("Relationship ended.");
  await refreshAthleteRelationships();
  await loadAthleteToday().catch(handleError);
}

async function loadPersistentAccountDetail(
  options = {}
) {
  const detail =
    await fetchAccountDetail();

  state.accountDetail = detail;

  if (
    detail.terms &&
    typeof detail.terms === "object"
  ) {
    state.currentTerms =
      detail.terms;
  }

  state.csrfToken =
    detail.csrf_token ??
    state.csrfToken;

  if (detail.account) {
    applyAccountIdentity(
      detail.account
    );
  }

  saveState();
  renderIdentity();
  renderAccount();

  if (!options.quiet) {
    showNotice(
      "Account refreshed."
    );
  }

  return detail;
}

async function saveAccountProfile(
  event
) {
  event.preventDefault();

  const response =
    await updateAccountProfile(
      {
        display_name:
          elements.accountProfileName.value
            .trim(),
        email:
          elements.accountProfileEmail.value
            .trim()
            .toLowerCase()
      },
      state.csrfToken
    );

  applyAccountIdentity(
    response.account
  );

  state.accountDetail = null;
  saveState();
  renderIdentity();
  renderAccount();

  const developmentCode =
    response.verification
      ?.development_code;

  elements.accountProfileResult.hidden =
    false;

  elements.accountProfileResult.textContent =
    developmentCode
      ? `Profile updated. Development verification code: ${developmentCode}`
      : "Profile updated.";

  if (developmentCode) {
    elements.verificationCode.value =
      developmentCode;
  }
}

async function requestAccountVerificationCode() {
  const response =
    await requestEmailVerification(
      state.csrfToken
    );

  const developmentCode =
    String(
      response?.development_code ??
      ""
    );

  if (developmentCode) {
    elements.verificationCode.value =
      developmentCode;
  }

  elements.verificationResult.hidden =
    false;

  elements.verificationResult.textContent =
    response?.already_verified
      ? "Email is already verified."
      : developmentCode
        ? `Development code: ${developmentCode}`
        : "Verification code requested.";
}

async function verifyAccountEmail() {
  const response =
    await completeEmailVerification(
      {
        code:
          elements.verificationCode.value
            .trim()
      },
      state.csrfToken
    );

  applyAccountIdentity(
    response.account
  );

  state.accountDetail = null;
  saveState();
  renderIdentity();
  renderAccount();

  elements.verificationResult.hidden =
    false;

  elements.verificationResult.textContent =
    "Email verified.";
}

async function saveAccountPassword(
  event
) {
  event.preventDefault();

  await changeAccountPassword(
    {
      current_password:
        elements.currentPassword.value,
      new_password:
        elements.newPassword.value
    },
    state.csrfToken
  );

  elements.accountPasswordForm.reset();

  elements.passwordChangeResult.hidden =
    false;

  elements.passwordChangeResult.textContent =
    "Password changed. Other sessions were revoked.";
}

async function closePersistentAccount(
  event
) {
  event.preventDefault();

  const confirmation =
    elements.accountClosureConfirmation.value
      .trim();

  const response =
    await requestAccountClosure(
      { confirmation },
      state.csrfToken
    );

  elements.accountClosureResult.hidden =
    false;

  elements.accountClosureResult.textContent =
    `Closure request recorded: ${response.closure_request_id}`;

  resetAccountState();

  location.assign("/app/");
}

function dataExportRecordCard(entry) {
  const statusClass =
    entry.status === "ready" ? "complete" :
    entry.status === "expired" ? "partial" :
    entry.status === "failed" ? "danger" : "neutral";
  const canDownload = entry.status === "ready";

  return `
    <article class="record-card">
      <div>
        <h3>Export requested ${escapeHtml(formatDate(entry.requested_at_iso8601))}</h3>
        <p>${entry.expires_at_iso8601 ? `Expires ${escapeHtml(formatDate(entry.expires_at_iso8601))}` : "No expiry recorded"}</p>
        <p>${entry.downloaded_at_iso8601 ? `Downloaded ${escapeHtml(formatDate(entry.downloaded_at_iso8601))}` : "Not yet downloaded"}</p>
      </div>
      <div class="record-meta">
        <span class="badge ${statusClass}">${escapeHtml(titleCase(entry.status))}</span>
        ${canDownload ? `<button class="button secondary small-button" type="button" data-download-export-id="${escapeHtml(entry.export_request_id)}">Download</button>` : ""}
      </div>
    </article>
  `;
}

function renderDataExportList(entries) {
  elements.dataExportList.innerHTML = entries.length
    ? entries.map(dataExportRecordCard).join("")
    : '<div class="empty-state compact-empty"><p>No export requested yet.</p></div>';

  for (const button of elements.dataExportList.querySelectorAll("[data-download-export-id]")) {
    button.addEventListener("click", () => {
      triggerDataExportDownload(button.dataset.downloadExportId).catch(handleError);
    });
  }
}

function dataDeletionRecordCard(entry) {
  return `
    <article class="record-card">
      <div>
        <h3>Deletion requested ${escapeHtml(formatDate(entry.requested_at_iso8601))}</h3>
        <p>${escapeHtml(titleCase(entry.reason_code))}</p>
      </div>
      <div class="record-meta">
        <span class="badge active">${escapeHtml(titleCase(entry.queue_status))}</span>
        <span class="badge neutral">${Number(entry.retention_boundary?.retained_record_count ?? 0)} retained</span>
      </div>
    </article>
  `;
}

function renderDataDeletionList(entries) {
  elements.dataDeletionList.innerHTML = entries.length
    ? entries.map(dataDeletionRecordCard).join("")
    : '<div class="empty-state compact-empty"><p>No deletion requested yet.</p></div>';
}

async function loadDataRightsState(options = {}) {
  elements.dataRightsServiceUnavailable.hidden = true;
  elements.dataRightsLoading.hidden = false;

  let exportStatus;
  let deletionStatus;
  try {
    [exportStatus, deletionStatus] = await Promise.all([
      loadDataExportStatus(),
      loadDataDeletionStatus()
    ]);
  }
  catch (error) {
    elements.dataRightsLoading.hidden = true;
    elements.dataRightsServiceUnavailable.hidden = false;
    if (options.quiet) return;
    throw error;
  }

  elements.dataRightsLoading.hidden = true;
  renderDataExportList(Array.isArray(exportStatus.exports) ? exportStatus.exports : []);
  renderDataDeletionList(Array.isArray(deletionStatus.deletion_requests) ? deletionStatus.deletion_requests : []);
}

async function requestDataExportAction() {
  const result = await submitDataExportRequest(state.csrfToken);

  elements.dataExportResult.hidden = false;
  elements.dataExportResult.textContent = `Export ready: ${result.export_request_id}`;

  await loadDataRightsState({ quiet: true });
}

async function triggerDataExportDownload(exportRequestId) {
  const payload = await fetchDataExportDownload(exportRequestId);

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `kolosseum-data-export-${exportRequestId}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);

  showNotice("Data export downloaded.");
  await loadDataRightsState({ quiet: true });
}

function renderDataDeletionRetentionPreview(preview) {
  elements.dataDeletionRetentionNotice.textContent = preview.factual_notice ?? "";

  const notices = Array.isArray(preview.retention_notices) ? preview.retention_notices : [];
  elements.dataDeletionRetentionList.innerHTML = notices.length
    ? notices.map((notice) => `
        <div class="record-card">
          <div>
            <h3>${escapeHtml(titleCase(notice.retention_reason))}</h3>
            <p>${escapeHtml(notice.copy)}</p>
          </div>
          <div class="record-meta"><span class="badge neutral">${Number(notice.record_count)} records</span></div>
        </div>
      `).join("")
    : '<div class="empty-state compact-empty"><p>No records are retained; nothing blocks a deletion request.</p></div>';
}

async function reviewDataDeletionAction() {
  const preview = await loadDataDeletionPreview(state.csrfToken);
  renderDataDeletionRetentionPreview(preview);
  elements.dataDeletionReviewPanel.hidden = false;
}

async function confirmDataDeletionAction(event) {
  event.preventDefault();

  const confirmation = elements.dataDeletionConfirmation.value.trim();

  // Kept across a failed submission (network error, validation rejection) so
  // a retry replays the same logical request instead of queuing a second one;
  // cleared only once a request has actually been recorded.
  const clientRequestId = state.dataDeletionClientRequestId || newClientRequestId();
  state.dataDeletionClientRequestId = clientRequestId;
  saveState();

  const result = await submitDataDeletionConfirmationRequest(
    { confirmation, client_request_id: clientRequestId },
    state.csrfToken
  );

  elements.dataDeletionResult.hidden = false;
  elements.dataDeletionResult.textContent = result.replayed
    ? `Deletion already requested: ${result.deletion_request_id}`
    : `Deletion requested: ${result.deletion_request_id}`;

  state.dataDeletionClientRequestId = null;
  saveState();

  elements.dataDeletionConfirmForm.reset();
  await loadDataRightsState({ quiet: true });
}

async function checkConnection() {
  try {
    const health = await api("GET", "/health");
    elements.connectionStatus.textContent = health?.status === "ok" ? "Connected" : "Unavailable";
    elements.connectionStatus.classList.toggle("offline", health?.status !== "ok");
  }
  catch {
    elements.connectionStatus.textContent = "Offline";
    elements.connectionStatus.classList.add("offline");
  }
}

// Part E - live delivery for messaging. Server->client push only: this
// socket never sends application data, it only reflects messages already
// persisted and returned by the existing POST /messages/... routes, so a
// dropped/never-established connection is never a correctness problem -
// refreshCoachAthleteMessages()/refreshAthleteOwnMessages() (refresh-on-
// open) remain the source of truth. Native WebSocket has no built-in
// reconnect, unlike EventSource, so a capped exponential backoff is
// handled here manually.
let messagingSocket = null;
let messagingReconnectTimer = null;
let messagingReconnectDelayMs = 2000;
const MESSAGING_RECONNECT_MAX_DELAY_MS = 30000;

function setLiveConnectionStatus(connected) {
  elements.connectionStatus.textContent = connected ? "Connected" : "Offline";
  elements.connectionStatus.classList.toggle("offline", !connected);
}

function connectMessagingSocket() {
  if (state.role !== "coach" && state.role !== "athlete") return;

  if (messagingReconnectTimer) {
    clearTimeout(messagingReconnectTimer);
    messagingReconnectTimer = null;
  }

  const wsUrl = `${location.origin.replace(/^http/u, "ws")}/ws/messages`;
  const socket = new WebSocket(wsUrl);
  messagingSocket = socket;

  socket.addEventListener("open", () => {
    if (messagingSocket !== socket) return;
    messagingReconnectDelayMs = 2000;
    setLiveConnectionStatus(true);
  });

  socket.addEventListener("message", (event) => {
    if (messagingSocket !== socket) return;
    let envelope = null;
    try { envelope = JSON.parse(event.data); }
    catch { return; }
    handleMessagingSocketPayload(envelope);
  });

  socket.addEventListener("close", () => {
    if (messagingSocket !== socket) return;
    setLiveConnectionStatus(false);
    scheduleMessagingReconnect();
  });

  socket.addEventListener("error", () => {
    if (messagingSocket !== socket) return;
    setLiveConnectionStatus(false);
  });
}

function scheduleMessagingReconnect() {
  if (messagingReconnectTimer) return;
  messagingReconnectTimer = setTimeout(() => {
    messagingReconnectTimer = null;
    connectMessagingSocket();
  }, messagingReconnectDelayMs);
  messagingReconnectDelayMs = Math.min(messagingReconnectDelayMs * 2, MESSAGING_RECONNECT_MAX_DELAY_MS);
}

// coach<->athlete only live-updates the single thread the user currently
// has open (state.liveMessageThreadId) - cross-thread notification is out
// of scope there, same as the original D.1/D.2 plan. org_athlete_message
// (part D.4) is the one exception with no "currently open" gate at all,
// since its athlete-side UI renders every org thread simultaneously - see
// the branch below. Org-owner<->coach pushes still have no client here:
// org owner has no dedicated frontend, and the coach-side org inbox is
// API-only, same as every prior org slice.
function handleMessagingSocketPayload(envelope) {
  if (!envelope) return;

  if (envelope.type === "coach_athlete_message") {
    const thread = envelope.thread;
    const message = envelope.message;
    if (!thread || !message) return;

    if (state.role === "coach") {
      if (thread.thread_id !== state.liveMessageThreadId) return;
      const existing = Array.isArray(state.coachAthleteMessages) ? state.coachAthleteMessages : [];
      if (existing.some((entry) => entry.message_id === message.message_id)) return;
      state.coachAthleteMessages = [...existing, message];
      renderCoachAthleteMessages();
    }
    else if (state.role === "athlete") {
      // An athlete has at most one current coach thread open at a time. A
      // still-null liveMessageThreadId means the panel is open but no
      // message has been sent yet - the thread doesn't exist server-side
      // until the first send, so there's no prior id to match. Adopt the
      // pushed thread's id in that case instead of discarding the push.
      if (!document.getElementById("athleteMessageHistory")) return;
      if (state.liveMessageThreadId && thread.thread_id !== state.liveMessageThreadId) return;
      state.liveMessageThreadId = thread.thread_id;
      const existing = Array.isArray(state.athleteMessages) ? state.athleteMessages : [];
      if (existing.some((entry) => entry.message_id === message.message_id)) return;
      state.athleteMessages = [...existing, message];
      renderAthleteOwnMessages();
    }
  }
  // Part D.4 - unlike the single-thread coach<->athlete case above, an
  // athlete can have several simultaneously-rendered org threads (no
  // "currently open" gate), so a push either appends to an existing entry
  // or - for an org's very first message to this athlete - adds a brand
  // new one using the thread row the push already carries.
  else if (envelope.type === "org_athlete_message" && state.role === "athlete") {
    const thread = envelope.thread;
    const message = envelope.message;
    if (!thread || !message) return;

    const entries = Array.isArray(state.athleteOrgMessageThreads) ? state.athleteOrgMessageThreads : [];
    const existingEntry = entries.find((entry) => entry.thread.thread_id === thread.thread_id);
    if (existingEntry) {
      if (existingEntry.messages.some((entry) => entry.message_id === message.message_id)) return;
      existingEntry.messages = [...existingEntry.messages, message];
    }
    else {
      entries.push({ thread, messages: [message] });
    }
    state.athleteOrgMessageThreads = entries;
    renderAthleteOrgMessages();
  }
}

async function clearLocalSession() {
  try {
    if (state.csrfToken) {
      await signOutAccount(
        state.csrfToken
      );
    }
  }
  finally {
    resetAccountState();
    location.assign("/app/");
  }
}

function buildFailureContextFromError(error) {
  if (!error?.requestPath) return null;

  const reason = String(
    error?.payload?.reason ??
    error?.payload?.failure_token ??
    error?.payload?.error ??
    ""
  ).slice(0, 200);

  return {
    status: Number.isInteger(error.status) ? error.status : null,
    reason,
    method: String(error.requestMethod ?? "").toUpperCase(),
    path: String(error.requestPath ?? "")
  };
}

function handleError(error) {
  hideBusy();
  showNotice(
    error?.message ?? "The request could not be completed.",
    "error",
    { failureContext: buildFailureContextFromError(error) }
  );
  console.error(error);
}

async function enterApplication() {
  elements.bootScreen.hidden = true;
  elements.entryView.hidden = true;
  elements.appShell.hidden = false;

  renderRoleNavigation();
  renderIdentity();
  renderAccount();

  if (state.role === "athlete") {
    // FULL-UI-22 cross-product quality: server authority over local cache.
    // The locally-cached today/history/session state is never shown on
    // its own on a fresh boot/refresh - it's covered by the busy overlay
    // until the corresponding server call has actually confirmed or
    // superseded it, so a stale cached session/assignment/completion
    // state is never visible, even briefly, as if it were current.
    showBusy("Loading your training data...");
    renderAthleteSession();
    renderToday();
    renderHistory();

    try {
      // Server state after refresh decides which session is current - a
      // locally-cached activeSessionId (from a previous programme, a since-
      // replaced assignment, or a stale reload) must never be trusted on
      // its own. loadAthleteToday() re-derives it from the athlete's actual
      // current assignment/session every time.
      await refreshHistory({ quiet: true });
      await loadAthleteToday();
    }
    catch (error) {
      showNotice(error.message, "error");
    }
    finally {
      hideBusy();
    }
  }
  else {
    try {
      await Promise.all([
        loadTemplateExercises(),
        refreshTemplates({ quiet: true }),
        refreshCoachEvents({ quiet: true }),
        refreshCoachAthletes({ quiet: true }),
        refreshCoachAssignments({ quiet: true })
      ]);

      await refreshCoachAthleteProfiles();
    }
    catch (error) {
      showNotice(error.message, "error");
    }

    renderCoachWorkspace();
    renderCoachEvents();
    renderTemplateLibrary();
  }

  setView(state.view);
  checkConnection();
  connectMessagingSocket();
  refreshNotificationUnreadCount().catch(() => {});
}

function showEntry() {
  elements.bootScreen.hidden = true;
  elements.appShell.hidden = true;
  elements.entryView.hidden = false;
  renderTermsState();
}

for (const radio of document.querySelectorAll('input[name="role"]')) {
  radio.addEventListener("change", () => {
    elements.entryActivityField.hidden = radio.value === "coach" && radio.checked;
  });
}

for (const button of document.querySelectorAll("[data-view]")) {
  button.addEventListener("click", () => setView(button.dataset.view));
}

for (const button of document.querySelectorAll("[data-view-link]")) {
  button.addEventListener("click", () => setView(button.dataset.viewLink));
}

elements.entryCreateTab.addEventListener(
  "click",
  () => setEntryMode("create")
);

elements.entrySignInTab.addEventListener(
  "click",
  () => setEntryMode("sign-in")
);

elements.entryForm.addEventListener(
  "submit",
  (event) => {
    handleEntrySubmit(event)
      .catch(handleError);
  }
);

elements.forgotPasswordButton.addEventListener(
  "click",
  showPasswordResetRequest
);

elements.passwordResetRequestForm.addEventListener(
  "submit",
  (event) => {
    guardedAction(submitButtonOf, handleResetRequest)(event)
      .catch(handleError);
  }
);

elements.passwordResetCompleteForm.addEventListener(
  "submit",
  (event) => {
    guardedAction(submitButtonOf, handleResetComplete)(event)
      .catch(handleError);
  }
);

elements.cancelPasswordResetButton.addEventListener(
  "click",
  showSignInForm
);

elements.cancelPasswordResetCompleteButton.addEventListener(
  "click",
  showSignInForm
);

// FULL-UI-18 factual in-product notifications. Every notification comes
// from the server's own derivation of already-durable product events - this
// module never invents urgency, priority or a recommendation, and every
// deep link either opens a real existing route or shows the explicit
// unavailable-target state.
const NOTIFICATION_TYPE_LABELS = Object.freeze({
  relationship_invited: "Relationship invited",
  relationship_accepted: "Relationship accepted",
  relationship_declined: "Relationship declined",
  relationship_revoked: "Relationship revoked",
  assignment_created: "Assignment created",
  assignment_replaced: "Assignment replaced",
  assignment_cancelled: "Assignment cancelled",
  event_linked: "Event linked",
  event_unlinked: "Event unlinked",
  event_cancelled: "Event cancelled",
  programme_available: "Programme available",
  session_completed: "Session completed",
  coach_note_visible: "Coach note visible",
  billing_action_required: "Billing action required"
});

function notificationCoachName(coachUserId) {
  if (!coachUserId) return null;
  const accepted = (state.athleteRelationships ?? []).find((relationship) => relationship.coach_user_id === coachUserId);
  if (accepted?.coach_display_name) return accepted.coach_display_name;
  const pending = (state.pendingRelationshipInvitations ?? []).find((invitation) => invitation.coach_user_id === coachUserId);
  return pending?.coach_display_name || coachUserId;
}

function notificationAthleteName(athleteUserId) {
  if (!athleteUserId) return null;
  const athlete = (state.coachAthletes ?? []).find((entry) => entry.userId === athleteUserId);
  return athlete?.displayName || athleteUserId;
}

// The declared, server-derived notification_payload (coach_user_id or
// athlete_user_id, depending on the notification's direction) names which
// coach or athlete triggered the event - stored and shipped on the wire
// since FULL-UI-18, but never read anywhere until now, so every
// notification of the same type looked identical regardless of source.
function notificationSubject(notification) {
  const payload = notification?.notification_payload;
  if (!payload || typeof payload !== "object") return null;
  if (payload.athlete_user_id) return notificationAthleteName(String(payload.athlete_user_id));
  if (payload.coach_user_id) return notificationCoachName(String(payload.coach_user_id));
  return null;
}

function renderNotificationUnreadBadge(count) {
  const value = Number(count) || 0;
  if (value > 0) {
    elements.notificationUnreadBadge.hidden = false;
    elements.notificationUnreadBadge.textContent = value > 99 ? "99+" : String(value);
  }
  else {
    elements.notificationUnreadBadge.hidden = true;
    elements.notificationUnreadBadge.textContent = "0";
  }
}

async function refreshNotificationUnreadCount() {
  try {
    const payload = await api("GET", "/account/notifications/unread-count");
    renderNotificationUnreadBadge(payload.unread_count);
  }
  catch {
    // The badge keeps its last known value; opening the panel shows the
    // explicit unavailable state if the surface truly cannot be reached.
  }
}

function notificationTargetHref(notification) {
  if (notification.target_available !== true) return null;
  try {
    return serializeProductRoute(notification.deep_link.route_id, notification.deep_link.params ?? {});
  }
  catch {
    return null;
  }
}

function openNotificationTarget(notification, href) {
  if (!href) return;
  closeNotificationPanel();
  location.hash = href;
  if (notification.read_at_iso8601 === null) {
    markNotificationRead(notification.notification_id).catch(() => {});
  }
}

async function markNotificationRead(notificationId) {
  await api("POST", `/account/notifications/${encodeURIComponent(notificationId)}/read`, {});
  await refreshNotificationUnreadCount();
}

async function markNotificationUnread(notificationId) {
  await api("POST", `/account/notifications/${encodeURIComponent(notificationId)}/unread`, {});
  await refreshNotificationUnreadCount();
}

async function toggleNotificationReadState(notificationId, markRead) {
  if (markRead) await markNotificationRead(notificationId);
  else await markNotificationUnread(notificationId);
  await loadNotificationPanelContent();
}

function renderNotificationList(notifications) {
  elements.notificationList.innerHTML = "";

  if (notifications.length === 0) {
    elements.notificationEmpty.hidden = false;
    return;
  }
  elements.notificationEmpty.hidden = true;

  for (const notification of notifications) {
    const isRead = notification.read_at_iso8601 !== null;
    const label = NOTIFICATION_TYPE_LABELS[notification.notification_type] ?? titleCase(notification.notification_type);
    const subject = notificationSubject(notification);
    const href = notificationTargetHref(notification);

    const item = document.createElement("li");
    item.className = "notification-item";
    item.dataset.notificationId = notification.notification_id;

    const openButton = document.createElement("button");
    openButton.type = "button";
    openButton.className = "notification-item-open";
    openButton.dataset.targetAvailable = String(notification.target_available === true);
    if (!isRead) openButton.dataset.unread = "true";
    openButton.innerHTML = `
      <span class="notification-item-dot" ${isRead ? "hidden" : ""} aria-hidden="true"></span>
      <span class="notification-item-body">
        <span class="notification-item-type">${escapeHtml(label)}</span>
        ${subject ? `<span class="notification-item-subject">${escapeHtml(subject)}</span>` : ""}
        <span class="notification-item-time">${escapeHtml(formatDate(notification.occurred_at_iso8601))}</span>
        ${notification.target_available === true ? "" : '<span class="notification-item-unavailable">This item is no longer available</span>'}
      </span>
    `;
    openButton.addEventListener("click", () => openNotificationTarget(notification, href));

    const toggleButton = document.createElement("button");
    toggleButton.type = "button";
    toggleButton.className = "notification-item-toggle-read";
    toggleButton.dataset.read = String(isRead);
    toggleButton.textContent = isRead ? "Mark unread" : "Mark read";
    toggleButton.addEventListener("click", (event) => {
      event.stopPropagation();
      toggleNotificationReadState(notification.notification_id, !isRead).catch(handleError);
    });

    item.append(openButton, toggleButton);
    elements.notificationList.appendChild(item);
  }
}

async function loadNotificationPanelContent() {
  elements.notificationLoading.hidden = false;
  elements.notificationServiceUnavailable.hidden = true;
  elements.notificationEmpty.hidden = true;
  elements.notificationList.innerHTML = "";

  try {
    const payload = await api("GET", "/account/notifications");
    renderNotificationList(payload.notifications ?? []);
    renderNotificationUnreadBadge(payload.unread_count);
  }
  catch {
    elements.notificationServiceUnavailable.hidden = false;
  }
  finally {
    elements.notificationLoading.hidden = true;
  }
}

async function markAllNotificationsReadAction() {
  await api("POST", "/account/notifications/mark-all-read", {});
  await loadNotificationPanelContent();
}

function isNotificationPanelOpen() {
  return !elements.notificationPanel.hidden;
}

function openNotificationPanel() {
  elements.notificationPanel.hidden = false;
  elements.notificationBellButton.setAttribute("aria-expanded", "true");
  loadNotificationPanelContent().catch(handleError);
}

function closeNotificationPanel() {
  elements.notificationPanel.hidden = true;
  elements.notificationBellButton.setAttribute("aria-expanded", "false");
}

function toggleNotificationPanel() {
  if (isNotificationPanelOpen()) closeNotificationPanel();
  else openNotificationPanel();
}

// FULL-UI-20 factual platform status and error-reporting. A report is
// built entirely from an explicit allowlist captured client-side (route
// hash, timestamp, a fixed set of browser fields, and - only when the
// report was opened from a failed request - status/method/path of that
// one request). Nothing from localStorage, cookies or auth state is ever
// read here.
let currentSupportReportContext = null;

function generateCorrelationId() {
  if (typeof crypto?.randomUUID === "function") return crypto.randomUUID();
  return `corr-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function buildBrowserContextSnapshot() {
  return {
    user_agent: navigator.userAgent ?? "",
    language: navigator.language ?? "",
    viewport_width: window.innerWidth ?? null,
    viewport_height: window.innerHeight ?? null,
    timezone_offset_minutes: new Date().getTimezoneOffset()
  };
}

function openSupportReportForm(failureContext) {
  const browserContext = buildBrowserContextSnapshot();

  currentSupportReportContext = {
    correlation_id: generateCorrelationId(),
    route_hash: location.hash || "#/",
    occurred_at_iso8601: new Date().toISOString(),
    browser_context: browserContext,
    failure_context: failureContext && failureContext.path ? failureContext : null
  };

  elements.supportReportCorrelationId.textContent = currentSupportReportContext.correlation_id;
  elements.supportReportRoute.textContent = currentSupportReportContext.route_hash;
  elements.supportReportTimestamp.textContent = formatDate(currentSupportReportContext.occurred_at_iso8601);
  elements.supportReportBrowserSummary.textContent =
    `${browserContext.viewport_width}x${browserContext.viewport_height}, ${browserContext.language || "unknown language"}`;
  elements.supportReportDescription.value = "";
  elements.supportReportResult.hidden = true;

  const canRetry =
    currentSupportReportContext.failure_context?.method === "GET" &&
    Boolean(currentSupportReportContext.failure_context?.path);
  elements.supportRetryButton.hidden = !canRetry;

  elements.supportReportPanel.hidden = false;
  elements.supportReportPanel.scrollIntoView?.({ block: "center", behavior: "smooth" });
}

function closeSupportReportForm() {
  elements.supportReportPanel.hidden = true;
}

async function submitSupportReport(event) {
  event.preventDefault();
  if (!currentSupportReportContext) return;

  const description = elements.supportReportDescription.value.trim();
  if (!description) {
    elements.supportReportResult.hidden = false;
    elements.supportReportResult.textContent = "Enter a description before submitting.";
    return;
  }

  const result = await api("POST", "/account/support/reports", {
    correlation_id: currentSupportReportContext.correlation_id,
    route_hash: currentSupportReportContext.route_hash,
    occurred_at_iso8601: currentSupportReportContext.occurred_at_iso8601,
    description,
    browser_context: currentSupportReportContext.browser_context,
    failure_context: currentSupportReportContext.failure_context ?? {}
  });

  elements.supportReportResult.hidden = false;
  elements.supportReportResult.textContent = `Report submitted. Correlation ID: ${result.report.correlation_id}`;
  await refreshSupportHistory();
}

async function retrySupportFailedRequest() {
  const context = currentSupportReportContext?.failure_context;
  if (!context || context.method !== "GET" || !context.path) return;

  await api("GET", context.path);
  showNotice("The request succeeded on retry.", "success");
  closeSupportReportForm();
}

function recoverToSafeScreen() {
  closeSupportReportForm();
  setView(state.role === "coach" ? "coach-overview" : "today");
}

function renderSupportHistory(reports) {
  elements.supportHistoryList.innerHTML = "";

  if (reports.length === 0) {
    elements.supportHistoryEmpty.hidden = false;
    return;
  }
  elements.supportHistoryEmpty.hidden = true;

  for (const report of reports) {
    const row = document.createElement("div");
    row.className = "support-history-row";

    const statusBadge = document.createElement("span");
    statusBadge.className = "badge neutral support-history-status";
    statusBadge.textContent = titleCase(report.status);

    const description = document.createElement("span");
    description.className = "support-history-description";
    description.textContent = report.description;

    const time = document.createElement("span");
    time.className = "support-history-time";
    time.textContent = formatDate(report.created_at_iso8601);

    row.append(statusBadge, description, time);
    elements.supportHistoryList.appendChild(row);
  }
}

async function refreshSupportHistory() {
  const result = await api("GET", "/account/support/reports");
  renderSupportHistory(Array.isArray(result.reports) ? result.reports : []);
}

async function refreshPlatformStatus() {
  elements.platformStatusValue.textContent = "Checking...";
  elements.platformStatusValue.classList.remove("status-ok");

  try {
    const result = await api("GET", "/health");
    const operational = result.status === "ok";
    elements.platformStatusValue.textContent = operational ? "Operational" : "Degraded";
    elements.platformStatusValue.classList.toggle("status-ok", operational);
  }
  catch {
    elements.platformStatusValue.textContent = "Unavailable";
  }
  finally {
    elements.platformStatusChecked.textContent = `Checked ${formatDate(new Date().toISOString())}`;
  }
}

elements.checkPlatformStatusButton?.addEventListener("click", () => {
  refreshPlatformStatus().catch(handleError);
});

elements.openSupportReportButton?.addEventListener("click", () => {
  openSupportReportForm(null);
});

elements.cancelSupportReportButton?.addEventListener("click", () => {
  closeSupportReportForm();
});

elements.supportRetryButton?.addEventListener("click", () => {
  retrySupportFailedRequest().catch(handleError);
});

elements.supportRecoveryButton?.addEventListener("click", () => {
  recoverToSafeScreen();
});

elements.supportReportForm?.addEventListener("submit", (event) => {
  guardedAction(submitButtonOf, submitSupportReport)(event).catch(handleError);
});

elements.notificationBellButton?.addEventListener("click", (event) => {
  event.stopPropagation();
  toggleNotificationPanel();
});

elements.notificationRetryButton?.addEventListener("click", () => {
  loadNotificationPanelContent().catch(handleError);
});

elements.notificationMarkAllReadButton?.addEventListener("click", () => {
  markAllNotificationsReadAction().catch(handleError);
});

document.addEventListener("click", (event) => {
  if (!isNotificationPanelOpen()) return;
  if (event.target.closest("#notificationPanel, #notificationBellButton")) return;
  closeNotificationPanel();
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && isNotificationPanelOpen()) closeNotificationPanel();
});

elements.menuButton.addEventListener("click", () => {
  elements.sidebar.classList.toggle("open");
});

elements.topbarAccount.addEventListener("click", () => setView("account"));
elements.createSessionButton.addEventListener("click", () => createSession().catch(handleError));
elements.continueSessionButton.addEventListener("click", () => setView("session"));
elements.todayRetryButton.addEventListener("click", () => loadAthleteToday().catch(handleError));
elements.sessionRetryButton.addEventListener("click", () => loadSessionState().catch(handleError));
elements.startSessionButton.addEventListener("click", () => startSession().catch(handleError));
elements.completeExerciseButton.addEventListener("click", () => {
  maybeStartRestTimer();
  postSessionEvent({ type: "COMPLETE_STEP" }).catch(handleError);
});
elements.skipRestButton.addEventListener("click", stopRestTimer);
elements.skipExerciseButton.addEventListener("click", openSkipReasonPanel);
elements.cancelSkipButton.addEventListener("click", hideAllActionPanels);
elements.confirmSkipButton.addEventListener("click", () => {
  confirmSkipWithReason().catch(handleError);
});
elements.reportPainButton.addEventListener("click", openPainReportPanel);
elements.cancelPainReportButton.addEventListener("click", hideAllActionPanels);
elements.confirmPainReportButton.addEventListener("click", () => {
  confirmPainReport().catch(handleError);
});
elements.reportRpeButton.addEventListener("click", openRpeReportPanel);
elements.cancelRpeReportButton.addEventListener("click", hideAllActionPanels);
elements.confirmRpeReportButton.addEventListener("click", () => {
  confirmRpeReport().catch(handleError);
});
elements.requestSubstitutionButton.addEventListener("click", openSubstitutionPanel);
elements.cancelSubstitutionButton.addEventListener("click", hideAllActionPanels);
elements.checkSubstitutionButton.addEventListener("click", () => {
  checkSubstitution().catch(handleError);
});
elements.recordVideoFeedbackButton.addEventListener("click", openVideoFeedbackPanel);
elements.cancelVideoFeedbackButton.addEventListener("click", hideAllActionPanels);
elements.uploadVideoFeedbackButton.addEventListener("click", () => {
  uploadExerciseVideo().catch(handleError);
});
elements.refreshVideoFeedbackQueueButton.addEventListener("click", () => {
  refreshVideoFeedbackQueue().catch(handleError);
});
elements.splitSessionButton.addEventListener("click", () => {
  postSessionEvent({ type: "SPLIT_SESSION" }).catch(handleError);
});
elements.returnContinueButton.addEventListener("click", () => {
  postSessionEvent({ type: "RETURN_CONTINUE" }).catch(handleError);
});
elements.returnSkipButton.addEventListener("click", () => {
  postSessionEvent({ type: "RETURN_SKIP" }).catch(handleError);
});
elements.refreshHistoryButton.addEventListener("click", () => refreshHistory().catch(handleError));
elements.historyRetryButton.addEventListener("click", () => refreshHistory().catch(handleError));
elements.applyHistoryFiltersButton.addEventListener("click", () => applyHistoryFilters().catch(handleError));
elements.clearHistoryFiltersButton.addEventListener("click", clearHistoryFilters);
elements.exportHistoryButton.addEventListener("click", () => exportHistory().catch(handleError));

document.addEventListener("kolosseum:history-detail-route", (event) => {
  const sessionId = event.detail?.session_id;
  if (sessionId) openHistoryDetail(sessionId).catch(handleError);
});
elements.connectAthleteForm.addEventListener("submit", (event) => {
  connectAthlete(event).catch(handleError);
});
elements.inviteAthleteByEmailForm.addEventListener("submit", (event) => {
  guardedAction(submitButtonOf, inviteAthleteByEmail)(event).catch(handleError);
});
elements.coachBroadcastForm.addEventListener("submit", (event) => {
  guardedAction(submitButtonOf, confirmSendCoachBroadcast)(event).catch(handleError);
});

// FULL-UI-05B builder interaction bindings.
elements.templateDraftRecoveryResumeButton.addEventListener(
  "click",
  resumeRecoveredTemplateDraft
);

elements.templateDraftRecoveryDiscardButton.addEventListener(
  "click",
  discardRecoveredTemplateDraft
);

elements.templateBuilderDiscardButton.addEventListener(
  "click",
  () => closeTemplateBuilder()
);

elements.templateBuilderValidationList.addEventListener(
  "click",
  (event) => {
    const button = event.target.closest(
      "[data-builder-validation-index]"
    );

    if (button) {
      focusTemplateValidationIssue(
        button.dataset.builderValidationIndex
      );
    }
  }
);

for (const eventName of ["input", "change"]) {
  document.addEventListener(eventName, (event) => {
    if (
      !elements.templateBuilderView.hidden &&
      event.target.closest("#templateBuilderView")
    ) {
      scheduleTemplateBuilderStateRefresh();
    }
  });
}

document.addEventListener("click", (event) => {
  if (elements.templateBuilderView.hidden) return;

  const target = event.target.closest(
    "#templateBuilderView button"
  );

  if (!target) return;

  if (
    target.matches(
      "#saveTemplateButton, " +
      "#saveCompleteTemplateButton, " +
      "#activateTemplateButton, " +
      "#backToTemplatesButton, " +
      "#templateBuilderDiscardButton, " +
      ".template-validation-link"
    )
  ) {
    return;
  }

  scheduleTemplateBuilderStateRefresh();
});

document.addEventListener("keydown", (event) => {
  if (elements.templateBuilderView.hidden) return;

  if (
    (event.ctrlKey || event.metaKey) &&
    event.key.toLowerCase() === "s"
  ) {
    event.preventDefault();

    if (!templateBuilderSaving) {
      saveTemplateDraft().catch(handleError);
    }

    return;
  }

  if (event.key === "Escape") {
    event.preventDefault();
    closeTemplateBuilder();
  }
});

globalThis.addEventListener("beforeunload", (event) => {
  const coachNoteFormOpenAndDirty = coachNoteDirty && !elements.coachNoteForm.hidden;
  if (!templateDraftIsDirty() && !coachNoteFormOpenAndDirty) return;

  event.preventDefault();
  event.returnValue = "";
});

elements.coachNoteText.addEventListener("input", () => {
  coachNoteDirty = true;
});

elements.newTemplateButton.addEventListener("click", () => {
  loadTemplateExercises()
    .then(() => openTemplateBuilder(newTemplateDraft()))
    .catch(handleError);
});

elements.coachDashboardRefreshButton.addEventListener("click", () => {
  refreshCoachDashboard().catch(handleError);
});

elements.refreshEventsButton.addEventListener("click", () => {
  refreshCoachEvents().catch(handleError);
});

elements.eventActivity.addEventListener("change", () => {
  syncCoachEventTypeOptions();
  renderCoachEventPreview();
});

for (const control of [
  elements.eventProgrammeStartDate,
  elements.eventDate
]) {
  control.addEventListener("input", renderCoachEventPreview);
  control.addEventListener("change", renderCoachEventPreview);
}

elements.eventForm.addEventListener("submit", (event) => {
  createCoachEvent(event).catch(handleError);
});

elements.progressPhotoUploadForm?.addEventListener("submit", (event) => {
  event.preventDefault();
  uploadProgressPhoto().catch(handleError);
});

elements.bodyMetricLogForm?.addEventListener("submit", (event) => {
  event.preventDefault();
  logBodyMetricEntry().catch(handleError);
});

elements.nutritionForm?.addEventListener("submit", (event) => {
  event.preventDefault();
  logNutritionEntry().catch(handleError);
});

elements.habitCreateForm?.addEventListener("submit", (event) => {
  event.preventDefault();
  createHabit().catch(handleError);
});

elements.habitList?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-habit-action]");
  if (!button) return;
  const habitId = button.dataset.habitId;
  if (button.dataset.habitAction === "complete") {
    logHabitCompletionToday(habitId).catch(handleError);
  }
  else if (button.dataset.habitAction === "archive") {
    archiveHabit(habitId).catch(handleError);
  }
});

elements.athleteGoalMetricSelect?.addEventListener("change", () => {
  updateAthleteGoalTargetValueVisibility();
});

elements.athleteGoalCreateForm?.addEventListener("submit", (event) => {
  event.preventDefault();
  createAthleteGoal().catch(handleError);
});

elements.athleteGoalList?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-goal-action]");
  if (!button) return;
  resolveAthleteGoal(button.dataset.goalId, button.dataset.goalAction).catch(handleError);
});

if (elements.weeklyCheckinWeekStartInput) {
  elements.weeklyCheckinWeekStartInput.value = defaultWeeklyCheckinWeekStartDate();
}

elements.weeklyCheckinForm?.addEventListener("submit", (event) => {
  event.preventDefault();
  submitWeeklyCheckin().catch(handleError);
});

elements.deviceConnectForm?.addEventListener("submit", (event) => {
  event.preventDefault();
  connectDeviceSync().catch(handleError);
});

elements.deviceConnectionList?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-device-disconnect]");
  if (!button) return;
  disconnectDeviceSync(button.dataset.deviceDisconnect).catch(handleError);
});

elements.refreshTemplatesButton.addEventListener("click", () => {
  refreshProgrammeLibrary().catch(handleError);
});

elements.templateLibrarySearch.addEventListener("input", () => {
  state.templateLibrarySearch = elements.templateLibrarySearch.value;
  saveState();
  renderTemplateLibrary();
});

elements.templateLibraryStatusFilter.addEventListener("change", () => {
  state.templateLibraryStatusFilter =
    elements.templateLibraryStatusFilter.value;
  saveState();
  renderTemplateLibrary();
});

elements.templateLibraryActivityFilter.addEventListener("change", () => {
  state.templateLibraryActivityFilter =
    elements.templateLibraryActivityFilter.value;
  saveState();
  renderTemplateLibrary();
});

elements.templateLibrarySort.addEventListener("change", () => {
  state.templateLibrarySort = elements.templateLibrarySort.value;
  saveState();
  renderTemplateLibrary();
});

elements.templateLibraryClearFilters.addEventListener("click", () => {
  state.templateLibrarySearch = "";
  state.templateLibraryStatusFilter = "all";
  state.templateLibraryActivityFilter = "all";
  state.templateLibrarySort = "updated_desc";
  saveState();
  renderTemplateLibrary();
});

elements.templateDetailCloseButton.addEventListener(
  "click",
  closeProgrammeDetail
);

elements.backToTemplatesButton.addEventListener("click", closeTemplateBuilder);

elements.saveTemplateButton.addEventListener("click", () => {
  saveTemplateDraft().catch(handleError);
});

elements.saveCompleteTemplateButton.addEventListener("click", () => {
  completeOpenTemplate().catch(handleError);
});

elements.activateTemplateButton.addEventListener("click", () => {
  activateOpenTemplate().catch(handleError);
});

elements.addTemplateBlockButton.addEventListener("click", addTemplateBlock);

for (const control of [
  elements.templateName,
  elements.templateActivity,
  elements.templateDescription
]) {
  control.addEventListener("input", syncTemplateHeader);
  control.addEventListener("change", syncTemplateHeader);
}

elements.templateActivity.addEventListener("change", () => {
  if (state.templateDraft?.event_plan) {
    ensureDraftEventPlan();
    state.templateDraft.event_compile_summary = null;
    rerenderTemplateBuilder();
  }
});

elements.templateEventEnabled.addEventListener("change", () => {
  if (!state.templateDraft) return;

  if (elements.templateEventEnabled.checked) {
    ensureDraftEventPlan();
  }
  else {
    state.templateDraft.event_plan = null;
    state.templateDraft.event_compile_summary = null;
    for (const block of state.templateDraft.blocks) {
      block.calendar_start_date = "";
      block.calendar_end_date = "";
    }
  }

  rerenderTemplateBuilder();
});

for (const control of [
  elements.templateEventName,
  elements.templateEventType,
  elements.templateProgrammeStartDate,
  elements.templateEventDate,
  elements.templateEventLocation,
  elements.templateEventTimezone,
  elements.templateEventNotes
]) {
  const updateEventCompiler = () => {
    syncTemplateEventFields();
    renderTemplateBlocks();
    updateTemplateFacts();
  };

  control.addEventListener("input", updateEventCompiler);
  control.addEventListener("change", updateEventCompiler);
}

elements.compileEventCalendarButton.addEventListener("click", () => {
  previewEventCalendar().catch(handleError);
});

elements.fitFinalBlockButton.addEventListener("click", () => {
  try {
    fitFinalBlockToEvent();
  }
  catch (error) {
    handleError(error);
  }
});

elements.templateEventBindingSelect.addEventListener("change", () => {
  renderEventBindingPicker();
});

elements.bindTemplateEventButton.addEventListener("click", () => {
  bindSelectedEventToTemplate().catch(handleError);
});

elements.templateBlocks.addEventListener("input", (event) => {
  const control = event.target.closest("[data-template-kind]");
  if (control) updateTemplateFieldFromControl(control);
});

elements.templateBlocks.addEventListener("change", (event) => {
  const control = event.target.closest("[data-template-kind]");
  if (control) updateTemplateFieldFromControl(control);
});

elements.templateBlocks.addEventListener("click", (event) => {
  const action = event.target.closest("button");
  if (!action) return;

  const blockIndex = Number(action.dataset.blockIndex);
  const weekIndex = Number(action.dataset.weekIndex);
  const sessionIndex = Number(action.dataset.sessionIndex);
  const workItemIndex = Number(action.dataset.workItemIndex);
  const direction = Number(action.dataset.direction);

  if (action.classList.contains("add-template-session")) {
    addTemplateSession(blockIndex, weekIndex);
  }
  else if (action.classList.contains("remove-template-session")) {
    removeTemplateSession(blockIndex, weekIndex, sessionIndex);
  }
  else if (action.classList.contains("duplicate-template-session")) {
    duplicateTemplateSession(blockIndex, weekIndex, sessionIndex);
  }
  else if (action.classList.contains("move-template-session")) {
    moveTemplateSession(blockIndex, weekIndex, sessionIndex, direction);
  }
  else if (action.classList.contains("add-template-work-item")) {
    addTemplateWorkItem(blockIndex, weekIndex, sessionIndex);
  }
  else if (action.classList.contains("remove-template-work-item")) {
    removeTemplateWorkItem(blockIndex, weekIndex, sessionIndex, workItemIndex);
  }
  else if (action.classList.contains("duplicate-template-work-item")) {
    duplicateTemplateWorkItem(blockIndex, weekIndex, sessionIndex, workItemIndex);
  }
  else if (action.classList.contains("move-template-work-item")) {
    moveTemplateWorkItem(blockIndex, weekIndex, sessionIndex, workItemIndex, direction);
  }
  else if (action.classList.contains("template-work-item-info-toggle")) {
    toggleTemplateWorkItemInfo(action, blockIndex, weekIndex, sessionIndex, workItemIndex);
  }
  else if (action.classList.contains("group-with-next-work-item")) {
    groupWorkItemWithNext(blockIndex, weekIndex, sessionIndex, workItemIndex);
  }
  else if (action.classList.contains("ungroup-work-item")) {
    ungroupWorkItem(blockIndex, weekIndex, sessionIndex, workItemIndex);
  }
  else if (action.classList.contains("add-template-week")) {
    addTemplateWeek(blockIndex);
  }
  else if (action.classList.contains("remove-template-week")) {
    removeTemplateWeek(blockIndex, weekIndex);
  }
  else if (action.classList.contains("duplicate-template-week")) {
    duplicateTemplateWeek(blockIndex, weekIndex);
  }
  else if (action.classList.contains("move-template-week")) {
    moveTemplateWeek(blockIndex, weekIndex, direction);
  }
  else if (action.classList.contains("remove-template-block")) {
    removeTemplateBlock(blockIndex);
  }
  else if (action.classList.contains("duplicate-template-block")) {
    duplicateTemplateBlock(blockIndex);
  }
  else if (action.classList.contains("move-template-block")) {
    moveTemplateBlock(blockIndex, direction);
  }
});

// <details> `toggle` events do not bubble, but a capture-phase listener on a
// stable ancestor still receives them, and keeps working across the
// innerHTML replacement renderExerciseFocus performs on every re-render.
elements.currentExercise.addEventListener("toggle", (event) => {
  const details = event.target;
  if (!(details instanceof HTMLElement) || !details.classList.contains("exercise-howto")) return;
  if (!details.open) return;
  loadExerciseHowto(details.dataset.exerciseId, details.querySelector(".exercise-howto-body"));
}, { capture: true });

elements.closeAthleteProfileButton.addEventListener("click", closeAthleteProfile);
elements.addAthleteBenchmarkButton.addEventListener("click", addAthleteBenchmark);
elements.athleteProfileForm.addEventListener("submit", (event) => {
  saveOpenAthleteProfile(event).catch(handleError);
});

for (const control of [
  elements.athletePreferredUnit,
  elements.athleteRoundingIncrement,
  elements.athleteBodyweight,
  elements.athleteBodyweightUnit
]) {
  control.addEventListener("input", syncAthleteProfileHeader);
  control.addEventListener("change", syncAthleteProfileHeader);
}

elements.athleteBenchmarkList.addEventListener("input", (event) => {
  const control = event.target.closest("[data-profile-field]");
  if (control) updateAthleteBenchmarkControl(control);
});

elements.athleteBenchmarkList.addEventListener("change", (event) => {
  const control = event.target.closest("[data-profile-field]");
  if (control) updateAthleteBenchmarkControl(control);
});

elements.athleteBenchmarkList.addEventListener("click", (event) => {
  const button = event.target.closest(".remove-athlete-benchmark");
  if (button) removeAthleteBenchmark(Number(button.dataset.benchmarkIndex));
});

elements.athleteAssignmentEvent.addEventListener("change", renderAthleteProfileAssignmentRequirements);
  elements.athleteAssignmentTemplate.addEventListener("change", renderAthleteProfileAssignmentRequirements);
  elements.athleteAssignmentForm.addEventListener("submit", (event) => {
    recordAthleteProfileAssignment(event).catch(handleError);
  });
  elements.athleteAssignmentCancelButton.addEventListener("click", () => {
    cancelAssignmentForAthlete(state.selectedCoachAthleteId, "profile").catch(handleError);
  });

elements.assignmentAthlete.addEventListener("change", () => {
  renderAssignmentTemplateOptions();
  renderAssignmentLifecycleSurfaces();
  refreshAssignmentAthleteProfile().catch(handleError);
});
elements.assignmentTemplate.addEventListener("change", renderAssignmentRequirements);
elements.assignmentForm.addEventListener("submit", (event) => {
  recordAssignment(event).catch(handleError);
});
elements.assignmentCancelButton.addEventListener("click", () => {
  cancelAssignmentForAthlete(elements.assignmentAthlete.value, "workspace").catch(handleError);
});
elements.loadReviewButton.addEventListener("click", () => loadCoachReview().catch(
  catchWithViewRetry(elements.reviewStatus, () => loadCoachReview(), "Review queue could not be loaded.")
));
elements.reviewSearch.addEventListener("input", () => {
  state.coachReviewSearch = elements.reviewSearch.value;
  renderCoachReviewWorkspace();
});
elements.reviewStatusFilter.addEventListener("change", () => {
  state.coachReviewFilter = elements.reviewStatusFilter.value;
  renderCoachReviewWorkspace();
});
elements.reviewAthlete.addEventListener("change", () => {
  renderCoachReviewWorkspace();
});
elements.coachNoteForm.addEventListener("submit", (event) => {
  recordCoachNote(event).catch(handleError);
});
elements.copyAccountCodeButton.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(currentAccountId());
    showNotice("Account code copied.");
  }
  catch {
    showNotice("Copy was blocked by the browser.", "error");
  }
});
elements.refreshAccountButton.addEventListener(
  "click",
  () => {
    loadPersistentAccountDetail()
      .catch(handleError);
  }
);

elements.accountProfileForm.addEventListener(
  "submit",
  (event) => {
    guardedAction(submitButtonOf, saveAccountProfile)(event)
      .catch(handleError);
  }
);

elements.requestVerificationButton.addEventListener(
  "click",
  () => {
    guardedAction(elements.requestVerificationButton, requestAccountVerificationCode)()
      .catch(handleError);
  }
);

elements.completeVerificationButton.addEventListener(
  "click",
  () => {
    guardedAction(elements.completeVerificationButton, verifyAccountEmail)()
      .catch(handleError);
  }
);

elements.accountPasswordForm.addEventListener(
  "submit",
  (event) => {
    guardedAction(submitButtonOf, saveAccountPassword)(event)
      .catch(handleError);
  }
);

elements.accountClosureForm.addEventListener(
  "submit",
  (event) => {
    guardedAction(submitButtonOf, closePersistentAccount)(event)
      .catch(handleError);
  }
);

elements.dataRightsRetryButton.addEventListener(
  "click",
  () => {
    loadDataRightsState().catch(handleError);
  }
);

elements.requestDataExportButton.addEventListener(
  "click",
  () => {
    guardedAction(elements.requestDataExportButton, requestDataExportAction)()
      .catch(handleError);
  }
);

elements.reviewDataDeletionButton.addEventListener(
  "click",
  () => {
    reviewDataDeletionAction().catch(handleError);
  }
);

elements.dataDeletionConfirmForm.addEventListener(
  "submit",
  (event) => {
    guardedAction(submitButtonOf, confirmDataDeletionAction)(event).catch(handleError);
  }
);

elements.signOutButton.addEventListener(
  "click",
  () => {
    clearLocalSession()
      .catch(handleError);
  }
);

async function bootstrapApplication() {
  let termsError = null;

  try {
    await loadServerTerms();
  }
  catch (error) {
    termsError = error;
    state.currentTerms = null;
    renderTermsState();
  }

  try {
    const response =
      await restoreAccountSession();

    applyAccountSession(response);

    await enterApplication();
  }
  catch (error) {
    resetAccountState();
    showEntry();
    setEntryMode("sign-in");

    if (
      error?.status &&
      error.status !== 401
    ) {
      showEntryMessage(
        friendlyError(
          error.payload,
          error.status
        ),
        true
      );
    }
    else if (termsError) {
      showEntryMessage(
        "Current terms and consent versions are unavailable. Account creation is disabled; existing users may still sign in.",
        true
      );
    }
  }
}

bootstrapApplication()
  .catch(handleError);


// FULL-UI-04A relationship directory event wiring.
elements.connectAthleteRelationshipState
  ?.addEventListener(
    "change",
    syncConnectAthleteRelationshipForm
  );

elements.refreshAthleteDirectoryButton
  ?.addEventListener(
    "click",
    () => {
      refreshCoachAthletes()
        .catch(
          catchWithViewRetry(
            elements.athleteDirectoryStatus,
            () => refreshCoachAthletes(),
            "Athlete directory could not be loaded."
          )
        );
    }
  );

elements.athleteDirectorySearch
  ?.addEventListener(
    "input",
    () => {
      state.coachAthleteSearch =
        elements.athleteDirectorySearch.value;

      saveState();
      renderCoachAthleteDirectory();
    }
  );

elements.athleteRelationshipFilter
  ?.addEventListener(
    "change",
    () => {
      state.coachAthleteRelationshipFilter =
        elements.athleteRelationshipFilter.value;

      saveState();
      renderCoachAthleteDirectory();
    }
  );

elements.closeAthleteRelationshipDetailButton
  ?.addEventListener(
    "click",
    closeAthleteRelationshipDetail
  );

elements.athleteRelationshipProfileButton
  ?.addEventListener(
    "click",
    () => {
      const athleteUserId =
        elements.athleteRelationshipProfileButton
          .dataset.athleteId;

      openAthleteProfile(
        athleteUserId
      ).catch(handleError);
    }
  );

elements.athleteRelationshipTransitionButton
  ?.addEventListener(
    "click",
    () => {
      const button =
        elements.athleteRelationshipTransitionButton;

      transitionCoachRelationship(
        button.dataset.relationshipAthleteId,
        button.dataset.relationshipAction
      ).catch(handleError);
    }
  );

document.addEventListener(
  "click",
  (event) => {
    const button =
      event.target.closest(
        "[data-relationship-action='audit']"
      );

    if (!button) return;

    openAthleteRelationshipDetail(
      button.dataset.relationshipAthleteId
    );
  }
);

if (elements.athleteDirectorySearch) {
  elements.athleteDirectorySearch.value =
    state.coachAthleteSearch ?? "";
}

if (elements.athleteRelationshipFilter) {
  elements.athleteRelationshipFilter.value =
    state.coachAthleteRelationshipFilter ??
    "all";
}

syncConnectAthleteRelationshipForm();

// FULL-UI-04B athlete-detail controls.
elements.athleteDetailRefreshButton
  ?.addEventListener(
    "click",
    () => {
      refreshAthleteDetail(
        state.selectedCoachAthleteId
      ).catch(handleError);
    }
  );

elements.athleteDetailNoteForm
  ?.addEventListener(
    "submit",
    (event) => {
      recordAthleteDetailNote(
        event
      ).catch(handleError);
    }
  );

elements.athleteDetailNoteCancelButton
  ?.addEventListener(
    "click",
    () => {
      elements.athleteDetailNoteForm
        .hidden = true;
    }
  );

elements.athleteDetailMessageButton
  ?.addEventListener(
    "click",
    openComposeAthleteMessagePanel
  );

elements.athleteDetailMessageForm
  ?.addEventListener(
    "submit",
    (event) => {
      confirmSendAthleteMessage(
        event
      ).catch(handleError);
    }
  );

elements.athleteDetailMessageCancelButton
  ?.addEventListener(
    "click",
    closeComposeAthleteMessagePanel
  );
