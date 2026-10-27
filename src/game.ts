import { questions, type Question } from "./data/questions";
import { cruiseLevels, stageByLevel, type StageDef } from "./data/stages";
import { Crocodile } from "./modes/crocodile";
import { Lobster } from "./modes/lobster";
import type { Host, Mode, ModeView } from "./modes/mode";
import { Octopus } from "./modes/octopus";
import { CruiseEx, CruiseLast } from "./modes/secret";
import { Stage3 } from "./modes/stage3";
import { Statue } from "./modes/statue";
import { Tortoise } from "./modes/tortoise";
import { Totem } from "./modes/totem";
import { buildRecord, newRun, type RunRecord, type RunStats } from "./trophies";
import type { CameraPose, Ending, GameEvent, Gate, ObstacleKind, PhaseName, Sprite, View } from "./types";
import { asset } from "./paths";

export const STEP = 1 / 30;

export const MAX_HEARTS = 5;
const QUIZ_TIME = 15;
// Depth at which an enemy stops in front of the boat and starts its quiz.
const ENEMY_AHEAD = 14;
// While its quiz is open the bee hovers above the question card (enemy up, 謎 down).
const QUIZ_BEE_X = 0.4;
const QUIZ_BEE_Y = 2.45;
const QUIZ_BEE_MOVE = 0.6;
const LINE = 10;
const COUNTDOWN_GO = 3.25;
const BRANCH_APPROACH = 2;
const TURN_TIME = 5;
const BLACK_IN = 1;
const BLACK_HOLD = 3;
const INTRO_TIME = 4;
const LAUNCH_WHITE_IN = 0.12;
const LAUNCH_WHITE_FULL = 0.5;
const LAUNCH_END = 1.1;
export const SECRET_UP_STROKES = 10;
const SECRET_UP_GAP = 1800;

type Checkpoint = {
  cameraZ: number;
  lane: number;
  questionIndex: number;
  run: RunStats;
  hits: Record<number, boolean>;
  movers: Record<number, { localX: number; speed: number }>;
};

type Obstacle = {
  id: number;
  kind: ObstacleKind;
  lane: number;
  z: number;
  hit: boolean;
  localX: number;
  speed: number;
  left: number;
  right: number;
};

// An enemy's question. While it is open the course stops approaching (the boat still rows forward visually).
type Quiz = {
  question: Question;
  enemyId: number;
  time: number;
};

type Phase =
  | { name: "title" }
  | { name: "launch"; time: number }
  | { name: "intro"; time: number; image: string }
  | { name: "countdown"; time: number }
  | { name: "cruise" }
  | { name: "branch"; time: number; choosing: boolean; fromX: number; fromZ: number }
  | { name: "turn"; time: number; dir: -1 | 1; fromZ: number }
  | { name: "black"; time: number }
  | { name: "mode" }
  | { name: "result"; time: number; file: string }
  | { name: "over" };

const introImages: Record<number, string> = {
  10: asset("art/iwaba.webp"),
  11: asset("art/keikoku.webp"),
};

const RESULT_BGM_DELAY = 7;

function laneX(lane: number): number {
  return -9 + lane * 3;
}

function outQuad(t: number): number {
  return 1 - (1 - t) * (1 - t);
}

function inQuad(t: number): number {
  return t * t;
}

function clamp01(t: number): number {
  return Math.min(1, Math.max(0, t));
}

// RouteNum a debug jump would have accumulated on the way to `level`.
function routeFor(level: number): number {
  if (level === 11) return 4;
  if (level === 21) return 2;
  if (level === 22) return 4;
  if (level === 23) return 6;
  if (level >= 30 && level <= 34) return 2 * (level - 30);
  return 0;
}

// Question type asked by the enemies of the cruise `level`.
function questionTypeFor(level: number): Question["type"] {
  if (level === 10) return "道2左";
  if (level === 11) return "道2右";
  return "道1";
}

function isModeLevel(level: number): boolean {
  return (level >= 20 && level <= 23) || (level >= 30 && level <= 34) || level === 42 || level === 50 || level === 60;
}

function shuffle<T>(list: T[]): T[] {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function normalizeAnswer(text: string): string {
  const width = text.normalize("NFKC").trim().replace(/\s+/g, "");
  return width.replace(/[\u30a1-\u30f6]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 0x60));
}

let nextId = 1;

