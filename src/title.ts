import { asset } from "./paths";
import logoSvg from "./title-logo.svg?raw";
import "./title.css";

// Title: plain key visual slams in → 激流！ → ナゾリバー → オンライン版, then CLICK TO START.
// Logo SVG coordinates are stage pixels (viewBox 20 10 1400 520), so parts line up with the key visual.

const OUT_BACK = "cubic-bezier(0.34, 1.56, 0.64, 1)";
const OUT_QUAD = "cubic-bezier(0.5, 1, 0.89, 1)";
const OUT_EXPO = "cubic-bezier(0.16, 1, 0.3, 1)";

// Intro timeline (ms)
const T_BG = 0;
const T_GEKI = 650;
const T_NAZO = 1150;
const T_BADGE = 1750;
const T_READY = 2250;

type Handlers = {
  begin: () => void;
  se: (name: string) => void;
};

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, parent: HTMLElement): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  parent.appendChild(node);
  return node;
}

function place(node: HTMLElement, cx: number, cy: number, w: number, h: number): void {
  node.style.left = `${cx - w / 2}px`;
  node.style.top = `${cy - h / 2}px`;
  node.style.width = `${w}px`;
  node.style.height = `${h}px`;
}

function picture(src: string, className: string, parent: HTMLElement): HTMLImageElement {
  const node = el("img", className, parent);
  node.src = asset(src);
  node.draggable = false;
  node.alt = "";
  return node;
}

const STAR = "M0 -10 L2.6 -2.6 L10 0 L2.6 2.6 L0 10 L-2.6 2.6 L-10 0 L-2.6 -2.6 Z";
const sparkleSpots = [
  [118, 70, 1.3], [470, 40, 0.9], [1150, 70, 1.1], [1400, 230, 1.4], [1330, 470, 0.8],
  [640, 520, 1], [190, 330, 0.9], [960, 180, 0.7], [1240, 150, 0.9], [90, 240, 0.7],
] as const;

export class TitleScreen {
  private root: HTMLElement;
  private stage: HTMLElement;
  private bgWrap: HTMLElement;
  private bg: HTMLImageElement;
  private lines: HTMLImageElement;
  private logo: HTMLElement;
  private geki: SVGGElement;
  private nazo: SVGGElement;
  private badge: SVGGElement;
  private shines: SVGGElement[];
  private splash: HTMLElement;
  private sparkles: HTMLElement;
  private corp: HTMLImageElement;
  private start: HTMLElement;
  private flash: HTMLElement;
  private intro: Animation[] = [];
  private idle: Animation[] = [];
  private timers: number[] = [];
  private state: "intro" | "ready" | "launching" = "intro";

  constructor(parent: HTMLElement, private handlers: Handlers) {
    this.root = el("div", "abs title", parent);
    place(this.root, 960, 540, 1920, 1080);
    this.stage = el("div", "abs t-stage", this.root);
    place(this.stage, 960, 540, 1920, 1080);

    this.bgWrap = el("div", "abs t-bg-wrap", this.stage);
    place(this.bgWrap, 960, 540, 1920, 1080);
    this.bg = picture("art/title/bg.webp", "abs t-bg", this.bgWrap);
    place(this.bg, 960, 540, 1920, 1080);

    const glow = el("div", "abs t-glow", this.stage);
    place(glow, 720, 270, 1700, 820);
    const vignette = el("div", "abs t-vignette", this.stage);
    place(vignette, 960, 540, 1920, 1080);

    this.lines = picture("art/shuchusen_1.webp", "abs t-lines", this.stage);
    place(this.lines, 960, 540, 1920, 1080);

    this.sparkles = el("div", "abs t-sparkles", this.stage);
    place(this.sparkles, 960, 540, 1920, 1080);
    sparkleSpots.forEach(([x, y, s], i) => {
      const star = el("div", "abs t-sparkle", this.sparkles);
      place(star, x, y, 44 * s, 44 * s);
      star.style.animationDelay = `${(i * 0.37) % 2.2}s`;
      star.innerHTML = `<svg viewBox="-11 -11 22 22"><path d="${STAR}"/></svg>`;
    });

    this.logo = el("div", "abs t-logo", this.stage);
    this.logo.style.left = "20px";
    this.logo.style.top = "10px";
    this.logo.style.width = "1400px";
    this.logo.style.height = "520px";
    this.logo.innerHTML = logoSvg;
    this.geki = this.logo.querySelector(".k-geki")!;
    this.nazo = this.logo.querySelector(".k-nazo")!;
    this.badge = this.logo.querySelector(".k-badge")!;
    this.shines = Array.from(this.logo.querySelectorAll<SVGGElement>(".k-shine"));

    this.splash = el("div", "abs t-splash", this.stage);
    place(this.splash, 960, 540, 1920, 1080);

    this.corp = picture("art/title/tumbleweed.webp", "abs t-corp", this.stage);
    place(this.corp, 300, 992, 236, 152);

    this.start = el("div", "abs t-start", this.stage);
    place(this.start, 960, 990, 1100, 150);
    const touch = window.matchMedia("(pointer: coarse)").matches;
    const label = el("div", "t-start-label", this.start);
    label.innerHTML = `<svg viewBox="0 0 1100 150"><defs><linearGradient id="tStartFill" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0.3" stop-color="#fff"/><stop offset="0.65" stop-color="#fff38a"/><stop offset="1" stop-color="#ffc21a"/></linearGradient></defs>
      <text x="550" y="104" text-anchor="middle" class="t-start-shadow">${touch ? "TAP TO START" : "CLICK TO START"}</text>
      <text x="550" y="96" text-anchor="middle" class="t-start-text">${touch ? "TAP TO START" : "CLICK TO START"}</text></svg>`;

    this.flash = el("div", "abs t-flash", this.root);
    place(this.flash, 960, 540, 1920, 1080);

    this.root.querySelectorAll("img").forEach((node) => (node.draggable = false));
    this.root.addEventListener("click", () => this.press());
    // Hold the intro until the key visual and logo font are ready, so the first "bang" is not a blank frame.
    this.stage.style.opacity = "0";
    const fonts = (document as Document & { fonts?: FontFaceSet }).fonts;
    void Promise.all([this.bg.decode().catch(() => undefined), fonts?.load('52px "Wanpaku"').catch(() => undefined)]).then(() => {
      this.stage.style.opacity = "";
      if (this.state === "intro") this.play();
    });
  }

