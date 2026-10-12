import type { Reading } from "@/lib/logic";
import { cappedAt, formatPrice, formatWeek, splitSegments } from "@/lib/logic";

/**
 * 平年比の推移。y は log2(平年比)、y=1.00 の平年線を全幅に固定する。
 * 欠測区間は線を分断する（線形補間は統計の改竄になるため絶対に繋がない）。
 * 分断の判定は lib/logic の splitSegments に置き、テストから触れるようにしている。
 */
const W = 1000;
const H = 320;
const PAD_L_WIDE = 62;
const PAD_L_NARROW = 150;
const PAD_R = 16;
const PAD_T = 16;
const PAD_B = 34;
const CAP_HI = 1.2;
const CAP_LO = -1;


const PLOT_H = H - PAD_T - PAD_B;

function yOf(ratio: number): number {
  const clamped = Math.max(CAP_LO, Math.min(CAP_HI, Math.log2(ratio)));
  const t = (clamped - CAP_LO) / (CAP_HI - CAP_LO);
  return PAD_T + (1 - t) * PLOT_H;
}

const GRID: { ratio: number; label: string }[] = [
  { ratio: 2, label: "2.0倍" },
  { ratio: 1.5, label: "1.5倍" },
  { ratio: 1, label: "平年" },
  { ratio: 0.75, label: "0.75倍" },
  { ratio: 0.5, label: "0.5倍" },
];

