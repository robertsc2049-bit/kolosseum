param(
  [switch]$Full
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

try {
  [Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
  $script:OutputEncoding = [Console]::OutputEncoding
} catch {}

function FAIL([string]$Message) {
  Write-Host ("FAIL: " + $Message) -ForegroundColor Red
  exit 1
}

function OK([string]$Message) {
  Write-Host $Message -ForegroundColor Green
}

function Get-GitConfig([string]$Key) {
  try {
    $v = (git config --get $Key) 2>$null
    if ($null -eq $v -or $v -eq "") { return "" }
    return $v.Trim()
  } catch { return "" }
}

function Get-WorkingTreeStatus {
  try {
    $s = (git status --porcelain=v1) 2>$null
    if ($null -eq $s -or $s.Trim().Length -eq 0) { return "CLEAN" }
    return "DIRTY"
  } catch { return "UNKNOWN" }
}

function Get-PortListeningFast([int]$Port) {
  try {
    $x = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
    return ($null -ne $x)
  } catch { return $false }
}

function Invoke-ProcessWithTimeout {
  param(
    [Parameter(Mandatory=$true)][string]$FilePath,
    [Parameter(Mandatory=$false)][string[]]$ArgumentList = @(),
    [Parameter(Mandatory=$true)][int]$TimeoutSeconds
  )

  $psi = [System.Diagnostics.ProcessStartInfo]::new()
  $psi.FileName = $FilePath
  foreach ($a in $ArgumentList) { [void]$psi.ArgumentList.Add($a) }
  $psi.UseShellExecute = $false
  $psi.RedirectStandardOutput = $true
  $psi.RedirectStandardError  = $true
  $psi.CreateNoWindow = $true
  $psi.WorkingDirectory = (Get-Location).Path

  $p = [System.Diagnostics.Process]::new()
  $p.StartInfo = $psi

  try {
    try {
      if (-not $p.Start()) {
        return [pscustomobject]@{ ok=$false; code=999; out=""; err="Failed to start: $FilePath" }
      }
    } catch {
      return [pscustomobject]@{
        ok=$false; code=999; out=""; err=($_.Exception.Message)
      }
    }

    $ok = $p.WaitForExit([Math]::Max(1,$TimeoutSeconds) * 1000)
    if (-not $ok) {
      try { $p.Kill($true) | Out-Null } catch { try { $p.Kill() | Out-Null } catch {} }
      return [pscustomobject]@{
        ok   = $false
        code = 124
        out  = ""
        err  = ("TIMEOUT after {0}s: {1} {2}" -f $TimeoutSeconds, $FilePath, ($ArgumentList -join " "))
      }
    }

    $stdout = ""
    $stderr = ""
    try { $stdout = $p.StandardOutput.ReadToEnd().TrimEnd() } catch {}
    try { $stderr = $p.StandardError.ReadToEnd().TrimEnd() } catch {}

    $code = 0
    try { $code = $p.ExitCode } catch { $code = 999 }

    return [pscustomobject]@{
      ok   = ($code -eq 0)
      code = $code
      out  = $stdout
      err  = $stderr
    }
  }
  finally {
    try { $p.Dispose() } catch {}
  }
}

Write-Host "== Kolosseum Dev Status ==" -ForegroundColor Cyan

# Use explicit Windows shims where relevant.
$node = Invoke-ProcessWithTimeout -FilePath "node"     -ArgumentList @("-v") -TimeoutSeconds 3
$npm  = Invoke-ProcessWithTimeout -FilePath "npm.cmd"  -ArgumentList @("-v") -TimeoutSeconds 10

Write-Host ("Node: " + ($node.ok ? $node.out : ("UNKNOWN" + ($node.err ? (" (" + $node.err + ")") : ""))))
Write-Host ("npm : " + ($npm.ok  ? $npm.out  : ("UNKNOWN" + ($npm.err ? (" (" + $npm.err + ")") : ""))))

if (-not $npm.ok) {
  Write-Host "== DIAG: npm resolution ==" -ForegroundColor Yellow
  try { Write-Host ("PATH: " + $env:PATH) } catch {}
  try { Write-Host ("where npm:"); (cmd.exe /d /s /c "where npm" 2>&1) | ForEach-Object { Write-Host $_ } } catch {}
  try { Write-Host ("where npm.cmd:"); (cmd.exe /d /s /c "where npm.cmd" 2>&1) | ForEach-Object { Write-Host $_ } } catch {}
}

$wt = Get-WorkingTreeStatus
Write-Host ("WORKING TREE: " + $wt)

Write-Host ("git core.editor:      " + (Get-GitConfig "core.editor"))
Write-Host ("git core.autocrlf:    " + (Get-GitConfig "core.autocrlf"))
Write-Host ("git core.eol:         " + (Get-GitConfig "core.eol"))
Write-Host ("git core.longpaths:   " + (Get-GitConfig "core.longpaths"))
Write-Host ("git rerere.enabled:   " + (Get-GitConfig "rerere.enabled"))
Write-Host ("git pull.rebase:      " + (Get-GitConfig "pull.rebase"))
Write-Host ("git rebase.autoStash: " + (Get-GitConfig "rebase.autoStash"))

$p3000 = Get-PortListeningFast 3000
$p5432 = Get-PortListeningFast 5432
Write-Host ("port 3000 listening:  " + $p3000)
Write-Host ("port 3000 free:       " + (-not $p3000))
Write-Host ("port 5432 listening:  " + $p5432)
Write-Host ("port 5432 free:       " + (-not $p5432))

if ($Full) {
  Write-Host "== FULL: running verify ==" -ForegroundColor Cyan
  $run = Invoke-ProcessWithTimeout -FilePath "npm.cmd" -ArgumentList @("run","verify") -TimeoutSeconds (60 * 15)

  if ($run.out) { Write-Host $run.out }
  if ($run.err) { Write-Host $run.err -ForegroundColor DarkRed }

  if (-not $run.ok) {
    FAIL ("verify failed (exit={0})" -f $run.code)
  }

  OK "OK (full)"
} else {
  OK "OK (status-only)"
}