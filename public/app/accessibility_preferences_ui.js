// DEV NOTE: shared between athlete_onboarding_ui.js and coach_onboarding_ui.js
// - both declare the exact same 4 accessibility preferences and both need
// them applied as data-a11y-* attributes on <html> to have any real effect
// (see public/app/styles.css's data-a11y-* rules). A declared-but-never-
// applied preference was a real bug once already (PR #865); extracted here
// so coach onboarding gaining the same preferences couldn't reintroduce a
// second copy of that same risk. Each caller keeps its own same-named
// applyAccessibilityPreferences() wrapper that delegates to this module,
// rather than importing this function under its own name directly, so
// source-text regression tests that check for "a downstream reader exists
// in this specific file" keep passing.

function accessibility(value = {}) {
  return {
    reduced_motion: value.reduced_motion === true,
    high_contrast: value.high_contrast === true,
    larger_text: value.larger_text === true,
    screen_reader_optimised: value.screen_reader_optimised === true
  };
}

export function applyAccessibilityPreferences(value) {
  if (typeof document === "undefined") return;
  const a = accessibility(value);
  const root = document.documentElement;
  root.dataset.a11yReducedMotion = String(a.reduced_motion);
  root.dataset.a11yHighContrast = String(a.high_contrast);
  root.dataset.a11yLargerText = String(a.larger_text);
  root.dataset.a11yScreenReaderOptimised = String(a.screen_reader_optimised);
}
