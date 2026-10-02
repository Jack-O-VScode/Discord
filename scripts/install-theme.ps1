# Embeds theme\background.* into the theme file, then copies the theme into
# Vencord's themes folder. Run it via install-theme.bat (double-click).

$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$themeDir = Join-Path $root 'theme'
$themeFile = Join-Path $themeDir 'JungleGlass.theme.css'

# Find the background image (background.jpg / .jpeg / .png / .webp / .gif)
$image = Get-ChildItem -Path $themeDir -File |
    Where-Object { $_.BaseName -eq 'background' -and $_.Extension -match '^\.(jpe?g|png|webp|gif)$' } |
    Select-Object -First 1
if (-not $image) {
    throw "No background image found. Put a file named background.jpg (or .png/.webp/.gif) in $themeDir"
}

$mime = switch -Regex ($image.Extension.ToLower()) {
    '^\.jpe?g$' { 'image/jpeg' }
    '^\.png$'   { 'image/png' }
    '^\.webp$'  { 'image/webp' }
    '^\.gif$'   { 'image/gif' }
}

Write-Host "Embedding $($image.Name) ($([math]::Round($image.Length / 1MB, 2)) MB)..."
$base64 = [Convert]::ToBase64String([IO.File]::ReadAllBytes($image.FullName))
$newValue = "--jg-image: url(`"data:$mime;base64,$base64`");"

$css = [IO.File]::ReadAllText($themeFile)
$pattern = '--jg-image:\s*url\("[^"]*"\);'
if (-not [regex]::IsMatch($css, $pattern)) {
    throw "Couldn't find the --jg-image line in $themeFile"
}
$css = [regex]::Replace($css, $pattern, { param($m) $newValue })
[IO.File]::WriteAllText($themeFile, $css, (New-Object Text.UTF8Encoding $false))

# Copy into Vencord's themes folder
$vencordDir = Join-Path $env:APPDATA 'Vencord'
if (-not (Test-Path $vencordDir)) {
    throw "Vencord doesn't look installed ($vencordDir not found). Install Vencord first, then run this again."
}
$vencordThemes = Join-Path $vencordDir 'themes'
New-Item -ItemType Directory -Force -Path $vencordThemes | Out-Null
Copy-Item -Path $themeFile -Destination $vencordThemes -Force

Write-Host ""
Write-Host "Done! Theme copied to $vencordThemes"
Write-Host "In Discord: User Settings > Vencord > Themes > turn on 'JungleGlass.theme.css'."
