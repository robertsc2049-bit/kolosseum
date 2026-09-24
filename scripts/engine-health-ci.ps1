
# DEV NOTE: Repository automation script. This file exists to make a repeatable repo operation
# deterministic and reviewable. Keep side effects explicit, paths repo-root relative, and
# failure output readable for PowerShell and CI users.

$EngineHealthScript = Join-Path $PSScriptRoot "engine-health.ps1"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File $EngineHealthScript -Ci
