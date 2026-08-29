import React from "react";

import { templateCounts } from "./programmeDraft";
import { useProgrammeBuilderDraft } from "./useProgrammeBuilderDraft";

// DEV NOTE: FULL-UI-05B programme builder facts (read-only) - ported
// field-for-field from public/app/app.js's updateTemplateFacts()'s four
// elements.template*Count/.templateVersion.textContent writes, replacing
// the static .template-facts markup. See useProgrammeBuilderDraft.ts's own
// DEV NOTE for how this stays in sync with the still-legacy builder.

export function CoachProgrammeBuilderFactsPanel() {
  const { draft } = useProgrammeBuilderDraft();
  if (!draft) return null;

  const counts = templateCounts(draft);

  return (
    <div className="template-facts">
      <div><span>Version</span><strong>{draft.template_version ?? 1}</strong></div>
      <div><span>Blocks</span><strong>{counts.blocks}</strong></div>
      <div><span>Weeks</span><strong>{counts.weeks}</strong></div>
      <div><span>Sessions</span><strong>{counts.sessions}</strong></div>
    </div>
  );
}
