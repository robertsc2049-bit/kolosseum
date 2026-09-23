import React from "react";

// DEV NOTE: hand-synced with ATHLETE_POSITIONS_BY_ACTIVITY
// (src/api/athlete_onboarding_service.ts) - every one of the 7 locked
// activities gets a position field, not just rugby_union: rugby_union gets
// a real position list, the other 6 (rugby_league included) each get a
// single generic "Athlete" option. rugby_league's real position list is a
// deliberately deferred follow-up slice, mirroring how rugby_union's own
// position list only arrived separately from its initial activation. A
// single <select>, unlike TrainingFocusCheckboxes.tsx's checkboxes -
// position is exactly one value, not zero-or-more.
export const POSITION_OPTIONS_BY_ACTIVITY: Record<string, readonly { id: string; label: string }[]> = {
  rugby_union: [
    { id: "prop", label: "Prop" },
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
  rugby_league: [{ id: "athlete", label: "Athlete" }]
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
