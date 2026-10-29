export type VolumeRange = Readonly<{ min: number | null; max: number | null }>;
export type VolumeStatus = "under" | "in_range" | "over";

export declare const VOLUME_LEVELS: readonly string[];
export declare const DEFAULT_VOLUME_LEVEL: string;
export declare const MUSCLE_VOLUME_RANGES: Readonly<Record<string, Readonly<Record<string, VolumeRange>>>>;
export declare const VOLUME_FOCUS_GROUPS: Readonly<Record<string, readonly string[]>>;

export declare function volumeLevel(level: string | null | undefined): string;
export declare function muscleVolumeRange(group: string, level: string | null | undefined, activityId?: string): VolumeRange;
export declare function volumeStatus(sets: number, volumeRange: VolumeRange): VolumeStatus | null;
export declare function rangeText(volumeRange: VolumeRange): string;
