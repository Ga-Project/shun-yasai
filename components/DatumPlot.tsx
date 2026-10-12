import type { Latest } from "@/lib/data";
import { bandOf, deviationPercent, formatPrice, plotPosition, signedPercent, type Band } from "@/lib/logic";

/**
 * 平年線からの偏差を、1本の基準線と直交するステムで示す主図。
 *
 * 目盛りは log2(平年比)。平年比の分布が非対称（中央値 1.08 / 最大 3.37 / 最小 0.54）なので、
 * 線形の対称目盛りだと上振れが必ず振り切れる。log2 なら「2倍」と「半分」が
 * 基準線から等距離になり、上下の見え方が釣り合う。
 */
const CAP = 1; // log2 の表示上限。±1 = 0.5倍〜2.0倍

/** 目盛り。推移図（TrendRibbon）と同じ刻みにして、2つの図の軸を揃える。 */
const GRID: { ratio: number; label: string }[] = [
  { ratio: 2, label: "2.0倍" },
  { ratio: 1.5, label: "1.5倍" },
  { ratio: 0.75, label: "0.75倍" },
  { ratio: 0.5, label: "0.5倍" },
];

type Plotted = {
  latest: Latest;
  ratio: number;
  d: number;
  capped: "low" | "high" | null;
  percent: number;
  tone: Band;
};

function plot(rows: Latest[]): Plotted[] {
  const out: Plotted[] = [];
  for (const latest of rows) {
    const ratio = latest.reading?.ratio;
    if (ratio === null || ratio === undefined) continue;
    const { d, capped } = plotPosition(ratio, CAP);
    // 帯の判定は bandOf に一本化する。ここに独自のしきい値を持つと、
    // 同じ画面の見出し（bandOf で数える）と図（別のしきい値）が食い違う。
    out.push({
      latest,
      ratio,
      d,
      capped,
      percent: deviationPercent(ratio),
      tone: bandOf(ratio) ?? "normal",
    });
  }
  // 安い→高い。一覧（買い時順）と同じ並びにする。
  return out.sort((a, b) => a.ratio - b.ratio);
}

const FILL: Record<Band, string> = {
  cheap: "var(--dev-low-fill)",
  normal: "var(--dev-mid-fill)",
  expensive: "var(--dev-high-fill)",
};

const INK: Record<Band, string> = {
  cheap: "var(--dev-low-ink)",
  normal: "var(--dev-mid-ink)",
  expensive: "var(--dev-high-ink)",
};

function describe(rows: Plotted[]): string {
  return rows
    .map((r) => `${r.latest.item.name}は平年比${r.ratio.toFixed(2)}倍（${signedPercent(r.percent)}）`)
    .join("、");
}

/** 端点の記号。色を落としても状態が判るよう、形だけで3状態を区別する。 */
function Node({
  tone,
  x,
  y,
  capped,
}: {
  tone: Band;
  x: number;
  y: number;
  capped: "low" | "high" | null;
}) {
  const fill = FILL[tone];
  if (tone === "normal") {
    return <rect x={x - 7} y={y - 1.5} width={14} height={3} fill={fill} />;
  }
  const up = tone === "expensive";
  const tri = (offset: number) =>
    up
      ? `${x},${y - 12 - offset} ${x - 6},${y - offset} ${x + 6},${y - offset}`
      : `${x},${y + 12 + offset} ${x - 6},${y + offset} ${x + 6},${y + offset}`;
  return (
    <>
      <polygon points={tri(0)} fill={fill} />
      {capped !== null ? <polygon points={tri(9)} fill={fill} /> : null}
    </>
  );
}

/**
 * ラベルは既定でノードの外側に置くが、描画域からはみ出す場合は内側へ折り返す。
 * 実データの下限は 0.54 倍まであり、外側固定だと安値の品目でラベルが消える。
 */
function labelY(d: number, y: number, bottomLimit: number): number {
  const outside = d >= 0 ? y - 24 : y + 34;
  const inside = d >= 0 ? y + 30 : y - 20;
  const min = 18;
  if (outside < min || outside > bottomLimit) {
    return Math.max(min, Math.min(bottomLimit, inside));
  }
  return outside;
}

