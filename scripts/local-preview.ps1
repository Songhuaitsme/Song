param(
  [ValidateSet('Start', 'Stop')][string]$Action = 'Start',
  [switch]$NoBrowser,
  [switch]$NoDialog,
  [ValidateRange(5, 300)][int]$StartupTimeoutSeconds = 120
)

# Windows PowerShell 5.1 reads the Chinese messages using this file's UTF-8 BOM.
$ErrorActionPreference = 'Stop'
$projectRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$previewDirectory = Join-Path $projectRoot 'var\preview'
$statePath = Join-Path $previewDirectory 'service.json'
$launcherLog = Join-Path $previewDirectory 'launcher.log'
$frameworkLockPath = Join-Path $projectRoot '.vinext\dev\lock.json'
$runnerPath = Join-Path $projectRoot 'scripts\run-framework.mjs'
$siteUrl = 'http://127.0.0.1:5173/'
$controlLock = $null
$startedService = $null
$exitCode = 0

function Write-LauncherLog([string]$Message) {
  Add-Content -LiteralPath $launcherLog -Value ('{0:o} [{1}] {2}' -f [DateTime]::Now, $Action, $Message) -Encoding UTF8
}

function Show-Notice([string]$Message, [bool]$IsError = $false) {
  if ($NoDialog) {
    Write-Output $Message
    return
  }
  $popup = New-Object -ComObject WScript.Shell
  $icon = if ($IsError) { 16 } else { 64 }
  [void]$popup.Popup($Message, 0, 'Song 网站预览', $icon)
}

function Read-JsonFile([string]$Path) {
  if (Test-Path -LiteralPath $Path) {
    try { return (Get-Content -LiteralPath $Path -Raw -Encoding UTF8 | ConvertFrom-Json) }
    catch { Write-LauncherLog ('忽略无效记录：' + $Path) }
  }
  return $null
}

function Get-OwnedService {
  $record = Read-JsonFile $statePath
  if (!$record -or $record.root -ne $projectRoot -or $record.port -ne 5173) { return $null }
  $service = Get-Process -Id ([int]$record.processId) -ErrorAction SilentlyContinue
  if (!$service) { return $null }
  # PID alone is insufficient: Windows can reuse it for a different program.
  if ($service.StartTime.ToUniversalTime().Ticks.ToString() -ne [string]$record.startTicks -or
      $service.Path -ne $record.executable) { return $null }
  return $service
}

function Get-PortOwners {
  # Querying all listeners avoids treating "no matching connection" as an error.
  return @(Get-NetTCPConnection -State Listen -ErrorAction Stop |
    Where-Object { $_.LocalPort -eq 5173 } |
    Select-Object -ExpandProperty OwningProcess -Unique)
}

function Get-ExistingProjectService {
  $record = Read-JsonFile $frameworkLockPath
  if (!$record -or $record.cwd -ne $projectRoot -or $record.port -ne 5173) { return $null }
  $service = Get-Process -Id ([int]$record.pid) -ErrorAction SilentlyContinue
  if (!$service -or $service.ProcessName -ne 'node') { return $null }
  $startedAt = [DateTimeOffset]::FromUnixTimeMilliseconds([long]$record.startedAt).UtcDateTime
  $age = ($startedAt - $service.StartTime.ToUniversalTime()).TotalSeconds
  if ($age -lt 0 -or $age -gt 120) { return $null }
  $owners = @(Get-PortOwners)
  if ($owners.Count -eq 0 -or @($owners | Where-Object { $_ -ne $service.Id }).Count -gt 0) { return $null }
  # The framework records the checkout root, PID and launch time; the listener
  # must also belong to that process. Reusing it does not claim stop ownership.
  return $service
}

