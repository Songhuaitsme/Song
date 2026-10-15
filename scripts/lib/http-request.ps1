param(
  [Parameter(Mandatory=$true)][string]$Url,
  [Parameter(Mandatory=$true)][string]$Method,
  [Parameter(Mandatory=$true)][string]$OutputPath,
  [Parameter(Mandatory=$true)][string]$MetaPath,
  [string]$BodyPath = "",
  [string]$ContentType = "application/octet-stream"
)
$ErrorActionPreference = 'Stop'
$request = [Net.HttpWebRequest]::Create($Url)
$request.Method = $Method
$request.Headers['Authorization'] = 'Bearer ' + $env:SONG_SYNC_SECRET
$request.Timeout = 180000
$request.ReadWriteTimeout = 180000
$request.ServicePoint.Expect100Continue = $false
$request.AllowWriteStreamBuffering = $false
if ($BodyPath) {
  $request.ContentType = $ContentType
  $inputStream = [IO.File]::OpenRead($BodyPath)
  $request.ContentLength = $inputStream.Length
  try {
    $upload = $request.GetRequestStream()
    try { $inputStream.CopyTo($upload) } finally { $upload.Dispose() }
  } finally { $inputStream.Dispose() }
}
try { $response = $request.GetResponse() }
catch [Net.WebException] {
  if (-not $_.Exception.Response) { throw }
  $response = $_.Exception.Response
}
try {
  $outputStream = [IO.File]::Create($OutputPath)
  try {
    $download = $response.GetResponseStream()
    try { $download.CopyTo($outputStream) } finally { $download.Dispose() }
  } finally { $outputStream.Dispose() }
  [IO.File]::WriteAllText($MetaPath, (@{ status=[int]$response.StatusCode; contentType=[string]$response.ContentType } | ConvertTo-Json -Compress), [Text.UTF8Encoding]::new($false))
} finally { $response.Dispose() }
