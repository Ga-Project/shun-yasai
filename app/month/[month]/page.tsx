import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { pageMetadata } from "@/app/site";
import { DeviationLane } from "@/components/DeviationLane";
import { itemsCheapInMonth, source } from "@/lib/data";
import { BAND_LABEL, bandOf, formatPrice, signedPercent } from "@/lib/logic";

const MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

export function generateStaticParams() {
  return MONTHS.map((month) => ({ month: String(month) }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ month: string }>;
}): Promise<Metadata> {
  const { month } = await params;
  return pageMetadata({
    title: `${Number(month)}月に安い野菜`,
    description: `${Number(month)}月に例年安くなる野菜を、農林水産省の公的統計の月別平均価格から並べています。`,
    path: `month/${Number(month)}/`,
  });
}

export default async function MonthPage({ params }: { params: Promise<{ month: string }> }) {
  const { month } = await params;
  const m = Number(month);
  if (!MONTHS.includes(m)) notFound();

  const ranked = itemsCheapInMonth(m);
  // 見出しの件数・数字の色・レーンの色を、すべて bandOf 一つから導く。
  const cheap = ranked.filter((r) => bandOf(r.stat.relative) === "cheap");

  return (
    <div className="wrap">
      <section className="section">
        <p className="meta">
          過去の調査週をならした、{m}月の平均価格です。
          <br />
          価格はすべて 円/kg（全国平均・税込・特売を除く）
        </p>
        <h1 className="lede">
          {cheap.length > 0
            ? `${m}月は ${cheap.length} 品目が例年より安くなります。`
            : `${m}月に、例年より目立って安くなる品目はありません。`}
        </h1>
        <p className="meta prose">
          基準は<strong>その品目の調査のあった月の平均</strong>です。品目によって調査のある月が
          違うため、基準も品目ごとに変わります。
        </p>
      </section>

      <section className="section">
        <h2 className="section__h">{m}月の安い順</h2>
        <div className="lane-scale lane-scale--month" aria-hidden="true">
          <span>品目</span>
          <span style={{ textAlign: "right" }}>{m}月の平均</span>
          <span className="lane-scale__marks">
            <span>0.5倍</span>
            <span>基準</span>
            <span>2倍</span>
          </span>
          <span style={{ textAlign: "right" }}>差</span>
        </div>
        <div className="rows">
          {ranked.map(({ item, stat }) => {
            const relative = stat.relative ?? 1;
            const diff = Math.round((relative - 1) * 100);
            const tone = bandOf(stat.relative) ?? "normal";
            return (
              <Link className="row row--month" key={item.id} href={`/item/${item.id}/`}>
                <span className="row__name">{item.name}</span>
                <span className="row__price">
                  {stat.averagePrice === null ? "—" : formatPrice(stat.averagePrice)}
                </span>
                <DeviationLane ratio={relative} tone={tone} label="" decorative />
                <span className={`row__ratio row__ratio--${tone}`}>
                  <span aria-hidden="true">{signedPercent(diff)}</span>
                  <span className="visually-hidden">
                    {`調査のあった月の平均より ${signedPercent(diff)}、${BAND_LABEL[tone]}`}
                  </span>
                </span>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="section">
        <details>
          <summary>数値表で見る</summary>
          <div className="table-scroll">
            <table>
              <caption className="visually-hidden">{m}月の品目別平均価格</caption>
              <thead>
                <tr>
                  <th scope="col">品目</th>
                  <th scope="col">{m}月の平均価格（円/kg）</th>
                  <th scope="col">調査月の平均との差</th>
                  <th scope="col">調査週数</th>
                </tr>
              </thead>
              <tbody>
                {ranked.map(({ item, stat }) => (
                  <tr key={item.id}>
                    <th scope="row">
                      <Link href={`/item/${item.id}/`}>{item.name}</Link>
                    </th>
                    <td>{stat.averagePrice === null ? "—" : formatPrice(stat.averagePrice)}</td>
                    <td>{signedPercent(Math.round(((stat.relative ?? 1) - 1) * 100))}</td>
                    <td>{stat.samples}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      </section>

      <section className="section">
        <h2 className="section__h">ほかの月</h2>
        <ul className="chips">
          {MONTHS.filter((x) => x !== m).map((x) => (
            <li key={x}>
              <Link className="chip" href={`/month/${x}/`}>
                {x}月
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="section prose">
        <p className="meta">
          この表は月ごとの平均価格の比較で、いま買い時かどうかは示しません。
          今週の状況は <Link href="/">今週の一覧</Link> をご覧ください。出典: {source.name}。
        </p>
      </section>
    </div>
  );
}
