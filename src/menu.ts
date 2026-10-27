import type { VolumeKind } from "./audio";
import { debugAreas } from "./debug";
import "@fontsource/m-plus-rounded-1c/700.css";
import "@fontsource/m-plus-rounded-1c/800.css";
import "./menu.css";

// Hamburger menu: サウンド (volume) / リセット (records) / デバッグ (stage jump + clear; only with ?debug=true).

type Handlers = {
  volume: (kind: VolumeKind) => number;
  setVolume: (kind: VolumeKind, value: number) => void;
  preview: (kind: VolumeKind) => void;
  resetRecords: () => void;
  jump?: (level: number) => void;
  clearStage?: () => boolean;
  title?: () => void;
};

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, parent: HTMLElement): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  parent.appendChild(node);
  return node;
}

function button(className: string, parent: HTMLElement, text: string, onClick: () => void): HTMLButtonElement {
  const node = el("button", className, parent);
  node.type = "button";
  node.textContent = text;
  node.addEventListener("click", (event) => {
    event.stopPropagation();
    onClick();
  });
  return node;
}

export type MenuButtonMode = "title" | "game" | "hidden";

export class Menu {
  private toggle: HTMLButtonElement;
  private root: HTMLElement;
  private sheet: HTMLElement;
  private sliders: { kind: VolumeKind; input: HTMLInputElement; value: HTMLElement }[] = [];
  private resetConfirm: HTMLElement;
  private resetButton: HTMLButtonElement;
  private resetNote: HTMLElement;
  private debugNote: HTMLElement | null = null;
  private mode: MenuButtonMode = "title";

  constructor(parent: HTMLElement, private handlers: Handlers) {
    this.toggle = el("button", "abs menu-toggle", parent);
    this.toggle.type = "button";
    this.toggle.setAttribute("aria-label", "メニュー");
    for (let i = 0; i < 3; i++) el("span", "menu-toggle-bar", this.toggle);
    this.toggle.addEventListener("click", (event) => {
      event.stopPropagation();
      this.open(!this.isOpen);
    });
    this.toggle.addEventListener("pointerdown", (event) => event.stopPropagation());

    this.root = el("div", "abs menu", parent);
    this.root.style.left = "0px";
    this.root.style.top = "0px";
    this.root.style.width = "1920px";
    this.root.style.height = "1080px";
    this.root.addEventListener("pointerdown", (event) => event.stopPropagation());
    this.root.addEventListener("click", (event) => {
      event.stopPropagation();
      if (event.target === this.root) this.open(false);
    });

    this.sheet = el("div", "menu-sheet", this.root);
    const head = el("div", "menu-head", this.sheet);
    el("div", "menu-title", head).textContent = "メニュー";
    button("menu-close", head, "×", () => this.open(false));

    const body = el("div", "menu-body", this.sheet);

    // サウンド
    const sound = this.section(body, "サウンド", "♪");
    for (const [kind, label] of [
      ["bgm", "BGM"],
      ["se", "効果音"],
    ] as const) {
      const row = el("label", "menu-slider", sound);
      el("span", "menu-slider-label", row).textContent = label;
      const input = el("input", "menu-range", row);
      input.type = "range";
      input.min = "0";
      input.max = "100";
      input.step = "5";
      const value = el("span", "menu-slider-value", row);
      input.addEventListener("input", () => {
        this.handlers.setVolume(kind, Number(input.value) / 100);
        this.paintSlider(input, value);
      });
      input.addEventListener("change", () => this.handlers.preview(kind));
      this.sliders.push({ kind, input, value });
    }

    // リセット
    const reset = this.section(body, "リセット", "↺");
    el("div", "menu-text", reset).textContent = "獲得した実績(トロフィー)の記録をすべて消します。";
    this.resetButton = button("menu-button danger", reset, "記録をリセット", () => this.showConfirm(true));
    this.resetConfirm = el("div", "menu-confirm", reset);
    el("div", "menu-confirm-text", this.resetConfirm).textContent = "本当に消しますか？元に戻せません。";
    const confirmRow = el("div", "menu-row", this.resetConfirm);
    button("menu-button danger", confirmRow, "消す", () => {
      this.handlers.resetRecords();
      this.showConfirm(false);
      this.resetNote.textContent = "記録をリセットしました";
    });
    button("menu-button ghost", confirmRow, "やめる", () => this.showConfirm(false));
    this.resetNote = el("div", "menu-note", reset);

    // デバッグ
    if (handlers.jump) {
      const debug = this.section(body, "デバッグ", "⚙");
      el("div", "menu-sub", debug).textContent = "ステージへ移動";
      const grid = el("div", "menu-grid", debug);
      for (const area of debugAreas) {
        const b = el("button", "menu-area", grid);
        b.type = "button";
        el("span", `menu-area-tag tag-${area.tag}`, b).textContent = area.tag;
        el("span", "menu-area-name", b).textContent = area.name;
        b.addEventListener("click", (event) => {
          event.stopPropagation();
          this.open(false);
          this.handlers.jump!(area.level);
        });
      }
      el("div", "menu-sub", debug).textContent = "ステージクリア判定";
      const row = el("div", "menu-row", debug);
      button("menu-button go", row, "いまのステージをクリアにする", () => {
        const ok = this.handlers.clearStage?.() ?? false;
        if (ok) this.open(false);
        else if (this.debugNote) this.debugNote.textContent = "このタイミングではクリアにできません";
      });
      if (handlers.title) button("menu-button ghost", row, "タイトルへ", () => {
        this.open(false);
        this.handlers.title!();
      });
      this.debugNote = el("div", "menu-note", debug);
    }

    this.root.style.display = "none";
  }

