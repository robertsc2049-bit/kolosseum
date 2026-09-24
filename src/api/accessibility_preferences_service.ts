// DEV NOTE: shared accessibility-preferences validation, used by both
// athlete and coach onboarding. Extracted to avoid a second near-identical
// copy of this validator - a declared preference with no shared downstream
// effect was a real bug once already (PR #865, athlete_onboarding_service.ts's
// own history) and duplicating the same 4-field shape a second time for
// coaches would reintroduce exactly that risk class.

export const ACCESSIBILITY_PREFERENCE_KEYS = [
  "reduced_motion", "high_contrast", "larger_text", "screen_reader_optimised"
] as const;

export type AccessibilityPreferences = Readonly<
  Record<(typeof ACCESSIBILITY_PREFERENCE_KEYS)[number], boolean>
>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

// Throws via the caller's own `fail`, so each onboarding service keeps
// wrapping validation errors in its own error class (AthleteOnboardingError
// vs CoachOnboardingError) unchanged.
export function parseAccessibilityPreferences(
  value: unknown,
  fail: (field: string, message: string) => never
): AccessibilityPreferences {
  if (!isRecord(value)) fail("accessibility_preferences", "Choose your accessibility preferences.");
  for (const key of Object.keys(value)) {
    if (!(ACCESSIBILITY_PREFERENCE_KEYS as readonly string[]).includes(key)) {
      fail(`accessibility_preferences.${key}`, "This accessibility preference is not supported.");
    }
  }
  const result = {} as Record<string, boolean>;
  for (const key of ACCESSIBILITY_PREFERENCE_KEYS) {
    if (typeof value[key] !== "boolean") {
      fail(`accessibility_preferences.${key}`, "Select yes or no for this preference.");
    }
    result[key] = value[key] as boolean;
  }
  return Object.freeze(result) as AccessibilityPreferences;
}

// Non-throwing reader with all-false defaults, for rendering a preference
// value back out before anything has ever been saved.
export function accessibilityPreferencesOf(value: unknown): AccessibilityPreferences {
  const record = isRecord(value) ? value : {};
  const result = {} as Record<string, boolean>;
  for (const key of ACCESSIBILITY_PREFERENCE_KEYS) {
    result[key] = record[key] === true;
  }
  return Object.freeze(result) as AccessibilityPreferences;
}
