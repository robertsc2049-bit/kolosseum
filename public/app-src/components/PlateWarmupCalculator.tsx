import React, { useState } from "react";

import { type JsonRecord } from "../api/transport";
import {
  BAR_WEIGHT_BY_UNIT,
  COLLAR_WEIGHT_BY_UNIT,
  FRACTIONAL_PLATE_SET_BY_UNIT,
  computePlateBreakdown,
  computeWarmupRamp,
  type WeightUnit
} from "../utils/plateCalculator";
import { BarbellDiagram } from "./BarbellDiagram";

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

// DEV NOTE: the inputs/breakdown/ramp body, shared between this session-
// embedded <details> disclosure (pre-filled from the current exercise's
// prescription, below) and the standalone Barbell calculator tool
// (screens/tools/BarbellCalculatorPanel.tsx, no pre-fill, its own
// dedicated view/nav item available to both roles) - extracted once the
// standalone tool needed the identical rendering.
export function PlateWarmupCalculatorFields({ initialTarget, initialUnit }: { initialTarget: string; initialUnit: WeightUnit }) {
  const [targetValue, setTargetValue] = useState(initialTarget);
  const [unit, setUnit] = useState<WeightUnit>(initialUnit);
  const [barWeight, setBarWeight] = useState(String(BAR_WEIGHT_BY_UNIT[initialUnit]));
  const [useCollars, setUseCollars] = useState(false);
  const [useFractionalPlates, setUseFractionalPlates] = useState(false);

  const parsedTarget = Number(targetValue);
  const parsedBar = Number(barWeight);
  const hasValidTarget = targetValue.trim() !== "" && Number.isFinite(parsedTarget) && parsedTarget > 0;
  const hasValidBar = barWeight.trim() !== "" && Number.isFinite(parsedBar) && parsedBar >= 0;

  const breakdown = hasValidTarget && hasValidBar
    ? computePlateBreakdown(parsedTarget, parsedBar, unit, { useCollars, useFractionalPlates })
    : null;
  // DEV NOTE: collars stay on through warm-up (removing/reattaching them
  // between every set isn't realistic), so the ramp treats bar+collars as
  // its own effective floor rather than the bar alone.
  const rampBarWeight = parsedBar + (useCollars ? COLLAR_WEIGHT_BY_UNIT[unit] : 0);
  const ramp = hasValidTarget && hasValidBar ? computeWarmupRamp(parsedTarget, rampBarWeight, unit, useFractionalPlates) : [];

  return (
    <>
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

      <div className="plate-calc-options">
        <label className="checkbox-field">
          <input type="checkbox" checked={useCollars} onChange={(event) => setUseCollars(event.target.checked)} />
          <span>{`Weighted collars (${COLLAR_WEIGHT_BY_UNIT[unit] / 2}${unit} each / ${COLLAR_WEIGHT_BY_UNIT[unit]}${unit} pair)`}</span>
        </label>
        <label className="checkbox-field">
          <input type="checkbox" checked={useFractionalPlates} onChange={(event) => setUseFractionalPlates(event.target.checked)} />
          <span>{`Fractional plates (${FRACTIONAL_PLATE_SET_BY_UNIT[unit].join("/")}${unit})`}</span>
        </label>
      </div>

      {!hasValidTarget || !hasValidBar ? (
        <p className="muted">Enter a target weight to see the plate breakdown and warm-up ramp.</p>
      ) : (
        <>
          <div className="plate-calc-breakdown">
            {breakdown ? (
              <BarbellDiagram perSide={breakdown.perSide} barWeight={breakdown.barWeight} collarWeight={breakdown.collarWeight} unit={unit} />
            ) : null}
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
            {breakdown && breakdown.collarWeight > 0 ? (
              <p className="muted">{`+ ${breakdown.collarWeight}${unit} weighted collars`}</p>
            ) : null}
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
    </>
  );
}

export function PlateWarmupCalculator({ exercise }: { exercise: JsonRecord | null }) {
  const [initial] = useState(() => initialTargetFromExercise(exercise));

  return (
    <details className="exercise-howto plate-calc">
      <summary>Plate calculator &amp; warm-up ramp</summary>
      <div className="exercise-howto-body plate-calc-body">
        <PlateWarmupCalculatorFields initialTarget={initial.value} initialUnit={initial.unit} />
      </div>
    </details>
  );
}
