import React from "react";

import { type GroupVolume, HIGH_WEEKLY_SETS, MAJOR_MUSCLE_GROUPS, MUSCLE_GROUPS, type MuscleOption, type VolumeItem, formatSets, weeklyMuscleVolume } from "../utils/muscleGroups";

// Hard sets per muscle group for a week, so a coach can see at a glance
// whether it's balanced: what each group gets, what gets a lot, and which
// major groups get no direct work.
export function MuscleVolumeList({ volume, title, note, open = false }: {
  volume: readonly GroupVolume[];
  title: string;
  note: string;
  open?: boolean;
}) {
  if (!volume.length) return null;
  const top = [...volume].sort((a, b) => b.sets - a.sets).slice(0, 3).map((v) => `${v.label} ${formatSets(v.sets)}`).join(" · ");
  const trained = new Set(volume.map((v) => v.group));
  const untrained = MUSCLE_GROUPS.filter((g) => MAJOR_MUSCLE_GROUPS.includes(g.id) && !trained.has(g.id)).map((g) => g.label);
  return (
    <details className="weekly-muscle-volume" open={open}>
      <summary>{`${title}: ${top}`}</summary>
      <p className="muted small">{note}</p>
      <ul className="weekly-muscle-volume-list">
        {volume.map((v) => (
          <li key={v.group} data-high={v.sets > HIGH_WEEKLY_SETS ? "true" : undefined}>
            <span>{v.label}</span>
            <strong>{formatSets(v.sets)}</strong>
            {v.sets > HIGH_WEEKLY_SETS ? <small className="field-warning">Very high - check recovery</small> : null}
          </li>
        ))}
      </ul>
      {untrained.length ? <p className="muted small">{`No direct work: ${untrained.join(", ")}.`}</p> : null}
    </details>
  );
}

// A planned week in the coach builder.
export function WeeklyMuscleVolume({ items, exercises }: {
  items: readonly VolumeItem[];
  exercises: ReadonlyMap<string, MuscleOption>;
}) {
  return (
    <MuscleVolumeList
      volume={weeklyMuscleVolume(items, exercises)}
      title="Sets per muscle group"
      note="Hard sets planned this week; a secondary muscle counts as half a set. Warm-ups, cool-downs and conditioning aren't counted."
    />
  );
}

// What the athlete actually logged over the last 7 days (progress insights).
export function LoggedMuscleVolume({ weekly }: { weekly: unknown }) {
  const groups = weekly && typeof weekly === "object" && Array.isArray((weekly as { groups?: unknown }).groups)
    ? ((weekly as { groups: unknown[] }).groups as GroupVolume[]).filter((g) => g && typeof g.sets === "number")
    : [];
  if (!groups.length) return null;
  return (
    <article className="record-card" data-testid="logged-muscle-volume">
      <MuscleVolumeList
        volume={groups}
        title="Sets per muscle group, last 7 days"
        note="Hard sets logged in the last 7 days; a secondary muscle counts as half a set. Conditioning isn't counted."
        open
      />
    </article>
  );
}
