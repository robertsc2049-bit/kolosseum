function beta08BaseFixture(activityId) {
  const exerciseByActivity = {
    powerlifting: ["fixture_powerlifting_squat", "squat"],
    rugby_union: ["fixture_rugby_jump", "jump"],
    general_strength: ["fixture_general_squat", "squat"]
  };

  const subdivisionByActivity = {
    powerlifting: "powerlifting__competition_lift",
    rugby_union: "rugby_union__general_preparation",
    general_strength: "general_strength__training"
  };

  const metricByActivity = {
    powerlifting: ["powerlifting__attempt_count", "integer", "recorded"],
    rugby_union: ["rugby_union__jump_height_cm", "number", "recorded"],
    general_strength: ["general_strength__set_count", "integer", "declared"]
  };

  const [exerciseId, movementId] = exerciseByActivity[activityId];
  const subdivisionId = subdivisionByActivity[activityId];
  const [sportMetricId, valueType, metricSource] = metricByActivity[activityId];

  return {
    slice_id: "BETA-08",
    fixture_id: `positive_${activityId}`,
    registry_index: {
      version: "beta-08-fixture",
      order: ["activity", "movement", "exercise", "program"]
    },
    enum_bundle: {
      enum_bundle_version: "EB2-1.0.0",
      activity_ids: ["powerlifting", "rugby_union", "general_strength"],
      metric_value_types: ["number", "integer"],
      metric_kinds: ["factual_metric_definition"],
      metric_sources: ["recorded", "declared", "derived_only"],
      registry_domains: [
        "activity",
        "movement",
        "exercise",
        "program",
        "sport_subdivision",
        "sport_metric",
        "metric_exercise_link"
      ]
    },
    registry_bundle: {
      version: "beta-08-fixture",
      registries: {
        activity: {
          registry_id: "activity",
          version: "beta-08-fixture",
          entries: {
            powerlifting: { activity_id: "powerlifting" },
            rugby_union: { activity_id: "rugby_union" },
            general_strength: { activity_id: "general_strength" }
          }
        },
        movement: {
          registry_id: "movement",
          version: "beta-08-fixture",
          entries: {
            [movementId]: { movement_pattern_id: movementId }
          }
        },
        exercise: {
          registry_id: "exercise",
          version: "beta-08-fixture",
          entries: {
            [exerciseId]: {
              exercise_id: exerciseId,
              movement_pattern_id: movementId,
              primary_activity_applicability: activityId,
              secondary_activity_applicability: []
            }
          }
        },
        program: {
          registry_id: "program",
          version: "beta-08-fixture",
          entries: [
            {
              activity_id: activityId,
              template_id: `fixture_${activityId}_program`,
              exercise_eligibility: [exerciseId]
            }
          ]
        }
      }
    },
    beta_metric_registries: {
      sport_subdivision: {
        registry_id: "sport_subdivision",
        version: "beta-08-fixture",
        entries: {
          [subdivisionId]: {
            sport_subdivision_id: subdivisionId,
            activity_id: activityId
          }
        }
      },
      sport_metric: {
        registry_id: "sport_metric_registry_1c",
        version: "beta-08-fixture",
        entries: {
          [sportMetricId]: {
            sport_metric_id: sportMetricId,
            activity_id: activityId,
            sport_subdivision_id: subdivisionId,
            metric_kind: "factual_metric_definition",
            value_type: valueType,
            metric_source: metricSource
          }
        }
      },
      metric_exercise_link: {
        registry_id: "metric_exercise_link_registry_1c_a",
        version: "beta-08-fixture",
        entries: {
          [`${sportMetricId}__${exerciseId}`]: {
            metric_exercise_link_id: `${sportMetricId}__${exerciseId}`,
            sport_metric_id: sportMetricId,
            exercise_id: exerciseId,
            activity_id: activityId
          }
        }
      }
    },
    phase1_declaration: {
      activity_id: activityId,
      declared_metric_ids: [sportMetricId]
    }
  };
}

function cloneFixture(value) {
  return JSON.parse(JSON.stringify(value));
}