function buildObstacles(rows: string[]): Obstacle[] {
  const list: Obstacle[] = [];
  const base = { hit: false, localX: 0, speed: 0, left: 0, right: 0 };
  rows.forEach((row, index) => {
    const cells = `${row}-----`.slice(0, 5);
    for (let column = 0; column < 5; column++) {
      const cell = cells[column];
      const lane = column + 1;
      const ahead = (index + 1) * LINE;
      if (cell === "0" || cell === "1") {
        const span = 3 * (2 - column);
        list.push({
          ...base,
          id: nextId++,
          kind: cell === "1" ? "mover" : "rock",
          lane,
          z: ahead,
          speed: cell === "1" ? -0.05 : 0,
          left: -6 + span,
          right: 6 + span,
        });
      } else if (cell === "E") {
        list.push({ ...base, id: nextId++, kind: "enemy", lane: 3, z: ahead });
        break;
      } else if (cell === "C") {
        list.push({ ...base, id: nextId++, kind: "choice", lane, z: (index - 1) * LINE });
      } else if (cell === "L" || cell === "R") {
        list.push({ ...base, id: nextId++, kind: cell === "L" ? "windL" : "windR", lane: 3, z: ahead });
      }
    }
  });
  return list;
}

function findGate(stage: StageDef): Gate | null {
  for (let index = 0; index < stage.rows.length; index++) {
    const column = stage.rows[index].indexOf("C");
    if (column < 0) continue;
    return {
      x: laneX(column + 1),
      z: index * LINE,
      left: asset(`gates/${stage.leftGate}`),
      right: asset(`gates/${stage.rightGate}`),
    };
  }
  return null;
}

export class Game {
  level = 0;
  cameraZ = 0;
  // Distance rowed while a quiz holds the course; added to everything drawn so the boat keeps moving.
  drift = 0;
  lane = 3;
  laneFrom = 3;
  laneTo = 3;
  laneTime = 0;
  laneDuration = 0;
  gauge = 0;
  speed = 0.2;
  moving = false;
  damaging = 0;
  knockFrom = 0;
  knockTo = 0;
  wind = 0;
  windDir = 0;
  focusToken = 0;
  answerEcho = "";
  blackFade = 0;
  phase: Phase = { name: "title" };
  stage: StageDef = stageByLevel(0)!;
  gate: Gate | null = null;
  obstacles: Obstacle[] = [];
  queue: Question[] = [];
  questionIndex = 0;
  quiz: Quiz | null = null;
  prevZ = 0;
  leftPresses = 0;
  rightPresses = 0;
  accel = false;
  run: RunStats = newRun();
  record: RunRecord | null = null;
  mode: Mode | null = null;
  lifePoint = MAX_HEARTS;
  private checkpoint: Checkpoint | null = null;
  private turnEnd: { dir: -1 | 1; fromZ: number } | null = null;
  private events: GameEvent[] = [];
  private touchTimes = { l: -Infinity, r: -Infinity };
  private secretLifts = 0;
  private lastSecretLift = 0;
  private host: Host;
  private modeView: ModeView | null = null;

  constructor() {
    this.host = {
      run: this.run,
      emit: (event) => this.emit(event),
      lifePoint: () => this.lifePoint,
      setLifePoint: (value) => {
        this.lifePoint = Math.max(0, Math.min(MAX_HEARTS, value));
        return this.lifePoint > 0;
      },
      gameOver: () => this.gameOver(),
      focusAnswer: () => {
        this.focusToken += 1;
        this.answerEcho = "";
      },
      branch: (fromX, fromZ) => {
        this.stage = stageByLevel(this.level) ?? this.stage;
        this.phase = { name: "branch", time: BRANCH_APPROACH, choosing: false, fromX, fromZ };
        this.gauge = 0;
        this.emit({ type: "se", name: "bird" });
      },
      next: (level) => {
        this.level = level;
        this.turnEnd = null;
        this.phase = { name: "black", time: 0 };
      },
      result: (file) => this.showResult(file),
    };
    this.loadCruise(0);
    this.emit({ type: "bgm", name: "op" });
  }

  drainEvents(): GameEvent[] {
    const list = this.events;
    this.events = [];
    return list;
  }

  begin(): void {
    if (this.phase.name !== "title") return;
    this.phase = { name: "launch", time: 0 };
  }

  restart(): void {
    this.level = 0;
    this.lifePoint = MAX_HEARTS;
    this.answerEcho = "";
    this.blackFade = 0;
    Object.assign(this.run, newRun());
    this.record = null;
    this.checkpoint = null;
    this.secretLifts = 0;
    this.clearMode();
    this.phase = { name: "title" };
    this.loadCruise(0);
    this.emit({ type: "bgm", name: "op" });
  }

