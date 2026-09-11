import React from "react";

// DEV NOTE: a genuinely persisted, zero-or-more athlete preference (see
// athlete_onboarding_service.ts's validateAthleteTrainingFocus), editable
// anytime alongside accessibility/instruction-density preferences via
// PATCH /account/onboarding/preferences. Deliberately unrelated to
// ActivityCategoryFilter.tsx (a pure, non-persisted sport-picker filter) -
// the ids/labels below are kept matching that component's CATEGORIES only
// for consistent language across the app, not because the two share any
// mechanism. Unlike AccessibilityCheckboxes.tsx's fixed-key boolean record,
// `value` here is a variable-length array of selected ids.
export const TRAINING_FOCUS_OPTIONS = [
  { id: "strength", label: "Strength" },
  { id: "body_composition", label: "Body composition" },
  { id: "conditioning", label: "Conditioning" },
  { id: "strength_and_conditioning", label: "Strength & conditioning" },
  { id: "power", label: "Power" },
  { id: "plyometric", label: "Plyometric" }
] as const;

export function TrainingFocusCheckboxes({ value, onChange }: {
  value: readonly string[];
  onChange: (next: string[]) => void;
}) {
  function toggle(id: string) {
    onChange(value.includes(id) ? value.filter((entry) => entry !== id) : [...value, id]);
  }

  return (
    <>
      {TRAINING_FOCUS_OPTIONS.map((option) => (
        <label className="onboarding-choice" key={option.id}>
          <input
            type="checkbox"
            checked={value.includes(option.id)}
            onChange={() => toggle(option.id)}
          />
          <span>{option.label}</span>
        </label>
      ))}
    </>
  );
}
