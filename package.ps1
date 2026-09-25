# Builds dist/dthelper-<version>.zip for the Chrome Web Store.
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$manifest = Get-Content (Join-Path $root 'manifest.json') -Raw | ConvertFrom-Json
$version = $manifest.version
$dist = Join-Path $root 'dist'
$stage = Join-Path $dist 'stage'
if (Test-Path $stage) { Remove-Item -Recurse -Force $stage }
New-Item -ItemType Directory -Force $stage | Out-Null
foreach ($item in @('manifest.json', 'popup.html', 'popup.css', 'popup.js', 'content.css', 'js', 'icons')) {
    Copy-Item (Join-Path $root $item) (Join-Path $stage $item) -Recurse
}
$zip = Join-Path $dist ("dthelper-" + $version + ".zip")
if (Test-Path $zip) { Remove-Item -Force $zip }
Compress-Archive -Path (Join-Path $stage '*') -DestinationPath $zip
Remove-Item -Recurse -Force $stage
Write-Host "Created $zip"
