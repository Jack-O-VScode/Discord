# Jungle Glass — my Discord theme

A personal Vencord theme for Discord on Windows:

- Custom background image (embedded in the theme, 2560×1440)
- Frosted glass panels (blurred, see-through)
- Sea-blue accent colour
- Choice of fonts (Nunito, Inter, Outfit, Quicksand, or Discord's default)
- Settings you can change live from inside Discord

## First-time setup

1. **Install Vencord.** Download the Windows installer from <https://vencord.dev/download>, run it, and click **Install**. Then restart Discord fully: right-click Discord in the system tray and choose **Quit Discord**, then reopen it.
2. **Download this repo.** On GitHub click **Code → Download ZIP**, then unzip it somewhere, e.g. your Documents folder.
3. **Double-click `install-theme.bat`.** It puts your background into the theme and copies the theme into Vencord's themes folder (`%APPDATA%\Vencord\themes`).
4. **Turn it on.** In Discord, go to **User Settings → Vencord → Themes** and switch on **JungleGlass.theme.css**.

From then on you open Discord as usual and the theme loads automatically.

> If a Discord update ever brings back the plain look, re-run the Vencord installer and click **Install** again. Your theme and settings stay where they are.

## Changing settings inside Discord

1. In Discord, go to **User Settings → Vencord** and make sure **Enable Custom CSS** is on.
2. Click **Edit QuickCSS**. A code editor window opens.
3. Paste in everything from [`settings.css`](settings.css).
4. Change any value. Discord updates instantly as you type.

| Setting | What it does |
|---|---|
| `--jg-accent` | Accent colour. Click the little colour square next to it for a colour picker. Hover and link shades follow automatically. |
| `--jg-font` | `"Nunito"`, `"Inter"`, `"Outfit"`, `"Quicksand"` or `"gg sans"` (Discord's default) |
| `--jg-panel-opacity` | Glass panels: `0` = fully see-through, `1` = solid |
| `--jg-blur` | Background blur: `0px` = sharp image, `30px` = very blurry |
| `--jg-popup-opacity` | Menus, popouts and dialogs: `0` = see-through, `1` = solid |
| `--jg-bg-dim` | Darkens the background image: `0` = none, `1` = black |

Your QuickCSS is saved by Vencord, so it stays even when you reinstall or update the theme. To go back to the defaults, delete those lines from QuickCSS.

## Changing the background

1. Replace `theme/background.jpg` with your new image. Keep the name `background`; `.jpg`, `.png`, `.webp` or `.gif` all work. Images around 2560×1440 look sharpest on a 1440p monitor.
2. Double-click `install-theme.bat` again.

## Files

```
install-theme.bat            double-click to (re)install the theme
settings.css                 paste into QuickCSS to change settings inside Discord
scripts/install-theme.ps1    the script the .bat runs
theme/JungleGlass.theme.css  the theme
theme/background.jpg         your background image
```
