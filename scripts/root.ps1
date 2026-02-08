$ErrorActionPreference="Stop"

# HARD ANCHOR: your actual repo path
$repo = "C:\Users\rober\kolosseum"

if (-not (Test-Path -LiteralPath $repo)) { throw "Repo path missing: $repo" }
Set-Location $repo

if (-not (Test-Path -LiteralPath ".\.git")) { throw "No .git here. Not repo root: $repo" }
if (-not (Test-Path -LiteralPath ".\package.json")) { throw "package.json missing; not repo root: $repo" }

# Normalize + verify against git (handles slash differences)
$repoNorm = (Resolve-Path $repo).Path
$topNorm  = (Resolve-Path (git rev-parse --show-toplevel)).Path
if ($topNorm -ne $repoNorm) { throw "Not at repo root. git says: $topNorm" }

Write-Host "OK: repo root -> $repoNorm"
