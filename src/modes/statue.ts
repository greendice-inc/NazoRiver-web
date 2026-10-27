import { questionsIn, type BossQuestion } from "../data/bossQuestions";
import { gaugeTint, img, lerp, normalizeKana, popup, rect, RES, seg, shuffle, SPR, txt, type SceneNode } from "../scene";
import type { CameraPose } from "../types";
import { Boss, qimg } from "./boss";
import type { Host } from "./mode";

// Boss6ExScript (神の石像).
const maxTimeList = [60, 50, 40, 30, 20, 10];
const slotPos: [number, number][] = [
  [-300, 100],
  [300, 100],
  [-750, -100],
  [750, -100],
  [-300, -300],
  [300, -300],
];

type Slot = { q: BossQuestion; time: number; answered: boolean };
type StoneColor = "" | "blue" | "green" | "yellow" | "red";

const reactions: Record<Exclude<StoneColor, "">, { file: string; w: number; h: number; se: string | null }> = {
  blue: { file: "txt_iwahikatta", w: 1001, h: 200, se: "fa-" },
  green: { file: "txt_iwakuzureta", w: 1001, h: 201, se: "garagara" },
  yellow: { file: "txt_iwanatta", w: 1001, h: 200, se: "kirin" },
  red: { file: "txt_iwanashi", w: 1501, h: 201, se: null },
};

export class Statue extends Boss {
  readonly kind = "statue";
  private pool: BossQuestion[];
  private form = 1;
  private slots: Slot[] = [];
  private waveAt = 0;
  private color: StoneColor = "";
  private colorUntil = -1;
  private kickAt = -10;
  private kickColor: StoneColor = "";
  private hitting = false;
  private collapsing = false;

  constructor(host: Host) {
    super(host, true);
    this.pool = shuffle(questionsIn("道中"));
    this.bgm("uraboss");
  }

  private get maxTime(): number {
    return maxTimeList[Math.min(this.form, maxTimeList.length) - 1];
  }

  protected answering(): boolean {
    return this.slots.length > 0 && !this.collapsing;
  }

  protected onStart(): void {
    this.newWave();
  }

  private newWave(): void {
    const slots: Slot[] = [];
    for (let i = 0; i < 6; i++) {
      for (let guard = 0; guard < this.pool.length && slots.some((s) => s.q.answers.includes(this.pool[0].answers[0])); guard++) {
        this.pool.push(this.pool.shift()!);
      }
      const q = this.pool.shift() ?? questionsIn("道中")[i];
      slots.push({ q, time: this.maxTime, answered: false });
    }
    this.slots = slots;
    this.waveAt = this.clock;
    this.host.focusAnswer();
  }

  protected update(): void {
    this.stepKick();
    if (!this.playing || this.collapsing) return;
    let expired = false;
    for (const slot of this.slots) {
      if (slot.answered) continue;
      slot.time -= 1 / 30;
      if (slot.time <= 0) expired = true;
    }
    if (expired) {
      const unanswered = this.slots.filter((slot) => !slot.answered).length;
      for (const slot of this.slots) if (!slot.answered && slot.time <= 0) slot.answered = true;
      this.hurt(unanswered, () => this.checkWave());
    }
    if (this.color && !this.hitting && this.clock >= this.colorUntil) this.color = "";
  }

  answer(raw: string): "clear" | "keep" {
    if (!this.playing || this.collapsing || this.slots.length === 0) return "keep";
    const answer = normalizeKana(raw);
    let index = -1;
    this.slots.forEach((slot, i) => {
      if (answer !== "" && !slot.answered && slot.q.answers.some((item) => item !== "" && normalizeKana(item) === answer)) index = i;
    });
    if (index < 0) {
      this.se("bu");
      return "clear";
    }
    this.se("piropiropiron");
    const slot = this.slots[index];
    slot.answered = true;
    const rate = slot.time / this.maxTime;
    this.color = rate > 0.75 ? "blue" : rate > 0.5 ? "green" : rate > 0.25 ? "yellow" : "red";
    this.colorUntil = this.clock + 3;
    this.checkWave();
    return "clear";
  }

  private checkWave(): void {
    if (this.collapsing || !this.slots.every((slot) => slot.answered)) return;
    this.form += 1;
    this.slots = [];
    this.angry(this.form - 1, () => this.newWave());
  }

  // Q+W+O+P chord (center stroke) or tapping the statue: kick the stone.
  rowBoth(): void {
    this.kick();
  }

  tap(index: number): void {
    if (index === 99) this.kick();
  }

  debugSolve(): void {
    const slot = this.slots.find((item) => !item.answered);
    if (!slot) return;
    slot.time = this.maxTime * 0.6;
    this.answer(slot.q.answers[0]);
    this.kick();
  }

