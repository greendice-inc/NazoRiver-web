import { DebugMenu } from "./debug";
import { ResultScreen, TrophyBook } from "./record";
import type { RowZone } from "./rowing";
import { SceneLayer } from "./sceneLayer";
import { TitleScreen } from "./title";
import type { GameEvent, View } from "./types";

const OUT_QUAD = "cubic-bezier(0.5, 1, 0.89, 1)";

type Handlers = {
  begin: () => void;
  restart: () => void;
  retry: () => void;
  submit: (text: string) => "clear" | "keep";
  echo: (text: string) => void;
  toggleMute: () => boolean;
  se: (name: string) => void;
  tap: (index: number) => void;
  advance: () => void;
  jump?: (level: number) => void;
};

// GameControllerScript.ConvertLifeGaugeAnimation: small hearts inside the bar, then they grow into LifePoint.
const smallHeartX = [-242, -121, 0, 121, 242];
const bigHeartX = [-400, -250, -100, 50, 200];
const CONVERT_END = 6.5;

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

function image(src: string, className: string, parent: HTMLElement, cx: number, cy: number, w: number, h: number): HTMLImageElement {
  const node = el("img", `abs ${className}`, parent);
  node.src = src;
  node.draggable = false;
  place(node, cx, cy, w, h);
  return node;
}

function show(node: HTMLElement, visible: boolean): void {
  node.style.display = visible ? "" : "none";
}

function outQuad(t: number): number {
  return 1 - (1 - t) * (1 - t);
}

function lifeTint(rate: number): string {
  if (rate > 4 / 5) return "rgb(255,255,255)";
  if (rate > 3 / 5) return "rgb(0,255,255)";
  if (rate > 2 / 5) return "rgb(0,255,0)";
  if (rate > 1 / 5) return "rgb(255,255,0)";
  return "rgb(255,0,0)";
}

function timerTint(time: number, max: number): string {
  if (time > (max * 3) / 4) return "rgb(0,255,255)";
  if (time > (max * 2) / 4) return "rgb(0,255,0)";
  if (time > max / 4) return "rgb(255,255,0)";
  return "rgb(255,0,0)";
}

export class Hud {
  readonly root: HTMLElement;
  private roll: HTMLElement;
  private header: HTMLElement;
  private lifeFill: HTMLElement;
  private nazoCount: HTMLElement;
  private muteButton: HTMLButtonElement;
  private arrowLeft: HTMLElement;
  private arrowRight: HTMLElement;
  private arrowLeftFill: HTMLImageElement;
  private arrowRightFill: HTMLImageElement;
  private shuchu: HTMLImageElement[];
  private windLeft: HTMLImageElement;
  private windRight: HTMLImageElement;
  private nazoGet: HTMLImageElement;
  private caution: HTMLImageElement;
  private routeMap: HTMLImageElement;
  private intro: HTMLImageElement;
  private introCount: HTMLElement;
  private question: HTMLElement;
  private questionImage: HTMLImageElement;
  private timer: HTMLElement;
  private timerFill: HTMLElement;
  private timerText: HTMLElement;
  private panel: HTMLElement;
  private input: HTMLInputElement;
  private submitButton: HTMLButtonElement;
  private popups = new Map<string, HTMLImageElement>();
  private qNumber: HTMLImageElement;
  private title: TitleScreen;
  private lastPhase = "";
  private white: HTMLElement;
  private black: HTMLElement;
  private ending: HTMLElement;
  private endingImage: HTMLImageElement;
  private endingTitle: HTMLElement;
  private endingText: HTMLElement;
  private endingButton: HTMLButtonElement;
  private endingAlt: HTMLButtonElement;
  private endingTime = 0;
  private result: ResultScreen;
  private book: TrophyBook;
  private debug: DebugMenu | null = null;
  private rowGuide: HTMLElement;
  private rowZones: HTMLElement;
  private rowColumns = new Map<RowZone, HTMLElement>();
  private cruiseTime = 0;
  readonly rowLayer: HTMLElement;
  private shukko: HTMLImageElement;
  private lastFocus = -1;
  private sceneUnder: SceneLayer;
  private sceneOver: SceneLayer;
  private tapCatch: HTMLElement;
  private counter: HTMLElement;
  private lifeParts: HTMLElement[];
  private lines: HTMLElement;
  private hearts: HTMLImageElement[] = [];
  private resultImage: HTMLImageElement;
  private resultHint: HTMLElement;
  private pendingRecord: View["record"] = null;
  private windTimer = 0;
  private time = 0;
  private composing = false;

