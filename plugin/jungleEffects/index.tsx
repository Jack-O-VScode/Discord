/*
 * Jungle Effects - animated background particles for the Jungle Glass theme.
 * Personal Vencord userplugin.
 */

import "./style.css";

import { plugins } from "@api/PluginManager";
import { addServerListElement, removeServerListElement, ServerListRenderPosition } from "@api/ServerList";
import { definePluginSettings } from "@api/Settings";
import ErrorBoundary from "@components/ErrorBoundary";
import { openPluginModal } from "@components/settings";
import definePlugin, { OptionType } from "@utils/types";
import { Tooltip } from "@webpack/common";

import { EffectName, EffectOptions, EffectsEngine, Layer } from "./engine";

const settings = definePluginSettings({
    effect: {
        type: OptionType.SELECT,
        description: "Which effect to show",
        options: [
            { label: "None (off)", value: "none" },
            { label: "Rain", value: "rain", default: true },
            { label: "Snow", value: "snow" },
            { label: "Leaves", value: "leaves" },
            { label: "Stars", value: "stars" },
            { label: "Fireflies", value: "fireflies" },
        ],
        onChange: () => applySettings(),
    },
    speed: {
        type: OptionType.SLIDER,
        description: "Speed (1 = normal)",
        markers: [0.25, 0.5, 0.75, 1, 1.5, 2, 2.5, 3],
        stickToMarkers: false,
        default: 1,
        onChange: () => applySettings(),
    },
    size: {
        type: OptionType.SLIDER,
        description: "Particle size (1 = normal)",
        markers: [0.5, 0.75, 1, 1.5, 2, 2.5],
        stickToMarkers: false,
        default: 1,
        onChange: () => applySettings(),
    },
    amount: {
        type: OptionType.SLIDER,
        description: "How many particles (1 = normal)",
        markers: [0.25, 0.5, 1, 1.5, 2, 3],
        stickToMarkers: false,
        default: 1,
        onChange: () => applySettings(),
    },
    opacity: {
        type: OptionType.SLIDER,
        description: "Opacity (1 = full strength)",
        markers: [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1],
        stickToMarkers: false,
        default: 0.8,
        onChange: () => applySettings(),
    },
    layer: {
        type: OptionType.SELECT,
        description: "Where the effect is drawn",
        options: [
            { label: "Under the text (on the glass panels)", value: "panels", default: true },
            { label: "In front of everything (clicks still go through)", value: "front" },
        ],
        onChange: () => applySettings(),
    },
    maxFps: {
        type: OptionType.SELECT,
        description: "Frame rate limit (lower = lighter on your PC)",
        options: [
            { label: "30 FPS", value: 30 },
            { label: "60 FPS", value: 60, default: true },
            { label: "120 FPS", value: 120 },
            { label: "Unlimited (match monitor)", value: 0 },
        ],
        onChange: () => applySettings(),
    },
    pauseWhenUnfocused: {
        type: OptionType.BOOLEAN,
        description: "Pause the effect while Discord isn't the focused window (e.g. while gaming)",
        default: false,
        onChange: () => applySettings(),
    },
    showButton: {
        type: OptionType.BOOLEAN,
        description: "Show the effects button at the top of the server list",
        default: true,
        onChange: (show: boolean) => (show ? addButton() : removeButton()),
    },
});

let engine: EffectsEngine | null = null;

function currentOptions(): EffectOptions {
    const s = settings.store;
    return {
        effect: s.effect as EffectName,
        speed: s.speed,
        size: s.size,
        amount: s.amount,
        opacity: s.opacity,
        layer: s.layer as Layer,
        maxFps: Number(s.maxFps),
        pauseWhenUnfocused: s.pauseWhenUnfocused,
    };
}

function applySettings() {
    engine?.update(currentOptions());
}

function openSettings() {
    openPluginModal(plugins.JungleEffects);
}

const EffectsButton = ErrorBoundary.wrap(() => (
    <Tooltip text="Background effects" position="right">
        {props => (
            <div
                {...props}
                className="vc-jungle-fx-btn"
                role="button"
                tabIndex={0}
                aria-label="Background effects settings"
                onClick={openSettings}
                onKeyDown={e => (e.key === "Enter" || e.key === " ") && openSettings()}
            >
                <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
                    <path
                        fill="currentColor"
                        d="M12 2l1.6 4.4L18 8l-4.4 1.6L12 14l-1.6-4.4L6 8l4.4-1.6L12 2zm6.5 10l.9 2.6L22 15.5l-2.6.9-.9 2.6-.9-2.6-2.6-.9 2.6-.9.9-2.6zM6 14l1.1 2.9L10 18l-2.9 1.1L6 22l-1.1-2.9L2 18l2.9-1.1L6 14z"
                    />
                </svg>
            </div>
        )}
    </Tooltip>
), { noop: true });

let buttonAdded = false;
function addButton() {
    if (buttonAdded) return;
    addServerListElement(ServerListRenderPosition.Above, EffectsButton);
    buttonAdded = true;
}
function removeButton() {
    if (!buttonAdded) return;
    removeServerListElement(ServerListRenderPosition.Above, EffectsButton);
    buttonAdded = false;
}

export default definePlugin({
    name: "JungleEffects",
    description: "Animated rain, snow, leaves, stars and fireflies over your background, each particle with its own speed and path.",
    authors: [{ name: "jack-o-vscode", id: 0n }],
    dependencies: ["ServerListAPI"],
    settings,

    start() {
        // The plugin replaces the theme's CSS-only effects, so switch those off
        document.documentElement.style.setProperty("--jg-effect", "none", "important");
        engine = new EffectsEngine(currentOptions());
        engine.start();
        if (settings.store.showButton) addButton();
    },

    stop() {
        engine?.stop();
        engine = null;
        removeButton();
        document.documentElement.style.removeProperty("--jg-effect");
    },
});
