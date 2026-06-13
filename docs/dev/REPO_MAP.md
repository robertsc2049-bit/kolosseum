<!-- DEV NOTE: Developer documentation surface. This document explains repo behaviour or boundaries, but canonical law remains in the tracked contracts, guards, and tests. Keep docs aligned with executable checks. -->

# Repository Map

This file explains the main repo areas and how to think about them.

It is a navigation guide only. It does not create product law.

## Top-Level Folder Contract

Status: developer navigation contract for S-V1-03.
Authority: this section explains repo ownership. It does not create product law, engine law, registry law, CI token meaning, payment authority, auth authority, UI authority, or release authority.

This contract is navigation and boundary documentation only. It does not create product behaviour.

No folder contract may create new product behaviour, product routes, storage behaviour, UI behaviour, payment behaviour, auth behaviour, registry content, or engine behaviour.

### Deterministic engine boundary

The deterministic engine boundary is explicit: `engine/` owns deterministic compile/execution truth and must not consume auth, billing, UI, coach notes, commercial copy, dashboards, marketplace, messaging, organisation, team, gym, or EPOS state.

If a change makes engine output depend on a product surface, payment surface, notes surface, copy surface, presentation field, operator opinion, or dashboard state, the change is outside this folder contract and must fail until a deliberate engine-boundary slice proves it.

### Top-level folder ownership

- `.github/` owns GitHub workflow definitions and pull-request automation policy.
- `artifacts/` owns generated or captured local proof artefacts where explicitly permitted by slice law.
- `ci/` owns executable guards, fixtures, CI contracts, CI scripts, guard metadata, and release checks.
- `claims/` owns claim-control material only where already governed by copy and claim guards.
- `cli/` owns command-line entry surfaces and must not bypass engine or API contracts.
- `contracts/` owns machine-readable or human-readable contracts that pin expected shapes and boundaries.
- `copy/` owns copy-registry material and claim-safe text surfaces; it must not create engine truth.
- `db/` owns database migrations, schema helpers, and persistence support; it must not reinterpret engine decisions.
- `dist/` owns built output and must not be edited as source.
- `docs/` owns product, release, developer, architecture, proof, and operating documents; docs explain and point to authority but do not silently create behaviour.
- `engine/` owns deterministic engine source and engine-public contracts only.
- `examples/` owns example inputs or usage notes; examples must not become hidden acceptance law.
- `fixtures/` owns shared test and proof fixtures where explicitly referenced by tests or guards.
- `githooks/` and `.githooks/` own local Git hook support only.
- `out/`, `previews/`, and `tmp/` own local or generated output and must not become source authority.
- `public/` owns static public assets and public-facing static surfaces.
- `registries/` owns registry data, registry indexes, registry bundles, and registry classifications; registry content must remain closed-world and validated.
- `replay/` owns replay suites, replay envelopes, and replay proof inputs/outputs.
- `scripts/` owns repository automation, generators, maintenance scripts, and helper commands.
- `server/` owns API routing, transport, persistence orchestration, and product-facing adapters outside the engine.
- `shared/` owns shared contracts and helpers used across boundaries; shared code must not become a dumping ground for hidden product behaviour.
- `src/` owns application and package source according to the local module boundary.
- `support/` owns support documents or support-surface material where explicitly scoped.
- `test/` and `tests/` own executable test suites and test wrappers.
- `test_support/` owns test helpers only.
- `tools/` owns developer utilities and utility-surface build helpers; tools must not create active app capability without a named slice.
- `ui/` owns presentation surfaces and UI contracts; UI may present factual outputs but must not create engine truth.

### Placement rule

New work belongs in the narrowest folder that already owns that type of file.

When placement is unclear, inspect:

1. `REPO_BOUNDARY_MAP.md`
2. `docs/dev/REPO_MAP.md`
3. `docs/dev/DEVELOPER_OPERATING_CONVENTIONS.md`
4. `docs/roadmap/ACTIVE_RELEASE_BOUNDARY.md`
5. the closest existing guard or test pattern

Do not create a new top-level folder unless a slice explicitly authorises it and defines its owner, boundary, proof, and non-scope.

### Non-authority rule

This top-level folder contract is not permission to implement app, UI, payment, auth, registry, engine, proof, marketplace, messaging, organisation, team, gym, EPOS, or dashboard capability.

It is a developer handover map only.


## Developer Entry Pack

Start here when entering the repo without founder context:

- `docs/dev/GETTING_STARTED.md` - setup, commands, gates, and boundary pointers.
- `docs/dev/REPO_MAP.md` - repo area map and protected boundaries.
- `docs/dev/CI_FAILURE_GUIDE.md` - common gate failures and what not to change.
- docs/dev/FAILURE_TOKEN_INDEX.md - searchable index of failure tokens and safe repair paths.
- `docs/dev/SLICE_TEMPLATE.md` - bounded slice format and completion checks.
- `docs/roadmap/ACTIVE_RELEASE_BOUNDARY.md` - pointer to current release-boundary records.

These files are navigation and handover material only. They do not replace canonical contracts, release records, tests, or guards.

## Core Areas

### `/docs`

Product, release, architecture, proof, developer, and operating documents.

Use this area to understand why the system exists, what is in scope, what is excluded, and how developers should work safely.

### `/docs/dev`

Developer-facing navigation and handover material.

This area should explain:

- How to enter the repo safely
- Where to find rules
- How to search
- What not to touch
- How docs are maintained

### `/contracts`

Contracts define expected structures, boundaries, and data surfaces.

Treat contracts as stronger than explanatory docs.

### `/registries`

Registry content and registry rules.

Registry behaviour must remain explicit, validated, and closed over supported v1 scope.

Do not use registry content to smuggle in unsupported sports, unsupported equipment behaviour, recommendation language, or hidden fallback semantics.

### `/tests`

Tests are executable proof.

When docs and implementation disagree, tests expose the current enforced behaviour. If the enforced behaviour is wrong, fix it through a proper slice, not by silently changing tests.

### `/scripts`

Repo automation, CI helpers, validation scripts, and developer checks.

Scripts should fail clearly and explain what boundary was violated.

### `/src`

Application and engine implementation.

Engine code must remain deterministic and isolated from UI, auth, billing, notes, dashboards, AI, and coach convenience layers unless a contract explicitly allows the data boundary.

### `/public` or UI areas

User-facing surfaces.

UI may display factual outputs, but must not create engine truth or make unsupported recommendations.

## Boundary Areas To Protect

### Engine Boundary

The engine owns deterministic compile/execution truth.

It must not consume:

- Coach notes
- AI output
- UI-only state
- Marketing copy
- Billing state
- Dashboard summaries
- Inferred fatigue/readiness/risk labels

### Coach Notes Boundary

Coach notes are factual review/support material.

They must remain engine-invisible.

### Registry Boundary

Registries define supported content and allowed mappings.

Do not add temporary fallback behaviour. Temporary fallback becomes hidden product law.

### Proof Boundary

Replay, hashes, evidence, and runtime proof must be reproducible.

Do not let convenience data alter proof.

### Copy Boundary

Copy must avoid unsupported claims.

Use factual wording such as:

- recorded
- reported
- declared
- completed
- skipped
- substituted
- changed
- selected period
- coach review

Avoid unsupported wording such as:

- optimal
- safe
- safer
- effective
- recommends
- fatigue
- readiness
- risk
- injury risk
- programme worked
- programme failed
