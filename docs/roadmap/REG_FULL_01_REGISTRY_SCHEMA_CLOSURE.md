# REG-FULL-01 — Registry Schema Closure

Status: implementation slice.

REG-FULL-00 decides which registry authorities exist. REG-FULL-01 consumes that authority and gives every `required_active` registry exactly one canonical Draft 2020-12 schema and one canonical ID vocabulary.

## Closed outcomes

- `registries/final_registry_schema_manifest.json` is the machine-readable schema authority beneath the REG-FULL-00 surface manifest.
- All 25 final required-active registries have exactly one authoritative schema path.
- Canonical rows use domain-specific primary keys. Generic `id` aliases are not canonical vocabulary.
- `movement_pattern_id` is the movement FK vocabulary; legacy `pattern` and `movement_id` readers are removed from registry consumers.
- Exercise equipment is represented by `equipment_requirements` / `equipment_alternatives`; the legacy parallel `equipment` and `equipment_tags` representations are removed from the live exercise registry.
- Exercise instruction data uses `instruction_short_text` and `instruction_detail_text`; the legacy nested instruction object is not accepted by the canonical schema.
- The compact loaded `program` domain is a compatibility projection of `sport_program_template_registry_5f`. It is not Sport Program Profile 5D. Profile and template remain distinct authorities.
- Registries whose complete row contract is not surfaced by governing authority are hard-closed to zero materialised rows. REG-FULL-01 does not invent a schema from prose.
- Canonical schemas contain no undocumented optional fields. S-REG-34 `reference_media` remains an explicitly documented optional field only on the loaded exercise compatibility schema.

## Content neutrality

This slice changes representation and canonical vocabulary. It does not add exercises, activities, sport roles, metrics, equipment, applicability relationships, substitution edges or programme templates. Existing row counts and factual relationships are preserved.

## Compatibility

Current loader domain names remain in `registry_index.json` for runtime compatibility. Their schemas and payloads are canonicalised internally, but those compact registry IDs are not parallel final architecture authorities. Later REG-FULL slices may migrate or retire compatibility projections only under explicit authority.

## Proof

Primary proof:

- `node --test test/reg_full_01_registry_schema_closure.test.mjs`
- `node ci/guards/reg_full_01_registry_schema_closure_guard.mjs`
- `node ci/guards/reg_full_00_final_registry_surface_authority_guard.mjs`
- `node ci/guards/registry_schema_presence_guard.mjs`
- `node ci/guards/registry_bundle_guard.mjs`
- `node ci/guards/registry_law_guard.mjs`
- relevant S-REG and S-V1 registry contract guards
- registry seal freeze/gate/drift proof
- golden replay proof
- `npm run lint:fast`
- `npm run test:ci`
- `npm run test:ci:integration`

No package version or release tag changes are authorised by REG-FULL-01.
