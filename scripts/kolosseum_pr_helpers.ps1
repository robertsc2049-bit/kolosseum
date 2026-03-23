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
    [Parameter(Mandatory = $true)][string]$Repo
  )

  $scriptPath = "scripts/gh_pr_checks_status.mjs"
  $args = @($scriptPath, "--repo", $Repo, "--pr", "$PrNumber", "--json")

  $previousNativePreference = $script:PSNativeCommandUseErrorActionPreference
  try {
    $script:PSNativeCommandUseErrorActionPreference = $false
    $output = & node @args 2>&1
    $exitCode = $LASTEXITCODE
  } finally {
    $script:PSNativeCommandUseErrorActionPreference = $previousNativePreference
  }

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

    if ($json.hasFailing) {
      Write-Host ("PR_CHECKS_FAIL attempt={0} failing={1} pending={2} successful={3}" -f $attempt, [int]$json.failingCount, [int]$json.pendingCount, [int]$json.successfulCount)
      throw "PR #$PrNumber has failing checks."
    }

    if ($json.isGreen) {
      Write-Host ("PR_CHECKS_GREEN attempt={0} failing={1} pending={2} successful={3}" -f $attempt, [int]$json.failingCount, [int]$json.pendingCount, [int]$json.successfulCount)
      return
    }

    Write-Host ("PR_CHECKS_PENDING attempt={0} failing={1} pending={2} successful={3}" -f $attempt, [int]$json.failingCount, [int]$json.pendingCount, [int]$json.successfulCount)

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