  setVisible(visible: boolean): void {
    this.root.style.display = visible ? "" : "none";
  }

  /** Called whenever the game comes back to the title: replay the intro after a run. */
  reset(): void {
    if (this.state === "launching") this.play();
  }

  key(code: string): boolean {
    if (code === "Enter" || code === "Space") {
      this.press();
      return true;
    }
    return false;
  }

  private clear(): void {
    this.timers.forEach((id) => window.clearTimeout(id));
    this.timers = [];
    for (const a of [...this.intro, ...this.idle]) a.cancel();
    this.intro = [];
    this.idle = [];
    this.splash.replaceChildren();
    this.root.classList.remove("ready", "launching");
  }

  private at(ms: number, fn: () => void): void {
    this.timers.push(window.setTimeout(fn, ms));
  }

  private anim(target: Element, frames: Keyframe[], options: KeyframeAnimationOptions): Animation {
    const a = target.animate(frames, { fill: "both", ...options });
    this.intro.push(a);
    return a;
  }

  private play(): void {
    this.clear();
    this.state = "intro";

    // 1. Key visual bangs in (white flash + zoom punch).
    this.anim(this.flash, [{ opacity: 1 }, { opacity: 0 }], { duration: 420, delay: T_BG, easing: OUT_QUAD });
    this.anim(this.bgWrap, [{ transform: "scale(1.22)", filter: "brightness(1.6)" }, { transform: "scale(1)", filter: "brightness(1)" }], {
      duration: 520,
      delay: T_BG,
      easing: OUT_EXPO,
    });
    this.anim(this.sparkles, [{ opacity: 0 }, { opacity: 1 }], { duration: 400, delay: T_READY - 300 });

    // 2. 激流！ slams down.
    this.anim(
      this.geki,
      [
        { opacity: 0, transform: "scale(2.6) rotate(-14deg)" },
        { opacity: 1, transform: "scale(0.9) rotate(2deg)", offset: 0.62 },
        { opacity: 1, transform: "scale(1) rotate(0deg)" },
      ],
      { duration: 360, delay: T_GEKI, easing: "cubic-bezier(0.55, 0, 0.6, 1)" },
    );
    this.at(T_GEKI + 220, () => this.impact("bashi", 14, 0.55));

    // 3. ナゾリバー surges in from the right like a wave.
    this.anim(
      this.nazo,
      [
        { opacity: 0, transform: "translateX(900px) skewX(-24deg) scaleX(1.25)" },
        { opacity: 1, transform: "translateX(-40px) skewX(8deg) scaleX(0.96)", offset: 0.6 },
        { opacity: 1, transform: "translateX(12px) skewX(-2deg) scaleX(1.01)", offset: 0.82 },
        { opacity: 1, transform: "translateX(0) skewX(0deg) scaleX(1)" },
      ],
      { duration: 520, delay: T_NAZO, easing: "cubic-bezier(0.3, 0.7, 0.4, 1)" },
    );
    this.at(T_NAZO + 300, () => {
      this.impact("basha", 20, 0.7);
      this.splashBurst();
    });

    // 4. オンライン版 badge stamps on.
    this.anim(
      this.badge,
      [
        { opacity: 0, transform: "scale(0) rotate(-20deg)" },
        { opacity: 1, transform: "scale(1.25) rotate(4deg)", offset: 0.6 },
        { opacity: 1, transform: "scale(1) rotate(0deg)" },
      ],
      { duration: 420, delay: T_BADGE, easing: OUT_BACK },
    );
    this.at(T_BADGE + 120, () => this.handlers.se("shakin"));

    // 5. Start prompt + company logo.
    this.anim(this.start, [{ opacity: 0, transform: "translateY(40px)" }, { opacity: 1, transform: "translateY(0)" }], {
      duration: 420,
      delay: T_READY,
      easing: OUT_BACK,
    });
    this.anim(this.corp, [{ opacity: 0, transform: "translateY(20px)" }, { opacity: 1, transform: "translateY(0)" }], {
      duration: 420,
      delay: T_READY + 100,
      easing: OUT_QUAD,
    });
    this.at(T_READY, () => this.ready());
  }

