import { COUNTDOWN_START, countdownNodes, img, outQuad, popup, rect, RES, seg, SPR, txt, type SceneNode } from "../scene";
import type { CameraPose } from "../types";
import { baseView, Mode, shakeRoll, STEP, type Host, type ModeView } from "./mode";
import { asset } from "../paths";

export type BossKind = "octopus" | "lobster" | "totem" | "crocodile" | "tortoise" | "statue";

type IntroArt = { back: string; moji: string; boss: string; rule: string | null };

const introFolder: Record<Exclude<BossKind, "statue">, string> = {
  octopus: "tako",
  lobster: "lobster",
  totem: "totem",
  crocodile: "wani",
  tortoise: "kame",
};

function introArt(kind: BossKind, ex: boolean): IntroArt {
  if (kind === "statue") {
    return {
      back: `${SPR}lastBoss/intro_sekizou_3.webp`,
      moji: `${SPR}lastBoss/intro_sekizou_1.webp`,
      boss: `${SPR}lastBoss/intro_sekizou_2.webp`,
      rule: null,
    };
  }
  if (ex) {
    const moji = kind === "totem" ? `${SPR}lastBoss/intro_totem_2 norowareta.webp` : `${SPR}lastBoss/intro_${kind}_2_norowareta.webp`;
    return {
      back: `${SPR}lastBoss/intro_${kind}_back_norowareta.webp`,
      moji,
      boss: `${SPR}lastBoss/intro_${kind}_3_norowareta.webp`,
      rule: null,
    };
  }
  const folder = introFolder[kind];
  return {
    back: `${SPR}${folder}/intro_${kind}_back.webp`,
    moji: `${SPR}${folder}/intro_${kind}_2.webp`,
    boss: `${SPR}${folder}/intro_${kind}_3.webp`,
    rule: `${RES}inst/rule_${kind}.webp`,
  };
}

export const qimg = (file: string): string => asset(`questions/${file}.webp`);

type Stage = "intro" | "inst" | "countdown" | "play" | "angry" | "fail" | "end";

const CONVERT_TIME = 7;
const FAIL_TIME = 8;

export abstract class Boss extends Mode {
  abstract readonly kind: BossKind;
  protected stage: Stage = "intro";
  protected t = 0;
  protected clock = 0;
  protected damage = -1;
  private afterDamage: (() => void) | null = null;
  private angryImage = "";
  private angryDone: (() => void) | null = null;
  private failFile = "";

  constructor(
    host: Host,
    readonly ex: boolean,
  ) {
    super(host);
  }

  // Seconds until the intro accepts input (Unity isAnimation=false).
  private get introEnd(): number {
    if (this.ex) return this.kind === "totem" || this.kind === "statue" ? 3 : 2;
    return 4;
  }

  private get hasInstruction(): boolean {
    return !this.ex;
  }

  private get countdownPre(): number {
    return this.ex && this.kind === "totem" ? CONVERT_TIME : 0;
  }

  protected get playing(): boolean {
    return this.stage === "play" && this.damage < 0;
  }

  advance(): void {
    if (this.stage === "intro" && this.t >= this.introEnd) {
      if (this.hasInstruction) {
        this.stage = "inst";
        this.t = 0;
      } else {
        this.beginCountdown();
      }
    } else if (this.stage === "inst" && this.t >= CONVERT_TIME + 1) {
      this.beginCountdown();
    }
  }

  private beginCountdown(): void {
    this.stage = "countdown";
    this.t = 0;
  }

  step(): void {
    this.t += STEP;
    this.clock += STEP;
    switch (this.stage) {
      case "intro":
        if (this.t - STEP < 0.25 && this.t >= 0.25) this.se("dededen");
        break;
      case "countdown": {
        const c = this.t - this.countdownPre;
        if (c >= 0.25 && c - STEP < 0.25) this.se("pi");
        if (c >= COUNTDOWN_START) {
          this.stage = "play";
          this.t = 0;
          this.onStart();
        }
        break;
      }
      case "play":
        this.stepDamage();
        this.update();
        break;
      case "angry":
        this.stepDamage();
        if (this.t >= (this.kind === "statue" ? 1.5 : 7.5)) {
          this.stage = "play";
          this.t = 0;
          const done = this.angryDone;
          this.angryDone = null;
          done?.();
        }
        break;
      case "fail":
        if (this.t >= 1 && this.t - STEP < 1) this.bgm(null);
        if ((this.t >= 2 && this.t - STEP < 2) || (this.t >= 4 && this.t - STEP < 4) || (this.t >= 6 && this.t - STEP < 6)) this.se("bashi");
        if (this.t >= FAIL_TIME) {
          this.stage = "end";
          this.host.result(this.failFile);
        }
        break;
      default:
        this.stepDamage();
        this.updateEnd();
        break;
    }
  }

  private stepDamage(): void {
    if (this.damage < 0) return;
    this.damage += STEP;
    if (this.damage >= 1.2) {
      this.damage = -1;
      const after = this.afterDamage;
      this.afterDamage = null;
      after?.();
    }
  }

  // Unity Damaged(): bashi, LifePoint −n, 1.2s shake; OnComplete → fail or continue.
  protected hurt(amount: number, after?: () => void): void {
    if (this.damage >= 0) return;
    this.se("bashi");
    this.host.run.noDamage = false;
    const alive = this.host.setLifePoint(this.host.lifePoint() - amount);
    this.damage = 0;
    this.afterDamage = () => {
      if (!alive) this.fail();
      else after?.();
    };
  }

  protected angry(num: number, done: () => void): void {
    this.stage = "angry";
    this.t = 0;
    this.se("alert");
    this.angryImage = `${RES}angry/okotta_${this.kind}_${num + 1}.webp`;
    this.angryDone = done;
  }

