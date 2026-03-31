# V1 Operator Freeze Runbook

## Purpose

Give one canonical operator flow for freeze, verify, and explicit no-unfreeze handling.

## Invariant

- operator flow is fixed and auditable
- Unfreeze is not allowed.
- Only lawful transition: pre_seal -> sealed.

## Canonical command sequence

```powershell
Set-Location C:\Users\rober\kolosseum
$ErrorActionPreference = "Stop"
$PSNativeCommandUseErrorActionPreference = $true
Set-StrictMode -Version Latest

node .\ci\scripts\run_registry_seal_manifest_verifier.mjs
node .\ci\scripts\run_registry_seal_scope_completeness_verifier.mjs
node .\ci\scripts\run_registry_seal_drift_diff_reporter.mjs
node .\ci\scripts\run_registry_seal_gate.mjs
node .\ci\scripts\run_registry_seal_freeze.mjs
node .\ci\scripts\run_registry_seal_gate.mjs
node .\ci\scripts\run_registry_seal_drift_diff_reporter.mjs
```

## Operator interpretation

1. Verify manifest integrity first.
2. Verify live surface completeness against manifest.
3. Verify no drift exists before freeze.
4. Verify current lifecycle/gate state.
5. Execute freeze.
6. Re-verify gate after freeze.
7. Re-verify drift after freeze.

## Forbidden actions

- Do not invent alternate freeze command sequences.
- Do not skip the pre-freeze verification steps.
- Do not attempt reverse transition.
- Do not document or execute any unfreeze flow.

## Lawful lifecycle

- pre_seal -> sealed
- sealed -> pre_seal is forbidden
- Unfreeze is not allowed.