  retry(): void {
    const point = this.checkpoint;
    if (this.phase.name !== "over") return;
    if (isModeLevel(this.level)) {
      this.lifePoint = MAX_HEARTS;
      this.record = null;
      this.enterMode(this.level);
      return;
    }
    if (!point) return;
    this.lifePoint = MAX_HEARTS;
    this.record = null;
    this.answerEcho = "";
    this.blackFade = 0;
    this.quiz = null;
    Object.assign(this.run, point.run);
    this.questionIndex = point.questionIndex;
    for (const obstacle of this.obstacles) {
      obstacle.hit = point.hits[obstacle.id] ?? false;
      const mover = point.movers[obstacle.id];
      if (mover) {
        obstacle.localX = mover.localX;
        obstacle.speed = mover.speed;
      }
    }
    this.cameraZ = point.cameraZ;
    this.prevZ = point.cameraZ;
    this.drift = 0;
    this.lane = point.lane;
    this.laneFrom = point.lane;
    this.laneTo = point.lane;
    this.laneTime = 0;
    this.moving = false;
    this.damaging = 0;
    this.gauge = 0;
    this.speed = 0.2;
    this.wind = 0;
    this.leftPresses = 0;
    this.rightPresses = 0;
    this.secretLifts = 0;
    this.emit({ type: "bgm", name: "river" });
    this.startCountdown();
  }

  // Debug area jump. 510–515 start the rush at SecretBossNumList [n, 5].
  debugJump(level: number): void {
    this.lifePoint = MAX_HEARTS;
    this.answerEcho = "";
    this.blackFade = 0;
    this.record = null;
    Object.assign(this.run, newRun());
    this.run.routeNum = routeFor(level);
    this.secretLifts = 0;
    this.clearMode();
    if (level >= 510) {
      this.run.secretList = level === 515 ? [5] : [level - 510, 5];
      level = 50;
    } else if (level === 50) {
      this.run.secretList = [2];
    }
    if (cruiseLevels.has(level)) {
      this.loadCruise(level);
      this.emit({ type: "bgm", name: "river" });
      const image = introImages[level];
      if (image) this.phase = { name: "intro", time: INTRO_TIME, image };
      else this.startCountdown();
      return;
    }
    if (isModeLevel(level)) this.enterMode(level);
  }

  steeringOn(): boolean {
    if (this.phase.name === "cruise") return !this.moving && this.damaging <= 0;
    return this.phase.name === "branch" && this.phase.choosing;
  }

  pressLeft(): void {
    if (this.phase.name === "mode") this.mode?.pressLeft();
    else if (this.steeringOn()) this.leftPresses += 1;
  }

  pressRight(): void {
    if (this.phase.name === "mode") this.mode?.pressRight();
    else if (this.steeringOn()) this.rightPresses += 1;
  }

  tapPanel(index: number): void {
    if (this.phase.name === "mode") this.mode?.tap(index);
  }

  // Stroke start point in stage pixels (1920×1080, y down).
  strokeAt(x: number, y: number): void {
    if (this.phase.name === "mode") this.mode?.strokeAt(x, y);
  }

  advance(): void {
    if (this.phase.name === "mode") this.mode?.advance();
  }

  debugSolve(): void {
    if (this.phase.name === "mode") this.mode?.debugSolve();
  }

  noteTouch(side: "l" | "r"): void {
    if (this.canAccelerate()) {
      const now = performance.now();
      this.touchTimes[side] = now;
      if (now - this.touchTimes.l <= 200 && now - this.touchTimes.r <= 200) {
        this.accel = true;
        this.touchTimes = { l: -Infinity, r: -Infinity };
      }
    }
    if (side === "r") this.pressRight();
    else this.pressLeft();
  }

  submitAnswer(raw: string): "clear" | "keep" {
    if (this.phase.name === "mode") {
      const result = this.mode?.answer(raw) ?? "keep";
      if (result === "clear") this.answerEcho = "";
      return result;
    }
    if (!this.quiz || this.phase.name !== "cruise") return "keep";
    const answer = normalizeAnswer(raw);
    if (!answer) return "keep";
    this.answerEcho = "";
    if (this.quiz.question.answers.some((item) => normalizeAnswer(item) === answer)) {
      this.endQuiz(true);
      return "clear";
    }
    this.emit({ type: "miss" });
    this.emit({ type: "se", name: "bu" });
    return "clear";
  }

  rowBoth(): void {
    if (this.phase.name === "mode") {
      this.mode?.rowBoth();
      return;
    }
    this.secretLifts = Math.max(0, this.secretLifts - 1);
    if (this.canAccelerate()) this.accel = true;
  }

  noteLift(zone: "left" | "center" | "right"): void {
    if (zone !== "center") return;
    if (this.level === 40) return;
    if (this.phase.name !== "cruise" || !this.steeringOn()) return;
    const now = performance.now();
    if (now - this.lastSecretLift > SECRET_UP_GAP) this.secretLifts = 0;
    this.lastSecretLift = now;
    this.secretLifts += 1;
    if (this.secretLifts >= SECRET_UP_STROKES) this.enterSecret();
  }

