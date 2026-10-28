// 書き出した out/ を見て、検索・共有まわりの配線を検査する。
// ソースの grep ではなく実際の成果物を見る（metadata の組み立て違いは成果物にしか出ない）。
// CI は build の後にこのテストを回す。out/ が無い・ソースより古いときは緑にせず落とす。
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const OUT = new URL("../out/", import.meta.url).pathname;
const APP = new URL("../app/", import.meta.url).pathname;
const BASE = "https://ga-project.github.io/shun-yasai/";

function newest(dir) {
  let t = 0;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    t = Math.max(t, e.isDirectory() ? newest(p) : statSync(p).mtimeMs);
  }
  return t;
}

test("out/ が存在しソースより新しい（build 後に実行する）", () => {
  assert.ok(existsSync(join(OUT, "index.html")), "out/ がありません。先に pnpm build を実行してください");
  assert.ok(
    statSync(join(OUT, "index.html")).mtimeMs >= newest(APP),
    "out/ がソースより古いです。pnpm build をやり直してください",
  );
});

function html(path) {
  return readFileSync(join(OUT, path), "utf8");
}

test("サイトマップに全品目・12か月・about が絶対URLで載る", () => {
  const xml = html("sitemap.xml");
  const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  const items = readdirSync(join(OUT, "item"), { withFileTypes: true }).filter((e) => e.isDirectory());
  assert.ok(items.length >= 10, "品目ページが少なすぎる");
  for (const e of items) assert.ok(locs.includes(`${BASE}item/${e.name}/`), `item/${e.name}/ が載っていない`);
  for (let m = 1; m <= 12; m++) assert.ok(locs.includes(`${BASE}month/${m}/`), `month/${m}/ が載っていない`);
  assert.ok(locs.includes(BASE) && locs.includes(`${BASE}about/`));
  assert.ok(locs.every((l) => l.startsWith(BASE) && !l.includes("//", 8)), "basePath を取り違えた URL がある");
});

test("indexable な全ページに自分自身を指す canonical と共有カード画像がある", () => {
  const pages = ["index.html", "about/index.html", "privacy/index.html", "month/1/index.html"];
  const item = readdirSync(join(OUT, "item"), { withFileTypes: true }).find((e) => e.isDirectory());
  pages.push(`item/${item.name}/index.html`);
  for (const p of pages) {
    const h = html(p);
    const self = BASE + p.replace(/index\.html$/, "");
    assert.ok(h.includes(`rel="canonical" href="${self}"`), `${p}: canonical が ${self} でない`);
    assert.ok(h.includes(`og:image" content="${BASE}og.png"`), `${p}: og:image が無い`);
    assert.ok(h.includes('twitter:card" content="summary_large_image"'), `${p}: twitter:card が大きいカードでない`);
  }
});

test("共有カードの画像は 1200x630 の PNG として実在する", () => {
  const buf = readFileSync(join(OUT, "og.png"));
  assert.equal(buf.subarray(1, 4).toString(), "PNG");
  assert.equal(buf.readUInt32BE(16), 1200);
  assert.equal(buf.readUInt32BE(20), 630);
});

test("構造化データは妥当な JSON で、404 には canonical を出さない", () => {
  const m = html("index.html").match(/<script type="application\/ld\+json">([^<]+)<\/script>/);
  assert.ok(m, "ld+json が無い");
  const ld = JSON.parse(m[1]);
  assert.equal(ld["@type"], "WebSite");
  assert.equal(ld.url, BASE);
  assert.ok(!html("404.html").includes('rel="canonical"'), "404 に canonical が出ている");
});
