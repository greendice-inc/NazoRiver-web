import type { SceneNode } from "./scene";
import type { RunRecord } from "./trophies";

export type ObstacleKind = "rock" | "mover" | "nazo" | "enemy" | "choice" | "windL" | "windR";

export type Sprite = {
  id: number;
  kind: ObstacleKind;
  x: number;
  z: number;
};

// Extra world objects owned by stage 3 / the secret river: letters, shiritori boards, hard rocks, gems.
export type Prop = {
  id: string;
  kind: "char" | "image" | "rock";
  x: number;
  y: number;
  z: number;
  text?: string;
  src?: string;
  scale?: number;
  opacity?: number;
};

export type PhaseName =
  | "title"
  | "launch"
  | "intro"
  | "countdown"
  | "cruise"
  | "branch"
  | "turn"
  | "black"
  | "question"
  | "mark"
  | "qend"
  | "mode"
  | "result"
  | "over";

export type CameraPose = {
  x: number;
  z: number;
  yaw: number;
  roll: number;
  pitch?: number;
};

export type Gate = {
  x: number;
  z: number;
  left: string;
  right: string;
  fadeIn?: boolean;
};

export type GameEvent =
  | { type: "se"; name: string }
  | { type: "bgm"; name: string | null }
  | { type: "launch" }
  | { type: "countdown"; kind: "cruise" | "question" }
  | { type: "nazoGet"; x: number; z: number }
  | { type: "accelerate" }
  | { type: "wind"; dir: -1 | 1; duration: number }
  | { type: "damage" }
  | { type: "questionNumber"; n: number }
  | { type: "answer"; ok: boolean }
  | { type: "miss" };

export type Ending = {
  kind: "over" | "result";
  image: string | null;
  title: string;
  text: string;
};

// LifeGauge → LifePoint hearts. `since` counts seconds from the conversion start (Infinity = settled).
export type Hearts = {
  count: number;
  since: number;
};

export type TotemFaces = {
  ex: boolean;
  angles: number[];
};

export type View = {
  phase: PhaseName;
  level: number;
  life: number;
  maxLife: number;
  collected: number;
  counter: boolean;
  gauge: number;
  gaugeFull: boolean;
  arrows: boolean;
  arrowY: number;
  showLeftArrow: boolean;
  showRightArrow: boolean;
  steering: boolean;
  // Mode phases take row strokes as input even when the boat is not steering.
  strokes: boolean;
  camera: CameraPose;
  // Canvas roll when it differs from the camera (Unity rotates canvas and camera separately).
  hudRoll?: number;
  sprites: Sprite[];
  props: Prop[];
  gate: Gate | null;
  intro: { image: string; count: number | null } | null;
  caution: boolean;
  routeMap: string | null;
  questionSrc: string;
  questionTime: number;
  questionMax: number;
  questionElapsed: number;
  answering: boolean;
  answerEcho: string;
  qend: boolean;
  black: number;
  white: number;
  titleScreen: boolean;
  focusToken: number;
  ending: Ending | null;
  record: RunRecord | null;
  canRetry: boolean;
  secret: boolean;
  scene: SceneNode[];
  hearts: Hearts | null;
  waitTap: boolean;
  boat: { roll: number } | null;
  totem: TotemFaces | null;
  decor: "forest" | "pillars";
};
