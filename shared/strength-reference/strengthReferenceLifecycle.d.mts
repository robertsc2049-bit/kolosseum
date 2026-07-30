export class StrengthReferenceLifecycleError
  extends Error {
  readonly code: string;
}

export function convertStrengthValue(
  valueInput: unknown,
  fromUnitInput: unknown,
  toUnitInput: unknown
): number;

export function projectStrengthReferenceLifecycle(
  recordsOrProfile: unknown,
  displayUnitInput?: string,
  asOfDateInput?: string
): Readonly<Record<string, unknown>>;

export function assertImmutableStrengthReferenceAppend(
  previousRecordsOrProfile: unknown,
  nextRecordsOrProfile: unknown
): readonly Readonly<Record<string, unknown>>[];

export function requiredStrengthReferenceExerciseIds(
  template: unknown
): readonly string[];

export function compareProgrammeStrengthRequirements(
  template: unknown,
  recordsOrProfile: unknown,
  asOfDateInput?: string,
  displayUnitInput?: string
): Readonly<Record<string, unknown>>;

export function resolveStrengthReferenceLoad(
  recordsOrProfile: unknown,
  exerciseIdInput: string,
  percentageInput: number,
  options?: Readonly<Record<string, unknown>>
): Readonly<Record<string, unknown>> | null;