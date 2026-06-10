param([switch]$Verify)

$ErrorActionPreference = "Stop"

function Fail([string]$msg, [string]$fix = "") {
  Write-Host $msg -ForegroundColor Red
  if ($fix) { Write-Host ("Fix: " + $fix) -ForegroundColor Yellow }
  throw $msg
}

function Assert-LFOnly([string]$relPath) {
  if (Select-String -Path $relPath -Pattern "`r" -AllMatches -ErrorAction SilentlyContinue) {
    Fail "$relPath contains CRLF (`r). Refusing." "Rewrite using scripts/Write-Utf8NoBomLf.ps1"
  }
}

function Decode-Base64Utf8([string]$b64) {
  try {
    $bytes = [Convert]::FromBase64String($b64)
    return [Text.Encoding]::UTF8.GetString($bytes)
  } catch {
    Fail ("Base64 decode failed: " + $_.Exception.Message) "Regenerate installer payloads from committed guard sources."
  }
}

function Write-FileStrict([string]$relPath, [string]$content) {
  if (-not $content.EndsWith("`n")) { $content += "`n" }

  if (Test-Path $relPath) {
    $existing = Get-Content -Raw -LiteralPath $relPath
    if (-not $existing.EndsWith("`n")) { $existing += "`n" }
    if ($existing -ne $content) { Fail "Refusing: $relPath already exists but differs." "Delete the file or re-run on a clean checkout." }
    return
  }

  $dir = Split-Path -Parent $relPath
  if ($dir -and -not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir | Out-Null }

  .\scripts\Write-Utf8NoBomLf.ps1 -Path $relPath -Text $content
  Assert-LFOnly $relPath
}

function Get-WorkflowFiles() {
  $wfDir = Join-Path (Get-Location) ".github\workflows"
  if (-not (Test-Path $wfDir)) { return @() }
  $yml = Get-ChildItem -LiteralPath $wfDir -File -ErrorAction SilentlyContinue | Where-Object {
    $_.Name.ToLower().EndsWith(".yml") -or $_.Name.ToLower().EndsWith(".yaml")
  }
  return @($yml | ForEach-Object { $_.FullName })
}

function Verify-Prereqs() {
  if (-not (Test-Path ".\package.json")) { Fail "Not in repo root (package.json missing)." "cd to the repo root." }
  if (-not (Test-Path ".\scripts\Write-Utf8NoBomLf.ps1")) { Fail "Missing scripts/Write-Utf8NoBomLf.ps1" "Restore repo scripts folder (clean checkout) before running installer." }

  $pkg = (Get-Content -Raw -LiteralPath ".\package.json") | ConvertFrom-Json
  if ($null -eq $pkg.scripts) { Fail "package.json missing scripts" "Add scripts section or restore package.json from main." }
  if (-not ($pkg.scripts.PSObject.Properties.Name -contains "green")) {
    Fail "package.json missing scripts.green" "Add scripts.green (local green gate) before relying on these guards."
  }
  if (-not ($pkg.scripts.PSObject.Properties.Name -contains "green:ci")) {
    Fail "package.json missing scripts.green:ci" "Add scripts.green:ci (CI parity gate) before relying on these guards."
  }

  $wfs = Get-WorkflowFiles
  if ($wfs.Count -eq 0) {
    Fail ".github/workflows has no workflow YAML files." "Create a workflow that runs: npm run green:ci"
  }

  $needle = [regex] "npm\s+run\s+green:ci\b"
  $hit = $null
  foreach ($f in $wfs) {
    $t = Get-Content -Raw -LiteralPath $f
    if ($needle.IsMatch($t)) { $hit = $f; break }
  }
  if (-not $hit) {
    Fail "CI workflows do not invoke npm run green:ci" "Edit a workflow under .github/workflows to include: npm run green:ci"
  }

  Write-Host ("OK: verify (workflow invokes green:ci: " + (Resolve-Path $hit).Path + ")") -ForegroundColor Green
}

# --- fast verify mode (no writes) ---
if ($Verify) {
  Verify-Prereqs
  Write-Host "OK: apply_green_contract_guards.ps1 --verify" -ForegroundColor Green
  exit 0
}

# --- normal install path ---
Verify-Prereqs

