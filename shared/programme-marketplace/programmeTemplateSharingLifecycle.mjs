// DEV NOTE: FULL-UI-67 programme template marketplace visibility lifecycle
// law. Sharing a template is the owning coach's own declared visibility
// choice - it makes that template's summary (name, activity, description)
// browsable by every other coach, never cloned or assigned across coaches
// in this slice. This module is limited to declared-fact normalisation,
// mirroring shared/coach-branding/coachBrandingLifecycle.mjs's own
// boundary.

export class ProgrammeTemplateSharingLifecycleError
  extends Error {
  constructor(code) {
    super(code);
    this.name =
      "ProgrammeTemplateSharingLifecycleError";
    this.code = code;
  }
}

function fail(code) {
  throw new ProgrammeTemplateSharingLifecycleError(
    code
  );
}

function isRecord(value) {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value)
  );
}

function exactKeys(
  record,
  allowed,
  code
) {
  const allowedKeys =
    new Set(allowed);

  for (const key of Object.keys(record)) {
    if (!allowedKeys.has(key)) {
      fail(code);
    }
  }
}

/**
 * FUNCTION NOTE:
 * Purpose: Validates and normalises one coach-declared template sharing preference.
 * Boundary: Exact-key allowlist only - a single boolean visibility flag.
 * Determinism: Returns the same normalised object for the same input every time.
 * Failure: Any unknown field or non-boolean value fails closed.
 */
export function normaliseProgrammeTemplateSharingPreference(
  input
) {
  if (!isRecord(input)) {
    fail(
      "programme_template_sharing_preference_invalid"
    );
  }

  exactKeys(
    input,
    [
      "shared_publicly"
    ],
    "programme_template_sharing_preference_unknown_field"
  );

  if (
    typeof input.shared_publicly !==
      "boolean"
  ) {
    fail(
      "programme_template_shared_publicly_invalid"
    );
  }

  return Object.freeze({
    shared_publicly:
      input.shared_publicly
  });
}
