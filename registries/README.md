# Registry Module Notes

v0_scope_guard: boundary_doc

Status: active v0 developer note.
Scope: registry documentation binding.

## DEV NOTE: authority boundary

This README explains the registry boundary for future developers. It does not create new engine law.

Canonical docs define law. DEV NOTE comments explain boundaries. Tests prove behaviour.

The registry authority chain for active v0 is:

1. Canonical release and boundary documents.
2. Executable guard scripts.
3. Executable tests.
4. Developer notes and READMEs.

When this README appears to disagree with a canonical document or executable guard, treat the canonical document and guard result as the authority. Update this README only to explain the already-enforced boundary.

## Active v0 registry files

Active v0 registry content is limited to the domains listed in `registries/registry_index.json`:

- `activity`
- `movement`
- `exercise`
- `program`

The generated bundle is `registries/registry_bundle.json`. It must be produced from `registries/registry_index.json` and the active registry files. It must not be hand-edited.

Use:

- `npm run registry:bundle`
- or `node scripts/bundle_writer.cjs`

## Schema validity

Every active registry domain in `registries/registry_index.json` must have a matching schema at:

- `ci/schemas/<registry>.registry.schema.json`

The schema presence rule is enforced by:

- `ci/guards/registry_schema_presence_guard.mjs`

The broader schema and registry checks are also covered by:

- `ci/scripts/schema_guard.mjs`
- `ci/guards/registry_law_guard.mjs`

## FK closure

Registry references are closed-world references.

Active v0 registry references must resolve to committed registry targets. Missing targets are build failures, not warnings.

Current registry FK examples include:

- `exercise.pattern` -> movement registry IDs
- `exercise.stimulus_intent` -> activity stimulus intents
- exercise equipment tokens -> movement-scoped equipment vocabulary
- exercise joint stress tags -> movement-scoped joint stress tag vocabulary

The FK closure rule is enforced by:

- `ci/guards/registry_law_guard.mjs`
- `test/ci_registry_law_guard_fk_negative.test.mjs`
- `test/ci_registry_law_guard_stimulus_fk_negative.test.mjs`
- `test/ci_registry_law_guard_equipment_fk_negative.test.mjs`
- `test/ci_registry_law_guard_joint_stress_fk_negative.test.mjs`
- `test/s_v0_10_registry_bundle_closure.test.mjs`

## Frozen store and bundle closure

The registry bundle is a committed generated artefact.

The bundle must match the current registry index and active registry files exactly. Changing a registry file without regenerating and committing the bundle is invalid.

Bundle closure is enforced by:

- `ci/guards/registry_bundle_guard.mjs`
- `scripts/bundle_writer.cjs`
- `test/s_v0_10_registry_bundle_closure.test.mjs`

## No registry fallback

Registry loading must not use fallback, approximate, guessed, closest-match, inferred, or partial registry behaviour.

If a registry file is missing, malformed, stale, or contains a broken reference, the correct result is a hard failure with readable output.

Do not repair a failing registry guard by weakening the guard. Repair the registry, schema, bundle, or canonical boundary deliberately.

## v0/v1 boundary

Active v0 registry content is limited to the active v0 boundary.

Future v1 registry content may be documented or scaffolded only where it is clearly excluded from active v0 execution. Future-scope registry content must not enter:

- `registries/registry_index.json`
- `registries/registry_bundle.json`
- active v0 registry files
- active v0 engine execution paths
- active v0 tests as accepted runtime capability

The current v0 bundle closure record is:

- `docs/release/V0_REGISTRY_BUNDLE_CLOSURE.md`

## CI binding

The registry law surfaces are wired through `lint:fast` and therefore through normal v0 gate execution:

- `ci/guards/registry_schema_presence_guard.mjs`
- `ci/guards/registry_bundle_guard.mjs`
- `ci/guards/registry_law_guard.mjs`

S-V0-11 binds this README to executable proof with:

- `test/s_v0_11_registry_law_documentation_binding.test.mjs`
