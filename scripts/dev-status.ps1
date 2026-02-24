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

function Invoke-ExternalWithTimeout {
  param(
    [Parameter(Mandatory=$true)][string]$FilePath,
    [Parameter(Mandatory=$false)][string[]]$ArgumentList = @(),
    [Parameter(Mandatory=$true)][int]$TimeoutSeconds,
    [switch]$Stream
  )

  $psi = [System.Diagnostics.ProcessStartInfo]::new()
  $psi.FileName = $FilePath
  foreach ($a in $ArgumentList) { [void]$psi.ArgumentList.Add($a) }
  $psi.UseShellExecute = $false
  $psi.RedirectStandardOutput = $true
  $psi.RedirectStandardError  = $true
  $psi.CreateNoWindow = $true

  $p = [System.Diagnostics.Process]::new()
  $p.StartInfo = $psi

  $out = [System.Collections.Generic.List[string]]::new()
  $err = [System.Collections.Generic.List[string]]::new()

  try {
    $outHandler = [System.Diagnostics.DataReceivedEventHandler]{
      param($sender, $e)
      if ($null -ne $e.Data) {
        $out.Add($e.Data) | Out-Null
        if ($Stream) { Write-Host $e.Data }
      }
    }

    $errHandler = [System.Diagnostics.DataReceivedEventHandler]{
      param($sender, $e)
      if ($null -ne $e.Data) {
        $err.Add($e.Data) | Out-Null
        if ($Stream) { Write-Host $e.Data -ForegroundColor DarkRed }
      }
    }

    $p.add_OutputDataReceived($outHandler)
    $p.add_ErrorDataReceived($errHandler)

    if (-not $p.Start()) {
      return [pscustomobject]@{ ok=$false; code=999; out=""; err="Failed to start: $FilePath" }
    }

    $p.BeginOutputReadLine()
    $p.BeginErrorReadLine()

    $ok = $p.WaitForExit([Math]::Max(1,$TimeoutSeconds) * 1000)
    if (-not $ok) {
      try { $p.Kill($true) | Out-Null } catch { try { $p.Kill() | Out-Null } catch {} }
      return [pscustomobject]@{
        ok   = $false
        code = 124
        out  = ($out -join "`n").TrimEnd()
        err  = ("TIMEOUT after {0}s: {1} {2}" -f $TimeoutSeconds, $FilePath, ($ArgumentList -join " "))
      }
    }

    # flush any last lines
    Start-Sleep -Milliseconds 50

    $code = 0
    try { $code = $p.ExitCode } catch { $code = 999 }

    return [pscustomobject]@{
      ok   = ($code -eq 0)
      code = $code
      out  = ($out -join "`n").TrimEnd()
      err  = ($err -join "`n").TrimEnd()
    }
  }
  finally {
    try { $p.Dispose() } catch {}
  }
}

Write-Host "== Kolosseum Dev Status ==" -ForegroundColor Cyan

$node = Invoke-ExternalWithTimeout -FilePath "node" -ArgumentList @("-v") -TimeoutSeconds 3
$npm  = Invoke-ExternalWithTimeout -FilePath "npm"  -ArgumentList @("-v") -TimeoutSeconds 10

Write-Host ("Node: " + ($node.ok ? $node.out : "UNKNOWN"))
Write-Host ("npm : " + ($npm.ok  ? $npm.out  : "UNKNOWN"))

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
  $run = Invoke-ExternalWithTimeout -FilePath "npm" -ArgumentList @("run","verify") -TimeoutSeconds (60 * 15) -Stream
  if (-not $run.ok) {
    if ($run.out) { Write-Host $run.out }
    if ($run.err) { Write-Host $run.err -ForegroundColor Red }
    FAIL ("verify failed (exit={0})" -f $run.code)
  }
  OK "OK (full)"
} else {
  OK "OK (status-only)"
}