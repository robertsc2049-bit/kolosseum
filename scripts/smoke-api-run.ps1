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

# Tier-0: explicitly disable DB for THIS RUN
$env:SMOKE_NO_DB = "1"

# Do NOT set DATABASE_URL here. Tier-0 must boot without infra.

if (Is-Blank $env:PORT) {
  $env:PORT = [string]$Port
}

Assert-Port-Free ([int]$env:PORT)

$logDir = Join-Path $repo ".logs"
Ensure-Dir $logDir

$stdout = Join-Path $logDir "server.smoke_api.out.log"
$stderr = Join-Path $logDir "server.smoke_api.err.log"

"Starting server (npm run start) on port $env:PORT... (SMOKE_NO_DB=1)" | Out-Host

$serverProc = Start-Process -FilePath "cmd.exe" -ArgumentList @("/c","npm","run","start") `
  -PassThru -NoNewWindow -RedirectStandardOutput $stdout -RedirectStandardError $stderr

$serverPid = $serverProc.Id
"SERVER PID=$serverPid" | Out-Host

try {
  npm run smoke:api
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