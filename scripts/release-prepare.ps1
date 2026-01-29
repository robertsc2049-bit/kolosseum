# scripts/release-prepare.ps1
# Purpose:
#   - Enforce a clean, repeatable "bump -> build -> ci -> commit -> push" flow
#   - Write src/version.ts + package.json version (UTF-8 without BOM)
#   - Run npm run ci
#   - Refuse unexpected diffs (only those two files may change)
#   - Commit + push to origin/main
#
# Usage:
#   powershell -NoProfile -ExecutionPolicy Bypass -File scripts/release-prepare.ps1 -Version 0.1.14
#
param(
  [Parameter(Mandatory)]
  [string]$Version,

  # If set, allows your local main to be ahead of origin/main (still requires clean tree).
  [switch]$AllowAhead = $false,

  # Commit message override (default: "Release: bump version to X.Y.Z")
  [string]$Message = ""
)

$ErrorActionPreference = "Stop"

function Fail([string]$msg) {
  Write-Host "FAIL release-prepare: $msg" -ForegroundColor Red
  exit 1
}

function Info([string]$msg) {
  Write-Host "INFO: $msg" -ForegroundColor Cyan
}

function Ok([string]$msg) {
  Write-Host "OK: $msg" -ForegroundColor Green
}

function Read-TextUtf8NoBom([string]$path) {
  if (-not (Test-Path $path)) { Fail "missing file: $path" }
  $bytes = [System.IO.File]::ReadAllBytes($path)
  if ($bytes.Length -ge 3 -and $bytes[0] -eq 0xEF -and $bytes[1] -eq 0xBB -and $bytes[2] -eq 0xBF) {
    Fail "$path has UTF-8 BOM (must be UTF-8 without BOM)"
  }
  return [System.Text.Encoding]::UTF8.GetString($bytes)
}

