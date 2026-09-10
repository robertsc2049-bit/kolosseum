import React, { useEffect, useRef, useState } from "react";

import { type JsonRecord } from "../../api/transport";
import { AccessibilityCheckboxes } from "../../components/AccessibilityCheckboxes";
import { accessibilityLabel, accessibilityOf, type AccessibilityPreferences } from "../../utils/accessibilityPreferences";
import { FRIENDLY_ERROR_MESSAGES } from "../../utils/friendlyError";
import { useCoachOnboarding } from "./useCoachOnboarding";

// DEV NOTE: FULL-UI-04C coach onboarding profile/terms/completion view -
// ported field-for-field from public/app/coach_onboarding_ui.js's
// render()/renderHistory()/showMessage()/errorMessage().

function clean(value: unknown): string {
  return String(value ?? "").trim();
}

function humanise(value: unknown): string {
  const text = clean(value);
  return text ? text.replaceAll("_", " ").replace(/\b\w/gu, (letter) => letter.toUpperCase()) : "—";
}

function formatDate(value: unknown): string {
  const date = new Date(clean(value));
  return Number.isNaN(date.getTime()) ? clean(value) : date.toLocaleString();
}

const ERROR_MESSAGES: Record<string, string> = {
  account_session_missing: "Sign in to continue coach onboarding.",
  account_session_invalid: "The sign-in session has expired.",
  coach_onboarding_coach_required: "Coach onboarding is available to coach accounts only.",
  coach_onboarding_profile_invalid: "Check the coach profile details.",
  coach_onboarding_profile_required: "Save the coach profile before accepting coach terms.",
  coach_terms_invalid: "The current coach terms must be explicitly accepted.",
  coach_onboarding_accessibility_invalid: "Check the accessibility preferences.",
  coach_onboarding_terms_required: "Accept coach terms before saving accessibility preferences.",
  coach_onboarding_incomplete: "Complete every coach onboarding step.",
  account_email_already_registered: "That email address is already registered."
};

function errorMessage(error: { message: string; payload: unknown } | null): string {
  if (!error) return "";
  const code = clean((error.payload as JsonRecord | undefined)?.error ?? error.message);
  return ERROR_MESSAGES[code] ?? FRIENDLY_ERROR_MESSAGES[code] ?? humanise(code);
}

function ProfileForm({ profile, busy, onSave, formRef }: {
  profile: JsonRecord;
  busy: boolean;
  onSave: (input: JsonRecord) => void;
  formRef: React.RefObject<HTMLFormElement>;
}) {
  const [displayName, setDisplayName] = useState(clean(profile.display_name));
  const [email, setEmail] = useState(clean(profile.email));

  useEffect(() => {
    setDisplayName(clean(profile.display_name));
    setEmail(clean(profile.email));
  }, [profile.display_name, profile.email]);

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    onSave({ display_name: displayName, email });
  }

  return (
    <form className="panel form-panel" ref={formRef} onSubmit={handleSubmit}>
      <div>
        <p className="eyebrow">Coach profile</p>
        <h3>Identity details</h3>
        <p className="muted">This is your account profile. It doesn't affect how training is calculated.</p>
      </div>
      <label className="field">
        <span>Display name</span>
        <input autoComplete="name" required value={displayName} onChange={(event) => setDisplayName(event.target.value)} />
      </label>
      <label className="field">
        <span>Email</span>
        <input type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} />
      </label>
      <button className="button primary" type="submit" disabled={busy}>Save coach profile</button>
    </form>
  );
}

