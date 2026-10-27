import { asset } from "./paths";
export type RunStats = {
  routeNum: number;
  speedUps: number;
  noDamage: boolean;
  totalQuestions: number;
  allCorrect: boolean;
  bossFlag: number;
  bossSecretFlag: number;
  third: number;
  secretList: number[];
};

export type Trophy = { name: string; icon: string };

export type RunRecord = {
  trophies: Trophy[];
  earned: string[];
  fresh: Set<string>;
  password: string;
  route: string;
};

export type CatalogEntry = {
  name: string;
  icon: string;
  hint: string;
  secret?: boolean;
};

export const catalog: CatalogEntry[] = [
  { name: "のんびりクルーズ", icon: "trophy_g", hint: "一度も加速せずに冒険を終える" },
  { name: "クイッククルーズ", icon: "trophy_g", hint: "20回以上加速して冒険を終える" },
  { name: "無傷の生還", icon: "trophy_g", hint: "一度もぶつからずに冒険を終える" },
  { name: "純粋な探検家", icon: "trophy_g", hint: "ナゾをひとつも取らずに冒険を終える" },
  { name: "全問正解", icon: "trophy_g", hint: "取ったナゾをすべて解き明かす" },
  { name: "ナゾコレクター", icon: "trophy_g", hint: "ナゾを7個以上集める" },
  { name: "スーパーナゾコレクター", icon: "trophy_g", hint: "ナゾを10個以上集める" },
  { name: "パーフェクトスピード", icon: "god_g", hint: "無傷のままクイッククルーズを達成" },
  { name: "アルティメットタンケンカ", icon: "god_g", hint: "パーフェクトスピードを純粋な探検家で達成" },
  { name: "パーフェクトソルバー", icon: "god_g", hint: "無傷・全問正解・スーパーナゾコレクターを同時に達成" },
  { name: "オクトパスからの生還", icon: "tako_s", hint: "川の主から生還する", secret: true },
  { name: "ロブスターからの生還", icon: "lobster_s", hint: "川の主から生還する", secret: true },
  { name: "トーテムからの生還", icon: "totem_s", hint: "川の主から生還する", secret: true },
  { name: "クロコダイルからの生還", icon: "wani_s", hint: "川の主から生還する", secret: true },
  { name: "トータスからの生還", icon: "kame_s", hint: "川の主から生還する", secret: true },
  { name: "集中砲火", icon: "tako_g", hint: "川の主の秘密を暴く", secret: true },
  { name: "おおきなはさみ", icon: "lobster_g", hint: "川の主の秘密を暴く", secret: true },
  { name: "キドアイラク", icon: "totem_g", hint: "川の主の秘密を暴く", secret: true },
  { name: "口の中の急所", icon: "wani_g", hint: "川の主の秘密を暴く", secret: true },
  { name: "水に流して", icon: "kame_g", hint: "川の主の秘密を暴く", secret: true },
  { name: "まぼろしの回転草", icon: "trophy_g", hint: "最後の川で見つかる", secret: true },
  { name: "オールチェイン", icon: "trophy_g", hint: "最後の川で見つかる", secret: true },
  { name: "オールスリー", icon: "trophy_g", hint: "最後の川で見つかる", secret: true },
  { name: "優柔不断", icon: "trophy_g", hint: "最後の川で見つかる", secret: true },
  { name: "大いなる秘密", icon: "god_g", hint: "？？？", secret: true },
];

const kana = [..."あいうえおかきくけこさしすせそたちつてとなにぬねのはひふへほまみむめもやゆよらりるれろわをん"];
const checkDigits = ["たを", "ちぬ", "つろ", "てむ", "とゆ", "まに", "みれ", "むる", "めを", "もぬ"];
const STORAGE_KEY = "nazoriver.trophies";

export function newRun(): RunStats {
  return { routeNum: 0, speedUps: 0, noDamage: true, totalQuestions: 0, allCorrect: true, bossFlag: 0, bossSecretFlag: 0, third: 0, secretList: [] };
}

export function loadEarned(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const list = raw ? (JSON.parse(raw) as unknown) : [];
    return new Set(Array.isArray(list) ? list.filter((item): item is string => typeof item === "string") : []);
  } catch {
    return new Set();
  }
}

function saveEarned(earned: Set<string>): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...earned]));
  } catch {
    // Storage may be unavailable (private mode); the run record still shows.
  }
}

export function encodePassword(num: number): string {
  const digit = (value: number) => kana[Math.floor(value) % kana.length];
  return (
    digit(num / 46 ** 3) +
    digit((num % 46 ** 3) / 46 ** 2) +
    digit((num % 46 ** 2) / 46) +
    digit(num % 46) +
    checkDigits[num % 10]
  );
}

