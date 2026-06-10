
# DEV NOTE: Repository automation script. This file exists to make a repeatable repo operation
# deterministic and reviewable. Keep side effects explicit, paths repo-root relative, and
# failure output readable for PowerShell and CI users.

powershell.exe -NoProfile -ExecutionPolicy Bypass -File C:\Users\rober\kolosseum\scripts\engine-health.ps1
