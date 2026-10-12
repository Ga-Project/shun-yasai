import type { Reading } from "@/lib/logic";
import { formatPrice } from "@/lib/logic";

/**
 * 価格そのものの推移（副次）。
 * 縦軸の下端は必ず 0 にする。途中で軸を切ると値動きを実際より大きく見せてしまう。
 * 目盛りは品目ごとに変わるので、品目をまたいだ比較には使わせない（注記を必ず添える）。
 */
const W = 1000;
const H = 200;
const PAD_R = 12;
const PAD_T = 12;
const PAD_B = 26;

export function PriceLine({ rows, itemName }: { rows: Reading[]; itemName: string }) {
  if (rows.filter((r) => r.price !== null).length < 2) return null;
  return (
    <figure className="figure">
      <Chart rows={rows} itemName={itemName} narrow={false} />
      <Chart rows={rows} itemName={itemName} narrow />
      <figcaption className="meta">
        縦軸は0円から始めています。目盛りの上限は品目ごとに異なります。
        <strong>品目をまたいだ比較は平年比でご覧ください。</strong>
      </figcaption>
    </figure>
  );
}

/** narrow は狭い画面用。幾何は同じで文字だけ大きくする（viewBox が縮むため）。 */
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
  const PAD_L = narrow ? 150 : 52;
  const priced = rows.filter((r) => r.price !== null);
  if (priced.length < 2) return null;

  const max = Math.max(...priced.map((r) => r.price as number));
  const top = Math.ceil(max / 100) * 100;
  const plotW = W - PAD_L - PAD_R;
  const plotH = H - PAD_T - PAD_B;
  const step = rows.length > 1 ? plotW / (rows.length - 1) : 0;
  const yOf = (price: number) => PAD_T + (1 - price / top) * plotH;

  const segments: { x: number; y: number }[][] = [];
  let current: { x: number; y: number }[] = [];
  rows.forEach((row, i) => {
    if (row.price === null) {
      if (current.length) segments.push(current);
      current = [];
      return;
    }
    current.push({ x: PAD_L + i * step, y: yOf(row.price) });
  });
  if (current.length) segments.push(current);

  const ticks = [0, top / 2, top];

  return (
      <svg
        className={`figure__svg figure__svg--${narrow ? "narrow" : "wide"}`}
        viewBox={`0 0 ${W} ${H}`}
        role="img"
      >
        <title>{`${itemName}の価格の推移`}</title>
        <desc>縦軸は0から{top}円/kg。数値は「平年比のうつりかわり」の数値表で確認できます。</desc>
        {ticks.map((t) => (
          <g key={t}>
            <line
              x1={PAD_L}
              y1={yOf(t)}
              x2={W - PAD_R}
              y2={yOf(t)}
              stroke="var(--line-hair)"
              strokeWidth={1}
            />
            <text
              x={PAD_L - 6}
              y={yOf(t) + 4}
              fontSize={fs}
              textAnchor="end"
              fill="var(--ink-3)"
              className="datum-label"
            >
              {formatPrice(t)}
            </text>
          </g>
        ))}
        {segments.map((seg, i) => (
          <path
            key={i}
            d={seg.map((p, j) => `${j === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ")}
            fill="none"
            stroke="var(--ink-2)"
            strokeWidth={2}
          />
        ))}
      </svg>
  );
}
