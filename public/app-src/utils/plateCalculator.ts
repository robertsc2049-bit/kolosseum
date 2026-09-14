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

export interface PlateBreakdownOptions {
  useCollars?: boolean;
  availablePlates?: ReadonlySet<number>;
}

export interface PlateBreakdown {
  perSide: PlatePair[];
  barWeight: number;
  collarWeight: number;
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

// DEV NOTE: the default-available standard set, mirroring kolosseum.tools/
// ironclock's own DEFAULT_AVAILABLE - every denomination here is still
// individually opt-out-able (see availablePlates below), not a hardcoded
// assumption. Not every gym has every plate, 25kg included.
export const PLATE_SET_BY_UNIT: Record<WeightUnit, readonly number[]> = {
  kg: [25, 20, 15, 10, 5, 2.5, 1.25],
  lb: [45, 35, 25, 10, 5, 2.5]
};

// DEV NOTE: micro-plates, off by default (mirroring ironclock's
// DEFAULT_AVAILABLE excluding them too) - fine-tuning plates most gyms
// don't stock. lb has no equivalent fractional-plate convention to port,
// so this uses the closest common commercial fractional-plate-set sizes
// (1lb/0.5lb).
export const FRACTIONAL_PLATE_SET_BY_UNIT: Record<WeightUnit, readonly number[]> = {
  kg: [0.5, 0.25],
  lb: [1, 0.5]
};

export const FULL_PLATE_SET_BY_UNIT: Record<WeightUnit, readonly number[]> = {
  kg: [...PLATE_SET_BY_UNIT.kg, ...FRACTIONAL_PLATE_SET_BY_UNIT.kg],
  lb: [...PLATE_SET_BY_UNIT.lb, ...FRACTIONAL_PLATE_SET_BY_UNIT.lb]
};

// DEV NOTE: a competition/lockable collar pair, mirroring ironclock's
// binary "Not included" / "2.5kg each / 5kg pair" toggle exactly (kg) - lb
// has no single standard collar weight, so this uses the same 2.5-each/
// 5-pair shape rather than inventing an unrelated number.
export const COLLAR_WEIGHT_BY_UNIT: Record<WeightUnit, number> = { kg: 5, lb: 5 };

export function defaultAvailablePlates(unit: WeightUnit): Set<number> {
  return new Set(PLATE_SET_BY_UNIT[unit]);
}

function sortedAvailablePlates(availablePlates: ReadonlySet<number>): number[] {
  return Array.from(availablePlates).sort((a, b) => b - a);
}

// DEV NOTE: size/color/label styling for BarbellDiagram.tsx - by rank
// (largest to smallest) within each unit, matching the real IPF
// competition plate color convention (and kolosseum.tools/ironclock's own
// existing implementation of it: red/blue/yellow/green/white/black/grey,
// descending by height+width). kg's 7 denominations map 1:1 onto
// ironclock's own size table; lb has only 6 denominations (no single
// commercial-gym color standard exists for lb plates, so this reuses the
// same rank-ordered scheme rather than inventing an unrelated one) and so
// never reaches the 7th (grey) rank. Fractional (opt-in micro) plates get
// their own, smaller two-tier grey scheme, since ironclock has no
// dedicated visual for them either (they render as its generic "small"
// class) and this app's diagram needs a distinct size per denomination. A
// plate's rank/visual is about its own identity, not whether it's
// currently toggled available - unaffected by availablePlates.
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

export const FRACTIONAL_PLATE_RANK_STYLES: readonly PlateVisual[] = [
  { height: 56, width: 16, gradientId: "bd-frac-1", gradientStops: ["#8A8D93", "#46494E"], textColor: "#FFFFFF", fontSize: 9, textShadow: true },
  { height: 44, width: 14, gradientId: "bd-frac-2", gradientStops: ["#6E7176", "#36393D"], textColor: "#FFFFFF", fontSize: 8, textShadow: true }
];

export function plateVisual(plate: number, unit: WeightUnit): PlateVisual {
  const mainRank = PLATE_SET_BY_UNIT[unit].indexOf(plate);
  if (mainRank >= 0) return PLATE_RANK_STYLES[mainRank];

  const fractionalRank = FRACTIONAL_PLATE_SET_BY_UNIT[unit].indexOf(plate);
  if (fractionalRank >= 0) {
    return FRACTIONAL_PLATE_RANK_STYLES[fractionalRank] ?? FRACTIONAL_PLATE_RANK_STYLES[FRACTIONAL_PLATE_RANK_STYLES.length - 1];
  }

  return PLATE_RANK_STYLES[PLATE_RANK_STYLES.length - 1];
}

const RAMP_STEPS: { label: string; percent: number | null; reps: string }[] = [
  { label: "Bar", percent: null, reps: "8-10" },
  { label: "40%", percent: 0.4, reps: "5" },
  { label: "60%", percent: 0.6, reps: "3" },
  { label: "80%", percent: 0.8, reps: "2" },
  { label: "90%", percent: 0.9, reps: "1" }
];

export function computePlateBreakdown(
  targetWeight: number,
  barWeight: number,
  unit: WeightUnit,
  options: PlateBreakdownOptions = {}
): PlateBreakdown {
  const collarWeight = options.useCollars ? COLLAR_WEIGHT_BY_UNIT[unit] : 0;
  const plateSet = options.availablePlates ? sortedAvailablePlates(options.availablePlates) : PLATE_SET_BY_UNIT[unit];

  const perSide: PlatePair[] = [];
  let remaining = Number.isFinite(targetWeight) && Number.isFinite(barWeight)
    ? Math.max(0, (targetWeight - barWeight - collarWeight) / 2)
    : 0;

  if (remaining > EPSILON) {
    for (const plate of plateSet) {
      const count = Math.floor((remaining + EPSILON) / plate);
      if (count > 0) {
        perSide.push({ plate, count });
        remaining -= count * plate;
      }
    }
  }

  const loadedPerSide = perSide.reduce((sum, { plate, count }) => sum + plate * count, 0);
  const achievedWeight = barWeight + collarWeight + loadedPerSide * 2;
  const exact = Number.isFinite(targetWeight) && Math.abs(targetWeight - achievedWeight) <= EPSILON;

  return { perSide, barWeight, collarWeight, achievedWeight, exact };
}

// DEV NOTE: mirrors ironclock's stepKg/stepTarget rounding exactly - the
// increment is 2 x the smallest currently-available plate (a bare 2.5
// fallback when nothing is selected, same literal fallback the reference
// uses regardless of unit).
export function nearestAchievableWeight(
  weight: number,
  barWeight: number,
  availablePlates: ReadonlySet<number>
): number {
  if (!Number.isFinite(weight) || weight <= barWeight) return barWeight;

  const plates = Array.from(availablePlates);
  const increment = plates.length ? 2 * Math.min(...plates) : 2.5;
  const steps = Math.round((weight - barWeight) / increment);
  return barWeight + steps * increment;
}

export function computeWarmupRamp(
  targetWeight: number,
  barWeight: number,
  availablePlates: ReadonlySet<number>
): WarmupStep[] {
  if (!Number.isFinite(targetWeight) || targetWeight <= 0 || !Number.isFinite(barWeight)) return [];

  const steps: WarmupStep[] = [];
  let lastWeight = -Infinity;

  for (const step of RAMP_STEPS) {
    const weight = step.percent === null
      ? barWeight
      : nearestAchievableWeight(targetWeight * step.percent, barWeight, availablePlates);

    if (weight >= targetWeight || weight <= lastWeight) continue;

    steps.push({ label: step.label, weight, reps: step.reps });
    lastWeight = weight;
  }

  return steps;
}
