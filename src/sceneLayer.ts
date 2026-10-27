import type { SceneNode } from "./scene";

type Entry = {
  root: HTMLElement;
  image: HTMLImageElement | null;
  text: HTMLElement | null;
  sig: string;
};

const fonts: Record<NonNullable<SceneNode["font"]>, string> = {
  wanpaku: `"Wanpaku", sans-serif`,
  ipa: `"IPAexG", sans-serif`,
  noto: `"NotoJP", sans-serif`,
};

// Client pixels a tap may drift before it counts as a stroke.
const TAP_SLOP = 24;

function outline(color: string, width: number): string {
  const shadows: string[] = [];
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    shadows.push(`${(Math.cos(a) * width).toFixed(1)}px ${(Math.sin(a) * width).toFixed(1)}px 0 ${color}`);
  }
  return shadows.join(",");
}

export class SceneLayer {
  readonly root: HTMLElement;
  private entries = new Map<string, Entry>();
  private order = "";
  private press: { id: number; index: number; x: number; y: number } | null = null;

  constructor(parent: HTMLElement, className: string, private onTap: (index: number) => void) {
    this.root = document.createElement("div");
    this.root.className = `abs scene-layer ${className}`;
    this.root.style.left = "0px";
    this.root.style.top = "0px";
    this.root.style.width = "1920px";
    this.root.style.height = "1080px";
    parent.appendChild(this.root);
    // Taps fire on release and only when the pointer stayed put, so a row stroke that starts on a
    // tappable node still reaches RowInput instead of also tapping it.
    this.root.addEventListener("pointerdown", (event) => {
      const target = (event.target as HTMLElement).closest<HTMLElement>("[data-tap]");
      if (!target) return;
      event.preventDefault();
      this.press = { id: event.pointerId, index: Number(target.dataset.tap), x: event.clientX, y: event.clientY };
    });
    window.addEventListener("pointerup", (event) => {
      const press = this.press;
      if (!press || press.id !== event.pointerId) return;
      this.press = null;
      if (Math.hypot(event.clientX - press.x, event.clientY - press.y) <= TAP_SLOP) this.onTap(press.index);
    });
    window.addEventListener("pointercancel", (event) => {
      if (this.press?.id === event.pointerId) this.press = null;
    });
  }

  update(nodes: SceneNode[]): void {
    const seen = new Set<string>();
    for (const node of nodes) {
      seen.add(node.key);
      let entry = this.entries.get(node.key);
      if (!entry) {
        const root = document.createElement("div");
        root.className = "scene-node";
        entry = { root, image: null, text: null, sig: "" };
        this.entries.set(node.key, entry);
      }
      this.apply(entry, node);
    }
    for (const [key, entry] of this.entries) {
      if (seen.has(key)) continue;
      entry.root.remove();
      this.entries.delete(key);
    }
    const order = nodes.map((node) => node.key).join("|");
    if (order !== this.order) {
      this.order = order;
      for (const node of nodes) this.root.appendChild(this.entries.get(node.key)!.root);
    }
  }

  private apply(entry: Entry, node: SceneNode): void {
    const { root } = entry;
    const style = root.style;
    const sig = `${node.x}|${node.y}|${node.w}|${node.h}|${node.scale ?? 1}|${node.rot ?? 0}|${node.spinY ?? 0}|${node.flipY ? 1 : 0}|${node.alpha ?? 1}|${node.fill ?? 1}|${node.fillFrom ?? ""}|${node.bg ?? ""}|${node.tap ?? ""}|${node.round ? 1 : 0}|${node.blink ? 1 : 0}`;
    if (sig !== entry.sig) {
      entry.sig = sig;
      style.left = `${960 + node.x - node.w / 2}px`;
      style.top = `${540 - node.y - node.h / 2}px`;
      style.width = `${node.w}px`;
      style.height = `${node.h}px`;
      const transforms: string[] = [];
      if (node.rot) transforms.push(`rotate(${-node.rot}deg)`);
      if (node.spinY) transforms.push(`rotateY(${node.spinY}deg)`);
      if (node.flipY) transforms.push("scaleY(-1)");
      if (node.scale !== undefined && node.scale !== 1) transforms.push(`scale(${node.scale})`);
      style.transform = transforms.join(" ");
      style.opacity = node.alpha === undefined ? "" : String(Math.max(0, Math.min(1, node.alpha)));
      style.background = node.bg ?? "";
      style.borderRadius = node.round ? "50%" : "";
      const fill = node.fill ?? 1;
      let clip = "";
      let mask = "";
      if (fill < 1) {
        const rest = `${((1 - Math.max(0, fill)) * 100).toFixed(2)}%`;
        if (node.fillFrom === "right") clip = `inset(0 0 0 ${rest})`;
        else if (node.fillFrom === "bottom") clip = `inset(${rest} 0 0 0)`;
        else if (node.fillFrom === "radial") mask = `conic-gradient(transparent 0deg ${((1 - Math.max(0, fill)) * 360).toFixed(1)}deg, #000 0deg)`;
        else clip = `inset(0 ${rest} 0 0)`;
      }
      style.clipPath = clip;
      style.setProperty("mask-image", mask);
      style.setProperty("-webkit-mask-image", mask);
      root.classList.toggle("scene-tap", node.tap !== undefined);
      root.classList.toggle("scene-blink", !!node.blink);
      if (node.tap !== undefined) root.dataset.tap = String(node.tap);
      else delete root.dataset.tap;
    }

    if (node.src) {
      if (!entry.image) {
        entry.image = document.createElement("img");
        entry.image.className = "scene-image";
        entry.image.draggable = false;
        root.prepend(entry.image);
      }
      if (entry.image.dataset.src !== node.src) {
        entry.image.dataset.src = node.src;
        entry.image.src = node.src;
      }
    } else if (entry.image) {
      entry.image.remove();
      entry.image = null;
    }

    if (node.text !== undefined) {
      if (!entry.text) {
        entry.text = document.createElement("div");
        entry.text.className = "scene-text";
        root.appendChild(entry.text);
      }
      const text = entry.text;
      if (text.textContent !== node.text) text.textContent = node.text;
      const font = fonts[node.font ?? "ipa"];
      if (text.style.fontFamily !== font) text.style.fontFamily = font;
      const size = `${node.size ?? 60}px`;
      if (text.style.fontSize !== size) text.style.fontSize = size;
      const color = node.color ?? "#fff";
      if (text.style.color !== color) text.style.color = color;
      const shadow = node.stroke ? outline(node.stroke, Math.max(2, (node.size ?? 60) / 22)) : "";
      if (text.dataset.shadow !== shadow) {
        text.dataset.shadow = shadow;
        text.style.textShadow = shadow;
      }
    } else if (entry.text) {
      entry.text.remove();
      entry.text = null;
    }
  }
}
