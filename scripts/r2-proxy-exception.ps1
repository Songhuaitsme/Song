param([switch]$Restore)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$config = Get-Content -LiteralPath (Join-Path $projectRoot 'wrangler.cloudflare.jsonc') -Raw | ConvertFrom-Json
$account = [string]$config.vars.R2_ACCOUNT_ID
if ($account -notmatch '^[a-f0-9]{32}$') { throw 'Invalid R2 account ID' }
$storageHost = "$account.r2.cloudflarestorage.com"
$settingsPath = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Internet Settings'
$current = [string](Get-ItemProperty -LiteralPath $settingsPath).ProxyOverride
$backupPath = Join-Path $projectRoot 'var\r2-proxy-exception-backup.json'
$rules = @($current.Split(';') | Where-Object { $_ })
if ($Restore) {
  $backup = Get-Content -LiteralPath $backupPath -Raw | ConvertFrom-Json
  if ($backup.storageHost -ne $storageHost) { throw 'Proxy backup belongs to a different R2 account' }
  if (-not $backup.alreadyExcluded) { $rules = @($rules | Where-Object { $_ -ne $storageHost }) }
} else {
  if (-not (Test-Path -LiteralPath $backupPath)) {
    [void][IO.Directory]::CreateDirectory((Split-Path -Parent $backupPath))
    @{ originalProxyOverride=$current; storageHost=$storageHost; alreadyExcluded=($rules -contains $storageHost) } | ConvertTo-Json | Set-Content -LiteralPath $backupPath -Encoding UTF8
  }
  if ($rules -notcontains $storageHost) { $rules += $storageHost }
}
Set-ItemProperty -LiteralPath $settingsPath -Name ProxyOverride -Value ($rules -join ';')
if (-not ('SongProxyNative' -as [type])) {
  Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class SongProxyNative {
  [DllImport("wininet.dll", SetLastError=true)]
  public static extern bool InternetSetOption(IntPtr handle, int option, IntPtr buffer, int length);
}
'@
}
[void][SongProxyNative]::InternetSetOption([IntPtr]::Zero, 39, [IntPtr]::Zero, 0)
[void][SongProxyNative]::InternetSetOption([IntPtr]::Zero, 37, [IntPtr]::Zero, 0)
Write-Host $(if ($Restore) { 'R2 proxy exception removed.' } else { 'R2 storage now bypasses the system proxy. Refresh your browser before uploading.' })
