import { stages } from "./data/stages";

const modeAreas = [
  { level: 20, name: "幻影の急流" },
  { level: 21, name: "繋がりの浅瀬" },
  { level: 22, name: "文字の河原" },
  { level: 23, name: "怪魚の淀み" },
  { level: 30, name: "オクトパス" },
  { level: 31, name: "ロブスター" },
  { level: 32, name: "トーテム" },
  { level: 33, name: "クロコダイル" },
  { level: 34, name: "トータス" },
  { level: 42, name: "裏の急流" },
  { level: 50, name: "裏ボスラッシュ" },
  { level: 510, name: "オクトパス改" },
  { level: 511, name: "ロブスター改" },
  { level: 513, name: "クロコダイル改" },
  { level: 514, name: "トータス改" },
  { level: 515, name: "神の石像" },
  { level: 60, name: "脱出" },
];

export const debugAreas = [
  ...stages.filter((stage) => stage.rows.length > 0).map((stage) => ({ level: stage.level, name: stage.name, tag: "川" })),
  ...modeAreas.map((area) => ({ ...area, tag: area.level >= 42 ? "裏" : area.level >= 30 ? "ボス" : "川3" })),
];

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

export function debugEnabled(): boolean {
  return new URLSearchParams(location.search).get("debug") === "true";
}

export class DebugMenu {
  private pad: HTMLElement;
  private root: HTMLElement;
  private taps = 0;
  private lastTap = 0;

  constructor(
    parent: HTMLElement,
    private handlers: { jump: (level: number) => void; title: () => void },
  ) {
    this.pad = el("div", "abs debug-pad", parent);
    place(this.pad, 1820, 90, 200, 180);
    this.pad.addEventListener("pointerdown", (event) => {
      event.stopPropagation();
      event.preventDefault();
      this.tap();
    });

    this.root = el("div", "abs debug-menu", parent);
    place(this.root, 960, 540, 1920, 1080);
    const panel = el("div", "abs debug-panel", this.root);
    place(panel, 960, 540, 1320, 860);
    el("div", "debug-label", panel).textContent = "デバッグ：エリア選択";
    const grid = el("div", "debug-grid", panel);
    for (const area of debugAreas) {
      const button = el("button", "debug-area", grid);
      button.type = "button";
      el("div", "debug-area-tag", button).textContent = area.tag;
      el("div", "debug-area-name", button).textContent = area.name;
      button.addEventListener("click", (event) => {
        event.stopPropagation();
        this.open(false);
        this.handlers.jump(area.level);
      });
    }
    const row = el("div", "debug-row", panel);
    const home = el("button", "debug-area ghost", row);
    home.type = "button";
    home.textContent = "タイトルへ";
    home.addEventListener("click", (event) => {
      event.stopPropagation();
      this.open(false);
      this.handlers.title();
    });
    const close = el("button", "debug-area ghost", row);
    close.type = "button";
    close.textContent = "とじる";
    close.addEventListener("click", (event) => {
      event.stopPropagation();
      this.open(false);
    });
    this.root.addEventListener("pointerdown", (event) => event.stopPropagation());
    this.root.addEventListener("click", (event) => {
      if (event.target === this.root) this.open(false);
    });
    this.root.style.display = "none";
  }

  get isOpen(): boolean {
    return this.root.style.display !== "none";
  }

  key(code: string): boolean {
    if (!this.isOpen) return false;
    if (code === "Escape") this.open(false);
    return true;
  }

  private tap(): void {
    if (this.isOpen) return;
    const now = performance.now();
    this.taps = now - this.lastTap > 1400 ? 1 : this.taps + 1;
    this.lastTap = now;
    if (this.taps >= 5) {
      this.taps = 0;
      this.open(true);
    }
  }

  private open(open: boolean): void {
    this.root.style.display = open ? "" : "none";
  }
}
