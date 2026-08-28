import React, { useEffect, useState } from "react";

import { type JsonRecord } from "../../api/transport";
import {
  accessibilityLabel,
  accessibilityOf,
  type AccessibilityPreferences,
  STAGE_TITLES,
  STAGES,
  useAthleteOnboarding
} from "./useAthleteOnboarding";

// DEV NOTE: FULL-UI-03C athlete onboarding wizard/completed-declaration
// view - ported field-for-field from public/app/athlete_onboarding_ui.js's
// renderDraft()/stageHtml()/renderComplete()/preferenceEditor()/
// historyHtml()/errors()/status()/progress()/facts(). useAthleteOnboarding()
// is called exactly once, at the top level - every sub-component below
// receives its slice of state as props rather than calling the hook again,
// which would otherwise create an independent, out-of-sync fetch/state
// instance per component.

type OnboardingApi = ReturnType<typeof useAthleteOnboarding>;

function formatDate(value: unknown): string {
  if (!value) return "not recorded";
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString("en-GB");
}

function label(value: unknown): string {
  return String(value ?? "not selected").replaceAll("_", " ");
}

function StatusBanner({ state, hasError, forceKind }: { state: JsonRecord | null; hasError: boolean; forceKind?: string }) {
  const complete = state?.onboarding_status === "completed";
  const actual = forceKind || (hasError
    ? "validation_failure"
    : complete
      ? "completed"
      : state?.saved_draft_state
        ? "saved_draft"
        : "incomplete");

  const heading: Record<string, string> = {
    incomplete: "Incomplete onboarding",
    saved_draft: "Saved draft state",
    validation_failure: "Validation failure",
    completed: "Completed onboarding",
    unavailable: "Unavailable service state"
  };

  const detail = actual === "saved_draft" ? `Saved ${formatDate(state?.saved_draft_at_iso8601)}.`
    : actual === "completed" ? "The current effective declaration is persisted on the server."
    : actual === "validation_failure" ? "Correct the declaration fields before continuing."
    : actual === "unavailable" ? "No completion state has been assumed."
    : "Complete each stage and confirm the review.";

  return (
    <div className="onboarding-status" data-state={actual}>
      <strong>{heading[actual]}</strong>
      <span>{detail}</span>
    </div>
  );
}

function ProgressBar({ stage }: { stage: string }) {
  const index = Math.max(0, STAGES.indexOf(stage as typeof STAGES[number]));
  return (
    <div className="onboarding-progress">
      {STAGES.map((s, i) => <span className={i <= index ? "done" : ""} key={s} />)}
    </div>
  );
}

function DeclarationFacts({ fields }: { fields: JsonRecord }) {
  return (
    <div className="declaration-grid">
      <div className="declaration-fact"><span>Activity</span><strong>{label(fields.activity_id)}</strong></div>
      <div className="declaration-fact"><span>Execution scope</span><strong>{label(fields.execution_scope)}</strong></div>
      <div className="declaration-fact"><span>Product acknowledgement</span><strong>{fields.product_acknowledged ? "Accepted" : "Not accepted"}</strong></div>
      <div className="declaration-fact"><span>Jurisdiction</span><strong>{label(fields.jurisdiction_code)}</strong></div>
      <div className="declaration-fact"><span>Accessibility</span><strong>{accessibilityLabel(fields.accessibility_preferences)}</strong></div>
      <div className="declaration-fact"><span>Instruction density</span><strong>{label(fields.instruction_density)}</strong></div>
    </div>
  );
}

function ValidationErrors({ error }: { error: { message: string; payload: unknown } }) {
  const fieldErrors = (error.payload as JsonRecord | undefined)?.field_errors as JsonRecord | undefined;
  const entries = Object.entries(fieldErrors ?? {});
  return (
    <div className="onboarding-errors">
      <strong>Validation failure</strong>
      {entries.length ? (
        <ul>
          {entries.map(([key, value]) => <li key={key}><strong>{key}:</strong> {String(value)}</li>)}
        </ul>
      ) : (
        <p>{error.message}</p>
      )}
    </div>
  );
}

function AccessibilityCheckboxes({ value, onChange }: { value: AccessibilityPreferences; onChange: (next: AccessibilityPreferences) => void }) {
  const rows: [keyof AccessibilityPreferences, string][] = [
    ["reduced_motion", "Reduce motion"],
    ["high_contrast", "Higher contrast"],
    ["larger_text", "Larger text"],
    ["screen_reader_optimised", "Screen-reader optimised"]
  ];
  return (
    <>
      {rows.map(([key, text]) => (
        <label className="onboarding-choice" key={key}>
          <input
            type="checkbox"
            checked={value[key]}
            onChange={(event) => onChange({ ...value, [key]: event.target.checked })}
          />
          <span>{text}</span>
        </label>
      ))}
    </>
  );
}

