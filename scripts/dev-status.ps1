param(
  [switch]$Full
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Info($msg) { Write-Host $msg -ForegroundColor Cyan }
function OK($msg)   { Write-Host $msg -ForegroundColor Green }
function WARN($msg) { Write-Host $msg -ForegroundColor Yellow }
function FAIL($msg) { Write-Host $msg -ForegroundColor Red; exit 1 }

function Invoke-ExternalWithTimeout {
  param(
    [Parameter(Mandatory=$true)][string]$FilePath,
    [string[]]$ArgumentList = @(),
    [int]$TimeoutSeconds = 5
  )

  $p = New-Object System.Diagnostics.Process
  $p.StartInfo = New-Object System.Diagnostics.ProcessStartInfo
  $p.StartInfo.FileName = $FilePath
  $p.StartInfo.Arguments = ($ArgumentList -join " ")
  $p.StartInfo.RedirectStandardOutput = $true
  $p.StartInfo.RedirectStandardError = $true
  $p.StartInfo.UseShellExecute = $false
  $p.StartInfo.CreateNoWindow = $true

  if (-not $p.Start()) { return @{ ok=$false; code=$null; out=""; err="failed to start" } }

  if (-not $p.WaitForExit($TimeoutSeconds * 1000)) {
    try { $p.Kill() } catch { }
    return @{ ok=$false; code=$null; out=""; err="timeout" }
  }

  $out = $p.StandardOutput.ReadToEnd()
  $err = $p.StandardError.ReadToEnd()
  return @{ ok=($p.ExitCode -eq 0); code=$p.ExitCode; out=$out; err=$err }
}

function Get-FirstLine($s) {
  if (-not $s) { return $null }
  $line = ($s -split "`r?`n" | Select-Object -First 1)
  if ($line) { return $line.Trim() }
  return $null
}

function Get-GitConfig([string]$key) {
  $r = Invoke-ExternalWithTimeout -FilePath "git" -ArgumentList @("config","--get",$key) -TimeoutSeconds 3
  if (-not $r.ok) { return $null }
  return (Get-FirstLine $r.out)
}

function Get-PortListeningFast([int]$port) {
  $r = Invoke-ExternalWithTimeout -FilePath "cmd.exe" -ArgumentList @("/c","netstat -ano -p tcp | findstr /R /C:"":$port\s""") -TimeoutSeconds 2
  return $r.ok
}

Write-Host "== Kolosseum Dev Status ==" -ForegroundColor Cyan

# Node (direct)
$node = Invoke-ExternalWithTimeout -FilePath "node" -ArgumentList @("-v") -TimeoutSeconds 3
if (-not $node.ok) { FAIL "Node not found or not responding" }
Write-Host ("Node: {0}" -f (Get-FirstLine $node.out))

# npm (go through cmd.exe so npm.cmd is resolved)
$npm = Invoke-ExternalWithTimeout -FilePath "cmd.exe" -ArgumentList @("/c","npm -v") -TimeoutSeconds 3
if (-not $npm.ok) { FAIL "npm not found or not responding (via cmd.exe)" }
Write-Host ("npm : {0}" -f (Get-FirstLine $npm.out))

# Repo root
$root = Invoke-ExternalWithTimeout -FilePath "git" -ArgumentList @("rev-parse","--show-toplevel") -TimeoutSeconds 5
if (-not $root.ok) { FAIL "Not a git repo (rev-parse failed or timed out)" }
$repo = (Get-FirstLine $root.out)
Set-Location $repo

# Working tree
$porc = Invoke-ExternalWithTimeout -FilePath "git" -ArgumentList @("status","--porcelain") -TimeoutSeconds 5
if (-not $porc.ok) { WARN "WORKING TREE: UNKNOWN (git status timed out)" }
elseif ((Get-FirstLine $porc.out)) { WARN "WORKING TREE: DIRTY" }
else { OK "WORKING TREE: CLEAN" }

# Git settings
Write-Host ("git core.editor:     {0}" -f ((Get-GitConfig "core.editor")      ?? "<unset>"))
Write-Host ("git core.autocrlf:   {0}" -f ((Get-GitConfig "core.autocrlf")    ?? "<unset>"))
Write-Host ("git core.eol:        {0}" -f ((Get-GitConfig "core.eol")         ?? "<unset>"))
Write-Host ("git core.longpaths:  {0}" -f ((Get-GitConfig "core.longpaths")   ?? "<unset>"))
Write-Host ("git rerere.enabled:  {0}" -f ((Get-GitConfig "rerere.enabled")   ?? "<unset>"))
Write-Host ("git pull.rebase:     {0}" -f ((Get-GitConfig "pull.rebase")      ?? "<unset>"))
Write-Host ("git rebase.autoStash:{0}" -f ((Get-GitConfig "rebase.autoStash") ?? "<unset>"))

# Ports (clear)
$listen3000 = Get-PortListeningFast 3000
$listen5432 = Get-PortListeningFast 5432

Write-Host ("port 3000 listening: {0}" -f $listen3000)
Write-Host ("port 3000 free:      {0}" -f (-not $listen3000))
Write-Host ("port 5432 listening: {0}" -f $listen5432)
Write-Host ("port 5432 free:      {0}" -f (-not $listen5432))

if ($Full) {
  Info "Running: npm run dev:fast"
  # Use cmd.exe so npm.cmd resolution is identical to your normal terminal behaviour
  $run = Invoke-ExternalWithTimeout -FilePath "cmd.exe" -ArgumentList @("/c","npm run dev:fast") -TimeoutSeconds (60 * 10)
  if (-not $run.ok) {
    Write-Host $run.out
    Write-Host $run.err
    FAIL "dev:fast failed"
  }
  Write-Host $run.out
  OK "OK"
} else {
  OK "OK (status-only)"
}