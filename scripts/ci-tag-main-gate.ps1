Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Fail([string]$msg) {
  Write-Host "FAIL: tag-main gate: $msg" -ForegroundColor Red
  exit 1
}
function Info([string]$msg) {
  Write-Host "INFO: $msg" -ForegroundColor Cyan
}

# Run from repo root
$repoRoot = (& git rev-parse --show-toplevel) 2>$null
if (-not $repoRoot) { Fail "not inside a git repo" }
Set-Location $repoRoot

# Only meaningful in CI tag builds
$ref = [string]$env:GITHUB_REF
if (-not $ref.StartsWith("refs/tags/")) {
  Info "Not a tag build; gate skipped."
  exit 0
}

$tag = $ref.Substring("refs/tags/".Length)
if ($tag -notmatch '^v\d+\.\d+\.\d+$') {
  Fail "tag '$tag' must match vX.Y.Z"
}

# Ensure we actually have origin/main
& git fetch --no-tags origin main | Out-Null
if ($LASTEXITCODE -ne 0) { Fail "git fetch origin main failed" }

# Resolve SHAs
$tagCommit = (& git rev-list -n 1 $tag).Trim()
if (-not $tagCommit) { Fail "could not resolve tag commit for $tag" }

$mainCommit = (& git rev-parse origin/main).Trim()
if (-not $mainCommit) { Fail "could not resolve origin/main" }

Info "tag=$tag commit=$tagCommit"
Info "origin/main=$mainCommit"

# Gate: tagged commit must be ancestor of origin/main (i.e., contained in main history)
& git merge-base --is-ancestor $tagCommit $mainCommit
if ($LASTEXITCODE -ne 0) {
  Fail "tag $tag points to a commit not on origin/main"
}

Write-Host "PASS: tag-main gate passed ($tag is on main)." -ForegroundColor Green
exit 0
