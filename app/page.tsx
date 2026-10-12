import Link from "next/link";
import { DatumPlot } from "@/components/DatumPlot";
import { ItemRows } from "@/components/ItemRows";
import { latestAll, latestWeek, source } from "@/lib/data";
import { deviationPercent, formatWeek, signedPercent } from "@/lib/logic";

const MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

export default function Home() {
  const rows = latestAll();
  const inSeason = rows.filter((r) => !r.outOfSeason && r.reading?.ratio != null);
  const cheap = inSeason.filter((r) => r.band === "cheap");

  // 「安い品目がゼロ」の週は全体の3分の1あるので、例外ではなく通常の結果として書く。
  const nearest = inSeason.reduce<(typeof inSeason)[number] | null>((best, r) => {
    if (!best) return r;
    const a = Math.abs((r.reading?.ratio ?? 9) - 1);
    const b = Math.abs((best.reading?.ratio ?? 9) - 1);
    return a < b ? r : best;
  }, null);

  return (
    <>
      <div className="wrap">
        <section className="section">
          <p className="meta">
            {latestWeek ? formatWeek(latestWeek) : "—"}（調査分）
            <br />
            価格はすべて 円/kg（全国平均・税込・特売を除く）
          </p>

          <h1 className="lede">
            {cheap.length > 0
              ? `今週、平年より安い野菜は ${cheap.length} 品目です。`
              : "今週、平年より安い野菜はありません。"}
          </h1>

          {cheap.length === 0 && nearest ? (
            <p className="meta">
              平年にいちばん近いのは <strong>{nearest.item.name}</strong>（
              {signedPercent(deviationPercent(nearest.reading?.ratio ?? 1))}）です。
            </p>
          ) : null}

          <DatumPlot rows={inSeason} />
        </section>

        <section className="section">
          <h2 className="section__h">買い時順（平年比の低い順）</h2>
          <ItemRows rows={rows} />
        </section>

        <section className="section">
          <h2 className="section__h">月から探す</h2>
          <p className="meta prose">
            例年その月に安くなる野菜を、月ごとにまとめています。
          </p>
          <ul className="chips">
            {MONTHS.map((m) => (
              <li key={m}>
                <Link className="chip" href={`/month/${m}/`}>
                  {m}月に安い野菜
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section className="section prose">
          <h2 className="section__h">この数字は何か</h2>
          <p>
            「平年比」は、その週の価格が
            <strong>平年（例年の同じ時期）の価格の何倍か</strong>を表します。1.00 が平年並みです。
            値段そのものではなく平年との比を見ると、季節による当たり前の値上がりと、
            天候や不作による本当の高値を切り分けられます。
          </p>
          <p className="meta">
            出典: {source.name}。{source.note}
            <br />
            <Link href="/about/">この数字の読み方をくわしく見る</Link>
          </p>
        </section>
      </div>
    </>
  );
}