  constructor(parent: HTMLElement, private handlers: Handlers) {
    this.root = el("div", "hud", parent);
    this.roll = el("div", "hud-roll", this.root);
    const r = this.roll;

    this.windLeft = image("/art/kaze_left.png", "wind", r, 960, 540, 1920, 1080);
    this.windRight = image("/art/kaze_right.png", "wind", r, 960, 540, 1920, 1080);
    this.shuchu = [1, 2, 3].map((n) => image(`/art/shuchusen_${n}.png`, "shuchu", r, 960, 540, 1920, 1080));

    this.header = el("div", "abs header", r);
    place(this.header, 960, 50, 2200, 300);
    const lifeHeart = image("/art/heart_red.png", "", this.header, 110 + 140, 100 + 100, 150, 150);
    const lifeBack = image("/art/bar-back_black.png", "", this.header, 510 + 140, 100 + 100, 640.8, 120);
    this.lifeFill = el("div", "abs life-fill", this.header);
    place(this.lifeFill, 510 + 140, 100 + 100, 605.6, 80.8);
    this.lines = el("div", "abs", this.header);
    place(this.lines, 510 + 140, 100 + 100, 640.8, 120);
    for (const x of [-181.5, -60.5, 60.5, 181.5]) {
      const line = el("div", "abs", this.lines);
      place(line, 320.4 + x, 60, 4, 80);
      line.style.background = "rgb(64,64,64)";
    }
    this.lifeParts = [lifeHeart, lifeBack, this.lifeFill];
    for (let i = 0; i < 5; i++) this.hearts.push(image("/u/Resources/ui/heart_red.png", "heart", this.header, 0, 0, 100, 100));
    this.counter = el("div", "abs nazo-counter", this.header);
    place(this.counter, 1560 + 140, 100 + 100, 360, 120);
    el("div", "nazo-icon", this.counter);
    this.nazoCount = el("div", "nazo-count", this.counter);
    this.muteButton = el("button", "abs mute", this.header);
    // Web-only control: kept in the corner clear of Unity's rest badges at (1260..1860, 25..175).
    place(this.muteButton, 1888 + 140, 36 + 100, 56, 56);
    this.muteButton.type = "button";
    this.muteButton.textContent = "♪";
    this.muteButton.addEventListener("click", (event) => {
      event.stopPropagation();
      const muted = this.handlers.toggleMute();
      this.muteButton.classList.toggle("off", muted);
    });

    this.rowZones = el("div", "abs row-zones", r);
    place(this.rowZones, 960, 620, 1920, 920);
    for (const zone of ["left", "center", "right"] as const) {
      el("div", `row-zone-band row-${zone}`, this.rowZones);
    }

    this.rowGuide = el("div", "abs row-guide", r);
    place(this.rowGuide, 960, 540, 1920, 1080);
    const guides: [RowZone, number, string, string][] = [
      ["left", 320, "右へ", "左側を下へドラッグ"],
      ["center", 960, "加速", "真ん中を下へドラッグ"],
      ["right", 1600, "左へ", "右側を下へドラッグ"],
    ];
    for (const [zone, cx, label, sub] of guides) {
      const column = el("div", `abs row-column row-${zone}`, this.rowGuide);
      place(column, cx, 600, 640, 760);
      el("div", "row-chevrons", column);
      el("div", "row-label", column).textContent = label;
      el("div", "row-sub", column).textContent = sub;
      this.rowColumns.set(zone, column);
    }

    this.sceneUnder = new SceneLayer(r, "under", (index) => this.handlers.tap(index));

    this.arrowLeft = el("div", "abs arrow", r);
    place(this.arrowLeft, 760, 940, 300, 300);
    image("/art/arrow_back_left.png", "arrow-back", this.arrowLeft, 150, 150, 300, 300);
    this.arrowLeftFill = image("/art/arrow_left.png", "arrow-fill", this.arrowLeft, 150, 150, 300, 300);
    this.arrowRight = el("div", "abs arrow", r);
    place(this.arrowRight, 1160, 940, 300, 300);
    image("/art/arrow_back_right.png", "arrow-back", this.arrowRight, 150, 150, 300, 300);
    this.arrowRightFill = image("/art/arrow_right.png", "arrow-fill", this.arrowRight, 150, 150, 300, 300);

    this.nazoGet = image("/art/nazoget.png", "", r, 960, 540, 801, 201);
    this.caution = image("/art/wakaremichida.png", "", r, 960, 540, 1201, 500);
    this.routeMap = image("", "", r, 960, 540, 800, 800);

    this.intro = image("", "intro", r, 960, 640, 960.8, 784.8);
    this.introCount = el("div", "abs intro-count", r);
    place(this.introCount, 1122, 744, 200, 147);

    this.question = el("div", "abs question", r);
    place(this.question, 960, 540, 1920, 1080);
    image("/art/nazo_back_normal.png", "", this.question, 960, 590, 900, 700);
    this.questionImage = image("", "question-image", this.question, 960, 590, 800, 600);
    this.timer = el("div", "abs timer", this.question);
    place(this.timer, 960, 240, 125, 125);
    el("div", "timer-back", this.timer);
    this.timerFill = el("div", "timer-fill", this.timer);
    this.timerText = el("div", "timer-text", this.timer);

    this.panel = el("form", "abs answer-panel", r);
    place(this.panel, 960, 990, 1100, 150);
    this.input = el("input", "answer-input", this.panel);
    this.input.type = "text";
    this.input.autocomplete = "off";
    this.input.spellcheck = false;
    this.input.setAttribute("enterkeyhint", "send");
    this.submitButton = el("button", "answer-submit", this.panel);
    this.submitButton.type = "submit";
    this.submitButton.textContent = "解答";
    this.input.addEventListener("compositionstart", () => (this.composing = true));
    this.input.addEventListener("compositionend", () => {
      this.composing = false;
      this.handlers.echo(this.input.value);
    });
    this.input.addEventListener("input", () => this.handlers.echo(this.input.value));
    this.input.addEventListener("keydown", (event) => {
      event.stopPropagation();
      if (event.key === "Enter" && (this.composing || event.isComposing)) event.preventDefault();
    });
    this.panel.addEventListener("submit", (event) => {
      event.preventDefault();
      if (this.composing) return;
      if (this.handlers.submit(this.input.value) === "clear") this.input.value = "";
      this.input.focus();
    });

    const popupDefs: [string, string, number, number][] = [
      ["3", "/art/popup_3.png", 1000, 1000],
      ["2", "/art/popup_2.png", 1000, 1000],
      ["1", "/art/popup_1.png", 1000, 1000],
      ["start", "/art/popup_start.png", 1921, 1000],
      ["correct", "/art/seikai.png", 1201, 1201],
      ["incorrect", "/art/zannen.png", 1201, 1201],
    ];
    for (const [key, src, w, h] of popupDefs) {
      const node = image(src, "popup", r, 960, 540, w, h);
      this.popups.set(key, node);
    }
    this.qNumber = image("/art/q1.png", "popup", r, 960, 540, 1201, 601);

    this.tapCatch = el("div", "abs tap-catch", r);
    place(this.tapCatch, 960, 540, 1920, 1080);
    this.tapCatch.addEventListener("pointerdown", (event) => {
      event.stopPropagation();
      this.handlers.advance();
    });
    this.sceneOver = new SceneLayer(r, "over", (index) => this.handlers.tap(index));

    this.rowLayer = el("div", "abs row-layer", r);
    place(this.rowLayer, 960, 540, 1920, 1080);

    this.title = new TitleScreen(this.root, {
      begin: () => this.handlers.begin(),
      se: (name) => this.handlers.se(name),
      trophies: () => this.book.open(true),
    });

    this.shukko = image("/art/popup_shukkou.png", "popup", this.root, 960, 540, 1921, 1000);
    this.white = el("div", "abs fill white", this.root);
    this.black = el("div", "abs fill black", this.root);

    this.ending = el("div", "abs ending", this.root);
    place(this.ending, 960, 540, 1920, 1080);
    this.resultImage = image("", "result-boss", this.ending, 960, 540, 1920, 1080);
    this.resultHint = el("div", "abs result-hint", this.ending);
    place(this.resultHint, 960, 1030, 1920, 60);
    this.resultHint.textContent = "タップで探検記録へ";
    this.ending.addEventListener("pointerdown", (event) => {
      if (this.ending.dataset.kind !== "result" || (event.target as HTMLElement).closest("button")) return;
      event.stopPropagation();
      this.endingEnter();
    });
    const card = el("div", "abs ending-card", this.ending);
    place(card, 960, 560, 1040, 860);
    this.endingImage = el("img", "ending-image", card);
    this.endingTitle = el("div", "ending-title", card);
    this.endingText = el("div", "ending-text", card);
    this.endingButton = el("button", "ending-button", card);
    this.endingButton.type = "button";
    this.endingButton.textContent = "探検記録を見る";
    this.endingButton.addEventListener("click", () => this.endingEnter());
    this.endingAlt = el("button", "ending-button alt", card);
    this.endingAlt.type = "button";
    this.endingAlt.textContent = "タイトルへ";
    this.endingAlt.addEventListener("click", () => this.handlers.restart());

    this.result = new ResultScreen(this.root, {
      restart: () => this.handlers.restart(),
      trophies: () => this.book.open(true),
    });
    this.book = new TrophyBook(this.root);
    if (this.handlers.jump) {
      this.debug = new DebugMenu(this.root, {
        jump: (level) => this.handlers.jump!(level),
        title: () => this.handlers.restart(),
      });
    }

    for (const node of [...this.shuchu, this.windLeft, this.windRight, this.nazoGet, this.qNumber, this.shukko, this.endingAlt, this.tapCatch]) show(node, false);
    for (const node of this.popups.values()) show(node, false);
  }

