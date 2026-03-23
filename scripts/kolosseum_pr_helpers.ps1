function Format-KolosseumTextForConsole {
  [CmdletBinding()]
  param(
    [AllowNull()]
    [object]$Text
  )

  if ($null -eq $Text) {
    return ""
  }

  if ($Text -isnot [string] -and $Text -is [System.Collections.IEnumerable]) {
    throw "Format-KolosseumTextForConsole expects a scalar value, not a collection."
  }

  $clean = [string]$Text
  $clean = $clean -replace "`r?`n", " "
  $clean = $clean -replace "\s+", " "
  $clean = $clean.Trim()

  $clean = $clean.Replace([string][char]0x2026, "...")
  $clean = $clean -replace [regex]::Escape([string][char]0x00D4 + [string][char]0x00C7 + [string][char]0x00AA), "..."
  $clean = $clean -replace [regex]::Escape([string][char]0x00C3 + [string][char]0x201D + [string][char]0x00C3 + [string][char]0x2021 + [string][char]0x00C2 + [string][char]0x00AA), "..."

  return $clean
}

function Test-KolosseumRunRecord {
  [CmdletBinding()]
  param(
    [AllowNull()]
    [object]$Item
  )

  if ($null -eq $Item) {
    return $false
  }

  $propertyNames = @($Item.PSObject.Properties.Name)
  return (($propertyNames -contains "status") -and ($propertyNames -contains "workflowName"))
}

