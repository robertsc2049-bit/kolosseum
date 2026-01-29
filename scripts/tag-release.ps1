param(
  [Parameter(Mandatory)]
  [string]$Tag
)

$ErrorActionPreference = "Stop"

function Fail {
  param([string]$Message)
  Write-Host "FAIL tag-release: $Message" -ForegroundColor Red
  exit 1
}

function Info {
  param([string]$Message)
  Write-Host "INFO: $Message" -ForegroundColor Cyan
}

function Ok {
  param([string]$Message)
  Write-Host "OK: $Message" -ForegroundColor Green
}

# Always run from repo root
$repoRoot = & git rev-parse --show-toplevel 2>$null
if (-not $repoRoot) { Fail "not inside a git repo" }
Set-Location $repoRoot

# Validate tag format
if ($Tag -notmatch '^v\d+\.\d+\.\d+$') {
  Fail "tag '$Tag' must match vX.Y.Z"
}

# Must be clean
if (git status --porcelain) {
  Fail "Dirty working tree. Commit or stash before tagging.`n$(git status --short)"
}

# Must be on main
$branch = (git branch --show-current).Trim()
if ($branch -ne "main") {
  Fail "Must be on branch 'main' (current: '$branch')"
}

# Fetch refs
Info "Fetching origin/main and tags"
git fetch --no-tags origin main | Out-Null
git fetch --tags origin | Out-Null

# Must match origin/main exactly
$counts = (git rev-list --left-right --count origin/main...HEAD).Trim()
$behind, $ahead = $counts -split '\s+'

if ([int]$behind -ne 0 -or [int]$ahead -ne 0) {
  Fail "Local main must exactly match origin/main (behind=$behind ahead=$ahead)"
}

# Tag must not already exist
if (git show-ref --tags --verify --quiet "refs/tags/$Tag") {
  Fail "tag already exists locally: $Tag"
}

if (git ls-remote --tags origin "refs/tags/$Tag") {
  Fail "tag already exists on origin: $Tag"
}

# Run CI
Info "Running npm run ci"
npm run ci
if ($LASTEXITCODE -ne 0) {
  Fail "npm run ci failed"
}

# Version gate
Info "Running version gate"
powershell -NoProfile -ExecutionPolicy Bypass `
  -File scripts/version-gate.ps1 -Tag $Tag

if ($LASTEXITCODE -ne 0) {
  Fail "version gate failed"
}

# Create annotated tag
Info "Creating tag $Tag"
git tag -a $Tag -m $Tag

# Push only the tag
Info "Pushing tag $Tag"
git push origin $Tag

Ok "Released $Tag"
