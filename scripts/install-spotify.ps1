# Installs the Jungle Glass theme + extension into Spicetify, applies it,
# and blocks Spotify auto-updates (which is what keeps resetting the theme).
# Run it via install-spotify.bat (double-click). Re-run it after changing
# theme\background.jpg.

# 'Continue' so Spicetify printing warnings doesn't abort the script;
# real failures are checked with $LASTEXITCODE below.
$ErrorActionPreference = 'Continue'

function Step($text) { Write-Host ""; Write-Host "==> $text" -ForegroundColor Cyan }

$root = Split-Path -Parent $PSScriptRoot
$srcTheme = Join-Path $root 'spotify\Themes\JungleGlass'
$srcExt = Join-Path $root 'spotify\Extensions\jungleGlass.js'
$themeDir = Join-Path $root 'theme'

Step 'Checking Spicetify'
if (-not (Get-Command spicetify -ErrorAction SilentlyContinue)) {
    Write-Host 'Spicetify is not installed (or not on PATH).' -ForegroundColor Red
    Write-Host 'Install it from https://spicetify.app, then run install-spotify.bat again.'
    exit 1
}

# The Microsoft Store version updates itself through the Store, so blocking
# updates (and so keeping the theme) can't work reliably with it.
if (Get-AppxPackage -Name '*Spotify*' -ErrorAction SilentlyContinue) {
    Write-Host ''
    Write-Host 'Heads up: you have the Microsoft Store version of Spotify.' -ForegroundColor Yellow
    Write-Host 'The Store updates it by itself, which removes the theme. For the theme to stick,' -ForegroundColor Yellow
    Write-Host 'uninstall it and install Spotify from https://www.spotify.com/download instead.' -ForegroundColor Yellow
}

# Find Spicetify's folder (normally %APPDATA%\spicetify)
$spiceDir = $null
try {
    $cfg = (& spicetify -c 2>$null | Select-Object -Last 1).Trim()
    if ($cfg -and (Test-Path $cfg)) { $spiceDir = Split-Path -Parent $cfg }
} catch { }
if (-not $spiceDir) { $spiceDir = Join-Path $env:APPDATA 'spicetify' }
if (-not (Test-Path $spiceDir)) { throw "Couldn't find Spicetify's folder ($spiceDir)." }
Write-Host "Spicetify folder: $spiceDir"

$previous = (& spicetify config current_theme 2>$null | Select-Object -Last 1)
if ($previous) { Write-Host "Your current theme is: $previous (to switch back later: spicetify config current_theme $previous ; spicetify apply)" }

Step 'Copying the theme'
$destTheme = Join-Path $spiceDir 'Themes\JungleGlass'
New-Item -ItemType Directory -Force -Path $destTheme -ErrorAction Stop | Out-Null
Copy-Item (Join-Path $srcTheme 'color.ini') $destTheme -Force -ErrorAction Stop

# Embed the wallpaper (same one as the Discord theme) into user.css
$image = Get-ChildItem -Path $themeDir -File |
    Where-Object { $_.BaseName -eq 'background' -and $_.Extension -match '^\.(jpe?g|png|webp|gif)$' } |
    Select-Object -First 1
if (-not $image) { throw "No background image found in $themeDir" }
$mime = switch -Regex ($image.Extension.ToLower()) {
    '^\.jpe?g$' { 'image/jpeg' }
    '^\.png$'   { 'image/png' }
    '^\.webp$'  { 'image/webp' }
    '^\.gif$'   { 'image/gif' }
}
$base64 = [Convert]::ToBase64String([IO.File]::ReadAllBytes($image.FullName))
$css = [IO.File]::ReadAllText((Join-Path $srcTheme 'user.css'))
$css = $css.Replace('__BACKGROUND__', "data:$mime;base64,$base64")
[IO.File]::WriteAllText((Join-Path $destTheme 'user.css'), $css, (New-Object Text.UTF8Encoding $false))
Write-Host "Wallpaper: $($image.Name)"

Step 'Copying the extension'
$destExt = Join-Path $spiceDir 'Extensions'
New-Item -ItemType Directory -Force -Path $destExt -ErrorAction Stop | Out-Null
Copy-Item $srcExt $destExt -Force -ErrorAction Stop

Step 'Configuring Spicetify'
& spicetify config current_theme JungleGlass color_scheme Base inject_css 1 replace_colors 1 overwrite_assets 0
if ($LASTEXITCODE -ne 0) { throw 'spicetify config failed' }
# remove first so re-running doesn't add it twice, then add
& spicetify config extensions jungleGlass.js- 2>$null | Out-Null
& spicetify config extensions jungleGlass.js
if ($LASTEXITCODE -ne 0) { throw 'spicetify config extensions failed' }

Step 'Applying (Spotify will restart)'
& spicetify apply
if ($LASTEXITCODE -ne 0) {
    # After a Spotify update the old backup no longer matches; Spicetify's own
    # advice is "spicetify backup apply", which backs up the new version first.
    Write-Host 'Apply failed - making a fresh backup of the updated Spotify first.' -ForegroundColor Yellow
    & spicetify backup apply
    if ($LASTEXITCODE -ne 0) {
        Write-Host 'Still failing - trying restore backup apply.' -ForegroundColor Yellow
        & spicetify restore backup apply
        if ($LASTEXITCODE -ne 0) { throw 'spicetify apply failed' }
    }
}

Step 'Blocking Spotify auto-updates (so the theme stops resetting)'
& spicetify spotify-updates block
if ($LASTEXITCODE -ne 0) {
    Write-Host "Couldn't block updates. Run 'spicetify upgrade' and then install-spotify.bat again." -ForegroundColor Yellow
}

Write-Host ""
Write-Host 'Done! Click the sparkle button in Spotify''s top bar to change the look and effects.' -ForegroundColor Green
Write-Host 'If a Spotify update ever removes the theme, double-click fix-spotify.bat.'
