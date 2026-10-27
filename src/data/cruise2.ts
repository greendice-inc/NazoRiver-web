export type CharGame = {
  id: number;
  rows: string[];
  answers: string[];
};

export type PiranhaGame = {
  id: number;
  labels: string[];
  attacks: number[];
};

export type SilhouetteGame = {
  id: number;
  file: number;
  answer: number[];
};

export type ShiritoriCell = {
  line: number;
  lane: number;
  words: string[];
};

export const charGames: CharGame[] = [
  { id: 1, rows: ["ぞさ-くき", "る-か-り", "なうまん-"], answers: ["さる", "ぞう", "くま", "きりん", "さかな"] },
  { id: 2, rows: ["さあ-きう", "ばゆくや-", "-らめ-り"], answers: ["さくら", "あやめ", "ばら", "ゆり", "うめ", "きく", "くり", "うり", "きり"] },
  { id: 3, rows: ["れ-にかと", "うま-なた", "らすりとぶ"], answers: ["れたす", "かぶ", "にら", "とまと", "なす", "うり"] },
  { id: 4, rows: ["ばく-きそ", "しり-るい", "まくす-や"], answers: ["くるま", "そり", "ばいく", "きしや", "ばす", "ばしや"] },
  { id: 5, rows: ["-ぽ-ばと", "た-ますり", "とらい-こ"], answers: ["ぽすと", "とまと", "たこ", "ばら", "とりい", "たい"] },
  { id: 6, rows: ["あま-こた", "りーいま-", "んご-やす"], answers: ["つき", "こいん", "たいや", "ぼーる", "たまご", "あーす", "まり", "たま"] },
  { id: 7, rows: ["-かすうほ", "らのく-に", "み-ろりす"], answers: ["からす", "ほくろ", "ごりら", "すみ", "のり", "うに", "すす"] },
  { id: 8, rows: ["-みあめゆ", "た-くみは", "びまし-ち"], answers: ["ゆび", "くち", "はな", "め", "みみ", "くび", "あし", "は", "あたま", "くま"] },
  { id: 9, rows: ["木火月日金", "田-丁-月", "月寺-市木"], answers: ["木木", "木市", "日寺", "日月", "月月", "月市", "火田", "火丁", "金丁", "金田", "木月月"] },
];

export const piranhaGames: PiranhaGame[] = [
  { id: 1, labels: ["春", "秋", "夏", "冬"], attacks: [2, 4] },
  { id: 2, labels: ["金", "日", "土", "月"], attacks: [2, 4] },
  { id: 3, labels: ["かえる", "へび", "いるか", "にわとり"], attacks: [2, 3] },
  { id: 5, labels: ["I", "K", "J", "L"], attacks: [2, 3] },
  { id: 6, labels: ["はさみ", "鉛筆", "服", "靴"], attacks: [1, 3] },
  { id: 7, labels: ["ナ", "レ", "ニ", "ロ"], attacks: [1, 4] },
  { id: 8, labels: ["トマル", "カエル", "ツル", "アゲル"], attacks: [2, 3] },
  { id: 9, labels: ["ネ", "酉", "申", "己"], attacks: [2, 3] },
  { id: 10, labels: ["天", "虫", "穴", "工"], attacks: [3, 4] },
];

export const silhouetteGames: SilhouetteGame[] = [
  { id: 1, file: 1, answer: [1, 3, 2, 4] },
  { id: 2, file: 1, answer: [3, 4, 1, 2] },
  { id: 3, file: 2, answer: [4, 2, 3, 1] },
  { id: 4, file: 2, answer: [2, 1, 4, 3] },
  { id: 5, file: 3, answer: [1, 4, 2, 2] },
  { id: 6, file: 3, answer: [4, 2, 3, 1] },
  { id: 7, file: 4, answer: [2, 1, 4, 3] },
  { id: 8, file: 4, answer: [4, 2, 3, 1] },
  { id: 9, file: 5, answer: [1, 2, 3, 1] },
];

