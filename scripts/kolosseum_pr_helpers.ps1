function Format-KolosseumTextForConsole {
  [CmdletBinding()]
  param(
    [AllowNull()]
    [string]$Text
  )

  if ($null -eq $Text) {
    return ""
  }

  $clean = $Text
  $clean = $clean -replace "`r?`n", " "
  $clean = $clean -replace "\s+", " "
  $clean = $clean.Trim()

  $clean = $clean.Replace([string][char]0x2026, "...")
  $clean = $clean -replace [regex]::Escape([string][char]0x00D4 + [string][char]0x00C7 + [string][char]0x00AA), "..."
  $clean = $clean -replace [regex]::Escape([string][char]0x00C3 + [string][char]0x201D + [string][char]0x00C3 + [string][char]0x2021 + [string][char]0x00C2 + [string][char]0x00AA), "..."

  return $clean
}

function Get-KolosseumDedupedCheckSummaryRows {
  [CmdletBinding()]
  param(
    [Parameter(Mandatory = $true)]
    [object[]]$Checks
  )

  $rows = foreach ($check in $Checks) {
    $workflow = Format-KolosseumTextForConsole $check.workflow
    $name = Format-KolosseumTextForConsole $check.name
    $state = (Format-KolosseumTextForConsole $check.state).ToUpperInvariant()

    [pscustomobject]@{
      workflow = $workflow
      name = $name
      state = $state
      dedupe_key = "{0}|{1}|{2}" -f $workflow, $name, $state
    }
  }

  $deduped = foreach ($group in ($rows | Group-Object dedupe_key | Sort-Object Name)) {
    $first = $group.Group | Select-Object -First 1
    [pscustomobject]@{
      workflow = $first.workflow
      name = $first.name
      state = $first.state
      count = $group.Count
    }
  }

  return $deduped
}

function Get-KolosseumDedupedRecentRunRows {
  [CmdletBinding()]
  param(
    [Parameter(Mandatory = $true)]
    [object[]]$Runs
  )

  $rows = foreach ($run in $Runs) {
    $status = if ($run.status -eq "completed") {
      if ([string]::IsNullOrWhiteSpace($run.conclusion)) { "completed" } else { $run.conclusion }
    } else {
      $run.status
    }

    $status = Format-KolosseumTextForConsole $status
    $workflow = Format-KolosseumTextForConsole $run.workflowName
    $branch = Format-KolosseumTextForConsole $run.headBranch
    $event = Format-KolosseumTextForConsole $run.event
    $title = Format-KolosseumTextForConsole $run.displayTitle
    $created = Format-KolosseumTextForConsole $run.createdAt

    [pscustomobject]@{
      status = $status
      workflow = $workflow
      branch = $branch
      event = $event
      title = $title
      created = $created
      dedupe_key = "{0}|{1}|{2}|{3}|{4}|{5}" -f $status, $workflow, $branch, $event, $created, $title
    }
  }

  $deduped = foreach ($group in ($rows | Group-Object dedupe_key | Sort-Object Name)) {
    $first = $group.Group | Select-Object -First 1
    [pscustomobject]@{
      status = $first.status
      workflow = $first.workflow
      branch = $first.branch
      event = $first.event
      title = $first.title
      created = $first.created
      count = $group.Count
    }
  }

  return $deduped
}

function Show-KolosseumCheckSummary {
  [CmdletBinding()]
  param(
    [Parameter(Mandatory = $true)]
    [int]$PrNumber
  )

  $checksJson = gh pr checks $PrNumber --json name,state,workflow,bucket,link 2>$null
  if (-not $checksJson) {
    Write-Host "Checks: no structured results returned for PR #$PrNumber"
    return
  }

  $checks = $checksJson | ConvertFrom-Json
  if (-not $checks) {
    Write-Host "Checks: no checks found for PR #$PrNumber"
    return
  }

  $summaryRows = Get-KolosseumDedupedCheckSummaryRows -Checks @($checks)

  Write-Host "Checks summary:"
  foreach ($row in $summaryRows) {
    $countSuffix = if ($row.count -gt 1) { " x$($row.count)" } else { "" }

    if ([string]::IsNullOrWhiteSpace($row.workflow)) {
      Write-Host ("- [{0}] {1}{2}" -f $row.state, $row.name, $countSuffix)
    } else {
      Write-Host ("- [{0}] {1} / {2}{3}" -f $row.state, $row.workflow, $row.name, $countSuffix)
    }
  }
}

function Show-KolosseumRecentRuns {
  [CmdletBinding()]
  param(
    [int]$Limit = 10
  )

  $runsJson = gh run list --limit $Limit --json status,conclusion,workflowName,headBranch,event,displayTitle,createdAt 2>$null
  if (-not $runsJson) {
    Write-Host "Recent runs: no structured results returned"
    return
  }

  $runs = $runsJson | ConvertFrom-Json
  if (-not $runs) {
    Write-Host "Recent runs: none"
    return
  }

  $recentRows = Get-KolosseumDedupedRecentRunRows -Runs @($runs)

  Write-Host "Recent runs:"
  foreach ($row in $recentRows) {
    $countSuffix = if ($row.count -gt 1) { " x$($row.count)" } else { "" }
    Write-Host ("- [{0}] {1} | {2} | {3} | {4} | {5}{6}" -f $row.status, $row.workflow, $row.branch, $row.event, $row.created, $row.title, $countSuffix)
  }
}

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
  $prTitle = Format-KolosseumTextForConsole $prInfo.title

  if ($prInfo.isDraft) {
    throw "PR #$PrNumber is draft: $prTitle"
  }

  if ($prInfo.mergeable -ne "MERGEABLE") {
    throw "PR #$PrNumber is not mergeable.`nmergeable=$($prInfo.mergeable)`nmergeStateStatus=$($prInfo.mergeStateStatus)`nreviewDecision=$($prInfo.reviewDecision)`nurl=$($prInfo.url)"
  }

  Write-Host ("Watching checks for PR #{0}: {1}" -f $PrNumber, $prTitle)
  gh pr checks $PrNumber --watch | Out-Null
  Show-KolosseumCheckSummary -PrNumber $PrNumber

  Write-Host ("Merging PR #{0}: {1}" -f $PrNumber, $prTitle)
  gh pr merge $PrNumber --squash --delete-branch --admin | Out-Host

  Sync-KolosseumMainAfterMerge
  Show-KolosseumRecentRuns -Limit 10
}