  private kick(): void {
    if (!this.playing || this.hitting || this.collapsing) return;
    this.hitting = true;
    this.kickAt = this.clock;
    this.kickColor = this.color;
    if (this.color === "green") {
      this.collapsing = true;
    }
  }

  private stepKick(): void {
    if (!this.hitting) return;
    const t = this.clock - this.kickAt;
    const tick = (at: number) => t >= at && t - 1 / 30 < at;
    if (tick(0.5)) this.se("kick");
    const color = this.kickColor;
    if (color === "") {
      if (t >= 1) this.hitting = false;
      return;
    }
    if (color === "green") {
      if (tick(1)) {
        this.slots = [];
        this.bgm(null);
      }
      if (tick(3)) this.se("garagara");
      if (t >= 7.25) {
        this.hitting = false;
        this.host.run.bossFlag = 6;
        this.host.run.secretList.shift();
        this.host.next(60);
      }
      return;
    }
    const reaction = reactions[color];
    if (tick(1) && reaction.se) this.se(reaction.se);
    if (t >= 3.5) this.hitting = false;
  }

  private zoom(): number {
    if (!this.hitting && this.clock - this.kickAt > 1) return 0;
    const t = this.clock - this.kickAt;
    if (t < 0.5) return t / 0.5;
    if (t < 1) return 1 - (t - 0.5) / 0.5;
    return 0;
  }

  protected camera(): CameraPose {
    return { x: 0, z: 4 * this.zoom(), yaw: 0, roll: 0, pitch: -5 };
  }

  protected nodes(): SceneNode[] {
    const s = 1 + this.zoom();
    const at = (key: string, src: string, x: number, y: number, w: number, h: number, extra: Partial<SceneNode> = {}) => img(key, src, x * s, y * s, w * s, h * s, extra);
    const nodes: SceneNode[] = [];
    const t = this.clock - this.kickAt;
    const fall = this.collapsing ? seg(t, 3, 4) : 0;
    const bodyY = lerp(-100, -400, fall);
    nodes.push(at("sekizou", `${SPR}lastBoss/神像_分割素材_本体.png`, 0, bodyY, 1251, 701, { alpha: 1 - fall, tap: 99 }));
    const stoneY = bodyY - 80;
    if (!this.collapsing) {
      nodes.push(at("stone", `${RES}lastBoss/神像_分割素材_鉱石.png`, 0, stoneY, 240, 240, { tap: 99 }));
      if (this.color) nodes.push(at("color-stone", `${RES}lastBoss/stone_${this.color}.png`, 0, stoneY, 120, 160, { tap: 99 }));
    } else {
      nodes.push(at("collapse-stone", `${RES}lastBoss/stone_green.png`, 0, stoneY, 120, 160, { alpha: 1 - fall }));
    }
    const live = this.stage === "play" || this.stage === "fail" || this.stage === "end";
    if (live) {
      const grow = lerp(0.5, 0.6, seg(this.clock, this.waveAt, this.maxTime));
      this.slots.forEach((slot, i) => {
        if (slot.answered) return;
        const [x, y] = slotPos[i];
        const k = grow;
        const rate = Math.max(slot.time, 0) / this.maxTime;
        nodes.push(at(`slot${i}-back`, `${SPR}ui/nazo_back_normal.png`, x, y, 720 * k, 560 * k));
        nodes.push(at(`slot${i}-image`, qimg(slot.q.file), x, y, 640 * k, 480 * k));
        nodes.push(rect(`slot${i}-gauge-back`, x * s, (y + 300 * k) * s, 160 * k * s, 160 * k * s, "rgb(94,94,94)", { round: true }));
        nodes.push(rect(`slot${i}-gauge`, x * s, (y + 300 * k) * s, 160 * k * s, 160 * k * s, gaugeTint(rate), { round: true, fill: rate, fillFrom: "radial" }));
        nodes.push(txt(`slot${i}-time`, String(Math.max(Math.ceil(slot.time), 0)), x * s, (y + 300 * k) * s, 250 * k * s, 100 * k * s, 80 * k * s, { font: "wanpaku", color: "#000" }));
      });
    }
    if (this.hitting && this.kickColor) {
      const reaction = reactions[this.kickColor];
      const pop = this.kickColor === "green" ? (t >= 3 ? popup(t - 3, 3.75) : null) : popup(t - 1, 2);
      if (pop) nodes.push(img("reaction", `${SPR}lastBoss/${reaction.file}.png`, 0, 150, reaction.w, reaction.h, { alpha: pop.alpha, scale: pop.scale }));
    }
    return nodes;
  }
}
