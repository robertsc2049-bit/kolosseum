import { useEffect, useState } from "react";

import { loadAccountDetail } from "../../api/client";
import { loadStandaloneEventLibrary, loadTemplateEventBindingStatus } from "../../api/coachWorkspaceClient";
import { type JsonRecord } from "../../api/transport";
import { useProgrammeBuilderDraft } from "./useProgrammeBuilderDraft";

// DEV NOTE: FULL-UI-12C event-calendar binding picker. The compile/fit-
// final-block math, countdown and allocation summary stay legacy (see
// renderEventCompiler()'s own DEV NOTE in app.js) - only the event
// selector/bind-button/status banner (the former renderEventBindingPicker())
// moved to React. The event library and binding-status GETs are fetched
// independently by this hook (this migration's established per-mount-point
// fetch pattern) rather than riding the kolosseum:programme-draft-changed
// broadcast, which only carries the draft itself plus save/dirty metadata.
// The actual bind mutation (POST /templates/:id/bind-event, plus its
// cascade of state.templateDraft/saveState()/reopening the builder) stays
// entirely in legacy's bindSelectedEventToTemplate() - requestBind() below
// only dispatches a kolosseum:bind-template-event CustomEvent for a small
// new app.js listener to hand off to that unchanged function, since
// replicating its side effects in React would duplicate real mutation
// logic for no behavioral gain.
const BIND_EVENT = "kolosseum:bind-template-event";

export function useCoachProgrammeEventBinding() {
  const { draft } = useProgrammeBuilderDraft();
  const [eventLibrary, setEventLibrary] = useState<JsonRecord[]>([]);
  const [bindingStatus, setBindingStatus] = useState<JsonRecord | null>(null);

  const templateId = String(draft?.template_id ?? "");
  const boundEventId = String(draft?.bound_event_id ?? "");

  useEffect(() => {
    let cancelled = false;
    loadStandaloneEventLibrary()
      .then((events) => {
        if (!cancelled) setEventLibrary(events);
      })
      .catch(() => {
        if (!cancelled) setEventLibrary([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!templateId || !boundEventId) {
      setBindingStatus(null);
      return;
    }
    let cancelled = false;
    loadAccountDetail()
      .then((account) => {
        const coachUserId = String((account.account as JsonRecord | undefined)?.user_id ?? "");
        return loadTemplateEventBindingStatus(templateId, coachUserId);
      })
      .then((status) => {
        if (!cancelled) setBindingStatus(status);
      })
      .catch(() => {
        if (!cancelled) setBindingStatus(null);
      });
    return () => {
      cancelled = true;
    };
  }, [templateId, boundEventId]);

  function requestBind(eventId: string) {
    if (!eventId) return;
    document.dispatchEvent(new CustomEvent(BIND_EVENT, { detail: { event_id: eventId } }));
  }

  return { draft, eventLibrary, bindingStatus, requestBind };
}
