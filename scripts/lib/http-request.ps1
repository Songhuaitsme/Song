param(
  [Parameter(Mandatory=$true)][string]$Url,
  [Parameter(Mandatory=$true)][string]$Method,
  [Parameter(Mandatory=$true)][string]$OutputPath,
  [Parameter(Mandatory=$true)][string]$MetaPath,
  [string]$BodyPath = "",
  [string]$ContentType = "application/octet-stream"
)
$headers = @{ Authorization = "Bearer $env:SONG_SYNC_SECRET" }
$arguments = @{ Uri=$Url; Method=$Method; Headers=$headers; SkipHttpErrorCheck=$true; TimeoutSec=180 }
if ($BodyPath) { $arguments.Body = [IO.File]::ReadAllBytes($BodyPath); $arguments.ContentType = $ContentType }
$response = Invoke-WebRequest @arguments
if ($response.Content -is [byte[]]) { [IO.File]::WriteAllBytes($OutputPath, $response.Content) }
else { [IO.File]::WriteAllText($OutputPath, [string]$response.Content, [Text.UTF8Encoding]::new($false)) }
$responseType = [string]$response.Headers.'Content-Type'
[IO.File]::WriteAllText($MetaPath, (@{ status=[int]$response.StatusCode; contentType=$responseType } | ConvertTo-Json -Compress), [Text.UTF8Encoding]::new($false))