  handle(event: GameEvent): void {
    switch (event.type) {
      case "countdown":
        ["3", "2", "1", "start"].forEach((key, i) => this.pop(this.popups.get(key)!, i * 1000, 500));
        break;
      case "questionNumber":
        this.qNumber.src = `/art/q${Math.min(event.n, 10)}.png`;
        this.pop(this.qNumber, 0, 500);
        break;
      case "answer":
        this.pop(this.popups.get(event.ok ? "correct" : "incorrect")!, 0, 500);
        break;
      case "miss":
        this.panel.animate(
          [
            { transform: "translateX(0)" },
            { transform: "translateX(-18px)" },
            { transform: "translateX(14px)" },
            { transform: "translateX(-8px)" },
            { transform: "translateX(0)" },
          ],
          { duration: 300 },
        );
        break;
      case "nazoGet":
        show(this.nazoGet, true);
        this.nazoGet.getAnimations().forEach((a) => a.cancel());
        this.nazoGet.animate([{ opacity: 1 }, { opacity: 1 }], { duration: 1000 }).onfinish = () => show(this.nazoGet, false);
        break;
      case "accelerate":
        this.flashShuchu();
        break;
      case "wind":
        this.windTimer = event.duration;
        show(this.windLeft, event.dir < 0);
        show(this.windRight, event.dir > 0);
        break;
      default:
        break;
    }
  }

