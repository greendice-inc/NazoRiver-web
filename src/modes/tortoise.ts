import { questionsIn, type BossQuestion } from "../data/bossQuestions";
import { img, lerp, normalizeKana, outQuad, shuffle, SPR, type SceneNode } from "../scene";
import { Boss, qimg } from "./boss";
import type { Host } from "./mode";

// Boss3Script / Boss3ExScript.
const MAX_TIME = 60;

type Bubble = { id: number; x: number; y: number };

export class Tortoise extends Boss {
  readonly kind = "tortoise";
  private pool: BossQuestion[];
  private form = 1;
  private rest: number;
  private time = MAX_TIME;
  private current: BossQuestion | null = null;
  private bubbles: Bubble[] = [];
  private nextBubble = 0;
  private shownAt = -1;
  private oars = [false, false, false, false];
  private oarTurn = [0, 0];

  constructor(host: Host, ex: boolean) {
    super(host, ex);
    this.pool = shuffle(questionsIn("カメ"));
    this.rest = ex ? 4 : 8;
    this.bgm("kame");
  }

  protected answering(): boolean {
    return this.current !== null;
  }

  protected onStart(): void {
    this.showQuestion();
  }

  protected update(): void {
    if (!this.playing || !this.current) return;
    this.time -= 1 / 30;
    if (this.time <= 0) this.damaged();
  }

  private damaged(): void {
    const damage = this.ex ? 1 : [1, 2, 3, 5][this.form - 1];
    this.hurt(damage, () => this.setRest(this.rest - 1));
  }

  // Q/W (left-side strokes) are oars 0/1, O/P (right-side strokes) are oars 2/3.
  pressRight(): void {
    this.oarTurn[0] ^= 1;
    this.hitBubble(this.oarTurn[0]);
  }

  pressLeft(): void {
    this.oarTurn[1] ^= 1;
    this.hitBubble(2 + this.oarTurn[1]);
  }

  // Tapping a bubble pops it directly (normal tortoise only).
  tap(index: number): void {
    if (this.ex || !this.playing) return;
    const at = this.bubbles.findIndex((bubble) => bubble.id === index);
    if (at < 0) return;
    this.se("powa");
    this.bubbles.splice(at, 1);
  }

  // Center stroke: SetStaffScript.WashBubble.
  rowBoth(): void {
    if (this.ex || !this.playing || !this.current) return;
    this.se("basha");
    if (this.host.run.bossSecretFlag !== 5) {
      this.se("hoyiyi");
      this.host.run.bossSecretFlag = 5;
    }
  }

  private hitBubble(oar: number): void {
    if (!this.playing || !this.current) return;
    if (this.ex && this.oars[oar]) {
      this.se("powa");
      this.bubbles.push(this.newBubble());
      return;
    }
    if (this.bubbles.length > 0) {
      this.se("powa");
      this.bubbles.pop();
    }
  }

  private newBubble(): Bubble {
    return { id: 1000 + this.nextBubble++, x: lerp(-350, 350, Math.random()), y: lerp(-250, 250, Math.random()) };
  }

  answer(raw: string): "clear" | "keep" {
    if (!this.playing || !this.current) return "keep";
    const answer = normalizeKana(raw);
    if (answer !== "" && this.current.answers.some((item) => item !== "" && normalizeKana(item) === answer)) {
      this.se("piropiropiron");
      this.setRest(this.rest - 1);
    } else {
      this.se("bu");
    }
    return "clear";
  }

  debugSolve(): void {
    if (this.current) this.answer(this.current.answers[0]);
  }

  private setRest(value: number): void {
    this.rest = value;
    this.time = MAX_TIME;
    if (this.ex) {
      if (value === 0) {
        this.current = null;
        this.exWin();
      } else this.showQuestion();
      return;
    }
    if (value === 0) {
      this.current = null;
      this.host.run.bossFlag = 5;
      this.clear("clear_tortoise");
      return;
    }
    const forms: Record<number, number> = { 6: 2, 4: 3, 1: 4 };
    if (forms[value]) {
      this.form = forms[value];
      this.current = null;
      this.angry(this.form - 1, () => this.showQuestion());
      return;
    }
    this.showQuestion();
  }

  private take(type: string): BossQuestion {
    const index = this.pool.findIndex((q) => q.type === type);
    return index < 0 ? questionsIn("カメ", type)[0] : this.pool.splice(index, 1)[0];
  }

  private showQuestion(): void {
    this.se("bukubuku");
    let count = 30;
    if (this.ex) {
      this.current = this.take("カメ_lv3_5・6文字");
      count = 50;
      do this.oars = this.oars.map(() => Math.random() < 0.5);
      while (this.oars.filter(Boolean).length < 2);
    } else if (this.rest >= 7) {
      this.current = this.take("カメ_lv1_4・5文字");
    } else if (this.rest >= 5) {
      this.current = this.take("カメ_lv2_4・5文字");
    } else if (this.rest >= 2) {
      this.current = this.take("カメ_lv3_5・6文字");
      count = 50;
    } else {
      this.current = this.take("カメ_最終問題");
      count = 100;
    }
    this.bubbles = Array.from({ length: count }, (_, i) => ({ id: i + 1, x: lerp(-350, 350, Math.random()), y: lerp(-250, 250, Math.random()) }));
    this.shownAt = this.clock;
    this.host.focusAnswer();
  }

  protected nodes(): SceneNode[] {
    const live = this.current !== null && (this.stage === "play" || this.stage === "fail" || this.stage === "end");
    const nodes: SceneNode[] = [img("kame", this.ex ? `${SPR}kame/カメ改_本体基本ポーズ.png` : `${SPR}kame/カメ_本体基本ポーズ.png`, -400, -100, 840, 648)];
    nodes.push(...this.restNodes(`${SPR}kame/atoXmon_tortoise.png`, this.rest, 600, 440, 601, 151, 605, 90));
    let scale = 0.8;
    let cx = 300;
    let cy = 0;
    if (live) {
      const k = Math.min((this.clock - this.shownAt) / MAX_TIME, 1);
      scale = lerp(0.8, 1.3, outQuad(k));
      cx = lerp(300, 0, k);
      cy = lerp(0, 100, k);
    }
    const at = (x: number, y: number): [number, number] => [cx + x * scale, cy + y * scale];
    const [bx, by] = at(0, -150);
    nodes.push(img("q-back", `${SPR}kame/nazo_back_tortoise.png`, bx, by, 900 * scale, 700 * scale));
    if (live && this.current) {
      nodes.push(img("q-image", qimg(this.current.file), bx, by, 800 * scale, 600 * scale));
      for (const bubble of this.bubbles) {
        const [x, y] = at(bubble.x, bubble.y - 150);
        nodes.push(img(`bubble${bubble.id}`, `${SPR}kame/bubble.png`, x, y, 250 * scale, 250 * scale, { tap: this.ex ? undefined : bubble.id }));
      }
      if (this.stage === "play") {
        const [tx, ty] = at(0, 250);
        const time = this.timeNode(this.time, tx, ty, 100 * scale);
        nodes.push(time);
      }
    }
    return nodes;
  }
}