// ResultScript.SetTrophyList for the result image `fileName` (clear_* / failed_*).
export function buildRecord(stats: RunStats, fileName: string): RunRecord {
  const failed = fileName.includes("failed");
  const has = (name: string) => list.some((item) => item.name === name);
  const drop = (...names: string[]) => {
    list = list.filter((item) => !names.includes(item.name));
  };
  let list: Trophy[] = [];
  let num = 3456 * stats.routeNum;

  const bossTrophy: Record<number, Trophy> = {
    1: { name: "オクトパスからの生還", icon: "tako_s" },
    2: { name: "ロブスターからの生還", icon: "lobster_s" },
    3: { name: "トーテムからの生還", icon: "totem_s" },
    4: { name: "クロコダイルからの生還", icon: "wani_s" },
    5: { name: "トータスからの生還", icon: "kame_s" },
    6: { name: "大いなる秘密", icon: "god_g" },
  };
  if (bossTrophy[stats.bossFlag]) list.push(bossTrophy[stats.bossFlag]);
  num += 576 * stats.bossFlag;

  const secretTrophy: Record<number, Trophy> = {
    1: { name: "集中砲火", icon: "tako_g" },
    2: { name: "おおきなはさみ", icon: "lobster_g" },
    3: { name: "キドアイラク", icon: "totem_g" },
    4: { name: "口の中の急所", icon: "wani_g" },
    5: { name: "水に流して", icon: "kame_g" },
  };
  if (secretTrophy[stats.bossSecretFlag]) list.push(secretTrophy[stats.bossSecretFlag]);

  num += 27648 * stats.third;
  const thirdTrophy: Record<number, Trophy> = {
    1: { name: "まぼろしの回転草", icon: "trophy_g" },
    2: { name: "オールチェイン", icon: "trophy_g" },
    3: { name: "オールスリー", icon: "trophy_g" },
    4: { name: "優柔不断", icon: "trophy_g" },
  };
  if (thirdTrophy[stats.third]) list.push(thirdTrophy[stats.third]);
  num += 96 * stats.bossSecretFlag;

  let speedNum = 0;
  if (stats.speedUps === 0) {
    list.push({ name: "のんびりクルーズ", icon: "trophy_g" });
    speedNum = 1;
  } else if (stats.speedUps >= 20) {
    list.push({ name: "クイッククルーズ", icon: "trophy_g" });
    speedNum = 2;
  }
  num += 32 * speedNum;

  if (stats.noDamage && !failed) {
    list.push({ name: "無傷の生還", icon: "trophy_g" });
    num += 16;
  }

  if (stats.totalQuestions === 0) {
    list.push({ name: "純粋な探検家", icon: "trophy_g" });
    num += 8;
  } else {
    if (stats.allCorrect) {
      list.push({ name: "全問正解", icon: "trophy_g" });
      num += 4;
    }
    if (stats.totalQuestions >= 7) {
      list.push({ name: "ナゾコレクター", icon: "trophy_g" });
      num += 2;
    }
    if (stats.totalQuestions >= 10) {
      list.push({ name: "スーパーナゾコレクター", icon: "trophy_g" });
      num += 1;
    }
  }

  let password = encodePassword(num);
  if (has("大いなる秘密")) {
    list = [bossTrophy[6]];
    password = "secret";
  }
  if (fileName === "failed_all") list = [];

  const earned = list.map((item) => item.name);
  if (has("無傷の生還") && has("クイッククルーズ")) {
    drop("無傷の生還", "クイッククルーズ");
    list.push({ name: "パーフェクトスピード", icon: "god_g" });
    earned.push("パーフェクトスピード");
    if (has("純粋な探検家")) {
      drop("純粋な探検家");
      list.push({ name: "アルティメットタンケンカ", icon: "god_g" });
      earned.push("アルティメットタンケンカ");
    }
  }
  if ((has("無傷の生還") || has("パーフェクトスピード")) && has("スーパーナゾコレクター") && has("全問正解")) {
    drop("無傷の生還", "スーパーナゾコレクター", "全問正解");
    list.push({ name: "パーフェクトソルバー", icon: "god_g" });
    earned.push("パーフェクトソルバー");
  }

  const stored = loadEarned();
  const fresh = new Set(earned.filter((name) => !stored.has(name)));
  for (const name of earned) stored.add(name);
  saveEarned(stored);

  return { trophies: list.slice(0, 8), earned, fresh, password, route: asset(`art/route/route_${stats.routeNum}.webp`) };
}
