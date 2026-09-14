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

// DEV NOTE: size/color/label styling for BarbellDiagram.tsx - by rank
// (largest to smallest) within each unit, matching the real IPF
// competition plate color convention (and kolosseum.tools/ironclock's own
// existing implementation of it: red/blue/yellow/green/white/black/grey,
// descending by height+width). kg's 7 denominations map 1:1 onto
// ironclock's own size table; lb has only 6 denominations (no single
// commercial-gym color standard exists for lb plates, so this reuses the
// same rank-ordered scheme rather than inventing an unrelated one) and so
// never reaches the 7th (grey) rank.
export interface PlateVisual {
  height: number;
  width: number;
  gradientId: string;
  gradientStops: readonly [string, string];
  textColor: string;
  fontSize: number;
  textShadow: boolean;
}

export const PLATE_RANK_STYLES: readonly PlateVisual[] = [
  { height: 190, width: 36, gradientId: "bd-red", gradientStops: ["#D72B2B", "#8A1414"], textColor: "#FFFFFF", fontSize: 16, textShadow: true },
  { height: 176, width: 33, gradientId: "bd-blue", gradientStops: ["#2F70B6", "#163D6B"], textColor: "#FFFFFF", fontSize: 16, textShadow: true },
  { height: 160, width: 30, gradientId: "bd-yellow", gradientStops: ["#E8C84A", "#A08820"], textColor: "#1A1A1A", fontSize: 14, textShadow: false },
  { height: 140, width: 28, gradientId: "bd-green", gradientStops: ["#319A4F", "#14552A"], textColor: "#FFFFFF", fontSize: 14, textShadow: true },
  { height: 114, width: 24, gradientId: "bd-white", gradientStops: ["#EFEFEF", "#B6B6B6"], textColor: "#1A1A1A", fontSize: 12, textShadow: false },
  { height: 86, width: 21, gradientId: "bd-black", gradientStops: ["#2A2A2A", "#0C0C0C"], textColor: "#E6E6E6", fontSize: 11, textShadow: true },
  { height: 70, width: 20, gradientId: "bd-grey", gradientStops: ["#9A9DA3", "#54585E"], textColor: "#1A1A1A", fontSize: 11, textShadow: false }
];

const PLATE_RANK_BY_UNIT: Record<WeightUnit, readonly number[]> = {
  kg: PLATE_SET_BY_UNIT.kg,
  lb: PLATE_SET_BY_UNIT.lb
};

export function plateVisual(plate: number, unit: WeightUnit): PlateVisual {
  const rank = PLATE_RANK_BY_UNIT[unit].indexOf(plate);
  return rank >= 0 ? PLATE_RANK_STYLES[rank] : PLATE_RANK_STYLES[PLATE_RANK_STYLES.length - 1];
}

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
