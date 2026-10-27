import { questionsIn, type BossQuestion } from "../data/bossQuestions";
import { img, shuffle, SPR, txt, type SceneNode } from "../scene";
import { Boss, qimg } from "./boss";
import type { Host, ModeView } from "./mode";

// Boss5Script / Boss5ExScript.
const wordList = [
  ["あたま", "せなか", "てくび", "こゆび", "ひたい", "みけん"],
  ["あしくび", "なかゆび", "てのひら", "かみのけ", "つまさき", "わきばら"],
];
const kanaList = [..."ぁあぃいぅうぇえぉおかがきぎくぐけげこごさざしじすずせぜそぞただちぢっつづてでとどなにぬねのはばぱひびぴふぶぷへべぺほぼぽまみむめもゃやゅゆょよらりるれろわをんー"];
const decoy: Record<number, string> = { 7: "お", 6: "お", 5: "き", 4: "な", 3: "は", 2: "さ", 1: "み" };
const maxTimeList = [20, 20, 20, 30, 40];

const MAP_X = 550;
const MAP_Y = -100;
const CENTER = 5;
// Heading in 90° counter-clockwise steps from "up": grid [row, col] step for each.
const headingStep: [number, number][] = [
  [-1, 0],
  [0, -1],
  [1, 0],
  [0, 1],
];

// Panels 1–9 in keypad-like order: 1–3 top row, 5 = center.
function cell(index: number): [number, number] {
  const col = (index - 1) % 3;
  const row = Math.floor((index - 1) / 3);
  return [(col - 1) * 200, (1 - row) * 200];
}

export class Lobster extends Boss {
  readonly kind = "lobster";
  private pool: BossQuestion[];
  private form = 1;
  private rest: number;
  private time: number;
  private timerHidden = false;
  private pos = CENTER;
  private heading = 0;
  private gauge = 0;
  private panels: string[] = [];
  private answerText = "";
  private current: BossQuestion[] = [];
  private selected = "";
  private spin: { period: number; offsets: number[]; at: number } | null = null;
  private shown = false;

  constructor(host: Host, ex: boolean) {
    super(host, ex);
    this.pool = shuffle(questionsIn("ロブ"));
    this.rest = ex ? 4 : 7;
    this.time = ex ? 30 : maxTimeList[0];
    this.bgm("zari");
  }

  private take(type: string, pred: (q: BossQuestion) => boolean = () => true): BossQuestion {
    const index = this.pool.findIndex((q) => q.type === type && pred(q));
    return index < 0 ? questionsIn("ロブ", type)[0] : this.pool.splice(index, 1)[0];
  }

  protected onStart(): void {
    this.setQuestion();
  }

  protected update(): void {
    if (!this.playing || !this.shown) return;
    this.stepTurn();
    this.time -= 1 / 30;
    if (this.time <= 0) this.checkAnswer();
  }

  // Same fill as the river: ±0.2 per stroke, 0.005/frame decay, turn 90° at ±1.
  pressLeft(): void {
    if (this.canSteer) this.gauge -= 0.2;
  }

  pressRight(): void {
    if (this.canSteer) this.gauge += 0.2;
  }

  rowBoth(): void {
    if (!this.canSteer) return;
    const row = Math.floor((this.pos - 1) / 3) + headingStep[this.heading][0];
    const col = ((this.pos - 1) % 3) + headingStep[this.heading][1];
    if (row < 0 || row > 2 || col < 0 || col > 2) return;
    this.pos = row * 3 + col + 1;
    this.se("basha");
  }

  private get canSteer(): boolean {
    return this.playing && this.shown;
  }

  private stepTurn(): void {
    if (this.gauge > 0) this.gauge = Math.max(this.gauge - 0.005, 0);
    else if (this.gauge < 0) this.gauge = Math.min(this.gauge + 0.005, 0);
    if (this.gauge >= 1) {
      this.heading = (this.heading + 3) % 4;
      this.gauge = 0;
    } else if (this.gauge <= -1) {
      this.heading = (this.heading + 1) % 4;
      this.gauge = 0;
    }
  }

  protected viewExtras(view: ModeView): void {
    const active = this.canSteer;
    view.arrows = active;
    view.gauge = this.gauge;
    view.gaugeFull = Math.abs(this.gauge) >= 1;
    view.showLeftArrow = active;
    view.showRightArrow = active;
  }

  debugSolve(): void {
    if (!this.playing || !this.shown) return;
    const index = this.panels.findIndex((text, i) => i !== CENTER - 1 && text !== "" && !this.answerText.includes(text));
    if (index >= 0) this.pos = index + 1;
    this.time = 0;
  }

  // The boat must sit on a panel whose letter the claws don't attack (not in the answer).
  private checkAnswer(): void {
    if (this.pos === CENTER) {
      this.damaged();
      return;
    }
    const letter = this.panels[this.pos - 1];
    this.selected += letter;
    if (this.answerText.includes(letter)) {
      this.damaged();
      return;
    }
    this.se("piropiropiron");
    this.setRest(this.rest - 1);
  }

  private damaged(): void {
    const damage = this.ex ? 1 : [1, 1, 2, 3, 5][this.form - 1] ?? 5;
    this.hurt(damage, () => this.setRest(this.rest - 1));
  }

