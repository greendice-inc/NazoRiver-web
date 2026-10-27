import { charGames, komoji, piranhaGames, shiritoriCells, silhouetteDir, silhouetteGames } from "../data/cruise2";
import { COUNTDOWN_START, countdownNodes, img, outQuad, rect, RES, seg, shuffle, SPR, txt, type SceneNode } from "../scene";
import type { Gate, Prop } from "../types";
import { baseView, laneX, LINE, Mode, shakeRoll, STEP, type Host, type ModeView } from "./mode";
import { Steer } from "./steer";

// Cruise2Script: 20 幻影の急流 (mode 3), 21 繋がりの浅瀬 (4), 22 文字の河原 (1), 23 怪魚の淀み (2).
const modeByLevel: Record<number, 1 | 2 | 3 | 4> = { 20: 3, 21: 4, 22: 1, 23: 2 };
const introByLevel: Record<number, string> = { 20: "kyuryu", 21: "asase", 22: "kawara", 23: "kaigyo" };
const gatesByLevel: Record<number, [string, string]> = {
  20: ["octopus", "lobster"],
  21: ["lobster", "totem"],
  22: ["totem", "crocodile"],
  23: ["crocodile", "tortoise"],
};

const SPEED = 0.08;
const QUESTION_TIME = 20;
const ROTATE_TIME = 3;

type Letter = { id: string; row: number; lane: number; text: string; y: number };
type Board = { id: string; line: number; lane: number; words: string[]; z: number; rock: boolean };

let serial = 0;

export class Stage3 extends Mode {
  readonly level: number;
  readonly mode: 1 | 2 | 3 | 4;
  private phase: "intro" | "countdown" | "play" | "gate" = "intro";
  private time = 0;
  private z = 0;
  private steer = new Steer();
  private damage = -1;
  private knockFrom = 0;
  private knockTo = 0;
  private pitch = -5;
  private queue: number[] = [];
  private qTime = QUESTION_TIME;
  // mode 1
  private letters: Letter[] = [];
  private rowZ = new Map<number, number>();
  private checkZ = -1;
  private current = "";
  // mode 2
  private guards: number[] = [];
  private changes = 0;
  private mode2Move = false;
  private finishTime = -1;
  private panelsOn = false;
  private boatRoll = 0;
  private pendingNext = false;
  // mode 3
  private states = [1, 1, 1, 1];
  private checkTime = 1;
  // mode 4
  private boards: Board[] = [];
  // gate
  private gate: Gate | null = null;
  private gateTime = 0;
  private choiceZ = -1;
  private arrowY = 0;
  private panelVisible = true;
  private prevZ = 0;
  private countdownAt = 0;

  constructor(host: Host, level: number) {
    super(host);
    this.level = level;
    this.mode = modeByLevel[level];
    this.arrowY = this.mode === 1 || this.mode === 4 ? 150 : 0;
    this.bgm(null);
  }

  private get progress(): number {
    return Math.floor(this.z / LINE);
  }

  advance(): void {
    if (this.phase !== "intro") return;
    this.phase = "countdown";
    this.time = 0;
    if (this.mode === 2) this.panelsOn = true;
  }

  pressLeft(): void {
    if (this.canSteer()) this.steer.pressLeft();
  }

  pressRight(): void {
    if (this.canSteer()) this.steer.pressRight();
  }

  tap(index: number): void {
    if (this.phase !== "play") return;
    if (this.mode === 2 && !this.mode2Move && this.queue.length) this.guard(index);
    else if (this.mode === 3 && this.queue.length) this.flip(index);
  }

  debugSolve(): void {
    if (this.phase !== "play") return;
    if (this.mode === 4) {
      const line = this.boards.filter((board) => !board.rock);
      const tail = this.current.slice(-1);
      const last = komoji[tail] ?? tail;
      const pick = line.find((board) => !this.current || board.words.some((word) => word.startsWith(last))) ?? line[0];
      if (pick && this.damage < 0) this.steer.reset(pick.lane);
      return;
    }
    if (!this.queue.length) return;
    if (this.mode === 3) {
      this.states = [...silhouetteGames[this.queue[0] - 1].answer];
      this.checkTime = 0;
    } else if (this.mode === 2) {
      this.guards = [...piranhaGames.find((game) => game.id === this.queue[0])!.attacks];
      this.qTime = 0;
    } else if (this.mode === 1) {
      const game = charGames[this.queue[0] - 1];
      this.current = game.answers[0];
      this.letters = [];
      this.z = Math.max(this.z, this.checkZ - 0.5);
    }
  }

