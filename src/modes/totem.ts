import { img, outQuad, pick, seg, shuffle, SPR, RES, txt, type SceneNode } from "../scene";
import { Boss } from "./boss";
import type { Host, ModeView } from "./mode";

// Boss4Script / Boss4ExScript.
const kiList = [..."いきしちにひみりぎじぢびぴぃ"];
const doList = [..."おこそとのほもよろをごぞどぼぽぉょ"];
const aiList = [..."あかさたなはまやらわがざだばぱぁゃ"];
const rakuList = [..."うくすつぬふむゆるゔぐずづぶぷぅゅ"];

const wordList: string[][] = [
  ["いしきり", "じひびき", "みちびき"],
  ["しきたり", "ちかみち", "わきみち"],
  ["いしうす", "うちみず", "つゆいり", "みずくみ", "ゆうぎり"],
  ["あじさい", "かみなり", "はじまり", "ひまわり", "ぴらにあ"],
  ["うずまき", "ぬかるみ", "みずくさ", "みらくる", "ゆうだち"],
  ["くうふく", "ゆうふく", "くすぐる"],
  ["あまつぶ", "かつやく", "くさむら", "ながぐつ", "ゆうがた"],
  ["うりもの", "すぽいと", "とびうお", "ほおずき"],
  [],
  ["かずのこ", "こばると", "ふなぞこ", "わるもの"],
  ["おかると", "くだもの", "とこなつ"],
  ["あさがた", "あまがさ", "かわはば", "さかさま", "たなばた", "はなたば", "わがまま"],
  ["おおもの", "こそどろ", "ものおと", "ものごと", "よそもの", "おおとろ"],
  ["いきつぎ", "みずきり", "みちすじ", "ゆびきり"],
  ["うきしま", "くちばし", "つりばし", "みずあび"],
  ["いきもの", "おしどり", "こいびと", "とびこみ"],
  ["うぐいす", "すずむし", "ふうすい", "ぷりずむ"],
  ["かなづち", "たつまき", "はまぐり", "みずたま"],
  ["あおのり", "さいころ", "なみおと", "まぼろし"],
  ["こまどり", "そらいろ", "ともだち", "ほしぞら"],
  ["くうはく", "つゆくさ", "つるくさ"],
  ["おうこく", "くろうと", "こすもす", "ろうそく"],
  ["あすぱら", "あるぱか", "がらくた", "くわがた", "すなはま", "わかあゆ"],
  ["あおぞら", "あぼかど", "かまぼこ", "かわぞこ", "ことわざ", "そとがわ", "とおあさ", "よのなか", "わかもの"],
];

const specialWordList = [
  ["しごとば", "しなもの", "しろあと", "しろごま"],
  ["とことこ", "とぼとぼ", "ともども", "とろとろ"],
  ["らいばる", "らくがき", "らくだい", "らくらい"],
  ["すいしつ", "すいりく", "すうしき", "すじみち", "すりきり"],
];

const wordNumList = [
  [11, 9, 21, 6],
  [23, 3, 7, 22],
  [11, 5, 23, 15],
  [0, 16, 2, 13],
  [0, 0, 0, 0],
  [12, 22, 23, 5],
  [15, 4, 14, 21],
  [9, 7, 16, 1],
  [0, 23, 11, 12],
  [0, 0, 0, 0],
  [-1, 11, 20, 23],
  [-1, 11, 4, 22],
  [-1, 12, 19, 10],
  [-1, 12, 23, 23],
  [0, 0, 0, 0],
];

const exWords = [
  "あひる", "ないふ", "らいふ", "たいこ", "はしご", "まいご", "あくび", "たぬき", "やすり", "あうと", "かぶと", "まぐろ",
  "あそび", "かおり", "さそり", "かぞく", "ぱどる", "まほう", "きかく", "しばふ", "りある", "いなほ", "きなこ", "みなと",
  "うなぎ", "くさり", "むかし", "すがお", "すばこ", "ふたご", "おわり", "となり", "もやし", "おやつ", "こたつ", "ほたる",
  "いるか", "きずな", "ひるま", "いろは", "ひどら", "ひろば", "うきわ", "くじら", "ふきや", "くもま", "すこあ", "ふろあ",
  "こじま", "ごりら", "のりば", "おくば", "こうら", "もぐら", "ぎふと", "ぎるど", "みくろ", "いおう", "きこう", "ちのう",
  "うしろ", "つきよ", "ふりこ", "くもり", "つぼみ", "ゆとり", "おいる", "どりる", "ぼいす", "おうぎ", "こむぎ", "ぼうし",
];

// GetFace: Y angle, emotion delta and the Ex rush id for each vowel row.
function face(kana: string): { angle: number; plus: number; rush: number | null } {
  if (kiList.includes(kana)) return { angle: 45, plus: 3, rush: 3 };
  if (doList.includes(kana)) return { angle: 135, plus: -2, rush: 1 };
  if (aiList.includes(kana)) return { angle: 225, plus: -1, rush: 4 };
  if (rakuList.includes(kana)) return { angle: 315, plus: 1, rush: 0 };
  return { angle: 0, plus: 0, rush: null };
}

