import { questionsIn, type BossQuestion } from "../data/bossQuestions";
import { img, lerp, RES, seg, shuffle, SPR, type SceneNode } from "../scene";
import type { CameraPose } from "../types";
import { Boss, qimg } from "./boss";
import type { Host, ModeView } from "./mode";

// Boss1Script / Boss1ExScript.
const insectFile: Record<string, string> = {
  あぶ: "abu",
  あり: "ari",
  ちょう: "chou",
  が: "ga",
  はち: "hachi",
  ほたる: "hotaru-ka",
  か: "ka",
  とんぼ: "tonbo",
  のみ: "nomi",
  くも: "kumo",
  せみ: "semi",
  やご: "yago",
  かいこ: "kaiko-ka",
};

type Fang = { q: BossQuestion | null; done: boolean; result: string | null };

// Camera X / Images X slide: `from` → `to` lane positions over `dur` seconds (linear).
type Slide = { from: number; to: number; at: number; dur: number };

// Throat transitions use the shared BlackOut canvas.
type Throat = { at: number; enter: boolean; target: number };

export class Crocodile extends Boss {
  readonly kind = "crocodile";
  private pool: BossQuestion[];
  private form = 1;
  private rest = 3;
  private time: number;
  private lane = 4;
  private gauge = 0;
  private fangs: Fang[] = [];
  private shown = false;
  private slide: Slide | null = null;
  private pos = 4;
  private throat: Throat | null = null;
  private inThroat = false;

  constructor(host: Host, ex: boolean) {
    super(host, ex);
    this.pool = shuffle(questionsIn("ワニ"));
    this.time = ex ? 90 : 180;
    this.bgm("wani");
  }

  private get lanes(): number {
    return this.ex ? 7 : 8;
  }

  private get moving(): boolean {
    return this.slide !== null || this.throat !== null;
  }

  protected onStart(): void {
    this.showQuestion(1);
  }

  private take(type: string): BossQuestion {
    const index = this.pool.findIndex((q) => q.type === type);
    return index < 0 ? questionsIn("ワニ", type)[0] : this.pool.splice(index, 1)[0];
  }

  private showQuestion(form: number): void {
    if (this.ex) {
      const list = shuffle([...[0, 1, 2].map(() => this.take("ワニ_セーフの歯")), ...[0, 1, 2].map(() => this.take("ワニ_ふつう虫")), this.take("ワニ_蚊、蛾")]);
      this.fangs = list.map((q) => ({ q, done: false, result: null }));
    } else if (form === 1) {
      const list = shuffle([
        ...[0, 1, 2].map(() => this.take("ワニ_セーフの歯")),
        ...[0, 1, 2].map(() => this.take("ワニ_ふつう虫")),
        this.take("ワニ_露骨"),
        this.take("ワニ_蚊、蛾"),
      ]);
      this.fangs = list.map((q) => ({ q, done: false, result: null }));
    } else {
      const list = [this.take("ワニ_セーフの歯"), ...[0, 1, 2, 3].map(() => this.take("ワニ_ふつう虫")), this.take("ワニ_蚊、蛾")];
      this.fangs = [{ q: null, done: true, result: null }, ...list.map((q) => ({ q, done: false, result: null })), { q: null, done: true, result: null }];
    }
    this.shown = true;
  }

  protected update(): void {
    this.stepMotion();
    if (!this.playing || this.moving || this.inThroatTransition) return;
    this.time -= 1 / 30;
    if (this.time <= 0) {
      this.fail();
      return;
    }
    if (this.gauge > 0) this.gauge = Math.max(this.gauge - 0.005, 0);
    else if (this.gauge < 0) this.gauge = Math.min(this.gauge + 0.005, 0);
    if (this.gauge >= 1) {
      this.gauge = 0;
      this.move(this.lane + 1);
    } else if (this.gauge <= -1) {
      this.gauge = 0;
      this.move(this.lane - 1);
    }
  }

  private get inThroatTransition(): boolean {
    return this.throat !== null;
  }

  private get canInput(): boolean {
    return this.playing && !this.moving && this.shown;
  }

  // Q/W: toward higher lanes.
  pressRight(): void {
    if (!this.canInput) return;
    const edge = this.ex ? 7 : this.form === 1 ? 8 : 7;
    if (this.lane === edge) {
      if (this.gauge <= -0.2) this.gauge += 0.2;
      else if (this.gauge < 0) this.gauge = 0;
      else this.gauge = !this.ex && this.form === 2 ? this.gauge + 0.03 : 0;
    } else this.gauge += 0.2;
  }

  // O/P: toward lower lanes.
  pressLeft(): void {
    if (!this.canInput) return;
    const edge = !this.ex && this.form === 2 ? 2 : 1;
    if (this.lane === edge) {
      if (this.gauge >= 0.2) this.gauge -= 0.2;
      else if (this.gauge > 0) this.gauge = 0;
      else this.gauge = !this.ex && this.form === 2 ? this.gauge - 0.03 : 0;
    } else this.gauge -= 0.2;
  }

  // Q+W+O+P chord: bite the tooth in front of the boat.
  rowBoth(): void {
    if (this.canInput) this.pushFang();
  }

  tap(index: number): void {
    if (this.canInput && index === this.lane) this.pushFang();
  }

  debugSolve(): void {
    const index = this.fangs.findIndex((fang) => !fang.done && fang.q?.type === "ワニ_セーフの歯");
    if (index < 0) return;
    this.lane = index + 1;
    this.pos = this.lane;
    this.pushFang();
  }

