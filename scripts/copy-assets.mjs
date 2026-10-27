import fs from "fs";
import path from "path";
import sharp from "sharp";

const unityRoot = [
  "/mnt/c/ProgramWork_local/NazoRiver_Unity/nazoriver-main/nazoriver-main/NazoRiver/Assets",
  "C:/ProgramWork_local/NazoRiver_Unity/nazoriver-main/nazoriver-main/NazoRiver/Assets",
].find((dir) => fs.existsSync(dir));
if (!unityRoot) throw new Error("Unity project not found");

const from = (...parts) => path.join(unityRoot, ...parts);
const pub = (...parts) => path.join("public", ...parts);

function copy(src, dest) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
}

const ui = {
  "Sprites/ui": [
    "heart_red.webp",
    "heart_black.webp",
    "bar-back_black.webp",
    "arrow_back_left.webp",
    "arrow_back_right.webp",
    "nazoget.webp",
    "seikai.webp",
    "zannen.webp",
    "popup_1.webp",
    "popup_2.webp",
    "popup_3.webp",
    "popup_start.webp",
    "popup_go.webp",
    "popup_shukkou.webp",
    "wakaremichida.webp",
    "shuchusen_1.webp",
    "shuchusen_2.webp",
    "shuchusen_3.webp",
    "kaze_left.webp",
    "kaze_right.webp",
    "nazo_back_normal.webp",
    "answerarea_back.webp",
    "waiting.webp",
    "nazowotokou.webp",
    "boat.webp",
    ...["ul", "ur", "dl", "dr"].flatMap((corner) => [`off_${corner}.webp`, `on_${corner}.webp`]),
  ],
  "Resources/ui": [
    "bar_white.webp",
    "arrow_left.webp",
    "arrow_right.webp",
    "arrow_left_yellow.webp",
    "arrow_right_yellow.webp",
    ...Array.from({ length: 10 }, (_, i) => `q${i + 1}.webp`),
  ],
  "Resources/inst": [
    "iwaba.webp",
    "keikoku.webp",
    "kawara.webp",
    "kaigyo.webp",
    "kyuryu.webp",
    "asase.webp",
    "nazotokitime_end.webp",
  ],
  "Resources/route": ["branch_0.webp", "branch_10.webp", "branch_11.webp", "branch_20.webp", "branch_21.webp", "branch_22.webp", "branch_23.webp"],
  Sprites: ["BigCircle.webp"],
};
for (const [dir, files] of Object.entries(ui)) {
  for (const file of files) copy(from(dir, file), pub("art", file));
}
copy(from("Sprites/ui", "result.webp"), pub("art", "result.webp"));

const mirrored = [
  ...["angry", "failed", "lastBoss", "question", "question_dochu", "shiritori", "silhouette", "tako", "totem", "wani", "inst", "gate", "ui", "route", "bgm", "se"].map(
    (dir) => `Resources/${dir}`,
  ),
  ...["wani", "tako", "kame", "totem", "lobster", "lastBoss", "ui", "apple"].map((dir) => `Sprites/${dir}`),
  "Sprites/ura_sky.webp",
  "Sprites/ura_sky_mirror.webp",
];
function mirror(rel) {
  const src = from(rel);
  if (!fs.existsSync(src)) return;
  if (fs.statSync(src).isDirectory()) {
    for (const name of fs.readdirSync(src)) if (!name.endsWith(".meta")) mirror(path.posix.join(rel, name));
    return;
  }
  if (!/\.(png|jpg|jpeg|mp3|wav|ogg)$/i.test(rel)) return;
  const dest = pub("u", rel);
  if (fs.existsSync(dest) && fs.statSync(dest).size === fs.statSync(src).size) return;
  copy(src, dest);
}
for (const rel of mirrored) mirror(rel);
for (let i = 0; i < 8; i++) copy(from("Resources/route", `route_${i}.webp`), pub("art", "route", `route_${i}.webp`));
for (const file of fs.readdirSync(from("Resources/trophy"))) {
  if (file.endsWith(".webp")) copy(from("Resources/trophy", file), pub("art", "trophy", file));
}

const world = [
  "stone_1.webp",
  "stone_3.webp",
  "stone_4.webp",
  "stone_5.webp",
  "tree_1.webp",
  "tree_7.webp",
  "tree_8.webp",
  "tree_10.webp",
];
for (const file of world) copy(from("Sprites/ui", file), pub("world", file));

const gates = [
  "treegate_iwaba.webp",
  "treegate_keikoku.webp",
  "treegate_kyuryu.webp",
  "treegate_asase.webp",
  "treegate_kawara.webp",
  "treegate_kaigyo.webp",
];
for (const file of gates) copy(from("Resources/gate", file), pub("gates", file));

const fonts = ["WanpakuRuikaSeikyo-05.TTF", "NotoSansJP-Medium.otf", "IPAEXG.TTF"];
for (const file of fonts) copy(from("Sprites/fonts", file), pub("fonts", file));

for (const file of ["river.mp3", "question.mp3", "op.mp3", "tako.mp3", "wani.mp3", "kame.mp3", "totem.mp3", "zari.mp3", "uraboss.mp3", "urariver.mp3"]) {
  copy(from("Resources/bgm", file), pub("audio", file));
}
const se = [
  "321pua-.wav",
  "pi.mp3",
  "bashi.mp3",
  "wind.mp3",
  "byu-.mp3",
  "syukin.mp3",
  "bird.mp3",
  "piropiropiron.mp3",
  "bu.mp3",
  "deden.mp3",
  "hoyiyi.mp3",
  "kata.wav",
  "pinpon.mp3",
  "fanfare.mp3",
  "pua-.mp3",
  "shakin.mp3",
  "fon.mp3",
  "powa.mp3",
  "bukubuku.mp3",
  "chakin.mp3",
  "kick.mp3",
];
for (const file of se) copy(from("Resources/se", file), pub("audio", file));