function Write-TextUtf8NoBom([string]$path, [string]$text) {
  $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText((Resolve-Path (Split-Path -Parent $path)).Path + "\" + (Split-Path -Leaf $path), $text, $utf8NoBom)
}

function Exec([string]$cmd) {
  Info $cmd
  & powershell -NoProfile -Command $cmd
  if ($LASTEXITCODE -ne 0) { Fail "command failed: $cmd" }
}

# --- Validate version format X.Y.Z ---
if ($Version -notmatch '^\d+\.\d+\.\d+$') {
  Fail "Version must be X.Y.Z (e.g. 0.1.14). Got: '$Version'"
}

$Tag = "v$Version"
if (-not $Message) { $Message = "Release: bump version to $Version" }

# --- Ensure we are in repo root ---
$repoRoot = (git rev-parse --show-toplevel) 2>$null
if (-not $repoRoot) { Fail "not inside a git repo" }
Set-Location $repoRoot

# --- Ensure on main ---
$branch = (& git rev-parse --abbrev-ref HEAD).Trim()
if ($branch -ne "main") { Fail "must run on branch 'main' (current: '$branch')" }

# --- Must be clean BEFORE changes ---
if (git status --porcelain) {
  Write-Host "Working tree status:" -ForegroundColor Yellow
  git status --short
  Fail "dirty working tree. Commit or stash before preparing a release."
}

# --- Refuse if HEAD is currently exactly tagged vX.Y.Z (release tag must be created AFTER prepare) ---
$headTag = (& git describe --tags --exact-match 2>$null).Trim()
if ($headTag -match '^v\d+\.\d+\.\d+$') {
  Fail "HEAD is already tagged ($headTag). Release-prepare must run on an untagged commit. Move HEAD forward (commit something) or checkout the intended commit."
}

Info "Fetching origin/main and tags"
& git fetch --tags --prune origin main | Out-Null
if ($LASTEXITCODE -ne 0) { Fail "git fetch origin main failed" }

# --- Ensure local main is not behind origin/main ---
$localHead  = (& git rev-parse HEAD).Trim()
$remoteHead = (& git rev-parse origin/main).Trim()

if ($localHead -ne $remoteHead) {
  # If local is behind -> hard fail.
  & git merge-base --is-ancestor $localHead $remoteHead | Out-Null
  if ($LASTEXITCODE -eq 0) {
    Fail "local main is behind origin/main. Run: git pull --rebase"
  }

  # If local is ahead -> allow only if -AllowAhead
  & git merge-base --is-ancestor $remoteHead $localHead | Out-Null
  if ($LASTEXITCODE -eq 0) {
    if (-not $AllowAhead) {
      Fail "local main is ahead of origin/main. Push first or rerun with -AllowAhead."
    }
    Info "local main is ahead of origin/main (allowed by -AllowAhead)."
  } else {
    Fail "local main and origin/main have diverged. Fix history before releasing."
  }
}

# --- Refuse if tag exists locally or on origin (defensive) ---
if (git show-ref --tags --verify --quiet "refs/tags/$Tag") {
  Fail "tag already exists locally: $Tag"
}

$remoteTag = (& git ls-remote --tags origin "refs/tags/$Tag") 2>$null
if ($remoteTag) {
  Fail "tag already exists on origin: $Tag"
}

# --- Update src/version.ts (UTF-8 no BOM) ---
$versionTsPath = Join-Path $repoRoot "src/version.ts"
if (-not (Test-Path $versionTsPath)) { Fail "missing src/version.ts" }

$versionTs = "export const VERSION = `"$Version`";`n"
Write-TextUtf8NoBom $versionTsPath $versionTs
Ok "Updated src/version.ts -> $Version"

# --- Update package.json version (preserve valid JSON; write UTF-8 no BOM) ---
$pkgPath = Join-Path $repoRoot "package.json"
if (-not (Test-Path $pkgPath)) { Fail "missing package.json" }

$pkgText = Read-TextUtf8NoBom $pkgPath
try {
  $pkgObj = $pkgText | ConvertFrom-Json
} catch {
  Fail "package.json is not valid JSON: $($_.Exception.Message)"
}

$pkgObj.version = $Version

# ConvertTo-Json will reformat. That's fine as long as it's valid JSON.
# Use enough depth to preserve scripts/deps.
$pkgOut = $pkgObj | ConvertTo-Json -Depth 32
# Ensure trailing newline (git friendliness)
$pkgOut = $pkgOut.TrimEnd() + "`n"
Write-TextUtf8NoBom $pkgPath $pkgOut
Ok "Updated package.json version -> $Version"

# --- Build + CI ---
Info "Running npm run ci"
& npm run ci
if ($LASTEXITCODE -ne 0) { Fail "npm run ci failed" }
Ok "npm run ci passed"

# --- Ensure only expected files changed ---
$changed = (& git status --porcelain).Trim()
if (-not $changed) {
  Fail "no changes detected after bump. Something is wrong."
}

$allowed = @(
  " M package.json",
  " M src/version.ts"
)

$lines = (& git status --porcelain) | ForEach-Object { $_.TrimEnd() }
foreach ($l in $lines) {
  if ($allowed -notcontains $l) {
    Write-Host "Unexpected change detected:" -ForegroundColor Yellow
    & git status --short
    Fail "unexpected file changes. Only src/version.ts and package.json may change in release-prepare."
  }
}

# --- Commit ---
Info "Staging release files"
& git add src/version.ts package.json
if ($LASTEXITCODE -ne 0) { Fail "git add failed" }

Info "Committing: $Message"
& git commit -m $Message
if ($LASTEXITCODE -ne 0) { Fail "git commit failed" }
Ok "Committed release bump"

# --- Push ---
Info "Pushing to origin/main"
& git push origin main
if ($LASTEXITCODE -ne 0) { Fail "git push failed" }
Ok "Pushed to origin/main"

Write-Host ""
Ok "Release prepare complete."
Write-Host ("Next: run your tag script after this commit is on origin/main: `n  .\scripts\tag-release.ps1 {0}" -f $Tag) -ForegroundColor Cyan
exit 0
