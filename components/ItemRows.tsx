import Link from "next/link";
import type { Latest } from "@/lib/data";
import { DeviationLane, MissingLane } from "@/components/DeviationLane";
import { BAND_LABEL, deviationPercent, formatPrice, formatWeek, signedPercent } from "@/lib/logic";

function Row({ latest }: { latest: Latest }) {
  const { item, reading, band, outOfSeason } = latest;
  const ratio = reading?.ratio ?? null;
  const href = `/item/${item.id}/`;

  if (ratio === null) {
    return (
      <Link className="row" href={href}>
        <span className="row__name">{item.name}</span>
        <span className="row__price">—</span>
        <MissingLane />
        <span className="row__ratio row__ratio--none">—</span>
        <span className="state state--none">調査対象外</span>
      </Link>
    );
  }

  const tone = band ?? "normal";
  const percent = deviationPercent(ratio);

  return (
    <Link className="row" href={href}>
      <span className="row__name">{item.name}</span>
      <span className="row__price">
        {reading?.price !== null && reading?.price !== undefined ? formatPrice(reading.price) : "—"}
      </span>
      {/* 同じ内容を隣の visually-hidden が読ませるので、図は装飾扱いにする。 */}
      <DeviationLane ratio={ratio} tone={tone} label="" decorative muted={outOfSeason} />
      <span className={`row__ratio row__ratio--${outOfSeason ? "none" : tone}`}>
        {/* 見えている数字と読み上げが食い違わないよう、帯の語をそのまま読ませる。 */}
        <span aria-hidden="true">{signedPercent(percent)}</span>
        {/* 帯の語はこの直後の判定列が可視テキストで読ませるので、ここでは数値だけ。
            記号（+/−/±）は読み上げが不安定なので言葉にする。 */}
        <span className="visually-hidden">{`平年比 ${ratio.toFixed(2)}倍`}</span>
      </span>
      <span className={`state state--${outOfSeason ? "none" : tone}`}>
        {outOfSeason && reading
          ? `${formatWeek(reading.week)}の値`
          : BAND_LABEL[tone]}
      </span>
    </Link>
  );
}

export function ItemRows({ rows }: { rows: Latest[] }) {
  const inSeason = rows.filter((r) => !r.outOfSeason);
  const offSeason = rows.filter((r) => r.outOfSeason);

  return (
    <>
      <div className="lane-scale" aria-hidden="true">
        <span>品目</span>
        <span style={{ textAlign: "right" }}>価格（円/kg）</span>
        <span className="lane-scale__marks">
          <span>0.5倍</span>
          <span>平年</span>
          <span>2倍</span>
        </span>
        <span style={{ textAlign: "right" }}>平年比</span>
        <span />
      </div>
      <div className="rows">
        {inSeason.map((latest) => (
          <Row key={latest.item.id} latest={latest} />
        ))}
      </div>

      {offSeason.length > 0 ? (
        <>
          <h3 className="offseason__h">今週は調査対象外（出回り期外）</h3>
          <p className="meta offseason__note">
            調査は品目ごとに時期が決まっています。下の品目は今週の数字がありませんが、
            過去の値動きは見られます。
          </p>
          <div className="rows">
            {offSeason.map((latest) => (
              <Row key={latest.item.id} latest={latest} />
            ))}
          </div>
        </>
      ) : null}
    </>
  );
}