// Unity 6-sided skybox faces, in three.js cube order px, nx, py, ny, pz, nz.
// Unity z is flipped to three -z, so Unity front (+Z) becomes three nz.
const skyFaces = [
  ["SkyBox02b0002.tif", "px.jpg"],
  ["SkyBox02b0004.tif", "nx.jpg"],
  ["SkyBox02b0005.tif", "py.jpg"],
  ["SkyBox02b0006.tif", "ny.jpg"],
  ["SkyBox02b0003.tif", "pz.jpg"],
  ["SkyBox02b0001.tif", "nz.jpg"],
];
fs.mkdirSync(pub("sky"), { recursive: true });
for (const [src, dest] of skyFaces) {
  await sharp(from("Wispy Sky/Textures", src)).jpeg({ quality: 92 }).toFile(pub("sky", dest));
}

// Unity imports WaterBump.jpg as "normal map from grayscale"; bake the same here.
{
  const { data, info } = await sharp(from("Standard Assets/Environment/Water/Water/Textures/WaterBump.jpg"))
    .greyscale()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width, height } = info;
  const h = (x, y) => data[((y + height) % height) * width + ((x + width) % width)] / 255;
  const out = Buffer.alloc(width * height * 3);
  const strength = 0.6;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const dx =
        h(x + 1, y - 1) + 2 * h(x + 1, y) + h(x + 1, y + 1) - h(x - 1, y - 1) - 2 * h(x - 1, y) - h(x - 1, y + 1);
      const dy =
        h(x - 1, y + 1) + 2 * h(x, y + 1) + h(x + 1, y + 1) - h(x - 1, y - 1) - 2 * h(x, y - 1) - h(x + 1, y - 1);
      let nx = -dx * strength;
      let ny = -dy * strength;
      let nz = 1;
      const len = Math.hypot(nx, ny, nz);
      nx /= len;
      ny /= len;
      nz /= len;
      const i = (y * width + x) * 3;
      out[i] = Math.round((nx * 0.5 + 0.5) * 255);
      out[i + 1] = Math.round((ny * 0.5 + 0.5) * 255);
      out[i + 2] = Math.round((nz * 0.5 + 0.5) * 255);
    }
  }
  fs.mkdirSync(pub("water"), { recursive: true });
  await sharp(out, { raw: { width, height, channels: 3 } }).webp().toFile(pub("water", "bump.webp"));
}

// WaterFresnel.psd: the fresnel curve lives in the alpha channel of row 0.
{
  const buf = fs.readFileSync(from("Standard Assets/Environment/Water/Water/Textures/WaterFresnel.psd"));
  let p = 12;
  const channels = buf.readUInt16BE(p);
  const height = buf.readUInt32BE(p + 2);
  const width = buf.readUInt32BE(p + 6);
  p = 26;
  p += 4 + buf.readUInt32BE(p);
  p += 4 + buf.readUInt32BE(p);
  p += 4 + buf.readUInt32BE(p);
  const compression = buf.readUInt16BE(p);
  p += 2;
  const planes = [];
  if (compression === 0) {
    for (let c = 0; c < channels; c++) {
      planes.push(buf.subarray(p, p + width * height));
      p += width * height;
    }
  } else {
    const counts = [];
    for (let i = 0; i < channels * height; i++) {
      counts.push(buf.readUInt16BE(p));
      p += 2;
    }
    for (let c = 0; c < channels; c++) {
      const plane = Buffer.alloc(width * height);
      for (let row = 0; row < height; row++) {
        const end = p + counts[c * height + row];
        let o = row * width;
        while (p < end) {
          const n = buf.readInt8(p++);
          if (n >= 0) {
            buf.copy(plane, o, p, p + n + 1);
            p += n + 1;
            o += n + 1;
          } else if (n !== -128) {
            plane.fill(buf[p++], o, o + 1 - n);
            o += 1 - n;
          }
        }
      }
      planes.push(plane);
    }
  }
  const alpha = planes[Math.min(3, channels - 1)];
  const curve = Array.from(alpha.subarray(0, width));
  fs.writeFileSync(pub("water", "fresnel.json"), JSON.stringify(curve));
}

const questionSrc = from("Resources/question");
const questionFiles = fs.readFileSync("scripts/question-files.txt", "utf8").trim().split(/\r?\n/);
const missing = [];
for (const file of questionFiles) {
  const src = path.join(questionSrc, `${file}.webp`);
  if (!fs.existsSync(src)) {
    missing.push(file);
    continue;
  }
  copy(src, pub("questions", `${file}.webp`));
}

for (const dir of fs.readdirSync("public")) {
  const full = pub(dir);
  if (!fs.statSync(full).isDirectory()) continue;
  for (const file of fs.readdirSync(full)) {
    if (file.endsWith(":Zone.Identifier")) fs.rmSync(path.join(full, file));
  }
}

console.log(`questions ${questionFiles.length - missing.length}/${questionFiles.length}`);
if (missing.length) console.log("missing", missing.join(","));