const base = beta08BaseFixture("powerlifting");

const unknownEnum = cloneFixture(base);
unknownEnum.fixture_id = "negative_unknown_enum";
unknownEnum.expected_failure_token = "CI_BETA_08_REGISTRY_FK_ENUM_UNKNOWN_ENUM_TOKEN";
unknownEnum.phase1_declaration.activity_id = "cycling";

const badFk = cloneFixture(base);
badFk.fixture_id = "negative_bad_fk";
badFk.expected_failure_token = "CI_BETA_08_REGISTRY_FK_ENUM_UNRESOLVED_FK";
badFk.phase1_declaration.declared_metric_ids = ["powerlifting__missing_metric"];

const duplicateId = cloneFixture(base);
duplicateId.fixture_id = "negative_duplicate_id";
duplicateId.expected_failure_token = "CI_BETA_08_REGISTRY_FK_ENUM_DUPLICATE_ENTRY_ID";
{
  const metric = duplicateId.beta_metric_registries.sport_metric.entries.powerlifting__attempt_count;
  duplicateId.beta_metric_registries.sport_metric.entries = [metric, cloneFixture(metric)];
}

const missingLink = cloneFixture(base);
missingLink.fixture_id = "negative_missing_1c_a_link";
missingLink.expected_failure_token = "CI_BETA_08_REGISTRY_FK_ENUM_MISSING_METRIC_EXERCISE_LINK";
missingLink.beta_metric_registries.metric_exercise_link.entries = {};

const metricActivityMismatch = cloneFixture(base);
metricActivityMismatch.fixture_id = "negative_metric_activity_mismatch";
metricActivityMismatch.expected_failure_token = "CI_BETA_08_REGISTRY_FK_ENUM_METRIC_ACTIVITY_MISMATCH";
metricActivityMismatch.beta_metric_registries.metric_exercise_link.entries.powerlifting__attempt_count__fixture_powerlifting_squat.activity_id = "rugby_union";

const activitySubdivisionMismatch = cloneFixture(base);
activitySubdivisionMismatch.fixture_id = "negative_activity_subdivision_mismatch";
activitySubdivisionMismatch.expected_failure_token = "CI_BETA_08_REGISTRY_FK_ENUM_ACTIVITY_SUBDIVISION_MISMATCH";
activitySubdivisionMismatch.beta_metric_registries.sport_subdivision.entries.powerlifting__competition_lift.activity_id = "rugby_union";

const derivedOnlyPhase1Metric = cloneFixture(base);
derivedOnlyPhase1Metric.fixture_id = "negative_derived_only_phase1_metric";
derivedOnlyPhase1Metric.expected_failure_token = "CI_BETA_08_REGISTRY_FK_ENUM_DERIVED_ONLY_PHASE1_METRIC";
derivedOnlyPhase1Metric.beta_metric_registries.sport_metric.entries.powerlifting__attempt_count.metric_source = "derived_only";

const crossDomainContamination = cloneFixture(base);
crossDomainContamination.fixture_id = "negative_cross_domain_contamination";
crossDomainContamination.expected_failure_token = "CI_BETA_08_REGISTRY_FK_ENUM_CROSS_DOMAIN_CONTAMINATION";
crossDomainContamination.registry_bundle.registries.exercise.entries.fixture_powerlifting_squat.sport_metric_id = "powerlifting__attempt_count";

export const beta08PositiveFixtures = Object.freeze({
  powerlifting: beta08BaseFixture("powerlifting"),
  rugby_union: beta08BaseFixture("rugby_union"),
  general_strength: beta08BaseFixture("general_strength")
});

export const beta08NegativeFixtures = Object.freeze({
  unknown_enum: unknownEnum,
  bad_fk: badFk,
  duplicate_id: duplicateId,
  missing_1c_a_link: missingLink,
  metric_activity_mismatch: metricActivityMismatch,
  activity_subdivision_mismatch: activitySubdivisionMismatch,
  derived_only_phase1_metric: derivedOnlyPhase1Metric,
  cross_domain_contamination: crossDomainContamination
});