# Ensure README exists (seed only; repo guard enforces contract content separately)
if (-not (Test-Path "README.md")) {
  $seed = "# Kolosseum`n`n" +
          "## How to validate changes`n`n" +
          "Run the full local green gate:`n`n" +
          "- npm run green`n`n" +
          "CI runs the CI-parity green gate:`n`n" +
          "- npm run green:ci`n"
  .\scripts\Write-Utf8NoBomLf.ps1 -Path "README.md" -Text $seed
  Assert-LFOnly "README.md"
}

# Guard payloads (base64, UTF-8) - kept in sync by ci/guards/green_contract_installer_sync_guard.mjs
$B64_GREEN = "Ly8gQGxhdzogQ0kgSW50ZWdyaXR5Ci8vIEBzZXZlcml0eTogaGlnaAovLyBAc2NvcGU6IHJlcG8KaW1wb3J0IGZzIGZyb20gIm5vZGU6ZnMiOwppbXBvcnQgcGF0aCBmcm9tICJub2RlOnBhdGgiOwppbXBvcnQgcHJvY2VzcyBmcm9tICJub2RlOnByb2Nlc3MiOwoKZnVuY3Rpb24gZGllKG1zZykgewogIGNvbnNvbGUuZXJyb3IobXNnKTsKICBwcm9jZXNzLmV4aXQoMSk7Cn0KCmZ1bmN0aW9uIGV4aXN0cyhwKSB7CiAgdHJ5IHsKICAgIGZzLmFjY2Vzc1N5bmMocCwgZnMuY29uc3RhbnRzLkZfT0spOwogICAgcmV0dXJuIHRydWU7CiAgfSBjYXRjaCB7CiAgICByZXR1cm4gZmFsc2U7CiAgfQp9CgpmdW5jdGlvbiByZWFkVXRmOChwKSB7CiAgcmV0dXJuIGZzLnJlYWRGaWxlU3luYyhwLCAidXRmOCIpOwp9CgpmdW5jdGlvbiBsaXN0WWFtbEZpbGVzKGRpckFicykgewogIGlmICghZXhpc3RzKGRpckFicykpIHJldHVybiBbXTsKICByZXR1cm4gZnMKICAgIC5yZWFkZGlyU3luYyhkaXJBYnMsIHsgd2l0aEZpbGVUeXBlczogdHJ1ZSB9KQogICAgLmZpbHRlcigoZCkgPT4gZC5pc0ZpbGUoKSkKICAgIC5tYXAoKGQpID0+IGQubmFtZSkKICAgIC5maWx0ZXIoKG4pID0+IG4udG9Mb3dlckNhc2UoKS5lbmRzV2l0aCgiLnltbCIpIHx8IG4udG9Mb3dlckNhc2UoKS5lbmRzV2l0aCgiLnlhbWwiKSkKICAgIC5tYXAoKG4pID0+IHBhdGguam9pbihkaXJBYnMsIG4pKTsKfQoKY29uc3QgcmVwbyA9IHByb2Nlc3MuY3dkKCk7CmNvbnN0IHBrZ1BhdGggPSBwYXRoLmpvaW4ocmVwbywgInBhY2thZ2UuanNvbiIpOwppZiAoIWV4aXN0cyhwa2dQYXRoKSkgZGllKCJncmVlbl9jaV9wYXJpdHlfZ3VhcmQ6IHBhY2thZ2UuanNvbiBtaXNzaW5nIChydW4gZnJvbSByZXBvIHJvb3QpIik7CgpsZXQgcGtnOwp0cnkgewogIHBrZyA9IEpTT04ucGFyc2UocmVhZFV0ZjgocGtnUGF0aCkpOwp9IGNhdGNoIChlKSB7CiAgZGllKCJncmVlbl9jaV9wYXJpdHlfZ3VhcmQ6IGZhaWxlZCB0byBwYXJzZSBwYWNrYWdlLmpzb246ICIgKyBTdHJpbmcoZSkpOwp9Cgpjb25zdCBzY3JpcHRzID0gKHBrZyAmJiBwa2cuc2NyaXB0cykgfHwge307CmNvbnN0IGhhc0dyZWVuID0gT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eS5jYWxsKHNjcmlwdHMsICJncmVlbiIpOwoKaWYgKCFoYXNHcmVlbikgewogIGNvbnNvbGUubG9nKCJPSzogZ3JlZW5fY2lfcGFyaXR5X2d1YXJkIChubyBzY3JpcHRzLmdyZWVuOyBza2lwcGluZykiKTsKICBwcm9jZXNzLmV4aXQoMCk7Cn0KCmNvbnN0IHdmRGlyID0gcGF0aC5qb2luKHJlcG8sICIuZ2l0aHViIiwgIndvcmtmbG93cyIpOwpjb25zdCB5bWxzID0gbGlzdFlhbWxGaWxlcyh3ZkRpcik7CgppZiAoeW1scy5sZW5ndGggPT09IDApIHsKICBkaWUoImdyZWVuX2NpX3Bhcml0eV9ndWFyZDogc2NyaXB0cy5ncmVlbiBleGlzdHMgYnV0IG5vIHdvcmtmbG93IFlBTUwgZmlsZXMgZm91bmQgaW4gLmdpdGh1Yi93b3JrZmxvd3MiKTsKfQoKY29uc3QgbmVlZGxlID0gL25wbVxzK3J1blxzK2dyZWVuOmNpXGIvOwpsZXQgaGl0RmlsZSA9ICIiOwoKZm9yIChjb25zdCBmIG9mIHltbHMpIHsKICBjb25zdCB0eHQgPSByZWFkVXRmOChmKTsKICBpZiAobmVlZGxlLnRlc3QodHh0KSkgewogICAgaGl0RmlsZSA9IHBhdGgucmVsYXRpdmUocmVwbywgZik7CiAgICBicmVhazsKICB9Cn0KCmlmICghaGl0RmlsZSkgewogIGRpZSgiZ3JlZW5fY2lfcGFyaXR5X2d1YXJkOiBzY3JpcHRzLmdyZWVuIGV4aXN0cyBidXQgQ0kgZG9lcyBub3QgaW52b2tlICducG0gcnVuIGdyZWVuOmNpJyBpbiBhbnkgd29ya2Zsb3cgWUFNTCIpOwp9Cgpjb25zb2xlLmxvZygiT0s6IGdyZWVuX2NpX3Bhcml0eV9ndWFyZCAod29ya2Zsb3cgaW52b2tlcyBncmVlbjpjaTogIiArIGhpdEZpbGUgKyAiKSIpOwo="
$B64_README = "Ly8gQGxhdzogQ29udHJhY3RzCi8vIEBzZXZlcml0eTogaGlnaAovLyBAc2NvcGU6IHJlcG8KaW1wb3J0IGZzIGZyb20gIm5vZGU6ZnMiOwppbXBvcnQgcGF0aCBmcm9tICJub2RlOnBhdGgiOwppbXBvcnQgcHJvY2VzcyBmcm9tICJub2RlOnByb2Nlc3MiOwoKZnVuY3Rpb24gZGllKG1zZykgewogIGNvbnNvbGUuZXJyb3IobXNnKTsKICBwcm9jZXNzLmV4aXQoMSk7Cn0KCmZ1bmN0aW9uIGV4aXN0cyhwKSB7CiAgdHJ5IHsKICAgIGZzLmFjY2Vzc1N5bmMocCwgZnMuY29uc3RhbnRzLkZfT0spOwogICAgcmV0dXJuIHRydWU7CiAgfSBjYXRjaCB7CiAgICByZXR1cm4gZmFsc2U7CiAgfQp9Cgpjb25zdCByZXBvID0gcHJvY2Vzcy5jd2QoKTsKY29uc3QgcCA9IHBhdGguam9pbihyZXBvLCAiUkVBRE1FLm1kIik7CgppZiAoIWV4aXN0cyhwKSkgewogIGRpZSgicmVhZG1lX3ZhbGlkYXRpb25fY29udHJhY3RfZ3VhcmQ6IFJFQURNRS5tZCBtaXNzaW5nIik7Cn0KCmNvbnN0IHMgPSBmcy5yZWFkRmlsZVN5bmMocCwgInV0ZjgiKTsKCmZ1bmN0aW9uIHJlcXVpcmVJbmNsdWRlcyhuZWVkbGUsIGxhYmVsKSB7CiAgaWYgKCFzLmluY2x1ZGVzKG5lZWRsZSkpIHsKICAgIGRpZSgicmVhZG1lX3ZhbGlkYXRpb25fY29udHJhY3RfZ3VhcmQ6IG1pc3NpbmcgcmVxdWlyZWQgUkVBRE1FIGNvbnRyYWN0OiAiICsgbGFiZWwpOwogIH0KfQoKZnVuY3Rpb24gZm9yYmlkSW5jbHVkZXMobmVlZGxlLCBsYWJlbCkgewogIGlmIChzLmluY2x1ZGVzKG5lZWRsZSkpIHsKICAgIGRpZSgicmVhZG1lX3ZhbGlkYXRpb25fY29udHJhY3RfZ3VhcmQ6IGZvcmJpZGRlbiBSRUFETUUgc3RyaW5nIChwb2xpY3kpOiAiICsgbGFiZWwpOwogIH0KfQoKcmVxdWlyZUluY2x1ZGVzKCIjIyBIb3cgdG8gdmFsaWRhdGUgY2hhbmdlcyIsICJoZWFkaW5nICcjIyBIb3cgdG8gdmFsaWRhdGUgY2hhbmdlcyciKTsKcmVxdWlyZUluY2x1ZGVzKCJucG0gcnVuIHZlcmlmeSIsICJjb21tYW5kICducG0gcnVuIHZlcmlmeSciKTsKCi8vIFBvbGljeTogUkVBRE1FIG11c3Qgbm90IGluc3RydWN0IGh1bWFucyB0byBydW4gaW50ZXJuYWwgZ3JlZW4gZW50cnlwb2ludHMuCmZvcmJpZEluY2x1ZGVzKCJucG0gcnVuIGdyZWVuOmNpIiwgImNvbW1hbmQgJ25wbSBydW4gZ3JlZW46Y2knIik7CmZvcmJpZEluY2x1ZGVzKCJucG0gcnVuIGdyZWVuIiwgImNvbW1hbmQgJ25wbSBydW4gZ3JlZW4nIik7Cgpjb25zb2xlLmxvZygiT0s6IHJlYWRtZV92YWxpZGF0aW9uX2NvbnRyYWN0X2d1YXJkIik7"
Write-FileStrict "ci/guards/green_ci_parity_guard.mjs" (Decode-Base64Utf8 $B64_GREEN)
Write-FileStrict "ci/guards/readme_validation_contract_guard.mjs" (Decode-Base64Utf8 $B64_README)

