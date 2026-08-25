import { type JsonRecord, request } from "./transport";

export type LogAthleteNutritionInput = {
  effective_date: string;
  macros: Array<{ metric_type: string; value: number }>;
};

export async function loadAthleteNutritionSelf(): Promise<JsonRecord[]> {
  const response = await request("GET", "/body-metrics");
  return Array.isArray(response.entries) ? (response.entries as JsonRecord[]) : [];
}

// DEV NOTE: ported verbatim from app.js's logNutritionEntry() - nutrition
// has no dedicated route, so one macro figure is one POST /body-metrics
// call with a nutrition-flavored metric_type (see NUTRITION_METRIC_TYPES).
export async function logAthleteNutritionSelf(input: LogAthleteNutritionInput, csrfToken: string): Promise<void> {
  for (const { metric_type, value } of input.macros) {
    await request("POST", "/body-metrics", { metric_type, value, effective_date: input.effective_date }, csrfToken);
  }
}
