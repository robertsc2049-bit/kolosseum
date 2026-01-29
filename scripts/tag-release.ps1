param(
  [Parameter(Mandatory)]
  [string]$Tag
)

$ErrorActionPreference = "Stop"

function Fail([string]$msg) {
  Write-Host "FAIL tag-release: $msg" -ForegroundColor Red
  exit 1
}

function Info([string]$msg) {
  Write-Host "INFO: $msg" -ForegroundColor Cyan
}

function Ok([string]$msg) {
  Write-Host "OK: $msg" -ForegroundColor Green
}

function Exec([string]$label, [string[]]$cmd) {
  Info $label
  & $cmd[0] $cmd[1..($cmd.Length-1)]
  if ($LASTEXITCODE -ne 0) { Fail "$label failed" }
}

function Get-RepoRoot() {
  $root = (& git rev-parse --show-toplevel 2>$null)
  if ($LASTEXITCODE -ne 0 -or -not $root) { Fail "not inside a git repo" }
  return $root.Trim()
}

function Read-Bytes([string]$path) {
  if (-not (Test-Path $path)) { Fail "missing file: $path" }
  return [System.IO.File]::ReadAllBytes($path)
}

function Assert-NoUtf8Bom([byte[]]$bytes, [string]$path) {
  if ($bytes.Length -ge 3 -and $bytes[0] -eq 0xEF -and $bytes[1] -eq 0xBB -and $bytes[2] -eq 0xBF) {
    Fail "$path has UTF-8 BOM (must be UTF-8 without BOM)"
  }
}

function Write-Utf8NoBomLf([string]$path, [string]$text) {
  # normalize to LF
  $t = $text -replace "`r`n","`n" -replace "`r","`n"
  $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText($path, $t, $utf8NoBom)
}

function Assert-CleanTree() {
  $porcelain = (& git status --porcelain)
  if ($porcelain) {
    Write-Host "FAIL tag-release: Dirty working tree. Commit or stash before tagging." -ForegroundColor Red
    & git status --short
    exit 1
  }
}

function Assert-OnMain() {
  $branch = (& git branch --show-current).Trim()
  if ($branch -ne "main") { Fail "must run on branch 'main' (current: $branch)" }
}

function Assert-UpToDateWithOriginMain() {
  # ensure we have latest origin/main
  & git fetch --no-tags origin main | Out-Null
  if ($LASTEXITCODE -ne 0) { Fail "git fetch origin main failed" }

  $head = (& git rev-parse HEAD).Trim()
  $remote = (& git rev-parse origin/main).Trim()
  if ($head -ne $remote) {
    Fail "local main is not exactly origin/main. Rebase/pull first. HEAD=$head origin/main=$remote"
  }
}

function Assert-TagFormat([string]$tag) {
  if ($tag -notmatch '^v(\d+)\.(\d+)\.(\d+)$') { Fail "tag must match vX.Y.Z (e.g. v0.1.11)" }
}

function Assert-TagDoesNotExist([string]$tag) {
  # local
  & git rev-parse -q --verify "refs/tags/$tag" 2>$null | Out-Null
  if ($LASTEXITCODE -eq 0) { Fail "tag already exists locally: $tag" }

  # remote (fast check)
  $remoteHit = (& git ls-remote --tags origin "refs/tags/$tag" 2>$null)
  if ($remoteHit) { Fail "tag already exists on origin: $tag" }
}

function Bump-VersionTs([string]$repoRoot, [string]$version) {
  $path = Join-Path $repoRoot "src/version.ts"
  $line = 'export const VERSION = "' + $version + '";' + "`n"
  Write-Utf8NoBomLf $path $line

  $bytes = Read-Bytes $path
  Assert-NoUtf8Bom $bytes "src/version.ts"
}

function Bump-PackageJson([string]$repoRoot, [string]$version) {
  $path = Join-Path $repoRoot "package.json"
  $bytes = Read-Bytes $path
  Assert-NoUtf8Bom $bytes "package.json"

  $raw = [System.Text.Encoding]::UTF8.GetString($bytes)

  # validate JSON before touching it
  try { $null = $raw | ConvertFrom-Json } catch { Fail "package.json invalid JSON: $($_.Exception.Message)" }

  # replace first occurrence of "version": "..."
  if ($raw -notmatch '(?m)^(\s*)"version"\s*:\s*"[^"]+"') { Fail "package.json missing version field" }
  $indent = $Matches[1]
  $raw2 = [regex]::Replace($raw, '(?m)^(\s*)"version"\s*:\s*"[^"]+"', ($indent + '"version": "' + $version + '"'), 1)

  Write-Utf8NoBomLf $path $raw2

  $bytes2 = Read-Bytes $path
  Assert-NoUtf8Bom $bytes2 "package.json"
}

# -------------------- main --------------------

$repoRoot = Get-RepoRoot
Set-Location $repoRoot

Assert-TagFormat $Tag
$version = $Tag.Substring(1)

Assert-OnMain
Assert-CleanTree

# must be fully synced before we mutate versions
Assert-UpToDateWithOriginMain

Assert-TagDoesNotExist $Tag

Info "Release tag: $Tag (version $version)"

# bump versions
Bump-VersionTs $repoRoot $version
Bump-PackageJson $repoRoot $version

# run quality gates before committing
Exec "npm run lint" @("npm","run","lint")
Exec "npm test" @("npm","test")
Exec "npm run build" @("npm","run","build")

# version gate MUST pass against the intended tag value
Exec "version gate" @("powershell","-NoProfile","-ExecutionPolicy","Bypass","-File","scripts/version-gate.ps1","-Tag",$Tag)

# commit bump
Exec "git add version files" @("git","add","src/version.ts","package.json")

$hasDiff = (& git status --porcelain)
if (-not $hasDiff) { Fail "no changes detected after bump (unexpected)" }

$commitMsg = "Release: bump version to $version"
Exec "git commit" @("git","commit","-m",$commitMsg)

# push main first (so tag is definitely on origin/main)
Exec "git push main" @("git","push","origin","main")

# (optional) sanity: ensure HEAD == origin/main after push
Assert-UpToDateWithOriginMain

# create annotated tag and push it explicitly
Exec "git tag (annotated)" @("git","tag","-a",$Tag,"-m",$Tag)
Exec "git push tag" @("git","push","origin",$Tag)

Ok "Released $Tag"
exit 0
