import { questions } from "../src/data/questions";
import { Game, SECRET_UP_STROKES } from "../src/game";

const game = new Game();
game.begin();
for (let i = 0; i < 30 * 120 && game.view().phase !== "question"; i++) {
  const phase = game.view().phase;
  if (phase === "cruise" || phase === "branch") {
    for (let n = 0; n < 5; n++) game.pressRight();
  }
  game.step();
}

const before = game.view();
if (before.phase !== "question") {
  console.error("question did not start", before.phase);
  process.exit(1);
}
const file = before.questionSrc.match(/(\d+)\.png$/)?.[1];
const question = questions.find((item) => item.file === file);
if (!question) {
  console.error("missing question", before.questionSrc);
  process.exit(1);
}

game.submitAnswer("ちがうよ");
if (game.view().phase !== "question") {
  console.error("wrong answer advanced the phase");
  process.exit(1);
}
game.submitAnswer(question.answers[0]);
for (let i = 0; i < 40; i++) game.step();
const after = game.view();
if (after.phase !== "question" && after.phase !== "qend" && after.phase !== "black" && after.phase !== "cruise") {
  console.error("correct answer did not advance", after.phase);
  process.exit(1);
}
console.log(JSON.stringify({ file, before: before.phase, after: after.phase, life: after.life }));

const retry = new Game();
retry.begin();
for (let i = 0; i < 30 * 40 && retry.view().phase !== "cruise"; i++) retry.step();
if (retry.view().phase !== "cruise") {
  console.error("cruise did not start for retry check", retry.view().phase);
  process.exit(1);
}
const saved = retry.cameraZ;
retry.life = 1;
retry.step();
if (retry.view().phase !== "over" || !retry.view().canRetry) {
  console.error("death did not offer retry", retry.view().phase, retry.view().canRetry);
  process.exit(1);
}
retry.retry();
if (retry.view().phase !== "countdown" || Math.abs(retry.cameraZ - saved) > 1) {
  console.error("retry did not restore place", retry.view().phase, retry.cameraZ, saved);
  process.exit(1);
}

function fail(message: string, ...rest: unknown[]): never {
  console.error(message, ...rest);
  process.exit(1);
}

function answerCurrent(game: Game): void {
  const id = game.view().questionSrc.match(/(\d+)\.png$/)?.[1];
  const found = questions.find((item) => item.file === id);
  if (found) game.submitAnswer(found.answers[0]);
}

// Plays until the result screen: answers nazo, takes `route` at each branch, debug-solves modes.
function drive(game: Game, route: string, seconds: number): void {
  let branch = 0;
  let wasBranch = false;
  for (let i = 0; i < 30 * seconds; i++) {
    const view = game.view();
    if (view.phase === "result" || view.phase === "over") return;
    if (view.waitTap) game.advance();
    if (view.phase === "cruise" && i % 10 === 0) game.rowBoth();
    if (view.phase === "question") answerCurrent(game);
    if (view.phase === "branch" && view.steering) {
      const dir = route[branch] ?? "L";
      if (dir === "L") game.pressLeft();
      else game.pressRight();
      wasBranch = true;
    } else if (wasBranch && view.phase !== "branch") {
      branch += 1;
      wasBranch = false;
    }
    if (view.phase === "mode" && i % 15 === 0) game.debugSolve();
    game.step();
  }
}

const bossRoutes: Record<string, number> = { LLL: 30, LLR: 31, LRR: 32, RLR: 33, RRR: 34 };
for (const [route, boss] of Object.entries(bossRoutes)) {
  const full = new Game();
  full.begin();
  drive(full, route, 1800);
  const end = full.view();
  if (end.phase !== "result" || !end.record) fail("full run did not reach result", route, end.phase, full.level);
  if (full.level !== boss) fail("branch went to the wrong boss", route, full.level, boss);
  if (!/^[ぁ-ん]{6}$/.test(end.record.password)) fail("bad password", end.record.password);
  console.log(
    JSON.stringify({ route, boss, image: end.ending?.image, run: { routeNum: full.run.routeNum, bossFlag: full.run.bossFlag }, trophies: end.record.trophies.map((t) => t.name), password: end.record.password }),
  );
}

