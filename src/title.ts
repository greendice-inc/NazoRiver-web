const OUT_QUAD = "cubic-bezier(0.5, 1, 0.89, 1)";

// GameStartScript lights Visual1..4 (upper-left, lower-left, upper-right, lower-right) as each rower gets ready.
const seats = [
  { corner: "ul", cx: 480, cy: 270 },
  { corner: "dl", cx: 480, cy: 810 },
  { corner: "ur", cx: 1440, cy: 270 },
  { corner: "dr", cx: 1440, cy: 810 },
] as const;

type Handlers = {
  begin: () => void;
  se: (name: string) => void;
  trophies: () => void;
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

const steps: { zone: "left" | "center" | "right"; title: string; text: string }[] = [
  { zone: "left", title: "左側を下へなぞる", text: "左のオールを漕いで\nボートは右へ！" },
  { zone: "right", title: "右側を下へなぞる", text: "右のオールを漕いで\nボートは左へ！" },
  { zone: "center", title: "真ん中を下へなぞる", text: "両方いっしょに漕いで\nスピードアップ！" },
];

export class TitleScreen {
  private root: HTMLElement;
  private art: HTMLElement;
  private lit: HTMLImageElement[] = [];
  private flashes: HTMLElement[] = [];
  private howTo: HTMLElement;
  private launching = false;
  private timers: number[] = [];

  constructor(parent: HTMLElement, private handlers: Handlers) {
    this.root = el("div", "abs title", parent);
    place(this.root, 960, 540, 1920, 1080);
    this.art = el("div", "abs title-art", this.root);
    place(this.art, 960, 540, 1920, 1080);

    for (const seat of seats) {
      const off = el("img", "abs", this.art);
      off.src = `/art/off_${seat.corner}.png`;
      place(off, seat.cx, seat.cy, 962, 542);
      const on = el("img", "abs title-lit", this.art);
      on.src = `/art/on_${seat.corner}.png`;
      place(on, seat.cx, seat.cy, 962, 542);
      this.lit.push(on);
      const flash = el("div", "abs title-flash", this.art);
      place(flash, seat.cx, seat.cy, 960, 540);
      this.flashes.push(flash);
    }
    this.root.querySelectorAll("img").forEach((node) => (node.draggable = false));

    const bar = el("div", "abs title-bar", this.root);
    place(bar, 960, 1000, 820, 112);
    const text = el("div", "title-text", bar);
    const touch = window.matchMedia("(pointer: coarse)").matches;
    el("div", "title-text-main", text).textContent = touch ? "タップしてはじめる！" : "クリックしてはじめる！";
    el("div", "title-text-sub", text).textContent = "画面を下へなぞってボートを漕ごう";

    const trophyButton = el("button", "abs title-how title-trophy", this.root);
    place(trophyButton, 130, 1000, 200, 88);
    trophyButton.type = "button";
    trophyButton.textContent = "実績";
    trophyButton.addEventListener("click", (event) => {
      event.stopPropagation();
      this.handlers.trophies();
    });

    if (document.fullscreenEnabled) {
      const full = el("button", "abs title-full", this.root);
      place(full, 1840, 80, 120, 72);
      full.type = "button";
      full.textContent = "全画面";
      full.addEventListener("click", (event) => {
        event.stopPropagation();
        if (document.fullscreenElement) void document.exitFullscreen();
        else
          void document.documentElement
            .requestFullscreen()
            .then(() => (screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> }).lock?.("landscape"))
            .catch(() => undefined);
      });
    }

    const howButton = el("button", "abs title-how", this.root);
    place(howButton, 1790, 1000, 200, 88);
    howButton.type = "button";
    howButton.textContent = "遊び方";
    howButton.addEventListener("click", (event) => {
      event.stopPropagation();
      this.openHowTo(true);
    });

    this.howTo = el("div", "abs title-howto", this.root);
    place(this.howTo, 960, 540, 1920, 1080);
    this.buildHowTo(this.howTo, touch);
    this.howTo.addEventListener("click", (event) => {
      event.stopPropagation();
      this.openHowTo(false);
    });
    this.howTo.style.display = "none";

    this.root.addEventListener("click", () => this.readyAll());
  }

  setVisible(visible: boolean): void {
    this.root.style.display = visible ? "" : "none";
  }

  reset(): void {
    this.timers.forEach((id) => window.clearTimeout(id));
    this.timers = [];
    this.launching = false;
    this.root.classList.remove("launching");
    this.lit.forEach((node) => {
      node.getAnimations().forEach((a) => a.cancel());
      node.style.opacity = "0";
    });
    this.openHowTo(false);
  }

  key(code: string): boolean {
    if (code === "Escape" && this.howTo.style.display !== "none") {
      this.openHowTo(false);
      return true;
    }
    return false;
  }

  private buildHowTo(root: HTMLElement, touch: boolean): void {
    const sheet = el("div", "abs howto-sheet", root);
    place(sheet, 960, 520, 1800, 940);
    const story = el("div", "abs howto-story", sheet);
    place(story, 470, 360, 840, 622);
    const steer = el("div", "abs howto-rules", sheet);
    place(steer, 1340, 470, 820, 860);
    el("div", "howto-heading", steer).textContent = "遊び方";
    const list = el("div", "howto-steps", steer);
    for (const step of steps) {
      const row = el("div", `howto-step row-${step.zone}`, list);
      const pad = el("div", "howto-pad", row);
      for (const zone of ["left", "center", "right"]) el("div", `howto-pad-col${zone === step.zone ? " on" : ""}`, pad);
      const body = el("div", "howto-step-body", row);
      el("div", "howto-step-title", body).textContent = step.title;
      el("div", "howto-step-text", body).textContent = step.text;
    }
    const notes = el("div", "abs howto-notes", sheet);
    place(notes, 470, 790, 840, 200);
    for (const line of [
      "体力は時間とともに減り、岩にぶつかると大きく減る",
      "白く光る「ナゾ」を取ると、あとで謎解きタイム",
      "答えを入力して正解すると体力が回復する",
    ]) {
      el("div", "howto-note", notes).textContent = line;
    }
    const close = el("div", "abs title-howto-close", root);
    place(close, 960, 1040, 1920, 64);
    close.textContent = touch ? "タップで閉じる" : "クリックで閉じる";
  }

  private openHowTo(open: boolean): void {
    this.howTo.style.display = open ? "" : "none";
  }

  private readyAll(): void {
    if (this.launching) return;
    this.launching = true;
    seats.forEach((_, n) => {
      this.timers.push(window.setTimeout(() => this.light(n), n * 160));
    });
    this.timers.push(window.setTimeout(() => this.launch(), seats.length * 160 + 260));
  }

  private light(index: number): void {
    const lit = this.lit[index];
    lit.getAnimations().forEach((a) => a.cancel());
    lit.style.opacity = "1";
    this.handlers.se("shakin");
    lit.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 220, easing: OUT_QUAD });
    this.flashes[index].animate([{ opacity: 0.85 }, { opacity: 0 }], { duration: 480, easing: OUT_QUAD });
  }

  private launch(): void {
    this.root.classList.add("launching");
    this.art.animate([{ transform: "scale(1.04)" }, { transform: "scale(1)" }], { duration: 400, easing: OUT_QUAD });
    this.handlers.begin();
  }
}
