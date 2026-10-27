import { catalog, loadEarned, type RunRecord } from "./trophies";
import { asset } from "./paths";

const OUT_QUAD = "cubic-bezier(0.5, 1, 0.89, 1)";

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
  node.src = src;
  node.draggable = false;
  return node;
}

function fitText(node: HTMLElement, text: string, width: number, max: number): void {
  node.textContent = text;
  node.style.fontSize = `${Math.min(max, Math.floor(width / Math.max(text.length, 1)))}px`;
}

// ResultScript.Record: Unity anchors are centre-origin with y up, so stage = (960 + x, 540 - y).
const slotX = [120, 595];
const slotY = [255, 125, -5, -130];

export class ResultScreen {
  private root: HTMLElement;
  private sheet: HTMLElement;
  private route: HTMLImageElement;
  private slots: { root: HTMLElement; icon: HTMLImageElement; text: HTMLElement; badge: HTMLElement }[] = [];
  private empty: HTMLElement;
  private password: HTMLElement;
  private shown: RunRecord | null = null;

  constructor(parent: HTMLElement, handlers: { restart: () => void; trophies: () => void }) {
    this.root = el("div", "abs result", parent);
    place(this.root, 960, 540, 1920, 1080);
    this.sheet = el("div", "abs result-sheet", this.root);
    place(this.sheet, 960, 540, 1920, 1080);
    place(picture(asset("art/result.webp"), "abs", this.sheet), 960, 540, 1920, 1080);

    this.route = picture("", "abs result-route", this.sheet);
    place(this.route, 960 - 520, 540 + 90, 700, 700);

    for (const y of slotY) {
      for (const x of slotX) {
        const root = el("div", "abs result-slot", this.sheet);
        place(root, 960 + x, 540 - y, 450, 100);
        const icon = picture("", "abs", root);
        place(icon, 225 - 165, 50, 100, 100);
        const text = el("div", "abs result-slot-text", root);
        place(text, 225 + 60, 50, 330, 100);
        const badge = el("div", "abs result-new", root);
        badge.textContent = "NEW";
        this.slots.push({ root, icon, text, badge });
      }
    }
    const order = [0, 2, 4, 6, 1, 3, 5, 7];
    this.slots = order.map((i) => this.slots[i]);

    this.empty = el("div", "abs result-empty", this.sheet);
    place(this.empty, 960 + 357, 540 - 62, 920, 120);
    this.empty.textContent = "獲得したトロフィーはありません";

    this.password = el("div", "abs result-password", this.sheet);
    place(this.password, 960 + 390, 540 + 290, 600, 80);

    const buttons = el("div", "abs result-buttons", this.root);
    place(buttons, 960, 1030, 1920, 90);
    const book = el("button", "result-button book", buttons);
    book.type = "button";
    book.textContent = "実績一覧";
    book.addEventListener("click", (event) => {
      event.stopPropagation();
      handlers.trophies();
    });
    const again = el("button", "result-button", buttons);
    again.type = "button";
    again.textContent = "もう一度あそぶ";
    again.addEventListener("click", (event) => {
      event.stopPropagation();
      handlers.restart();
    });

    this.root.style.display = "none";
  }

  get visible(): boolean {
    return this.root.style.display !== "none";
  }

  show(record: RunRecord | null): void {
    if (!record) {
      this.shown = null;
      this.root.style.display = "none";
      return;
    }
    if (this.shown === record) return;
    this.shown = record;
    this.route.src = record.route;
    this.slots.forEach((slot, i) => {
      const trophy = record.trophies[i];
      slot.root.style.display = trophy ? "" : "none";
      if (!trophy) return;
      slot.icon.src = asset(`art/trophy/${trophy.icon}.webp`);
      slot.text.textContent = trophy.name;
      slot.badge.style.display = record.fresh.has(trophy.name) ? "" : "none";
    });
    this.empty.style.display = record.trophies.length ? "none" : "";
    this.password.textContent = record.password;
    this.root.style.display = "";
    this.root.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 500, easing: OUT_QUAD });
    this.sheet.animate(
      [
        { transform: "translateY(60px) scale(0.86) rotate(-1.5deg)" },
        { transform: "translateY(0) scale(0.9) rotate(0deg)" },
      ],
      { duration: 650, easing: OUT_QUAD },
    );
    this.slots.forEach((slot, i) => {
      if (!record.trophies[i]) return;
      slot.root.animate(
        [
          { opacity: 0, transform: "scale(1.4)" },
          { opacity: 1, transform: "scale(1)" },
        ],
        { duration: 300, delay: 600 + i * 140, easing: OUT_QUAD, fill: "backwards" },
      );
    });
  }
}

export class TrophyBook {
  private root: HTMLElement;
  private count: HTMLElement;
  private cards: { entry: (typeof catalog)[number]; root: HTMLElement; icon: HTMLImageElement; name: HTMLElement }[] = [];

  constructor(parent: HTMLElement) {
    this.root = el("div", "abs trophies", parent);
    place(this.root, 960, 540, 1920, 1080);
    const panel = el("div", "abs trophies-panel", this.root);
    place(panel, 960, 540, 1780, 1000);

    const head = el("div", "trophies-head", panel);
    el("div", "trophies-label", head).textContent = "実績";
    this.count = el("div", "trophies-count", head);
    const close = el("button", "trophies-close", head);
    close.type = "button";
    close.textContent = "とじる";
    close.addEventListener("click", (event) => {
      event.stopPropagation();
      this.open(false);
    });

    const grid = el("div", "trophies-grid", panel);
    for (const entry of catalog) {
      const root = el("div", "trophy-card", grid);
      const icon = picture("", "trophy-card-icon", root);
      const body = el("div", "trophy-card-body", root);
      const name = el("div", "trophy-card-name", body);
      el("div", "trophy-card-hint", body).textContent = entry.hint;
      this.cards.push({ entry, root, icon, name });
    }

    this.root.addEventListener("click", (event) => {
      event.stopPropagation();
      if (event.target === this.root) this.open(false);
    });
    this.root.addEventListener("pointerdown", (event) => event.stopPropagation());
    this.root.style.display = "none";
  }

  get isOpen(): boolean {
    return this.root.style.display !== "none";
  }

  open(open: boolean): void {
    if (!open) {
      this.root.style.display = "none";
      return;
    }
    const earned = loadEarned();
    let got = 0;
    for (const card of this.cards) {
      const has = earned.has(card.entry.name);
      if (has) got += 1;
      card.root.classList.toggle("locked", !has);
      card.icon.src = asset(has ? `art/trophy/${card.entry.icon}.webp` : "art/trophy/trophy_gray.webp");
      fitText(card.name, has || !card.entry.secret ? card.entry.name : "？？？", 196, 30);
    }
    this.count.textContent = `${got} / ${this.cards.length}`;
    this.root.style.display = "";
    this.root.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 250, easing: OUT_QUAD });
  }
}
