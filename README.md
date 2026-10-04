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
| `--jg-mention` | Ping colour: @mentions and the highlight on messages that ping you |
| `--jg-font` | `"Nunito"`, `"Inter"`, `"Outfit"`, `"Quicksand"` or `"gg sans"` (Discord's default) |
| `--jg-panel-opacity` | Glass panels: `0` = fully see-through, `1` = solid |
| `--jg-blur` | Blur behind panels: `0px` = none, `30px` = very blurry |
| `--jg-popup-opacity` | Menus, popouts and dialogs: `0` = see-through, `1` = solid |
| `--jg-bg-dim` | Darkens the background image: `0` = none, `1` = black |
| `--jg-effect` | Animated effect: `none`, `snow`, `rain`, `leaves`, `stars` or `fireflies` (no quotes). `none` turns it off completely. |
| `--jg-effect-speed` | Effect speed: `0.25` = slow, `3` = fast |
| `--jg-effect-size` | Effect size: `0.5` = tiny, `2.5` = big |
| `--jg-effect-opacity` | Effect opacity: `0.2` = faint, `1` = full |
| `--jg-effect-layer` | `panels` = under the text, `front` = over everything (clicks still go through) |

Your QuickCSS is saved by Vencord, so it stays even when you reinstall or update the theme. To go back to the defaults, delete those lines from QuickCSS.

## Changing the background

1. Replace `theme/background.jpg` with your new image. Keep the name `background`; `.jpg`, `.png`, `.webp` or `.gif` all work. Images around 2560×1440 look sharpest on a 1440p monitor.
2. Double-click `install-theme.bat` again.

## Files

```
install-theme.bat            double-click to (re)install the theme
setup-plugin.bat             double-click to build/update Vencord with the JungleEffects plugin
plugin/jungleEffects/        the plugin's source code
settings.css                 paste into QuickCSS to change settings inside Discord
scripts/install-theme.ps1    the script the .bat runs
theme/JungleGlass.theme.css  the theme
theme/background.jpg         your background image
```

## JungleEffects plugin (optional)

A small personal Vencord plugin that replaces the theme's CSS effects with a real particle system: every raindrop, snowflake, leaf, star and firefly gets its own random speed, size, path and spawn point. Settings use sliders inside Discord, and an effects button sits at the top of your server list.

It needs Vencord built from source, because custom plugins can't be added to the normal Vencord install.

### Setup (first time)

1. Install **Git**: <https://git-scm.com/download/win> (default options are fine).
2. Install **Node.js LTS**: <https://nodejs.org>.
3. Double-click **`setup-plugin.bat`**. It downloads Vencord to `%USERPROFILE%\Vencord`, adds the plugin, builds everything and installs it into Discord. When the Vencord installer asks, pick your normal Discord.
4. Fully quit Discord (system tray > Quit Discord) and reopen it.
5. **User Settings > Vencord > Plugins**, search **JungleEffects**, turn it on.

Your theme, QuickCSS and Vencord settings all carry over.

### Using it

Click the ✦ button at the top of your server list (or the gear next to JungleEffects in the Plugins list) to change the effect, speed, size, amount, opacity, layer and frame-rate limit. While the plugin is on, the theme's own CSS effect is switched off automatically.

### Updating

Double-click **`setup-plugin.bat`** again, then restart Discord.