  step(): void {
    this.time += STEP;
    if (this.phase === "intro") return;
    if (this.phase === "countdown") {
      this.stepCountdown();
      return;
    }
    this.stepPlay();
  }

  private stepCountdown(): void {
    const pre = this.mode === 2 ? ROTATE_TIME : 0;
    if (this.mode === 2) this.pitch = -5 + 95 * outQuad(Math.min(1, this.time / ROTATE_TIME));
    const t = this.time - pre;
    if (t >= 0 && t - STEP < 0) this.se("321pua-");
    if (t >= COUNTDOWN_START) {
      this.phase = "play";
      this.countdownAt = this.time - t;
      this.start();
    }
  }

  private start(): void {
    this.prevZ = this.z;
    if (this.mode === 1) {
      this.host.run.third = 3;
      this.queue = [...shuffle([1, 2, 3, 4, 5, 6, 7, 8]).slice(0, 4), 9];
      this.showQuestion();
    } else if (this.mode === 2) {
      const pool = shuffle([1, 2, 3, 5, 6, 8, 9]);
      this.queue = [...pool.slice(0, 4), pool[5] > pool[6] ? 7 : 10];
      this.qTime = QUESTION_TIME;
      this.changes = 0;
    } else if (this.mode === 3) {
      this.queue = [...shuffle([1, 2, 3, 4, 5, 6, 7, 8]).slice(0, 4), 9];
      this.qTime = QUESTION_TIME;
      this.checkTime = 1;
      this.states = [1, 1, 1, 1];
    } else {
      this.host.run.third = 2;
      this.spawnLine(1);
    }
  }

  private canSteer(): boolean {
    return (this.mode === 1 || this.mode === 4) && (this.phase === "play" || this.phase === "gate") && this.damage < 0;
  }

  private stepPlay(): void {
    if (this.damage >= 0) {
      this.damage += STEP;
      if (this.mode === 4) this.z = this.knockFrom + (this.knockTo - this.knockFrom) * outQuad(Math.min(1, this.damage / 1.2));
      if (this.mode === 2) this.boatRoll = shakeRoll(this.damage);
      if (this.damage >= 1.2) {
        this.damage = -1;
        this.boatRoll = 0;
        this.prevZ = this.z;
        if (this.pendingNext) {
          this.pendingNext = false;
          this.nextQuestion();
        }
      }
    }

    const steering = this.canSteer();
    this.steer.step(steering, 0.01 / SPEED);

    const forward = this.damage < 0 && (this.mode !== 2 || this.mode2Move);
    if (forward) this.z += SPEED;

    if (this.mode === 1) this.stepLetters();
    if (this.mode === 2) this.stepGuard();
    if (this.mode === 3) this.stepSilhouette();
    if (this.mode === 4) this.stepBoards();
    if (this.finishTime >= 0) this.stepFinish();
    if (this.gate) this.gateTime += STEP;
    if (this.gate && this.gateTime < 1 && (this.mode === 1 || this.mode === 4)) this.arrowY = 150 * (1 - outQuad(this.gateTime));
    else if (this.gate) this.arrowY = 0;

    if (this.choiceZ >= 0 && this.prevZ < this.choiceZ && this.z >= this.choiceZ) {
      this.choiceZ = -1;
      this.host.branch(this.steer.x(), this.z);
    }
    this.prevZ = this.z;
  }

  // ---- mode 1: 文字の河原 ----
  private showQuestion(): void {
    if (this.mode !== 1) return;
    const game = charGames[this.queue[0] - 1];
    const p = this.progress;
    this.letters = [];
    this.rowZ.clear();
    game.rows.forEach((row, index) => {
      const i = index + 1;
      const z = (p + i + 2) * LINE;
      this.rowZ.set(i, z);
      [...row].forEach((char, lane) => {
        if (char === "-") return;
        this.letters.push({ id: `c${serial++}`, row: i, lane: lane + 1, text: char, y: 1 + 4 * i });
      });
    });
    this.checkZ = (p + game.rows.length + 2) * LINE + 5;
  }

