param(
  [string]$Workflow = "vertical-slice",
  [int]$Limit = 50,
  [string]$Branch,
  [ValidateSet("any","pull_request","push","workflow_dispatch","schedule")]
  [string]$Event = "any",
  [string]$Repo = "robertsc2049-bit/kolosseum",
  [switch]$Web
)

Set-Location C:\Users\rober\kolosseum
$ErrorActionPreference = "Stop"

if (-not $Branch -or $Branch.Trim() -eq "") {
  $Branch = (git branch --show-current).Trim()
}

# Normalize common inputs:
# - origin/main -> main
# - refs/heads/main -> main
$Branch = $Branch.Trim()
if ($Branch -match "^(origin/)(.+)$") { $Branch = $Matches[2] }
if ($Branch -match "^refs/heads/(.+)$") { $Branch = $Matches[1] }

# IMPORTANT:
# Fetch runs server-side filtered by branch so older branches (e.g. main)
# are not pushed out of the global top-N by noisy PR branches.
$runs = gh run list `
  --repo $Repo `
  --branch $Branch `
  --limit $Limit `
  --json databaseId,workflowName,name,headBranch,createdAt,status,conclusion,displayTitle,event,url `
  | ConvertFrom-Json

$run = $runs `
  | Where-Object {
      ($_.workflowName -eq $Workflow -or $_.name -eq $Workflow) -and
      ($Event -eq "any" -or $_.event -eq $Event)
    } `
  | Sort-Object createdAt -Descending `
  | Select-Object -First 1

if (-not $run) {
  "No run found. repo='$Repo' workflow='$Workflow' branch='$Branch' event='$Event'. Recent runs on this branch:"
  $runs `
    | Where-Object { $Event -eq "any" -or $_.event -eq $Event } `
    | Sort-Object createdAt -Descending `
    | Select-Object -First 20 databaseId,workflowName,name,event,status,conclusion,createdAt,displayTitle `
    | Format-Table -AutoSize
  exit 1
}

$runId = $run.databaseId
"Selected: repo=$Repo workflow=$Workflow branch=$Branch event=$($run.event) databaseId=$runId status=$($run.status) conclusion=$($run.conclusion)"
"Title: $($run.displayTitle)"
"URL:   $($run.url)"

if ($Web) {
  Start-Process $run.url
  exit 0
}

if ($run.status -ne "completed") {
  gh run watch --repo $Repo $runId --interval 5
}
elseif ($run.conclusion -ne "success") {
  gh run view --repo $Repo $runId --log-failed
}
else {
  gh run view --repo $Repo $runId
}