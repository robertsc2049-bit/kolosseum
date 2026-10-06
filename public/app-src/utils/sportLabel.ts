// eslint-disable-next-line import/no-unresolved
import { V1_ACTIVITIES } from "../../../shared/v1-boundary/v1ActivityRegistry.mjs";

import { titleCase } from "./format";

// A sport's name as the activity registry writes it - "MMA", "CrossFit",
// "Brazilian jiu-jitsu" - never a title-cased id ("Mma").
const LABELS = new Map((V1_ACTIVITIES as readonly { activity_id: string; display_label: string }[]).map((a) => [a.activity_id, a.display_label]));
export function sportLabel(activityId: string): string {
  return LABELS.get(activityId) ?? titleCase(activityId);
}
