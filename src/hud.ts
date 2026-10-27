import type { VolumeKind } from "./audio";
import { Menu } from "./menu";
import { ResultScreen, TrophyBook } from "./record";
import type { RowZone } from "./rowing";
import { SceneLayer } from "./sceneLayer";
import { TitleScreen } from "./title";
import type { GameEvent, View } from "./types";
import { asset } from "./paths";

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
  volume: (kind: VolumeKind) => number;
  setVolume: (kind: VolumeKind, value: number) => void;
  resetRecords: () => void;
  jump?: (level: number) => void;
  clearStage?: () => boolean;
};

const heartX = [-400, -250, -100, 50, 200];

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
  node.src = asset(src);
  node.draggable = false;
  place(node, cx, cy, w, h);
  return node;
}

function show(node: HTMLElement, visible: boolean): void {
  node.style.display = visible ? "" : "none";
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
  private question: HTMLElement;
  private questionImage: HTMLImageElement;
  private timer: HTMLElement;
  private timerFill: HTMLElement;
  private timerText: HTMLElement;
  private panel: HTMLElement;
  private input: HTMLInputElement;
  private submitButton: HTMLButtonElement;
  private popups = new Map<string, HTMLImageElement>();
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
  private menu: Menu;
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

    this.windLeft = image("/art/kaze_left.webp", "wind", r, 960, 540, 1920, 1080);
    this.windRight = image("/art/kaze_right.webp", "wind", r, 960, 540, 1920, 1080);
    this.shuchu = [1, 2, 3].map((n) => image(`/art/shuchusen_${n}.webp`, "shuchu", r, 960, 540, 1920, 1080));

    this.header = el("div", "abs header", r);
    place(this.header, 960, 50, 2200, 300);
    for (const x of heartX) this.hearts.push(image("/u/Resources/ui/heart_red.webp", "heart", this.header, 510 + x + 140, 100 + 100, 160, 160));
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
    image("/art/arrow_back_left.webp", "arrow-back", this.arrowLeft, 150, 150, 300, 300);
    this.arrowLeftFill = image("/art/arrow_left.webp", "arrow-fill", this.arrowLeft, 150, 150, 300, 300);
    this.arrowRight = el("div", "abs arrow", r);
    place(this.arrowRight, 1160, 940, 300, 300);
    image("/art/arrow_back_right.webp", "arrow-back", this.arrowRight, 150, 150, 300, 300);
    this.arrowRightFill = image("/art/arrow_right.webp", "arrow-fill", this.arrowRight, 150, 150, 300, 300);

    this.nazoGet = image("/art/nazoget.webp", "", r, 960, 540, 801, 201);
    this.caution = image("/art/wakaremichida.webp", "", r, 960, 540, 1201, 500);
    this.routeMap = image("", "", r, 960, 540, 800, 800);

    this.intro = image("", "intro", r, 960, 640, 960.8, 784.8);

    this.question = el("div", "abs question", r);
    place(this.question, 960, 540, 1920, 1080);
    image("/art/nazo_back_normal.webp", "", this.question, 960, 590, 900, 700);
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
      ["3", "/art/popup_3.webp", 1000, 1000],
      ["2", "/art/popup_2.webp", 1000, 1000],
      ["1", "/art/popup_1.webp", 1000, 1000],
      ["start", "/art/popup_start.webp", 1921, 1000],
      ["correct", "/art/seikai.webp", 1201, 1201],
      ["incorrect", "/art/zannen.webp", 1201, 1201],
    ];
    for (const [key, src, w, h] of popupDefs) {
      const node = image(src, "popup", r, 960, 540, w, h);
      this.popups.set(key, node);
    }

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
    });

    this.shukko = image("/art/popup_shukkou.webp", "popup", this.root, 960, 540, 1921, 1000);
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
    this.menu = new Menu(this.root, {
      volume: (kind) => this.handlers.volume(kind),
      setVolume: (kind, value) => this.handlers.setVolume(kind, value),
      preview: (kind) => {
        if (kind === "se") this.handlers.se("pi");
      },
      resetRecords: () => this.handlers.resetRecords(),
      ...(this.handlers.jump
        ? {
            jump: (level: number) => this.handlers.jump!(level),
            clearStage: () => this.handlers.clearStage?.() ?? false,
            title: () => this.handlers.restart(),
          }
        : {}),
    });

    for (const node of [...this.shuchu, this.windLeft, this.windRight, this.nazoGet, this.shukko, this.endingAlt, this.tapCatch, this.ending, this.white, this.black]) show(node, false);
    for (const node of this.popups.values()) show(node, false);
  }

  handle(event: GameEvent): void {
    switch (event.type) {
      case "countdown":
        ["3", "2", "1", "start"].forEach((key, i) => this.pop(this.popups.get(key)!, i * 1000, 500));
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
    this.menu.setMode(view.titleScreen ? "title" : this.handlers.jump ? "game" : "hidden");
    this.hearts.forEach((heart, i) => {
      const src = asset(i < view.hearts ? "u/Resources/ui/heart_red.webp" : "u/Resources/ui/heart_black.webp");
      if (heart.src !== src) heart.src = src;
    });

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
    const leftSrc = asset(left >= 1 || (view.gaugeFull && view.gauge < 0) ? "art/arrow_left_yellow.webp" : "art/arrow_left.webp");
    const rightSrc = asset(right >= 1 || (view.gaugeFull && view.gauge > 0) ? "art/arrow_right_yellow.webp" : "art/arrow_right.webp");
    if (this.arrowLeftFill.src !== leftSrc) this.arrowLeftFill.src = leftSrc;
    if (this.arrowRightFill.src !== rightSrc) this.arrowRightFill.src = rightSrc;
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

    if (view.intro && !this.intro.src.endsWith(view.intro.image)) this.intro.src = view.intro.image;
    show(this.intro, !!view.intro);

    const quiz = view.quiz;
    show(this.question, !!quiz);
    show(this.panel, view.answering);
    if (quiz) {
      if (!this.questionImage.src.endsWith(quiz.src)) this.questionImage.src = quiz.src;
      // Enemy above, card below it, with a clear gap above the answer panel (~y 915).
      this.question.style.transform = "translateY(40px) scale(0.58)";
      const fraction = Math.max(0, quiz.time / quiz.max);
      this.timerFill.style.background = `conic-gradient(transparent 0deg ${(1 - fraction) * 360}deg, ${timerTint(quiz.time, quiz.max)} 0deg)`;
      this.timerText.textContent = String(Math.max(Math.ceil(quiz.time), 0));
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

  titleKey(code: string): boolean {
    if (this.overlayKey(code)) return true;
    return this.title.key(code);
  }

  overlayKey(code: string): boolean {
    if (this.menu.key(code)) return true;
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
