// NAME: Jungle Glass
// AUTHOR: jack-o-vscode
// DESCRIPTION: Settings button for the Jungle Glass theme plus animated rain, snow, leaves, stars and fireflies.

/// <reference path="../globals.d.ts" />

(function JungleGlass() {
    if (!(window.Spicetify && Spicetify.Topbar && Spicetify.PopupModal && Spicetify.LocalStorage && document.querySelector(".Root__top-container"))) {
        setTimeout(JungleGlass, 300);
        return;
    }

    // ------------------------------------------------------------------
    // Settings
    // ------------------------------------------------------------------

    const STORAGE_KEY = "jungleGlass:settings";
    const DEFAULTS = {
        accent: "#0fa3b8",
        font: "Nunito",
        panelOpacity: 0.5,
        blur: 12,
        bgDim: 0.2,
        effect: "rain",
        speed: 1,
        size: 1,
        amount: 1,
        effectOpacity: 0.8,
        layer: "panels",
        maxFps: 60,
        pauseWhenUnfocused: false,
    };

    function load() {
        try {
            return { ...DEFAULTS, ...JSON.parse(Spicetify.LocalStorage.get(STORAGE_KEY) || "{}") };
        } catch {
            return { ...DEFAULTS };
        }
    }

    let settings = load();

    function save() {
        Spicetify.LocalStorage.set(STORAGE_KEY, JSON.stringify(settings));
    }

    function applyTheme() {
        const s = document.documentElement.style;
        s.setProperty("--jg-accent", settings.accent);
        s.setProperty("--jg-font", settings.font === "Default" ? "\"SpotifyMixUI\", \"CircularSp\"" : `"${settings.font}"`);
        s.setProperty("--jg-panel-opacity", String(settings.panelOpacity));
        s.setProperty("--jg-blur", `${settings.blur}px`);
        s.setProperty("--jg-bg-dim", String(settings.bgDim));
        const hex = settings.accent.replace("#", "");
        const rgb = [0, 2, 4].map(i => parseInt(hex.slice(i, i + 2), 16)).join(",");
        s.setProperty("--spice-rgb-button", rgb);
        s.setProperty("--spice-rgb-notification", rgb);
    }

    // ------------------------------------------------------------------
    // Particle engine (same as the Discord plugin)
    // ------------------------------------------------------------------

    const PANEL_SELECTOR = ".Root__nav-bar, .Root__main-view, .Root__right-sidebar";
    const REF_AREA = 2560 * 1440;
    const BASE_COUNT = { rain: 320, snow: 230, leaves: 42, stars: 240, fireflies: 48 };
    const LEAF_COLORS = ["#7aa65a", "#5e8c4a", "#c9a24a", "#d9822b", "#9bb85a", "#b5652a", "#8fa84e"];

    const rand = (a, b) => a + Math.random() * (b - a);
    const pick = arr => arr[(Math.random() * arr.length) | 0];

    function makeSprite(size, draw) {
        const c = document.createElement("canvas");
        c.width = c.height = size;
        draw(c.getContext("2d"), size);
        return c;
    }

    function softDot(color, inner) {
        return makeSprite(64, (c, s) => {
            const g = c.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
            g.addColorStop(0, color);
            g.addColorStop(0.35, inner);
            g.addColorStop(1, "rgba(0,0,0,0)");
            c.fillStyle = g;
            c.fillRect(0, 0, s, s);
        });
    }

    function leafSprite(color) {
        return makeSprite(64, (c, s) => {
            c.translate(s / 2, s / 2);
            c.scale(s / 26, s / 26);
            const sk = rand(-2, 2);
            c.beginPath();
            c.moveTo(0, -10);
            c.bezierCurveTo(6 + sk, -5, 6, 5, 0, 10);
            c.bezierCurveTo(-6, 5, -6 + sk, -5, 0, -10);
            c.fillStyle = color;
            c.fill();
            c.beginPath();
            c.moveTo(0, -9);
            c.lineTo(0, 12);
            c.strokeStyle = "rgba(40,30,10,.35)";
            c.lineWidth = 0.8;
            c.stroke();
        });
    }

    class EffectsEngine {
        constructor(opts) {
            this.opts = { ...opts };
            this.particles = [];
            this.canvases = new Map();
            this.frontCanvas = null;
            this.raf = 0;
            this.scanTimer = 0;
            this.last = 0;
            this.lastDraw = 0;
            this.t = 0;
            this.W = 0;
            this.H = 0;
            this.restored = [];
            this.shooting = null;
            this.nextShooting = rand(4, 10);
            this.sprites = {};
            this.base = { dpr: 1, ox: 0, oy: 0 };
            this.onResize = () => {
                this.resize();
                this.spawnAll();
            };
            this.frame = this.frame.bind(this);
        }

        start() {
            this.stop();
            if (this.opts.effect === "none") return;
            this.resize();
            this.spawnAll();
            this.scan();
            this.scanTimer = setInterval(() => this.scan(), 1000);
            window.addEventListener("resize", this.onResize);
            this.last = performance.now();
            this.raf = requestAnimationFrame(this.frame);
        }

        stop() {
            cancelAnimationFrame(this.raf);
            clearInterval(this.scanTimer);
            window.removeEventListener("resize", this.onResize);
            for (const c of this.canvases.values()) c.remove();
            this.canvases.clear();
            if (this.frontCanvas) this.frontCanvas.remove();
            this.frontCanvas = null;
            this.restored.forEach(fn => fn());
            this.restored = [];
            this.particles = [];
        }

        update(opts) {
            const prev = this.opts;
            this.opts = { ...prev, ...opts };
            if (prev.effect !== this.opts.effect || prev.layer !== this.opts.layer) return this.start();
            if (prev.amount !== this.opts.amount) this.spawnAll();
        }

        resize() {
            this.W = window.innerWidth;
            this.H = window.innerHeight;
        }

        makeCanvas() {
            const c = document.createElement("canvas");
            c.className = "jg-fx-canvas";
            c.setAttribute("aria-hidden", "true");
            Object.assign(c.style, { pointerEvents: "none", width: "100%", height: "100%", display: "block" });
            return c;
        }

        scan() {
            if (this.opts.layer === "front") {
                if (!this.frontCanvas || !this.frontCanvas.isConnected) {
                    this.frontCanvas = this.makeCanvas();
                    Object.assign(this.frontCanvas.style, { position: "fixed", inset: "0", zIndex: "2147483000" });
                    document.body.appendChild(this.frontCanvas);
                }
                return;
            }

            const hosts = findPanels();

            for (const [host, canvas] of this.canvases) {
                if (!host.isConnected || !hosts.includes(host)) {
                    canvas.remove();
                    this.canvases.delete(host);
                }
            }

            for (const host of hosts) {
                const existing = this.canvases.get(host);
                if (existing && existing.parentElement === host) continue;
                if (existing) existing.remove();

                const cs = getComputedStyle(host);
                if (cs.position === "static") {
                    host.style.position = "relative";
                    this.restored.push(() => host.style.removeProperty("position"));
                }
                if (cs.isolation !== "isolate") {
                    host.style.isolation = "isolate";
                    this.restored.push(() => host.style.removeProperty("isolation"));
                }

                const canvas = this.makeCanvas();
                // above the panel's own background, below its content
                Object.assign(canvas.style, { position: "absolute", inset: "0", zIndex: "-1" });
                host.appendChild(canvas);
                this.canvases.set(host, canvas);
            }

        }

        count() {
            const e = this.opts.effect;
            if (e === "none") return 0;
            const n = BASE_COUNT[e] * this.opts.amount * (this.W * this.H) / REF_AREA;
            return Math.min(2000, Math.max(1, Math.round(n)));
        }

        spawnAll() {
            const e = this.opts.effect;
            if (e === "snow" && !this.sprites.snow) this.sprites.snow = softDot("rgba(255,255,255,1)", "rgba(255,255,255,.85)");
            if (e === "fireflies" && !this.sprites.firefly) this.sprites.firefly = softDot("rgba(244,255,176,1)", "rgba(216,245,106,.85)");
            if (e === "leaves" && !this.sprites.leaves) this.sprites.leaves = LEAF_COLORS.flatMap(c => [leafSprite(c), leafSprite(c)]);
            this.particles = [];
            const n = this.count();
            for (let i = 0; i < n; i++) this.particles.push(this.spawn(true));
        }

        spawn(initial) {
            const { W, H } = this;
            const d = Math.pow(Math.random(), 1.6); // more far particles than near ones
            const p = {
                x: rand(-0.1 * W, 1.1 * W), y: initial ? rand(-0.1 * H, H) : 0,
                d, vx: 0, vy: 0, a: 1, s: 1, ph: rand(0, Math.PI * 2), f: rand(0.4, 1.4),
                amp: 0, rot: rand(0, Math.PI * 2), vr: 0, sprite: 0,
            };
            switch (this.opts.effect) {
                case "rain":
                    // near drops fall faster and look longer (motion blur), like real rain
                    p.vy = rand(1100, 1300) + 900 * d;
                    p.s = p.vy * rand(0.014, 0.019);
                    p.a = 0.12 + 0.45 * d;
                    p.amp = rand(-0.012, 0.012); // tiny per-drop angle difference
                    p.x = rand(-0.2 * H, W);
                    if (!initial) p.y = -rand(0, 0.15 * H) - p.s;
                    break;
                case "snow":
                    p.vy = rand(25, 45) + 75 * d;
                    p.s = 0.8 + 3.6 * d + rand(-0.3, 0.3);
                    p.a = 0.35 + 0.6 * d;
                    p.amp = rand(10, 35) * (0.5 + d);
                    p.f = rand(0.3, 0.9);
                    if (!initial) p.y = -rand(5, 60);
                    break;
                case "leaves":
                    p.vy = rand(35, 55) + 55 * d;
                    p.s = 0.5 + 1.0 * d + rand(-0.1, 0.1);
                    p.a = 0.5 + 0.45 * d;
                    p.amp = rand(25, 70);
                    p.f = rand(0.4, 1.0);
                    p.vr = rand(0.6, 2.2) * pick([1, -1]);
                    p.sprite = (Math.random() * ((this.sprites.leaves && this.sprites.leaves.length) || 1)) | 0;
                    if (!initial) p.y = -rand(20, 120);
                    break;
                case "stars":
                    p.x = rand(0, W);
                    p.y = rand(0, H);
                    p.s = 0.5 + 1.4 * d;
                    p.a = 0.4 + 0.6 * Math.random();
                    p.f = rand(0.3, 1.4);
                    break;
                case "fireflies":
                    p.x = rand(0, W);
                    p.y = rand(0, H);
                    p.s = 3 + 6 * d;
                    p.a = 0.6 + 0.4 * d;
                    p.rot = rand(0, Math.PI * 2); // heading
                    p.vy = rand(14, 34);          // wander speed
                    p.f = rand(0.3, 0.9);         // blink speed
                    break;
            }
            return p;
        }

        // Rain angle: every drop shares it; it drifts slowly between ~1 and ~10 degrees.
        rainSlant(t) {
            return 0.1 + 0.05 * Math.sin(t * 0.05) + 0.03 * Math.sin(t * 0.13 + 1);
        }

        // smooth gusts for snow and leaves
        wind(t) {
            return 0.22 + 0.32 * Math.sin(t * 0.13) + 0.2 * Math.sin(t * 0.31 + 1.7) + 0.12 * Math.sin(t * 0.71 + 0.4);
        }

        step(dt) {
            const { W, H } = this;
            const sp = this.opts.speed;
            const t = this.t;
            const wind = this.wind(t);
            const slant = this.rainSlant(t);
            const ps = this.particles;

            for (let i = 0; i < ps.length; i++) {
                let p = ps[i];
                switch (this.opts.effect) {
                    case "rain":
                        p.vx = p.vy * (slant + p.amp);
                        p.x += p.vx * dt * sp;
                        p.y += p.vy * dt * sp;
                        if (p.y - p.s * this.opts.size > H) ps[i] = this.spawn(false);
                        break;
                    case "snow": {
                        const sway = Math.cos(t * p.f * 2 + p.ph) * p.amp * p.f;
                        p.x += ((wind - 0.22) * (30 + 50 * p.d) + sway) * dt * sp;
                        p.y += p.vy * dt * sp;
                        if (p.y > H + 10) ps[i] = this.spawn(false);
                        break;
                    }
                    case "leaves": {
                        const sway = Math.cos(t * p.f * 2 + p.ph) * p.amp * p.f;
                        p.x += (wind * (60 + 80 * p.d) + sway) * dt * sp;
                        p.y += (p.vy + Math.sin(t * p.f * 4 + p.ph) * 12) * dt * sp;
                        p.rot += p.vr * dt * sp;
                        if (p.y > H + 30 || p.x > 1.25 * W) {
                            p = ps[i] = this.spawn(false);
                            if (wind > 0.3) p.x = rand(-0.4 * W, 0.8 * W);
                        }
                        break;
                    }
                    case "fireflies":
                        p.rot += rand(-1.6, 1.6) * dt * sp;
                        p.x += Math.cos(p.rot) * p.vy * dt * sp;
                        p.y += (Math.sin(p.rot) * p.vy - 6) * dt * sp;
                        if (p.x < -30) p.x = W + 30;
                        else if (p.x > W + 30) p.x = -30;
                        if (p.y < -30) p.y = H + 30;
                        else if (p.y > H + 30) p.y = -30;
                        break;
                }
            }

            if (this.opts.effect === "stars") {
                this.nextShooting -= dt * sp;
                if (!this.shooting && this.nextShooting <= 0) {
                    const ang = rand(0.35, 0.6);
                    const v = rand(900, 1300);
                    this.shooting = { x: rand(0.1 * W, 0.7 * W), y: rand(0, 0.4 * H), vx: Math.cos(ang) * v, vy: Math.sin(ang) * v, life: rand(0.6, 0.9) };
                    this.nextShooting = rand(6, 16);
                }
                if (this.shooting) {
                    const s = this.shooting;
                    s.x += s.vx * dt * sp;
                    s.y += s.vy * dt * sp;
                    s.life -= dt * sp;
                    if (s.life <= 0) this.shooting = null;
                }
            }
        }

        applyBase(ctx) {
            const { dpr, ox, oy } = this.base;
            ctx.setTransform(dpr, 0, 0, dpr, -ox * dpr, -oy * dpr);
        }

        draw(ctx, ox, oy, w, h) {
            const { size } = this.opts;
            const opacity = this.opts.effectOpacity;
            const t = this.t;
            const ps = this.particles;
            const pad = 80 * size;
            const inView = p => p.x > ox - pad && p.x < ox + w + pad && p.y > oy - pad && p.y < oy + h + pad;

            switch (this.opts.effect) {
                case "rain": {
                    ctx.lineCap = "round";
                    ctx.strokeStyle = "rgb(205,225,255)";
                    for (let b = 0; b < 4; b++) {
                        const lo = b / 4, hi = (b + 1) / 4;
                        ctx.globalAlpha = opacity * (0.12 + 0.45 * (lo + hi) / 2);
                        ctx.lineWidth = (0.6 + 1.1 * (lo + hi) / 2) * size;
                        ctx.beginPath();
                        for (const p of ps) {
                            if (p.d < lo || p.d >= hi || !inView(p)) continue;
                            const len = p.s * size;
                            const k = len / Math.hypot(p.vx, p.vy);
                            ctx.moveTo(p.x, p.y);
                            ctx.lineTo(p.x - p.vx * k, p.y - p.vy * k);
                        }
                        ctx.stroke();
                    }
                    break;
                }
                case "snow": {
                    const sp = this.sprites.snow;
                    for (const p of ps) {
                        if (!inView(p)) continue;
                        const r = p.s * size * 2.2;
                        ctx.globalAlpha = opacity * p.a;
                        ctx.drawImage(sp, p.x - r, p.y - r, r * 2, r * 2);
                    }
                    break;
                }
                case "leaves": {
                    const sprites = this.sprites.leaves;
                    for (const p of ps) {
                        if (!inView(p)) continue;
                        const s = p.s * size * 26;
                        const flip = Math.cos(t * p.f * 3 + p.ph); // 3D tumble
                        ctx.globalAlpha = opacity * p.a;
                        this.applyBase(ctx);
                        ctx.translate(p.x, p.y);
                        ctx.rotate(p.rot);
                        ctx.scale(Math.max(0.15, Math.abs(flip)) * (Math.sign(flip) || 1), 1);
                        ctx.drawImage(sprites[p.sprite % sprites.length], -s / 2, -s / 2, s, s);
                    }
                    this.applyBase(ctx);
                    break;
                }
                case "stars": {
                    ctx.fillStyle = "#fff";
                    for (const p of ps) {
                        if (!inView(p)) continue;
                        const tw = 0.5 + 0.5 * Math.sin(t * p.f * 2 + p.ph);
                        ctx.globalAlpha = opacity * p.a * (0.15 + 0.85 * tw);
                        const r = p.s * size;
                        if (p.d > 0.85) {
                            const k = r * 3.5;
                            ctx.beginPath();
                            ctx.moveTo(p.x, p.y - k);
                            ctx.quadraticCurveTo(p.x, p.y, p.x + k, p.y);
                            ctx.quadraticCurveTo(p.x, p.y, p.x, p.y + k);
                            ctx.quadraticCurveTo(p.x, p.y, p.x - k, p.y);
                            ctx.quadraticCurveTo(p.x, p.y, p.x, p.y - k);
                            ctx.fill();
                        } else {
                            ctx.fillRect(p.x - r / 2, p.y - r / 2, r, r);
                        }
                    }
                    const s = this.shooting;
                    if (s) {
                        const k = 0.14;
                        const g = ctx.createLinearGradient(s.x - s.vx * k, s.y - s.vy * k, s.x, s.y);
                        g.addColorStop(0, "rgba(255,255,255,0)");
                        g.addColorStop(1, "rgba(255,255,255,1)");
                        ctx.globalAlpha = opacity * Math.min(1, s.life * 3);
                        ctx.strokeStyle = g;
                        ctx.lineWidth = 1.6 * size;
                        ctx.lineCap = "round";
                        ctx.beginPath();
                        ctx.moveTo(s.x - s.vx * k, s.y - s.vy * k);
                        ctx.lineTo(s.x, s.y);
                        ctx.stroke();
                    }
                    break;
                }
                case "fireflies": {
                    const sp = this.sprites.firefly;
                    for (const p of ps) {
                        if (!inView(p)) continue;
                        const blink = Math.max(0, Math.sin(t * p.f * 2.2 + p.ph));
                        ctx.globalAlpha = opacity * p.a * (0.08 + 0.92 * blink * blink);
                        const r = p.s * size * 2;
                        ctx.drawImage(sp, p.x - r, p.y - r, r * 2, r * 2);
                    }
                    break;
                }
            }
            ctx.globalAlpha = 1;
        }

        render() {
            const dpr = window.devicePixelRatio || 1;
            const targets = [];
            if (this.frontCanvas) targets.push([this.frontCanvas, new DOMRect(0, 0, this.W, this.H)]);
            for (const [host, canvas] of this.canvases) {
                if (host.checkVisibility && !host.checkVisibility()) continue;
                targets.push([canvas, host.getBoundingClientRect()]);
            }
            for (const [canvas, r] of targets) {
                const w = Math.max(1, Math.round(r.width * dpr));
                const h = Math.max(1, Math.round(r.height * dpr));
                if (canvas.width !== w || canvas.height !== h) {
                    canvas.width = w;
                    canvas.height = h;
                }
                const ctx = canvas.getContext("2d");
                ctx.setTransform(1, 0, 0, 1, 0, 0);
                ctx.clearRect(0, 0, w, h);
                this.base = { dpr, ox: r.left, oy: r.top };
                this.applyBase(ctx);
                this.draw(ctx, r.left, r.top, r.width, r.height);
            }
        }

        frame(now) {
            this.raf = requestAnimationFrame(this.frame);
            if (document.hidden || (this.opts.pauseWhenUnfocused && !document.hasFocus())) {
                this.last = now;
                return;
            }
            const minGap = this.opts.maxFps > 0 ? 1000 / this.opts.maxFps - 1 : 0;
            if (now - this.lastDraw < minGap) return;
            this.lastDraw = now;

            const dt = Math.min(0.05, (now - this.last) / 1000);
            this.last = now;
            this.t += dt * this.opts.speed;
            this.step(dt);
            this.render();
        }
    }

    // ------------------------------------------------------------------
    // Glass keeper: Spotify paints a solid background on some big layers
    // inside each panel, which hides the glass and the effects. Find large
    // layers with a background that cover a panel and make them see-through.
    // Runs all the time (not only while an effect is on).
    // ------------------------------------------------------------------

    // Newer Spotify versions give the panels scrambled class names, so find
    // them by layout instead: the boxes directly inside .Root__top-container.
    // They get a data-jg-panel attribute, which the theme's CSS styles.
    function overlapArea(a, b) {
        const w = Math.min(a.right, b.right) - Math.max(a.left, b.left);
        const h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
        return w > 0 && h > 0 ? w * h : 0;
    }

    function tagPanels() {
        const top = document.querySelector(".Root__top-container");
        if (!top) return [];
        const tr = top.getBoundingClientRect();
        const kids = Array.from(top.children).filter(el => !el.matches(".Root__globalNav, .Root__lyrics-cinema, script, style, canvas"));
        const rects = new Map(kids.map(el => [el, el.getBoundingClientRect()]));
        const panels = [];
        for (const el of kids) {
            const r = rects.get(el);
            let ok = r.width >= 120 && r.height >= 40;
            if (ok && r.width > tr.width * 0.95 && r.height > tr.height * 0.9) ok = false; // full-window layers
            if (ok) {
                // floating layers (overlays, drag-and-drop areas) are positioned on top
                const pos = getComputedStyle(el).position;
                if (pos === "absolute" || pos === "fixed") ok = false;
            }
            if (ok) {
                // a real panel sits beside the others; an overlay is the bigger
                // layer that covers another one
                const area = r.width * r.height;
                for (const other of kids) {
                    if (other === el) continue;
                    const o = rects.get(other);
                    const oArea = o.width * o.height;
                    if (o.width < 40 || o.height < 40 || oArea > area) continue;
                    if (overlapArea(r, o) > oArea * 0.3) {
                        ok = false;
                        break;
                    }
                }
            }
            if (ok) {
                if (!el.hasAttribute("data-jg-panel")) el.setAttribute("data-jg-panel", "");
                panels.push(el);
            } else if (el.hasAttribute("data-jg-panel")) {
                el.removeAttribute("data-jg-panel");
            }
        }
        return panels;
    }

    // Panels the effect is drawn in (tall ones only, not the player bar)
    function findPanels() {
        const found = [...tagPanels(), ...document.querySelectorAll(PANEL_SELECTOR)].filter(el => {
            const r = el.getBoundingClientRect();
            return r.width > 120 && r.height > 200;
        });
        const unique = [...new Set(found)];
        return unique.filter(el => !unique.some(o => o !== el && o.contains(el)));
    }

    function clearCovers(host) {
        const r = host.getBoundingClientRect();
        const points = [[0.5, 0.5], [0.5, 0.2], [0.5, 0.8], [0.25, 0.5], [0.75, 0.5]];
        for (const [fx, fy] of points) {
            for (const e of document.elementsFromPoint(r.left + r.width * fx, r.top + r.height * fy)) {
                if (e === host) break;
                if (!host.contains(e) || e.dataset.jgCleared) continue;
                const er = e.getBoundingClientRect();
                if (er.width < r.width * 0.6 || er.height < r.height * 0.6) continue;
                clearBg(e);
            }
        }
    }

    function clearBg(e) {
        if (e.dataset.jgCleared) return;
        const cs = getComputedStyle(e);
        const solid = cs.backgroundColor !== "rgba(0, 0, 0, 0)" && cs.backgroundColor !== "transparent";
        if (!solid && cs.backgroundImage === "none") return;
        e.dataset.jgCleared = "1";
        e.style.setProperty("background-color", "transparent", "important");
        e.style.setProperty("background-image", "none", "important");
    }

    // Layout wrappers between the wallpaper (.Root__top-container) and each
    // panel also use Spotify's solid main colour; make those see-through too.
    function clearWrappers(host) {
        for (let e = host.parentElement; e && e !== document.body; e = e.parentElement) {
            if (e.classList.contains("Root__top-container")) break;
            clearBg(e);
        }
    }

    function keepGlass() {
        const hosts = new Set([...findPanels(), ...tagPanels()]);
        for (const host of hosts) {
            clearWrappers(host);
            clearCovers(host);
        }
        for (const el of document.querySelectorAll(".Root__now-playing-bar, .Root__globalNav, [data-jg-panel]")) clearWrappers(el);
    }

    const engine = new EffectsEngine(settings);

    // ------------------------------------------------------------------
    // Settings panel (opened by the ✦ button)
    // ------------------------------------------------------------------

    const FONTS = ["Nunito", "Inter", "Outfit", "Quicksand", "Courier New", "Segoe UI", "Default"];
    const EFFECTS = [["none", "None (off)"], ["rain", "Rain"], ["snow", "Snow"], ["leaves", "Leaves"], ["stars", "Stars"], ["fireflies", "Fireflies"]];

    function onChange(key, value) {
        settings[key] = value;
        save();
        applyTheme();
        engine.update(settings);
    }

    function el(tag, props = {}, children = []) {
        const e = Object.assign(document.createElement(tag), props);
        for (const c of children) e.append(c);
        return e;
    }

    function slider(label, key, min, max, step, fmt = v => v) {
        const out = el("output", { textContent: fmt(settings[key]) });
        const input = el("input", { type: "range", min, max, step, value: settings[key] });
        input.addEventListener("input", () => {
            out.textContent = fmt(Number(input.value));
            onChange(key, Number(input.value));
        });
        return el("label", {}, [el("span", { textContent: label }), input, out]);
    }

    function select(label, key, options) {
        const input = el("select");
        for (const opt of options) {
            const [value, text] = Array.isArray(opt) ? opt : [opt, opt];
            input.append(el("option", { value: String(value), textContent: text, selected: String(settings[key]) === String(value) }));
        }
        input.addEventListener("change", () => {
            const v = typeof DEFAULTS[key] === "number" ? Number(input.value) : input.value;
            onChange(key, v);
        });
        return el("label", {}, [el("span", { textContent: label }), input, el("span")]);
    }

    function color(label, key) {
        const input = el("input", { type: "color", value: settings[key] });
        input.addEventListener("input", () => onChange(key, input.value));
        return el("label", {}, [el("span", { textContent: label }), input, el("span")]);
    }

    function checkbox(label, key) {
        const input = el("input", { type: "checkbox", checked: settings[key] });
        input.addEventListener("change", () => onChange(key, input.checked));
        return el("label", {}, [el("span", { textContent: label }), input, el("span")]);
    }

    function openSettings() {
        const pct = v => `${Math.round(v * 100)}%`;
        const x = v => `${v}×`;
        const content = el("div", { className: "jg-settings" }, [
            el("h3", { textContent: "Look" }),
            color("Accent colour", "accent"),
            select("Font", "font", FONTS),
            slider("Glass darkness", "panelOpacity", 0, 1, 0.05, pct),
            slider("Blur", "blur", 0, 30, 1, v => `${v}px`),
            slider("Darken wallpaper", "bgDim", 0, 0.8, 0.05, pct),
            el("h3", { textContent: "Animated effect" }),
            select("Effect", "effect", EFFECTS),
            slider("Speed", "speed", 0.25, 3, 0.05, x),
            slider("Size", "size", 0.5, 2.5, 0.05, x),
            slider("Amount", "amount", 0.25, 3, 0.05, x),
            slider("Opacity", "effectOpacity", 0.1, 1, 0.05, pct),
            select("Draw", "layer", [["panels", "Under the text"], ["front", "In front of everything"]]),
            select("Frame rate limit", "maxFps", [[30, "30 FPS"], [60, "60 FPS"], [120, "120 FPS"], [0, "Unlimited"]]),
            checkbox("Pause when Spotify isn't focused", "pauseWhenUnfocused"),
        ]);
        const reset = el("button", { className: "jg-reset", textContent: "Reset to defaults" });
        reset.addEventListener("click", () => {
            settings = { ...DEFAULTS };
            save();
            applyTheme();
            engine.update(settings);
            Spicetify.PopupModal.hide();
            setTimeout(openSettings, 50);
        });
        content.append(reset);
        Spicetify.PopupModal.display({ title: "Jungle Glass", content, isLarge: true });
    }

    const ICON = '<svg role="img" height="16" width="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l1.6 4.4L18 8l-4.4 1.6L12 14l-1.6-4.4L6 8l4.4-1.6L12 2zm6.5 10l.9 2.6L22 15.5l-2.6.9-.9 2.6-.9-2.6-2.6-.9 2.6-.9.9-2.6zM6 14l1.1 2.9L10 18l-2.9 1.1L6 22l-1.1-2.9L2 18l2.9-1.1L6 14z"/></svg>';
    new Spicetify.Topbar.Button("Jungle Glass settings", ICON, openSettings);

    applyTheme();
    keepGlass();
    setInterval(keepGlass, 1000);
    engine.start();
})();