  private stepLetters(): void {
    for (const letter of this.letters) letter.y = Math.max(letter.y - 0.032, 1);
    const x = this.steer.x();
    for (const [row, z] of this.rowZ) {
      if (!(this.prevZ < z && this.z >= z)) continue;
      const hit = this.letters.find((letter) => letter.row === row && Math.abs(laneX(letter.lane) - x) < 1.35);
      if (!hit) continue;
      this.se("syukin");
      this.current += hit.text;
      this.letters = this.letters.filter((letter) => letter.row !== row);
      this.rowZ.delete(row);
    }
    if (this.checkZ >= 0 && this.prevZ < this.checkZ && this.z >= this.checkZ) {
      this.checkZ = -1;
      this.checkWord();
    }
  }

  private checkWord(): void {
    const game = charGames[this.queue[0] - 1];
    if (game.answers.includes(this.current)) {
      this.se("pinpon");
      if (this.current.length <= 2) this.host.run.third = 0;
    } else {
      this.host.run.third = 0;
      this.hurt();
    }
    this.queue.shift();
    this.current = "";
    this.letters = [];
    this.rowZ.clear();
    this.nextQuestion();
  }

  // ---- mode 2: 怪魚の淀み ----
  private guard(num: number): void {
    this.se("syukin");
    if (!this.guards.includes(num)) {
      this.guards.push(num);
      if (this.guards.length >= 3) this.guards.shift();
    }
    this.changes += 1;
    if (this.changes >= 20 && this.host.run.third !== 4) {
      this.se("hoyiyi");
      this.host.run.third = 4;
    }
  }

  private stepGuard(): void {
    if (this.mode2Move || !this.queue.length || this.pendingNext) return;
    this.qTime -= STEP;
    if (this.qTime > 0) return;
    const game = piranhaGames.find((item) => item.id === this.queue[0])!;
    const ok = game.attacks.every((num) => this.guards.includes(num));
    this.queue.shift();
    this.guards = [];
    this.qTime = QUESTION_TIME;
    if (ok) {
      this.se("pinpon");
      this.nextQuestion();
    } else {
      this.pendingNext = true;
      this.hurt();
    }
  }

  private stepFinish(): void {
    this.finishTime += STEP;
    const t = this.finishTime;
    this.pitch = 90 - 95 * outQuad(Math.min(1, t / ROTATE_TIME));
    if (t >= 1) this.mode2Move = true;
    if (t >= ROTATE_TIME) this.finishTime = -1;
  }

  // ---- mode 3: 幻影の急流 ----
  private flip(index: number): void {
    this.se("fon");
    this.states[index - 1] = (this.states[index - 1] % 4) + 1;
    this.checkTime = 1;
  }

  private stepSilhouette(): void {
    if (!this.queue.length || this.pendingNext) return;
    this.qTime -= STEP;
    this.checkTime -= STEP;
    if (this.qTime <= 0) this.checkSilhouette();
    else if (this.checkTime <= 0) {
      this.checkSilhouette();
      this.checkTime = 500;
    }
  }

  private checkSilhouette(): void {
    const id = this.queue[0];
    const game = silhouetteGames[id - 1];
    if (this.states.every((state, i) => state === game.answer[i])) {
      this.qTime = QUESTION_TIME;
      this.se("pinpon");
      this.queue.shift();
      this.nextQuestion();
      return;
    }
    if (id === 9 && this.states.join() === "2,1,1,3" && this.host.run.third !== 1) {
      this.se("hoyiyi");
      this.host.run.third = 1;
    }
    if (this.qTime <= 0) {
      this.qTime = QUESTION_TIME;
      this.queue.shift();
      this.pendingNext = true;
      this.hurt();
    }
  }

  // ---- mode 4: 繋がりの浅瀬 ----
  private spawnLine(line: number): void {
    const z = (this.progress + 3) * LINE;
    for (const cell of shiritoriCells.filter((item) => item.line === line)) {
      const rock = cell.words.length === 0 || cell.words[0] === "";
      this.boards.push({ id: `s${serial++}`, line, lane: cell.lane, words: cell.words, z, rock });
    }
  }

