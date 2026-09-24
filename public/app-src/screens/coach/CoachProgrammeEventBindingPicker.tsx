import React, { useEffect, useState } from "react";

import { type JsonRecord } from "../../api/transport";
import { formatDate } from "../../utils/format";
import { useCoachProgrammeEventBinding } from "./useCoachProgrammeEventBinding";

// DEV NOTE: FULL-UI-12C event-calendar binding picker - a field-for-field
// port of app.js's former renderEventBindingPicker(). The option list, the
// bind/rebind button text/disabled state, and the status banner's not-yet-
// checked / inaccessible / cancelled / archived / stale-version / current
// state machine are reproduced 1:1 from that function (including its one
// quirk: once bound, the select's value is always forced back to the bound
// event id on every render, so a warning-state "select a different event"
// button stays disabled until the coach picks a genuinely new value in the
// same render pass that clears it - unchanged legacy behavior, not
// something this port should silently fix). See
// useCoachProgrammeEventBinding.ts for the data/write-path split.

type BindingStatus = {
  event_id?: string;
  accessible?: boolean;
  event_status?: string;
  is_current?: boolean;
};

function eventOptionLabel(event: JsonRecord): string {
  const plan = event.event_plan as JsonRecord | undefined;
  const name = String(plan?.event_name ?? event.event_id ?? "");
  return `${name} · ${formatDate(plan?.event_date)}`;
}

export function CoachProgrammeEventBindingPicker() {
  const { draft, eventLibrary, bindingStatus, requestBind } = useCoachProgrammeEventBinding();
  const [selected, setSelected] = useState("");

  const bound = Boolean(draft?.bound_event_id);

  useEffect(() => {
    if (!draft) setSelected("");
  }, [draft]);

  if (!draft) return null;

  const boundEventId = String(draft.bound_event_id ?? "");
  const knownEvent = eventLibrary.some((event) => String(event.event_id) === boundEventId);
  const selectValue = bound ? boundEventId : selected;
  const status = bindingStatus as BindingStatus | null;

  let buttonText = "Bind event";
  let buttonDisabled = !selectValue;
  let banner: { className: string; text: string } | null = null;

  if (bound) {
    if (!status || status.event_id !== boundEventId) {
      buttonText = "Rebind event";
      buttonDisabled = true;
      banner = { className: "neutral", text: "Checking the bound event's current state…" };
    }
    else if (!status.accessible) {
      buttonText = "Bind a different event";
      buttonDisabled = !selectValue || selectValue === boundEventId;
      banner = { className: "warning", text: "This event is no longer accessible. Select a different event to continue." };
    }
    else if (status.event_status === "cancelled") {
      buttonText = "Rebind event";
      buttonDisabled = !selectValue || selectValue === boundEventId;
      banner = { className: "warning", text: "The bound event has been cancelled. Activation is blocked until you rebind to another event." };
    }
    else if (status.event_status === "archived") {
      buttonText = "Rebind event";
      buttonDisabled = !selectValue || selectValue === boundEventId;
      banner = { className: "warning", text: "The bound event has been archived. Activation is blocked until you rebind to another event." };
    }
    else if (!status.is_current) {
      buttonText = "Rebind to latest version";
      buttonDisabled = false;
      banner = { className: "warning", text: "This event has a newer version. The programme still shows the date and details bound earlier - rebind to pull in the latest version." };
    }
    else {
      buttonText = "Bound";
      buttonDisabled = true;
      banner = { className: "complete", text: "This programme is bound to the current version of this event." };
    }
  }

  return (
    <>
      <label className="field">
        <span>Bind to an existing event</span>
        <select
          id="templateEventBindingSelect"
          value={selectValue}
          onChange={(event) => setSelected(event.target.value)}
        >
          <option value="">— Type event details manually —</option>
          {eventLibrary.map((event) => (
            <option key={String(event.event_id)} value={String(event.event_id)}>
              {eventOptionLabel(event)}
            </option>
          ))}
          {bound && !knownEvent && (
            <option value={boundEventId}>
              {String((draft.event_plan as JsonRecord | null)?.event_name ?? boundEventId)} (bound)
            </option>
          )}
        </select>
      </label>
      <div className="button-row">
        <button
          id="bindTemplateEventButton"
          className="button secondary small-button"
          type="button"
          disabled={buttonDisabled}
          onClick={() => requestBind(selectValue)}
        >
          {buttonText}
        </button>
      </div>
      <div
        id="templateEventBindingStatus"
        className={`assignment-requirements ${banner?.className ?? "neutral"}`}
        hidden={!banner}
      >
        {banner?.text ?? ""}
      </div>
    </>
  );
}
