import React from "react";

import { type JsonRecord } from "../../api/transport";
import { useProgrammeBuilderDraft } from "./useProgrammeBuilderDraft";

// DEV NOTE: FULL-UI-05B programme builder event-plan detail fields (name/
// type/programme start date/event date/location/timezone/notes) - ported
// field-for-field from public/app/index.html's static markup, mounted at
// #template-event-fields-root, reusing the SAME delegated-listener-on-a-
// wrapper technique established for CoachProgrammeIdentityFields.tsx
// (see updateTemplateEventField() in app.js's own DEV NOTE). The
// containing #templateEventFields div's own hidden toggle (driven by
// whether draft.event_plan exists at all - the "Compile to an event"
// checkbox) stays legacy, as does the event-binding picker, the compile/
// fit-final-block buttons, and the countdown/allocation summary display -
// all still read/write draft.blocks[].calendar_start_date as a side
// effect of the still-legacy renderEventCompiler(), a genuinely deeper
// entanglement than a clean render-only port could easily separate out
// in one slice.
//
// EVENT_TYPES_BY_ACTIVITY is duplicated here from app.js's own copy
// (kept in sync by convention, matching this migration's other
// duplicated-not-shared helpers e.g. newTemplateBlock()) since the
// activity-scoped <option> list needs to render correctly in React.
const EVENT_TYPES_BY_ACTIVITY: Record<string, [string, string][]> = {
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
};

function eventTypesForActivity(activityId: string): [string, string][] {
  return EVENT_TYPES_BY_ACTIVITY[activityId] ?? EVENT_TYPES_BY_ACTIVITY.general_strength;
}

export function CoachProgrammeEventFields() {
  const { draft } = useProgrammeBuilderDraft();
  const eventPlan = draft?.event_plan as JsonRecord | null | undefined;
  if (!draft || !eventPlan) return null;

  const bound = Boolean(draft.bound_event_id);
  const eventType = String(eventPlan.event_type ?? "");

  return (
    <>
      <label className="field">
        <span>Event name</span>
        <input
          maxLength={120}
          placeholder="British Championships"
          defaultValue={String(eventPlan.event_name ?? "")}
          disabled={bound}
          data-template-kind="event"
          data-field="event_name"
        />
      </label>
      <label className="field">
        <span>Event type</span>
        <select
          defaultValue={eventType}
          disabled={bound}
          data-template-kind="event"
          data-field="event_type"
        >
          {eventTypesForActivity(draft.activity_id).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>Programme start date</span>
        <input
          type="date"
          defaultValue={String(eventPlan.programme_start_date ?? "")}
          disabled={bound}
          data-template-kind="event"
          data-field="programme_start_date"
        />
      </label>
      <label className="field">
        <span>Event date</span>
        <input
          type="date"
          defaultValue={String(eventPlan.event_date ?? "")}
          disabled={bound}
          data-template-kind="event"
          data-field="event_date"
        />
      </label>
      <label className="field">
        <span>Location</span>
        <input
          maxLength={200}
          placeholder="Optional venue or town"
          defaultValue={String(eventPlan.location ?? "")}
          disabled={bound}
          data-template-kind="event"
          data-field="location"
        />
      </label>
      <label className="field">
        <span>Timezone</span>
        <input
          maxLength={80}
          defaultValue={String(eventPlan.timezone ?? "Europe/London")}
          disabled={bound}
          data-template-kind="event"
          data-field="timezone"
        />
      </label>
      <label className="field event-notes-field">
        <span>Event notes</span>
        <textarea
          maxLength={1000}
          placeholder="Factual event details only"
          defaultValue={String(eventPlan.notes ?? "")}
          disabled={bound}
          data-template-kind="event"
          data-field="notes"
        />
      </label>
    </>
  );
}
