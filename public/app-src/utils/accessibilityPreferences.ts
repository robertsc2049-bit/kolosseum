import { type JsonRecord } from "../api/transport";

// DEV NOTE: shared between athlete and coach onboarding - both declare the
// exact same 4 accessibility preferences and both need them applied as
// data-a11y-* attributes on <html> to have any real effect (see
// public/app/styles.css's data-a11y-* rules). A declared-but-never-applied
// preference was a real bug once already (PR #865); extracted here so
// adding a second onboarding surface (coach) can't reintroduce a second
// copy of that same risk. useAthleteOnboarding.ts keeps its own same-named
// applyAccessibilityPreferences() wrapper that delegates to this module
// (useCoachOnboarding.ts calls this export directly - it has no equivalent
// source-text regression test to satisfy), so that "a downstream reader
// exists in this specific file" keeps passing for the athlete side.
export type AccessibilityPreferences = {
  reduced_motion: boolean;
  high_contrast: boolean;
  larger_text: boolean;
  screen_reader_optimised: boolean;
};

export function accessibilityOf(value: unknown): AccessibilityPreferences {
  const record = (value ?? {}) as JsonRecord;
  return {
    reduced_motion: record.reduced_motion === true,
    high_contrast: record.high_contrast === true,
    larger_text: record.larger_text === true,
    screen_reader_optimised: record.screen_reader_optimised === true
  };
}

export function accessibilityLabel(value: unknown): string {
  const chosen = Object.entries(accessibilityOf(value))
    .filter(([, enabled]) => enabled)
    .map(([key]) => key.replaceAll("_", " "));
  return chosen.length ? chosen.join(", ") : "No additional presentation preferences";
}

export function applyAccessibilityPreferences(value: unknown): void {
  const a = accessibilityOf(value);
  const root = document.documentElement;
  root.dataset.a11yReducedMotion = String(a.reduced_motion);
  root.dataset.a11yHighContrast = String(a.high_contrast);
  root.dataset.a11yLargerText = String(a.larger_text);
  root.dataset.a11yScreenReaderOptimised = String(a.screen_reader_optimised);
}
