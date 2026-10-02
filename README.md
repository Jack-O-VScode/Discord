# Jungle Glass — my Discord theme

A personal Vencord theme for Discord on Windows:

- Custom background image (embedded in the theme, 2560×1440)
- Frosted glass panels (blurred, see-through)
- Sea-blue accent colour
- Nunito font

## First-time setup

1. **Install Vencord.** Download the Windows installer from <https://vencord.dev/download>, run it, and click **Install**. Then restart Discord fully: right-click Discord in the system tray and choose **Quit Discord**, then reopen it.
2. **Download this repo.** On GitHub click **Code → Download ZIP**, then unzip it somewhere, e.g. your Documents folder.
3. **Double-click `install-theme.bat`.** It puts your background into the theme and copies the theme into Vencord's themes folder (`%APPDATA%\Vencord\themes`).
4. **Turn it on.** In Discord, go to **User Settings → Vencord → Themes** and switch on **JungleGlass.theme.css**.

From then on you open Discord as usual and the theme loads automatically.

> If a big Discord update ever brings back the plain look, re-run the Vencord installer and click **Install** again. Your theme stays where it is.

## Changing the background

1. Replace `theme/background.jpg` with your new image. Keep the name `background`; `.jpg`, `.png`, `.webp` or `.gif` all work. Images around 2560×1440 look sharpest on a 1440p monitor.
2. Double-click `install-theme.bat` again.

## Tweaking the look

Open `%APPDATA%\Vencord\themes\JungleGlass.theme.css` in Notepad (or click **Edit** next to the theme in Vencord's Themes tab). The **SETTINGS** block at the top has everything:

| Setting | What it does |
|---|---|
| `--jg-accent` / `-hover` / `-light` | Accent colours (buttons, links, mentions) |
| `--jg-blur` | Blur strength behind panels (`0px` turns it off) |
| `--jg-panel-opacity` | Panel darkness: `0` = see-through, `1` = solid |
| `--jg-popup-opacity` | Darkness of menus, popouts and dialogs |
| `--jg-bg-dim` | Darkens the whole background image |
| `--jg-font` | Font, which can be any [Google Font](https://fonts.google.com) (also update the `@import` line) |

Save the file and Discord updates instantly.

**Tip:** To keep your tweaks, edit `theme/JungleGlass.theme.css` in this folder instead and re-run `install-theme.bat`. Running the .bat copies this folder's version over the one in `%APPDATA%`.

## Files

```
install-theme.bat          double-click to (re)install the theme
scripts/install-theme.ps1  the script the .bat runs
theme/JungleGlass.theme.css  the theme
theme/background.jpg       your background image
```