# Wire into lint:fast (idempotent; keep clean_tree_guard first if present)
$pkgPath = (Resolve-Path ".\package.json").Path
$pkg = (Get-Content -Raw -LiteralPath $pkgPath) | ConvertFrom-Json

if ($null -eq $pkg.scripts) { Fail "package.json missing scripts" "Restore package.json from main." }
if (-not ($pkg.scripts.PSObject.Properties.Name -contains "lint:fast")) { Fail "scripts['lint:fast'] missing. Refusing." "Add scripts.lint:fast before installing guards." }

$guardChain = "node ci/guards/green_ci_parity_guard.mjs && node ci/guards/readme_validation_contract_guard.mjs"
$lintFast = [string]$pkg.scripts."lint:fast"

if ($lintFast -match [regex]::Escape("node ci/guards/green_ci_parity_guard.mjs")) {
  if ($lintFast -notmatch [regex]::Escape("node ci/guards/readme_validation_contract_guard.mjs")) {
    Fail "lint:fast contains green_ci_parity_guard but not readme_validation_contract_guard. Refusing." "Fix lint:fast chain to include both guards (or reinstall from a clean checkout)."
  }
} else {
  $parts = $lintFast -split '\s*&&\s*'
  if ($parts.Length -ge 1 -and $parts[0].Trim() -eq "node ci/guards/clean_tree_guard.mjs") {
    $newParts = @($parts[0].Trim(), $guardChain) + $parts[1..($parts.Length-1)]
    $pkg.scripts."lint:fast" = ($newParts -join " && ")
  } else {
    $pkg.scripts."lint:fast" = ($guardChain + " && " + $lintFast.Trim())
  }
}

$json = ($pkg | ConvertTo-Json -Depth 50)
if (-not $json.EndsWith("`n")) { $json += "`n" }
.\scripts\Write-Utf8NoBomLf.ps1 -Path "package.json" -Text $json
Assert-LFOnly "package.json"

Write-Host "OK: guards installed + lint:fast wired + README ensured." -ForegroundColor Green
