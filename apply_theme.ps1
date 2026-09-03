$ErrorActionPreference = "Stop"
$root = (Split-Path -Parent $MyInvocation.MyCommand.Path) -replace '\\', '/'
$tmp = Join-Path $env:TEMP "most-apply-theme.js"

Copy-Item (Join-Path $root "apply_theme.js") $tmp -Force
$env:MOST_ROOT = $root
node $tmp
