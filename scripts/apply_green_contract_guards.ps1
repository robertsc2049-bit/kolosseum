param()

$ErrorActionPreference = "Stop"

if (-not (Test-Path ".\package.json")) { throw "Not in repo root (package.json missing)." }
if (-not (Test-Path ".\scripts\Write-Utf8NoBomLf.ps1")) { throw "Missing scripts\Write-Utf8NoBomLf.ps1" }

function Assert-LFOnly([string]$relPath) {
  if (Select-String -Path $relPath -Pattern "
" -AllMatches -ErrorAction SilentlyContinue) {
    throw "$relPath contains CRLF (
). Refusing."
  }
}

function Write-FileStrict([string]$relPath, [string]$content) {
  if (-not $content.EndsWith("
")) { $content += "
" }

  if (Test-Path $relPath) {
    $existing = Get-Content -Raw -LiteralPath $relPath
    if (-not $existing.EndsWith("
")) { $existing += "
" }
    if ($existing -ne $content) { throw "Refusing: $relPath already exists but differs." }
    return
  }

  $dir = Split-Path -Parent $relPath
  if ($dir -and -not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir | Out-Null }

  .\scripts\Write-Utf8NoBomLf.ps1 -Path $relPath -Text $content
  Assert-LFOnly $relPath
}

function Decode-Base64Utf8([string]$b64) {
  $bytes = [Convert]::FromBase64String($b64)
  return [Text.Encoding]::UTF8.GetString($bytes)
}

# Ensure README exists (your branch currently has none)
if (-not (Test-Path "README.md")) {
  $seed = "# Kolosseum

" +
          "## How to validate changes

" +
          "Run the full local green gate:

" +
          "- npm run green

" +
          "CI runs the CI-parity green gate:

" +
          "- npm run green:ci
"
  .\scripts\Write-Utf8NoBomLf.ps1 -Path "README.md" -Text $seed
  Assert-LFOnly "README.md"
}

# Guard payloads (base64, UTF-8)
$B64_GREEN = "aW1wb3J0IGZzIGZyb20gIm5vZGU6ZnMiOwppbXBvcnQgcGF0aCBmcm9tICJub2RlOnBhdGgiOwppbXBvcnQgcHJvY2VzcyBmcm9tICJub2RlOnByb2Nlc3MiOwoKZnVuY3Rpb24gZGllKG1zZykgewogIGNvbnNvbGUuZXJyb3IobXNnKTsKICBwcm9jZXNzLmV4aXQoMSk7Cn0KCmZ1bmN0aW9uIGV4aXN0cyhwKSB7CiAgdHJ5IHsKICAgIGZzLmFjY2Vzc1N5bmMocCwgZnMuY29uc3RhbnRzLkZfT0spOwogICAgcmV0dXJuIHRydWU7CiAgfSBjYXRjaCB7CiAgICByZXR1cm4gZmFsc2U7CiAgfQp9CgpmdW5jdGlvbiByZWFkVXRmOChwKSB7CiAgcmV0dXJuIGZzLnJlYWRGaWxlU3luYyhwLCAidXRmOCIpOwp9CgpmdW5jdGlvbiBsaXN0WWFtbEZpbGVzKGRpckFicykgewogIGlmICghZXhpc3RzKGRpckFicykpIHJldHVybiBbXTsKICByZXR1cm4gZnMKICAgIC5yZWFkZGlyU3luYyhkaXJBYnMsIHsgd2l0aEZpbGVUeXBlczogdHJ1ZSB9KQogICAgLmZpbHRlcigoZCkgPT4gZC5pc0ZpbGUoKSkKICAgIC5tYXAoKGQpID0+IGQubmFtZSkKICAgIC5maWx0ZXIoKG4pID0+IG4udG9Mb3dlckNhc2UoKS5lbmRzV2l0aCgiLnltbCIpIHx8IG4udG9Mb3dlckNhc2UoKS5lbmRzV2l0aCgiLnlhbWwiKSkKICAgIC5tYXAoKG4pID0+IHBhdGguam9pbihkaXJBYnMsIG4pKTsKfQoKY29uc3QgcmVwbyA9IHByb2Nlc3MuY3dkKCk7CmNvbnN0IHBrZ1BhdGggPSBwYXRoLmpvaW4ocmVwbywgInBhY2thZ2UuanNvbiIpOwppZiAoIWV4aXN0cyhwa2dQYXRoKSkgZGllKCJncmVlbl9jaV9wYXJpdHlfZ3VhcmQ6IHBhY2thZ2UuanNvbiBtaXNzaW5nIChydW4gZnJvbSByZXBvIHJvb3QpIik7CgpsZXQgcGtnOwp0cnkgewogIHBrZyA9IEpTT04ucGFyc2UocmVhZFV0ZjgocGtnUGF0aCkpOwp9IGNhdGNoIChlKSB7CiAgZGllKCJncmVlbl9jaV9wYXJpdHlfZ3VhcmQ6IGZhaWxlZCB0byBwYXJzZSBwYWNrYWdlLmpzb246ICIgKyBTdHJpbmcoZSkpOwp9Cgpjb25zdCBzY3JpcHRzID0gKHBrZyAmJiBwa2cuc2NyaXB0cykgfHwge307CmNvbnN0IGhhc0dyZWVuID0gT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eS5jYWxsKHNjcmlwdHMsICJncmVlbiIpOwoKaWYgKCFoYXNHcmVlbikgewogIGNvbnNvbGUubG9nKCJPSzogZ3JlZW5fY2lfcGFyaXR5X2d1YXJkIChubyBzY3JpcHRzLmdyZWVuOyBza2lwcGluZykiKTsKICBwcm9jZXNzLmV4aXQoMCk7Cn0KCmNvbnN0IHdmRGlyID0gcGF0aC5qb2luKHJlcG8sICIuZ2l0aHViIiwgIndvcmtmbG93cyIpOwpjb25zdCB5bWxzID0gbGlzdFlhbWxGaWxlcyh3ZkRpcik7CgppZiAoeW1scy5sZW5ndGggPT09IDApIHsKICBkaWUoImdyZWVuX2NpX3Bhcml0eV9ndWFyZDogc2NyaXB0cy5ncmVlbiBleGlzdHMgYnV0IG5vIHdvcmtmbG93IFlBTUwgZmlsZXMgZm91bmQgaW4gLmdpdGh1Yi93b3JrZmxvd3MiKTsKfQoKY29uc3QgbmVlZGxlID0gL25wbVxzK3J1blxzK2dyZWVuOmNpXGIvOwpsZXQgaGl0RmlsZSA9ICIiOwoKZm9yIChjb25zdCBmIG9mIHltbHMpIHsKICBjb25zdCB0eHQgPSByZWFkVXRmOChmKTsKICBpZiAobmVlZGxlLnRlc3QodHh0KSkgewogICAgaGl0RmlsZSA9IHBhdGgucmVsYXRpdmUocmVwbywgZik7CiAgICBicmVhazsKICB9Cn0KCmlmICghaGl0RmlsZSkgewogIGRpZSgiZ3JlZW5fY2lfcGFyaXR5X2d1YXJkOiBzY3JpcHRzLmdyZWVuIGV4aXN0cyBidXQgQ0kgZG9lcyBub3QgaW52b2tlICducG0gcnVuIGdyZWVuOmNpJyBpbiBhbnkgd29ya2Zsb3cgWUFNTCIpOwp9Cgpjb25zb2xlLmxvZygiT0s6IGdyZWVuX2NpX3Bhcml0eV9ndWFyZCAod29ya2Zsb3cgaW52b2tlcyBncmVlbjpjaTogIiArIGhpdEZpbGUgKyAiKSIpOwo="
$B64_README = "aW1wb3J0IGZzIGZyb20gIm5vZGU6ZnMiOwppbXBvcnQgcGF0aCBmcm9tICJub2RlOnBhdGgiOwppbXBvcnQgcHJvY2VzcyBmcm9tICJub2RlOnByb2Nlc3MiOwoKZnVuY3Rpb24gZGllKG1zZykgewogIGNvbnNvbGUuZXJyb3IobXNnKTsKICBwcm9jZXNzLmV4aXQoMSk7Cn0KCmZ1bmN0aW9uIGV4aXN0cyhwKSB7CiAgdHJ5IHsKICAgIGZzLmFjY2Vzc1N5bmMocCwgZnMuY29uc3RhbnRzLkZfT0spOwogICAgcmV0dXJuIHRydWU7CiAgfSBjYXRjaCB7CiAgICByZXR1cm4gZmFsc2U7CiAgfQp9Cgpjb25zdCByZXBvID0gcHJvY2Vzcy5jd2QoKTsKY29uc3QgcCA9IHBhdGguam9pbihyZXBvLCAiUkVBRE1FLm1kIik7CgppZiAoIWV4aXN0cyhwKSkgewogIGRpZSgicmVhZG1lX3ZhbGlkYXRpb25fY29udHJhY3RfZ3VhcmQ6IFJFQURNRS5tZCBtaXNzaW5nIik7Cn0KCmNvbnN0IHMgPSBmcy5yZWFkRmlsZVN5bmMocCwgInV0ZjgiKTsKCmZ1bmN0aW9uIHJlcXVpcmVJbmNsdWRlcyhuZWVkbGUsIGxhYmVsKSB7CiAgaWYgKCFzLmluY2x1ZGVzKG5lZWRsZSkpIHsKICAgIGRpZSgicmVhZG1lX3ZhbGlkYXRpb25fY29udHJhY3RfZ3VhcmQ6IG1pc3NpbmcgcmVxdWlyZWQgUkVBRE1FIGNvbnRyYWN0OiAiICsgbGFiZWwpOwogIH0KfQoKcmVxdWlyZUluY2x1ZGVzKCIjIyBIb3cgdG8gdmFsaWRhdGUgY2hhbmdlcyIsICJoZWFkaW5nICcjIyBIb3cgdG8gdmFsaWRhdGUgY2hhbmdlcyciKTsKcmVxdWlyZUluY2x1ZGVzKCJucG0gcnVuIGdyZWVuIiwgImNvbW1hbmQgJ25wbSBydW4gZ3JlZW4nIik7CnJlcXVpcmVJbmNsdWRlcygibnBtIHJ1biBncmVlbjpjaSIsICJjb21tYW5kICducG0gcnVuIGdyZWVuOmNpJyIpOwoKY29uc29sZS5sb2coIk9LOiByZWFkbWVfdmFsaWRhdGlvbl9jb250cmFjdF9ndWFyZCIpOwo="
Write-FileStrict "ci/guards/green_ci_parity_guard.mjs" (Decode-Base64Utf8 $B64_GREEN)
Write-FileStrict "ci/guards/readme_validation_contract_guard.mjs" (Decode-Base64Utf8 $B64_README)

# Wire into lint:fast (idempotent; keep clean_tree_guard first if present)
$pkgPath = (Resolve-Path ".\package.json").Path
$pkg = (Get-Content -Raw -LiteralPath $pkgPath) | ConvertFrom-Json

if ($null -eq $pkg.scripts) { throw "package.json missing scripts" }
if (-not ($pkg.scripts.PSObject.Properties.Name -contains "lint:fast")) { throw "scripts['lint:fast'] missing. Refusing." }

$guardChain = "node ci/guards/green_ci_parity_guard.mjs && node ci/guards/readme_validation_contract_guard.mjs"
$lintFast = [string]$pkg.scripts."lint:fast"

if ($lintFast -match [regex]::Escape("node ci/guards/green_ci_parity_guard.mjs")) {
  if ($lintFast -notmatch [regex]::Escape("node ci/guards/readme_validation_contract_guard.mjs")) {
    throw "lint:fast contains green_ci_parity_guard but not readme_validation_contract_guard. Refusing."
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
if (-not $json.EndsWith("
")) { $json += "
" }
.\scripts\Write-Utf8NoBomLf.ps1 -Path "package.json" -Text $json
Assert-LFOnly "package.json"

Write-Host "OK: guards installed + lint:fast wired + README ensured." -ForegroundColor Green