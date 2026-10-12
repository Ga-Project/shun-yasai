// サブパス配信（<owner>.github.io/shun-yasai/）では basePath/assetPrefix が必須で、
// 未設定だと /_next/... がドメイン直下に解決されて全アセットが 404 になる。
// 一方、ローカル確認では out/ をポート直下（ルート）で配信するため basePath は空にする。
// よってビルド時の環境変数で切り替える。
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // static export（out/ に静的書き出し）。サーバランタイム不要。
  output: "export",
  // export では Next の画像最適化サーバが使えないため無効化（最適化は事前に行うか CSS で対応）。
  images: { unoptimized: true },
  // 各ルートを /path/index.html として出力し、サブディレクトリ配信で 404 を避ける。
  trailingSlash: true,
  ...(basePath ? { basePath, assetPrefix: basePath } : {}),
};

export default nextConfig;
