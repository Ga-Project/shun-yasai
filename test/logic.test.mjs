// 価格の読み解きロジックの単体テスト。
// lib/logic.ts を直接読み込む（Node の型ストリップが効くので、ビルドを挟まない）。
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  BAND_THRESHOLD,
  bandOf,
  cappedAt,
  compareForList,
  deviationPercent,
  formatWeek,
  latestReading,
  monthlyStats,
  recentWeeks,
  signedPercent,
  splitSegments,
} from "../lib/logic.ts";

test("平年比は 1.00 を中心に3つの帯へ分かれる", () => {
  assert.equal(bandOf(0.8), "cheap");
  assert.equal(bandOf(1.0), "normal");
  assert.equal(bandOf(1.4), "expensive");
});

test("帯の境目は下側を安い・上側を高いに含めない（境界そのものは平年並み）", () => {
  assert.equal(bandOf(BAND_THRESHOLD.cheap), "normal", "0.95 ちょうどは平年並み");
  assert.equal(bandOf(BAND_THRESHOLD.cheap - 0.0001), "cheap");
  assert.equal(bandOf(BAND_THRESHOLD.expensive), "normal", "1.05 ちょうどは平年並み");
  assert.equal(bandOf(BAND_THRESHOLD.expensive + 0.0001), "expensive");
});

test("欠測の平年比は帯を持たない", () => {
  assert.equal(bandOf(null), null);
});

test("平年比は「何%高い/安い」に変換できる", () => {
  assert.equal(deviationPercent(1.12), 12);
  assert.equal(deviationPercent(0.88), -12);
  assert.equal(deviationPercent(1.0), 0);
});

test("最新の読みは欠測を飛ばして遡る", () => {
  const rows = [
    { week: "2026-01-05", price: 100, ratio: 1.0 },
    { week: "2026-01-12", price: 120, ratio: 1.2 },
    { week: "2026-01-19", price: null, ratio: null },
  ];
  assert.equal(latestReading(rows)?.week, "2026-01-12");
});

test("全て欠測なら最新の読みは無い", () => {
  assert.equal(latestReading([{ week: "2026-01-05", price: null, ratio: null }]), null);
});

test("一覧は安い順に並び、時期外の品目は最後へ送られる", () => {
  const rows = [
    { name: "高い", outOfSeason: false, ratio: 1.3 },
    { name: "時期外", outOfSeason: true, ratio: 0.5 },
    { name: "安い", outOfSeason: false, ratio: 0.8 },
  ];
  const order = [...rows].sort(compareForList).map((r) => r.name);
  assert.deepEqual(order, ["安い", "高い", "時期外"]);
});

test("平年比を持たない品目は時期内でも後ろへ回る", () => {
  const rows = [
    { name: "比率なし", outOfSeason: false, ratio: null },
    { name: "比率あり", outOfSeason: false, ratio: 1.9 },
  ];
  const order = [...rows].sort(compareForList).map((r) => r.name);
  assert.deepEqual(order, ["比率あり", "比率なし"]);
});

test("月別平均は複数年をまとめ、調査のあった月の平均に対する比を返す", () => {
  const rows = [
    { week: "2024-01-08", price: 100, ratio: null },
    { week: "2025-01-06", price: 200, ratio: null }, // 1月 平均 150
    { week: "2024-07-08", price: 50, ratio: null },
    { week: "2025-07-07", price: 50, ratio: null }, // 7月 平均 50
  ];
  const stats = monthlyStats(rows);
  const jan = stats.find((s) => s.month === 1);
  const jul = stats.find((s) => s.month === 7);
  assert.equal(jan?.averagePrice, 150);
  assert.equal(jul?.averagePrice, 50);
  assert.equal(jan?.samples, 2);
  // 調査のあった月の平均は (150+50)/2 = 100 なので、1月は 1.5 倍・7月は 0.5 倍
  assert.equal(jan?.relative, 1.5);
  assert.equal(jul?.relative, 0.5);
});

