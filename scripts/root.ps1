$ErrorActionPreference="Stop"

# Portable repo-root anchor:
# - Resolve repo root as parent of this script's directory (scripts/)
$repo = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Set-Location $repo

if (-not (Test-Path -LiteralPath ".\.git")) { throw "No .git here. Not repo root: $repo" }
if (-not (Test-Path -LiteralPath ".\package.json")) { throw "package.json missing; not repo root: $repo" }

# Verify against git (handles slash differences)
$repoNorm = (Resolve-Path $repo).Path
$topNorm  = (Resolve-Path (git rev-parse --show-toplevel)).Path
if ($topNorm -ne $repoNorm) { throw "Not at repo root. git says: $topNorm" }

Write-Host "OK: repo root -> $repoNorm"
