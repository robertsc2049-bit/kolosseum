import React from "react";

import { builderSaveStatus } from "./programmeDraft";
import { useProgrammeBuilderDraft } from "./useProgrammeBuilderDraft";

// DEV NOTE: FULL-UI-05B programme builder save-state badge + detail text
// (read-only) - ported field-for-field from public/app/app.js's
// renderTemplateBuilderState()'s save-badge/save-detail branches (see
// builderSaveStatus() in programmeDraft.ts). Two small independent mount
// points (matching this migration's established per-mount-point hook
// pattern) since the badge sits inside .template-builder-save-line
// (alongside the still-legacy Discard button) while the detail paragraph
// is a separate sibling below - each calls the shared hook independently
// rather than threading props between two mount roots.
//
// The mount container itself (#programme-builder-save-badge-root, static
// in index.html) keeps tabindex="-1" and is what
// openTemplateBuilder()'s recovery-focus call
// (elements.templateBuilderSaveBadgeRoot.focus(...)) targets - app.js's
// `elements` snapshot is built before the React bundle's script tag runs
// (see index.html's script order), so a live-mounted id on the React
// span itself would resolve to null at that point; the static wrapper
// div is always present at that time instead.

export function CoachProgrammeBuilderSaveBadge() {
  const { draft, saving, saveError, dirty, recovered, savedAt } = useProgrammeBuilderDraft();
  const status = builderSaveStatus({ draft, saving, saveError, dirty, recovered, savedAt });

  return (
    <span className={status.badgeClass} role="status" aria-live="polite">
      {status.label}
    </span>
  );
}

export function CoachProgrammeBuilderSaveDetail() {
  const { draft, saving, saveError, dirty, recovered, savedAt } = useProgrammeBuilderDraft();
  const status = builderSaveStatus({ draft, saving, saveError, dirty, recovered, savedAt });

  return <p className="muted small">{status.detail}</p>;
}
