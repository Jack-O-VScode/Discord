/*
 * Jungle Effects - particle engine
 * Plain TypeScript, no Vencord imports, so it can be tested on its own.
 */

export type EffectName = "none" | "rain" | "snow" | "leaves" | "stars" | "fireflies";
export type Layer = "panels" | "front";

export interface EffectOptions {
    effect: EffectName;
    speed: number;   // 0.25 - 3
    size: number;    // 0.5 - 2.5
    amount: number;  // 0.25 - 3
    opacity: number; // 0.1 - 1
    layer: Layer;
    maxFps: number;  // 0 = unlimited
    pauseWhenUnfocused: boolean;
}

interface Particle {
    x: number;
    y: number;
    d: number;      // depth 0 (far) .. 1 (near)
    vx: number;
    vy: number;
    a: number;      // base alpha
    s: number;      // size
    ph: number;     // phase
    f: number;      // frequency
    amp: number;    // sway amplitude
    rot: number;
    vr: number;
    sprite: number;
}

// Panels the effect is drawn inside of (over the glass, under the text)
const PANEL_SELECTOR = '[class^="sidebar_"], [class^="page_"]';
const REF_AREA = 2560 * 1440;
const BASE_COUNT: Record<Exclude<EffectName, "none">, number> = {
    rain: 320,
    snow: 230,
    leaves: 42,
    stars: 240,
    fireflies: 48,
};

const rand = (a: number, b: number) => a + Math.random() * (b - a);
const pick = <T,>(arr: T[]) => arr[(Math.random() * arr.length) | 0];

function makeSprite(size: number, draw: (c: CanvasRenderingContext2D, s: number) => void) {
    const c = document.createElement("canvas");
    c.width = c.height = size;
    draw(c.getContext("2d")!, size);
    return c;
}

function softDot(color: string, inner: string) {
    return makeSprite(64, (c, s) => {
        const g = c.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
        g.addColorStop(0, color);
        g.addColorStop(0.35, inner);
        g.addColorStop(1, "rgba(0,0,0,0)");
        c.fillStyle = g;
        c.fillRect(0, 0, s, s);
    });
}

const LEAF_COLORS = ["#7aa65a", "#5e8c4a", "#c9a24a", "#d9822b", "#9bb85a", "#b5652a", "#8fa84e"];

