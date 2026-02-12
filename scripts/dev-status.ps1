param(
  [switch]$Full
)

$ErrorActionPreference = "Stop"

function OK([string]$msg)   { Write-Host $msg -ForegroundColor Green }
function WARN([string]$msg) { Write-Host $msg -ForegroundColor Yellow }
function FAIL([string]$msg) { Write-Host $msg -ForegroundColor Red; exit 1 }

function Invoke-ExternalWithTimeout {
  param(
    [Parameter(Mandatory=$true)][string]$FilePath,
    [Parameter(Mandatory=$false)][string[]]$ArgumentList = @(),
    [Parameter(Mandatory=$true)][int]$TimeoutSeconds
  )

  $psi = New-Object System.Diagnostics.ProcessStartInfo
  $psi.FileName = $FilePath
  $psi.Arguments = ($ArgumentList -join " ")
  $psi.RedirectStandardOutput = $true
  $psi.RedirectStandardError  = $true
  $psi.UseShellExecute = $false
  $psi.CreateNoWindow  = $true

  $p = New-Object System.Diagnostics.Process
  $p.StartInfo = $psi

  [void]$p.Start()

  if (-not $p.WaitForExit($TimeoutSeconds * 1000)) {
    try { $p.Kill() } catch {}
    return @{ ok = $false; out = ""; err = "timeout"; code = $null }
  }

  $out = $p.StandardOutput.ReadToEnd().Trim()
  $err = $p.StandardError.ReadToEnd().Trim()
  return @{ ok = ($p.ExitCode -eq 0); out = $out; err = $err; code = $p.ExitCode }
}

function Invoke-CmdWithTimeout {
  param(
    [Parameter(Mandatory=$true)][string]$CmdLine,
    [Parameter(Mandatory=$true)][int]$TimeoutSeconds
  )
  # Use cmd.exe so Windows can resolve npm.cmd reliably.
  return Invoke-ExternalWithTimeout -FilePath "cmd.exe" -ArgumentList @("/c", $CmdLine) -TimeoutSeconds $TimeoutSeconds
}

function Get-WorkingTreeStatus {
  $p = Invoke-ExternalWithTimeout -FilePath "git" -ArgumentList @("status","--porcelain") -TimeoutSeconds 5
  if (-not $p.ok) { return "UNKNOWN" }
  if ([string]::IsNullOrWhiteSpace($p.out)) { return "CLEAN" }
  return "DIRTY"
}

function Get-GitConfig([string]$key) {
  $r = Invoke-ExternalWithTimeout -FilePath "git" -ArgumentList @("config","--get",$key) -TimeoutSeconds 3
  if ($r.ok -and $r.out) { return $r.out }
  return ""
}

function Get-PortListeningFast([int]$port) {
  try {
    $client = New-Object System.Net.Sockets.TcpClient
    $iar = $client.BeginConnect("127.0.0.1", $port, $null, $null)
    $ok = $iar.AsyncWaitHandle.WaitOne(200)
    if (-not $ok) { $client.Close(); return $false }
    $client.EndConnect($iar)
    $client.Close()
    return $true
  } catch {
    try { $client.Close() } catch {}
    return $false
  }
}

Write-Host "== Kolosseum Dev Status ==" -ForegroundColor Cyan

# Versions
$node = Invoke-ExternalWithTimeout -FilePath "node" -ArgumentList @("-v") -TimeoutSeconds 3
$npm  = Invoke-CmdWithTimeout -CmdLine "npm -v" -TimeoutSeconds 3

Write-Host ("Node: " + ($node.ok ? $node.out : "UNKNOWN"))
Write-Host ("npm : " + ($npm.ok  ? $npm.out  : "UNKNOWN"))

# Git status/config
$wt = Get-WorkingTreeStatus
Write-Host ("WORKING TREE: " + $wt)

Write-Host ("git core.editor:     " + (Get-GitConfig "core.editor"))
Write-Host ("git core.autocrlf:   " + (Get-GitConfig "core.autocrlf"))
Write-Host ("git core.eol:        " + (Get-GitConfig "core.eol"))
Write-Host ("git core.longpaths:  " + (Get-GitConfig "core.longpaths"))
Write-Host ("git rerere.enabled:  " + (Get-GitConfig "rerere.enabled"))
Write-Host ("git pull.rebase:     " + (Get-GitConfig "pull.rebase"))
Write-Host ("git rebase.autoStash:" + (Get-GitConfig "rebase.autoStash"))

# Ports
$p3000 = Get-PortListeningFast 3000
$p5432 = Get-PortListeningFast 5432
Write-Host ("port 3000 listening: " + $p3000)
Write-Host ("port 3000 free:      " + (-not $p3000))
Write-Host ("port 5432 listening: " + $p5432)
Write-Host ("port 5432 free:      " + (-not $p5432))

if ($Full) {
  Write-Host "== FULL: running verify ==" -ForegroundColor Cyan
  $run = Invoke-CmdWithTimeout -CmdLine "npm run verify" -TimeoutSeconds (60 * 15)
  if (-not $run.ok) {
    if ($run.out) { Write-Host $run.out }
    if ($run.err) { Write-Host $run.err }
    FAIL "verify failed"
  }
  if ($run.out) { Write-Host $run.out }
  OK "OK (full)"
} else {
  OK "OK (status-only)"
}