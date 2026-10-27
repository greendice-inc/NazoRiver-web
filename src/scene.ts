import { asset } from "./paths";

// Unity MessageCanvas nodes: x/y are canvas units with the origin at the screen center and y pointing up.
export type SceneNode = {
  key: string;
  x: number;
  y: number;
  w: number;
  h: number;
  src?: string;
  text?: string;
  font?: "wanpaku" | "ipa" | "noto";
  size?: number;
  color?: string;
  stroke?: string;
  bg?: string;
  scale?: number;
  rot?: number;
  spinY?: number;
  flipY?: boolean;
  alpha?: number;
  fill?: number;
  fillFrom?: "left" | "right" | "bottom" | "radial";
  tap?: number;
  over?: boolean;
  round?: boolean;
  blink?: boolean;
};

export const U = asset("u/");
export const SPR = asset("u/Sprites/");
export const RES = asset("u/Resources/");

export function img(key: string, src: string, x: number, y: number, w: number, h: number, extra: Partial<SceneNode> = {}): SceneNode {
  return { key, src, x, y, w, h, ...extra };
}

export function txt(key: string, text: string, x: number, y: number, w: number, h: number, size: number, extra: Partial<SceneNode> = {}): SceneNode {
  return { key, text, x, y, w, h, size, font: "ipa", color: "#fff", ...extra };
}

export function rect(key: string, x: number, y: number, w: number, h: number, bg: string, extra: Partial<SceneNode> = {}): SceneNode {
  return { key, x, y, w, h, bg, ...extra };
}

export function clamp01(t: number): number {
  return Math.min(1, Math.max(0, t));
}

export function outQuad(t: number): number {
  return 1 - (1 - t) * (1 - t);
}

export function inQuad(t: number): number {
  return t * t;
}

export function inOutQuad(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
}

// Progress of a tween that starts at `start` and lasts `dur`, clamped to 0..1.
export function seg(t: number, start: number, dur: number): number {
  if (dur <= 0) return t >= start ? 1 : 0;
  return clamp01((t - start) / dur);
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function shuffle<T>(list: readonly T[]): T[] {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function pick<T>(list: readonly T[]): T {
  return list[Math.floor(Math.random() * list.length)];
}

export function normalizeKana(raw: string): string {
  const width = raw.normalize("NFKC").trim().replace(/\s+/g, "");
  return width.replace(/[\u30a1-\u30f6]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 0x60));
}

// Popup used by countdowns, angry cards and answer stamps: scale 2→1 + fade in 0.25s, hold, then scale→0 + fade out 0.25s.
export function popup(t: number, hold: number): { alpha: number; scale: number } | null {
  if (t < 0 || t > 0.5 + hold) return null;
  if (t < 0.25) {
    const k = outQuad(t / 0.25);
    return { alpha: k, scale: 2 - k };
  }
  if (t < 0.25 + hold) return { alpha: 1, scale: 1 };
  const k = outQuad((t - 0.25 - hold) / 0.25);
  return { alpha: 1 - k, scale: 1 - k };
}

export function countdownNodes(t: number): SceneNode[] {
  const nodes: SceneNode[] = [];
  const steps: [string, string, number, number][] = [
    ["3", "popup_3", 1000, 1000],
    ["2", "popup_2", 1000, 1000],
    ["1", "popup_1", 1000, 1000],
    ["start", "popup_start", 1921, 1000],
  ];
  steps.forEach(([key, file, w, h], i) => {
    const pop = popup(t - i * 0.75, 0.5);
    if (pop) nodes.push(img(`cd-${key}`, `${SPR}ui/${file}.webp`, 0, 0, w, h, { over: true, alpha: pop.alpha, scale: pop.scale }));
  });
  return nodes;
}

export const COUNTDOWN_START = 2.25;
export const COUNTDOWN_END = 3;

export function gaugeTint(rate: number): string {
  if (rate > 3 / 4) return "rgb(0,255,255)";
  if (rate > 2 / 4) return "rgb(0,255,0)";
  if (rate > 1 / 4) return "rgb(255,255,0)";
  return "rgb(255,0,0)";
}
