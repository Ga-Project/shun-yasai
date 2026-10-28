// 価格データの読み解きだけを行う純粋関数群。
// import を持たないので、ビルドを通さずに node --test から直接読み込める
// （Node の型ストリップが効く条件＝バンドラ固有の解決に依存しない）。
// データの受け渡しは引数で行い、このファイルは JSON を知らない。

export type Reading = {
  week: string;
  price: number | null;
  ratio: number | null;
};

export type Item = {
  id: string;
  name: string;
};

/**
 * 平年比の帯。平年比は「平年（例年の同時期）の価格に対する比率」で 1.00 が平年並み。
 * ±5% を境にしているのは、週次の小売価格がこの程度は平常時も動くため。
 */
export type Band = "cheap" | "normal" | "expensive";

/** 月ページの月（1〜12）。月ページ・サイトマップ・トップの月リンクが同じ配列を見る。 */
export const MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

export const BAND_THRESHOLD = { cheap: 0.95, expensive: 1.05 } as const;

export const BAND_LABEL: Record<Band, string> = {
  cheap: "平年より安い",
  normal: "平年並み",
  expensive: "平年より高い",
};

export function bandOf(ratio: number | null): Band | null {
  if (ratio === null) return null;
  if (ratio < BAND_THRESHOLD.cheap) return "cheap";
  if (ratio > BAND_THRESHOLD.expensive) return "expensive";
  return "normal";
}

/** 平年比 1.12 を「12（%高い）」のように読める整数へ。 */
export function deviationPercent(ratio: number): number {
  return Math.round((ratio - 1) * 100);
}

/** 価格が入っている最も新しい週の行。全て欠測なら null。 */
export function latestReading(rows: Reading[]): Reading | null {
  for (let i = rows.length - 1; i >= 0; i -= 1) {
    const row = rows[i];
    if (row && row.price !== null) return row;
  }
  return null;
}

export type MonthStat = {
  /** 1-12 */
  month: number;
  averagePrice: number | null;
  /** 全月平均に対する比。1 未満なら例年その月は安い。 */
  relative: number | null;
  samples: number;
};

/**
 * 月ごとの平均小売価格。複数年ぶんをまとめるので「例年この月は安いか」を表す。
 * 平年比ではなく実価格を使う。平年比は平年（＝同時期の平均）との比なので、
 * 季節性が既に相殺されていて月ごとの高低が消えてしまう。
 */
export function monthlyStats(rows: Reading[]): MonthStat[] {
  const buckets = new Map<number, number[]>();
  for (const row of rows) {
    if (row.price === null) continue;
    const month = Number(row.week.slice(5, 7));
    const bucket = buckets.get(month);
    if (bucket) bucket.push(row.price);
    else buckets.set(month, [row.price]);
  }

  const averages = new Map<number, number>();
  for (const [month, values] of buckets) {
    averages.set(month, values.reduce((a, b) => a + b, 0) / values.length);
  }
  const all = [...averages.values()];
  const overall = all.length ? all.reduce((a, b) => a + b, 0) / all.length : null;

  const out: MonthStat[] = [];
  for (let month = 1; month <= 12; month += 1) {
    const average = averages.get(month) ?? null;
    out.push({
      month,
      averagePrice: average === null ? null : Math.round(average),
      relative: average === null || overall === null ? null : average / overall,
      samples: buckets.get(month)?.length ?? 0,
    });
  }
  return out;
}

/**
 * 一覧の並び順を決める比較関数。安い順（平年比の小さい順）に並べ、
 * 時期外（最新週に数字が無い）品目は後ろへ送る。
 * 「いま何が買い時か」が一覧の主題なので、比較できない品目を上に混ぜない。
 */
export function compareForList(
  a: { outOfSeason: boolean; ratio: number | null },
  b: { outOfSeason: boolean; ratio: number | null },
): number {
  if (a.outOfSeason !== b.outOfSeason) return a.outOfSeason ? 1 : -1;
  if (a.ratio === null) return b.ratio === null ? 0 : 1;
  if (b.ratio === null) return -1;
  return a.ratio - b.ratio;
}

/**
 * 直近 n 週ぶん。**欠測行をそのまま残す。**
 * 図に渡すのは必ずこちら。欠測を取り除いてから渡すと、調査対象外の期間が
 * 詰められて前後が地続きに見え、線でつないでいないつもりでもつながってしまう。
 */
export function recentWeeks(rows: Reading[], weeks: number): Reading[] {
  return rows.slice(-weeks);
}

/**
 * 欠測で分断した連続区間と、その隙間を返す。
 * 線形補間は統計の改竄になるので、欠測をまたいで点をつながない。
 * 判定を純粋関数に出しておくのは、描画側に置くとテストから触れなくなるため
 * （実際、描画側に置いていた分断は一度も実行されないまま気づかれなかった）。
 */
export function splitSegments(rows: Reading[]): {
  segments: { index: number; ratio: number }[][];
  gaps: { fromIndex: number; toIndex: number }[];
} {
  const segments: { index: number; ratio: number }[][] = [];
  const gaps: { fromIndex: number; toIndex: number }[] = [];
  let current: { index: number; ratio: number }[] = [];
  let gapStart: number | null = null;

  rows.forEach((row, index) => {
    if (row.ratio === null || row.price === null) {
      if (current.length) {
        segments.push(current);
        current = [];
      }
      if (gapStart === null) gapStart = index;
      return;
    }
    if (gapStart !== null) {
      gaps.push({ fromIndex: gapStart, toIndex: index });
      gapStart = null;
    }
    current.push({ index, ratio: row.ratio });
  });
  if (current.length) segments.push(current);
  if (gapStart !== null) gaps.push({ fromIndex: gapStart, toIndex: rows.length - 1 });
  return { segments, gaps };
}

/** 表示の上限で頭打ちになったか。頭打ちは図の上で必ず明示する。 */
export function cappedAt(ratio: number, low: number, high: number): "low" | "high" | null {
  const d = Math.log2(ratio);
  if (d > high) return "high";
  if (d < low) return "low";
  return null;
}

/**
 * 平年比を log2 の表示範囲へ収める。基準からの距離が同じなら
 * 「2倍」と「半分」が等距離になる。頭打ちかどうかも一緒に返す。
 */
export function plotPosition(
  ratio: number,
  cap = 1,
): { d: number; capped: "low" | "high" | null } {
  const capped = cappedAt(ratio, -cap, cap);
  const raw = Math.log2(ratio);
  return { d: Math.max(-cap, Math.min(cap, raw)), capped };
}

/** 2026-08-24 → 「2026年8月24日の週」。形式が違えばそのまま返す（NaN を表示しない）。 */
export function formatWeek(week: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(week);
  if (!m) return week;
  return `${Number(m[1])}年${Number(m[2])}月${Number(m[3])}日の週`;
}

export function formatPrice(price: number): string {
  return price.toLocaleString("ja-JP");
}

/**
 * 平年との差を符号つきで表す。全画面でこれを使う。
 * マイナスは U+2212（−）。ASCII のハイフンだと等幅数字の字幅と揃わない。
 */
export function signedPercent(percent: number): string {
  if (percent === 0) return "±0%";
  return percent > 0 ? `+${percent}%` : `−${Math.abs(percent)}%`;
}

