import type { Metadata } from "next";

// 公開 URL の単一の出どころ。GitHub Pages のプロジェクトページ配信では公開 URL に
// /<slug> のサブパスが付く（next.config.mjs の NEXT_PUBLIC_BASE_PATH と同じ値）。
// canonical・サイトマップ・共有カードの画像がこれを取り違えると、ページは表示できても
// 画像だけ 404 になる、といったズレ方をする。全員がこの定数を見る。
// 末尾スラッシュが混ざると "...//og.png" になるので落とす。
const BASE_PATH = (process.env.NEXT_PUBLIC_BASE_PATH || "").replace(/\/$/, "");

/** 末尾スラッシュ付きの公開 URL（例: https://ga-project.github.io/shun-yasai/）。 */
export const SITE_URL = `https://ga-project.github.io${BASE_PATH}/`;

export const SITE_NAME = "旬やさい相場ナビ";

/** 共有カード（1200×630）。原版は scripts/og-card.html、書き出し先が public/og.png。 */
export const OG_IMAGE = `${SITE_URL}og.png`;
export const OG_ALT = "旬やさい相場ナビ — 野菜の値段が平年より高いか安いかを、公的統計の数字で確かめる";

/**
 * サイト内のパス（先頭スラッシュなし・末尾スラッシュ付き。例 "item/cabbage/"）を
 * 絶対 URL にする。next.config.mjs の trailingSlash: true と同じ形に揃える。
 */
export function absoluteUrl(path: string): string {
  return `${SITE_URL}${path.replace(/^\//, "")}`;
}

/**
 * 個別ページの metadata（title / description / canonical / 共有カード）。
 * layout の openGraph・twitter は子ページで指定すると丸ごと置き換わる（項目ごとに混ざらない）ので、
 * 画像やサイト名まで含めて毎回まとめて組み立てる。ここを通さず一部だけ書くと
 * 共有カードの画像が消えたページができる。
 */
export function pageMetadata({
  title,
  description,
  path,
}: {
  title: string;
  description: string;
  path: string;
}): Metadata {
  const url = absoluteUrl(path);
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      type: "website",
      locale: "ja_JP",
      siteName: SITE_NAME,
      url,
      images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: OG_ALT }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [{ url: OG_IMAGE, alt: OG_ALT }],
    },
  };
}