  private pushFang(): void {
    if (this.lane === 0) {
      this.se("hoyiyi");
      this.se("chakin");
      this.host.run.bossFlag = 4;
      this.host.run.bossSecretFlag = 4;
      this.clear("clear_crocodile");
      return;
    }
    const fang = this.fangs[this.lane - 1];
    if (!fang || fang.done || !fang.q) return;
    fang.done = true;
    if (fang.q.type === "ワニ_セーフの歯") {
      this.se("chakin");
      fang.result = "safe";
      this.rest -= 1;
      if (this.rest <= 0) this.nextForm();
      return;
    }
    fang.result = insectFile[fang.q.extra[0]] ?? "safe";
    this.gauge = 0;
    this.hurt(this.ex ? 1 : this.form === 2 ? 5 : 2);
  }

  private nextForm(): void {
    if (this.ex) {
      this.shown = false;
      this.exWin();
      return;
    }
    this.form += 1;
    if (this.form === 3) {
      this.host.run.bossFlag = 4;
      this.clear("clear_crocodile");
      return;
    }
    this.time = 60;
    this.rest = 1;
    this.shown = false;
    this.slide = { from: this.pos, to: 4, at: this.clock, dur: 3 };
    this.lane = 4;
    this.angry(1, () => this.showQuestion(2));
  }

  private move(target: number): void {
    if (this.lane === 0) {
      const to = target === -1 ? 7 : 2;
      this.throat = { at: this.clock, enter: false, target: to };
      return;
    }
    if (!this.ex && this.form === 2 && (target < 2 || target > 7)) {
      this.throat = { at: this.clock, enter: true, target };
      this.slide = { from: this.pos, to: target, at: this.clock, dur: 3 };
      return;
    }
    this.slide = { from: this.pos, to: target, at: this.clock, dur: 0.5 };
    this.lane = target;
  }

  private stepMotion(): void {
    if (this.slide) {
      const k = seg(this.clock, this.slide.at, this.slide.dur);
      this.pos = lerp(this.slide.from, this.slide.to, k);
      if (k >= 1) this.slide = null;
    }
    const throat = this.throat;
    if (!throat) return;
    const t = this.clock - throat.at;
    if (throat.enter) {
      if (t >= 4 && !this.inThroat) this.inThroat = true;
      if (t >= 5) {
        this.throat = null;
        this.lane = 0;
      }
      return;
    }
    if (t >= 3 && this.inThroat) {
      this.inThroat = false;
      this.pos = throat.target === 7 ? 8 : 1;
      this.slide = { from: this.pos, to: throat.target, at: throat.at + 4, dur: 3 };
    }
    if (t >= 7) {
      this.throat = null;
      this.lane = throat.target;
    }
  }

  private blackout(): number {
    const throat = this.throat;
    if (!throat) return 0;
    const t = this.clock - throat.at;
    if (throat.enter) return t < 3 ? t / 3 : t < 4 ? 1 : Math.max(0, 1 - (t - 4));
    return t < 3 ? t / 3 : t < 4 ? 1 : Math.max(0, 1 - (t - 4));
  }

  protected camera(): CameraPose {
    return { x: -5 + this.pos, z: 0, yaw: 0, roll: 0, pitch: -5 };
  }

  protected viewExtras(view: ModeView): void {
    view.black = this.blackout();
    const active = this.stage === "play" && this.shown;
    view.arrows = active;
    view.gauge = this.gauge;
    view.gaugeFull = Math.abs(this.gauge) >= 1;
    view.showLeftArrow = this.lane !== 1;
    view.showRightArrow = this.lane !== this.lanes;
  }

  protected nodes(): SceneNode[] {
    const nodes: SceneNode[] = [];
    const live = this.shown && (this.stage === "play" || this.stage === "fail" || this.stage === "end");
    if (this.inThroat) {
      nodes.push(img("nodo", `${SPR}wani/ワニ_分割素材_喉.png`, 0, -196.92, 1920, 1080));
    } else {
      nodes.push(img("wani-up", `${SPR}wani/ワニ_分割素材_上顎.png`, 0, 165, 2112, 385));
      nodes.push(img("wani-down", `${SPR}wani/ワニ_分割素材_下顎.png`, 0, -400, 2112, 385));
      const offset = 800 * (4 - this.pos);
      for (let n = 1; n <= this.lanes; n++) {
        const fang = this.fangs[n - 1];
        if (live && fang && !fang.q) continue;
        const x = 800 * (n - 4) + offset;
        if (x < -1500 || x > 1500) continue;
        nodes.push(img(`fang${n}`, `${SPR}wani/ワニ_分割素材_下歯.png`, x, -350, 400, 500, { tap: n }));
        nodes.push(img(`fang${n}-back`, `${SPR}ui/nazo_back_normal.png`, x, 0, 720, 560, { tap: n }));
        if (live && fang?.q) nodes.push(img(`fang${n}-image`, qimg(fang.q.file), x, 0, 640, 480, { tap: n }));
        if (live && fang?.result) nodes.push(img(`fang${n}-result`, `${RES}wani/mushiba_${fang.result}.png`, x, 150, 600, 400, { blink: true }));
      }
    }
    if (live && this.stage === "play") nodes.push(this.timeNode(this.time));
    nodes.push(...this.restNodes(`${SPR}wani/atoXhon_crocodile.png`, this.rest, 600, 440, 601, 151, 650, 90));
    return nodes;
  }
}
