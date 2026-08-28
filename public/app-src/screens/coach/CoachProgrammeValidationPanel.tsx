import React from "react";

import { type JsonRecord } from "../../api/transport";
import { programmeDisplayState } from "./useCoachProgrammeLibrary";
import { useCoachProgrammeStructure } from "./useCoachProgrammeStructure";
import { programmeActivationIssues } from "./programmeDraft";

// DEV NOTE: FULL-UI-05A programme activation validation summary (read-
// only) - ported field-for-field from public/app/app.js's
// programmeValidationHtml(). programmeActivationIssues() itself (the ~200-
// line rules engine) stays in app.js too - completeTemplateById() and the
// builder's own currentTemplateBuilderIssues() both still call it directly
// - see programmeDraft.ts's own copy, ported alongside templateRecordToDraft()
// since both this panel and the (future) structure-preview slice need the
// exact same draft shape. "Open draft builder" dispatches the same
// kolosseum:edit-programme bridge event the library/detail panels already
// use, rather than porting openTemplateBuilder() here.

function currentTemplate(templateId: string, templates: JsonRecord[]): JsonRecord | undefined {
  return templates.find((candidate) => String(candidate.template_id) === templateId);
}

function openDraftBuilder(templateId: string) {
  document.dispatchEvent(new CustomEvent("kolosseum:edit-programme", { detail: { template_id: templateId } }));
}

export function CoachProgrammeValidationPanel() {
  const { templateId, templates, templateExercises, loading, error } = useCoachProgrammeStructure();
  const template = currentTemplate(templateId, templates);

  if (loading && !template) return null;
  if (error) return <p className="muted small">{error}</p>;
  if (!template) return null;

  const storedStatus = String(template.template_status ?? "draft");

  if (storedStatus !== "draft") {
    const displayState = programmeDisplayState(template, templates);
    return (
      <div className="assignment-requirements neutral">
        This persisted version is {displayState}. Completion checks apply to draft versions only.
      </div>
    );
  }

  const issues = programmeActivationIssues(template, templateExercises);

  if (issues.length === 0) {
    return (
      <div className="assignment-requirements complete">
        All visible completion checks pass. The server remains authoritative when the template is marked complete.
      </div>
    );
  }

  return (
    <>
      <div className="assignment-requirements warning">
        {issues.length} completion issue{issues.length === 1 ? "" : "s"} recorded.
      </div>
      <ol className="programme-validation-list">
        {issues.map((issue, index) => (
          <li key={index}>
            <strong>{issue.path}</strong>
            <span>{issue.message}</span>
            <code>{issue.code}</code>
          </li>
        ))}
      </ol>
      <button className="button secondary small-button programme-validation-edit" type="button" onClick={() => openDraftBuilder(templateId)}>
        Open draft builder
      </button>
    </>
  );
}
