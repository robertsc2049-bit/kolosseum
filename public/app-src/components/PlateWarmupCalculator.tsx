import React, { useState } from "react";

import { type JsonRecord } from "../api/transport";
import {
  BAR_WEIGHT_BY_UNIT,
  computePlateBreakdown,
  computeWarmupRamp,
  type WeightUnit
} from "../utils/plateCalculator";

// DEV NOTE: mirrors exerciseDetails()'s intensity/resolved_load branching
// (utils/format.ts) so the pre-filled target matches what the athlete
// already sees in the prescription line above. This is a one-time initial
// value, not a live sync - the athlete can freely overwrite it.
function initialTargetFromExercise(exercise: JsonRecord | null): { value: string; unit: WeightUnit } {
  const intensity = exercise?.intensity && typeof exercise.intensity === "object" ? exercise.intensity as JsonRecord : null;

  if (intensity?.type === "percent_1rm") {
    const resolved = exercise?.resolved_load && typeof exercise.resolved_load === "object" ? exercise.resolved_load as JsonRecord : null;
    if (resolved && Number.isFinite(Number(resolved.value))) {
      return { value: String(Number(resolved.value)), unit: resolved.unit === "lb" ? "lb" : "kg" };
    }
  }
  else if (intensity?.type === "load" && Number.isFinite(Number(intensity.value))) {
    return { value: String(Number(intensity.value)), unit: intensity.unit === "lb" ? "lb" : "kg" };
  }

  return { value: "", unit: "kg" };
}

export function PlateWarmupCalculator({ exercise }: { exercise: JsonRecord | null }) {
  const [initial] = useState(() => initialTargetFromExercise(exercise));
  const [targetValue, setTargetValue] = useState(initial.value);
  const [unit, setUnit] = useState<WeightUnit>(initial.unit);
  const [barWeight, setBarWeight] = useState(String(BAR_WEIGHT_BY_UNIT[initial.unit]));

  const parsedTarget = Number(targetValue);
  const parsedBar = Number(barWeight);
  const hasValidTarget = targetValue.trim() !== "" && Number.isFinite(parsedTarget) && parsedTarget > 0;
  const hasValidBar = barWeight.trim() !== "" && Number.isFinite(parsedBar) && parsedBar >= 0;

  const breakdown = hasValidTarget && hasValidBar ? computePlateBreakdown(parsedTarget, parsedBar, unit) : null;
  const ramp = hasValidTarget && hasValidBar ? computeWarmupRamp(parsedTarget, parsedBar, unit) : [];

  return (
    <details className="exercise-howto plate-calc">
      <summary>Plate calculator &amp; warm-up ramp</summary>
      <div className="exercise-howto-body plate-calc-body">
        <div className="plate-calc-inputs">
          <label className="field">
            <span>Target weight</span>
            <input
              type="number"
              min={0}
              step="any"
              value={targetValue}
              placeholder="Enter weight"
              onChange={(event) => setTargetValue(event.target.value)}
            />
          </label>
          <label className="field">
            <span>Unit</span>
            <select
              value={unit}
              onChange={(event) => {
                const nextUnit: WeightUnit = event.target.value === "lb" ? "lb" : "kg";
                setUnit(nextUnit);
                setBarWeight(String(BAR_WEIGHT_BY_UNIT[nextUnit]));
              }}
            >
              <option value="kg">kg</option>
              <option value="lb">lb</option>
            </select>
          </label>
          <label className="field">
            <span>Bar weight</span>
            <input
              type="number"
              min={0}
              step="any"
              value={barWeight}
              onChange={(event) => setBarWeight(event.target.value)}
            />
          </label>
        </div>

        {!hasValidTarget || !hasValidBar ? (
          <p className="muted">Enter a target weight to see the plate breakdown and warm-up ramp.</p>
        ) : (
          <>
            <div className="plate-calc-breakdown">
              <p className="exercise-howto-heading">Plates per side</p>
              {breakdown && breakdown.perSide.length ? (
                <div className="plate-calc-plates">
                  {breakdown.perSide.map(({ plate, count }) => (
                    <span className="badge neutral" key={plate}>{`${count} × ${plate}${unit}`}</span>
                  ))}
                </div>
              ) : (
                <p className="muted">Bar only.</p>
              )}
              {breakdown && !breakdown.exact ? (
                <p className="muted">{`Closest achievable: ${breakdown.achievedWeight}${unit}`}</p>
              ) : null}
            </div>

            <div className="plate-calc-ramp">
              <p className="exercise-howto-heading">Warm-up ramp</p>
              {ramp.length ? (
                <ul className="exercise-howto-list">
                  {ramp.map((step) => (
                    <li key={step.label}>{`${step.label}: ${step.weight}${unit} × ${step.reps}`}</li>
                  ))}
                </ul>
              ) : (
                <p className="muted">No warm-up needed below the bar.</p>
              )}
            </div>
          </>
        )}
      </div>
    </details>
  );
}