  setEcho(text: string): void {
    if (this.quiz || (this.phase.name === "mode" && this.modeView?.answering)) {
      this.answerEcho = text;
      this.mode?.echo(text);
    }
  }

  step(): void {
    if (this.wind > 0) this.wind -= STEP;
    if (this.phase.name !== "black" && this.blackFade > 0) this.blackFade = Math.max(0, this.blackFade - STEP);

    switch (this.phase.name) {
      case "launch": {
        const before = this.phase.time;
        this.phase.time += STEP;
        const now = this.phase.time;
        if (before < LAUNCH_WHITE_FULL && now >= LAUNCH_WHITE_FULL) this.emit({ type: "bgm", name: "river" });
        if (now >= LAUNCH_END) this.startCountdown();
        break;
      }
      case "intro":
        this.phase.time -= STEP;
        if (this.phase.time <= 0) this.startCountdown();
        break;
      case "countdown":
        this.advanceCountdown();
        break;
      case "cruise":
        this.advanceCruise();
        break;
      case "branch":
        this.advanceBranch();
        break;
      case "turn":
        this.phase.time += STEP;
        if (this.phase.time >= TURN_TIME) this.phase = { name: "black", time: 0 };
        break;
      case "black":
        this.phase.time += STEP;
        this.blackFade = clamp01(this.phase.time / BLACK_IN);
        if (this.phase.time >= BLACK_HOLD) this.resolveBlack();
        break;
      case "mode":
        this.mode?.step();
        break;
      case "result": {
        const before = this.phase.time;
        this.phase.time += STEP;
        const delay = this.phase.file.includes("failed") ? 0 : RESULT_BGM_DELAY;
        if (before <= delay && this.phase.time > delay) this.emit({ type: "bgm", name: "op" });
        break;
      }
      default:
        break;
    }
    this.modeView = this.mode ? this.mode.view() : null;
  }

  view(): View {
    const sprites: Sprite[] = [];
    const quizEnemy = this.quiz?.enemyId;
    const horizon = this.enemyHorizon();
    for (const obstacle of this.obstacles) {
      if (obstacle.kind === "choice" || obstacle.kind === "windL" || obstacle.kind === "windR") continue;
      if (obstacle.hit && obstacle.id !== quizEnemy) continue;
      // Nothing past the next enemy is drawn until it is dealt with; only the river shows behind it.
      if (horizon !== null && obstacle.z > horizon) continue;
      const depth = obstacle.z - this.cameraZ;
      if (depth < -8 || depth > 112) continue;
      const sprite: Sprite = { id: obstacle.id, kind: obstacle.kind, z: obstacle.z + this.drift, x: this.obstacleX(obstacle) };
      if (obstacle.id === quizEnemy && this.quiz) {
        const k = outQuad(clamp01((QUIZ_TIME - this.quiz.time) / QUIZ_BEE_MOVE));
        sprite.x += QUIZ_BEE_X * k;
        sprite.y = 1.1 + (QUIZ_BEE_Y - 1.1) * k;
      }
      sprites.push(sprite);
    }

    const phase = this.phase;
    const quiz = this.quiz;
    const lane = this.displayLane();
    const steering = this.steeringOn();
    const choosing = phase.name === "branch" && phase.choosing;
    const mv = this.mode ? (this.modeView ?? this.mode.view()) : null;
    const inMode = phase.name === "mode" && mv !== null;
    let gauge = this.gauge;
    let gaugeFull = false;
    if (phase.name === "cruise" && this.moving) {
      gauge = Math.sign(this.laneTo - this.laneFrom);
      gaugeFull = true;
    } else if (phase.name === "turn") {
      gauge = phase.dir;
      gaugeFull = true;
    }
    const arrows =
      phase.name === "cruise" ||
      phase.name === "branch" ||
      phase.name === "turn" ||
      phase.name === "countdown" ||
      phase.name === "intro";

    let ending: Ending | null = null;
    if (phase.name === "over") {
      ending = { kind: "over", image: null, title: "ハートがなくなってしまった…", text: "この場所から、もう一度挑戦できる。" };
    } else if (phase.name === "result") {
      ending = { kind: "result", image: asset(`u/Resources/ui/${phase.file}.webp`), title: "", text: "" };
    }

    const camera = this.cameraPose(mv);
    const hiddenGate = !!this.gate && horizon !== null && this.gate.z > horizon;
    const gate = !this.gate || hiddenGate ? null : this.drift ? { ...this.gate, z: this.gate.z + this.drift } : this.gate;
    return {
      phase: phase.name as PhaseName,
      level: this.level,
      gauge: inMode ? mv.gauge : gauge,
      gaugeFull: inMode ? mv.gaugeFull : gaugeFull,
      arrows: inMode ? mv.arrows : arrows,
      arrowY: inMode ? mv.arrowY : 0,
      showLeftArrow: inMode ? mv.showLeftArrow : choosing || phase.name === "turn" || lane > 1.2,
      showRightArrow: inMode ? mv.showRightArrow : choosing || phase.name === "turn" || lane < 4.8,
      steering: inMode ? mv.steering : steering,
      strokes: inMode && !mv.waitTap,
      camera,
      hudRoll: mv && (inMode || phase.name === "black") ? mv.hudRoll : undefined,
      sprites,
      props: mv ? mv.props : [],
      gate: mv && phase.name !== "result" ? mv.gate : gate,
      intro: phase.name === "intro" ? { image: phase.image } : null,
      caution: phase.name === "branch" && !phase.choosing,
      routeMap: choosing && this.level !== 40 ? asset(`art/branch_${this.stage.level}.webp`) : null,
      quiz: quiz ? { src: asset(`questions/${quiz.question.file}.webp`), time: quiz.time, max: QUIZ_TIME } : null,
      answering: !!quiz || (inMode && mv.answering),
      answerEcho: this.answerEcho,
      black: Math.max(this.blackFade, inMode ? mv.black : 0),
      white: this.whiteFade(),
      titleScreen: phase.name === "title" || (phase.name === "launch" && this.level !== 40 && phase.time < LAUNCH_WHITE_FULL),
      focusToken: this.focusToken,
      ending,
      record: this.record,
      canRetry: phase.name === "over" && (!!this.checkpoint || isModeLevel(this.level)),
      secret: this.level === 40 || this.level === 42 || this.level === 50 || this.level === 60,
      scene: mv && (inMode || phase.name === "black" || phase.name === "branch" || phase.name === "turn") ? mv.scene : [],
      hearts: this.lifePoint,
      waitTap: inMode && mv.waitTap,
      boat: mv ? mv.boat : null,
      totem: mv ? mv.totem : null,
      decor: mv ? mv.decor : "forest",
    };
  }

