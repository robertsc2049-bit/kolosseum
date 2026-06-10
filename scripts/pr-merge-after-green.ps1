param(
  [Parameter(Mandatory = $true)]
  [string]$Repo,

  [Parameter(Mandatory = $true)]
  [int]$PrNumber,

  [int]$Attempts = 20,
  [int]$DelaySeconds = 15,

  [switch]$NoDeleteBranch,
  [switch]$NoSyncMain
)

$ErrorActionPreference = "Stop"

function Fail([string]$Message) {
  throw $Message
}

function Ensure-RepoRoot {
  $repoRoot = (git rev-parse --show-toplevel) 2>$null
  if (-not $repoRoot) {
    Fail "Not inside a git repository."
  }

  Set-Location $repoRoot
}

function Run-Poller {
  param(
    [Parameter(Mandatory = $true)][string]$Repo,
    [Parameter(Mandatory = $true)][int]$PrNumber,
    [Parameter(Mandatory = $true)][int]$Attempts,
    [Parameter(Mandatory = $true)][int]$DelaySeconds
  )

  $poll = & node scripts/gh_pr_checks_poll_until_green.mjs `
    --repo $Repo `
    --pr $PrNumber `
    --attempts $Attempts `
    --delay-seconds $DelaySeconds `
    --json 2>&1

  if ($LASTEXITCODE -ne 0) {
    $detail = ($poll | Out-String).Trim()
    if (-not $detail) {
      $detail = "poller failed without output"
    }
    Fail "PR poller failed: $detail"
  }

  $json = ($poll | Out-String).Trim()
  if (-not $json) {
    Fail "PR poller returned empty output."
  }

  $parsed = $json | ConvertFrom-Json
  if (-not $parsed.ok) {
    Fail "PR checks did not reach green. reason=$($parsed.reason)"
  }

  return $parsed
}

function Merge-Pr {
  param(
    [Parameter(Mandatory = $true)][string]$Repo,
    [Parameter(Mandatory = $true)][int]$PrNumber,
    [Parameter(Mandatory = $true)][bool]$DeleteBranch
  )

  $args = @(
    "pr", "merge", $PrNumber,
    "--repo", $Repo,
    "--squash",
    "--admin"
  )

  if ($DeleteBranch) {
    $args += "--delete-branch"
  }

  & gh @args
  if ($LASTEXITCODE -ne 0) {
    Fail "gh pr merge failed."
  }
}

function Sync-Main {
  git fetch --all --prune
  if ($LASTEXITCODE -ne 0) { Fail "git fetch --all --prune failed." }

  git switch main
  if ($LASTEXITCODE -ne 0) { Fail "git switch main failed." }

  git reset --hard origin/main
  if ($LASTEXITCODE -ne 0) { Fail "git reset --hard origin/main failed." }

  git pull --ff-only
  if ($LASTEXITCODE -ne 0) { Fail "git pull --ff-only failed." }
}

Ensure-RepoRoot

Write-Host "== pr:merge:admin =="
Write-Host ("repo:         {0}" -f $Repo)
Write-Host ("pr:           {0}" -f $PrNumber)
Write-Host ("attempts:     {0}" -f $Attempts)
Write-Host ("delaySeconds: {0}" -f $DelaySeconds)
Write-Host ("deleteBranch: {0}" -f $(-not $NoDeleteBranch))
Write-Host ("syncMain:     {0}" -f $(-not $NoSyncMain))

Write-Host ""
Write-Host "== poll until green =="
$pollResult = Run-Poller -Repo $Repo -PrNumber $PrNumber -Attempts $Attempts -DelaySeconds $DelaySeconds
$pollJson = $pollResult | ConvertTo-Json -Depth 16 -Compress
Write-Host $pollJson

Write-Host ""
Write-Host "== merge PR =="
Merge-Pr -Repo $Repo -PrNumber $PrNumber -DeleteBranch (-not $NoDeleteBranch)

if (-not $NoSyncMain) {
  Write-Host ""
  Write-Host "== sync local main =="
  Sync-Main
}

Write-Host ""
Write-Host "== done =="
