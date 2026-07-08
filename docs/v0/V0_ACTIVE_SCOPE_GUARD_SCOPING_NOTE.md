<!-- DEV NOTE: Developer documentation surface. This document explains repo behaviour or boundaries, but canonical law remains in the tracked contracts, guards, and tests. Keep docs aligned with executable checks. -->

# V0 Active Scope Guard Scoping Note

Document ID: v0_active_scope_guard_scoping_note
Version: 1.1.1
Status: authoritative
Scope class: closed_world

## Purpose

The v0 active scope guard has two operating modes.

1. Active surface scan.
2. Report-only broad scan.

The active surface scan is the CI-candidate mode. It scans live product/app/API/copy surfaces by default.

The broad scan is diagnostic only. It scans wider docs, tests, and fixtures and is expected to find excluded terms because those files often define boundaries, negative examples, objection handling, and fixture expectations.

## Active surface scan roots

Active mode scans these roots by default:

- app
- web
- admin
- server
- shared
- marketing
- emails

## Report-only roots

These roots are broad/report-only by default:

- docs
- tests
- fixtures

## Broad scan rule

Broad scan must not be wired into lint:fast. It is allowed to be expensive and noisy.

## Active scan rule

Active scan is the only CI-candidate mode.

## Opt-in marker for docs/tests/fixtures

A docs, tests, or fixtures file may be included in active CI scanning only if it contains:

v0_scope_guard: active_surface

## Final rule

The S26 guard is designed to stop v0 product/copy/API leakage, not to ban internal boundary documents, tests, or fixtures from naming excluded concepts.
