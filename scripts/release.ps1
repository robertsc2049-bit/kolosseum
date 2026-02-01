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

# Must not be mid-merge/rebase (NOTE: parentheses required around Test-Path calls)
if ((Test-Path ".git\rebase-apply") -or (Test-Path ".git\rebase-merge")) { Die "Rebase in progress. Finish it before releasing." }
if (Test-Path ".git\MERGE_HEAD") { Die "Merge in progress. Finish it before releasing." }

# Ensure aligned with origin/main
Run "git fetch --tags origin | Out-Null"
$local = (git rev-parse HEAD).Trim()
$remote = (git rev-parse origin/main).Trim()
if ($local -ne $remote) {
  Die "main is not aligned with origin/main.`nlocal : $local`nremote: $remote`nPull/rebase first."
}

# Gate
Run "npm run ci"

# Bump version WITHOUT tag
Run "npm version $Bump --no-git-tag-version"

$ver = (node -p ""require('./package.json').version"").Trim()
if (-not $ver) { Die "Failed to read version from package.json after bump." }

# Commit bump
Run "git add package.json package-lock.json"
Run "git commit -m ""chore(release): v$ver"""

# Tag (annotated)
$tag = "v$ver"

$existingLocal = (git tag -l $tag).Trim()
if ($existingLocal) { Die "Tag already exists locally: $tag" }

$existingRemote = (git ls-remote --tags origin $tag) 2>$null
if ($existingRemote) { Die "Tag already exists on origin: $tag" }

# Create annotated tag (message uses ${ver} pattern to avoid ':' interpolation edge cases elsewhere)
Run "git tag -a ""$tag"" -m ""v$ver"""

# Gate again on tagged state
Run "npm run ci"

# Push
Run "git push origin main"
Run "git push origin ""$tag"""

Write-Host ""
Write-Host "RELEASED $tag" -ForegroundColor Green
