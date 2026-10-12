import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "プライバシーポリシー",
  description: "旬やさい相場ナビにおける、アクセス解析と端末内保存の扱いについて説明します。",
};

export default function PrivacyPage() {
  return (
    <div className="wrap">
      <section className="section prose">
        <h1>プライバシーポリシー</h1>

        <h2 className="section__h">アクセス解析</h2>
        <p>
          当サイトは、どのページがどれくらい見られているかを把握するためにアクセス解析を利用しています。
          この解析は<strong>Cookie を使わず</strong>、個人を識別する情報を取得しません。
        </p>

        <h2 className="section__h">直売所の価格メモについて</h2>
        <p>
          品目ページで記録できる価格メモは、<strong>お使いの端末のブラウザ内にのみ保存</strong>されます。
          当サイトのサーバーや第三者に送信されることはありません。ブラウザの設定でサイトデータを
          消去すると、メモも消えます。
        </p>

        <h2 className="section__h">お問い合わせフォームについて</h2>
        <p>
          当サイトには、氏名・メールアドレスなどの個人情報を入力する仕組みはありません。
        </p>

        <h2 className="section__h">広告・アフィリエイトについて</h2>
        <p>
          現在、当サイトは広告およびアフィリエイトリンクを掲載していません。
          今後掲載する場合は、その旨を明示したうえで、このページの記載を更新します。
        </p>
      </section>
    </div>
  );
}
