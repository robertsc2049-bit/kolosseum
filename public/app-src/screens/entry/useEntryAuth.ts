import { useCallback, useEffect, useState } from "react";

import { completePasswordReset, loadCurrentTerms, registerAccount, requestPasswordReset, signInAccount } from "../../api/authClient";
import { type JsonRecord } from "../../api/transport";

// DEV NOTE: FULL-UI-02D entry (sign-up/sign-in/password-reset) screen -
// ported field-for-field from public/app/app.js's setEntryMode()/
// showEntryMessage()/showPasswordResetRequest()/showPasswordResetComplete()/
// showSignInForm()/handleEntrySubmit()/handleResetRequest()/
// handleResetComplete()/currentTermsAvailable()/renderTermsState()/
// loadServerTerms(), mounted at #entry-auth-root (replacing the whole
// static tabs+entryForm+passwordResetRequestForm+passwordResetCompleteForm
// markup). app.js keeps toggling #entryView's own hidden attribute
// (bootstrapApplication()/showEntry()/enterApplication() - the shell-vs-
// entry-view decision itself stays legacy, driven by a session-cookie
// check this component never needs to duplicate) - this hook only owns
// what's rendered INSIDE that section.
//
// A successful create/sign-in dispatches kolosseum:entry-auth-succeeded
// with the raw session response; app.js's listener calls the existing
// applyAccountSession()/enterApplication() (both unchanged) and, if
// applyAccountSession() throws (a data-integrity edge case - a coach
// profile or athlete declaration that couldn't be restored), dispatches
// kolosseum:entry-auth-session-rejected back with a factual message so
// this hook can show it inline instead of leaving the user stuck on a
// blank transition. Both listeners run synchronously up to the possible
// throw, so the rejection (if any) is already dispatched by the time
// dispatchEvent() returns here - no promise/timeout needed.
const ENTRY_AUTH_SUCCEEDED_EVENT = "kolosseum:entry-auth-succeeded";
const SESSION_REJECTED_EVENT = "kolosseum:entry-auth-session-rejected";
const BOOTSTRAP_NOTICE_EVENT = "kolosseum:entry-bootstrap-notice";

export type EntryMode = "create" | "sign-in" | "reset-request" | "reset-complete";

type EntryAuthState = {
  mode: EntryMode;
  terms: JsonRecord | null;
  termsError: boolean;
  submitting: boolean;
  error: Error | null;
  statusMessage: string | null;
  resetRequestResult: string | null;
};

const initialState: EntryAuthState = {
  mode: "create",
  terms: null,
  termsError: false,
  submitting: false,
  error: null,
  statusMessage: null,
  resetRequestResult: null
};

function dispatchEntryAuthSucceeded(response: JsonRecord, mode: "create" | "sign-in"): string | null {
  let rejectedMessage: string | null = null;

  function handleRejected(event: Event) {
    rejectedMessage = String((event as CustomEvent).detail?.message ?? "The session could not be established.");
  }

  document.addEventListener(SESSION_REJECTED_EVENT, handleRejected);
  document.dispatchEvent(new CustomEvent(ENTRY_AUTH_SUCCEEDED_EVENT, { detail: { response, mode } }));
  document.removeEventListener(SESSION_REJECTED_EVENT, handleRejected);

  return rejectedMessage;
}

