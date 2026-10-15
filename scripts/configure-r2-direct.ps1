$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$node = (Get-Command node -ErrorAction Stop).Source
$values = @{}
foreach ($name in @('R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY')) {
  $secure = Read-Host "Paste $name (input hidden)" -AsSecureString
  $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  try { $values[$name] = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer) }
  finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer); $secure.Dispose() }
  if ([string]::IsNullOrWhiteSpace($values[$name])) { throw "$name is required" }
}
$settings = New-Object Diagnostics.ProcessStartInfo
$settings.FileName = $node
$settings.WorkingDirectory = $projectRoot
$settings.UseShellExecute = $false
$settings.RedirectStandardInput = $true
$settings.Arguments = '"' + (Join-Path $projectRoot 'node_modules\wrangler\bin\wrangler.js') + '" secret bulk --config "' + (Join-Path $projectRoot 'wrangler.cloudflare.jsonc') + '"'
$process = New-Object Diagnostics.Process
$process.StartInfo = $settings
try {
  [void]$process.Start()
  $process.StandardInput.WriteLine(($values | ConvertTo-Json -Compress))
  $process.StandardInput.Close()
  $values.Clear()
  $process.WaitForExit()
  if ($process.ExitCode -ne 0) { throw 'Cloudflare secret configuration failed' }
  Write-Host 'R2 direct upload credentials configured. Refresh the website before uploading.'
} finally { $values.Clear(); $process.Dispose() }
