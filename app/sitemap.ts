import type { MetadataRoute } from "next";

import { items } from "@/lib/data";
import { MONTHS } from "@/lib/logic";
import { SITE_URL, absoluteUrl } from "./site";

// next.config.mjs が output: "export" なので、これを静的にする指定が要る。
export const dynamic = "force-static";

// サイトマップ。static export では build 時に out/sitemap.xml として書き出される。
// robots.txt は置かない: robots.txt はオリジン単位でしか読まれず、この製品が置ける
// /<slug>/robots.txt はクローラに取得されない。sitemap は Search Console へ直接送信できる。
// 品目ページ・月ページは generateStaticParams と同じ配列から並べる
// （ページを足したのにサイトマップに載らない、を防ぐ）。
// lastModified / priority は付けない: ビルドのたびに全 URL を「更新された」と申告する値は
// 不正確で、検索エンジンに無視される。
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: SITE_URL },
    ...items.map((item) => ({
      url: absoluteUrl(`item/${item.id}/`),
    })),
    ...MONTHS.map((m) => ({ url: absoluteUrl(`month/${m}/`) })),
    { url: absoluteUrl("about/") },
    { url: absoluteUrl("privacy/") },
  ];
}
