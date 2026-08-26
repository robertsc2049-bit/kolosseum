import { useCallback, useEffect, useRef, useState } from "react";

import {
  loadCommercialAccount,
  recordCommercialPaymentReturn,
  requestCommercialBillingPortal,
  requestCommercialCheckout
} from "../../api/commercialClient";
import { loadAccountDetail } from "../../api/client";
import { type JsonRecord } from "../../api/transport";

// DEV NOTE: FULL-UI-08 commercial/billing - ported from commercial_ui.js's
// refreshCommercial()/openCheckout()/openBillingPortal()/
// handlePaymentReturn(). Fetches on mount only (no view-entry MutationObserver
// like legacy's - this hook's effect runs once per mount, matching every
// other account sub-panel migrated so far), plus a one-time payment-return
// check reading window.location.search (never bare location - see
// useTrainingHistory.ts's established jsdom-safe pattern).
//
// legacy's lastRenderedSignature de-dup (skip re-render if the payload is
// byte-identical to last time) has no equivalent here - React already
// bails out of re-rendering unchanged output, and setState with identical
// data is harmless, so this manual DOM-mutation-avoidance optimisation is
// simply dropped rather than ported.
function clean(value: unknown): string {
  return String(value ?? "").trim();
}

function humanise(value: unknown): string {
  const text = clean(value);
  return text ? text.replaceAll("_", " ").replace(/\b\w/gu, (letter) => letter.toUpperCase()) : "—";
}

function dateTime(value: unknown): string {
  const candidate = clean(value);
  if (!candidate) return "—";
  const date = new Date(candidate);
  return Number.isNaN(date.getTime()) ? candidate : date.toLocaleString();
}

function currentRequestId(prefix: string): string {
  const cryptoObj = globalThis.crypto as Crypto | undefined;
  const suffix = typeof cryptoObj?.randomUUID === "function"
    ? cryptoObj.randomUUID()
    : `${Date.now()}_${Math.random().toString(16).slice(2)}`;
  return `${prefix}_${suffix}`.replace(/[^A-Za-z0-9_.:-]/gu, "_");
}

function errorMessage(error: unknown): string {
  const payload = error instanceof Error ? (error as Error & { payload?: unknown }).payload : undefined;
  const record = payload as JsonRecord | undefined;
  const code = typeof record?.error === "string" ? record.error : (error instanceof Error ? error.message : "commercial_request_failed");

  const missing = (record?.details as JsonRecord | undefined)?.missing_configuration;
  const missingSuffix = Array.isArray(missing) && missing.length > 0
    ? ` Missing: ${missing.map((entry) => clean(entry)).join(", ")}.`
    : "";

  const messages: Record<string, string> = {
    account_session_missing: "Sign in to view commercial account state.",
    account_session_invalid: "The sign-in session has expired.",
    commercial_configuration_missing: `Controlled-launch checkout is not configured on this server.${missingSuffix}`,
    commercial_coach_account_required: "Commercial controls are available to coach accounts only.",
    commercial_seat_limit_reached: "The current seat allowance is fully used.",
    commercial_checkout_record_missing: "No checkout request exists for this account.",
    commercial_billing_record_missing: "No billing record exists for this account.",
    commercial_portal_unavailable: "The billing portal is unavailable until trusted payment confirmation is recorded.",
    commercial_portal_configuration_missing: "The billing portal has not been configured on this server.",
    commercial_payment_return_invalid: "The payment return status is invalid."
  };

  return messages[code] ?? humanise(code);
}

export type CommercialAccountState = {
  loading: boolean;
  commercial: JsonRecord;
  history: JsonRecord[];
  resultText: string | null;
  resultTone: "neutral" | "success" | "error" | "warning";
  entitlementText: string | null;
  entitlementTone: "neutral" | "warning";
  busy: boolean;
};

const initialState: CommercialAccountState = {
  loading: true,
  commercial: {},
  history: [],
  resultText: null,
  resultTone: "neutral",
  entitlementText: null,
  entitlementTone: "neutral",
  busy: false
};

