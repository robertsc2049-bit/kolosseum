# scripts/smoke-api.ps1
param(
  [string]$Base,
  [ValidateSet("idempotent","fresh")]
  [string]$Mode = "idempotent"
)

$ErrorActionPreference = "Stop"

function Must([bool]$ok, [string]$msg) { if (-not $ok) { throw $msg } }

function Try-Json([scriptblock]$fn) {
  try { & $fn } catch {
    # Preserve server body if present
    if ($_.Exception -and $_.Exception.Response) {
      try {
        $resp = $_.Exception.Response
        $stream = $resp.GetResponseStream()
        $reader = New-Object System.IO.StreamReader($stream)
        $body = $reader.ReadToEnd()
        throw $body
      } catch {
        throw $_
      }
    }
    throw $_
  }
}

if (-not $Base) {
  $Base = "http://[::1]:3000"
  try { Invoke-RestMethod "$Base/health" | Out-Null }
  catch { $Base = "http://127.0.0.1:3000" }
}

Write-Host "Base: $Base"
Write-Host "Mode: $Mode"

# health
$h = Invoke-RestMethod "$Base/health"
Must ($h.ok -eq $true) "Health failed"

# ------------------------------------------------------------
# 1) Compile block (and optionally create session in one call)
# ------------------------------------------------------------

$phase1 = @{
  consent_granted         = $true
  engine_version          = "EB2-1.0.0"
  enum_bundle_version     = "EB2-1.0.0"
  phase1_schema_version   = "1.0.0"
  actor_type              = "athlete"
  execution_scope         = "individual"
  activity_id             = "powerlifting"
  nd_mode                 = $false
  instruction_density     = "standard"
  exposure_prompt_density = "standard"
  bias_mode               = "variety"
}

$compileBodyObj = @{ phase1_input = $phase1 }

if ($Mode -eq "fresh") {
  $compileBodyObj.canonical_hash = ("smoke_" + ([guid]::NewGuid().ToString("N")))
}

$compileBody = $compileBodyObj | ConvertTo-Json -Depth 50 -Compress

# Ticket-022 target: compile can create session (single call)
# We attempt it first, then fall back to the 2-step flow.
$blockId = $null
$sessionId = $null

$compileUriSingle = "$Base/blocks/compile?create_session=true"
$compileUriBlockOnly = "$Base/blocks/compile"

try {
  $resp = Try-Json { Invoke-RestMethod -Method Post -Uri $compileUriSingle -ContentType "application/json" -Body $compileBody }
  $blockId = $resp.block_id
  $sessionId = $resp.session_id
} catch {
  # Fallback: old behaviour (compile returns block_id only)
  $resp = Try-Json { Invoke-RestMethod -Method Post -Uri $compileUriBlockOnly -ContentType "application/json" -Body $compileBody }
  $blockId = $resp.block_id
}

Must ($null -ne $blockId -and $blockId.Length -gt 0) "Compile block failed: no block_id"
Write-Host "block_id: $blockId"

# If session_id not returned from compile, do 2) Create session from block
if (-not ($sessionId -and $sessionId.Length -gt 0)) {

  # Planned session payload (still used until compile emits Phase6 plan)
  $plannedObj = @{
    planned_session = @{
      status    = "ready"
      exercises = @(
        @{ exercise_id="ex_demo_1"; source="program" }
        @{ exercise_id="ex_demo_2"; source="program" }
      )
      notes = @()
    }
  }

  $planned = $plannedObj | ConvertTo-Json -Depth 50 -Compress
  $sessionResp = Try-Json { Invoke-RestMethod -Method Post -Uri "$Base/blocks/$blockId/sessions" -ContentType "application/json" -Body $planned }
  $sessionId = $sessionResp.session_id
}

Must ($null -ne $sessionId -and $sessionId.Length -gt 0) "Create session failed: no session_id"
Write-Host "session_id: $sessionId"

# ------------------------------------------------------------
# 3) Start (persists START_SESSION)
# ------------------------------------------------------------
Try-Json { Invoke-RestMethod -Method Post "$Base/sessions/$sessionId/start" | Out-Null }

# ------------------------------------------------------------
# 4) Events (persisted append-only)
# ------------------------------------------------------------
$body = @{ event = @{ type="COMPLETE_EXERCISE"; exercise_id="ex_demo_1" } } | ConvertTo-Json -Compress
Try-Json { Invoke-RestMethod -Method Post "$Base/sessions/$sessionId/events" -ContentType "application/json" -Body $body | Out-Null }

$body = @{ event = @{ type="SPLIT_SESSION" } } | ConvertTo-Json -Compress
Try-Json { Invoke-RestMethod -Method Post "$Base/sessions/$sessionId/events" -ContentType "application/json" -Body $body | Out-Null }

$body = @{ event = @{ type="RETURN_CONTINUE" } } | ConvertTo-Json -Compress
Try-Json { Invoke-RestMethod -Method Post "$Base/sessions/$sessionId/events" -ContentType "application/json" -Body $body | Out-Null }

# ------------------------------------------------------------
# 5) Verify events are in DB
# ------------------------------------------------------------
$events = Try-Json { Invoke-RestMethod "$Base/sessions/$sessionId/events" }
Must ($events.events.Count -ge 4) "Expected >= 4 events persisted (START + 3 runtime)"
Write-Host ("events persisted: " + $events.events.Count)

# ------------------------------------------------------------
# 6) State
# ------------------------------------------------------------
Try-Json { Invoke-RestMethod "$Base/sessions/$sessionId/state" | ConvertTo-Json -Depth 50 }
