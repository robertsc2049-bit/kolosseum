Set-StrictMode -Version Latest

param(
  [Parameter(Mandatory = $true)][int]$PrNumber,
  [Parameter(Mandatory = $true)][string]$Repo,
  [int]$MaxAttempts = 40,
  [int]$SleepSeconds = 10
)

$helperPath = Join-Path $PSScriptRoot "kolosseum_pr_helpers.ps1"
. $helperPath

Wait-KolosseumPrGreen -PrNumber $PrNumber -Repo $Repo -MaxAttempts $MaxAttempts -SleepSeconds $SleepSeconds
