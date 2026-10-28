// 書き出した out/ を見て、検索・共有まわりの配線を検査する。
// ソースの grep ではなく実際の成果物を見る（metadata の組み立て違いは成果物にしか出ない）。
// CI は build の後にこのテストを回す（pages.yml）。out/ が無いとき、CI では落とし、
// ローカルでは skip と明示する（pnpm build 後に回すと有効になる）。黙って緑にはしない。
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const OUT = new URL("../out/", import.meta.url).pathname;
const built = existsSync(join(OUT, "sitemap.xml"));
if (!built && process.env.CI) {
  test("out/ が存在する（CI は build の後に test を回す）", () => {
    assert.fail("out/ がありません。pages.yml で pnpm build を test の前に回してください");
  });
}
const opts = { skip: built ? false : "out/ が無い（pnpm build の後に実行すると有効）" };

const html = (path) => readFileSync(join(OUT, path), "utf8");
const locs = built
  ? [...html("sitemap.xml").matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1])
  : [];
// build に与えた basePath の違い（CI は /shun-yasai、ローカルはルート）を吸収するため、
// 基準 URL はサイトマップの先頭（トップ）から読む。
const BASE = locs[0] ?? "";
const ids = built
  ? readdirSync(join(OUT, "item"), { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name)
  : [];

test("CI の build は Pages のサブパス付きで、基準 URL が別サイトのルートになっていない", { skip: process.env.CI ? false : "CI のみ" }, () => {
  assert.equal(BASE, "https://ga-project.github.io/shun-yasai/");
});

test("サイトマップに全品目・12か月・about が絶対URLで載り、基準 URL が1種類", opts, () => {
  assert.ok(ids.length >= 10, "品目ページが少なすぎる");
  for (const id of ids) assert.ok(locs.includes(`${BASE}item/${id}/`), `item/${id}/ が載っていない`);
  for (let m = 1; m <= 12; m++) assert.ok(locs.includes(`${BASE}month/${m}/`), `month/${m}/ が載っていない`);
  assert.ok(locs.includes(`${BASE}about/`));
  assert.ok(locs.every((l) => l.startsWith(BASE) && !l.slice(8).includes("//")), "基準 URL を取り違えた URL がある");
});

// out/ 配下の全 index.html（404 を除く）。ページを足してもここに自動で入る。
function pagesUnder(dir, rel = "") {
  const found = [];
  for (const e of readdirSync(join(dir, rel), { withFileTypes: true })) {
    const r = rel ? `${rel}/${e.name}` : e.name;
    if (e.isDirectory()) {
      if (e.name === "_next" || e.name === "404") continue;
      found.push(...pagesUnder(dir, r));
    } else if (e.name === "index.html") found.push(r);
  }
  return found;
}
const pages = built ? pagesUnder(OUT) : [];
const canonicalOf = (h) => h.match(/<link[^>]*rel="canonical"[^>]*href="([^"]*)"/)?.[1];

test("indexable な全ページが自分自身を指す canonical と大きい共有カードを持つ", opts, () => {
  assert.ok(pages.length >= 25, `ページ数が少なすぎる: ${pages.length}`);
  const meta = (h, attr, name) => h.match(new RegExp(`<meta[^>]*${attr}="${name}"[^>]*>`))?.[0] ?? "";
  for (const p of pages) {
    const h = html(p);
    const self = BASE + p.replace(/index\.html$/, "");
    assert.equal(canonicalOf(h), self, `${p}: canonical が ${self} でない`);
    assert.ok(meta(h, "property", "og:image").includes(`content="${BASE}og.png"`), `${p}: og:image が無い`);
    assert.ok(meta(h, "name", "twitter:card").includes('content="summary_large_image"'), `${p}: twitter:card が大きいカードでない`);
  }
});

test("サイトマップと indexable ページの集合が両方向で一致する", opts, () => {
  const fromPages = pages.map((p) => BASE + p.replace(/index\.html$/, "")).sort();
  assert.deepEqual([...locs].sort(), fromPages);
});

test("404 は noindex で、canonical を出さない", opts, () => {
  for (const p of ["404.html", "404/index.html"]) {
    if (!existsSync(join(OUT, p))) continue;
    const h = html(p);
    assert.match(h, /<meta[^>]*name="robots"[^>]*content="[^"]*noindex/, `${p}: noindex が無い`);
    assert.equal(canonicalOf(h), undefined, `${p}: canonical が出ている`);
  }
  assert.ok(existsSync(join(OUT, "404.html")), "404.html が無い");
});

test("共有カードの画像は 1200x630 の PNG として実在する", opts, () => {
  const buf = readFileSync(join(OUT, "og.png"));
  assert.equal(buf.subarray(1, 4).toString(), "PNG");
  assert.equal(buf.readUInt32BE(16), 1200);
  assert.equal(buf.readUInt32BE(20), 630);
});

test("構造化データは妥当な JSON", opts, () => {
  const m = html("index.html").match(/<script type="application\/ld\+json">([^<]+)<\/script>/);
  assert.ok(m, "ld+json が無い");
  const ld = JSON.parse(m[1]);
  assert.equal(ld["@type"], "WebSite");
  assert.equal(ld.url, BASE);
});