  update(view: View, dt: number): void {
    this.time += dt;
    const phase = view.phase;

    const roll = view.hudRoll ?? view.camera.roll;
    this.roll.style.transform = roll ? `rotate(${roll}deg)` : "";

    if (phase === "title" && this.lastPhase !== "title") this.title.reset();
    this.lastPhase = phase;
    this.title.setVisible(view.titleScreen);
    show(this.shukko, false);
    this.white.style.opacity = String(view.white);
    show(this.white, view.white > 0);
    this.black.style.opacity = String(view.black);
    show(this.black, view.black > 0);

    show(this.header, !view.titleScreen);
    const rate = Math.max(0, view.life / view.maxLife);
    this.lifeFill.style.clipPath = `inset(0 ${(1 - rate) * 100}% 0 0)`;
    this.lifeFill.style.backgroundColor = lifeTint(rate);
    this.nazoCount.textContent = `× ${view.collected}`;
    show(this.counter, view.counter);
    this.updateHearts(view);

    this.sceneUnder.update(view.scene.filter((node) => !node.over));
    this.sceneOver.update(view.scene.filter((node) => node.over));
    show(this.tapCatch, view.waitTap);

    show(this.arrowLeft, view.arrows && view.showLeftArrow);
    show(this.arrowRight, view.arrows && view.showRightArrow);
    const arrowShift = view.arrowY ? `translateY(${-view.arrowY}px)` : "";
    this.arrowLeft.style.transform = arrowShift;
    this.arrowRight.style.transform = arrowShift;
    const left = view.gauge < 0 ? Math.min(-view.gauge, 1) : 0;
    const right = view.gauge > 0 ? Math.min(view.gauge, 1) : 0;
    this.arrowLeftFill.style.clipPath = `inset(0 0 0 ${(1 - left) * 100}%)`;
    this.arrowRightFill.style.clipPath = `inset(0 ${(1 - right) * 100}% 0 0)`;
    const leftSrc = left >= 1 || (view.gaugeFull && view.gauge < 0) ? "/art/arrow_left_yellow.png" : "/art/arrow_left.png";
    const rightSrc = right >= 1 || (view.gaugeFull && view.gauge > 0) ? "/art/arrow_right_yellow.png" : "/art/arrow_right.png";
    if (!this.arrowLeftFill.src.endsWith(leftSrc)) this.arrowLeftFill.src = leftSrc;
    if (!this.arrowRightFill.src.endsWith(rightSrc)) this.arrowRightFill.src = rightSrc;
    this.updateRowGuide(view, dt);

    if (this.windTimer > 0) {
      this.windTimer -= dt;
      if (this.windTimer <= 0 || phase !== "cruise") {
        this.windTimer = 0;
        show(this.windLeft, false);
        show(this.windRight, false);
      }
    }

    show(this.caution, view.caution);
    if (view.routeMap) {
      if (!this.routeMap.src.endsWith(view.routeMap)) this.routeMap.src = view.routeMap;
      this.routeMap.style.opacity = String(Math.sin((this.time / 2) * Math.PI) / 2 + 0.5);
    }
    show(this.routeMap, !!view.routeMap);

    if (view.intro) {
      if (!this.intro.src.endsWith(view.intro.image)) this.intro.src = view.intro.image;
      const nazo = view.intro.count !== null;
      place(this.intro, 960, 640, 960.8, nazo ? 640.8 : 784.8);
      this.introCount.textContent = nazo ? String(view.intro.count) : "";
      show(this.introCount, nazo);
    } else {
      show(this.introCount, false);
    }
    show(this.intro, !!view.intro);

    const inQuestion = phase === "question" || phase === "mark";
    show(this.question, inQuestion);
    show(this.panel, view.answering);
    if (inQuestion) {
      if (!this.questionImage.src.endsWith(view.questionSrc)) this.questionImage.src = view.questionSrc;
      const scale = 0.8 + 0.5 * outQuad(Math.min(view.questionElapsed / view.questionMax, 1));
      this.question.style.transform = `scale(${scale})`;
      const fraction = Math.max(0, view.questionTime / view.questionMax);
      this.timerFill.style.background = `conic-gradient(transparent 0deg ${(1 - fraction) * 360}deg, ${timerTint(view.questionTime, view.questionMax)} 0deg)`;
      this.timerText.textContent = String(Math.max(Math.ceil(view.questionTime), 0));
    }
    if (view.answering && this.lastFocus !== view.focusToken) {
      this.lastFocus = view.focusToken;
      this.input.value = "";
      window.setTimeout(() => this.input.focus({ preventScroll: true }), 0);
    }

    if (view.ending) this.endingTime += dt;
    else this.endingTime = 0;
    if (!view.record || view.record !== this.pendingRecord) this.result.show(null);
    this.pendingRecord = view.record;
    const fullImage = view.ending?.kind === "result";
    show(this.ending, !!view.ending && (fullImage || !this.result.visible));
    if (view.ending) {
      this.ending.dataset.kind = view.ending.kind;
      show(this.resultImage, fullImage);
      show(this.resultHint, fullImage && !this.result.visible && this.endingTime > 2);
      if (fullImage && view.ending.image && !this.resultImage.src.endsWith(view.ending.image)) this.resultImage.src = view.ending.image;
      show(this.endingImage, !fullImage && !!view.ending.image);
      if (!fullImage && view.ending.image && !this.endingImage.src.endsWith(view.ending.image)) this.endingImage.src = view.ending.image;
      this.endingTitle.textContent = view.ending.title;
      this.endingText.textContent = view.ending.text;
      this.endingButton.textContent = view.canRetry ? "ここからやり直す" : "探検記録を見る";
      show(this.endingAlt, view.canRetry);
    }
  }

