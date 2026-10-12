// 同梱データ（data/prices.json）が表示に耐える形かを検査する。
// 公開元の Excel の構成が変わったときに、気づかないまま壊れた数字を出さないための防波堤。
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const data = JSON.parse(
  readFileSync(fileURLToPath(new URL("../data/prices.json", import.meta.url)), "utf8"),
);

test("出典を表示するのに必要な情報が揃っている", () => {
  for (const key of ["name", "page", "file", "licence", "retrieved", "unit", "note"]) {
    assert.ok(data.source[key], `source.${key} が空`);
  }
  assert.match(data.source.retrieved, /^\d{4}-\d{2}-\d{2}$/);
  assert.ok(data.source.page.startsWith("https://"), "出典リンクが https でない");
});

test("価格の単位は全品目で共通（品目ごとに持たない）", () => {
  // 全品目が同じ単位なので品目間の価格比較が成立する。品目ごとに単位を持たせると、
  // 実際には同一単位なのに比較できないという誤った制約を UI に持ち込むことになる。
  assert.equal(data.source.unit, "円/kg");
  for (const item of data.items) {
    assert.equal(item.unit, undefined, `${item.name} が品目ごとの単位を持っている`);
  }
});

test("調査対象の10品目が揃っている", () => {
  assert.equal(data.items.length, 10);
  for (const item of data.items) {
    assert.match(item.id, /^[a-z]+$/, `id が URL に使えない: ${item.id}`);
    assert.ok(item.name.length > 0);
  }
  const ids = data.items.map((i) => i.id);
  assert.equal(new Set(ids).size, ids.length, "品目 id が重複している");
});

test("週は昇順に並び、重複が無い", () => {
  assert.ok(data.weeks.length > 100, "週数が少なすぎる");
  for (let i = 1; i < data.weeks.length; i += 1) {
    assert.ok(data.weeks[i] > data.weeks[i - 1], `週が昇順でない: ${data.weeks[i]}`);
  }
});

test("全品目が全週ぶんの行を持つ（行のずれを検出する）", () => {
  for (const item of data.items) {
    const rows = data.series[item.id];
    assert.ok(Array.isArray(rows), `${item.name} の系列が無い`);
    assert.equal(rows.length, data.weeks.length, `${item.name} の行数が週数と違う`);
    for (let i = 0; i < rows.length; i += 1) {
      assert.equal(rows[i].week, data.weeks[i], `${item.name} の週がずれている`);
    }
  }
});

test("価格と平年比は妥当な範囲に収まる", () => {
  for (const item of data.items) {
    for (const row of data.series[item.id]) {
      if (row.price !== null) {
        assert.ok(
          Number.isFinite(row.price) && row.price > 0 && row.price < 100000,
          `${item.name} ${row.week} の価格が異常: ${row.price}`,
        );
      }
      if (row.ratio !== null) {
        assert.ok(
          Number.isFinite(row.ratio) && row.ratio > 0.1 && row.ratio < 10,
          `${item.name} ${row.week} の平年比が異常: ${row.ratio}`,
        );
      }
    }
  }
});

test("どの品目にも表示できる数字が最低1つある", () => {
  for (const item of data.items) {
    const withPrice = data.series[item.id].filter((r) => r.price !== null);
    assert.ok(withPrice.length > 0, `${item.name} に価格が1つも無い`);
  }
});

test("最新週に数字がある品目が1つ以上ある（一覧が空にならない）", () => {
  const latest = data.weeks[data.weeks.length - 1];
  const inSeason = data.items.filter((item) => {
    const row = data.series[item.id].find((r) => r.week === latest);
    return row && row.price !== null;
  });
  assert.ok(inSeason.length > 0, "最新週に数字のある品目が無い");
});

test("価格と平年比の欠測は必ず対応している", () => {
  // 片方だけ欠けると「今週調査された品目」の判定が崩れ、
  // 一覧に出ているのに帯を持たない品目が生まれる。
  for (const item of data.items) {
    for (const row of data.series[item.id]) {
      assert.equal(
        row.price === null,
        row.ratio === null,
        `${item.name} ${row.week} で価格と平年比の欠測が食い違う`,
      );
    }
  }
});

test("平年比は 0.2〜5.0 に収まる（百分率表記への変更を検出する）", () => {
  for (const item of data.items) {
    for (const row of data.series[item.id]) {
      if (row.ratio === null) continue;
      assert.ok(
        row.ratio >= 0.2 && row.ratio <= 5.0,
        `${item.name} ${row.week} の平年比 ${row.ratio} が想定の桁でない`,
      );
    }
  }
});