  private ready(): void {
    if (this.state !== "intro") return;
    this.state = "ready";
    this.root.classList.add("ready");
    this.idle.push(
      this.logo.animate([{ transform: "translateY(0) rotate(0deg)" }, { transform: "translateY(-10px) rotate(-0.4deg)" }], {
        duration: 2200,
        iterations: Infinity,
        direction: "alternate",
        easing: "ease-in-out",
      }),
      this.bg.animate([{ transform: "scale(1)" }, { transform: "scale(1.045)" }], {
        duration: 14000,
        iterations: Infinity,
        direction: "alternate",
        easing: "ease-in-out",
      }),
    );
    this.shines.forEach((shine, i) => {
      this.idle.push(
        shine.animate([{ transform: "translateX(0)" }, { transform: "translateX(1900px)" }], {
          duration: 4200,
          delay: i * 140,
          iterations: Infinity,
          easing: "cubic-bezier(0.45, 0, 0.2, 1)",
        }),
      );
    });
  }

  private skip(): void {
    this.timers.forEach((id) => window.clearTimeout(id));
    this.timers = [];
    this.intro.forEach((a) => a.finish());
    this.ready();
  }

  private press(): void {
    if (this.state === "intro") {
      this.skip();
      return;
    }
    if (this.state !== "ready") return;
    this.launch();
  }

  private impact(se: string, shake: number, lines: number): void {
    this.handlers.se(se);
    const s = shake;
    this.stage.animate(
      [
        { transform: "translate(0,0)" },
        { transform: `translate(${-s}px, ${s * 0.6}px)` },
        { transform: `translate(${s * 0.8}px, ${-s * 0.5}px)` },
        { transform: `translate(${-s * 0.45}px, ${s * 0.3}px)` },
        { transform: `translate(${s * 0.2}px, 0)` },
        { transform: "translate(0,0)" },
      ],
      { duration: 320, easing: "linear" },
    );
    this.lines.animate([{ opacity: lines, transform: "scale(1.15)" }, { opacity: 0, transform: "scale(1)" }], { duration: 380, easing: OUT_QUAD });
  }

  private splashBurst(): void {
    for (let i = 0; i < 26; i++) {
      const drop = el("div", "abs t-drop", this.splash);
      const x = 260 + Math.random() * 1100;
      const y = 380 + Math.random() * 90;
      const size = 14 + Math.random() * 26;
      place(drop, x, y, size, size);
      const dx = (Math.random() - 0.3) * 260;
      const up = 140 + Math.random() * 220;
      drop.animate(
        [
          { transform: "translate(0,0) scale(0.4)", opacity: 1 },
          { transform: `translate(${dx * 0.6}px, ${-up}px) scale(1)`, opacity: 1, offset: 0.45 },
          { transform: `translate(${dx}px, ${-up * 0.4 + 120}px) scale(0.7)`, opacity: 0 },
        ],
        { duration: 700 + Math.random() * 400, easing: "cubic-bezier(0.2, 0.6, 0.5, 1)", fill: "forwards" },
      ).onfinish = () => drop.remove();
    }
  }

  private launch(): void {
    this.state = "launching";
    this.root.classList.add("launching");
    this.handlers.se("shakin");
    this.start.animate([{ transform: "scale(1)" }, { transform: "scale(1.18)" }, { transform: "scale(1)" }], { duration: 260, easing: OUT_QUAD });
    this.logo.animate([{ filter: "brightness(1)" }, { filter: "brightness(1.5)" }, { filter: "brightness(1)" }], { duration: 300, easing: OUT_QUAD });
    this.at(260, () => this.handlers.begin());
  }
}
