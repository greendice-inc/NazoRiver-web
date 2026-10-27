import { asset } from "./paths";

// The parrot on the title now and then flaps its wing or works its beak.
// Parts are cut from the key visual (tools/title-art/parrot_parts.py); the background under them is pre-patched
// (shadowed body red under the wing, dark mouth behind the beak), so moving them reveals something sensible.

type Part = { x: number; y: number; w: number; h: number; px: number; py: number };

// Stage pixels, written by parrot_parts.py. px/py = hinge point.
const WING: Part = { x: 55, y: 549, w: 137, h: 282, px: 143, py: 569 };
const BEAK: Part = { x: 220, y: 506, w: 61, h: 87, px: 228, py: 532 };
const JAW: Part = { x: 208, y: 548, w: 42, h: 38, px: 214, py: 554 };

function layer(parent: HTMLElement, name: string, part: Part): HTMLImageElement {
  const img = document.createElement("img");
  img.className = "abs t-parrot";
  img.src = asset(`art/title/parrot_${name}.webp`);
  img.draggable = false;
  img.alt = "";
  img.style.left = `${part.x}px`;
  img.style.top = `${part.y}px`;
  img.style.width = `${part.w}px`;
  img.style.height = `${part.h}px`;
  img.style.transformOrigin = `${part.px - part.x}px ${part.py - part.y}px`;
  parent.appendChild(img);
  return img;
}

export class TitleParrot {
  private wing: HTMLImageElement;
  private jaw: HTMLImageElement;
  private beak: HTMLImageElement;
  private timer = 0;
  private running = false;

  constructor(parent: HTMLElement) {
    this.wing = layer(parent, "wing", WING);
    this.jaw = layer(parent, "jaw", JAW);
    this.beak = layer(parent, "beak", BEAK);
  }

  setRunning(running: boolean): void {
    if (running === this.running) return;
    this.running = running;
    window.clearTimeout(this.timer);
    if (running) this.schedule(1800 + Math.random() * 1500);
  }

  private schedule(ms: number): void {
    this.timer = window.setTimeout(() => {
      if (!this.running) return;
      const roll = Math.random();
      if (roll < 0.45) this.talk();
      else if (roll < 0.85) this.flap();
      else {
        this.flap();
        window.setTimeout(() => this.talk(), 350);
      }
      this.schedule(2600 + Math.random() * 3600);
    }, ms);
  }

  /** Wing lifts away from the body a couple of times, then folds back. */
  private flap(): void {
    const big = Math.random() < 0.6;
    const frames = big
      ? [
          { transform: "rotate(0deg)" },
          { transform: "rotate(12deg) scaleX(1.03)", offset: 0.22 },
          { transform: "rotate(4deg)", offset: 0.45 },
          { transform: "rotate(10deg) scaleX(1.02)", offset: 0.68 },
          { transform: "rotate(0deg)" },
        ]
      : [{ transform: "rotate(0deg)" }, { transform: "rotate(6deg)", offset: 0.4 }, { transform: "rotate(0deg)" }];
    this.wing.animate(frames, { duration: big ? 950 : 520, easing: "ease-in-out" });
  }

  /** Beak opens and closes one to three times, like it's squawking. */
  private talk(): void {
    const chomps = 1 + Math.floor(Math.random() * 3);
    const jaw: Keyframe[] = [{ transform: "rotate(0deg)" }];
    const beak: Keyframe[] = [{ transform: "rotate(0deg)" }];
    for (let i = 0; i < chomps; i++) {
      const open = 20 + Math.random() * 8;
      jaw.push({ transform: `rotate(${open}deg)`, offset: (i + 0.45) / chomps }, { transform: "rotate(0deg)", offset: (i + 1) / chomps });
      beak.push({ transform: `rotate(${-open * 0.45}deg)`, offset: (i + 0.45) / chomps }, { transform: "rotate(0deg)", offset: (i + 1) / chomps });
    }
    const duration = 300 * chomps;
    this.jaw.animate(jaw, { duration, easing: "ease-in-out" });
    this.beak.animate(beak, { duration, easing: "ease-in-out" });
  }
}