  private stepBoards(): void {
    if (this.damage >= 0) return;
    const x = this.steer.x();
    for (const board of this.boards) {
      if (!(this.prevZ < board.z && this.z >= board.z)) continue;
      if (Math.abs(laneX(board.lane) - x) >= 1.35) continue;
      if (board.rock) {
        this.hurt();
        return;
      }
      this.takeBoard(board);
      return;
    }
  }

  private takeBoard(board: Board): void {
    if (board.line === 1) {
      this.se("pinpon");
      this.current = board.words[0];
    } else {
      const tail = this.current.slice(-1);
      const last = komoji[tail] ?? tail;
      const match = board.words.find((word) => word.startsWith(last));
      if (match) {
        this.se("pinpon");
        this.current = match;
      } else {
        this.hurt();
        this.current = board.words[0];
      }
    }
    this.boards = this.boards.filter((item) => item.line !== board.line);
    if (board.line !== 15) this.spawnLine(board.line + 1);
    else this.showGate();
  }

  // ---- shared ----
  private nextQuestion(): void {
    if (this.mode === 3) {
      this.states = [1, 1, 1, 1];
      this.checkTime = 1;
    }
    if (this.mode === 2) this.changes = 0;
    if (!this.queue.length) {
      if (this.mode === 2) this.finishTime = 0;
      this.showGate();
      return;
    }
    if (this.mode === 1) this.showQuestion();
  }

  private showGate(): void {
    if (this.gate) return;
    const p = this.progress;
    const [left, right] = gatesByLevel[this.level];
    this.gate = {
      x: 0,
      z: (p + 3) * LINE,
      left: `${RES}gate/treegate_${left}.webp`,
      right: `${RES}gate/treegate_${right}.webp`,
      fadeIn: true,
    };
    this.gateTime = 0;
    this.choiceZ = (p + 2) * LINE;
    this.phase = "gate";
    if (this.mode === 1 || this.mode === 4) this.panelVisible = false;
    if ((this.mode === 1 && this.host.run.third === 3) || (this.mode === 4 && this.host.run.third === 2)) this.se("hoyiyi");
  }

  private hurt(): void {
    if (this.damage >= 0) return;
    this.se("bashi");
    this.host.run.noDamage = false;
    this.host.run.allCorrect = false;
    if (!this.host.setLifePoint(this.host.lifePoint() - 1)) {
      this.host.gameOver();
      return;
    }
    this.damage = 0;
    this.steer.gauge = 0;
    if (this.mode === 4) {
      this.host.run.third = 0;
      this.knockFrom = this.z;
      this.knockTo = Math.max(0, this.z - LINE);
    }
  }

  view(): ModeView {
    const roll = this.mode !== 2 && this.damage >= 0 ? shakeRoll(this.damage) : 0;
    const v = baseView({ x: this.steer.x(), z: this.z, yaw: 0, roll, pitch: this.pitch });
    if (this.mode === 2 && this.damage >= 0) v.hudRoll = shakeRoll(this.damage);
    v.props = this.props();
    v.gate = this.gate;
    v.scene = this.scene();
    v.waitTap = this.phase === "intro";
    v.boat = this.mode === 2 ? { roll: this.boatRoll } : null;
    const steerable = this.mode === 1 || this.mode === 4;
    v.arrows = steerable && this.phase !== "intro";
    v.arrowY = this.arrowY;
    const arrow = this.steer.arrowGauge();
    v.gauge = arrow.gauge;
    v.gaugeFull = arrow.full;
    const lane = this.steer.displayLane();
    v.showLeftArrow = lane > 1.2;
    v.showRightArrow = lane < 4.8;
    v.steering = this.canSteer();
    return v;
  }

  private props(): Prop[] {
    const list: Prop[] = [];
    for (const letter of this.letters) {
      const z = this.rowZ.get(letter.row);
      if (z === undefined) continue;
      list.push({ id: letter.id, kind: "char", x: laneX(letter.lane), y: letter.y, z, text: letter.text });
    }
    for (const board of this.boards) {
      if (board.rock) list.push({ id: board.id, kind: "rock", x: laneX(board.lane), y: 1, z: board.z });
      else list.push({ id: board.id, kind: "image", x: laneX(board.lane), y: 1, z: board.z, src: `${RES}shiritori/1-${board.line}-${board.lane}.webp`, scale: 0.7 });
    }
    return list;
  }