export const shiritoriCells: ShiritoriCell[] = [
  { line: 1, lane: 1, words: ["め"] },
  { line: 1, lane: 2, words: ["みみ"] },
  { line: 1, lane: 3, words: ["はな"] },
  { line: 1, lane: 4, words: ["くち"] },
  { line: 1, lane: 5, words: ["て"] },
  { line: 2, lane: 1, words: ["みせ"] },
  { line: 2, lane: 2, words: ["めーる", "てがみ"] },
  { line: 2, lane: 3, words: ["ちょこ"] },
  { line: 2, lane: 4, words: [""] },
  { line: 2, lane: 5, words: ["ないふ"] },
  { line: 3, lane: 1, words: [""] },
  { line: 3, lane: 2, words: ["こるく"] },
  { line: 3, lane: 3, words: ["みるく"] },
  { line: 3, lane: 4, words: ["ふきだし", "せりふ"] },
  { line: 3, lane: 5, words: ["こんぱす", "るーれっと"] },
  { line: 4, lane: 1, words: ["ふるーつ", "くだもの"] },
  { line: 4, lane: 2, words: ["すこっぷ", "しゃべる"] },
  { line: 4, lane: 3, words: [""] },
  { line: 4, lane: 4, words: ["すーつ"] },
  { line: 4, lane: 5, words: ["ふきだし", "とーく"] },
  { line: 5, lane: 1, words: ["つつ"] },
  { line: 5, lane: 2, words: ["ぷっしゅ"] },
  { line: 5, lane: 3, words: ["のーず"] },
  { line: 5, lane: 4, words: ["くつ", "しゅーず"] },
  { line: 5, lane: 5, words: ["るーじゅ", "くちべに"] },
  { line: 6, lane: 1, words: ["ずのう"] },
  { line: 6, lane: 2, words: ["つき"] },
  { line: 6, lane: 3, words: ["つらら", "ゆき"] },
  { line: 6, lane: 4, words: [""] },
  { line: 6, lane: 5, words: ["にんぎょ"] },
  { line: 7, lane: 1, words: [""] },
  { line: 7, lane: 2, words: ["うさぎ", "らびっと"] },
  { line: 7, lane: 3, words: ["よっと"] },
  { line: 7, lane: 4, words: ["きみ", "らんおう"] },
  { line: 7, lane: 5, words: [""] },
  { line: 8, lane: 1, words: ["みるく", "ぎゅうにゅう"] },
  { line: 8, lane: 2, words: [""] },
  { line: 8, lane: 3, words: ["うでどけい", "とけい"] },
  { line: 8, lane: 4, words: [""] },
  { line: 8, lane: 5, words: ["ぎんが", "うずまき"] },
  { line: 9, lane: 1, words: [""] },
  { line: 9, lane: 2, words: ["くらりねっと", "がっき"] },
  { line: 9, lane: 3, words: ["きゃっと", "いりおもてやまねこ"] },
  { line: 9, lane: 4, words: ["くろーぜっと", "いしょうべや"] },
  { line: 9, lane: 5, words: ["うえきばち", "くさ"] },
  { line: 10, lane: 1, words: ["ちらしずし"] },
  { line: 10, lane: 2, words: ["きっぷ"] },
  { line: 10, lane: 3, words: ["とらんぷ", "きんぐ"] },
  { line: 10, lane: 4, words: ["とびうお", "さかな"] },
  { line: 10, lane: 5, words: ["やじるし"] },
  { line: 11, lane: 1, words: ["ぐろーぶ"] },
  { line: 11, lane: 2, words: ["ないと"] },
  { line: 11, lane: 3, words: ["しょうかき"] },
  { line: 11, lane: 4, words: [""] },
  { line: 11, lane: 5, words: ["ぷれぜんと", "おくりもの"] },
  { line: 12, lane: 1, words: ["きじ", "とり"] },
  { line: 12, lane: 2, words: ["きかんしゃ", "のりもの"] },
  { line: 12, lane: 3, words: [""] },
  { line: 12, lane: 4, words: ["のり", "ぶんぼうぐ"] },
  { line: 12, lane: 5, words: [""] },
  { line: 13, lane: 1, words: ["のこぎり"] },
  { line: 13, lane: 2, words: ["やきりんご", "りんご"] },
  { line: 13, lane: 3, words: [""] },
  { line: 13, lane: 4, words: [""] },
  { line: 13, lane: 5, words: ["じゅーす", "ぐらす"] },
  { line: 14, lane: 1, words: ["ごかくけい"] },
  { line: 14, lane: 2, words: [""] },
  { line: 14, lane: 3, words: ["すなぶろ"] },
  { line: 14, lane: 4, words: [""] },
  { line: 14, lane: 5, words: ["りす"] },
  { line: 15, lane: 1, words: ["いわ", "ろっく", "すとーん"] },
  { line: 15, lane: 2, words: ["みかん"] },
  { line: 15, lane: 3, words: ["いわ", "ろっく", "すとーん"] },
  { line: 15, lane: 4, words: ["ふらいぱん"] },
  { line: 15, lane: 5, words: ["いわ", "ろっく", "すとーん"] },
];

export const komoji: Record<string, string> = {
  ぁ: "あ",
  ぃ: "い",
  ぅ: "う",
  ぇ: "え",
  ぉ: "お",
  っ: "つ",
  ゃ: "や",
  ゅ: "ゆ",
  ょ: "よ",
};

export const silhouetteDir = ["front-left", "back-left", "front-right", "back-right"] as const;
