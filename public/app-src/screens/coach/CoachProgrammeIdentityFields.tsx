import React from "react";

import { useProgrammeBuilderDraft } from "./useProgrammeBuilderDraft";

// DEV NOTE: FULL-UI-05B programme builder identity fields (name/activity/
// description) - ported field-for-field from public/app/index.html's
// static markup, mounted at #template-identity-root. Unlike the tree/
// validation-list slices, there was no existing delegated listener to
// reuse here - legacy previously attached separate addEventListener
// calls directly to elements.templateName/templateActivity/
// templateDescription (captured once at bootstrap, before this React
// bundle's script tag runs - see index.html's script order). Moving
// those ids onto React-rendered elements would leave the OLD listeners
// attached to now-destroyed nodes.
//
// Fixed by extending this migration's established delegated-listener
// pattern to a NEW container: app.js now attaches ONE input listener and
// ONE change listener to #template-identity-root itself (which DOES
// exist at bootstrap, being static HTML) instead of to the three
// individual fields, matching data-template-kind="header"/data-field
// attributes on each control below - see updateTemplateIdentityField()
// in app.js's own DEV NOTE. syncTemplateHeader() (the old per-element
// handler) was deleted outright: it read the fields' live .value
// directly, which the new delegated handler already keeps
// state.templateDraft in sync with on every keystroke, making the old
// function's remaining "sync defensively before building a payload"
// call sites redundant.
//
// The name/activity fields keep their ORIGINAL ids ("templateName"/
// "templateActivity") since templateValidationSelector()'s click-to-
// focus mapping (#templateName/#templateActivity) is a LIVE
// document.querySelector() at click time, not a bootstrap-time
// snapshot - unlike elements.*, a live query works fine regardless of
// when React mounted.
// Uncontrolled (defaultValue, no onChange) so native typing is never
// fought by React - the delegated listener drives
// state.templateDraft, and a broadcast-triggered re-render reflects
// that external truth, same as every other builder-tree control.

export function CoachProgrammeIdentityFields() {
  const { draft } = useProgrammeBuilderDraft();
  if (!draft) return null;

  return (
    <>
      <label className="field">
        <span>Programme name</span>
        <input
          id="templateName"
          maxLength={120}
          defaultValue={draft.template_name}
          data-template-kind="header"
          data-field="template_name"
        />
      </label>
      <label className="field">
        <span>Activity</span>
        <select
          id="templateActivity"
          defaultValue={draft.activity_id}
          data-template-kind="header"
          data-field="activity_id"
        >
          <option value="powerlifting">Powerlifting</option>
          <option value="general_strength">General strength</option>
          <option value="rugby_union">Rugby union</option>
        </select>
      </label>
      <label className="field">
        <span>Description</span>
        <textarea
          maxLength={1000}
          placeholder="Factual description of this programme"
          defaultValue={draft.description}
          data-template-kind="header"
          data-field="description"
        />
      </label>
    </>
  );
}
