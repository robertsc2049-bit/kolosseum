param(
  [Parameter(Mandatory)]
  [string]$Tag
)

$ErrorActionPreference = "Stop"

function Fail([string]$Message) {
  Write-Host "FAIL tag-release: $Message" -ForegroundColor Red
  exit 1
}

function Info([string]$Message) {
  Write-Host "INFO: $Message" -ForegroundColor Cyan
}

function Ok([string]$Message) {
  Write-Host "OK: $Message" -ForegroundColor Green
}

function Exec([string]$Title, [scriptblock]$Cmd) {
  Info $Title
  & $Cmd | Out-Null
  if ($LASTEXITCODE -ne 0) { Fail "$Title (exit=$LASTEXITCODE)" }
}

# --- repo root ---
$repoRoot = (& git rev-parse --show-toplevel 2>$null)
if ($LASTEXITCODE -ne 0 -or -not $repoRoot) { Fail "not inside a git repo" }
Set-Location $repoRoot.Trim()

# --- validate tag format ---
if ($Tag -notmatch '^v\d+\.\d+\.\d+$') {
  Fail "tag '$Tag' must match vX.Y.Z"
}

# --- must be on main ---
$branch = (& git branch --show-current).Trim()
if ($LASTEXITCODE -ne 0) { Fail "unable to detect current branch" }
if ($branch -ne "main") { Fail "must be on branch 'main' (current: '$branch')" }

# --- must be clean ---
$porcelain = (& git status --porcelain)
if ($LASTEXITCODE -ne 0) { Fail "git status failed" }
if ($porcelain) {
  Write-Host "Working tree status:" -ForegroundColor Yellow
  & git status --short
  Fail "dirty working tree. Commit or stash before tagging."
}

# --- fetch remote truth ---
Exec "Fetching origin/main and tags" {
  git fetch --prune origin main --tags
}

# --- must match origin/main exactly ---
$counts = (& git rev-list --left-right --count origin/main...HEAD).Trim()
if ($LASTEXITCODE -ne 0 -or -not $counts) { Fail "unable to compare HEAD to origin/main" }

$parts = $counts -split '\s+'
if ($parts.Count -lt 2) { Fail "unexpected rev-list output: '$counts'" }

$behind = [int]$parts[0]
$ahead  = [int]$parts[1]

if ($behind -ne 0 -or $ahead -ne 0) {
  Fail "local main must exactly match origin/main (behind=$behind ahead=$ahead). Run: git pull --rebase OR git push."
}

# --- tag must not exist locally ---
& git show-ref --tags --verify --quiet "refs/tags/$Tag"
if ($LASTEXITCODE -eq 0) { Fail "tag already exists locally: $Tag" }

# --- tag must not exist on origin ---
$remoteTag = (& git ls-remote --tags origin "refs/tags/$Tag" 2>$null)
if ($remoteTag) { Fail "tag already exists on origin: $Tag" }

# --- run CI ---
Exec "Running npm run ci" {
  npm run ci
}

# --- run version gate (explicit tag) ---
Exec "Running version gate against $Tag" {
  powershell -NoProfile -ExecutionPolicy Bypass -File scripts/version-gate.ps1 -Tag $Tag
}

# --- create annotated tag ---
Exec "Creating annotated tag $Tag" {
  git tag -a $Tag -m $Tag
}

# --- verify annotated tag (must be type 'tag') ---
$ttype = (& git cat-file -t $Tag 2>$null).Trim()
if ($LASTEXITCODE -ne 0 -or $ttype -ne "tag") {
  Fail "tag '$Tag' is not annotated. Use annotated tags only."
}

# --- push tag only ---
Exec "Pushing tag $Tag" {
  git push origin $Tag
}

Ok "Released $Tag"
exit 0
