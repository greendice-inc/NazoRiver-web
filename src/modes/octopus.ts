import { questionsIn, type BossQuestion } from "../data/bossQuestions";
import { img, inQuad, normalizeKana, RES, seg, shuffle, SPR, type SceneNode } from "../scene";
import { Boss, qimg } from "./boss";
import type { Host } from "./mode";

// Boss2Script / Boss2ExScript.
const legendLegs = [
  { color: "あか", file: "tako_red" },
  { color: "きん", file: "tako_gold" },
  { color: "はい", file: "tako_gray" },
  { color: "しろ", file: "tako_white" },
  { color: "くろ", file: "tako_black" },
  { color: "みず", file: "tako_cyan" },
  { color: "ちゃ", file: "tako_brown" },
  { color: "みどり", file: "tako_green" },
];

const colorList1 = [
  ["あか", "ちゃ", "はい", "きん"],
  ["はい", "くろ", "あか", "きん"],
  ["くろ", "ちゃ", "あか", "はい"],
  ["ちゃ", "くろ", "あか", "しろ"],
  ["きん", "くろ", "あか", "しろ"],
  ["はい", "くろ", "あか", "きん"],
];

const colorList2 = [
  ["きん", "ちゃ", "くろ", "はい", "しろ"],
  ["きん", "くろ", "ちゃ", "はい", "しろ"],
  ["きん", "ちゃ", "くろ", "はい", "しろ"],
  ["きん", "くろ", "ちゃ", "はい", "あか"],
  ["きん", "ちゃ", "くろ", "はい", "しろ"],
  ["きん", "くろ", "ちゃ", "はい", "しろ"],
];

const colorList3 = [
  ["きん", "しろ", "あか", "ちゃ", "はい"],
  ["あか", "みず", "きん", "しろ", "ちゃ"],
  ["きん", "はい", "あか", "ちゃ", "しろ"],
  ["きん", "はい", "あか", "みず", "しろ"],
  ["ちゃ", "きん", "あか", "みず", "はい"],
  ["きん", "あか", "みず", "くろ", "しろ"],
];

const cardPos: [number, number][] = [
  [-720, 190],
  [-720, -100],
  [-720, -390],
  [720, 190],
  [720, -100],
  [720, -390],
];
const legPos: [number, number][] = [
  [-500, 100],
  [-300, 100],
  [300, 100],
  [500, 100],
  [-400, -300],
  [-200, -300],
  [200, -300],
  [400, -300],
];

type Card = { q: BossQuestion; answers: string[]; hidden: boolean; drop: number; dropAt: number };
type Leg = { color: string; file: string; done: boolean };

function legOf(color: string): { color: string; file: string } {
  return legendLegs.find((leg) => leg.color === color)!;
}

const pick6 = () => Math.floor(Math.random() * 6);

export class Octopus extends Boss {
  readonly kind = "octopus";
  private pool: BossQuestion[];
  private form = 1;
  private rest = 0;
  private norma = 0;
  private defeat = 0;
  private time = 90;
  private cards: Card[] = [];
  private legs: Leg[] = [];
  private left = true;
  private shuchu = true;
  private shown = false;

  constructor(host: Host, ex: boolean) {
    super(host, ex);
    this.pool = shuffle(questionsIn("タコ"));
    this.bgm("tako");
    this.setForm(1, false);
  }

  private take(pred: (q: BossQuestion) => boolean): BossQuestion {
    const index = this.pool.findIndex(pred);
    if (index < 0) return this.pool.shift()!;
    return this.pool.splice(index, 1)[0];
  }

  protected answering(): boolean {
    return this.shown;
  }

  protected onStart(): void {
    this.showQuestion(1);
    this.host.focusAnswer();
  }

  protected update(): void {
    if (!this.playing) return;
    this.time -= 1 / 30;
    if (this.time <= 0) this.fail();
  }

  debugSolve(): void {
    const gain = (card: Card) => this.legs.filter((leg) => !leg.done && card.q.extra.includes(leg.color)).length;
    const open = this.cards.filter((item) => !item.hidden && item.answers.length);
    const card = open.sort((a, b) => gain(b) - gain(a))[0];
    if (card) this.answer(card.answers[0]);
  }

  answer(raw: string): "clear" | "keep" {
    if (!this.playing || !this.shown) return "keep";
    const answer = normalizeKana(raw);
    if (!answer) return "keep";
    let index = -1;
    this.cards.forEach((card, i) => {
      if (card.answers.some((item) => item !== "" && normalizeKana(item) === answer)) index = i;
    });
    if (index < 0) {
      this.se("bu");
      return "clear";
    }
    this.se("piropiropiron");
    this.correct(index);
    return "clear";
  }

