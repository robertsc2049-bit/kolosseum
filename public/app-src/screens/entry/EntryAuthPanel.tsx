import React, { useState } from "react";

import { ApiRequestError, type JsonRecord } from "../../api/transport";
import { useEntryAuth } from "./useEntryAuth";

// DEV NOTE: see useEntryAuth.ts's own DEV NOTE for the full port mapping and
// the cross-stack bridge protocol. This file owns the raw form field state
// (the hook only owns mode/terms/submit-status), matching this migration's
// established split between a screen-level hook (submit actions + result
// state) and per-field useState in the panel (see PasswordForm.tsx/
// ProfileForm.tsx).

const ERROR_MESSAGES: Record<string, string> = {
  account_email_invalid: "Enter a valid email address.",
  account_display_name_invalid: "Enter a display name of 80 characters or fewer.",
  account_password_too_short: "Passwords must contain at least 12 characters.",
  account_password_too_long: "The password is too long.",
  account_actor_type_invalid: "Choose an athlete or coach account.",
  account_activity_invalid: "Choose a supported primary activity.",
  account_acceptance_required: "Accept the terms and account consent before continuing.",
  account_acceptance_version_mismatch: "The terms or consent version changed. Review the current versions and try again.",
  account_email_already_registered: "An account already uses this email address.",
  account_existing_role_mismatch: "This existing identity belongs to a different account type.",
  account_sign_in_failed: "The email or password is incorrect.",
  account_temporarily_locked: "Sign-in is temporarily locked after repeated failed attempts.",
  account_session_missing: "Sign in to continue.",
  account_session_invalid: "The sign-in session has expired.",
  account_csrf_invalid: "The account request could not be authorised. Refresh and try again.",
  account_challenge_invalid: "The six-digit code is invalid or expired."
};

const ACCOUNT_STATE_MESSAGES: Record<string, string> = {
  suspended: "This account is suspended. Workspace access is unavailable.",
  closed: "This account is closed. Sign-in and workspace access are unavailable.",
  deleted: "This account has been deleted. Sign-in and workspace access are unavailable."
};

function factualAccountStateMessage(accountState: string): string {
  return ACCOUNT_STATE_MESSAGES[accountState] ?? "This account is not currently active.";
}

function genericMessageForStatus(status: number): string {
  if (status === 401) return "Sign in again to continue.";
  if (status === 403) return "This action is not available for this account.";
  if (status === 404) return "That record could not be found.";
  if (status === 409) return "That could not be completed because something changed. Refresh and try again.";
  if (status === 423) return "This account is not currently active.";
  if (status === 429) return "Too many attempts. Wait a moment and try again.";
  if (status >= 500) return "Something went wrong on our end. Try again in a moment.";
  return "That request could not be completed. Try again, or report this problem if it continues.";
}

function errorMessage(error: Error | null): string {
  if (!error) return "";

  if (error instanceof ApiRequestError) {
    const record = (error.payload ?? {}) as JsonRecord;
    const code = String(record.error ?? record.reason ?? record.failure_token ?? error.message);
    if (code === "account_unavailable") return factualAccountStateMessage(String(record.account_state ?? ""));
    return ERROR_MESSAGES[code] ?? genericMessageForStatus(error.status);
  }

  return error.message;
}

