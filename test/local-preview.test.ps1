# Windows integration tests. Close other services on port 5173 before running:
# powershell -NoProfile -ExecutionPolicy Bypass -File test/local-preview.test.ps1
$ErrorActionPreference = 'Stop'
$projectRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$testRoot = Join-Path $projectRoot ('var\preview-tests\space 中文 ' + [Guid]::NewGuid().ToString('N'))
$powershellPath = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
$nodePath = (Get-Command node.exe -CommandType Application).Source
$manualService = $null

function Assert-True([bool]$Condition, [string]$Message) {
  if (!$Condition) { throw $Message }
}

function Read-OutputLog([string]$Path) {
  $stream = [IO.File]::Open($Path, [IO.FileMode]::Open, [IO.FileAccess]::Read, [IO.FileShare]::ReadWrite)
  $reader = [IO.StreamReader]::new($stream, [Text.Encoding]::Default)
  try { return $reader.ReadToEnd() } finally { $reader.Dispose() }
}

function Invoke-Launcher([string]$Action = 'Start', [int]$Timeout = 15) {
  $invocation = [Guid]::NewGuid().ToString('N')
  $outputPath = Join-Path $testRoot ($invocation + '.stdout.log')
  $errorPath = Join-Path $testRoot ($invocation + '.stderr.log')
  $launcher = Start-Process -FilePath $powershellPath -WindowStyle Hidden -PassThru `
    -ArgumentList ('-NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "{0}" -Action {1} -NoDialog -NoBrowser -StartupTimeoutSeconds {2}' -f
      (Join-Path $testRoot 'scripts\local-preview.ps1'), $Action, $Timeout) `
    -RedirectStandardOutput $outputPath -RedirectStandardError $errorPath
  # Start-Process -Wait also waits for descendants on Windows. We only want
  # the launcher to exit, while its development server remains alive.
  [void]$launcher.Handle
  Assert-True ($launcher.WaitForExit(45000)) 'Launcher did not exit promptly.'
  return @{ code = $launcher.ExitCode; output = (Read-OutputLog $outputPath) + (Read-OutputLog $errorPath) }
}

function Read-ServiceRecord {
  return (Get-Content -LiteralPath (Join-Path $testRoot 'var\preview\service.json') -Raw | ConvertFrom-Json)
}

function Assert-Failure([string]$Expected) {
  $result = Invoke-Launcher
  Assert-True ($result.code -eq 1 -and $result.output.Contains($Expected)) ('Missing error: ' + $Expected + '; code=' + $result.code + '; output=' + $result.output)
}

