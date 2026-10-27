import { stages } from "./data/stages";

const modeAreas = [
  { level: 20, name: "幻影の急流" },
  { level: 21, name: "繋がりの浅瀬" },
  { level: 22, name: "文字の河原" },
  { level: 23, name: "怪魚の淀み" },
  { level: 30, name: "オクトパス" },
  { level: 31, name: "ロブスター" },
  { level: 32, name: "トーテム" },
  { level: 33, name: "クロコダイル" },
  { level: 34, name: "トータス" },
  { level: 42, name: "裏の急流" },
  { level: 50, name: "裏ボスラッシュ" },
  { level: 510, name: "オクトパス改" },
  { level: 511, name: "ロブスター改" },
  { level: 513, name: "クロコダイル改" },
  { level: 514, name: "トータス改" },
  { level: 515, name: "神の石像" },
  { level: 60, name: "脱出" },
];

export const debugAreas = [
  ...stages.filter((stage) => stage.rows.length > 0).map((stage) => ({ level: stage.level, name: stage.name, tag: "川" })),
  ...modeAreas.map((area) => ({ ...area, tag: area.level >= 42 ? "裏" : area.level >= 30 ? "ボス" : "川3" })),
];

export function debugEnabled(): boolean {
  return new URLSearchParams(location.search).get("debug") === "true";
}
