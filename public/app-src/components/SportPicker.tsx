import React from "react";

// eslint-disable-next-line import/no-unresolved
import { V1_ACTIVITIES } from "../../../shared/v1-boundary/v1ActivityRegistry.mjs";

// Choosing a sport on a phone: every sport as a tappable chip, grouped by
// family, with the choice spelled out underneath. A long native dropdown let
// a wheel picker land on its first sport (Powerlifting) by a slight scroll,
// and nothing showed it had happened.
export const SPORT_FAMILIES: Array<[string, string[]]> = [
  ["Strength sports", ["powerlifting", "olympic_weightlifting", "strongman", "street_lifting", "general_strength"]],
  ["Hybrid fitness", ["hyrox", "crossfit"]],
  ["Team sports", ["rugby_union", "rugby_league", "rugby_sevens", "american_football", "football_soccer", "field_hockey", "ice_hockey", "netball", "basketball", "volleyball", "cricket"]],
  ["Racket sports", ["tennis"]],
  ["Endurance", ["athletics", "swimming", "cycling", "rowing", "kayaking", "triathlon"]],
  ["Combat sports", ["boxing", "muay_thai", "mma", "wrestling", "judo", "brazilian_jiu_jitsu"]]
];

type Activity = { activity_id: string; display_label: string };

export function SportPicker({ value, onChange, label, allowNone = false, name = "sport" }: {
  value: string;
  onChange: (activityId: string) => void;
  label: string;
  allowNone?: boolean;
  name?: string;
}) {
  const activities = V1_ACTIVITIES as readonly Activity[];
  const byId = new Map(activities.map((a) => [a.activity_id, a]));
  const listed = new Set(SPORT_FAMILIES.flatMap(([, ids]) => ids));
  const all: Array<[string, string[]]> = [...SPORT_FAMILIES, ["Other", activities.map((a) => a.activity_id).filter((id) => !listed.has(id))]];
  const families: Array<[string, string[]]> = all
    .map(([title, ids]) => [title, ids.filter((id) => byId.has(id))] as [string, string[]])
    .filter(([, ids]) => ids.length > 0);
  const chosen = byId.get(value)?.display_label;

  return (
    <div className="field sport-picker" role="group" aria-label={label}>
      <span>{label}</span>
      <div className="choice-section">
        {allowNone ? (
          <div className="choice-chips">
            <label className="choice-chip">
              <input type="radio" name={name} checked={value === ""} onChange={() => onChange("")} />
              <span>Not yet</span>
            </label>
          </div>
        ) : null}
        {families.map(([title, ids]) => (
          <fieldset key={title} className="choice-chips">
            <legend>{title}</legend>
            {ids.map((id) => (
              <label key={id} className="choice-chip">
                <input type="radio" name={name} value={id} checked={value === id} onChange={() => onChange(id)} />
                <span>{byId.get(id)?.display_label ?? id}</span>
              </label>
            ))}
          </fieldset>
        ))}
      </div>
      <p className="sport-chosen" aria-live="polite">{chosen ? `Your sport: ${chosen}` : "No sport chosen yet"}</p>
    </div>
  );
}
