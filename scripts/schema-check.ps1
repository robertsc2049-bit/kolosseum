param(
  [switch]$Quiet,

  # Optional: override psql location if needed
  [string]$PsqlExe = "C:\Program Files\PostgreSQL\18\bin\psql.exe",

  # Connection pieces (no secrets printed)
  [string]$User = "postgres",
  [string]$Password,
  [string]$HostName = "127.0.0.1",
  [int]$Port = 5432,

  # Admin DB used only to create/drop the check DB
  [string]$AdminDb = "postgres",

  # The throwaway DB we create/drop
  [string]$CheckDb = "kolosseum_schema_check"
)

$ErrorActionPreference = "Stop"

function Die([string]$msg) {
  Write-Error $msg
  exit 1
}

if (-not (Test-Path $PsqlExe)) {
  Die "[schema-check] psql not found at: $PsqlExe"
}

# Percent-encode password if it contains special chars
function UrlEncode([string]$s) {
  if ($null -eq $s) { return $null }
  return [System.Uri]::EscapeDataString($s)
}

$encPwd = UrlEncode $Password

if ([string]::IsNullOrWhiteSpace($encPwd)) {
  # Allow passwordless local postgres setups
  $adminUrl = "postgresql://$User@$HostName`:$Port/$AdminDb"
  $checkUrl = "postgresql://$User@$HostName`:$Port/$CheckDb"
} else {
  $adminUrl = "postgresql://$User`:$encPwd@$HostName`:$Port/$AdminDb"
  $checkUrl = "postgresql://$User`:$encPwd@$HostName`:$Port/$CheckDb"
}

if (-not $Quiet) {
  Write-Host "[schema-check] psql: $PsqlExe"
  Write-Host "[schema-check] target: user=$User host=$HostName port=$Port db=$CheckDb"
}

function Invoke-Psql([string]$url, [string]$sql) {
  # IMPORTANT:
  # - Do NOT wrap in a transaction.
  # - Keep each call a single -c statement (DROP/CREATE DATABASE require autocommit).
  # - Suppress noise via psql flags, not by issuing SET ...; before the command.
  if ($Quiet) {
    & $PsqlExe $url -X -q -v ON_ERROR_STOP=1 -v VERBOSITY=terse -P pager=off -c $sql 1>$null 2>$null | Out-Null
  } else {
    & $PsqlExe $url -X -q -v ON_ERROR_STOP=1 -v VERBOSITY=terse -P pager=off -c $sql | Out-Null
  }
}

function PsqlAdmin([string]$sql) { Invoke-Psql $adminUrl $sql }

function Test-DbExists([string]$dbName) {
  $q = "SELECT 1 FROM pg_database WHERE datname = '$dbName';"
  if ($Quiet) {
    $out = & $PsqlExe $adminUrl -X -q -t -A -v ON_ERROR_STOP=1 -c $q 2>$null
  } else {
    $out = & $PsqlExe $adminUrl -X -q -t -A -v ON_ERROR_STOP=1 -c $q
  }
  return ($out -match "1")
}

function Terminate-DbConnections([string]$dbName) {
  # Avoid DROP DATABASE failures when something is connected.
  # This is safe for the throwaway DB we own.
  $sql = @"
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE datname = '$dbName'
  AND pid <> pg_backend_pid();
"@
  PsqlAdmin $sql
}

function Drop-DbIfExists([string]$dbName) {
  if (Test-DbExists $dbName) {
    Terminate-DbConnections $dbName
    PsqlAdmin "DROP DATABASE $dbName;"
  }
}

# --- Drop/create check DB ---
if (-not $Quiet) { Write-Host "[schema-check] dropping db (if exists): $CheckDb" }
Drop-DbIfExists $CheckDb

if (-not $Quiet) { Write-Host "[schema-check] creating db: $CheckDb" }
PsqlAdmin "CREATE DATABASE $CheckDb;"

# --- Apply schema to check DB ---
try {
  if (-not $Quiet) { Write-Host "[schema-check] running: node scripts/apply-schema.mjs" }

  # Only set env for this process
  $env:DATABASE_URL = $checkUrl

  if ($Quiet) {
    node scripts/apply-schema.mjs 1>$null 2>$null
  } else {
    node scripts/apply-schema.mjs
  }

  if (-not $Quiet) { Write-Host "[schema-check] OK: schema applied cleanly" }
} catch {
  if (-not $Quiet) { Write-Host "[schema-check] FAIL: schema apply failed" }
  throw
} finally {
  if (-not $Quiet) { Write-Host "[schema-check] dropping check db: $CheckDb" }
  try { Drop-DbIfExists $CheckDb } catch {}
}
