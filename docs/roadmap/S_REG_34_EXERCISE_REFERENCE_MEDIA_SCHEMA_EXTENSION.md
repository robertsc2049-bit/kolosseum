# S-REG-34 — Exercise Reference Media Schema Extension

## Purpose

S-REG-34 adds an optional `reference_media` field to the already-active `exercise` registry's schema, so exercises can eventually carry a coach/admin-entered video reference. Unlike S-REG-32 (which added two *required* fields with real derived values to all 19 live entries), this slice adds a purely *optional* field and gives it a value on **zero** of the 19 live entries — there is no reference-media content to populate yet, only the schema shape to receive it later.

`runtime_status` stays `non_runtime` for this slice — nothing consumes the field yet. The product-facing read surface that will expose it is `FULL-UI-30`, built separately as ordinary product work (not a registry slice), since there is no live "get exercise detail" route today — the engine only reads the registry file directly at compile time.

## Why this is needed

The product owner asked for feature parity with mainstream coaching apps, bounded by this repo's own durable guidelines. A gap analysis identified exercise reference-media (short instructional videos) as an allowed-but-missing capability, with the explicit caveat that there is no video content to populate right now — so this slice ships the infrastructure only: the schema shape, a content-free invariant proof, and (in a separate product commit) a read-only API surface that returns `null` for every exercise until a later slice adds real content.

## Field shape

Added identically to all 3 exercise schema files (`ci/schemas/exercise.registry.schema.json`, `ci/schemas/exercise.registry.schema.v1.0.0.json`, `ci/schemas/exercise_registry.schema.json`):

```json
"reference_media": {
  "type": "object",
  "additionalProperties": false,
  "required": ["video_url", "source"],
  "properties": {
    "video_url": {"type": "string", "minLength": 1, "format": "uri"},
    "thumbnail_url": {"type": "string", "minLength": 1, "format": "uri"},
    "source": {"type": "string", "enum": ["coach_entered", "admin_entered"]}
  }
}
```

`reference_media` itself is **not** added to the entry schema's `required` array — it stays optional, mirroring how `equipment_requirements`/`equipment_alternatives` started optional during S-REG-25. `source` stays coach/admin-only by explicit decision: reopening athlete-uploaded video would drag in the messaging-attachment moderation question this infrastructure slice doesn't need.

## Why this is lighter than every prior content-mutation slice

Because no exercise entry's data changes, `registries/exercise/exercise.registry.json` and `registries/registry_bundle.json` are both completely untouched — confirmed directly: `bundle_writer.cjs` (the `npm run registry:bundle` implementation) reads only `<registry>.registry.json` data files listed in `registry_index.json`'s `order[]`, never the `ci/schemas/` definition files, so no bundle regeneration is needed. The registry-seal snapshot (`ci/evidence/registry_seal_snapshot.v1.json`) hashes registry data files only, not schema files, so no seal re-pin is needed either. This slice only ever changes the 3 schema files themselves.

The engine's exercise loader (`engine/src/registries/loadExerciseEntries.ts`) parses `exercise.registry.json` directly with no schema/ajv validation step at runtime, so adding an unused optional property to the schema cannot change engine behaviour even in principle — confirmed, not merely assumed, by the runtime parity proof below.

## Boundary

S-REG-34 includes:

- `reference_media` added to `properties` (not `required`) in all 3 exercise schema files, kept byte-for-byte identical across all 3 as always.
- This slice's own module (`ci/registry/s_reg_34_exercise_reference_media_schema_extension.mjs`) independently re-derives and validates the schema shape in all 3 files, and separately re-derives the content-free invariant by reading every one of the 19 live exercise entries and confirming none carries the field.
- Test and guard proof.
- Documentation.
- Package proof script.
- Generated indexes and checksums through existing generators.

## Non-scope

S-REG-34 must not touch:

- `registries/exercise/exercise.registry.json`'s content, `registries/registry_bundle.json`, `registries/registry_index.json`'s `order[]`, `registries/registry_surface_classification.json`, or any registry seal evidence file — no registry data or seal mutation happens in this slice.
- Any candidate domain's activation.
- `engine/`, `src/`, `server/`, `app/`, `web/`, or `supabase/` source — the product-facing read surface that exposes `reference_media` (`FULL-UI-30`) is a separate, ordinary product commit, not part of this registry slice's boundary.
- Marker evaluator behaviour, real value comparison, advice, outcome inference, programme assignment, substitution runtime, UI behaviour, coach interpretation.
- Deterministic engine output — proven unchanged by the runtime parity proof below.

## Runtime parity proof

`npm run e2e:golden`'s 13 fixtures were captured before this slice and re-captured after every mutation in this slice. All 13 were byte-identical, including `phase3_precedence_banned_over_available` and `phase3_sovereign_constraints_envelope`. Since this slice touches only `ci/schemas/` files — which the exercise loader never reads — and `exercise.registry.json`/`registry_index.json` are both completely untouched, PHASE_3's `loaded_registries` list cannot be affected. This was confirmed by actually running the golden suite, not assumed from the absence of a new domain.

## Rollback plan

Primary: `git revert <this-slice-commit>` reverses the 3 exercise schema files and this slice's own scaffolding atomically back to the pre-extension state in one step. No registry data, bundle, or seal file is touched by this slice, so no other rollback step is needed.

Fallback if a clean revert is not possible: remove the `reference_media` property block from all 3 exercise schema files, confirming all 3 files return to the pre-extension hashes recorded in `schema_file_hashes_before`.

## Proof

Expected proof:

- `node --test test/s_reg_34_exercise_reference_media_schema_extension.test.mjs`
- `node ci/guards/s_reg_34_exercise_reference_media_schema_extension_guard.mjs`
- `npm.cmd run proof:s-reg-34`
- `node ci/guards/registry_bundle_guard.mjs`
- `node ci/guards/registry_law_guard.mjs`
- `node ci/guards/registry_schema_presence_guard.mjs`
- `node ci/guards/s_v1_24_registry_load_order_fk_closure_guard.mjs`
- `node ci/guards/s_v1_21_exercise_registry_contract_guard.mjs` (must stay green - unrelated domain, confirms no cross-contamination)
- `node ci/scripts/run_registry_seal_gate.mjs` (must stay green - proves the seal genuinely needed no re-pin)
- `node ci/scripts/run_failure_token_index_guard.mjs`
- `node ci/guards/guards_index_guard.mjs`
- `node ci/guards/guards_entrypoint_coverage_guard.mjs`
- `npm.cmd run lint:fast`

## Final boundary

S-REG-34 extends the `exercise` registry's schema only, adding a content-free, optional `reference_media` field in preparation for `FULL-UI-30`'s read-only product surface.

It does not activate any candidate domain, mutate any registry's content, mutate the bundle or seal, create marker evaluator behaviour, compare real values, emit advice, infer outcomes, alter programme assignment, alter substitution runtime, create UI behaviour, or alter deterministic engine output.
