import React from "react";

// DEV NOTE: hand-synced with ATHLETE_POSITIONS_BY_ACTIVITY
// (src/api/athlete_onboarding_service.ts) - every one of the 6 locked
// activities gets a position field, not just rugby_union: rugby_union gets
// a real position list, the other 5 (individual pursuits) each get a
// single generic "Athlete" option. A single <select>, unlike
// TrainingFocusCheckboxes.tsx's checkboxes - position is exactly one
// value, not zero-or-more.
export const POSITION_OPTIONS_BY_ACTIVITY: Record<string, readonly { id: string; label: string }[]> = {
  rugby_union: [
    { id: "loosehead_prop", label: "Loosehead prop" },
    { id: "tighthead_prop", label: "Tighthead prop" },
    { id: "hooker", label: "Hooker" },
    { id: "lock", label: "Lock" },
    { id: "flanker", label: "Flanker" },
    { id: "number8", label: "Number 8" },
    { id: "scrum_half", label: "Scrum-half" },
    { id: "fly_half", label: "Fly-half" },
    { id: "centre", label: "Centre" },
    { id: "wing", label: "Wing" },
    { id: "fullback", label: "Fullback" }
  ],
  powerlifting: [{ id: "athlete", label: "Athlete" }],
  general_strength: [{ id: "athlete", label: "Athlete" }],
  strongman: [{ id: "athlete", label: "Athlete" }],
  hyrox: [{ id: "athlete", label: "Athlete" }],
  crossfit: [{ id: "athlete", label: "Athlete" }],
  football_soccer: [{ id: "athlete", label: "Athlete" }],
  netball: [{ id: "athlete", label: "Athlete" }],
  basketball: [{ id: "athlete", label: "Athlete" }],
  rugby_sevens: [{ id: "athlete", label: "Athlete" }],
  field_hockey: [{ id: "athlete", label: "Athlete" }],
  ice_hockey: [{ id: "athlete", label: "Athlete" }],
  volleyball: [{ id: "athlete", label: "Athlete" }],
  cricket: [{ id: "athlete", label: "Athlete" }],
  american_football: [{ id: "athlete", label: "Athlete" }],
  athletics: [{ id: "athlete", label: "Athlete" }],
  swimming: [{ id: "athlete", label: "Athlete" }],
  olympic_weightlifting: [{ id: "athlete", label: "Athlete" }],
  cycling: [{ id: "athlete", label: "Athlete" }],
  rowing: [{ id: "athlete", label: "Athlete" }],
  kayaking: [{ id: "athlete", label: "Athlete" }],
  boxing: [{ id: "athlete", label: "Athlete" }],
  wrestling: [{ id: "athlete", label: "Athlete" }],
  judo: [{ id: "athlete", label: "Athlete" }],
  brazilian_jiu_jitsu: [{ id: "athlete", label: "Athlete" }],
  muay_thai: [{ id: "athlete", label: "Athlete" }],
  mma: [{ id: "athlete", label: "Athlete" }],
  tennis: [{ id: "athlete", label: "Athlete" }],
  triathlon: [{ id: "athlete", label: "Athlete" }],
  rugby_league: [{ id: "athlete", label: "Athlete" }],
  street_lifting: [{ id: "athlete", label: "Athlete" }]
};

export function PositionSelect({ activityId, value, onChange, label = "Position" }: {
  activityId: string;
  value: string;
  onChange: (next: string) => void;
  label?: string;
}) {
  const options = POSITION_OPTIONS_BY_ACTIVITY[activityId] ?? [];

  return (
    <label className="field">
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">Choose</option>
        {options.map((option) => (
          <option key={option.id} value={option.id}>{option.label}</option>
        ))}
      </select>
    </label>
  );
}
