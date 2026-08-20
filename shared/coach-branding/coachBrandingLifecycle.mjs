// DEV NOTE: FULL-UI-65 coach branding preference lifecycle law. A brand
// preference is a coach's own declared presentation choice - an accent
// colour and an optional short tagline shown on their own athletes' view
// of them - a plain display setting, structurally identical to a display
// name. This module is limited to declared-fact normalisation, mirroring
// shared/weekly-checkins/weeklyCheckinLifecycle.mjs's own boundary.

const MAX_TAGLINE_LENGTH = 120;

export class CoachBrandingLifecycleError
  extends Error {
  constructor(code) {
    super(code);
    this.name =
      "CoachBrandingLifecycleError";
    this.code = code;
  }
}

function fail(code) {
  throw new CoachBrandingLifecycleError(
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
 * Purpose: Validates and normalises one coach-declared brand preference.
 * Boundary: Exact-key allowlist only - a hex accent colour and an
 * optional short tagline, structurally the same as a display name.
 * Determinism: Returns the same normalised object for the same input every time.
 * Failure: Any unknown field, malformed colour, or over-length tagline fails closed.
 */
export function normaliseCoachBrandPreference(
  input
) {
  if (!isRecord(input)) {
    fail(
      "coach_brand_preference_invalid"
    );
  }

  exactKeys(
    input,
    [
      "brand_color",
      "brand_tagline"
    ],
    "coach_brand_preference_unknown_field"
  );

  const brandColor =
    cleanString(input.brand_color).toLowerCase();

  if (
    !/^#[0-9a-f]{6}$/u.test(
      brandColor
    )
  ) {
    fail(
      "coach_brand_color_invalid"
    );
  }

  const brandTagline =
    input.brand_tagline === undefined ||
    input.brand_tagline === null ||
    input.brand_tagline === ""
      ? null
      : cleanString(input.brand_tagline);

  if (
    brandTagline !== null &&
    brandTagline.length > MAX_TAGLINE_LENGTH
  ) {
    fail(
      "coach_brand_tagline_too_long"
    );
  }

  return Object.freeze({
    brand_color: brandColor,
    brand_tagline: brandTagline
  });
}
