param(
  [string]$DbUrl,
  [int]$Port = 3000
)

$ErrorActionPreference = "Stop"

# --- repo root ---
Set-Location (Split-Path -Parent $MyInvocation.MyCommand.Path) | Out-Null
Set-Location .. | Out-Null

function Load-DotEnv([string]$Path) {
  if (-not (Test-Path $Path)) { return }

  Get-Content $Path | ForEach-Object {
    $line = $_.Trim()
    if ($line.Length -eq 0) { return }
    if ($line.StartsWith("#")) { return }

    $idx = $line.IndexOf("=")
    if ($idx -lt 1) { return }

    $k = $line.Substring(0, $idx).Trim()
    $v = $line.Substring($idx + 1).Trim()

    # strip optional surrounding quotes
    if (($v.StartsWith('"') -and $v.EndsWith('"')) -or ($v.StartsWith("'") -and $v.EndsWith("'"))) {
      $v = $v.Substring(1, $v.Length - 2)
    }

    if ($k.Length -gt 0) {
      Set-Item -Path "Env:$k" -Value $v
    }
  }
}

function Parse-PostgresUrl([string]$Url) {
  # Accept postgres:// or postgresql://
  # Output: Host, Port, Db, User (no password)
  # Throws on obvious malformed inputs.

  if (-not $Url -or $Url.Trim().Length -eq 0) { throw "empty url" }

  $s = $Url.Trim()

  # Strip scheme
  if ($s -match '^(postgres|postgresql)://') {
    $s = $s -replace '^(postgres|postgresql)://', ''
  } else {
    throw "unsupported scheme"
  }

  # Strip query/fragment
  $s = $s.Split('?',2)[0].Split('#',2)[0]

  # Split userinfo@rest
  $user = ""
  $rest = $s
  $at = $s.LastIndexOf('@')
  if ($at -ge 0) {
    $userinfo = $s.Substring(0, $at)
    $rest = $s.Substring($at + 1)

    # userinfo can be user or user:pass
    $up = $userinfo.Split(':', 2)
    if ($up.Length -ge 1 -and $up[0].Length -gt 0) {
      $user = [System.Uri]::UnescapeDataString($up[0])
    }
  }

  # rest = host[:port]/db   (host may be IPv6 in brackets)
  $slash = $rest.IndexOf('/')
  if ($slash -lt 0) { throw "missing /db" }

  $hostPort = $rest.Substring(0, $slash)
  $db = $rest.Substring($slash + 1)
  if (-not $db -or $db.Length -eq 0) { throw "missing db" }

  $host = ""
  $port = ""

  if ($hostPort.StartsWith('[')) {
    # IPv6: [::1]:5432
    $rb = $hostPort.IndexOf(']')
    if ($rb -lt 0) { throw "bad ipv6 host" }
    $host = $hostPort.Substring(1, $rb - 1)

    $after = $hostPort.Substring($rb + 1) # may be :port or empty
    if ($after.StartsWith(':') -and $after.Length -gt 1) {
      $port = $after.Substring(1)
    }
  } else {
    # IPv4/hostname: host:5432
    $parts = $hostPort.Split(':', 2)
    $host = $parts[0]
    if ($parts.Length -eq 2) { $port = $parts[1] }
  }

  if (-not $host -or $host.Length -eq 0) { throw "missing host" }

  # Validate port if present
  if ($port -and $port.Length -gt 0) {
    if ($port -notmatch '^\d+$') { throw "bad port" }
  } else {
    $port = "(default)"
  }

  return [pscustomobject]@{
    Host = $host
    Port = $port
    Db   = $db
    User = $user
  }
}

# Load .env if present (kept out of git)
Load-DotEnv ".\.env"

$resolvedFrom = $null

if ($DbUrl -and $DbUrl.Trim().Length -gt 0) {
  $resolvedFrom = "param:-DbUrl"
}
elseif ($env:DATABASE_URL -and $env:DATABASE_URL.Trim().Length -gt 0) {
  $DbUrl = $env:DATABASE_URL
  $resolvedFrom = "env:DATABASE_URL"
}
else {
  throw "DATABASE_URL not set. Provide -DbUrl or set DATABASE_URL (or create .env)."
}

# Normalize env for child processes
$env:DATABASE_URL = $DbUrl
$env:PORT = "$Port"

# Print resolved DB target (no password)
try {
  $info = Parse-PostgresUrl $DbUrl
  Write-Host ("DB: host={0} port={1} db={2} user={3} (from {4})" -f $info.Host, $info.Port, $info.Db, $info.User, $resolvedFrom)
}
catch {
  # Do NOT echo the URL (avoid leaking secrets)
  Write-Host ("DB: (unparsed) (from {0})" -f $resolvedFrom)
}

Write-Host ("API: port={0}" -f $Port)

npm run build
if ($LASTEXITCODE -ne 0) { throw "build failed" }

node .\dist\src\server.js