  private correct(index: number): void {
    const card = this.cards[index];
    card.answers = [];
    for (const leg of this.legs) {
      if (card.q.extra.includes(leg.color) && !leg.done) {
        leg.done = true;
        this.defeat += 1;
      }
    }
    card.hidden = true;
    if (!this.ex) this.checkShuchu(index);
    if (!this.ex && this.rest !== 1) {
      const targets = index === 1 ? [0] : index === 2 ? [0, 1] : index === 4 ? [3] : index === 5 ? [3, 4] : [];
      for (const target of targets) {
        this.cards[target].drop += 290;
        this.cards[target].dropAt = this.clock;
      }
    }
    this.setRest(this.rest - 1);
  }

  private checkShuchu(index: number): void {
    const required: Record<string, number> = { "1-2": 2, "1-1": 1, "2-3": 2, "2-2": 1, "2-1": 0, "3-3": 2, "3-2": 1, "3-1": 0 };
    const base = required[`${this.form}-${this.rest}`];
    if (base === undefined) return;
    if (index !== (this.left ? base : base + 3)) this.shuchu = false;
  }

  private setRest(value: number): void {
    this.rest = value;
    if (value !== 0) return;
    if (this.ex) {
      if (this.form !== 1 && this.defeat < this.norma) this.hurt(1, () => this.setForm(this.form + 1));
      else this.setForm(this.form + 1);
      return;
    }
    this.setForm(this.form + 1);
  }

  private setForm(form: number, live = true): void {
    const missed = live && !this.ex && form !== 1 && this.defeat < this.norma;
    this.form = form;
    this.defeat = 0;
    const next = () => this.enterForm(form, live);
    if (missed) {
      const damage = form === 2 ? 2 : form === 3 ? 5 : 1;
      this.hurt(damage, form === 4 ? next : undefined);
      if (form !== 4) next();
      return;
    }
    next();
  }

  private enterForm(form: number, live: boolean): void {
    const exForms = [
      { time: 90, rest: 2, norma: 4 },
      { time: 90, rest: 2, norma: 5 },
    ];
    const forms = [
      { time: 90, rest: 2, norma: 2 },
      { time: 90, rest: 3, norma: 5 },
      { time: 90, rest: 3, norma: 8 },
    ];
    const table = this.ex ? exForms : forms;
    if (form > table.length) {
      if (this.ex) {
        this.exWin();
        return;
      }
      this.host.run.bossFlag = 1;
      if (this.shuchu) {
        this.se("hoyiyi");
        this.host.run.bossSecretFlag = 1;
      }
      this.clear("clear_octopus");
      return;
    }
    const row = table[form - 1];
    this.time = row.time;
    this.norma = row.norma;
    this.rest = row.rest;
    if (form === 1 || !live) return;
    this.shown = false;
    this.angry(this.ex ? 0 : form - 1, () => this.showQuestion(form));
  }

