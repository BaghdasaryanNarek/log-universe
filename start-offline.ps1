<#
  Наше место среди звёзд — запуск собранного сайта БЕЗ Node и без интернета.
  Работает на любом Windows 10/11 (встроенный PowerShell 5.1 + .NET HttpListener).

  Использование (из папки, где лежат start-offline.ps1 и dist\):
    powershell -ExecutionPolicy Bypass -File .\start-offline.ps1
  Откроется браузер на http://localhost:8080/. Остановить — Ctrl+C в окне PowerShell.
#>
param([int]$Port = 8080, [string]$Root = (Join-Path $PSScriptRoot 'dist'))

if (-not (Test-Path (Join-Path $Root 'index.html'))) {
  Write-Host "Не найдена сборка: $Root\index.html. Сначала выполните 'pnpm build' или скопируйте папку dist рядом со скриптом." -ForegroundColor Red
  exit 1
}

$mime = @{
  '.html' = 'text/html; charset=utf-8'; '.js' = 'text/javascript; charset=utf-8'; '.css' = 'text/css; charset=utf-8'
  '.json' = 'application/json; charset=utf-8'; '.bin' = 'application/octet-stream'; '.svg' = 'image/svg+xml'
  '.png' = 'image/png'; '.jpg' = 'image/jpeg'; '.webp' = 'image/webp'; '.woff2' = 'font/woff2'; '.woff' = 'font/woff'
  '.ttf' = 'font/ttf'; '.ico' = 'image/x-icon'; '.txt' = 'text/plain; charset=utf-8'; '.mp3' = 'audio/mpeg'; '.ogg' = 'audio/ogg'
}

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$Port/")
try { $listener.Start() } catch {
  Write-Host "Порт $Port занят. Запустите с другим: -Port 8090" -ForegroundColor Red
  exit 1
}
$url = "http://localhost:$Port/"
Write-Host "Сайт запущен: $url  (Ctrl+C — остановить)" -ForegroundColor Green
Start-Process $url

$rootFull = [System.IO.Path]::GetFullPath($Root)
try {
  while ($listener.IsListening) {
    $ctx = $listener.GetContext()
    $path = [Uri]::UnescapeDataString($ctx.Request.Url.AbsolutePath.TrimStart('/'))
    if ($path -eq '') { $path = 'index.html' }
    $file = [System.IO.Path]::GetFullPath((Join-Path $rootFull $path))
    $res = $ctx.Response
    if (-not $file.StartsWith($rootFull) -or -not (Test-Path $file -PathType Leaf)) {
      $res.StatusCode = 404
      $bytes = [Text.Encoding]::UTF8.GetBytes('404')
    } else {
      $ext = [System.IO.Path]::GetExtension($file).ToLower()
      $res.ContentType = if ($mime.ContainsKey($ext)) { $mime[$ext] } else { 'application/octet-stream' }
      $bytes = [System.IO.File]::ReadAllBytes($file)
    }
    $res.Headers.Add('Cache-Control', 'no-cache')
    $res.ContentLength64 = $bytes.Length
    $res.OutputStream.Write($bytes, 0, $bytes.Length)
    $res.OutputStream.Close()
  }
} finally {
  $listener.Stop()
}