test("月別平均は12か月ぶん返し、データの無い月は欠測にする", () => {
  const stats = monthlyStats([{ week: "2025-03-03", price: 100, ratio: null }]);
  assert.equal(stats.length, 12);
  assert.equal(stats.find((s) => s.month === 3)?.averagePrice, 100);
  assert.equal(stats.find((s) => s.month === 9)?.averagePrice, null);
  assert.equal(stats.find((s) => s.month === 9)?.samples, 0);
});

test("週の表示は和暦を使わず年月日で読める形にする", () => {
  assert.equal(formatWeek("2026-08-24"), "2026年8月24日の週");
});


// ── 図に渡す行の作り方 ────────────────────────────────────────────
// 推移図に「欠測を取り除いた行」を渡すと、調査対象外の期間が詰められて
// 前後が地続きに見える。分断ロジックが正しくても、そこへ到達しなくなる。

test("recentWeeks は欠測行をそのまま残す（図に渡すのはこちら）", () => {
  const rows = [
    { week: "2026-01-05", price: 1, ratio: 1 },
    { week: "2026-01-12", price: null, ratio: null },
    { week: "2026-01-19", price: 3, ratio: 1 },
  ];
  assert.equal(recentWeeks(rows, 3).length, 3);
  assert.equal(recentWeeks(rows, 3)[1].price, null, "欠測が落ちている");
});

test("欠測をまたいで点をつながない（区間が分かれる）", () => {
  const rows = [
    { week: "2026-01-05", price: 1, ratio: 1.1 },
    { week: "2026-01-12", price: null, ratio: null },
    { week: "2026-01-19", price: 3, ratio: 0.9 },
  ];
  const { segments, gaps } = splitSegments(rows);
  assert.equal(segments.length, 2, "欠測で分断されていない");
  assert.deepEqual(segments[0].map((p) => p.index), [0]);
  assert.deepEqual(segments[1].map((p) => p.index), [2]);
  assert.equal(gaps.length, 1);
  assert.deepEqual(gaps[0], { fromIndex: 1, toIndex: 2 });
});

test("欠測が無ければ区間は1本で隙間ゼロ", () => {
  const rows = [
    { week: "2026-01-05", price: 1, ratio: 1 },
    { week: "2026-01-12", price: 2, ratio: 1 },
  ];
  const { segments, gaps } = splitSegments(rows);
  assert.equal(segments.length, 1);
  assert.equal(segments[0].length, 2);
  assert.equal(gaps.length, 0);
});

test("末尾が欠測なら、その隙間も最後まで記録される", () => {
  const rows = [
    { week: "2026-01-05", price: 1, ratio: 1 },
    { week: "2026-01-12", price: null, ratio: null },
  ];
  const { segments, gaps } = splitSegments(rows);
  assert.equal(segments.length, 1);
  assert.equal(gaps.length, 1);
  assert.equal(gaps[0].fromIndex, 1);
});

test("価格があっても平年比が無い行は区間から外れる", () => {
  const rows = [{ week: "2026-01-05", price: 100, ratio: null }];
  const { segments } = splitSegments(rows);
  assert.equal(segments.length, 0);
});

test("表示の上限を超えた値は頭打ちとして報告される", () => {
  // 上限 log2 = 1.2（約2.30倍）、下限 -1（0.5倍）
  assert.equal(cappedAt(3.0, -1, 1.2), "high");
  assert.equal(cappedAt(0.4, -1, 1.2), "low");
  assert.equal(cappedAt(1.5, -1, 1.2), null);
});

test("符号つき表記は全画面で同じ形（±0・U+2212 のマイナス）", () => {
  assert.equal(signedPercent(12), "+12%");
  assert.equal(signedPercent(0), "±0%");
  assert.equal(signedPercent(-12), "−12%");
  assert.ok(signedPercent(-1).includes("\u2212"), "ASCII ハイフンを使っている");
});
