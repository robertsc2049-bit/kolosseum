import React from "react";

import { type AccessibilityPreferences } from "../utils/accessibilityPreferences";

// DEV NOTE: shared between athlete and coach onboarding wizards - was
// originally defined inside AthleteOnboardingPanel.tsx, moved here once
// coach onboarding needed the identical 4-checkbox form.
export function AccessibilityCheckboxes({ value, onChange }: {
  value: AccessibilityPreferences;
  onChange: (next: AccessibilityPreferences) => void;
}) {
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
