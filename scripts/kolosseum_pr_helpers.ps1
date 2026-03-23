Set-StrictMode -Version Latest

function Format-KolosseumTextForConsole {
  param(
    [Parameter(Mandatory = $true)][AllowEmptyString()][string]$Text
  )

  return ($Text -replace "`r`n", "`n" -replace "`r", "`n").TrimEnd("`n")
}

function Show-KolosseumRecentRuns {
  param(
    [string]$Repo = ""
  )

  $args = @("run", "list", "--limit", "10")
  if ($Repo) {
    $args += @("--repo", $Repo)
  }

  & gh @args
  if ($LASTEXITCODE -ne 0) {
    throw "gh run list failed."
  }
}

function Get-KolosseumPrChecksJson {
  param(
    [Parameter(Mandatory = $true)][int]$PrNumber,
    [string]$Repo = ""
  )

  $scriptPath = "scripts/gh_pr_checks_status.mjs"
  $args = @($scriptPath, "--repo")
  if ($Repo) {
    $args += $Repo
  } else {
    throw "Repo is required for Get-KolosseumPrChecksJson."
  }
  $args += @("--pr", "$PrNumber", "--json")

  $output = & node @args 2>&1
  $exitCode = $LASTEXITCODE

  $text = (($output | Out-String) -replace "`r`n", "`n" -replace "`r", "`n").Trim()
  if ([string]::IsNullOrWhiteSpace($text)) {
    throw "gh_pr_checks_status.mjs returned empty output."
  }

  try {
    $parsed = $text | ConvertFrom-Json
  } catch {
    throw "gh_pr_checks_status.mjs did not return valid JSON. Output: $text"
  }

  return [pscustomobject]@{
    ExitCode = $exitCode
    Json = $parsed
    Raw = $text
  }
}

function Wait-KolosseumPrGreen {
  param(
    [Parameter(Mandatory = $true)][int]$PrNumber,
    [Parameter(Mandatory = $true)][string]$Repo,
    [int]$MaxAttempts = 40,
    [int]$SleepSeconds = 10
  )

  for ($attempt = 1; $attempt -le $MaxAttempts; $attempt++) {
    $result = Get-KolosseumPrChecksJson -PrNumber $PrNumber -Repo $Repo
    $json = $result.Json

    $summary = [pscustomobject]@{
      attempt = $attempt
      isGreen = [bool]$json.isGreen
      hasPending = [bool]$json.hasPending
      hasFailing = [bool]$json.hasFailing
      successfulCount = [int]$json.successfulCount
      pendingCount = [int]$json.pendingCount
      failingCount = [int]$json.failingCount
      cancelledCount = [int]$json.cancelledCount
      skippedCount = [int]$json.skippedCount
      source = [string]$json.source
    } | ConvertTo-Json -Compress

    Write-Host $summary

    if ($json.hasFailing) {
      throw "PR #$PrNumber has failing checks."
    }

    if ($json.isGreen) {
      return
    }

    if ($attempt -lt $MaxAttempts) {
      Start-Sleep -Seconds $SleepSeconds
    }
  }

  throw "Timed out waiting for PR #$PrNumber to go green."
}

function Sync-KolosseumMainAfterMerge {
  git fetch --all --prune
  if ($LASTEXITCODE -ne 0) {
    throw "git fetch --all --prune failed."
  }

  git switch main
  if ($LASTEXITCODE -ne 0) {
    throw "git switch main failed."
  }

  git reset --hard origin/main
  if ($LASTEXITCODE -ne 0) {
    throw "git reset --hard origin/main failed."
  }

  git pull --ff-only
  if ($LASTEXITCODE -ne 0) {
    throw "git pull --ff-only failed."
  }
}

function Merge-KolosseumPr {
  param(
    [Parameter(Mandatory = $true)][int]$PrNumber,
    [Parameter(Mandatory = $true)][string]$Repo,
    [int]$MaxAttempts = 40,
    [int]$SleepSeconds = 10
  )

  Wait-KolosseumPrGreen -PrNumber $PrNumber -Repo $Repo -MaxAttempts $MaxAttempts -SleepSeconds $SleepSeconds

  & gh pr merge $PrNumber --repo $Repo --squash --delete-branch --admin
  if ($LASTEXITCODE -ne 0) {
    throw "gh pr merge failed for PR #$PrNumber."
  }

  Sync-KolosseumMainAfterMerge
  Show-KolosseumRecentRuns -Repo $Repo
}
