[CmdletBinding()]
param(
  [ValidateSet("patch","minor","major")]
  [string]$Bump = "patch"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Die([string]$msg) {
  Write-Host $msg -ForegroundColor Red
  exit 1
}

function Run([string]$cmd) {
  Write-Host ">> $cmd" -ForegroundColor Cyan
  Invoke-Expression $cmd
  if ($LASTEXITCODE -ne 0) { Die "Command failed ($LASTEXITCODE): $cmd" }
}

function Read-Version() {
  (node -e "process.stdout.write(require('./package.json').version)").Trim()
}

function Remote-Tag-Exists([string]$tag) {
  $out = (git ls-remote --tags origin $tag) 2>$null
  return [bool]($out -and $out.Trim().Length -gt 0)
}

# Must be at repo root
if (!(Test-Path ".git")) { Die "Not at repo root (missing .git). cd to repo root and rerun." }

# Must be on main
$branch = (git branch --show-current).Trim()
if ($branch -ne "main") { Die "Refusing to release from branch '$branch'. Switch to 'main' first." }

# Must be clean BEFORE doing anything
$status = git status --porcelain
if ($status) {
  Write-Host $status
  Die "Working tree is not clean. Commit/stash/revert changes before releasing."
}

# Must not be mid-merge/rebase
if ((Test-Path ".git\rebase-apply") -or (Test-Path ".git\rebase-merge")) { Die "Rebase in progress. Finish it before releasing." }
if (Test-Path ".git\MERGE_HEAD") { Die "Merge in progress. Finish it before releasing." }

# Fetch origin + tags, ensure aligned
Run "git fetch --tags origin | Out-Null"
$local = (git rev-parse HEAD).Trim()
$remote = (git rev-parse origin/main).Trim()
if ($local -ne $remote) {
  Die "main is not aligned with origin/main.`nlocal : $local`nremote: $remote`nPull/rebase first."
}

# Gate before any mutation
Run "npm run ci"

# Preflight: compute the next version without committing/tagging.
# npm version outputs the new version tag string like "v0.1.23" when --no-git-tag-version is used.
# But we do NOT want to mutate yet, so we simulate by reading current and checking remote only AFTER bump.
# The safe approach is: bump, read version, then if remote tag exists -> abort with instructions (no force).
# Because we already know tags are immutable, collision means you must bump again.

# Bump version WITHOUT creating a git tag (this mutates package files)
Run "npm version $Bump --no-git-tag-version"

$ver = Read-Version
if (-not $ver) { Die "Failed to read version from package.json after bump." }

$tag = "v$ver"

# Collision check BEFORE commit/tag
if (Remote-Tag-Exists $tag) {
  Die "Remote tag already exists: $tag`nYour repo uses immutable tags. Bump again (patch/minor/major) and retry."
}

# Commit bump
Run "git add package.json package-lock.json"
Run "git commit -m ""chore(release): $tag"""

# Local tag collision check
$existingLocal = (git tag -l $tag).Trim()
if ($existingLocal) {
  Die "Local tag already exists: $tag`nRefusing to proceed."
}

# Create annotated tag
Run "git tag -a ""$tag"" -m ""$tag"""

# Final gate on exact tagged commit
Run "npm run ci"

# Push commit + tag
Run "git push origin main"
Run "git push origin ""$tag"""

Write-Host ""
Write-Host "RELEASED $tag" -ForegroundColor Green