function Expand-KolosseumRunRecords {
  [CmdletBinding()]
  param(
    [Parameter(Mandatory = $true)]
    [object[]]$Runs
  )

  $expanded = [System.Collections.ArrayList]::new()

  function Add-KolosseumRunRecord {
    param(
      [AllowNull()]
      [object]$Node
    )

    if ($null -eq $Node) {
      return
    }

    if (Test-KolosseumRunRecord -Item $Node) {
      [void]$expanded.Add($Node)
      return
    }

    if ($Node -is [string]) {
      throw "Expand-KolosseumRunRecords: unsupported string run item shape."
    }

    if ($Node -is [System.Collections.IEnumerable]) {
      foreach ($nested in $Node) {
        Add-KolosseumRunRecord -Node $nested
      }
      return
    }

    throw "Expand-KolosseumRunRecords: unsupported run item shape: $($Node.GetType().FullName)"
  }

  foreach ($item in $Runs) {
    Add-KolosseumRunRecord -Node $item
  }

  return @($expanded.ToArray())
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
      workflow   = $workflow
      name       = $name
      state      = $state
      dedupe_key = "{0}|{1}|{2}" -f $workflow, $name, $state
    }
  }

  $deduped = foreach ($group in ($rows | Group-Object dedupe_key | Sort-Object Name)) {
    $first = $group.Group | Select-Object -First 1
    [pscustomobject]@{
      workflow = $first.workflow
      name     = $first.name
      state    = $first.state
      count    = $group.Count
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

  $flatRuns = Expand-KolosseumRunRecords -Runs $Runs

  $rows = foreach ($run in $flatRuns) {
    $status = if ($run.status -eq "completed") {
      if ([string]::IsNullOrWhiteSpace([string]$run.conclusion)) { "completed" } else { $run.conclusion }
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
      status     = $status
      workflow   = $workflow
      branch     = $branch
      event      = $event
      title      = $title
      created    = $created
      dedupe_key = "{0}|{1}|{2}|{3}|{4}|{5}" -f $status, $workflow, $branch, $event, $created, $title
    }
  }

  $deduped = foreach ($group in ($rows | Group-Object dedupe_key | Sort-Object Name)) {
    $first = $group.Group | Select-Object -First 1
    [pscustomobject]@{
      status   = $first.status
      workflow = $first.workflow
      branch   = $first.branch
      event    = $first.event
      title    = $first.title
      created  = $first.created
      count    = $group.Count
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

function Get-KolosseumLatestMainPushRunsForSha {
  [CmdletBinding()]
  param(
    [Parameter(Mandatory = $true)]
    [string]$Sha,

    [int]$Limit = 50
  )

  $runs = gh run list --branch main --event push --limit $Limit --json databaseId,headSha,workflowName,status,conclusion,event,displayTitle,createdAt,updatedAt | ConvertFrom-Json
  if (-not $runs) {
    return @()
  }

  $filtered = @(
    $runs |
      Where-Object { $_.headSha -eq $Sha -and $_.event -eq "push" } |
      Sort-Object workflowName, @{ Expression = "databaseId"; Descending = $true }
  )

  if ($filtered.Count -eq 0) {
    return @()
  }

  $latest = @(
    $filtered |
      Group-Object workflowName |
      ForEach-Object { $_.Group | Select-Object -First 1 } |
      Sort-Object workflowName
  )

  return $latest
}

$script:KolosseumRequiredPostMergeMainWorkflows = @(
  "ci",
  "engine-status",
  "green",
  "Protect main (auto-revert on CI failure)",
  "runnable-v0",
  "vertical-slice"
)
function Get-KolosseumRequiredPostMergeMainWorkflows {
  [CmdletBinding()]
  param()

  return @($script:KolosseumRequiredPostMergeMainWorkflows)
}

function Wait-KolosseumMainPostMergeRuns {
  [CmdletBinding(DefaultParameterSetName = "Minutes")]
  param(
    [Parameter(Mandatory = $true, Position = 0)]
    [Alias("HeadSha", "CommitSha", "MergeSha")]
    [string]$Sha,

    [int]$PollSeconds = 10,

    [Parameter(ParameterSetName = "Minutes")]
    [int]$TimeoutMinutes = 15,

    [Parameter(ParameterSetName = "Seconds")]
    [int]$TimeoutSeconds
  )

  if ($PSCmdlet.ParameterSetName -eq "Seconds") {
    $effectiveTimeoutSeconds = $TimeoutSeconds
  } else {
    $effectiveTimeoutSeconds = $TimeoutMinutes * 60
  }

  $requiredWorkflows = @(Get-KolosseumRequiredPostMergeMainWorkflows)

  $deadline = (Get-Date).AddSeconds($effectiveTimeoutSeconds)

  while ($true) {
    $latest = @(Get-KolosseumLatestMainPushRunsForSha -Sha $Sha)

    Write-Host ("Post-merge main runs (latest push run per workflow for sha {0}):" -f $Sha)

    if ($latest.Count -eq 0) {
      Write-Host "- [waiting] no main push runs found yet"
    } else {
      foreach ($run in $latest) {
        $state =
          if ($run.status -ne "completed") {
            "in_progress"
          } elseif ($run.conclusion -eq "success" -or $run.conclusion -eq "skipped") {
            "success"
          } else {
            "failure"
          }

        $displayTitle = Format-KolosseumTextForConsole $run.displayTitle
        Write-Host ("- [{0}] {1} | main | push | {2} | {3}" -f $state, $run.workflowName, $run.createdAt, $displayTitle)
      }
    }

    $latestByWorkflow = @{}
    foreach ($run in $latest) {
      $latestByWorkflow[$run.workflowName] = $run
    }

    $missing = @(
      $requiredWorkflows |
        Where-Object { -not $latestByWorkflow.ContainsKey($_) }
    )

    $inProgress = @(
      $requiredWorkflows |
        Where-Object {
          $latestByWorkflow.ContainsKey($_) -and
          $latestByWorkflow[$_].status -ne "completed"
        }
    )

    $failed = @(
      $requiredWorkflows |
        Where-Object {
          $latestByWorkflow.ContainsKey($_) -and
          $latestByWorkflow[$_].status -eq "completed" -and
          $latestByWorkflow[$_].conclusion -notin @("success", "skipped")
        }
    )

    if ($failed.Count -gt 0) {
      throw ("Wait-KolosseumMainPostMergeRuns: post-merge main run failure detected for sha {0} in workflow(s): {1}" -f $Sha, ($failed -join ", "))
    }

    if ($missing.Count -eq 0 -and $inProgress.Count -eq 0) {
      Write-Host ("Wait-KolosseumMainPostMergeRuns: all required post-merge main push workflows succeeded for sha {0}" -f $Sha)
      return
    }

    if ((Get-Date) -ge $deadline) {
      throw ("Wait-KolosseumMainPostMergeRuns: timeout waiting for post-merge main push workflows for sha {0}. Missing: {1}. In-progress: {2}" -f $Sha, ($missing -join ", "), ($inProgress -join ", "))
    }

    Start-Sleep -Seconds $PollSeconds
  }
}
# endregion post-merge-main-run-selection-override

# region Merge-KolosseumPr override: already-merged PRs exit cleanly
function Merge-KolosseumPr {
  [CmdletBinding()]
  param(
    [Parameter(Mandatory = $true)]
    [int]$PrNumber
  )

  function Get-KolosseumPrInfoJson {
    param(
      [Parameter(Mandatory = $true)]
      [int]$Number
    )

    $json = gh pr view $Number --json number,title,state,mergeable,mergeStateStatus,reviewDecision,url,mergedAt
    if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($json)) {
      throw "Unable to load PR #$Number via gh pr view."
    }

    return $json
  }

  function Get-KolosseumPrInfo {
    param(
      [Parameter(Mandatory = $true)]
      [int]$Number
    )

    return (Get-KolosseumPrInfoJson -Number $Number | ConvertFrom-Json)
  }

  $prInfo = Get-KolosseumPrInfo -Number $PrNumber

  if ($prInfo.state -eq "MERGED") {
    Write-Host "PR #$PrNumber already merged: $($prInfo.title)"
    if ($prInfo.mergedAt) {
      Write-Host "mergedAt=$($prInfo.mergedAt)"
    }
    Write-Host "url=$($prInfo.url)"
    return
  }

  gh pr checks $PrNumber --watch
  if ($LASTEXITCODE -ne 0) {
    throw "gh pr checks failed for PR #$PrNumber"
  }

  $prInfo = Get-KolosseumPrInfo -Number $PrNumber

  if ($prInfo.state -eq "MERGED") {
    Write-Host "PR #$PrNumber already merged: $($prInfo.title)"
    if ($prInfo.mergedAt) {
      Write-Host "mergedAt=$($prInfo.mergedAt)"
    }
    Write-Host "url=$($prInfo.url)"
    return
  }

  if (
    $prInfo.state -ne "OPEN" -or
    $prInfo.mergeable -ne "MERGEABLE" -or
    $prInfo.mergeStateStatus -eq "BLOCKED" -or
    $prInfo.reviewDecision -eq "REVIEW_REQUIRED"
  ) {
    throw "PR #$PrNumber is not mergeable. mergeable=$($prInfo.mergeable) mergeStateStatus=$($prInfo.mergeStateStatus) reviewDecision=$($prInfo.reviewDecision) url=$($prInfo.url)"
  }

  gh pr merge $PrNumber --squash --delete-branch --admin
  if ($LASTEXITCODE -ne 0) {
    throw "gh pr merge failed for PR #$PrNumber"
  }

  $postMergeInfo = Get-KolosseumPrInfo -Number $PrNumber
  if ($postMergeInfo.state -ne "MERGED") {
    throw "PR #$PrNumber merge command finished but PR state is $($postMergeInfo.state)"
  }

  Write-Host "Merged PR #${PrNumber}: $($postMergeInfo.title)"
  if ($postMergeInfo.mergedAt) {
    Write-Host "mergedAt=$($postMergeInfo.mergedAt)"
  }
  Write-Host "url=$($postMergeInfo.url)"
}
# endregion Merge-KolosseumPr override: already-merged PRs exit cleanly
