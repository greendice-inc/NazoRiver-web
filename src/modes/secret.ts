import { COUNTDOWN_START, countdownNodes, img, outQuad, popup, RES, seg, SPR, type SceneNode } from "../scene";
import type { Prop } from "../types";
import { baseView, laneX, LINE, Mode, STEP, type Host, type ModeView } from "./mode";
import { Steer } from "./steer";

type GemColor = "blue" | "green" | "yellow" | "red";
type Gem = { id: string; kind: "gemrock" | "pillar"; color: GemColor; x: number; y: number; z: number; alpha: number; bright: boolean };
type Hop = { from: number; to: number; at: number; dur: number };

const reactions: Record<GemColor, { file: string; w: number; h: number; se: string | null }> = {
  blue: { file: "txt_iwahikatta", w: 1001, h: 200, se: "fa-" },
  green: { file: "txt_iwakuzureta", w: 1001, h: 201, se: "garagara" },
  yellow: { file: "txt_iwanatta", w: 1001, h: 200, se: "kirin" },
  red: { file: "txt_iwanashi", w: 1501, h: 201, se: null },
};

const waves: { kind: "gemrock" | "pillar"; colors: GemColor[]; hop: number; dur: number }[] = [
  { kind: "gemrock", colors: ["blue", "green", "yellow", "red", "blue"], hop: 25, dur: 5 },
  { kind: "gemrock", colors: ["blue", "red", "yellow", "blue", "green"], hop: 10, dur: 2 },
  { kind: "pillar", colors: ["yellow", "red", "green", "red", "blue"], hop: 10, dur: 2 },
];

// CruiseExScript: the gem river between 裏の川 and the boss rush.
export class CruiseEx extends Mode {
  private phase: "intro" | "countdown" | "play" = "intro";
  private time = 0;
  private z = 0;
  private steer = new Steer();
  private wave = 0;
  private gems: Gem[] = [];
  private hop: Hop | null = null;
  private kickAt = -10;
  private kickGem: Gem | null = null;
  private exitAt = -1;
  private nextGem = 0;
  private countdownAt = 0;

  constructor(host: Host) {
    super(host);
    this.bgm("urariver");
  }

  advance(): void {
    if (this.phase !== "intro") return;
    this.phase = "countdown";
    this.time = 0;
  }

  private get animating(): boolean {
    return this.hop !== null;
  }

  private get hitting(): boolean {
    return this.kickGem !== null || this.time - this.kickAt < 1;
  }

  pressLeft(): void {
    if (this.phase === "play" && !this.animating) this.steer.pressLeft();
  }

  pressRight(): void {
    if (this.phase === "play" && !this.animating) this.steer.pressRight();
  }

  // Q+W+O+P chord: kick the lane in front of the boat.
  rowBoth(): void {
    if (this.phase !== "play" || this.animating || this.hitting || this.steer.moving) return;
    const gem = this.gems.find((item) => item.alpha > 0 && this.laneOf(item) === this.steer.lane);
    if (!gem) {
      this.showWave(this.wave + 1);
      return;
    }
    this.kickAt = this.time;
    this.kickGem = gem;
  }

  debugSolve(): void {
    if (this.phase !== "play" || this.animating) return;
    this.gems = [];
    this.kickGem = null;
    this.kickAt = -10;
    this.showWave(this.wave + 1);
  }

  private laneOf(gem: Gem): number {
    if (this.wave !== 2) return Math.round((gem.x + 9) / 3);
    for (let lane = 1; lane <= 5; lane++) {
      const local = gem.x - laneX(lane);
      if (local > 0 && local <= 3) return lane;
    }
    return 0;
  }

  step(): void {
    this.time += STEP;
    if (this.phase === "intro") return;
    if (this.phase === "countdown") {
      if (this.time >= STEP && this.time - STEP < STEP) this.se("321pua-");
      if (this.time >= COUNTDOWN_START) {
        this.phase = "play";
        this.countdownAt = this.time;
        this.showWave(1);
      }
      return;
    }
    if (this.hop) {
      const k = outQuad(seg(this.time, this.hop.at, this.hop.dur));
      this.z = this.hop.from + (this.hop.to - this.hop.from) * k;
      if (k >= 1) this.hop = null;
    }
    if (this.exitAt >= 0 && this.time >= this.exitAt) {
      this.exitAt = -1;
      this.host.run.secretList = [2];
      this.host.next(50);
    }
    this.steer.step(!this.animating, 0.5);
    if (this.wave === 2 && !this.kickGem) this.moveGems();
    this.stepKick();
  }

  private showWave(num: number): void {
    this.wave = num;
    this.gems = [];
    const wave = waves[num - 1];
    if (!wave) {
      this.hop = { from: this.z, to: this.z + 25, at: this.time, dur: 5 };
      this.exitAt = this.time + 3;
      return;
    }
    const target = this.z + wave.hop + LINE;
    wave.colors.forEach((color, i) => {
      const lane = i + 1;
      this.gems.push({ id: `gem${this.nextGem++}`, kind: wave.kind, color, x: laneX(lane), y: 0.5, z: target, alpha: 1, bright: false });
    });
    this.hop = { from: this.z, to: this.z + wave.hop, at: this.time, dur: wave.dur };
  }

