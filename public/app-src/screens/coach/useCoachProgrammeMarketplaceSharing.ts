import { useCallback, useEffect, useRef, useState } from "react";

import { loadAccountDetail } from "../../api/client";
import { loadCoachTemplates } from "../../api/coachWorkspaceClient";
import {
  loadTemplateReleaseHistory,
  loadTemplateSharingPreference,
  releaseTemplate,
  saveTemplateSharingPreference,
  type TemplateSharingPreference
} from "../../api/marketplaceClient";
import { type JsonRecord } from "../../api/transport";

// DEV NOTE: FULL-UI-05A programme marketplace sharing/release sub-panel -
// ported from public/app/app.js's renderProgrammeDetail()'s shareable-
// gating (a template can be shared/released once its status is "complete"
// or "active", never while still a draft) plus
// refreshTemplateSharingPreference()/confirmSaveTemplateSharing()/
// refreshTemplateReleaseHistory()/confirmReleaseTemplate(). Fetches the
// coach's own templates independently (matching this migration's
// established per-mount-point fetch pattern - see useCoachProgrammeDetail.ts)
// purely to read the currently open template's stored status for the
// shareable gate; opens on the same kolosseum:open-programme-detail event
// every other programme-detail sub-panel already listens for, and
// refetches on kolosseum:templates-changed so a status change made
// elsewhere (e.g. activating a completed template) updates the gate.
const OPEN_EVENT = "kolosseum:open-programme-detail";
const CHANGED_EVENT = "kolosseum:templates-changed";

export type CoachProgrammeMarketplaceSharingState = {
  templateId: string;
  loading: boolean;
  error: string | null;
  shareable: boolean;
  sharing: TemplateSharingPreference;
  savingSharing: boolean;
  sharingStatus: string;
  releases: JsonRecord[];
  releasing: boolean;
  releaseStatus: string;
};

const initialSharing: TemplateSharingPreference = { shared_publicly: false, price_label: "", payment_methods_note: "" };

const initialState: CoachProgrammeMarketplaceSharingState = {
  templateId: "",
  loading: false,
  error: null,
  shareable: false,
  sharing: initialSharing,
  savingSharing: false,
  sharingStatus: "",
  releases: [],
  releasing: false,
  releaseStatus: ""
};

export function useCoachProgrammeMarketplaceSharing() {
  const [state, setState] = useState<CoachProgrammeMarketplaceSharingState>(initialState);
  const templateIdRef = useRef("");

  useEffect(() => {
    templateIdRef.current = state.templateId;
  }, [state.templateId]);

  const load = useCallback(async (templateId: string) => {
    setState((current) => ({ ...current, templateId, loading: true, error: null }));
    try {
      const account = await loadAccountDetail();
      const coachUserId = String((account.account as JsonRecord | undefined)?.user_id ?? "");
      const templates = await loadCoachTemplates(coachUserId);
      const template = templates.find((candidate) => String(candidate.template_id) === templateId);
      const storedStatus = String(template?.template_status ?? "draft");
      const shareable = storedStatus === "complete" || storedStatus === "active";

      if (!shareable) {
        setState({ ...initialState, templateId, shareable: false });
        return;
      }

      const [sharing, releases] = await Promise.all([
        loadTemplateSharingPreference(templateId),
        loadTemplateReleaseHistory(templateId)
      ]);
      setState({ ...initialState, templateId, shareable: true, sharing, releases });
    }
    catch {
      setState((current) => ({
        ...current,
        loading: false,
        error: "The marketplace sharing details could not be loaded. Check your connection and try again."
      }));
    }
  }, []);

  const saveSharing = useCallback(async (input: { sharedPublicly: boolean; priceLabel: string; paymentMethodsNote: string }) => {
    const templateId = templateIdRef.current;
    if (!templateId) return;

    setState((current) => ({ ...current, savingSharing: true, sharingStatus: "Saving…" }));
    try {
      const account = await loadAccountDetail();
      const csrfToken = typeof account.csrf_token === "string" ? account.csrf_token : "";
      await saveTemplateSharingPreference(templateId, input, csrfToken);
      setState((current) => ({
        ...current,
        savingSharing: false,
        sharing: { shared_publicly: input.sharedPublicly, price_label: input.priceLabel, payment_methods_note: input.paymentMethodsNote },
        sharingStatus: input.sharedPublicly ? "Shared with other coaches." : "No longer shared."
      }));
    }
    catch {
      setState((current) => ({ ...current, savingSharing: false, sharingStatus: "The marketplace details could not be saved." }));
    }
  }, []);

  const release = useCallback(async (buyerAccountCode: string): Promise<boolean> => {
    const templateId = templateIdRef.current;
    if (!templateId || !buyerAccountCode) return false;

    setState((current) => ({ ...current, releasing: true, releaseStatus: "Releasing…" }));
    try {
      const account = await loadAccountDetail();
      const csrfToken = typeof account.csrf_token === "string" ? account.csrf_token : "";
      await releaseTemplate(templateId, buyerAccountCode, csrfToken);
      const releases = await loadTemplateReleaseHistory(templateId);
      setState((current) => ({ ...current, releasing: false, releases, releaseStatus: `Released to ${buyerAccountCode}.` }));
      return true;
    }
    catch {
      setState((current) => ({ ...current, releasing: false, releaseStatus: "The programme could not be released to that account." }));
      return false;
    }
  }, []);

  useEffect(() => {
    function handleOpen(event: Event) {
      const templateId = (event as CustomEvent<{ template_id?: string }>).detail?.template_id;
      if (templateId) load(templateId);
    }
    function handleChanged() {
      if (templateIdRef.current) load(templateIdRef.current);
    }
    document.addEventListener(OPEN_EVENT, handleOpen);
    document.addEventListener(CHANGED_EVENT, handleChanged);
    return () => {
      document.removeEventListener(OPEN_EVENT, handleOpen);
      document.removeEventListener(CHANGED_EVENT, handleChanged);
    };
  }, [load]);

  return { ...state, saveSharing, release };
}
