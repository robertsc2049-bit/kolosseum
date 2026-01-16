Write-Host "[guard] runtime boundary"

$RuntimeDir = "engine/src/runtime"

if (-not (Test-Path $RuntimeDir)) {
    Write-Error "Runtime directory not found: $RuntimeDir"
    exit 1
}

$ForbiddenPatterns = @(
    "registry",
    "registries",
    "registry_index",
    "exercise_registry",
    "phase4",
    "phase5",
    "planned_items",
    "substitution",
    "fs",
    "path",
    "crypto",
    "Math.random",
    "new Date"
)

foreach ($pattern in $ForbiddenPatterns) {
    $matches = Select-String -Path "$RuntimeDir\**\*" -Pattern $pattern -SimpleMatch
    if ($matches) {
        Write-Error "Runtime boundary violation: '$pattern' detected"
        $matches | ForEach-Object {
            Write-Host ("  " + $_.Path + ":" + $_.LineNumber)
        }
        exit 1
    }
}

Write-Host "Runtime boundary guard passed"
