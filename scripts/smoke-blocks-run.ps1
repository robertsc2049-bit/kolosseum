
# DEV NOTE: Repository automation script. This file exists to make a repeatable repo operation
# deterministic and reviewable. Keep side effects explicit, paths repo-root relative, and
# failure output readable for PowerShell and CI users.

param(
  [int]$Port = 3000
)

$ErrorActionPreference = "Stop"

function Ensure-Dir([string]$p) {
  if (-not (Test-Path -LiteralPath $p)) {
    New-Item -ItemType Directory -Force -Path $p | Out-Null
  }
}

function Is-Blank([string]$s) {
  return ($null -eq $s -or $s.Trim().Length -eq 0)
}

function Load-DotEnv([string]$path) {
  if (-not (Test-Path -LiteralPath $path)) { return }

  $lines = Get-Content -LiteralPath $path -ErrorAction Stop
  foreach ($line in $lines) {
    $t = $line.Trim()
    if ($t.Length -eq 0) { continue }
    if ($t.StartsWith("#")) { continue }

    $idx = $t.IndexOf("=")
    if ($idx -lt 1) { continue }

    $k = $t.Substring(0, $idx).Trim()
    $v = $t.Substring($idx + 1)

    # strip surrounding quotes (simple .env behavior)
    $vv = $v.Trim()
    if (($vv.StartsWith('"') -and $vv.EndsWith('"')) -or ($vv.StartsWith("'") -and $vv.EndsWith("'"))) {
      $vv = $vv.Substring(1, $vv.Length - 2)
    }

    if (-not (Is-Blank $k)) {
      Set-Item -Path ("Env:\" + $k) -Value $vv
    }
  }
}

function Assert-Port-Free([int]$p) {
  $conns = @()
  try {
    $conns = Get-NetTCPConnection -State Listen -LocalPort $p -ErrorAction SilentlyContinue
  } catch { $conns = @() }

  if ($conns -and $conns.Count -gt 0) {
    $pids = ($conns | Select-Object -ExpandProperty OwningProcess | Sort-Object -Unique)
    throw "Port $p is already in use (LISTEN). Owning PID(s): $($pids -join ', '). A previous smoke server is likely still running."
  }
}

function Stop-ProcessTree([int]$ProcId) {
  if ($ProcId -le 0) { return }
  try {
    & taskkill.exe /PID $ProcId /T /F | Out-Null
  } catch { }
}

$repo = (git rev-parse --show-toplevel).Trim()
Set-Location $repo

# ---- snapshot env so this runner does not poison the caller shell ----
$priorSmokeNoDb = $env:SMOKE_NO_DB
$priorDbUrl = $env:DATABASE_URL
$priorPort = $env:PORT

# Tier-1 runner: FORCE DB mode
$env:SMOKE_NO_DB = "0"

# Prefer .env (user-local). Fall back to .env.example for smoke.
if (Test-Path -LiteralPath (Join-Path $repo ".env")) {
  Load-DotEnv (Join-Path $repo ".env")
} elseif (Test-Path -LiteralPath (Join-Path $repo ".env.example")) {
  Load-DotEnv (Join-Path $repo ".env.example")
}

# SMOKE MODE ONLY:
# If DATABASE_URL still isn't set, use a known-local default so smoke is runnable on fresh machines.
if (Is-Blank $env:DATABASE_URL) {
  $env:DATABASE_URL = "postgres://postgres:postgres@127.0.0.1:5432/kolosseum"
  "DATABASE_URL not set; using smoke default: postgres://postgres:***@127.0.0.1:5432/kolosseum" | Out-Host
}

# Respect caller Port param, but if PORT already set in env, keep it.
if (Is-Blank $env:PORT) {
  $env:PORT = [string]$Port
}

Assert-Port-Free ([int]$env:PORT)

$logDir = Join-Path $repo ".logs"
Ensure-Dir $logDir

$stdout = Join-Path $logDir "server.out.log"
$stderr = Join-Path $logDir "server.err.log"

"Starting server (npm run start) on port $env:PORT... (SMOKE_NO_DB=$env:SMOKE_NO_DB)" | Out-Host

$serverProc = Start-Process -FilePath "cmd.exe" -ArgumentList @("/c","npm","run","start") `
  -PassThru -NoNewWindow -RedirectStandardOutput $stdout -RedirectStandardError $stderr

$serverPid = $serverProc.Id
"SERVER PID=$serverPid" | Out-Host

try {
  npm run smoke:blocks
}
finally {
  "Stopping server process tree PID=$serverPid" | Out-Host
  Stop-ProcessTree $serverPid

  # restore env
  if ([string]::IsNullOrWhiteSpace($priorSmokeNoDb)) {
    Remove-Item Env:\SMOKE_NO_DB -ErrorAction SilentlyContinue
  } else {
    $env:SMOKE_NO_DB = $priorSmokeNoDb
  }

  if ([string]::IsNullOrWhiteSpace($priorDbUrl)) {
    Remove-Item Env:\DATABASE_URL -ErrorAction SilentlyContinue
  } else {
    $env:DATABASE_URL = $priorDbUrl
  }

  if ([string]::IsNullOrWhiteSpace($priorPort)) {
    Remove-Item Env:\PORT -ErrorAction SilentlyContinue
  } else {
    $env:PORT = $priorPort
  }
}
