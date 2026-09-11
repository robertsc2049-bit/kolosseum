import React, { useEffect, useState } from "react";

// eslint-disable-next-line import/no-unresolved
import { V1_ACTIVITIES } from "../../../shared/v1-boundary/v1ActivityRegistry.mjs";

// DEV NOTE: pure client-side filter over V1_ACTIVITIES - narrows which
// sports the picker shows based on a training-category choice. This is
// deliberately NOT a resolution/mapping mechanism: nothing here is
// persisted or submitted, and the athlete/coach always ends by picking one
// real activity_id from the same set every server-side validator already
// checks against (validateActivity/validateAthleteActivityId). The
// category->sport grouping below is evidence-based (NSCA/ACSM rep-range
// continuum cross-referenced against this codebase's own real programme
// template data for each activity), not a guess at each sport's public
// reputation - see the FULL-UI-84-adjacent plan/PR for the full reasoning.
// A sport can belong to more than one category (e.g. CrossFit under both
// Power and Strength & conditioning) since this is an inclusive filter,
// not an exclusive resolve.
export const CATEGORIES = [
  { id: "strength", label: "Strength" },
  { id: "body_composition", label: "Body composition" },
  { id: "conditioning", label: "Conditioning" },
  { id: "strength_and_conditioning", label: "Strength & conditioning" },
  { id: "power", label: "Power" },
  { id: "plyometric", label: "Plyometric" }
] as const;

export const CATEGORY_ACTIVITY_IDS: Record<string, readonly string[]> = {
  strength: ["powerlifting", "strongman"],
  body_composition: ["general_strength"],
  conditioning: ["hyrox"],
  strength_and_conditioning: ["crossfit"],
  power: ["crossfit", "rugby_union"],
  plyometric: ["rugby_union", "hyrox"]
};

export function sportOptionsForCategory(categoryId: string) {
  if (!categoryId) return V1_ACTIVITIES;
  const ids = CATEGORY_ACTIVITY_IDS[categoryId];
  return ids && ids.length ? V1_ACTIVITIES.filter((activity) => ids.includes(activity.activity_id)) : V1_ACTIVITIES;
}

export function ActivityCategoryFilter({
  value,
  onChange,
  sportLabel,
  categoryLabel = "Training category",
  allowEmptySport = false
}: {
  value: string;
  onChange: (activityId: string) => void;
  sportLabel: string;
  categoryLabel?: string;
  allowEmptySport?: boolean;
}) {
  const [category, setCategory] = useState("");

  function isValid(categoryId: string, activityId: string): boolean {
    if (activityId === "" && allowEmptySport) return true;
    return sportOptionsForCategory(categoryId).some((activity) => activity.activity_id === activityId);
  }

  // Category changed by the user: narrow the value if it no longer fits.
  useEffect(() => {
    if (!isValid(category, value)) {
      const options = sportOptionsForCategory(category);
      onChange(allowEmptySport ? "" : (options[0]?.activity_id ?? value));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category]);

  // Value changed externally (e.g. a parent resets it after submit): fall
  // back to "All sports" rather than leaving a stale/invalid category filter.
  useEffect(() => {
    if (category !== "" && !isValid(category, value)) setCategory("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const sportOptions = sportOptionsForCategory(category);

  return (
    <>
      <label className="field">
        <span>{categoryLabel}</span>
        <select value={category} onChange={(event) => setCategory(event.target.value)}>
          <option value="">All sports</option>
          {CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
        </select>
      </label>
      <label className="field">
        <span>{sportLabel}</span>
        <select value={value} onChange={(event) => onChange(event.target.value)}>
          {allowEmptySport ? <option value="">Choose</option> : null}
          {sportOptions.map((activity) => (
            <option key={activity.activity_id} value={activity.activity_id}>{activity.display_label}</option>
          ))}
        </select>
      </label>
    </>
  );
}
