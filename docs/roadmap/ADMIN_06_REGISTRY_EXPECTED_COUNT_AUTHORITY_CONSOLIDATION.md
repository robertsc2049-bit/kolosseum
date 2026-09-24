# ADMIN-06 — Registry Expected-Count Authority Consolidation

Status: implemented on `automation/admin-06-registry-count-authority`

## Goal

Centralize repeated derived production-count acceptance facts without weakening exact-count enforcement or making the count snapshot a new registry-content authority.

## Authority boundary

`registries/registry_expected_counts.json` is a generated acceptance snapshot only.

Canonical registry content, materialized REG-FULL registries, manifests and existing closure law remain authoritative. The snapshot is engine-inert and cannot make a changed registry acceptable by itself: CI derives the expected counts independently from those source files and requires byte-exact snapshot parity.

## Materialization

Use:

```text
node scripts/materialize_registry_expected_counts.mjs --write
```

Check without writing:

```text
node scripts/materialize_registry_expected_counts.mjs --check
```

REG-FULL-09 `--write` includes the expected-count materialization before the final acceptance report is rebuilt.

## Migrated production totals

The centralized authority owns only repeated derived acceptance facts such as supported activities, exercises, movements, equipment, applicability rows, compatibility edges, programme-template total, substitution totals and copy/provenance totals.

Independent semantic contracts remain local, including the activity allowlist, exercise-token vocabulary, required exercise IDs, per-activity exercise/movement distributions, programme-family composition, low-equipment family count, closure state and zero-error requirements.

## Fail-closed proof

`test/admin_06_registry_expected_counts_authority.test.mjs` proves that:

- changing canonical registry materialization without rematerializing the snapshot fails;
- changing the snapshot alone cannot fake acceptance;
- duplicate IDs still fail;
- orphan relationships still fail;
- missing applicability still fails;
- substitution graph drift still fails;
- REG-FULL-09 still independently aggregates every child gate as PASS;
- migrated REG-FULL surfaces do not reintroduce the removed production-total literals.

The test is part of `ci/contracts/registry_law_positive_ci_cluster.json`.

## Scope boundary

ADMIN-06 changes no registry content, activities, exercises, programme families or runtime engine behaviour. It changes only expected-count authority, materialization and acceptance wiring.