export function DatumPlot({
  rows,
  compact = false,
  title = "今週の平年比",
}: {
  rows: Latest[];
  /** 品目ページの「今週の位置」用。ラベル帯を省き、縦を詰める。 */
  compact?: boolean;
  /** 出回り期外の品目では「今週」と言えないため、呼び出し側で言い換える。 */
  title?: string;
}) {
  const data = plot(rows);
  if (data.length === 0) return null;

  const W = 1000;
  const H = compact ? 240 : 452;
  const BASE = compact ? 118 : 200;
  const SPAN = compact ? 92 : 180;
  const RULE_Y = 396;
  const slot = W / data.length;
  const AXIS_X = 84; // 目盛りラベルのぶん、プロットを右へ寄せる

  const gridRows = GRID.map((g) => ({
    ...g,
    y: BASE - Math.max(-CAP, Math.min(CAP, Math.log2(g.ratio))) * SPAN,
  }));

  const VW = 640;
  // 狭い画面では viewBox が容器幅まで縮むので、作図上の文字は 343/640 倍で描かれる。
  // 実効 12px 以上にするため、narrow 側の文字は wide より大きく取る。
  const vfs = 24;
  const vfsSmall = 23;
  const rowH = 56;
  const VH = data.length * rowH + 52;
  const vBase = VW * 0.52;
  const vSpan = VW * 0.34;

  return (
    <figure className="figure">
      {/* 横基線版（広い画面） */}
      <svg
        className="figure__svg figure__svg--wide"
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="xMidYMid meet"
        role="img"
      >
        <title>{title}</title>
        <desc>{describe(data)}</desc>

        {gridRows.map((g) => (
          <g key={g.label}>
            <line
              x1={AXIS_X}
              y1={g.y}
              x2={W}
              y2={g.y}
              stroke="var(--line-hair)"
              strokeWidth={1}
            />
            <text
              x={AXIS_X - 8}
              y={g.y + 4}
              fontSize={13}
              textAnchor="end"
              fill="var(--ink-3)"
              className="datum-label"
            >
              {g.label}
            </text>
          </g>
        ))}

        <line x1={AXIS_X} y1={BASE} x2={W} y2={BASE} stroke="var(--datum)" strokeWidth={3} />
        <text
          x={AXIS_X - 8}
          y={BASE + 4}
          fontSize={13}
          textAnchor="end"
          fill="var(--ink-2)"
          className="datum-label"
        >
          平年（1.00）
        </text>

        {compact ? null : (
          <line
            x1={0}
            y1={RULE_Y}
            x2={W}
            y2={RULE_Y}
            stroke="var(--line-hair)"
            strokeWidth={1}
          />
        )}

        {data.map((r, i) => {
          const usable = W - AXIS_X;
          const cx = AXIS_X + (usable / data.length) * i + usable / data.length / 2;
          const y = BASE - r.d * SPAN;
          const top = Math.min(BASE, y);
          const height = Math.max(Math.abs(BASE - y), r.tone === "normal" ? 6 : 0);
          // 非compact ではラベル帯を分ける罫より下へ出さない（品目名と重なるため）。
          const ly = labelY(r.d, y, compact ? H - 8 : RULE_Y - 8);
          return (
            <g key={r.latest.item.id}>
              <rect x={cx - 5} y={top} width={10} height={height} fill={FILL[r.tone]} />
              <Node tone={r.tone} x={cx} y={y} capped={r.capped} />
              <text
                x={cx}
                y={ly}
                fontSize={18}
                fontWeight={700}
                textAnchor="middle"
                fill={INK[r.tone]}
                className="datum-label"
              >
                {r.capped === "high" ? "≫ " : r.capped === "low" ? "≪ " : ""}
                {signedPercent(r.percent)}
              </text>
              {compact ? null : (
                <>
                  <text
                    x={cx}
                    y={420}
                    fontSize={17}
                    textAnchor="middle"
                    fill="var(--ink)"
                    fontWeight={700}
                  >
                    {r.latest.item.name}
                  </text>
                  <text
                    x={cx}
                    y={446}
                    fontSize={15}
                    textAnchor="middle"
                    fill="var(--ink-3)"
                    className="datum-label"
                  >
                    {r.latest.reading?.price !== null && r.latest.reading?.price !== undefined
                      ? formatPrice(r.latest.reading.price)
                      : "—"}
                  </text>
                </>
              )}
            </g>
          );
        })}
      </svg>

      {/* 縦基線版（狭い画面）。横スクロールを作らないため、90度回した姿に差し替える。
          compact でも必ず描く（描かないと狭い画面で図そのものが消える）。 */}
      <svg
        className="figure__svg figure__svg--narrow"
        viewBox={`0 0 ${VW} ${VH}`}
        preserveAspectRatio="xMidYMid meet"
        role="img"
      >
        <title>{title}</title>
        <desc>{describe(data)}</desc>
        {GRID.map((g) => {
          const gx = vBase + Math.max(-CAP, Math.min(CAP, Math.log2(g.ratio))) * vSpan;
          return (
            <g key={`v-${g.label}`}>
              <line
                x1={gx}
                y1={0}
                x2={gx}
                y2={VH - 34}
                stroke="var(--line-hair)"
                strokeWidth={1}
              />
              <text
                x={gx}
                y={VH - 8}
                fontSize={vfsSmall}
                textAnchor="middle"
                fill="var(--ink-3)"
                className="datum-label"
              >
                {g.label}
              </text>
            </g>
          );
        })}
        <line x1={vBase} y1={0} x2={vBase} y2={VH - 34} stroke="var(--datum)" strokeWidth={3} />
        <text
          x={vBase}
          y={VH - 8}
          fontSize={vfsSmall}
          textAnchor="middle"
          fill="var(--ink-2)"
          className="datum-label"
        >
          平年
        </text>
        {data.map((r, i) => {
          const cy = i * rowH + rowH / 2;
          const x = vBase + r.d * vSpan;
          const left = Math.min(vBase, x);
          const width = Math.max(Math.abs(x - vBase), r.tone === "normal" ? 6 : 0);
          const outward = Math.abs(r.d) <= 0.82;
          return (
            <g key={r.latest.item.id}>
              {compact ? null : (
                <text x={0} y={cy + 6} fontSize={vfs} fill="var(--ink)" fontWeight={700}>
                  {r.latest.item.name}
                </text>
              )}
              <rect x={left} y={cy - 7} width={width} height={14} fill={FILL[r.tone]} />
              <rect
                x={r.d >= 0 ? x : x - 2}
                y={cy - 10}
                width={2}
                height={20}
                fill={INK[r.tone]}
              />
              <text
                x={outward ? (r.d >= 0 ? x + 10 : x - 10) : r.d >= 0 ? x - 10 : x + 10}
                y={cy + 7}
                fontSize={vfs}
                fontWeight={700}
                textAnchor={outward ? (r.d >= 0 ? "start" : "end") : r.d >= 0 ? "end" : "start"}
                fill={INK[r.tone]}
                className="datum-label"
              >
                {r.capped === "high" ? "≫" : r.capped === "low" ? "≪" : ""}
                {signedPercent(r.percent)}
              </text>
            </g>
          );
        })}
      </svg>

      <figcaption className="meta">
        目盛りは平年比の対数。基準線からの距離が同じなら、上は「2倍」下は「半分」まで同じ幅で表します。
      </figcaption>

      {compact ? null : (
        <details>
          <summary>数値表で見る</summary>
          <div className="table-scroll">
            <table>
              <caption className="visually-hidden">今週の品目別の価格と平年比</caption>
              <thead>
                <tr>
                  <th scope="col">品目</th>
                  <th scope="col">価格（円/kg）</th>
                  <th scope="col">平年比</th>
                  <th scope="col">平年との差</th>
                </tr>
              </thead>
              <tbody>
                {data.map((r) => (
                  <tr key={r.latest.item.id}>
                    <th scope="row">{r.latest.item.name}</th>
                    <td>
                      {r.latest.reading?.price !== null && r.latest.reading?.price !== undefined
                        ? formatPrice(r.latest.reading.price)
                        : "—"}
                    </td>
                    <td>{r.ratio.toFixed(2)}</td>
                    <td>{signedPercent(r.percent)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
    </figure>
  );
}
