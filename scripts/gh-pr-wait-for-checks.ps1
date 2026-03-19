param(
  [Parameter(Mandatory = $true)]
  [int]$PrNumber,

  [int]$MaxAttempts = 24,

  [int]$SleepSeconds = 5
)

$ErrorActionPreference = "Stop"

if ($PrNumber -le 0) {
  throw "PrNumber must be > 0."
}

$checksAppeared = $false

for ($i = 0; $i -lt $MaxAttempts; $i++) {
  $rollupJson = $null
  try {
    $rollupJson = gh pr view $PrNumber --json statusCheckRollup 2>$null
  } catch {
    $rollupJson = $null
  }

  if ($rollupJson) {
    try {
      $rollup = $rollupJson | ConvertFrom-Json
      if ($null -ne $rollup.statusCheckRollup -and $rollup.statusCheckRollup.Count -gt 0) {
        $checksAppeared = $true
        break
      }
    } catch {
    }
  }

  $checksJson = $null
  try {
    $checksJson = gh pr checks $PrNumber --json name,state,link 2>$null
  } catch {
    $checksJson = $null
  }

  if ($checksJson) {
    try {
      $checks = $checksJson | ConvertFrom-Json
      if ($null -ne $checks -and $checks.Count -gt 0) {
        $checksAppeared = $true
        break
      }
    } catch {
    }
  }

  Start-Sleep -Seconds $SleepSeconds
}

if (-not $checksAppeared) {
  throw "PR #$PrNumber has no reported checks after waiting. STOP HERE. Do not merge this PR."
}

gh pr checks --watch $PrNumber