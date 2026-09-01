// DEV NOTE: Prilepin's chart is a factual reference lookup only, not a
// calculator or recommender. It never derives planned_sets/planned_reps -
// the coach reads the matching zone(s) here and still types their own
// numbers into the existing rep/set fields, exactly like %1RM->weight
// resolution in strengthReferenceLifecycle.mjs never picks a rep scheme
// for the coach either. Both tables are checked independently and every
// match is returned - there is no auto-selection between them, since
// choosing one table over the other on the coach's behalf would itself be
// an inferred judgment call this module must not make.

export class PrilepinChartReferenceError extends Error {
  constructor(code) {
    super(code);
    this.name = "PrilepinChartReferenceError";
    this.code = code;
  }
}

function fail(code) {
  throw new PrilepinChartReferenceError(code);
}

function zone(fields) {
  return Object.freeze({ ...fields });
}

// Classic Prilepin's chart: the widely-cited 4-zone table (Soviet-era
// strength sport research, popularised via Zatsiorsky/Westside Barbell),
// covering the ~55-100% 1RM range typical of strength/power work.
export const CLASSIC_PRILEPIN_ZONES = Object.freeze([
  zone({
    chart: "classic",
    zone_id: "classic_sub_maximal",
    zone_label: "Sub-maximal (55-69% 1RM)",
    percent_1rm_min: 55,
    percent_1rm_max: 69,
    reps_per_set_min: 3,
    reps_per_set_max: 6,
    optimal_total_reps_min: 24,
    optimal_total_reps_max: 24,
    total_reps_min: 18,
    total_reps_max: 30
  }),
  zone({
    chart: "classic",
    zone_id: "classic_intermediate",
    zone_label: "Intermediate (70-79% 1RM)",
    percent_1rm_min: 70,
    percent_1rm_max: 79,
    reps_per_set_min: 3,
    reps_per_set_max: 6,
    optimal_total_reps_min: 18,
    optimal_total_reps_max: 18,
    total_reps_min: 12,
    total_reps_max: 24
  }),
  zone({
    chart: "classic",
    zone_id: "classic_maximal",
    zone_label: "Maximal (80-89% 1RM)",
    percent_1rm_min: 80,
    percent_1rm_max: 89,
    reps_per_set_min: 2,
    reps_per_set_max: 4,
    optimal_total_reps_min: 15,
    optimal_total_reps_max: 15,
    total_reps_min: 10,
    total_reps_max: 20
  }),
  zone({
    chart: "classic",
    zone_id: "classic_super_maximal",
    zone_label: "Super-maximal (90-100% 1RM)",
    percent_1rm_min: 90,
    percent_1rm_max: 100,
    reps_per_set_min: 1,
    reps_per_set_max: 2,
    optimal_total_reps_min: 4,
    optimal_total_reps_max: 4,
    total_reps_min: 4,
    total_reps_max: 10
  })
]);

// Modified/extended Prilepin's chart: a commonly used extension covering
// lower %1RM / higher-rep zones that Prilepin's own original research did
// not address. This is a widely circulated coaching adaptation, not part
// of Prilepin's own research - several different extended tables exist
// among coaches, and these specific numbers are a reasonable, clearly
// labelled default rather than a single agreed standard.
export const MODIFIED_PRILEPIN_ZONES = Object.freeze([
  zone({
    chart: "modified",
    zone_id: "modified_high_volume",
    zone_label: "High-volume (30-39% 1RM, modified chart)",
    percent_1rm_min: 30,
    percent_1rm_max: 39,
    reps_per_set_min: 12,
    reps_per_set_max: 15,
    optimal_total_reps_min: 60,
    optimal_total_reps_max: 60,
    total_reps_min: 40,
    total_reps_max: 70
  }),
  zone({
    chart: "modified",
    zone_id: "modified_moderate_high_volume",
    zone_label: "Moderate-high volume (40-49% 1RM, modified chart)",
    percent_1rm_min: 40,
    percent_1rm_max: 49,
    reps_per_set_min: 10,
    reps_per_set_max: 12,
    optimal_total_reps_min: 50,
    optimal_total_reps_max: 50,
    total_reps_min: 40,
    total_reps_max: 60
  }),
  zone({
    chart: "modified",
    zone_id: "modified_moderate_volume",
    zone_label: "Moderate volume (50-64% 1RM, modified chart)",
    percent_1rm_min: 50,
    percent_1rm_max: 64,
    reps_per_set_min: 6,
    reps_per_set_max: 10,
    optimal_total_reps_min: 40,
    optimal_total_reps_max: 40,
    total_reps_min: 30,
    total_reps_max: 50
  })
]);

const ALL_ZONES = Object.freeze([...CLASSIC_PRILEPIN_ZONES, ...MODIFIED_PRILEPIN_ZONES]);

export function lookupPrilepinZones(percentageInput) {
  const percentage = Number(percentageInput);

  if (!Number.isFinite(percentage)) {
    fail("prilepin_percentage_invalid");
  }

  if (percentage < 1 || percentage > 100) {
    fail("prilepin_percentage_invalid");
  }

  const chartMatches = ALL_ZONES.filter(
    (row) => percentage >= row.percent_1rm_min && percentage <= row.percent_1rm_max
  );

  return Object.freeze({
    type: "prilepin_zone_reference",
    percentage,
    chart_matches: Object.freeze(chartMatches),
    factual_reference_only: true,
    recommendation_inferred: false,
    optimisation_inferred: false,
    readiness_inferred: false,
    suitability_inferred: false,
    safety_inferred: false
  });
}
