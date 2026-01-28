param(
  [Parameter(Mandatory)]
  [string]$Tag
)

$ErrorActionPreference = "Stop"

if (git status --porcelain) {
  Write-Host "❌ Dirty working tree. Commit or stash before tagging." -ForegroundColor Red
  git status --short
  exit 1
}

git tag -a $Tag -m $Tag
git push --follow-tags
