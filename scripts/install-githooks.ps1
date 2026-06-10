param()

$ErrorActionPreference = "Stop"

# Must run from repo root.
if (-not (Test-Path -LiteralPath ".\.git")) { throw "Not in repo root (.git missing)." }
if (-not (Test-Path -LiteralPath ".\.githooks\pre-push")) { throw "Missing .githooks\pre-push" }

$src = Join-Path (Get-Location) ".githooks\pre-push"
$dstDir = Join-Path (Get-Location) ".git\hooks"
$dst = Join-Path $dstDir "pre-push"

New-Item -ItemType Directory -Force -Path $dstDir | Out-Null

Copy-Item -Force -LiteralPath $src -Destination $dst

# Ensure LF-only (Git hook shells can be picky).
# If you ever edit hooks, always write LF.
$raw = Get-Content -LiteralPath $dst -Raw
$lf = $raw -replace "`r`n", "`n"
[System.IO.File]::WriteAllText((Resolve-Path $dst), $lf, (New-Object System.Text.UTF8Encoding($false)))

Write-Host "OK: installed .git/hooks/pre-push from .githooks/pre-push"