<!-- DEV NOTE: ADR system surface. ADRs explain architecture decisions for future developers. They do not create product, engine, registry, release, CI, legal, commercial, or runtime law. -->

# Architecture Decision Records

Status: developer decision log.
Release boundary: applies from S-V1-06 onward.
Slice: S-V1-06.

## Purpose

Architecture Decision Records record important engineering and boundary decisions so future developers can understand why a path was chosen.

ADRs are explanation and decision-history records. They are not executable proof and they do not replace canonical release, engine, registry, contract, test, guard, or CI authority.

## Authority rule

ADRs document decisions; they do not create engine law.

Boundary docs and tests remain authoritative where applicable.

Canonical docs define law.

Tests prove behaviour.

Comments explain boundaries.

CI blocks drift.

If an ADR conflicts with active release law, engine law, registry law, contracts, tests, guards, or checksum-protected records, the active authority wins and the ADR must be corrected.

## File naming

Use uppercase ADR prefix, four digits, and lowercase kebab-case decision text:

- `ADR-0001-short-decision-name.md`
- `ADR-0002-short-decision-name.md`

Rules:

- ADR files must live directly under `docs/adr/`.
- ADR filenames must match `ADR-[0-9]{4}-[a-z0-9]+(-[a-z0-9]+)*.md`.
- `README.md`, `INDEX.md`, and `ADR_TEMPLATE.md` are the only non-numbered markdown files permitted directly under `docs/adr/`.
- Do not use vague ADR names such as `ADR-0001-final.md`, `ADR-0002-new.md`, `ADR-0003-fix.md`, `ADR-0004-misc.md`, or `ADR-0005-stuff.md`.

## Status values

Use one of:

- Proposed
- Accepted
- Superseded
- Deprecated

Only Accepted ADRs describe an active decision.

Superseded ADRs must link to the replacing ADR.

Deprecated ADRs must explain why the decision is no longer active.

## Required sections

Each ADR must include:

- Status
- Date
- Decision owner
- Context
- Decision
- Boundary impact
- Consequences
- Alternatives considered
- Proof
- Non-scope
- Authority note
- Supersedes
- Superseded by

## Required boundary statement

Every ADR must include this boundary statement or a stricter equivalent:

ADRs document decisions; they do not create engine law. Boundary docs, contracts, tests, and guards remain authoritative where applicable.

## Index rule

`docs/adr/INDEX.md` must list every numbered ADR and its status.

## Template rule

New ADRs must start from `docs/adr/ADR_TEMPLATE.md`.

## Guard rule

The ADR system is checked by:

- `ci/guards/s_v1_06_adr_system_start_guard.mjs`

Do not fix ADR guard failures by weakening ADR naming, deleting required sections, or treating ADRs as product law.
