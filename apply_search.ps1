$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path

Copy-Item "$root\search.js" "$root\..\search.js" -Force
Copy-Item "$root\index.html" "$root\..\index.html" -Force

$files = @(
  "0704.html","0708.html","0712.html","0714.html","0728.html","0729.html","0731.html",
  "0804.html","0809_01.html","0809_02.html","0813.html","0816.html","0820.html","0824.html","0828.html"
)

foreach ($name in $files) {
  $path = Join-Path (Split-Path -Parent $root) $name
  if (-not (Test-Path $path)) {
    Write-Warning "$name 을(를) 찾지 못했습니다. 건너뜁니다."
    continue
  }

  $text = Get-Content -Raw -Encoding UTF8 $path

  if ($text -notmatch '<script\s+src=["'']search\.js["'']\s*></script>') {
    $text = $text -replace '</body>', '  <script src="search.js"></script>`r`n</body>'
    Set-Content -Path $path -Value $text -Encoding UTF8
    Write-Host "수정: $name"
  } else {
    Write-Host "이미 적용됨: $name"
  }
}

Write-Host ""
Write-Host "검색 기능 적용이 완료되었습니다."