const panelPos: [number, number][] = [
  [-650, 250],
  [-650, -450],
  [650, 250],
  [650, -450],
];
const arrowPos: [number, number][] = [
  [-650, 100],
  [-650, -300],
  [650, 100],
  [650, -300],
];

type Spin = { from: number[]; to: number[]; at: number };
type Needle = { from: number; to: number; at: number };

export class Totem extends Boss {
  readonly kind = "totem";
  private words: string[][] = wordList.map((list) => [...list]);
  private special: string[][] = specialWordList.map((list) => [...list]);
  private exPool = shuffle(exWords);
  private phase5 = ["", "", "", ""];
  private phase10 = ["", "", "", ""];
  private phase15 = ["", "", "", ""];
  private form = 1;
  private rest: number;
  private time: number;
  private gauges = [0, 0, 0, 0];
  private choices: string[] = [];
  private moving = false;
  private angles: number[];
  private spin: Spin | null = null;
  private life = 20;
  private needle: Needle = { from: 20, to: 20, at: -10 };
  private selected = -1;
  private afterSpin: (() => void) | null = null;
  private spinEnd = 0;
  private katas: { at: number; last: boolean }[] = [];

  constructor(host: Host, ex: boolean) {
    super(host, ex);
    this.rest = ex ? 1 : 15;
    this.time = ex ? 60 : 20;
    this.angles = ex ? [45, 135, 225] : [0, 0, 0, 0];
    this.bgm("totem");
  }

  protected onStart(): void {
    this.showChoices();
  }

  private get maxTime(): number {
    if (this.ex) return 60;
    return this.rest > 10 ? 20 : 10;
  }

  protected update(): void {
    this.stepSpin();
    if (!this.playing || this.moving || this.choices.length === 0) return;
    this.gauges = this.gauges.map((g) => Math.max(g - 0.005, 0));
    this.time -= 1 / 30;
    if (this.time <= 0) this.gauges[Math.floor(Math.random() * 4)] = 1;
    const full = this.gauges.findIndex((g) => g >= 1);
    if (full >= 0) this.select(full);
  }

  tap(index: number): void {
    if (!this.playing || this.moving || index < 0 || index > 3 || this.choices.length === 0) return;
    this.gauges[index] += 0.2;
  }

  debugSolve(): void {
    if (!this.playing || this.moving || !this.choices.length) return;
    const score = (word: string) => [...word].slice(0, 4).reduce((sum, kana) => sum + face(kana).plus, 0);
    let best = 0;
    this.choices.forEach((word, i) => {
      if (score(word) > score(this.choices[best])) best = i;
    });
    this.select(best);
  }

  private stepSpin(): void {
    while (this.katas.length && this.clock >= this.katas[0].at) {
      const kata = this.katas.shift()!;
      this.se(kata.last && !this.ex && this.host.run.bossSecretFlag === 3 ? "hoyiyi" : "kata");
    }
    if (this.afterSpin && this.clock >= this.spinEnd) {
      const done = this.afterSpin;
      this.afterSpin = null;
      done();
    }
  }

  private showChoices(): void {
    if (this.ex) {
      this.choices = shuffle(this.exPool.splice(0, 4));
    } else if (this.rest === 11) {
      this.choices = [...this.phase5];
    } else if (this.rest === 6) {
      this.choices = [...this.phase10];
    } else if (this.rest === 1) {
      this.choices = [...this.phase15];
    } else {
      const nums = wordNumList[15 - this.rest];
      const list = nums.map((num) => {
        if (num === -1) return pick(this.special[5 - this.rest].filter(Boolean));
        const bag = this.words[num].filter(Boolean);
        const word = pick(bag);
        this.words[num].splice(this.words[num].indexOf(word), 1);
        return word;
      });
      this.choices = shuffle(list);
    }
    this.time = this.maxTime;
  }

  private panelSprite(i: number): string {
    if (this.ex) return `${RES}totem/totem_4moji_1.png`;
    const band = (15 - this.rest) % 5;
    if (band === 4) return `${RES}totem/totem_4moji_${String(i + 1).repeat(4)}.png`;
    return `${RES}totem/totem_4moji_${band + 1}.png`;
  }

