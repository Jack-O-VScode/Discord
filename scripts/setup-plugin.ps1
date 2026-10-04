# Builds Vencord from source with the JungleEffects plugin and installs it
# into Discord. Run it via setup-plugin.bat (double-click). Re-run it any
# time to update Vencord or the plugin.

$ErrorActionPreference = 'Stop'

function Step($text) { Write-Host ""; Write-Host "==> $text" -ForegroundColor Cyan }
function Run($exe, [string[]]$argList) {
    & $exe @argList
    if ($LASTEXITCODE -ne 0) { throw "'$exe $($argList -join ' ')' failed (exit code $LASTEXITCODE)" }
}

$root = Split-Path -Parent $PSScriptRoot
$pluginSrc = Join-Path $root 'plugin\jungleEffects'
$vencordDir = Join-Path $env:USERPROFILE 'Vencord'

Step 'Checking Git and Node.js'
foreach ($tool in 'git', 'node', 'npm') {
    if (-not (Get-Command $tool -ErrorAction SilentlyContinue)) {
        Write-Host "$tool is not installed." -ForegroundColor Red
        Write-Host "Install Git from https://git-scm.com/download/win and Node.js (LTS) from https://nodejs.org,"
        Write-Host "then close this window and run setup-plugin.bat again."
        exit 1
    }
}
Write-Host "$(git --version), node $(node --version)"

if (-not (Get-Command pnpm -ErrorAction SilentlyContinue)) {
    Step 'Installing pnpm (Vencord''s package manager)'
    Run 'npm' @('install', '-g', 'pnpm')
}

if (Test-Path (Join-Path $vencordDir '.git')) {
    Step "Updating Vencord in $vencordDir"
    Run 'git' @('-C', $vencordDir, 'pull', '--ff-only')
} else {
    Step "Downloading Vencord to $vencordDir"
    Run 'git' @('clone', 'https://github.com/Vendicated/Vencord.git', $vencordDir)
}

Step 'Adding the JungleEffects plugin'
$dest = Join-Path $vencordDir 'src\userplugins\jungleEffects'
New-Item -ItemType Directory -Force -Path $dest | Out-Null
Copy-Item -Path (Join-Path $pluginSrc '*') -Destination $dest -Recurse -Force

Push-Location $vencordDir
try {
    Step 'Installing Vencord''s dependencies (first time takes a few minutes)'
    Run 'pnpm' @('install', '--frozen-lockfile')

    Step 'Building Vencord'
    Run 'pnpm' @('build')

    Step 'Installing into Discord'
    Write-Host 'The Vencord installer will ask which Discord to patch: pick your normal Discord (usually Stable).'
    Run 'pnpm' @('inject')
} finally {
    Pop-Location
}

Write-Host ""
Write-Host "Done! Fully quit Discord (system tray > Quit Discord) and open it again." -ForegroundColor Green
Write-Host "Then: User Settings > Vencord > Plugins > search 'JungleEffects' > turn it on."
