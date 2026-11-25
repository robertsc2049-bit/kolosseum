import React from "react";

import { PhoneMore } from "../../components/PhoneMore";
import { useProgrammeBuilderDraft } from "./useProgrammeBuilderDraft";
// eslint-disable-next-line import/no-unresolved
import { V1_ACTIVITIES } from "../../../../shared/v1-boundary/v1ActivityRegistry.mjs";

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
      <PhoneMore key={draft.template_id} label="Name, sport and settings" open={!draft.template_id}>
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
            {V1_ACTIVITIES.map((activity) => (
              <option key={activity.activity_id} value={activity.activity_id}>{activity.display_label}</option>
            ))}
          </select>
        </label>
        <PhoneMore label="Description" open={Boolean(draft.description)}>
          <label className="field">
            <span>Description</span>
            <textarea
              maxLength={1000}
              placeholder="Optional description of this programme"
              defaultValue={draft.description}
              data-template-kind="header"
              data-field="description"
            />
          </label>
        </PhoneMore>
        <label className="checkbox-field programme-adjust-breaks">
          <input
            key={draft.template_id}
            type="checkbox"
            defaultChecked={draft.adjust_for_breaks === true}
            data-template-kind="header"
            data-field="adjust_for_breaks"
          />
          <span>Adjust for breaks</span>
        </label>
        <details className="hint-more"><summary>What this does</summary><p className="muted small">When ticked, an athlete back after 10 or more days without a session gets a lighter first week: a set fewer on everything, weights 10% lighter (20% after 28 days) and RPE 1 easier (2 after 28 days). Not ticked, their sessions come exactly as you write them.</p></details>
      </PhoneMore>
    </>
  );
}