function Stop-OwnedService($Service) {
  $Service.Refresh()
  if ($Service.HasExited) {
    Remove-Item -LiteralPath $statePath -Force -ErrorAction SilentlyContinue
    return
  }
  # Also usable for startup cleanup if writing the state file failed.
  $current = Get-Process -Id $Service.Id -ErrorAction SilentlyContinue
  if (!$current -or $current.StartTime.ToUniversalTime().Ticks -ne $Service.StartTime.ToUniversalTime().Ticks -or
      $current.Path -ne $Service.Path) { throw '进程记录已变化，未停止其他程序。' }
  $stopProcess = Start-Process -FilePath (Join-Path $env:SystemRoot 'System32\taskkill.exe') `
    -ArgumentList @('/PID', [string]$current.Id, '/T', '/F') -WindowStyle Hidden -PassThru -Wait
  if ($stopProcess.ExitCode -ne 0 -and (Get-OwnedService)) {
    throw '无法停止预览服务，请查看日志后重试。'
  }
  if (!$current.WaitForExit(10000)) { throw '预览服务未能及时停止，请重试。' }
  Remove-Item -LiteralPath $statePath -Force -ErrorAction SilentlyContinue
  Write-LauncherLog ('已停止进程 ' + $current.Id)
}

function Wait-Website($Service) {
  $deadline = [DateTime]::UtcNow.AddSeconds($StartupTimeoutSeconds)
  while ([DateTime]::UtcNow -lt $deadline) {
    $Service.Refresh()
    if ($Service.HasExited) { throw '预览服务启动失败，请查看 stdout.log 和 stderr.log。' }
    $owners = @(Get-PortOwners)
    if (@($owners | Where-Object { $_ -ne $Service.Id }).Count -gt 0) {
      throw '端口 5173 已被其他程序占用。请先关闭占用程序，再双击“启动网站”。'
    }
    if ($owners -contains $Service.Id) {
      try {
        $response = Invoke-WebRequest -Uri $siteUrl -UseBasicParsing -TimeoutSec 5
        if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 300) { return }
      } catch {
        # Compilation can take a few seconds or return a temporary error.
      }
    }
    Start-Sleep -Milliseconds 500
  }
  throw "等待网页就绪超时（$StartupTimeoutSeconds 秒）。请查看日志，修复源码或环境问题后重试。"
}

try {
  [void][IO.Directory]::CreateDirectory($previewDirectory)
  # Serialize double-clicks and stop requests across launcher processes.
  $lockDeadline = [DateTime]::UtcNow.AddSeconds($StartupTimeoutSeconds + 15)
  while (!$controlLock) {
    try {
      $controlLock = [IO.File]::Open((Join-Path $previewDirectory 'control.lock'),
        [IO.FileMode]::OpenOrCreate, [IO.FileAccess]::ReadWrite, [IO.FileShare]::None)
    } catch [IO.IOException] {
      if ([DateTime]::UtcNow -ge $lockDeadline) { throw '另一个启动或停止操作尚未完成，请稍后重试。' }
      Start-Sleep -Milliseconds 500
    }
  }
  $service = Get-OwnedService
  if ($Action -eq 'Stop') {
    if ($service) {
      Stop-OwnedService $service
      Show-Notice '网站预览已停止。下次双击“启动网站”即可重新打开。'
    } else {
      Remove-Item -LiteralPath $statePath -Force -ErrorAction SilentlyContinue
      Show-Notice '没有由“启动网站”入口运行的预览服务。通过终端启动的服务请在原终端停止。'
    }
  } else {
    if (!$service) { $service = Get-ExistingProjectService }
    if (!$service) {
      if (@(Get-PortOwners).Count -gt 0) {
        throw '端口 5173 已被其他程序占用。请先关闭占用程序，再双击“启动网站”。'
      }
      $nodeCommand = Get-Command node.exe -CommandType Application -ErrorAction SilentlyContinue
      if (!$nodeCommand) { throw '未找到 Node.js。请安装 Node.js 22.13 或更新版本后重试。' }
      foreach ($relativePath in @('node_modules\vinext\dist\cli.js', 'node_modules\vite\bin\vite.js')) {
        if (!(Test-Path -LiteralPath (Join-Path $projectRoot $relativePath))) {
          throw '项目依赖尚未安装。请先按 README 完成 npm install，再双击“启动网站”。'
        }
      }
      if (!(Test-Path -LiteralPath (Join-Path $projectRoot '.env.local'))) {
        throw '本地配置尚未初始化。请先按 README 完成 npm run setup，再双击“启动网站”。'
      }
      Remove-Item -LiteralPath $statePath -Force -ErrorAction SilentlyContinue
      $previousPreviewFlag = $env:SONG_LOCAL_PREVIEW
      try {
        $env:SONG_LOCAL_PREVIEW = '1'
        $service = Start-Process -FilePath $nodeCommand.Source -WorkingDirectory $projectRoot `
          -ArgumentList ('"{0}" dev --hostname 127.0.0.1' -f $runnerPath) `
          -WindowStyle Hidden -PassThru `
          -RedirectStandardOutput (Join-Path $previewDirectory 'stdout.log') `
          -RedirectStandardError (Join-Path $previewDirectory 'stderr.log')
      } finally { $env:SONG_LOCAL_PREVIEW = $previousPreviewFlag }
      $startedService = $service
      $record = @{
        root = $projectRoot; port = 5173; processId = $service.Id
        startTicks = $service.StartTime.ToUniversalTime().Ticks.ToString()
        executable = $nodeCommand.Source
      }
      $record | ConvertTo-Json | Set-Content -LiteralPath $statePath -Encoding UTF8
      Write-LauncherLog ('已启动进程 ' + $service.Id)
    } else { Write-LauncherLog ('复用进程 ' + $service.Id) }
    Wait-Website $service
    # A browser failure should leave the healthy service available for retry.
    $startedService = $null
    if (!$NoBrowser) { Start-Process -FilePath $siteUrl }
    Write-LauncherLog ('网页已就绪：' + $siteUrl)
    Write-Output ('网页已就绪：' + $siteUrl)
  }
} catch {
  $exitCode = 1
  $message = $_.Exception.Message
  if ($startedService) {
    try { Stop-OwnedService $startedService }
    catch { $message += "`r`n清理服务失败：" + $_.Exception.Message }
  }
  try { Write-LauncherLog $message } catch {}
  Show-Notice ($message + "`r`n`r`n日志目录：" + $previewDirectory) $true
} finally {
  if ($controlLock) { $controlLock.Dispose() }
}
exit $exitCode
