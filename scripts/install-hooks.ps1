Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Die([string]$msg) {
  Write-Host $msg -ForegroundColor Red
  exit 1
}

function Write-Utf8NoBomLf([string]$destPath, [string]$content) {
  $norm = $content.Replace("`r`n","`n").Replace("`r","`n")
  [System.IO.File]::WriteAllText($destPath, $norm, (New-Object System.Text.UTF8Encoding($false)))
}

# Must be at repo root
if (!(Test-Path ".git")) { Die "Not at repo root (missing .git). cd to repo root and rerun." }

$hooksDir = Join-Path (Get-Location) ".git\hooks"
if (!(Test-Path $hooksDir)) { Die "Missing hooks dir: $hooksDir" }

# Canonical templates live here
$tmplDir = Join-Path (Get-Location) "scripts\hooks"
$preCommitSrc = Join-Path $tmplDir "pre-commit"
$prePushSrc   = Join-Path $tmplDir "pre-push"

if (!(Test-Path $tmplDir))      { Die "Missing template dir: $tmplDir" }
if (!(Test-Path $preCommitSrc)) { Die "Missing hook template: $preCommitSrc" }
if (!(Test-Path $prePushSrc))   { Die "Missing hook template: $prePushSrc" }

$preCommitDst = Join-Path $hooksDir "pre-commit"
$prePushDst   = Join-Path $hooksDir "pre-push"

# Write UTF-8 no BOM, LF
Write-Utf8NoBomLf $preCommitDst (Get-Content -Raw $preCommitSrc)
Write-Utf8NoBomLf $prePushDst   (Get-Content -Raw $prePushSrc)

Write-Host "Installed pre-commit hook -> $preCommitDst" -ForegroundColor Green
Write-Host "Installed pre-push   hook -> $prePushDst"   -ForegroundColor Green

# Best-effort chmod for Git Bash users
$bash = "C:\Program Files\Git\bin\bash.exe"
if (Test-Path $bash) {
  & $bash -lc "chmod +x .git/hooks/pre-commit .git/hooks/pre-push" | Out-Null
  Write-Host "chmod +x applied via Git Bash" -ForegroundColor Green
} else {
  Write-Host "Git Bash not found at '$bash' (chmod skipped). If you use WSL/Git Bash, run chmod +x manually." -ForegroundColor Yellow
}
