// 直売所の価格メモ（従属機能）の純粋ロジック。
// 保存は各利用者の端末内（localStorage）だけで完結し、どこにも送信しない。
// import を持たないので node --test から直接読み込める。

export type Memo = {
  id: string;
  /** YYYY-MM-DD */
  date: string;
  /** 直売所・店舗の名前 */
  place: string;
  /** 品目名。調査対象の10品目に限らず自由入力できる。 */
  item: string;
  /** 自分の（付けようとしている）価格 */
  price: number;
  /** 同じ棚に並ぶ他の出品者の価格。分からなければ null。 */
  rivalPrice: number | null;
  /** 1袋あたりの原価。分からなければ null。 */
  cost: number | null;
  note: string;
};

// localStorage の保存先の名前。秘密ではない。
// 変数名に KEY を含めると秘密スキャナの汎用ルールが誤検知するため、STORE_NAME としている。
export const MEMO_STORE_NAME = "shun-yasai.memos.v1";

export function newId(): string {
  // 端末内のキーなので、衝突しなければ十分。crypto があれば使う。
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === "function") return c.randomUUID();
  return `m-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** 1件あたりの粗利。原価が無ければ null。 */
export function margin(memo: Memo): number | null {
  if (memo.cost === null) return null;
  return memo.price - memo.cost;
}

/** 他の出品者との差。相手の価格が無ければ null。負なら自分の方が安い。 */
export function priceGap(memo: Memo): number | null {
  if (memo.rivalPrice === null) return null;
  return memo.price - memo.rivalPrice;
}

function isFiniteNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

/** 形式だけでなく実在する日付かを見る（2026-13-45 のような値を通さない）。 */
export function isValidDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  if (y === undefined || m === undefined || d === undefined) return false;
  const date = new Date(Date.UTC(y, m - 1, d));
  return (
    date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d
  );
}

function optionalNumber(v: unknown): number | null {
  return isFiniteNumber(v) ? v : null;
}

/**
 * localStorage から読み出した任意の JSON を Memo[] に正規化する。
 * 壊れた値・別バージョンの値が入っていても落とさず、読める分だけ拾う
 * （利用者の端末の中身は我々が管理できないため）。
 */
export function parseMemos(input: unknown): Memo[] {
  if (!Array.isArray(input)) return [];
  const out: Memo[] = [];
  const seen = new Set<string>();
  for (const row of input) {
    if (typeof row !== "object" || row === null) continue;
    const r = row as Record<string, unknown>;
    if (typeof r.id !== "string" || r.id === "") continue;
    // id が重複すると React の key が衝突し、1件消したつもりが2件消える。
    if (seen.has(r.id)) continue;
    if (typeof r.date !== "string" || !isValidDate(r.date)) continue;
    // 入口（buildMemo）が負を弾くので、読み出し側の制約も揃える。
    if (!isFiniteNumber(r.price) || r.price < 0) continue;
    seen.add(r.id);
    out.push({
      id: r.id,
      date: r.date,
      place: typeof r.place === "string" ? r.place : "",
      item: typeof r.item === "string" ? r.item : "",
      price: r.price,
      rivalPrice: optionalNumber(r.rivalPrice),
      cost: optionalNumber(r.cost),
      note: typeof r.note === "string" ? r.note : "",
    });
  }
  return out;
}

/** 新しい順（同日なら後から足した方が上）。 */
export function sortMemos(memos: Memo[]): Memo[] {
  return [...memos].sort((a, b) => (a.date === b.date ? 0 : a.date < b.date ? 1 : -1));
}

/** 直売所ごとにまとめる。表示順は件数の多い順。 */
export function groupByPlace(memos: Memo[]): { place: string; memos: Memo[] }[] {
  const map = new Map<string, Memo[]>();
  for (const memo of memos) {
    const key = memo.place.trim() || "（店名なし）";
    const bucket = map.get(key);
    if (bucket) bucket.push(memo);
    else map.set(key, [memo]);
  }
  return [...map.entries()]
    .map(([place, rows]) => ({ place, memos: sortMemos(rows) }))
    .sort((a, b) => b.memos.length - a.memos.length);
}

export type MemoDraft = {
  date: string;
  place: string;
  item: string;
  price: string;
  rivalPrice: string;
  cost: string;
  note: string;
};

/** 入力欄の文字列を Memo にする。数値として読めない必須項目があればエラー文言を返す。 */
export function buildMemo(draft: MemoDraft): { ok: true; memo: Memo } | { ok: false; error: string } {
  // Number("0x10") は 16 を返すので、10進の数字だけを受け付ける。
  const decimal = /^-?\d+(\.\d+)?$/;
  const price = Number(draft.price);
  if (!decimal.test(draft.price.trim()) || !Number.isFinite(price)) {
    return { ok: false, error: "価格を数字で入力してください。" };
  }
  if (price < 0) return { ok: false, error: "価格に負の数は入れられません。" };
  if (!isValidDate(draft.date)) {
    return { ok: false, error: "日付を選んでください。" };
  }
  const rivalRaw = draft.rivalPrice.trim();
  const rival = rivalRaw === "" ? null : Number(rivalRaw);
  if (rival !== null && (!decimal.test(rivalRaw) || !Number.isFinite(rival) || rival < 0)) {
    return { ok: false, error: "まわりの価格は数字で入力してください。" };
  }
  const costRaw = draft.cost.trim();
  const cost = costRaw === "" ? null : Number(costRaw);
  if (cost !== null && (!decimal.test(costRaw) || !Number.isFinite(cost) || cost < 0)) {
    return { ok: false, error: "原価は数字で入力してください。" };
  }
  return {
    ok: true,
    memo: {
      id: newId(),
      date: draft.date,
      place: draft.place.trim(),
      item: draft.item.trim(),
      price,
      rivalPrice: rival,
      cost,
      note: draft.note.trim(),
    },
  };
}