function StageFields({ stage, draft, onChange }: { stage: string; draft: JsonRecord; onChange: (fields: JsonRecord) => void }) {
  if (stage === "activity") {
    return (
      <>
        <p>Declare the activity used by this account. This is not an assessment.</p>
        <label className="field">
          <span>Activity</span>
          <select value={String(draft.activity_id ?? "")} onChange={(event) => onChange({ ...draft, activity_id: event.target.value })}>
            <option value="">Choose</option>
            <option value="powerlifting">Powerlifting</option>
            <option value="general_strength">General strength</option>
            <option value="rugby_union">Rugby union</option>
          </select>
        </label>
      </>
    );
  }

  if (stage === "execution_scope") {
    return (
      <>
        <p>Declare where session instructions originate.</p>
        <label className="onboarding-choice">
          <input type="radio" name="scope" value="individual" checked={draft.execution_scope === "individual"} onChange={() => onChange({ ...draft, execution_scope: "individual" })} />
          <span><strong>Individual</strong><small>Work in my athlete workspace.</small></span>
        </label>
        <label className="onboarding-choice">
          <input type="radio" name="scope" value="coach_managed" checked={draft.execution_scope === "coach_managed"} onChange={() => onChange({ ...draft, execution_scope: "coach_managed" })} />
          <span><strong>Coach managed</strong><small>Work assigned through an accepted coach relationship.</small></span>
        </label>
      </>
    );
  }

  if (stage === "product_acknowledgement") {
    return (
      <>
        <p>This is a controlled-beta product. Features and availability may change. Records are not medical, safety or readiness decisions.</p>
        <label className="onboarding-choice">
          <input type="checkbox" checked={draft.product_acknowledged === true} onChange={(event) => onChange({ ...draft, product_acknowledged: event.target.checked })} />
          <span><strong>I acknowledge the controlled-beta product boundary.</strong><small>september_beta_2026</small></span>
        </label>
      </>
    );
  }

  if (stage === "jurisdiction") {
    return (
      <>
        <p>Select the jurisdiction yourself; it is not inferred from location.</p>
        <label className="field">
          <span>Jurisdiction</span>
          <select value={String(draft.jurisdiction_code ?? "")} onChange={(event) => onChange({ ...draft, jurisdiction_code: event.target.value })}>
            <option value="">Choose</option>
            <option value="england_wales">England and Wales</option>
            <option value="scotland">Scotland</option>
            <option value="northern_ireland">Northern Ireland</option>
            <option value="other">Other</option>
          </select>
        </label>
        <label className="onboarding-choice">
          <input type="checkbox" checked={draft.jurisdiction_acknowledged === true} onChange={(event) => onChange({ ...draft, jurisdiction_acknowledged: event.target.checked })} />
          <span>I acknowledge the selected jurisdiction.</span>
        </label>
      </>
    );
  }

  if (stage === "accessibility") {
    return (
      <>
        <p>Presentation preferences remain editable after confirmation.</p>
        <AccessibilityCheckboxes
          value={accessibilityOf(draft.accessibility_preferences)}
          onChange={(next) => onChange({ ...draft, accessibility_preferences: next })}
        />
      </>
    );
  }

  if (stage === "instruction_density") {
    const options: [string, string, string][] = [
      ["minimal", "Concise", "Essential instructions only."],
      ["standard", "Standard", "Normal context and instructions."],
      ["detailed", "Detailed", "More explanation and context."]
    ];
    return (
      <>
        <p>This presentation preference remains editable.</p>
        {options.map(([value, title, detail]) => (
          <label className="onboarding-choice" key={value}>
            <input type="radio" name="density" value={value} checked={draft.instruction_density === value} onChange={() => onChange({ ...draft, instruction_density: value })} />
            <span><strong>{title}</strong><small>{detail}</small></span>
          </label>
        ))}
      </>
    );
  }

  return (
    <>
      <DeclarationFacts fields={draft} />
      <p className="onboarding-boundary">Confirmation does not infer ability, safety, readiness, suitability, risk or medical clearance.</p>
    </>
  );
}

function DraftView({ api }: { api: OnboardingApi }) {
  const { serverState, draft, busy, validationError, currentStage, move, confirm } = api;
  const [localDraft, setLocalDraft] = useState<JsonRecord>(draft);

  useEffect(() => {
    setLocalDraft(draft);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStage, draft]);

  const index = Math.max(0, STAGES.indexOf(currentStage));

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (currentStage === "review") confirm();
    else move(1, localDraft);
  }

  return (
    <>
      <StatusBanner state={serverState} hasError={Boolean(validationError)} />
      <ProgressBar stage={currentStage} />
      {validationError ? <ValidationErrors error={validationError} /> : null}
      <form className="onboarding-card" data-onboarding-stage={currentStage} onSubmit={handleSubmit}>
        <p className="eyebrow">Stage {index + 1} of {STAGES.length}</p>
        <h3>{STAGE_TITLES[currentStage]}</h3>
        <StageFields stage={currentStage} draft={localDraft} onChange={setLocalDraft} />
        <div className="onboarding-actions">
          <button className="button secondary" type="button" disabled={index === 0 || busy} onClick={() => move(-1, localDraft)}>Back</button>
          <button className="button primary" type="submit" disabled={busy}>
            {currentStage === "review" ? "Confirm declaration" : "Save and continue"}
          </button>
        </div>
      </form>
    </>
  );
}