  private emit(event: GameEvent): void {
    this.events.push(event);
  }

  private whiteFade(): number {
    if (this.phase.name !== "launch") return 0;
    const t = this.phase.time;
    if (t < LAUNCH_WHITE_IN) return 0;
    if (t < LAUNCH_WHITE_FULL) return outQuad((t - LAUNCH_WHITE_IN) / (LAUNCH_WHITE_FULL - LAUNCH_WHITE_IN));
    return 1 - outQuad(clamp01((t - LAUNCH_WHITE_FULL) / (LAUNCH_END - LAUNCH_WHITE_FULL)));
  }

  private canAccelerate(): boolean {
    return this.phase.name === "cruise" && !this.moving && this.damaging <= 0;
  }

  private cameraPose(mv: ModeView | null): CameraPose {
    const phase = this.phase;
    const ownTurn = phase.name === "branch" || phase.name === "turn" || (phase.name === "black" && this.turnEnd);
    if (mv && !ownTurn) return mv.camera;
    let x = laneX(this.displayLane());
    let z = this.cameraZ + this.drift;
    let yaw = 0;
    let roll = 0;

    if (phase.name === "branch") {
      const t = phase.choosing ? 1 : clamp01(1 - phase.time / BRANCH_APPROACH);
      x = phase.fromX + (0 - phase.fromX) * t;
      z = phase.fromZ + t;
    } else if (phase.name === "turn" || (phase.name === "black" && this.turnEnd)) {
      const turn = phase.name === "turn" ? phase : this.turnEnd!;
      const t = phase.name === "turn" ? phase.time : TURN_TIME;
      const side = turn.dir * 4.5;
      if (t < 2) {
        x = side * (t / 2);
        z = turn.fromZ + 3 * (t / 2);
      } else {
        x = side;
        z = turn.fromZ + 3 + 20 * clamp01((t - 2) / 3);
      }
      if (t < 1.2) yaw = 20 * turn.dir * outQuad(t / 1.2);
      else if (t < 2.4) yaw = 20 * turn.dir * (1 - inQuad((t - 1.2) / 1.2));
    }

    if (this.damaging > 0) {
      const t = 1.2 - this.damaging;
      if (t < 0.3) roll = 3 * outQuad(t / 0.3);
      else if (t < 0.9) roll = 3 - 6 * outQuad((t - 0.3) / 0.6);
      else roll = -3 + 3 * outQuad((t - 0.9) / 0.3);
    }

    return { x, z, yaw, roll };
  }

