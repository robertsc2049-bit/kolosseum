param(
  [Parameter(Mandatory=$true, ParameterSetName="b64")][string]$JsB64
)

$ErrorActionPreference = "Stop"

# Decode UTF-8 (no BOM implied)
$bytes = [Convert]::FromBase64String($JsB64)
$Js = [System.Text.Encoding]::UTF8.GetString($bytes)

# Run JS as ESM via stdin: node --input-type=module -
$psi = New-Object System.Diagnostics.ProcessStartInfo
$psi.FileName = "node"
$psi.Arguments = "--input-type=module -"
$psi.UseShellExecute = $false
$psi.RedirectStandardInput = $true
$psi.RedirectStandardOutput = $true
$psi.RedirectStandardError = $true
$psi.CreateNoWindow = $true

$p = New-Object System.Diagnostics.Process
$p.StartInfo = $psi
[void]$p.Start()

$stdin = $p.StandardInput
$stdin.NewLine = "`n"
$stdin.Write($Js)
$stdin.Close()

$out = $p.StandardOutput.ReadToEnd()
$err = $p.StandardError.ReadToEnd()

$p.WaitForExit()

if ($out) { [Console]::Out.Write($out) }
if ($err) { [Console]::Error.Write($err) }

if ($p.ExitCode -ne 0) { exit $p.ExitCode }