  private updateHearts(view: View): void {
    const hearts = view.hearts;
    const since = hearts ? hearts.since : -1;
    const converting = since >= 0 && since < CONVERT_END;
    const settled = since >= CONVERT_END;
    const barAlpha = !hearts ? 1 : converting ? 1 - Math.min(1, Math.max(0, (since - 6) / 0.5)) : 0;
    for (const part of this.lifeParts) {
      part.style.opacity = barAlpha >= 1 ? "" : String(barAlpha);
      show(part, barAlpha > 0);
    }
    const linesAlpha = converting ? Math.min(1, since) * barAlpha : 0;
    this.lines.style.opacity = String(linesAlpha);
    show(this.lines, linesAlpha > 0);
    this.hearts.forEach((heart, i) => {
      if (!hearts) {
        show(heart, false);
        return;
      }
      const src = i < hearts.count ? "/u/Resources/ui/heart_red.png" : "/u/Resources/ui/heart_black.png";
      if (!heart.src.endsWith(src)) heart.src = src;
      let x = 510 + smallHeartX[i];
      let size = 100;
      let scale = 1;
      if (settled) {
        x = 510 + bigHeartX[i];
        size = 160;
      } else {
        const start = 1 + i * 0.8;
        const t = since - start;
        if (t < 0) scale = 0;
        else if (t < 0.2) scale = 1.2 * (t / 0.2);
        else if (t < 0.3) scale = 1.2 - 0.2 * ((t - 0.2) / 0.1);
        const grow = Math.min(1, Math.max(0, (since - 5.5) / 1));
        if (grow > 0) {
          x = 510 + smallHeartX[i] + (bigHeartX[i] - smallHeartX[i]) * grow;
          scale = 1 + 0.6 * grow;
        }
      }
      place(heart, x + 140, 100 + 100, size, size);
      heart.style.transform = scale === 1 ? "" : `scale(${scale})`;
      show(heart, scale > 0);
    });
  }