  private enterSecret(): void {
    this.secretLifts = 0;
    this.loadCruise(40);
    this.emit({ type: "bgm", name: "river" });
    this.emit({ type: "se", name: "hoyiyi" });
    this.phase = { name: "launch", time: 0 };
  }

  private loadCruise(level: number): void {
    const stage = stageByLevel(level) ?? stageByLevel(0)!;
    this.stage = stage;
    this.level = stage.level;
    this.obstacles = buildObstacles(stage.rows);
    this.gate = findGate(stage);
    const type = questionTypeFor(stage.level);
    this.queue = shuffle(questions.filter((question) => question.type === type));
    this.questionIndex = 0;
    this.resetRide();
  }

  private enterMode(level: number): void {
    this.clearMode();
    this.level = level;
    this.resetRide();
    this.obstacles = [];
    this.gate = null;
    this.queue = [];
    this.questionIndex = 0;
    this.checkpoint = null;
    this.mode = this.createMode(level);
    this.phase = { name: "mode" };
    this.modeView = this.mode.view();
  }

  private createMode(level: number): Mode {
    const host = this.host;
    if (level >= 20 && level <= 23) return new Stage3(host, level);
    if (level === 30) return new Octopus(host, false);
    if (level === 31) return new Lobster(host, false);
    if (level === 32) return new Totem(host, false);
    if (level === 33) return new Crocodile(host, false);
    if (level === 34) return new Tortoise(host, false);
    if (level === 42) return new CruiseEx(host);
    if (level === 60) return new CruiseLast(host);
    // 50: SecretBossNumList[0] decides the next rush boss.
    const rush = this.run.secretList[0] ?? 5;
    if (rush === 0) return new Octopus(host, true);
    if (rush === 1) return new Lobster(host, true);
    if (rush === 2) return new Totem(host, true);
    if (rush === 3) return new Crocodile(host, true);
    if (rush === 4) return new Tortoise(host, true);
    return new Statue(host);
  }

  private clearMode(): void {
    this.mode = null;
    this.modeView = null;
  }

  private showResult(file: string): void {
    this.record = buildRecord(this.run, file);
    this.phase = { name: "result", time: 0, file };
    this.emit({ type: "bgm", name: null });
    if (!file.includes("failed")) this.emit({ type: "se", name: "fanfare" });
  }

  private resetRide(): void {
    this.cameraZ = 0;
    this.prevZ = 0;
    this.drift = 0;
    this.quiz = null;
    this.lane = 3;
    this.laneFrom = 3;
    this.laneTo = 3;
    this.laneTime = 0;
    this.moving = false;
    this.damaging = 0;
    this.gauge = 0;
    this.speed = 0.2;
    this.wind = 0;
    this.turnEnd = null;
    this.leftPresses = 0;
    this.rightPresses = 0;
  }

  private startCountdown(): void {
    this.phase = { name: "countdown", time: 0 };
    this.emit({ type: "countdown" });
    this.emit({ type: "se", name: "321pua-" });
  }

  private advanceCountdown(): void {
    if (this.phase.name !== "countdown") return;
    this.phase.time += STEP;
    if (this.phase.time >= COUNTDOWN_GO) {
      this.phase = { name: "cruise" };
      this.leftPresses = 0;
      this.rightPresses = 0;
      this.saveCheckpoint();
    }
  }

  private advanceCruise(): void {
    this.moveMovers();
    this.stepQuiz();
    if (this.phase.name !== "cruise") return;
    if (this.damaging > 0) {
      this.damaging -= STEP;
      const t = clamp01(1 - Math.max(this.damaging, 0) / 1.2);
      this.cameraZ = this.knockFrom + (this.knockTo - this.knockFrom) * outQuad(t);
      if (this.damaging <= 0) {
        this.prevZ = this.cameraZ;
        if (!this.quiz) this.saveCheckpoint();
      }
      return;
    }

    if (this.moving) {
      this.laneTime += STEP;
      if (this.laneTime >= this.laneDuration) {
        this.lane = this.laneTo;
        this.moving = false;
      }
    } else {
      if (this.gauge > 0) this.gauge = Math.max(this.gauge - 0.005, 0);
      else if (this.gauge < 0) this.gauge = Math.min(this.gauge + 0.005, 0);

      const right = this.rightPresses;
      const left = this.leftPresses;
      this.rightPresses = 0;
      this.leftPresses = 0;
      for (let i = 0; i < right; i++) this.pushGauge(1);
      for (let i = 0; i < left; i++) this.pushGauge(-1);

      if (this.wind > 0) this.gauge += this.windDir === 1 ? -0.03 : 0.03;

      if (this.accel) {
        this.accel = false;
        this.speed = Math.min(this.speed + 0.02, 0.4);
        this.run.speedUps += 1;
        if (this.run.speedUps === 20) this.emit({ type: "se", name: "hoyiyi" });
        this.emit({ type: "accelerate" });
        this.emit({ type: "se", name: "wind" });
      }

      if (this.gauge >= 1) this.beginLane(this.lane + 1);
      else if (this.gauge <= -1) this.beginLane(this.lane - 1);
    }

    if (this.quiz) {
      this.drift += this.speed;
      return;
    }
    this.cameraZ += this.speed;
    this.tryHits();
  }

