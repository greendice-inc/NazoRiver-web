import fs from "fs";

const source =
  "C:/ProgramWork_local/NazoRiver_Unity/nazoriver-main/nazoriver-main/NazoRiver/Assets/Scripts/StartScript.cs";
const text = fs.readFileSync(source, "utf8");
const re =
  /new Question\(\s*(\d+),\s*"([^"]+)",\s*new List<string>\{([^}]*)\},\s*"([^"]+)",\s*"([^"]+)"/g;

const rows = [];
let match;
while ((match = re.exec(text))) {
  const answers = [...match[3].matchAll(/"([^"]*)"/g)]
    .map((item) => item[1])
    .filter(Boolean);
  rows.push({
    id: Number(match[1]),
    file: match[2],
    answers,
    area: match[4],
    type: match[5],
  });
}

const want = rows.filter(
  (row) =>
    row.area === "道中" &&
    (row.type === "道1" || row.type === "道2左" || row.type === "道2右"),
);

const counts = {};
for (const row of want) counts[row.type] = (counts[row.type] ?? 0) + 1;
console.log(JSON.stringify({ parsed: rows.length, want: want.length, counts }));

fs.mkdirSync("src/data", { recursive: true });
const body =
  "export type Question = {\n" +
  "  id: number;\n" +
  "  file: string;\n" +
  "  answers: string[];\n" +
  "  type: \"道1\" | \"道2左\" | \"道2右\";\n" +
  "};\n\n" +
  "export const questions: Question[] = " +
  JSON.stringify(
    want.map((row) => ({
      id: row.id,
      file: row.file,
      answers: row.answers,
      type: row.type,
    })),
    null,
    2,
  ) +
  ";\n";
fs.writeFileSync("src/data/questions.ts", body);

const files = [...new Set(want.map((row) => row.file))];
fs.writeFileSync("scripts/question-files.txt", files.join("\n"));
console.log("files", files.length);
