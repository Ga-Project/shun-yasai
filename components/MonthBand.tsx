import { bandOf, formatPrice, signedPercent, type Band, type MonthStat } from "@/lib/logic";

/**
 * 例年、どの月に安く買えるか。
 *
 * 「旬」そのものを示すデータは公開元に無いため、旬を推定して描かない。
 * 描けるのは (1) その月に調査があるか（＝出回り期） (2) 月ごとの平均価格が
 * 調査のあった月の平均に対して高いか安いか の2つで、それを重ねて示す。
 *
 * 広い画面は12列、狭い画面は12行に切り替える。同じ12列を縮めると
 * 文字が 6px 相当まで小さくなって読めなくなるため。
 */
const CAP = 0.4;

function toneOf(relative: number | null): Band {
  return bandOf(relative) ?? "normal";
}

function fillOf(tone: Band): string {
  return `var(--dev-${tone === "cheap" ? "low" : tone === "expensive" ? "high" : "mid"}-fill)`;
}

function inkOf(tone: Band): string {
  return `var(--dev-${tone === "cheap" ? "low" : tone === "expensive" ? "high" : "mid"}-ink)`;
}

/** 広い画面: 12列。上段＝調査の有無、下段＝基線からのステム。 */
function WideChart({
  stats,
  latestMonth,
  title,
  summary,
}: {
  stats: MonthStat[];
  latestMonth: number;
  title: string;
  summary: string;
}) {
  const W = 720;
  const H = 210;
  const PAD = 8;
  const COVER_Y = 6;
  const COVER_H = 12;
  const BASE = 108;
  const SPAN = 62;
  const LABEL_Y = 196;
  const colW = (W - PAD * 2) / 12;

  return (
    <svg
      className="figure__svg figure__svg--wide"
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="xMidYMid meet"
      role="img"
    >
      <title>{title}</title>
      <desc>{summary}</desc>

      {stats.map((s) => {
        const x = PAD + colW * (s.month - 1);
        const off = s.relative === null;
        // 調査の有無は塗りの有無＋実線/破線で示す。網かけだと地との差が
        // 1.06:1 しかなく、色を落とすと消える。
        return off ? (
          <rect
            key={`c-${s.month}`}
            x={x + 1}
            y={COVER_Y}
            width={colW - 2}
            height={COVER_H}
            fill="none"
            stroke="var(--dev-none)"
            strokeWidth={1}
            strokeDasharray="3 2"
          />
        ) : (
          <rect
            key={`c-${s.month}`}
            x={x + 1}
            y={COVER_Y}
            width={colW - 2}
            height={COVER_H}
            fill="var(--dev-mid-fill)"
          />
        );
      })}
      <text x={PAD} y={COVER_Y + COVER_H + 16} fontSize={13} fill="var(--ink-3)">
        上の帯: 調査のある月（破線の枠＝調査対象外）
      </text>

      <line x1={PAD} y1={BASE} x2={W - PAD} y2={BASE} stroke="var(--datum)" strokeWidth={3} />

      {stats.map((s) => {
        const x = PAD + colW * (s.month - 1) + colW / 2;
        const isLatest = s.month === latestMonth;
        const frame = isLatest ? (
          <rect
            x={x - colW / 2 + 1}
            y={COVER_Y}
            width={colW - 2}
            height={LABEL_Y - COVER_Y - 8}
            fill="none"
            stroke="var(--datum)"
            strokeWidth={2}
            strokeDasharray="3 3"
          />
        ) : null;
        if (s.relative === null) {
          return (
            <g key={`s-${s.month}`}>
              {frame}
              <text
                x={x}
                y={BASE + 5}
                fontSize={13}
                textAnchor="middle"
                fill="var(--ink-3)"
                className="datum-label"
              >
                —
              </text>
            </g>
          );
        }
        const tone = toneOf(s.relative);
        const dev = Math.max(-CAP, Math.min(CAP, s.relative - 1));
        const y = BASE - (dev / CAP) * SPAN;
        const diff = Math.round((s.relative - 1) * 100);
        return (
          <g key={`s-${s.month}`}>
            {frame}
            <rect
              x={x - 5}
              y={Math.min(BASE, y)}
              width={10}
              height={Math.max(Math.abs(BASE - y), 3)}
              fill={fillOf(tone)}
            />
            <text
              x={x}
              y={dev >= 0 ? y - 8 : y + 18}
              fontSize={13}
              textAnchor="middle"
              fontWeight={700}
              fill={inkOf(tone)}
              className="datum-label"
            >
              {signedPercent(diff)}
            </text>
          </g>
        );
      })}

      {stats.map((s) => (
        <text
          key={`l-${s.month}`}
          x={PAD + colW * (s.month - 1) + colW / 2}
          y={LABEL_Y}
          fontSize={14}
          textAnchor="middle"
          fill={s.month === latestMonth ? "var(--ink)" : "var(--ink-2)"}
          fontWeight={s.month === latestMonth ? 700 : 400}
          className="datum-label"
        >
          {s.month}
        </text>
      ))}
    </svg>
  );
}