  protected fail(): void {
    if (this.stage === "fail" || this.stage === "end") return;
    this.stage = "fail";
    this.t = 0;
    this.failFile = this.ex ? (this.kind === "lobster" ? "failed_lobster" : "failed_all") : `failed_${this.kind}`;
  }

  // ShowResult("clear_*"): 1s wait, then the result screen.
  protected clear(file: string): void {
    this.stage = "end";
    this.t = 0;
    this.endAction = () => this.host.result(file);
    this.endAt = 1;
  }

  // Ex win: SecretBossNumList.RemoveAt(0) + BlackOut → next rush entry.
  protected exWin(delay = 0): void {
    this.stage = "end";
    this.t = 0;
    this.endAction = () => {
      this.host.run.secretList.shift();
      this.host.next(50);
    };
    this.endAt = delay;
  }

  private endAction: (() => void) | null = null;
  private endAt = 0;

  private updateEnd(): void {
    if (!this.endAction || this.t < this.endAt) return;
    const action = this.endAction;
    this.endAction = null;
    action();
  }

  protected abstract onStart(): void;
  protected abstract update(): void;
  // Boss canvas nodes (Boss{n}/…); `neutral` is true outside the playing phase.
  protected abstract nodes(): SceneNode[];

  protected camera(): CameraPose {
    return { x: 0, z: 0, yaw: 0, roll: 0, pitch: -5 };
  }

  protected answering(): boolean {
    return false;
  }

  protected viewExtras(_view: ModeView): void {}

  view(): ModeView {
    const roll = this.damage >= 0 ? shakeRoll(this.damage) : 0;
    const camera = this.camera();
    camera.roll = roll;
    const v = baseView(camera);
    v.decor = this.ex ? "pillars" : "forest";
    v.scene = this.scene();
    v.waitTap = (this.stage === "intro" && this.t >= this.introEnd) || (this.stage === "inst" && this.t >= CONVERT_TIME + 1);
    v.answering = this.answering() && this.playing;
    this.viewExtras(v);
    return v;
  }

  private scene(): SceneNode[] {
    const nodes = this.nodes();
    if (this.stage === "intro") nodes.push(...this.introNodes());
    if (this.stage === "inst" && this.kind !== "statue" && this.t >= CONVERT_TIME) {
      nodes.push(img("angry-start", `${RES}angry/okotta_${this.kind}_1.webp`, 0, 0, 1201, 981, { over: true, alpha: seg(this.t, CONVERT_TIME, 1) }));
    }
    if (this.stage === "countdown") nodes.push(...countdownNodes(this.t - this.countdownPre));
    if (this.stage === "play" && this.t < 0.75) nodes.push(...countdownNodes(this.t + COUNTDOWN_START));
    if (this.stage === "angry") {
      const pop = popup(this.t, 7);
      if (pop && this.kind !== "statue") nodes.push(img("angry", this.angryImage, 0, 0, 1201, 981, { over: true, alpha: pop.alpha, scale: pop.scale }));
    }
    if (this.stage === "fail" || (this.stage === "end" && this.failFile)) nodes.push(...this.failNodes());
    return nodes;
  }

  private introNodes(): SceneNode[] {
    const art = introArt(this.kind, this.ex);
    const t = this.t;
    const nodes: SceneNode[] = [rect("intro-black", 0, 0, 1920, 1080, "rgba(0,0,0,0.75)", { over: true })];
    const back = outQuad(seg(t, 0.75, 0.25));
    if (back > 0) nodes.push(img("intro-back", art.back, 0, 0, 1151, 1081, { over: true, alpha: back }));
    const rise = outQuad(seg(t, 1.75, 0.25));
    if (rise > 0) nodes.push(img("intro-boss", art.boss, 0, -500 + 300 * rise, 1251, 701, { over: true, alpha: rise }));
    const pop = outQuad(seg(t, 0, 0.25));
    const move = outQuad(seg(t, 1, 0.25));
    nodes.push(img("intro-moji", art.moji, 0, 250 * move, 1401, 651, { over: true, alpha: pop, scale: 1.5 * pop - 0.5 * move }));
    if (art.rule) {
      const rule = seg(t, 3, 1);
      if (rule > 0) nodes.push(img("intro-rule", art.rule, 0, 0, 1920, 1080, { over: true, alpha: rule }));
    }
    return nodes;
  }

  private failNodes(): SceneNode[] {
    const t = this.stage === "end" ? FAIL_TIME : this.t;
    const nodes: SceneNode[] = [];
    if (t >= 1) nodes.push(rect("fail-back", 0, 0, 1920, 1080, "#000", { over: true, alpha: seg(t, 1, 1) }));
    if (t >= 2) {
      const file = this.ex || this.kind === "statue" ? "shippai_ura" : `shippai_${this.kind}`;
      nodes.push(img("fail-image", `${RES}failed/${file}.webp`, 0, 0, 1920, 1080, { over: true, alpha: seg(t, 2, 1) }));
    }
    return nodes;
  }

  // Shared HUD helpers (Boss{n}/Time, RestTime).
  protected timeNode(time: number, x = 0, y = 450, size = 100, color = "#fff"): SceneNode {
    return txt("time", String(Math.max(Math.ceil(time), 0)), x, y, 250, 100, size, { font: "wanpaku", color });
  }

  protected restNodes(image: string, value: number, imageX: number, imageY: number, w: number, h: number, numX: number, size: number): SceneNode[] {
    return [img("rest-image", image, imageX, imageY, w, h), txt("rest-num", String(value), numX, imageY, 200, 100, size, { font: "wanpaku" })];
  }
}