function TermsForm({ termsVersion, busy, onAccept }: { termsVersion: string; busy: boolean; onAccept: () => void }) {
  const [accepted, setAccepted] = useState(false);

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (accepted) onAccept();
  }

  return (
    <form className="panel form-panel" onSubmit={handleSubmit}>
      <div>
        <p className="eyebrow">Coach terms</p>
        <h3>Explicit acceptance</h3>
        <p className="muted">Current version: {termsVersion || "Unavailable"}</p>
      </div>
      <label className="checkbox-field">
        <input type="checkbox" required checked={accepted} onChange={(event) => setAccepted(event.target.checked)} />
        <span>I accept the current coach terms for product access.</span>
      </label>
      <button className="button primary" type="submit" disabled={busy}>Accept coach terms</button>
    </form>
  );
}

function AccessibilityForm({ preferences, busy, onSave }: {
  preferences: AccessibilityPreferences;
  busy: boolean;
  onSave: (input: JsonRecord) => void;
}) {
  const [value, setValue] = useState(preferences);

  useEffect(() => {
    setValue(preferences);
  }, [preferences]);

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    onSave({ accessibility_preferences: value });
  }

  return (
    <form className="panel form-panel" onSubmit={handleSubmit}>
      <div>
        <p className="eyebrow">Accessibility preferences</p>
        <h3>Presentation preferences</h3>
        <p className="muted">These control how the app looks and behaves for you. They don't affect how training is calculated.</p>
      </div>
      <AccessibilityCheckboxes value={value} onChange={setValue} />
      <button className="button primary" type="submit" disabled={busy}>Save accessibility preferences</button>
    </form>
  );
}

function ReviewPanel({ profile, termsAccepted, acceptedTermsVersion, accessibilityPreferences, busy, onComplete }: {
  profile: JsonRecord;
  termsAccepted: boolean;
  acceptedTermsVersion: string;
  accessibilityPreferences: AccessibilityPreferences;
  busy: boolean;
  onComplete: () => void;
}) {
  return (
    <section className="panel">
      <p className="eyebrow">Review</p>
      <h3>Confirm coach onboarding</h3>
      <div className="commercial-fact-grid">
        <div className="commercial-fact"><span>Profile</span><strong>{clean(profile.display_name) || "Not saved"}</strong></div>
        <div className="commercial-fact"><span>Coach terms</span><strong>{termsAccepted ? acceptedTermsVersion : "Not accepted"}</strong></div>
        <div className="commercial-fact"><span>Accessibility</span><strong>{accessibilityLabel(accessibilityPreferences)}</strong></div>
        <div className="commercial-fact"><span>Workspace</span><strong>Coach overview</strong></div>
      </div>
      <p className="muted">Completing this gives you access to the coach workspace. It doesn't change any training, eligibility or legal rules.</p>
      <button className="button primary" type="button" disabled={busy} onClick={onComplete}>Complete coach onboarding</button>
    </section>
  );
}

function openWorkspace() {
  window.location.hash = "#/coach/overview";
}

function openCommercial() {
  window.location.hash = "#/account";
}

function CompletedPanel({ onEditProfile }: { onEditProfile: () => void }) {
  return (
    <section className="panel">
      <p className="eyebrow">Completed onboarding</p>
      <h3>Coach workspace available</h3>
      <p className="muted">The completion state is stored on the server and survives refresh and restart.</p>
      <div className="commercial-actions">
        <button className="button primary" type="button" onClick={openWorkspace}>Open coach workspace</button>
        <button className="button secondary" type="button" onClick={onEditProfile}>Update coach profile</button>
        <button className="button secondary" type="button" onClick={openCommercial}>Open commercial account</button>
      </div>
    </section>
  );
}

function HistoryList({ items }: { items: JsonRecord[] }) {
  if (!items.length) {
    return (
      <div className="empty-state compact-empty">
        <p>No coach onboarding records.</p>
      </div>
    );
  }
  return (
    <>
      {items.map((record, index) => (
        <article key={index}>
          <strong>{humanise(record.event_type)}</strong>
          <p className="muted">{formatDate(record.occurred_at_iso8601)}</p>
        </article>
      ))}
    </>
  );
}