/** 狭い画面: 12行。基線を縦に置き、ステムを左右へ伸ばす。 */
function NarrowChart({
  stats,
  latestMonth,
  title,
  summary,
}: {
  stats: MonthStat[];
  latestMonth: number;
  title: string;
  summary: string;
}) {
  const W = 340;
  const rowH = 30;
  const H = 12 * rowH + 34;
  const BASE_X = 214;
  const SPAN = 96;

  return (
    <svg
      className="figure__svg figure__svg--narrow"
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="xMidYMid meet"
      role="img"
    >
      <title>{title}</title>
      <desc>{summary}</desc>

      <line x1={BASE_X} y1={0} x2={BASE_X} y2={12 * rowH} stroke="var(--datum)" strokeWidth={3} />
      <text
        x={BASE_X}
        y={12 * rowH + 22}
        fontSize={13}
        textAnchor="middle"
        fill="var(--ink-2)"
        className="datum-label"
      >
        基準
      </text>

      {stats.map((s) => {
        const cy = (s.month - 1) * rowH + rowH / 2;
        const off = s.relative === null;
        const tone = toneOf(s.relative);
        const dev = off ? 0 : Math.max(-CAP, Math.min(CAP, (s.relative ?? 1) - 1));
        const x = BASE_X + (dev / CAP) * SPAN;
        const diff = off ? 0 : Math.round(((s.relative ?? 1) - 1) * 100);
        return (
          <g key={`r-${s.month}`}>
            <text
              x={4}
              y={cy + 5}
              fontSize={14}
              fill={s.month === latestMonth ? "var(--ink)" : "var(--ink-2)"}
              fontWeight={s.month === latestMonth ? 700 : 400}
              className="datum-label"
            >
              {s.month}月
            </text>
            {off ? (
              <rect
                x={44}
                y={cy - 7}
                width={26}
                height={14}
                fill="none"
                stroke="var(--dev-none)"
                strokeWidth={1}
                strokeDasharray="3 2"
              />
            ) : (
              <rect x={44} y={cy - 7} width={26} height={14} fill="var(--dev-mid-fill)" />
            )}
            {off ? (
              <text
                x={BASE_X + 10}
                y={cy + 5}
                fontSize={13}
                fill="var(--ink-3)"
                className="datum-label"
              >
                調査対象外
              </text>
            ) : (
              <>
                <rect
                  x={Math.min(BASE_X, x)}
                  y={cy - 6}
                  width={Math.max(Math.abs(x - BASE_X), 3)}
                  height={12}
                  fill={fillOf(tone)}
                />
                <text
                  x={dev >= 0 ? x + 6 : x - 6}
                  y={cy + 5}
                  fontSize={13}
                  textAnchor={dev >= 0 ? "start" : "end"}
                  fontWeight={700}
                  fill={inkOf(tone)}
                  className="datum-label"
                >
                  {signedPercent(diff)}
                </text>
              </>
            )}
          </g>
        );
      })}
    </svg>
  );
}

export function MonthBand({
  stats,
  itemName,
  latestMonth,
}: {
  stats: MonthStat[];
  itemName: string;
  /**
   * 最新の調査があった月。「今月」は静的サイトではビルド時に固定され、
   * 月が変わると黙って嘘になるので印にしない。
   */
  latestMonth: number;
}) {
  const measured = stats.filter((s) => s.relative !== null);
  if (measured.length === 0) return null;

  const cheapest = measured.reduce((a, b) => ((a.relative ?? 9) <= (b.relative ?? 9) ? a : b));
  const cheapestDiff = Math.round(((cheapest.relative ?? 1) - 1) * 100);

  const title = `${itemName}の月別の平均価格`;
  const summary =
    `${itemName}の月別の平均価格。調査のあった月の平均を基準にしています。` +
    `例年もっとも安いのは${cheapest.month}月で、基準より${Math.abs(cheapestDiff)}%安い。` +
    `破線の枠は最新の調査があった${latestMonth}月。`;

  return (
    <figure className="figure">
      <WideChart stats={stats} latestMonth={latestMonth} title={title} summary={summary} />
      <NarrowChart stats={stats} latestMonth={latestMonth} title={title} summary={summary} />

      <figcaption className="meta">
        棒は、その月の平均価格が<strong>調査のあった月ぜんたいの平均</strong>より
        何%高い（安い）かです。破線の枠は最新の調査があった月。例年もっとも安いのは{" "}
        <strong>{cheapest.month}月</strong>（{signedPercent(cheapestDiff)}／平均{" "}
        {cheapest.averagePrice !== null ? formatPrice(cheapest.averagePrice) : "—"} 円/kg）。
      </figcaption>

      <details>
        <summary>月別の数値を見る</summary>
        <div className="table-scroll">
          <table>
            <caption className="visually-hidden">{itemName}の月別平均価格</caption>
            <thead>
              <tr>
                <th scope="col">月</th>
                <th scope="col">平均価格（円/kg）</th>
                <th scope="col">調査月の平均との差</th>
                <th scope="col">調査週数</th>
              </tr>
            </thead>
            <tbody>
              {stats.map((s) => (
                <tr key={s.month}>
                  <th scope="row">{s.month}月</th>
                  <td>{s.averagePrice === null ? "調査対象外" : formatPrice(s.averagePrice)}</td>
                  <td>
                    {s.relative === null
                      ? "—"
                      : signedPercent(Math.round((s.relative - 1) * 100))}
                  </td>
                  <td>{s.samples}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}
