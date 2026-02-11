<# scripts/smoke-api.ps1
   Cross-platform smoke tests for the Kolosseum API.

   Usage:
     pwsh ./scripts/smoke-api.ps1 -Base "http://127.0.0.1:3000" -Mode fresh
     pwsh ./scripts/smoke-api.ps1 -Base "http://127.0.0.1:3000" -Mode idempotent

   Contract:
   - /health must return HTTP 200 once the API is ready.
   - Body should be JSON and ideally include version/build metadata.
#>

[CmdletBinding()]
param(
  [Parameter(Mandatory = $false)]
  [string]$Base = "http://127.0.0.1:3000",

  [Parameter(Mandatory = $false)]
  [ValidateSet("fresh", "idempotent")]
  [string]$Mode = "fresh",

  # How long to wait for /health before failing (seconds)
  [Parameter(Mandatory = $false)]
  [int]$HealthTimeoutSeconds = 45,

  # Poll interval while waiting for /health (milliseconds)
  [Parameter(Mandatory = $false)]
  [int]$HealthPollMs = 750
)

$ErrorActionPreference = "Stop"

function Info([string]$msg) { Write-Host $msg -ForegroundColor Cyan }
function Warn([string]$msg) { Write-Host $msg -ForegroundColor Yellow }
function Fail([string]$msg) { Write-Host "FAIL: $msg" -ForegroundColor Red; exit 1 }

function JoinUrl([string]$base, [string]$path) {
  $b = $base.TrimEnd("/")
  $p = $path
  if (-not $p.StartsWith("/")) { $p = "/$p" }
  return "$b$p"
}

function Try-GetJson([string]$url) {
  try {
    # UseBasicParsing is ignored in PowerShell 7+, harmless.
    $resp = Invoke-WebRequest -Uri $url -Method GET -TimeoutSec 10 -UseBasicParsing
    $status = [int]$resp.StatusCode
    $raw = [string]$resp.Content

    $json = $null
    if ($raw) {
      try { $json = $raw | ConvertFrom-Json } catch { $json = $null }
    }

    return @{
      ok = $true
      status = $status
      raw = $raw
      json = $json
      error = $null
    }
  } catch {
    return @{
      ok = $false
      status = $null
      raw = $null
      json = $null
      error = $_.Exception.Message
    }
  }
}

function Wait-ForHealth([string]$base, [int]$timeoutSeconds, [int]$pollMs) {
  $healthUrl = JoinUrl $base "/health"
  $deadline = [DateTimeOffset]::UtcNow.AddSeconds($timeoutSeconds)

  Info "Health check: GET $healthUrl (timeout ${timeoutSeconds}s, poll ${pollMs}ms)"

  $last = $null
  while ([DateTimeOffset]::UtcNow -lt $deadline) {
    $r = Try-GetJson $healthUrl
    $last = $r

    if ($r.ok -and $r.status -eq 200) {
      # Optional sanity: if JSON exists, it must not be empty
      if ($r.json -ne $null) {
        Info "Health OK (200)."
        return $r
      }

      # If it returned 200 but JSON parse failed, still treat as OK but warn.
      Warn "Health OK (200) but response is not valid JSON. Continuing."
      return $r
    }

    if ($r.ok) {
      Warn "Health not ready yet: HTTP $($r.status). Retrying..."
    } else {
      Warn "Health not reachable yet: $($r.error). Retrying..."
    }

    Start-Sleep -Milliseconds $pollMs
  }

  # timed out
  $details = ""
  if ($last -ne $null) {
    if ($last.ok) {
      $details = "Last status=$($last.status). Last body=$([string]$last.raw)"
    } else {
      $details = "Last error=$($last.error)"
    }
  }
  Fail "Health failed after ${timeoutSeconds}s. $details"
}

function Invoke-Api([string]$method, [string]$url, [object]$body = $null) {
  try {
    $headers = @{ "Content-Type" = "application/json" }
    if ($body -ne $null) {
      $json = $body | ConvertTo-Json -Depth 20 -Compress
      $resp = Invoke-WebRequest -Uri $url -Method $method -Headers $headers -Body $json -TimeoutSec 20 -UseBasicParsing
    } else {
      $resp = Invoke-WebRequest -Uri $url -Method $method -Headers $headers -TimeoutSec 20 -UseBasicParsing
    }

    $raw = [string]$resp.Content
    $parsed = $null
    if ($raw) {
      try { $parsed = $raw | ConvertFrom-Json } catch { $parsed = $null }
    }

    return @{
      ok = $true
      status = [int]$resp.StatusCode
      raw = $raw
      json = $parsed
      error = $null
    }
  } catch {
    return @{
      ok = $false
      status = $null
      raw = $null
      json = $null
      error = $_.Exception.Message
    }
  }
}

# -------------------------
# Main
# -------------------------

Info "Base: $Base"
Info "Mode: $Mode"

# 1) Wait until API is actually ready
$health = Wait-ForHealth -base $Base -timeoutSeconds $HealthTimeoutSeconds -pollMs $HealthPollMs

# 2) Print version/build metadata if present
if ($health.json -ne $null) {
  $ver = $null
  if ($health.json.PSObject.Properties.Name -contains "version") { $ver = [string]$health.json.version }
  if (-not $ver -and ($health.json.PSObject.Properties.Name -contains "build_version")) { $ver = [string]$health.json.build_version }
  if ($ver) { Info "Build version: $ver" }
}

# 3) Minimal smoke calls (extend later when endpoints stabilize)
# NOTE: If you don't have a stable endpoint beyond /health yet, keep it lean.
# If you DO have one (e.g. POST /engine/run), wire it here.

# Example placeholder: no-op success
Info "Smoke OK: health passed. (No additional API calls configured yet.)"
exit 0
