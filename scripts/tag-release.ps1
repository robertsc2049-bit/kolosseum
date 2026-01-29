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
  Write-Host ("INFO: " + $msg) -ForegroundColor Cyan
}

# Always run from repo root
$repoRoot = (& git rev-parse --show-toplevel) 2>$null
if (-not $repoRoot) { Fail "not inside a git repo" }
Set-Location $repoRoot

# Tag format guard
if ($Tag -notmatch '^v\d+\.\d+\.\d+$') {
  Fail ("tag '" + $Tag + "' must match vX.Y.Z (e.g. v0.1.11)")
}

# Working tree must be clean
$dirty = (& git status --porcelain)
if ($dirty) {
  Write-Host "DIRTY working tree. Commit or stash before tagging." -ForegroundColor Red
  & git status --short
  exit 1
}

# Ensure we have up-to-date origin/main locally (avoid tagging stale)
& git fetch --no-tags origin main | Out-Null
if ($LASTEXITCODE -ne 0) { Fail "git fetch origin main failed" }

# Must be on main
$branch = (& git rev-parse --abbrev-ref HEAD).Trim()
if ($branch -ne "main") {
  Fail ("must run on branch 'main' (currently '" + $branch + "')")
}

# Must not be behind origin/main
$lr = (& git rev-list --left-right --count origin/main...HEAD).Trim()
if ($LASTEXITCODE -ne 0) { Fail "failed to compare HEAD with origin/main" }

$parts = $lr -split "\s+"
$behind = [int]$parts[0]
if ($behind -ne 0) {
  Fail ("your main is behind origin/main by " + $behind + " commits. Pull/rebase first.")
}

# Refuse to create a tag if it already exists.
# If it exists, it MUST be an annotated tag, but we still refuse to overwrite.
$tagExists = $false
& git rev-parse --verify --quiet ("refs/tags/" + $Tag) | Out-Null
if ($LASTEXITCODE -eq 0) { $tagExists = $true }

if ($tagExists) {
  $tagType = (& git cat-file -t $Tag).Trim()
  if ($tagType -ne "tag") {
    Fail ("tag '" + $Tag + "' exists but is NOT annotated (lightweight tags forbidden). Delete and recreate as annotated.")
  }
  Fail ("tag '" + $Tag + "' already exists. Refusing to retag.")
}

# Run CI locally before tagging
Info "Running npm run ci before tagging..."
& npm run ci
if ($LASTEXITCODE -ne 0) { Fail "npm run ci failed - refusing to tag" }

# Ensure build/tests did not dirty the tree
$dirtyAfter = (& git status --porcelain)
if ($dirtyAfter) {
  Write-Host "BUILD changed files. Commit them before tagging." -ForegroundColor Red
  & git status --short
  exit 1
}

# Create annotated tag on current HEAD
Info ("Creating annotated tag " + $Tag + " on HEAD...")
& git tag -a $Tag -m $Tag
if ($LASTEXITCODE -ne 0) { Fail ("failed to create tag " + $Tag) }

# Push just this tag (avoid pushing other local tags)
Info ("Pushing tag " + $Tag + "...")
& git push origin ("refs/tags/" + $Tag)
if ($LASTEXITCODE -ne 0) { Fail ("failed to push tag " + $Tag) }

Write-Host ("OK: Released " + $Tag) -ForegroundColor Green
exit 0