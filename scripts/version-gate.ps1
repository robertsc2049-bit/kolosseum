param(
  # Optional: force-check against a specific tag (e.g. v0.1.2)
  [string]$Tag = "",

  # Enforce package.json version matches too
  [switch]$EnforcePackageJson = $true,

  # Enforce dist/src/version.js matches too (only if file exists)
  [switch]$EnforceDist = $true
)

$ErrorActionPreference = "Stop"

function Fail([string]$msg) {
  Write-Host "FAIL: Version gate: $msg" -ForegroundColor Red
  exit 1
}

function Info([string]$msg) {
  Write-Host "INFO: $msg" -ForegroundColor Cyan
}

function Ok([string]$msg) {
  Write-Host "OK: $msg" -ForegroundColor Green
}

# Always run from repo root
$repoRoot = (& git rev-parse --show-toplevel 2>$null)
if ($LASTEXITCODE -ne 0 -or -not $repoRoot) { Fail "not inside a git repo" }
Set-Location $repoRoot.Trim()

function Assert-NoMergeMarkers([string]$path, [string]$text) {
  if ($text -match '(?m)^(<{7}|={7}\s*$|>{7})') {
    Fail "$path contains merge conflict markers"
  }
}

function Read-TextUtf8NoBom([string]$path) {
  if (-not (Test-Path $path)) { Fail "missing $path" }
  $bytes = [System.IO.File]::ReadAllBytes($path)
  if ($bytes.Length -ge 3 -and $bytes[0] -eq 0xEF -and $bytes[1] -eq 0xBB -and $bytes[2] -eq 0xBF) {
    Fail "$path has UTF-8 BOM (must be UTF-8 without BOM)"
  }
  return [System.Text.Encoding]::UTF8.GetString($bytes)
}

# ---- Determine tag to check ----
$tag = $Tag.Trim()

if (-not $tag) {
  # IMPORTANT: do not allow git.exe fatal output to bubble as a terminating error
  # Treat "no exact match" as normal (exit 0)
  $tagOut = (& git describe --tags --exact-match 2>$null) | Out-String
  if ($LASTEXITCODE -eq 0) {
    $tag = $tagOut.Trim()
  } else {
    $tag = ""
  }
}

if (-not $tag) {
  Info "No tag detected (not a tag build). Version gate skipped."
  exit 0
}

# ---- Validate tag format vX.Y.Z ----
if ($tag -notmatch '^v(\d+)\.(\d+)\.(\d+)$') {
  Fail "tag '$tag' must match format vX.Y.Z (e.g. v0.1.2)"
}

$tagVersion = "$($Matches[1]).$($Matches[2]).$($Matches[3])"
Info "Tag detected: $tag (version $tagVersion)"

# ---- src/version.ts ----
$versionPath = Join-Path $repoRoot "src/version.ts"
$versionText = Read-TextUtf8NoBom $versionPath
Assert-NoMergeMarkers "src/version.ts" $versionText

$reTs = 'export\s+const\s+VERSION\s*=\s*"(\d+\.\d+\.\d+)"\s*;'
if ($versionText -notmatch $reTs) {
  Fail 'src/version.ts must contain: export const VERSION = "X.Y.Z";'
}
$fileVersion = $Matches[1]
Info "src/version.ts VERSION: $fileVersion"

if ($fileVersion -ne $tagVersion) {
  Fail "VERSION mismatch: src/version.ts=$fileVersion but tag=$tagVersion"
}

# ---- package.json (optional) ----
if ($EnforcePackageJson) {
  $pkgPath = Join-Path $repoRoot "package.json"
  $pkgText = Read-TextUtf8NoBom $pkgPath
  Assert-NoMergeMarkers "package.json" $pkgText

  try {
    $pkg = $pkgText | ConvertFrom-Json
  } catch {
    Fail "package.json is not valid JSON: $($_.Exception.Message)"
  }

  $pkgVer = [string]$pkg.version
  if (-not $pkgVer) { Fail "package.json missing version" }
  Info "package.json version: $pkgVer"

  if ($pkgVer -ne $tagVersion) {
    Fail "package.json version mismatch: package.json=$pkgVer but tag=$tagVersion"
  }
}

# ---- dist/src/version.js (optional; only if exists) ----
if ($EnforceDist) {
  $distPath = Join-Path $repoRoot "dist/src/version.js"
  if (Test-Path $distPath) {
    $distText = Read-TextUtf8NoBom $distPath
    Assert-NoMergeMarkers "dist/src/version.js" $distText

    $reJs = 'export\s+const\s+VERSION\s*=\s*"(\d+\.\d+\.\d+)"\s*;'
    if ($distText -notmatch $reJs) {
      Fail 'dist/src/version.js must contain: export const VERSION = "X.Y.Z";'
    }
    $distVersion = $Matches[1]
    Info "dist/src/version.js VERSION: $distVersion"

    if ($distVersion -ne $tagVersion) {
      Fail "dist VERSION mismatch: dist/src/version.js=$distVersion but tag=$tagVersion"
    }
  } else {
    Info "dist/src/version.js not found; skipping dist check"
  }
}

Ok "Version gate passed (tag $tag)."
exit 0