export function TrendRibbon({ rows, itemName }: { rows: Reading[]; itemName: string }) {
  if (rows.length === 0) return null;
  const { gaps } = splitSegments(rows);
  const withRatio = rows.filter((r) => r.ratio !== null);
  const cappedCount = rows.filter(
    (r) => r.ratio !== null && cappedAt(r.ratio, CAP_LO, CAP_HI) !== null,
  ).length;

  return (
    <figure className="figure">
      <Chart rows={rows} itemName={itemName} narrow={false} />
      <Chart rows={rows} itemName={itemName} narrow />

      <figcaption className="meta">
        上に離れるほど平年より高く、下に離れるほど安い週です。
        {gaps.length > 0
          ? "点の網かけの区間は調査対象外で、値をつないでいません。"
          : "この期間に調査対象外の週はありません。"}
        {cappedCount > 0
          ? `「≫」は目盛りの上限（約2.3倍）を超えた週で、実際の値は下の表で確認できます（${cappedCount}週）。`
          : ""}
      </figcaption>

      <details>
        <summary>
          数値表で見る（{rows.length}週ぶん・うち調査 {withRatio.length} 回）
        </summary>
        <div className="table-scroll">
          <table>
            <caption className="visually-hidden">{itemName}の週別の価格と平年比</caption>
            <thead>
              <tr>
                <th scope="col">週</th>
                <th scope="col">価格（円/kg）</th>
                <th scope="col">平年比</th>
              </tr>
            </thead>
            <tbody>
              {[...rows].reverse().map((row) => (
                <tr key={row.week}>
                  <th scope="row">{formatWeek(row.week)}</th>
                  <td>{row.price === null ? "調査対象外" : formatPrice(row.price)}</td>
                  <td>{row.ratio === null ? "—" : row.ratio.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}

/**
 * narrow は狭い画面用。幾何は同じで文字だけ大きくする。
 * viewBox は容器幅に合わせて縮むので、作図上 13px の文字は 375px 幅では 4.5px になる。
 */
function Chart({
  rows,
  itemName,
  narrow,
}: {
  rows: Reading[];
  itemName: string;
  narrow: boolean;
}) {
  const fs = narrow ? 38 : 13;

  const PAD_L = narrow ? PAD_L_NARROW : PAD_L_WIDE;
  const PLOT_W = W - PAD_L - PAD_R;
  const step = rows.length > 1 ? PLOT_W / (rows.length - 1) : 0;
  const xOf = (index: number) => PAD_L + index * step;
  const baseY = yOf(1);
  const { segments, gaps } = splitSegments(rows);

  const line = (pts: { x: number; y: number }[]) =>
    pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");

  // 表示上限で頭打ちになった点。黙って潰すと 3.0倍 と 2.3倍 が同じ高さになるので必ず印を出す。
  const cappedPoints = rows
    .map((row, index) =>
      row.ratio === null ? null : { index, ratio: row.ratio, cap: cappedAt(row.ratio, CAP_LO, CAP_HI) },
    )
    .filter((p): p is { index: number; ratio: number; cap: "low" | "high" } => p !== null && p.cap !== null);

  const yearMarks: { x: number; year: string }[] = [];
  rows.forEach((row, i) => {
    const year = row.week.slice(0, 4);
    const prev = i > 0 ? rows[i - 1]?.week.slice(0, 4) : null;
    if (prev && prev !== year) yearMarks.push({ x: xOf(i), year });
  });

  const withRatio = rows.filter((r) => r.ratio !== null);
  const first = rows[0];
  const last = rows[rows.length - 1];
  const gapWeeks = rows.length - withRatio.length;

  return (
      <svg
        className={`figure__svg figure__svg--${narrow ? "narrow" : "wide"}`}
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="xMidYMid meet"
        role="img"
      >
        <title>{`${itemName}の平年比のうつりかわり`}</title>
        <desc>
          {first && last
            ? `${formatWeek(first.week)}から${formatWeek(last.week)}まで。${
                gapWeeks > 0 ? `うち${gapWeeks}週は調査対象外です。` : ""
              }数値は下の表で確認できます。`
            : "平年比の推移"}
        </desc>

        <defs>
          <pattern
            id="hatch-high"
            width="6"
            height="6"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(45)"
          >
            <line x1="0" y1="0" x2="0" y2="6" stroke="var(--dev-high-fill)" strokeWidth="1" />
          </pattern>
          <pattern id="dots-none" width="4" height="4" patternUnits="userSpaceOnUse">
            <circle cx="1" cy="1" r="0.5" fill="var(--dev-none)" />
          </pattern>
          <clipPath id="clip-above">
            <rect x={PAD_L} y={PAD_T} width={PLOT_W} height={baseY - PAD_T} />
          </clipPath>
          <clipPath id="clip-below">
            <rect x={PAD_L} y={baseY} width={PLOT_W} height={PAD_T + PLOT_H - baseY} />
          </clipPath>
        </defs>

        {/* 欠測区間 */}
        {gaps.map((g) => {
          const from = xOf(g.fromIndex);
          const to = xOf(g.toIndex);
          return (
            <rect
              key={`gap-${g.fromIndex}`}
              x={from}
              y={PAD_T}
              width={Math.max(to - from, 2)}
              height={PLOT_H}
              fill="url(#dots-none)"
            />
          );
        })}

        {yearMarks.map((m) => (
          <g key={m.year}>
            <line
              x1={m.x}
              y1={PAD_T}
              x2={m.x}
              y2={PAD_T + PLOT_H}
              stroke="var(--line-hair)"
              strokeWidth={1}
            />
            <text x={m.x + 4} y={H - 12} fontSize={fs} fill="var(--ink-3)" className="datum-label">
              {m.year}
            </text>
          </g>
        ))}

        {GRID.map((g) => {
          const y = yOf(g.ratio);
          const isBase = g.ratio === 1;
          return (
            <g key={g.label}>
              <line
                x1={PAD_L}
                y1={y}
                x2={W - PAD_R}
                y2={y}
                stroke={isBase ? "var(--datum)" : "var(--line-hair)"}
                strokeWidth={isBase ? 3 : 1}
              />
              <text
                x={PAD_L - 8}
                y={y + 4}
                fontSize={fs}
                textAnchor="end"
                fill={isBase ? "var(--ink-2)" : "var(--ink-3)"}
                className="datum-label"
              >
                {g.label}
              </text>
            </g>
          );
        })}

        {segments.map((seg, i) => {
          const pts = seg.map((p) => ({ x: xOf(p.index), y: yOf(p.ratio) }));
          const firstPt = pts[0];
          const lastPt = pts[pts.length - 1];
          if (!firstPt || !lastPt) return null;
          if (pts.length === 1) {
            // 前後が欠測の孤立した1週。線にならないので点で示す。
            return (
              <circle
                key={`dot-${i}`}
                cx={firstPt.x}
                cy={firstPt.y}
                r={2.5}
                fill="var(--ink-2)"
              />
            );
          }
          const area = `${line(pts)} L${lastPt.x.toFixed(1)},${baseY} L${firstPt.x.toFixed(1)},${baseY} Z`;
          return (
            <g key={`seg-${i}`}>
              <path d={area} fill="url(#hatch-high)" opacity={0.9} clipPath="url(#clip-above)" />
              <path
                d={area}
                fill="var(--dev-low-fill)"
                opacity="var(--dev-area-alpha)"
                clipPath="url(#clip-below)"
              />
              <path d={line(pts)} fill="none" stroke="var(--ink-2)" strokeWidth={2} />
            </g>
          );
        })}

        {/* 頭打ちの明示 */}
        {cappedPoints.map((p) => {
          const x = xOf(p.index);
          const y = p.cap === "high" ? PAD_T + 2 : PAD_T + PLOT_H - 2;
          return (
            <text
              key={`cap-${p.index}`}
              x={x}
              y={p.cap === "high" ? y + 11 : y - 3}
              fontSize={fs}
              textAnchor="middle"
              fill="var(--dev-high-ink)"
              className="datum-label"
            >
              {p.cap === "high" ? "≫" : "≪"}
            </text>
          );
        })}
      </svg>
  );
}
