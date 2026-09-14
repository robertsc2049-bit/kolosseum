import React, { useId, useState } from "react";

import { type JsonRecord } from "../api/transport";
import {
  BAR_WEIGHT_BY_UNIT,
  COLLAR_WEIGHT_BY_UNIT,
  FRACTIONAL_PLATE_SET_BY_UNIT,
  computePlateBreakdown,
  computeWarmupRamp,
  effectivePlateSet,
  type WeightUnit
} from "../utils/plateCalculator";
import { BarbellDiagram } from "./BarbellDiagram";

// DEV NOTE: mirrors exerciseDetails()'s intensity/resolved_load branching
// (utils/format.ts) so the pre-filled target matches what the athlete
// already sees in the prescription line above. This is a one-time initial
// value, not a live sync - the athlete can freely overwrite it.
function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

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
  // DEV NOTE: an explicit id/htmlFor pair, not implicit label-wrapping -
  // the target field's label now wraps two stepper buttons in addition to
  // the input, and RTL's (and browsers') implicit label association picks
  // whichever labelable-looking control comes first in DOM order once
  // there's more than one, which silently grabbed a stepper button
  // instead of the input.
  const targetInputId = useId();
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

  // DEV NOTE: ported from kolosseum.tools/ironclock's stepTarget()/stepKg -
  // the +/- step size tracks whichever plates are actually selectable, so
  // toggling fractional plates changes it too (2.5kg normally, 0.5kg once
  // 0.25kg micro-plates are in play). lb keeps a flat 5lb step regardless
  // of fractional plates, exactly like the reference - its lb display was
  // always a kg-internal conversion there, so lb stepping was never tied
  // to a plate set to begin with, and this app's lb plates don't change
  // that relationship for the step size.
  function stepTarget(direction: 1 | -1) {
    const plateSet = effectivePlateSet(unit, useFractionalPlates);
    const smallestPlate = plateSet[plateSet.length - 1] ?? (unit === "kg" ? 1.25 : 2.5);
    const step = unit === "lb" ? 5 : smallestPlate * 2;
    const base = hasValidTarget ? parsedTarget : 0;
    let next: number;

    if (direction > 0) {
      next = Math.floor(base / step + 1e-6) * step + step;
    }
    else {
      next = Math.ceil(base / step - 1e-6) * step - step;
      if (next < 0) next = 0;
    }

    setTargetValue(unit === "lb" ? String(Math.round(next)) : String(round2(next)));
  }

  return (
    <>
      <div className="plate-calc-inputs">
        <div className="field">
          <label htmlFor={targetInputId}>Target weight</label>
          <div className="target-stepper">
            <button type="button" className="target-stepper-button" aria-label="decrease target weight" onClick={() => stepTarget(-1)}>&minus;</button>
            <input
              id={targetInputId}
              type="number"
              min={0}
              step="any"
              value={targetValue}
              placeholder="Enter weight"
              onChange={(event) => setTargetValue(event.target.value)}
            />
            <button type="button" className="target-stepper-button" aria-label="increase target weight" onClick={() => stepTarget(1)}>+</button>
          </div>
        </div>
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
            <div className="plate-calc-status-row">
              <p className="exercise-howto-heading">Plates per side</p>
              {breakdown ? (
                <span className={`badge ${breakdown.exact ? "active" : "neutral"}`}>{breakdown.exact ? "Exact" : "Rounded"}</span>
              ) : null}
            </div>
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
              <p className="muted">
                {`Target cannot be loaded exactly with the selected plates. Rounded ${breakdown.achievedWeight > parsedTarget ? "up" : "down"} by ${round2(Math.abs(breakdown.achievedWeight - parsedTarget))}${unit}.`}
              </p>
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
