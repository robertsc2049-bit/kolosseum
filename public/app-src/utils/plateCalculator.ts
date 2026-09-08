// DEV NOTE: pure client-side plate/warm-up math for PlateWarmupCalculator.tsx.
// Plate sets and bar weights are the standard IPF/IWF competition set (kg)
// and the standard US commercial-gym set (lb) - not invented numbers.
// The warm-up ramp (empty bar, then 40/60/80/90% of the working weight,
// with descending reps) is the widely-used ramping scheme taught across
// mainstream strength programs; it deliberately stops at 90% since the
// working set itself is already shown elsewhere in the session UI.

export type WeightUnit = "kg" | "lb";

export interface PlatePair {
  plate: number;
  count: number;
}

export interface PlateBreakdown {
  perSide: PlatePair[];
  barWeight: number;
  achievedWeight: number;
  exact: boolean;
}

export interface WarmupStep {
  label: string;
  weight: number;
  reps: string;
}

const EPSILON = 1e-6;

export const BAR_WEIGHT_BY_UNIT: Record<WeightUnit, number> = { kg: 20, lb: 45 };

export const PLATE_SET_BY_UNIT: Record<WeightUnit, readonly number[]> = {
  kg: [25, 20, 15, 10, 5, 2.5, 1.25],
  lb: [45, 35, 25, 10, 5, 2.5]
};

const RAMP_STEPS: { label: string; percent: number | null; reps: string }[] = [
  { label: "Bar", percent: null, reps: "8-10" },
  { label: "40%", percent: 0.4, reps: "5" },
  { label: "60%", percent: 0.6, reps: "3" },
  { label: "80%", percent: 0.8, reps: "2" },
  { label: "90%", percent: 0.9, reps: "1" }
];

export function computePlateBreakdown(targetWeight: number, barWeight: number, unit: WeightUnit): PlateBreakdown {
  const perSide: PlatePair[] = [];
  let remaining = Number.isFinite(targetWeight) && Number.isFinite(barWeight)
    ? Math.max(0, (targetWeight - barWeight) / 2)
    : 0;

  if (remaining > EPSILON) {
    for (const plate of PLATE_SET_BY_UNIT[unit]) {
      const count = Math.floor((remaining + EPSILON) / plate);
      if (count > 0) {
        perSide.push({ plate, count });
        remaining -= count * plate;
      }
    }
  }

  const loadedPerSide = perSide.reduce((sum, { plate, count }) => sum + plate * count, 0);
  const achievedWeight = barWeight + loadedPerSide * 2;
  const exact = Number.isFinite(targetWeight) && Math.abs(targetWeight - achievedWeight) <= EPSILON;

  return { perSide, barWeight, achievedWeight, exact };
}

export function nearestAchievableWeight(weight: number, barWeight: number, unit: WeightUnit): number {
  if (!Number.isFinite(weight) || weight <= barWeight) return barWeight;

  const plates = PLATE_SET_BY_UNIT[unit];
  const increment = plates[plates.length - 1] * 2;
  const steps = Math.round((weight - barWeight) / increment);
  return barWeight + steps * increment;
}

export function computeWarmupRamp(targetWeight: number, barWeight: number, unit: WeightUnit): WarmupStep[] {
  if (!Number.isFinite(targetWeight) || targetWeight <= 0 || !Number.isFinite(barWeight)) return [];

  const steps: WarmupStep[] = [];
  let lastWeight = -Infinity;

  for (const step of RAMP_STEPS) {
    const weight = step.percent === null
      ? barWeight
      : nearestAchievableWeight(targetWeight * step.percent, barWeight, unit);

    if (weight >= targetWeight || weight <= lastWeight) continue;

    steps.push({ label: step.label, weight, reps: step.reps });
    lastWeight = weight;
  }

  return steps;
}
