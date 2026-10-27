import { Audio } from "./audio";
import { debugEnabled } from "./debug";
import { Game, STEP } from "./game";
import { Hud } from "./hud";
import { RowInput } from "./rowing";
import { resetEarned } from "./trophies";
import type { CameraPose, View } from "./types";
import { World } from "./world";

const viewport = document.querySelector<HTMLElement>("#viewport")!;
const stage = document.querySelector<HTMLElement>("#stage")!;
const canvas = document.querySelector<HTMLCanvasElement>("#world")!;
const rotateTip = document.querySelector<HTMLElement>("#rotate");

function hideRotateTip(): void {
  if (!rotateTip) return;
  rotateTip.style.display = "none";
}
window.addEventListener("pointerdown", hideRotateTip, { once: true });
window.setTimeout(hideRotateTip, 5000);

const debugOn = debugEnabled();
const game = new Game();
const audio = new Audio();
const world = new World(canvas);

function begin(): void {
  audio.unlock();
  game.begin();
}

const hud = new Hud(stage, {
  begin,
  restart: () => game.restart(),
  retry: () => game.retry(),
  submit: (text) => game.submitAnswer(text),
  tap: (index) => game.tapPanel(index),
  advance: () => game.advance(),
  echo: (text) => game.setEcho(text),
  toggleMute: () => audio.toggleMute(),
  se: (name) => audio.se(name),
  volume: (kind) => audio.volume(kind),
  setVolume: (kind, value) => audio.setVolume(kind, value),
  resetRecords: () => resetEarned(),
  ...(debugOn ? { jump: (level: number) => game.debugJump(level), clearStage: () => game.debugClear() } : {}),
});

const layout = { scale: 1, left: 0, top: 0 };

function fit(): void {
  const visual = window.visualViewport;
  const width = visual ? visual.width : window.innerWidth;
  const height = visual ? visual.height : window.innerHeight;
  viewport.style.left = `${visual ? visual.offsetLeft : 0}px`;
  viewport.style.top = `${visual ? visual.offsetTop : 0}px`;
  viewport.style.width = `${width}px`;
  viewport.style.height = `${height}px`;
  const scale = Math.min(width / 1920, height / 1080);
  const w = Math.round(1920 * scale);
  const h = Math.round(1080 * scale);
  const left = Math.round((width - w) / 2);
  const top = Math.round((height - h) / 2);
  Object.assign(layout, { scale, left, top });
  stage.style.transform = `translate(${left}px, ${top}px) scale(${scale})`;
  canvas.style.left = `${left}px`;
  canvas.style.top = `${top}px`;
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;
  world.resize(w, h, Math.min(window.devicePixelRatio || 1, 2));
}

fit();
window.addEventListener("resize", fit);
window.visualViewport?.addEventListener("resize", fit);
window.visualViewport?.addEventListener("scroll", fit);

new RowInput({
  surface: viewport,
  layer: hud.rowLayer,
  toStage: (clientX, clientY) => {
    const box = viewport.getBoundingClientRect();
    return {
      x: (clientX - box.left - layout.left) / layout.scale,
      y: (clientY - box.top - layout.top) / layout.scale,
    };
  },
  enabled: () => current.steering || current.strokes,
  row: (zone, x, y) => {
    game.strokeAt(x, y);
    if (zone === "left") game.noteTouch("r");
    else if (zone === "right") game.noteTouch("l");
    else game.rowBoth();
    hud.rowFlash(zone);
  },
  lift: (zone) => game.noteLift(zone),
});

window.addEventListener("pointerdown", () => audio.unlock());
window.addEventListener("keydown", (event) => {
  audio.unlock();
  const typing = event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement;
  if (current.waitTap && !typing && (event.code === "Space" || event.code === "Enter")) {
    event.preventDefault();
    game.advance();
    return;
  }
  if (!typing && (event.code === "Space" || event.code === "Enter") && game.view().phase === "title" && !hud.overlayKey(event.code)) {
    if (hud.titleKey(event.code)) event.preventDefault();
    return;
  }
  if (event.code !== "Escape") return;
  if (hud.overlayKey(event.code) || (game.view().phase === "title" && hud.titleKey(event.code))) event.preventDefault();
});

function dispatch(): void {
  for (const event of game.drainEvents()) {
    if (event.type === "se") audio.se(event.name);
    else if (event.type === "bgm") audio.playBgm(event.name);
    else if (event.type === "nazoGet") world.burst(event.x, event.z);
    hud.handle(event);
  }
}

const DEFAULT_PITCH = -5;

function lerpPose(a: CameraPose, b: CameraPose, t: number): CameraPose {
  return {
    x: a.x + (b.x - a.x) * t,
    z: a.z + (b.z - a.z) * t,
    yaw: a.yaw + (b.yaw - a.yaw) * t,
    roll: a.roll + (b.roll - a.roll) * t,
    ...(a.pitch === undefined && b.pitch === undefined
      ? {}
      : { pitch: (a.pitch ?? DEFAULT_PITCH) + ((b.pitch ?? DEFAULT_PITCH) - (a.pitch ?? DEFAULT_PITCH)) * t }),
  };
}

const debug = { paused: false };
let previous: View = game.view();
let current: View = previous;
let last = performance.now();
let acc = 0;

function frame(now: number): void {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  acc = debug.paused ? 0 : acc + dt;
  if (debug.paused) previous = current = game.view();
  while (acc >= STEP) {
    previous = current;
    game.step();
    current = game.view();
    acc -= STEP;
  }
  dispatch();
  const t = Math.min(acc / STEP, 1);
  const jump = Math.abs(current.camera.z - previous.camera.z) > 5;
  const pose = jump ? current.camera : lerpPose(previous.camera, current.camera, t);
  world.setSecret(current.secret);
  world.render(dt, pose, current.sprites, current.gate, {
    props: current.props,
    boat: current.boat,
    totem: current.totem,
    decor: current.decor,
  });
  hud.update({ ...current, camera: pose }, dt);
  requestAnimationFrame(frame);
}

if (import.meta.env.DEV || debugOn) Object.assign(window, { __game: game, __debug: debug });

dispatch();
void world.ready.then(() => requestAnimationFrame(frame));
