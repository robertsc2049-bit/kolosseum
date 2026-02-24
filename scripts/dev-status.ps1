param(
  [switch]$Full
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

# UTF-8 output (no BOM) to avoid mojibake / console weirdness
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

function Invoke-CmdWithTimeout {
  param(
    [Parameter(Mandatory=$true)][string]$CmdLine,
    [Parameter(Mandatory=$true)][int]$TimeoutSeconds,
    [switch]$Stream
  )

  $psi = New-Object System.Diagnostics.ProcessStartInfo
  $psi.FileName = "cmd.exe"
  # /d disables AutoRun, /s keeps quoting rules, /c executes then exits
  [void]$psi.ArgumentList.Add("/d")
  [void]$psi.ArgumentList.Add("/s")
  [void]$psi.ArgumentList.Add("/c")
  [void]$psi.ArgumentList.Add($CmdLine)
  $psi.UseShellExecute = $false
  $psi.RedirectStandardOutput = $true
  $psi.RedirectStandardError  = $true
  $psi.CreateNoWindow = $true

  $p = New-Object System.Diagnostics.Process
  $p.StartInfo = $psi
  $p.EnableRaisingEvents = $true

  $out = New-Object System.Collections.Generic.List[string]
  $err = New-Object System.Collections.Generic.List[string]

  $subOut = $null
  $subErr = $null

  try {
    if (-not $p.Start()) {
      return [pscustomobject]@{ ok=$false; code=999; out=""; err="Failed to start: $CmdLine" }
    }

    # IMPORTANT: use Register-ObjectEvent so handlers execute on a Runspace (no PSInvalidOperationException)
    $subOut = Register-ObjectEvent -InputObject $p -EventName OutputDataReceived -Action {
      $line = $Event.SourceEventArgs.Data
      if ($null -ne $line) {
        $script:out.Add($line) | Out-Null
        if ($using:Stream) { Write-Host $line }
      }
    }

    $subErr = Register-ObjectEvent -InputObject $p -EventName ErrorDataReceived -Action {
      $line = $Event.SourceEventArgs.Data
      if ($null -ne $line) {
        $script:err.Add($line) | Out-Null
        if ($using:Stream) { Write-Host $line -ForegroundColor DarkRed }
      }
    }

    $p.BeginOutputReadLine()
    $p.BeginErrorReadLine()

    $sw = [System.Diagnostics.Stopwatch]::StartNew()
    while (-not $p.HasExited) {
      # Pump the event queue so OutputDataReceived/ErrorDataReceived actions run
      Wait-Event -Timeout 0.1 | Out-Null

      if ($sw.Elapsed.TotalSeconds -ge $TimeoutSeconds) {
        try { $p.Kill($true) | Out-Null } catch { try { $p.Kill() | Out-Null } catch {} }
        return [pscustomobject]@{
          ok  = $false
          code = 124
          out = ($out -join "`n").TrimEnd()
          err = ("TIMEOUT after {0}s: {1}" -f $TimeoutSeconds, $CmdLine)
        }
      }
    }

    # Final pump to flush any last lines
    for ($i=0; $i -lt 10; $i++) { Wait-Event -Timeout 0.05 | Out-Null }

    $code = 0
    try { $code = $p.ExitCode } catch { $code = 999 }

    return [pscustomobject]@{
      ok  = ($code -eq 0)
      code = $code
      out = ($out -join "`n").TrimEnd()
      err = ($err -join "`n").TrimEnd()
    }
  }
  finally {
    if ($subOut) { try { Unregister-Event -SourceIdentifier $subOut.Name } catch {} }
    if ($subErr) { try { Unregister-Event -SourceIdentifier $subErr.Name } catch {} }

    # Clean up any queued events/subscribers to avoid leaks across runs
    try { Get-EventSubscriber | Where-Object { $_.SourceObject -eq $p } | Unregister-Event -Force } catch {}
    try { Remove-Event -ErrorAction SilentlyContinue } catch {}
    try { $p.Dispose() } catch {}
  }
}

function Invoke-ExternalWithTimeout {
  param(
    [Parameter(Mandatory=$true)][string]$FilePath,
    [Parameter(Mandatory=$false)][string[]]$ArgumentList = @(),
    [Parameter(Mandatory=$true)][int]$TimeoutSeconds
  )

  $psi = New-Object System.Diagnostics.ProcessStartInfo
  $psi.FileName = $FilePath
  foreach ($a in $ArgumentList) { [void]$psi.ArgumentList.Add($a) }
  $psi.UseShellExecute = $false
  $psi.RedirectStandardOutput = $true
  $psi.RedirectStandardError  = $true
  $psi.CreateNoWindow = $true

  $p = New-Object System.Diagnostics.Process
  $p.StartInfo = $psi

  try {
    if (-not $p.Start()) {
      return [pscustomobject]@{ ok=$false; out=""; err="Failed to start: $FilePath" }
    }
    $ok = $p.WaitForExit([Math]::Max(1,$TimeoutSeconds)*1000)
    if (-not $ok) {
      try { $p.Kill($true) | Out-Null } catch { try { $p.Kill() | Out-Null } catch {} }
      return [pscustomobject]@{ ok=$false; out=""; err=("TIMEOUT after {0}s: {1}" -f $TimeoutSeconds, $FilePath) }
    }
    $stdout = $p.StandardOutput.ReadToEnd().Trim()
    $stderr = $p.StandardError.ReadToEnd().Trim()
    return [pscustomobject]@{ ok=($p.ExitCode -eq 0); out=$stdout; err=$stderr }
  } finally {
    try { $p.Dispose() } catch {}
  }
}

# ---------------- Main ----------------

Write-Host "== Kolosseum Dev Status ==" -ForegroundColor Cyan

$node = Invoke-ExternalWithTimeout -FilePath "node" -ArgumentList @("-v") -TimeoutSeconds 3
$npm  = Invoke-CmdWithTimeout -CmdLine "npm -v" -TimeoutSeconds 3

Write-Host ("Node: " + ($node.ok ? $node.out : "UNKNOWN"))
Write-Host ("npm : " + ($npm.ok  ? $npm.out  : "UNKNOWN"))

$wt = Get-WorkingTreeStatus
Write-Host ("WORKING TREE: " + $wt)

Write-Host ("git core.editor:     " + (Get-GitConfig "core.editor"))
Write-Host ("git core.autocrlf:   " + (Get-GitConfig "core.autocrlf"))
Write-Host ("git core.eol:        " + (Get-GitConfig "core.eol"))
Write-Host ("git core.longpaths:  " + (Get-GitConfig "core.longpaths"))
Write-Host ("git rerere.enabled:  " + (Get-GitConfig "rerere.enabled"))
Write-Host ("git pull.rebase:     " + (Get-GitConfig "pull.rebase"))
Write-Host ("git rebase.autoStash:" + (Get-GitConfig "rebase.autoStash"))

$p3000 = Get-PortListeningFast 3000
$p5432 = Get-PortListeningFast 5432
Write-Host ("port 3000 listening: " + $p3000)
Write-Host ("port 3000 free:      " + (-not $p3000))
Write-Host ("port 5432 listening: " + $p5432)
Write-Host ("port 5432 free:      " + (-not $p5432))

if ($Full) {
  Write-Host "== FULL: running verify ==" -ForegroundColor Cyan

  # stream to avoid “looks stuck” and avoid stdout pipe deadlocks
  $run = Invoke-CmdWithTimeout -CmdLine "npm run verify" -TimeoutSeconds (60 * 15) -Stream

  if (-not $run.ok) {
    if ($run.out) { Write-Host $run.out }
    if ($run.err) { Write-Host $run.err -ForegroundColor Red }
    FAIL ("verify failed (exit={0})" -f $run.code)
  }

  OK "OK (full)"
} else {
  OK "OK (status-only)"
}