  get isOpen(): boolean {
    return this.root.style.display !== "none";
  }

  /** Where the hamburger sits: big on the title, small under the ♪ button in-game (debug only). */
  setMode(mode: MenuButtonMode): void {
    if (mode === this.mode) return;
    this.mode = mode;
    this.toggle.style.display = mode === "hidden" ? "none" : "";
    this.toggle.classList.toggle("in-game", mode === "game");
    if (mode === "hidden") this.open(false);
  }

  key(code: string): boolean {
    if (!this.isOpen) return false;
    if (code === "Escape") this.open(false);
    return true;
  }

  open(open: boolean): void {
    if (open === this.isOpen) return;
    if (!open) {
      this.root.style.display = "none";
      return;
    }
    for (const slider of this.sliders) {
      slider.input.value = String(Math.round(this.handlers.volume(slider.kind) * 100));
      this.paintSlider(slider.input, slider.value);
    }
    this.showConfirm(false);
    this.resetNote.textContent = "";
    if (this.debugNote) this.debugNote.textContent = "";
    this.root.style.display = "";
    this.root.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 180, easing: "ease-out" });
    this.sheet.animate([{ transform: "translateX(110%)" }, { transform: "translateX(0)" }], {
      duration: 320,
      easing: "cubic-bezier(0.16, 1, 0.3, 1)",
    });
  }

  private section(parent: HTMLElement, title: string, icon: string): HTMLElement {
    const box = el("section", "menu-section", parent);
    const head = el("div", "menu-section-head", box);
    el("span", "menu-section-icon", head).textContent = icon;
    el("span", "menu-section-title", head).textContent = title;
    return box;
  }

  private showConfirm(show: boolean): void {
    this.resetConfirm.style.display = show ? "" : "none";
    this.resetButton.style.display = show ? "none" : "";
    if (show) this.resetNote.textContent = "";
  }

  private paintSlider(input: HTMLInputElement, value: HTMLElement): void {
    value.textContent = input.value;
    input.style.setProperty("--fill", `${input.value}%`);
  }
}
