function Sync-KolosseumMainAfterMerge {
  [CmdletBinding()]
  param()

  Set-Location C:\Users\rober\kolosseum
  $ErrorActionPreference = "Stop"

  git fetch origin --prune | Out-Host
  git switch main | Out-Host

  $countsRaw = (git rev-list --left-right --count main...origin/main).Trim()
  if (-not $countsRaw) {
    throw "Sync-KolosseumMainAfterMerge: could not read divergence counts for main...origin/main"
  }

  $parts = $countsRaw -split '\s+'
  if ($parts.Count -lt 2) {
    throw "Sync-KolosseumMainAfterMerge: unexpected divergence count format: $countsRaw"
  }

  $ahead = [int]$parts[0]
  $behind = [int]$parts[1]

  if ($ahead -eq 0 -and $behind -eq 0) {
    Write-Host "local main already aligned with origin/main"
    return
  }

  if ($ahead -eq 0 -and $behind -gt 0) {
    Write-Host "local main behind origin/main; fast-forwarding"
    git pull --ff-only | Out-Host
    return
  }

  Write-Warning "local main diverged from origin/main after successful merge; hard-resetting local main to origin/main"
  git reset --hard origin/main | Out-Host
}

function Merge-KolosseumPr {
  [CmdletBinding()]
  param(
    [Parameter(Mandatory = $true)]
    [int]$PrNumber
  )

  Set-Location C:\Users\rober\kolosseum
  $ErrorActionPreference = "Stop"

  $prInfo = gh pr view $PrNumber --json mergeable,mergeStateStatus,reviewDecision,isDraft,title,url | ConvertFrom-Json

  if ($prInfo.isDraft) {
    throw "PR #$PrNumber is draft: $($prInfo.title)"
  }

  if ($prInfo.mergeable -ne "MERGEABLE") {
    throw "PR #$PrNumber is not mergeable.`nmergeable=$($prInfo.mergeable)`nmergeStateStatus=$($prInfo.mergeStateStatus)`nreviewDecision=$($prInfo.reviewDecision)`nurl=$($prInfo.url)"
  }

  gh pr checks $PrNumber --watch | Out-Host
  gh pr merge $PrNumber --squash --delete-branch --admin | Out-Host
  Sync-KolosseumMainAfterMerge
  gh run list --limit 10 | Out-Host
}