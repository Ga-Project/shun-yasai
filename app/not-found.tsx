import Link from "next/link";
import type { Metadata } from "next";
import { ItemRows } from "@/components/ItemRows";
import { latestAll } from "@/lib/data";

export const metadata: Metadata = {
  title: "ページが見つかりません",
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <div className="wrap">
      <section className="section">
        <h1>そのページは見つかりませんでした</h1>
        <p className="meta prose">
          お探しの野菜は扱っていないか、URL が変わった可能性があります。
          扱っている品目は次のとおりです。
        </p>
      </section>
      <section className="section">
        <h2 className="section__h">今週の一覧</h2>
        <ItemRows rows={latestAll()} />
        <p className="meta" style={{ marginTop: "var(--sp-4)" }}>
          <Link href="/">トップへ戻る</Link>
        </p>
      </section>
    </div>
  );
}
