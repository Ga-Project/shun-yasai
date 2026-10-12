import { plotPosition, type Band } from "@/lib/logic";

/**
 * 基準（1.00）を中央の縦線に置き、そこから左右へ伸びる偏差レーン。
 * 一覧行・月別行で同じ姿・同じ目盛りを使う。
 *
 * 目盛りは log2（±1 = 0.5倍〜2.0倍）。主図・推移図と同じ空間にしておかないと、
 * 同じ形の横棒が画面ごとに違う尺度を意味することになる。
 * 「安い／平年並み／高い」の判定はここでは行わず、必ず呼び出し側が bandOf で決めた
 * tone を渡す（しきい値をここに持つと定義が増え、画面ごとに判定が食い違う）。
 */
export function DeviationLane({
  ratio,
  tone,
  label,
  decorative = false,
  muted = false,
}: {
  /** 基準を 1.00 とする比。 */
  ratio: number;
  tone: Band;
  label: string;
  /** 同じ内容を隣のテキストが読ませている場合は true。読み上げの重複を避ける。 */
  decorative?: boolean;
  /** 今週の値ではない行。帯の色で「安い／高い」を主張しない。 */
  muted?: boolean;
}) {
  const { d } = plotPosition(ratio);
  const shade = muted ? "none" : tone;
  const half = Math.abs(d) * 50;
  const pct = Math.max(half, 0.6);
  const left = d >= 0 ? "50%" : `${50 - pct}%`;
  const width = `${pct}%`;

  return (
    <span
      className="lane"
      {...(decorative ? { "aria-hidden": true } : { role: "img", "aria-label": label })}
    >
      <span className={`lane__bar lane__bar--${shade}`} style={{ left, width }} />
      <span
        className={`lane__cap lane__cap--${shade}`}
        style={d >= 0 ? { left: `calc(${left} + ${width} - 2px)` } : { left }}
      />
    </span>
  );
}

/** 欠測の行。中央基線を出さず、レーン全幅に点線を渡す。 */
export function MissingLane() {
  return (
    <span className="lane lane--none" role="img" aria-label="調査対象外">
      <span className="lane__dash" />
    </span>
  );
}
