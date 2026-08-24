import { useCallback, useEffect, useState } from "react";

import { type JsonRecord, loadAccountDetail } from "../../api/client";

export type AccountDetailState = {
  loading: boolean;
  error: string | null;
  account: JsonRecord | null;
  terms: JsonRecord | null;
  consentHistory: JsonRecord[];
  csrfToken: string;
};

const initialState: AccountDetailState = {
  loading: true,
  error: null,
  account: null,
  terms: null,
  consentHistory: [],
  csrfToken: ""
};

function isRecord(value: unknown): value is JsonRecord {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

// DEV NOTE: This hook independently fetches GET /account/detail rather than
// reading legacy app.js's private `state`/`elements` module scope - the two
// stacks stay decoupled by design (see the migration plan's "session
// handling" section). A second, redundant fetch alongside legacy
// bootstrapApplication's own call is accepted as harmless.
export function useAccountDetail(refreshToken: number) {
  const [state, setState] = useState<AccountDetailState>(initialState);

  const refresh = useCallback(async () => {
    setState((current) => ({ ...current, loading: true, error: null }));
    try {
      const detail = await loadAccountDetail();
      const account = isRecord(detail.account) ? detail.account : null;
      const terms = isRecord(detail.terms) ? detail.terms : null;
      const consentHistory = Array.isArray(detail.consent_history)
        ? detail.consent_history.filter(isRecord)
        : [];
      const csrfToken = typeof detail.csrf_token === "string" ? detail.csrf_token : "";

      setState({ loading: false, error: null, account, terms, consentHistory, csrfToken });
    }
    catch {
      setState((current) => ({
        ...current,
        loading: false,
        error: "Account details could not be loaded. Check your connection and try again."
      }));
    }
  }, []);

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refresh, refreshToken]);

  return { ...state, refresh };
}