  private advanceBranch(): void {
    if (this.phase.name !== "branch") return;
    if (!this.phase.choosing) {
      this.phase.time -= STEP;
      if (this.phase.time <= 0) {
        this.phase.choosing = true;
        this.gauge = 0;
        this.leftPresses = 0;
        this.rightPresses = 0;
      }
      return;
    }

    if (this.gauge > 0) this.gauge = Math.max(this.gauge - 0.005, 0);
    else if (this.gauge < 0) this.gauge = Math.min(this.gauge + 0.005, 0);
    const right = this.rightPresses;
    const left = this.leftPresses;
    this.rightPresses = 0;
    this.leftPresses = 0;
    this.gauge += 0.2 * right - 0.2 * left;

    if (this.gauge >= 1) this.choose(1);
    else if (this.gauge <= -1) this.choose(-1);
  }

  private startQuiz(enemy: Obstacle): void {
    const question = this.queue[this.questionIndex % this.queue.length];
    this.questionIndex += 1;
    this.quiz = { question, enemyId: enemy.id, time: QUIZ_TIME };
    this.answerEcho = "";
    this.focusToken += 1;
    this.emit({ type: "se", name: "deden" });
  }

  private stepQuiz(): void {
    if (!this.quiz) return;
    this.quiz.time -= STEP;
    if (this.quiz.time <= 0) this.endQuiz(false);
  }

  // Correct: +1 heart. Time over: −1 heart. Either way the course starts approaching again.
  private endQuiz(ok: boolean): void {
    const quiz = this.quiz;
    if (!quiz) return;
    this.quiz = null;
    this.answerEcho = "";
    this.run.totalQuestions += 1;
    this.emit({ type: "answer", ok });
    if (ok) {
      this.lifePoint = Math.min(MAX_HEARTS, this.lifePoint + 1);
      this.emit({ type: "se", name: "piropiropiron" });
      const enemy = this.obstacles.find((item) => item.id === quiz.enemyId);
      if (enemy) this.emit({ type: "nazoGet", x: this.obstacleX(enemy) + QUIZ_BEE_X, z: enemy.z + this.drift });
      this.saveCheckpoint();
      return;
    }
    this.run.allCorrect = false;
    this.emit({ type: "se", name: "bu" });
    if (!this.loseHeart()) return;
    this.gauge = 0;
    this.moving = false;
    this.damaging = 1.2;
    this.knockFrom = this.cameraZ;
    this.knockTo = this.cameraZ;
  }

  // Z of the nearest enemy still ahead (unanswered, or its quiz is open); null when none remain.
  private enemyHorizon(): number | null {
    let horizon: number | null = null;
    for (const obstacle of this.obstacles) {
      if (obstacle.kind !== "enemy") continue;
      if (obstacle.hit && obstacle.id !== this.quiz?.enemyId) continue;
      if (horizon === null || obstacle.z < horizon) horizon = obstacle.z;
    }
    return horizon;
  }

  private choose(dir: -1 | 1): void {
    if (this.phase.name !== "branch") return;
    if (dir > 0) {
      if (this.stage.level === 0) this.run.routeNum += 4;
      else if (this.stage.level === 10 || this.stage.level === 11) this.run.routeNum += 2;
      else if (this.stage.level >= 20 && this.stage.level <= 23) this.run.routeNum += 1;
    }
    this.level = dir < 0 ? this.stage.nextLeft : this.stage.nextRight;
    this.gauge = 0;
    const fromZ = this.phase.fromZ + 1;
    this.turnEnd = { dir, fromZ };
    this.phase = { name: "turn", time: 0, dir, fromZ };
  }

  private resolveBlack(): void {
    this.turnEnd = null;
    if (cruiseLevels.has(this.level)) {
      this.loadCruise(this.level);
      this.emit({ type: "bgm", name: "river" });
      const image = introImages[this.level];
      if (image) this.phase = { name: "intro", time: INTRO_TIME, image };
      else this.startCountdown();
      return;
    }

    if (isModeLevel(this.level)) this.enterMode(this.level);
  }

  private gameOver(): void {
    this.mode = null;
    this.modeView = null;
    this.quiz = null;
    this.phase = { name: "over" };
    this.record = null;
    this.emit({ type: "bgm", name: null });
  }

