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

  $wd = (Get-Location).Path
  $outFile = Join-Path $env:TEMP ("kolosseum-devstatus-out-" + [guid]::NewGuid().ToString("n") + ".log")
  $errFile = Join-Path $env:TEMP ("kolosseum-devstatus-err-" + [guid]::NewGuid().ToString("n") + ".log")

  $sw = [System.Diagnostics.Stopwatch]::StartNew()
  try {
    $p = $null
    try {
      $p = Start-Process -FilePath $FilePath `
        -ArgumentList $ArgumentList `
        -WorkingDirectory $wd `
        -NoNewWindow `
        -PassThru `
        -RedirectStandardOutput $outFile `
        -RedirectStandardError  $errFile
    } catch {
      return [pscustomobject]@{ ok=$false; code=999; out=""; err=($_.Exception.Message) }
    }

    $finished = $false
    try {
      $finished = $p.WaitForExit([Math]::Max(1,$TimeoutSeconds) * 1000)
    } catch {
      # If WaitForExit itself errors, treat as failure
      $finished = $false
    }

    if (-not $finished) {
      try { $p.Kill($true) | Out-Null } catch { try { $p.Kill() | Out-Null } catch {} }
      return [pscustomobject]@{
        ok   = $false
        code = 124
        out  = ""
        err  = ("TIMEOUT after {0}s: {1} {2}" -f $TimeoutSeconds, $FilePath, ($ArgumentList -join " "))
      }
    }

    $code = 0
    try { $code = $p.ExitCode } catch { $code = 999 }

    $stdout = ""
    $stderr = ""
    try { if (Test-Path -LiteralPath $outFile) { $stdout = ([System.IO.File]::ReadAllText($outFile)).TrimEnd() } } catch {}
    try { if (Test-Path -LiteralPath $errFile) { $stderr = ([System.IO.File]::ReadAllText($errFile)).TrimEnd() } } catch {}

    return [pscustomobject]@{
      ok   = ($code -eq 0)
      code = $code
      out  = $stdout
      err  = $stderr
    }
  }
  finally {
    $sw.Stop() | Out-Null
    try { if (Test-Path -LiteralPath $outFile) { Remove-Item -LiteralPath $outFile -Force } } catch {}
    try { if (Test-Path -LiteralPath $errFile) { Remove-Item -LiteralPath $errFile -Force } } catch {}
  }
}

function Resolve-GlobalNpmCmd {
  $cmds = @()
  try { $cmds = @(Get-Command npm.cmd -All -ErrorAction SilentlyContinue) } catch { $cmds = @() }

  $paths = @()
  foreach ($c in $cmds) {
    try {
      if ($c -and $c.Source -and (Test-Path -LiteralPath $c.Source)) { $paths += $c.Source }
    } catch {}
  }

  if ($paths.Count -eq 0) { return "" }

  foreach ($p in $paths) { if ($p -ieq "C:\Program Files\nodejs\npm.cmd") { return $p } }
  foreach ($p in $paths) { if ($p -like "*\Program Files\nodejs\npm.cmd") { return $p } }

  return $paths[0]
}

Write-Host "== Kolosseum Dev Status ==
env.KOLOSSEUM_GREEN:             
env.KOLOSSEUM_GREEN_ENTRYPOINT:   
env.KOLOSSEUM_CLEAN_TREE_ENFORCE: 
env.KOLOSSEUM_CLEAN_TREE_STRICT:  
env.KOLOSSEUM_DEV_FAST_STRICT:    " -ForegroundColor Cyan

$node = Invoke-ProcessWithTimeout -FilePath "node" -ArgumentList @("-v") -TimeoutSeconds 3
Write-Host ("Node: " + ($node.ok ? $node.out : ("UNKNOWN" + ($node.err ? (" (" + $node.err + ")") : ""))))

$npmCmd = Resolve-GlobalNpmCmd
if (-not $npmCmd) {
  Write-Host "npm : UNKNOWN (could not resolve npm.cmd via Get-Command)" -ForegroundColor Yellow
} else {
  $npm = Invoke-ProcessWithTimeout -FilePath $npmCmd -ArgumentList @("-v") -TimeoutSeconds 10
  Write-Host ("npm : " + ($npm.ok ? $npm.out : ("UNKNOWN" + ($npm.err ? (" (" + $npm.err + ")") : ""))))
  Write-Host ("npm.cmd (resolved): " + $npmCmd)
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
  if (-not $npmCmd) { FAIL "verify failed: npm.cmd not resolvable" }

  $run = Invoke-ProcessWithTimeout -FilePath $npmCmd -ArgumentList @("run","verify") -TimeoutSeconds (60 * 15)

  if ($run.out) { Write-Host $run.out }
  if ($run.err) { Write-Host $run.err -ForegroundColor DarkRed }

  if (-not $run.ok) {
    FAIL ("verify failed (exit={0})" -f $run.code)
  }

  OK "OK (full)"
} else {
  OK "OK (status-only)"
}