  private showQuestion(form: number): void {
    const cards: BossQuestion[] = [];
    let legs: string[] = [];
    if (this.ex) {
      const color = colorList2[pick6()];
      const one = (c: string) => this.take((q) => q.type === "タコ_1色" && q.extra[0] === c);
      if (form === 1) {
        for (const c of [color[0], color[0], color[1], color[2], color[2], color[3]]) cards.push(one(c));
        legs = [color[0], color[0], color[1], color[1], color[2], color[3], "みず", "みず"];
      } else {
        for (const c of [color[0], color[0], color[0], color[1], color[2], color[3]]) cards.push(one(c));
        legs = [color[0], color[1], color[1], color[2], color[2], color[3], color[3], color[3]];
      }
      this.setCards(shuffle(cards), shuffle(legs));
      return;
    }
    if (form === 1) {
      const color = colorList1[pick6()];
      const slotColor = (i: number) => (i <= 1 ? color[0] : i <= 3 ? color[1] : i === 4 ? color[2] : color[3]);
      let rokotsu = 0;
      do rokotsu = pick6();
      while (!["あか", "きん", "しろ", "くろ", "ちゃ"].includes(slotColor(rokotsu)));
      for (let i = 0; i < 6; i++) {
        const type = i === rokotsu ? "タコ_露骨" : "タコ_1色";
        cards.push(this.take((q) => q.type === type && q.extra[0] === slotColor(i)));
      }
      legs = legendLegs.map((leg) => leg.color);
      let order = cards;
      for (let guard = 0; guard < 500; guard++) {
        order = shuffle(cards);
        const c = order.map((q) => q.extra[0]);
        if (c[1] !== c[2] && c[4] === c[5]) {
          this.left = true;
          break;
        }
        if (c[1] === c[2] && c[4] !== c[5]) {
          this.left = false;
          break;
        }
      }
      this.setCards(order, shuffle(legs));
      return;
    }
    if (form === 2) {
      const color = colorList2[pick6()];
      for (const c of [color[0], color[1], color[2], color[2], color[3], color[4]]) cards.push(this.take((q) => q.type === "タコ_1色" && q.extra[0] === c));
      legs = [color[0], color[0], color[1], color[1], color[2], color[2], color[3], color[4]];
      let order = cards;
      for (let guard = 0; guard < 500; guard++) {
        order = shuffle(cards);
        const half = (this.left ? order.slice(0, 3) : order.slice(3)).map((q) => q.extra[0]);
        const score = [0, 1, 2].reduce((sum, i) => sum + (half.includes(color[i]) ? 2 : 0), 0) + [3, 4].reduce((sum, i) => sum + (half.includes(color[i]) ? 1 : 0), 0);
        if (score >= 5) break;
      }
      this.setCards(order, shuffle(legs));
      return;
    }
    const color = colorList3[pick6()];
    cards.push(this.take((q) => q.type === "タコ_2色" && q.extra.includes(color[0]) && q.extra.includes(color[1])));
    cards.push(this.take((q) => q.type === "タコ_2色" && q.extra.includes(color[2]) && q.extra.includes(color[3])));
    for (const c of [color[0], color[1], color[2], color[4]]) cards.push(this.take((q) => q.type === "タコ_1色" && q.extra[0] === c));
    legs = [color[0], color[0], color[1], color[1], color[2], color[2], color[3], color[4]];
    let order = cards;
    for (let guard = 0; guard < 500; guard++) {
      order = shuffle(cards);
      const half = this.left ? order.slice(0, 3) : order.slice(3);
      if (half.every((q) => q.type === "タコ_2色" || q.extra[0] === color[4])) break;
    }
    this.setCards(order, shuffle(legs));
  }

  private setCards(questions: BossQuestion[], legs: string[]): void {
    this.cards = questions.map((q) => ({ q, answers: [...q.answers], hidden: false, drop: 0, dropAt: -10 }));
    this.legs = shuffle(legs).map((color) => ({ ...legOf(color), done: false }));
    this.shown = true;
    this.host.focusAnswer();
  }

  protected nodes(): SceneNode[] {
    const nodes: SceneNode[] = [];
    const live = this.shown && (this.stage === "play" || this.stage === "end" || this.stage === "fail");
    cardPos.forEach(([x, y], i) => {
      const card = this.cards[i];
      if (live && card?.hidden) return;
      let dy = 0;
      if (live && card && card.drop > 0) {
        const k = inQuad(seg(this.clock, card.dropAt, 1));
        dy = -(card.drop - 290 + 290 * k);
      }
      nodes.push(img(`card${i}-back`, `${SPR}tako/nazo_back_octopus.webp`, x, y + dy, 382.5, 297.5));
      if (live && card) nodes.push(img(`card${i}-image`, qimg(card.q.file), x, y + dy, 340, 255));
    });
    nodes.push(...this.restNodes(`${SPR}tako/atoXkai_octopus.webp`, this.rest, 600, 480, 360.6, 90.6, 600, 55));
    nodes.push(img("norma-image", `${SPR}tako/Xhonnoshokushu_octopus.webp`, 600, 390, 690.6, 90.6));
    nodes.push({ key: "norma-num", text: String(Math.max(this.norma - this.defeat, 0)), x: 312, y: 390, w: 200, h: 100, size: 55, font: "wanpaku", color: "#fff" });
    nodes.push(img("tako", this.ex ? `${SPR}tako/タコ改_本体素材.webp` : `${SPR}tako/タコ_本体素材.webp`, 0, -50, 540, 540));
    if (live && this.stage === "play") nodes.push(this.timeNode(this.time));
    if (live) {
      this.legs.forEach((leg, i) => {
        const [x, y] = legPos[i];
        nodes.push(img(`leg${i}`, `${RES}tako/${leg.file}.webp`, x, y, 80, 480, { flipY: i >= 4 }));
        if (leg.done) nodes.push(img(`leg${i}-done`, `${SPR}tako/kougekizumi.webp`, x, y, 100.5, 300.5, { rot: -5 }));
      });
    }
    return nodes;
  }
}