export function useEntryAuth() {
  const [state, setState] = useState<EntryAuthState>(initialState);

  useEffect(() => {
    loadCurrentTerms()
      .then((terms) => setState((current) => ({ ...current, terms })))
      .catch(() => setState((current) => ({ ...current, termsError: true })));
  }, []);

  useEffect(() => {
    function handleBootstrapNotice(event: Event) {
      const message = (event as CustomEvent).detail?.message;
      if (message) setState((current) => ({ ...current, error: new Error(String(message)) }));
    }
    document.addEventListener(BOOTSTRAP_NOTICE_EVENT, handleBootstrapNotice);
    return () => document.removeEventListener(BOOTSTRAP_NOTICE_EVENT, handleBootstrapNotice);
  }, []);

  const termsAvailable = Boolean(state.terms?.current_terms_version && state.terms?.current_consent_version);

  const setMode = useCallback((mode: EntryMode) => {
    setState((current) => ({ ...current, mode, error: null, statusMessage: null }));
  }, []);

  const submitCreate = useCallback(async (input: {
    role: string;
    displayName: string;
    activityId: string;
    email: string;
    password: string;
    betaConsent: boolean;
    declarationConsent: boolean;
  }) => {
    if (!termsAvailable) {
      setState((current) => ({ ...current, error: new Error("Current terms and consent versions are unavailable. Account creation is disabled.") }));
      return;
    }

    if (!input.betaConsent || !input.declarationConsent) {
      setState((current) => ({ ...current, error: new Error("Accept the terms and account consent before continuing.") }));
      return;
    }

    setState((current) => ({ ...current, submitting: true, error: null }));

    try {
      const response = await registerAccount({
        actor_type: input.role,
        display_name: input.displayName.trim(),
        email: input.email.trim().toLowerCase(),
        password: input.password,
        activity_id: input.role === "athlete" ? input.activityId : null,
        accepted_terms: true,
        accepted_consent: true,
        accepted_terms_version: state.terms?.current_terms_version,
        accepted_consent_version: state.terms?.current_consent_version
      });

      const rejectedMessage = dispatchEntryAuthSucceeded(response, "create");
      setState((current) => ({
        ...current,
        submitting: rejectedMessage ? false : current.submitting,
        error: rejectedMessage ? new Error(rejectedMessage) : current.error
      }));
    }
    catch (error) {
      setState((current) => ({ ...current, submitting: false, error: error instanceof Error ? error : new Error("The account could not be created.") }));
    }
  }, [termsAvailable, state.terms]);

  const submitSignIn = useCallback(async (input: { email: string; password: string }) => {
    setState((current) => ({ ...current, submitting: true, error: null }));

    try {
      const response = await signInAccount({
        email: input.email.trim().toLowerCase(),
        password: input.password
      });

      const rejectedMessage = dispatchEntryAuthSucceeded(response, "sign-in");
      setState((current) => ({
        ...current,
        submitting: rejectedMessage ? false : current.submitting,
        error: rejectedMessage ? new Error(rejectedMessage) : current.error
      }));
    }
    catch (error) {
      setState((current) => ({ ...current, submitting: false, error: error instanceof Error ? error : new Error("Sign-in failed.") }));
    }
  }, []);

  const submitResetRequest = useCallback(async (email: string) => {
    setState((current) => ({ ...current, submitting: true, error: null }));

    try {
      const trimmedEmail = email.trim().toLowerCase();
      const response = await requestPasswordReset({ email: trimmedEmail });
      const developmentCode = String(response?.development_code ?? "");

      setState((current) => ({
        ...current,
        submitting: false,
        mode: "reset-complete",
        resetRequestResult: developmentCode ? `Development code: ${developmentCode}` : "The request was recorded."
      }));

      return { email: trimmedEmail, code: developmentCode };
    }
    catch (error) {
      setState((current) => ({ ...current, submitting: false, error: error instanceof Error ? error : new Error("The request could not be completed.") }));
      return null;
    }
  }, []);

  const submitResetComplete = useCallback(async (input: { email: string; code: string; newPassword: string }) => {
    setState((current) => ({ ...current, submitting: true, error: null }));

    try {
      await completePasswordReset({
        email: input.email.trim().toLowerCase(),
        code: input.code.trim(),
        new_password: input.newPassword
      });

      setState((current) => ({
        ...current,
        submitting: false,
        mode: "sign-in",
        statusMessage: "Password reset complete. Sign in with the new password."
      }));

      return true;
    }
    catch (error) {
      setState((current) => ({ ...current, submitting: false, error: error instanceof Error ? error : new Error("The password could not be reset.") }));
      return false;
    }
  }, []);

  return {
    ...state,
    termsAvailable,
    setMode,
    submitCreate,
    submitSignIn,
    submitResetRequest,
    submitResetComplete
  };
}