const clearFlags: Record<number, number> = { 30: 1, 31: 2, 32: 3, 33: 4, 34: 5 };
for (const [level, flag] of Object.entries(clearFlags)) {
  const boss = new Game();
  boss.begin();
  boss.debugJump(Number(level));
  drive(boss, "", 900);
  const end = boss.view();
  if (end.phase !== "result" || end.ending?.image?.includes("failed")) fail("boss debug clear failed", level, end.phase, end.ending?.image);
  if (boss.run.bossFlag !== flag) fail("bossFlag mismatch", level, boss.run.bossFlag, flag);
}

const lose = new Game();
lose.begin();
lose.debugJump(30);
for (let i = 0; i < 30 * 600 && lose.view().phase !== "result"; i++) {
  if (lose.view().waitTap) lose.advance();
  lose.step();
}
if (lose.view().ending?.image !== "/u/Resources/ui/failed_octopus.png") fail("octopus timeout did not fail", lose.view().phase, lose.view().ending?.image);
if (lose.view().record?.trophies.some((t) => t.name === "無傷")) fail("無傷 given on failure");
console.log(JSON.stringify({ lose: lose.view().ending?.image, trophies: lose.view().record?.trophies.map((t) => t.name) }));

const secret = new Game();
secret.begin();
for (let i = 0; i < 30 * 40 && secret.view().phase !== "cruise"; i++) secret.step();
if (secret.view().phase !== "cruise") {
  console.error("cruise did not start for secret check", secret.view().phase);
  process.exit(1);
}
for (let i = 0; i < SECRET_UP_STROKES - 1; i++) secret.noteLift("center");
if (secret.level !== 0 || secret.view().phase !== "cruise") {
  console.error("secret opened too early", secret.level, secret.view().phase);
  process.exit(1);
}
secret.rowBoth();
secret.noteLift("center");
if (secret.level !== 0) {
  console.error("center down should only subtract one", secret.level);
  process.exit(1);
}
secret.noteLift("center");
if (secret.level !== 40 || secret.view().phase !== "launch") {
  console.error("secret route did not start", secret.level, secret.view().phase);
  process.exit(1);
}
if (!secret.view().secret) {
  console.error("secret flag was off after entry");
  process.exit(1);
}
console.log(JSON.stringify({ secret: true, level: secret.level, phase: secret.view().phase }));

const fromSecret = new Game();
fromSecret.begin();
fromSecret.debugJump(40);
const seen: string[] = [];
for (let i = 0; i < 30 * 1800; i++) {
  const view = fromSecret.view();
  if (view.phase === "result" || view.phase === "over") break;
  const name = fromSecret.mode?.constructor.name;
  if (name && seen[seen.length - 1] !== name) seen.push(name);
  if (view.waitTap) fromSecret.advance();
  if (view.phase === "cruise") fromSecret.rowBoth();
  if (view.phase === "branch") fromSecret.pressRight();
  if (view.phase === "question") answerCurrent(fromSecret);
  if (view.phase === "mode" && i % 15 === 0) fromSecret.debugSolve();
  if (name === "CruiseLast" && view.phase === "mode" && i % 3 === 0) fromSecret.rowBoth();
  fromSecret.step();
}
const last = fromSecret.view();
console.log(JSON.stringify({ secretRoute: seen, phase: last.phase, image: last.ending?.image, trophies: last.record?.trophies.map((t) => t.name), password: last.record?.password }));
if (seen[0] !== "CruiseEx" || seen[1] !== "Totem" || seen[seen.length - 2] !== "Statue" || seen[seen.length - 1] !== "CruiseLast") fail("secret route order wrong", seen);
if (last.ending?.image !== "/u/Resources/ui/clear_all.png" || last.record?.password !== "secret") fail("secret route did not end with 大いなる秘密");