export function useCommercialAccount() {
  const [state, setState] = useState<CommercialAccountState>(initialState);
  const returnHandledRef = useRef(false);

  const refresh = useCallback(async (options: { quiet?: boolean } = {}) => {
    try {
      const payload = await loadCommercialAccount();
      const commercial = (payload.commercial && typeof payload.commercial === "object" ? payload.commercial : {}) as JsonRecord;
      const history = Array.isArray(payload.history) ? (payload.history as JsonRecord[]) : [];

      const entitlement = commercial.entitlement_error && typeof commercial.entitlement_error === "object"
        ? (commercial.entitlement_error as JsonRecord)
        : null;

      setState((current) => ({
        ...current,
        loading: false,
        commercial,
        history,
        entitlementText: entitlement ? (clean(entitlement.message) || humanise(entitlement.code)) : null,
        entitlementTone: entitlement ? "warning" : "neutral",
        ...(options.quiet ? {} : { resultText: "Commercial account state refreshed.", resultTone: "success" as const })
      }));
    }
    catch (error) {
      setState((current) => ({ ...current, loading: false, resultText: errorMessage(error), resultTone: "error" }));
    }
  }, []);

  const runAction = useCallback(async (action: () => Promise<JsonRecord>): Promise<JsonRecord | null> => {
    setState((current) => ({ ...current, busy: true }));
    try {
      const result = await action();
      await refresh({ quiet: true });
      return result;
    }
    catch (error) {
      setState((current) => ({ ...current, resultText: errorMessage(error), resultTone: "error" }));
      return null;
    }
    finally {
      setState((current) => ({ ...current, busy: false }));
      await refresh({ quiet: true });
    }
  }, [refresh]);

  const openCheckout = useCallback(async () => {
    const result = await runAction(async () => {
      const account = await loadAccountDetail();
      const csrfToken = typeof account.csrf_token === "string" ? account.csrf_token : "";
      return requestCommercialCheckout({ request_id: currentRequestId("commercial_checkout") }, csrfToken);
    });
    if (!result) return;

    const checkoutUrl = clean(result.checkout_url);
    if (checkoutUrl) {
      setState((current) => ({ ...current, resultText: "Checkout request recorded. Opening the configured provider page.", resultTone: "success" }));
      window.location.assign(checkoutUrl);
      return;
    }
    setState((current) => ({ ...current, resultText: "Checkout request recorded. No live provider call was performed.", resultTone: "success" }));
  }, [runAction]);

  const openBillingPortal = useCallback(async () => {
    const result = await runAction(async () => {
      const account = await loadAccountDetail();
      const csrfToken = typeof account.csrf_token === "string" ? account.csrf_token : "";
      return requestCommercialBillingPortal({ request_id: currentRequestId("commercial_portal") }, csrfToken);
    });
    if (!result) return;

    const portalUrl = clean(result.portal_url);
    if (portalUrl) {
      setState((current) => ({ ...current, resultText: "Portal request recorded. Opening the configured provider page.", resultTone: "success" }));
      window.location.assign(portalUrl);
      return;
    }
    setState((current) => ({ ...current, resultText: "Portal request recorded. No live provider call was performed.", resultTone: "success" }));
  }, [runAction]);

  const handlePaymentReturn = useCallback(async () => {
    if (returnHandledRef.current) return;

    const parameters = new URLSearchParams(window.location.search);
    const outcome = clean(parameters.get("checkout_return"));

    if (outcome !== "success" && outcome !== "cancelled") {
      returnHandledRef.current = true;
      return;
    }
    returnHandledRef.current = true;

    try {
      await runAction(async () => {
        const account = await loadAccountDetail();
        const csrfToken = typeof account.csrf_token === "string" ? account.csrf_token : "";
        const providerSessionId = clean(parameters.get("provider_session_id"));
        return recordCommercialPaymentReturn(
          {
            request_id: `commercial_return_${outcome}_${providerSessionId || "no_session"}`,
            outcome,
            provider_session_id: providerSessionId || null
          },
          csrfToken
        );
      });

      setState((current) => ({
        ...current,
        resultText: outcome === "success"
          ? "Checkout return recorded. Trusted provider confirmation is still required."
          : "Checkout cancellation recorded.",
        resultTone: outcome === "success" ? "warning" : "neutral"
      }));

      parameters.delete("checkout_return");
      parameters.delete("provider_session_id");
      const query = parameters.toString();
      const nextUrl = `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`;
      window.history.replaceState(null, "", nextUrl);
    }
    catch {
      // Matches legacy's silent swallow here - runAction already recorded a
      // user-visible error message via resultText.
    }
  }, [runAction]);

  useEffect(() => {
    refresh({ quiet: true });
    handlePaymentReturn();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const button = document.getElementById("refreshAccountButton");
    if (!button) return;
    function handleClick() {
      window.setTimeout(() => {
        refresh({ quiet: true });
      }, 0);
    }
    button.addEventListener("click", handleClick);
    return () => button.removeEventListener("click", handleClick);
  }, [refresh]);

  return {
    ...state,
    refresh,
    openCheckout,
    openBillingPortal
  };
}
