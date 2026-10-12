import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DatumPlot } from "@/components/DatumPlot";
import { MonthBand } from "@/components/MonthBand";
import { PriceLine } from "@/components/PriceLine";
import { StallMemo } from "@/components/StallMemo";
import { TrendRibbon } from "@/components/TrendRibbon";
import { items, itemById, latestOf, latestAll, readings, statsFor, source } from "@/lib/data";
import { BAND_LABEL, deviationPercent, formatPrice, formatWeek, recentWeeks, signedPercent } from "@/lib/logic";

export function generateStaticParams() {
  return items.map((item) => ({ id: item.id }));
}

/**
 * 見出しで「いま」と言えるのは、今週その品目が調査された場合だけ。
 * 出回り期を外れた品目の最新値は数週間〜数か月前のものなので、現在の話として書かない。
 */
function headlineFor(name: string, latest: ReturnType<typeof latestOf>): string {
  const ratio = latest.reading?.ratio ?? null;
  if (ratio === null) return `${name}の値段と平年比`;
  if (latest.outOfSeason) return `${name}の値段と平年比（今週は調査対象外）`;
  const percent = deviationPercent(ratio);
  if (percent === 0) return `${name}の値段は、いま平年並み`;
  return `${name}の値段は、いま平年より ${Math.abs(percent)}% ${percent > 0 ? "高い" : "安い"}`;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const item = itemById(id);
  if (!item) return { title: "見つかりません" };
  const latest = latestOf(item);
  const headline = headlineFor(item.name, latest);
  return {
    title: headline,
    description: `${item.name}の小売価格と平年比を、農林水産省の公的統計から確認できます。例年安くなる月もあわせて掲載しています。`,
  };
}

export default async function ItemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const item = itemById(id);
  if (!item) notFound();

  const latest = latestOf(item);
  const rows = readings(item.id);
  const stats = statsFor(item.id);


  return (
    <>
      <div className="wrap">
        <section className="section">
          <h1>{headlineFor(item.name, latest)}</h1>
          <p className="meta">
            {latest.reading ? formatWeek(latest.reading.week) : "—"}（調査分）／{" "}
            {latest.reading?.price != null ? `${formatPrice(latest.reading.price)}円/kg` : "—"}
            <br />
            全国平均・税込・特売を除く
            {latest.outOfSeason ? "／この品目は今週は調査対象外です（表示は直近の調査週）" : ""}
          </p>
          {latest.band ? (
            <p className={`state state--${latest.outOfSeason ? "none" : latest.band}`}>
              {latest.outOfSeason
                ? `前回の調査では ${BAND_LABEL[latest.band]}`
                : BAND_LABEL[latest.band]}
            </p>
          ) : null}
        </section>

        <section className="section">
          <h2 className="section__h">
            {latest.outOfSeason ? "前回の調査週の位置" : "今週の位置"}
          </h2>
          <DatumPlot
            rows={[latest]}
            compact
            title={
              latest.outOfSeason
                ? `${item.name}の前回調査週の平年比`
                : `${item.name}の今週の平年比`
            }
          />
        </section>

        <section className="section">
          <h2 className="section__h">平年比のうつりかわり（直近52週）</h2>
          <TrendRibbon rows={recentWeeks(rows, 52)} itemName={item.name} />
        </section>

        <section className="section">
          <h2 className="section__h">例年、どの月が安いか</h2>
          <MonthBand
            stats={stats}
            itemName={item.name}
            latestMonth={
              latest.reading ? Number(latest.reading.week.slice(5, 7)) : 1
            }
          />
        </section>

        <section className="section">
          <h2 className="section__h">価格そのものの推移</h2>
          <PriceLine rows={recentWeeks(rows, 52)} itemName={item.name} />
        </section>

        <section className="section">
          <h2 className="section__h">ほかの品目</h2>
          <div className="rows">
            {latestAll()
              .filter((l) => l.item.id !== item.id)
              .map((l) => (
                <Link className="row row--compact" key={l.item.id} href={`/item/${l.item.id}/`}>
                  <span className="row__name">{l.item.name}</span>
                  <span className="row__ratio">
                    {l.reading?.ratio != null
                      ? signedPercent(deviationPercent(l.reading.ratio))
                      : "—"}
                  </span>
                </Link>
              ))}
          </div>
        </section>

        <section className="section prose">
          <p className="meta">
            出典: {source.name}（{source.retrieved} 取得）。{source.note}
          </p>
        </section>
      </div>

      <StallMemo itemName={item.name} />
    </>
  );
}
