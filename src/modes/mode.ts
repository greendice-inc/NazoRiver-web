import { outQuad, type SceneNode } from "../scene";
import type { RunStats } from "../trophies";
import type { CameraPose, GameEvent, Gate, Prop, TotemFaces } from "../types";

export const STEP = 1 / 30;
export const LINE = 10;
export const MAX_LIFE = 14400;

export function laneX(lane: number): number {
  return -9 + lane * 3;
}

// Unity damage shake: camera z-rot 0→+3 (0.3s) → −3 (0.6s) → 0 (0.3s), OutQuad each leg.
export function shakeRoll(t: number): number {
  if (t < 0 || t >= 1.2) return 0;
  if (t < 0.3) return 3 * outQuad(t / 0.3);
  if (t < 0.9) return 3 - 6 * outQuad((t - 0.3) / 0.6);
  return -3 + 3 * outQuad((t - 0.9) / 0.3);
}

export type ModeView = {
  camera: CameraPose;
  hudRoll?: number;
  props: Prop[];
  gate: Gate | null;
  scene: SceneNode[];
  waitTap: boolean;
  boat: { roll: number } | null;
  totem: TotemFaces | null;
  decor: "forest" | "pillars";
  arrows: boolean;
  arrowY: number;
  gauge: number;
  gaugeFull: boolean;
  showLeftArrow: boolean;
  showRightArrow: boolean;
  steering: boolean;
  answering: boolean;
  black: number;
};

export type Host = {
  run: RunStats;
  emit(event: GameEvent): void;
  life(): number;
  setLife(value: number): void;
  lifePoint(): number;
  // Returns false when LifePoint reaches 0 (GameControllerScript.SetLifePoint).
  setLifePoint(value: number): boolean;
  // ConvertLifeGaugeAnimation (7s): Life → LifePoint hearts.
  convertHearts(): void;
  showHearts(): void;
  focusAnswer(): void;
  // Cruise2.ChoiceRoute: hand the camera to the shared branch / turn sequence.
  branch(fromX: number, fromZ: number): void;
  // BlackOut → next level.
  next(level: number): void;
  // ResultScript.ShowResult(fileName).
  result(file: string): void;
};

export abstract class Mode {
  constructor(protected host: Host) {}

  abstract step(): void;
  abstract view(): ModeView;

  pressLeft(): void {}
  pressRight(): void {}
  rowBoth(): void {}
  tap(_index: number): void {}
  advance(): void {}
  answer(_raw: string): "clear" | "keep" {
    return "keep";
  }
  echo(_text: string): void {}
  debugSolve(): void {}

  protected se(name: string): void {
    this.host.emit({ type: "se", name });
  }

  protected bgm(name: string | null): void {
    this.host.emit({ type: "bgm", name });
  }
}

export function baseView(camera: CameraPose): ModeView {
  return {
    camera,
    props: [],
    gate: null,
    scene: [],
    waitTap: false,
    boat: null,
    totem: null,
    decor: "forest",
    arrows: false,
    arrowY: 0,
    gauge: 0,
    gaugeFull: false,
    showLeftArrow: false,
    showRightArrow: false,
    steering: false,
    answering: false,
    black: 0,
  };
}

export type SceneList = SceneNode[];