  private select(index: number): void {
    this.moving = true;
    this.selected = index;
    const word = this.choices[index];
    const chars = [...word];
    if (this.ex) {
      const faces = chars.slice(0, 3).map(face);
      const list = faces.map((f) => f.rush).filter((id): id is number => id !== null);
      this.startSpin(faces.map((f) => f.angle + 360), () => {
        this.host.run.secretList = [...list, 5];
        this.gauges = [0, 0, 0, 0];
        this.exWin();
      });
      return;
    }
    const target = this.rest > 11 ? this.phase5 : this.rest > 6 && this.rest <= 10 ? this.phase10 : this.rest > 1 && this.rest <= 5 ? this.phase15 : null;
    if (target) for (let i = 0; i < 4; i++) target[i] += chars[i] ?? "";
    const faces = chars.slice(0, 4).map(face);
    const plus = faces.reduce((sum, f) => sum + f.plus, 0);
    if (faces.map((f) => f.angle).join() === "45,135,225,315") this.host.run.bossSecretFlag = 3;
    this.startSpin(
      faces.map((f) => f.angle + 360 * (16 - this.rest)),
      () => {
        const next = Math.min(this.life + plus, 40);
        this.setLife(next);
        this.se(plus > 0 ? "pinpon" : plus < 0 ? "bu" : "kyun");
        this.gauges = [0, 0, 0, 0];
        this.moving = false;
        this.selected = -1;
        this.setRest(this.rest - 1);
      },
    );
  }

  private startSpin(to: number[], done: () => void): void {
    const n = to.length;
    this.spin = { from: [...this.angles], to, at: this.clock };
    this.katas = Array.from({ length: n }, (_, i) => ({ at: this.clock + 0.8 * (i + 1), last: i === n - 1 }));
    this.spinEnd = this.clock + 0.8 * n + 0.5;
    this.afterSpin = () => {
      this.angles = [...to];
      this.spin = null;
      done();
    };
  }

  private setLife(value: number): void {
    this.needle = { from: this.displayLife(), to: value, at: this.clock };
    this.life = value;
  }

  private displayLife(): number {
    const k = outQuad(seg(this.clock, this.needle.at, 1));
    return this.needle.from + (this.needle.to - this.needle.from) * k;
  }

  private setRest(value: number): void {
    this.rest = value;
    this.time = this.maxTime;
    this.choices = [];
    if (value === 10 || value === 5 || value === 0) {
      const passed = this.life >= 20;
      if (!passed) {
        const damage = [2, 3, 5][this.form - 1];
        this.hurt(damage, () => this.setForm(this.form + 1));
      }
      this.setLife(20);
      if (passed) this.setForm(this.form + 1);
      return;
    }
    this.showChoices();
  }

  private setForm(form: number): void {
    this.form = form;
    if (form === 4) {
      this.host.run.bossFlag = 3;
      this.clear("clear_totem");
      return;
    }
    this.angry(form - 1, () => this.showChoices());
  }

  private currentAngles(): number[] {
    if (!this.spin) return this.angles;
    const spin = this.spin;
    return spin.to.map((to, i) => {
      const k = outQuad(seg(this.clock, spin.at + 0.8 * i, 0.8));
      return spin.from[i] + (to - spin.from[i]) * k;
    });
  }

  protected viewExtras(view: ModeView): void {
    view.totem = { ex: this.ex, angles: this.currentAngles() };
  }

  protected nodes(): SceneNode[] {
    const nodes: SceneNode[] = [];
    const live = this.choices.length > 0 && (this.stage === "play" || this.stage === "fail" || this.stage === "end");
    if (!this.ex) {
      nodes.push(img("meter", `${SPR}totem/totem_kokorometer.png`, 0, -410, 400.4, 240.4));
      const theta = ((this.displayLife() - 20) * -4.5 * Math.PI) / 180;
      nodes.push(img("needle", `${SPR}totem/totem_kokorogauge.png`, -100 * Math.sin(theta), -510 + 100 * Math.cos(theta), 60.4, 220.4, { rot: (this.displayLife() - 20) * -4.5 }));
      nodes.push(img("needle-heart", `${SPR}totem/totem_kokorogauge_heart.png`, 0, -510, 60.4, 60.4));
    }
    panelPos.forEach(([x, y], i) => {
      nodes.push(img(`panel${i}`, this.panelSprite(i), x, y, 540.6, 135.6, { tap: i }));
      const text = live ? this.choices[i] || "" : "";
      nodes.push(txt(`panel${i}-text`, text, x, y, 540.6, 135.6, 80, { color: "#323232" }));
    });
    arrowPos.forEach(([x, y], i) => {
      const yellow = this.selected === i && this.moving;
      nodes.push(img(`arrow${i}`, `${SPR}ui/arrow_back_left.png`, x, y, 240, 240, { tap: i }));
      nodes.push(img(`arrow${i}-gauge`, `${RES}ui/${yellow ? "arrow_left_yellow" : "arrow_left"}.png`, x, y, 240, 240, { fill: yellow ? 1 : Math.min(this.gauges[i], 1), fillFrom: "right" }));
    });
    if (live && this.stage === "play") nodes.push(this.timeNode(this.time));
    nodes.push(...this.restNodes(`${SPR}totem/atoXkai_totem.png`, this.rest, 600, 440, 601, 151, 605, 90));
    return nodes;
  }
}