  private setRest(value: number): void {
    if (this.ex) this.time = 30;
    else if (this.form <= 4) this.time = maxTimeList[this.form - 1];
    else this.timerHidden = true;
    this.rest = value;
    this.pos = CENTER;
    this.heading = 0;
    this.gauge = 0;
    if (this.ex) {
      if (value === 0) {
        this.shown = false;
        this.exWin();
      } else this.setQuestion();
      return;
    }
    const forms: Record<number, number> = { 6: 2, 5: 3, 3: 4, 1: 5, 0: 6 };
    if (forms[value] !== undefined) this.setForm(forms[value]);
    else this.setQuestion();
  }

  private setForm(form: number): void {
    this.form = form;
    if (form === 6) {
      if (this.selected === "おおきなはさみ") {
        this.se("hoyiyi");
        this.host.run.bossSecretFlag = 2;
      }
      this.host.run.bossFlag = 2;
      this.shown = false;
      this.clear("clear_lobster");
      return;
    }
    this.time = maxTimeList[form - 1];
    this.shown = false;
    this.angry(form - 1, () => {
      this.timerHidden = false;
      this.setQuestion();
    });
  }

  private setQuestion(): void {
    const panels: string[] = [];
    this.current = [];
    if (this.ex) {
      this.current = [this.take("ロブ_lv3_6文字")];
      this.answerText = this.current[0].answers[0];
    } else if (this.rest === 7 || this.rest === 6) {
      this.answerText = shuffle(wordList[7 - this.rest])[0];
    } else if (this.rest >= 4) {
      this.current = [this.take("ロブ_lv2_5文字")];
      this.answerText = this.current[0].answers[0];
    } else if (this.rest >= 2) {
      this.current = [this.take("ロブ_lv3_6文字")];
      this.answerText = this.current[0].answers[0];
    } else {
      const first = this.take("ロブ_最終_3+4文字");
      const second = this.take("ロブ_最終_3+4文字", (q) => q.extra[0] === first.extra[0]);
      this.current = [first, second];
      this.answerText = first.answers[0] + second.answers[0];
    }
    for (const char of this.answerText) if (!panels.includes(char)) panels.push(char);
    for (const char of shuffle(kanaList)) {
      if (panels.length >= 8) break;
      if (!panels.includes(char)) panels.push(char);
    }
    if (!this.ex && !panels.includes(decoy[this.rest])) panels[7] = decoy[this.rest];
    const spinRests = this.ex ? [2, 1] : [6, 3, 2, 1];
    this.spin = spinRests.includes(this.rest)
      ? { period: !this.ex && this.rest === 1 ? 1 : 2, offsets: Array.from({ length: 9 }, () => Math.random() * 90), at: this.clock }
      : null;
    const order = shuffle(panels);
    order.splice(4, 0, "");
    this.panels = order;
    this.shown = true;
  }

  protected nodes(): SceneNode[] {
    const live = this.shown && (this.stage === "play" || this.stage === "fail" || this.stage === "end");
    const nodes: SceneNode[] = [img("robster", this.ex ? `${SPR}lobster/ザリガニ改_本体基本ポーズ.webp` : `${SPR}lobster/ザリガニ_本体基本ポーズ.webp`, 0, -112.08, 700, 600)];
    const pair = live && this.current.length === 2;
    if (pair) {
      nodes.push(img("q2-back1", `${SPR}lobster/lobster_nazo.webp`, -600, 100, 540, 420));
      nodes.push(img("q2-image1", qimg(this.current[0].file), -600, 100, 480, 360));
      nodes.push(img("q2-back2", `${SPR}lobster/lobster_nazo.webp`, -600, -300, 540, 420));
      nodes.push(img("q2-image2", qimg(this.current[1].file), -600, -300, 480, 360));
    } else {
      nodes.push(img("q-back", `${SPR}lobster/lobster_nazo.webp`, -600, -100, 720, 560));
      if (live && this.current.length === 1) nodes.push(img("q-image", qimg(this.current[0].file), -600, -100, 640, 480));
      if (live && this.current.length === 0) nodes.push(txt("q-answer", this.answerText, -600, -100, 800, 100, 100, { font: "noto", color: "#323232" }));
    }
    nodes.push(img("panel-image", `${SPR}lobster/lobster_map_2.webp`, MAP_X, MAP_Y, 700, 700));
    for (let d = 1; d <= 9; d++) {
      const [dx, dy] = cell(d);
      const text = live ? this.panels[d - 1] ?? "" : "";
      const spinY = this.spin && d !== 5 ? this.spin.offsets[d - 1] + (360 * (this.clock - this.spin.at)) / this.spin.period : 0;
      nodes.push(txt(`panel${d}`, text, MAP_X + dx, MAP_Y + dy, 200, 200, 100, { font: d === CENTER ? "ipa" : "noto", spinY }));
    }
    const [bx, by] = cell(live ? this.pos : CENTER);
    nodes.push(img("boat", `${SPR}ui/boat.webp`, MAP_X + bx, MAP_Y + by, 170, 170, { rot: live ? this.heading * 90 : 0, alpha: live && this.pos !== CENTER ? 0.6 : 1 }));
    if (live && this.stage === "play") {
      nodes.push(txt("rc-help", "左を漕ぐ：右回り　右を漕ぐ：左回り　真ん中：前進", MAP_X, MAP_Y - 380, 900, 60, 36, { stroke: "#000" }));
    }
    if (live && this.stage === "play" && !this.timerHidden) nodes.push(this.timeNode(this.time));
    nodes.push(...this.restNodes(`${SPR}lobster/atoXkai_lobster.webp`, this.rest, 600, 440, 601, 151, 605, 90));
    return nodes;
  }
}
