export type RowZone = "left" | "center" | "right";

type Options = {
  surface: HTMLElement;
  layer: HTMLElement;
  toStage: (clientX: number, clientY: number) => { x: number; y: number };
  enabled: () => boolean;
  row: (zone: RowZone) => void;
  lift?: (zone: RowZone) => void;
};

type Stroke = {
  zone: RowZone;
  anchorX: number;
  anchorY: number;
  armed: boolean;
  liftAnchorX: number;
  liftAnchorY: number;
  liftArmed: boolean;
  trail: HTMLElement;
};

const STROKE = 140;
const REARM = 50;
const IGNORE = "button, input, textarea, select, a, form, .title, .ending, .result, .trophies, .debug-menu, .debug-pad, .scene-tap, .tap-catch";

export function zoneAt(x: number): RowZone {
  if (x < 640) return "left";
  if (x > 1280) return "right";
  return "center";
}

export class RowInput {
  private strokes = new Map<number, Stroke>();

  constructor(private options: Options) {
    const { surface } = options;
    surface.addEventListener("pointerdown", (event) => this.down(event));
    window.addEventListener("pointermove", (event) => this.move(event), { passive: true });
    window.addEventListener("pointerup", (event) => this.end(event.pointerId));
    window.addEventListener("pointercancel", (event) => this.end(event.pointerId));
  }

  private down(event: PointerEvent): void {
    if (event.button > 0) return;
    if (event.target instanceof Element && event.target.closest(IGNORE)) return;
    const point = this.options.toStage(event.clientX, event.clientY);
    const zone = zoneAt(point.x);
    const trail = document.createElement("div");
    trail.className = `abs row-trail row-${zone}`;
    this.options.layer.appendChild(trail);
    this.strokes.set(event.pointerId, {
      zone,
      anchorX: point.x,
      anchorY: point.y,
      armed: true,
      liftAnchorX: point.x,
      liftAnchorY: point.y,
      liftArmed: true,
      trail,
    });
    this.draw(this.strokes.get(event.pointerId)!, point.x, point.y);
  }

  private move(event: PointerEvent): void {
    const stroke = this.strokes.get(event.pointerId);
    if (!stroke) return;
    for (const sample of event.getCoalescedEvents?.() ?? [event]) {
      const point = this.options.toStage(sample.clientX, sample.clientY);
      this.track(stroke, point.x, point.y);
    }
  }

  private track(stroke: Stroke, x: number, y: number): void {
    const dy = y - stroke.anchorY;
    if (stroke.armed) {
      if (dy < 0) {
        stroke.anchorY = y;
        stroke.anchorX = x;
      } else if (dy >= STROKE && Math.abs(x - stroke.anchorX) < dy) {
        if (this.options.enabled()) {
          this.options.row(stroke.zone);
          this.splash(stroke, y);
        }
        stroke.armed = false;
        stroke.anchorY = y;
      }
    } else if (dy > 0) {
      stroke.anchorY = y;
    } else if (-dy >= REARM) {
      stroke.armed = true;
      stroke.anchorY = y;
      stroke.anchorX = x;
    }

    const up = stroke.liftAnchorY - y;
    if (stroke.liftArmed) {
      if (up < 0) {
        stroke.liftAnchorY = y;
        stroke.liftAnchorX = x;
      } else if (up >= STROKE && Math.abs(x - stroke.liftAnchorX) < up) {
        if (this.options.enabled()) {
          this.options.lift?.(stroke.zone);
          this.splash(stroke, y, true);
        }
        stroke.liftArmed = false;
        stroke.liftAnchorY = y;
      }
    } else if (up > 0) {
      stroke.liftAnchorY = y;
    } else if (-up >= REARM) {
      stroke.liftArmed = true;
      stroke.liftAnchorY = y;
      stroke.liftAnchorX = x;
    }
    this.draw(stroke, x, y);
  }

  private draw(stroke: Stroke, x: number, y: number): void {
    const downTop = stroke.armed ? stroke.anchorY : y;
    const downLen = Math.max(0, y - downTop);
    const upBottom = stroke.liftArmed ? stroke.liftAnchorY : y;
    const upLen = Math.max(0, upBottom - y);
    const lifting = upLen > downLen;
    const length = lifting ? upLen : downLen;
    const style = stroke.trail.style;
    style.left = `${x - 22}px`;
    style.top = `${lifting ? y : downTop}px`;
    style.height = `${length}px`;
    style.opacity = this.options.enabled() ? String(Math.min(1, 0.25 + length / STROKE)) : "0";
    stroke.trail.classList.toggle("row-up", lifting);
  }

  private splash(stroke: Stroke, y: number, upward = false): void {
    const streak = stroke.trail.cloneNode() as HTMLElement;
    streak.style.opacity = "1";
    this.options.layer.appendChild(streak);
    streak.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 360 }).onfinish = () => streak.remove();

    const node = document.createElement("div");
    node.className = `abs row-splash row-${stroke.zone}${upward ? " row-up" : ""}`;
    node.style.left = `${(upward ? stroke.liftAnchorX : stroke.anchorX) - 90}px`;
    node.style.top = `${y - 90}px`;
    this.options.layer.appendChild(node);
    node.animate(
      [
        { opacity: 1, transform: "scale(0.4)" },
        { opacity: 0, transform: "scale(1.6)" },
      ],
      { duration: 420, easing: "cubic-bezier(0.5, 1, 0.89, 1)" },
    ).onfinish = () => node.remove();
  }

  private end(id: number): void {
    const stroke = this.strokes.get(id);
    if (!stroke) return;
    this.strokes.delete(id);
    stroke.trail.animate([{ opacity: stroke.trail.style.opacity || "1" }, { opacity: 0 }], { duration: 200 }).onfinish = () =>
      stroke.trail.remove();
  }
}
