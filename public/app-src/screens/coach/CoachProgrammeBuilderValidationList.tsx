import React from "react";

import { draftToValidationRecord, programmeActivationIssues } from "./programmeDraft";
import { useProgrammeBuilderDraft } from "./useProgrammeBuilderDraft";

// DEV NOTE: FULL-UI-05B programme builder completion validation list -
// ported field-for-field from public/app/app.js's
// renderTemplateBuilderState()'s issues.map(...) branch, reusing
// programmeActivationIssues()/draftToValidationRecord() from
// programmeDraft.ts (the exact same rules engine the persisted-template
// CoachProgrammeValidationPanel.tsx already uses). Mounted DIRECTLY into
// the existing #templateBuilderValidationList <ol> (kept, not replaced,
// so the still-legacy delegated click listener on that element - which
// calls focusTemplateValidationIssue() to scroll/focus the matching
// builder field - keeps firing on real clicks via native DOM bubbling;
// no bridge event needed for this). The outer #templateBuilderValidation
// container's warning/complete class and hidden state stay legacy
// (renderTemplateBuilderState() computes the identical issues.length via
// its own currentTemplateBuilderIssues(), kept in sync by convention).

export function CoachProgrammeBuilderValidationList() {
  const { draft, templateExercises } = useProgrammeBuilderDraft();
  if (!draft) return null;

  const issues = programmeActivationIssues(draftToValidationRecord(draft), templateExercises);

  if (issues.length === 0) {
    return (
      <li className="template-builder-validation-pass">
        All visible completion checks pass. The server remains authoritative.
      </li>
    );
  }

  return (
    <>
      {issues.map((issue, index) => (
        <li key={`${issue.code}_${index}`}>
          <button className="template-validation-link" type="button" data-builder-validation-index={index}>
            <span>{issue.path}</span>
            <strong>{issue.message}</strong>
            <code>{issue.code}</code>
          </button>
        </li>
      ))}
    </>
  );
}