  // Wave 2 conveyor: gems drift left, sink at lane 1 and resurface past lane 5.
  private moveGems(): void {
    for (const gem of this.gems) {
      gem.x -= 0.1;
      const lane = this.laneOf(gem);
      if (gem.x - laneX(1) < 0.5 && gem.x > laneX(1) - 0.2) gem.y -= 0.2;
      else if (lane === 5 && gem.x - laneX(5) > 2.5) gem.y = Math.min(gem.y + 0.2, 0.5);
      else gem.y = 0.5;
      if (gem.x <= laneX(1)) gem.x += 15;
    }
  }

  private stepKick(): void {
    const gem = this.kickGem;
    if (!gem) return;
    const t = this.time - this.kickAt;
    const tick = (at: number) => t >= at && t - STEP < at;
    if (tick(0.5)) this.se("kick");
    if (tick(1)) {
      const se = reactions[gem.color].se;
      if (se) this.se(se);
      if (gem.color === "blue") gem.bright = true;
    }
    if (gem.color === "green" && t >= 1) {
      const k = seg(t, 1, 2);
      gem.alpha = 1 - k;
      gem.y = 0.5 - 2 * k;
      if (k >= 1) this.gems = this.gems.filter((item) => item !== gem);
    }
    if (t >= 3.5) {
      gem.bright = false;
      this.kickGem = null;
    }
  }

  private zoom(): number {
    const t = this.time - this.kickAt;
    if (t < 0 || t >= 1) return 0;
    return t < 0.5 ? t / 0.5 : 1 - (t - 0.5) / 0.5;
  }

  view(): ModeView {
    const v = baseView({ x: this.steer.x(), z: this.z + 4 * this.zoom(), yaw: 0, roll: 0, pitch: -5 });
    v.decor = "pillars";
    v.waitTap = this.phase === "intro";
    v.props = this.gems.map(
      (gem): Prop => ({
        id: gem.id,
        kind: "image",
        x: gem.x,
        y: gem.y,
        z: gem.z,
        src: `${RES}lastBoss/cruise/${gem.kind}_${gem.color}${gem.bright ? "_bright" : ""}.webp`,
        scale: 0.2,
        opacity: gem.alpha,
      }),
    );
    v.arrows = this.phase === "play" && !this.animating;
    const arrow = this.steer.arrowGauge();
    v.gauge = arrow.gauge;
    v.gaugeFull = arrow.full;
    const lane = this.steer.displayLane();
    v.showLeftArrow = lane > 1.2;
    v.showRightArrow = lane < 4.8;
    v.steering = this.phase === "play" && !this.animating;
    v.scene = this.scene();
    return v;
  }

  private scene(): SceneNode[] {
    const nodes: SceneNode[] = [];
    if (this.phase === "countdown") nodes.push(...countdownNodes(this.time));
    else if (this.phase === "play" && this.time - this.countdownAt < 0.75) nodes.push(...countdownNodes(this.time - this.countdownAt + COUNTDOWN_START));
    const gem = this.kickGem;
    if (gem) {
      const pop = popup(this.time - this.kickAt - 1, 2);
      const reaction = reactions[gem.color];
      if (pop) nodes.push(img("reaction", `${SPR}lastBoss/${reaction.file}.webp`, 0, 150, reaction.w, reaction.h, { alpha: pop.alpha, scale: pop.scale }));
    }
    return nodes;
  }
}

// CruiseLastScript: the escape run. Speed only, cleared past line 50.
export class CruiseLast extends Mode {
  private phase: "intro" | "countdown" | "play" | "end" = "intro";
  private time = 0;
  private z = 0;
  private speed = 0.2;
  private countdownAt = 0;

  constructor(host: Host) {
    super(host);
    this.bgm("uraquestion");
  }

  advance(): void {
    if (this.phase !== "intro") return;
    this.phase = "countdown";
    this.time = 0;
  }

  rowBoth(): void {
    if (this.phase !== "play") return;
    this.speed = Math.min(this.speed + 0.02, 5);
    this.host.run.speedUps += 1;
    if (this.host.run.speedUps === 20) this.se("hoyiyi");
    this.host.emit({ type: "accelerate" });
    this.se("wind");
  }

  debugSolve(): void {
    if (this.phase === "play") this.z = LINE * 51;
  }

  step(): void {
    this.time += STEP;
    if (this.phase === "intro" || this.phase === "end") return;
    if (this.phase === "countdown") {
      if (this.time >= STEP && this.time - STEP < STEP) this.se("321pua-");
      if (this.time >= COUNTDOWN_START) {
        this.phase = "play";
        this.countdownAt = this.time;
      }
      return;
    }
    this.z += this.speed;
    if (Math.floor(this.z / LINE) > 50) {
      this.phase = "end";
      this.host.result("clear_all");
    }
  }

  view(): ModeView {
    const v = baseView({ x: laneX(3), z: this.z, yaw: 0, roll: 0, pitch: -5 });
    v.decor = "pillars";
    v.waitTap = this.phase === "intro";
    const nodes: SceneNode[] = [];
    if (this.phase === "countdown") nodes.push(...countdownNodes(this.time));
    else if (this.phase === "play" && this.time - this.countdownAt < 0.75) nodes.push(...countdownNodes(this.time - this.countdownAt + COUNTDOWN_START));
    v.scene = nodes;
    return v;
  }
}