  titleKey(code: string): boolean {
    if (this.overlayKey(code)) return true;
    return this.title.key(code);
  }

  overlayKey(code: string): boolean {
    if (this.debug?.key(code)) return true;
    if (!this.book.isOpen) return false;
    if (code === "Escape" || code === "Enter" || code === "Space") this.book.open(false);
    return true;
  }

  endingEnter(): void {
    if (this.book.isOpen) return;
    if (this.result.visible) this.handlers.restart();
    else if (this.pendingRecord) this.result.show(this.pendingRecord);
    else this.handlers.retry();
  }

  rowFlash(zone: RowZone): void {
    this.rowColumns.get(zone)?.animate([{ transform: "scale(1.12)", filter: "brightness(1.6)" }, { transform: "scale(1)" }], {
      duration: 320,
      easing: OUT_QUAD,
    });
  }

  private updateRowGuide(view: View, dt: number): void {
    const phase = view.phase;
    if (phase === "cruise") this.cruiseTime += dt;
    else this.cruiseTime = 0;
    let base = 0;
    if (phase === "countdown" && view.arrows) base = 1;
    else if (phase === "cruise") base = Math.max(0, Math.min(1, 4 - this.cruiseTime));
    const choosing = !!view.routeMap;
    for (const [zone, column] of this.rowColumns) {
      const value = choosing ? (zone === "center" ? 0 : 1) : base;
      column.style.opacity = String(value);
    }
    show(this.rowGuide, base > 0 || choosing);
    const lanes = view.steering || view.arrows;
    this.rowZones.classList.toggle("branch", choosing);
    show(this.rowZones, lanes);
  }

  private pop(node: HTMLElement, delay: number, hold: number): void {
    window.setTimeout(() => {
      node.getAnimations().forEach((a) => a.cancel());
      show(node, true);
      const total = 250 + hold + 250;
      const a = 250 / total;
      const b = (250 + hold) / total;
      node.animate(
        [
          { opacity: 0, transform: "scale(2)", easing: OUT_QUAD, offset: 0 },
          { opacity: 1, transform: "scale(1)", offset: a },
          { opacity: 1, transform: "scale(1)", easing: OUT_QUAD, offset: b },
          { opacity: 0, transform: "scale(0)", offset: 1 },
        ],
        { duration: total, fill: "forwards" },
      ).onfinish = () => show(node, false);
    }, delay);
  }

  private flashShuchu(): void {
    const frames = [0, 1, 2, 0, 1, 0];
    frames.forEach((frame, i) => {
      window.setTimeout(() => this.shuchu.forEach((node, j) => show(node, j === frame)), i * 200);
    });
    window.setTimeout(() => this.shuchu.forEach((node) => show(node, false)), frames.length * 200);
  }
}
