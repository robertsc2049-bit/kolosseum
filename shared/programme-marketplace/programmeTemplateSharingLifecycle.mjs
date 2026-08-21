// DEV NOTE: FULL-UI-67/68 programme template marketplace visibility and
// release lifecycle law. Sharing a template is the owning coach's own
// declared visibility choice - it makes that template's summary (name,
// activity, description) browsable by every other coach. A price label
// and payment-methods note are optional, plain display text the coach
// supplies for their own off-platform arrangement with a buyer - this
// module never parses, validates as currency, or acts on either value,
// and no payment of any kind is processed, held, or transmitted by this
// application. This module is limited to declared-fact normalisation,
// mirroring shared/coach-branding/coachBrandingLifecycle.mjs's own
// boundary.

const MAX_PRICE_LABEL_LENGTH = 40;
const MAX_PAYMENT_METHODS_NOTE_LENGTH = 200;

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

function cleanString(value) {
  return typeof value === "string"
    ? value.trim()
    : "";
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
 * Boundary: Exact-key allowlist only - a visibility flag plus an optional price
 * label and an optional payment-methods note, both plain display text.
 * Determinism: Returns the same normalised object for the same input every time.
 * Failure: Any unknown field, non-boolean flag, or over-length text fails closed.
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
      "shared_publicly",
      "price_label",
      "payment_methods_note"
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

  const priceLabel =
    input.price_label === undefined ||
    input.price_label === null ||
    input.price_label === ""
      ? null
      : cleanString(input.price_label);

  if (
    priceLabel !== null &&
    priceLabel.length > MAX_PRICE_LABEL_LENGTH
  ) {
    fail(
      "programme_template_price_label_too_long"
    );
  }

  const paymentMethodsNote =
    input.payment_methods_note === undefined ||
    input.payment_methods_note === null ||
    input.payment_methods_note === ""
      ? null
      : cleanString(input.payment_methods_note);

  if (
    paymentMethodsNote !== null &&
    paymentMethodsNote.length > MAX_PAYMENT_METHODS_NOTE_LENGTH
  ) {
    fail(
      "programme_template_payment_methods_note_too_long"
    );
  }

  return Object.freeze({
    shared_publicly:
      input.shared_publicly,
    price_label: priceLabel,
    payment_methods_note: paymentMethodsNote
  });
}