function leafSprite(color: string) {
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

export class EffectsEngine {
    private opts: EffectOptions;
    private particles: Particle[] = [];
    private canvases = new Map<HTMLElement, HTMLCanvasElement>();
    private frontCanvas: HTMLCanvasElement | null = null;
    private raf = 0;
    private scanTimer = 0;
    private last = 0;
    private lastDraw = 0;
    private t = 0;
    private W = 0;
    private H = 0;
    private restored: Array<() => void> = [];
    private shooting: { x: number; y: number; vx: number; vy: number; life: number; } | null = null;
    private nextShooting = rand(4, 10);
    private sprites: { snow?: HTMLCanvasElement; firefly?: HTMLCanvasElement; leaves?: HTMLCanvasElement[]; } = {};

    constructor(opts: EffectOptions) {
        this.opts = { ...opts };
    }

    start() {
        this.stop();
        if (this.opts.effect === "none") return;
        this.resize();
        this.spawnAll();
        this.scan();
        this.scanTimer = window.setInterval(() => this.scan(), 1000);
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
        this.frontCanvas?.remove();
        this.frontCanvas = null;
        this.restored.forEach(fn => fn());
        this.restored = [];
        this.particles = [];
    }

    update(opts: Partial<EffectOptions>) {
        const prev = this.opts;
        this.opts = { ...prev, ...opts };
        const needsRestart =
            prev.effect !== this.opts.effect ||
            prev.layer !== this.opts.layer ||
            (this.opts.effect === "none") !== (prev.effect === "none");
        if (needsRestart) return this.start();
        if (prev.amount !== this.opts.amount) this.spawnAll();
    }

    private onResize = () => {
        this.resize();
        this.spawnAll();
    };

    private resize() {
        this.W = window.innerWidth;
        this.H = window.innerHeight;
    }

    // ---------- hosts (where we draw) ----------

    private scan() {
        if (this.opts.layer === "front") {
            if (!this.frontCanvas?.isConnected) {
                this.frontCanvas = this.makeCanvas();
                Object.assign(this.frontCanvas.style, { position: "fixed", inset: "0", zIndex: "2147483000" });
                document.body.appendChild(this.frontCanvas);
            }
            return;
        }

        const found = Array.from(document.querySelectorAll<HTMLElement>(PANEL_SELECTOR)).filter(el => {
            const r = el.getBoundingClientRect();
            return r.width > 120 && r.height > 120;
        });
        // skip panels nested inside another panel we already draw in
        const hosts = found.filter(el => !found.some(o => o !== el && o.contains(el)));

        for (const [host, canvas] of this.canvases) {
            if (!host.isConnected || !hosts.includes(host)) {
                canvas.remove();
                this.canvases.delete(host);
            }
        }

        for (const host of hosts) {
            const existing = this.canvases.get(host);
            if (existing?.parentElement === host) continue;
            existing?.remove();

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

    private makeCanvas() {
        const c = document.createElement("canvas");
        c.className = "vc-jungle-fx-canvas";
        c.setAttribute("aria-hidden", "true");
        Object.assign(c.style, { pointerEvents: "none", width: "100%", height: "100%", display: "block" });
        return c;
    }

    // ---------- particles ----------

    private count() {
        const e = this.opts.effect;
        if (e === "none") return 0;
        const n = BASE_COUNT[e] * this.opts.amount * (this.W * this.H) / REF_AREA;
        return Math.min(2000, Math.max(1, Math.round(n)));
    }

    private spawnAll() {
        const n = this.count();
        this.particles = [];
        const e = this.opts.effect;
        if (e === "snow" && !this.sprites.snow) this.sprites.snow = softDot("rgba(255,255,255,1)", "rgba(255,255,255,.85)");
        if (e === "fireflies" && !this.sprites.firefly) this.sprites.firefly = softDot("rgba(244,255,176,1)", "rgba(216,245,106,.85)");
        if (e === "leaves" && !this.sprites.leaves) this.sprites.leaves = LEAF_COLORS.flatMap(c => [leafSprite(c), leafSprite(c)]);
        for (let i = 0; i < n; i++) this.particles.push(this.spawn(true));
    }

    private spawn(initial: boolean): Particle {
        const { W, H } = this;
        const d = Math.pow(Math.random(), 1.6); // more far particles than near ones
        const p: Particle = {
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
                // spawn across the top, plus a strip up-wind so the left edge isn't empty
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
                p.sprite = (Math.random() * (this.sprites.leaves?.length ?? 1)) | 0;
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
                p.y = initial ? rand(0, H) : H + 20;
                p.s = 3 + 6 * d;
                p.a = 0.6 + 0.4 * d;
                p.rot = rand(0, Math.PI * 2); // heading
                p.vy = rand(14, 34);          // wander speed
                p.f = rand(0.3, 0.9);         // blink speed
                break;
        }
        return p;
    }

    // Rain angle (as a slope): every drop shares it, and it drifts slowly
    // between about 1 and 10 degrees, always leaning the same way.
    private rainSlant(t: number) {
        return 0.1 + 0.05 * Math.sin(t * 0.05) + 0.03 * Math.sin(t * 0.13 + 1);
    }

    // smooth gusts: a few slow waves added together
    private wind(t: number) {
        return 0.22 + 0.32 * Math.sin(t * 0.13) + 0.2 * Math.sin(t * 0.31 + 1.7) + 0.12 * Math.sin(t * 0.71 + 0.4);
    }

    private step(dt: number) {
        const { W, H } = this;
        const sp = this.opts.speed;
        const t = this.t;
        const wind = this.wind(t);
        const slant = this.rainSlant(t);
        const ps = this.particles;

        for (let i = 0; i < ps.length; i++) {
            let p = ps[i];
            switch (this.opts.effect) {
                case "rain": {
                    p.vx = p.vy * (slant + p.amp);
                    p.x += p.vx * dt * sp;
                    p.y += p.vy * dt * sp;
                    if (p.y - p.s * this.opts.size > H) p = ps[i] = this.spawn(false);
                    break;
                }
                case "snow": {
                    const sway = Math.cos(t * p.f * 2 + p.ph) * p.amp * p.f;
                    p.x += ((wind - 0.22) * (30 + 50 * p.d) + sway) * dt * sp;
                    p.y += p.vy * dt * sp;
                    if (p.y > H + 10) p = ps[i] = this.spawn(false);
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
                case "fireflies": {
                    p.rot += rand(-1.6, 1.6) * dt * sp;
                    p.x += Math.cos(p.rot) * p.vy * dt * sp;
                    p.y += (Math.sin(p.rot) * p.vy - 6) * dt * sp;
                    if (p.x < -30) p.x = W + 30;
                    else if (p.x > W + 30) p.x = -30;
                    if (p.y < -30) p.y = H + 30;
                    else if (p.y > H + 30) p.y = -30;
                    break;
                }
                case "stars":
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

    // ---------- drawing ----------

    private draw(ctx: CanvasRenderingContext2D, ox: number, oy: number, w: number, h: number) {
        const { size, opacity } = this.opts;
        const t = this.t;
        const ps = this.particles;
        const pad = 80 * size;
        const inView = (p: Particle) => p.x > ox - pad && p.x < ox + w + pad && p.y > oy - pad && p.y < oy + h + pad;

        switch (this.opts.effect) {
            case "rain": {
                // group drops into a few alpha buckets so they draw in a handful of strokes
                ctx.lineCap = "round";
                ctx.strokeStyle = "rgb(205,225,255)";
                for (let b = 0; b < 4; b++) {
                    const lo = b / 4, hi = (b + 1) / 4;
                    ctx.globalAlpha = opacity * (0.12 + 0.45 * (lo + hi) / 2);
                    ctx.lineWidth = (0.6 + 1.1 * (lo + hi) / 2) * size;
                    ctx.beginPath();
                    for (let i = 0; i < ps.length; i++) {
                        const p = ps[i];
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
                const sp = this.sprites.snow!;
                for (let i = 0; i < ps.length; i++) {
                    const p = ps[i];
                    if (!inView(p)) continue;
                    const r = p.s * size * 2.2;
                    ctx.globalAlpha = opacity * p.a;
                    ctx.drawImage(sp, p.x - r, p.y - r, r * 2, r * 2);
                }
                break;
            }
            case "leaves": {
                const sprites = this.sprites.leaves!;
                for (let i = 0; i < ps.length; i++) {
                    const p = ps[i];
                    if (!inView(p)) continue;
                    const s = p.s * size * 26;
                    const flip = Math.cos(t * p.f * 3 + p.ph); // 3D tumble
                    ctx.globalAlpha = opacity * p.a;
                    ctx.setTransform(1, 0, 0, 1, 0, 0);
                    this.applyBase(ctx);
                    ctx.translate(p.x, p.y);
                    ctx.rotate(p.rot);
                    ctx.scale(Math.max(0.15, Math.abs(flip)) * Math.sign(flip || 1), 1);
                    ctx.drawImage(sprites[p.sprite % sprites.length], -s / 2, -s / 2, s, s);
                }
                ctx.setTransform(1, 0, 0, 1, 0, 0);
                this.applyBase(ctx);
                break;
            }
            case "stars": {
                ctx.fillStyle = "#fff";
                for (let i = 0; i < ps.length; i++) {
                    const p = ps[i];
                    if (!inView(p)) continue;
                    const tw = 0.5 + 0.5 * Math.sin(t * p.f * 2 + p.ph);
                    ctx.globalAlpha = opacity * p.a * (0.15 + 0.85 * tw);
                    const r = p.s * size;
                    if (p.d > 0.85) {
                        // bright sparkle
                        const s = r * 3.5;
                        ctx.beginPath();
                        ctx.moveTo(p.x, p.y - s);
                        ctx.quadraticCurveTo(p.x, p.y, p.x + s, p.y);
                        ctx.quadraticCurveTo(p.x, p.y, p.x, p.y + s);
                        ctx.quadraticCurveTo(p.x, p.y, p.x - s, p.y);
                        ctx.quadraticCurveTo(p.x, p.y, p.x, p.y - s);
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
                const sp = this.sprites.firefly!;
                for (let i = 0; i < ps.length; i++) {
                    const p = ps[i];
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

    private base = { dpr: 1, ox: 0, oy: 0 };
    private applyBase(ctx: CanvasRenderingContext2D) {
        const { dpr, ox, oy } = this.base;
        ctx.setTransform(dpr, 0, 0, dpr, -ox * dpr, -oy * dpr);
    }

    private render() {
        const dpr = window.devicePixelRatio || 1;
        const targets: Array<[HTMLCanvasElement, DOMRect]> = [];
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
            const ctx = canvas.getContext("2d")!;
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.clearRect(0, 0, w, h);
            this.base = { dpr, ox: r.left, oy: r.top };
            this.applyBase(ctx);
            this.draw(ctx, r.left, r.top, r.width, r.height);
        }
    }

    private frame = (now: number) => {
        this.raf = requestAnimationFrame(this.frame);
        if (document.hidden) {
            this.last = now;
            return;
        }
        if (this.opts.pauseWhenUnfocused && !document.hasFocus()) {
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
    };
}