export function CoachOnboardingPanel() {
  const { loading, unavailableError, serverState, busy, validationError, refresh, saveProfile, acceptTerms, saveAccessibilityPreferences, complete } = useCoachOnboarding();
  const profileFormRef = useRef<HTMLFormElement>(null);
  const [confirmation, setConfirmation] = useState<string | null>(null);

  async function handleSaveProfile(input: JsonRecord) {
    setConfirmation(null);
    const result = await saveProfile(input);
    if (result) {
      setConfirmation(
        result.onboarding_status === "completed"
          ? "Coach profile updated. Your completed setup is still saved."
          : "Coach profile saved."
      );
    }
  }

  async function handleAcceptTerms() {
    setConfirmation(null);
    const result = await acceptTerms();
    if (result) setConfirmation("Coach terms accepted.");
  }

  async function handleSaveAccessibilityPreferences(input: JsonRecord) {
    setConfirmation(null);
    const result = await saveAccessibilityPreferences(input);
    if (result) setConfirmation("Accessibility preferences saved.");
  }

  async function handleComplete() {
    setConfirmation(null);
    const result = await complete();
    if (result) {
      setConfirmation("Coach onboarding completed. Opening the coach workspace.");
      window.location.hash = "#/coach/overview";
    }
  }

  if (loading && !serverState) {
    return <div className="panel">Loading coach onboarding state…</div>;
  }

  if (unavailableError) {
    return (
      <div className="panel">
        <p>{errorMessage(unavailableError)}</p>
        <button className="button primary" type="button" onClick={() => refresh()}>Retry</button>
      </div>
    );
  }

  if (!serverState) return null;

  const completed = serverState.onboarding_status === "completed";
  const stage = clean(serverState.current_stage) || "profile";
  const profile = serverState.profile && typeof serverState.profile === "object" ? (serverState.profile as JsonRecord) : {};
  const termsAccepted = serverState.terms_accepted === true;
  const accessibilityPreferences = accessibilityOf(serverState.accessibility_preferences);
  const history = Array.isArray(serverState.history) ? (serverState.history as JsonRecord[]) : [];

  function handleEditProfile() {
    profileFormRef.current?.scrollIntoView({ block: "start", behavior: "smooth" });
  }

  return (
    <>
      <span className={`badge ${completed ? "success" : "warning"}`}>{completed ? "Completed onboarding" : "Incomplete onboarding"}</span>
      <div className="panel coach-onboarding-progress">
        {completed ? "Coach profile saved · Coach terms accepted · Setup complete" : `Current step: ${humanise(stage)}`}
      </div>
      {validationError ? <p className="inline-result" data-tone="error">{errorMessage(validationError)}</p> : null}
      {!validationError && confirmation ? <p className="inline-result" data-tone="success">{confirmation}</p> : null}
      {(stage === "profile" || completed) ? (
        <ProfileForm profile={profile} busy={busy} onSave={handleSaveProfile} formRef={profileFormRef} />
      ) : null}
      {stage === "terms" ? (
        <TermsForm termsVersion={clean(serverState.current_terms_version)} busy={busy} onAccept={handleAcceptTerms} />
      ) : null}
      {(stage === "accessibility" || completed) ? (
        <AccessibilityForm preferences={accessibilityPreferences} busy={busy} onSave={handleSaveAccessibilityPreferences} />
      ) : null}
      {stage === "review" ? (
        <ReviewPanel
          profile={profile}
          termsAccepted={termsAccepted}
          acceptedTermsVersion={clean(serverState.accepted_terms_version)}
          accessibilityPreferences={accessibilityPreferences}
          busy={busy}
          onComplete={handleComplete}
        />
      ) : null}
      {completed ? <CompletedPanel onEditProfile={handleEditProfile} /> : null}
      <section className="panel">
        <p className="eyebrow">Onboarding history</p>
        <div className="record-list compact-record-list">
          <HistoryList items={history} />
        </div>
      </section>
    </>
  );
}
