import type { MetadataRoute } from "next";

import { items } from "@/lib/data";
import { SITE_URL, absoluteUrl } from "./site";

// next.config.mjs が output: "export" なので、これを静的にする指定が要る。
export const dynamic = "force-static";

// サイトマップ。static export では build 時に out/sitemap.xml として書き出される。
// robots.txt は置かない: robots.txt はオリジン単位でしか読まれず、この製品が置ける
// /<slug>/robots.txt はクローラに取得されない。sitemap は Search Console へ直接送信できる。
// 品目ページ・月ページは generateStaticParams と同じ配列から並べる
// （ページを足したのにサイトマップに載らない、を防ぐ）。
export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  return [
    { url: SITE_URL, lastModified, changeFrequency: "weekly", priority: 1 },
    ...items.map((item) => ({
      url: absoluteUrl(`item/${item.id}/`),
      lastModified,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
    ...Array.from({ length: 12 }, (_, i) => ({
      url: absoluteUrl(`month/${i + 1}/`),
      lastModified,
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
    { url: absoluteUrl("about/"), lastModified, changeFrequency: "monthly", priority: 0.5 },
  ];
}