export function EntryAuthPanel() {
  const {
    mode, terms, termsAvailable, submitting, error, statusMessage, resetRequestResult,
    setMode, submitCreate, submitSignIn, submitResetRequest, submitResetComplete
  } = useEntryAuth();

  const [role, setRole] = useState("athlete");
  const [displayName, setDisplayName] = useState("");
  const [activityId, setActivityId] = useState("powerlifting");
  const [betaConsent, setBetaConsent] = useState(false);
  const [declarationConsent, setDeclarationConsent] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [resetRequestEmail, setResetRequestEmail] = useState("");
  const [resetCompleteEmail, setResetCompleteEmail] = useState("");
  const [resetCompleteCode, setResetCompleteCode] = useState("");
  const [resetCompletePassword, setResetCompletePassword] = useState("");

  const createMode = mode === "create";

  function handleEntrySubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    if (createMode) {
      submitCreate({ role, displayName, activityId, email, password, betaConsent, declarationConsent });
    }
    else {
      submitSignIn({ email, password });
    }
  }

  function handleForgotPassword() {
    setResetRequestEmail(email);
    setMode("reset-request");
  }

  async function handleResetRequestSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    const result = await submitResetRequest(resetRequestEmail);
    if (result) {
      setResetCompleteEmail(result.email);
      setResetCompleteCode(result.code);
    }
  }

  async function handleResetCompleteSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    const succeeded = await submitResetComplete({
      email: resetCompleteEmail,
      code: resetCompleteCode,
      newPassword: resetCompletePassword
    });
    if (succeeded) {
      setEmail(resetCompleteEmail);
      setPassword("");
    }
  }

  return (
    <>
      <div className="entry-mode-tabs" role="tablist" aria-label="Account access">
        <button
          type="button"
          role="tab"
          aria-selected={createMode}
          className={`entry-mode-tab${createMode ? " active" : ""}`}
          onClick={() => setMode("create")}
        >
          Create account
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={!createMode}
          className={`entry-mode-tab${!createMode ? " active" : ""}`}
          onClick={() => setMode("sign-in")}
        >
          Sign in
        </button>
      </div>

      {mode === "create" || mode === "sign-in" ? (
        <form className="entry-form" onSubmit={handleEntrySubmit}>
          <div>
            <p className="eyebrow">September controlled beta</p>
            <h2>{createMode ? "Create your account" : "Sign in"}</h2>
            <p className="muted">
              {createMode
                ? "Create persistent product access for this installation."
                : "Open an existing athlete or coach workspace."}
            </p>
          </div>

          {createMode ? (
            <div>
              <fieldset className="role-choice">
                <legend>Account type</legend>
                <label>
                  <input
                    type="radio"
                    name="role"
                    value="athlete"
                    checked={role === "athlete"}
                    onChange={() => setRole("athlete")}
                  />
                  <span>
                    <strong>Athlete</strong>
                    <small>Run sessions and view history</small>
                  </span>
                </label>
                <label>
                  <input
                    type="radio"
                    name="role"
                    value="coach"
                    checked={role === "coach"}
                    onChange={() => setRole("coach")}
                  />
                  <span>
                    <strong>Coach</strong>
                    <small>Assign and review athlete work</small>
                  </span>
                </label>
              </fieldset>

              <label className="field">
                <span>Display name</span>
                <input
                  autoComplete="name"
                  maxLength={80}
                  required
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                />
              </label>

              {role === "athlete" ? (
                <label className="field">
                  <span>Primary activity</span>
                  <select value={activityId} onChange={(event) => setActivityId(event.target.value)}>
                    <option value="powerlifting">Powerlifting</option>
                    <option value="general_strength">General strength</option>
                    <option value="rugby_union">Rugby union</option>
                  </select>
                </label>
              ) : null}

              <div className="consent-box">
                <label>
                  <input
                    type="checkbox"
                    required
                    checked={betaConsent}
                    onChange={(event) => setBetaConsent(event.target.checked)}
                  />
                  <span>
                    I accept the controlled-beta terms
                    (<strong>{terms?.current_terms_version ? String(terms.current_terms_version) : "unavailable"}</strong>).
                  </span>
                </label>
                <label>
                  <input
                    type="checkbox"
                    required
                    checked={declarationConsent}
                    onChange={(event) => setDeclarationConsent(event.target.checked)}
                  />
                  <span>
                    I consent to the account and factual product records being stored
                    (<strong>{terms?.current_consent_version ? String(terms.current_consent_version) : "unavailable"}</strong>).
                  </span>
                </label>
              </div>
            </div>
          ) : null}

          <label className="field">
            <span>Email</span>
            <input
              type="email"
              autoComplete="email"
              required
              maxLength={254}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>

          <label className="field">
            <span>Password</span>
            <input
              type="password"
              autoComplete={createMode ? "new-password" : "current-password"}
              required
              minLength={12}
              maxLength={200}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
            <small>At least 12 characters.</small>
          </label>

          <button
            className="button primary wide"
            type="submit"
            disabled={submitting || (createMode && !termsAvailable)}
          >
            {createMode ? "Create account" : "Sign in"}
          </button>

          {!createMode ? (
            <button type="button" className="text-button centred-action" onClick={handleForgotPassword}>
              Forgot password?
            </button>
          ) : null}

          {error || statusMessage ? (
            <p className={`form-error${!error && statusMessage ? " success-message" : ""}`} role="alert">
              {error ? errorMessage(error) : statusMessage}
            </p>
          ) : null}
        </form>
      ) : null}

      {mode === "reset-request" ? (
        <form className="entry-form compact-entry-form" onSubmit={handleResetRequestSubmit}>
          <div>
            <p className="eyebrow">Account recovery</p>
            <h2>Reset password</h2>
            <p className="muted">Request a six-digit recovery code.</p>
          </div>

          <label className="field">
            <span>Email</span>
            <input
              type="email"
              autoComplete="email"
              required
              maxLength={254}
              value={resetRequestEmail}
              onChange={(event) => setResetRequestEmail(event.target.value)}
            />
          </label>

          <button className="button primary wide" type="submit" disabled={submitting}>Request code</button>
          <button type="button" className="text-button centred-action" onClick={() => setMode("sign-in")}>
            Back to sign in
          </button>

          {error ? <p className="inline-result" data-tone="error">{errorMessage(error)}</p> : null}
        </form>
      ) : null}

      {mode === "reset-complete" ? (
        <form className="entry-form compact-entry-form" onSubmit={handleResetCompleteSubmit}>
          <div>
            <p className="eyebrow">Account recovery</p>
            <h2>Set new password</h2>
          </div>

          <label className="field">
            <span>Email</span>
            <input
              type="email"
              autoComplete="email"
              required
              maxLength={254}
              value={resetCompleteEmail}
              onChange={(event) => setResetCompleteEmail(event.target.value)}
            />
          </label>

          <label className="field">
            <span>Six-digit code</span>
            <input
              inputMode="numeric"
              autoComplete="one-time-code"
              required
              pattern="[0-9]{6}"
              maxLength={6}
              value={resetCompleteCode}
              onChange={(event) => setResetCompleteCode(event.target.value)}
            />
          </label>

          <label className="field">
            <span>New password</span>
            <input
              type="password"
              autoComplete="new-password"
              required
              minLength={12}
              maxLength={200}
              value={resetCompletePassword}
              onChange={(event) => setResetCompletePassword(event.target.value)}
            />
          </label>

          <button className="button primary wide" type="submit" disabled={submitting}>Set new password</button>
          <button type="button" className="text-button centred-action" onClick={() => setMode("sign-in")}>
            Back to sign in
          </button>

          {resetRequestResult ? <p className="inline-result">{resetRequestResult}</p> : null}
          {error ? <p className="inline-result" data-tone="error">{errorMessage(error)}</p> : null}
        </form>
      ) : null}
    </>
  );
}