function PreferenceEditor({ api, fields }: { api: OnboardingApi; fields: JsonRecord }) {
  const { busy, cancelEditing, savePreferences } = api;
  const [accessibility, setAccessibility] = useState<AccessibilityPreferences>(() => accessibilityOf(fields.accessibility_preferences));
  const [density, setDensity] = useState(() => String(fields.instruction_density ?? "standard"));

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    savePreferences({ accessibility_preferences: accessibility, instruction_density: density });
  }

  return (
    <form className="onboarding-card" onSubmit={handleSubmit}>
      <h3>Edit lawful preferences</h3>
      <p>Only accessibility and instruction-density preferences can be changed after confirmation. Saving creates a new declaration and preserves the old one.</p>
      <AccessibilityCheckboxes value={accessibility} onChange={setAccessibility} />
      <label className="field">
        <span>Instruction density</span>
        <select value={density} onChange={(event) => setDensity(event.target.value)}>
          <option value="minimal">Concise</option>
          <option value="standard">Standard</option>
          <option value="detailed">Detailed</option>
        </select>
      </label>
      <div className="onboarding-actions">
        <button className="button secondary" type="button" onClick={cancelEditing}>Cancel</button>
        <button className="button primary" type="submit" disabled={busy}>Save new declaration</button>
      </div>
    </form>
  );
}

function HistoricalDeclarations({ items }: { items: JsonRecord[] }) {
  if (!items.length) return <p className="muted">No superseded declarations are recorded.</p>;
  return (
    <div className="declaration-history">
      {items.map((item) => (
        <article className="onboarding-card" data-declaration-status="superseded" key={String(item.declaration_id)}>
          <strong>Superseded declaration</strong>
          <span> · {formatDate(item.effective_at_iso8601)}</span>
          <DeclarationFacts fields={(item.fields as JsonRecord) ?? {}} />
          <small>Immutable declaration {String(item.declaration_id)}</small>
        </article>
      ))}
    </div>
  );
}

function openWorkspace() {
  sessionStorage.removeItem("kolosseum.athlete_onboarding.reload_required");
  location.assign("/app/#/athlete/today");
}

function CompletedView({ api }: { api: OnboardingApi }) {
  const { serverState, editing, validationError, startEditing } = api;
  const current = serverState?.current_effective_declaration as JsonRecord | undefined;
  if (!current) return null;
  const fields = (current.fields as JsonRecord) ?? {};
  const history = Array.isArray(serverState?.historical_declarations) ? (serverState!.historical_declarations as JsonRecord[]) : [];

  return (
    <>
      <StatusBanner state={serverState} hasError={Boolean(validationError)} />
      {validationError ? <ValidationErrors error={validationError} /> : null}
      <article className="onboarding-card" data-declaration-status="current">
        <p className="eyebrow">Current declaration</p>
        <h3>Current effective declaration</h3>
        <p>Version {String(current.declaration_version)} · effective {formatDate(current.effective_at_iso8601)}</p>
        <DeclarationFacts fields={fields} />
        <p className="onboarding-boundary">This factual declaration does not indicate ability, safety, readiness, suitability, risk or medical clearance.</p>
        <div className="onboarding-actions">
          <button className="button primary" type="button" onClick={openWorkspace}>Open training workspace</button>
          <button className="button secondary" type="button" onClick={startEditing}>Edit accessibility and instruction density</button>
        </div>
      </article>
      {editing ? <PreferenceEditor api={api} fields={fields} /> : null}
      <article className="onboarding-card">
        <h3>Historical declarations</h3>
        <p>Superseded declarations remain immutable.</p>
        <HistoricalDeclarations items={history} />
      </article>
    </>
  );
}

export function AthleteOnboardingPanel() {
  const api = useAthleteOnboarding();
  const { loading, unavailableError, serverState, refresh } = api;

  if (loading && !serverState) {
    return (
      <div className="onboarding-shell" aria-live="polite">
        <article className="onboarding-card">Loading server onboarding state…</article>
      </div>
    );
  }

  if (unavailableError) {
    return (
      <div className="onboarding-shell" aria-live="polite">
        <StatusBanner state={null} hasError={false} forceKind="unavailable" />
        <article className="onboarding-card">
          <h3>Onboarding is unavailable</h3>
          <p>No browser-only completion has been created.</p>
          <p>{unavailableError}</p>
          <button className="button primary" type="button" onClick={() => refresh()}>Retry</button>
        </article>
      </div>
    );
  }

  const complete = serverState?.onboarding_status === "completed";

  return (
    <div className="onboarding-shell" aria-live="polite">
      {complete ? <CompletedView api={api} /> : <DraftView api={api} />}
    </div>
  );
}
