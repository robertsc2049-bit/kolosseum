param(
  [switch]$SkipGreenFast = $false
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Write-Headline([string]$msg) {
  Write-Host ""
  Write-Host ("== " + $msg + " ==") -ForegroundColor Cyan
}

function Try-Run([scriptblock]$sb) {
  try { & $sb } catch { Write-Warning $_.Exception.Message }
}

# Always from repo root
$repo = (git rev-parse --show-toplevel).Trim()
if (-not $repo) { throw "git rev-parse --show-toplevel failed." }
Set-Location $repo

$helperPath = Join-Path $repo "scripts/gh_json_helpers.ps1"
if (-not (Test-Path $helperPath)) {
  throw "Missing helper: $helperPath"
}
. $helperPath

$canonical = "https://github.com/robertsc2049-bit/kolosseum.git"
$repoName = "robertsc2049-bit/kolosseum"

Write-Headline "origin url (fetch+push) must be canonical"
$fetch = (git remote get-url origin).Trim()
$push  = (git remote get-url --push origin).Trim()

if ($fetch -ne $canonical -or $push -ne $canonical) {
  Write-Warning ("origin is wrong. fetch='{0}' push='{1}' -> fixing to '{2}'" -f $fetch, $push, $canonical)
  git remote set-url origin $canonical
  git remote set-url --push origin $canonical
}

git remote -v

Write-Headline "global insteadOf rewrite (kolusseum -> kolosseum)"
Try-Run {
  git config --global url."$canonical".insteadOf "https://github.com/robertsc2049-bit/kolusseum.git"
}
Try-Run {
  git config --global --get-regexp '^url\..*\.insteadOf$'
}

Write-Headline "gh repo view (source of truth)"
Try-Run {
  $repoView = Invoke-GhJson -Arguments @(
    "repo", "view",
    "--repo", $repoName,
    "--json", "nameWithOwner,url"
  )
  Write-Host $repoView.nameWithOwner
  Write-Host $repoView.url
}

Write-Headline "gh run list (latest 10)"
Try-Run {
  gh run list --limit 10
}

if (-not $SkipGreenFast) {
  Write-Headline "green:fast"
  npm run green:fast
}

Write-Headline "DONE"
