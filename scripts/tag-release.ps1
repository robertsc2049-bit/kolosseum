param(
  [Parameter(Mandatory)]
  [string]$Tag
)

$ErrorActionPreference = "Stop"

function Fail([string]$msg) {
  Write-Host ("FAIL tag-release: " + $msg) -ForegroundColor Red
  exit 1
}

function Info([string]$msg) {
  Write-Host ("INFO tag-release: " + $msg) -ForegroundColor Cyan
}

# Always run from repo root
$repoRoot = (& git rev-parse --show-toplevel 2>$null)
if (-not $repoRoot) { Fail "not inside a git repo" }
Set-Location $repoRoot

# Validate tag format
if ($Tag -notmatch '^v\d+\.\d+\.\d+$') {
  Fail ("tag '" + $Tag + "' must match vX.Y.Z (e.g. v0.1.10)")
}

# Must be on main
$branch = (& git rev-parse --abbrev-ref HEAD).Trim()
if ($branch -ne "main") {
  Fail ("must run on branch 'main' (currently '" + $branch + "')")
}

# Must be clean
$dirty = (& git status --porcelain)
if ($dirty) {
  Write-Host "FAIL tag-release: Dirty working tree. Commit or stash before tagging." -ForegroundColor Red
  & git status --short
  exit 1
}

# Must match origin/main exactly
& git fetch --prune origin main | Out-Null
if ($LASTEXITCODE -ne 0) { Fail "git fetch origin main failed" }

$head = (& git rev-parse HEAD).Trim()
$originMain = (& git rev-parse origin/main).Trim()
if ($head -ne $originMain) {
  Fail ("HEAD is not exactly origin/main. Refusing to tag. HEAD=" + $head + " origin/main=" + $originMain)
}

# Tag must not exist locally
$localType = (& git cat-file -t $Tag 2>$null)
if ($LASTEXITCODE -eq 0 -and $localType) {
  Fail ("tag '" + $Tag + "' already exists locally")
}

# Tag must not exist on origin
$remoteTag = (& git ls-remote --tags origin ("refs/tags/" + $Tag) 2>$null)
if ($remoteTag) {
  Fail ("tag '" + $Tag + "' already exists on origin")
}

# Run CI before tagging (includes version gate + tests)
Info "running: npm run ci"
& npm run ci
if ($LASTEXITCODE -ne 0) { Fail "npm run ci failed; refusing to tag" }

# Re-check clean (CI must not generate tracked changes)
$dirtyAfter = (& git status --porcelain)
if ($dirtyAfter) {
  Write-Host "FAIL tag-release: CI changed the working tree. Refusing to tag." -ForegroundColor Red
  & git status --short
  exit 1
}

# Create annotated tag
Info ("creating annotated tag: " + $Tag)
& git tag -a $Tag -m $Tag
if ($LASTEXITCODE -ne 0) { Fail "git tag failed" }

# Enforce annotated tag (lightweight forbidden)
$tagType = (& git cat-file -t $Tag).Trim()
if ($tagType -ne "tag") {
  Fail ("tag '" + $Tag + "' must be an annotated tag (lightweight tags are forbidden)")
}

# Push ONLY this tag
Info ("pushing tag: " + $Tag)
& git push origin $Tag
if ($LASTEXITCODE -ne 0) { Fail ("git push origin " + $Tag + " failed") }

Write-Host ("OK tag-release: Released " + $Tag) -ForegroundColor Green
exit 0

