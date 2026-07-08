# V0 Registry Law Documentation Binding

v0_scope_guard: boundary_doc

Status: active v0 release record.
Slice: S-V0-11 Registry Law Documentation Binding.

## DEV NOTE: purpose

This record documents S-V0-11. The slice binds registry rules to a concise registry module note so future developers understand what registry files can and cannot do.

This slice does not add registry content, new schema domains, broad v1 registry production work, engine behaviour, product UI, or future-scope capability.

## Authority rule

Documentation must not create new engine law.

Canonical docs define law. DEV NOTE comments explain boundaries. Tests prove behaviour.

The new registry module note explains the already-enforced boundary and links to the executable guard and test surfaces.

## Added documentation binding

S-V0-11 adds:

- `registries/README.md`
- `test/s_v0_11_registry_law_documentation_binding.test.mjs`

The README documents:

- schema validity
- FK closure
- frozen store and bundle closure
- no registry fallback
- v0/v1 registry boundary
- CI guard binding

## Guard links

The documentation binds directly to:

- `ci/guards/registry_schema_presence_guard.mjs`
- `ci/guards/registry_bundle_guard.mjs`
- `ci/guards/registry_law_guard.mjs`
- `ci/scripts/schema_guard.mjs`
- `scripts/bundle_writer.cjs`
- `test/s_v0_10_registry_bundle_closure.test.mjs`

## Completion condition

S-V0-11 is complete only when:

- registry law docs and guard scripts are located
- registry README/module note exists
- schema validity is documented
- FK closure is documented
- frozen store and bundle closure are documented
- no registry fallback is documented
- v0/v1 boundary is documented
- docs link back to guard scripts
- executable documentation binding test passes
- required v0 gates pass
- the working tree is clean
- local main is pushed to origin/main after successful gates
