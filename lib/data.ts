import raw from "@/data/prices.json";
import {
  bandOf,
  compareForList,
  latestReading,
  monthlyStats,
  type Item,
  type MonthStat,
  type Reading,
  type Band,
} from "./logic";

export type Source = {
  name: string;
  page: string;
  file: string;
  licence: string;
  retrieved: string;
  /** 全品目に共通する価格の単位（公開元の表題から取り込む）。 */
  unit: string;
  note: string;
};

type Dataset = {
  source: Source;
  items: Item[];
  weeks: string[];
  series: Record<string, Reading[]>;
};

const data = raw as Dataset;

export const source: Source = data.source;
export const items: Item[] = data.items;

/** 調査全体で最も新しい週。品目ごとの最新週とは限らない（季節品目は時期外に調査が無い）。 */
export const latestWeek: string = data.weeks[data.weeks.length - 1] ?? "";

export function readings(itemId: string): Reading[] {
  return data.series[itemId] ?? [];
}

export function itemById(itemId: string): Item | undefined {
  return items.find((i) => i.id === itemId);
}

export type Latest = {
  item: Item;
  /** その品目で価格が入っている最も新しい週。時期外の品目は数週間〜数か月前になる。 */
  reading: Reading | null;
  band: Band | null;
  /** 調査全体の最新週にこの品目の数字が無い＝いまは調査時期外。 */
  outOfSeason: boolean;
};

export function latestOf(item: Item): Latest {
  const reading = latestReading(readings(item.id));
  return {
    item,
    reading,
    band: bandOf(reading?.ratio ?? null),
    outOfSeason: reading === null || reading.week !== latestWeek,
  };
}

export function latestAll(): Latest[] {
  return items
    .map(latestOf)
    .sort((a, b) =>
      compareForList(
        { outOfSeason: a.outOfSeason, ratio: a.reading?.ratio ?? null },
        { outOfSeason: b.outOfSeason, ratio: b.reading?.ratio ?? null },
      ),
    );
}

export function statsFor(itemId: string): MonthStat[] {
  return monthlyStats(readings(itemId));
}

/** 例年その月に安く買える品目（月別ページ用）。relative が小さい順。 */
export function itemsCheapInMonth(month: number): { item: Item; stat: MonthStat }[] {
  const out: { item: Item; stat: MonthStat }[] = [];
  for (const item of items) {
    const stat = statsFor(item.id).find((s) => s.month === month);
    if (stat && stat.relative !== null) out.push({ item, stat });
  }
  return out.sort((a, b) => (a.stat.relative ?? 9) - (b.stat.relative ?? 9));
}

export type { Item, Reading, MonthStat, Band };
export {
  BAND_LABEL,
  BAND_THRESHOLD,
  bandOf,
  deviationPercent,
  formatPrice,
  formatWeek,
} from "./logic";