  private saveCheckpoint(): void {
    this.checkpoint = {
      cameraZ: this.cameraZ,
      lane: this.lane,
      questionIndex: this.questionIndex,
      run: { ...this.run },
      hits: Object.fromEntries(this.obstacles.map((obstacle) => [obstacle.id, obstacle.hit])),
      movers: Object.fromEntries(
        this.obstacles
          .filter((obstacle) => obstacle.kind === "mover")
          .map((obstacle) => [obstacle.id, { localX: obstacle.localX, speed: obstacle.speed }]),
      ),
    };
  }

  private pushGauge(dir: 1 | -1): void {
    if (dir > 0 && this.lane === 5) {
      this.gauge = this.gauge <= -0.2 ? this.gauge + 0.2 : 0;
      return;
    }
    if (dir < 0 && this.lane === 1) {
      this.gauge = this.gauge >= 0.2 ? this.gauge - 0.2 : 0;
      return;
    }
    this.gauge += 0.2 * dir;
  }

  private beginLane(next: number): void {
    if (next < 1 || next > 5 || next === this.lane) {
      this.gauge = 0;
      return;
    }
    this.laneFrom = this.lane;
    this.laneTo = next;
    this.lane = next;
    this.laneTime = 0;
    this.laneDuration = 0.05 / this.speed;
    this.moving = true;
    this.gauge = 0;
  }

  private moveMovers(): void {
    for (const obstacle of this.obstacles) {
      if (obstacle.kind !== "mover" || obstacle.hit) continue;
      obstacle.localX += obstacle.speed;
      if (
        (obstacle.localX < obstacle.left && obstacle.speed < 0) ||
        (obstacle.localX > obstacle.right && obstacle.speed > 0)
      ) {
        obstacle.speed *= -1;
      }
    }
  }

  private tryHits(): void {
    const boat = laneX(this.displayLane());
    for (const obstacle of this.obstacles) {
      if (obstacle.hit) continue;
      const z = obstacle.kind === "enemy" ? obstacle.z - ENEMY_AHEAD : obstacle.z;
      if (!(this.prevZ < z && this.cameraZ >= z)) continue;
      if (obstacle.kind === "choice") {
        obstacle.hit = true;
        this.moving = false;
        this.lane = 3;
        this.phase = { name: "branch", time: BRANCH_APPROACH, choosing: false, fromX: boat, fromZ: this.cameraZ + this.drift };
        this.emit({ type: "se", name: "bird" });
        break;
      }
      if (obstacle.kind === "enemy") {
        obstacle.hit = true;
        this.startQuiz(obstacle);
        break;
      }
      const aligned =
        obstacle.kind === "windL" || obstacle.kind === "windR" || Math.abs(boat - this.obstacleX(obstacle)) < 1.35;
      if (!aligned) continue;
      obstacle.hit = true;
      if (obstacle.kind === "rock" || obstacle.kind === "mover") this.damage();
      else if (obstacle.kind === "windL" || obstacle.kind === "windR") {
        this.wind = 5;
        this.windDir = obstacle.kind === "windL" ? 1 : 2;
        this.emit({ type: "wind", dir: obstacle.kind === "windL" ? -1 : 1, duration: 5 });
        this.emit({ type: "se", name: "byu-" });
      }
    }
    this.prevZ = this.cameraZ;
  }

  // Returns false when the last heart is gone (the run is over).
  private loseHeart(): boolean {
    this.lifePoint = Math.max(0, this.lifePoint - 1);
    this.run.noDamage = false;
    this.emit({ type: "se", name: "bashi" });
    if (this.lifePoint <= 0) {
      this.gameOver();
      return false;
    }
    this.emit({ type: "damage" });
    return true;
  }

  private damage(): void {
    if (this.damaging > 0) return;
    if (!this.loseHeart()) return;
    this.gauge = 0;
    this.speed = 0.2;
    this.damaging = 1.2;
    this.knockFrom = this.cameraZ;
    this.knockTo = Math.max(0, this.cameraZ - LINE);
    this.moving = false;
  }

  private displayLane(): number {
    if (!this.moving) return this.lane;
    const t = Math.min(this.laneTime / this.laneDuration, 1);
    return this.laneFrom + (this.laneTo - this.laneFrom) * t;
  }

  private obstacleX(obstacle: Obstacle): number {
    if (obstacle.kind === "mover") return laneX(obstacle.lane) + obstacle.localX;
    if (obstacle.kind === "windL" || obstacle.kind === "windR" || obstacle.kind === "choice" || obstacle.kind === "enemy") return 0;
    return laneX(obstacle.lane);
  }
}
