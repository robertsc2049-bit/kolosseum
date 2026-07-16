<!-- DEV NOTE: BETA-29 release rehearsal documentation only. This document creates no engine, registry, product, payment, or runtime authority. -->

# BETA-29 Production Beta Rehearsal

Slice: BETA-29
Status: release-candidate rehearsal
Scope: proof composition and operational control only

## Purpose

BETA-29 combines the existing beta proof chain into one release-candidate rehearsal command.

No product feature is added by this slice. No engine decision changes. No registry content changes. No broader runtime scope is activated.

## One-command gate

Windows command:

npm.cmd run rehearsal:beta

Portable package command:

npm run rehearsal:beta

The command must finish with:

CI_BETA_29_PRODUCTION_BETA_REHEARSAL::PASS

Any failed stage blocks beta opening.

## What the rehearsal proves

The integrated rehearsal verifies:

- a clean individual account and declaration are admitted;
- the matching individual vector executes Phase 1 through Phase 8;
- the coach-managed product path is operational;
- the coach-managed replay vector is accepted;
- the runner verdict is ACCEPTED;
- Phase 8 creates a sealed evidence envelope;
- repeated projection exports are byte-identical to stored projection bytes;
- repeated evidence exports are byte-identical to sealed evidence bytes;
- the existing copy-policy scan passes;
- organisation, team, unit, and gym runtime declarations remain unreachable;
- the tracked-file secret scan passes;
- the production dependency audit reports no high or critical findings.

## Existing proof sources

BETA-29 composes existing BETA-16 through BETA-28 proof surfaces. It does not replace their contracts or weaken their tests.

The verify-only replay runner remains authoritative for committed replay vectors. BETA-29 does not create update mode, altered-input retry, fallback behaviour, or fixture rewriting.

## Operational checklist

The controlled beta opening sequence is recorded in:

docs/releases/BETA_29_BETA_OPENING_CHECKLIST.md

The checklist links the existing rollback, release-tag, status, error-reporting, backup-reference, support, and incident surfaces.

## Boundaries

BETA-29 does not:

- create a release tag;
- deploy a service;
- access production data;
- record production secret values;
- mutate historical truth;
- rewrite sealed evidence;
- enable organisation, team, unit, or gym runtime;
- change payments;
- add dashboards;
- add analytics;
- add messaging;
- add new activities;
- alter engine behaviour.

## Failure rule

A failed rehearsal blocks beta opening.

The failure must be handled in a separate bounded fix slice. The rehearsal slice must not weaken an existing test, bypass a gate, modify expected output merely to obtain a pass, or broaden runtime scope.
