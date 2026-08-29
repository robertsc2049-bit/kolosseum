# REG-FULL-05 — Sport Context Completion

## Goal

Replace the seed-sized sport-context surface with an explicit, production-grade model for the locked activities:

- `powerlifting`
- `general_strength`
- `rugby_union`

The slice owns five content surfaces only:

1. `sport_subdivision`
2. `sport_role`
3. `sport_metric`
4. `metric_exercise_link`
5. `threshold_marker`

## Completion model

REG-FULL-05 materialises at least:

- 24 sport subdivisions;
- 18 sport roles, including the retained generic rugby field-player role and the standard rugby positional role taxonomy;
- 32 factual sport metrics spanning competition/training, strength, conditioning, speed, jump and change-of-direction contexts;
- explicit metric→exercise rows for every exercise-linked metric;
- at least one factual threshold-marker row for every sport metric.

Body-mass metrics are deliberately non-exercise metrics and must have zero metric→exercise links.

## Explicit relation law

`metric_exercise_link.registry.json` is the relation authority. Authoring-time movement/equipment policies in `scripts/reg_full_05_materialize_sport_context.mjs` may be used once to generate rows, but they are not runtime inference and are not a fallback path.

Every final metric→exercise row must satisfy all of the following:

- metric FK exists;
- exercise FK exists;
- activity FK exists;
- metric activity equals link activity;
- the exercise already has explicit exercise→activity applicability for that activity;
- primary key is exactly `${sport_metric_id}__${exercise_id}`;
- relation kind is factual only;
- no `fallback`, `unknown`, `unspecified`, catch-all or default relation is permitted.

## Threshold-marker supersession boundary

REG-FULL-00 classified `threshold_marker_registry` as dormant, non-authoritative, non-runtime and `new_content_allowed=false`.

The explicit REG-FULL-05 human instruction supersedes **only** the `new_content_allowed=false` content prohibition so that factual threshold-marker rows can be completed for the supported sport metrics.

It does **not** supersede the remaining REG-FULL-00 boundary. Threshold markers remain:

- dormant in final architecture;
- non-authoritative;
- non-runtime;
- without evaluator behaviour;
- without comparison-result behaviour;
- without recommendation, suitability, safety, tactical or performance interpretation authority.

The five S-REG-30 historical threshold rows remain immutable historical members.

## Historical activation preservation

S-REG-26, S-REG-28, S-REG-29 and S-REG-30 originally proved smaller activation sets. REG-FULL-05 must not rewrite their JSON evidence counts.

Their validators are made supersession-safe by checking the historical activated IDs and frozen historical count rather than equating that historical count to the current live registry size. S-REG-27 already uses this pattern and is the precedent.

Historical floors retained:

- S-REG-26 sport subdivisions: 4 activated rows;
- S-REG-28 sport roles: 3 activated rows;
- S-REG-29 metric→exercise links: 12 activated rows;
- S-REG-30 sport metric extension: 3 rows;
- S-REG-30 threshold markers: 5 activated rows.

## Generated artefacts

The controlled generation order is:

1. `node scripts/reg_full_05_materialize_sport_context.mjs --write`
2. `npm.cmd run registry:bundle`
3. `node scripts/reg_full_05_materialize_sport_context.mjs --write-evidence`
4. `node ci/scripts/evidence_seal.mjs --write`

Generated files are committed and reviewed; `registry_bundle.json` is never hand-edited.

## CI proof

`ci/registry/reg_full_05_sport_context_completion.mjs` and `test/reg_full_05_sport_context_completion.test.mjs` prove:

- all three activity contexts are populated;
- required subdivisions and rugby roles exist;
- metric/subdivision/activity FKs are coherent;
- every linkable metric has explicit exercise relations;
- every link uses explicit exercise/activity applicability;
- body-mass metrics remain linkless;
- every sport metric has a threshold-marker row;
- historical threshold rows remain present;
- threshold unit/activity/status contracts remain coherent;
- threshold-marker final architecture stays dormant and non-runtime;
- REG-FULL-05 evidence hashes match the materialised registries and generated bundle;
- no generic fallback identifier is accepted.

The test is indexed into the registry-law positive `test:ci` cluster.
