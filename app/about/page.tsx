import Link from "next/link";
import type { Metadata } from "next";
import { pageMetadata } from "@/app/site";
import { BAND_THRESHOLD } from "@/lib/logic";
import { items, latestWeek, source } from "@/lib/data";
import { formatWeek } from "@/lib/logic";

export const metadata: Metadata = pageMetadata({
  title: "この数字の読み方",
  description:
    "旬やさい相場ナビが使っているデータの出典と、平年比の意味、価格の単位、調査対象外の扱いについて説明します。",
  path: "about/",
});

export default function AboutPage() {
  return (
    <div className="wrap">
      <section className="section prose">
        <h1>この数字の読み方</h1>

        <h2 className="section__h">平年比とは</h2>
        <p>
          平年比は、その週の小売価格が<strong>平年（例年の同じ時期）の価格の何倍か</strong>
          を表す値です。1.00 が平年並みで、1.20 なら平年より2割高いことを意味します。
          この値は当サイトの推計ではなく、<strong>調査そのものが公表している値</strong>をそのまま使っています。
        </p>
        <p>
          当サイトでは平年比が {BAND_THRESHOLD.cheap} 未満を「平年より安い」、
          {BAND_THRESHOLD.expensive} を超える場合を「平年より高い」、その間を「平年並み」と表示しています。
          週ごとの小売価格はふだんでもこの程度は上下するためです。
        </p>

        <h2 className="section__h">なぜ値段そのものではなく平年比なのか</h2>
        <p>
          野菜の値段は季節で大きく動きます。値段だけを見ると、季節どおりの当たり前の値上がりと、
          天候不順による本当の高値を区別できません。平年比は同じ時期どうしを比べるので、
          「いつもの年と比べてどうか」が分かります。
        </p>
        <p>
          なお、いちばん値段の安い品目が、平年と比べていちばん割安とは限りません。
          むしろ逆になる週もあります。当サイトが「値段の安い順」の一覧を作っていないのはこのためです。
        </p>

        <h2 className="section__h">価格の単位</h2>
        <p>
          価格は<strong>すべて 円/kg</strong> です。{source.note}
        </p>

        <h2 className="section__h">月別の「安い月」の基準について</h2>
        <p>
          品目ページと月別ページで示す「例年この月は安い」は、
          <strong>その品目の調査のあった月の平均</strong>を基準にしています。
          調査は品目ごとに時期が決まっており、はくさい・だいこんのように
          半年ほど調査対象外になる品目では、基準も調査のあった月だけから作られます。
          品目をまたいで基準の意味が同じではない点にご注意ください。
        </p>

        <h2 className="section__h">「調査対象外」の表示について</h2>
        <p>
          調査は品目ごとに時期が決まっており、出回り期を外れた品目はその週の調査が行われません。
          データが壊れているわけではないので、当サイトでは「調査対象外」と表示し、
          グラフでも前後の値を線でつながずに区切っています。
        </p>

        <h2 className="section__h">対象の品目</h2>
        <ul className="chips">
          {items.map((item) => (
            <li key={item.id}>
              <Link className="chip" href={`/item/${item.id}/`}>
                {item.name}
              </Link>
            </li>
          ))}
        </ul>

        <h2 className="section__h">出典と更新</h2>
        <p>
          出典: {source.name}
          （
          <a href={source.page} rel="noreferrer noopener" target="_blank">
            公表ページ
          </a>
          ）。{source.licence}。
        </p>
        <p className="meta">
          データ取得日: {source.retrieved}／掲載している最新の調査週:{" "}
          {latestWeek ? formatWeek(latestWeek) : "—"}。
          調査は原則として毎週行われ、当サイトは取り込んだ時点のデータを表示します。
        </p>

        <h2 className="section__h">ご利用にあたって</h2>
        <p>
          表示している価格は調査時点の全国平均の目安であり、店頭での実際の価格を保証するものでは
          ありません。購入の判断はご自身の責任でお願いします。
        </p>
      </section>
    </div>
  );
}
