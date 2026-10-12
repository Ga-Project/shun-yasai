// 直売所メモ（従属機能）のロジック。端末内に貯まる壊れた値を読んでも落ちないことを含めて確認する。
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  buildMemo,
  groupByPlace,
  isValidDate,
  margin,
  parseMemos,
  priceGap,
  sortMemos,
} from "../lib/memo.ts";

const base = {
  id: "a",
  date: "2026-09-01",
  place: "みどりの里",
  item: "トマト",
  price: 300,
  rivalPrice: null,
  cost: null,
  note: "",
};

test("原価があれば粗利を出し、無ければ出さない", () => {
  assert.equal(margin({ ...base, cost: 120 }), 180);
  assert.equal(margin(base), null);
});

test("まわりの価格との差は、自分が安いとき負になる", () => {
  assert.equal(priceGap({ ...base, price: 280, rivalPrice: 300 }), -20);
  assert.equal(priceGap({ ...base, price: 320, rivalPrice: 300 }), 20);
  assert.equal(priceGap(base), null);
});

test("壊れた保存内容を読んでも、読める分だけ拾う", () => {
  const stored = [
    { ...base, id: "ok" },
    null,
    "文字列",
    { ...base, id: "" }, // id なし
    { ...base, id: "baddate", date: "2026/09/01" }, // 日付の形式違い
    { ...base, id: "noprice", price: "300" }, // 数値でない
  ];
  const memos = parseMemos(stored);
  assert.deepEqual(memos.map((m) => m.id), ["ok"]);
});

test("配列でない保存内容は空として扱う", () => {
  assert.deepEqual(parseMemos(null), []);
  assert.deepEqual(parseMemos({ memos: [] }), []);
  assert.deepEqual(parseMemos(undefined), []);
});

test("欠けている任意項目は既定値で埋まる", () => {
  const memos = parseMemos([{ id: "x", date: "2026-09-01", price: 100 }]);
  assert.equal(memos.length, 1);
  assert.equal(memos[0].place, "");
  assert.equal(memos[0].rivalPrice, null);
  assert.equal(memos[0].cost, null);
});

test("新しい日付が上に来る", () => {
  const rows = [
    { ...base, id: "old", date: "2026-08-01" },
    { ...base, id: "new", date: "2026-09-01" },
  ];
  assert.deepEqual(sortMemos(rows).map((m) => m.id), ["new", "old"]);
});

test("店舗ごとにまとまり、件数の多い店が先に来る", () => {
  const rows = [
    { ...base, id: "1", place: "A" },
    { ...base, id: "2", place: "B" },
    { ...base, id: "3", place: "B" },
  ];
  const groups = groupByPlace(rows);
  assert.equal(groups[0].place, "B");
  assert.equal(groups[0].memos.length, 2);
  assert.equal(groups[1].place, "A");
});

test("店名が空でも捨てずにまとめる", () => {
  const groups = groupByPlace([{ ...base, id: "1", place: "  " }]);
  assert.equal(groups[0].place, "（店名なし）");
});

const draft = {
  date: "2026-09-01",
  place: " みどりの里 ",
  item: " トマト ",
  price: "300",
  rivalPrice: "",
  cost: "",
  note: " 大玉 ",
};

test("入力欄の文字列からメモを作り、前後の空白を落とす", () => {
  const result = buildMemo(draft);
  assert.equal(result.ok, true);
  assert.equal(result.memo.place, "みどりの里");
  assert.equal(result.memo.item, "トマト");
  assert.equal(result.memo.note, "大玉");
  assert.equal(result.memo.price, 300);
  assert.ok(result.memo.id.length > 0);
});

test("価格が空・数字でない・負のときは理由を返す", () => {
  for (const price of ["", "やすい", "-5"]) {
    const result = buildMemo({ ...draft, price });
    assert.equal(result.ok, false, `price=${price} が通ってしまう`);
    assert.ok(result.error.length > 0);
  }
});

test("日付が未選択なら理由を返す", () => {
  const result = buildMemo({ ...draft, date: "" });
  assert.equal(result.ok, false);
  assert.match(result.error, /日付/);
});

test("任意項目が数字でなければ理由を返す", () => {
  assert.equal(buildMemo({ ...draft, rivalPrice: "たかい" }).ok, false);
  assert.equal(buildMemo({ ...draft, cost: "ふつう" }).ok, false);
});

test("任意項目が空なら未入力として通る", () => {
  const result = buildMemo({ ...draft, rivalPrice: "", cost: "" });
  assert.equal(result.ok, true);
  assert.equal(result.memo.rivalPrice, null);
  assert.equal(result.memo.cost, null);
});

test("実在しない日付は受け付けない", () => {
  assert.equal(isValidDate("2026-09-01"), true);
  assert.equal(isValidDate("2026-13-01"), false);
  assert.equal(isValidDate("2026-02-30"), false);
  assert.equal(isValidDate("2026-9-1"), false);
  assert.equal(buildMemo({ ...draft, date: "2026-02-30" }).ok, false);
});

test("id が重複した保存内容は先頭の1件だけ拾う", () => {
  // 重複すると、1件消したつもりが2件消える（key と filter が id で動くため）
  const memos = parseMemos([
    { ...base, id: "dup", place: "A" },
    { ...base, id: "dup", place: "B" },
  ]);
  assert.equal(memos.length, 1);
  assert.equal(memos[0].place, "A");
});

test("負の価格は保存内容からも弾く（入口の制約と揃える）", () => {
  assert.equal(parseMemos([{ ...base, id: "neg", price: -5 }]).length, 0);
});

test("16進表記のような文字列は価格として通さない", () => {
  assert.equal(buildMemo({ ...draft, price: "0x10" }).ok, false);
  assert.equal(buildMemo({ ...draft, rivalPrice: "0x10" }).ok, false);
});