  private scene(): SceneNode[] {
    const nodes: SceneNode[] = [];
    if (this.phase === "intro") {
      nodes.push(img("intro", `${RES}inst/${introByLevel[this.level]}.webp`, 0, -100, 960.8, 784.8, { over: true }));
      return nodes;
    }
    if (this.phase === "countdown") {
      const pre = this.mode === 2 ? ROTATE_TIME : 0;
      nodes.push(...countdownNodes(this.time - pre));
    } else if (this.time - this.countdownAt < 3) {
      nodes.push(...countdownNodes(this.time - this.countdownAt));
    }
    const playing = this.phase !== "countdown";
    const id = this.queue[0];
    if (this.mode === 1 && this.panelVisible) {
      if (playing && id) {
        nodes.push(img("m1-q", `${RES}question_dochu/Qtext_A${id}.webp`, 550, 435, 800, 201));
        nodes.push(img("m1-x", `${SPR}ui/Xmonseikai.webp`, 50, 435, 300.25, 100.25));
      }
      nodes.push(rect("m1-panel", 0, -450, 1200, 150, "rgba(0,0,0,0.25)"));
      nodes.push(txt("m1-text", this.current, 0, -450, 1200, 150, 100));
    }
    if (this.mode === 4 && this.panelVisible) {
      nodes.push(rect("m4-panel", 0, -450, 1200, 150, "rgba(0,0,0,0.25)"));
      nodes.push(txt("m4-text", this.current, 0, -450, 1200, 150, 100));
    }
    if (this.mode === 2 && this.panelsOn) {
      const alpha = this.finishTime >= 0 ? 1 - seg(this.finishTime, 0, 0.5) : this.mode2Move ? 0 : 1;
      const game = id ? piranhaGames.find((item) => item.id === id) : null;
      if (alpha > 0) {
        const spots: [number, number, number][] = [
          [-600, 100, 400],
          [-600, -300, 400],
          [600, 100, -400],
          [600, -300, -400],
        ];
        spots.forEach(([x, y, guardX], i) => {
          nodes.push(rect(`m2-p${i}`, x, y, 650, 200, "rgba(0,0,0,0.25)", { alpha, tap: i + 1 }));
          nodes.push(txt(`m2-t${i}`, game?.labels[i] ?? "", x, y, 650, 200, 150, { alpha }));
          if (this.guards.includes(i + 1)) nodes.push(img(`m2-g${i}`, `${RES}wani/mushiba_safe.webp`, x + guardX, y, 300, 200, { alpha }));
        });
      }
      if (playing && id && !this.mode2Move && this.finishTime < 0) {
        nodes.push(txt("m2-time", String(Math.ceil(Math.max(this.qTime, 0))), 0, 450, 250, 100, 100, { font: "wanpaku" }));
        nodes.push(img("m2-q", `${RES}question_dochu/Qtext_B${id}.webp`, 550, 435, 800, 201));
      }
    }
    if (this.mode === 3 && playing && id) {
      const game = silhouetteGames[id - 1];
      nodes.push(txt("m3-time", String(Math.ceil(Math.max(this.qTime, 0))), 0, 450, 250, 100, 100, { font: "wanpaku" }));
      nodes.push(img("m3-q", `${RES}question_dochu/Qtext_C${id}.webp`, 550, 435, 800, 201));
      nodes.push(img("m3-back", `${SPR}ui/genei_waku.webp`, 0, -100, 901, 901));
      const spots: [number, number][] = [
        [-200, 100],
        [-200, -300],
        [200, 100],
        [200, -300],
      ];
      spots.forEach(([x, y], i) => {
        nodes.push(img(`m3-p${i}`, `${RES}silhouette/${game.file}-${this.states[i]}-${silhouetteDir[i]}.webp`, x, y, 400, 400, { tap: i + 1 }));
      });
    }
    return nodes;
  }
}