try {
  $listeners = @(Get-NetTCPConnection -State Listen | Where-Object { $_.LocalPort -eq 5173 })
  Assert-True ($listeners.Count -eq 0) 'Close existing services on port 5173 before running these tests.'
  [void][IO.Directory]::CreateDirectory((Join-Path $testRoot 'scripts'))
  Copy-Item -LiteralPath (Join-Path $projectRoot 'scripts\local-preview.ps1') -Destination (Join-Path $testRoot 'scripts\local-preview.ps1')
  Assert-Failure '项目依赖尚未安装'
  foreach ($relativePath in @('node_modules\vinext\dist\cli.js', 'node_modules\vite\bin\vite.js')) {
    $fixturePath = Join-Path $testRoot $relativePath
    [void][IO.Directory]::CreateDirectory([IO.Path]::GetDirectoryName($fixturePath))
    [IO.File]::WriteAllText($fixturePath, '// test fixture')
  }
  Assert-Failure '本地配置尚未初始化'
  [IO.File]::WriteAllText((Join-Path $testRoot '.env.local'), '# test fixture')
  $savedPath = $env:PATH
  try {
    $env:PATH = ''
    Assert-Failure '未找到 Node.js'
  } finally { $env:PATH = $savedPath }
  Write-Output 'PASS: missing dependencies, configuration and Node.js'

  $fixtureSource = @'
import fs from "node:fs";
import http from "node:http";
import { spawn } from "node:child_process";
if (process.env.SONG_PREVIEW_TEST_FAIL === "1") process.exit(42);
fs.appendFileSync("starts.txt", `${process.pid}\n`);
fs.mkdirSync(".vinext/dev", { recursive: true });
fs.writeFileSync(".vinext/dev/lock.json", JSON.stringify({
  pid: process.pid, port: 5173, cwd: process.cwd(), startedAt: Date.now()
}));
const child = spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)"], {
  windowsHide: true, stdio: "ignore"
});
fs.writeFileSync("child.txt", String(child.pid));
const server = http.createServer((request, response) => {
  response.statusCode = process.env.SONG_PREVIEW_TEST_TIMEOUT === "1" ? 503 : 200;
  response.end("launcher test");
});
setTimeout(() => server.listen(5173, "127.0.0.1"), 1500);
setInterval(() => console.log("background log tick"), 500);
'@
  [IO.File]::WriteAllText((Join-Path $testRoot 'scripts\run-framework.mjs'), $fixtureSource)
  $result = Invoke-Launcher
  Assert-True ($result.code -eq 0) $result.output
  $firstRecord = Read-ServiceRecord
  Start-Sleep -Seconds 2
  $tickCount = @(Select-String -LiteralPath (Join-Path $testRoot 'var\preview\stdout.log') -Pattern 'background log tick').Count
  Assert-True ($tickCount -ge 4) 'Background output stopped after the launcher exited.'
  $result = Invoke-Launcher
  Assert-True ($result.code -eq 0) $result.output
  Assert-True ((Read-ServiceRecord).processId -eq $firstRecord.processId) 'Duplicate launch created a second service.'
  Assert-True (@(Get-Content -LiteralPath (Join-Path $testRoot 'starts.txt')).Count -eq 1) 'Service was started twice.'
  Write-Output 'PASS: delayed readiness, background lifetime/logging and repeated start'

  # A stale PID must not allow the stop command to terminate another process.
  $forgedRecord = $firstRecord.PSObject.Copy()
  $forgedRecord.startTicks = '0'
  $forgedRecord | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $testRoot 'var\preview\service.json') -Encoding UTF8
  $result = Invoke-Launcher 'Stop'
  Assert-True ($result.code -eq 0 -and $null -ne (Get-Process -Id $firstRecord.processId -ErrorAction SilentlyContinue)) 'Stale process identity was not protected.'
  $firstRecord | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $testRoot 'var\preview\service.json') -Encoding UTF8
  $childId = [int](Get-Content -LiteralPath (Join-Path $testRoot 'child.txt'))
  $result = Invoke-Launcher 'Stop'
  Assert-True ($result.code -eq 0) $result.output
  Assert-True ($null -eq (Get-Process -Id $firstRecord.processId -ErrorAction SilentlyContinue)) 'Service survived stop.'
  Assert-True ($null -eq (Get-Process -Id $childId -ErrorAction SilentlyContinue)) 'Child process survived stop.'
  Write-Output 'PASS: PID identity protection and process-tree stop'

  $result = Invoke-Launcher
  Assert-True ($result.code -eq 0) $result.output
  Assert-True ((Read-ServiceRecord).startTicks -ne $firstRecord.startTicks) 'Restart reused the terminated process.'
  $result = Invoke-Launcher 'Stop'
  Assert-True ($result.code -eq 0) $result.output
  Write-Output 'PASS: restart after stop'

  $manualService = Start-Process -FilePath $nodePath -WorkingDirectory $testRoot `
    -ArgumentList ('"{0}" dev' -f (Join-Path $testRoot 'scripts\run-framework.mjs')) -WindowStyle Hidden -PassThru `
    -RedirectStandardOutput (Join-Path $testRoot 'manual.stdout.log') -RedirectStandardError (Join-Path $testRoot 'manual.stderr.log')
  Start-Sleep -Seconds 3
  $result = Invoke-Launcher
  Assert-True ($result.code -eq 0) $result.output
  $result = Invoke-Launcher 'Stop'
  Assert-True ($null -ne (Get-Process -Id $manualService.Id -ErrorAction SilentlyContinue)) 'Manual service was stopped.'
  [IO.File]::WriteAllText((Join-Path $testRoot '.vinext\dev\lock.json'), '{}')
  Assert-Failure '端口 5173 已被其他程序占用'
  $stop = Start-Process -FilePath (Join-Path $env:SystemRoot 'System32\taskkill.exe') `
    -ArgumentList @('/PID', [string]$manualService.Id, '/T', '/F') -WindowStyle Hidden -PassThru -Wait
  Assert-True ($stop.ExitCode -eq 0) 'Could not clean up manual test service.'
  $manualService = $null
  Write-Output 'PASS: reuse manual service, stop ownership and occupied port'

  try {
    $env:SONG_PREVIEW_TEST_FAIL = '1'
    Assert-Failure '预览服务启动失败'
  } finally { Remove-Item Env:SONG_PREVIEW_TEST_FAIL -ErrorAction SilentlyContinue }
  try {
    $env:SONG_PREVIEW_TEST_TIMEOUT = '1'
    $result = Invoke-Launcher 'Start' 5
    Assert-True ($result.code -eq 1 -and $result.output.Contains('等待网页就绪超时')) 'Missing readiness timeout error.'
    Assert-True (!(Test-Path -LiteralPath (Join-Path $testRoot 'var\preview\service.json'))) 'Timeout did not clean up service state.'
    Assert-True (@(Get-NetTCPConnection -State Listen | Where-Object { $_.LocalPort -eq 5173 }).Count -eq 0) 'Timeout left the port occupied.'
  } finally { Remove-Item Env:SONG_PREVIEW_TEST_TIMEOUT -ErrorAction SilentlyContinue }
  Write-Output 'PASS: startup failure and timeout cleanup'

  # Execute both unmodified VBS entrypoints against a tiny action recorder.
  # The fixture includes spaces and Chinese characters, just like the service tests.
  $entryRoot = Join-Path $testRoot 'entry tests'
  [void][IO.Directory]::CreateDirectory((Join-Path $entryRoot 'scripts'))
  $entryHelper = @'
param([ValidateSet('Start', 'Stop')][string]$Action)
Add-Content -LiteralPath (Join-Path $PSScriptRoot '..\actions.txt') -Value $Action
exit 0
'@
  [IO.File]::WriteAllText((Join-Path $entryRoot 'scripts\local-preview.ps1'), $entryHelper)
  foreach ($entryName in @('启动网站.vbs', '停止网站.vbs')) {
    Copy-Item -LiteralPath (Join-Path $projectRoot $entryName) -Destination (Join-Path $entryRoot $entryName)
    $entry = Start-Process -FilePath (Join-Path $env:SystemRoot 'System32\wscript.exe') `
      -ArgumentList ('"{0}"' -f (Join-Path $entryRoot $entryName)) -WindowStyle Hidden -PassThru
    [void]$entry.Handle
    Assert-True ($entry.WaitForExit(10000) -and $entry.ExitCode -eq 0) ('VBS entry failed: ' + $entryName)
  }
  $actions = @(Get-Content -LiteralPath (Join-Path $entryRoot 'actions.txt'))
  Assert-True ($actions.Count -eq 2 -and $actions[0] -eq 'Start' -and $actions[1] -eq 'Stop') 'VBS entries sent incorrect actions.'
  Write-Output 'PASS: both VBS entrypoints with spaces and Chinese paths'
  Write-Output 'All launcher integration tests passed.'
} finally {
  if (Test-Path -LiteralPath (Join-Path $testRoot 'scripts\local-preview.ps1')) { [void](Invoke-Launcher 'Stop') }
  if ($manualService -and !$manualService.HasExited) {
    $cleanup = Start-Process -FilePath (Join-Path $env:SystemRoot 'System32\taskkill.exe') `
      -ArgumentList @('/PID', [string]$manualService.Id, '/T', '/F') -WindowStyle Hidden -PassThru -Wait
  }
}
