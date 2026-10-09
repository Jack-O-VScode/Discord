# Re-applies the Jungle Glass Spotify theme if a Spotify update removed it.
#
# Run it with fix-spotify.bat (double-click).
#
# It only does something when the theme is missing: Spicetify copies
# jungleGlass.js into Spotify's files when it applies the theme, and a
# Spotify update wipes those files.

param(
    [int]$Delay = 0   # optional: seconds to wait before checking
)

$ErrorActionPreference = 'Continue'
$logDir = Join-Path $env:LOCALAPPDATA 'JungleGlass'
New-Item -ItemType Directory -Force -Path $logDir | Out-Null
$log = Join-Path $logDir 'spotify-autofix.log'

function Log($msg) {
    $line = "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')  $msg"
    Write-Host $line
    Add-Content -Path $log -Value $line
}

if ($Delay -gt 0) { Start-Sleep -Seconds $Delay }

# Find spicetify (normally on PATH; the official installer puts it here otherwise)
$spicetify = (Get-Command spicetify -ErrorAction SilentlyContinue).Source
if (-not $spicetify) {
    $candidate = Join-Path $env:LOCALAPPDATA 'spicetify\spicetify.exe'
    if (Test-Path $candidate) { $spicetify = $candidate }
}
if (-not $spicetify) {
    Log 'Spicetify not found - nothing to do.'
    exit 1
}

# Find Spotify (website version installs to %APPDATA%\Spotify)
$spotifyDir = $null
try {
    $p = (& $spicetify config spotify_path 2>$null | Select-Object -Last 1)
    if ($p) { $p = $p.Trim() }
    if ($p -and (Test-Path $p)) { $spotifyDir = $p }
} catch { }
if (-not $spotifyDir) { $spotifyDir = Join-Path $env:APPDATA 'Spotify' }

$marker = Join-Path $spotifyDir 'Apps\xpui\extensions\jungleGlass.js'
if (Test-Path $marker) {
    Log 'Theme is in place - nothing to do.'
    exit 0
}

Log 'Theme is missing (Spotify probably updated). Re-applying...'

# -q answers Spicetify's yes/no questions automatically, so this can run hidden
& $spicetify -q backup apply
if ($LASTEXITCODE -ne 0) {
    Log 'backup apply failed - trying restore backup apply.'
    & $spicetify -q restore backup apply
}

if (Test-Path $marker) {
    Log 'Theme re-applied.'
} else {
    Log 'Could not re-apply automatically. Run install-spotify.bat by hand.'
}

& $spicetify -q spotify-updates block
if ($LASTEXITCODE -eq 0) { Log 'Spotify updates blocked again.' } else { Log 'Could not block Spotify updates.' }
