
# DEV NOTE: Repository automation script. This file exists to make a repeatable repo operation
# deterministic and reviewable. Keep side effects explicit, paths repo-root relative, and
# failure output readable for PowerShell and CI users.

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
$B64_GREEN = "Ly8gQGxhdzogQ0kgSW50ZWdyaXR5Ci8vIEBzZXZlcml0eTogaGlnaAovLyBAc2NvcGU6IHJlcG8KCi8vIERFViBOT1RFOiBHcmVlbi9DSSBwYXJpdHkgZ3VhcmQuIFRoaXMgc2NyaXB0IHByb3RlY3RzIHRoZSBsb2NhbC10by1DSSBjb250cmFjdAovLyBieSByZXF1aXJpbmcgYSBHaXRIdWIgQWN0aW9ucyB3b3JrZmxvdyB0byBpbnZva2UgbnBtIHJ1biBncmVlbjpjaSB3aGVuZXZlcgovLyBwYWNrYWdlLmpzb24gZXhwb3NlcyBzY3JpcHRzLmdyZWVuLiBMb2NhbCBncmVlbiBhbmQgQ0kgZ3JlZW4gbXVzdCByZW1haW4gYWxpZ25lZAovLyBzbyBkZXZlbG9wZXJzIGRvIG5vdCB0cnVzdCBhIGxvY2FsIHBhdGggdGhhdCBDSSBuZXZlciBydW5zLgoKaW1wb3J0IGZzIGZyb20gIm5vZGU6ZnMiOwppbXBvcnQgcGF0aCBmcm9tICJub2RlOnBhdGgiOwppbXBvcnQgcHJvY2VzcyBmcm9tICJub2RlOnByb2Nlc3MiOwoKLyoqCiAqIERFViBOT1RFOiBUZXJtaW5hdGUgd2l0aCBhIHN0YWJsZSBndWFyZC1vd25lZCBtZXNzYWdlIGFuZCBub24temVybyBleGl0IGNvZGUuCiAqIENJIHBhcml0eSBmYWlsdXJlcyBzaG91bGQgYmUgcmVhZGFibGUgaW4gbG9jYWwgYW5kIEdpdEh1YiBBY3Rpb25zIG91dHB1dCByYXRoZXIKICogdGhhbiBzdXJmYWNpbmcgYXMgdW5oYW5kbGVkIEphdmFTY3JpcHQgc3RhY2sgdHJhY2VzLgogKi8KZnVuY3Rpb24gZGllKG1zZykgewogIGNvbnNvbGUuZXJyb3IobXNnKTsKICBwcm9jZXNzLmV4aXQoMSk7Cn0KCi8qKgogKiBERVYgTk9URTogRXhpc3RlbmNlIGhlbHBlciB1c2VkIGZvciBvcHRpb25hbCBzdXJmYWNlcy4KICogTWlzc2luZyB3b3JrZmxvd3MgY2FuIGJlIHZhbGlkIG9ubHkgd2hlbiBzY3JpcHRzLmdyZWVuIGlzIGFic2VudDsgb25jZSBncmVlbgogKiBleGlzdHMsIG1pc3Npbmcgd29ya2Zsb3cgZmlsZXMgYmVjb21lIGEgQ0kgcGFyaXR5IGZhaWx1cmUuCiAqLwpmdW5jdGlvbiBleGlzdHMocCkgewogIHRyeSB7CiAgICBmcy5hY2Nlc3NTeW5jKHAsIGZzLmNvbnN0YW50cy5GX09LKTsKICAgIHJldHVybiB0cnVlOwogIH0gY2F0Y2ggewogICAgcmV0dXJuIGZhbHNlOwogIH0KfQoKLyoqCiAqIERFViBOT1RFOiBSZWFkIFVURi04IHRleHQgZnJvbSByZXBvIGZpbGVzLiBUaGlzIGd1YXJkIG9ubHkgbmVlZHMgdGV4dHVhbAogKiBwYWNrYWdlL3dvcmtmbG93IGluc3BlY3Rpb24gYW5kIGRvZXMgbm90IGV4ZWN1dGUgd29ya2Zsb3cgWUFNTC4KICovCmZ1bmN0aW9uIHJlYWRVdGY4KHApIHsKICByZXR1cm4gZnMucmVhZEZpbGVTeW5jKHAsICJ1dGY4Iik7Cn0KCi8qKgogKiBERVYgTk9URTogTGlzdCB3b3JrZmxvdyBZQU1MIGZpbGVzIGZyb20gLmdpdGh1Yi93b3JrZmxvd3Mgd2l0aG91dCByZWN1cnNpb24uCiAqIEdpdEh1YiB3b3JrZmxvdyBlbnRyeXBvaW50cyBhcmUgZXhwZWN0ZWQgdG8gbGl2ZSBkaXJlY3RseSBpbiB0aGF0IGRpcmVjdG9yeSwKICogc28gaGlkZGVuIG5lc3RlZCBkaXNjb3ZlcnkgaXMgZGVsaWJlcmF0ZWx5IGF2b2lkZWQuCiAqLwpmdW5jdGlvbiBsaXN0WWFtbEZpbGVzKGRpckFicykgewogIGlmICghZXhpc3RzKGRpckFicykpIHJldHVybiBbXTsKICByZXR1cm4gZnMKICAgIC5yZWFkZGlyU3luYyhkaXJBYnMsIHsgd2l0aEZpbGVUeXBlczogdHJ1ZSB9KQogICAgLmZpbHRlcigoZCkgPT4gZC5pc0ZpbGUoKSkKICAgIC5tYXAoKGQpID0+IGQubmFtZSkKICAgIC5maWx0ZXIoKG4pID0+IG4udG9Mb3dlckNhc2UoKS5lbmRzV2l0aCgiLnltbCIpIHx8IG4udG9Mb3dlckNhc2UoKS5lbmRzV2l0aCgiLnlhbWwiKSkKICAgIC5tYXAoKG4pID0+IHBhdGguam9pbihkaXJBYnMsIG4pKTsKfQoKY29uc3QgcmVwbyA9IHByb2Nlc3MuY3dkKCk7CmNvbnN0IHBrZ1BhdGggPSBwYXRoLmpvaW4ocmVwbywgInBhY2thZ2UuanNvbiIpOwoKLy8gREVWIE5PVEU6IHBhY2thZ2UuanNvbiBpcyBtYW5kYXRvcnkgYmVjYXVzZSBzY3JpcHRzLmdyZWVuIGlzIHRoZSB0cmlnZ2VyIGZvcgovLyB0aGlzIHBhcml0eSBydWxlLiBSdW5uaW5nIG91dHNpZGUgdGhlIHJlcG8gcm9vdCBzaG91bGQgZmFpbCBsb3VkbHkuCmlmICghZXhpc3RzKHBrZ1BhdGgpKSBkaWUoImdyZWVuX2NpX3Bhcml0eV9ndWFyZDogcGFja2FnZS5qc29uIG1pc3NpbmcgKHJ1biBmcm9tIHJlcG8gcm9vdCkiKTsKCmxldCBwa2c7CnRyeSB7CiAgcGtnID0gSlNPTi5wYXJzZShyZWFkVXRmOChwa2dQYXRoKSk7Cn0gY2F0Y2ggKGUpIHsKICBkaWUoImdyZWVuX2NpX3Bhcml0eV9ndWFyZDogZmFpbGVkIHRvIHBhcnNlIHBhY2thZ2UuanNvbjogIiArIFN0cmluZyhlKSk7Cn0KCmNvbnN0IHNjcmlwdHMgPSAocGtnICYmIHBrZy5zY3JpcHRzKSB8fCB7fTsKY29uc3QgaGFzR3JlZW4gPSBPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwoc2NyaXB0cywgImdyZWVuIik7CgovLyBERVYgTk9URTogSWYgbm8gbG9jYWwgZ3JlZW4gc2NyaXB0IGV4aXN0cywgdGhlcmUgaXMgbm8gZ3JlZW4tdG8tQ0kgcGFyaXR5Ci8vIGNvbnRyYWN0IHRvIGVuZm9yY2UuIFRoaXMgaXMgYSBkZWxpYmVyYXRlIHNraXAsIG5vdCBhcHByb3ZhbCBvZiBDSSBjb3ZlcmFnZS4KaWYgKCFoYXNHcmVlbikgewogIGNvbnNvbGUubG9nKCJPSzogZ3JlZW5fY2lfcGFyaXR5X2d1YXJkIChubyBzY3JpcHRzLmdyZWVuOyBza2lwcGluZykiKTsKICBwcm9jZXNzLmV4aXQoMCk7Cn0KCmNvbnN0IHdmRGlyID0gcGF0aC5qb2luKHJlcG8sICIuZ2l0aHViIiwgIndvcmtmbG93cyIpOwpjb25zdCB5bWxzID0gbGlzdFlhbWxGaWxlcyh3ZkRpcik7CgppZiAoeW1scy5sZW5ndGggPT09IDApIHsKICBkaWUoImdyZWVuX2NpX3Bhcml0eV9ndWFyZDogc2NyaXB0cy5ncmVlbiBleGlzdHMgYnV0IG5vIHdvcmtmbG93IFlBTUwgZmlsZXMgZm91bmQgaW4gLmdpdGh1Yi93b3JrZmxvd3MiKTsKfQoKLy8gREVWIE5PVEU6IFRoZSByZXF1aXJlZCBDSSBpbnZvY2F0aW9uIGlzIG5wbSBydW4gZ3JlZW46Y2ksIG5vdCBucG0gcnVuIGdyZWVuLgovLyBncmVlbjpjaSBpcyB0aGUgQ0ktc2FmZSBlbnRyeXBvaW50IGFuZCBhdm9pZHMgbG9jYWwtb25seSBhc3N1bXB0aW9ucyBsZWFraW5nCi8vIGludG8gR2l0SHViIEFjdGlvbnMuCmNvbnN0IG5lZWRsZSA9IC9ucG1ccytydW5ccytncmVlbjpjaVxiLzsKbGV0IGhpdEZpbGUgPSAiIjsKCi8vIERFViBOT1RFOiBBbnkgd29ya2Zsb3cgbWF5IG93biB0aGUgaW52b2NhdGlvbiwgYnV0IGF0IGxlYXN0IG9uZSBtdXN0IGNvbnRhaW4gaXQuCi8vIFRoZSBmaXJzdCBoaXQgaXMgcmVwb3J0ZWQgc28gZnV0dXJlIGRldmVsb3BlcnMgY2FuIGxvY2F0ZSB0aGUgQ0kgcGFyaXR5IGFuY2hvci4KZm9yIChjb25zdCBmIG9mIHltbHMpIHsKICBjb25zdCB0eHQgPSByZWFkVXRmOChmKTsKICBpZiAobmVlZGxlLnRlc3QodHh0KSkgewogICAgaGl0RmlsZSA9IHBhdGgucmVsYXRpdmUocmVwbywgZik7CiAgICBicmVhazsKICB9Cn0KCi8vIERFViBOT1RFOiBGYWlsdXJlIG1lYW5zIGxvY2FsIGdyZWVuIGV4aXN0cyB3aXRob3V0IGEgbWF0Y2hpbmcgQ0kgZ3JlZW4gcGF0aC4KLy8gRG8gbm90IGZpeCB0aGlzIGJ5IGRlbGV0aW5nIHNjcmlwdHMuZ3JlZW4gb3Igd2Vha2VuaW5nIHRoZSByZWdleDsgd2lyZSBDSSB0bwovLyBucG0gcnVuIGdyZWVuOmNpIHVubGVzcyB0aGUgcmVsZWFzZSBib3VuZGFyeSBpbnRlbnRpb25hbGx5IGNoYW5nZXMuCmlmICghaGl0RmlsZSkgewogIGRpZSgiZ3JlZW5fY2lfcGFyaXR5X2d1YXJkOiBzY3JpcHRzLmdyZWVuIGV4aXN0cyBidXQgQ0kgZG9lcyBub3QgaW52b2tlICducG0gcnVuIGdyZWVuOmNpJyBpbiBhbnkgd29ya2Zsb3cgWUFNTCIpOwp9CgovLyBERVYgTk9URTogU3VjY2VzcyBtZWFucyBDSSBoYXMgYXQgbGVhc3Qgb25lIHZpc2libGUgd29ya2Zsb3cgcGF0aCBpbnZva2luZyB0aGUKLy8gQ0ktc2FmZSBncmVlbiBzY3JpcHQuIEl0IGRvZXMgbm90IHByb3ZlIGV2ZXJ5IHdvcmtmbG93IGlzIGNvbXBsZXRlIGJ5IGl0c2VsZi4KY29uc29sZS5sb2coIk9LOiBncmVlbl9jaV9wYXJpdHlfZ3VhcmQgKHdvcmtmbG93IGludm9rZXMgZ3JlZW46Y2k6ICIgKyBoaXRGaWxlICsgIikiKTsK"
$B64_README = "Ly8gQGxhdzogQ29udHJhY3RzCi8vIEBzZXZlcml0eTogaGlnaAovLyBAc2NvcGU6IHJlcG8KCi8vIERFViBOT1RFOiBDSSBndWFyZCBzdXJmYWNlLiBUaGlzIGZpbGUgZW5mb3JjZXMgYSByZXBvIGJvdW5kYXJ5IGFuZCBzaG91bGQgZmFpbCBjbG9zZWQgd2l0aAovLyByZWFkYWJsZSBvdXRwdXQuIERvIG5vdCB3ZWFrZW4gdGhlIGd1YXJkIHRvIG1ha2UgYSBmYWlsaW5nIGJ1aWxkIHBhc3M7IGZpeCB0aGUgdW5kZXJseWluZwovLyBib3VuZGFyeSBkcmlmdCBvciB1cGRhdGUgdGhlIGNhbm9uaWNhbCBjb250cmFjdCBkZWxpYmVyYXRlbHkuCgppbXBvcnQgZnMgZnJvbSAibm9kZTpmcyI7CmltcG9ydCBwYXRoIGZyb20gIm5vZGU6cGF0aCI7CmltcG9ydCBwcm9jZXNzIGZyb20gIm5vZGU6cHJvY2VzcyI7CgpmdW5jdGlvbiBkaWUobXNnKSB7CiAgY29uc29sZS5lcnJvcihtc2cpOwogIHByb2Nlc3MuZXhpdCgxKTsKfQoKZnVuY3Rpb24gZXhpc3RzKHApIHsKICB0cnkgewogICAgZnMuYWNjZXNzU3luYyhwLCBmcy5jb25zdGFudHMuRl9PSyk7CiAgICByZXR1cm4gdHJ1ZTsKICB9IGNhdGNoIHsKICAgIHJldHVybiBmYWxzZTsKICB9Cn0KCmNvbnN0IHJlcG8gPSBwcm9jZXNzLmN3ZCgpOwpjb25zdCBwID0gcGF0aC5qb2luKHJlcG8sICJSRUFETUUubWQiKTsKCmlmICghZXhpc3RzKHApKSB7CiAgZGllKCJyZWFkbWVfdmFsaWRhdGlvbl9jb250cmFjdF9ndWFyZDogUkVBRE1FLm1kIG1pc3NpbmciKTsKfQoKY29uc3QgcyA9IGZzLnJlYWRGaWxlU3luYyhwLCAidXRmOCIpOwoKZnVuY3Rpb24gcmVxdWlyZUluY2x1ZGVzKG5lZWRsZSwgbGFiZWwpIHsKICBpZiAoIXMuaW5jbHVkZXMobmVlZGxlKSkgewogICAgZGllKCJyZWFkbWVfdmFsaWRhdGlvbl9jb250cmFjdF9ndWFyZDogbWlzc2luZyByZXF1aXJlZCBSRUFETUUgY29udHJhY3Q6ICIgKyBsYWJlbCk7CiAgfQp9CgpmdW5jdGlvbiBmb3JiaWRJbmNsdWRlcyhuZWVkbGUsIGxhYmVsKSB7CiAgaWYgKHMuaW5jbHVkZXMobmVlZGxlKSkgewogICAgZGllKCJyZWFkbWVfdmFsaWRhdGlvbl9jb250cmFjdF9ndWFyZDogZm9yYmlkZGVuIFJFQURNRSBzdHJpbmcgKHBvbGljeSk6ICIgKyBsYWJlbCk7CiAgfQp9CgpyZXF1aXJlSW5jbHVkZXMoIiMjIEhvdyB0byB2YWxpZGF0ZSBjaGFuZ2VzIiwgImhlYWRpbmcgJyMjIEhvdyB0byB2YWxpZGF0ZSBjaGFuZ2VzJyIpOwpyZXF1aXJlSW5jbHVkZXMoIm5wbSBydW4gdmVyaWZ5IiwgImNvbW1hbmQgJ25wbSBydW4gdmVyaWZ5JyIpOwoKLy8gUG9saWN5OiBSRUFETUUgbXVzdCBub3QgaW5zdHJ1Y3QgaHVtYW5zIHRvIHJ1biBpbnRlcm5hbCBncmVlbiBlbnRyeXBvaW50cy4KZm9yYmlkSW5jbHVkZXMoIm5wbSBydW4gZ3JlZW46Y2kiLCAiY29tbWFuZCAnbnBtIHJ1biBncmVlbjpjaSciKTsKZm9yYmlkSW5jbHVkZXMoIm5wbSBydW4gZ3JlZW4iLCAiY29tbWFuZCAnbnBtIHJ1biBncmVlbiciKTsKCmNvbnNvbGUubG9nKCJPSzogcmVhZG1lX3ZhbGlkYXRpb25fY29udHJhY3RfZ3VhcmQiKTsK"
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
