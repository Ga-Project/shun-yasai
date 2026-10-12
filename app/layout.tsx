import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import "./globals.css";
import { StaleNotice } from "@/components/StaleNotice";
import { latestWeek, source } from "@/lib/data";
import { formatWeek } from "@/lib/logic";

const SITE = "旬やさい相場ナビ";
const DESCRIPTION =
  "野菜の値段が平年に比べて安いか高いかを、農林水産省の公的統計から毎週の数字で確かめられます。";

export const metadata: Metadata = {
  metadataBase: new URL("https://ga-project.github.io/shun-yasai/"),
  title: {
    default: `${SITE} — 野菜の値段は平年より高い？安い？`,
    template: `%s | ${SITE}`,
  },
  description: DESCRIPTION,
  openGraph: {
    title: `${SITE} — 野菜の値段は平年より高い？安い？`,
    description: DESCRIPTION,
    type: "website",
    locale: "ja_JP",
    siteName: SITE,
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ja">
      <body>
        {/* アクセス解析（cookieless・秘密キー不要）: 全プロダクト共通の単一 GoatCounter サイト
            「ga-project」に集約する。製品ごとの数値は path（/shun-yasai/）で区別されるので、
            GoatCounter 側でサイトを新規作成しない＝新プロダクトは自動で ga-project の新パスとして計測される。 */}
        <script
          data-goatcounter="https://ga-project.goatcounter.com/count"
          async
          src="//gc.zgo.at/count.js"
        />
        <a className="skip" href="#main">
          本文へ移動
        </a>
        <header>
          <div className="bar">
            <Link className="bar__brand" href="/">
              {SITE}
            </Link>
            <nav className="bar__nav" aria-label="サイト">
              <Link href="/about/">この数字の読み方</Link>
            </nav>
          </div>
          <StaleNotice latestWeek={latestWeek} />
        </header>
        <main id="main">{children}</main>
        <footer className="foot">
          <div className="wrap">
            <div className="foot__links">
              <Link href="/">今週の一覧</Link>
              <Link href="/about/">この数字の読み方</Link>
              <Link href="/privacy/">プライバシー</Link>
              <a href={source.page} rel="noreferrer noopener" target="_blank">
                出典（{source.name}）
              </a>
            </div>
            <p>
              出典: {source.name}。{source.note}
              価格の単位は{source.unit}。{source.licence}。
            </p>
            <p>
              データ取得日: {source.retrieved}／掲載している最新の調査週:{" "}
              {latestWeek ? formatWeek(latestWeek) : "—"}
            </p>
            <p>
              表示している価格は調査時点の全国平均の目安であり、店頭の実際の価格を
              保証するものではありません。
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
