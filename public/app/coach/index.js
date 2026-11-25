import { catchWithViewRetry, handleError, showNotice } from "../core/notices.js";
import { elements } from "../core/elements.js";
import { state } from "../core/state.js";
import {
  closeAthleteProfile,
  refreshCoachAssignments,
  refreshCoachAthletes,
  refreshCoachDashboard,
  refreshCoachEvents,
  renderCoachDashboard,
  renderCoachEvents,
  renderCoachWorkspace
} from "./athletes.js";
import { clearTemplateDraftState, closeTemplateBuilder, confirmTemplateBuilderDeparture } from "./builder.js";
import { loadTemplateExercises, refreshProgrammeLibrary, refreshTemplates, renderTemplateLibrary } from "./programmes.js";
import "./builderControls.js";

export { clearTemplateDraftState, closeAthleteProfile };

// A coach's own data, once when the app opens.
export async function loadCoachWorkspace() {
  try {
    // (The exercise list is read when the builder or an athlete's profile opens.)
    await Promise.all([
      refreshTemplates({ quiet: true }),
      refreshCoachEvents({ quiet: true }),
      refreshCoachAthletes({ quiet: true }),
      refreshCoachAssignments({ quiet: true })
    ]);
  }
  catch (error) {
    showNotice(error.message, "error");
  }

  renderCoachWorkspace();
  renderCoachEvents();
  renderTemplateLibrary();
}

// Leaving the builder for another screen: false if the coach stays.
export function leaveTemplateBuilder() {
  if (!elements.templateBuilderView || elements.templateBuilderView.hidden) return true;
  if (!confirmTemplateBuilderDeparture()) {
    return false;
  }

  closeTemplateBuilder({
    force: true,
    silent: true,
    updateRoute: false
  });
  return true;
}

export function coachViewShown(view) {
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
    // The builder's exercise list, ready before it's opened.
    loadTemplateExercises().catch(handleError);
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
}
