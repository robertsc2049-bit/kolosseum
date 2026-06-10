param()

$ErrorActionPreference = 'Stop'

if (-not (Test-Path '.\scripts\Write-Utf8NoBomLf.ps1')) {
  throw 'Missing scripts\Write-Utf8NoBomLf.ps1'
}

if (-not (Test-Path '.\README.md')) {
  .\scripts\Write-Utf8NoBomLf.ps1 -Path 'README.md' -Text "# Kolosseum`n`n"
}

$readme = Get-Content -Raw -LiteralPath '.\README.md'

$blockLines = @(
  '## How to validate changes',
  '',
  'Use the canonical green chain before committing or pushing:',
  '',
  '```bash',
  'npm run green',
  '```',
  '',
  'What it runs (fast -> slow):',
  '',
  '- `npm run lint:fast`',
  '- `npm run test:unit`',
  '- `npm run build:fast`',
  '- `npm run dev:fast`',
  '',
  'Rules:',
  '- Must start CLEAN and end CLEAN (no dirty tree after running checks).',
  '- If `package-lock.json` changes, you must also add `LOCKFILE_CHANGE_NOTE.md` (LF-only) and stage both.',
  ''
)

$block = $blockLines -join "`n"

$pattern = '(?ms)^## How to validate changes\s+.*?(?=^\#\#\s|\z)'

if ($readme -match $pattern) {
  $updated = [regex]::Replace($readme, $pattern, ($block.TrimEnd() + "`n`n"))
} else {
  if (-not $readme.EndsWith("`n")) { $readme += "`n" }
  $updated = $readme + "`n" + $block
}

if (-not $updated.EndsWith("`n")) { $updated += "`n" }

.\scripts\Write-Utf8NoBomLf.ps1 -Path 'README.md' -Text $updated

# Prove LF-only
$cr = Select-String -Path '.\README.md' -Pattern "`r" -AllMatches -ErrorAction SilentlyContinue
if ($cr) { throw 'README.md contains CRLF (`r). Refusing.' }

Write-Host 'OK: README.md updated (How to validate changes -> npm run green).'