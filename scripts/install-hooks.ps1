Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Die([string]$msg) {
  Write-Host $msg -ForegroundColor Red
  exit 1
}

function Normalize-ToLf([string]$s) {
  return $s.Replace("`r`n","`n").Replace("`r","`n")
}

function Has-Utf8Bom([byte[]]$bytes) {
  return ($bytes.Length -ge 3 -and $bytes[0] -eq 0xEF -and $bytes[1] -eq 0xBB -and $bytes[2] -eq 0xBF)
}

function Read-Bytes([string]$path) {
  if (-not (Test-Path -LiteralPath $path)) { Die "Missing file: $path" }
  return [System.IO.File]::ReadAllBytes((Resolve-Path -LiteralPath $path))
}

function Read-TextUtf8([string]$path) {
  $bytes = Read-Bytes $path
  if (Has-Utf8Bom $bytes) { Die "BOM detected (refuse): $path`nFix: resave as UTF-8 (no BOM)." }
  return [System.Text.Encoding]::UTF8.GetString($bytes)
}

function Write-Utf8NoBomLf([string]$destPath, [string]$content) {
  $norm = Normalize-ToLf $content
  [System.IO.File]::WriteAllText($destPath, $norm, (New-Object System.Text.UTF8Encoding($false)))
}

function Ensure-Template-LfNoBom([string]$path, [switch]$AutoFixCrlf) {
  $bytes = Read-Bytes $path
  if (Has-Utf8Bom $bytes) { Die "BOM detected in template (refuse): $path`nFix: resave as UTF-8 (no BOM)." }

  $text = [System.Text.Encoding]::UTF8.GetString($bytes)
  if ($text.Contains("`r")) {
    if ($AutoFixCrlf) {
      Write-Host "Normalizing template CRLF -> LF: $path" -ForegroundColor Yellow
      Write-Utf8NoBomLf $path $text
      # re-read to confirm
      $bytes2 = Read-Bytes $path
      $text2 = [System.Text.Encoding]::UTF8.GetString($bytes2)
      if (Has-Utf8Bom $bytes2) { Die "BOM appeared after normalize (unexpected): $path" }
      if ($text2.Contains("`r")) { Die "CRLF still present after normalize (unexpected): $path" }
      return
    }
    Die "CRLF detected in template: $path`nFix: convert to LF-only (recommended: .gitattributes + renormalize, or resave file with LF)."
  }
}

# Must be at repo root
if (!(Test-Path -LiteralPath ".git")) { Die "Not at repo root (missing .git). cd to repo root and rerun." }

$repoRoot  = (Get-Location).Path
$hooksDir  = Join-Path $repoRoot ".git\hooks"
$tmplDir   = Join-Path $repoRoot "scripts\hooks"

if (!(Test-Path -LiteralPath $hooksDir)) { Die "Missing hooks dir: $hooksDir" }
if (!(Test-Path -LiteralPath $tmplDir))  { Die "Missing template dir: $tmplDir" }

$preCommitSrc = Join-Path $tmplDir "pre-commit"
$prePushSrc   = Join-Path $tmplDir "pre-push"

if (!(Test-Path -LiteralPath $preCommitSrc)) { Die "Missing hook template: $preCommitSrc" }
if (!(Test-Path -LiteralPath $prePushSrc))   { Die "Missing hook template: $prePushSrc" }

# Policy:
# - BOM is forbidden (hard fail)
# - CRLF in templates: auto-fix to LF (safe and consistent with repo policy)
Ensure-Template-LfNoBom $preCommitSrc -AutoFixCrlf
Ensure-Template-LfNoBom $prePushSrc   -AutoFixCrlf

$preCommitDst = Join-Path $hooksDir "pre-commit"
$prePushDst   = Join-Path $hooksDir "pre-push"

Write-Utf8NoBomLf $preCommitDst (Read-TextUtf8 $preCommitSrc)
Write-Utf8NoBomLf $prePushDst   (Read-TextUtf8 $prePushSrc)

Write-Host "Installed pre-commit hook -> $preCommitDst" -ForegroundColor Green
Write-Host "Installed pre-push   hook -> $prePushDst"   -ForegroundColor Green

# Best-effort chmod for Git Bash users
$bash = "C:\Program Files\Git\bin\bash.exe"
if (Test-Path -LiteralPath $bash) {
  & $bash -lc "chmod +x .git/hooks/pre-commit .git/hooks/pre-push" | Out-Null
  Write-Host "chmod +x applied via Git Bash" -ForegroundColor Green
} else {
  Write-Host "Git Bash not found at '$bash' (chmod skipped). If you use WSL/Git Bash, run chmod +x manually." -ForegroundColor Yellow
}

# Quick verification: installed hooks must be LF-only + no BOM
function Assert-Installed-Hook([string]$path) {
  $b = Read-Bytes $path
  if (Has-Utf8Bom $b) { Die "BOM detected in installed hook (unexpected): $path" }
  $t = [System.Text.Encoding]::UTF8.GetString($b)
  if ($t.Contains("`r")) { Die "CRLF detected in installed hook (unexpected): $path" }
}

Assert-Installed-Hook $preCommitDst
Assert-Installed-Hook $prePushDst

Write-Host "Hook install verification OK (UTF-8 no BOM, LF-only)." -ForegroundColor Green
